import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
    async start(args) {
      let output = '';
      child = spawn(process.execPath, [executable, ...args, '--port', String(port)], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (data) => { output += data; });
      child.stderr.on('data', (data) => { output += data; });
      exited = new Promise((resolve) => child.once('exit', resolve));
      let spawnError;
      child.once('error', (error) => { spawnError = error; });
      const url = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (spawnError) throw spawnError;
        if (child.exitCode !== null || child.signalCode !== null) assert.fail(`Dashboard exited before becoming ready: ${output}`);
        try {
          const response = await fetch(`${url}/api/state`, { signal: AbortSignal.timeout(500) });
          if (response.ok) return { state: await response.json(), url, output };
        } catch {}
        await delay(50);
      }
      assert.fail(`Dashboard did not become ready: ${output}`);
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

test('CLI builds a named app without starting HTTP and rejects unknown app ids', async (t) => {
  const app = await fixture(t);
  const result = spawnSync(process.execPath, [executable, '--config', app.config, '--build', '--app', 'fixture'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Building fixture/);
  assert.equal(await readFile(join(app.root, 'build-cwd.txt'), 'utf8'), app.root);
  const unknown = spawnSync(process.execPath, [executable, '--config', app.config, '--build', '--app', 'unknown'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown app: unknown/);
});
