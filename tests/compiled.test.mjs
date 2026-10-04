import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { parseArgs } from '../src/cli.mjs';
import { buildCompiledWorkspace, compiledStore, createCompiledManager, inspectBuild } from '../src/compiled.mjs';
import { createConfigStore } from '../src/config.mjs';
import { createEulerServer } from '../src/server.mjs';
import { loadWorkspace, validateManifest } from '../src/workspace.mjs';

const index = '<!doctype html><html><body><h1>Compiled fixture</h1><script src="/app/alpha/assets/main.js"></script></body></html>';
const withoutDock = (html) => html.replace(/<link rel="stylesheet" href="\/euler-dock\.css" data-euler-dock>/g, '').replace(/<link rel="preload" href="\/euler-dock-ui\.css" as="style" data-euler-dock>/g, '').replace(/<script type="module" src="\/euler-dock\.js" blocking="render" data-euler-dock><\/script>/g, '');

function manifest() {
  const project = (id, port) => ({ name: id, directory: `app/${id}`, port, scripts: ['dev'], commands: { dev: ['{node}', 'unused-dev.mjs'] },
    compiled: { type: 'static', output: 'dist-euler', build: ['{node}', 'build-fixture.mjs', 'an argument with spaces', '{projectRoot}', '{workspaceRoot}', '{port}', 'literal;$value'] } });
  return { version: 1, name: 'Euler', projects: { alpha: project('alpha', 5301), beta: project('beta', 5302) } };
}

async function fixture(t, { built = true, value = manifest() } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'quirq compiled workspace '));
  const servers = [];
  t.after(async () => {
    for (const app of servers.reverse()) await app.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  const config = join(root, 'euler.workspace.json');
  await writeFile(config, JSON.stringify(value));
  for (const [id, project] of Object.entries(value.projects)) {
    const directory = join(root, project.directory);
    await mkdir(directory, { recursive: true });
    if (!built) continue;
    const output = join(directory, project.compiled.output);
    await mkdir(join(output, 'assets'), { recursive: true });
    await writeFile(join(output, 'index.html'), index);
    await writeFile(join(output, 'BUILD_ID'), 'fixture-build');
    await writeFile(join(output, 'assets', 'main.js'), 'globalThis.compiledFixture = true;');
    await writeFile(join(output, 'assets', 'main.css'), 'body { color: green; }');
    await writeFile(join(output, '.env'), 'PRIVATE_FIXTURE_TOKEN=secret');
    await writeFile(join(output, 'quirq-build.json'), JSON.stringify({ version: 1, id, type: project.compiled.type, basePath: `/app/${id}` }));
  }
  const workspace = await loadWorkspace({ workspace: root });
  return { root, config, workspace, value, output: (id) => join(root, value.projects[id].directory, value.projects[id].compiled.output),
    async start(manager) {
      const app = await createEulerServer({ workspace, manager, port: 0 });
      servers.push(app);
      return app;
    } };
}

function request(app, path, { method = 'GET', headers = {}, body } = {}) {
  const address = new URL(app.url);
  return new Promise((resolvePromise, reject) => {
    const req = httpRequest({ hostname: address.hostname, port: address.port, path, method, headers, timeout: 4000 }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.once('error', reject);
      response.once('end', () => {
        const bytes = Buffer.concat(chunks);
        const text = bytes.toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch { /* App HTML, assets, and HEAD responses are not JSON. */ }
        resolvePromise({ status: response.statusCode, headers: response.headers, bytes, text, json });
      });
    });
    req.once('error', reject);
    req.once('timeout', () => req.destroy(new Error(`Request timed out: ${method} ${path}`)));
    req.end(body);
  });
}

function mutation(app, path, body = {}, method = 'POST') {
  return request(app, path, { method, headers: { origin: app.url, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('Euler workspace hosts its registry directly and isolates its settings from the old dashboard', async (t) => {
  const { root, workspace } = await fixture(t);
  assert.equal(workspace.mode, 'compiled');
  assert.equal(workspace.profile, undefined);
  assert.equal(workspace.name, 'Euler');
  assert.deepEqual(Object.keys(workspace.projects), ['alpha', 'beta']);
  assert.equal(workspace.stateFile, join(root, '.workspace-state', 'euler', 'config.json'));
});

test('Euler CLI builds directly and rejects legacy profile selection or ambiguous options', () => {
  assert.deepEqual(parseArgs(['--workspace', 'folder with spaces', '--build']), { port: 2713, workspace: 'folder with spaces', build: true });
  assert.deepEqual(parseArgs(['--build', '--app', 'alpha', '--port', '4500']), { port: 4500, build: true, app: 'alpha' });
  for (const args of [['--app', 'alpha'], ['--profile'], ['--profile', 'euler'], ['--build', '--build']]) {
    assert.throws(() => parseArgs(args), undefined, JSON.stringify(args));
  }
});

test('manifest validation requires compiled adapters and rejects escaping output or profiles', () => {
  const mutations = [
    (value) => { value.projects.alpha.compiled.type = 'proxy'; },
    ...['.', './', '.\\', '../outside', '/absolute', 'C:\\outside', '\\\\server\\share'].map((output) => (value) => { value.projects.alpha.compiled.output = output; }),
    ...[[], 'node build.js', ['node', 7], ['node', 'bad\0argument'], ['{unknown}']].map((build) => (value) => { value.projects.alpha.compiled.build = build; }),
    (value) => { value.profiles = { euler: { mode: 'compiled', apps: ['alpha'] } }; },
    (value) => { delete value.projects.alpha.compiled; },
    (value) => { value.name = ''; },
  ];
  for (const change of mutations) {
    const value = manifest();
    change(value);
    assert.throws(() => validateManifest(value), /Invalid workspace manifest/, JSON.stringify(value));
  }
});

test('compiled server automatically mounts enabled apps on its own listener and serves app HTML without a viewer', async (t) => {
  const fixtureApp = await fixture(t);
  const app = await fixtureApp.start();
  const state = await request(app, '/api/state');
  assert.equal(state.status, 200);
  assert.equal(state.json.dashboard.mode, 'compiled');
  assert.equal(state.json.dashboard.profile, undefined);
  const port = Number(new URL(app.url).port);
  for (const project of state.json.projects) {
    assert.equal(project.status, 'running');
    assert.equal(project.port, port);
    assert.equal(project.pid, null);
    assert.equal(project.hosting, 'compiled');
    assert.equal(project.url, `/app/${project.id}/`);
    assert.deepEqual(project.modes, ['start']);
    const response = await request(app, project.url);
    assert.equal(response.status, 200, response.text);
    assert.equal(withoutDock(response.text), index);
    assert.match(response.text, /src="\/euler-dock\.js"/);
    assert.doesNotMatch(response.text, /iframe|preview\.js|frame-container/);
  }
  assert.equal((await request(app, '/')).status, 200);
  for (const path of ['/app/other/', '/app/unknown/']) assert.equal((await request(app, path)).status, 404, path);
});

test('static routing preserves the mount prefix, serves assets and HEAD metadata, and supports HTML SPA fallback', async (t) => {
  const app = await (await fixture(t)).start();
  const redirect = await request(app, '/app/alpha?tab=one');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/app/alpha/?tab=one');
  for (const [path, contentType, content] of [
    ['/app/alpha/', /text\/html/, index],
    ['/app/alpha/assets/main.js?version=1', /text\/javascript/, 'globalThis.compiledFixture = true;'],
    ['/app/alpha/assets/main.css', /text\/css/, 'body { color: green; }'],
  ]) {
    const get = await request(app, path);
    assert.equal(get.status, 200, get.text);
    assert.match(get.headers['content-type'], contentType);
    assert.equal(withoutDock(get.text), content);
    const head = await request(app, path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-type'], get.headers['content-type']);
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength(content));
    assert.equal(head.text, '');
  }
  const spa = await request(app, '/app/alpha/nested/client/route?tab=two', { headers: { accept: 'text/html' } });
  assert.equal(spa.status, 200);
  assert.equal(withoutDock(spa.text), index);
  for (const path of ['/app/alpha/assets/missing.js', '/app/alpha/missing.css']) assert.equal((await request(app, path, { headers: { accept: 'text/html' } })).status, 404);
  assert.equal((await request(app, '/app/alpha/api/missing', { headers: { accept: 'application/json' } })).status, 404);
  assert.equal((await mutation(app, '/app/alpha/')).status, 405);
});

test('Euler Home contains app controls and statistics, with legacy management links redirected', async (t) => {
  const fixtureApp = await fixture(t);
  const compiled = await fixtureApp.start();
  const home = await request(compiled, '/');
  assert.equal(home.status, 200);
  assert.match(home.text, /src="\/euler-home\.js"/);
  assert.equal(home.text.split('src="/euler-dock.js"').length, 2, 'One shared dock module');
  assert.match(home.text, /href="\/euler-dock\.css"/);
  for (const id of ['applications', 'apps', 'running-count', 'enabled-count', 'total-count', 'start-enabled', 'stop-all', 'appearance']) {
    assert.ok(home.text.includes(`id="${id}"`), id);
  }
  assert.doesNotMatch(home.text, /href="\/manage"|src="\/app\.js"/);
  const head = await request(compiled, '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.text, '');
  for (const path of ['/manage', '/manage/', '/manage?from=bookmark']) {
    for (const method of ['GET', 'HEAD']) {
      const legacy = await request(compiled, path, { method });
      assert.equal(legacy.status, 302);
      assert.equal(legacy.headers.location, '/#applications');
      assert.equal(legacy.text, '');
    }
    assert.equal((await request(compiled, path, { headers: { origin: 'https://foreign.example' } })).status, 403);
  }
  for (const path of ['/app.js', '/app.css', '/preview.js', '/preview.css', '/api/projects/alpha/preview']) {
    assert.equal((await request(compiled, path)).status, 404, path);
  }
});

test('Euler public assets use an explicit allowlist with existing origin and traversal protections', async (t) => {
  const app = await (await fixture(t)).start();
  for (const [path, type] of [
    ['/euler.css', /text\/css/], ['/euler-dock.css', /text\/css/], ['/euler-dock-ui.css', /text\/css/],
    ['/euler-dock-host.css', /text\/css/], ['/euler-dock-extension.js', /text\/javascript/],
    ['/euler-home.js', /text\/javascript/], ['/euler-dock.js', /text\/javascript/],
    ['/euler-avatar.js', /text\/javascript/], ['/euler-avatar-editor.js', /text\/javascript/],
    ['/vendor/blobatar/index.js', /text\/javascript/], ['/vendor/blobatar/expression.js', /text\/javascript/],
    ...['innernet', 'quitter', 'instants', 'home', 'settings'].map((id) => [`/euler-icons/${id}.svg`, /image\/svg\+xml/]),
  ]) {
    const asset = await request(app, path);
    assert.equal(asset.status, 200, path);
    assert.match(asset.headers['content-type'], type);
    assert.ok(asset.text.length, path);
    assert.equal((await request(app, path, { headers: { origin: 'https://foreign.example' } })).status, 403);
  }
  for (const path of ['/euler-icons/missing.svg', '/euler-icons/../euler.html', '/euler-icons/%2e%2e/euler.html', '/euler-icons/%5c..%5ceuler.html', '/vendor/blobatar/provenance.json', '/vendor/blobatar/../../euler.html']) {
    assert.equal((await request(app, path)).status, 404, path);
  }
  for (const path of ['/app/home/package.json', '/app/home/build.mjs', '/app/home/assets.mjs', '/app/home/server.mjs', '/app/home/src/dock.mjs', '/app/home/public/euler.html', '/app/home/public/euler-dock.js']) {
    assert.equal((await request(app, path)).status, 404, 'Home package internals are not public routes');
  }
});

test('Home document integration runs before app compression and preserves non-document responses', async (t) => {
  const value = manifest();
  value.projects.alpha.compiled.type = 'next';
  delete value.projects.beta;
  const fixtureApp = await fixture(t, { value });
  const manager = createCompiledManager({ workspace: fixtureApp.workspace, dashboardPort: 4500,
    createHandler: async () => ({
      async handle(req, res) {
        const encoding = req.headers['accept-encoding'];
        const content = encoding === 'gzip' ? gzipSync(index) : Buffer.from(index);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': content.length,
          'Content-Encoding': encoding,
        });
        res.end(req.method === 'HEAD' ? undefined : content);
      },
      async close() {},
    }),
  });
  const app = await fixtureApp.start(manager);
  const document = await request(app, '/app/alpha', { headers: { 'accept-encoding': 'gzip', 'sec-fetch-dest': 'document' } });
  assert.equal(document.status, 200);
  assert.equal(document.headers['content-encoding'], 'identity');
  assert.equal(document.headers['content-length'], undefined);
  assert.equal(withoutDock(document.text), index);
  assert.match(document.text, /src="\/euler-dock\.js"/);

  // Even HTML from these requests must bypass Home's presentation hook.
  for (const [path, options] of [
    ['/app/alpha/api/items', {}],
    ['/app/alpha/_next/static/file.js', {}],
    ['/app/alpha', { method: 'HEAD' }],
    ['/app/alpha', { method: 'POST' }],
    ['/app/alpha', { headers: { rsc: '1' } }],
    ['/app/alpha', { headers: { accept: 'text/x-component' } }],
    ['/app/alpha', { headers: { 'next-router-prefetch': '1' } }],
    ['/app/alpha', { headers: { 'sec-fetch-dest': 'script' } }],
    ['/app/alpha', { headers: { range: 'bytes=0-10' } }],
  ]) {
    const response = await request(app, path, { ...options, headers: { 'accept-encoding': 'gzip', ...options.headers } });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers['content-encoding'], 'gzip', path);
    assert.equal(Number(response.headers['content-length']), gzipSync(index).length, path);
    assert.deepEqual(response.bytes, options.method === 'HEAD' ? Buffer.alloc(0) : gzipSync(index), path);
  }
});

test('each app selects its own dock while Home and unconfigured apps retain the default', async (t) => {
  const value = manifest();
  value.projects.gamma = { ...value.projects.beta, directory: 'app/gamma', port: 5303 };
  value.projects.alpha.dock = { module: 'euler/team dock.mjs', stylesheet: 'euler/dock.css' };
  value.projects.beta.dock = { stylesheet: 'euler/theme.css' };
  const fixtureApp = await fixture(t, { value });
  const files = [
    ['alpha', 'team dock.mjs', 'export function mount(context) { return () => {}; }', /text\/javascript/],
    ['alpha', 'dock.css', ':host { color: teal; }', /text\/css/],
    ['beta', 'theme.css', '.dock { border-radius: 8px; }', /text\/css/],
  ];
  for (const [id, file, content] of files) {
    await mkdir(join(fixtureApp.output(id), 'euler'), { recursive: true });
    await writeFile(join(fixtureApp.output(id), 'euler', file), content);
  }
  const app = await fixtureApp.start();
  const expected = {
    alpha: { version: 1, appId: 'alpha', moduleUrl: '/app/alpha/euler/team%20dock.mjs', stylesheetUrl: '/app/alpha/euler/dock.css' },
    beta: { version: 1, appId: 'beta', stylesheetUrl: '/app/beta/euler/theme.css' },
  };
  for (const id of ['alpha', 'beta']) {
    for (const route of [`/app/${id}/`, `/app/${id}/nested/page?tab=one`]) {
      const page = await request(app, route, { headers: { accept: 'text/html' } });
      assert.equal(page.status, 200);
      const config = /<meta name="euler-dock-config" content="([^"]*)"[^>]*>/.exec(page.text);
      assert.ok(config, `${route} selects an app dock`);
      const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      assert.deepEqual(JSON.parse(decode(config[1])), expected[id]);
      assert.equal(page.text.split('name="euler-dock-config"').length, 2);
      assert.equal(withoutDock(page.text.replace(config[0], '')), index);
    }
  }
  for (const route of ['/', '/app/gamma/', '/api/state']) {
    const response = await request(app, route);
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.text, /name="euler-dock-config"/);
  }
  for (const [id, file, content, type] of files) {
    const route = `/app/${id}/euler/${encodeURIComponent(file)}`;
    const asset = await request(app, route);
    assert.equal(asset.status, 200, route);
    assert.match(asset.headers['content-type'], type);
    assert.equal(asset.text, content);
    const head = await request(app, route, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.text, '');
  }
  const missing = await request(app, '/app/alpha/euler/missing.js', { headers: { accept: 'text/html' } });
  assert.equal(missing.status, 404, 'Missing custom modules must not receive an HTML SPA fallback');
  assert.doesNotMatch(missing.text, /euler-dock-config/);
});

test('static handler does not expose build markers, dotfiles, traversal targets, or malformed paths', async (t) => {
  const fixtureApp = await fixture(t);
  await writeFile(join(fixtureApp.root, 'outside.txt'), 'PRIVATE_OUTSIDE_CONTENT');
  const app = await fixtureApp.start();
  for (const path of [
    '/app/alpha/quirq-build.json', '/app/alpha/quirq-build%2Ejson', '/app/alpha/.env', '/app/alpha/%2eenv',
    '/app/alpha/.git/config', '/app/alpha/%2e%2e/outside.txt', '/app/alpha/%2e%2e%2foutside.txt',
    '/app/alpha/%2f..%2f..%2foutside.txt', '/app/alpha/%5c..%5coutside.txt', '/app/alpha/file%00.txt',
  ]) {
    const response = await request(app, path, { headers: { accept: 'text/html' } });
    assert.equal(response.status, 404, `${path}: ${response.text}`);
    assert.doesNotMatch(response.text, /PRIVATE_FIXTURE_TOKEN|PRIVATE_OUTSIDE_CONTENT|"basePath"/);
  }
  assert.equal((await request(app, '/app/alpha/%E0%A4%A')).status, 400);
});

test('static handler rejects a symlink that leaves its build directory', async (t) => {
  const fixtureApp = await fixture(t);
  const outside = join(fixtureApp.root, 'outside-directory');
  await mkdir(outside);
  await writeFile(join(outside, 'secret.txt'), 'PRIVATE_SYMLINK_CONTENT');
  await symlink(outside, join(fixtureApp.output('alpha'), 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const app = await fixtureApp.start();
  const response = await request(app, '/app/alpha/escape/secret.txt');
  assert.equal(response.status, 404, response.text);
  assert.doesNotMatch(response.text, /PRIVATE_SYMLINK_CONTENT/);
});

test('enabled changes apply immediately, survive a new server, and preserve dynamic settings', async (t) => {
  const fixtureApp = await fixture(t);
  const dynamicFile = join(fixtureApp.root, '.workspace-state', 'dashboard', 'config.json');
  const dynamicStore = createConfigStore({ file: dynamicFile, projects: fixtureApp.workspace.projects });
  await dynamicStore.update('alpha', { enabled: false, useOverrides: true, port: 5399 });
  const dynamicBefore = await readFile(dynamicFile, 'utf8');
  let app = await fixtureApp.start();
  assert.equal((await mutation(app, '/api/projects/alpha/config', { enabled: false }, 'PUT')).status, 200);
  assert.equal((await request(app, '/app/alpha/')).status, 503);
  assert.equal((await request(app, '/app/beta/')).status, 200);
  const saved = JSON.parse(await readFile(fixtureApp.workspace.stateFile, 'utf8'));
  assert.equal(saved.apps.alpha.enabled, false);
  await app.close();
  app = await fixtureApp.start();
  const state = (await request(app, '/api/state')).json;
  assert.equal(state.projects.find(({ id }) => id === 'alpha').status, 'stopped');
  assert.equal(state.projects.find(({ id }) => id === 'beta').status, 'running');
  assert.equal((await mutation(app, '/api/projects/alpha/config', { enabled: true }, 'PUT')).status, 200);
  assert.equal((await request(app, '/app/alpha/')).status, 200);
  assert.equal(await readFile(dynamicFile, 'utf8'), dynamicBefore);
});

test('compiled lifecycle actions mount and unmount without changing enabled preferences', async (t) => {
  const fixtureApp = await fixture(t);
  const app = await fixtureApp.start();
  assert.equal((await mutation(app, '/api/projects/alpha/stop')).status, 200);
  assert.equal((await request(app, '/app/alpha/')).status, 503);
  assert.equal((await compiledStore(fixtureApp.workspace).load()).alpha.enabled, true);
  assert.equal((await mutation(app, '/api/projects/alpha/start')).status, 200);
  assert.equal((await request(app, '/app/alpha/')).status, 200);
  assert.equal((await mutation(app, '/api/projects/alpha/restart')).status, 200);
  assert.equal((await request(app, '/app/alpha/')).status, 200);
  assert.equal((await mutation(app, '/api/stop-all')).status, 200);
  assert.equal((await request(app, '/app/beta/')).status, 503);
  assert.equal((await mutation(app, '/api/start-enabled')).status, 200);
  assert.equal((await request(app, '/app/beta/')).status, 200);
  for (const patch of [{ enabled: 'yes' }, { enabled: true, port: 4500 }, { enabled: true, useOverrides: true }, {}]) {
    assert.equal((await mutation(app, '/api/projects/alpha/config', patch, 'PUT')).status, 400);
  }
});

test('missing and mismatched builds report actionable errors while leaving the dashboard available', async (t) => {
  const fixtureApp = await fixture(t);
  await rm(join(fixtureApp.output('alpha'), 'index.html'));
  await writeFile(join(fixtureApp.output('beta'), 'quirq-build.json'), JSON.stringify({ version: 1, id: 'beta', type: 'static', basePath: '/wrong-mount' }));
  const app = await fixtureApp.start();
  const state = await request(app, '/api/state');
  assert.equal(state.status, 200);
  for (const project of state.json.projects) {
    assert.equal(project.available, false);
    assert.equal(project.status, 'error');
    assert.match(project.error, /npm run build/);
    const start = await mutation(app, `/api/projects/${project.id}/start`);
    assert.equal(start.status, 409);
    assert.match(start.json.error, /npm run build/);
  }
  assert.equal((await request(app, '/')).status, 200);
});

test('build commands preserve arguments, receive mount environment, and skip disabled apps', async (t) => {
  const fixtureApp = await fixture(t, { built: false });
  for (const project of Object.values(fixtureApp.value.projects)) {
    await writeFile(join(fixtureApp.root, project.directory, 'build-fixture.mjs'), `
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const output = process.env.QUIRQ_DIST_DIR;
await mkdir(output, { recursive: true });
await writeFile(join(output, 'index.html'), '<h1>Fresh build</h1>');
await writeFile('build-capture.json', JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), env: { NODE_ENV: process.env.NODE_ENV, QUIRQ_BASE_PATH: process.env.QUIRQ_BASE_PATH, QUIRQ_DIST_DIR: output } }));
`);
  }
  await compiledStore(fixtureApp.workspace).update('beta', { enabled: false });
  const messages = [];
  await buildCompiledWorkspace(fixtureApp.workspace, { log: (message) => messages.push(message) });
  const alphaRoot = join(fixtureApp.root, fixtureApp.value.projects.alpha.directory);
  const captured = JSON.parse(await readFile(join(alphaRoot, 'build-capture.json'), 'utf8'));
  // Compare directory identity; process.cwd() may resolve a temporary-directory symlink.
  assert.equal(await realpath(captured.cwd), await realpath(alphaRoot));
  assert.deepEqual(captured.args, ['an argument with spaces', alphaRoot, fixtureApp.root, '5301', 'literal;$value']);
  assert.deepEqual(captured.env, { NODE_ENV: 'production', QUIRQ_BASE_PATH: '/app/alpha', QUIRQ_DIST_DIR: 'dist-euler' });
  const marker = JSON.parse(await readFile(join(fixtureApp.output('alpha'), 'quirq-build.json'), 'utf8'));
  assert.equal(marker.version, 1);
  assert.equal(marker.id, 'alpha');
  assert.equal(marker.type, 'static');
  assert.equal(marker.basePath, '/app/alpha');
  assert.ok(Number.isFinite(Date.parse(marker.builtAt)));
  await inspectBuild(fixtureApp.workspace, 'alpha');
  for (const id of ['beta']) {
    await assert.rejects(readFile(join(fixtureApp.root, fixtureApp.value.projects[id].directory, 'build-capture.json')), { code: 'ENOENT' });
  }
  assert.ok(messages.some((message) => /Skipping disabled app: beta/.test(message)));
  await assert.rejects(buildCompiledWorkspace({ ...fixtureApp.workspace, mode: 'dynamic' }), /compiled workspace/);
  await assert.rejects(buildCompiledWorkspace(fixtureApp.workspace, { app: 'missing' }), /Unknown app/);
  const stateBefore = await readFile(fixtureApp.workspace.stateFile, 'utf8');
  await rm(join(alphaRoot, 'build-capture.json'));
  await buildCompiledWorkspace(fixtureApp.workspace, { app: 'beta', log() {} });
  await inspectBuild(fixtureApp.workspace, 'beta');
  await assert.rejects(readFile(join(alphaRoot, 'build-capture.json')), { code: 'ENOENT' });
  assert.equal(await readFile(fixtureApp.workspace.stateFile, 'utf8'), stateBefore, 'An explicit app build preserves all app settings, including disabled state');
});

test('Next adapter dispatch preserves method, URL, query and body without forcing a slash redirect', async (t) => {
  const value = manifest();
  value.projects.alpha.compiled.type = 'next';
  delete value.projects.beta;
  const fixtureApp = await fixture(t, { value });
  let closed = 0;
  let prepared = 0;
  const manager = createCompiledManager({ workspace: fixtureApp.workspace, dashboardPort: 4500,
    createHandler: async (build, id) => {
      prepared++;
      assert.equal(build.project.compiled.type, 'next');
      assert.equal(id, 'alpha');
      return { async handle(req, res) {
        let body = '';
        for await (const chunk of req) body += chunk;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, url: req.url, body }));
      }, async close() { closed++; } };
    } });
  const app = await fixtureApp.start(manager);
  const page = await request(app, '/app/alpha?view=full');
  assert.equal(page.status, 200);
  assert.equal(page.headers.location, undefined);
  assert.equal(page.json.url, '/app/alpha?view=full');
  const api = await request(app, '/app/alpha/api/items?id=42', { method: 'POST', headers: { origin: app.url, 'content-type': 'application/json' }, body: '{"title":"Example"}' });
  assert.equal(api.status, 200);
  assert.deepEqual(api.json, { method: 'POST', url: '/app/alpha/api/items?id=42', body: '{"title":"Example"}' });
  assert.equal((await mutation(app, '/api/projects/alpha/stop')).status, 200);
  assert.equal(closed, 0);
  assert.equal((await request(app, '/app/alpha/')).status, 503);
  assert.equal((await mutation(app, '/api/projects/alpha/start')).status, 200);
  assert.equal((await mutation(app, '/api/projects/alpha/restart')).status, 200);
  assert.equal((await request(app, '/app/alpha/api/items')).status, 200);
  assert.equal(prepared, 1, 'Next runtime must stay warm between route activations');
  assert.equal(closed, 0);
  await app.close();
  assert.equal(closed, 1, 'Runtime closes once when Quirq exits');
});
