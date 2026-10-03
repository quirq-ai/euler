import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { attachEulerDock } from '../src/dock.mjs';

const html = '<!doctype html><html><head><title>Innernet 🌿 café</title></head><body><h1>नमस्ते</h1></body></html>';
const css = '<link rel="stylesheet" href="/euler-dock.css" data-euler-dock>';
const preload = '<link rel="preload" href="/euler-dock-ui.css" as="style" data-euler-dock>';
const script = '<script type="module" src="/euler-dock.js" blocking="render" data-euler-dock></script>';
const markup = css + preload + script;
const decorated = html.replace('</head>', `${markup}</head>`);
const policy = "default-src 'self'; script-src 'self'; frame-ancestors 'none'";

async function fixture(t, handler) {
  const server = createServer((req, res) => {
    attachEulerDock(req, res);
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return (path = '/app/innernet/', { method = 'GET', headers = {}, onData } = {}) => new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port: server.address().port, path, method, headers, timeout: 4000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); onData?.(chunk); });
      res.on('error', reject);
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body, text: body.toString('utf8') });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Fixture response timed out')));
    req.end();
  });
}

test('dock injection handles split closing heads and multibyte Unicode without changing document bytes', async (t) => {
  const get = await fixture(t, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(html));
    res.setHeader('ETag', '"original"');
    res.setHeader('Content-Security-Policy', policy);
    const bytes = Buffer.from(html);
    for (const byte of bytes) res.write(Buffer.from([byte]));
    res.end();
  });
  const response = await get();
  assert.equal(response.text, decorated);
  assert.equal(response.headers['content-length'], undefined);
  assert.equal(response.headers.etag, undefined);
  assert.equal(response.headers['content-security-policy'], policy);
});

test('dock injection removes stale validators supplied through each writeHead signature', async (t) => {
  for (const array of [false, true]) {
    const get = await fixture(t, (req, res) => {
      const headers = { 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(html), ETag: '"original"', Digest: 'sha-256=original' };
      if (array) res.writeHead(200, 'OK', Object.entries(headers).flat());
      else res.writeHead(200, headers);
      res.end(html);
    });
    const response = await get();
    assert.equal(response.text, decorated);
    for (const name of ['content-length', 'etag', 'digest']) assert.equal(response.headers[name], undefined);
  }
});

test('HTML-looking text in scripts, styles, comments and attributes cannot split app markup', async (t) => {
  const content = '<!doctype html><html><head><!-- </head> --><meta name="x" content="</head>"><script>globalThis.template="</head><body>";</script><style>body:after{content:"</head>"}</style></head><body>App</body></html>';
  const get = await fixture(t, (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    for (const byte of Buffer.from(content)) res.write(Buffer.from([byte]));
    res.end();
  });
  assert.equal((await get()).text, content.replace('</style></head>', `</style>${markup}</head>`));
});

test('dock injection preserves write/end callbacks, flushHeaders and streams before document completion', async (t) => {
  let release;
  let firstWrite;
  let completed = false;
  const released = new Promise((resolve) => { release = resolve; });
  const get = await fixture(t, async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.flushHeaders();
    res.write('<!doctype html><html><head></head><body>', () => { firstWrite = true; });
    await released;
    res.end('streamed content</body></html>', () => { completed = true; });
  });
  const response = await get('/app/innernet/', { onData(chunk) { assert.ok(chunk.length); release(); } });
  assert.equal(firstWrite, true);
  assert.equal(completed, true);
  assert.match(response.text, /euler-dock\.js/);
  assert.match(response.text, /streamed content/);
});

test('a buffered document write still commits headers before an upstream error can replace them', async (t) => {
  let committed;
  const get = await fixture(t, (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.write('<!doctype html><html><head>');
    committed = res.headersSent;
    res.end('</head><body>App</body></html>');
  });
  const response = await get();
  assert.equal(committed, true);
  assert.match(response.text, /euler-dock\.js/);
});

test('bounded prefix streaming handles documents with huge heads before upstream ends', async (t) => {
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  const prefix = '<!doctype html><html><head>' + ' '.repeat(96 * 1024);
  const get = await fixture(t, async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.write(prefix);
    await released;
    res.end('</head><body>Done</body></html>');
  });
  const response = await get('/app/innernet/', { onData() { release(); } });
  assert.ok(response.text.startsWith('<!doctype html><html><head>' + markup));
  assert.equal(response.text.replace(markup, ''), prefix + '</head><body>Done</body></html>');
});

test('dock injection works for headless static documents and never duplicates its assets or wrapper', async (t) => {
  for (const content of [decorated, '<!doctype html><html><body>Static page</body></html>', '<h1>Small document</h1>']) {
    const get = await fixture(t, (req, res) => {
      attachEulerDock(req, res);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    const response = await get();
    assert.equal(response.text.split('/euler-dock.js').length, 2);
    assert.equal(response.text.split('/euler-dock.css').length, 2);
    assert.equal(response.text.split('/euler-dock-ui.css').length, 2);
    if (content === decorated) assert.equal(response.text, decorated);
    else assert.equal(response.text.replace(markup, ''), content);
  }
});

test('the shadow stylesheet is preloaded without applying global rules or duplicating existing preload links', async (t) => {
  for (const existing of ['', '<link as="style" href="/euler-dock-ui.css" rel="preload">']) {
    const get = await fixture(t, (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(html.replace('</head>', `${existing}</head>`));
    });
    const response = await get();
    assert.equal(response.text.split('/euler-dock-ui.css').length, 2);
    const link = response.text.match(/<link\b[^>]*href="\/euler-dock-ui\.css"[^>]*>/)?.[0];
    assert.match(link, /rel="preload"/);
    assert.match(link, /as="style"/);
    assert.doesNotMatch(link, /rel="stylesheet"/);
  }
});

test('HEAD and non-document requests keep original content length, validators and payload', async (t) => {
  const get = await fixture(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(html), ETag: '"original"' });
    res.end(html);
  });
  const cases = [
    ['/app/innernet/', { method: 'HEAD' }], ['/app/innernet/', { method: 'POST' }],
    ['/app/innernet/', { headers: { rsc: '1' } }],
    ['/app/innernet/', { headers: { accept: 'text/x-component' } }],
    ['/app/innernet/', { headers: { 'next-router-prefetch': '1' } }],
    ['/app/innernet/', { headers: { 'next-router-state-tree': '[]' } }],
    ['/app/innernet/', { headers: { 'sec-fetch-dest': 'empty' } }],
    ['/app/innernet/', { headers: { range: 'bytes=0-10' } }],
    ['/app/innernet/api/export', {}], ['/app/innernet/_next/static/asset.html', {}],
  ];
  for (const [path, options] of cases) {
    const response = await get(path, options);
    assert.equal(response.text, options.method === 'HEAD' ? '' : html, JSON.stringify([path, options]));
    assert.equal(Number(response.headers['content-length']), Buffer.byteLength(html));
    assert.equal(response.headers.etag, '"original"');
  }
});

test('non-HTML, compressed HTML, attachments, partial responses and UTF-16 retain exact bytes', async (t) => {
  for (const [type, body, headers, status] of [
    ['application/octet-stream', Buffer.from([0, 255, 128, 17]), {}, 200],
    ['text/x-component', Buffer.from('0:{"children":"</head>"}'), {}, 200],
    ['application/json', Buffer.from('{"text":"</head>"}'), {}, 200],
    ['text/html', gzipSync(html), { 'Content-Encoding': 'gzip' }, 200],
    ['text/html', Buffer.from(html), { 'Content-Disposition': 'attachment; filename=export.html' }, 200],
    ['text/html', Buffer.from(html), { 'Content-Range': `bytes 0-${Buffer.byteLength(html) - 1}/${Buffer.byteLength(html)}` }, 206],
    ['text/html; charset=utf-16le', Buffer.from(html, 'utf16le'), {}, 200],
  ]) {
    const get = await fixture(t, (req, res) => {
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': body.length, ETag: '"original"', ...headers });
      res.end(body);
    });
    const response = await get();
    assert.deepEqual(response.body, body, type);
    assert.equal(Number(response.headers['content-length']), body.length);
    assert.equal(response.headers.etag, '"original"');
  }
});
