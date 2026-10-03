import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const manifestName = 'euler.workspace.json';
export const defaultManifest = fileURLToPath(new URL('../euler.workspace.json', import.meta.url));
const launchModes = new Set(['dev', 'start', 'preview']);
const placeholders = new Set(['node', 'port', 'workspaceRoot', 'projectRoot']);
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const invalid = (message) => new Error(`Invalid workspace manifest: ${message}`);
const localPath = (value) => typeof value === 'string' && value.trim() && !isAbsolute(value) && !/^[a-z]:/i.test(value) && !value.startsWith('\\') && !value.replaceAll('\\', '/').split('/').some((part) => part === '..');

export function validateManifest(value) {
  if (!object(value) || value.version !== 1) throw invalid('version must be 1.');
  if (!object(value.projects)) throw invalid('projects must be an object.');
  if (value.profiles !== undefined) throw invalid('Euler uses its project registry directly; remove profiles.');
  if (value.name !== undefined && (typeof value.name !== 'string' || !value.name.trim())) throw invalid('name must be a nonempty string.');
  const projects = {};
  const ports = new Map();
  for (const [id, project] of Object.entries(value.projects)) {
    if (id === 'home') throw invalid('home is reserved for Euler\'s built-in control page.');
    if (!identifier.test(id) || ['constructor', 'prototype'].includes(id)) throw invalid(`unsupported project id: ${id}.`);
    if (!object(project)) throw invalid(`${id} must be an object.`);
    if (!Number.isInteger(project.port) || project.port < 1024 || project.port > 65535) throw invalid(`${id}.port must be an integer from 1024 to 65535.`);
    if (ports.has(project.port)) throw invalid(`${id} and ${ports.get(project.port)} use the same port ${project.port}.`);
    ports.set(project.port, id);
    if (!Array.isArray(project.scripts) || !project.scripts.includes('dev') || project.scripts.some((mode) => typeof mode !== 'string' || !identifier.test(mode))) throw invalid(`${id}.scripts must list supported scripts including dev.`);
    const directory = project.directory ?? id;
    if (typeof directory !== 'string' || !directory.trim() || isAbsolute(directory) || /^[a-z]:/i.test(directory) || directory.replaceAll('\\', '/').split('/').some((part) => part === '..') || directory.startsWith('\\')) throw invalid(`${id}.directory must be a relative path inside the workspace.`);
    const urlPath = project.urlPath ?? '/';
    if (typeof urlPath !== 'string' || !urlPath.startsWith('/') || urlPath.startsWith('//') || /[\\\r\n]/.test(urlPath)) throw invalid(`${id}.urlPath must be a local path beginning with /.`);
    for (const field of ['name', 'description', 'kind']) if (project[field] !== undefined && typeof project[field] !== 'string') throw invalid(`${id}.${field} must be a string.`);
    if (project.nxProject !== undefined && (typeof project.nxProject !== 'string' || !/^[@a-zA-Z0-9][a-zA-Z0-9@._/-]*$/.test(project.nxProject))) throw invalid(`${id}.nxProject is not a valid Nx project name.`);
    if (project.commands !== undefined) {
      if (!object(project.commands)) throw invalid(`${id}.commands must be an object of argument arrays.`);
      for (const [mode, args] of Object.entries(project.commands)) {
        if (!launchModes.has(mode) || !project.scripts.includes(mode)) throw invalid(`${id}.commands.${mode} is not a supported launch mode.`);
        if (!Array.isArray(args) || !args.length || !args[0] || args.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) throw invalid(`${id}.commands.${mode} must be a nonempty array of strings.`);
        for (const arg of args) for (const match of arg.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)) if (!placeholders.has(match[1])) throw invalid(`unknown placeholder ${match[0]} for ${id}.`);
      }
      for (const mode of project.scripts.filter((script) => launchModes.has(script))) if (!Object.hasOwn(project.commands, mode)) throw invalid(`${id}.commands.${mode} is missing.`);
    }
    {
      const compiled = project.compiled;
      if (!object(compiled) || !['next', 'static'].includes(compiled.type)) throw invalid(`${id}.compiled.type must be next or static.`);
      if (!localPath(compiled.output) || !compiled.output.replaceAll('\\', '/').split('/').some((part) => part && part !== '.')) throw invalid(`${id}.compiled.output must be a relative build directory.`);
      if (!Array.isArray(compiled.build) || !compiled.build.length || !compiled.build[0] || compiled.build.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) throw invalid(`${id}.compiled.build must be an argument array.`);
      for (const arg of compiled.build) for (const match of arg.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)) if (!placeholders.has(match[1])) throw invalid(`unknown placeholder ${match[0]} for ${id}.`);
    }
    projects[id] = { ...project, directory: directory.replaceAll('\\', '/'), urlPath, scripts: [...new Set(project.scripts)] };
  }
  return { version: 1, name: value.name || 'Euler', projects };
}

export async function loadWorkspace({ workspace, config, cwd = process.cwd() } = {}) {
  if (workspace && config) throw new Error('Choose only one of --workspace or --config.');
  const configFile = config ? resolve(cwd, config) : workspace ? join(resolve(cwd, workspace), manifestName) : defaultManifest;
  let manifest;
  try { manifest = validateManifest(JSON.parse(await readFile(configFile, 'utf8'))); }
  catch (cause) { throw new Error(`Cannot load ${configFile}: ${cause.message}`, { cause }); }
  const root = dirname(configFile);
  return { root, name: manifest.name, projects: manifest.projects, configFile,
    stateFile: join(root, '.workspace-state', 'euler', 'config.json'), mode: 'compiled' };
}
