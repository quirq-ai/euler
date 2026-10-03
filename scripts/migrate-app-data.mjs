import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, unlink, utimes } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appIds = ['innernet', 'quitter', 'instants'];
const generated = new Set(['node_modules', '.next', '.next-euler', 'dist', 'dist-euler', '.nx']);
const help = `Move personal app files left behind by Euler's apps/ to app/ rename.

  npm run migrate:app-data
  npm run migrate:app-data -- --dry-run

Stop Euler and standalone apps, then pull the new layout before running this.
All destinations are checked before changes. Existing files are never replaced.
Symlinks, junctions, unknown app folders and collisions require manual attention.
Dependencies/build outputs stay in apps/: reinstall and rebuild under app/.
`;

async function statOptional(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function inside(root, path) {
  const part = relative(root, path);
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`)) {
    throw new Error('Migration path must stay inside the Euler workspace.');
  }
  return part;
}

// Check each component, including dangling links. Never walk a junction or a
// symlink even if its current target happens to be inside the workspace.
async function inspect(root, path) {
  const parts = inside(root, path).split(sep).filter(Boolean);
  let current = root;
  let stat = await lstat(root);
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index]);
    stat = await statOptional(current);
    if (!stat) return null;
    if (stat.isSymbolicLink()) throw new Error(`Manual migration required for link: ${relative(root, current)}`);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`Destination parent is not a directory: ${relative(root, current)}`);
    }
  }
  return stat;
}

async function readJson(root, path) {
  const stat = await inspect(root, path);
  if (!stat?.isFile()) throw new Error('Pull the new app/ layout before migrating personal data.');
  return JSON.parse(await readFile(path, 'utf8'));
}

async function verifyLayout(root) {
  const manifest = await readJson(root, join(root, 'app/upstream.json'));
  const workspace = await readJson(root, join(root, 'euler.workspace.json'));
  for (const id of appIds) {
    if (manifest.version !== 1 || !manifest.applications?.some((app) => app.id === id && app.directory === `app/${id}`)
      || workspace.projects?.[id]?.directory !== `app/${id}`) {
      throw new Error('Pull the complete new app/ layout before migrating personal data.');
    }
    await readJson(root, join(root, 'app', id, 'package.json'));
  }
}

async function makeParents(root, directory) {
  let current = root;
  for (const part of inside(root, directory).split(sep).filter(Boolean)) {
    current = join(current, part);
    let stat = await inspect(root, current);
    if (!stat) {
      try { await mkdir(current); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      stat = await inspect(root, current);
    }
    if (!stat?.isDirectory()) throw new Error(`Destination parent is not a directory: ${relative(root, current)}`);
  }
}

function sameFile(a, b) {
  return b?.isFile() && a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs;
}

export async function migrateAppData(workspaceRoot, { dryRun = false } = {}) {
  const suppliedRoot = resolve(workspaceRoot);
  if ((await lstat(suppliedRoot)).isSymbolicLink()) throw new Error('Use the real workspace path, not a link.');
  const root = await realpath(suppliedRoot);
  await verifyLayout(root);
  const report = { dryRun, planned: [], moved: [], skipped: [] };
  const sourceRoot = join(root, 'apps');
  const sourceStat = await inspect(root, sourceRoot);
  if (!sourceStat) return report;
  if (!sourceStat.isDirectory()) throw new Error('Old apps path is not a directory.');
  const entries = (await readdir(sourceRoot)).sort();
  for (const entry of entries) {
    if (!appIds.includes(entry)) throw new Error(`Unrecognized old entry apps/${entry}; inspect it manually before migration.`);
  }
  const plan = [];
  async function visit(source, target, topLevel = false) {
    const stat = await inspect(root, source);
    if (!stat) throw new Error(`Source changed during inspection: ${relative(root, source)}`);
    if (stat.isDirectory()) {
      const destination = await inspect(root, target);
      if (destination && !destination.isDirectory()) throw new Error(`Destination collision: ${relative(root, target)}`);
      for (const name of (await readdir(source)).sort()) {
        const from = join(source, name);
        // Generated artifacts may themselves contain links (e.g. pnpm). Leave
        // the entire excluded entry untouched without inspecting its contents.
        if ((topLevel && generated.has(name)) || name.endsWith('.tsbuildinfo')) {
          report.skipped.push(relative(root, from));
          continue;
        }
        if (name === '.git') throw new Error(`Nested repository at ${relative(root, from)}; inspect it manually.`);
        await visit(from, join(target, name));
      }
      return;
    }
    if (!stat.isFile()) throw new Error(`Unsupported source type: ${relative(root, source)}; migrate it manually.`);
    if (await inspect(root, target)) throw new Error(`Destination collision: ${relative(root, target)}. No files have been moved.`);
    plan.push({ source, target, stat });
    report.planned.push({ from: relative(root, source), to: relative(root, target) });
  }
  // Complete the entire preflight before creating directories or moving data.
  for (const id of entries) {
    const source = join(sourceRoot, id);
    if (!(await inspect(root, source))?.isDirectory()) throw new Error(`Old apps/${id} is not a directory.`);
    await visit(source, join(root, 'app', id), true);
  }
  if (dryRun) return report;
  for (const { source, target, stat } of plan) {
    if (!sameFile(stat, await inspect(root, source))) throw new Error(`Source changed: ${relative(root, source)}. Stop all apps before retrying.`);
    await makeParents(root, dirname(target));
    if (await inspect(root, target)) throw new Error(`Destination appeared during migration: ${relative(root, target)}. Nothing was overwritten.`);
    // rename() can overwrite on POSIX. Exclusive copying provides the same
    // no-overwrite guarantee on Windows, macOS and Linux, including races.
    await copyFile(source, target, constants.COPYFILE_EXCL);
    await utimes(target, stat.atime, stat.mtime);
    if (!sameFile(stat, await inspect(root, source))) {
      throw new Error(`Source changed while copying ${relative(root, source)}. Both copies were kept; inspect them manually.`);
    }
    await unlink(source);
    report.moved.push(relative(root, target));
  }
  return report;
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) { console.log(help); return; }
  if (args.some((arg) => arg !== '--dry-run')) throw new Error('Unknown option. Use --help for migration instructions.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const report = await migrateAppData(root, { dryRun: args.includes('--dry-run') });
  for (const item of report.planned) console.log(`${report.dryRun ? 'Would move' : 'Moved'} ${item.from} -> ${item.to}`);
  for (const path of report.skipped) console.log(`Left generated artifact: ${path}`);
  console.log(report.planned.length ? `${report.planned.length} personal file(s) ${report.dryRun ? 'ready to migrate' : 'migrated'}.` : 'No personal app files need migration.');
  console.log('Old directories and generated artifacts remain untouched. Run npm run setup, then npm run build.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
