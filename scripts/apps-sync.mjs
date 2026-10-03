import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const manifestPath = 'app/upstream.json';
const help = `Update Euler's embedded applications from their upstream Git repositories.

  node scripts/apps-sync.mjs check [id|all]
  node scripts/apps-sync.mjs sync <id>
  node scripts/apps-sync.mjs sync --continue
  node scripts/apps-sync.mjs sync --abort

check defaults to all apps and only fetches Git objects/refs. sync updates one
app, preserving committed Euler changes through a Git subtree three-way merge.
Commit or remove uncommitted changes first. Conflicts use normal Git resolution:
edit the files, git add them, then sync --continue; sync --abort cancels the merge.
Updates create local commits only. Nothing is pushed, stashed, or reset hard.
`;

async function git(cwd, args, { allowFailure = false, input } = {}) {
  try {
    const pending = execute('git', args, {
      cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_MERGE_AUTOEDIT: 'no' },
      windowsHide: true,
    });
    pending.child.stdin.end(input);
    const result = await pending;
    return { ...result, code: 0 };
  } catch (error) {
    if (allowFailure && typeof error.code === 'number') {
      return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code };
    }
    throw new Error(`git ${args[0]} failed: ${(error.stderr || error.message).trim()}`);
  }
}

async function output(cwd, args) { return (await git(cwd, args)).stdout.trim(); }
async function readOptional(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function fail(message) { throw new Error(message); }
function oid(value) { return typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value); }
function inApp(path, app) { return path.startsWith(`${app.directory}/`); }

async function context(cwd) {
  const root = await output(cwd, ['rev-parse', '--show-toplevel']);
  const gitDir = await output(root, ['rev-parse', '--absolute-git-dir']);
  return { root, gitDir, statePath: join(gitDir, 'euler-app-sync.json') };
}

async function loadManifest(ctx) {
  const raw = await readFile(join(ctx.root, manifestPath), 'utf8');
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.applications)) fail('Invalid app/upstream.json.');
  const seen = new Set();
  for (const app of data.applications) {
    if (!/^[a-z][a-z0-9-]*$/.test(app.id) || seen.has(app.id)
      || !/^app\/[a-z][a-z0-9-]*$/.test(app.directory)
      || typeof app.upstream?.repository !== 'string' || !app.upstream.repository
      || app.upstream.repository.startsWith('-') || !oid(app.upstream.commit)) {
      fail('Invalid application entry in app/upstream.json.');
    }
    seen.add(app.id);
    const branch = app.upstream.branch || 'main';
    await git(ctx.root, ['check-ref-format', `refs/heads/${branch}`]);
  }
  return { raw, data };
}

async function existingOperation(ctx) {
  for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    if (await readOptional(join(ctx.gitDir, name)) !== null) return name;
  }
  // These paths are directories, so ask Git whether a rebase is in progress.
  const status = await output(ctx.root, ['status', '--porcelain=v2', '--branch']);
  if (status.includes('# branch.head (detached)')) {
    fail('Check out a branch before updating applications.');
  }
  const { existsSync } = await import('node:fs');
  for (const name of ['rebase-merge', 'rebase-apply', 'sequencer']) {
    if (existsSync(join(ctx.gitDir, name))) return name;
  }
  return null;
}

async function ensureClean(ctx) {
  const operation = await existingOperation(ctx);
  if (operation) fail(`Finish the existing Git operation (${operation}) first.`);
  if (await output(ctx.root, ['status', '--porcelain=v1', '--untracked-files=all'])) {
    fail('The working tree must be clean, including untracked files. Commit your changes first.');
  }
}

async function fetchLatest(ctx, app) {
  const branch = app.upstream.branch || 'main';
  const ref = `refs/euler/upstream/${app.id}`;
  await git(ctx.root, ['fetch', '--no-tags', app.upstream.repository, `+refs/heads/${branch}:${ref}`]);
  const latest = await output(ctx.root, ['rev-parse', `${ref}^{commit}`]);
  const pinned = app.upstream.commit;
  // Old snapshots must remain available even in shallow or freshly cloned hosts.
  const present = await git(ctx.root, ['cat-file', '-e', `${pinned}^{commit}`], { allowFailure: true });
  if (present.code !== 0) await git(ctx.root, ['fetch', '--no-tags', app.upstream.repository, pinned]);
  const ancestor = await git(ctx.root, ['merge-base', '--is-ancestor', pinned, latest], { allowFailure: true });
  if (ancestor.code !== 0) fail(`${app.id}: upstream history rewound or diverged from ${pinned}. No source was changed.`);
  const ahead = Number(await output(ctx.root, ['rev-list', '--count', `${pinned}..${latest}`]));
  return { latest, ahead };
}

async function subtreeBaseline(ctx, app) {
  // Prefix changes must include a raw-source tracking commit in shared Git
  // history. Reusing the old path silently would make git subtree choose a
  // different baseline from the one validated here.
  const escaped = app.directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const log = await output(ctx.root, ['log', '--format=%H%x00%B%x00', `--grep=^git-subtree-dir: ${escaped}/*$`, 'HEAD']);
  const entries = log.split('\0');
  for (let index = 0; index + 1 < entries.length; index += 2) {
    const commit = entries[index].trim();
    const body = entries[index + 1];
    if (!body.split('\n').includes(`git-subtree-dir: ${app.directory}`)) continue;
    const split = body.match(/^git-subtree-split: ([a-f0-9]+)$/m)?.[1];
    if (!split) continue;
    if (split !== app.upstream.commit || /^git-subtree-mainline:/m.test(body)) {
      fail(`${app.id}: subtree history does not match the pinned upstream commit. Restore its tracking history before syncing.`);
    }
    const tree = await output(ctx.root, ['rev-parse', `${commit}^{tree}`]);
    const upstreamTree = await output(ctx.root, ['rev-parse', `${split}^{tree}`]);
    if (tree !== upstreamTree) fail(`${app.id}: the subtree baseline must contain the unmodified upstream source.`);
    return commit;
  }
  fail(`${app.id}: missing Git subtree tracking history. Use a full clone containing Euler's subtree bootstrap and directory-migration commits.`);
}

async function sourceStats(ctx, commit) {
  const listing = (await git(ctx.root, ['ls-tree', '-rlz', commit])).stdout;
  let trackedFiles = 0;
  let trackedBytes = 0;
  for (const entry of listing.split('\0').filter(Boolean)) {
    const match = entry.match(/^\d+ blob [a-f0-9]+\s+(\d+)\t/);
    if (!match) fail('Upstream contains an unsupported Git submodule or tree entry.');
    trackedFiles += 1;
    trackedBytes += Number(match[1]);
  }
  return { trackedFiles, trackedBytes };
}

async function protectLocalFiles(ctx, app, target) {
  const tracked = new Set((await git(ctx.root, ['ls-tree', '-rz', '--name-only', 'HEAD', '--', app.directory])).stdout.split('\0').filter(Boolean));
  const incoming = (await git(ctx.root, ['ls-tree', '-rz', '--name-only', target])).stdout.split('\0').filter(Boolean);
  for (const relative of incoming) {
    const path = `${app.directory}/${relative}`;
    if (tracked.has(path)) continue;
    const parts = path.split('/');
    // Inspect only incoming paths and their parents, not whole dependency/data folders.
    for (let count = 2; count <= parts.length; count += 1) {
      const candidate = parts.slice(0, count).join('/');
      let info;
      try { info = await lstat(join(ctx.root, candidate)); }
      catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') break; throw error; }
      if (!info.isDirectory()) {
        if (!tracked.has(candidate)) fail(`Incoming upstream source would overwrite local file '${candidate}'. Move it before syncing.`);
        break;
      }
      if (count === parts.length) {
        const ignored = await output(ctx.root, ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '--no-empty-directory', '--', `${candidate}/`]);
        if (ignored) fail(`Incoming upstream source would replace local data in '${candidate}/'. Move it before syncing.`);
      }
    }
  }
}

async function verifySquash(ctx, commit, state) {
  const body = await output(ctx.root, ['show', '-s', '--format=%B', commit]);
  if (!body.split('\n').includes(`git-subtree-dir: ${state.directory}`)
    || !body.split('\n').includes(`git-subtree-split: ${state.target}`)) return false;
  const parents = (await output(ctx.root, ['show', '-s', '--format=%P', commit])).split(' ');
  if (parents.length !== 1 || parents[0] !== state.baseline) return false;
  return await output(ctx.root, ['rev-parse', `${commit}^{tree}`])
    === await output(ctx.root, ['rev-parse', `${state.target}^{tree}`]);
}

async function mergeInProgress(ctx, state) {
  const mergeHead = (await readOptional(join(ctx.gitDir, 'MERGE_HEAD')))?.trim();
  if (!mergeHead) return false;
  if (!oid(mergeHead) || !await verifySquash(ctx, mergeHead, state)) {
    fail('An unrelated Git merge is in progress. The updater will not modify it.');
  }
  const message = await readOptional(join(ctx.gitDir, 'MERGE_MSG'));
  if (!message?.startsWith(state.message)) fail('The active merge is not the recorded Euler update.');
  return true;
}

async function generatedMerge(ctx, state) {
  const head = await output(ctx.root, ['rev-parse', 'HEAD']);
  if (head === state.originalHead) return false;
  const parents = (await output(ctx.root, ['show', '-s', '--format=%P', head])).split(' ');
  return parents.length === 2 && parents[0] === state.originalHead
    && await output(ctx.root, ['show', '-s', '--format=%s', head]) === state.message
    && await verifySquash(ctx, parents[1], state);
}

async function readState(ctx) {
  const raw = await readOptional(ctx.statePath);
  if (!raw) return null;
  const state = JSON.parse(raw);
  if (state.version !== 1 || !oid(state.originalHead) || !oid(state.target) || !oid(state.baseline)
    || !/^app\/[a-z][a-z0-9-]*$/.test(state.directory)
    || typeof state.message !== 'string' || typeof state.before !== 'string' || typeof state.after !== 'string') {
    fail('Invalid Euler update recovery state. Inspect it before performing another update.');
  }
  return state;
}

async function ensureOwnedChanges(ctx, state) {
  const paths = [];
  for (const args of [
    ['diff', '--name-only', '-z', state.originalHead],
    ['diff', '--cached', '--name-only', '-z', state.originalHead],
    ['diff', '--name-only', '-z'],
  ]) paths.push(...(await git(ctx.root, args)).stdout.split('\0').filter(Boolean));
  if (paths.some((path) => path !== manifestPath && !inApp(path, state))) {
    fail('Unrelated files changed during this update. Restore those changes before continuing.');
  }
  const untracked = await output(ctx.root, ['ls-files', '--others', '--exclude-standard']);
  if (untracked) fail('Untracked files are present. Add resolved app files or move unrelated files before continuing.');
  const current = await readFile(join(ctx.root, manifestPath), 'utf8');
  if (current !== state.before && current !== state.after) fail('app/upstream.json was edited independently. Restore it before continuing.');
  const indexed = await output(ctx.root, ['rev-parse', `:${manifestPath}`]);
  const original = await output(ctx.root, ['rev-parse', `${state.originalHead}:${manifestPath}`]);
  // Compare Git blobs, not checkout bytes: clean filters/autocrlf may normalize
  // the LF metadata we write differently from the original working copy.
  const updated = (await git(ctx.root, ['hash-object', `--path=${manifestPath}`, '--stdin'], { input: state.after })).stdout.trim();
  if (indexed !== original && indexed !== updated) fail('app/upstream.json has independent staged edits. Preserve and unstage those edits before continuing or aborting.');
}

async function finish(ctx, state) {
  const merging = await mergeInProgress(ctx, state);
  const generated = !merging && await generatedMerge(ctx, state);
  if (!merging && !generated) fail('HEAD changed outside the recorded update; no commit will be amended.');
  if (merging && await output(ctx.root, ['rev-parse', 'HEAD']) !== state.originalHead) fail('HEAD changed during the recorded merge.');
  await ensureOwnedChanges(ctx, state);
  if (await output(ctx.root, ['ls-files', '--unmerged'])) fail('Resolve all merge conflicts and git add the resolved files, then run sync --continue.');
  const unstaged = (await git(ctx.root, ['diff', '--name-only', '-z'])).stdout.split('\0').filter(Boolean);
  if (unstaged.some((path) => path !== manifestPath)) fail('Stage your resolved app changes with git add before continuing.');
  // After an automatic merge, only our manifest may be changed before amendment.
  if (generated) {
    const extra = (await git(ctx.root, ['diff', '--name-only', '-z', 'HEAD'])).stdout.split('\0').filter(Boolean);
    if (extra.some((path) => path !== manifestPath)) fail('The generated merge has subsequent edits. Save them elsewhere and restore the generated merge without changing HEAD, then continue and reapply those edits.');
    const recorded = await output(ctx.root, ['show', `HEAD:${manifestPath}`]);
    if (recorded.trim() === state.after.trim() && extra.length === 0) {
      await unlink(ctx.statePath);
      console.log(`${state.id}: update already completed at ${state.target}.`);
      return;
    }
  }
  await writeFile(join(ctx.root, manifestPath), state.after, 'utf8');
  await git(ctx.root, ['add', '--', manifestPath]);
  await git(ctx.root, generated ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', state.message]);
  if (!await generatedMerge(ctx, state)) fail('The commit changed unexpectedly; recovery state was retained.');
  await unlink(ctx.statePath);
  console.log(`${state.id}: updated to ${state.target}. Run setup, tests, and builds before pushing.`);
}

async function abort(ctx, state) {
  const merging = await mergeInProgress(ctx, state);
  if (merging) {
    if (await output(ctx.root, ['rev-parse', 'HEAD']) !== state.originalHead) fail('HEAD changed during the recorded merge.');
    await ensureOwnedChanges(ctx, state);
    await git(ctx.root, ['merge', '--abort']);
    await unlink(ctx.statePath);
    console.log(`${state.id}: update aborted.`);
    return;
  }
  if (await output(ctx.root, ['rev-parse', 'HEAD']) === state.originalHead) {
    if (await output(ctx.root, ['status', '--porcelain=v1', '--untracked-files=all'])) fail('Working files changed without an active merge; inspect them before removing recovery state.');
    await unlink(ctx.statePath);
    console.log(`${state.id}: pending update cleared; no merge was active.`);
    return;
  }
  fail('The update already created a commit. Use sync --continue to finish its metadata; --abort will not reset commits.');
}

async function sync(ctx, app, manifest) {
  await ensureClean(ctx);
  const latest = await fetchLatest(ctx, app);
  const baseline = await subtreeBaseline(ctx, app);
  if (latest.latest === app.upstream.commit) {
    console.log(`${app.id}: already up to date at ${latest.latest}.`);
    return;
  }
  await protectLocalFiles(ctx, app, latest.latest);
  const stats = await sourceStats(ctx, latest.latest);
  const initial = app.upstream.commit;
  app.import ??= {};
  app.import.importedCommit ??= initial;
  Object.assign(app.upstream, { commit: latest.latest, ...stats });
  const state = {
    version: 1, id: app.id, directory: app.directory, baseline,
    originalHead: await output(ctx.root, ['rev-parse', 'HEAD']), target: latest.latest,
    message: `Update ${app.id} from upstream ${latest.latest.slice(0, 12)} (Euler sync ${randomUUID()})`,
    before: manifest.raw, after: `${JSON.stringify(manifest.data, null, 2)}\n`,
  };
  // Exclusive creation also prevents two sync commands from owning the same worktree.
  await writeFile(ctx.statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  try {
    await ensureClean(ctx);
    const result = await git(ctx.root, ['subtree', 'merge', `--prefix=${app.directory}`, '--squash', latest.latest, '-m', state.message], { allowFailure: true });
    if (result.code !== 0) {
      if (await mergeInProgress(ctx, state)) {
        fail(`${result.stdout.trim()}\n${result.stderr.trim()}\nResolve the merge and run sync --continue, or run sync --abort.`.trim());
      }
      fail(`Git subtree could not complete the update: ${(result.stderr || result.stdout).trim()}`);
    }
    await finish(ctx, state);
  } catch (error) {
    if (!await readOptional(join(ctx.gitDir, 'MERGE_HEAD'))
      && await output(ctx.root, ['rev-parse', 'HEAD']) === state.originalHead
      && !await output(ctx.root, ['status', '--porcelain=v1', '--untracked-files=all'])) {
      await unlink(ctx.statePath).catch(() => {});
    }
    throw error;
  }
}

export async function main(args = [], { cwd = process.cwd() } = {}) {
  try {
    if (!args.length || args[0] === '--help' || args[0] === '-h'
      || (['sync', 'check'].includes(args[0]) && ['--help', '-h'].includes(args[1]))) { console.log(help); return 0; }
    if (args[0] === 'sync' && ['--continue', '--abort'].includes(args[1])) args = args.slice(1);
    const [command, id, ...extra] = args;
    if (!['check', 'sync', '--continue', '--abort'].includes(command) || extra.length
      || (command.startsWith('--') && id) || (command === 'sync' && (!id || id === 'all'))) {
      fail('Use check [id|all], sync <id>, sync --continue, or sync --abort. See --help.');
    }
    const ctx = await context(resolve(cwd));
    const state = await readState(ctx);
    if (command === '--continue' || command === '--abort') {
      if (!state) fail('There is no pending Euler app update.');
      await (command === '--continue' ? finish(ctx, state) : abort(ctx, state));
      return 0;
    }
    if (state) fail('An Euler app update is pending. Run sync --continue or sync --abort first.');
    const manifest = await loadManifest(ctx);
    const selected = !id || id === 'all' ? manifest.data.applications : manifest.data.applications.filter((app) => app.id === id);
    if (!selected.length) fail(`Unknown app '${id}'. Choose: ${manifest.data.applications.map((app) => app.id).join(', ')}.`);
    if (command === 'sync') await sync(ctx, selected[0], manifest);
    else for (const app of selected) {
      const latest = await fetchLatest(ctx, app);
      console.log(`${app.id}: pinned ${app.upstream.commit}; latest ${latest.latest}; ${latest.ahead} commit(s) ahead`);
    }
    return 0;
  } catch (error) {
    console.error(`Euler app update: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
