import { createEulerServer } from './server.mjs';
import { loadWorkspace } from './workspace.mjs';
import { buildCompiledWorkspace } from './compiled.mjs';

export function parseArgs(args) {
  const options = { port: 2713 };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help' || flag === '-h') return { help: true };
    if (!['--workspace', '--config', '--port', '--build', '--app'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or repeated option: ${flag}. Run euler --help.`);
    seen.add(flag);
    if (flag === '--build') { options.build = true; continue; }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
    options[flag.slice(2)] = flag === '--port' ? Number(value) : value;
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) throw new Error('Choose an Euler port between 1024 and 65535.');
  if (options.workspace && options.config) throw new Error('Choose only one of --workspace or --config.');
  if (options.app && !options.build) throw new Error('--app requires --build.');
  return options;
}

export async function main(args = process.argv.slice(2)) {
  try {
    const options = parseArgs(args);
    if (options.help) {
      console.log('Euler - your local app workspace\n\nUsage: node bin/euler.mjs [options]\n\n  --workspace PATH  Use euler.workspace.json in this folder\n  --config FILE     Use a specific Euler workspace manifest\n  --port NUMBER     Euler port (default 2713)\n  --build           Build enabled apps and exit\n  --app ID          Build only this app (requires --build; includes disabled apps)\n  --help            Show this help\n\nBy default, use euler.workspace.json in this repository, regardless of the\ncurrent folder. Run npm run build once, then npm start. Enabled apps are\nserved directly at /app/<name>/; manage them on Home at /.');
      return;
    }
    const workspace = await loadWorkspace(options);
    if (options.build) { await buildCompiledWorkspace(workspace, { app: options.app }); return; }
    process.env.NODE_ENV = 'production';
    const dashboard = await createEulerServer({ port: options.port, workspace });
    console.log(`\nEuler is ready at ${dashboard.url}\nWorkspace: ${workspace.name}\nManifest: ${workspace.configFile}\nUse Ctrl+C to close Euler and its apps.\n`);
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      try { await dashboard.close(); }
      catch (error) { console.error(error.message); process.exitCode = 1; }
      finally { process.off('SIGINT', shutdown); process.off('SIGTERM', shutdown); }
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return dashboard;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
