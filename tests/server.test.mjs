import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Agent, request as httpRequest } from 'node:http';
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

function request(app, path, { method = 'GET', headers = {}, body, agent, send } = {}) {
  const address = new URL(app.url);
  return new Promise((resolve, reject) => {
    let result;
    let uploadFinished = false;
    let requestClosed = false;
    const complete = () => {
      // An early 413 may arrive while Node is still flushing the upload. Ordinary
      // callers must wait for that work before their test closes the server.
      // Streaming callers explicitly finish and clean up their request themselves.
      if (result && (send || (uploadFinished && requestClosed))) resolve(result);
    };
    const req = httpRequest({
      hostname: address.hostname,
      port: address.port,
      path,
      method,
      headers,
      agent,
      timeout: 3000,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.once('error', reject);
      response.once('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch { /* Assertions describe non-JSON responses. */ }
        result = { status: response.statusCode, headers: response.headers, text, json };
        complete();
      });
    });
    req.on('error', reject);
    req.once('finish', () => { uploadFinished = true; complete(); });
    req.once('close', () => { requestClosed = true; complete(); });
    req.once('timeout', () => req.destroy(new Error(`Dashboard request timed out: ${method} ${path}`)));
    if (send) send(req);
    else req.end(body);
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

test('an oversized streaming upload receives JSON 413 before ending and leaves its connection usable', { timeout: 10000 }, async (t) => {
  const app = await dashboard(t);
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  t.after(() => agent.destroy());
  let connections = 0;
  app.server.on('connection', () => { connections += 1; });
  const accepted = once(app.server, 'request');
  let upload;
  const pendingResponse = request(app, '/api/projects/euler/config', {
    method: 'PUT', agent,
    headers: { origin: new URL(app.url).origin, 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
    send(req) {
      upload = req;
      // Deliberately keep the upload open after crossing the 64 KiB limit.
      req.write('x'.repeat(128 * 1024));
    },
  });
  const [incoming] = await accepted;
  const response = await pendingResponse;
  assertJsonError(response, 413);
  assert.equal(incoming.complete, false, 'The rejection must not wait for the upload to end');
  assert.equal(incoming.destroyed, false, 'Rejecting the body must not destroy the response socket');
  assert.deepEqual(app.manager.calls, []);
  const drained = once(incoming, 'end');
  const clientSocket = upload.socket;
  await Promise.all([
    drained,
    new Promise((resolve, reject) => upload.end('remaining upload', (error) => error ? reject(error) : resolve())),
  ]);
  const state = await request(app, '/api/state', { agent });
  assert.equal(state.status, 200);
  assert.deepEqual(state.json, app.manager.state());
  assert.equal(connections, 1, 'The server must drain the rejected body before accepting another request on the same connection');
  assert.deepEqual(app.manager.calls, []);
  // Await transport cleanup so no socket work escapes the lifetime of this test.
  const closed = once(clientSocket, 'close');
  agent.destroy();
  await closed;
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
