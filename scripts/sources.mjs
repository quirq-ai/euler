import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, readFile, readlink, readdir, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative } from 'node:path';

// Euler keeps no copy of its apps. infra/repo.toml pins each one to a commit of its own
// repository; `qq sync` fetches it, read only, to .qq/deps/<id>. Preparing copies that tree to
// app/<id> and applies Euler's subpath adapter, app/adapters/<id>.patch. Files the app writes at
// run time (indexes, journals, node_modules, builds) are never tracked upstream, so they stay.
export const pinnedApps = ['innernet', 'quitter', 'instants'];
const MARKER = '.euler-source.json';

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`Cannot run git: ${result.error.message}. Install Git and run setup again.`);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

async function statOptional(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function readMarker(directory) {
  try { return JSON.parse(await readFile(join(directory, MARKER), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error(`Cannot read ${join(directory, MARKER)}: ${error.message}`); }
}

function safePath(path) {
  const normal = posix.normalize(path);
  if (!path || path !== normal || posix.isAbsolute(path) || normal === '..' || normal.startsWith('../') || path.split('/').includes('.git')) {
    throw new Error(`Refusing unsafe source path: ${JSON.stringify(path)}`);
  }
  return path;
}

// Writing or removing through a linked folder (say a data folder linked elsewhere) would change
// files outside app/<id>, so every folder on the way must be a real one.
async function noLinkedParents(directory, path) {
  let current = directory;
  for (const part of path.split('/').slice(0, -1)) {
    current = join(current, part);
    const stat = await statOptional(current);
    if (!stat) return;
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${current} is not a plain folder; move it away and run setup again.`);
  }
}

// The commit qq sync linked, checked against what qq recorded for the current manifest.
export async function pinnedSource(root, id) {
  const source = join(root, '.qq/deps', id);
  let record;
  try { record = JSON.parse(await readFile(join(root, '.qq/sync.json'), 'utf8')); }
  catch { record = null; }
  const pin = Array.isArray(record) ? record.find((entry) => entry.section === 'deps' && entry.name === id) : null;
  if (!pin || !(await statOptional(source))) {
    throw new Error(`No pinned source for ${id} in .qq/deps/${id}. Run qq sync in the Euler repository first.`);
  }
  const commit = git(['rev-parse', 'HEAD'], source).trim();
  if (pin.digest !== `git:${commit}`) throw new Error(`.qq/deps/${id} is not at its pin. Run qq sync again.`);
  return { source, digest: pin.digest };
}

function upstreamFiles(source) {
  const files = [];
  for (const line of git(['ls-files', '--stage', '-z'], source).split('\0').filter(Boolean)) {
    const [info, path] = line.split('\t');
    const mode = info.split(' ')[0];
    if (mode === '160000') continue; // a nested repository is not part of the tree's files
    files.push({ path: safePath(path), mode });
  }
  return files;
}

// The files the adapter adds and removes, from `git apply --summary`.
function patchSummary(patch, cwd) {
  const summary = { create: [], delete: [] };
  for (const line of git(['apply', '--summary', patch], cwd).split('\n')) {
    const match = /^ (create|delete) mode \d+ (.+)$/.exec(line);
    if (match) summary[match[1]].push(safePath(match[2]));
  }
  return summary;
}

async function removeEmptyParents(directory, path) {
  for (let parent = dirname(join(directory, path)); parent !== directory && parent.startsWith(directory); parent = dirname(parent)) {
    try { if ((await readdir(parent)).length) return; await rmdir(parent); }
    catch (error) { if (error.code === 'ENOENT') continue; return; }
  }
}

export async function prepareSource(root, id, { log = console.log } = {}) {
  if (!pinnedApps.includes(id)) throw new Error(`Unknown pinned app: ${id}`);
  const { source, digest } = await pinnedSource(root, id);
  const patch = join(root, 'app/adapters', `${id}.patch`);
  const patchSha256 = createHash('sha256').update(await readFile(patch)).digest('hex');
  const directory = join(root, 'app', id);
  await mkdir(directory, { recursive: true });
  const previous = await readMarker(directory);
  const files = upstreamFiles(source);
  const changes = patchSummary(patch, root);
  const written = [...new Set([...files.map((file) => file.path), ...changes.create])];
  const owned = written.filter((path) => !changes.delete.includes(path)).sort();
  if (previous?.complete && previous.digest === digest && previous.patchSha256 === patchSha256) {
    const present = await Promise.all(owned.map((path) => statOptional(join(directory, path))));
    if (present.every(Boolean)) { log(`${id} source is ready at ${digest.slice(4, 11)}.`); return { id, digest, changed: false }; }
  }

  // Only files an earlier prepare wrote may be replaced; anything else in the way is someone's.
  const known = new Set((previous?.files ?? []).map(safePath));
  const blocked = [];
  for (const path of written) if (!known.has(path) && await statOptional(join(directory, path))) blocked.push(path);
  if (blocked.length) {
    throw new Error(`app/${id} already has files the pinned source would replace: ${blocked.slice(0, 10).join(', ')}`
      + `${blocked.length > 10 ? ', …' : ''}. Move them out of app/${id} and run setup again.`);
  }
  log(`Preparing ${id} from ${digest.slice(4, 11)}…`);
  // Until the copy finishes, every file either version owns counts as ours, so a retry can replace it.
  const writing = [...new Set([...known, ...written])].sort();
  await writeFile(join(directory, MARKER), `${JSON.stringify({ version: 1, complete: false, digest, patchSha256, files: writing }, null, 2)}\n`);
  for (const path of [...known, ...written]) await noLinkedParents(directory, path);
  for (const path of known) {
    if (!(await statOptional(join(directory, path)))) continue;
    await unlink(join(directory, path));
    await removeEmptyParents(directory, path);
  }
  for (const { path, mode } of files) {
    const from = join(source, path);
    const to = join(directory, path);
    await mkdir(dirname(to), { recursive: true });
    if (mode === '120000') await symlink(await readlink(from), to);
    else await writeFile(to, await readFile(from), { mode: mode === '100755' ? 0o755 : 0o644 });
  }
  // Adapter files must match the pinned bytes, whatever line-ending conversion this machine's Git does.
  const applied = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'apply', '--whitespace=nowarn', `--directory=${relative(root, directory).split('\\').join('/')}`, patch],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  if (applied.status !== 0) {
    throw new Error(`Euler's adapter app/adapters/${id}.patch does not apply to ${id} ${digest.slice(4, 11)}: `
      + `${(applied.stderr || applied.error?.message || '').trim()}\nUpdate the adapter for this pin (docs/app-updates.md).`);
  }
  await writeFile(join(directory, MARKER), `${JSON.stringify({ version: 1, complete: true, digest, patchSha256, files: owned }, null, 2)}\n`);
  log(`${id} source ready at ${digest.slice(4, 11)}.`);
  return { id, digest, changed: true };
}
