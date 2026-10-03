import { blobatar, traits as blobatarTraits } from './vendor/blobatar/index.js';
import { happy, idle, sleepy, smug, surprised, thinking, wink } from './vendor/blobatar/expression.js';

export const AVATAR_STORAGE_KEY = 'euler.avatar.v1';
const options = (values) => Object.freeze(values.map(([value, label]) => Object.freeze({ value, label })));

export const avatarShapes = options([
  ['auto', 'From seed'], ['round', 'Round'], ['organic', 'Organic'], ['boxy', 'Boxy'],
  ['capsule', 'Capsule'], ['nub', 'Nub'], ['cloud', 'Cloud'], ['droplet', 'Droplet'],
  ['hexagon', 'Hexagon'], ['sun', 'Sun'], ['triangle', 'Triangle'],
]);
export const avatarExpressions = options([
  ['idle', 'Calm'], ['happy', 'Happy'], ['wink', 'Wink'], ['surprised', 'Surprised'],
  ['sleepy', 'Sleepy'], ['smug', 'Smug'], ['thinking', 'Thinking'],
]);
export const avatarBackgrounds = options([
  ['squircle', 'Soft square'], ['circle', 'Circle'], ['square', 'Square'], ['transparent', 'None'],
]);
export const avatarTraits = Object.freeze([
  ['body.r', 'Body size'], ['body.ratio', 'Body height'], ['body.n', 'Body squareness'],
  ['eye.rx', 'Eye size'], ['eye.ratio', 'Eye height'], ['eye.n', 'Eye squareness'],
  ['eye.scale', 'Eye variation'], ['eye.gap', 'Eye spacing'], ['eye.lean', 'Eye tilt'],
  ['gaze.x', 'Look sideways'], ['gaze.y', 'Look up or down'],
].map(([key, label]) => Object.freeze({ key, label, min: 0, max: 0.999, step: 0.01 })));

export const defaultAvatarConfig = Object.freeze({
  name: 'Euler', hue: 210, tone: 0.45, background: 'squircle', shape: 'round', expression: 'idle', traits: Object.freeze({}),
});

// Midpoints of Blobatar 2's frozen shape bands, not a second shape renderer.
// See upstream packages/blobatar/src/styles/blob.ts at the pinned revision.
const shapePositions = Object.freeze({ round: 0.11, organic: 0.35, boxy: 0.54, capsule: 0.65, nub: 0.745, cloud: 0.825, droplet: 0.8875, hexagon: 0.9325, sun: 0.965, triangle: 0.99 });
const expressions = { idle, happy, wink, surprised, sleepy, smug, thinking };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const choice = (value, list, fallback) => list.some((option) => option.value === value) ? value : fallback;

export function normalizeAvatarConfig(value) {
  const source = object(value) ? value : {};
  const name = typeof source.name === 'string'
    ? Array.from(source.name.toWellFormed().normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()).slice(0, 80).join('') : '';
  const traits = {};
  if (object(source.traits)) {
    for (const { key } of avatarTraits) {
      if (Object.hasOwn(source.traits, key) && typeof source.traits[key] === 'number' && Number.isFinite(source.traits[key])) {
        traits[key] = number(source.traits[key], 0, 0, 0.999);
      }
    }
  }
  return {
    name: name || defaultAvatarConfig.name,
    hue: number(source.hue, defaultAvatarConfig.hue, 0, 359),
    // Blobatar treats 1 as a wrapped tone; cap just below it to retain the ink tone.
    tone: number(source.tone, defaultAvatarConfig.tone, 0, 0.999),
    background: choice(source.background, avatarBackgrounds, defaultAvatarConfig.background),
    shape: choice(source.shape, avatarShapes, defaultAvatarConfig.shape),
    expression: choice(source.expression, avatarExpressions, defaultAvatarConfig.expression),
    traits,
  };
}

export function resolveAvatarTraits(config) {
  const normalized = normalizeAvatarConfig(config);
  const sample = blobatarTraits(normalized.name, true, normalized.traits);
  return Object.fromEntries(avatarTraits.map(({ key }) => [key, sample(key)]));
}

export function avatarSvg(config) {
  const value = normalizeAvatarConfig(config);
  const traits = { ...value.traits };
  if (value.shape !== 'auto') traits.shape = shapePositions[value.shape];
  return blobatar(value.name, {
    hue: value.hue, tone: value.tone, background: value.background === 'transparent' ? false : value.background,
    traits, expression: expressions[value.expression], title: value.name,
  });
}

export function avatarUri(config) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(config))}`;
}

function browserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function loadAvatarConfig(storage) {
  try {
    const source = storage === undefined ? browserStorage() : storage;
    const text = source?.getItem(AVATAR_STORAGE_KEY);
    return normalizeAvatarConfig(text ? JSON.parse(text) : undefined);
  } catch { return normalizeAvatarConfig(); }
}

export function saveAvatarConfig(config, storage) {
  const normalized = normalizeAvatarConfig(config);
  try {
    const target = storage === undefined ? browserStorage() : storage;
    if (!target || typeof target.setItem !== 'function') throw new Error('Browser storage is unavailable.');
    target.setItem(AVATAR_STORAGE_KEY, JSON.stringify(normalized));
  } catch (cause) {
    throw new Error('Your browser could not save the avatar. Check storage permissions and try again.', { cause });
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('euler:avatar-change', { detail: normalized }));
  }
  return normalized;
}
