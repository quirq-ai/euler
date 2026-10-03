// PRIVATE BY DESIGN. The machine drawn as a walled garden on a fortified plan: a bastioned
// rampart (the accent) around the folders, the index ledger, the search lens and the
// Innerpedia book. One gate, 127.0.0.1, locked. Three outward arrows (sync to the cloud,
// telemetry pings, third-party fetches) hit the rampart and are struck through.
// Film frame 07 and guide chapter V.

import { P, line, circle, rect, path_, mono, note, centreLine, arrowHead, writing, register, rand, writePlate } from "./lib.mjs";

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------------------------------------------------------------- local helpers

const D = (pts, close = false) => pts.map(([x, y], i) => `${i ? "L" : "M"}${P(x, y)}`).join("") + (close ? "Z" : "");
const deg = (d) => (d * Math.PI) / 180;
const arcD = (cx, cy, r, a0, a1) => {
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0, sw = a1 > a0 ? 1 : 0;
  return `M${P(cx + r * Math.cos(a0), cy + r * Math.sin(a0))}A${r} ${r} 0 ${large} ${sw} ${P(cx + r * Math.cos(a1), cy + r * Math.sin(a1))}`;
};
const norm = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
/** Intersection of the lines p + t*u and q + s*v. */
function meet(p, u, q, v) {
  const cr = u[0] * v[1] - u[1] * v[0];
  const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / cr;
  return [p[0] + u[0] * t, p[1] + u[1] * t];
}
/** Even-odd scanline hatching over closed rings; returns segments [[a],[b]]. */
function hatchSegs(rings, angle, sp, off = 0) {
  const a = deg(angle), c = Math.cos(a), s = Math.sin(a);
  const edges = [];
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    edges.push([x1 * c + y1 * s, -x1 * s + y1 * c, x2 * c + y2 * s, -x2 * s + y2 * c]);
  }
  const vs = edges.flatMap((e) => [e[1], e[3]]);
  const v0 = Math.min(...vs), v1 = Math.max(...vs), out = [];
  for (let v = Math.ceil((v0 - off) / sp) * sp + off + 0.01; v < v1; v += sp) {
    const xs = [];
    for (const [ua, va, ub, vb] of edges) if ((va <= v && vb > v) || (vb <= v && va > v)) xs.push(ua + ((v - va) / (vb - va)) * (ub - ua));
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1] - xs[k] < 2) continue;
      out.push([[xs[k] * c - v * s, xs[k] * s + v * c], [xs[k + 1] * c - v * s, xs[k + 1] * s + v * c]]);
    }
  }
  return out;
}
/** A path tagged with data-part, so a host can time the wall, the attempts and the strikes apart. */
const part = (name, d) => `<path data-part="${name}" d="${d}"/>`;
const segsD = (segs) => segs.map(([a, b]) => `M${P(...a)}L${P(...b)}`).join("");
/** Bucket segments into n paths by angle around a centre, so a layer draws on as a sweep. */
function sweep(segs, cx, cy, n, a0 = Math.PI / 2) {
  const buckets = Array.from({ length: n }, () => []);
  for (const sg of segs) {
    const mx = (sg[0][0] + sg[1][0]) / 2, my = (sg[0][1] + sg[1][1]) / 2;
    let a = Math.atan2(my - cy, mx - cx) - a0;
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    buckets[Math.min(n - 1, Math.floor((a / (2 * Math.PI)) * n))].push(sg);
  }
  return buckets.filter((b) => b.length).map((b) => path_(segsD(b)));
}
/** Dashes along a straight line, as path data; keep(x, y) can drop a dash. */
function dashes(x1, y1, x2, y2, on, off, keep = () => true) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  let d = "";
  for (let t = 0; t < L; t += on + off) {
    const ax = x1 + ux * t, ay = y1 + uy * t, bx = x1 + ux * Math.min(L, t + on), by = y1 + uy * Math.min(L, t + on);
    if (keep((ax + bx) / 2, (ay + by) / 2)) d += `M${P(ax, ay)}L${P(bx, by)}`;
  }
  return d;
}
/** The parts of segment [a, b] that lie outside the circle (c, r). */
function outsideCircle([a, b], c, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - c[0], fy = a[1] - c[1];
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r, disc = B * B - 4 * A * C;
  if (disc <= 0) return [[a, b]];
  const t1 = (-B - Math.sqrt(disc)) / (2 * A), t2 = (-B + Math.sqrt(disc)) / (2 * A), at = (t) => [a[0] + dx * t, a[1] + dy * t];
  const out = [];
  if (t1 > 0.02) out.push([a, at(Math.min(1, t1))]);
  if (t2 < 0.98) out.push([at(Math.max(0, t2)), b]);
  return out;
}
const circlePts = (cx, cy, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);

// ---------------------------------------------------------------- the rampart

// A walled garden: a curtain wall with a round tower on each corner and one gate in the
// south wall. The wall's centre line runs on the rectangle X0..X1, Y0..Y1.
const X0 = 196, X1 = 904, Y0 = 196, Y1 = 776;
const GX = (X0 + X1) / 2, GW = 30; // gate centre and half-width
const T = 28, R = 50, RI = 21; // wall thickness, tower radius, tower hollow
const TOW = [[X0, Y1], [X0, Y0], [X1, Y0], [X1, Y1]]; // clockwise from the south-west
const h = T / 2, cut = Math.sqrt(R * R - h * h); // where a wall face meets a tower
const arcPts = (cx, cy, r, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
// angle on a tower circle where the outer (o) or inner (i) face of a wall leaves it
const ang = (dx, dy) => Math.atan2(dy, dx);

// the outer outline, clockwise from the gate: [kind, points]
const outer = [];
{
  // south wall, gate to the SW tower
  outer.push(["wall", [[GX - GW, Y1 + h], [X0 + cut, Y1 + h]]]);
  // SW tower: from the south face round to the west face (through south, west)
  outer.push(["tower", arcPts(X0, Y1, R, ang(cut, h), ang(-h, -cut) + 2 * Math.PI)]);
  outer.push(["wall", [[X0 - h, Y1 - cut], [X0 - h, Y0 + cut]]]);
  outer.push(["tower", arcPts(X0, Y0, R, ang(-h, cut), ang(cut, -h) + 2 * Math.PI)]);
  outer.push(["wall", [[X0 + cut, Y0 - h], [X1 - cut, Y0 - h]]]);
  outer.push(["tower", arcPts(X1, Y0, R, ang(-cut, -h) + 2 * Math.PI, ang(h, cut) + 2 * Math.PI)]);
  outer.push(["wall", [[X1 + h, Y0 + cut], [X1 + h, Y1 - cut]]]);
  outer.push(["tower", arcPts(X1, Y1, R, ang(h, -cut), ang(-cut, h))]);
  outer.push(["wall", [[X1 - cut, Y1 + h], [GX + GW, Y1 + h]]]);
}
const OUTRING = outer.flatMap(([, p]) => p);
// the inner outline: inner faces of the walls, bitten by the towers
const INRING = [
  ...arcPts(X0, Y1, R, ang(h, -cut), ang(cut, -h), 16),
  ...arcPts(X1, Y1, R, ang(-cut, -h), ang(-h, -cut), 16),
  ...arcPts(X1, Y0, R, ang(-h, cut), ang(-cut, h), 16),
  ...arcPts(X0, Y0, R, ang(cut, h), ang(h, cut), 16),
];

// L-acc: the outer face, wall by wall and tower by tower (each tower in two arcs).
for (const [kind, pts] of outer) {
  if (kind === "wall") acc.push(part("wall", D(pts)));
  else { const m = Math.floor(pts.length / 2); acc.push(part("wall", D(pts.slice(0, m + 1))), part("wall", D(pts.slice(m)))); }
}

// L-main: the inner faces (the south one broken by the gate), the tower hollows, the gate cheeks.
const inArc = (i) => INRING.slice(i * 17, i * 17 + 17);
main.push(path_(D([[GX - GW, Y1 - h], [X0 + cut, Y1 - h]])));
main.push(path_(D([[X0 + h, Y1 - cut], [X0 + h, Y0 + cut]])));
main.push(path_(D([[X0 + cut, Y0 + h], [X1 - cut, Y0 + h]])));
main.push(path_(D([[X1 - h, Y0 + cut], [X1 - h, Y1 - cut]])));
main.push(path_(D([[X1 - cut, Y1 - h], [GX + GW, Y1 - h]])));
for (let i = 0; i < 4; i++) main.push(path_(D(inArc(i))));
for (const [cx, cy] of TOW) main.push(circle(cx, cy, RI));
main.push(line(GX - GW, Y1 + h, GX - GW, Y1 - h), line(GX + GW, Y1 + h, GX + GW, Y1 - h));

// L-det: the masonry hatched close, the tower hollows left open, the gate cut out.
const gateHole = [[GX - GW, Y1 - h - 1], [GX + GW, Y1 - h - 1], [GX + GW, Y1 + h + 1], [GX - GW, Y1 + h + 1]];
const hollows = TOW.map(([cx, cy]) => circlePts(cx, cy, RI, 40));
det.push(...sweep(hatchSegs([OUTRING, INRING, gateHole, ...hollows], -45, 5.6), GX, (Y0 + Y1) / 2, 14));
// the walls' shadow on the garden, light from the north-west: a narrow strip of close
// hatching inside the north and west walls
{
  const sw = 9, x0 = X0 + h, y0 = Y0 + h;
  const north = [[x0 + cut - h, y0], [GX - 12, y0], [GX - 12, y0 + sw], [x0 + cut - h + sw, y0 + sw]];
  const north2 = [[GX + 12, y0], [X1 - cut, y0], [X1 - cut - sw * 0.6, y0 + sw], [GX + 12, y0 + sw]];
  const west = [[x0, y0 + cut - h], [x0 + sw, y0 + cut - h + sw], [x0 + sw, Y1 - cut - sw], [x0, Y1 - cut]];
  for (const poly of [north, north2, west]) det.push(path_(segsD(hatchSegs([poly], 45, 3.2))));
}
// in each tower: a newel stair, drawn as radial treads round the hollow
for (const [cx, cy] of TOW) {
  let d = "";
  for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI + 0.2; d += `M${P(cx + 5 * Math.cos(a), cy + 5 * Math.sin(a))}L${P(cx + (RI - 3) * Math.cos(a), cy + (RI - 3) * Math.sin(a))}`; }
  det.push(path_(d), circle(cx, cy, 5));
}

// L-det: hachures off the outer face of the walls (buttress ticks), long every fourth.
for (const [kind, pts] of outer) {
  if (kind !== "wall") continue;
  const [a, b] = pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], o = [u[1], -u[0]];
  let d = "";
  for (let t = 9, k = 0; t < L - 8; t += 11, k++) {
    const x = a[0] + u[0] * t, y = a[1] + u[1] * t;
    if (Math.abs(x - GX) < GW + 44 && y > Y1) continue;
    const len = k % 4 === 0 ? 15 : 7;
    d += `M${P(x + o[0] * 2.5, y + o[1] * 2.5)}L${P(x + o[0] * (len + 2.5), y + o[1] * (len + 2.5))}`;
  }
  det.push(path_(d));
}
// L-con: the ditch, dashed, round the towers and along the walls, opened for the causeway.
{
  const M = 40, RM = R + 24;
  const dx = Math.sqrt(RM * RM - (M + h) ** 2);
  const keep = (x, y) => !(Math.abs(x - GX) < 32 && y > Y1);
  const seg = (x1, y1, x2, y2) => con.push(path_(dashes(x1, y1, x2, y2, 11, 6, keep)));
  seg(X0 + dx, Y1 + h + M, GX - 40, Y1 + h + M); seg(GX + 40, Y1 + h + M, X1 - dx, Y1 + h + M);
  seg(X0 - h - M, Y1 - dx, X0 - h - M, Y0 + dx);
  seg(X0 + dx, Y0 - h - M, X1 - dx, Y0 - h - M);
  seg(X1 + h + M, Y0 + dx, X1 + h + M, Y1 - dx);
  const ra = (cx, cy, a0, a1) => {
    const n = 22, pts = arcPts(cx, cy, RM, a0, a1, n);
    let d = "";
    for (let i = 0; i < n; i += 2) d += `M${P(...pts[i])}L${P(...pts[i + 1])}`;
    con.push(path_(d));
  };
  const A = (x, y) => Math.atan2(y, x);
  ra(X0, Y1, A(dx, M + h), A(-(M + h), -dx) + 2 * Math.PI);
  ra(X0, Y0, A(-(M + h), dx), A(dx, -(M + h)) + 2 * Math.PI);
  ra(X1, Y0, A(-dx, -(M + h)) + 2 * Math.PI, A(M + h, dx) + 2 * Math.PI);
  ra(X1, Y1, A(M + h, -dx), A(-dx, M + h));
}

// ---------------------------------------------------------------- the gate, locked

const WO = Y1 + h, WI = Y1 - h; // outer and inner faces of the south wall
// two drum towers flanking the gate, their masonry hatched
for (const sx of [-1, 1]) {
  const cx = GX + sx * (GW + 19);
  main.push(path_(arcD(cx, WO, 19, 0, Math.PI)));
  det.push(path_(arcD(cx, WO, 10, 0, Math.PI)));
  det.push(path_(segsD(hatchSegs([[...arcPts(cx, WO, 18, 0, Math.PI, 20), ...arcPts(cx, WO, 11, Math.PI, 0, 12)]], 45, 4))));
}
// the closed leaves: rails and boards
det.push(path_(D([[GX - GW + 3, WI + 6], [GX + GW - 3, WI + 6]]) + D([[GX - GW + 3, WO - 6], [GX + GW - 3, WO - 6]])));
{
  let d = "";
  for (let x = GX - GW + 7; x < GX + GW - 3; x += 7) if (Math.abs(x - GX) > 2) d += `M${P(x, WI + 2)}L${P(x, WO - 2)}`;
  det.push(path_(d));
}
main.push(line(GX, WI, GX, WO));
// causeway over the ditch
det.push(path_(D([[GX - 24, WO + 24], [GX - 24, WO + 66]]) + D([[GX + 24, WO + 24], [GX + 24, WO + 66]])));
{
  let d = "";
  for (let y = WO + 50; y < WO + 67; y += 5.5) d += `M${P(GX - 24, y)}L${P(GX + 24, y)}`;
  det.push(path_(d));
}
// the padlock, hung across the meeting of the leaves
{
  const lx = GX, ly = WO - 10, bw = 46, bh = 38, sr = 14;
  main.push(path_(`M${P(lx - sr, ly + 10)}L${P(lx - sr, ly)}A${sr} ${sr} 0 0 1 ${P(lx + sr, ly)}L${P(lx + sr, ly + 10)}`));
  det.push(path_(`M${P(lx - sr + 6, ly + 10)}L${P(lx - sr + 6, ly)}A${sr - 6} ${sr - 6} 0 0 1 ${P(lx + sr - 6, ly)}L${P(lx + sr - 6, ly + 10)}`));
  main.push(rect(lx - bw / 2, ly + 10, bw, bh, 5));
  det.push(path_(segsD(hatchSegs([[[lx + 8, ly + 13], [lx + bw / 2 - 3, ly + 13], [lx + bw / 2 - 3, ly + bh + 7], [lx + 8, ly + bh + 7]]], 90, 4))));
  det.push(circle(lx - 4, ly + 25, 4.5), path_(`M${P(lx - 6.5, ly + 28)}L${P(lx - 8, ly + 38)}L${P(lx, ly + 38)}L${P(lx - 1.5, ly + 28)}`));
}

// ---------------------------------------------------------------- inside: the garden of folders

con.push(centreLine(GX, Y0 + h + 8, GX, WI - 8));
// the walk: from the gate up the axis between the garden and the readers
det.push(path_(D([[GX - 12, WI], [GX - 12, Y0 + h]])), path_(D([[GX + 12, WI], [GX + 12, Y0 + h]])));
con.push(register(GX, (Y0 + Y1) / 2, 11));

/** A tree in plan: a scalloped crown, shaded to the south-east, its trunk marked. */
function tree(cx, cy, r, seed) {
  const n = 10;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 + seed, am = ((i + 0.5) / n) * Math.PI * 2 + seed, a1 = ((i + 1) / n) * Math.PI * 2 + seed;
    if (i === 0) d += `M${P(cx + r * Math.cos(a), cy + r * Math.sin(a))}`;
    if (i < n) {
      const bulge = 1.2 + 0.08 * rand(i, seed * 9 + 1);
      d += `Q${P(cx + r * bulge * Math.cos(am), cy + r * bulge * Math.sin(am))} ${P(cx + r * Math.cos(a1), cy + r * Math.sin(a1))}`;
    }
  }
  det.push(path_(d));
  // shade: a crescent of close lines on the south-east, outside a lit disc shifted north-west
  const lc = [cx - r * 0.3, cy - r * 0.3], lr = r * 0.9;
  const segs = hatchSegs([circlePts(cx, cy, r * 0.98)], 45, 3.3).flatMap((sg) => outsideCircle(sg, lc, lr));
  det.push(path_(segsD(segs)));
  det.push(circle(cx, cy, 2.4));
}
const TREES = [
  ["innernet", 322, 284], ["linear-clone", 462, 340],
  ["computing-age", 322, 420], ["space-drift", 462, 476],
  ["makepad", 322, 556],
];
TREES.forEach(([name, x, y], i) => {
  tree(x, y, 27, i * 0.9 + 0.3);
  lbl.push(mono(x, y + 54, name, { anchor: "middle", size: 17, ls: 1 }));
});
// the rest of the orchard: thousands of folders, a quincunx of saplings between the named trees
{
  const keepOut = [
    ...TREES.flatMap(([name, x, y]) => [[x - 36, y - 36, x + 36, y + 34], [x - name.length * 5.8 - 10, y + 36, x + name.length * 5.8 + 10, y + 62]]),
    [424, 566, 504, 690], // the sealed file and its label
    [280, 708, 506, 744], // the note
  ];
  const free = (x, y) => !keepOut.some(([a, b, c, d]) => x > a - 6 && x < c + 6 && y > b - 6 && y < d + 6);
  let row = 0, d = "";
  for (let y = 240; y < WI - 18; y += 22, row++) {
    for (let x = 242 + (row % 2) * 13; x < GX - 22; x += 26) {
      if (!free(x, y)) continue;
      d += `M${P(x + 3.6, y)}A3.6 3.6 0 1 1 ${P(x - 3.6, y)}A3.6 3.6 0 1 1 ${P(x + 3.6, y)}`;
    }
  }
  det.push(path_(d));
}

// the sealed file: .env is never opened, tied shut and sealed
{
  const x = 437, y = 578, w = 50, h = 64, fo = 14;
  main.push(path_(D([[x, y], [x + w - fo, y], [x + w, y + fo], [x + w, y + h], [x, y + h]], true)));
  det.push(path_(D([[x + w - fo, y], [x + w - fo, y + fo], [x + w, y + fo]])));
  det.push(writing(x + 9, y + 22, 26, 3, 9, 4));
  // the cord, crossed over the file
  det.push(path_(D([[x - 6, y + h * 0.62], [x + w + 6, y + h * 0.62]]) + D([[x + w * 0.62, y - 6], [x + w * 0.62, y + h + 6]])));
  // the seal on the knot, with its two tails
  const sx = x + w * 0.62, sy = y + h * 0.62;
  det.push(path_(D([[sx - 4, sy + 9], [sx - 12, sy + 26], [sx - 6, sy + 23], [sx - 3, sy + 29], [sx + 1, sy + 10]]) + D([[sx + 5, sy + 8], [sx + 14, sy + 24], [sx + 7, sy + 22], [sx + 5, sy + 28], [sx + 1, sy + 10]])));
  main.push(circle(sx, sy, 11));
  det.push(path_(segsD(hatchSegs([circlePts(sx, sy, 10.5, 28)], 45, 3.2))));
  lbl.push(mono(x + w / 2, y + h + 34, ".env", { anchor: "middle", size: 18, ls: 2 }));
  lbl.push(note(392, WI - 22, "secrets are never read", { anchor: "middle", size: 24 }));
}

// ---------------------------------------------------------------- inside: the three readers

const CX = 684;

// The index, a ledger
{
  const x = CX - 96, y = 244, w = 192, h = 110;
  main.push(rect(x, y, w, h, 3));
  main.push(line(x + 18, y, x + 18, y + h));
  det.push(path_(D([[x + 18, y + 22], [x + w, y + 22]]) + D([[x + 18, y + 25], [x + w, y + 25]])));
  det.push(path_(D([[x + 92, y], [x + 92, y + h]]) + D([[x + 146, y], [x + 146, y + h]])));
  let holes = "";
  for (let i = 0; i < 5; i++) holes += circle(x + 9, y + 15 + i * 20, 3);
  det.push(holes);
  det.push(writing(x + 28, y + 40, 54, 5, 14, 3), writing(x + 100, y + 40, 38, 2, 14, 7), writing(x + 100, y + 82, 38, 2, 14, 9), writing(x + 154, y + 40, 30, 5, 14, 11));
  // one value blacked out: credential-shaped text is stored as [redacted]
  det.push(rect(x + 100, y + 63, 40, 10));
  det.push(path_(segsD([...hatchSegs([[[x + 100, y + 63], [x + 140, y + 63], [x + 140, y + 73], [x + 100, y + 73]]], 45, 2.6), ...hatchSegs([[[x + 100, y + 63], [x + 140, y + 63], [x + 140, y + 73], [x + 100, y + 73]]], -45, 2.6)])));
  det.push(path_(D([[x + 28, y + 12], [x + 70, y + 12]]) + D([[x + 100, y + 12], [x + 128, y + 12]]) + D([[x + 154, y + 12], [x + 178, y + 12]])));
  lbl.push(mono(CX, y + h + 32, "index.json", { anchor: "middle", size: 21, ls: 1.5 }));
}

// Search, a lens
const LENS = [CX - 6, 466, 44];
{
  const [cx, cy, r] = LENS;
  main.push(circle(cx, cy, r));
  det.push(circle(cx, cy, r - 7));
  const a = deg(135), hx = cx + r * Math.cos(a), hy = cy + r * Math.sin(a);
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, w = 7.5;
  main.push(path_(D([[hx + nx * w, hy + ny * w], [hx + ux * 58 + nx * w, hy + uy * 58 + ny * w], [hx + ux * 64, hy + uy * 64], [hx + ux * 58 - nx * w, hy + uy * 58 - ny * w], [hx - nx * w, hy - ny * w]])));
  det.push(path_([14, 20].map((k) => D([[hx + ux * k + nx * w, hy + uy * k + ny * w], [hx + ux * k - nx * w, hy + uy * k - ny * w]])).join("")));
  det.push(path_(arcD(cx, cy, r - 13, deg(195), deg(255))));
  let d = "";
  for (let k = -2; k <= 2; k++) {
    const yy = cy + k * 10, half = Math.sqrt(Math.max(0, (r - 15) ** 2 - (k * 10) ** 2));
    d += `M${P(cx - half, yy)}L${P(cx + half * (k === 2 ? 0.1 : 0.8), yy)}`;
  }
  det.push(path_(d));
  lbl.push(mono(CX + 22, cy + r + 36, "SEARCH", { anchor: "middle", size: 21, ls: 3 }));
}

// Innerpedia, an open book
const BOOK = { cx: CX, top: 614, hw: 100, h: 62 };
{
  const { cx, top, hw, h } = BOOK;
  const page = (sx) => `M${P(cx, top + 8)}Q${P(cx + sx * hw * 0.5, top - 10)} ${P(cx + sx * hw, top)}L${P(cx + sx * hw, top + h)}Q${P(cx + sx * hw * 0.5, top + h - 12)} ${P(cx, top + h + 6)}Z`;
  main.push(path_(page(-1)), path_(page(1)));
  det.push(path_(`M${P(cx - hw, top + h)}L${P(cx - hw, top + h + 6)}Q${P(cx - hw * 0.5, top + h - 4)} ${P(cx, top + h + 12)}Q${P(cx + hw * 0.5, top + h - 4)} ${P(cx + hw, top + h + 6)}L${P(cx + hw, top + h)}`));
  for (const sx of [-1, 1]) {
    let d = "";
    for (let k = 0; k < 4; k++) {
      const t = 17 + k * 11, x0 = cx + sx * 13, x1 = cx + sx * (hw - 12), len = k === 3 ? 0.55 : 1;
      d += `M${P(x0, top + t + 2)}Q${P(cx + sx * hw * 0.5, top + t - 12)} ${P(x0 + (x1 - x0) * len, top + t - (len < 1 ? 6 : 0))}`;
    }
    det.push(path_(d));
  }
  lbl.push(mono(CX, top + h + 46, "INNERPEDIA", { anchor: "middle", size: 21, ls: 3 }));
}

// ---------------------------------------------------------------- three attempts, struck at the wall

const XIN = X1 - h;
const ROWS = [
  { y: 299, from: CX + 100, label: "SYNC", tgt: [1100, 284] },
  { y: 466, from: LENS[0] + LENS[2] + 6, label: "PING", tgt: [1150, 470] },
  { y: 646, from: CX + 104, label: "FETCH", tgt: [1132, 668] },
];
for (const r of ROWS) {
  const tip = XIN - 4;
  main.push(part("attempt", `M${P(r.from + 6, r.y)}L${P(tip, r.y)}` + arrowHead(tip, r.y, 0, 15)));
  lbl.push(mono(r.from + 6, r.y - 13, r.label, { size: 17, ls: 2 }));
  // the strike: a cross on the arrowhead, where it meets the wall
  const sx = tip - 8, k = 16;
  acc.push(part("strike", D([[sx - k, r.y - k], [sx + k, r.y + k]])), part("strike", D([[sx - k, r.y + k], [sx + k, r.y - k]])));
  // beyond the wall, the path not taken
  const x0 = X1 + h + 52;
  // (no arrowhead: the line ends at an open ring, a destination never reached)
  const ang0 = Math.atan2(r.tgt[1] - r.y, r.tgt[0] - x0), ex = r.tgt[0] - 6 * Math.cos(ang0), ey = r.tgt[1] - 6 * Math.sin(ang0);
  con.push(path_(dashes(x0, r.y, ex - 6 * Math.cos(ang0), ey - 6 * Math.sin(ang0), 5, 6)), circle(ex, ey, 5));
}

// ---------------------------------------------------------------- outside: what never receives a byte

const RX = 1206, LX = 1346; // glyph column centre, label column

// The cloud: a cumulus of circles over a flat base, its underside engraved.
{
  const cx = RX, cy = 262;
  const C = [[cx - 74, cy + 12, 28], [cx - 36, cy - 12, 38], [cx + 12, cy - 28, 46], [cx + 58, cy - 6, 36], [cx + 90, cy + 14, 24]];
  const base = cy + 38, xa = cx - 100, xb = cx + 108;
  const top = [];
  for (let x = xa; x <= xb; x += 3) {
    let y = base;
    for (const [ccx, ccy, rr] of C) if (Math.abs(x - ccx) < rr) y = Math.min(y, ccy - Math.sqrt(rr * rr - (x - ccx) ** 2));
    top.push([x, y]);
  }
  const poly = [...top, [xb, base], [xa, base]];
  const third = Math.floor(top.length / 3);
  main.push(path_(D(top.slice(0, third + 1))), path_(D(top.slice(third, 2 * third + 1))), path_(D(top.slice(2 * third))));
  main.push(path_(`M${P(xa, top[0][1])}Q${P(xa - 6, base)} ${P(xa + 14, base)}L${P(xb - 12, base)}Q${P(xb + 5, base)} ${P(xb, top.at(-1)[1])}`));
  det.push(path_(arcD(cx - 36, cy - 12, 28, deg(205), deg(290)) + arcD(cx + 12, cy - 28, 35, deg(215), deg(305)) + arcD(cx + 58, cy - 6, 26, deg(235), deg(320))));
  det.push(path_(segsD(hatchSegs([poly], 0, 5.5).filter(([a]) => a[1] > cy + 4))));
  // a far wisp
  det.push(path_(`M${P(cx - 92, cy - 62)}A13 13 0 0 1 ${P(cx - 70, cy - 70)}A18 18 0 0 1 ${P(cx - 38, cy - 66)}A10 10 0 0 1 ${P(cx - 26, cy - 54)}L${P(cx - 96, cy - 54)}A9 9 0 0 1 ${P(cx - 92, cy - 62)}`));
  lbl.push(mono(LX, cy - 8, "THE CLOUD", { size: 22, ls: 4 }));
  lbl.push(note(LX, cy + 24, "one local file, never synced", { size: 22 }));
}

// Telemetry: a lattice mast and its waves.
{
  const cx = RX, yb = 560, yt = 400, wb = 36, wt = 6;
  const at = (t) => [wb + (wt - wb) * t, yb + (yt - yb) * t];
  main.push(path_(D([[cx - wb, yb], [cx - wt, yt]])), path_(D([[cx + wb, yb], [cx + wt, yt]])));
  main.push(line(cx, yt, cx, yt - 26), circle(cx, yt - 30, 4.5));
  let d = "";
  const lv = [0, 0.2, 0.38, 0.54, 0.68, 0.8, 0.9, 1];
  for (let i = 0; i < lv.length - 1; i++) {
    const [w0, y0] = at(lv[i]), [w1, y1] = at(lv[i + 1]);
    d += `M${P(cx - w0, y0)}L${P(cx + w0, y0)}M${P(cx - w0, y0)}L${P(cx + w1, y1)}M${P(cx + w0, y0)}L${P(cx - w1, y1)}`;
  }
  det.push(path_(d));
  for (const k of [1, 2, 3]) det.push(path_(arcD(cx, yt - 30, 12 * k + 6, deg(-155), deg(-115)) + arcD(cx, yt - 30, 12 * k + 6, deg(-65), deg(-25))));
  main.push(line(cx - 64, yb, cx + 64, yb));
  let gd = "";
  for (let x = cx - 60; x < cx + 64; x += 7) gd += `M${P(x, yb + 2)}L${P(x - 7, yb + 11)}`;
  det.push(path_(gd));
  lbl.push(mono(LX, 466, "TELEMETRY", { size: 22, ls: 4 }));
  lbl.push(note(LX, 498, "no pings: the one call", { size: 22 }));
  lbl.push(note(LX, 525, "is /api/suggest, local", { size: 22 }));
}

// Third parties: a heap of crates.
{
  const cx = RX, cy = 676, a = 34;
  const cube = (x, y) => {
    const h = a * 0.5;
    main.push(path_(D([[x, y - h], [x + a, y], [x, y + h], [x - a, y]], true)));
    main.push(path_(D([[x - a, y], [x - a, y + a], [x, y + h + a], [x + a, y + a], [x + a, y]])), path_(D([[x, y + h], [x, y + h + a]])));
    det.push(path_(segsD(hatchSegs([[[x, y + h], [x + a, y], [x + a, y + a], [x, y + h + a]]], 90, 5))));
  };
  cube(cx - 36, cy + 2);
  cube(cx + 36, cy + 2);
  cube(cx, cy - 48);
  const yb = cy + 2 + a + 18;
  main.push(line(cx - 92, yb, cx + 92, yb));
  // the same hatched ground the mast stands on
  let gd = "";
  for (let x = cx - 86; x < cx + 94; x += 7) gd += `M${P(x, yb + 2)}L${P(x - 7, yb + 11)}`;
  det.push(path_(gd));
  lbl.push(mono(LX, cy - 8, "THIRD PARTIES", { size: 22, ls: 3 }));
  lbl.push(note(LX, cy + 24, "fonts are self-hosted;", { size: 22 }));
  lbl.push(note(LX, cy + 51, "default-src 'self'", { size: 22 }));
}

// The meter: 0 bytes sent.
{
  const cx = RX, cy = 878, r = 62;
  main.push(circle(cx, cy, r));
  det.push(circle(cx, cy, r - 7));
  const a0 = deg(150), a1 = deg(390), marks = ["0", "KB", "MB", "GB"];
  let d = "";
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((a1 - a0) * i) / 24, L = i % 8 === 0 ? 10 : 5;
    d += `M${P(cx + (r - 8) * Math.cos(a), cy + (r - 8) * Math.sin(a))}L${P(cx + (r - 8 - L) * Math.cos(a), cy + (r - 8 - L) * Math.sin(a))}`;
  }
  det.push(path_(d));
  marks.forEach((m, i) => {
    const a = a0 + ((a1 - a0) * i) / 3;
    const aa = i === 0 ? a - 0.36 : a, rr = i === 0 ? r - 25 : r - 32;
    lbl.push(mono(cx + rr * Math.cos(aa), cy + rr * Math.sin(aa) + 5, m, { anchor: "middle", size: 14, ls: 0 }));
  });
  main.push(path_(D([[cx - 8 * Math.cos(a0), cy - 8 * Math.sin(a0)], [cx + (r - 14) * Math.cos(a0), cy + (r - 14) * Math.sin(a0)]])));
  main.push(circle(cx, cy, 5));
  det.push(circle(cx + (r - 13) * Math.cos(a0 - 0.13), cy + (r - 13) * Math.sin(a0 - 0.13), 2.4));
  lbl.push(mono(LX, cy - 4, "0 BYTES SENT", { size: 22, ls: 3 }));
  lbl.push(note(LX, cy + 28, "nothing leaves the machine", { size: 22 }));
}

// ---------------------------------------------------------------- titles of the two grounds

lbl.push(mono(GX, 100, "THIS MACHINE", { anchor: "middle", size: 22, ls: 6 }));
// engraved rules either side of the two titles, with end ticks
for (const [x1, x2] of [[X0 - 30, GX - 130], [GX + 130, X1 + 30]]) con.push(path_(D([[x1, 92], [x2, 92]]) + D([[x1, 86], [x1, 98]]) + D([[x2, 86], [x2, 98]])));
con.push(path_(D([[RX + 40, 92], [1560, 92]]) + D([[1560, 86], [1560, 98]])));
lbl.push(mono(RX - 100, 100, "OUTSIDE", { size: 22, ls: 6 }));
lbl.push(mono(GX, Y1 + 122, "127.0.0.1", { anchor: "middle", size: 28, ls: 3 }));
lbl.push(note(GX, Y1 + 156, "only this machine is served", { anchor: "middle", size: 26 }));
lbl.push(mono(GX, Y1 + 190, "ANY OTHER HOST: 403", { anchor: "middle", size: 18, ls: 2 }));

// a north point, as on any garden plan (the shading above takes its light from the north-west)
{
  const cx = 96, cy = 914, r = 22;
  con.push(circle(cx, cy, r), circle(cx, cy, r - 6));
  let d = "";
  for (let k = 0; k < 16; k++) { const a = (k / 16) * 2 * Math.PI, L = k % 4 === 0 ? 7 : 3; d += `M${P(cx + r * Math.cos(a), cy + r * Math.sin(a))}L${P(cx + (r + L) * Math.cos(a), cy + (r + L) * Math.sin(a))}`; }
  con.push(path_(d));
  main.push(path_(D([[cx, cy - r - 6], [cx + 6, cy], [cx, cy + r - 4], [cx - 6, cy]], true)));
  det.push(path_(segsD(hatchSegs([[[cx, cy - r - 6], [cx + 6, cy], [cx, cy + r - 4]]], 90, 2.2))));
  lbl.push(mono(cx, cy - r - 14, "N", { anchor: "middle", size: 18, ls: 0 }));
}

for (const [x, y] of [[40, 40], [1560, 40], [40, 960], [1560, 960]]) con.push(register(x, y, 14));

writePlate("privacy", "Private by design: the machine as a walled garden, and nothing leaves it", { con, main, det, acc, lbl });
