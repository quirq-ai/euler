import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { prepareSource } from '../scripts/sources.mjs';

const quiet = { log() {} };

async function put(root, path, content = '') {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

// A workspace as qq sync leaves it: .qq/deps/quitter is a checkout at a commit, recorded in .qq/sync.json.
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'euler sources '));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const source = join(root, '.qq/deps/quitter');
  await mkdir(source, { recursive: true });
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'gitconfig'),
    GIT_AUTHOR_NAME: 'Euler test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Euler test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  await writeFile(env.GIT_CONFIG_GLOBAL, '');
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: source, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q');
  const commit = async (files) => {
    git('rm', '-rq', '--ignore-unmatch', '.');
    for (const [path, content] of Object.entries(files)) await put(source, path, content);
    git('add', '-A');
    git('commit', '-qm', 'upstream', '--allow-empty');
    const sha = git('rev-parse', 'HEAD');
    await put(root, '.qq/sync.json', JSON.stringify([{ section: 'deps', name: 'quitter', digest: `git:${sha}`, path: source }]));
    return sha;
  };
  await put(root, 'app/adapters/quitter.patch', [
    'diff --git a/vite.config.ts b/vite.config.ts',
    '--- a/vite.config.ts',
    '+++ b/vite.config.ts',
    '@@ -1 +1 @@',
    '-export default {};',
    "+export default { base: process.env.QUIRQ_BASE_PATH || '/' };",
    'diff --git a/project.md b/project.md',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/project.md',
    '@@ -0,0 +1 @@',
    '+Mounted by Euler.',
    '',
  ].join('\n'));
  return { root, commit, app: join(root, 'app/quitter') };
}

test('prepare copies the pinned commit, applies the adapter and keeps local data', async (t) => {
  const { root, commit, app } = await fixture(t);
  const sha = await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'one\n', 'docs/old.md': 'old\n' });
  await put(app, 'data/index.json', 'personal');
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, true);
  assert.match(await readFile(join(app, 'vite.config.ts'), 'utf8'), /QUIRQ_BASE_PATH/);
  assert.equal(await readFile(join(app, 'project.md'), 'utf8'), 'Mounted by Euler.\n');
  const marker = JSON.parse(await readFile(join(app, '.euler-source.json'), 'utf8'));
  assert.equal(marker.complete, true);
  assert.equal(marker.digest, `git:${sha}`);
  assert.deepEqual(marker.files, ['docs/old.md', 'project.md', 'src/main.ts', 'vite.config.ts']);
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, false);

  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'two\n' });
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, true);
  assert.equal(await readFile(join(app, 'src/main.ts'), 'utf8'), 'two\n');
  assert.equal(await exists(join(app, 'docs')), false);
  assert.equal(await readFile(join(app, 'data/index.json'), 'utf8'), 'personal');
});

test('prepare never replaces a file it did not write', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'upstream\n' });
  await put(app, 'src/main.ts', 'mine');
  await assert.rejects(prepareSource(root, 'quitter', quiet), /already has files the pinned source would replace: src\/main\.ts/);
  assert.equal(await readFile(join(app, 'src/main.ts'), 'utf8'), 'mine');
});

test('prepare needs qq sync and an adapter that applies to the pin', async (t) => {
  const { root, commit } = await fixture(t);
  await assert.rejects(prepareSource(root, 'quitter', quiet), /Run qq sync/);
  const sha = await commit({ 'vite.config.ts': 'export default {};\n' });
  await put(root, '.qq/sync.json', JSON.stringify([{ section: 'deps', name: 'quitter', digest: `git:${'0'.repeat(40)}` }]));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /not at its pin/);
  await put(root, '.qq/sync.json', JSON.stringify([{ section: 'deps', name: 'quitter', digest: `git:${sha}` }]));
  await commit({ 'vite.config.ts': 'export default { changed: true };\n' });
  await assert.rejects(prepareSource(root, 'quitter', quiet), /adapter app\/adapters\/quitter\.patch does not apply/);
  await assert.rejects(prepareSource(root, '../quitter', quiet), /Unknown pinned app/);
});

test('prepare refuses to write or remove through a linked folder', { skip: process.platform === 'win32' }, async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'data/demo.json': '{}\n' });
  const outside = join(root, 'outside');
  await mkdir(outside);
  await mkdir(app, { recursive: true });
  await symlink(outside, join(app, 'data'));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /not a plain folder/);
  assert.equal(await exists(join(outside, 'demo.json')), false);
});
