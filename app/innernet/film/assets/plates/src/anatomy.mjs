// anatomy: what the crawler reads in one folder (film frame 05, /guide figure).
//
// An exploded axonometric of a real repository folder (xo-swarm, from data/index.json):
// four files lift out of it along their read paths (README.md, package.json, .git,
// CLAUDE.md), each with a leader to what it becomes on the page. Apart from them, a
// sealed key file that is never opened, and a ruled slip showing a credential as
// [redacted]. L-acc carries the one idea: the four read paths and the seal.
//
//   node assets/plates/src/anatomy.mjs

import { P, circle, path_, mono, note, register, writePlate } from "./lib.mjs";

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------------------------------------------------------------------------------------
// Projection: orthographic axonometric, yaw -18deg, pitch 22deg (x width, y depth, z up).
const YAW = (-18 * Math.PI) / 180, PITCH = (22 * Math.PI) / 180;
const EX = [Math.cos(YAW), -Math.sin(YAW) * Math.sin(PITCH)];
const ED = [-Math.sin(YAW), -Math.cos(YAW) * Math.sin(PITCH)];
const EZ = Math.cos(PITCH);
const pr = (o, x, y, z) => [o[0] + x * EX[0] + y * ED[0], o[1] + x * EX[1] + y * ED[1] - z * EZ];

// ---------------------------------------------------------------------------------------
// Hidden lines: occluders are convex screen polygons; a stroke loses the parts inside them.
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
const signedArea = (poly) => poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
function insideT(a, b, poly, eps = 0.7) {
  const s = Math.sign(signedArea(poly));
  let t0 = 0, t1 = 1;
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i], w = poly[(i + 1) % poly.length], ex = w[0] - v[0], ey = w[1] - v[1], len = Math.hypot(ex, ey) || 1;
    const f0 = (s * cross(ex, ey, a[0] - v[0], a[1] - v[1])) / len - eps;
    const f1 = (s * cross(ex, ey, b[0] - v[0], b[1] - v[1])) / len - eps;
    if (f0 < 0 && f1 < 0) return null;
    if (f0 >= 0 && f1 >= 0) continue;
    const tc = f0 / (f0 - f1);
    if (f0 < 0) t0 = Math.max(t0, tc); else t1 = Math.min(t1, tc);
    if (t0 >= t1) return null;
  }
  return [t0, t1];
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function visible(a, b, occ) {
  const iv = occ.map((p) => insideT(a, b, p)).filter(Boolean).sort((u, v) => u[0] - v[0]);
  const out = [];
  let t = 0;
  for (const [s, e] of iv) { if (s > t) out.push([t, s]); t = Math.max(t, e); }
  if (t < 1) out.push([t, 1]);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return out.filter(([s, e]) => (e - s) * L > 0.9).map(([s, e]) => [lerp(a, b, s), lerp(a, b, e)]);
}
/** Polyline with hidden parts removed, as path data. */
function dPoly(pts, occ = [], closed = false) {
  const Q = closed ? [...pts, pts[0]] : pts;
  let d = "", last = null;
  for (let i = 0; i < Q.length - 1; i++) {
    for (const [p, q] of visible(Q[i], Q[i + 1], occ)) {
      d += last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.05 ? `L${P(...q)}` : `M${P(...p)}L${P(...q)}`;
      last = q;
    }
  }
  return d;
}
const push = (layer, d) => { if (d) layer.push(path_(d)); };
/** Dashed straight line (each dash its own subpath, so draw-on still works). */
function dDash(a, b, occ = [], dash = 9, gap = 7) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let d = "";
  for (let t = 0; t < L; t += dash + gap) d += dPoly([lerp(a, b, t / L), lerp(a, b, Math.min(L, t + dash) / L)], occ);
  return d;
}
/** Dash-dot centre line (long dash, gap, dot, gap), minus occluders. */
function dDashDot(a, b, occ = [], pat = [24, 6, 3, 6]) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let d = "", t = 0, i = 0;
  while (t < L) {
    const seg = Math.min(pat[i % pat.length], L - t);
    if (i % 2 === 0) d += dPoly([lerp(a, b, t / L), lerp(a, b, (t + seg) / L)], occ);
    t += seg;
    i++;
  }
  return d;
}
/** Parallel hatching clipped to a convex polygon (inset by `inset`), minus occluders. */
function dHatch(poly, spacing, angleDeg, occ = [], inset = 2.5) {
  const a = (angleDeg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 4;
  let d = "";
  for (let o = -R + spacing / 2; o <= R; o += spacing) {
    const p0 = [cx + nx * o - dx * R, cy + ny * o - dy * R], p1 = [cx + nx * o + dx * R, cy + ny * o + dy * R];
    const iv = insideT(p0, p1, poly, inset);
    if (iv) d += dPoly([lerp(p0, p1, iv[0]), lerp(p0, p1, iv[1])], occ);
  }
  return d;
}
const quad = (a, c, b, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
const arrowD = (x, y, ang, s = 12) => { const a1 = ang + Math.PI - 0.38, a2 = ang + Math.PI + 0.38; return `M${P(x + s * Math.cos(a1), y + s * Math.sin(a1))}L${P(x, y)}L${P(x + s * Math.cos(a2), y + s * Math.sin(a2))}`; };

// ---------------------------------------------------------------------------------------
// The folder: an expanding file with a tabbed back board, a front cover leaning open and
// pleated gussets. Real subject: ~/Programming/XO/ClaudeWorkspace/xo-swarm.
const FO = [104, 868];
const FL = 372, FD = 130, HB = 238, HF = 192, ALPHA = (15 * Math.PI) / 180;
const f3 = (x, y, z) => pr(FO, x, y, z);
const CY = -HF * Math.sin(ALPHA), CZ = HF * Math.cos(ALPHA);
const cv = (u, v) => f3(u, (CY * v) / HF, (CZ * v) / HF); // on the cover: u across, v up

const cover = [f3(0, 0, 0), f3(FL, 0, 0), f3(FL, CY, CZ), f3(0, CY, CZ)];
const gussetR = [f3(FL, 0, 0), f3(FL, FD, 0), f3(FL, FD, HB), f3(FL, CY, CZ)];
const FRONT = [cover, gussetR];

// Sheets standing inside (the files the crawler only measures): y, x0, x1, height, tab x.
const SHEETS = [
  [14, 14, FL - 22, 202, 236],
  [30, 22, FL - 16, 214, 52],
  [47, 12, FL - 26, 206, 290],
  [64, 20, FL - 12, 220, 150],
  [82, 16, FL - 20, 212, 232],
  [99, 24, FL - 18, 226, 84],
  [115, 14, FL - 24, 218, 300],
];
const sheetBody = ([y, x0, x1, h]) => [f3(x0, y, 0), f3(x1, y, 0), f3(x1, y, h), f3(x0, y, h)];
const sheetTab = ([y, , , h, tx]) => [f3(tx, y, h - 1), f3(tx + 62, y, h - 1), f3(tx + 56, y, h + 17), f3(tx + 6, y, h + 17)];
const sheetOcc = (k) => SHEETS.slice(0, k).flatMap((s) => [sheetBody(s), sheetTab(s)]);
const ALL = sheetOcc(SHEETS.length);

// back board with its tab, and the board's thickness along the top
const backPts = [f3(0, FD, 0), f3(0, FD, HB + 22), f3(12, FD, HB + 32), f3(124, FD, HB + 32), f3(146, FD, HB), f3(FL, FD, HB), f3(FL, FD, 0)];
const boardPlane = [f3(0, FD, 0), f3(FL, FD, 0), f3(FL, FD, HB), f3(0, FD, HB)];
const tabPlane = [f3(0, FD, HB - 2), f3(146, FD, HB - 2), f3(124, FD, HB + 32), f3(12, FD, HB + 32), f3(0, FD, HB + 22)];
push(main, dPoly(backPts, [...FRONT, ...ALL]));
{
  const t = 5;
  const top = [f3(0, FD + t, HB + 22), f3(12, FD + t, HB + 32), f3(124, FD + t, HB + 32), f3(146, FD + t, HB), f3(FL, FD + t, HB), f3(FL, FD + t, HB - 30)];
  push(det, dPoly(top, [...FRONT, ...ALL, boardPlane, tabPlane]));
  push(det, dPoly([f3(0, FD, HB + 22), f3(0, FD + t, HB + 22)], [...FRONT, ...ALL]));
  // label slot on the tab
  push(det, dPoly([f3(28, FD, HB + 9), f3(110, FD, HB + 9), f3(110, FD, HB + 24), f3(28, FD, HB + 24)], [...FRONT, ...ALL], true));
  // the inside of the board is in shade
  push(det, dHatch(boardPlane, 6.5, 90, [...FRONT, ...ALL], 2.4));
}

// gusset tops, pleated
function gussetTop(x, n = 6, dip = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x, CY + (FD - CY) * t, CZ + (HB - CZ) * t - (i % 2 ? dip : 0)]);
  }
  return pts;
}
push(main, dPoly(gussetTop(0).map((p) => f3(...p)), [cover, ...ALL]));
push(det, dPoly([f3(0, FD, 0), f3(0, FD, HB)], [cover, ...ALL]));

// the sheets, back to front, each hidden by the ones in front of it and the front parts
for (let k = SHEETS.length - 1; k >= 0; k--) {
  const [y, x0, x1, h, tx] = SHEETS[k];
  const occ = [...FRONT, ...sheetOcc(k)];
  push(det, dPoly([f3(x0, y, 0), f3(x0, y, h), f3(tx, y, h), f3(tx + 6, y, h + 17), f3(tx + 56, y, h + 17), f3(tx + 62, y, h), f3(x1, y, h), f3(x1, y, 0)], occ));
  let d = "";
  for (let r = 0; r < 4; r++) {
    const z = h - 16 - r * 11, x2 = x1 - 18 - ((k * 37 + r * 53) % 70);
    d += dPoly([f3(x0 + 14, y, z), f3(x2, y, z)], occ);
  }
  d += dPoly([f3(tx + 14, y, h + 8), f3(tx + 46, y, h + 8)], occ);
  push(det, d);
}

// front cover: outline, board edge, label holder with the folder's real name, button and string
push(main, dPoly(cover, [], true));
push(det, dPoly([f3(0, CY - 4, CZ - 2), f3(FL, CY - 4, CZ - 2)], [cover]));
push(det, dPoly([cv(108, 100), cv(264, 100), cv(264, 150), cv(108, 150)], [], true));
push(det, dPoly([cv(114, 106), cv(258, 106), cv(258, 144), cv(114, 144)], [], true));
{
  const o = cv(186, 116), U = [EX[0], EX[1]], V0 = cv(0, 0), V1 = cv(0, 1), Vup = [V1[0] - V0[0], V1[1] - V0[1]];
  const m = [U[0], U[1], -Vup[0], -Vup[1], o[0], o[1]].map((n) => Math.round(n * 1000) / 1000).join(" ");
  lbl.push(`<g transform="matrix(${m})">${mono(0, 0, "xo-swarm", { anchor: "middle", size: 24, ls: 1 })}</g>`);
}
{
  const b = cv(FL / 2, 50);
  main.push(circle(b[0], b[1], 9));
  det.push(circle(b[0], b[1], 3.2));
  push(det, dPoly([b, cv(FL / 2 + 14, 70), cv(FL / 2 + 22, 96)]));
  push(det, dPoly([cv(FL / 2 + 26, 154), cv(FL / 2 + 22, 190), cv(FL / 2 + 16, HF - 2)]));
  push(det, dHatch([cv(0, 0), cv(FL, 0), cv(FL, 26), cv(0, 26)], 7, -62, [], 2));
}
// right gusset with pleats, shaded
{
  const gr = gussetTop(FL);
  push(main, dPoly([f3(FL, 0, 0), ...gr.map((p) => f3(...p)), f3(FL, FD, 0)]));
  // accordion folds: each crease runs down to the floor; every other panel is shaded
  const n = gr.length - 1;
  const foot = (i) => f3(FL, (FD * i) / n, 0);
  const tops = gr.map((p) => f3(...p));
  let d = "";
  for (let i = 1; i < n; i++) d += dPoly([tops[i], foot(i)]);
  push(det, d);
  let h = "";
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) continue;
    const panel = [foot(i), foot(i + 1), tops[i + 1], tops[i]];
    const ang = (Math.atan2(tops[i][1] - foot(i)[1], tops[i][0] - foot(i)[0]) * 180) / Math.PI;
    h += dHatch(panel, 5.5, ang, [], 2.2);
  }
  push(det, h);
}
push(main, dPoly([f3(FL, 0, 0), f3(FL, FD, 0)]));
// ground, with the engraver's section ticks
{
  const g0 = f3(-36, -14, 0), g1 = f3(FL + 80, -14, 0);
  push(con, dPoly([g0, g1]));
  let d = "";
  for (let i = 0; i <= 38; i++) { const p = lerp(g0, g1, i / 38); d += `M${P(...p)}L${P(p[0] - 10, p[1] + 13)}`; }
  push(det, d);
}
con.push(path_(dDash(f3(FL / 2, FD / 2, -34), f3(FL / 2, FD / 2, HB + 54), [], 26, 6)));

// ---------------------------------------------------------------------------------------
// The four lifted files, a column of translated slabs, each face engraved with its kind.
const FW = 200, FH = 130, FT = 12, FOLD = 26;
const COLX = 676;
const ROWS = [196, 358, 520, 682];
const face = (o, u, v) => pr(o, u, 0, v);
function slab(o, kind) {
  const F = kind === "git"
    ? [[0, 0], [FW, 0], [FW, FH - 16], [FW * 0.4 + 12, FH - 16], [FW * 0.4, FH], [10, FH], [0, FH - 10]]
    : [[0, 0], [FW, 0], [FW, FH - FOLD], [FW - FOLD, FH], [0, FH]];
  const front = F.map(([u, v]) => face(o, u, v));
  const back = F.map(([u, v]) => pr(o, u, FT, v));
  push(main, dPoly(front, [], true));
  let d = dPoly(back, [front], true);
  for (let i = 0; i < F.length; i++) d += dPoly([front[i], back[i]], [front]);
  d += dPoly(F.map(([u, v]) => pr(o, u, FT * 0.5, v)), [front]);
  push(det, d);
  if (kind !== "git") push(det, dPoly([face(o, FW - FOLD, FH), face(o, FW - FOLD, FH - FOLD), face(o, FW, FH - FOLD)]));
  return front;
}

// read paths start inside the folder, between sheets; nested arcs, never crossing
const FILES = [
  { kind: "readme", name: "README.md", what: "summary and Overview", sub: "FIRST 14,000 BYTES", start: [196, 107, 170] },
  { kind: "manifest", name: "package.json", what: "frameworks and the infobox", sub: "NAME · VERSION · DEPENDENCIES", start: [254, 90, 170] },
  { kind: "git", name: ".git", what: "a History section", sub: "AUTHOR NAMES, NEVER EMAILS", start: [304, 72, 170] },
  { kind: "agents", name: "CLAUDE.md", what: "notes for agents", sub: "FIRST PROSE PARAGRAPH ONLY", start: [342, 55, 170] },
];

FILES.forEach((F, i) => {
  const o = [COLX, ROWS[i]];
  slab(o, F.kind);
  const fu = (u, v) => face(o, u, v);
  if (F.kind === "readme") {
    push(main, dPoly([fu(18, FH - 16), fu(88, FH - 16)]));
    let d = dPoly([fu(18, FH - 22), fu(120, FH - 22)]);
    for (let r = 0; r < 3; r++) d += dPoly([fu(26, FH - 42 - r * 12), fu(FW - 22 - (r === 2 ? 64 : r * 8), FH - 42 - r * 12)]);
    for (let r = 0; r < 4; r++) d += dPoly([fu(18, FH - 86 - r * 11), fu(FW - 26 - ((r * 41) % 50), FH - 86 - r * 11)]);
    push(det, d);
    // bracket on the first paragraph, the part that becomes the summary
    push(main, dPoly([fu(18, FH - 35), fu(13, FH - 35), fu(13, FH - 72), fu(18, FH - 72)]));
  } else if (F.kind === "manifest") {
    let d = "";
    const rows = [[0, 0.2], [1, 0.42], [1, 0.5], [1, 0.3], [2, 0.36], [2, 0.44], [2, 0.28], [2, 0.38], [1, 0.12]];
    rows.forEach(([ind, len], r) => {
      const v = FH - 18 - r * 12.5, u0 = 24 + ind * 16;
      d += dPoly([fu(u0, v), fu(u0 + 36, v)]);
      const dot = fu(u0 + 41, v);
      d += `M${P(dot[0] - 1, dot[1])}L${P(dot[0] + 1, dot[1])}`;
      d += dPoly([fu(u0 + 47, v), fu(u0 + 47 + len * 110, v)]);
    });
    push(det, d);
    const brace = (u, v0, v1, dir) => {
      const m = (v0 + v1) / 2, w = 6 * dir;
      return dPoly([fu(u + w, v0), fu(u, v0 - 4), fu(u, m + 4), fu(u - w * 0.8, m), fu(u, m - 4), fu(u, v1 + 4), fu(u + w, v1)]);
    };
    push(main, brace(12, FH - 10, 12, 1));
    push(main, brace(FW - 12, FH - 34, 12, -1));
  } else if (F.kind === "git") {
    // a commit graph: a main line and a branch that leaves and merges back
    const yv = 62, xs = [24, 50, 76, 102, 128, 154, 178];
    push(main, dPoly([fu(xs[0], yv), fu(xs[xs.length - 1], yv)]));
    for (const u of xs) { const c = fu(u, yv); main.push(circle(c[0], c[1], 5)); }
    const b0 = fu(xs[1], yv), b1 = fu(xs[4], yv), bu = [fu(66, yv + 28), fu(90, yv + 28), fu(114, yv + 28)];
    push(main, dPoly(quad(b0, fu(xs[1] + 4, yv + 28), bu[0], 12)) + dPoly([bu[0], bu[2]]) + dPoly(quad(bu[2], fu(xs[4] - 4, yv + 28), b1, 12)));
    for (const c of bu) det.push(circle(c[0], c[1], 4.2));
    // 24 months of commits on its foot (xo-swarm, real counts, 230 in all)
    const months = [0, 0, 0, 0, 0, 0, 0, 26, 7, 11, 14, 2, 15, 15, 10, 18, 23, 31, 58, 0, 0, 0, 0, 0];
    let d = dPoly([fu(16, 14), fu(FW - 16, 14)]);
    months.forEach((c, m) => { const u = 21 + m * 6.9; d += dPoly([fu(u, 14), fu(u, 14 + (c ? 3 + c * 0.44 : 1.6))]); });
    push(det, d);
  } else {
    let d = "";
    const h = fu(18, FH - 18);
    d += `M${P(h[0], h[1] - 5)}l3,10M${P(h[0] + 6, h[1] - 5)}l3,10M${P(h[0] - 2, h[1] - 1)}l12,1.4M${P(h[0] - 2, h[1] + 3.5)}l12,1.4`;
    d += dPoly([fu(34, FH - 18), fu(96, FH - 18)]);
    for (let r = 0; r < 2; r++) d += dPoly([fu(22, FH - 38 - r * 11), fu(FW - 30 - r * 46, FH - 38 - r * 11)]);
    for (let r = 0; r < 4; r++) {
      const v = FH - 74 - r * 11, c = fu(24, v);
      d += `M${P(c[0] - 2, c[1])}L${P(c[0] + 2, c[1])}`;
      d += dPoly([fu(34, v), fu(FW - 30 - ((r * 29) % 60), v)]);
    }
    push(det, d);
    push(main, dPoly([fu(18, FH - 31), fu(13, FH - 31), fu(13, FH - 53), fu(18, FH - 53)]));
  }

  // the read path: up out of the folder, turning into the file's left edge
  const s = f3(...F.start);
  const e = face(o, 0, FH * 0.5), eIn = [e[0] - 5, e[1]];
  const c = [s[0], eIn[1]];
  const k = SHEETS.findIndex((sh) => sh[0] > F.start[1]);
  const occ = [...FRONT, ...sheetOcc(k < 0 ? SHEETS.length : k)];
  // hidden inside the folder, in the open once it has cleared the mouth
  const pts = quad(s, c, eIn, 64), exitY = f3(F.start[0], F.start[1], HB + 6)[1];
  const cut = Math.max(1, pts.findIndex((p) => p[1] < exitY));
  acc.push(path_(dPoly(pts.slice(0, cut + 1), occ) + dPoly(pts.slice(cut)) + arrowD(eIn[0], eIn[1], 0, 13)));
  // its construction: the lift axis straight up out of the slot, closed by a tick
  if (c[1] < s[1] - 60) {
    con.push(path_(dDashDot(s, [c[0], c[1] + 4], occ)));
    con.push(circle(c[0], c[1], 4));
    con.push(path_(`M${P(c[0] + 4, c[1])}L${P(c[0] + 22, c[1])}`));
  }

  // leader and labels
  const mid = face(o, FW + FT * 0.3, FH * 0.5);
  const yL = Math.round(mid[1]), x0 = mid[0] + 12, x1 = 1120;
  det.push(circle(x0, yL, 4));
  push(det, `M${P(x0, yL)}L${P(x1, yL)}`);
  lbl.push(mono(x0 + 20, yL - 12, F.name, { size: 22, ls: 1 }));
  lbl.push(note(x1 + 14, yL + 8, F.what, { size: 26 }));
  lbl.push(mono(x1 + 16, yL + 38, F.sub, { size: 18, ls: 1.4 }));
});

// ---------------------------------------------------------------------------------------
// Apart: the sealed key file, never opened; and a ruled slip with a redacted credential.
const DIVY = 772;
{
  let d = `M${P(640, DIVY)}L${P(1540, DIVY)}`;
  for (let i = 0; i <= 45; i++) { const x = 640 + i * 20; d += `M${P(x, DIVY)}L${P(x, DIVY + (i % 5 ? 6 : 12))}`; }
  con.push(path_(d));
}
{
  const o = [COLX, 924];
  const front = slab(o, "key");
  const fu = (u, v) => face(o, u, v);
  const c = fu(FW * 0.5, FH * 0.53), R = 33;
  const bandH = [fu(0, FH * 0.46), fu(FW, FH * 0.46), fu(FW, FH * 0.6), fu(0, FH * 0.6)];
  const bandV = [fu(FW * 0.44, 0), fu(FW * 0.56, 0), fu(FW * 0.56, FH), fu(FW * 0.44, FH)];
  const disc = Array.from({ length: 24 }, (_, i) => [c[0] + (R + 4) * Math.cos((i / 24) * 2 * Math.PI), c[1] + (R + 4) * Math.sin((i / 24) * 2 * Math.PI)]);
  // shut: cross-hatched under the cords
  push(det, dHatch(front, 8, -38, [bandH, bandV, disc], 3));
  push(det, dHatch(front, 8, 52, [bandH, bandV, disc], 3));
  // the cords, tied round both ways
  let d = "";
  for (const v of [0.46, 0.6]) d += dPoly([fu(0, FH * v), fu(FW, FH * v)], [disc]);
  for (const u of [0.44, 0.56]) d += dPoly([fu(FW * u, 0), fu(FW * u, FH - (u > 0.5 ? 0 : 0))], [disc]);
  push(main, d);
  // the seal
  let w = "";
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2, rr = R + 2.2 * Math.sin(a * 11) + 1.1 * Math.sin(a * 27 + 1);
    w += `${i ? "L" : "M"}${P(c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a))}`;
  }
  acc.push(path_(w + "Z"));
  acc.push(circle(c[0], c[1], 21));
  acc.push(path_(`M${P(c[0] + 5, c[1] - 6)}A5,5 0 1,0 ${P(c[0] - 5, c[1] - 6)}A5,5 0 1,0 ${P(c[0] + 5, c[1] - 6)}M${P(c[0] - 2.6, c[1] - 1.6)}L${P(c[0] - 5, c[1] + 10)}L${P(c[0] + 5, c[1] + 10)}L${P(c[0] + 2.6, c[1] - 1.6)}`));
  const mid = face(o, FW + FT * 0.3, FH * 0.5);
  const yL = Math.round(mid[1]), x0 = mid[0] + 12;
  det.push(circle(x0, yL, 4));
  push(det, `M${P(x0, yL)}L${P(1150, yL)}`);
  lbl.push(mono(x0 + 20, yL - 12, ".env · keys · tokens", { size: 20, ls: 0.6 }));
  lbl.push(note(x0 + 20, yL + 33, "never opened", { size: 26 }));
  lbl.push(mono(x0 + 22, yL + 64, "NOT LISTED · NOT READ", { size: 18, ls: 1.4 }));
}
// the redaction slip
{
  const x = 1190, y = 800, w = 350, h = 132;
  main.push(path_(`M${P(x, y)}L${P(x + w, y)}L${P(x + w, y + h)}L${P(x, y + h)}Z`));
  det.push(path_(`M${P(x + 6, y + 6)}L${P(x + w - 6, y + 6)}L${P(x + w - 6, y + h - 6)}L${P(x + 6, y + h - 6)}Z`));
  det.push(path_(`M${P(x + 6, y + 42)}L${P(x + w - 6, y + 42)}M${P(x + 18, y + 84)}L${P(x + w - 18, y + 84)}`));
  // conditional on purpose: xo-swarm's own README holds no key. Both lines are forms the
  // live index really shows (CLIENT_SECRET=..., a postgres login), as redactSecrets leaves them.
  lbl.push(mono(x + 20, y + 30, "IF A README HOLDS A KEY", { size: 18, ls: 1.4 }));
  lbl.push(mono(x + 20, y + 72, "CLIENT_SECRET=[redacted]", { size: 20, ls: 0.4 }));
  lbl.push(mono(x + 20, y + 114, "postgres://app:[redacted]@db", { size: 18, ls: 0 }));
}

// ---------------------------------------------------------------------------------------
// The subject (a real folder from the index), and the note on the rest of the folder.
const SUBY = 86, LEGY = 236, NOTEY = 446;
lbl.push(mono(70, SUBY, "xo-swarm/", { size: 26, ls: 1 }));
lbl.push(mono(71, SUBY + 30, "~/Programming/XO/ClaudeWorkspace", { size: 18, ls: 0.6 }));
// legend: the three ways a file is treated
{
  const sw = 70, tx = 132, gap = 36;
  push(con, `M${P(70, LEGY - 30)}L${P(300, LEGY - 30)}M${P(70, LEGY + gap * 2 + 20)}L${P(300, LEGY + gap * 2 + 20)}`);
  // read: a read path
  acc.push(path_(`M${P(sw, LEGY - 6)}L${P(sw + 44, LEGY - 6)}` + arrowD(sw + 46, LEGY - 6, 0, 10)));
  lbl.push(mono(tx, LEGY, "READ", { size: 18, ls: 1.4 }));
  // measured only: a plain sheet
  const y2 = LEGY + gap;
  push(det, `M${P(sw + 6, y2 + 2)}L${P(sw + 6, y2 - 14)}L${P(sw + 12, y2 - 14)}L${P(sw + 14, y2 - 20)}L${P(sw + 26, y2 - 20)}L${P(sw + 28, y2 - 14)}L${P(sw + 38, y2 - 14)}L${P(sw + 38, y2 + 2)}Z`);
  lbl.push(mono(tx, y2, "MEASURED ONLY", { size: 18, ls: 1.4 }));
  // never opened: a hatched, sealed sheet
  const y3 = LEGY + gap * 2, sq = [[sw + 6, y3 + 2], [sw + 38, y3 + 2], [sw + 38, y3 - 18], [sw + 6, y3 - 18]];
  push(main, dPoly(sq, [], true));
  push(det, dHatch(sq, 4.5, -45, [], 1.2) + dHatch(sq, 4.5, 45, [], 1.2));
  lbl.push(mono(tx, y3, "NEVER OPENED", { size: 18, ls: 1.4 }));
}
// the rest of the folder: listed and measured, never opened (xo-swarm: 18 files, 3 read)
{
  lbl.push(note(70, NOTEY, "the other 15 files", { size: 26 }));
  lbl.push(note(70, NOTEY + 28, "are only measured", { size: 26 }));
  lbl.push(mono(72, NOTEY + 56, "SIZE AND DATES", { size: 18, ls: 1.4 }));
  // the fifteen, counted out as plain sheets (the legend's MEASURED ONLY glyph)
  const RY = NOTEY + 88, gw = 11, gh = 15;
  let d = "";
  for (let i = 0; i < 15; i++) {
    const x = 72 + i * 15.5;
    d += `M${P(x, RY)}L${P(x, RY - gh + 3)}L${P(x + 2, RY - gh + 3)}L${P(x + 3, RY - gh)}L${P(x + 7, RY - gh)}L${P(x + 8, RY - gh + 3)}L${P(x + gw, RY - gh + 3)}L${P(x + gw, RY)}Z`;
  }
  push(det, d);
  // a fine dimension under the count, as on a measured drawing
  push(con, `M${P(72, RY + 8)}L${P(72 + 14 * 15.5 + gw, RY + 8)}M${P(72, RY + 4)}L${P(72, RY + 12)}M${P(72 + 14 * 15.5 + gw, RY + 4)}L${P(72 + 14 * 15.5 + gw, RY + 12)}`);
  const sp = f3(30, 14, 214);
  push(det, `M${P(80, RY + 22)}L${P(80, sp[1])}L${P(...sp)}`);
  det.push(circle(sp[0], sp[1], 4));
}
for (const [x, y] of [[40, 40], [1560, 40], [40, 960], [1560, 960]]) con.push(register(x, y, 14));

writePlate("anatomy", "What it reads: an exploded folder whose README, package.json, .git and CLAUDE.md lift out to become its page, beside a sealed key file that is never opened", { con, main, det, acc, lbl });
