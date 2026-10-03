const $ = (selector, context = document) => context.querySelector(selector);
const byId = (id) => document.getElementById(id);
const state = { projects: [], dashboard: {}, loaded: false };
const cards = new Map();
const pending = new Set();
const pendingEnabled = new Map();
const knownIcons = new Set(['innernet', 'quitter', 'instants']);
const statusLabels = { stopped: 'Stopped', starting: 'Starting', running: 'Running', stopping: 'Stopping', error: 'Needs attention' };
let filter = 'all';
let connected = false;
let mutationCount = 0;
let stateRevision = 0;
let polling = false;
let pollController;
let lastSharedState = 0;
let settingsId = null;
let logsId = null;
let logsPolling = false;
let logsRevision = 0;
let toastTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function setText(node, value) { if (node && node.textContent !== value) node.textContent = value; }
function nameOf(project) { return typeof project.name === 'string' && project.name.trim() ? project.name.trim() : project.id; }
function owned(project) { return ['running', 'starting', 'stopping'].includes(project.status); }
function busy(project) { return mutationCount > 0 || ['starting', 'stopping'].includes(project.status); }
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}
function button(text, iconName, className = 'button') {
  const node = element('button', className);
  node.type = 'button';
  if (iconName) node.append(icon(iconName));
  if (text) node.append(element('span', '', text));
  return node;
}
function updateTime() {
  const now = new Date();
  setText(byId('today'), new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now));
  setText(byId('header-clock'), new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now));
  byId('header-clock').dateTime = now.toISOString();
  const hour = now.getHours();
  setText(byId('welcome-title'), hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.');
}

async function api(path, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    let response;
    try {
      response = await fetch(path, {
        cache: 'no-store', credentials: 'same-origin', ...options, signal: controller.signal,
        headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      });
    } catch (cause) {
      const error = new Error(controller.signal.aborted ? 'Euler took too long to respond. Check its terminal and try again.' : 'Cannot reach Euler. Check that it is running and try again.');
      error.connectionLost = true;
      error.cause = cause;
      throw error;
    }
    let data;
    try { data = await response.json(); }
    catch { throw new Error('Euler returned an unreadable response. Please try again.'); }
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`);
    return data;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
function notify(message, error = false) {
  clearTimeout(toastTimer);
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 7000 : 3500);
}
function connection(ok, message = '') {
  connected = ok;
  const label = byId('sync-label');
  const text = ok ? 'Live updates' : 'Disconnected';
  if (label.dataset.connection !== text) {
    label.replaceChildren(element('span', 'sync-dot'), document.createTextNode(text));
    label.dataset.connection = text;
  }
  label.classList.toggle('offline', !ok);
  byId('connection-message').hidden = ok;
  setText(byId('connection-copy'), message);
  byId('retry').hidden = ok;
  render();
}
function applyState(data) {
  if (!Array.isArray(data?.projects)) throw new Error('Euler returned an invalid workspace.');
  state.projects = data.projects.filter((project) => project && typeof project.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(project.id));
  state.dashboard = { ...state.dashboard, ...data.dashboard };
  state.loaded = true;
  const name = typeof state.dashboard.name === 'string' && state.dashboard.name.trim() ? state.dashboard.name.trim() : 'Euler';
  setText(byId('workspace-name'), name);
  byId('workspace-name').title = name;
  setText(byId('dashboard-address'), `Euler · ${window.location.host}`);
  connection(true);
}
async function refresh() {
  if (polling || mutationCount || document.hidden) return;
  polling = true;
  const revision = stateRevision;
  const controller = new AbortController();
  pollController = controller;
  try {
    const data = await api('/api/state', { signal: controller.signal });
    if (revision === stateRevision && !mutationCount) applyState(data);
  } catch (error) {
    if (revision === stateRevision && !mutationCount) connection(false, error.message);
  } finally {
    if (pollController === controller) pollController = null;
    polling = false;
  }
}
async function mutate(path, method = 'POST', body = {}, key = 'all') {
  if (!connected) throw new Error('Reconnect to Euler before changing your apps.');
  if (mutationCount) throw new Error('An app action is still finishing. Try again in a moment.');
  const focusTarget = document.activeElement;
  let focusMoved = false;
  const trackFocus = (event) => { if (event.target !== focusTarget && event.target !== document.body) focusMoved = true; };
  document.addEventListener('focusin', trackFocus);
  pending.add(key);
  mutationCount += 1;
  stateRevision += 1;
  pollController?.abort();
  window.dispatchEvent(new CustomEvent('euler:refresh', { detail: { phase: 'start' } }));
  if (typeof body.enabled === 'boolean') pendingEnabled.set(key, body.enabled);
  render();
  let latest;
  try {
    latest = await api(path, { method, body: JSON.stringify(body) }, 30000);
    applyState(latest);
    return latest;
  } catch (error) {
    if (error.connectionLost) connection(false, error.message);
    throw error;
  } finally {
    mutationCount -= 1;
    stateRevision += 1;
    pending.delete(key);
    pendingEnabled.delete(key);
    render();
    document.removeEventListener('focusin', trackFocus);
    if (!focusMoved && document.activeElement === document.body && focusTarget?.isConnected && !focusTarget.disabled) {
      focusTarget.focus({ preventScroll: true });
    }
    window.dispatchEvent(new CustomEvent('euler:refresh', { detail: { phase: 'end', ...(latest ? { state: latest } : {}) } }));
    void refresh();
  }
}
function safeAppUrl(project) {
  try {
    const prefix = `/app/${encodeURIComponent(project.id)}/`;
    const url = new URL(project.url || prefix, window.location.href);
    return url.origin === window.location.origin && !url.username && !url.password && ['http:', 'https:'].includes(url.protocol)
      && (url.pathname === prefix.slice(0, -1) || url.pathname.startsWith(prefix)) ? url.href : null;
  } catch { return null; }
}

function createCard(project) {
  const card = element('article', 'app-card');
  card.dataset.appId = project.id;
  const top = element('div', 'app-card-top');
  const image = element('img', 'app-icon');
  image.src = `/euler-icons/${knownIcons.has(project.id) ? project.id : 'home'}.svg`;
  image.alt = '';
  image.width = 52;
  image.height = 52;
  image.draggable = false;
  const identity = element('div', 'app-identity');
  const title = element('h3', 'app-name');
  const description = element('p', 'app-description');
  identity.append(title, description);
  const enableLabel = element('label', 'app-enable');
  const enabled = element('input');
  enabled.type = 'checkbox';
  enabled.setAttribute('role', 'switch');
  enableLabel.append(enabled, element('span', 'app-switch-track'));
  top.append(image, identity, enableLabel);
  const statusRow = element('div', 'app-card-status');
  const status = element('span', 'app-status');
  const statusDot = element('span', 'status-dot');
  statusDot.setAttribute('aria-hidden', 'true');
  const statusText = element('span', 'status-text');
  const enabledText = element('span', 'enabled-label');
  status.append(statusDot, statusText);
  statusRow.append(status, enabledText);
  const detail = element('p', 'app-card-detail');
  const error = element('p', 'app-error');
  const actions = element('div', 'app-card-actions');
  const open = element('a', 'button primary-button open-button', 'Open');
  open.dataset.eulerApp = project.id;
  open.addEventListener('click', (event) => { if (open.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  const toggle = button('Start', 'play', 'button app-toggle');
  const restart = button('', 'restart', 'icon-button');
  const logs = button('', 'log', 'icon-button');
  const settings = button('', 'settings', 'icon-button');
  actions.append(open, toggle, restart, logs, settings);
  card.append(top, statusRow, detail, error, actions);
  enabled.addEventListener('change', () => void changeEnabled(project.id, enabled.checked));
  toggle.addEventListener('click', () => void act(project.id, toggle.dataset.action));
  restart.addEventListener('click', () => void act(project.id, 'restart'));
  logs.addEventListener('click', () => void openLogs(project.id));
  settings.addEventListener('click', () => openSettings(project.id));
  return { card, title, description, enabled, enableLabel, status, statusDot, statusText, enabledText, detail, error, open, toggle, restart, logs, settings };
}
function updateCard(parts, project) {
  const name = nameOf(project);
  const isEnabled = Boolean(project.config?.enabled);
  const applying = pending.has(project.id) || pending.has('all');
  setText(parts.title, name);
  setText(parts.description, project.description || ({ innernet: 'Search and explore your projects.', quitter: 'Your agents, threads, and activity.', instants: 'A space for conversations and moments.' }[project.id] || 'Part of your Euler workspace.'));
  parts.enabled.checked = pendingEnabled.has(project.id) ? pendingEnabled.get(project.id) : isEnabled;
  parts.enabled.disabled = !connected || busy(project) || (!project.available && !isEnabled);
  parts.enabled.setAttribute('aria-label', `Enable ${name} in Euler`);
  parts.enableLabel.title = !project.available && !isEnabled ? 'Build this app before enabling it' : `${isEnabled ? 'Disable' : 'Enable'} ${name} in Euler`;
  parts.card.setAttribute('aria-busy', String(applying));
  parts.status.dataset.status = project.status;
  parts.statusDot.classList.toggle('running', project.status === 'running');
  setText(parts.statusText, applying ? 'Applying…' : statusLabels[project.status] || 'Unknown');
  setText(parts.enabledText, isEnabled ? 'Enabled' : 'Disabled');
  setText(parts.detail, `/app/${project.id}/ · ${state.dashboard.port || window.location.port || 'Euler'}`);
  let error = typeof project.error === 'string' ? project.error : '';
  if (!project.available) error = `Run npm run build -- --app ${project.id}, then start this app.`;
  setText(parts.error, error);
  parts.error.hidden = !error;
  const url = safeAppUrl(project);
  const canOpen = Boolean(connected && !applying && url && project.status === 'running');
  if (canOpen) parts.open.href = url;
  else parts.open.removeAttribute('href');
  parts.open.setAttribute('aria-label', `Open ${name}`);
  parts.open.setAttribute('aria-disabled', String(!canOpen));
  parts.open.tabIndex = canOpen ? 0 : -1;
  parts.open.title = !connected ? 'Reconnect to Euler to open this app' : canOpen ? `Open ${name}` : 'Start this app to open it';
  const action = owned(project) ? 'stop' : 'start';
  if (parts.toggle.dataset.action !== action) {
    parts.toggle.dataset.action = action;
    parts.toggle.replaceChildren(icon(action === 'stop' ? 'stop' : 'play'), element('span', '', action === 'stop' ? 'Stop' : 'Start'));
  }
  parts.toggle.disabled = !connected || busy(project) || (action === 'start' && !project.available);
  parts.toggle.setAttribute('aria-label', `${action === 'stop' ? 'Stop' : 'Start'} ${name}`);
  parts.restart.disabled = !connected || !project.available || project.status !== 'running' || busy(project);
  parts.restart.setAttribute('aria-label', `Restart ${name}`);
  parts.restart.title = `Restart ${name}`;
  parts.logs.disabled = !connected;
  parts.logs.setAttribute('aria-label', `View ${name} logs`);
  parts.logs.title = 'View logs';
  parts.settings.disabled = !connected || mutationCount > 0;
  parts.settings.setAttribute('aria-label', `${name} settings`);
  parts.settings.title = 'App settings';
}
function render() {
  const projects = state.projects;
  const query = byId('search').value.trim().toLowerCase();
  const visible = projects.filter((project) => {
    const matches = `${project.id} ${nameOf(project)} ${project.description || ''}`.toLowerCase().includes(query);
    return matches && (filter === 'all' || filter === 'running' && project.status === 'running'
      || filter === 'enabled' && project.config?.enabled || filter === 'stopped' && ['stopped', 'error'].includes(project.status));
  });
  setText(byId('running-count'), String(projects.filter((project) => project.status === 'running').length));
  setText(byId('enabled-count'), String(projects.filter((project) => project.config?.enabled).length));
  setText(byId('total-count'), String(projects.length));
  setText(byId('list-count'), String(visible.length));
  byId('start-enabled').disabled = !connected || mutationCount > 0 || !projects.some((project) => project.config?.enabled && project.available && !owned(project));
  byId('stop-all').disabled = !connected || mutationCount > 0 || !projects.some((project) => owned(project));
  const list = byId('apps');
  list.querySelector('.loading-state')?.remove();
  const existing = new Set(projects.map((project) => project.id));
  for (const [id, parts] of cards) if (!existing.has(id)) { parts.card.remove(); cards.delete(id); }
  const shown = new Set(visible.map((project) => project.id));
  for (const [index, project] of projects.entries()) {
    let parts = cards.get(project.id);
    if (!parts) { parts = createCard(project); cards.set(project.id, parts); }
    if (list.children[index] !== parts.card) list.insertBefore(parts.card, list.children[index] || null);
    updateCard(parts, project);
    parts.card.hidden = !shown.has(project.id);
  }
  byId('empty-state').hidden = visible.length > 0;
  setText($('#empty-state h3'), !state.loaded ? 'Connecting to your workspace' : projects.length ? 'No apps found' : 'No applications yet');
  setText($('#empty-state p'), !state.loaded ? 'Your apps will appear when Euler is available.' : projects.length ? 'Try a different name or choose another filter.' : 'Apps appear here when they are added to your workspace.');
  byId('reset-filters').hidden = !projects.length;
  if (byId('loading-indicator')) byId('loading-indicator').hidden = state.loaded || !connected;
  byId('save-settings').disabled = !connected || mutationCount > 0;
  const settingsProject = projects.find((project) => project.id === settingsId);
  byId('setting-enabled').disabled = !connected || mutationCount > 0 || Boolean(settingsProject && !settingsProject.available && !settingsProject.config?.enabled);
}

async function act(id, action) {
  if (!['start', 'stop', 'restart'].includes(action)) return;
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  try {
    await mutate(`/api/projects/${encodeURIComponent(id)}/${action}`, 'POST', {}, id);
    notify(`${nameOf(project)} ${action === 'stop' ? 'stopped' : action === 'restart' ? 'restarted' : 'started'}.`);
  } catch (error) { notify(error.message, true); }
}
async function changeEnabled(id, enabled) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  try {
    await mutate(`/api/projects/${encodeURIComponent(id)}/config`, 'PUT', { enabled }, id);
    notify(`${nameOf(project)} ${enabled ? 'enabled' : 'disabled'} in Euler.`);
  } catch (error) { render(); notify(error.message, true); }
}
function openSettings(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  settingsId = id;
  setText(byId('settings-title'), `${nameOf(project)} settings`);
  setText(byId('settings-description'), 'Enabled apps are available at startup and included in default builds. Turning this off also stops the app.');
  byId('setting-enabled').checked = Boolean(project.config?.enabled);
  byId('settings-error').hidden = true;
  render();
  byId('settings-dialog').showModal();
}
byId('settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!settingsId) return;
  const id = settingsId;
  byId('settings-error').hidden = true;
  try {
    await mutate(`/api/projects/${encodeURIComponent(id)}/config`, 'PUT', { enabled: byId('setting-enabled').checked }, id);
    if (settingsId === id) byId('settings-dialog').close();
    notify('Settings saved and applied.');
  } catch (error) {
    if (settingsId === id) { setText(byId('settings-error'), error.message); byId('settings-error').hidden = false; }
  }
});
async function openLogs(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  logsId = id;
  logsRevision += 1;
  setText(byId('logs-title'), `${nameOf(project)} logs`);
  setText(byId('log-output'), 'Loading logs…');
  setText(byId('log-status'), 'Recent application output');
  byId('logs-dialog').showModal();
  await refreshLogs();
}
async function refreshLogs() {
  if (!logsId || logsPolling || !byId('logs-dialog').open || document.hidden) return;
  logsPolling = true;
  const id = logsId;
  const revision = logsRevision;
  try {
    const data = await api(`/api/projects/${encodeURIComponent(id)}/logs`);
    if (logsId !== id || revision !== logsRevision || !byId('logs-dialog').open) return;
    const output = byId('log-output');
    const text = Array.isArray(data.lines) && data.lines.length ? data.lines.join('\n') : 'No output yet. Start this app to see its logs here.';
    if (output.textContent !== text) {
      output.textContent = text;
      if (byId('follow-logs').checked) output.scrollTop = output.scrollHeight;
    }
    setText(byId('log-status'), 'Recent application output');
  } catch (error) {
    if (logsId === id && revision === logsRevision) setText(byId('log-status'), error.message);
  } finally { logsPolling = false; }
}
byId('copy-logs').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(byId('log-output').textContent); notify('Logs copied.'); }
  catch { notify('Copy is unavailable. Select the log text to copy it.', true); }
});
for (const control of document.querySelectorAll('[data-close]')) control.addEventListener('click', () => byId(control.dataset.close).close());
byId('settings-dialog').addEventListener('close', () => { if (!byId('settings-dialog').open) settingsId = null; });
byId('logs-dialog').addEventListener('close', () => { if (!byId('logs-dialog').open) { logsId = null; logsRevision += 1; } });
for (const dialog of [byId('settings-dialog'), byId('logs-dialog')]) dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
byId('start-enabled').addEventListener('click', async () => {
  try {
    const data = await mutate('/api/start-enabled');
    const failed = data.projects.some((project) => project.config?.enabled && project.status === 'error');
    notify(failed ? 'Some enabled apps need attention. Check their cards.' : 'Enabled apps started.', failed);
  }
  catch (error) { notify(error.message, true); }
});
byId('stop-all').addEventListener('click', async () => {
  try { await mutate('/api/stop-all'); notify('All Euler apps stopped.'); }
  catch (error) { notify(error.message, true); }
});
byId('search').addEventListener('input', render);
for (const control of document.querySelectorAll('[data-filter]')) control.addEventListener('click', () => {
  filter = control.dataset.filter;
  for (const item of document.querySelectorAll('[data-filter]')) {
    item.classList.toggle('active', item === control);
    item.setAttribute('aria-pressed', String(item === control));
  }
  render();
});
byId('reset-filters').addEventListener('click', () => { byId('search').value = ''; $('[data-filter="all"]').click(); byId('search').focus(); });
byId('retry').addEventListener('click', () => { window.dispatchEvent(new CustomEvent('euler:refresh')); void refresh(); });
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing
    && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
    && !document.activeElement?.isContentEditable && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    byId('search').focus();
  }
});
// Only the dock publishes shared state. Its start/end refresh protocol cancels
// pre-mutation reads; our revision also rejects overlapping local poll results.
window.addEventListener('euler:state', (event) => {
  if (mutationCount || !Array.isArray(event.detail?.projects)) return;
  lastSharedState = Date.now();
  stateRevision += 1;
  pollController?.abort();
  applyState(event.detail);
});
function revealAppearance() {
  const appearance = byId('appearance');
  if (appearance instanceof HTMLDetailsElement) appearance.open = true;
  appearance.scrollIntoView({ block: 'start', behavior: 'instant' });
}
window.addEventListener('hashchange', () => { if (window.location.hash === '#appearance') revealAppearance(); });
document.addEventListener('click', (event) => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (event.composedPath().some((node) => node.matches?.('a[href="/#appearance"], a[href="#appearance"]'))) revealAppearance();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateTime(); void refresh(); void refreshLogs(); } });
window.addEventListener('pageshow', () => { updateTime(); if (window.location.hash === '#appearance') revealAppearance(); void refresh(); });
window.addEventListener('pagehide', () => { stateRevision += 1; pollController?.abort(); });
updateTime();
render();
if (window.location.hash === '#appearance') revealAppearance();
void refresh();
setInterval(updateTime, 30000);
setInterval(() => {
  if (document.hidden) return;
  if (!connected || Date.now() - lastSharedState > 7500) void refresh();
  void refreshLogs();
}, 2000);
