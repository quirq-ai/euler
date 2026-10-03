const $ = (selector, context = document) => context.querySelector(selector);
const state = { projects: [], dashboard: {}, loaded: false };
const rows = new Map();
const pending = new Set();
let filter = 'all';
let settingsId = null;
let logsId = null;
let polling = false;
let logsPolling = false;
let toastTimer;
let mutationCount = 0;
let stateRevision = 0;

const statusLabels = { stopped: 'Stopped', starting: 'Starting', running: 'Running', stopping: 'Stopping', error: 'Needs attention' };
const projectLooks = { innernet: ['in', 'blue'], quitter: ['q', 'green'], instants: ['i', 'rose'] };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

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

function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
function nameOf(project) { return project.name || project.id; }
function busy(project) { return pending.has(project.id) || project.status === 'starting' || project.status === 'stopping'; }
function owned(project) { return ['running', 'starting', 'stopping'].includes(project.status); }

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new Error('The dashboard returned an unreadable response. Please try again.'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`);
  return data;
}

function notify(message, error = false) {
  clearTimeout(toastTimer);
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 7000 : 3500);
}

function applyState(data) {
  if (!Array.isArray(data.projects)) return;
  state.projects = data.projects;
  state.dashboard = { ...state.dashboard, ...data.dashboard };
  state.loaded = true;
  renderWorkspaceContext();
  render();
}

function renderWorkspaceContext() {
  const name = typeof state.dashboard.name === 'string' && state.dashboard.name.trim()
    ? state.dashboard.name.trim() : 'Euler';
  setText($('#workspace-name'), name);
  $('#workspace-name').title = name;
  document.title = 'Manage apps · Euler';
}

function connection(ok, message = '') {
  const label = $('#sync-label');
  label.replaceChildren(element('span', 'sync-dot'), document.createTextNode(ok ? 'Live updates' : 'Disconnected'));
  label.classList.toggle('offline', !ok);
  $('#connection-message').hidden = ok;
  $('#connection-message').textContent = message;
}

async function refresh() {
  if (polling || mutationCount) return;
  polling = true;
  const revision = stateRevision;
  try {
    const data = await api('/api/state');
    if (revision === stateRevision && !mutationCount) applyState(data);
    connection(true);
  } catch {
    connection(false, 'The dashboard server is unavailable. Reopen the dashboard command to reconnect.');
    if (!state.loaded) {
      $('#apps').replaceChildren();
      $('#empty-state').hidden = false;
      $('#empty-state h3').textContent = 'Waiting for your workspace';
      $('#empty-state p').textContent = 'The page will reconnect automatically when the dashboard is available.';
      $('#reset-filters').hidden = true;
    }
  } finally { polling = false; }
}

async function mutate(path, method = 'POST', body = {}, key = 'all') {
  if (pending.has(key)) throw new Error('This app is still processing another action. Try again in a moment.');
  pending.add(key);
  mutationCount++;
  stateRevision++;
  render();
  try {
    const data = await api(path, { method, body: JSON.stringify(body) });
    applyState(data);
    connection(true);
    return data;
  } finally {
    mutationCount--;
    stateRevision++;
    pending.delete(key);
    render();
    void refresh();
  }
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function createRow(project) {
  const row = element('article', 'app-row');
  const identity = element('div', 'app-identity');
  const emblem = element('span', 'app-icon');
  emblem.setAttribute('aria-hidden', 'true');
  const info = element('div', 'app-info');
  const titleLine = element('div', 'app-title-line');
  const title = element('h3', 'app-name');
  const enabled = element('span', 'enabled-marker');
  enabled.append(icon('check'));
  enabled.title = 'Enabled in Euler';
  enabled.setAttribute('aria-label', 'Enabled in Euler');
  titleLine.append(title, enabled);
  const description = element('p', 'app-description');
  const error = element('p', 'app-error');
  info.append(titleLine, description, error);
  identity.append(emblem, info);
  const status = element('span', 'app-status');
  const statusText = element('span');
  status.append(element('span', 'status-dot'), statusText);
  const port = element('span', 'app-port');
  const portText = element('span');
  port.append(portText);
  const actions = element('div', 'app-actions');
  const open = element('a', 'button open-button');
  open.append(element('span', '', 'Open'));
  const external = element('a', 'icon-button external-button');
  external.append(icon('external'));
  external.target = '_blank';
  external.rel = 'noopener noreferrer';
  const toggle = button('Start', 'play', 'button app-toggle');
  const restart = button('', 'restart', 'icon-button');
  const logs = button('', 'log', 'icon-button');
  const settings = button('', 'settings', 'icon-button');
  actions.append(open, external, toggle, restart, logs, settings);
  row.append(identity, status, port, actions);
  toggle.addEventListener('click', () => act(project.id, toggle.dataset.action));
  restart.addEventListener('click', () => act(project.id, 'restart'));
  logs.addEventListener('click', () => openLogs(project.id));
  settings.addEventListener('click', () => openSettings(project.id));
  return { row, emblem, title, enabled, description, error, status, statusText, portText, open, external, toggle, restart, logs, settings };
}

function updateRow(parts, project) {
  const name = nameOf(project);
  const [mark, tone] = projectLooks[project.id] || [name.slice(0, 2), 'gray'];
  setText(parts.emblem, mark);
  parts.emblem.dataset.tone = tone;
  setText(parts.title, name);
  setText(parts.description, project.description || project.id);
  parts.description.title = project.description || project.id;
  parts.enabled.hidden = !project.config?.enabled;
  setText(parts.error, project.error || (!project.available ? 'Build Euler before starting this app.' : ''));
  parts.error.hidden = !parts.error.textContent;
  parts.status.dataset.status = project.status;
  parts.status.firstElementChild.classList.toggle('running', project.status === 'running');
  setText(parts.statusText, statusLabels[project.status] || 'Unknown');
  setText(parts.portText, 'Direct');
  parts.portText.title = '/app/' + project.id + '/ on the Euler server';
  const url = safeUrl(project.url);
  const canOpen = Boolean(url && project.status === 'running');
  if (canOpen) parts.open.href = url;
  else parts.open.removeAttribute('href');
  parts.open.setAttribute('aria-label', 'Open ' + name);
  parts.open.setAttribute('aria-disabled', String(!canOpen));
  parts.open.tabIndex = canOpen ? 0 : -1;
  parts.open.title = canOpen ? 'Open ' + name : 'Start this app to open it';
  if (canOpen) parts.external.href = url;
  else parts.external.removeAttribute('href');
  parts.external.setAttribute('aria-disabled', String(!canOpen));
  parts.external.tabIndex = canOpen ? 0 : -1;
  parts.external.setAttribute('aria-label', 'Open ' + name + ' in a new tab');
  parts.external.title = 'Open in new tab';
  const action = owned(project) ? 'stop' : 'start';
  if (parts.toggle.dataset.action !== action) {
    parts.toggle.dataset.action = action;
    parts.toggle.replaceChildren(icon(action === 'stop' ? 'stop' : 'play'), element('span', '', action === 'stop' ? 'Stop' : 'Start'));
  }
  parts.toggle.disabled = pending.has(project.id) || pending.has('all')
    || (action === 'stop' ? project.status === 'stopping' : !project.available || busy(project));
  parts.toggle.setAttribute('aria-label', (action === 'stop' ? 'Stop ' : 'Start ') + name);
  parts.restart.disabled = !project.available || project.status !== 'running' || busy(project) || pending.has('all');
  parts.restart.setAttribute('aria-label', 'Restart ' + name);
  parts.restart.title = 'Restart ' + name;
  parts.logs.setAttribute('aria-label', 'View ' + name + ' logs');
  parts.logs.title = 'View logs';
  parts.settings.setAttribute('aria-label', name + ' settings');
  parts.settings.title = 'App settings';
}

function render() {
  if (!state.loaded) return;
  const projects = state.projects;
  const query = $('#search').value.trim().toLowerCase();
  const isRunning = (project) => project.status === 'running';
  const visible = projects.filter((project) => {
    const matches = `${project.id} ${nameOf(project)} ${project.description || ''}`.toLowerCase().includes(query);
    return matches && (filter === 'all' || filter === 'running' && isRunning(project) || filter === 'enabled' && project.config?.enabled || filter === 'stopped' && ['stopped', 'error'].includes(project.status));
  });
  setText($('#running-count'), String(projects.filter(isRunning).length));
  setText($('#enabled-count'), String(projects.filter((project) => project.config?.enabled).length));
  setText($('#total-count'), String(projects.length));
  setText($('#list-count'), String(visible.length));
  $('#start-enabled').disabled = pending.size > 0 || !projects.some((project) => project.config?.enabled && project.available && !owned(project) && ['stopped', 'error'].includes(project.status));
  $('#stop-all').disabled = pending.size > 0 || !projects.some((project) => owned(project) && project.status !== 'stopping');
  const list = $('#apps');
  if (!rows.size) list.replaceChildren();
  const existing = new Set(projects.map((project) => project.id));
  for (const [id, parts] of rows) if (!existing.has(id)) { parts.row.remove(); rows.delete(id); }
  const shown = new Set(visible.map((project) => project.id));
  for (const project of projects) {
    let parts = rows.get(project.id);
    if (!parts) { parts = createRow(project); rows.set(project.id, parts); list.append(parts.row); }
    updateRow(parts, project);
    parts.row.hidden = !shown.has(project.id);
  }
  $('#empty-state').hidden = visible.length > 0;
  $('#empty-state h3').textContent = projects.length ? 'No apps found' : 'No applications yet';
  $('#empty-state p').textContent = projects.length ? 'Try a different name or choose another filter.' : 'Applications will appear here when they are added to your workspace.';
  $('#reset-filters').hidden = !projects.length;
  if (state.dashboard.port) setText($('#dashboard-address'), 'Euler · localhost:' + state.dashboard.port);
}

async function act(id, action) {
  if (!['start', 'stop', 'restart'].includes(action)) return;
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  try {
    await mutate(`/api/projects/${encodeURIComponent(id)}/${action}`, 'POST', {}, id);
    notify(`${nameOf(project)} ${action === 'start' ? 'is starting' : action === 'restart' ? 'is restarting' : 'stopped'}.`);
  } catch (error) { notify(error.message, true); }
}

function openSettings(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  settingsId = id;
  $('#settings-title').textContent = nameOf(project);
  $('#settings-description').textContent = project.description || 'Choose whether this app is available in Euler.';
  $('#setting-enabled').checked = Boolean(project.config?.enabled);
  $('#settings-error').hidden = true;
  $('#settings-dialog').showModal();
}

$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!settingsId) return;
  const id = settingsId;
  const config = { enabled: $('#setting-enabled').checked };
  $('#save-settings').disabled = true;
  $('#settings-error').hidden = true;
  try {
    await mutate(`/api/projects/${encodeURIComponent(id)}/config`, 'PUT', config, id);
    if (settingsId === id) $('#settings-dialog').close();
    notify('Settings saved and applied.');
  } catch (error) {
    $('#settings-error').textContent = error.message;
    $('#settings-error').hidden = false;
  } finally { $('#save-settings').disabled = false; }
});

async function openLogs(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  logsId = id;
  $('#logs-title').textContent = `${nameOf(project)} logs`;
  $('#log-output').textContent = 'Loading logs…';
  $('#log-status').textContent = 'Recent application output';
  $('#logs-dialog').showModal();
  await refreshLogs();
}

async function refreshLogs() {
  if (!logsId || logsPolling || !$('#logs-dialog').open) return;
  logsPolling = true;
  const id = logsId;
  try {
    const data = await api(`/api/projects/${encodeURIComponent(id)}/logs`);
    if (logsId !== id) return;
    const output = $('#log-output');
    const text = Array.isArray(data.lines) && data.lines.length ? data.lines.join('\n') : 'No output yet. Start this app to see its logs here.';
    if (output.textContent !== text) {
      output.textContent = text;
      if ($('#follow-logs').checked) output.scrollTop = output.scrollHeight;
    }
  } catch (error) {
    if (logsId === id) $('#log-status').textContent = error.message;
  } finally { logsPolling = false; }
}

$('#copy-logs').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#log-output').textContent); notify('Logs copied.'); }
  catch { notify('Copy is unavailable. Select the log text to copy it.', true); }
});
for (const control of document.querySelectorAll('[data-close]')) control.addEventListener('click', () => document.getElementById(control.dataset.close).close());
$('#settings-dialog').addEventListener('close', () => { settingsId = null; });
$('#logs-dialog').addEventListener('close', () => { logsId = null; });
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});

$('#start-enabled').addEventListener('click', async () => {
  try { await mutate('/api/start-enabled'); notify('Your enabled apps are starting.'); }
  catch (error) { notify(error.message, true); }
});
$('#stop-all').addEventListener('click', async () => {
  try { await mutate('/api/stop-all'); notify('All Euler apps have stopped.'); }
  catch (error) { notify(error.message, true); }
});
$('#search').addEventListener('input', render);
for (const control of document.querySelectorAll('[data-filter]')) control.addEventListener('click', () => {
  filter = control.dataset.filter;
  for (const item of document.querySelectorAll('[data-filter]')) {
    item.classList.toggle('active', item === control);
    item.setAttribute('aria-pressed', String(item === control));
  }
  render();
});
$('#reset-filters').addEventListener('click', () => { $('#search').value = ''; $('[data-filter="all"]').click(); $('#search').focus(); });
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    $('#search').focus();
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { void refresh(); void refreshLogs(); } });
setInterval(() => { if (!document.hidden) { void refresh(); void refreshLogs(); } }, 2000);
void refresh();
