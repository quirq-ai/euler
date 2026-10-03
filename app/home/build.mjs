import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { homeAssets } from './assets.mjs';

const run = promisify(execFile);

// Home uses browser-native HTML, CSS, and ES modules. The host serves these
// checked-in assets directly, so building checks them without a duplicate dist.
export async function buildHome({ log = console.log, assets = homeAssets } = {}) {
  for (const [route, [location, type]] of Object.entries(assets)) {
    const file = location instanceof URL ? location : new URL(location);
    try {
      const content = await readFile(file, 'utf8');
      if (!content.trim()) throw new Error('The asset is empty.');
      if (type.startsWith('text/javascript')) {
        await run(process.execPath, ['--check', fileURLToPath(file)], {
          windowsHide: true, timeout: 10000,
        });
      }
    } catch (cause) {
      throw new Error(`Home build failed for ${route}: ${cause.stderr?.trim() || cause.message}`, { cause });
    }
  }
  log('Home assets validated. Euler serves them directly; no transpilation is required.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildHome().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
