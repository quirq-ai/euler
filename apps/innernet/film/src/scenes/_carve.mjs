// Build-time helpers for plate scenes (w1: 04, 05). They read an inlined plate's own
// geometry so a scene can pick out parts of it (a row, a strike, a seal) without
// hard-coding pixel positions: when a plate is redrawn, a rebuild follows it.
//
//   const p = parsePlate(ctx.plate("anatomy"));
//   p.layers["L-acc"].items  -> [{ tag, open, src, pts, box: {x0,y0,x1,y1,cx,cy,w,h}, text }]
//   emit(p)                  -> the svg string again (after moving or tagging items)

const SHAPE = /^(path|line|circle|ellipse|rect|polyline|polygon|text|g)$/;

/** Numbers and commands of a path's d. */
function pathPoints(d) {
  const toks = d.match(/[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
  const N = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
  const pts = [];
  let i = 0, cmd = "M", x = 0, y = 0, sx = 0, sy = 0;
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const lc = cmd.toLowerCase(), rel = cmd !== cmd.toUpperCase(), n = N[lc];
    if (n === undefined) break;
    if (lc === "z") { x = sx; y = sy; pts.push([x, y]); cmd = rel ? "l" : "L"; continue; }
    const a = toks.slice(i, i + n).map(Number);
    if (a.length < n || a.some(Number.isNaN)) break;
    i += n;
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (lc === "h") x = ox + a[0];
    else if (lc === "v") y = oy + a[0];
    else if (lc === "a") { x = ox + a[5]; y = oy + a[6]; }
    else {
      for (let j = 0; j < n - 2; j += 2) pts.push([ox + a[j], oy + a[j + 1]]);
      x = ox + a[n - 2]; y = oy + a[n - 1];
    }
    pts.push([x, y]);
    if (lc === "m") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
  }
  return pts;
}

const attr = (s, name) => {
  const m = s.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const num = (s, name, d = 0) => {
  const v = attr(s, name);
  return v === null ? d : Number(v);
};

function bbox(pts) {
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Approximate outline points of one element (open tag + body). */
function geom(tag, open, body) {
  switch (tag) {
    case "path": return pathPoints(attr(open, "d") || "");
    case "line": return [[num(open, "x1"), num(open, "y1")], [num(open, "x2"), num(open, "y2")]];
    case "circle": { const cx = num(open, "cx"), cy = num(open, "cy"), r = num(open, "r"); return [[cx - r, cy - r], [cx + r, cy + r]]; }
    case "ellipse": { const cx = num(open, "cx"), cy = num(open, "cy"), rx = num(open, "rx"), ry = num(open, "ry"); return [[cx - rx, cy - ry], [cx + rx, cy + ry]]; }
    case "rect": { const x = num(open, "x"), y = num(open, "y"); return [[x, y], [x + num(open, "width"), y + num(open, "height")]]; }
    case "polyline": case "polygon": {
      const n = (attr(open, "points") || "").match(/[+-]?(?:\d+\.?\d*|\.\d+)/g) || [];
      const p = [];
      for (let i = 0; i + 1 < n.length; i += 2) p.push([+n[i], +n[i + 1]]);
      return p;
    }
    case "text": {
      const t = textOf(body), fs = num(open, "font-size", 20), ls = num(open, "letter-spacing", 0);
      const mono = /mono/.test(attr(open, "class") || "") || /Mono/.test(attr(open, "font-family") || "");
      const w = t.length * (mono ? 0.6 * fs + ls : 0.46 * fs + ls);
      const anchor = attr(open, "text-anchor") || "start";
      const x = num(open, "x"), y = num(open, "y");
      const xs = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
      return [[xs, y - 0.74 * fs], [xs + w, y + 0.22 * fs]];
    }
    default: return [];
  }
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export const textOf = (body) => decode(String(body || "").replace(/<[^>]+>/g, "")).trim();

/** Split a run of sibling elements (depth 0 of `s`) into items. */
function children(s) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let depth = 0, start = -1, tag = null, open = "", m;
  while ((m = re.exec(s))) {
    const [all, close, name, , self] = m;
    if (!close && depth === 0) { start = m.index; tag = name; open = all; }
    if (!close && !self) depth++;
    if (close) depth--;
    if (depth === 0 && start >= 0 && (self || close)) {
      const src = s.slice(start, m.index + all.length);
      const body = self ? "" : src.slice(open.length, src.length - `</${tag}>`.length);
      out.push(makeItem(tag, open, body, src));
      start = -1;
    }
  }
  return out;
}

function makeItem(tag, open, body, src) {
  let pts = [];
  if (tag === "g") {
    // a nested group: union of its children, through a matrix() or translate() if present
    const kids = children(body);
    const tf = attr(open, "transform") || "";
    let M = [1, 0, 0, 1, 0, 0];
    const mm = tf.match(/matrix\(([^)]*)\)/), tm = tf.match(/translate\(([^)]*)\)/);
    if (mm) M = mm[1].split(/[\s,]+/).filter(Boolean).map(Number);
    else if (tm) { const t = tm[1].split(/[\s,]+/).filter(Boolean).map(Number); M = [1, 0, 0, 1, t[0] || 0, t[1] || 0]; }
    for (const k of kids) if (k.box) for (const [x, y] of [[k.box.x0, k.box.y0], [k.box.x1, k.box.y1], [k.box.x0, k.box.y1], [k.box.x1, k.box.y0]]) pts.push([M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]);
    return { tag, open, body, src, box: bbox(pts), text: kids.map((k) => k.text).filter(Boolean).join(" "), nested: true };
  }
  if (SHAPE.test(tag)) pts = geom(tag, open, body);
  return { tag, open, body, src, pts, box: bbox(pts), text: tag === "text" ? textOf(body) : "" };
}

/** Parse an inlined plate (the string ctx.plate returns). */
export function parsePlate(svg) {
  const head = svg.match(/^[\s\S]*?<svg\b[^>]*>/)[0];
  const tail = svg.slice(svg.lastIndexOf("</svg>"));
  const inner = svg.slice(head.length, svg.lastIndexOf("</svg>"));
  const layers = {}, order = [];
  for (const it of children(inner)) {
    const cls = it.tag === "g" ? (attr(it.open, "class") || "").split(/\s+/).find((c) => /^L-/.test(c)) : null;
    if (!cls) { order.push({ raw: it.src }); continue; }
    layers[cls] = { cls, open: it.open, items: children(it.body) };
    order.push({ layer: cls });
  }
  return { head, tail, layers, order };
}

/** All items across layers, each tagged with its layer name. */
export const allItems = (p) => Object.values(p.layers).flatMap((L) => L.items.map((it) => Object.assign(it, { layer: L.cls })));

/** Add classes to an item's open tag. */
export function tag(it, cls) {
  if (/\sclass="/.test(it.open)) it.src = it.src.replace(/\sclass="([^"]*)"/, (m, c) => ` class="${c} ${cls}"`);
  else it.src = it.src.replace(/^<([\w:-]+)/, `<$1 class="${cls}"`);
  return it;
}

/** Remove items from their layers (returns them). */
export function take(p, pred) {
  const out = [];
  for (const L of Object.values(p.layers)) {
    L.items = L.items.filter((it) => {
      if (pred(it, L.cls)) { out.push(Object.assign(it, { layer: L.cls })); return false; }
      return true;
    });
  }
  return out;
}

/** Wrap items in groups that keep their layer's stroke settings and colour (class xL-*). */
export function wrap(p, items, cls = "") {
  const by = {};
  for (const it of items) (by[it.layer] ??= []).push(it);
  return Object.entries(by).map(([layer, its]) => {
    const open = p.layers[layer]?.open ?? `<g>`;
    const attrs = open.replace(/^<g\b/, "").replace(/>$/, "").replace(/\sclass="[^"]*"/, "");
    return `<g class="x${layer} ${cls}"${attrs}>${its.map((i) => i.src).join("")}</g>`;
  }).join("");
}

/** Re-emit the svg: layers in their order, then `extra` markup on top. */
export function emit(p, extra = "", headCls = "") {
  const head = headCls ? p.head.replace(/class="([^"]*)"/, (m, c) => `class="${c} ${headCls}"`) : p.head;
  const body = p.order.map((o) => (o.raw ? o.raw : `${p.layers[o.layer].open}${p.layers[o.layer].items.map((i) => i.src).join("")}</g>`)).join("\n");
  return `${head}\n${body}\n${extra}\n${p.tail}`;
}

/** A copy of the parsed plate with every layer emptied (same layer groups and order). */
export function blank(p) {
  const layers = {};
  for (const [k, L] of Object.entries(p.layers)) layers[k] = { ...L, items: [] };
  return { head: p.head, tail: p.tail, layers, order: p.order.filter((o) => o.layer) };
}

/** CSS that colours extracted groups like the layer they came from. */
export const XL_CSS = (sid) => `
#${sid} .xL-con { color: var(--con); }
#${sid} .xL-main { color: var(--ink); }
#${sid} .xL-det { color: var(--ink2); }
#${sid} .xL-acc { color: var(--link); }
#${sid} .xL-lbl { color: var(--ink2); }
`;

/** Split a path into one element per subpath (absolute M only). Chrome restarts the dash
 *  pattern for every subpath, so an arrowhead kept in its shaft's path draws at once;
 *  split, it can follow the shaft. Returns [item] when there is nothing to split. */
export function splitPath(it) {
  const d = (it.open.match(/\sd="([^"]*)"/) || [])[1];
  if (it.tag !== "path" || !d || /m/.test(d.slice(1))) return [it];
  const parts = d.split(/(?=M)/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return [it];
  return parts.map((pd) => {
    const open = it.open.replace(/\sd="[^"]*"/, ` d="${pd}"`);
    const pts = pathPoints(pd);
    return { ...it, open, src: open, pts, box: bbox(pts) };
  });
}

/** Drop the plate's own corner registration marks (small marks near its four corners):
 *  the film frame draws its own, and the plate's would sit under the HUD. */
export const dropCorners = (p, W = 1600, H = 1000, r = 80) =>
  take(p, (it) => it.box && it.box.w < 60 && it.box.h < 60 && [0, W].some((x) => Math.abs(it.box.cx - x) < r) && [0, H].some((y) => Math.abs(it.box.cy - y) < r));

/** Plate units to wrapper pixels. */
export const fit = (s, ox, oy) => ({ s, ox, oy, X: (x) => +(ox + x * s).toFixed(1), Y: (y) => +(oy + y * s).toFixed(1) });
