import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createConfigStore, effectiveConfig } from '../src/config.mjs';

const projects = {
  web: { port: 3000, scripts: ['dev', 'start', 'build', 'test'] },
  board: { port: 5173, scripts: ['dev', 'preview', 'build'] },
  api: { port: 8000, scripts: ['dev', 'start', 'runtime'] },
  wiki: { scripts: ['validate'] },
};
const temporaryRoot = tmpdir();

async function fixture(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const folder = await mkdtemp(join(temporaryRoot, 'dashboard config '));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const file = join(folder, 'state/dashboard/config.json');
  return { file, store: createConfigStore({ file, projects }) };
}

test('missing config loads defaults for runnable projects without creating a file', async (t) => {
  const { file, store } = await fixture(t);
  const config = await store.load();
  assert.deepEqual(Object.keys(config), ['web', 'board', 'api']);
  assert.deepEqual(config.web, { enabled: true, useOverrides: false, port: 3000, mode: 'dev' });
  assert.equal(existsSync(file), false);
  config.web.port = 5001;
  assert.equal((await store.load()).web.port, 3000);
});

test('override toggle retains values and switches effective settings without a restart action', async (t) => {
  const { store } = await fixture(t);
  let config = await store.update('web', { port: 5300, mode: 'start', useOverrides: true });
  assert.deepEqual(effectiveConfig(projects.web, config.web), { enabled: true, port: 5300, mode: 'start' });
  config = await store.update('web', { useOverrides: false, enabled: false });
  assert.deepEqual(config.web, { enabled: false, useOverrides: false, port: 5300, mode: 'start' });
  assert.deepEqual(effectiveConfig(projects.web, config.web), { enabled: false, port: 3000, mode: 'dev' });
  config = await store.update('web', { useOverrides: true });
  assert.deepEqual(effectiveConfig(projects.web, config.web), { enabled: false, port: 5300, mode: 'start' });
});

test('port validation rejects strings, fractions, invalid ranges, and nonfinite numbers', async (t) => {
  const { file, store } = await fixture(t);
  for (const port of ['5300', null, true, 1023, 65536, 3000.5, NaN, Infinity]) {
    await assert.rejects(store.update('web', { port }), /integer between 1024 and 65535/);
  }
  assert.equal(existsSync(file), false);
  await store.update('web', { port: 1024, useOverrides: true });
  assert.equal((await store.update('web', { port: 65535 })).web.port, 65535);
});

test('only known runnable projects, exact fields, booleans and supported modes are accepted', async (t) => {
  const { store } = await fixture(t);
  for (const id of ['wiki', 'missing', '../web', '__proto__', null]) {
    await assert.rejects(store.update(id, {}), /Unknown runnable project/);
  }
  for (const patch of [{ env: {} }, { command: 'node app.js' }, { typo: true }, { enabled: 1 }, { useOverrides: 'false' }, { mode: 'runtime' }, { mode: 'preview' }, null, []]) {
    await assert.rejects(store.update('web', patch));
  }
  await assert.rejects(store.save({ missing: {} }), /Unknown runnable project/);
  await assert.rejects(store.save(JSON.parse('{"__proto__":{}}')), /Unknown runnable project/);
  const saved = await store.update('board', { mode: 'preview', useOverrides: true });
  assert.equal(saved.board.mode, 'preview');
});

test('effective ports must be unique, including disabled apps and override-off transitions', async (t) => {
  const { store } = await fixture(t);
  await store.update('web', { port: 5173 }); // Inactive override does not occupy the port.
  await assert.rejects(store.update('web', { useOverrides: true }), /both use port 5173/);
  await store.update('web', { port: 5300, useOverrides: true });
  await store.update('board', { port: 3000, useOverrides: true, enabled: false });
  await assert.rejects(store.update('web', { useOverrides: false }), /both use port 3000/);
  const retained = await store.load();
  assert.equal(retained.web.useOverrides, true);
  assert.equal(retained.web.port, 5300);
});

test('reserved dashboard ports are rejected only when effective', async (t) => {
  const { file, store } = await fixture(t);
  await store.update('web', { port: 4400 });
  await assert.rejects(store.update('web', { useOverrides: true }), /reserved dashboard port 4400/);
  const custom = createConfigStore({ file, projects, reservedPorts: [4500] });
  await custom.update('web', { useOverrides: true });
  await assert.rejects(custom.update('web', { port: 4500 }), /reserved dashboard port 4500/);
});

test('saved settings round-trip across store instances and atomic replacement leaves no temp files', async (t) => {
  const { file, store } = await fixture(t);
  const saved = await store.update('api', { enabled: false, port: 8010, mode: 'start', useOverrides: true });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { version: 1, apps: saved });
  assert.deepEqual(await createConfigStore({ file, projects }).load(), saved);
  await store.update('api', { enabled: true });
  assert.deepEqual(await readdir(dirname(file)), ['config.json']);
});

test('updates reload external edits and serialize concurrent changes without losing unrelated settings', async (t) => {
  const { file, store } = await fixture(t);
  await store.update('web', { enabled: false });
  const external = JSON.parse(await readFile(file, 'utf8'));
  external.apps.api = { enabled: true, useOverrides: true, port: 8011, mode: 'start' };
  await writeFile(file, JSON.stringify(external));
  const patch = { enabled: false };
  const first = store.update('board', patch);
  patch.enabled = true;
  await Promise.all([first, store.update('web', { port: 5300 }), store.update('web', { mode: 'start' })]);
  const final = await store.load();
  assert.deepEqual(final.api, external.apps.api);
  assert.equal(final.board.enabled, false);
  assert.equal(final.web.enabled, false);
  assert.equal(final.web.port, 5300);
  assert.equal(final.web.mode, 'start');
});

test('invalid existing files fail with an actionable path and remain untouched on update', async (t) => {
  const { file, store } = await fixture(t);
  await mkdir(dirname(file), { recursive: true });
  for (const content of ['{broken', '{}', JSON.stringify({ version: 2, apps: {} }), JSON.stringify({ version: 1, apps: { web: { enabled: 'yes' } } }), JSON.stringify({ version: 1, apps: { removed: {} } }), JSON.stringify({ version: 1, apps: {}, env: {} })]) {
    await writeFile(file, content);
    await assert.rejects(store.load(), (error) => error.code === 'INVALID_SAVED_CONFIG' && error.message.includes(file) && error.message.includes('Fix this file or move it aside'));
    await assert.rejects(store.update('web', { enabled: false }), /Invalid dashboard configuration/);
    assert.equal(await readFile(file, 'utf8'), content);
  }
});

test('new registry apps receive defaults while existing saved values survive', async (t) => {
  const { file, store } = await fixture(t);
  await store.update('web', { port: 5300, useOverrides: true });
  const expanded = createConfigStore({ file, projects: { ...projects, newApp: { port: 9000, scripts: ['dev'] } } });
  const loaded = await expanded.load();
  assert.deepEqual(loaded.newApp, { enabled: true, useOverrides: false, port: 9000, mode: 'dev' });
  assert.equal(loaded.web.port, 5300);
  assert.equal(loaded.web.useOverrides, true);
});
