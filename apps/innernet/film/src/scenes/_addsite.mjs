// Shared, build-time only: the add-site journey (frames 12 to 15). One long clip (s12x,
// written by scene 12) holds the add-site plate under a camera; scenes 12 to 15 each own
// the overlays of their station and ride the same camera (every `.cam12` wrapper gets the
// same transform, driven from scene 12's motion).
//
// The plate is split here by geometry, not by pixel positions: every element is assigned
// to the path, to one of the five stations, to the key (what it reads) or to the end (the
// lock), from its bounding box relative to the station numerals. So each station can draw
// itself on when the camera arrives, and overlays can be anchored to what the plate drew,
// even while the plate is still being refined.

const PLATE = "add-site";
let memo = null;

// ------------------------------------------------------------------ sigils (as the app)
// Same math as ../components/sigil.tsx: the slug hashed (FNV-1a) into three hues.
function fnv(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function sigilHues(seed) {
  const h = fnv(seed);
  const a = h % 360;
  const b = (a + 35 + ((h >>> 9) % 90)) % 360;
  const c = (a + 180 + ((h >>> 17) % 60) - 30) % 360;
  return [a, b, c];
}
export function sigilGradient(seed, muted = false) {
  const [a, b, c] = sigilHues(seed);
  const ch = muted ? 0.035 : 0.14;
  const x1 = 18 + (fnv(seed + "x") % 30);
  const y1 = 14 + (fnv(seed + "y") % 30);
  return [
    `radial-gradient(circle at ${x1}% ${y1}%, oklch(0.88 ${ch} ${a}) 0%, transparent 58%)`,
    `radial-gradient(circle at ${100 - x1}% ${100 - y1 / 2}%, oklch(0.74 ${+(ch * 1.1).toFixed(4)} ${b}) 0%, transparent 62%)`,
    `linear-gradient(135deg, oklch(0.68 ${ch} ${c}), oklch(0.58 ${+(ch * 0.9).toFixed(4)} ${b}))`,
  ].join(", ");
}

// ------------------------------------------------------------------ parsing
const attr = (a, n) => {
  const m = a.match(new RegExp(`\\s${n}="([^"]*)"`));
  return m ? m[1] : null;
};
const num = (a, n, d = 0) => {
  const v = attr(a, n);
  return v === null ? d : +v;
};
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

function bbox(tag, a, text) {
  if (tag === "line") {
    const x1 = num(a, "x1"), y1 = num(a, "y1"), x2 = num(a, "x2"), y2 = num(a, "y2");
    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  }
  if (tag === "rect") {
    const x = num(a, "x"), y = num(a, "y");
    return [x, y, x + num(a, "width"), y + num(a, "height")];
  }
  if (tag === "circle") {
    const cx = num(a, "cx"), cy = num(a, "cy"), r = num(a, "r");
    return [cx - r, cy - r, cx + r, cy + r];
  }
  if (tag === "ellipse") {
    const cx = num(a, "cx"), cy = num(a, "cy"), rx = num(a, "rx"), ry = num(a, "ry");
    return [cx - rx, cy - ry, cx + rx, cy + ry];
  }
  if (tag === "text") {
    const x = num(a, "x"), y = num(a, "y"), size = num(a, "font-size", 16), ls = num(a, "letter-spacing", 0);
    const cls = attr(a, "class") ?? "";
    const per = /mono/.test(cls) ? size * 0.6 + ls : /display/.test(cls) ? size * 0.42 : size * 0.46;
    const w = text.length * per;
    const anchor = attr(a, "text-anchor") ?? "start";
    const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    return [x0, y - size * 0.72, x0 + w, y + size * 0.22];
  }
  let src = tag === "path" ? attr(a, "d") ?? "" : attr(a, "points") ?? "";
  src = src.replace(/A\s*[-\d.]+[ ,]+[-\d.]+\s+[-\d.]+\s+[01][ ,]*[01][ ,]+/g, "A ");
  const xs = [], ys = [];
  for (const m of src.matchAll(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g)) {
    xs.push(+m[1]);
    ys.push(+m[2]);
  }
  if (!xs.length) return [0, 0, 0, 0];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const inside = (b, r, pad = 0) => b[0] >= r[0] - pad && b[1] >= r[1] - pad && b[2] <= r[2] + pad && b[3] <= r[3] + pad;
const union = (bs) => bs.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])], [Infinity, Infinity, -Infinity, -Infinity]);
const r1 = (v) => Math.round(v * 10) / 10;

// ------------------------------------------------------------------ the split
/**
 * Returns { svg, A, cams }:
 *  svg  the plate regrouped: `.pg-<group>` groups (each a `.plate-svg` scope that
 *       k.drawPlate can draw on its own), `.acc-<group>` accent groups (drawn by the
 *       scenes on their words, items tagged data-role), and special parts (snip, chips,
 *       chiparr, bars) the scenes hand over to or animate.
 *  A    anchors in plate units (station x, path y, boxes the overlays sit on).
 *  cams camera framings {x, y, scale} for the overview and the five stations.
 */
export function journey(ctx) {
  if (memo) return memo;
  const raw = ctx.plate(PLATE, "as-plate");
  const open = raw.match(/^<svg\b[^>]*>/)[0].replace("<svg", "<svg data-layout-ignore");
  const body = raw.slice(open.length, raw.lastIndexOf("</svg>"));
  const layers = {};
  const items = [];
  for (const g of body.matchAll(/<g class="(L-[a-z]+)"([^>]*)>([\s\S]*?)<\/g>/g)) {
    const L = g[1];
    layers[L] = g[2];
    for (const m of g[3].matchAll(/<(path|line|circle|ellipse|rect|polyline|polygon)\b([^>]*?)\/>|<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const tag = m[1] ?? "text";
      const a = m[2] ?? m[3];
      const text = m[4] !== undefined ? unesc(m[4]) : null;
      const b = bbox(tag, a, text ?? "");
      items.push({ L, tag, a, text, html: m[0], b, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, g: null, role: null });
    }
  }
  const T = (re, list = items) => list.filter((i) => i.text !== null && re.test(i.text));

  // stations: the numerals 1 to 5 on the path
  const nums = items.filter((i) => i.text !== null && /^[1-5]$/.test(i.text) && num(i.a, "font-size") >= 28).sort((p, q) => +p.text - +q.text);
  const SX = nums.length === 5 ? nums.map((n) => num(n.a, "x")) : [375, 610, 850, 1095, 1340];
  const PY = nums.length === 5 ? Math.round(nums.reduce((s, n) => s + num(n.a, "y"), 0) / 5 - 11) : 510;
  const near = (x, cands) => cands.reduce((best, c) => (Math.abs(c[0] - x) < Math.abs(best[0] - x) ? c : best));

  for (const i of items) {
    const h = i.b[3] - i.b[1];
    if (i.text !== null && i.cy > PY + 20 && i.cx > SX[4] + 40) i.g = "end"; // the address at the end of the line
    else if (i.text !== null ?i.cy > PY - 125 && i.cy < PY + 125 : Math.abs(i.cy - PY) <= 60 && h < 160) i.g = "path";
    else if (i.cy < PY) i.g = near(i.cx, [[SX[0], "st1"], [SX[2], "st3"], [SX[4], "st5"]])[1];
    else if (i.cx < SX[1] - 300) i.g = "key";
    else if (i.cx > SX[4] + 40) i.g = "end";
    else i.g = near(i.cx, [[SX[1], "st2"], [SX[3], "st4"]])[1];
  }
  // the plate's corner registers belong to the printed page, not to the journey
  for (const i of items) if ([[40, 40], [1560, 40], [40, 960], [1560, 960]].some(([x, y]) => Math.abs(i.cx - x) < 20 && Math.abs(i.cy - y) < 20 && i.b[2] - i.b[0] < 40)) i.g = "x";
  const G = (g, L) => items.filter((i) => i.g === g && (!L || i.L === L));
  const A = { SX, PY };

  // ---- station 1: the folder and its crop marks
  {
    const crops = G("st1", "L-acc").filter((i) => i.tag === "path" && i.b[2] - i.b[0] < 40 && i.b[3] - i.b[1] < 40);
    const lab = T(/\/$/, G("st1"))[0];
    A.crops = crops.length ? union(crops.map((c) => c.b)) : [251, 176, 499, 360];
    A.folderLabel = lab ? { x: num(lab.a, "x"), y: num(lab.a, "y"), size: num(lab.a, "font-size") } : { x: 375, y: 318, size: 26 };
    A.st1 = union(G("st1").filter((i) => i.b[0] > 46 || i.b[1] > 46).map((i) => i.b));
  }

  // ---- station 2: README, IN SEARCH (the schematic card is handed over to the real one)
  {
    const ins = T(/^IN SEARCH$/, G("st2"))[0];
    const rd = T(/^README\.md$/, G("st2"))[0];
    A.insearch = ins ? { x: num(ins.a, "x"), y: num(ins.a, "y") } : { x: 660, y: 698 };
    const card = G("st2", "L-main").filter((i) => i.tag === "rect" && Math.abs(i.b[0] - A.insearch.x) < 14 && i.b[1] > A.insearch.y).sort((p, q) => p.b[1] - q.b[1])[0];
    A.snip = card ? card.b : [660, 712, 846, 864];
    const zone = [A.snip[0] - 3, A.snip[1] - 3, A.snip[2] + 14, A.snip[3] + 14];
    for (const i of G("st2")) if (inside(i.b, zone)) i.g = "snip";
    A.readme = rd ? { x: num(rd.a, "x"), y: num(rd.a, "y") } : { x: 350, y: 656 };
    const page = G("st2").filter((i) => i.text === null && i.b[0] >= A.readme.x - 30 && i.b[2] < A.snip[0] - 20);
    A.page = union(page.map((i) => i.b));
    for (const i of G("st2", "L-acc")) i.role = i.tag === "line" && i.b[2] < A.snip[0] - 20 ? "para" : "leader";
    const st2 = items.filter((i) => i.g === "st2" || i.g === "snip");
    A.st2 = union(st2.map((i) => i.b));
  }

  // ---- key: what it reads, what it never reads
  {
    const k = G("key");
    const pick = (re) => {
      const t = T(re, k)[0];
      return t ? { x: num(t.a, "x"), y: num(t.a, "y"), w: t.b[2] - t.b[0] } : null;
    };
    A.key = { reads: pick(/^(IT )?READS?$/), readme: pick(/^README\.md$/), never: pick(/^NEVER\b/), env: pick(/^\.env$/), keys: pick(/^keys$/), src: pick(/^source code$/) };
    A.keyBox = k.length ? union(k.filter((i) => i.b[1] > PY + 100).map((i) => i.b)) : [52, 650, 288, 940];
  }

  // ---- station 3: package.json, the "next" box, the arrows, the chips
  {
    const s3 = G("st3");
    const code = s3.filter((i) => i.L === "L-main" && i.tag === "rect").sort((p, q) => (q.b[2] - q.b[0]) * (q.b[3] - q.b[1]) - (p.b[2] - p.b[0]) * (p.b[3] - p.b[1]))[0];
    A.code = code ? code.b : [598, 92, 898, 364];
    const pills = s3.filter((i) => i.tag === "rect" && num(i.a, "rx") >= 12 && i.b[0] > A.code[2]);
    const names = T(/^(Next\.js|React|Tailwind CSS)$/, s3);
    A.chips = pills.map((p) => {
      const t = names.find((n) => inside([n.cx, n.cy, n.cx, n.cy], p.b, 2));
      return { x: p.b[0], y: p.b[1], w: p.b[2] - p.b[0], h: p.b[3] - p.b[1], name: t ? t.text : "", acc: p.L === "L-acc" };
    }).sort((p, q) => p.y - q.y);
    for (const i of [...pills, ...names]) i.g = "chips";
    const cx0 = pills.length ? Math.min(...pills.map((p) => p.b[0])) : A.code[2] + 50;
    for (const i of G("st3")) if (i.text === null && i.b[0] >= A.code[2] + 9 && i.b[2] <= cx0 + 2) i.g = "chiparr";
    for (const i of G("st3", "L-acc")) i.role = "next";
    const fw = T(/^FRAMEWORKS$/, items)[0];
    A.frameworks = fw ? { x: num(fw.a, "x"), y: num(fw.a, "y") } : { x: 948, y: 130 };
    A.st3 = union(items.filter((i) => ["st3", "chips", "chiparr"].includes(i.g)).map((i) => i.b));
  }

  // ---- station 4: git; the bars rise on "history"
  {
    const s4 = G("st4");
    const rects = s4.filter((i) => i.tag === "rect" && (i.L === "L-main" || i.L === "L-acc") && i.b[3] - i.b[1] > 4);
    const base = rects.length ? Math.max(...rects.map((r) => r.b[3])) : 905;
    const bars = rects.filter((r) => Math.abs(r.b[3] - base) < 3).sort((p, q) => p.b[0] - q.b[0]);
    A.bars = bars.map((b) => {
      b.g = "bars";
      const hatch = s4.filter((i) => i.L === "L-det" && i.tag === "path" && i.g === "st4" && inside(i.b, b.b, 2));
      hatch.forEach((h) => (h.g = "bars"));
      return { el: b, hatch, ox: r1((b.b[0] + b.b[2]) / 2), oy: r1(base), peak: b.L === "L-acc" };
    });
    for (const i of G("st4", "L-acc")) i.role = "peak";
    A.base = base;
    A.st4 = union(items.filter((i) => i.g === "st4" || i.g === "bars").map((i) => i.b));
  }

  // ---- station 5: the terminal (its text is typed by scene 15) and the article
  {
    const s5 = G("st5");
    const boxes = s5.filter((i) => i.L === "L-main" && i.tag === "rect" && i.b[2] - i.b[0] > 250).sort((p, q) => p.b[1] - q.b[1]);
    A.term = boxes[0] ? boxes[0].b : [1124, 62, 1546, 214];
    A.article = boxes[1] ? boxes[1].b : [1124, 250, 1546, 382];
    for (const i of s5) i.g = i.cy >= A.article[1] - 6 ? "st5a" : "st5t";
    const t5 = G("st5t");
    const cmd = T(/^\$\s*pnpm index/, t5)[0], out = T(/^indexed\b/, t5)[0], pr = T(/^\$$/, t5)[0];
    const about = T(/^ABOUT /, t5)[0];
    A.cmd = cmd ? { x: num(cmd.a, "x"), y: num(cmd.a, "y"), size: num(cmd.a, "font-size") } : { x: A.term[0] + 18, y: A.term[1] + 66, size: 22 };
    A.out = out ? { x: num(out.a, "x"), y: num(out.a, "y"), size: num(out.a, "font-size") } : { x: A.cmd.x, y: A.cmd.y + 34, size: 16 };
    A.about = about ? about.b : null;
    for (const i of [cmd, out, pr]) if (i) i.g = "x";
    for (const i of G("st5t", "L-acc")) i.g = "x"; // the plate's underline and arrow: scene 15 draws its own under its own text
    if (pr) {
      const px = num(pr.a, "x"), py = num(pr.a, "y");
      for (const i of G("st5t", "L-det")) if (inside(i.b, [px + 6, py - 26, px + 46, py + 10])) i.g = "x";
    }
    const bar = G("st5t", "L-det").filter((i) => i.tag === "line" && i.b[3] - i.b[1] < 1 && i.b[2] - i.b[0] > (A.term[2] - A.term[0]) * 0.9)[0];
    A.titleY = bar ? bar.b[1] : A.term[1] + 28;
    const ring = G("st5a", "L-acc").filter((i) => i.tag === "circle")[0];
    A.sigil = ring ? { cx: num(ring.a, "cx"), cy: num(ring.a, "cy"), r: num(ring.a, "r") } : { cx: 1484, cy: 298, r: 30 };
    for (const i of G("st5a", "L-acc")) i.role = "ring";
    A.st5 = union(items.filter((i) => i.g === "st5t" || i.g === "st5a").map((i) => i.b));
  }

  // ---- the end: localhost, the lock
  A.end = union(G("end").map((i) => i.b));
  const endLab = T(/on this machine/, items)[0];
  A.machine = endLab ? endLab.b : null;

  // ------------------------------------------------------------------ emit
  const LAYERS = ["L-con", "L-main", "L-det", "L-acc", "L-lbl"];
  const tagged = (i) => (i.role ? i.html.replace(/^<(\w+)/, `<$1 data-role="${i.role}" data-x="${r1(i.cx)}" data-y="${r1(i.cy)}"`) : i.html);
  const layered = (list, keepAcc) => LAYERS.filter((L) => keepAcc || L !== "L-acc").map((L) => {
    const els = list.filter((i) => i.L === L);
    return els.length ? `<g class="${L}"${layers[L] ?? ""}>${els.map(tagged).join("")}</g>` : "";
  }).join("");
  const order = ["path", "st1", "key", "end", "st2", "st3", "st4", "st5t", "st5a"];
  let out = open;
  for (const g of order) {
    const list = G(g);
    const keepAcc = g === "path" || g === "st1" || g === "key" || g === "end";
    out += `<g class="plate-svg pg pg-${g}">${layered(list, keepAcc)}</g>`;
  }
  for (const g of ["st2", "st3", "st4", "st5a"]) {
    const list = G(g, "L-acc");
    if (list.length) out += `<g class="L-acc acc acc-${g}"${layers["L-acc"] ?? ""}>${list.map(tagged).join("")}</g>`;
  }
  out += `<g class="sp sp-snip">${layered(G("snip"), true)}</g>`;
  out += `<g class="sp sp-chiparr">${layered(G("chiparr"), true)}</g>`;
  out += `<g class="sp sp-chips">${layered(G("chips"), true)}</g>`;
  out += `<g class="sp sp-bars">${A.bars.map((b) => `<g class="bar${b.peak ? " peak" : ""}" data-ox="${b.ox}" data-oy="${b.oy}">${layered([b.el, ...b.hatch], true)}</g>`).join("")}</g>`;
  out += "</svg>";
  for (const b of A.bars) delete b.el, delete b.hatch;

  // ------------------------------------------------------------------ camera
  // The plate is seen through a window: fully visible over y 240..846 (feathered above to
  // 185 and below to 870, so nothing of the plate reaches the FIG line, the HUD or the
  // captions), x 112..1808. Framings are { x, y, scale } plus the world point (cx, cy)
  // that sits at screen (960, 532), so the motion can drift a framing about its centre.
  const FX = 960, FY = 532, WW = 1640, TOP = 244;
  const pack = (s, cx, cy) => ({ x: r1(FX - s * cx), y: r1(FY - s * cy), scale: +s.toFixed(4), cx: r1(cx), cy: r1(cy) });
  const frame = (b, cap) => {
    const s = Math.min(cap, WW / (b[2] - b[0]), (842 - TOP) / (b[3] - b[1]));
    return pack(s, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  };
  // above the path: world y `pinW` lands on screen y `pinS`; content from world y `top`
  const above = (x0, x1, top, pinW, pinS, cap) => {
    const s = Math.min(cap, WW / (x1 - x0), (pinS - TOP) / (pinW - top));
    return pack(s, (x0 + x1) / 2, pinW - (pinS - FY) / s);
  };
  // below the path: the path is a horizon at the top of the window, its upper labels masked
  const HORIZON = 250;
  const below = (x0, x1, bottom, cap) => {
    const s = Math.min(cap, WW / (x1 - x0), (846 - HORIZON) / (bottom - PY));
    return pack(s, (x0 + x1) / 2, PY + (FY - HORIZON) / s);
  };
  const lbl = PY - 54; // the bottom of the upper station labels
  const snipW = 640;
  A.snipMount = { x: A.snip[0] + 2, y: A.insearch.y + 26, w: snipW };
  const cams = {
    ov: frame([36, 50, 1564, 872], 0.9),
    s1: above(Math.min(A.st1[0], 40) - 6, A.crops[2] + 70, A.st1[1] - 8, PY, 815, 1.42),
    s2: below(A.keyBox[0] - 14, A.snipMount.x + snipW + 22, Math.max(A.page[3], A.snipMount.y + 200) + 14, 1.3),
    s3: above(A.code[0] - 14, Math.max(A.st3[2], ...A.chips.map((c) => c.x + c.w)) + 24, A.code[1] - 34, lbl, 846, 1.46),
    s4: below(A.st4[0] - 30, Math.max(A.st4[2], A.end[2]) + 24, A.st4[3] + 8, 1.46),
    // station 5 in three beats: the terminal close, then the output and the article, then
    // a settle on the whole station, command to article, so the chapter ends on one
    // readable picture (the sigil has just bloomed in it)
    s5: pack(2.0, (A.term[0] + A.term[2]) / 2 + 4, (A.term[1] + A.term[3]) / 2 + 4),
    s5b: frame([A.term[0] - 20, A.out.y - 26, A.term[2] + 28, A.article[3] + 26], 1.9),
    s5c: frame([A.term[0] - 20, A.term[1] - 8, A.term[2] + 28, A.article[3] + 18], 1.9),
  };
  memo = { svg: out, A, cams };
  return memo;
}

// ------------------------------------------------------------------ shared CSS
/** The camera window and wrapper, scoped to one scene element. */
export const CAM_CSS = (sel) => `
${sel} .vp12 { position: absolute; inset: 0; overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, transparent 185px, #000 240px, #000 846px, transparent 870px), linear-gradient(to right, transparent 58px, #000 112px, #000 1808px, transparent 1862px);
  -webkit-mask-composite: source-in; mask-image: linear-gradient(to bottom, transparent 185px, #000 240px, #000 846px, transparent 870px), linear-gradient(to right, transparent 58px, #000 112px, #000 1808px, transparent 1862px); mask-composite: intersect; }
${sel} .cam12 { position: absolute; left: 0; top: 0; width: 1600px; height: 1000px; transform-origin: 0 0; }
${sel} .cam12 .ov { position: absolute; left: 0; top: 0; width: 1600px; height: 1000px; overflow: visible; }
`;

/** Initial camera transform (the overview), so a still frame before the motion runs is sane. */
export const camStyle = (c) => `transform: translate(${c.x}px, ${c.y}px) scale(${c.scale})`;
