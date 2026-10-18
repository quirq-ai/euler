import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
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
  // The manifest is older than every qq sync below, as after a clone followed by qq sync.
  await put(root, 'infra/repo.toml', '');
  await utimes(join(root, 'infra/repo.toml'), new Date(2000, 0, 1), new Date(2000, 0, 1));
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
  return { root, commit, git, source, app: join(root, 'app/quitter') };
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
  assert.deepEqual(marker.files.map((file) => file.path), ['docs/old.md', 'project.md', 'src/main.ts', 'vite.config.ts']);
  assert.ok(marker.files.every((file) => /^[0-9a-f]{64}$/.test(file.sha256) && file.mode === '100644'));
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, false);

  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'two\n' });
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, true);
  assert.equal(await readFile(join(app, 'src/main.ts'), 'utf8'), 'two\n');
  assert.equal(await exists(join(app, 'docs')), false);
  assert.equal(await readFile(join(app, 'data/index.json'), 'utf8'), 'personal');
});

test('prepare never replaces a file it did not write, and takes over identical ones', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'upstream\n', 'src/same.ts': 'same\n' });
  await put(app, 'src/main.ts', 'mine');
  await put(app, 'src/same.ts', 'same\n');
  await assert.rejects(prepareSource(root, 'quitter', quiet), /differ from what setup wrote or would write: src\/main\.ts\. Nothing was changed/);
  assert.equal(await readFile(join(app, 'src/main.ts'), 'utf8'), 'mine');
  assert.equal(await exists(join(app, 'vite.config.ts')), false);
  const result = await prepareSource(root, 'quitter', { ...quiet, backup: true });
  assert.equal(await readFile(join(root, result.backup, 'src/main.ts'), 'utf8'), 'mine');
  assert.equal(await readFile(join(app, 'src/main.ts'), 'utf8'), 'upstream\n');
});

test('prepare stops on a hand edit to a file it wrote, with or without a pin change', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'README.md': 'readme\n', 'gone.md': 'x\n' });
  await prepareSource(root, 'quitter', quiet);
  await appendFile(join(app, 'vite.config.ts'), '// my local fix\n');
  await rm(join(app, 'README.md'));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /vite\.config\.ts\. Nothing was changed/);
  assert.match(await readFile(join(app, 'vite.config.ts'), 'utf8'), /my local fix/);
  await commit({ 'vite.config.ts': 'export default {};\n', 'README.md': 'readme two\n' });
  await assert.rejects(prepareSource(root, 'quitter', quiet), /vite\.config\.ts/);
  assert.match(await readFile(join(app, 'vite.config.ts'), 'utf8'), /my local fix/);
  assert.equal(await exists(join(app, 'gone.md')), true);

  // A file the marker lists with bytes setup never wrote is not deleted either.
  await put(app, 'data/mine.json', 'PERSONAL');
  const marker = JSON.parse(await readFile(join(app, '.euler-source.json'), 'utf8'));
  marker.files.push({ path: 'data/mine.json', sha256: '0'.repeat(64), mode: '100644' });
  marker.complete = false;
  await writeFile(join(app, '.euler-source.json'), JSON.stringify(marker));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /data\/mine\.json/);
  assert.equal(await readFile(join(app, 'data/mine.json'), 'utf8'), 'PERSONAL');
  const { backup } = await prepareSource(root, 'quitter', { ...quiet, backup: true });
  assert.equal(await readFile(join(root, backup, 'data/mine.json'), 'utf8'), 'PERSONAL');
  assert.match(await readFile(join(root, backup, 'vite.config.ts'), 'utf8'), /my local fix/);
  assert.equal(await readFile(join(app, 'README.md'), 'utf8'), 'readme two\n');
  assert.equal(await exists(join(app, 'gone.md')), false);
});

test('a lost or broken marker recovers by taking over identical files', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'one\n' });
  await prepareSource(root, 'quitter', quiet);
  await writeFile(join(app, '.euler-source.json'), '{');
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, true);
  await rm(join(app, '.euler-source.json'));
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, true);
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, false);
  assert.deepEqual((await readdir(app)).filter((name) => name.endsWith('.tmp')), []);
});

test('an adapter written with a rename keeps working on later runs', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'app/icon.tsx': 'line one\nline two\nline three\nline four\n' });
  await put(root, 'app/adapters/quitter.patch', [
    'diff --git a/app/icon.tsx b/components/icon.tsx',
    'similarity index 80%',
    'rename from app/icon.tsx',
    'rename to components/icon.tsx',
    '--- a/app/icon.tsx',
    '+++ b/components/icon.tsx',
    '@@ -1,4 +1,4 @@',
    ' line one',
    ' line two',
    ' line three',
    '-line four',
    '+line 4',
    '',
  ].join('\n'));
  await prepareSource(root, 'quitter', quiet);
  assert.equal(await exists(join(app, 'app/icon.tsx')), false);
  assert.match(await readFile(join(app, 'components/icon.tsx'), 'utf8'), /line 4/);
  await rm(join(app, 'vite.config.ts'));
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, true);
  assert.equal((await prepareSource(root, 'quitter', quiet)).changed, false);
});

test('prepare needs qq sync and an adapter that applies to the pin', async (t) => {
  const { root, commit } = await fixture(t);
  await assert.rejects(prepareSource(root, 'quitter', quiet), /Run qq sync/);
  const sha = await commit({ 'vite.config.ts': 'export default {};\n' });
  await put(root, '.qq/sync.json', JSON.stringify([{ section: 'deps', name: 'quitter', digest: `git:${'0'.repeat(40)}` }]));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /not at its pin/);
  await put(root, '.qq/sync.json', JSON.stringify([{ section: 'deps', name: 'quitter', digest: `git:${sha}` }]));
  await commit({ 'vite.config.ts': 'export default { changed: true };\n' });
  await assert.rejects(prepareSource(root, 'quitter', quiet), /adapter app\/adapters\/quitter\.patch does not apply[\s\S]*app\/quitter is unchanged/);
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

test('prepare uses only the pin infra/repo.toml names now, unmodified', async (t) => {
  const { root, commit, source } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n' });
  await writeFile(join(root, 'infra/repo.toml'), '# moved pin');
  await utimes(join(root, 'infra/repo.toml'), new Date(Date.now() + 60000), new Date(Date.now() + 60000));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /infra\/repo\.toml changed since the last qq sync/);
  await utimes(join(root, 'infra/repo.toml'), new Date(2000, 0, 1), new Date(2000, 0, 1));
  await writeFile(join(source, 'vite.config.ts'), 'export default { tampered: true };\n');
  await assert.rejects(prepareSource(root, 'quitter', quiet), /has changed files/);
});

test('a file edited while setup runs is not replaced or removed', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'one\n', 'old.md': 'old\n' });
  await prepareSource(root, 'quitter', quiet);
  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'two\n' });
  // The edit lands after setup checked app/quitter and before it writes: when it logs "Preparing".
  const sync = (path) => ({ log(line) { if (line.startsWith('Preparing')) writeFileSync(join(app, path), 'EDITED DURING SETUP'); } });
  await assert.rejects(prepareSource(root, 'quitter', sync('src/main.ts')), /app\/quitter\/src\/main\.ts changed while setup was running/);
  assert.equal(await readFile(join(app, 'src/main.ts'), 'utf8'), 'EDITED DURING SETUP');
  await rm(join(app, 'src/main.ts'));
  await assert.rejects(prepareSource(root, 'quitter', sync('old.md')), /app\/quitter\/old\.md changed while setup was running/);
  assert.equal(await readFile(join(app, 'old.md'), 'utf8'), 'EDITED DURING SETUP');
});

test('backups never reuse a folder that is already there', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'src/main.ts': 'upstream\n' });
  await put(app, 'src/main.ts', 'first');
  const RealDate = Date;
  const fixed = new RealDate('2026-10-18T20:00:00.000Z');
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed.getTime(); } };
  t.after(() => { globalThis.Date = RealDate; });
  const taken = `${app}.setup-backup-2026-10-18T20-00-00-000Z`;
  await put(taken, 'src/main.ts', 'someone else');
  const { backup } = await prepareSource(root, 'quitter', { ...quiet, backup: true });
  assert.equal(join(root, backup), `${taken}-1`);
  assert.equal(await readFile(join(taken, 'src/main.ts'), 'utf8'), 'someone else');
  assert.equal(await readFile(join(root, backup, 'src/main.ts'), 'utf8'), 'first');
});

test('an interrupted run keeps both lists, and markers naming "." are refused', async (t) => {
  const { root, commit, app } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n', 'a.md': 'a\n' });
  await prepareSource(root, 'quitter', quiet);
  const done = JSON.parse(await readFile(join(app, '.euler-source.json'), 'utf8'));
  // As if a run toward a tree with b.md stopped after writing it.
  await put(app, 'b.md', 'b\n');
  const b = { path: 'b.md', sha256: createHash('sha256').update('b\n').digest('hex'), mode: '100644' };
  await writeFile(join(app, '.euler-source.json'), JSON.stringify({ ...done, complete: false, next: [...done.files, b] }));
  // A second run that stops too (here on an edit to a.md made while it runs) must still list
  // b.md as ours, so the next run removes it.
  await commit({ 'vite.config.ts': 'export default {};\n', 'c.md': 'c\n' });
  const edit = { log(line) { if (line.startsWith('Preparing')) writeFileSync(join(app, 'a.md'), 'EDITED'); } };
  await assert.rejects(prepareSource(root, 'quitter', edit), /a\.md changed while setup was running/);
  const interim = JSON.parse(await readFile(join(app, '.euler-source.json'), 'utf8'));
  assert.equal(interim.complete, false);
  assert.ok(interim.files.some((file) => file.path === 'b.md'));
  await writeFile(join(app, 'a.md'), 'a\n');
  await prepareSource(root, 'quitter', quiet);
  assert.equal(await exists(join(app, 'b.md')), false);
  assert.equal(await exists(join(app, 'a.md')), false);

  await writeFile(join(app, '.euler-source.json'), JSON.stringify({ ...done, files: [{ path: '.', sha256: '0'.repeat(64), mode: '100644' }] }));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /unsafe source path: "\."/);
});

test('a linked .workspace-tmp is refused before anything is cleaned', { skip: process.platform === 'win32' }, async (t) => {
  const { root, commit } = await fixture(t);
  await commit({ 'vite.config.ts': 'export default {};\n' });
  const outside = join(root, 'outside');
  await put(outside, 'sources/quitter/keep.txt', 'keep');
  await symlink(outside, join(root, '.workspace-tmp'));
  await assert.rejects(prepareSource(root, 'quitter', quiet), /not a plain folder/);
  assert.equal(await readFile(join(outside, 'sources/quitter/keep.txt'), 'utf8'), 'keep');
});
