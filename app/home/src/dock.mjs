// Decorate only full HTML documents. App APIs, React Server Components, assets,
// and downloads must retain their exact response bytes and cache metadata.
const installed = Symbol('euler-dock-response');
const prefixLimit = 64 * 1024;
const invalidatedHeaders = new Set(['content-length', 'etag', 'content-md5', 'digest', 'content-digest', 'repr-digest']);

export function isDockDocumentRequest(request) {
  const headers = request.headers;
  const path = new URL(request.url, 'http://localhost').pathname;
  return request.method === 'GET' && !headers.range &&
    !headers.rsc && !headers['next-router-state-tree'] && !headers['next-router-prefetch'] &&
    !String(headers.accept || '').includes('text/x-component') &&
    (!headers['sec-fetch-dest'] || headers['sec-fetch-dest'] === 'document') &&
    !/^\/app\/[^/]+\/(?:api|_next)(?:\/|$)/.test(path);
}

function documentPrefix(text) {
  const structure = {};
  let position = 0;
  while (position < text.length) {
    const start = text.indexOf('<', position);
    if (start < 0) break;
    if (text.startsWith('<!--', start)) {
      const end = text.indexOf('-->', start + 4);
      if (end < 0) break;
      position = end + 3;
      continue;
    }
    // Quoted attributes can contain > and even apparent closing head tags.
    const tag = /^<(?:"[^"]*"|'[^']*'|[^'">])*>/.exec(text.slice(start))?.[0];
    if (!tag) break;
    position = start + tag.length;
    const name = /^<\/?([a-z][a-z0-9:-]*)\b/i.exec(tag)?.[1]?.toLowerCase();
    if (/^<!doctype\b/i.test(tag)) structure.doctype = position;
    if (name === 'html' && !tag.startsWith('</')) structure.htmlStart ??= position;
    if (name === 'head') {
      if (tag.startsWith('</')) { structure.headEnd = start; break; }
      structure.headStart ??= position;
    }
    if (name === 'body' && !tag.startsWith('</')) { structure.bodyStart = start; break; }
    if (name === 'link' && /\bhref\s*=\s*["']\/euler-dock\.css["']/i.test(tag)) structure.hasCss = true;
    if (name === 'link' && /\bhref\s*=\s*["']\/euler-dock-ui\.css["']/i.test(tag) && /\brel\s*=\s*["']preload["']/i.test(tag) && /\bas\s*=\s*["']style["']/i.test(tag)) structure.hasUiPreload = true;
    if (name === 'script' && /\bsrc\s*=\s*["']\/euler-dock\.js["']/i.test(tag)) structure.hasScript = true;
    if (name && /^(?:script|style|title|textarea|xmp|iframe|noembed|noframes)$/.test(name) && !tag.startsWith('</')) {
      const closing = new RegExp(`</${name}\\s*>`, 'ig');
      closing.lastIndex = position;
      const match = closing.exec(text);
      if (!match) break;
      position = match.index + match[0].length;
    }
  }
  return structure;
}

function decorate(prefix, structure) {
  const offset = structure.headEnd ?? structure.bodyStart ?? structure.headStart ?? structure.htmlStart ?? structure.doctype ?? 0;
  let markup = '';
  if (!structure.hasCss) markup += '<link rel="stylesheet" href="/euler-dock.css" data-euler-dock>';
  // Warm the shadow stylesheet without applying its rules to the app document.
  if (!structure.hasUiPreload) markup += '<link rel="preload" href="/euler-dock-ui.css" as="style" data-euler-dock>';
  if (!structure.hasScript) markup += '<script type="module" src="/euler-dock.js" blocking="render" data-euler-dock></script>';
  if (!markup) return prefix;
  return Buffer.concat([prefix.subarray(0, offset), Buffer.from(markup), prefix.subarray(offset)]);
}

// Hold at most a small document prefix until </head> (or <body>) arrives. Buffer
// slices preserve UTF-8 characters even when the upstream splits code points.
function prefixWriter() {
  let pending = Buffer.alloc(0);
  let complete = false;
  return (chunk, final = false) => {
    if (complete) return chunk.length ? [chunk] : [];
    const take = Math.min(prefixLimit - pending.length, chunk.length);
    pending = Buffer.concat([pending, chunk.subarray(0, take)]);
    const structure = documentPrefix(pending.toString('latin1'));
    if (!final && pending.length < prefixLimit && structure.headEnd === undefined && structure.bodyStart === undefined) return [];
    complete = true;
    const result = decorate(pending, structure);
    pending = Buffer.alloc(0);
    return take < chunk.length ? [result, chunk.subarray(take)] : [result];
  };
}

export function attachEulerDock(request, response) {
  if (response[installed] || !isDockDocumentRequest(request)) return;
  response[installed] = true;
  const original = { write: response.write, end: response.end, writeHead: response.writeHead };
  const transform = prefixWriter();
  let enabled;

  function select(status = response.statusCode, incoming) {
    if (enabled !== undefined) return;
    const entries = Array.isArray(incoming)
      ? Array.from({ length: incoming.length / 2 }, (_, index) => [incoming[index * 2], incoming[index * 2 + 1]])
      : Object.entries(incoming || {});
    const headers = new Map(Object.entries(response.getHeaders()).map(([name, value]) => [name.toLowerCase(), value]));
    for (const [name, value] of entries) headers.set(name.toLowerCase(), value);
    const type = String(headers.get('content-type') || '');
    const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(type)?.[1];
    enabled = status >= 200 && status !== 204 && status !== 205 && status !== 304 && status !== 206 &&
      /^text\/html(?:\s*;|\s*$)/i.test(type) && (!charset || /^(?:utf-?8|us-ascii)$/i.test(charset)) &&
      (!headers.get('content-encoding') || headers.get('content-encoding') === 'identity') &&
      !headers.has('content-range') && !/^attachment\b/i.test(String(headers.get('content-disposition') || ''));
    if (enabled) for (const header of invalidatedHeaders) response.removeHeader(header);
  }

  response.writeHead = function (status, statusMessage, headers) {
    const incoming = typeof statusMessage === 'string' ? headers : statusMessage;
    select(status, incoming);
    if (enabled) for (const header of invalidatedHeaders) response.removeHeader(header);
    let filtered = incoming;
    if (enabled && incoming) {
      if (Array.isArray(incoming)) {
        filtered = [];
        for (let index = 0; index < incoming.length; index += 2) {
          if (!invalidatedHeaders.has(incoming[index].toLowerCase())) filtered.push(incoming[index], incoming[index + 1]);
        }
      } else filtered = Object.fromEntries(Object.entries(incoming).filter(([name]) => !invalidatedHeaders.has(name.toLowerCase())));
    }
    return typeof statusMessage === 'string'
      ? original.writeHead.call(this, status, statusMessage, filtered)
      : original.writeHead.call(this, status, filtered);
  };

  response.write = function (chunk, encoding, callback) {
    if (typeof encoding === 'function') { callback = encoding; encoding = undefined; }
    select();
    if (!enabled) return original.write.call(this, chunk, encoding, callback);
    // Preserve ServerResponse's normal write() contract even while a small
    // prefix is held: headers are committed at the first body write.
    if (!this.headersSent) this.flushHeaders();
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk, encoding) : Buffer.from(chunk);
    const chunks = transform(bytes);
    if (!chunks.length) { if (callback) queueMicrotask(callback); return true; }
    let ready = true;
    for (let index = 0; index < chunks.length; index++) {
      if (!original.write.call(this, chunks[index], index === chunks.length - 1 ? callback : undefined)) ready = false;
    }
    return ready;
  };

  response.end = function (chunk, encoding, callback) {
    if (typeof chunk === 'function') { callback = chunk; chunk = undefined; }
    else if (typeof encoding === 'function') { callback = encoding; encoding = undefined; }
    select();
    if (!enabled) return original.end.call(this, chunk, encoding, callback);
    const bytes = chunk == null ? Buffer.alloc(0) : typeof chunk === 'string' ? Buffer.from(chunk, encoding) : Buffer.from(chunk);
    const chunks = transform(bytes, true);
    for (let index = 0; index < chunks.length - 1; index++) original.write.call(this, chunks[index]);
    return original.end.call(this, chunks.at(-1), callback);
  };
}
