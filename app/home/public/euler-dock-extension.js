const appIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function assetUrl(value, appId, origin, extension) {
  const prefix = `/app/${appId}/`;
  if (typeof value !== 'string' || !value.startsWith(prefix) || /[\\?#\u0000-\u001f\u007f-\u009f]/.test(value)) throw new Error('Dock assets must belong to the current app.');
  let segments;
  try { segments = value.slice(prefix.length).split('/').map(decodeURIComponent); }
  catch { throw new Error('Dock asset URL has invalid encoding.'); }
  if (segments.some((part) => !part || part === '.' || part === '..' || /[\\/%:?#\u0000-\u001f\u007f-\u009f]/.test(part)) || !extension.test(segments.at(-1))) throw new Error('Dock asset URL has an unsupported path or file type.');
  const url = new URL(value, origin);
  if (url.origin !== origin || !url.pathname.startsWith(prefix)) throw new Error('Dock assets must use the Euler origin.');
  return url.href;
}

export function parseDockConfig(raw, pathname, origin) {
  // Home always owns the default interface, including when an app supplies bad metadata.
  const appId = /^\/app\/([^/]+)(?:\/|$)/.exec(pathname)?.[1];
  if (!appId || raw == null) return null;
  if (typeof raw !== 'string' || raw.length > 8192) throw new Error('Invalid dock configuration.');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('Invalid dock configuration JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !appIdPattern.test(appId) || value.appId !== appId || Object.keys(value).some((key) => !['version', 'appId', 'moduleUrl', 'stylesheetUrl'].includes(key))) throw new Error('Dock configuration does not match the current app.');
  const config = { version: 1, appId };
  if (value.moduleUrl !== undefined) config.moduleUrl = assetUrl(value.moduleUrl, appId, origin, /\.(?:m?js)$/i);
  if (value.stylesheetUrl !== undefined) config.stylesheetUrl = assetUrl(value.stylesheetUrl, appId, origin, /\.css$/i);
  if (!config.moduleUrl && !config.stylesheetUrl) throw new Error('Dock configuration needs a module or stylesheet.');
  return Object.freeze(config);
}

export function dockSnapshot({ apps, currentAppId, online, opacity, avatarUrl }) {
  return Object.freeze({
    apps: Object.freeze(apps.map(({ id, name, url }) => Object.freeze({ id, name, url, active: id === currentAppId }))),
    currentAppId, online, opacity, avatarUrl,
  });
}

// Subscriber failures are handled by the active view, never by the polling loop.
export function createDockSubscription(getState, signal, onError) {
  const listeners = new Set();
  signal.addEventListener('abort', () => listeners.clear(), { once: true });
  const call = (listener) => {
    try {
      const result = listener(getState());
      if (result && typeof result.then === 'function') Promise.resolve(result).catch((error) => { if (!signal.aborted) onError(error); });
    } catch (error) { onError(error); }
  };
  return {
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Dock subscriber must be a function.');
      if (signal.aborted) return () => {};
      listeners.add(listener);
      call(listener);
      return () => listeners.delete(listener);
    },
    publish() {
      for (const listener of [...listeners]) {
        if (signal.aborted) return;
        if (listeners.has(listener)) call(listener);
      }
    },
  };
}

export function dockClearance(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Dock clearance must be a finite number.');
  return Math.max(0, Math.min(400, value));
}
