// THE CRAWL: the walk over ~/Programming, drawn as a radial tree on depth rings 0 to 6.
// The tree is the real one (data/index.json, children in crawl order, clockwise), thinned
// by arc length so the outer rings read as engraved texture. The spine is a real path to
// depth 6 (~/Programming/XO/ClaudeWorkspace/experiments/linear-clone/features/issues);
// the sweep marks the depth-first walk; the pruned names are struck through.
// Numbers are from FACTS.md: pages per depth, 5,484 folders, 769 tallied, 35 pruned names.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P, r1, line, circle, path_, mono, note, display, arrowHead, hatch, folder, register, writePlate } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(fs.readFileSync(path.resolve(here, "../../../../data/index.json"), "utf8"));

// ---------------------------------------------------------------- geometry
const D2R = Math.PI / 180;
const C = [800, 488];
const R0 = 36, GAP = 56;
const RK = (k) => R0 + GAP * k; // ring 6 = 372
const R6 = RK(6);
const pol = (r, deg) => [C[0] + r * Math.cos(deg * D2R), C[1] + r * Math.sin(deg * D2R)];
const PP = (r, deg) => P(...pol(r, deg));
const sw = (s, w) => s.replace(/^<(\w+) /, `<$1 stroke-width="${w}" `);
const dash = (s, da) => s.replace(/^<(\w+) /, `<$1 stroke-dasharray="${da}" `);
const TIP = -90; // the walk is here now: the leading edge of the sweep

// knock-outs: rectangles where line work breaks so lettering stays clean
const keep = [];
const ko = (x0, y0, x1, y1) => keep.push([x0, y0, x1, y1]);
const blocked = (x, y) => keep.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
const monoW = (s, size, ls) => s.length * (0.6 * size + ls) - ls;

/** Arc at radius r from a0 to a1 (degrees, clockwise), split around knock-outs. */
function arcs(r, a0, a1, minRun = 0.4) {
  const out = [];
  const step = Math.max(0.08, Math.min(1, 120 / r));
  let s = null;
  const flush = (e) => {
    if (s !== null && e - s >= minRun && (e - s) * D2R * r >= 4) out.push(path_(`M${PP(r, s)}A${r1(r)} ${r1(r)} 0 ${e - s > 180 ? 1 : 0} 1 ${PP(r, e)}`));
    s = null;
  };
  for (let a = a0; ; a += step) {
    const aa = Math.min(a, a1);
    if (blocked(...pol(r, aa))) flush(aa - step);
    else if (s === null) s = aa;
    if (aa >= a1) break;
  }
  flush(a1);
  return out;
}
/** Straight segment split around knock-outs. */
function seg(x1, y1, x2, y2) {
  const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(L / 1.5));
  const pt = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  const out = [];
  let s = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (blocked(...pt(t))) {
      if (s !== null && (t - 1 / n - s) * L > 3) out.push(path_(`M${P(...pt(s))}L${P(...pt(t - 1 / n))}`));
      s = null;
    } else if (s === null) s = t;
  }
  if (s !== null && (1 - s) * L > 3) out.push(path_(`M${P(...pt(s))}L${P(x2, y2)}`));
  return out;
}
const radial = (a, ra, rb) => seg(...pol(ra, a), ...pol(rb, a));
/** Dash-dot centre line that breaks for lettering. */
function centre(x1, y1, x2, y2, pat = [26, 6, 4, 6]) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  let d = "", t = 0, i = 0;
  while (t < L) {
    const sl = Math.min(pat[i % pat.length], L - t);
    if (i % 2 === 0 && !blocked(x1 + ux * (t + sl / 2), y1 + uy * (t + sl / 2)) && !blocked(x1 + ux * t, y1 + uy * t) && !blocked(x1 + ux * (t + sl), y1 + uy * (t + sl)))
      d += `M${P(x1 + ux * t, y1 + uy * t)}L${P(x1 + ux * (t + sl), y1 + uy * (t + sl))}`;
    t += sl; i++;
  }
  return path_(d);
}
/** Rotated mono label. */
const monoRot = (x, y, s, deg, { size = 18, ls = 3, anchor = "middle" } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" transform="rotate(${deg} ${r1(x)} ${r1(y)})" text-anchor="${anchor}" font-size="${size}" letter-spacing="${ls}" class="mono" font-family="JetBrains Mono, ui-monospace, monospace" fill="currentColor">${s}</text>`;

// ---------------------------------------------------------------- the real tree
const bySlug = new Map(index.pages.map((p) => [p.slug, p]));
function build(p) {
  const n = { p, name: p.name, depth: p.depth, kids: p.children.map((s) => build(bySlug.get(s))) };
  n.size = 1 + n.kids.reduce((s, k) => s + k.size, 0);
  n.w = Math.pow(n.size, 0.85);
  return n;
}
const tree = build(index.pages.find((p) => p.depth === 0));
function lay(n, a0, a1) {
  n.a0 = a0; n.a1 = a1; n.a = (a0 + a1) / 2;
  const tot = n.kids.reduce((s, k) => s + k.w, 0);
  let a = a0;
  for (const k of n.kids) { const span = ((a1 - a0) * k.w) / tot; lay(k, a, a + span); a += span; }
}
const spine = [tree];
for (const nm of ["XO", "ClaudeWorkspace", "experiments", "linear-clone", "features", "issues"]) spine.push(spine.at(-1).kids.find((k) => k.name === nm));
lay(tree, 0, 360);
const rot = TIP - spine[6].a;
(function turn(n) { n.a0 += rot; n.a1 += rot; n.a += rot; n.kids.forEach(turn); })(tree);
const onSpine = new Set(spine);

// thin by arc length on the node's own ring
const MIN_ARC = [0, 0, 3.2, 2.6, 2.4, 2.3, 2.2];
(function mark(n, parentShown) {
  n.show = n.depth === 0 || onSpine.has(n) || (parentShown && (n.a1 - n.a0) * D2R * RK(n.depth) >= MIN_ARC[n.depth]);
  n.kids.forEach((k) => mark(k, n.show));
})(tree, true);
const shown = [];
(function walk(n) { if (n.show) shown.push(n); n.kids.forEach(walk); })(tree);
const XY = (n) => (n.depth === 0 ? C : pol(RK(n.depth), n.a));

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------------------------------------------------------------- lettering first (it sets the knock-outs)
const LS = 1.5;
function tag(x, y, s, { anchor = "start", size = 20, pad = 6, ls = LS } = {}) {
  const w = monoW(s, size, ls);
  const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  ko(x0 - pad, y - size * 0.8 - pad, x0 + w + pad, y + size * 0.25 + pad);
  lbl.push(mono(x, y, s, { anchor, size, ls }));
}
for (const n of spine.slice(1)) {
  const [x, y] = XY(n);
  tag(x + (n.depth === 6 ? 42 : n.depth >= 4 ? 18 : 14), y + 7, n.name, { size: 21 });
  ko(x - 11, y - 9, x + 11, y + 9);
}
tag(C[0], C[1] + 66, "~/Programming", { anchor: "middle", size: 20 });
ko(C[0] - R0 - 1, C[1] - R0 - 1, C[0] + R0 + 1, C[1] + R0 + 1);
// a few more real folders by name
const byName = (arr, nm) => arr.find((k) => k.name === nm);
{
  const sm = byName(tree.kids, "smoodle"), [sx, sy] = XY(sm);
  tag(sx - 16, sy + 7, "smoodle", { anchor: "end", size: 20 });
  const ox = byName(spine[1].kids, "openxai-studio"), [qx, qy] = XY(ox);
  tag(qx + 14, qy + 7, "openxai-studio", { size: 20 });
}
// ring numerals down the 6 o'clock line, set into the rings
for (let k = 1; k <= 6; k++) {
  const y = C[1] + RK(k);
  ko(C[0] - 12, y - 13, C[0] + 12, y + 13);
  lbl.push(mono(C[0], y + 6.5, String(k), { anchor: "middle", size: 18, ls: 0 }));
}
// tiny glyphs where a sector is wide enough to hold one, never on lettering or each other
const glyphs = [];
for (const n of shown) {
  if (onSpine.has(n) || n.depth < 1 || n.depth > 3) continue;
  const span = (n.a1 - n.a0) * D2R * RK(n.depth);
  if (span < [0, 10, 24, 40][n.depth]) continue;
  const [x, y] = XY(n);
  if ([[-10, -8], [10, -8], [-10, 8], [10, 8], [0, 0]].some(([dx, dy]) => blocked(x + dx, y + dy))) continue;
  if (glyphs.some((g) => Math.hypot(XY(g)[0] - x, XY(g)[1] - y) < 24)) continue;
  glyphs.push(n);
}
for (const n of glyphs) { const [x, y] = XY(n); ko(x - 9, y - 7.5, x + 9, y + 7.5); }

// ---------------------------------------------------------------- construction
con.push(centre(C[0] - R6 - 64, C[1], C[0] + R6 + 64, C[1]));
con.push(centre(C[0], C[1] + R0 + 4, C[0], C[1] + R6 + 60));
con.push(circle(C[0], C[1], R6 + 9), circle(C[0], C[1], R6 + 19));
for (const a of [-150, -120, -60, -30, 30, 60, 120, 150]) con.push(...radial(a, R6 + 46, R6 + 64));

// ---------------------------------------------------------------- rings 0 to 6
main.push(circle(C[0], C[1], R0));
det.push(sw(circle(C[0], C[1], R0 - 6), 1));
main.push(folder(C[0] - 15, C[1] - 11, 30, 22));
{
  let d = "";
  for (let a = 0; a < 360; a += 7.5) d += `M${PP(R0 - 6, a)}L${PP(R0, a)}`;
  det.push(sw(path_(d), 0.8));
}
for (let k = 1; k <= 5; k++) for (let q = 0; q < 8; q++) det.push(...arcs(RK(k), q * 45, q * 45 + 45).map((s) => sw(s, 1.15)));
for (let q = 0; q < 12; q++) main.push(...arcs(R6, q * 30, q * 30 + 30));
for (let q = 0; q < 12; q++) det.push(...arcs(R6 - 5, q * 30, q * 30 + 30).map((s) => sw(s, 0.8)));

// bezel graduation; the 40 first-level sectors are marked long
det.push(sw(circle(C[0], C[1], R6 + 28), 1.1));
for (let q = 0; q < 12; q++) {
  let d = "";
  for (let a = q * 30; a < q * 30 + 30; a += 1) d += `M${PP(R6 + 28, a)}L${PP(R6 + (a % 10 === 0 ? 42 : a % 5 === 0 ? 37 : 33), a)}`;
  det.push(sw(path_(d), 0.9));
}
{
  let d = "";
  for (const k of tree.kids) d += `M${PP(R6 + 9, k.a0)}L${PP(R6 + 28, k.a0)}`;
  det.push(sw(path_(d), 1.2));
}

// the fringe: depth-6 folders that carry a tally of what lies below, hatched where they sit
{
  const spans = [];
  (function f(n) { if (n.depth === 6 && n.p.deeper) spans.push([n.a0, n.a1]); n.kids.forEach(f); })(tree);
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const s of spans) { const m = merged.at(-1); if (m && s[0] - m[1] < 0.5) m[1] = Math.max(m[1], s[1]); else merged.push([...s]); }
  let d = "", cnt = 0;
  for (const [a0, a1] of merged) {
    for (let a = a0; a <= a1 + 0.01; a += 0.8) { d += `M${PP(R6 + 10, a)}L${PP(R6 + 18, a + 1)}`; cnt++; }
    if (cnt > 40) { det.push(sw(path_(d), 0.9)); d = ""; cnt = 0; }
  }
  if (d) det.push(sw(path_(d), 0.9));
}

// ---------------------------------------------------------------- branches (radial dendrogram)
for (const n of shown) {
  const kids = n.kids.filter((k) => k.show);
  if (!kids.length) continue;
  const r = RK(n.depth), rb = r + GAP * 0.5, rk = RK(n.depth + 1);
  const w = n.depth === 0 ? 1.2 : n.depth === 1 ? 1.1 : n.depth === 2 ? 1 : 0.9;
  if (n.depth === 0) {
    for (let q = 0; q < 8; q++) det.push(...arcs(rb, q * 45, q * 45 + 45).map((s) => sw(s, w)));
    let d = "";
    for (let q = 0; q < 8; q++) d += `M${PP(R0, q * 45 + 22.5)}L${PP(rb, q * 45 + 22.5)}`;
    det.push(sw(path_(d), w));
  } else {
    det.push(...radial(n.a, r + (n.depth <= 2 ? 4 : 2), rb).map((s) => sw(s, w)));
    const lo = Math.min(n.a, ...kids.map((k) => k.a)), hi = Math.max(n.a, ...kids.map((k) => k.a));
    if (hi - lo > 0.06) det.push(...arcs(rb, lo, hi, 0.06).map((s) => sw(s, w)));
  }
  const stubs = [];
  for (const k of kids) stubs.push(...radial(k.a, rb, rk - (k.depth <= 2 ? 4 : 0)));
  // one path per family keeps the stagger readable without thousands of nodes
  const d = stubs.map((s) => s.match(/d="([^"]+)"/)[1]).join("");
  if (d) det.push(sw(path_(d), w));
}
// node glyphs
for (const n of glyphs) {
  const [x, y] = XY(n);
  det.push(sw(folder(x - 7, y - 5.5, 14, 11), 1.2));
}
for (const n of shown) {
  if (n.depth !== 1 || onSpine.has(n) || glyphs.includes(n)) continue;
  det.push(...radial(n.a, RK(1) - 4, RK(1) + 4).map((s) => sw(s, 1.2)));
}

// the spine: the walk's current path, root to depth 6, in the accent
for (let i = 1; i < spine.length; i++) {
  const a = spine[i - 1], b = spine[i];
  const r = RK(a.depth), rb = r + GAP * 0.5;
  const pcs = [...radial(a.a, a.depth === 0 ? R0 : r + 7, rb)];
  if (Math.abs(b.a - a.a) > 0.1) pcs.push(...arcs(rb, Math.min(a.a, b.a), Math.max(a.a, b.a), 0.05));
  pcs.push(...radial(b.a, rb, RK(b.depth) - 7));
  acc.push(...pcs.map((s) => sw(s, 2.6)));
}
for (const n of spine.slice(1)) {
  const [x, y] = XY(n);
  main.push(folder(x - 9, y - 7, 18, 14));
}
// ---------------------------------------------------------------- the sweep (accent)
{
  const [lx, ly] = XY(spine[6]);
  acc.push(path_(`M${PP(R6 + 16, TIP)}L${PP(R6 + 58, TIP)}`));
  // afterglow: the walked sector behind the hand, fading as it falls behind
  const trail = [2.4, 5.2, 8.4, 12.2, 16.8, 22.2, 28.6];
  trail.forEach((t, i) => {
    const w = r1(Math.max(0.6, 1.8 - i * 0.2));
    acc.push(...radial(TIP - t, R0 + 26, R6 - 14 - i * 5).map((s) => sw(s, w)));
  });
  // the walk so far: a fine ink line from where it began, turning to the bold sweep for the last quarter
  const ra = R6 + 52, a0 = tree.a0, aS = a0 + 90, a1 = TIP + 6;
  det.push(...arcs(ra, a0, aS + 0.5).map((s) => sw(s, 1.4)));
  for (let a = a0 + 22.5; a < aS; a += 22.5) {
    const [x, y] = pol(ra, a);
    det.push(sw(path_(arrowHead(x, y, (a + 90) * D2R, 9)), 1.4));
  }
  const nseg = 4;
  for (let i = 0; i < nseg; i++) {
    const s0 = aS + ((a1 - aS) * i) / nseg, s1 = aS + ((a1 - aS) * (i + 1)) / nseg;
    const [ex, ey] = pol(ra, s1);
    acc.push(path_(`M${PP(ra, s0)}A${ra} ${ra} 0 0 1 ${P(ex, ey)}` + (i === nseg - 1 ? arrowHead(ex, ey, (s1 + 90) * D2R, 13) : "")));
  }
  const [sx, sy] = pol(ra, a0);
  main.push(circle(sx, sy, 5.5));
  main.push(path_(`M${PP(ra - 12, a0)}L${PP(ra + 12, a0)}`));
  // the rest of the walk, still to come
  con.push(...arcs(ra, a1 + 4, a0 + 360 - 3).map((s) => dash(s, "3 7")));
  lbl.push(mono(sx + 16, sy + 26, "START", { size: 18, ls: 3 }));
  lbl.push(mono(sx + 16 + monoW("START", 18, 3) + 12, sy + 26, "aifun", { size: 18, ls: 1 }));
  // where the walk met pruned folders it struck them and went on: blips in the afterglow
  const blips = [];
  for (const n of shown) {
    if (!(n.p.hiddenChildren && n.p.hiddenChildren.length) || n.a > TIP || n.a < TIP - 31 || n.depth === 0 || onSpine.has(n)) continue;
    const r = RK(n.depth) + (n.depth === 6 ? 0 : 11), [x, y] = pol(r, n.a);
    if (blocked(x, y) || Math.abs(x - C[0]) < 22 || blips.some(([bx, by]) => Math.hypot(bx - x, by - y) < 20)) continue;
    blips.push([x, y]);
    acc.push(sw(path_(`M${P(x - 4.5, y - 4.5)}L${P(x + 4.5, y + 4.5)}M${P(x - 4.5, y + 4.5)}L${P(x + 4.5, y - 4.5)}`), 1.8));
  }
  // the lens on the folder being read
  acc.push(circle(lx, ly, 20));
  let t = "";
  for (const a of [0, 90, 180, 270]) t += `M${P(lx + 20 * Math.cos(a * D2R), ly + 20 * Math.sin(a * D2R))}L${P(lx + 30 * Math.cos(a * D2R), ly + 30 * Math.sin(a * D2R))}`;
  acc.push(sw(path_(t), 2));
}
{
  lbl.push(mono(866, 46, "THE WALK", { size: 20, ls: 4 }));
  lbl.push(note(866 + monoW("THE WALK", 20, 4) + 16, 47, "depth-first, in sorted order", { size: 24 }));
}

// ---------------------------------------------------------------- pruned (right column)
const GROUPS = [
  ["DEPENDENCIES", ["node_modules", ".venv"]],
  ["BUILDS", ["dist", "build", ".next"]],
  ["CACHES", ["__pycache__"]],
  ["VERSION CONTROL", [".git"]],
];
{
  const x0 = 1268, xr = 1560;
  lbl.push(mono(x0, 112, "PRUNED", { size: 22, ls: 5 }));
  main.push(line(x0, 128, xr, 128));
  con.push(line(x0, 134, xr, 134));
  let y = 176;
  for (const [g, names] of GROUPS) {
    lbl.push(mono(x0, y, g, { size: 18, ls: 3 }));
    con.push(line(x0 + monoW(g, 18, 3) + 12, y - 6, xr, y - 6));
    y += 44;
    for (const nm of names) {
      main.push(folder(x0 + 2, y - 18, 38, 29));
      det.push(sw(hatch(x0 + 6, y - 10, 30, 17, 5, -45), 1));
      lbl.push(mono(x0 + 58, y + 3, nm, { size: 22, ls: 1.5 }));
      acc.push(sw(path_(`M${P(x0 - 6, y - 3)}L${P(x0 + 58 + monoW(nm, 22, 1.5) + 14, y - 4)}`), 2.8));
      y += 52;
    }
    y += 4;
  }
  lbl.push(note(x0, y + 22, "skipped, never walked", { size: 28 }));
  lbl.push(mono(x0, y + 60, "+ 28 MORE NAMES", { size: 18, ls: 2 }));
  lbl.push(mono(x0, y + 86, "+ EVERY .DOT FOLDER", { size: 18, ls: 2 }));
}

// ---------------------------------------------------------------- depth scale (upper left), projected from the rings
const DEPTHS = [1, 40, 192, 476, 1089, 1591, 2095];
{
  const nx = 330, bx = 286, maxL = 196;
  lbl.push(mono(nx, 72, "DEPTH", { anchor: "end", size: 18, ls: 3 }));
  lbl.push(mono(bx - maxL, 72, "PAGES", { size: 18, ls: 3 }));
  DEPTHS.forEach((c, k) => {
    const y = C[1] - RK(k);
    con.push(...seg(nx + 40, y, C[0] - 3, y).map((s) => dash(s, "7 6")));
    lbl.push(display(nx, y + 12, String(k), { anchor: "end", size: 36 }));
    const L = Math.max(2, (maxL * c) / 2095);
    if (L > 6) {
      det.push(path_(`M${P(bx, y - 5)}L${P(bx - L, y - 5)}L${P(bx - L, y + 5)}L${P(bx, y + 5)}`));
      det.push(sw(hatch(bx - L, y - 5, L, 10, 4, -45), 0.9));
    } else det.push(path_(`M${P(bx - L, y - 5)}L${P(bx - L, y + 5)}`));
    lbl.push(mono(bx, y - 13, c.toLocaleString("en-US"), { anchor: "end", size: 18, ls: 1 }));
  });
  det.push(line(bx + 3, C[1] - RK(0) - 15, bx + 3, C[1] - RK(6) + 15));
  // dimension: six levels
  const dx = nx + 22, ya = C[1] - RK(0), yb = C[1] - RK(6);
  con.push(path_(`M${P(dx, ya)}L${P(dx, yb)}` + arrowHead(dx, yb, -Math.PI / 2, 9) + arrowHead(dx, ya, Math.PI / 2, 9)));
  main.push(line(bx - maxL - 6, ya + 26, nx, ya + 26));
  lbl.push(mono(bx - maxL - 6, ya + 52, "5,484 FOLDERS", { size: 18, ls: 2 }));
  lbl.push(note(bx - maxL - 6, 40, "maxDepth 6: seven levels of pages", { size: 22 }));
}

// ---------------------------------------------------------------- the fringe callout
{
  const a = 62, [x, y] = pol(R6 + 14, a);
  con.push(circle(x, y, 4));
  con.push(path_(`M${P(x, y)}L${P(x + 40, 916)}L${P(1040, 916)}`));
  lbl.push(mono(1052, 923, "769 FOLDERS AT THE LIMIT", { size: 18, ls: 2 }));
  lbl.push(note(1052, 955, "what lies below is counted, never paged", { size: 24 }));
}

// registration marks, the same four corners as every plate in the set
for (const [x, y] of [[40, 40], [1560, 40], [40, 960], [1560, 960]]) con.push(register(x, y, 14));

writePlate("crawl", "The crawl: depth rings 0 to 6 around ~/Programming, the depth-first walk, and the pruned folders", { con, main, det, acc, lbl });
console.log(`shown nodes ${shown.length}`);
