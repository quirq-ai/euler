// contribute: THE LOOP. A clock face (or an orrery seen from above): a chapter ring with
// a minute track and a reeded bezel, five stations set into it (edit, typecheck, crawl,
// screenshot, pull request), each a medallion with an engraved glyph, and at the centre a
// seal: "everything stays local", ringed by the proxy's own words.
// L-acc is the loop itself: the orbit arcs with their arrowheads, and the marker (a bead
// on the orbit and a fine hand from the seal), grouped as .loop-marker with data-cx,
// data-cy and data-deg so a host can turn it about the dial centre.
//
//   node assets/plates/src/contribute.mjs
// Facts (FACTS.md, "Contributing" and "Privacy and security"): pnpm -s typecheck exits 0
// in about 1.1 s; the route crawler checks 211 routes, 0 failing, median 40 ms;
// scripts/shot.sh emulates light or dark and reports horizontal overflow; data/*.json is
// gitignored; the server binds 127.0.0.1 on port 3470 and proxy.ts answers 403
// "Innernet only answers to localhost." to any other Host.

import {
  writePlate, line, circle, rect, path_, mono, note, display,
  centreLine, arrowHead, register, P, r1,
} from "./lib.mjs";

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------- geometry ----------
const C = [800, 525];
const D2R = Math.PI / 180;
const pol = (r, deg, c = C) => [c[0] + r * Math.cos(deg * D2R), c[1] + r * Math.sin(deg * D2R)];
const PP = (r, deg, c = C) => P(...pol(r, deg, c));
/** Arc path on a circle about c, from a0 to a1 degrees (clockwise when a1 > a0). */
function arcD(r, a0, a1, c = C) {
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
  return `M${PP(r, a0, c)}A${r1(r)} ${r1(r)} 0 ${large} ${sweep} ${PP(r, a1, c)}`;
}
const arc = (r, a0, a1, c = C) => path_(arcD(r, a0, a1, c));

const R = 290;          // orbit: the station pitch circle
const MED = 50;         // medallion radius
const GAP = MED + 6;    // clearance around a medallion for rings that pass under it
const RING = { in: 258, track: 308, out: 322, bz0: 334, bz1: 346 };
const SEAL = { out: 160, rim: 152, legend: 133, face: 114 };
const NUM_R = 210;      // the circle the station numerals sit on

const STATIONS = [
  { key: "edit", num: "I", name: "EDIT", cmd: "lib/ · components/ · app/", note: "make the change" },
  { key: "typecheck", num: "II", name: "TYPECHECK", cmd: "pnpm -s typecheck", note: "exits 0 in about 1.1 s" },
  { key: "crawl", num: "III", name: "CRAWL", cmd: "211 routes · 0 failing", note: "median 40 ms, on localhost" },
  { key: "screenshot", num: "IV", name: "SCREENSHOT", cmd: "scripts/shot.sh", note: "light and dark, overflow flagged" },
  { key: "pr", num: "V", name: "PULL REQUEST", cmd: "data/*.json is gitignored", note: "your index never leaves" },
].map((s, i) => ({ ...s, i, deg: -90 + 72 * i }));
for (const s of STATIONS) s.c = pol(R, s.deg);

/** Half-angle (degrees) a circle of radius rho must skip to clear every medallion. */
const halfGap = (rho, clear = GAP) => Math.acos((rho * rho + R * R - clear * clear) / (2 * rho * R)) / D2R;
/** The arcs of circle rho between medallions, as separate paths. */
function brokenRing(rho, clear = GAP) {
  const h = halfGap(rho, clear);
  return STATIONS.map((s) => arc(rho, s.deg + h, s.deg + 72 - h));
}
/** Is angle a (deg) within the shadow of a medallion on circle rho? */
const nearStation = (rho, a, clear = GAP) => {
  const h = halfGap(rho, clear);
  return STATIONS.some((s) => {
    let d = ((a - s.deg) % 360 + 540) % 360 - 180;
    return Math.abs(d) < h;
  });
};

// ---------- construction ----------
// centre lines, stopped at the seal so they never cross the inscription
con.push(centreLine(260, C[1], C[0] - SEAL.out - 8, C[1]));
con.push(centreLine(C[0] + SEAL.out + 8, C[1], 1340, C[1]));
con.push(centreLine(C[0], C[1] + SEAL.out + 8, C[0], 902));
// the inscribed pentagon through the five stations
for (const s of STATIONS) {
  const t = STATIONS[(s.i + 1) % 5];
  const ux = (t.c[0] - s.c[0]), uy = (t.c[1] - s.c[1]), L = Math.hypot(ux, uy);
  const k0 = (MED + 4) / L, k1 = 1 - (MED + 4) / L;
  con.push(line(s.c[0] + ux * k0, s.c[1] + uy * k0, s.c[0] + ux * k1, s.c[1] + uy * k1));
}
// guide circles
for (const s of STATIONS) con.push(arc(NUM_R, s.deg + 9, s.deg + 72 - 9));
// small centre crosses on every medallion
for (const s of STATIONS) {
  const [x, y] = s.c;
  con.push(path_(`M${P(x - MED - 10, y)}L${P(x - MED + 4, y)}M${P(x + MED - 4, y)}L${P(x + MED + 10, y)}M${P(x, y - MED - 10)}L${P(x, y - MED + 4)}M${P(x, y + MED - 4)}L${P(x, y + MED + 10)}`));
}
// angle dimension: 72 degrees between III and IV, below the dial
{
  const a0 = STATIONS[2].deg, a1 = STATIONS[3].deg, rd = 382;
  con.push(path_(`M${PP(RING.bz1 + 8, a0)}L${PP(rd + 12, a0)}M${PP(RING.bz1 + 8, a1)}L${PP(rd + 12, a1)}`));
  const [ex, ey] = pol(rd, a1), [sx, sy] = pol(rd, a0);
  con.push(path_(arcD(rd, a0, a1) + arrowHead(ex, ey, (a1 + 90) * D2R, 9) + arrowHead(sx, sy, (a0 - 90) * D2R, 9)));
}
// registration marks at the plate corners
for (const [x, y] of [[40, 40], [1560, 40], [40, 960], [1560, 960]]) con.push(register(x, y, 14));

// ---------- main: the dial ----------
for (const d of brokenRing(RING.in)) main.push(d);
for (const d of brokenRing(RING.out)) main.push(d);
for (const d of brokenRing(RING.bz1)) main.push(d);
// the seal
main.push(circle(C[0], C[1], SEAL.out));
main.push(circle(C[0], C[1], SEAL.face));
// medallions
for (const s of STATIONS) main.push(circle(s.c[0], s.c[1], MED));

// ---------- detail ----------
for (const d of brokenRing(RING.track)) det.push(d);
for (const d of brokenRing(RING.bz0)) det.push(d);
// minute track: 300 fine ticks, every fifth long
{
  let fine = "", major = "";
  for (let k = 0; k < 300; k++) {
    const a = -90 + k * 1.2;
    if (nearStation(RING.out, a, GAP + 3)) continue;
    if (k % 5 === 0) major += `M${PP(RING.out, a)}L${PP(RING.track, a)}`;
    else fine += `M${PP(RING.out, a)}L${PP(RING.out - 6, a)}`;
  }
  det.push(path_(fine));
  det.push(path_(major));
  let inner = "";
  for (let k = 0; k < 60; k++) {
    const a = -90 + k * 6;
    if (nearStation(RING.in, a, GAP + 3)) continue;
    inner += `M${PP(RING.in, a)}L${PP(RING.in + 7, a)}`;
  }
  det.push(path_(inner));
}
// reeded bezel: slanted strokes all round, one path per sector so it staggers
for (const s of STATIONS) {
  let d = "";
  const h = halfGap(RING.bz1) + 1.5;
  for (let a = s.deg + h; a < s.deg + 72 - h; a += 1.6) d += `M${PP(RING.bz0 + 1.5, a)}L${PP(RING.bz1 - 1.5, a + 1.1)}`;
  det.push(path_(d));
}
// seal: rim, legend guides and a sub-dial of 60 marks
det.push(circle(C[0], C[1], SEAL.rim));
det.push(circle(C[0], C[1], SEAL.face + 6));
// guilloche band round the seal: three phase-shifted waves, as on a banknote rosette
{
  const rm = 172, amp = 6, n = 36;
  for (let j = 0; j < 3; j++) {
    let d = "";
    for (let k = 0; k <= 720; k++) {
      const a = k * 0.5, r = rm + amp * Math.sin((n * a + j * 120) * D2R);
      d += `${k ? "L" : "M"}${PP(r, a)}`;
    }
    det.push(path_(d + "Z"));
  }
  det.push(circle(C[0], C[1], rm + amp + 6));
}
// engraver's shadow: hatching on the lower right of the band, inside the inner edge
{
  let d = "";
  const a0 = -8, a1 = 122;
  for (let a = a0; a < a1; a += 2) {
    if (nearStation(RING.in, a, GAP + 2)) continue;
    const L = 3 + 10 * Math.sin(((a - a0) / (a1 - a0)) * Math.PI);
    d += `M${PP(RING.in - 2, a)}L${PP(RING.in - 2 - L, a - L * 0.16)}`;
  }
  det.push(path_(d));
}

// the dial's cast shadow on the paper, outside the bezel on the lower right, tapered
{
  let d = "";
  const a0 = -4, a1 = 124;
  for (let a = a0; a < a1; a += 1.7) {
    if (nearStation(RING.bz1 + 6, a, GAP + 4)) continue;
    const L = 2 + 9 * Math.sin(((a - a0) / (a1 - a0)) * Math.PI);
    d += `M${PP(RING.bz1 + 5, a)}L${PP(RING.bz1 + 5 + L, a + L * 0.14)}`;
  }
  det.push(path_(d));
}

// ---------- medallion glyphs ----------
const G = {};
/** Rotate local glyph point (x,y) by deg about the medallion centre c. */
const rot = (c, deg) => (x, y) => {
  const a = deg * D2R;
  return P(c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a));
};

G.edit = (c) => {
  const t = rot(c, 38);
  // nib body, slit, breather hole, collar, and the line it has just written
  main.push(path_(`M${t(-13, -16)}L${t(13, -16)}L${t(15, -2)}Q${t(11, 12)} ${t(0, 28)}Q${t(-11, 12)} ${t(-15, -2)}Z`));
  det.push(path_(`M${t(0, 28)}L${t(0, 4)}`));
  det.push(path_(`M${t(-3.2, 0)}A3.2 3.2 0 1 0 ${t(3.2, 0)}A3.2 3.2 0 1 0 ${t(-3.2, 0)}`));
  det.push(path_(`M${t(-14, -16)}L${t(-14, -27)}L${t(14, -27)}L${t(14, -16)}M${t(-14, -21.5)}L${t(14, -21.5)}`));
  det.push(path_(`M${t(-9, -5)}L${t(-5, 10)}M${t(9, -5)}L${t(5, 10)}`));
  const [tx, ty] = [c[0] + -28 * Math.sin(38 * D2R) * -1, c[1] + 28 * Math.cos(38 * D2R)];
  det.push(path_(`M${P(tx - 26, ty + 4)}Q${P(tx - 18, ty - 4)} ${P(tx - 10, ty + 3)}T${P(tx + 2, ty + 1)}`));
};
G.typecheck = (c) => {
  const [x, y] = c;
  main.push(rect(x - 20, y - 20, 40, 40, 4));
  det.push(path_(`M${P(x - 14, y + 24)}L${P(x + 24, y + 24)}L${P(x + 24, y - 14)}`));
  det.push(path_(`M${P(x - 11, y + 1)}L${P(x - 3, y + 10)}L${P(x + 13, y - 11)}`));
  det.push(path_(`M${P(x - 11, y + 4)}L${P(x - 3, y + 13)}L${P(x + 13, y - 8)}`));
};
G.crawl = (c) => {
  const [x, y] = c, s = 15;
  // nine pages, visited in order: left to right, down, right to left, down, left to right
  const order = [[-1, -1], [0, -1], [1, -1], [1, 0], [0, 0], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  for (const [i, j] of order) det.push(rect(x + i * s - 3.6, y + j * s - 3.6, 7.2, 7.2, 1));
  let d = "";
  for (let k = 0; k < order.length - 1; k++) {
    const [ai, aj] = order[k], [bi, bj] = order[k + 1];
    const ax = x + ai * s, ay = y + aj * s, bx = x + bi * s, by = y + bj * s;
    const ux = Math.sign(bx - ax), uy = Math.sign(by - ay);
    d += `M${P(ax + ux * 6, ay + uy * 6)}L${P(bx - ux * 6, by - uy * 6)}`;
  }
  main.push(path_(d));
  // the crawler enters top left and leaves bottom right
  main.push(path_(`M${P(x - s - 14, y - s)}L${P(x - s - 6, y - s)}`));
  main.push(path_(`M${P(x + s + 6, y + s)}L${P(x + s + 16, y + s)}` + arrowHead(x + s + 16, y + s, 0, 6)));
};
G.screenshot = (c) => {
  const [x, y] = c, ro = 24, ri = 9;
  main.push(circle(x, y, ro));
  const V = [...Array(6)].map((_, k) => [ri * Math.cos((k * 60 + 15) * D2R), ri * Math.sin((k * 60 + 15) * D2R)]);
  let d = "";
  for (let k = 0; k < 6; k++) {
    const [ax, ay] = V[k], [bx, by] = V[(k + 1) % 6];
    const ux = bx - ax, uy = by - ay, L = Math.hypot(ux, uy), dx = ux / L, dy = uy / L;
    // extend the hexagon edge past b until it meets the outer circle
    const bq = bx * dx + by * dy, t = -bq + Math.sqrt(bq * bq - (bx * bx + by * by - ro * ro));
    d += `M${P(x + ax, y + ay)}L${P(x + bx + dx * t, y + by + dy * t)}`;
  }
  det.push(path_(d));
  det.push(circle(x, y, ro + 5));
};
G.pr = (c) => {
  const [x, y] = c, tx = x - 13, bx = x + 13;
  // trunk with a commit at each end; a branch leaves, carries one commit, and merges back
  main.push(path_(`M${P(tx, y + 23)}L${P(tx, y - 23)}`));
  main.push(path_(`M${P(tx, y + 18)}L${P(bx, y + 11)}L${P(bx, y + 5)}`));
  main.push(path_(`M${P(bx, y - 5)}L${P(bx, y - 11)}L${P(tx + 1.5, y - 17.6)}` + arrowHead(tx + 1.5, y - 17.6, Math.atan2(-6.6, -24.5), 7)));
  det.push(circle(tx, y + 27.5, 4.5));
  det.push(circle(tx, y - 27.5, 4.5));
  det.push(circle(bx, y, 5));
};
for (const s of STATIONS) G[s.key](s.c);

// medallion bevels: inner ring and shadow hatching on the lower right
for (const s of STATIONS) {
  det.push(circle(s.c[0], s.c[1], MED - 7));
  let d = "";
  for (let a = -10; a <= 110; a += 7) d += `M${PP(MED - 6, a, s.c)}L${PP(MED - 1, a - 4, s.c)}`;
  det.push(path_(d));
}

// ---------- the padlock in the seal ----------
{
  const [x, y] = [C[0], C[1] - 58];
  main.push(rect(x - 15, y - 2, 30, 23, 3));
  main.push(path_(`M${P(x - 9, y - 2)}L${P(x - 9, y - 10)}A9 9 0 0 1 ${P(x + 9, y - 10)}L${P(x + 9, y - 2)}`));
  det.push(path_(`M${P(x, y + 6)}L${P(x, y + 13)}`));
  det.push(circle(x, y + 6, 2.6));
}

// ---------- accent: the orbit and the marker ----------
const BEAD = -54;
{
  const h = (2 * Math.asin((MED + 9) / (2 * R))) / D2R;
  for (const s of STATIONS) {
    const a0 = s.deg + h, a1 = s.deg + 72 - h;
    const [ex, ey] = pol(R, a1);
    const head = arrowHead(ex, ey, (a1 + 90) * D2R, 12);
    if (a0 < BEAD && BEAD < a1) {
      acc.push(path_(arcD(R, a0, BEAD - 3.4)));
      acc.push(path_(arcD(R, BEAD + 3.4, a1) + head));
    } else acc.push(path_(arcD(R, a0, a1) + head));
  }
  const [bx, by] = pol(R, BEAD);
  acc.push(`<g class="loop-marker" data-cx="${C[0]}" data-cy="${C[1]}" data-deg="${BEAD}">${circle(bx, by, 13)}${circle(bx, by, 4)}${circle(...pol(190, BEAD), 3.4)}${path_(`M${PP(193.4, BEAD)}L${PP(R - 17, BEAD)}`)}</g>`);
}

// ---------- labels ----------
// station numerals on the dial, inside the chapter ring
for (const s of STATIONS) {
  const [x, y] = pol(NUM_R, s.deg);
  lbl.push(display(x, y + 14, s.num, { anchor: "middle", size: 42 }));
}
// station captions with leaders
function caption(s, x, y, anchor) {
  lbl.push(mono(x, y, s.name, { anchor, size: 22, ls: 3, weight: 600 }));
  lbl.push(mono(x, y + 30, s.cmd, { anchor, size: 18, ls: 1 }));
  lbl.push(note(x, y + 60, s.note, { anchor, size: 25 }));
}
{
  // I: above the dial, centred
  const s = STATIONS[0];
  det.push(path_(`M${P(s.c[0], s.c[1] - MED - 6)}L${P(s.c[0], 150)}`));
  caption(s, s.c[0], 58, "middle");
  // II and III: to the right; IV and V: to the left; horizontal leaders
  for (const s of STATIONS.slice(1)) {
    const right = s.c[0] > C[0], dir = right ? 1 : -1;
    const x0 = s.c[0] + dir * (MED + 6);
    const edge = C[0] + dir * Math.sqrt(Math.max(0, (RING.bz1 + 18) ** 2 - (s.c[1] - C[1]) ** 2));
    const x1 = right ? Math.max(x0 + 40, edge) : Math.min(x0 - 40, edge);
    det.push(circle(x0, s.c[1], 3.2));
    det.push(path_(`M${P(x0, s.c[1])}L${P(x1, s.c[1])}`));
    caption(s, x1 + dir * 14, s.c[1] + 8, right ? "start" : "end");
  }
}
// the angle dimension
lbl.push(mono(C[0], C[1] + 382 + 34, "72°  ·  FIVE STEPS, ONE TURN", { anchor: "middle", size: 18, ls: 3 }));

// the seal: inscription and legend
lbl.push(note(C[0], C[1] + 8, "everything", { anchor: "middle", size: 36 }));
lbl.push(note(C[0], C[1] + 46, "stays local", { anchor: "middle", size: 36 }));
{
  const rL = SEAL.legend;
  const top = `M${PP(rL, 180)}A${rL} ${rL} 0 0 1 ${PP(rL, 0)}`;
  const bot = `M${PP(rL + 6, 180)}A${rL + 6} ${rL + 6} 0 0 0 ${PP(rL + 6, 0)}`;
  lbl.push(`<defs><path id="contribute-legend-top" d="${top}"/><path id="contribute-legend-bot" d="${bot}"/></defs>`);
  lbl.push(`<text class="mono" font-family="JetBrains Mono, ui-monospace, monospace" font-size="18" letter-spacing="3" fill="currentColor"><textPath href="#contribute-legend-top" startOffset="50%" text-anchor="middle">ONLY ANSWERS TO LOCALHOST</textPath></text>`);
  lbl.push(`<text class="mono" font-family="JetBrains Mono, ui-monospace, monospace" font-size="18" letter-spacing="3" fill="currentColor"><textPath href="#contribute-legend-bot" startOffset="50%" text-anchor="middle">127.0.0.1 · PORT 3470</textPath></text>`);
  // legend stops at nine and three o'clock
  for (const a of [180, 0]) {
    const [x, y] = pol(rL - 4, a);
    det.push(circle(x, y, 2.4));
  }
}

writePlate("contribute", "The loop: edit, typecheck, crawl, screenshot, pull request, all on this machine", { con, main, det, acc, lbl });
