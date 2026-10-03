import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import test from 'node:test';
import { createEulerServer } from '../src/server.mjs';

function managerStub() {
  const state = { projects: [{ id: 'euler', enabled: true, status: 'stopped', port: 8002 }] };
  const calls = [];
  const requireProject = (id) => {
    if (id !== 'euler') throw Object.assign(new Error(`Unknown app: ${id}`), { statusCode: 404 });
  };
  const record = (method) => async (...args) => {
    if (args.length) requireProject(args[0]);
    calls.push({ method, args });
    return state;
  };
  return {
    calls,
    state: () => state,
    logs: (id) => { requireProject(id); return { lines: [`${id}: a local log line`] }; },
    start: record('start'),
    stop: record('stop'),
    restart: record('restart'),
    updateConfig: record('updateConfig'),
    startEnabled: record('startEnabled'),
    stopAll: record('stopAll'),
    close: record('close'),
  };
}

async function dashboard(t, manager = managerStub()) {
  const app = await createEulerServer({ port: 0, manager });
  assert.deepEqual(manager.calls, [{ method: 'startEnabled', args: [] }]);
  manager.calls.length = 0;
  t.after(async () => {
    app.server.closeAllConnections();
    await app.close();
  });
  return { ...app, manager };
}

function request(app, path, { method = 'GET', headers = {}, body } = {}) {
  const address = new URL(app.url);
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: address.hostname,
      port: address.port,
      path,
      method,
      headers,
      timeout: 3000,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.once('error', reject);
      response.once('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch { /* Assertions describe non-JSON responses. */ }
        resolve({ status: response.statusCode, headers: response.headers, text, json });
      });
    });
    req.once('error', reject);
    req.once('timeout', () => req.destroy(new Error(`Dashboard request timed out: ${method} ${path}`)));
    req.end(body);
  });
}

function mutation(app, path, options = {}) {
  return request(app, path, {
    method: options.method || 'POST',
    body: options.body ?? '{}',
    headers: {
      origin: new URL(app.url).origin,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
}

function assertJsonError(response, status) {
  if (Array.isArray(status)) assert.ok(status.includes(response.status), `Expected ${status.join('/')} but got ${response.status}: ${response.text}`);
  else assert.equal(response.status, status, response.text);
  assert.match(response.headers['content-type'] || '', /application\/json/);
  assert.equal(typeof response.json?.error, 'string', response.text);
  assert.ok(response.json.error.length > 0);
}

test('dashboard binds only IPv4 loopback and serves manager state and project logs', async (t) => {
  const app = await dashboard(t);
  assert.equal(app.server.address().address, '127.0.0.1');
  assert.equal(new URL(app.url).hostname, '127.0.0.1');
  const state = await request(app, '/api/state');
  assert.equal(state.status, 200);
  assert.match(state.headers['content-type'] || '', /application\/json/);
  assert.deepEqual(state.json, app.manager.state());
  const logs = await request(app, '/api/projects/euler/logs');
  assert.equal(logs.status, 200);
  assert.deepEqual(logs.json, { lines: ['euler: a local log line'] });
  assert.deepEqual(app.manager.calls, []);
});

test('valid project controls dispatch only the registered operation and project id', async (t) => {
  const app = await dashboard(t);
  for (const action of ['start', 'stop', 'restart']) {
    const response = await mutation(app, `/api/projects/euler/${action}`);
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.json, app.manager.state());
  }
  assert.deepEqual(app.manager.calls, ['start', 'stop', 'restart'].map((method) => ({ method, args: ['euler'] })));
});

test('configuration and batch controls return manager results', async (t) => {
  const app = await dashboard(t);
  const config = { enabled: false, port: 8802 };
  const configured = await mutation(app, '/api/projects/euler/config', {
    method: 'PUT', body: JSON.stringify(config), headers: { 'content-type': 'application/json; charset=utf-8' },
  });
  assert.equal(configured.status, 200, configured.text);
  assert.deepEqual(configured.json, app.manager.state());
  for (const path of ['/api/start-enabled', '/api/stop-all']) {
    const response = await mutation(app, path);
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.json, app.manager.state());
  }
  assert.deepEqual(app.manager.calls, [
    { method: 'updateConfig', args: ['euler', config] },
    { method: 'startEnabled', args: [] },
    { method: 'stopAll', args: [] },
  ]);
});

test('foreign Host is rejected for reads and writes without manager mutations', async (t) => {
  const app = await dashboard(t);
  assertJsonError(await request(app, '/api/state', { headers: { host: 'foreign.example' } }), [403, 421]);
  assertJsonError(await mutation(app, '/api/projects/euler/start', { headers: { host: 'foreign.example' } }), [403, 421]);
  assert.deepEqual(app.manager.calls, []);
});

test('foreign and opaque Origins cannot mutate local projects', async (t) => {
  const app = await dashboard(t);
  for (const origin of ['https://foreign.example', 'null', 'http://127.0.0.1:1']) {
    assertJsonError(await mutation(app, '/api/projects/euler/start', { headers: { origin } }), 403);
  }
  assert.deepEqual(app.manager.calls, []);
});

test('cross-site Fetch Metadata cannot bypass mutation checks', async (t) => {
  const app = await dashboard(t);
  const response = await mutation(app, '/api/start-enabled', { headers: { 'sec-fetch-site': 'cross-site' } });
  assertJsonError(response, 403);
  assert.deepEqual(app.manager.calls, []);
});

test('mutations require application/json even for an empty object', async (t) => {
  const app = await dashboard(t);
  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'application/jsonp']) {
    assertJsonError(await mutation(app, '/api/projects/euler/start', { headers: { 'content-type': contentType } }), 415);
  }
  const missingType = await request(app, '/api/projects/euler/start', {
    method: 'POST', headers: { origin: new URL(app.url).origin }, body: '{}',
  });
  assertJsonError(missingType, 415);
  assert.deepEqual(app.manager.calls, []);
});

test('malformed JSON is rejected before a control operation', async (t) => {
  const app = await dashboard(t);
  assertJsonError(await mutation(app, '/api/projects/euler/start', { body: '{' }), 400);
  assert.deepEqual(app.manager.calls, []);
});

test('oversized mutation body returns 413 without dispatching', async (t) => {
  const app = await dashboard(t);
  const body = JSON.stringify({ padding: 'x'.repeat(1024 * 1024) });
  assertJsonError(await mutation(app, '/api/projects/euler/config', { method: 'PUT', body }), 413);
  assert.deepEqual(app.manager.calls, []);
});

test('chunked oversized bodies also return JSON 413 without dispatching', async (t) => {
  const app = await dashboard(t);
  const body = JSON.stringify({ padding: 'x'.repeat(1024 * 1024) });
  const response = await mutation(app, '/api/projects/euler/config', {
    method: 'PUT', body, headers: { 'transfer-encoding': 'chunked' },
  });
  assertJsonError(response, 413);
  assert.deepEqual(app.manager.calls, []);
});

test('unknown commands and unregistered project ids are not dispatched', async (t) => {
  const app = await dashboard(t);
  for (const path of [
    '/api/exec', '/api/projects/euler/run', '/api/projects/euler/close',
    '/api/projects/does-not-exist/start', '/api/projects/__proto__/start', '/api/projects/constructor/start',
  ]) {
    assertJsonError(await mutation(app, path, { body: '{"command":"arbitrary user command"}' }), 404);
  }
  assertJsonError(await request(app, '/api/projects/does-not-exist/logs'), 404);
  assert.deepEqual(app.manager.calls, []);
});

test('wrong HTTP methods never start or reconfigure a project', async (t) => {
  const app = await dashboard(t);
  assertJsonError(await request(app, '/api/projects/euler/start'), [404, 405]);
  assertJsonError(await mutation(app, '/api/projects/euler/config'), [404, 405]);
  assert.deepEqual(app.manager.calls, []);
});

test('manager failures become JSON errors and preserve explicit status codes', async (t) => {
  const manager = managerStub();
  manager.start = async () => { throw new Error('simulated operation failure'); };
  manager.updateConfig = async () => { throw Object.assign(new Error('invalid configuration'), { statusCode: 400 }); };
  const app = await dashboard(t, manager);
  assertJsonError(await mutation(app, '/api/projects/euler/start'), 500);
  assertJsonError(await mutation(app, '/api/projects/euler/config', { method: 'PUT' }), 400);
});
