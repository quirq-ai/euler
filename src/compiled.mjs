import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createConfigStore } from './config.mjs';

const failure = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const prefix = (id) => `/app/${id}`;
const markerName = 'quirq-build.json';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const appPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

function paths(workspace, id) {
  const project = workspace.projects[id];
  const root = resolve(workspace.root, project.directory);
  return { project, root, output: resolve(root, project.compiled.output) };
}
function buildEnvironment(root, id, output) {
  return { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', QUIRQ_BASE_PATH: prefix(id), QUIRQ_DIST_DIR: output,
    ...(id === 'innernet' ? { INNERNET_PROJECT_ROOT: root, INNERNET_BASE_PATH: prefix(id), INNERNET_DIST_DIR: output } : {}),
    ...(id === 'instants' ? { INSTANTS_SESSION_DIR: join(root, 'session'), INSTANTS_BASE_PATH: prefix(id), INSTANTS_DIST_DIR: output } : {}) };
}
export function compiledStore(workspace) {
  return createConfigStore({ file: workspace.stateFile, projects: workspace.projects, reservedPorts: [] });
}
export async function inspectBuild(workspace, id) {
  const { project, root, output } = paths(workspace, id);
  try {
    const marker = JSON.parse(await readFile(join(output, markerName), 'utf8'));
    if (marker.version !== 1 || marker.id !== id || marker.basePath !== prefix(id) || marker.type !== project.compiled.type) throw new Error('The build mount path does not match this app.');
    if (!(await stat(join(output, project.compiled.type === 'next' ? 'BUILD_ID' : 'index.html'))).isFile()) throw new Error('Build output missing.');
    return { project, root, output };
  } catch (cause) { throw failure(`${id} needs a compiled build. Run npm run build. ${cause.code === 'ENOENT' ? '' : cause.message}`.trim()); }
}

export async function buildCompiledWorkspace(workspace, { log = console.log, app } = {}) {
  if (workspace.mode !== 'compiled') throw new Error('Euler builds require a compiled workspace.');
  if (app && !Object.hasOwn(workspace.projects, app)) throw new Error(`Unknown app: ${app}.`);
  const settings = await compiledStore(workspace).load();
  for (const id of app ? [app] : Object.keys(workspace.projects)) {
    if (!app && !settings[id].enabled) { log(`Skipping disabled app: ${id}`); continue; }
    const { project, root, output } = paths(workspace, id);
    const values = { node: process.execPath, port: String(project.port), workspaceRoot: workspace.root, projectRoot: root };
    const args = project.compiled.build.map((arg) => arg.replace(/\{(node|port|workspaceRoot|projectRoot)\}/g, (_, key) => values[key]));
    log(`Building ${id} at ${prefix(id)}/`);
    await unlink(join(output, markerName)).catch((cause) => { if (cause.code !== 'ENOENT') throw cause; });
    await new Promise((resolvePromise, reject) => {
      const child = spawn(args[0], args.slice(1), { cwd: root, env: buildEnvironment(root, id, project.compiled.output), stdio: 'inherit', windowsHide: true });
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 ? resolvePromise() : reject(new Error(`${id} build failed (${signal || code}).`)));
    });
    if (!(await stat(join(output, project.compiled.type === 'next' ? 'BUILD_ID' : 'index.html'))).isFile()) throw new Error(`${id} did not produce its configured output: ${output}`);
    await writeFile(join(output, markerName), JSON.stringify({ version: 1, id, type: project.compiled.type, basePath: prefix(id), builtAt: new Date().toISOString() }, null, 2) + '\n');
  }
  log(`${app || workspace.name} is built. Start Euler with npm start.`);
}

async function staticHandler({ output }, id) {
  const directory = await realpath(output);
  const inside = (file) => { const path = relative(directory, file); return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path); };
  return {
    async handle(request, response) {
      if (!['GET', 'HEAD'].includes(request.method)) throw failure('Method not allowed.', 405);
      const url = new URL(request.url, 'http://localhost');
      let path;
      try { path = decodeURIComponent(url.pathname.slice(prefix(id).length)); } catch { throw failure('Invalid path.', 400); }
      if (path.includes('\\') || path.includes('\0') || path.split('/').some((part) => part.startsWith('.')) || path.endsWith(`/${markerName}`)) throw failure('Not found.', 404);
      let file = resolve(directory, `.${path || '/'}`);
      if (!inside(file)) throw failure('Not found.', 404);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        file = await realpath(file);
        if (!inside(file) || !(await stat(file)).isFile()) throw failure('Not found.', 404);
      } catch (cause) {
        if (cause.statusCode) throw cause;
        if (!['ENOENT', 'ENOTDIR'].includes(cause.code)) throw cause;
        if (extname(path) || !(request.headers.accept || '').includes('text/html')) throw failure('Not found.', 404);
        file = await realpath(join(directory, 'index.html'));
        if (!inside(file)) throw failure('Not found.', 404);
      }
      response.setHeader('Content-Security-Policy', appPolicy);
      response.setHeader('Content-Type', mime[extname(file).toLowerCase()] || 'application/octet-stream');
      response.setHeader('Content-Length', (await stat(file)).size);
      if (request.method === 'HEAD') response.end();
      else await pipeline(createReadStream(file), response);
    },
    async close() {},
  };
}

async function nextHandler(build, id, port) {
  const { root, output } = build;
  const { config } = JSON.parse(await readFile(join(output, 'required-server-files.json'), 'utf8'));
  if (config.basePath !== prefix(id) || resolve(root, config.distDir) !== output) throw failure(`${id} was built for a different mount. Run npm run build.`);
  // Runtime data belongs to each app directory, regardless of Euler's working directory.
  if (id === 'innernet') Object.assign(process.env, { INNERNET_PROJECT_ROOT: root, INNERNET_BASE_PATH: prefix(id), INNERNET_DIST_DIR: build.project.compiled.output });
  if (id === 'instants') Object.assign(process.env, { INSTANTS_SESSION_DIR: join(root, 'session'), INSTANTS_BASE_PATH: prefix(id), INSTANTS_DIST_DIR: build.project.compiled.output });
  const require = createRequire(join(root, 'package.json'));
  const next = require('next');
  const app = next({ dev: false, dir: root, conf: config, hostname: '127.0.0.1', port });
  try { await app.prepare(); } catch (cause) { await app.close().catch(() => {}); throw cause; }
  const handler = app.getRequestHandler();
  return {
    async handle(request, response) {
      response.removeHeader('Content-Security-Policy');
      await handler(request, response);
    },
    close: () => app.close(),
  };
}

export function createCompiledManager({ workspace, dashboardPort, createHandler } = {}) {
  const store = compiledStore(workspace);
  const records = new Map(Object.keys(workspace.projects).map((id) => [id, { handler: null, prepared: null, status: 'stopped', error: null, lines: [] }]));
  let pending = Promise.resolve();
  let closing = false;
  function record(id) { if (!records.has(id)) throw failure(`Unknown app: ${id}`, 404); return records.get(id); }
  function queue(action) { const result = pending.catch(() => {}).then(action); pending = result; return result; }
  async function state() {
    const settings = await store.load();
    const projects = await Promise.all([...records].map(async ([id, item]) => {
      const project = workspace.projects[id];
      let available = true;
      try { await inspectBuild(workspace, id); } catch { available = false; }
      return { id, name: project.name || id, kind: project.kind, description: project.description, status: item.status,
        available, error: item.error || (!available ? 'Build this app with npm run build.' : null), pid: null, port: dashboardPort,
        url: `${prefix(id)}/`, hosting: 'compiled', needsRestart: false, modes: ['start'], config: { ...settings[id], mode: 'start', useOverrides: false } };
    }));
    return { projects, dashboard: { port: dashboardPort, name: workspace.name, mode: 'compiled' } };
  }
  async function startOne(id) {
    const item = record(id);
    if (closing) throw failure('Euler is shutting down.', 503);
    if (item.handler) return;
    item.status = 'starting'; item.error = null;
    try {
      const build = await inspectBuild(workspace, id);
      // Next caches its production server by directory. Closing then preparing it
      // again reuses an already closed after()/waitUntil context. Keep the runtime
      // warm while routes are disabled; dispose it once when Euler itself closes.
      item.prepared ||= await (createHandler ? createHandler(build, id, dashboardPort) : build.project.compiled.type === 'static' ? staticHandler(build, id) : nextHandler(build, id, dashboardPort));
      item.handler = item.prepared;
      item.status = 'running'; item.lines.push(`Mounted precompiled app at ${prefix(id)}/`);
    } catch (cause) { item.status = 'error'; item.error = cause.message; throw cause; }
    item.lines = item.lines.slice(-100);
  }
  async function stopOne(id) {
    const item = record(id);
    item.handler = null;
    item.status = 'stopped'; item.error = null;
  }
  return {
    state,
    logs(id) { return { lines: record(id).lines }; },
    async start(id) { await queue(() => startOne(id)); return state(); },
    async stop(id) { await queue(() => stopOne(id)); return state(); },
    async restart(id) { await queue(async () => { await stopOne(id); await startOne(id); }); return state(); },
    async updateConfig(id, patch) {
      record(id);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some((key) => key !== 'enabled') || typeof patch.enabled !== 'boolean') throw failure('Compiled app settings accept only enabled: true or false.', 400);
      await queue(async () => { await store.update(id, patch); if (patch.enabled) await startOne(id); else await stopOne(id); });
      return state();
    },
    async startEnabled() {
      await queue(async () => {
        const settings = await store.load();
        for (const id of records.keys()) if (settings[id].enabled) { try { await startOne(id); } catch { /* Keep the dashboard available to explain missing builds. */ } }
      });
      return state();
    },
    async stopAll() { await queue(async () => { for (const id of records.keys()) await stopOne(id); }); return state(); },
    async handle(request, response, path, prepareResponse) {
      const match = /^\/app\/([^/]+)(?:\/|$)/.exec(path);
      if (!match) return false;
      const id = match[1];
      const item = record(id);
      if (!item.handler) throw failure(item.error || `${id} is stopped. Start it from Euler Home.`, 503);
      if (path === prefix(id) && workspace.projects[id].compiled.type === 'static') {
        const query = new URL(request.url, 'http://localhost').search;
        response.writeHead(308, { Location: `${prefix(id)}/${query}` }); response.end();
      } else {
        // Presentation is supplied by the host application; the runtime only
        // controls routing and lifecycle for the mounted app.
        prepareResponse?.(request, response, { id, project: workspace.projects[id] });
        await item.handler.handle(request, response);
      }
      return true;
    },
    async close() {
      closing = true;
      await queue(async () => {
        const handlers = [...records.values()].map((item) => { const handler = item.prepared; item.handler = null; item.prepared = null; item.status = 'stopped'; return handler; });
        const results = await Promise.allSettled(handlers.map((handler) => handler?.close()));
        const failed = results.find((result) => result.status === 'rejected');
        if (failed) throw failed.reason;
      });
    },
  };
}
