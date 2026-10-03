// ADD A SITE. Five stations on one long ruled path, from an empty folder to an
// Innerpedia article: (1) a new folder, tide-pool, under the root; (2) a README whose
// first paragraph becomes the summary; (3) package.json, whose dependencies name the
// frameworks; (4) .git, whose commits become a 24-month history; (5) pnpm index, and
// the new article. Odd stations stand above the path, even ones below, so each reads
// as a vignette on its own when the film pans across at about 2.5x.
//
// L-acc carries the one idea: the path itself, and at each station the thing that
// station adds to the page.

import {
  P, path_, line, circle, rect, polyline, mono, note, display, centreLine, arrow, curveArrow,
  dimLine, hatch, hatchCircle, ticks, register, rand, writePlate, arrowHead,
} from "./lib.mjs";

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------------------------------------------------------------- helpers (local)

/** Width of a JetBrains Mono run (0.6 em advance plus letter spacing). */
const tw = (s, size, ls = 0) => s.length * (size * 0.6 + ls);

/** A line of handwriting as word dashes, one path. */
function words(x, y, w, seed) {
  let d = "", cx = x, i = 0;
  while (cx < x + w - 8) {
    const len = 10 + rand(i, seed) * 30;
    const e = Math.min(cx + len, x + w);
    d += `M${P(cx, y)}L${P(e, y)}`;
    cx = e + 7;
    i++;
  }
  return path_(d);
}

/** Dashed polyline (for ghost outlines), one path. */
function dashed(pts, on = 7, off = 5) {
  let d = "";
  for (let k = 0; k < pts.length - 1; k++) {
    const [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    for (let t = 0; t < L; t += on + off) {
      const e = Math.min(t + on, L);
      d += `M${P(x1 + ux * t, y1 + uy * t)}L${P(x1 + ux * e, y1 + uy * e)}`;
    }
  }
  return path_(d);
}

/** Corner crop marks around a box (the station highlight frame). */
function crops(x1, y1, x2, y2, s = 18) {
  return [
    path_(`M${P(x1, y1 + s)}L${P(x1, y1)}L${P(x1 + s, y1)}`),
    path_(`M${P(x2 - s, y1)}L${P(x2, y1)}L${P(x2, y1 + s)}`),
    path_(`M${P(x2, y2 - s)}L${P(x2, y2)}L${P(x2 - s, y2)}`),
    path_(`M${P(x1 + s, y2)}L${P(x1, y2)}L${P(x1, y2 - s)}`),
  ];
}

/** Parallel hatching clipped to a polygon, or to several rings (even-odd, so inner rings are holes), one path. */
function hatchPoly(poly, deg, sp) {
  const rings = Array.isArray(poly[0][0]) ? poly : [poly];
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const prs = rings.map((r) => r.map(([x, y]) => [x * c + y * s, -x * s + y * c]));
  const vs = prs.flat().map((p) => p[1]);
  let d = "";
  for (let v = Math.min(...vs) + sp / 2; v < Math.max(...vs); v += sp) {
    const xs = [];
    for (const pr of prs) for (let i = 0; i < pr.length; i++) {
      const [ua, va] = pr[i], [ub, vb] = pr[(i + 1) % pr.length];
      if ((va <= v && vb > v) || (vb <= v && va > v)) xs.push(ua + ((v - va) / (vb - va)) * (ub - ua));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1] - xs[k] < 2) continue;
      d += `M${P(xs[k] * c - v * s, xs[k] * s + v * c)}L${P(xs[k + 1] * c - v * s, xs[k + 1] * s + v * c)}`;
    }
  }
  return path_(d);
}

/** The thickness of a card: a right and a bottom face, outlined and hatched. */
function depth(x, y, w, h, d = 8, r = 6) {
  const band = [[x + w, y + r], [x + w + d, y + r + d], [x + w + d, y + h + d], [x + r + d, y + h + d], [x + r, y + h], [x + w, y + h]];
  main.push(path_(`M${P(x + w, y + r)}L${P(x + w + d, y + r + d)}L${P(x + w + d, y + h + d)}L${P(x + r + d, y + h + d)}L${P(x + r, y + h)}`));
  det.push(hatchPoly(band, 45, 3.6));
}

/** A mono line of code that keeps its indentation (SVG collapses leading spaces). */
function code(x, y, s, size, cw) {
  const n = s.length - s.trimStart().length;
  return mono(x + n * cw, y, s.trimStart(), { size, ls: 0 });
}

const check = (x, y) => path_(`M${P(x, y)}L${P(x + 5, y + 6)}L${P(x + 14, y - 6)}`);
const cross = (x, y) => path_(`M${P(x, y - 6)}L${P(x + 12, y + 6)}M${P(x + 12, y - 6)}L${P(x, y + 6)}`);

// ---------------------------------------------------------------- the frame

const PY = 510; // the path
const SX = [375, 610, 850, 1095, 1340]; // stations
const CR = 26; // station circle radius
const X0 = 70, X1 = 1548; // path start (root datum) and end

for (const [x, y] of [[40, 40], [1560, 40], [40, 960], [1560, 960]]) con.push(register(x, y, 14));

// ---------------------------------------------------------------- the path

// rails either side of the path, broken at each station; a ruler scale under the lower rail
{
  const stops = [X0 + 16, ...SX.flatMap((x) => [x - CR - 12, x + CR + 12]), X1 - 6];
  for (let k = 0; k < stops.length; k += 2) {
    const a = stops[k], b = stops[k + 1];
    con.push(line(a, PY - 13, b, PY - 13));
    con.push(line(a, PY + 13, b, PY + 13));
    det.push(ticks(a, PY + 13, b, PY + 13, Math.round((b - a) / 10), 5, 5, 1));
  }
}
// the accent path, one leg at a time, so it draws station to station
{
  const legs = [[X0 + 12, SX[0] - CR - 5], ...SX.slice(0, -1).map((x, i) => [x + CR + 5, SX[i + 1] - CR - 5]), [SX[4] + CR + 5, X1]];
  legs.forEach(([a, b], i) => acc.push(path_(`M${P(a, PY)}L${P(b, PY)}` + (i === legs.length - 1 ? arrowHead(b, PY, 0, 14) : ""))));
}
// station circles and numerals
SX.forEach((x, i) => {
  main.push(circle(x, PY, CR));
  det.push(circle(x, PY, CR - 5));
  // a crown of fine ticks, as on a surveyor's station mark
  let d = "";
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2, r0 = CR + 3, r1 = CR + (k % 4 === 0 ? 8 : 5);
    d += `M${P(x + r0 * Math.cos(a), PY + r0 * Math.sin(a))}L${P(x + r1 * Math.cos(a), PY + r1 * Math.sin(a))}`;
  }
  det.push(path_(d));
  lbl.push(display(x, PY + 11, String(i + 1), { anchor: "middle", size: 34 }));
});
// the root datum where the path starts
{
  const x = X0, y = PY;
  main.push(circle(x, y, 10));
  det.push(path_(`M${P(x - 18, y)}L${P(x + 18, y)}M${P(x, y - 18)}L${P(x, y + 18)}`));
  con.push(line(x - 24, y + 26, x + 24, y + 26));
  det.push(hatch(x - 22, y + 27, 44, 10, 6, -45));
  lbl.push(mono(x - 22, y + 66, "~/Programming", { size: 18, ls: 1 }));
  lbl.push(note(x - 22, y + 96, "the root", { size: 22 }));
}
// where it ends: the page, served on this machine alone
{
  lbl.push(mono(X1 + 4, PY + 56, "localhost:3470", { anchor: "end", size: 18, ls: 1 }));
  lbl.push(mono(X1 + 4, PY + 82, "/wiki/tide-pool", { anchor: "end", size: 18, ls: 1 }));
  lbl.push(note(X1 + 4, PY + 114, "on this machine alone", { anchor: "end", size: 22 }));
}

// station labels hug the path: above it for odd stations, below for even ones
const LABELS = [
  ["A FOLDER", "under a root, six folders down at most"],
  ["A README", "its first paragraph becomes the summary"],
  ["A PACKAGE FILE", "its dependencies name the frameworks"],
  ["GIT", "its commits become a history"],
  ["PNPM INDEX", "one command, and the article appears"],
];
SX.forEach((x, i) => {
  const [t, n] = LABELS[i];
  if (i % 2 === 0) {
    lbl.push(mono(x, 418, t, { anchor: "middle", size: 20, ls: 4 }));
    lbl.push(note(x, 450, n, { anchor: "middle", size: 24 }));
    const vb = [366, 0, 378, 0, 396][i]; // where each vignette ends
    if (398 - vb > 8) con.push(centreLine(x, vb, x, 398));
    con.push(centreLine(x, 464, x, PY - CR - 4));
  } else {
    lbl.push(mono(x, 580, t, { anchor: "middle", size: 20, ls: 4 }));
    lbl.push(note(x, 612, n, { anchor: "middle", size: 24 }));
    con.push(centreLine(x, PY + CR + 4, x, 558));
    con.push(centreLine(x, 626, x, i === 1 ? 772 : 678));
  }
});

// ---------------------------------------------------------------- 1. a folder

{
  // the way down from the root, real names from the index
  const rows = ["~/Programming", "XO", "ClaudeWorkspace", "experiments"];
  const RY = (d) => 84 + d * 32;
  const IX = (d) => 80 + d * 16;
  // a depth staff, 0 to 6; below 6 only a tally, hatched
  con.push(line(64, RY(0) - 16, 64, RY(6) + 6));
  for (let d = 0; d <= 6; d++) {
    det.push(line(58, RY(d) - 5, 70, RY(d) - 5));
    lbl.push(mono(52, RY(d), String(d), { anchor: "end", size: 16, ls: 0 }));
  }
  det.push(hatch(58, RY(6) + 8, 12, 18, 4, -45));
  con.push(line(54, RY(6) + 8, 74, RY(6) + 8));
  rows.forEach((s, d) => {
    lbl.push(mono(IX(d), RY(d), s, { size: 17, ls: 0 }));
    if (d > 0) det.push(path_(`M${P(IX(d - 1) + 5, RY(d - 1) + 7)}L${P(IX(d - 1) + 5, RY(d) - 6)}L${P(IX(d) - 6, RY(d) - 6)}`));
  });
  // levels 5 and 6 are still free
  for (const d of [5, 6]) con.push(dashed([[78, RY(d) - 5], [200, RY(d) - 5]], 4, 6));
  con.push(dashed([[78, RY(4) - 5], [IX(3) - 2, RY(4) - 5]], 4, 6));

  // an open folder, engraved, centred on the station axis
  const fw = 220, fx = SX[0] - fw / 2, top = 190, bot = 346, flap = top + 74;
  // the new entry: from experiments down to level 4, into the folder
  acc.push(path_(`M${P(IX(3) + 5, RY(3) + 7)}L${P(IX(3) + 5, RY(4) - 5)}L${P(fx - 12, RY(4) - 5)}` + arrowHead(fx - 12, RY(4) - 5, 0, 12)));
  main.push(path_(`M${P(fx, top + 18)}L${P(fx, bot)}L${P(fx + fw, bot)}L${P(fx + fw, top + 18)}L${P(fx + 98, top + 18)}L${P(fx + 84, top)}L${P(fx + 10, top)}Q${P(fx, top)} ${P(fx, top + 10)}`));
  det.push(hatch(fx + 14, top + 4, 62, 11, 5, -45));
  // three sheets waiting to be added (README, package.json, .git), dashed
  const sheets = [[fx + 30, top + 36, -5], [fx + 86, top + 29, 2], [fx + 144, top + 39, 7]].map(([gx, gy, a]) => {
    const r = (a * Math.PI) / 180, w = 52, h = 64;
    return [[0, 0], [w - 14, 0], [w, 14], [w, h], [0, h]].map(([u, v]) => [gx + u * Math.cos(r) - v * Math.sin(r), gy + u * Math.sin(r) + v * Math.cos(r)]);
  });
  for (const pts of sheets) con.push(dashed([...pts, pts[0]], 5, 4));
  // the inside of the back panel, in shadow above the flap, the sheets left clear
  const clip = (pts) => pts.map(([x, y]) => [x, Math.min(y, flap - 2)]);
  det.push(hatchPoly([[[fx + 4, top + 22], [fx + fw - 4, top + 22], [fx + fw - 4, flap - 2], [fx + 4, flap - 2]], ...sheets.map(clip)], 90, 7));
  // the front flap, leaning out, shaded along its lip
  main.push(path_(`M${P(fx - 8, flap)}L${P(fx + fw + 8, flap)}L${P(fx + fw, bot)}L${P(fx, bot)}Z`));
  det.push(hatch(fx + 2, flap + 4, fw - 4, 9, 6, 0));
  lbl.push(mono(fx + fw / 2, flap + 54, "tide-pool/", { anchor: "middle", size: 26, ls: 1 }));
  // the station highlight: crop marks round the new folder
  acc.push(...crops(fx - 14, top - 14, fx + fw + 14, bot + 14, 20));
}

// ---------------------------------------------------------------- 2. a README

{
  const px = 350, py = 668, pw = 230, ph = 282;
  lbl.push(mono(px, py - 12, "README.md", { size: 18, ls: 1 }));
  main.push(path_(`M${P(px, py)}L${P(px + pw - 30, py)}L${P(px + pw, py + 30)}L${P(px + pw, py + ph)}L${P(px, py + ph)}Z`));
  depth(px, py + 30, pw, ph - 30, 7, 0);
  det.push(path_(`M${P(px + pw - 30, py)}L${P(px + pw - 30, py + 30)}L${P(px + pw, py + 30)}`));
  det.push(hatch(px + pw - 28, py + 2, 26, 26, 5, 45));
  lbl.push(display(px + 22, py + 50, "tide-pool", { size: 36 }));
  det.push(line(px + 22, py + 64, px + pw - 22, py + 64));
  // the first paragraph, written, then underlined in the accent
  const lx = px + 22, lw = pw - 44;
  const para = [96, 120, 144, 168];
  para.forEach((y, i) => {
    const w = i === para.length - 1 ? lw * 0.56 : lw;
    det.push(words(lx, py + y, w, 3 + i));
    acc.push(line(lx, py + y + 7, lx + w, py + y + 7));
  });
  det.push(path_(`M${P(px - 8, py + 86)}L${P(px - 15, py + 86)}L${P(px - 15, py + 178)}L${P(px - 8, py + 178)}`));
  lbl.push(mono(px - 22, py + 138, "¶1", { anchor: "end", size: 18, ls: 0 }));
  // the rest of the page: a heading, a code block, more prose
  main.push(line(lx, py + 202, lx + 70, py + 202));
  det.push(rect(lx, py + 214, lw, 34, 3));
  det.push(line(lx + 12, py + 227, lx + 96, py + 227));
  det.push(line(lx + 12, py + 238, lx + 64, py + 238));
  det.push(words(lx, py + 264, lw * 0.9, 11));

  // the search result it becomes
  const sx = 660, sy = 712, sw = 186, sh = 152;
  lbl.push(mono(sx, sy - 14, "IN SEARCH", { size: 18, ls: 3 }));
  main.push(rect(sx, sy, sw, sh, 4));
  depth(sx, sy, sw, sh, 6, 4);
  main.push(circle(sx + 24, sy + 26, 11));
  det.push(hatchCircle(sx + 24, sy + 26, 11, 4, -45));
  det.push(line(sx + 44, sy + 21, sx + 128, sy + 21));
  con.push(line(sx + 44, sy + 32, sx + 160, sy + 32));
  lbl.push(display(sx + 16, sy + 74, "tide-pool", { size: 30 }));
  [98, 118, 138].forEach((y, i) => {
    const w = i === 2 ? 92 : sw - 32;
    det.push(words(sx + 16, sy + y - 2, w, 21 + i));
    acc.push(line(sx + 16, sy + y + 5, sx + 16 + w, sy + y + 5));
  });
  // the paragraph carried across into the snippet
  acc.push(curveArrow(px + pw + 10, py + 130, sx - 40, py + 130, sx - 10, sy + 106, 12));
}

// ---------------------------------------------------------------- 3. package.json

{
  const cx = 598, cy = 92, cw = 300, ch = 272;
  lbl.push(mono(cx, cy - 12, "package.json", { size: 18, ls: 1 }));
  main.push(rect(cx, cy, cw, ch, 6));
  depth(cx, cy, cw, ch, 8, 6);
  det.push(line(cx + 34, cy + 10, cx + 34, cy + ch - 10));
  const src = ["{", '  "name": "tide-pool",', '  "dependencies": {', '    "next": "^16",', '    "react": "^19",', '    "tailwindcss": "^4"', "  }", "}"];
  const LH = 29, y0 = cy + 40, x0 = cx + 48, SZ = 17, cwid = SZ * 0.6;
  src.forEach((s, i) => {
    lbl.push(mono(cx + 25, y0 + i * LH, String(i + 1), { anchor: "end", size: 15, ls: 0 }));
    lbl.push(code(x0, y0 + i * LH, s, SZ, cwid));
  });
  // "next", boxed in the accent
  acc.push(rect(x0 + 4 * cwid - 5, y0 + 3 * LH - 19, 6 * cwid + 10, 26, 5));
  // what the dependencies name
  const kx = 948, ky = [172, 240, 308];
  lbl.push(mono(kx, 130, "FRAMEWORKS", { size: 18, ls: 3 }));
  [["Next.js", 3], ["React", 4], ["Tailwind CSS", 5]].forEach(([name, li], k) => {
    const w = tw(name, 18) + 30, y = ky[k], ly = y0 + li * LH - 6;
    const layer = k === 0 ? acc : main;
    layer.push(rect(kx, y - 18, w, 36, 18));
    lbl.push(mono(kx + 15, y + 6, name, { size: 18, ls: 0 }));
    const ex = cx + cw + 14;
    det.push(circle(ex, ly, 3.2));
    (k === 0 ? acc : det).push(path_(`M${P(ex + 4, ly)}L${P(ex + 12, ly)}L${P(kx - 8, y)}` + arrowHead(kx - 8, y, Math.atan2(y - ly, kx - 8 - ex - 12), 9)));
  });
}

// ---------------------------------------------------------------- 4. git history

{
  const gx = 885, gw = 440, base = 905, top = 768;
  const months = [0, 0, 0, 0, 0, 1, 0, 2, 3, 1, 4, 6, 3, 5, 8, 7, 4, 9, 12, 10, 15, 9, 11, 7];
  const max = Math.max(...months), peak = months.indexOf(max);
  const bin = gw / 24, bw = bin - 6;
  const mx = (m) => gx + m * bin + bin / 2;
  // .git, and its log as a strand of commits
  const sy = 692;
  lbl.push(mono(gx, sy + 7, ".git", { size: 20, ls: 1 }));
  main.push(line(gx + 62, sy, gx + gw, sy));
  det.push(ticks(gx + 62, sy, gx + gw, sy, Math.round((gw - 62) / bin), 4, 100, -1));
  months.forEach((c, m) => {
    if (!c) return;
    const h = (c / max) * (base - top);
    (m === peak ? acc : main).push(circle(mx(m), sy, 1.8 + 2.8 * Math.sqrt(c / max)));
    con.push(line(mx(m), sy + 8, mx(m), base - h - 6));
  });
  lbl.push(mono(gx + gw, sy - 18, "COMMITS PER MONTH", { anchor: "end", size: 18, ls: 2 }));
  months.forEach((c, m) => {
    const x = gx + m * bin + 3;
    if (!c) return det.push(line(x + 1, base - 2, x + bw - 1, base - 2));
    const h = Math.max(5, (c / max) * (base - top));
    (m === peak ? acc : main).push(rect(x, base - h, bw, h, 1.5));
    if (h > 14) det.push(hatch(x + 2, base - h + 2, bw - 4, h - 4, 5, -45));
  });
  main.push(line(gx - 8, base, gx + gw + 8, base));
  det.push(ticks(gx, base, gx + gw, base, 24, 5, 6, 1));
  con.push(dimLine(gx, base + 26, gx + gw, base + 26));
  lbl.push(mono(gx + gw / 2, base + 50, "24 MONTHS", { anchor: "middle", size: 18, ls: 3 }));
}

// ---------------------------------------------------------------- 5. pnpm index

{
  const tx = 1124, ty = 62, tw_ = 422, th = 152;
  main.push(rect(tx, ty, tw_, th, 7));
  depth(tx, ty, tw_, th, 8, 7);
  det.push(line(tx, ty + 28, tx + tw_, ty + 28));
  for (let k = 0; k < 3; k++) det.push(circle(tx + 18 + k * 17, ty + 14, 5));
  lbl.push(mono(tx + tw_ / 2, ty + 20, "innernet", { anchor: "middle", size: 15, ls: 2 }));
  lbl.push(mono(tx + 18, ty + 66, "$ pnpm index", { size: 22, ls: 0 }));
  lbl.push(mono(tx + tw_ - 18, ty + 66, "ABOUT 51 S", { anchor: "end", size: 16, ls: 2 }));
  con.push(dimLine(tx + 190, ty + 60, tx + tw_ - 146, ty + 60));
  const SZ = 16, cw = SZ * 0.6, ox = tx + 18, oy = ty + 100;
  lbl.push(mono(ox, oy, "indexed 5485 folders (959 articles, ...)", { size: SZ, ls: 0 }));
  acc.push(line(ox + 22 * cw, oy + 7, ox + 34 * cw, oy + 7));
  lbl.push(mono(ox, oy + 32, "$", { size: 16, ls: 0 }));
  det.push(rect(ox + 18, oy + 18, 10, 18));
  det.push(hatch(ox + 18, oy + 18, 10, 18, 3, -45));
  // down into the article
  acc.push(arrow(ox + 28 * cw, oy + 14, ox + 28 * cw, 246, 12));

  // the article: title, byline, lead, and an infobox whose sigil is round (a repo)
  const ax = 1124, ay = 250, aw = 422, ah = 132;
  main.push(rect(ax, ay, aw, ah, 4));
  depth(ax, ay, aw, ah, 8, 4);
  lbl.push(display(ax + 22, ay + 50, "tide-pool", { size: 42 }));
  det.push(line(ax + 22, ay + 64, ax + 300, ay + 64));
  lbl.push(note(ax + 22, ay + 86, "From Innerpedia, the encyclopedia of you", { size: 16 }));
  det.push(words(ax + 22, ay + 104, 278, 41));
  det.push(words(ax + 22, ay + 120, 170, 42));
  const ix = ax + aw - 108, iw = 92;
  det.push(rect(ix, ay + 12, iw, ah - 24, 2));
  const sgx = ix + iw / 2, sgy = ay + 48, sr = 24;
  main.push(circle(sgx, sgy, sr));
  det.push(hatchCircle(sgx, sgy, sr, 6, -60));
  det.push(hatchCircle(sgx, sgy, sr * 0.72, 6, 0));
  det.push(hatchCircle(sgx, sgy, sr * 0.44, 5, 60));
  acc.push(circle(sgx, sgy, sr + 6));
  for (const y of [88, 100]) {
    det.push(line(ix + 8, ay + y, ix + 34, ay + y));
    det.push(line(ix + 42, ay + y, ix + iw - 8, ay + y));
  }
}

// ---------------------------------------------------------------- the key: what it reads

{
  const x = 52, w = 236;
  con.push(line(x, 652, x + w, 652));
  lbl.push(mono(x, 680, "READ", { size: 18, ls: 3 }));
  ["README.md", "CLAUDE.md", "package.json", "git metadata"].forEach((s, i) => {
    det.push(check(x + 2, 706 + i * 28));
    lbl.push(mono(x + 28, 712 + i * 28, s, { size: 18, ls: 0 }));
  });
  con.push(line(x, 818, x + w, 818));
  lbl.push(mono(x, 846, "NEVER OPENED", { size: 18, ls: 3 }));
  [".env", "keys", "source code"].forEach((s, i) => {
    det.push(cross(x + 2, 872 + i * 28));
    lbl.push(mono(x + 28, 878 + i * 28, s, { size: 18, ls: 0 }));
  });
}

// ---------------------------------------------------------------- the lock: served to this machine alone

{
  const x = 1484, y = 742, bw = 70, bh = 56;
  main.push(path_(`M${P(x - 22, y)}L${P(x - 22, y - 20)}A22,22 0 0 1 ${P(x + 22, y - 20)}L${P(x + 22, y)}`));
  det.push(path_(`M${P(x - 14, y)}L${P(x - 14, y - 20)}A14,14 0 0 1 ${P(x + 14, y - 20)}L${P(x + 14, y)}`));
  main.push(rect(x - bw / 2, y, bw, bh, 5));
  det.push(hatch(x + 12, y + 3, bw / 2 - 15, bh - 6, 4, -45));
  main.push(circle(x - 6, y + 22, 6));
  det.push(line(x - 6, y + 28, x - 6, y + 42));
  con.push(line(x - 56, y + bh + 10, x + 56, y + bh + 10));
  det.push(hatch(x - 50, y + bh + 11, 100, 9, 6, -45));
  lbl.push(mono(x, y + bh + 48, "127.0.0.1", { anchor: "middle", size: 18, ls: 1 }));
  // the same words the privacy plate puts under its gate
  lbl.push(note(x, y + bh + 80, "only this machine", { anchor: "middle", size: 22 }));
  lbl.push(note(x, y + bh + 106, "is served", { anchor: "middle", size: 22 }));
}

writePlate("add-site", "Add a site: a folder, a README, a package file, git, and one command", { con, main, det, acc, lbl });
