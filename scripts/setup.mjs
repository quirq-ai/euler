import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, posix, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const knownApps = ['innernet', 'quitter', 'instants'];
export function setupApps(args) {
  if (args.some((id) => !knownApps.includes(id))) throw new Error(`Unknown app. Choose: ${knownApps.join(', ')}.`);
  return args.length ? [...new Set(args)] : [...knownApps];
}

export function npmCliCandidates({ platform = process.platform, execPath = process.execPath, env = process.env, realpath = realpathSync } = {}) {
  const path = platform === 'win32' ? win32 : posix;
  const candidates = [];
  const canonical = (value) => { try { return realpath(value); } catch { return value; } };
  const addCli = (value) => { if (value && /(?:^|[\\/])npm-cli\.js$/i.test(value)) candidates.push(value); };
  const addDirectory = (directory) => {
    for (const relative of ['node_modules/npm/bin/npm-cli.js', '../lib/node_modules/npm/bin/npm-cli.js', '../libexec/lib/node_modules/npm/bin/npm-cli.js']) candidates.push(path.resolve(directory, relative));
  };
  // Package managers other than npm also set npm_execpath.
  if (env.npm_execpath) { addCli(canonical(env.npm_execpath)); addCli(env.npm_execpath); }
  addDirectory(path.dirname(canonical(execPath)));
  addDirectory(path.dirname(execPath));
  const pathKey = Object.keys(env).find((key) => platform === 'win32' ? key.toUpperCase() === 'PATH' : key === 'PATH');
  for (const directory of (env[pathKey] || '').split(path.delimiter).filter(Boolean)) {
    for (const name of platform === 'win32' ? ['npm', 'npm.cmd'] : ['npm']) addCli(canonical(path.join(directory, name)));
    addDirectory(directory);
  }
  return [...new Set(candidates)];
}

export async function setup(args = process.argv.slice(2)) {
  const selected = setupApps(args);
  // Run npm through Node instead of a shell so spaces and Windows .cmd launchers
  // do not change argument handling. npm itself supplies npm_execpath.
  const npmCli = npmCliCandidates().find((file) => existsSync(file));
  if (!npmCli) throw new Error('Cannot find npm. Run this setup with npm run setup.');

  for (const id of selected.length ? selected : knownApps) {
    const directory = join(root, 'app', id);
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    console.log(`Installing ${pkg.name}…`);
    const pnpmCli = join(root, 'node_modules/pnpm/bin/pnpm.cjs');
    const args = existsSync(join(directory, 'pnpm-lock.yaml'))
      ? [pnpmCli, 'install', '--frozen-lockfile']
      : [npmCli, 'ci', '--no-audit', '--no-fund'];
    if (!existsSync(args[0])) throw new Error('Run npm ci at the Euler repository root first.');
    await new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: directory, stdio: 'inherit', windowsHide: true,
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 ? resolvePromise()
        : reject(new Error(`${id} installation failed (${signal || code}).`)));
    });
  }
  console.log('Dependencies ready. Run npm run build, then npm start.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
