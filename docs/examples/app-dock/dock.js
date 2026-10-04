// Copy this file and dock.css into your app's public/euler/ directory.
// Euler calls mount after the app's custom dock assets have loaded.
export function mount(context) {
  const { root, signal } = context;
  if (signal.aborted) return;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const surface = make('section', 'app-dock');
  const nav = make('nav', 'app-dock__nav');
  nav.setAttribute('aria-label', 'App dock');

  function link(id, name, url) {
    const anchor = make('a', 'app-dock__link');
    anchor.href = url;
    anchor.dataset.app = id;
    anchor.setAttribute('aria-label', name);
    anchor.title = name;
    anchor.addEventListener('click', (event) => {
      // Preserve native links for new tabs, copy-link, and modified clicks.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
          event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      context.navigate(id);
    }, { signal });
    return anchor;
  }

  const home = link('home', 'Euler Home', context.homeUrl);
  const avatar = make('img', 'app-dock__avatar');
  avatar.width = 28;
  avatar.height = 28;
  avatar.alt = '';
  home.append(avatar, make('span', 'app-dock__name', 'Home'));

  const apps = make('div', 'app-dock__apps');
  apps.setAttribute('role', 'group');
  apps.setAttribute('aria-label', 'Running apps');
  nav.append(home, apps);

  const footer = make('div', 'app-dock__footer');
  const status = make('span', 'app-dock__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const opacityLabel = make('label', 'app-dock__opacity', 'Opacity');
  const opacity = make('input');
  opacity.type = 'range';
  opacity.min = '20';
  opacity.max = '100';
  opacity.step = '1';
  opacity.setAttribute('aria-label', 'Dock background opacity');
  opacity.addEventListener('input', () => context.setOpacity(Number(opacity.value)), { signal });
  opacityLabel.append(opacity);
  footer.append(status, opacityLabel);
  surface.append(nav, footer);
  root.append(surface);

  nav.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const links = [...nav.querySelectorAll('a')];
    const current = links.indexOf(root.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length;
    links[next].focus();
  }, { signal });

  const appLinks = new Map();
  let disposed = false;
  let frame = 0;
  function measure() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (disposed) return;
      // Include the actual bottom offset and safe area in the reserved space.
      const clearance = Math.ceil(window.innerHeight - surface.getBoundingClientRect().top + 8);
      context.setClearance(Math.min(400, Math.max(0, clearance)));
    });
  }
  function active(anchor, selected) {
    if (selected) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  }
  const unsubscribe = context.subscribe((state) => {
    if (disposed) return;
    if (avatar.getAttribute('src') !== state.avatarUrl) avatar.src = state.avatarUrl;
    active(home, !state.currentAppId || state.currentAppId === 'home');
    const ids = new Set(state.apps.map((app) => app.id));
    for (const [id, entry] of appLinks) {
      if (!ids.has(id)) {
        // Keep keyboard focus within the dock when a running app disappears.
        if (root.activeElement === entry.anchor) home.focus();
        entry.anchor.remove();
        appLinks.delete(id);
      }
    }
    state.apps.forEach((app, index) => {
      let entry = appLinks.get(app.id);
      if (!entry) {
        const anchor = link(app.id, app.name, app.url);
        const monogram = make('span', 'app-dock__monogram');
        monogram.setAttribute('aria-hidden', 'true');
        const name = make('span', 'app-dock__name');
        anchor.append(monogram, name);
        entry = { anchor, monogram, name };
        appLinks.set(app.id, entry);
      }
      entry.anchor.href = app.url;
      entry.anchor.title = app.name;
      entry.anchor.setAttribute('aria-label', app.name);
      entry.monogram.textContent = app.name.slice(0, 2).toUpperCase();
      entry.name.textContent = app.name;
      active(entry.anchor, app.active);
      if (apps.children[index] !== entry.anchor) {
        apps.insertBefore(entry.anchor, apps.children[index] || null);
      }
    });
    surface.dataset.online = String(state.online);
    surface.style.setProperty('--app-dock-opacity', String(state.opacity / 100));
    opacity.value = String(state.opacity);
    opacity.setAttribute('aria-valuetext', `${state.opacity} percent`);
    const message = state.online
      ? `${state.apps.length} ${state.apps.length === 1 ? 'app' : 'apps'} running`
      : 'Reconnecting to Euler';
    if (status.textContent !== message) status.textContent = message;
    measure();
  });

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
  observer?.observe(surface);
  window.addEventListener('resize', measure, { signal });
  measure();

  function cleanup() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    unsubscribe();
    signal.removeEventListener('abort', cleanup);
    window.removeEventListener('resize', measure);
    surface.remove();
  }
  signal.addEventListener('abort', cleanup, { once: true });
  if (signal.aborted) cleanup();
  return cleanup;
}
