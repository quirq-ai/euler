import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { defaultManifest, loadWorkspace } from '../src/workspace.mjs';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

function manifest() {
  return {
    version: 1,
    name: 'Example workspace',
    projects: {
      web: {
        name: 'Web app', directory: '.', port: 5301,
        scripts: ['dev', 'start', 'preview', 'build', 'test'], urlPath: '/hello/',
        commands: {
          dev: ['{node}', 'server.mjs', '--port', '{port}', '{workspaceRoot}', '{projectRoot}'],
          start: ['{node}', 'server.mjs', '--port', '{port}'],
          preview: ['{node}', 'server.mjs', '--port', '{port}'],
        },
        compiled: { type: 'static', output: 'dist-euler', build: ['{node}', 'build.mjs'] },
      },
    },
  };
}

async function fixture(t, value = manifest()) {
  const root = await mkdtemp(join(tmpdir(), 'quirq workspace '));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  const config = join(root, 'euler.workspace.json');
  await writeFile(config, JSON.stringify(value), 'utf8');
  return { root, config };
}

test('explicit workspace loads JSON, preserves registered scripts, and uses local state', async (t) => {
  const value = manifest();
  const { root, config } = await fixture(t, value);
  const loaded = await loadWorkspace({ workspace: root });
  assert.equal(loaded.root, root);
  assert.equal(loaded.configFile, config);
  assert.equal(loaded.name, value.name);
  assert.equal(loaded.mode, 'compiled');
  assert.equal(loaded.stateFile, join(root, '.workspace-state', 'euler', 'config.json'));
  assert.deepEqual(loaded.projects.web.scripts, value.projects.web.scripts);
  assert.deepEqual(loaded.projects.web.commands, value.projects.web.commands);
  assert.equal(loaded.projects.web.urlPath, '/hello/');
});

test('explicit config uses its directory as the root and supports paths containing spaces', async (t) => {
  const { root } = await fixture(t);
  const nested = join(root, 'custom config');
  await mkdir(nested);
  const config = join(nested, 'my workspace.json');
  await writeFile(config, JSON.stringify(manifest()));
  const loaded = await loadWorkspace({ config: join('custom config', 'my workspace.json'), cwd: root });
  assert.equal(loaded.root, nested);
  assert.equal(loaded.configFile, config);
  assert.equal(loaded.stateFile, join(nested, '.workspace-state', 'euler', 'config.json'));
});

test('default manifest is anchored to the Euler repository regardless of current folder or nearby manifests', async (t) => {
  const { root } = await fixture(t);
  const nested = join(root, 'nested');
  const cwd = join(nested, 'app', 'src');
  await mkdir(cwd, { recursive: true });
  await writeFile(join(nested, 'euler.workspace.json'), JSON.stringify({ ...manifest(), name: 'Nearest' }));
  await writeFile(join(nested, 'quirq.workspace.json'), JSON.stringify({ ...manifest(), name: 'Old dashboard' }));
  const loaded = await loadWorkspace({ cwd });
  assert.equal(resolve(loaded.root), resolve(repositoryRoot));
  assert.equal(loaded.configFile, defaultManifest);
  assert.notEqual(loaded.name, 'Nearest');
  assert.notEqual(loaded.name, 'Old dashboard');
  assert.equal((await loadWorkspace({ cwd: root })).configFile, defaultManifest);
});

test('explicit workspace requires a manifest in that directory without walking upward', async (t) => {
  const { root } = await fixture(t);
  const folder = join(root, 'empty');
  await mkdir(folder);
  await assert.rejects(loadWorkspace({ workspace: 'empty', cwd: root }), /euler\.workspace\.json|not found|ENOENT/i);
});

test('explicit missing files and conflicting sources never fall back to another workspace', async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(loadWorkspace({ config: 'missing.json', cwd: root }), /missing.json/);
  await assert.rejects(loadWorkspace({ workspace: root, config: 'anything.json' }), /Choose only one/);
});

test('malformed, incompatible, and structurally invalid explicit manifests fail', async (t) => {
  const { root, config } = await fixture(t);
  for (const source of ['{', 'null', '[]', '{}', JSON.stringify({ ...manifest(), version: 2 }), JSON.stringify({ ...manifest(), projects: [] })]) {
    await writeFile(config, source);
    await assert.rejects(loadWorkspace({ workspace: root }), undefined, source);
  }
  await assert.rejects(loadWorkspace({ config: join(root, 'missing.json') }));
});

test('invalid ids, ports, project directories, URLs, and command values are rejected', async (t) => {
  const { root, config } = await fixture(t);
  const invalid = [
    (value) => { value.projects['../outside'] = value.projects.web; delete value.projects.web; },
    (value) => { value.projects['bad id'] = value.projects.web; delete value.projects.web; },
    ...[1023, 65536, 5301.5, '5301'].map((port) => (value) => { value.projects.web.port = port; }),
    ...['../outside', '/absolute', 'C:\\outside'].map((directory) => (value) => { value.projects.web.directory = directory; }),
    ...['https://foreign.example/', '//foreign.example/', 'javascript:alert(1)', '/\\foreign.example/'].map((urlPath) => (value) => { value.projects.web.urlPath = urlPath; }),
    (value) => { value.projects.web.commands.dev = 'node server.mjs'; },
    (value) => { value.projects.web.commands.dev = []; },
    (value) => { value.projects.web.commands.dev = ['node', 123]; },
    (value) => { value.projects.web.commands.dev = ['node', 'nul\0arg']; },
    (value) => { value.projects.web.commands.dev = ['{unknownToken}']; },
  ];
  for (const change of invalid) {
    const value = manifest();
    change(value);
    await writeFile(config, JSON.stringify(value));
    await assert.rejects(loadWorkspace({ workspace: root }), undefined, JSON.stringify(value));
  }
});

test('manifest loading does not execute JavaScript configuration or app commands', async (t) => {
  const { root, config } = await fixture(t);
  const marker = join(root, 'should-not-exist.txt');
  const module = join(root, 'euler.workspace.mjs');
  await writeFile(module, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed'); export default {};`);
  await assert.rejects(loadWorkspace({ config: module }));
  const loaded = await loadWorkspace({ config });
  assert.equal(basename(loaded.configFile), 'euler.workspace.json');
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  assert.equal(resolve(loaded.root), root);
});
