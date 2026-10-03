import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseArgs } from '../src/cli.mjs';

const executable = fileURLToPath(new URL('../bin/euler.mjs', import.meta.url));

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'quirq cli workspace '));
  let child;
  let exited;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      const closed = await Promise.race([exited.then(() => true), delay(5000, undefined, { ref: false }).then(() => false)]);
      if (!closed) { child.kill('SIGKILL'); await exited; }
    }
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  const port = await freePort();
  let projectPort = await freePort();
  while (projectPort === port) projectPort = await freePort();
  const marker = join(root, 'app-started.txt');
  const manifest = {
    version: 1, name: 'Independent CLI workspace',
    projects: {
      fixture: {
        directory: '.', port: projectPort, scripts: ['dev'],
        commands: { dev: ['{node}', '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'started')`] },
        compiled: { type: 'static', output: 'dist-euler', build: ['{node}', 'build-fixture.mjs'] },
      },
    },
  };
  const config = join(root, 'euler.workspace.json');
  await writeFile(config, JSON.stringify(manifest));
  await mkdir(join(root, 'dist-euler'));
  await writeFile(join(root, 'dist-euler', 'index.html'), '<html><head></head><body>Mounted fixture</body></html>');
  await writeFile(join(root, 'dist-euler', 'quirq-build.json'), JSON.stringify({ version: 1, id: 'fixture', type: 'static', basePath: '/app/fixture' }));
  await writeFile(join(root, 'build-fixture.mjs'), `import { writeFile } from 'node:fs/promises'; await writeFile('build-cwd.txt', process.cwd());`);
  return {
    root, port, config, marker,
    async start(args, { cwd = root, entry = executable } = {}) {
      let output = '';
      child = spawn(process.execPath, [entry, ...args, '--port', String(port)], {
        cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (data) => { output += data; });
      child.stderr.on('data', (data) => { output += data; });
      exited = new Promise((resolve) => child.once('exit', resolve));
      let spawnError;
      child.once('error', (error) => { spawnError = error; });
      const url = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 10000;
      const expectedIds = Object.keys(manifest.projects);
      let state;
      while (Date.now() < deadline) {
        if (spawnError) throw spawnError;
        if (child.exitCode !== null || child.signalCode !== null) assert.fail(`Dashboard exited before becoming ready: ${output}`);
        try {
          const response = await fetch(`${url}/api/state`, { signal: AbortSignal.timeout(500) });
          if (response.ok) state = await response.json();
        } catch {}
        if (state) {
          const projects = state.projects.filter(({ id }) => expectedIds.includes(id));
          const failed = projects.find(({ status }) => status === 'error' || status === 'failed');
          if (failed) assert.fail(`App ${failed.id} failed during startup: ${failed.error || failed.status}\n${output}`);
          // The HTTP listener is live before compiled apps finish mounting.
          if (expectedIds.every((id) => projects.some((project) => project.id === id && project.status === 'running'))) {
            return { state, url, output };
          }
        }
        await delay(50);
      }
      assert.fail(`Dashboard did not become ready: ${output}\nLast state: ${JSON.stringify(state)}`);
    },
  };
}

test('CLI help is available without a workspace or installed dependencies', () => {
  const result = spawnSync(process.execPath, [executable, '--help'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  for (const option of ['--workspace', '--config', '--build', '--app', '--port']) assert.ok(result.stdout.includes(option), option);
  assert.doesNotMatch(result.stdout, /--profile|--demo|4400/);
});

test('CLI argument parser accepts each workspace source and rejects ambiguous or invalid input', () => {
  assert.deepEqual(parseArgs([]), { port: 2713 });
  assert.deepEqual(parseArgs(['--workspace', 'folder with spaces', '--port', '5500']), { workspace: 'folder with spaces', port: 5500 });
  assert.deepEqual(parseArgs(['--config', 'custom config.json']), { config: 'custom config.json', port: 2713 });
  assert.deepEqual(parseArgs(['--build']), { build: true, port: 2713 });
  assert.deepEqual(parseArgs(['--build', '--app', 'fixture']), { build: true, app: 'fixture', port: 2713 });
  for (const args of [
    ['--workspace'], ['--config'], ['--port'], ['--workspace', '--demo'],
    ['--workspace', 'one', '--config', 'two'], ['--workspace', 'one', '--demo'], ['--config', 'one', '--demo'],
    ['--demo', '--demo'], ['--port', '5500', '--port', '5501'], ['--unknown'], ['exec', 'node'],
    ['--profile', 'euler'], ['--demo'], ['--app', 'fixture'], ['--build', '--app'], ['--build', '--app', 'a', '--app', 'b'],
    ...['0', '1023', '65536', '5.5', 'NaN'].map((port) => ['--port', port]),
  ]) assert.throws(() => parseArgs(args), undefined, JSON.stringify(args));
});

test('invalid CLI options exit with an actionable failure instead of starting a server', () => {
  const result = spawnSync(process.execPath, [executable, '--port', 'invalid'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  assert.equal(result.status, 1, result.stderr || result.error?.message);
  assert.match(result.stderr, /port/i);
});

for (const source of ['workspace', 'config']) {
  test(`CLI --${source} automatically mounts enabled builds without running development commands`, { timeout: 20000 }, async (t) => {
    const app = await fixture(t);
    const { state, url } = await app.start([`--${source}`, source === 'workspace' ? app.root : app.config]);
    assert.equal(state.dashboard.name, 'Independent CLI workspace');
    assert.equal(state.dashboard.mode, 'compiled');
    assert.equal(state.dashboard.profile, undefined);
    assert.equal(state.dashboard.port, app.port);
    assert.deepEqual(state.projects.map(({ id }) => id), ['fixture']);
    assert.equal(state.projects[0].available, true);
    assert.equal(state.projects[0].pid, null);
    assert.equal(state.projects[0].status, 'running');
    await assert.rejects(readFile(app.marker), { code: 'ENOENT' });
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /euler-home\.js/);
    const mounted = await fetch(`${url}/app/fixture/`);
    assert.equal(mounted.status, 200);
    assert.match(await mounted.text(), /Mounted fixture/);
  });
}

test('CLI readiness reports an app startup failure instead of accepting the listening server', { timeout: 20000 }, async (t) => {
  const app = await fixture(t);
  await rm(join(app.root, 'dist-euler', 'quirq-build.json'));
  await assert.rejects(app.start(['--config', app.config]), /App fixture failed during startup:/);
});

test('CLI builds a named app without starting HTTP and rejects unknown app ids', async (t) => {
  const app = await fixture(t);
  const result = spawnSync(process.execPath, [executable, '--config', app.config, '--build', '--app', 'fixture'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Building fixture/);
  // macOS exposes temporary directories through /var -> /private/var.
  assert.equal(await realpath(await readFile(join(app.root, 'build-cwd.txt'), 'utf8')), await realpath(app.root));
  const unknown = spawnSync(process.execPath, [executable, '--config', app.config, '--build', '--app', 'unknown'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown app: unknown/);
  assert.doesNotMatch(unknown.stdout, /Home assets validated/);
});

test('CLI can build only Home, while full builds include Home and the selected workspace', async (t) => {
  const app = await fixture(t);
  const home = spawnSync(process.execPath, [executable, '--config', app.config, '--build', '--app', 'home'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.equal(home.status, 0, home.stderr || home.error?.message);
  assert.match(home.stdout, /Home assets validated/);
  assert.doesNotMatch(home.stdout, /Building fixture/);
  await assert.rejects(readFile(join(app.root, 'build-cwd.txt')), { code: 'ENOENT' });
  const all = spawnSync(process.execPath, [executable, '--config', app.config, '--build'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.equal(all.status, 0, all.stderr || all.error?.message);
  assert.match(all.stdout, /Home assets validated[\s\S]*Building fixture/);
  assert.equal(await realpath(await readFile(join(app.root, 'build-cwd.txt'), 'utf8')), await realpath(app.root));
});

for (const script of ['dev', 'start']) {
  test(`Home's ${script} entry runs from app/home against the same Euler API`, { timeout: 20000 }, async (t) => {
    const app = await fixture(t);
    const homeDirectory = fileURLToPath(new URL('../app/home/', import.meta.url));
    const pkg = JSON.parse(await readFile(join(homeDirectory, 'package.json'), 'utf8'));
    const [command, entry, ...args] = pkg.scripts[script].split(' ');
    assert.equal(command, 'node');
    const { url, state } = await app.start([...args, '--config', app.config], { cwd: homeDirectory, entry });
    assert.deepEqual(state.projects.map((project) => project.id), ['fixture']);
    for (const path of ['/', '/euler-home.js', '/euler-avatar-editor.js', '/euler-avatar.js', '/euler-dock.js']) {
      assert.equal((await fetch(`${url}${path}`)).status, 200, path);
    }
  });
}
