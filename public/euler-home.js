const byId = (id) => document.getElementById(id);
const knownIcons = new Set(['innernet', 'quitter', 'instants']);
const tiles = new Map();
let activeRequest = false;
let stateReceived = false;
let connected = false;
let requestController;
let lastSharedState = 0;

function updateTime() {
  const now = new Date();
  byId('today').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  byId('header-clock').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now);
  byId('header-clock').dateTime = now.toISOString();
  const hour = now.getHours();
  byId('welcome-title').textContent = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
}

function appTile(project) {
  const item = document.createElement('li');
  item.className = 'app-tile';
  const anchor = document.createElement('a');
  anchor.className = 'app-link';
  anchor.href = `/app/${encodeURIComponent(project.id)}/`;
  anchor.dataset.eulerApp = project.id;
  const icon = document.createElement('img');
  icon.className = 'app-icon';
  icon.src = `/euler-icons/${knownIcons.has(project.id) ? project.id : 'home'}.svg`;
  icon.alt = '';
  icon.width = 84;
  icon.height = 84;
  icon.draggable = false;
  const name = document.createElement('span');
  name.className = 'app-name';
  anchor.append(icon, name);
  item.append(anchor);
  return { item, anchor, name };
}

function renderState(state) {
  if (!Array.isArray(state?.projects)) return;
  stateReceived = true;
  connected = true;
  const apps = state.projects.filter((project) => project?.hosting === 'compiled' && project.status === 'running' && typeof project.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(project.id));
  const current = new Set(apps.map((project) => project.id));
  for (const [id, tile] of tiles) {
    if (!current.has(id)) { tile.item.remove(); tiles.delete(id); }
  }
  for (const [index, project] of apps.entries()) {
    let tile = tiles.get(project.id);
    if (!tile) {
      tile = appTile(project);
      tiles.set(project.id, tile);
      byId('app-grid').append(tile.item);
    }
    const grid = byId('app-grid');
    if (grid.children[index] !== tile.item) grid.insertBefore(tile.item, grid.children[index] || null);
    const name = typeof project.name === 'string' && project.name.trim() ? project.name : project.id;
    tile.name.textContent = name;
    tile.anchor.setAttribute('aria-label', `Open ${name}`);
    tile.anchor.title = name;
  }
  byId('app-grid').hidden = apps.length === 0;
  byId('empty-state').hidden = apps.length > 0;
  byId('loading-indicator').hidden = true;
  byId('retry').hidden = true;
  byId('empty-manage').hidden = false;
  byId('empty-title').textContent = 'Make this space yours.';
  byId('empty-copy').textContent = 'Turn on an app in Manage apps. It will appear here, ready when you are.';
  byId('space-status').className = `space-status${apps.length ? ' ready' : ''}`;
  byId('space-status-text').textContent = apps.length ? `${apps.length} ${apps.length === 1 ? 'app' : 'apps'} ready · Everything runs locally` : 'Your workspace is ready';
}

function showOffline() {
  connected = false;
  byId('space-status').className = 'space-status offline';
  byId('space-status-text').textContent = 'Reconnecting to Euler';
  if (!stateReceived || tiles.size === 0) {
    byId('loading-indicator').hidden = true;
    byId('empty-title').textContent = 'Your space is taking a moment.';
    byId('empty-copy').textContent = 'Euler may be restarting. We’ll reconnect when it’s ready.';
    byId('retry').hidden = false;
    byId('empty-manage').hidden = true;
    byId('empty-state').hidden = false;
  }
}

async function refresh() {
  if (activeRequest || document.hidden) return;
  activeRequest = true;
  requestController = new AbortController();
  const timeout = setTimeout(() => requestController.abort(), 5000);
  try {
    const response = await fetch('/api/state', { cache: 'no-store', credentials: 'same-origin', signal: requestController.signal });
    if (!response.ok) throw new Error('Unavailable');
    const state = await response.json();
    if (!Array.isArray(state?.projects)) throw new Error('Invalid workspace');
    renderState(state);
  } catch { showOffline(); }
  finally { clearTimeout(timeout); activeRequest = false; }
}

// The persistent dock also shares fresh state so app toggles appear immediately.
window.addEventListener('euler:state', (event) => { lastSharedState = Date.now(); renderState(event.detail); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateTime(); void refresh(); } });
window.addEventListener('pageshow', () => { updateTime(); void refresh(); });
byId('retry').addEventListener('click', () => void refresh());
updateTime();
void refresh();
setInterval(updateTime, 30_000);
setInterval(() => { if (!connected || Date.now() - lastSharedState > 7500) void refresh(); }, 5000);
