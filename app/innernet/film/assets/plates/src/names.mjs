// names: NAMESAKES. Two hundred and four folders called "src", scattered through the
// tree at depths 2 to 6, are drawn into one ruled page: "src may refer to:".
// The field is set in strata by depth (real counts from data/index.json, one label per
// folder, 204 in all). Five real namesakes are picked out with their paths; their lines
// converge, in the accent, on the brace of the list.
//
//   node assets/plates/src/names.mjs

import {
  W, H, P, r1, line, circle, path_, centreLine, ticks, dimLine, folder, register, rand, hatch,
  mono, note, display, writePlate,
} from "./lib.mjs";

const con = [], main = [], det = [], acc = [], lbl = [];

// ---------------------------------------------------------------- the data (index of 2 Oct 2026)
// /wiki/src: 204 folders share the name and none is primary, so the bare name is the list.
const TOTAL = 204;
const BANDS = [
  { d: 2, n: 5, h: 66, size: 17, ink: 0.9 },
  { d: 3, n: 25, h: 112, size: 15.5, ink: 0.84 },
  { d: 4, n: 35, h: 146, size: 14.5, ink: 0.78 },
  { d: 5, n: 115, h: 346, size: 13, ink: 0.72 },
  { d: 6, n: 24, h: 96, size: 12.5, ink: 0.64 },
];
// Five real entries, in the list's own order (articles first, then shallower), one per depth.
// path: the folders above "src" that its qualifier is taken from.
const PICKS = [
  { title: "src (client-direct, packages)", d: 5, files: 3, path: "packages/client-direct/" },
  { title: "src (magnet)", d: 2, files: 20, path: "magnet/" },
  { title: "src (swapper)", d: 3, files: 6, path: "swapper/" },
  { title: "src (deer-flow)", d: 4, files: 87, path: "deer-flow/" },
  { title: "src (web, space-walk)", d: 6, files: 33, path: "space-walk/web/" },
];

// ---------------------------------------------------------------- geometry
const FX0 = 204, FX1 = 906; // the field
let yy = 124;
for (const b of BANDS) {
  b.y0 = yy;
  b.y1 = yy + b.h;
  yy = b.y1;
}
const FY0 = BANDS[0].y0, FY1 = BANDS.at(-1).y1;

// The card (the disambiguation page).
const CX0 = 1086, CX1 = 1534, CY0 = 358;
const ROW0 = CY0 + 252, ROWH = 46;
const rowsY = PICKS.map((_, i) => ROW0 + i * ROWH);
const CY1 = rowsY.at(-1) + 92;
const BR_X = 1056; // brace spine
const BR_T = rowsY[0] - 24, BR_B = rowsY.at(-1) + 14;
const TIP = [1016, (BR_T + BR_B) / 2];

// ---------------------------------------------------------------- text metrics (JetBrains Mono: 0.6em advance)
const monoW = (s, size, ls) => s.length * (0.6 * size + ls);

// ---------------------------------------------------------------- highlighted namesakes
// x: left of the folder glyph; f: baseline as a fraction of the band.
const HL = { 2: [262, 0.6], 3: [236, 0.42], 4: [300, 0.5], 5: [252, 0.36], 6: [330, 0.52] };
const HS = 19; // their type size
const hls = PICKS.map((pk) => {
  const b = BANDS.find((z) => z.d === pk.d);
  const [x, f] = HL[pk.d];
  const y = b.y0 + b.h * f + HS * 0.35;
  const textX = x + 30;
  const w = monoW(pk.path + "src", HS, 1);
  const dot = [textX + w + 14, y - HS * 0.34];
  return { ...pk, b, x, y, textX, dot, box: [x - 4, y - HS * 0.95, dot[0] + 8, y + 6] };
});

// the accent curves: quadratic arcs that leave each label nearly level and fall into
// the tip; the reach of each control point spreads their arrival into a sheaf
const REACH = { 2: 0.7, 3: 0.56, 4: 0.42, 5: 0.36, 6: 0.5 };
const curves = hls.map((h) => {
  const [sx, sy] = h.dot;
  const c = [sx + (TIP[0] - sx) * REACH[h.d], sy + (TIP[1] - sy) * 0.1];
  return { s: [sx + 5, sy], c, e: TIP };
});
const qpt = ({ s, c, e }, t) => [
  (1 - t) ** 2 * s[0] + 2 * (1 - t) * t * c[0] + t * t * e[0],
  (1 - t) ** 2 * s[1] + 2 * (1 - t) * t * c[1] + t * t * e[1],
];
const corridor = curves.flatMap((cv) => Array.from({ length: 160 }, (_, i) => qpt(cv, i / 159)));

// ---------------------------------------------------------------- the field: 199 more, packed
const boxes = hls.map((h) => h.box);
const hit = (a, m) => boxes.some((b) => a[0] - m[0] < b[2] && a[2] + m[0] > b[0] && a[1] - m[1] < b[3] && a[3] + m[1] > b[1]);
const nearCorridor = (a, m) => corridor.some(([x, y]) => x > a[0] - m && x < a[2] + m && y > a[1] - m && y < a[3] + m);

const placed = [];
let seed = 0;
for (const b of BANDS) {
  const s = b.size;
  const gw = s * 0.95, gh = s * 0.7, gap = s * 0.42;
  const w = gw + gap + monoW("src", s, 1);
  const want = b.n - 1;
  let got = 0;
  // generous spacing first, then tighter passes fill the gaps: an even, unruled scatter
  for (const m of [1.2, 1.0, 0.85, 0.72, 0.62, 0.54, 0.47, 0.42, 0.36]) {
    for (let k = 0; k < 30000 && got < want; k++) {
      const q = k + Math.round(m * 1e5);
      const x = FX0 + 12 + rand(q, 11 + b.d) * (FX1 - FX0 - 24 - w);
      const base = b.y0 + 8 + s * 0.8 + rand(q, 29 + b.d) * (b.h - 16 - s * 0.92);
      const box = [x, base - s * 0.8, x + w, base + s * 0.12];
      if (hit(box, [s * m, s * m * 0.7])) continue;
      if (nearCorridor(box, 6)) continue;
      boxes.push(box);
      placed.push({ x, y: base, s, gw, gh, gap, d: b.d, ink: b.ink, i: seed++ });
      got++;
    }
  }
  if (got < want) console.warn(`depth ${b.d}: placed ${got} of ${want}`);
}
// draw order: top to bottom, left to right, so the draw-on stagger reads as a sweep
placed.sort((a, z) => a.y - z.y || a.x - z.x);
for (const p of placed) {
  det.push(folder(p.x, p.y - p.gh - 1, p.gw, p.gh));
  lbl.push(mono(p.x + p.gw + p.gap, p.y, "src", { size: r1(p.s), ls: 1 }).replace("<text ", `<text fill-opacity="${p.ink}" `));
}

// ---------------------------------------------------------------- L-con: construction
// the field's neat line, graduated top and bottom
con.push(line(FX0, FY0, FX1, FY0), line(FX0, FY1, FX1, FY1));
con.push(line(FX0, FY0, FX0, FY1), line(FX1, FY0, FX1, FY1));
con.push(ticks(FX0, FY0, FX1, FY0, 49, 5, 7, -1));
con.push(ticks(FX0, FY1, FX1, FY1, 49, 5, 7, 1));
// strata boundaries
for (const b of BANDS.slice(1)) con.push(centreLine(FX0, b.y0, FX1, b.y0, [9, 7]));
// depth axis
const AX = 118;
con.push(dimLine(AX, FY0, AX, FY1));
for (const b of [...BANDS.map((z) => z.y0), FY1]) con.push(line(AX - 12, b, AX + 12, b));
con.push(ticks(AX, FY0, AX, FY1, 38, 5, 38, 1));

// perspective rays: from the field's right neat line to the tip, stopping at the guide circle
const RAYS = 17, RR = 96;
for (let i = 0; i < RAYS; i++) {
  const y0 = FY0 + 16 + ((FY1 - FY0 - 32) * i) / (RAYS - 1);
  const L = Math.hypot(TIP[0] - FX1, TIP[1] - y0);
  const ux = (TIP[0] - FX1) / L, uy = (TIP[1] - y0) / L;
  con.push(centreLine(FX1, y0, TIP[0] - ux * RR, TIP[1] - uy * RR, [7, 6]));
}
con.push(circle(TIP[0], TIP[1], RR));
{
  let d = "";
  for (let a = 120; a <= 240; a += 4) {
    const t = (a * Math.PI) / 180, l = a % 20 === 0 ? 12 : 6;
    d += `M${P(TIP[0] + RR * Math.cos(t), TIP[1] + RR * Math.sin(t))}L${P(TIP[0] + (RR + l) * Math.cos(t), TIP[1] + (RR + l) * Math.sin(t))}`;
  }
  con.push(path_(d));
}
con.push(circle(TIP[0], TIP[1], RR / 2));
con.push(centreLine(TIP[0], TIP[1] - RR - 40, TIP[0], TIP[1] + RR + 40));
con.push(centreLine(TIP[0] - RR - 30, TIP[1], CX0 - 8, TIP[1]));

// ---------------------------------------------------------------- highlighted namesakes
for (const [i, h] of hls.entries()) {
  main.push(folder(h.x, h.y - 16, 22, 16));
  det.push(hatch(h.x + 2, h.y - 12, 18, 10, 3.4, -45));
  lbl.push(
    `<text x="${r1(h.textX)}" y="${r1(h.y)}" font-size="${HS}" letter-spacing="1" class="mono" font-family="JetBrains Mono, ui-monospace, monospace" fill="currentColor"><tspan fill-opacity="0.55">${h.path}</tspan>src</text>`,
  );
  acc.push(circle(h.dot[0], h.dot[1], 5));
  const { s, c, e } = curves[i];
  acc.push(path_(`M${P(...s)}Q${P(...c)} ${P(...e)}`));
}

// the rule they show: a namesake is told apart by the folders above it
{
  const h = hls.find((z) => z.d === 2);
  const lx = h.textX + monoW("magnet", HS, 1) / 2, ly = h.y - HS - 2;
  det.push(circle(lx, ly, 3.2));
  det.push(path_(`M${P(lx, ly - 3)}L${P(lx, FY0 - 38)}L${P(lx + 26, FY0 - 38)}`));
  lbl.push(note(lx + 36, FY0 - 30, "each is told apart by the folders above it", { size: 24 }));
}

// ---------------------------------------------------------------- the depth gutter
lbl.push(mono(AX - 16, FY0 - 30, "DEPTH", { anchor: "end", size: 16, ls: 2 }));
lbl.push(mono(AX + 16, FY0 - 30, "SRC", { size: 16, ls: 2 }));
for (const b of BANDS) {
  const cy = (b.y0 + b.y1) / 2;
  lbl.push(display(AX - 18, cy + 14, String(b.d), { anchor: "end", size: 44 }));
  lbl.push(mono(AX + 18, cy + 7, String(b.n), { size: 18, ls: 1 }));
}

// ---------------------------------------------------------------- the numeral
lbl.push(display(CX0 - 8, 262, String(TOTAL), { size: 222 }));
con.push(path_(`M${P(CX0, 274)}L${P(CX0, 290)}M${P(CX0, 282)}L${P(CX1, 282)}M${P(CX1, 274)}L${P(CX1, 290)}`));
lbl.push(mono(CX0, 318, "FOLDERS CALLED src", { size: 20, ls: 3 }));

// ---------------------------------------------------------------- the card
const F = 34; // dog-ear
main.push(path_(`M${P(CX0, CY0)}L${P(CX1 - F, CY0)}L${P(CX1, CY0 + F)}L${P(CX1, CY1)}L${P(CX0, CY1)}Z`));
main.push(path_(`M${P(CX1 - F, CY0)}L${P(CX1 - F, CY0 + F)}L${P(CX1, CY0 + F)}`));
det.push(hatch(CX1 + 3, CY0 + F + 12, 13, CY1 - CY0 - F - 2, 8, -45));
det.push(hatch(CX0 + 14, CY1 + 3, CX1 - CX0 + 2, 13, 8, -45));
const IX = CX0 + 30, IX1 = CX1 - 30;
lbl.push(mono(IX, CY0 + 42, "/wiki/src", { size: 18, ls: 1 }));
det.push(line(IX, CY0 + 60, IX1 - 10, CY0 + 60));
lbl.push(display(IX, CY0 + 132, "src", { size: 68 }));
main.push(line(IX, CY0 + 152, IX1, CY0 + 152));
det.push(line(IX, CY0 + 158, IX1, CY0 + 158));
lbl.push(
  `<text x="${IX}" y="${CY0 + 204}" font-size="27" class="serif-i" font-family="Newsreader, Georgia, serif" font-style="italic" fill="currentColor"><tspan font-weight="700">src</tspan> may refer to:</text>`,
);
lbl.push(mono(IX1, CY0 + 202, "FILES", { anchor: "end", size: 16, ls: 2 }));
PICKS.forEach((pk, i) => {
  const ry = rowsY[i];
  det.push(circle(IX + 6, ry - 8, 2.6));
  lbl.push(display(IX + 22, ry, pk.title, { size: 29 }));
  lbl.push(mono(IX1, ry, String(pk.files), { anchor: "end", size: 18, ls: 1 }));
  det.push(line(IX, ry + 16, IX1, ry + 16));
});
lbl.push(note(IX + 22, rowsY.at(-1) + 62, `and ${TOTAL - PICKS.length} more`, { size: 26 }));

// ---------------------------------------------------------------- L-acc: the brace
{
  const x = BR_X, k = 16, m = TIP[1];
  acc.push(path_(`M${P(x + k, BR_T)}Q${P(x, BR_T)} ${P(x, BR_T + k)}L${P(x, m - k)}Q${P(x, m)} ${P(TIP[0] + 8, m)}`));
  acc.push(path_(`M${P(x + k, BR_B)}Q${P(x, BR_B)} ${P(x, BR_B - k)}L${P(x, m + k)}Q${P(x, m)} ${P(TIP[0] + 8, m)}`));
  acc.push(circle(TIP[0], TIP[1], 6.5));
}

// registration marks at the plate's corners
for (const [x, y] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]]) con.push(register(x, y, 14));

writePlate("names", "Namesakes: 204 folders called src gather into one disambiguation page", { con, main, det, acc, lbl });
console.log(`field labels ${placed.length + hls.length} of ${TOTAL}`);
