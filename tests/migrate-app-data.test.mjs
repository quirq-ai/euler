import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { migrateAppData } from '../scripts/migrate-app-data.mjs';

const ids = ['innernet', 'quitter', 'instants'];
async function put(root, path, value = 'personal data') {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), value);
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'Euler migration with spaces '));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  await put(root, 'app/upstream.json', JSON.stringify({ version: 1, applications: ids.map((id) => ({ id, directory: `app/${id}` })) }));
  await put(root, 'euler.workspace.json', JSON.stringify({ projects: Object.fromEntries(ids.map((id) => [id, { directory: `app/${id}` }])) }));
  for (const id of ids) await put(root, `app/${id}/package.json`, '{}');
  return root;
}
async function missing(root, path) {
  await assert.rejects(readFile(join(root, path)), { code: 'ENOENT' });
}

test('fresh clones and repeat migrations are no-ops; private files survive a path with spaces', async (t) => {
  const root = await fixture(t);
  assert.deepEqual((await migrateAppData(root)).moved, []);
  const files = {
    'innernet/.env.local': 'SECRET=example-only',
    'innernet/data/index/nested db.sqlite': Buffer.from([0, 255, 4, 2]),
    'instants/.session.json': '{"example":true}',
    'quitter/custom settings/personal.json': 'settings',
  };
  for (const [path, value] of Object.entries(files)) await put(root, `apps/${path}`, value);
  const result = await migrateAppData(root);
  assert.equal(result.moved.length, 4);
  for (const [path, value] of Object.entries(files)) {
    assert.deepEqual(await readFile(join(root, `app/${path}`)), Buffer.from(value));
    await missing(root, `apps/${path}`);
  }
  assert.deepEqual((await migrateAppData(root)).moved, []);
});

test('dry run leaves files and destination directories untouched', async (t) => {
  const root = await fixture(t);
  await put(root, 'apps/innernet/personal/new/file', 'unchanged');
  const result = await migrateAppData(root, { dryRun: true });
  assert.equal(result.planned.length, 1);
  assert.deepEqual(result.moved, []);
  assert.equal(await readFile(join(root, 'apps/innernet/personal/new/file'), 'utf8'), 'unchanged');
  assert.deepEqual(await readdir(join(root, 'app/innernet')), ['package.json']);
});

test('all collisions are checked before any file is moved, including identical contents', async (t) => {
  const root = await fixture(t);
  await put(root, 'apps/innernet/first/file', 'first');
  await put(root, 'apps/quitter/last/file', 'same');
  await put(root, 'app/quitter/last/file', 'same');
  await assert.rejects(migrateAppData(root), /Destination collision/);
  assert.equal(await readFile(join(root, 'apps/innernet/first/file'), 'utf8'), 'first');
  assert.deepEqual(await readdir(join(root, 'app/innernet')), ['package.json']);
  assert.equal(await readFile(join(root, 'apps/quitter/last/file'), 'utf8'), 'same');
  assert.equal(await readFile(join(root, 'app/quitter/last/file'), 'utf8'), 'same');
});

test('file versus directory conflicts are detected in preflight', async (t) => {
  const root = await fixture(t);
  await put(root, 'apps/innernet/data/nested/file');
  await put(root, 'app/innernet/data', 'existing file');
  await assert.rejects(migrateAppData(root), /Destination collision/);
  assert.equal(await readFile(join(root, 'app/innernet/data'), 'utf8'), 'existing file');
});

test('generated artifacts stay behind, but similarly named nested personal files migrate', async (t) => {
  const root = await fixture(t);
  const generated = ['node_modules', '.next', '.next-euler', 'dist', 'dist-euler', '.nx'];
  for (const folder of generated) await put(root, `apps/innernet/${folder}/cache`, 'generated');
  await put(root, 'apps/innernet/tsconfig.tsbuildinfo', 'generated');
  await put(root, 'apps/innernet/data/other.tsbuildinfo', 'generated');
  await put(root, 'apps/innernet/data/dist/personal', 'keep');
  const result = await migrateAppData(root);
  assert.equal(result.skipped.length, 8);
  assert.equal(result.moved.length, 1);
  assert.equal(await readFile(join(root, 'app/innernet/data/dist/personal'), 'utf8'), 'keep');
  for (const folder of generated) assert.equal(await readFile(join(root, `apps/innernet/${folder}/cache`), 'utf8'), 'generated');
});

test('unknown old app entries and nested Git repositories block the whole migration', async (t) => {
  const root = await fixture(t);
  await put(root, 'apps/innernet/.env');
  await put(root, 'apps/something-else/personal');
  await assert.rejects(migrateAppData(root), /Unrecognized old entry/);
  await missing(root, 'app/innernet/.env');
  await rm(join(root, 'apps/something-else'), { recursive: true });
  await put(root, 'apps/innernet/.git/config');
  await assert.rejects(migrateAppData(root), /Nested repository/);
  await missing(root, 'app/innernet/.env');
});

test('pre-rename or partial layouts cannot migrate personal data', async (t) => {
  const root = await fixture(t);
  await put(root, 'apps/innernet/.env');
  await put(root, 'euler.workspace.json', JSON.stringify({ projects: { innernet: { directory: 'apps/innernet' } } }));
  await assert.rejects(migrateAppData(root), /Pull the complete new app/);
  await missing(root, 'app/innernet/.env');
});

for (const where of ['source', 'destination', 'app-root']) {
  test(`rejects ${where} directory links without reading or modifying outside data`, async (t) => {
    const root = await fixture(t);
    const outside = await mkdtemp(join(tmpdir(), 'Euler external personal '));
    t.after(() => rm(outside, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
    await put(outside, 'private', 'external secret');
    await put(root, 'apps/innernet/a-safe-first', 'keep');
    let link;
    if (where === 'source') link = join(root, 'apps/innernet/z-linked');
    if (where === 'destination') {
      await put(root, 'apps/innernet/z-linked/private', 'personal');
      link = join(root, 'app/innernet/z-linked');
    }
    if (where === 'app-root') link = join(root, 'apps/quitter');
    await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(migrateAppData(root), /Manual migration required for link/);
    assert.equal(await readFile(join(outside, 'private'), 'utf8'), 'external secret');
    assert.equal(await readFile(join(root, 'apps/innernet/a-safe-first'), 'utf8'), 'keep');
    await missing(root, 'app/innernet/a-safe-first');
  });
}
