import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const configFields = new Set(['enabled', 'useOverrides', 'port', 'mode']);
const modes = new Set(['dev', 'start', 'preview']);

export class ConfigError extends Error {
  constructor(message, { code = 'INVALID_CONFIG', statusCode = 400, cause } = {}) {
    super(message, { cause });
    this.name = 'ConfigError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
  if (!isObject(value)) throw new ConfigError(`${label} must be a JSON object.`);
}

function defaults(project) {
  return { enabled: true, useOverrides: false, port: project.port, mode: 'dev' };
}

export function effectiveConfig(project, config) {
  return {
    enabled: config.enabled,
    port: config.useOverrides ? config.port : project.port,
    mode: config.useOverrides ? config.mode : 'dev',
  };
}

function validatePatch(id, project, patch) {
  assertObject(patch, `Configuration for ${id}`);
  for (const key of Object.keys(patch)) {
    if (!configFields.has(key)) throw new ConfigError(`Unknown configuration field "${key}" for ${id}.`);
  }
  for (const key of ['enabled', 'useOverrides']) {
    if (Object.hasOwn(patch, key) && typeof patch[key] !== 'boolean') {
      throw new ConfigError(`${id}.${key} must be true or false.`);
    }
  }
  if (Object.hasOwn(patch, 'port') && (!Number.isInteger(patch.port) || patch.port < 1024 || patch.port > 65535)) {
    throw new ConfigError(`${id}.port must be an integer between 1024 and 65535.`);
  }
  if (Object.hasOwn(patch, 'mode') && (!modes.has(patch.mode) || !project.scripts.includes(patch.mode))) {
    const supported = project.scripts.filter((mode) => modes.has(mode));
    throw new ConfigError(`${id}.mode must be one of: ${supported.join(', ')}.`);
  }
  return { ...patch };
}

async function writeAtomically(file, data) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } finally {
    await handle?.close();
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

/** Persist dashboard settings only: no process actions, commands, or environment variables. */
export function createConfigStore({ file, projects, reservedPorts = [4400] }) {
  if (typeof file !== 'string' || !file.trim()) throw new TypeError('Config store requires a file path.');
  assertObject(projects, 'Project registry');
  const target = resolve(file);
  const registry = new Map(Object.entries(projects)
    .filter(([, project]) => Array.isArray(project?.scripts) && project.scripts.includes('dev'))
    .map(([id, project]) => [id, { port: project.port, scripts: [...project.scripts] }]));
  if (!Array.isArray(reservedPorts) || reservedPorts.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) {
    throw new TypeError('Reserved ports must be an array of valid integer ports.');
  }
  const reserved = new Set(reservedPorts);

  function validate(apps) {
    assertObject(apps, 'App configurations');
    for (const id of Object.keys(apps)) {
      if (!registry.has(id)) throw new ConfigError(`Unknown runnable project "${id}".`);
    }
    const settings = Object.fromEntries([...registry].map(([id, project]) => [
      id, { ...defaults(project), ...validatePatch(id, project, Object.hasOwn(apps, id) ? apps[id] : {}) },
    ]));
    const ports = new Map();
    for (const [id, project] of registry) {
      // Validate registry defaults as well as supplied values before using them.
      validatePatch(id, project, settings[id]);
      const { port } = effectiveConfig(project, settings[id]);
      if (reserved.has(port)) throw new ConfigError(`${id} uses reserved dashboard port ${port}; choose another port.`);
      if (ports.has(port)) throw new ConfigError(`${id} and ${ports.get(port)} both use port ${port}; choose different effective ports.`);
      ports.set(port, id);
    }
    return settings;
  }

  async function read() {
    let content;
    try { content = await readFile(target, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return validate({});
      throw new ConfigError(`Cannot read dashboard configuration at ${target}: ${error.message}`, { code: 'CONFIG_READ_FAILED', statusCode: 500, cause: error });
    }
    try {
      const saved = JSON.parse(content);
      assertObject(saved, 'Saved dashboard configuration');
      for (const key of Object.keys(saved)) {
        if (!['version', 'apps'].includes(key)) throw new ConfigError(`Unknown saved configuration field "${key}".`);
      }
      if (saved.version !== 1) throw new ConfigError('Saved dashboard configuration must use version 1.');
      return validate(saved.apps);
    } catch (error) {
      throw new ConfigError(`Invalid dashboard configuration at ${target}: ${error.message} Fix this file or move it aside to use defaults. The existing file has been preserved.`, { code: 'INVALID_SAVED_CONFIG', statusCode: 500, cause: error });
    }
  }

  // Serialize this server's updates and reload the file for each mutation, so a
  // later toggle retains unrelated settings edited in the file between requests.
  let pending = Promise.resolve();
  function queued(task) {
    const result = pending.then(task);
    pending = result.catch(() => {});
    return result;
  }

  async function persist(apps) {
    const settings = validate(apps);
    try { await writeAtomically(target, { version: 1, apps: settings }); }
    catch (error) {
      throw new ConfigError(`Cannot save dashboard configuration at ${target}: ${error.message}`, { code: 'CONFIG_WRITE_FAILED', statusCode: 500, cause: error });
    }
    return settings;
  }

  return {
    file: target,
    load: () => queued(read),
    save: (apps) => {
      // Snapshot input before queueing; later caller mutations must not change it.
      let settings;
      try { settings = validate(apps); } catch (error) { return Promise.reject(error); }
      return queued(() => persist(settings));
    },
    update: (id, patch) => {
      let changes;
      try {
        if (!registry.has(id)) throw new ConfigError(`Unknown runnable project "${id}".`);
        changes = validatePatch(id, registry.get(id), patch);
      } catch (error) { return Promise.reject(error); }
      return queued(async () => {
        const current = await read();
        return persist({ ...current, [id]: { ...current[id], ...changes } });
      });
    },
  };
}
