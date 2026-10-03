import { createServer } from 'node:http';
import { createCompiledManager } from './compiled.mjs';
import { homeApplication } from '../app/home/server.mjs';

const bodyLimit = 64 * 1024;
const error = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const contentPolicy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
function decodeId(value) {
  try { return decodeURIComponent(value); }
  catch { throw error('Invalid app identifier.', 400); }
}

async function jsonBody(request) {
  if ((request.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw error('Send configuration as application/json.', 415);
  if (Number(request.headers['content-length']) > bodyLimit) { request.resume(); throw error('Request body is too large.', 413); }
  let body = '';
  let oversized = false;
  // Rejecting a streaming body must leave the socket open long enough to send 413.
  // The default async iterator destroys the request when this loop exits early.
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    body += chunk;
    if (Buffer.byteLength(body) > bodyLimit) { oversized = true; break; }
  }
  if (oversized) { request.resume(); throw error('Request body is too large.', 413); }
  try { const parsed = JSON.parse(body || '{}'); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); return parsed; }
  catch { throw error('Send a valid JSON object.', 400); }
}

export async function createEulerServer({ port = 2713, manager, workspace } = {}) {
  if (!manager && !workspace) throw new Error('Provide an Euler workspace or app manager.');
  let controller = manager;
  let actualPort;
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', `${contentPolicy}; frame-src 'none'`);
    const send = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data)); };
    try {
      const hosts = [`localhost:${actualPort}`, `127.0.0.1:${actualPort}`];
      if (!hosts.includes(request.headers.host)) throw error('Euler is available only on localhost.', 421);
      const expectedOrigin = `http://${request.headers.host}`;
      if (request.headers.origin && request.headers.origin !== expectedOrigin) throw error('Cross-origin access is not allowed.', 403);
      if (request.headers['sec-fetch-site'] === 'cross-site') throw error('Cross-site access is not allowed.', 403);
      const path = new URL(request.url, expectedOrigin).pathname;
      if (await homeApplication.handle(request, response, path)) return;
      if (!controller) throw error('Euler is preparing the workspace.', 503);
      if (controller.handle && await controller.handle(request, response, path, homeApplication.prepareAppResponse)) return;
      if (path === '/api/state') {
        if (request.method !== 'GET') throw error('Method not allowed.', 405);
        send(200, await controller.state()); return;
      }
      const match = /^\/api\/projects\/([^/]+)\/(logs|start|stop|restart|config)$/.exec(path);
      if (!match && !['/api/start-enabled', '/api/stop-all'].includes(path)) throw error('Not found.', 404);
      const id = match ? decodeId(match[1]) : null;
      const action = match?.[2];
      if (action === 'logs') {
        if (request.method !== 'GET') throw error('Method not allowed.', 405);
        send(200, await controller.logs(id)); return;
      }
      if (request.method !== (action === 'config' ? 'PUT' : 'POST')) throw error('Method not allowed.', 405);
      if (request.headers.origin !== expectedOrigin) throw error('A same-origin Euler request is required.', 403);
      const body = await jsonBody(request);
      if (action === 'config') send(200, await controller.updateConfig(id, body));
      else if (match) send(200, await controller[action](id));
      else send(200, await controller[path === '/api/start-enabled' ? 'startEnabled' : 'stopAll']());
    } catch (cause) {
      if (!response.headersSent) send(cause.statusCode || 500, { error: cause.message || 'Euler could not complete this action.' });
      else response.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolvePromise);
  });
  actualPort = server.address().port;
  controller ||= createCompiledManager({ workspace, dashboardPort: actualPort });
  try { await controller.startEnabled(); }
  catch (cause) { await controller.close(); await new Promise((resolve) => server.close(resolve)); throw cause; }
  let closing;
  return {
    server, url: `http://127.0.0.1:${actualPort}`,
    close() {
      closing ||= (async () => {
        let issue;
        try { await controller.close(); } catch (cause) { issue = cause; }
        await new Promise((resolvePromise) => { server.close(resolvePromise); server.closeAllConnections(); });
        if (issue) throw issue;
      })();
      return closing;
    },
  };
}
