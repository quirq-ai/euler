import assert from 'node:assert/strict';
import test from 'node:test';
import { createDockSubscription, dockClearance, dockSnapshot, parseDockConfig } from '../public/euler-dock-extension.js';

const origin = 'http://127.0.0.1:2713';
const metadata = (patch = {}) => JSON.stringify({ version: 1, appId: 'innernet', moduleUrl: '/app/innernet/dock.js', ...patch });
const parse = (raw) => parseDockConfig(raw, '/app/innernet/search', origin);

test('Home and pages without per-app dock metadata keep the default interface', () => {
  assert.equal(parseDockConfig(metadata(), '/', origin), null);
  assert.equal(parseDockConfig('invalid JSON', '/#appearance', origin), null);
  assert.equal(parse(undefined), null);
  assert.equal(parse(null), null);
});

test('dock metadata resolves module and stylesheet assets for the current app only', () => {
  const config = parse(metadata({ moduleUrl: '/app/innernet/UI%20components/%E6%B0%B4.mjs', stylesheetUrl: '/app/innernet/theme.css' }));
  assert.equal(config.moduleUrl, `${origin}/app/innernet/UI%20components/%E6%B0%B4.mjs`);
  assert.equal(config.stylesheetUrl, `${origin}/app/innernet/theme.css`);
  assert.equal(config.appId, 'innernet');
  assert.ok(Object.isFrozen(config));
  assert.deepEqual(parse(metadata({ moduleUrl: undefined, stylesheetUrl: '/app/innernet/theme.css' })), {
    version: 1, appId: 'innernet', stylesheetUrl: `${origin}/app/innernet/theme.css`,
  });
});

test('dock metadata rejects mismatched apps, unsupported versions, and malformed configuration', () => {
  for (const raw of ['{', 'null', 'false', '[]', '{}', metadata({ appId: 'quitter' }), metadata({ version: 2 }), metadata({ moduleUrl: undefined }), metadata({ arbitrary: true }), ' '.repeat(8193)]) {
    assert.throws(() => parse(raw), undefined, raw.slice(0, 100));
  }
});

test('dock URLs cannot escape the app via origin changes, traversal, separators, or double encoding', () => {
  for (const path of [
    'https://example.com/app/innernet/dock.js', `${origin}/app/innernet/dock.js`, '//example.com/dock.js',
    '/api/state', '/app/quitter/dock.js', '/app/innernet-other/dock.js',
    '/app/innernet/../quitter/dock.js', '/app/innernet/%2e%2e/quitter/dock.js',
    '/app/innernet/x%2fy.js', '/app/innernet/x%5cy.js', '/app/innernet/x%252fy.js',
    '/app/innernet/./dock.js', '/app/innernet//dock.js', '/app/innernet/x\\dock.js',
    '/app/innernet/%00dock.js', '/app/innernet/%0adock.js', '/app/innernet/%C2%85dock.js', '/app/innernet/%zz.js',
    '/app/innernet/dock.js?query', '/app/innernet/dock.js#fragment', '/app/innernet/x%3adock.js',
    '/app/innernet/dock.css', '/app/innernet/dock.js/',
  ]) assert.throws(() => parse(metadata({ moduleUrl: path })), undefined, path);
  assert.throws(() => parse(metadata({ stylesheetUrl: '/app/innernet/theme.js' })));
});

test('dock snapshots are immutable copies and include the active app and route', () => {
  const input = { apps: [{ id: 'innernet', name: 'Innernet', url: '/app/innernet/search?q=one#result' }, { id: 'quitter', name: 'Quitter', url: '/app/quitter/' }], currentAppId: 'innernet', online: false, opacity: 63, avatarUrl: 'data:image/svg+xml,avatar' };
  const state = dockSnapshot(input);
  input.apps[0].name = 'Changed outside';
  assert.equal(state.apps[0].name, 'Innernet');
  assert.equal(state.apps[0].url, '/app/innernet/search?q=one#result');
  assert.equal(state.apps[0].active, true);
  assert.equal(state.apps[1].active, false);
  assert.equal(state.online, false);
  assert.equal(state.opacity, 63);
  assert.equal(state.avatarUrl, input.avatarUrl);
  assert.throws(() => { state.apps[0].name = 'Changed inside'; }, TypeError);
  assert.throws(() => { state.apps.push({}); }, TypeError);
  assert.throws(() => { state.online = true; }, TypeError);
});

test('dock subscriptions deliver an immediate snapshot, updates, and stop on unsubscribe or abort', () => {
  const controller = new AbortController();
  let state = 1;
  const observed = [];
  const hub = createDockSubscription(() => state, controller.signal, assert.fail);
  const unsubscribe = hub.subscribe((value) => observed.push(value));
  assert.deepEqual(observed, [1]);
  state = 2; hub.publish();
  assert.deepEqual(observed, [1, 2]);
  unsubscribe(); state = 3; hub.publish();
  assert.deepEqual(observed, [1, 2]);
  hub.subscribe((value) => observed.push(value));
  controller.abort(); state = 4; hub.publish();
  hub.subscribe((value) => observed.push(value));
  assert.deepEqual(observed, [1, 2, 3]);
});

test('a failing dock subscriber triggers view recovery without disrupting polling or notifying aborted listeners', () => {
  const controller = new AbortController();
  const failures = [];
  let state = 0;
  let laterCalls = 0;
  const hub = createDockSubscription(() => state, controller.signal, (error) => { failures.push(error.message); controller.abort(); });
  hub.subscribe(() => { if (state) throw new Error('custom view failed'); });
  hub.subscribe(() => { laterCalls++; });
  state = 1;
  assert.doesNotThrow(() => hub.publish());
  assert.deepEqual(failures, ['custom view failed']);
  assert.equal(laterCalls, 1);
  hub.publish();
  assert.equal(laterCalls, 1);
});

test('async dock subscriber rejection is handled by recovery instead of becoming unhandled', async () => {
  const controller = new AbortController();
  const failure = new Promise((resolve) => {
    const hub = createDockSubscription(() => 1, controller.signal, resolve);
    hub.subscribe(async () => { throw new Error('async view failed'); });
  });
  assert.equal((await failure).message, 'async view failed');
  controller.abort();
});

test('custom dock clearance is bounded and rejects values that cannot become valid CSS pixels', () => {
  assert.equal(dockClearance(-1), 0);
  assert.equal(dockClearance(0), 0);
  assert.equal(dockClearance(125.5), 125.5);
  assert.equal(dockClearance(900), 400);
  for (const value of ['100', null, false, NaN, Infinity, -Infinity, {}, 'url(https://example.com)']) assert.throws(() => dockClearance(value), TypeError);
});

test('a subscriber promise rejecting after disposal cannot replace the active fallback again', async () => {
  const controller = new AbortController();
  const failures = [];
  let reject;
  const pending = new Promise((resolve, rejectPromise) => { reject = rejectPromise; });
  const hub = createDockSubscription(() => 1, controller.signal, (error) => failures.push(error));
  hub.subscribe(() => pending);
  controller.abort();
  reject(new Error('late custom view failure'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(failures, []);
});
