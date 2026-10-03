import {
  AVATAR_STORAGE_KEY, defaultAvatarConfig, normalizeAvatarConfig, avatarUri,
  loadAvatarConfig, saveAvatarConfig, resolveAvatarTraits,
  avatarShapes, avatarExpressions, avatarBackgrounds, avatarTraits,
} from './euler-avatar.js';

const byId = (id) => document.getElementById(id);
const equal = (left, right) => JSON.stringify(normalizeAvatarConfig(left)) === JSON.stringify(normalizeAvatarConfig(right));
const create = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const presets = [
  { name: 'Sky', hue: 205, className: 'sky' }, { name: 'Mint', hue: 145, className: 'mint' },
  { name: 'Lilac', hue: 265, className: 'lilac' }, { name: 'Peach', hue: 25, className: 'peach' },
  { name: 'Rose', hue: 340, className: 'rose' }, { name: 'Gold', hue: 48, className: 'gold' },
];
const seedNames = ['Nova', 'Milo', 'Clover', 'Orbit', 'Sora'];
let saved = loadAvatarConfig();
let draft = normalizeAvatarConfig(saved);
let dirty = false;
let renderPending = false;
const shapeButtons = new Map();
const expressionButtons = new Map();
const traitInputs = new Map();
const seedButtons = [];
const colorButtons = [];

function paintSaved() {
  const uri = avatarUri(saved);
  byId('euler-logo').src = uri;
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.href = uri;
}

function status(message, state = '') {
  byId('avatar-status').textContent = message;
  byId('avatar-status').className = state;
}

function makeOption(option, field, parent) {
  const button = create('button', 'avatar-option');
  button.type = 'button';
  button.dataset[field === 'shape' ? 'avatarShape' : 'avatarExpression'] = option.value;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', option.label);
  const image = create('img');
  image.alt = ''; image.width = 36; image.height = 36;
  button.append(image, create('span', '', option.label));
  button.addEventListener('click', () => change({ [field]: option.value }));
  parent.append(button);
  return { button, image };
}

function render() {
  renderPending = false;
  const normalized = normalizeAvatarConfig(draft);
  byId('avatar-preview').src = avatarUri(normalized);
  const traits = resolveAvatarTraits(normalized);
  for (const [value, option] of shapeButtons) {
    option.image.src = avatarUri({ ...normalized, shape: value, background: 'transparent' });
    option.button.setAttribute('aria-pressed', String(normalized.shape === value));
  }
  for (const [value, option] of expressionButtons) {
    option.image.src = avatarUri({ ...normalized, expression: value, background: 'transparent' });
    option.button.setAttribute('aria-pressed', String(normalized.expression === value));
  }
  seedButtons.forEach(({ name, image }) => { image.src = avatarUri({ ...normalized, name, background: 'transparent' }); });
  colorButtons.forEach(({ hue, button }) => { button.setAttribute('aria-pressed', String(Math.abs(normalized.hue - hue) < 2)); });
  if (document.activeElement !== byId('avatar-seed')) byId('avatar-seed').value = normalized.name;
  byId('avatar-hue').value = String(normalized.hue);
  byId('avatar-hue-value').textContent = `${Math.round(normalized.hue)}°`;
  byId('avatar-tone').value = String(normalized.tone);
  byId('avatar-tone-value').textContent = `${Math.round(normalized.tone * 100)}%`;
  byId('avatar-background').value = normalized.background;
  for (const [key, { input, output, reset }] of traitInputs) {
    const pinned = Object.hasOwn(normalized.traits, key);
    input.value = String(traits[key]);
    output.textContent = Number(traits[key]).toFixed(3);
    reset.disabled = !pinned;
    reset.textContent = pinned ? 'Reset' : 'From seed';
  }
  byId('avatar-unpin').disabled = Object.keys(normalized.traits).length === 0;
  dirty = !equal(normalized, saved);
  byId('avatar-save').disabled = !dirty;
  byId('avatar-cancel').disabled = !dirty;
}

function scheduleRender() {
  if (!renderPending) { renderPending = true; requestAnimationFrame(render); }
}

function change(patch) {
  draft = normalizeAvatarConfig({ ...draft, ...patch });
  dirty = !equal(draft, saved);
  status(dirty ? 'Previewing changes · not saved yet' : 'Your Euler avatar', dirty ? 'unsaved' : '');
  scheduleRender();
}

function selectTab(selected, focus = false) {
  for (const tab of document.querySelectorAll('[data-avatar-tab]')) {
    const active = tab.dataset.avatarTab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    byId(`avatar-panel-${tab.dataset.avatarTab}`).hidden = !active;
    if (active && focus) tab.focus();
  }
  document.querySelector('.avatar-panels').scrollTop = 0;
}

for (const option of avatarShapes) shapeButtons.set(option.value, makeOption(option, 'shape', byId('avatar-shapes')));
for (const option of avatarExpressions) expressionButtons.set(option.value, makeOption(option, 'expression', byId('avatar-expressions')));
for (const { value, label } of avatarBackgrounds) {
  const option = create('option', '', label); option.value = value; byId('avatar-background').append(option);
}
for (const { name, hue, className } of presets) {
  const button = create('button', `avatar-color ${className}`, name);
  button.type = 'button'; button.setAttribute('aria-label', `${name} color`); button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => change({ hue }));
  byId('avatar-colors').append(button); colorButtons.push({ hue, button });
}
for (const name of seedNames) {
  const button = create('button', 'avatar-variant');
  button.type = 'button'; button.setAttribute('aria-label', `Try ${name}`); button.title = `Try ${name}`;
  const image = create('img'); image.alt = ''; image.width = 35; image.height = 35;
  button.append(image); button.addEventListener('click', () => { change({ name }); byId('avatar-seed').value = name; });
  byId('avatar-variants').append(button); seedButtons.push({ name, image });
}
for (const trait of avatarTraits) {
  const id = `avatar-trait-${trait.key.replaceAll('.', '-')}`;
  const row = create('div', 'avatar-slider-row');
  const heading = create('div', 'avatar-slider-label');
  const label = create('label', '', trait.label); label.htmlFor = id;
  const tools = create('span', 'avatar-trait-tools');
  const output = create('output'); output.htmlFor = id;
  const reset = create('button', 'avatar-trait-reset', 'From seed');
  reset.type = 'button'; reset.setAttribute('aria-label', `Reset ${trait.label.toLowerCase()} to name-derived value`);
  const input = create('input', 'avatar-range');
  Object.assign(input, { type: 'range', id, min: String(trait.min), max: String(trait.max), step: String(trait.step) });
  input.dataset.avatarTrait = trait.key;
  input.addEventListener('input', () => change({ traits: { ...draft.traits, [trait.key]: input.valueAsNumber } }));
  reset.addEventListener('click', () => { const traits = { ...draft.traits }; delete traits[trait.key]; change({ traits }); });
  tools.append(output, reset); heading.append(label, tools); row.append(heading, input);
  byId(trait.key.startsWith('body.') ? 'avatar-body-traits' : 'avatar-eye-traits').append(row);
  traitInputs.set(trait.key, { input, output, reset });
}
for (const tab of document.querySelectorAll('[data-avatar-tab]')) {
  tab.addEventListener('click', () => selectTab(tab.dataset.avatarTab));
  tab.addEventListener('keydown', (event) => {
    const tabs = [...document.querySelectorAll('[data-avatar-tab]')];
    let index = tabs.indexOf(tab);
    if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else return;
    event.preventDefault(); selectTab(tabs[index].dataset.avatarTab, true);
  });
}
byId('avatar-hue').max = '359';
byId('avatar-tone').max = '0.999';
byId('avatar-tone').step = '0.001';
byId('avatar-seed').addEventListener('input', (event) => change({ name: event.target.value }));
byId('avatar-seed').addEventListener('blur', () => { byId('avatar-seed').value = draft.name; });
byId('avatar-hue').addEventListener('input', (event) => change({ hue: event.target.valueAsNumber }));
byId('avatar-tone').addEventListener('input', (event) => change({ tone: event.target.valueAsNumber }));
byId('avatar-background').addEventListener('change', (event) => change({ background: event.target.value }));
byId('avatar-unpin').addEventListener('click', () => change({ traits: {} }));
byId('avatar-randomize').addEventListener('click', () => {
  const values = crypto.getRandomValues(new Uint32Array(5));
  const shapes = avatarShapes.filter(({ value }) => value !== 'auto');
  change({ name: `Euler ${values[0].toString(36).slice(0, 6)}`, hue: values[1] % 360, tone: (250 + values[2] % 451) / 1000,
    shape: shapes[values[3] % shapes.length].value, expression: avatarExpressions[values[4] % avatarExpressions.length].value, traits: {} });
});
byId('avatar-reset').addEventListener('click', () => {
  draft = normalizeAvatarConfig(defaultAvatarConfig); render();
  status(dirty ? 'Default look restored · save to apply' : 'You’re using the original Euler avatar', dirty ? 'unsaved' : '');
});
byId('avatar-cancel').addEventListener('click', () => {
  saved = loadAvatarConfig(); draft = normalizeAvatarConfig(saved); render(); paintSaved(); status('Changes discarded');
});
byId('avatar-save').addEventListener('click', () => {
  try {
    saved = saveAvatarConfig(draft); draft = normalizeAvatarConfig(saved); render(); paintSaved();
    status('Saved · your logo and Home icon are up to date', 'saved');
  } catch (cause) { status(cause.message || 'Could not save. Your preview is still here; please try again.', 'error'); }
});

function syncSaved() {
  const preserveDraft = !equal(draft, saved);
  const current = loadAvatarConfig();
  const changed = !equal(current, saved);
  saved = current; paintSaved();
  if (!preserveDraft) { draft = normalizeAvatarConfig(saved); render(); }
  if (changed) {
    if (preserveDraft) { render(); status('Saved avatar changed in another tab. Your preview is still here.', 'unsaved'); }
    else status('Your saved avatar is up to date', 'saved');
  }
}
window.addEventListener('euler:avatar-change', syncSaved);
window.addEventListener('storage', (event) => { if (event.key === AVATAR_STORAGE_KEY || event.key === null) syncSaved(); });
window.addEventListener('pageshow', syncSaved);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSaved(); });
paintSaved();
render();
