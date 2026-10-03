import { AVATAR_STORAGE_KEY, avatarUri, loadAvatarConfig } from './euler-avatar.js';

const STATE_KEY = 'euler.dock.state.v1';
const ROUTES_KEY = 'euler.dock.routes.v1';
const OPACITY_KEY = 'euler.dock.opacity.v1';
const RESUME_KEY = 'euler.dock.resume.v1';
const iconIds = new Set(['innernet', 'quitter', 'instants']);
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id);

export function safeAppRoute(value, id, origin) {
  if (!validId(id) || typeof value !== 'string') return null;
  try {
    const url = new URL(value, origin);
    const base = `/app/${id}`;
    if (url.origin !== origin || url.username || url.password || (url.pathname !== base && !url.pathname.startsWith(`${base}/`))) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
export function dockOpacity(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return 72;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(20, Math.min(100, Math.round(parsed))) : 72;
}
export function runningApps(data) {
  if (!Array.isArray(data?.projects)) return [];
  const seen = new Set();
  return data.projects.filter((app) => app && typeof app === 'object' && validId(app.id) && !seen.has(app.id) && app.hosting === 'compiled' && app.status === 'running' && seen.add(app.id))
    .map((app) => ({ id: app.id, name: typeof app.name === 'string' ? app.name.slice(0, 80) : app.id }));
}

if (typeof window !== 'undefined' && !customElements.get('euler-dock')) {
  const storage = (name) => { try { return window[name]; } catch { return { getItem() { return null; }, setItem() {}, removeItem() {} }; } };
  const sessionStore = storage('sessionStorage');
  const localStore = storage('localStorage');
  const read = (storage, key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } };
  const node = (tag, attrs = {}, text) => {
    const item = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) item.setAttribute(name, value);
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const currentId = () => /^\/app\/([^/]+)(?:\/|$)/.exec(location.pathname)?.[1] || null;
  let latestApps = [];
  function storedRoutes() {
    const routes = read(sessionStore, ROUTES_KEY, {});
    return routes && typeof routes === 'object' && !Array.isArray(routes) ? routes : {};
  }
  let sessionRoutes = storedRoutes();
  function remember() {
    const id = currentId();
    const url = safeAppRoute(location.href, id, location.origin);
    if (!url) return;
    // Back/Forward can revive an older document after another app saved a route.
    sessionRoutes = storedRoutes();
    sessionRoutes[id] = { url, x: scrollX, y: scrollY };
    write(sessionStore, ROUTES_KEY, sessionRoutes);
  }
  function routeFor(id) {
    sessionRoutes = storedRoutes();
    return safeAppRoute(sessionRoutes[id]?.url, id, location.origin) || `/app/${id}/`;
  }
  function prepareNavigation(event, id, link) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (id && id === currentId()) { event.preventDefault(); return; }
    remember();
    if (id) {
      link.href = routeFor(id);
      const saved = sessionRoutes[id];
      write(sessionStore, RESUME_KEY, { id, url: link.getAttribute('href'), x: saved?.x || 0, y: saved?.y || 0, at: Date.now() });
    }
    document.documentElement.dataset.eulerNavigating = 'true';
    setTimeout(() => { delete document.documentElement.dataset.eulerNavigating; }, 5000);
  }

  class EulerDock extends HTMLElement {
    constructor() {
      super();
      const shadow = this.attachShadow({ mode: 'open' });
      const styles = node('link', { rel: 'stylesheet', href: '/euler-dock-ui.css' });
      this.style.visibility = 'hidden';
      this.stylesReady = new Promise((resolve) => {
        styles.addEventListener('load', () => { this.style.visibility = 'visible'; resolve(); }, { once: true });
        styles.addEventListener('error', resolve, { once: true });
      });
      shadow.append(styles);
      this.surface = node('div', { class: 'dock-surface' });
      this.nav = node('nav', { class: 'dock', 'aria-label': 'Euler app dock' });
      this.home = this.link('home', 'Home', '/');
      this.home.querySelector('img').classList.add('home-avatar');
      this.updateAvatar();
      this.home.setAttribute('aria-keyshortcuts', 'Alt+0');
      this.apps = node('div', { class: 'dock-apps', role: 'group', 'aria-label': 'Running apps' });
      this.settings = node('button', { class: 'dock-item utility', type: 'button', 'aria-label': 'Dock appearance', 'aria-expanded': 'false', 'aria-controls': 'dock-settings', 'data-label': 'Dock appearance' });
      this.settings.append(node('img', { src: '/euler-icons/settings.svg', alt: '', width: '48', height: '48', draggable: 'false' }));
      this.panel = node('section', { id: 'dock-settings', class: 'dock-settings', hidden: '', 'aria-label': 'Dock appearance' });
      const title = node('div', { class: 'settings-heading' });
      title.append(node('strong', {}, 'Make it yours'));
      const close = node('button', { type: 'button', class: 'close-panel', 'aria-label': 'Close dock appearance' }, '×');
      title.append(close);
      const label = node('label', { for: 'dock-opacity', class: 'opacity-label' }, 'Dock opacity');
      this.output = node('output', { for: 'dock-opacity' }); label.append(this.output);
      this.range = node('input', { type: 'range', id: 'dock-opacity', min: '20', max: '100', step: '1', 'aria-label': 'Dock opacity' });
      const hint = node('div', { class: 'range-labels', 'aria-hidden': 'true' }); hint.append(node('span', {}, 'Sheer'), node('span', {}, 'Solid'));
      const customize = node('a', { href: '/#appearance', class: 'customize-link' }, 'Customize Euler icon');
      this.panel.append(title, label, this.range, hint, customize);
      this.status = node('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
      this.nav.append(this.home, node('span', { class: 'divider', 'aria-hidden': 'true' }), this.apps, node('span', { class: 'divider', 'aria-hidden': 'true' }), this.settings);
      this.surface.append(this.panel, this.nav, this.status); shadow.append(this.surface);
      this.buttons = new Map();
      let stored; try { stored = localStore.getItem(OPACITY_KEY); } catch {}
      this.setOpacity(dockOpacity(stored));
      this.range.addEventListener('input', () => {
        this.setOpacity(this.range.value);
        try { localStore.setItem(OPACITY_KEY, this.range.value); } catch {}
      });
      this.settings.addEventListener('click', () => this.togglePanel());
      close.addEventListener('click', () => { this.togglePanel(false); this.settings.focus(); });
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !this.panel.hidden) { event.preventDefault(); this.togglePanel(false); this.settings.focus(); }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.composedPath()[0] === this.range || !this.panel.hidden) return;
        const items = [this.home, ...this.apps.children, this.settings];
        const index = items.indexOf(shadow.activeElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
      });
      this.home.addEventListener('click', (event) => prepareNavigation(event, null, this.home));
      document.addEventListener('pointerdown', (event) => { if (!event.composedPath().includes(this)) this.togglePanel(false); });
    }
    link(id, label, href) {
      const link = node('a', { href, class: `dock-item${id === 'home' ? ' utility' : ''}`, 'aria-label': label, 'data-label': label, 'data-app': id });
      if (iconIds.has(id) || id === 'home') link.append(node('img', { src: `/euler-icons/${id}.svg`, alt: '', width: '56', height: '56', draggable: 'false' }));
      else link.append(node('span', { class: 'fallback-icon', 'aria-hidden': 'true' }, label.slice(0, 2)));
      link.append(node('span', { class: 'running-dot', 'aria-hidden': 'true' }));
      return link;
    }
    setOpacity(value) {
      const opacity = dockOpacity(value);
      this.style.setProperty('--dock-opacity', String(opacity / 100));
      this.range.value = String(opacity); this.output.textContent = `${opacity}%`;
      this.range.setAttribute('aria-valuetext', `${opacity} percent`);
    }
    updateAvatar() {
      const icon = this.home.querySelector('img');
      const source = avatarUri(loadAvatarConfig());
      if (icon.getAttribute('src') !== source) icon.src = source;
    }
    togglePanel(open = this.panel.hidden) {
      this.panel.hidden = !open; this.settings.setAttribute('aria-expanded', String(open));
      if (open) this.range.focus();
    }
    render(apps, online = true) {
      this.toggleAttribute('data-many-apps', apps.length > 3);
      const ids = new Set(apps.map((app) => app.id));
      for (const [id, link] of this.buttons) if (!ids.has(id)) { link.remove(); this.buttons.delete(id); }
      apps.forEach((app, index) => {
        let link = this.buttons.get(app.id);
        if (!link) {
          link = this.link(app.id, app.name, routeFor(app.id));
          link.addEventListener('click', (event) => prepareNavigation(event, app.id, link));
          this.buttons.set(app.id, link); this.apps.append(link);
        }
        if (this.apps.children[index] !== link) this.apps.insertBefore(link, this.apps.children[index] || null);
        link.href = routeFor(app.id);
        link.setAttribute('aria-label', app.name); link.dataset.label = app.name;
        link.setAttribute('aria-keyshortcuts', `Alt+${index + 1}`);
        if (currentId() === app.id) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      });
      if (location.pathname === '/') this.home.setAttribute('aria-current', 'page'); else this.home.removeAttribute('aria-current');
      this.toggleAttribute('data-offline', !online);
      const message = online ? '' : 'Euler is disconnected. Reconnecting…';
      if (this.status.textContent !== message) this.status.textContent = message;
      this.setAttribute('aria-label', online ? 'Euler dock' : 'Euler dock, disconnected');
    }
  }
  customElements.define('euler-dock', EulerDock);
  const dock = new EulerDock();
  dock.id = 'euler-dock';
  dock.style.viewTransitionName = 'euler-dock';
  const cached = read(sessionStore, STATE_KEY, null);
  if (cached?.at > Date.now() - 30000) { latestApps = runningApps(cached.data); dock.render(latestApps); }

  function mount() {
    if (!document.body) return;
    if (!dock.isConnected) document.body.append(dock);
    if (typeof dock.showPopover === 'function') {
      dock.setAttribute('popover', 'manual');
      if (!dock.matches(':popover-open')) dock.showPopover();
    }
    document.documentElement.classList.add('euler-shell');
    if (currentId()) document.documentElement.dataset.eulerApp = currentId();
  }
  let polling = false;
  let stateRevision = 0;
  let mutationPending = false;
  let requestController;
  function applyState(data, broadcast = true) {
    if (data?.dashboard?.mode !== 'compiled' || !Array.isArray(data.projects)) return;
    latestApps = runningApps(data); dock.render(latestApps);
    write(sessionStore, STATE_KEY, { at: Date.now(), data: { projects: latestApps.map((app) => ({ ...app, status: 'running', hosting: 'compiled' })), dashboard: data.dashboard } });
    if (broadcast) window.dispatchEvent(new CustomEvent('euler:state', { detail: data }));
  }
  async function refresh() {
    if (polling || mutationPending || document.visibilityState === 'hidden') return;
    polling = true;
    const revision = stateRevision;
    const controller = new AbortController();
    requestController = controller;
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch('/api/state', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('State unavailable');
      const data = await response.json();
      if (revision === stateRevision && !mutationPending) applyState(data);
    } catch { if (revision === stateRevision && !mutationPending) dock.render(latestApps, false); }
    finally {
      clearTimeout(timeout);
      if (revision === stateRevision) { polling = false; requestController = null; }
    }
  }
  // Discard any poll begun before a Home action, so a stopped app cannot reappear.
  window.addEventListener('euler:refresh', (event) => {
    stateRevision++;
    requestController?.abort(); requestController = null; polling = false;
    if (event.detail?.phase === 'start') mutationPending = true;
    else if (event.detail?.phase === 'end') {
      mutationPending = false;
      if (event.detail.state) applyState(event.detail.state, false);
    }
    if (!mutationPending) void refresh();
  });
  function resumeScroll() {
    const resume = read(sessionStore, RESUME_KEY, null);
    if (!resume || resume.id !== currentId() || resume.at < Date.now() - 15000 || safeAppRoute(resume.url, resume.id, location.origin) !== location.pathname + location.search + location.hash) return;
    try { sessionStore.removeItem(RESUME_KEY); } catch {}
    const x = Number.isFinite(resume.x) ? Math.max(0, resume.x) : 0;
    const y = Number.isFinite(resume.y) ? Math.max(0, resume.y) : 0;
    // Restore once the app has hydrated and grown to its final scroll height.
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    window.addEventListener('wheel', cancel, { once: true, passive: true });
    window.addEventListener('touchstart', cancel, { once: true, passive: true });
    for (const ms of [0, 120, 350, 700]) setTimeout(() => { if (!cancelled) scrollTo({ left: x, top: y, behavior: 'instant' }); }, ms);
    setTimeout(() => { window.removeEventListener('wheel', cancel); window.removeEventListener('touchstart', cancel); }, 750);
  }
  function ready() {
    mount(); void refresh();
    if (document.readyState === 'complete') resumeScroll();
    else window.addEventListener('load', resumeScroll, { once: true });
    const observer = new MutationObserver(() => { if (!dock.isConnected) mount(); });
    observer.observe(document.body, { childList: true });
  }
  if (document.readyState !== 'loading') ready(); else document.addEventListener('DOMContentLoaded', ready, { once: true });
  window.addEventListener('pageshow', (event) => { delete document.documentElement.dataset.eulerNavigating; dock.updateAvatar(); if (event.persisted) { mount(); void refresh(); } });
  window.addEventListener('pagehide', remember);
  window.addEventListener('pageswap', (event) => {
    remember();
    // A cancelled navigation or unsupported destination can skip the animation.
    event.viewTransition?.ready.catch(() => {});
  });
  window.addEventListener('pagereveal', (event) => {
    event.viewTransition?.ready.then(
      () => window.dispatchEvent(new CustomEvent('euler:transition', { detail: { animated: true } })),
      () => window.dispatchEvent(new CustomEvent('euler:transition', { detail: { animated: false } })),
    );
  });
  window.addEventListener('hashchange', () => { remember(); dock.render(latestApps); });
  window.addEventListener('popstate', () => { remember(); dock.render(latestApps); });
  window.addEventListener('storage', (event) => {
    if (event.key === OPACITY_KEY || event.key === null) dock.setOpacity(event.newValue);
    if (event.key === AVATAR_STORAGE_KEY || event.key === null) dock.updateAvatar();
  });
  window.addEventListener('euler:avatar-change', () => dock.updateAvatar());
  document.addEventListener('visibilitychange', () => { if (document.hidden) remember(); else { dock.updateAvatar(); void refresh(); } });
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[data-euler-app]');
    if (link && latestApps.some((app) => app.id === link.dataset.eulerApp)) prepareNavigation(event, link.dataset.eulerApp, link);
  });
  window.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (!/^[0-9]$/.test(event.key)) return;
    const index = Number(event.key);
    const link = index === 0 ? dock.home : dock.buttons.get(latestApps[index - 1]?.id);
    if (link) { event.preventDefault(); link.click(); }
  });
  setInterval(() => { if (!document.hidden) { remember(); void refresh(); } }, 2500);
  // Synchronous setup above runs before the incoming snapshot. Finish loading
  // the isolated styles without leaving module initialization pending forever.
  await Promise.race([dock.stylesReady, new Promise((resolve) => setTimeout(resolve, 2000))]);
}
