import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  AVATAR_STORAGE_KEY, avatarBackgrounds, avatarExpressions, avatarShapes, avatarSvg, avatarTraits, avatarUri,
  defaultAvatarConfig, loadAvatarConfig, normalizeAvatarConfig, resolveAvatarTraits, saveAvatarConfig,
} from '../public/euler-avatar.js';
import { blobatar, traits as vendorTraits, VERSION } from '../public/vendor/blobatar/index.js';
import * as poses from '../public/vendor/blobatar/expression.js';

const memoryStorage = (initial) => {
  const values = new Map(initial === undefined ? [] : [[AVATAR_STORAGE_KEY, initial]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('vendored Blobatar is pinned and matches the verified unmodified package files', async () => {
  const directory = new URL('../public/vendor/blobatar/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('provenance.json', directory), 'utf8'));
  assert.equal(VERSION, '2.7.0');
  assert.equal(provenance.version, VERSION);
  assert.equal(provenance.license, 'MIT');
  assert.equal(provenance.commit, 'ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b');
  assert.equal(provenance.integrity, 'sha512-tL1p2J3dXE/Z9U/ITwHqU7HBHmTH+Am+hif1J1hWAhvFT1VYC2HG+eXtN7081yuY+L2lrp9bs/VaF7dVH3S2jw==');
  for (const [name, metadata] of Object.entries(provenance.files)) {
    const content = await readFile(new URL(name, directory));
    assert.equal(createHash('sha256').update(content).digest('hex'), metadata.sha256, name);
  }
  const license = await readFile(new URL('LICENSE', directory), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Alain/);
});

test('missing or invalid preferences become fresh complete defaults without mutating shared defaults', () => {
  for (const input of [undefined, null, true, 9, 'Euler', [], { name: ' \n ', traits: [] }]) {
    assert.deepEqual(normalizeAvatarConfig(input), defaultAvatarConfig);
  }
  const value = normalizeAvatarConfig();
  value.name = 'Changed'; value.traits['eye.gap'] = 0.5;
  assert.equal(defaultAvatarConfig.name, 'Euler');
  assert.deepEqual(defaultAvatarConfig.traits, {});
});

test('configuration bounds numeric controls and accepts only known enum and trait fields', () => {
  const input = {
    name: ' Example ', hue: -400, tone: 1, shape: 'cloud', background: 'circle', expression: 'wink',
    palette: { head: 'url(https://foreign.example)' }, svg: '<svg onload=alert(1)>',
    traits: { 'eye.gap': 2, 'body.r': -2, 'gaze.x': NaN, 'body.ratio': '0.5', shape: 0.999, 'unknown.key': 0.1 },
  };
  assert.deepEqual(normalizeAvatarConfig(input), {
    name: 'Example', hue: 0, tone: 0.999, shape: 'cloud', background: 'circle', expression: 'wink',
    traits: { 'body.r': 0, 'eye.gap': 0.999 },
  });
  const malformed = normalizeAvatarConfig({ hue: '10', tone: Infinity, shape: '__proto__', expression: 'constructor', background: false });
  assert.deepEqual(malformed, defaultAvatarConfig);
  assert.equal(normalizeAvatarConfig({ hue: 900 }).hue, 359);
  assert.deepEqual(input.traits, { 'eye.gap': 2, 'body.r': -2, 'gaze.x': NaN, 'body.ratio': '0.5', shape: 0.999, 'unknown.key': 0.1 });
  for (const { key } of avatarTraits) {
    assert.equal(normalizeAvatarConfig({ traits: { [key]: 9 } }).traits[key], 0.999, key);
    assert.equal(normalizeAvatarConfig({ traits: { [key]: -9 } }).traits[key], 0, key);
    assert.equal(normalizeAvatarConfig({ traits: { [key]: NaN } }).traits[key], undefined, key);
  }
});

test('Unicode names normalize safely, preserve whole characters, and tolerate lone surrogates', () => {
  assert.equal(normalizeAvatarConfig({ name: ' cafe\u0301 ' }).name, 'café');
  assert.equal(normalizeAvatarConfig({ name: '\0Eul\ner\u007f' }).name, 'Euler');
  assert.equal(Array.from(normalizeAvatarConfig({ name: '🦊'.repeat(100) }).name).length, 80);
  for (const name of ['\ud800', 'Euler\udfff', '\ud800x\udc00']) {
    const config = normalizeAvatarConfig(JSON.parse(JSON.stringify({ name })));
    assert.equal(config.name.isWellFormed(), true);
    assert.doesNotThrow(() => avatarUri(config));
  }
  assert.equal(avatarSvg({ name: 'cafe\u0301' }), avatarSvg({ name: 'café' }));
});

test('every shape and pose delegates directly to the official generator with matching options', () => {
  const positions = { round: 0.11, organic: 0.35, boxy: 0.54, capsule: 0.65, nub: 0.745, cloud: 0.825, droplet: 0.8875, hexagon: 0.9325, sun: 0.965, triangle: 0.99 };
  for (const { value: shape } of avatarShapes) {
    for (const { value: expression } of avatarExpressions) {
      const traits = { 'eye.gap': 0.7, ...(shape === 'auto' ? {} : { shape: positions[shape] }) };
      const expected = blobatar('Euler', { hue: 210, tone: 0.45, background: 'squircle', traits, expression: poses[expression], title: 'Euler' });
      assert.equal(avatarSvg({ shape, expression, traits: { 'eye.gap': 0.7 } }), expected, `${shape}/${expression}`);
    }
  }
  assert.notEqual(avatarSvg({ expression: 'wink' }), avatarSvg({ expression: 'idle' }));
  assert.notEqual(avatarSvg({ name: 'Euler' }), avatarSvg({ name: 'Another seed' }));
});

test('all background choices render through Blobatar and transparent truly omits the background', () => {
  const outputs = avatarBackgrounds.map(({ value: background }) => avatarSvg({ background }));
  assert.equal(new Set(outputs).size, avatarBackgrounds.length);
  const transparent = avatarSvg({ background: 'transparent' });
  assert.equal(transparent, blobatar('Euler', { hue: 210, tone: 0.45, background: false, traits: { shape: 0.11 }, expression: poses.idle, title: 'Euler' }));
});

test('trait controls resolve the actual seeded values and preserve only explicit overrides', () => {
  const sample = vendorTraits('Euler', true, { 'eye.gap': 0.8 });
  const actual = resolveAvatarTraits({ traits: { 'eye.gap': 0.8 } });
  assert.deepEqual(Object.keys(actual), avatarTraits.map(({ key }) => key));
  for (const { key } of avatarTraits) assert.equal(actual[key], sample(key), key);
  assert.equal(actual['eye.gap'], 0.8);
  assert.deepEqual(normalizeAvatarConfig({ traits: { 'eye.gap': 0.8 } }).traits, { 'eye.gap': 0.8 });
});

test('SVG data URLs escape markup-like names and never introduce scripts or remote resources', () => {
  const name = '</title><script>alert("x")</script><image href="https://foreign.example"> & test';
  const uri = avatarUri({ name, palette: { head: 'red" onload="alert(1)' }, traits: { shape: '<script>' } });
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
  const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
  assert.equal(svg, avatarSvg({ name }));
  assert.match(svg, /&lt;\/title&gt;&lt;script&gt;/);
  assert.doesNotMatch(svg, /<(?:script|image|foreignObject)\b|<[^>]*\b(?:onload|href)\s*=/i);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('preferences survive storage round trips while malformed or unavailable storage falls back safely', () => {
  const storage = memoryStorage();
  const saved = saveAvatarConfig({ name: 'My Euler', hue: 315, shape: 'sun', traits: { 'eye.gap': 0.2 } }, storage);
  assert.deepEqual(loadAvatarConfig(storage), saved);
  assert.deepEqual(JSON.parse(storage.getItem(AVATAR_STORAGE_KEY)), saved);
  assert.deepEqual(loadAvatarConfig(memoryStorage('{broken')), defaultAvatarConfig);
  assert.deepEqual(loadAvatarConfig(memoryStorage('null')), defaultAvatarConfig);
  assert.deepEqual(loadAvatarConfig({ getItem() { throw new Error('Denied'); } }), defaultAvatarConfig);
});

test('saving emits the shared event only after successful persistence and reports failed writes', (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browser = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'window', original); else delete globalThis.window; });
  const storage = memoryStorage();
  const events = [];
  browser.addEventListener('euler:avatar-change', (event) => {
    assert.deepEqual(loadAvatarConfig(storage), event.detail, 'Storage is updated before consumers rerender');
    events.push(event.detail);
  });
  const saved = saveAvatarConfig({ name: 'Saved face', expression: 'happy' }, storage);
  assert.deepEqual(events, [saved]);
  assert.throws(() => saveAvatarConfig({ name: 'Unsaved face' }, { setItem() { throw new Error('Quota'); } }), /could not save the avatar/);
  assert.throws(() => saveAvatarConfig({}, null), /could not save the avatar/);
  assert.equal(events.length, 1);
  assert.deepEqual(loadAvatarConfig(storage), saved);
});
