import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, readFile, readlink, readdir, realpath, rename, rm, rmdir, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative } from 'node:path';

// Euler keeps no copy of its apps. infra/repo.toml pins each one to a commit of its own
// repository; `qq sync` fetches it, read only, to .qq/deps/<id>. Preparing builds the pinned
// files plus Euler's adapter (app/adapters/<id>.patch) in a staging folder, then brings app/<id>
// to exactly that tree. The marker app/<id>/.euler-source.json records every file setup wrote
// with its hash, so setup only replaces or removes a file whose bytes are still the ones it
// wrote. Anything else (local data, node_modules, builds, a hand edit) is never touched.
export const pinnedApps = ['innernet', 'quitter', 'instants'];
const MARKER = '.euler-source.json';

function git(args, cwd) {
  const result = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args],
    { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`Cannot run git: ${result.error.message}. Install Git and run setup again.`);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

async function statOptional(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function safePath(path) {
  const normal = posix.normalize(path);
  if (typeof path !== 'string' || !path || path !== normal || posix.isAbsolute(path) || normal === '..' || normal.startsWith('../')
    || path.includes('\\') || path.split('/').includes('.git') || path === MARKER) {
    throw new Error(`Refusing unsafe source path: ${JSON.stringify(path)}`);
  }
  return path;
}

// What a file is, for comparing: its bytes or a link's target, and its mode. Absent is null.
async function fingerprint(path) {
  const info = await statOptional(path);
  if (!info) return null;
  if (info.isSymbolicLink()) return { sha256: createHash('sha256').update(`link\0${await readlink(path)}`).digest('hex'), mode: '120000' };
  if (!info.isFile()) return { sha256: 'not-a-file', mode: 'other' };
  return { sha256: createHash('sha256').update(await readFile(path)).digest('hex'), mode: info.mode & 0o100 ? '100755' : '100644' };
}

async function writeJsonAtomically(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

// An older, unreadable or missing marker counts as none: then only identical files are taken over.
async function readMarker(directory) {
  let marker;
  try { marker = JSON.parse(await readFile(join(directory, MARKER), 'utf8')); }
  catch { return null; }
  if (marker?.version !== 2 || !Array.isArray(marker.files)) return null;
  for (const entry of [...marker.files, ...(marker.next ?? [])]) safePath(entry.path);
  return marker;
}

// Writing or removing through a linked folder (say a data folder linked elsewhere) would change
// files outside app/<id>, so every folder on the way must be a real one.
async function noLinkedParents(directory, path) {
  let current = directory;
  for (const part of path.split('/').slice(0, -1)) {
    current = join(current, part);
    const info = await statOptional(current);
    if (!info) return;
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${current} is not a plain folder; move it away and run setup again.`);
  }
}

// The commit qq sync linked, checked to be the one infra/repo.toml pins now and to be unmodified.
export async function pinnedSource(root, id) {
  const source = join(root, '.qq/deps', id);
  const syncRecord = join(root, '.qq/sync.json');
  let record;
  try { record = JSON.parse(await readFile(syncRecord, 'utf8')); }
  catch { record = null; }
  const pin = Array.isArray(record) ? record.find((entry) => entry.section === 'deps' && entry.name === id) : null;
  let real = null;
  try { real = (await stat(source)).isDirectory() ? await realpath(source) : null; } catch { real = null; }
  if (!pin || !real) throw new Error(`No pinned source for ${id} in .qq/deps/${id}. Run qq sync in the Euler repository first.`);
  // A pull that moves a pin rewrites the manifest after qq last synced it.
  if ((await stat(join(root, 'infra/repo.toml'))).mtimeMs > (await stat(syncRecord)).mtimeMs) {
    throw new Error('infra/repo.toml changed since the last qq sync. Run qq sync, then setup again.');
  }
  if (await realpath(git(['rev-parse', '--show-toplevel'], real).trim()) !== real) {
    throw new Error(`.qq/deps/${id} is not a checkout of its own. Run qq sync again.`);
  }
  if (pin.digest !== `git:${git(['rev-parse', 'HEAD'], real).trim()}`) throw new Error(`.qq/deps/${id} is not at its pin. Run qq sync again.`);
  if (git(['status', '--porcelain', '--untracked-files=no'], real).trim()) throw new Error(`.qq/deps/${id} has changed files. Run qq sync again.`);
  return { source: real, digest: pin.digest };
}

async function walk(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(directory, path));
    else files.push(path);
  }
  return files;
}

// The pinned files plus the adapter, built apart from app/<id>, so a hunk can only touch files of
// the pinned tree, and a failed adapter leaves app/<id> as it was.
async function stage(root, id, source, patch) {
  const staging = join(root, '.workspace-tmp/sources', id);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  for (const line of git(['ls-files', '--stage', '-z'], source).split('\0').filter(Boolean)) {
    const [info, path] = line.split('\t');
    const mode = info.split(' ')[0];
    if (mode === '160000') continue; // a nested repository is not part of the tree's files
    const to = join(staging, safePath(path));
    await mkdir(dirname(to), { recursive: true });
    if (mode === '120000') await symlink(await readlink(join(source, path)), to);
    else await writeFile(to, await readFile(join(source, path)), { mode: mode === '100755' ? 0o755 : 0o644 });
  }
  try { git(['apply', '--whitespace=nowarn', `--directory=${relative(root, staging).split('\\').join('/')}`, patch], root); }
  catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw new Error(`Euler's adapter app/adapters/${id}.patch does not apply to this pin: ${error.message}\n`
      + `app/${id} is unchanged. Update the adapter for this pin (docs/app-updates.md).`);
  }
  const files = new Map();
  for (const path of (await walk(staging)).sort()) files.set(safePath(path), await fingerprint(join(staging, path)));
  return { staging, files };
}

export async function prepareSource(root, id, { log = console.log, backup = false } = {}) {
  if (!pinnedApps.includes(id)) throw new Error(`Unknown pinned app: ${id}`);
  const { source, digest } = await pinnedSource(root, id);
  const patch = join(root, 'app/adapters', `${id}.patch`);
  const patchSha256 = createHash('sha256').update(await readFile(patch)).digest('hex');
  const directory = join(root, 'app', id);
  if ((await statOptional(directory))?.isSymbolicLink()) throw new Error(`app/${id} is a link; make it a plain folder and run setup again.`);
  await mkdir(directory, { recursive: true });
  const previous = await readMarker(directory);

  // A file is ours while its bytes are ones setup wrote: the last complete tree or, after an
  // interrupted run, the tree that run was writing.
  const ours = new Map();
  for (const { path, sha256 } of previous ? [...previous.files, ...(previous.next ?? [])] : []) {
    ours.set(path, [...(ours.get(path) ?? []), sha256]);
  }
  const present = new Map();
  for (const path of ours.keys()) {
    await noLinkedParents(directory, path);
    present.set(path, await fingerprint(join(directory, path)));
  }
  const edited = [...ours].filter(([path, hashes]) => present.get(path) && !hashes.includes(present.get(path).sha256)).map(([path]) => path);

  if (previous?.complete && previous.digest === digest && previous.patchSha256 === patchSha256
    && !edited.length && previous.files.every(({ path }) => present.get(path))) {
    log(`${id} source is ready at ${digest.slice(4, 11)}.`);
    return { id, digest, changed: false };
  }

  const { staging, files } = await stage(root, id, source, patch);
  // A file in the way that setup did not write is taken over only when it is identical.
  const inTheWay = [];
  for (const [path, want] of files) {
    if (ours.has(path)) continue;
    await noLinkedParents(directory, path);
    const have = await fingerprint(join(directory, path));
    if (have && have.sha256 !== want.sha256) inTheWay.push(path);
  }
  const conflicts = [...new Set([...edited, ...inTheWay])].sort();
  if (conflicts.length && !backup) {
    await rm(staging, { recursive: true, force: true });
    throw new Error(`app/${id} has files that differ from what setup wrote or would write: ${conflicts.slice(0, 10).join(', ')}`
      + `${conflicts.length > 10 ? `, and ${conflicts.length - 10} more` : ''}. Nothing was changed. Move your changes out of app/${id} `
      + `(into the app's repository or its adapter) and run setup again, or run npm run setup -- ${id} --backup `
      + `to move exactly these files to app/${id}.setup-backup-<time>/ and continue.`);
  }

  log(`Preparing ${id} from ${digest.slice(4, 11)}…`);
  const next = [...files].map(([path, value]) => ({ path, ...value }));
  await writeJsonAtomically(join(directory, MARKER), { version: 2, complete: false, digest, patchSha256, files: previous?.files ?? [], next });
  let saved = null;
  if (conflicts.length) {
    saved = `${directory}.setup-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    for (const path of conflicts) {
      await mkdir(dirname(join(saved, path)), { recursive: true });
      await rename(join(directory, path), join(saved, path));
    }
    log(`Moved ${conflicts.length} changed file${conflicts.length === 1 ? '' : 's'} to ${relative(root, saved)}.`);
  }
  // Remove what setup wrote before and the new tree no longer has; each such file still has our bytes.
  for (const path of ours.keys()) {
    if (files.has(path) || !(await statOptional(join(directory, path)))) continue;
    await unlink(join(directory, path));
    for (let parent = dirname(join(directory, path)); parent !== directory && parent.startsWith(directory); parent = dirname(parent)) {
      try { if ((await readdir(parent)).length) break; await rmdir(parent); } catch { break; }
    }
  }
  for (const [path, want] of files) {
    const to = join(directory, path);
    const have = await fingerprint(to);
    if (have?.sha256 === want.sha256 && have.mode === want.mode) continue;
    if (have) await unlink(to);
    await mkdir(dirname(to), { recursive: true });
    await rename(join(staging, path), to);
  }
  await rm(staging, { recursive: true, force: true });
  await writeJsonAtomically(join(directory, MARKER), { version: 2, complete: true, digest, patchSha256, files: next });
  log(`${id} source ready at ${digest.slice(4, 11)}.`);
  return { id, digest, changed: true, backup: saved && relative(root, saved) };
}
