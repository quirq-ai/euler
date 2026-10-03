import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/apps-sync.mjs', import.meta.url));
const manifestPath = 'app/upstream.json';
const appPath = 'app/innernet';

function run(command, args, cwd, env, expected = 0) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (expected !== null) assert.equal(result.status, expected, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}\n${result.error || ''}`);
  return result;
}

async function put(root, path, content) {
  const file = join(root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function fixture(t, { directory = appPath } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'euler sync fixture '));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const upstream = join(root, 'upstream source');
  const remote = join(root, 'upstream remote.git');
  const host = join(root, 'Euler workspace');
  const globalConfig = join(root, 'isolated git config');
  await writeFile(globalConfig, '');
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: globalConfig,
    GIT_AUTHOR_NAME: 'Euler test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Euler test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
    GIT_TERMINAL_PROMPT: '0',
  };
  const git = (cwd, ...args) => run('git', args, cwd, env).stdout.trim();
  git(root, 'init', '--initial-branch=main', upstream);
  git(root, 'init', '--bare', '--initial-branch=main', remote);
  git(root, 'init', '--initial-branch=main', host);
  for (const cwd of [upstream, host]) {
    git(cwd, 'config', 'core.autocrlf', 'false');
    git(cwd, 'config', 'commit.gpgsign', 'false');
  }
  await put(upstream, 'shared.txt', 'base\n');
  await put(upstream, 'rename me.txt', 'rename survives\n');
  await put(upstream, 'obsolete.txt', 'remove upstream\n');
  await put(upstream, 'asset.bin', Buffer.from([0, 1, 2, 255, 13, 10]));
  git(upstream, 'add', '.');
  git(upstream, 'commit', '-m', 'Upstream baseline');
  const base = git(upstream, 'rev-parse', 'HEAD');
  git(upstream, 'remote', 'add', 'origin', remote);
  git(upstream, 'push', 'origin', 'main');
  const manifest = {
    version: 1,
    applications: [{
      id: 'innernet', directory,
      upstream: { repository: remote, branch: 'main', commit: base, trackedFiles: 4, trackedBytes: 999 },
      import: { method: 'git subtree add --squash', includesUncommittedChanges: false, excludedTrackedPaths: [] },
      eulerAdapters: { trackedAsSource: true, files: ['adapter.txt'] },
    }],
  };
  await put(host, `${directory.split('/')[0]}/upstream.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  await put(host, 'host-only.txt', 'Euler outside the app\n');
  git(host, 'add', '.');
  git(host, 'commit', '-m', 'Euler host');
  git(host, 'subtree', 'add', `--prefix=${directory}`, remote, 'main', '--squash');
  await put(host, `${directory}/adapter.txt`, 'Euler adapter stays\n');
  git(host, 'add', '.');
  git(host, 'commit', '-m', 'Euler adapter');
  return {
    root, host, upstream, remote, env, base, git,
    cli(args, cwd = host, expected = 0) { return run(process.execPath, [script, ...args], cwd, env, expected); },
    async publish(message = 'Upstream update') {
      git(upstream, 'add', '-A');
      git(upstream, 'commit', '-m', message);
      git(upstream, 'push', 'origin', 'main');
      return git(upstream, 'rev-parse', 'HEAD');
    },
    async manifest(cwd = host) { return JSON.parse(await readFile(join(cwd, manifestPath), 'utf8')); },
    async snapshot(cwd = host) {
      return { head: git(cwd, 'rev-parse', 'HEAD'), status: git(cwd, 'status', '--porcelain=v1', '--untracked-files=all'), manifest: await readFile(join(cwd, manifestPath), 'utf8') };
    },
  };
}

test('app check and no-op sync do not rewrite Euler source or provenance', async (t) => {
  const app = await fixture(t);
  const before = await app.snapshot();
  assert.match(app.cli(['sync', '--help']).stdout, /check|sync/);
  assert.match(app.cli(['check']).stdout, /innernet/);
  app.cli(['sync', 'innernet']);
  for (const args of [['sync'], ['sync', 'all'], ['sync', '../innernet']]) app.cli(args, app.host, 1);
  assert.deepEqual(await app.snapshot(), before);
  assert.equal(await readFile(join(app.host, appPath, 'adapter.txt'), 'utf8'), 'Euler adapter stays\n');
});

test('app sync preserves adapters and host files while importing changes, renames, deletions and binary bytes', async (t) => {
  const app = await fixture(t);
  await put(app.upstream, 'shared.txt', 'upstream changed\n');
  await put(app.upstream, 'new directory/new file.txt', 'new source\n');
  const binary = Buffer.from([0, 255, 254, 3, 0, 13, 10, 128]);
  await put(app.upstream, 'asset.bin', binary);
  app.git(app.upstream, 'mv', 'rename me.txt', 'renamed file.txt');
  app.git(app.upstream, 'rm', 'obsolete.txt');
  const latest = await app.publish();
  const beforeCheck = await app.snapshot();
  app.cli(['check', 'innernet']);
  assert.deepEqual(await app.snapshot(), beforeCheck, 'Checking upstream must not import files or update metadata');
  app.cli(['sync', 'innernet']);
  assert.equal(await readFile(join(app.host, appPath, 'shared.txt'), 'utf8'), 'upstream changed\n');
  assert.equal(await readFile(join(app.host, appPath, 'adapter.txt'), 'utf8'), 'Euler adapter stays\n');
  assert.equal(await readFile(join(app.host, 'host-only.txt'), 'utf8'), 'Euler outside the app\n');
  assert.equal(await readFile(join(app.host, appPath, 'renamed file.txt'), 'utf8'), 'rename survives\n');
  assert.equal(await readFile(join(app.host, appPath, 'new directory/new file.txt'), 'utf8'), 'new source\n');
  assert.deepEqual(await readFile(join(app.host, appPath, 'asset.bin')), binary);
  for (const path of ['rename me.txt', 'obsolete.txt']) await assert.rejects(readFile(join(app.host, appPath, path)), { code: 'ENOENT' });
  const entry = (await app.manifest()).applications[0];
  assert.equal(entry.upstream.commit, latest);
  assert.equal(entry.import.importedCommit, app.base);
  assert.equal(entry.upstream.trackedFiles, 4);
  assert.equal(entry.upstream.trackedBytes, 52);
  assert.deepEqual(entry.eulerAdapters, { trackedAsSource: true, files: ['adapter.txt'] });
  assert.equal(app.git(app.host, 'status', '--porcelain=v1'), '');
  assert.equal(app.git(app.host, 'rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).length, 3, 'Source and provenance share the new merge commit');
  const after = await app.snapshot();
  app.cli(['sync', 'innernet']);
  assert.deepEqual(await app.snapshot(), after);
  await put(app.upstream, 'second update.txt', 'another upstream revision\n');
  const second = await app.publish('Second upstream update');
  app.cli(['sync', 'innernet']);
  const secondEntry = (await app.manifest()).applications[0];
  assert.equal(secondEntry.upstream.commit, second);
  assert.equal(secondEntry.import.importedCommit, app.base, 'Later syncs retain the initial import provenance');
  assert.equal(await readFile(join(app.host, appPath, 'second update.txt'), 'utf8'), 'another upstream revision\n');
  assert.equal(await readFile(join(app.host, appPath, 'adapter.txt'), 'utf8'), 'Euler adapter stays\n');
  assert.equal(app.git(app.host, 'status', '--porcelain=v1'), '');
});

test('app sync rejects dirty tracked, staged and untracked files without altering them', async (t) => {
  const app = await fixture(t);
  await put(app.upstream, 'shared.txt', 'new upstream\n');
  await app.publish();
  for (const kind of ['unstaged', 'staged', 'untracked']) {
    const path = kind === 'untracked' ? 'untracked work.txt' : 'host-only.txt';
    await put(app.host, path, `${kind} local work\n`);
    if (kind === 'staged') app.git(app.host, 'add', path);
    const before = await app.snapshot();
    const result = app.cli(['sync', 'innernet'], app.host, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /clean|dirty|uncommitted|untracked/i);
    assert.deepEqual(await app.snapshot(), before, kind);
    assert.equal(await readFile(join(app.host, path), 'utf8'), `${kind} local work\n`);
    if (kind === 'untracked') await rm(join(app.host, path));
    else app.git(app.host, 'restore', '--staged', '--worktree', '--', path);
  }
});

test('upstream fetch failures leave the checkout and provenance untouched', async (t) => {
  const app = await fixture(t);
  const manifest = await app.manifest();
  manifest.applications[0].upstream.repository = join(app.root, 'missing upstream.git');
  await put(app.host, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  app.git(app.host, 'add', manifestPath);
  app.git(app.host, 'commit', '-m', 'Point fixture at unavailable upstream');
  const before = await app.snapshot();
  for (const args of [['check', 'innernet'], ['sync', 'innernet']]) {
    app.cli(args, app.host, 1);
    assert.deepEqual(await app.snapshot(), before);
  }
});

test('app sync refuses to overwrite ignored personal files newly tracked upstream', async (t) => {
  const app = await fixture(t);
  await put(app.host, `${appPath}/.gitignore`, 'local.state\n');
  app.git(app.host, 'add', `${appPath}/.gitignore`);
  app.git(app.host, 'commit', '-m', 'Keep local app state out of source control');
  await put(app.host, `${appPath}/local.state`, 'personal data must survive\n');
  assert.equal(app.git(app.host, 'check-ignore', `${appPath}/local.state`), `${appPath}/local.state`);
  await put(app.upstream, 'local.state', 'upstream now tracks this name\n');
  await app.publish();
  const before = await app.snapshot();
  assert.equal(before.status, '', 'Ignored local state does not make normal git status dirty');
  const result = app.cli(['sync', 'innernet'], app.host, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /ignored|overwrite|collision|untracked/i);
  assert.deepEqual(await app.snapshot(), before);
  assert.equal(await readFile(join(app.host, appPath, 'local.state'), 'utf8'), 'personal data must survive\n');
  assert.equal(run('git', ['rev-parse', '--verify', 'MERGE_HEAD'], app.host, app.env, null).status, 128);
});

test('app sync refuses to replace an ignored local directory with an upstream file', async (t) => {
  const app = await fixture(t);
  await put(app.host, `${appPath}/.gitignore`, 'local.cache/\n');
  app.git(app.host, 'add', `${appPath}/.gitignore`);
  app.git(app.host, 'commit', '-m', 'Keep personal cache out of source control');
  await put(app.host, `${appPath}/local.cache/personal.txt`, 'personal directory content\n');
  assert.equal(app.git(app.host, 'check-ignore', `${appPath}/local.cache/personal.txt`), `${appPath}/local.cache/personal.txt`);
  await put(app.upstream, 'local.cache', 'upstream file replaces this directory\n');
  await app.publish();
  const before = await app.snapshot();
  assert.equal(before.status, '');
  app.cli(['sync', 'innernet'], app.host, 1);
  assert.deepEqual(await app.snapshot(), before);
  assert.equal(await readFile(join(app.host, appPath, 'local.cache/personal.txt'), 'utf8'), 'personal directory content\n');
  assert.equal(run('git', ['rev-parse', '--verify', 'MERGE_HEAD'], app.host, app.env, null).status, 128);
});

test('conflicted sync supports abort and resolved continuation without prematurely advancing provenance', async (t) => {
  const app = await fixture(t);
  await put(app.host, `${appPath}/shared.txt`, 'Euler local implementation\n');
  app.git(app.host, 'add', '.');
  app.git(app.host, 'commit', '-m', 'Euler edits the shared source');
  await put(app.upstream, 'shared.txt', 'Upstream new implementation\n');
  const latest = await app.publish();
  const before = await app.snapshot();
  app.cli(['sync', 'innernet'], app.host, 1);
  assert.ok(app.git(app.host, 'rev-parse', '--verify', 'MERGE_HEAD'));
  assert.match(app.git(app.host, 'diff', '--name-only', '--diff-filter=U'), /app\/innernet\/shared\.txt/);
  assert.equal((await app.manifest()).applications[0].upstream.commit, app.base);
  app.cli(['sync', '--abort']);
  assert.deepEqual(await app.snapshot(), before);
  assert.equal(await readFile(join(app.host, appPath, 'shared.txt'), 'utf8'), 'Euler local implementation\n');
  app.cli(['sync', 'innernet'], app.host, 1);
  app.cli(['sync', '--continue'], app.host, 1);
  assert.equal((await app.manifest()).applications[0].upstream.commit, app.base, 'Unresolved continuation must not update the pin');
  await put(app.host, `${appPath}/shared.txt`, 'Euler and upstream reconciled\n');
  app.git(app.host, 'add', `${appPath}/shared.txt`);
  app.cli(['sync', '--continue']);
  assert.equal((await app.manifest()).applications[0].upstream.commit, latest);
  assert.equal(await readFile(join(app.host, appPath, 'shared.txt'), 'utf8'), 'Euler and upstream reconciled\n');
  assert.equal(app.git(app.host, 'status', '--porcelain=v1'), '');
  assert.equal(run('git', ['rev-parse', '--verify', 'MERGE_HEAD'], app.host, app.env, null).status, 128);
});

test('renaming apps to app retains three-way subtree updates through an ancestry-only prefix migration', async (t) => {
  const app = await fixture(t, { directory: 'apps/innernet' });
  await put(app.host, 'apps/innernet/shared.txt', 'Euler local implementation\n');
  app.git(app.host, 'add', '.');
  app.git(app.host, 'commit', '-m', 'Euler edits source before the folder rename');
  const oldBaseline = app.git(app.host, 'log', '-1', '--format=%H', '--grep=^git-subtree-dir: apps/innernet$');
  assert.ok(oldBaseline);
  app.git(app.host, 'mv', 'apps', 'app');
  const manifest = await app.manifest();
  manifest.applications[0].directory = appPath;
  await put(app.host, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  app.git(app.host, 'add', '.');
  app.git(app.host, 'commit', '-m', 'Rename the bundled application folder');
  await put(app.upstream, 'shared.txt', 'Upstream new implementation\n');
  const latest = await app.publish();

  // A directory rename alone must not silently invent a baseline or overwrite
  // Euler's edits. The migration belongs in shared history for every clone.
  const beforeMigration = await app.snapshot();
  const missingHistory = app.cli(['sync', 'innernet'], app.host, 1);
  assert.match(`${missingHistory.stdout}\n${missingHistory.stderr}`, /subtree tracking history/i);
  assert.deepEqual(await app.snapshot(), beforeMigration);
  const upstreamTree = app.git(app.host, 'rev-parse', `${app.base}^{tree}`);
  const newBaseline = app.git(app.host, 'commit-tree', upstreamTree, '-p', oldBaseline, '-m',
    `Track Innernet under app/innernet\n\ngit-subtree-dir: ${appPath}\ngit-subtree-split: ${app.base}`);
  const sourceTree = app.git(app.host, 'rev-parse', 'HEAD^{tree}');
  app.git(app.host, 'merge', '--no-ff', '-s', 'ours', newBaseline, '-m', 'Retarget subtree tracking after the folder rename');
  assert.equal(app.git(app.host, 'rev-parse', 'HEAD^{tree}'), sourceTree, 'Tracking migration must leave all source and metadata unchanged');

  const beforeUpdate = await app.snapshot();
  app.cli(['sync', 'innernet'], join(app.host, appPath), 1);
  assert.equal(app.git(app.host, 'diff', '--name-only', '--diff-filter=U'), `${appPath}/shared.txt`);
  assert.equal((await app.manifest()).applications[0].upstream.commit, app.base);
  app.cli(['sync', '--abort']);
  assert.deepEqual(await app.snapshot(), beforeUpdate);
  app.cli(['sync', 'innernet'], app.host, 1);
  await put(app.host, `${appPath}/shared.txt`, 'Euler and upstream reconciled\n');
  app.git(app.host, 'add', `${appPath}/shared.txt`);
  app.cli(['sync', '--continue']);
  assert.equal((await app.manifest()).applications[0].upstream.commit, latest);
  assert.equal(await readFile(join(app.host, appPath, 'shared.txt'), 'utf8'), 'Euler and upstream reconciled\n');
  assert.equal(await readFile(join(app.host, appPath, 'adapter.txt'), 'utf8'), 'Euler adapter stays\n');
  assert.equal(app.git(app.host, 'ls-files', 'apps'), '');
  await put(app.upstream, 'after migration.txt', 'Later upstream changes still sync\n');
  const next = await app.publish('Second upstream update after the directory rename');
  app.cli(['sync', 'innernet']);
  assert.equal((await app.manifest()).applications[0].upstream.commit, next);
  assert.equal(await readFile(join(app.host, appPath, 'after migration.txt'), 'utf8'), 'Later upstream changes still sync\n');
  assert.equal(await readFile(join(app.host, appPath, 'shared.txt'), 'utf8'), 'Euler and upstream reconciled\n');
  assert.equal(app.git(app.host, 'status', '--porcelain=v1'), '');
});

test('sync continuation and abort preserve independent staged provenance even when the working copy is restored', async (t) => {
  const app = await fixture(t);
  await put(app.host, `${appPath}/shared.txt`, 'Euler local implementation\n');
  app.git(app.host, 'add', '.');
  app.git(app.host, 'commit', '-m', 'Euler edits the shared source');
  await put(app.upstream, 'shared.txt', 'Upstream new implementation\n');
  await app.publish();
  app.cli(['sync', 'innernet'], app.host, 1);
  await put(app.host, `${appPath}/shared.txt`, 'Resolved app implementation\n');
  app.git(app.host, 'add', `${appPath}/shared.txt`);
  const originalManifest = await readFile(join(app.host, manifestPath), 'utf8');
  const independent = JSON.parse(originalManifest);
  independent.note = 'Independent staged provenance must survive recovery';
  const stagedManifest = `${JSON.stringify(independent, null, 2)}\n`;
  await put(app.host, manifestPath, stagedManifest);
  app.git(app.host, 'add', manifestPath);
  await put(app.host, manifestPath, originalManifest);
  const before = await app.snapshot();
  const mergeHead = app.git(app.host, 'rev-parse', '--verify', 'MERGE_HEAD');
  for (const args of [['sync', '--continue'], ['sync', '--abort']]) {
    const result = app.cli(args, app.host, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /manifest|upstream\.json/i);
    assert.equal(run('git', ['show', `:${manifestPath}`], app.host, app.env).stdout, stagedManifest);
    assert.deepEqual(await app.snapshot(), before);
    assert.equal((await app.manifest()).applications[0].upstream.commit, app.base);
    assert.equal(app.git(app.host, 'rev-parse', '--verify', 'MERGE_HEAD'), mergeHead);
    assert.equal(await readFile(join(app.host, appPath, 'shared.txt'), 'utf8'), 'Resolved app implementation\n');
  }
});

test('app sync rejects a rewound or diverged upstream rather than dropping the pinned history', async (t) => {
  const app = await fixture(t);
  await put(app.upstream, 'shared.txt', 'accepted upstream\n');
  await app.publish();
  app.cli(['sync', 'innernet']);
  const before = await app.snapshot();
  app.git(app.upstream, 'reset', '--hard', app.base);
  app.git(app.upstream, 'push', '--force', 'origin', 'main');
  for (const args of [['check', 'innernet'], ['sync', 'innernet']]) {
    const result = app.cli(args, app.host, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /rewind|diverg|ancestor|history|fast.forward/i);
    assert.deepEqual(await app.snapshot(), before);
  }
  await put(app.upstream, 'diverged.txt', 'different upstream history\n');
  app.git(app.upstream, 'add', '.');
  app.git(app.upstream, 'commit', '-m', 'Diverged fixture branch');
  app.git(app.upstream, 'push', '--force', 'origin', 'main');
  app.cli(['sync', 'innernet'], app.host, 1);
  assert.deepEqual(await app.snapshot(), before);
});

test('app sync works from a nested folder in a linked worktree whose paths contain spaces', async (t) => {
  const app = await fixture(t);
  const linked = join(app.root, 'linked Euler worktree');
  app.git(app.host, 'worktree', 'add', '-b', 'linked-app-update', linked);
  const mainBefore = await app.snapshot();
  await put(app.upstream, 'shared.txt', 'linked worktree update\n');
  const latest = await app.publish();
  app.cli(['sync', 'innernet'], join(linked, appPath));
  assert.equal((await app.manifest(linked)).applications[0].upstream.commit, latest);
  assert.equal(await readFile(join(linked, appPath, 'shared.txt'), 'utf8'), 'linked worktree update\n');
  assert.equal(await readFile(join(linked, appPath, 'adapter.txt'), 'utf8'), 'Euler adapter stays\n');
  assert.equal(app.git(linked, 'status', '--porcelain=v1'), '');
  assert.deepEqual(await app.snapshot(), mainBefore, 'Updating the linked branch leaves the original checkout intact');
});
