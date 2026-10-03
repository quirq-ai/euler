// codebase: the Innernet codebase as one engraved machine room.
//
// Left to right, standing on one ground line (this machine): the folders under
// ~/Programming feed a screw press (scripts/build-index.ts), which prints one ledger
// (data/index.json). Through the left wall of the server a lens (lib/data.ts) reads the
// ledger and brings it to a focus; a gear train (lib/search.ts) turns on what the lens
// hands it. app/ is a cabinet of routes, components/ a cabinet of drawers: both render
// on the server. The only way out is the gatehouse in the right wall (proxy.ts,
// 127.0.0.1), and beyond it the browser. L-acc carries the one idea: the path the data
// travels, out as HTML and back only as /api/suggest.
//
// Facts (FACTS.md, checked against the code): the indexer runs outside Next and writes
// data/index.json (about 7.9 MB); lib/data.ts stats it on every access and reloads when
// it changes; lib/search.ts builds MiniSearch over it; both import server-only; pages are
// Server Components; the only browser request is /api/suggest; proxy.ts answers 403
// unless the Host is localhost; the server binds 127.0.0.1:3470.
//
// run: node assets/plates/src/codebase.mjs

import {
  P, r1, line, circle, rect, path_, mono, note, centreLine, arrowHead, arrow,
  hatch, ticks, folder, file, writing, register, writePlate,
} from "./lib.mjs";

const con = [], main = [], det = [], acc = [], lbl = [];

// ------------------------------------------------------------------ local helpers

/** Mono text rotated about its anchor point (the gate's plaque). */
const monoRot = (x, y, s, deg, { size = 18, ls = 2 } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" transform="rotate(${deg} ${r1(x)} ${r1(y)})" text-anchor="middle" font-size="${size}" letter-spacing="${ls}" class="mono" font-family="JetBrains Mono, ui-monospace, monospace" fill="currentColor">${s}</text>`;

/** A toothed gear outline as one path. */
function gear(cx, cy, rp, n, depth, phase = 0) {
  const s = (Math.PI * 2) / n, ro = rp + depth / 2, ri = rp - depth / 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = phase + i * s;
    for (const [k, rr] of [[0, ri], [0.36, ri], [0.5, ro], [0.86, ro]]) pts.push([cx + rr * Math.cos(a + k * s), cy + rr * Math.sin(a + k * s)]);
  }
  return path_("M" + pts.map(([x, y]) => P(x, y)).join("L") + "Z");
}

/** A dashed polyline as many short paths, so it draws on dash by dash. */
function dashedPath(pts, dash = 13, gap = 8) {
  const out = [];
  let carry = 0, on = true;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    let t = 0;
    while (t < L) {
      const seg = Math.min((on ? dash : gap) - carry, L - t);
      if (on) out.push(path_(`M${P(x1 + ux * t, y1 + uy * t)}L${P(x1 + ux * (t + seg), y1 + uy * (t + seg))}`));
      t += seg;
      carry += seg;
      if (carry >= (on ? dash : gap) - 1e-6) { carry = 0; on = !on; }
    }
  }
  return out;
}

/** Bolt head: a circle with a slot. */
const bolt = (x, y, r = 4.5) => `${circle(x, y, r)}${path_(`M${P(x - r * 0.6, y - r * 0.6)}L${P(x + r * 0.6, y + r * 0.6)}`)}`;

/** Ashlar courses (stone joints) over a rectangle, skipping a window. */
function ashlar(x, y, w, h, course = 22, skip = null) {
  let d = "";
  const inSkip = (yy) => skip && yy > skip.y && yy < skip.y + skip.h;
  for (let k = 1, yy = y + course; yy < y + h; yy += course, k++) {
    if (inSkip(yy)) {
      d += `M${P(x, yy)}L${P(skip.x, yy)}M${P(skip.x + skip.w, yy)}L${P(x + w, yy)}`;
    } else d += `M${P(x, yy)}L${P(x + w, yy)}`;
    const jx = x + (k % 2 ? w * 0.36 : w * 0.7), y0 = yy - course;
    const mid = y0 + course / 2;
    if (!(skip && jx > skip.x && jx < skip.x + skip.w && mid > skip.y && mid < skip.y + skip.h)) d += `M${P(jx, y0)}L${P(jx, yy)}`;
  }
  return path_(d);
}

/** Ground hatching: short strokes under a line, as on a section. */
function groundHatch(x1, x2, y, step = 16, len = 10) {
  let d = "";
  for (let x = x1 + len; x <= x2; x += step) d += `M${P(x, y)}L${P(x - len * 0.7, y + len)}`;
  return path_(d);
}

// ------------------------------------------------------------------ geometry

const GY = 730;                      // ground: everything here stands on this machine
const RY = 120, T = 18;              // server roof (outer top) and wall thickness
const EX0 = 640, EX1 = 1300;         // server walls, outer faces
const IX0 = EX0 + T;                 // interior left
const AY = 400;                      // optical axis: ledger, lens, focus
const PX = 270;                      // press centre line
const LX = 516;                      // ledger centre line
const LENSX = EX0 + T / 2;           // the lens sits in the left wall
const FX = 772;                      // its focus
const G1 = { x: 770, y: 604, r: 56, n: 24 };
const G2a = -0.72, G2r = 32;
const G2 = { x: G1.x + (G1.r + G2r) * Math.cos(G2a), y: G1.y + (G1.r + G2r) * Math.sin(G2a), r: G2r, n: 14 };
const CAB = { x: 990, y: 214, w: 214, row: 44, rows: ["/", "/wiki/[slug]", "/guide", "/search", "/api/suggest"] };
CAB.h = CAB.row * CAB.rows.length + 14;
const rowY = (i) => CAB.y + 7 + (i + 0.5) * CAB.row;
const DRW = { x: 990, y: 512, w: 214, h: 44, names: ["home", "search", "wiki", "guide"] };
DRW.H = DRW.h * DRW.names.length + 12;
const GATE = { x0: 1262, x1: 1326, top: 92, p0: 420, p1: 590 };
GATE.cx = (GATE.x0 + GATE.x1) / 2;
const BR = { x0: 1384, x1: 1560, y0: 330, y1: 548 };
BR.cx = (BR.x0 + BR.x1) / 2;
const HTML_Y = 524, ASK_Y = 472;     // the two crossings of the gate

// ------------------------------------------------------------------ L-con: construction

for (const [x, y] of [[40, 40], [1560, 40], [40, 960], [1560, 960]]) con.push(register(x, y, 14));
con.push(centreLine(LX + 96, AY, FX + 44, AY));                    // optical axis
con.push(centreLine(PX, 150, PX, GY + 16));                        // press centre line
con.push(centreLine(LX, 300, LX, GY + 16));                        // ledger centre line
con.push(centreLine(BR.cx, BR.y0 - 20, BR.cx, GY + 16));            // browser centre line
con.push(centreLine(GATE.cx, GATE.top - 24, GATE.cx, GY + 16));     // gate centre line
for (const g of [G1, G2]) {
  con.push(circle(g.x, g.y, g.r));                                 // pitch circles
  con.push(line(g.x - g.r - 16, g.y, g.x + g.r + 16, g.y), line(g.x, g.y - g.r - 16, g.x, g.y + g.r + 16));
}
con.push(line(G1.x, G1.y, G2.x, G2.y));                            // line of centres
// rays from the ledger through the lens to the focus
for (const dy of [-50, -34, -18, 18, 34, 50]) con.push(path_(`M${P(LX + 84, AY + dy)}L${P(LENSX, AY + dy)}L${P(FX, AY)}`));
con.push(circle(FX, AY, 18));
// the ledger's width, dimensioned
{
  const y = 318, L = LX - 84, R = LX + 84;
  con.push(line(L, y - 10, L, 338), line(R, y - 10, R, 338));
  con.push(path_(`M${P(L, y)}L${P(LX - 44, y)}` + arrowHead(L, y, Math.PI, 9)));
  con.push(path_(`M${P(LX + 44, y)}L${P(R, y)}` + arrowHead(R, y, 0, 9)));
}
// overall dimension: this machine
const DY = 856;
con.push(line(44, GY + 30, 44, DY + 14), line(1556, GY + 30, 1556, DY + 14));
con.push(path_(`M${P(44, DY)}L${P(684, DY)}` + arrowHead(44, DY, Math.PI, 11)));
con.push(path_(`M${P(916, DY)}L${P(1556, DY)}` + arrowHead(1556, DY, 0, 11)));
// a surveyor's base line under the ground
con.push(line(44, GY + 24, 1556, GY + 24));
con.push(ticks(44, GY + 24, 1556, GY + 24, 75, 4, 5, -1));

// ------------------------------------------------------------------ the folders (input)

{
  const fx = 46, fy = 410;
  for (let i = 2; i >= 0; i--) main.push(folder(fx + i * 9, fy - i * 11, 84, 60));
  det.push(writing(fx + 12, fy + 30, 56, 2, 12, 3));
}

// ------------------------------------------------------------------ the press: scripts/build-index.ts

{
  // base and uprights
  main.push(rect(PX - 116, 690, 232, 40));
  det.push(hatch(PX - 116, 690, 232, 40, 9, -45));
  for (const x of [PX - 94, PX + 70]) {
    main.push(rect(x, 256, 24, 434));
    det.push(hatch(x, 256, 24, 434, 8, -45));
  }
  // head with its crown
  main.push(rect(PX - 110, 210, 220, 46));
  main.push(path_(`M${P(PX - 76, 210)}Q${P(PX, 166)} ${P(PX + 76, 210)}`));
  det.push(hatch(PX - 110, 210, 34, 46, 8, -45), hatch(PX + 76, 210, 34, 46, 8, -45));
  main.push(rect(PX - 70, 218, 140, 30, 3));                       // nameplate
  lbl.push(mono(PX, 239, "pnpm index", { size: 18, ls: 1, anchor: "middle" }));
  det.push(path_(`M${P(PX - 54, 210)}Q${P(PX, 180)} ${P(PX + 54, 210)}`));
  det.push(circle(PX, 196, 5));
  for (const x of [PX - 93, PX + 93]) det.push(bolt(x, 233));
  for (const x of [PX - 100, PX + 100]) det.push(bolt(x, 710));
  // screw, collar and the bar
  main.push(rect(PX - 18, 256, 36, 16));
  main.push(line(PX - 8, 272, PX - 8, 350), line(PX + 8, 272, PX + 8, 350));
  {
    let d = "";
    for (let y = 276; y < 346; y += 7) d += `M${P(PX - 8, y)}L${P(PX + 8, y + 5)}`;
    det.push(path_(d));
  }
  main.push(rect(PX - 22, 296, 44, 16));
  main.push(path_(`M${P(PX - 22, 304)}L${P(122, 272)}`));
  main.push(circle(114, 270, 9));
  det.push(circle(114, 270, 3.5));
  // platen
  main.push(rect(PX - 14, 350, 28, 10));
  main.push(rect(PX - 66, 360, 132, 24));
  det.push(hatch(PX - 66, 360, 132, 24, 7, 45));
  for (const x of [PX - 36, PX, PX + 36]) det.push(arrow(x, 392, x, 412, 7));
  // the forme of type on the bed
  main.push(rect(PX - 58, 418, 116, 12));
  {
    let d = "";
    for (let x = PX - 52; x < PX + 56; x += 8) d += `M${P(x, 420)}L${P(x, 428)}`;
    det.push(path_(d));
  }
  // the bed, running out to the right on a bracket
  main.push(rect(PX - 84, 430, 194, 22));
  det.push(hatch(PX - 84, 430, 194, 22, 10, -45));
  main.push(path_(`M${P(PX + 94, 452)}L${P(PX + 110, 474)}L${P(PX + 110, 452)}`));
  // stretcher
  main.push(rect(PX - 70, 600, 140, 14));
  det.push(hatch(PX - 70, 600, 140, 14, 9, -45));
}

// ------------------------------------------------------------------ the ledger: data/index.json

{
  const top = 346, bot = 456, half = 82, sag = 12;
  const L = LX - half, R = LX + half;
  main.push(path_(`M${P(L, top + 8)}Q${P(LX - half / 2, top - 4)} ${P(LX, top + sag)}L${P(LX, bot)}Q${P(LX - half / 2, bot - 14)} ${P(L, bot - 2)}Z`));
  main.push(path_(`M${P(R, top + 8)}Q${P(LX + half / 2, top - 4)} ${P(LX, top + sag)}L${P(LX, bot)}Q${P(LX + half / 2, bot - 14)} ${P(R, bot - 2)}Z`));
  for (const k of [4, 8]) {
    det.push(path_(`M${P(L + 2, bot - 2 + k)}Q${P(LX - half / 2, bot - 14 + k)} ${P(LX, bot + k)}Q${P(LX + half / 2, bot - 14 + k)} ${P(R - 2, bot - 2 + k)}`));
  }
  // ruled ledger: rows and column rules on both pages
  for (let i = 0; i < 8; i++) {
    const y = top + 30 + i * 10;
    det.push(path_(`M${P(L + 10, y)}L${P(LX - 8, y + 3)}M${P(LX + 8, y + 3)}L${P(R - 10, y)}`));
  }
  det.push(line(L + 30, top + 22, L + 30, bot - 10), line(R - 30, top + 22, R - 30, bot - 10), line(LX + 30, top + 26, LX + 30, bot - 8));
  det.push(path_(`M${P(L + 10, top + 19)}L${P(L + 60, top + 21)}M${P(LX + 10, top + 23)}L${P(LX + 54, top + 21)}`));
  // ribbon
  main.push(path_(`M${P(LX - 3, bot + 6)}L${P(LX - 6, bot + 40)}L${P(LX + 1, bot + 33)}L${P(LX + 6, bot + 40)}L${P(LX + 3, bot + 6)}`));
  // lectern
  main.push(rect(LX - 92, 470, 184, 10));
  main.push(rect(LX - 8, 480, 16, 210));
  main.push(path_(`M${P(LX - 40, 690)}L${P(LX + 40, 690)}L${P(LX + 60, GY)}L${P(LX - 60, GY)}Z`));
  det.push(hatch(LX - 60, 690, 120, 40, 9, -45));
  det.push(line(LX - 8, 506, LX - 34, 480), line(LX + 8, 506, LX + 34, 480));
}

// ------------------------------------------------------------------ the server: roof and walls

{
  const lensGap = [AY - 88, AY + 88];
  main.push(rect(EX0, RY, GATE.x0 - EX0, T));                      // roof slab, up to the tower
  det.push(hatch(EX0, RY, GATE.x0 - EX0, T, 8, -45));
  for (const [y0, y1] of [[RY, lensGap[0]], [lensGap[1], GY]]) {    // left wall, broken for the lens
    main.push(rect(EX0, y0 + (y0 === RY ? T : 0), T, y1 - y0 - (y0 === RY ? T : 0)));
    det.push(hatch(EX0, y0 + (y0 === RY ? T : 0), T, y1 - y0 - (y0 === RY ? T : 0), 8, -45));
  }
  det.push(line(IX0, GY - 8, GATE.x0, GY - 8));                     // the floor
  {                                                                 // dentils under the roof
    let d = "";
    for (let x = IX0 + 6; x < GATE.x0 - 8; x += 14) d += `M${P(x, RY + T)}L${P(x, RY + T + 6)}L${P(x + 7, RY + T + 6)}L${P(x + 7, RY + T)}`;
    det.push(path_(d));
  }
}

// ------------------------------------------------------------------ the gatehouse: proxy.ts

{
  const g = GATE, w = g.x1 - g.x0;
  // tower above the passage, with merlons, and below it
  const merlon = 13;
  let d = `M${P(g.x0, g.p0 + 22)}L${P(g.x0, g.top)}`;
  for (let i = 0; i < 3; i++) {
    const x = g.x0 + i * (w - merlon) / 2;
    d += `L${P(x + merlon, g.top)}`;
    if (i < 2) d += `L${P(x + merlon, g.top + 12)}L${P(x + (w - merlon) / 2, g.top + 12)}L${P(x + (w - merlon) / 2, g.top)}`;
  }
  d += `L${P(g.x1, g.top)}L${P(g.x1, g.p0 + 22)}`;
  main.push(path_(d));
  main.push(line(g.x0 - 6, g.top + 22, g.x1 + 6, g.top + 22));   // string course
  main.push(path_(`M${P(g.x0, g.p0 + 22)}Q${P(g.cx, g.p0 - 14)} ${P(g.x1, g.p0 + 22)}`)); // arch
  det.push(path_(`M${P(g.x0 + 8, g.p0 + 22)}Q${P(g.cx, g.p0 - 2)} ${P(g.x1 - 8, g.p0 + 22)}`));
  main.push(rect(g.x0, g.p1, w, GY - g.p1));
  main.push(line(g.x0 - 6, g.p1, g.x1 + 6, g.p1));                 // threshold
  // the plaque that names the only address it answers to
  const pl = { x: g.cx - 15, y: 186, w: 30, h: 168 };
  // a padlock over it
  main.push(rect(g.cx - 11, 150, 22, 18, 2));
  main.push(path_(`M${P(g.cx - 7, 150)}L${P(g.cx - 7, 143)}A7 7 0 0 1 ${P(g.cx + 7, 143)}L${P(g.cx + 7, 150)}`));
  det.push(circle(g.cx, 157, 2.2), line(g.cx, 159, g.cx, 164));
  main.push(rect(pl.x, pl.y, pl.w, pl.h, 3));
  det.push(circle(g.cx, pl.y + 8, 2.5), circle(g.cx, pl.y + pl.h - 8, 2.5));
  // masonry
  det.push(ashlar(g.x0, g.top + 22, w, g.p0 - g.top - 22, 22, { x: pl.x - 6, y: 134, w: pl.w + 12, h: pl.y + pl.h + 6 - 134 }));
  det.push(ashlar(g.x0, g.p1, w, GY - g.p1, 22));
  // the raised portcullis: its teeth just show under the arch
  {
    let t = "";
    for (let x = g.x0 + 10; x < g.x1 - 4; x += 11) t += `M${P(x, g.p0 + 8)}L${P(x, g.p0 + 22)}l-3,0l3,7l3,-7l-3,0`;
    det.push(path_(t));
  }
  // jambs of the passage, and its shadow
  det.push(line(g.x0 + 8, g.p0 + 22, g.x0 + 8, g.p1), line(g.x1 - 8, g.p0 + 22, g.x1 - 8, g.p1));
  // the two gate leaves, swung open against the jambs
  for (const [xa, xb] of [[g.x0 + 8, g.x0 + 19], [g.x1 - 8, g.x1 - 19]]) {
    main.push(path_(`M${P(xa, g.p0 + 24)}L${P(xb, g.p0 + 34)}L${P(xb, g.p1 - 8)}L${P(xa, g.p1)}`));
    det.push(path_(`M${P((xa + xb) / 2, g.p0 + 30)}L${P((xa + xb) / 2, g.p1 - 4)}`));
    for (const t of [0.3, 0.7]) det.push(circle(xa + (xb - xa) * 0.5, g.p0 + 34 + (g.p1 - g.p0 - 40) * t, 1.8));
  }
}

// ------------------------------------------------------------------ the lens: lib/data.ts

{
  const top = AY - 70, bot = AY + 70;
  main.push(path_(`M${P(LENSX, top)}Q${P(LENSX + 30, AY)} ${P(LENSX, bot)}Q${P(LENSX - 30, AY)} ${P(LENSX, top)}Z`));
  for (const [y0, h] of [[top - 18, 18], [bot, 18]]) {
    main.push(rect(LENSX - 22, y0, 44, h));
    det.push(hatch(LENSX - 22, y0, 44, h, 6, 45));
  }
  det.push(path_(`M${P(LENSX - 6, top + 4)}Q${P(LENSX + 16, AY)} ${P(LENSX - 6, bot - 4)}`));
  // the barrel, opening into the room
  main.push(path_(`M${P(LENSX + 22, top - 18)}L${P(LENSX + 64, top + 2)}L${P(LENSX + 64, bot - 2)}L${P(LENSX + 22, bot + 18)}`));
  det.push(line(LENSX + 36, top - 11, LENSX + 36, bot + 11), line(LENSX + 50, top - 5, LENSX + 50, bot + 5));
  det.push(circle(FX, AY, 5));
}

// ------------------------------------------------------------------ the gears: lib/search.ts

{
  main.push(gear(G1.x, G1.y, G1.r, G1.n, 10, 0.1));
  main.push(gear(G2.x, G2.y, G2.r, G2.n, 9, 0.18));
  main.push(circle(G1.x, G1.y, 15), circle(G2.x, G2.y, 9));
  det.push(circle(G1.x, G1.y, G1.r - 13), circle(G1.x, G1.y, 6), circle(G2.x, G2.y, G2.r - 11), circle(G2.x, G2.y, 3));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, ri = 15, ro = G1.r - 13;
    det.push(path_(`M${P(G1.x + ri * Math.cos(a - 0.14), G1.y + ri * Math.sin(a - 0.14))}L${P(G1.x + ro * Math.cos(a - 0.05), G1.y + ro * Math.sin(a - 0.05))}M${P(G1.x + ri * Math.cos(a + 0.14), G1.y + ri * Math.sin(a + 0.14))}L${P(G1.x + ro * Math.cos(a + 0.05), G1.y + ro * Math.sin(a + 0.05))}`));
  }
  // a bracket from the wall carries the big gear
  main.push(path_(`M${P(IX0, G1.y - 10)}L${P(G1.x - 15, G1.y - 6)}M${P(IX0, G1.y + 10)}L${P(G1.x - 15, G1.y + 6)}`));
  main.push(rect(IX0, G1.y - 22, 14, 44));
  det.push(hatch(IX0, G1.y - 22, 14, 44, 6, 45));
}

// ------------------------------------------------------------------ app/: a cabinet of routes

{
  const c = CAB, x = c.x, y = c.y, w = c.w;
  main.push(rect(x, y, w, c.h));
  main.push(rect(x - 6, y - 8, w + 12, 8));
  for (let i = 1; i < c.rows.length; i++) main.push(line(x, y + 7 + i * c.row, x + w, y + 7 + i * c.row));
  c.rows.forEach((route, i) => {
    const ry = y + 7 + i * c.row;
    det.push(file(x + 12, ry + 7, 22, 30));
    det.push(writing(x + 15, ry + 18, 12, 3, 6, i + 2));
    lbl.push(mono(x + 46, ry + 29, route, { size: 19, ls: 0.5 }));
  });
  // plinth, and engraved shade down the far side
  main.push(rect(x - 4, y + c.h, w + 8, 6));
  det.push(hatch(x + w - 8, y, 8, c.h, 5, -45));
}

// ------------------------------------------------------------------ components/: a cabinet of drawers

{
  const d = DRW, x = d.x, y = d.y, w = d.w;
  main.push(rect(x, y, w, d.H));
  main.push(rect(x - 6, y - 8, w + 12, 8));
  d.names.forEach((n, i) => {
    const dy = y + 6 + i * d.h;
    main.push(rect(x + 8, dy + 3, w - 16, d.h - 6));
    det.push(rect(x + 20, dy + 11, 96, 22, 2));                     // label holder
    lbl.push(mono(x + 68, dy + 28, n, { size: 18, ls: 1, anchor: "middle" }));
    det.push(path_(`M${P(x + w - 62, dy + 24)}Q${P(x + w - 42, dy + 38)} ${P(x + w - 22, dy + 24)}`)); // pull
    det.push(circle(x + w - 62, dy + 23, 2.5), circle(x + w - 22, dy + 23, 2.5));
  });
  main.push(path_(`M${P(x + 14, y + d.H)}L${P(x + 14, GY - 8)}M${P(x + w - 14, y + d.H)}L${P(x + w - 14, GY - 8)}`));
  det.push(hatch(x + w - 8, y, 8, d.H, 5, -45));
}

// ------------------------------------------------------------------ the browser

{
  const b = BR;
  main.push(rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 6));
  main.push(line(b.x0, b.y0 + 30, b.x1, b.y0 + 30));
  for (const k of [0, 1, 2]) det.push(circle(b.x0 + 16 + k * 14, b.y0 + 15, 4));
  main.push(rect(b.x0 + 10, b.y0 + 42, b.x1 - b.x0 - 20, 30, 4));   // address bar
  lbl.push(mono(b.x0 + 15, b.y0 + 63, "localhost:3470", { size: 18, ls: -0.4 }));
  // a search box with its suggestions
  main.push(rect(b.x0 + 16, b.y0 + 92, b.x1 - b.x0 - 32, 26, 13));
  det.push(circle(b.x0 + 32, b.y0 + 105, 6), line(b.x0 + 36, b.y0 + 109, b.x0 + 41, b.y0 + 114));
  det.push(line(b.x0 + 48, b.y0 + 105, b.x0 + 96, b.y0 + 105));
  det.push(rect(b.x0 + 16, b.y0 + 124, b.x1 - b.x0 - 32, 52, 3));
  det.push(writing(b.x0 + 28, b.y0 + 138, b.x1 - b.x0 - 70, 3, 13, 7));
  det.push(writing(b.x0 + 16, b.y0 + 196, b.x1 - b.x0 - 40, 1, 13, 4));
  // stand
  main.push(rect(b.cx - 12, b.y1, 24, 142));
  main.push(path_(`M${P(b.cx - 44, 690)}L${P(b.cx + 44, 690)}L${P(b.cx + 62, GY)}L${P(b.cx - 62, GY)}Z`));
  det.push(hatch(b.cx - 62, 690, 124, 40, 9, -45));
}

// ------------------------------------------------------------------ ground

main.push(line(28, GY, 1572, GY));
det.push(groundHatch(44, 1556, GY + 2));

// a request from anywhere else, stopped at the gate (drawn in ink: the gate's other side)
{
  const y = 238, x0 = 1556, x1 = GATE.x1 + 14;
  det.push(path_(`M${P(x0, y)}L${P(x1, y)}` + arrowHead(x1, y, Math.PI, 10)));
  main.push(path_(`M${P(GATE.x1 + 6, y - 15)}L${P(GATE.x1 + 6, y + 15)}`));
}

// ------------------------------------------------------------------ L-acc: the path the data travels

// 1 the press reads the folders
acc.push(arrow(138, 441, PX - 98, 441, 12));
// 2 and writes the ledger
acc.push(path_(`M${P(PX + 116, 441)}Q${P(410, 441)} ${P(LX - 76, 414)}` + arrowHead(LX - 76, 414, Math.atan2(414 - 441, LX - 76 - 410), 12)));
// 3 the lens reads the ledger and brings it to a focus
acc.push(path_(`M${P(LX + 92, AY)}L${P(FX - 9, AY)}` + arrowHead(FX - 9, AY, 0, 12)));
// 4 data.ts hands the index to the pages
{
  const ex = CAB.x - 8, ey = rowY(1);
  acc.push(path_(`M${P(FX + 7, AY - 5)}L${P(ex, ey)}` + arrowHead(ex, ey, Math.atan2(ey - AY + 5, ex - FX - 7), 12)));
}
// 5 and turns search.ts
acc.push(path_(`M${P(FX, AY + 9)}L${P(FX, G1.y - G1.r - 14)}` + arrowHead(FX, G1.y - G1.r - 14, Math.PI / 2, 12)));
// 6 search.ts answers /search
{
  const sx = G2.x + G2.r + 10, sy = G2.y, cx = 930, ex = CAB.x - 8, ey = rowY(3);
  acc.push(path_(`M${P(sx, sy)}Q${P(cx, sy)} ${P(ex, ey)}` + arrowHead(ex, ey, Math.atan2(ey - sy, ex - cx), 12)));
}
// 7 the pages hand their data to the components
{
  const x = CAB.x + CAB.w - 28;
  acc.push(path_(`M${P(x, CAB.y + CAB.h + 10)}L${P(x, DRW.y - 14)}` + arrowHead(x, DRW.y - 14, Math.PI / 2, 11)));
}
// 8 HTML leaves through the gate, to the browser
acc.push(path_(`M${P(DRW.x + DRW.w + 8, HTML_Y)}L${P(BR.x0 - 10, HTML_Y)}` + arrowHead(BR.x0 - 10, HTML_Y, 0, 13)));
// 9 the one request back: /api/suggest
{
  const vx = 1234, ry = rowY(4);
  for (const s of dashedPath([[BR.x0 - 8, ASK_Y], [vx, ASK_Y], [vx, ry], [CAB.x + CAB.w + 22, ry]])) acc.push(s);
  acc.push(path_(arrowHead(CAB.x + CAB.w + 10, ry, Math.PI, 11)));
}

// ------------------------------------------------------------------ L-lbl

// the folders
lbl.push(mono(94, 504, "~/Programming", { size: 18, ls: 0, anchor: "middle" }));
lbl.push(note(94, 532, "5,484 folders", { size: 22, anchor: "middle" }));
// the ledger's dimension and the focal length
lbl.push(mono(LX, 324, "7.9 MB", { size: 18, ls: 1, anchor: "middle" }));
lbl.push(mono(FX + 12, AY + 34, "F", { size: 18, ls: 0 }));
// under the ground: what stands where
const under = (x, a, b, anchor = "middle") => {
  lbl.push(mono(x, GY + 66, a, { size: 20, ls: 0, anchor }));
  if (b) lbl.push(note(x, GY + 96, b, { size: 23, anchor }));
};
under(PX - 14, "scripts/build-index.ts", "writes the index");
under(LX + 14, "data/index.json", "one local file");
under(1000, "pnpm dev", "Server Components render every page");
under(1556, "your browser", "HTML in, one request out", "end");
// inside the server
lbl.push(mono(IX0 + 18, RY + 62, "lib/data.ts", { size: 20, ls: 0.5 }));
main.push(rect(IX0 + 166, RY + 40, 132, 30, 3));
lbl.push(mono(IX0 + 232, RY + 61, "server-only", { size: 17, ls: 0.5, anchor: "middle" }));
lbl.push(note(IX0 + 18, RY + 92, "reloads when it changes", { size: 22 }));
lbl.push(mono(IX0 + 18, GY - 22, "lib/search.ts", { size: 20, ls: 0.5 }));
lbl.push(note(IX0 + 196, GY - 22, "MiniSearch", { size: 22 }));
lbl.push(mono(CAB.x, CAB.y - 20, "app/", { size: 20, ls: 0.5 }));
lbl.push(mono(DRW.x, DRW.y - 18, "components/", { size: 20, ls: 0.5 }));
// the gate
lbl.push(mono(GATE.cx, GATE.top - 18, "proxy.ts", { size: 20, ls: 0.5, anchor: "middle" }));
lbl.push(monoRot(GATE.cx + 7, 186 + 84, "127.0.0.1", -90, { size: 20, ls: 1.5 }));
lbl.push(note(1556, 222, "any other Host: 403", { size: 22, anchor: "end" }));
lbl.push(mono((GATE.x1 + BR.x0) / 2, HTML_Y - 12, "HTML", { size: 18, ls: 0.5, anchor: "middle" }));
// the dimension
lbl.push(mono(800, DY + 7, "THIS MACHINE", { size: 18, ls: 5, anchor: "middle" }));
lbl.push(note(800, DY + 42, "nothing leaves it", { size: 24, anchor: "middle" }));

writePlate("codebase", "The codebase: a press writes the index, a lens and gears read it, the pages render on the server, and the only door is proxy.ts on 127.0.0.1", { con, main, det, acc, lbl });
