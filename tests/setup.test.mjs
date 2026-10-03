import assert from 'node:assert/strict';
import test from 'node:test';
import { npmCliCandidates, setupApps } from '../scripts/setup.mjs';

test('setup selects only bundled apps and avoids duplicate installation requests', () => {
  assert.deepEqual(setupApps([]), ['innernet', 'quitter', 'instants']);
  assert.deepEqual(setupApps(['quitter', 'innernet', 'quitter']), ['quitter', 'innernet']);
  assert.throws(() => setupApps(['../innernet']), /Unknown app/);
});

test('setup finds npm beside Windows Node without invoking a command shell', () => {
  const candidates = npmCliCandidates({ platform: 'win32', execPath: 'C:\\Program Files\\nodejs\\node.exe', env: {}, realpath: (path) => path });
  assert.equal(candidates[0], 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js');
  assert.ok(candidates.every((path) => path.endsWith('npm-cli.js')));
});

test('setup follows Homebrew Node and npm symlinks with separate installation prefixes', () => {
  const links = new Map([
    ['/opt/homebrew/bin/node', '/opt/homebrew/Cellar/node/24.21.0/bin/node'],
    ['/opt/homebrew/bin/npm', '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js'],
  ]);
  const candidates = npmCliCandidates({ platform: 'darwin', execPath: '/opt/homebrew/bin/node', env: { PATH: '/opt/homebrew/bin:/usr/bin' }, realpath: (path) => links.get(path) || path });
  assert.ok(candidates.includes('/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js'));
  assert.ok(candidates.includes('/opt/homebrew/Cellar/node/24.21.0/libexec/lib/node_modules/npm/bin/npm-cli.js'));
});

test('setup supports Linux version-manager layouts and ignores other package managers', () => {
  const candidates = npmCliCandidates({ platform: 'linux', execPath: '/home/test/.nvm/versions/node/v24/bin/node', env: { npm_execpath: '/tools/pnpm.cjs', PATH: '' }, realpath: (path) => path });
  assert.equal(candidates.includes('/tools/pnpm.cjs'), false);
  assert.ok(candidates.includes('/home/test/.nvm/versions/node/v24/lib/node_modules/npm/bin/npm-cli.js'));
  const explicit = npmCliCandidates({ platform: 'linux', execPath: '/usr/bin/node', env: { npm_execpath: '/custom/npm/bin/npm-cli.js' }, realpath: (path) => path });
  assert.equal(explicit[0], '/custom/npm/bin/npm-cli.js');
});
