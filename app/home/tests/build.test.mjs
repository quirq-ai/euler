import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { buildHome } from '../build.mjs';

async function fixture(t, content, name = 'home.mjs', type = 'text/javascript; charset=utf-8') {
  const directory = await mkdtemp(join(tmpdir(), 'euler home build '));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  const file = join(directory, name);
  if (content !== undefined) await writeFile(file, content);
  return { directory, assets: { '/home.js': [pathToFileURL(file), type] } };
}

test('Home build checks JavaScript without executing app code or resolving browser imports', async (t) => {
  const app = await fixture(t, '');
  const marker = join(app.directory, 'executed.txt');
  await writeFile(join(app.directory, 'home.mjs'), [
    "import './browser-only-dependency.js';",
    "import { writeFileSync } from 'node:fs';",
    `writeFileSync(${JSON.stringify(marker)}, 'must not execute');`,
    'document.body.textContent = "Home";',
  ].join('\n'));
  await buildHome({ assets: app.assets, log() {} });
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
});

test('Home build rejects JavaScript syntax errors before the app is served', async (t) => {
  const app = await fixture(t, 'export const state = ;');
  await assert.rejects(buildHome({ assets: app.assets, log() {} }), /Home build failed for \/home\.js:.*SyntaxError/s);
});

test('Home build fails clearly when a required asset is missing', async (t) => {
  const app = await fixture(t, undefined);
  await assert.rejects(buildHome({ assets: app.assets, log() {} }), /Home build failed for \/home\.js:.*ENOENT/s);
});

test('Home build rejects an empty HTML entry point', async (t) => {
  const app = await fixture(t, ' \n\t', 'index.html', 'text/html; charset=utf-8');
  await assert.rejects(buildHome({ assets: app.assets, log() {} }), /The asset is empty/);
});
