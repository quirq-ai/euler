// search: how search ranks (guide chapter III).
// The query "linear clone" is cut into two tokens, each token is looked up in the
// inverted index (its postings, field by field, under the field boosts), the pages that
// hold both words are joined (AND), multiplied by the prior (article, shallow, recent),
// sieved by the operators, and laid out as results with a knowledge panel. The whole
// apparatus sits inside one boundary: the machine it runs on.
// Every number is real: index of 2 October 2026, MiniSearch run of "linear clone".
//   node assets/plates/src/search.mjs

import {
  P, r1, line, circle, rect, path_, mono, note, display, centreLine, arrowHead, dimLine,
  hatch, hatchCircle, ticks, register, writing, writePlate,
} from "./lib.mjs";

const L = { con: [], main: [], det: [], acc: [], lbl: [] };

// ---------- local helpers ----------
const rotMono = (x, y, s, o) => `<g transform="rotate(-90 ${r1(x)} ${r1(y)})">${mono(x, y, s, o)}</g>`;

/** Orthogonal route through points with rounded elbows, as a path d string. */
function route(pts, rad = 14) {
  let d = `M${P(...pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const r = Math.min(rad, l1 / 2, l2 / 2);
    d += `L${P(x1 - ((x1 - x0) / l1) * r, y1 - ((y1 - y0) / l1) * r)}Q${P(x1, y1)} ${P(x1 + ((x2 - x1) / l2) * r, y1 + ((y2 - y1) / l2) * r)}`;
  }
  return d + `L${P(...pts.at(-1))}`;
}
const routeArrow = (pts, rad, s = 11) => {
  const [a, b] = pts.slice(-2);
  return path_(route(pts, rad) + arrowHead(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), s));
};
/** A dashed run drawn as separate strokes in one path (no stroke-dasharray, so draw-on still works). */
function dashed(pts, on = 7, off = 6) {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], len = Math.hypot(x2 - x1, y2 - y1);
    for (let t = 0; t < len; t += on + off) {
      const t2 = Math.min(t + on, len);
      d += `M${P(x1 + ((x2 - x1) * t) / len, y1 + ((y2 - y1) * t) / len)}L${P(x1 + ((x2 - x1) * t2) / len, y1 + ((y2 - y1) * t2) / len)}`;
    }
  }
  return path_(d);
}

/** Hatching clipped to any shape given as an inside(x, y) test over a bounding box. */
function hatchIn(inside, [bx, by, bw, bh], spacing = 7, angle = -45) {
  const a = (angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const cx = bx + bw / 2, cy = by + bh / 2, R = Math.hypot(bw, bh) / 2;
  let d = "";
  for (let o = -R + spacing / 2; o < R; o += spacing) {
    let run = null;
    for (let t = -R; t <= R + 0.5; t += 0.5) {
      const x = cx + nx * o + dx * t, y = cy + ny * o + dy * t;
      const ok = t <= R && inside(x, y);
      if (ok && !run) run = [x, y, x, y];
      if (ok) { run[2] = x; run[3] = y; }
      if (!ok && run) {
        if (Math.hypot(run[2] - run[0], run[3] - run[1]) > 2) d += `M${P(run[0], run[1])}L${P(run[2], run[3])}`;
        run = null;
      }
    }
  }
  return path_(d);
}
const inRoundRect = (x0, y0, w, h, rr) => (x, y) => {
  if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return false;
  const qx = Math.max(x0 + rr - x, 0, x - (x0 + w - rr)), qy = Math.max(y0 + rr - y, 0, y - (y0 + h - rr));
  return qx * qx + qy * qy <= rr * rr;
};

/** A type slab: the token as a block of printer's type, extruded up and right. */
function slab(x, y, w, h, word, d = 10) {
  L.main.push(rect(x, y, w, h));
  L.main.push(path_(`M${P(x, y)}L${P(x + d, y - d)}L${P(x + w + d, y - d)}L${P(x + w, y)}`));
  L.main.push(path_(`M${P(x + w + d, y - d)}L${P(x + w + d, y + h - d)}L${P(x + w, y + h)}`));
  let s = "";
  for (let t = 0.2; t < 0.95; t += 0.2) s += `M${P(x + w + d * t, y - d * t + 3)}L${P(x + w + d * t, y + h - d * t - 3)}`;
  L.det.push(path_(s));
  L.det.push(path_(`M${P(x + 14, y - 5)}L${P(x + w - 4, y - 5)}`));
  L.lbl.push(mono(x + w / 2, y + h / 2 + 8, word, { anchor: "middle", size: 23, ls: 1, weight: 600 }));
}

/** A small padlock (shackle and body), drawn closed. */
function padlock(cx, cy, s = 1) {
  const bw = 22 * s, bh = 17 * s, sw = 7 * s, top = cy - bh / 2 + 4 * s;
  L.main.push(rect(cx - bw / 2, top, bw, bh, 3 * s));
  L.main.push(path_(`M${P(cx - sw, top)}L${P(cx - sw, top - 6 * s)}A${r1(sw)},${r1(sw)} 0 0 1 ${P(cx + sw, top - 6 * s)}L${P(cx + sw, top)}`));
  L.det.push(circle(cx, cy + 3 * s, 2.4 * s), line(cx, cy + 5.4 * s, cx, cy + 9 * s));
}

// ---------- the data (real) ----------
const FIELDS = [
  ["NAME", 6, "6"], ["TITLE", 3, "3"], ["SUMMARY", 2, "2"], ["FRAMEWORKS", 1.6, "1.6"], ["CATEGORIES", 1.2, "1.2"],
  ["LANGUAGES", 1.2, "1.2"], ["PATH", 1, "1"], ["DEPENDENCIES", 1, "1"], ["AGENT NOTES", 1, "1"], ["README", 0.6, "0.6"],
];
const NAME = 0, TITLE = 1, SUMMARY = 2, CATS = 4, PATH = 6, README = 9;
const GROUPS = [
  {
    term: "linear", pages: 37, more: 33,
    rows: [
      ["linear-clone", [NAME, TITLE, SUMMARY, PATH, README], true],
      ["linear", [NAME, TITLE, PATH]],
      ["linear_progress", [NAME, TITLE, PATH]],
      ["docs (linear-clone)", [TITLE, CATS, PATH]],
    ],
    variants: [["=", "linear", 35], ["+", "linearly", 1], ["~", "linea", 1]],
  },
  {
    term: "clone", pages: 123, more: 119,
    rows: [
      ["autospawn-clone", [NAME, TITLE, SUMMARY, PATH, README]],
      ["linear-clone", [NAME, TITLE, PATH, README], true],
      ["rclone", [NAME, TITLE, PATH], false, "~"],
      ["docs (linear-clone)", [TITLE, CATS, PATH]],
    ],
    variants: [["=", "clone", 93], ["+", "cloned", 13], ["+", "clones", 12], ["~", "rclone", 17], ["~", "close", 13], ["~", "alone", 5]],
  },
];

// ---------- geometry ----------
const BX0 = 30, BY0 = 30, BX1 = 1570, BY1 = 956;        // the machine boundary
const TX0 = 420, PCOL = 230, CW = 40;                    // table
const FX0 = TX0 + PCOL, TX1 = FX0 + CW * FIELDS.length;  // 650 .. 1050
const TY0 = 196, HDR = 158, RY0 = TY0 + HDR;             // header 196..354
const GH = 34, RH = 36, TH = 28;                         // group head, row, torn row
const BU = 14;                                           // boost bar: units per 1.0
const colMid = (i) => FX0 + CW * i + CW / 2;

let y = RY0;
for (const g of GROUPS) {
  g.y0 = y; g.mid = y + GH / 2; y += GH;
  g.rowMid = g.rows.map((_, i) => y + i * RH + RH / 2);
  y += g.rows.length * RH;
  g.torn = [y, y + TH]; y += TH;
}
const TY1 = y; // table bottom

const GUT = 398;                                         // accent gutter left of the table
const JX = 1084;                                         // AND junction
const MX = 1360, MY = 519, MR = 14;                      // the prior multiplier
const GX = [1235, 1360, 1485], GT = 110, GB = 290, GU = (GB - GT) / 2; // gauges, scale 0..2
const SVY = 590;                                         // the operator sieve
const RX = 1118, RY = 652, RW = 420, RHt = 266;          // results page
const KX = 1380, KY = 698, KW = 148, KH = 206;           // knowledge panel
const TY = 714;                                          // where the path tees into result 1 and the panel

// =====================================================================
// L-con: the machine boundary, registration, margins, guides
// =====================================================================
{
  const gx0 = 392, gx1 = 1208, k = 7; // gap in the foot for the privacy cartouche
  L.con.push(path_(`M${P(gx0, BY1)}L${P(BX0, BY1)}L${P(BX0, BY0)}L${P(BX1, BY0)}L${P(BX1, BY1)}L${P(gx1, BY1)}`));
  L.con.push(path_(`M${P(gx0, BY1 - k)}L${P(BX0 + k, BY1 - k)}L${P(BX0 + k, BY0 + k)}L${P(BX1 - k, BY0 + k)}L${P(BX1 - k, BY1 - k)}L${P(gx1, BY1 - k)}`));
  for (const [x, yy] of [[BX0, BY0], [BX1, BY0], [BX0, BY1], [BX1, BY1]]) L.con.push(register(x, yy, 14));
  L.con.push(ticks(BX0 + 40, BY0 - 1, BX1 - 40, BY0 - 1, 74, 4, 5, -1));
  L.con.push(ticks(BX0 - 1, BY0 + 40, BX0 - 1, BY1 - 40, 44, 4, 5, 1));
  L.con.push(ticks(BX1 + 1, BY0 + 40, BX1 + 1, BY1 - 40, 44, 4, 5, -1));

  // table: extended margins, row ticks, corner marks
  L.con.push(line(TX0, TY0 - 104, TX0, TY1 + 26), line(TX1, TY0 - 104, TX1, TY1 + 26));
  L.con.push(line(TX0 - 14, TY0, TX1 + 14, TY0), line(TX0 - 14, TY1 + 6, TX1 + 14, TY1 + 6));
  for (const g of GROUPS) for (const m of g.rowMid) L.con.push(line(TX0 - 10, m - RH / 2, TX0 - 4, m - RH / 2));

  // boost scale beside the bars, and the 10x guides
  L.con.push(line(FX0 - 14, TY0, FX0 - 14, TY0 - 6 * BU));
  L.con.push(ticks(FX0 - 14, TY0, FX0 - 14, TY0 - 6 * BU, 6, 5, 3, 1));
  L.con.push(line(colMid(0) + 14, TY0 - 6 * BU, TX1 + 34, TY0 - 6 * BU), line(colMid(9) + 14, TY0 - 0.6 * BU, TX1 + 34, TY0 - 0.6 * BU));

  // query box centre line (stubs outside the box only)
  L.con.push(centreLine(44, 126, 56, 126), centreLine(384, 126, 404, 126));

  // the x1 line across the gauges, and the multiplier's cross hairs
  L.con.push(centreLine(GX[0] - 26, GB - GU, GX[2] + 30, GB - GU, [10, 5]));
  L.con.push(circle(MX, MY, 23));
}

// =====================================================================
// 01 QUERY
// =====================================================================
const QX = 60, QY = 96, QW = 320, QH = 60;
L.main.push(rect(QX, QY, QW, QH, 30));
L.main.push(circle(94, 122, 11), line(102, 130, 112, 140));
L.det.push(hatchCircle(94, 122, 8, 4.5, -45));
L.det.push(line(QX + 18, QY + QH + 6, QX + QW - 18, QY + QH + 6));
L.det.push(line(318, 110, 318, 142)); // caret
// the cut: the tokenizer splits at the space between the words
{
  const cx = 227;
  L.det.push(path_(`M${P(cx - 5, QY - 12)}L${P(cx, QY - 4)}L${P(cx + 5, QY - 12)}Z`), path_(`M${P(cx - 5, QY + QH + 16)}L${P(cx, QY + QH + 8)}L${P(cx + 5, QY + QH + 16)}Z`));
  L.con.push(centreLine(cx, QY - 2, cx, QY + QH + 6, [6, 4]));
}
L.lbl.push(mono(122, 135, "linear clone", { size: 26, ls: 0.5 }));
L.lbl.push(mono(QX, 82, "01  QUERY", { size: 18, ls: 3 }));

// =====================================================================
// 02 TOKENS
// =====================================================================
const SX = 90, SW = 150, SH = 38;
const slabY = GROUPS.map((g) => g.mid - SH / 2);
L.lbl.push(mono(150, 232, "02  TOKENS", { size: 18, ls: 3 }));
L.lbl.push(note(150, 264, "lowercased, then split"));
L.lbl.push(note(150, 290, "on spaces and punctuation"));
L.main.push(circle(120, 200, 5)); // the split
GROUPS.forEach((g, gi) => {
  slab(SX, slabY[gi], SW, SH, g.term);
  // the variant fan under the slab: exact (=), prefix (+), one typo (~)
  const fx = 106, top = slabY[gi] + SH;
  const vy = g.variants.map((_, i) => top + 30 + i * 28);
  L.det.push(path_(`M${P(fx, top)}L${P(fx, vy.at(-1) - 6)}`));
  g.variants.forEach(([mark, word, n], i) => {
    L.det.push(line(fx, vy[i] - 6, fx + 10, vy[i] - 6));
    L.lbl.push(mono(122, vy[i], mark, { size: 18, ls: 0 }));
    L.lbl.push(mono(142, vy[i], word, { size: 18, ls: 0.5 }));
    L.lbl.push(mono(330, vy[i], String(n), { size: 18, ls: 0, anchor: "end" }));
    // a dot leader from the word to its count
    let dl = "";
    for (let x = 142 + word.length * 11.3 + 10; x < 330 - String(n).length * 11 - 8; x += 7) dl += `M${P(x, vy[i] - 5)}L${P(x + 1.5, vy[i] - 5)}`;
    L.det.push(path_(dl));
  });
});
L.lbl.push(mono(60, 806, "=  THE WORD ITSELF", { size: 18, ls: 1 }));
L.lbl.push(mono(60, 832, "+  PREFIX, FROM 2 LETTERS", { size: 18, ls: 1 }));
L.lbl.push(mono(60, 858, "~  TYPO MATCH, FROM 5 LETTERS", { size: 18, ls: 1 }));
L.lbl.push(note(60, 896, "linear_clone, LINEAR-CLONE and"));
L.lbl.push(note(60, 922, "clone linear find the same pages"));

// =====================================================================
// 03 INVERTED INDEX: field boosts, the ruled table, postings
// =====================================================================
L.lbl.push(mono(TX0, 82, "03  INVERTED INDEX", { size: 18, ls: 3 }));
L.lbl.push(mono(FX0 - 28, 122, "BOOST", { size: 18, ls: 2, anchor: "end" }));
L.lbl.push(note(FX0 - 28, 154, "what a word is", { anchor: "end" }));
L.lbl.push(note(FX0 - 28, 178, "worth, by field", { anchor: "end" }));
FIELDS.forEach(([, b, s], i) => {
  const x = colMid(i), top = TY0 - b * BU;
  L.main.push(rect(x - 11, top, 22, b * BU));
  L.det.push(hatch(x - 11, top, 22, b * BU, 5, -45));
  L.lbl.push(mono(x, top - 9, s, { size: 18, ls: 0, anchor: "middle" }));
});
L.det.push(dimLine(TX1 + 26, TY0 - 6 * BU, TX1 + 26, TY0 - 0.6 * BU));
L.lbl.push(mono(TX1 + 40, (TY0 - 6 * BU + TY0 - 0.6 * BU) / 2 + 7, "10×", { size: 20, ls: 0 }));

// ruling: outer border, double rules, column rules row by row (never through a head)
L.main.push(rect(TX0, TY0, TX1 - TX0, TY1 - TY0));
L.main.push(line(TX0, TY0 + 5, TX1, TY0 + 5));
L.main.push(line(TX0, RY0 - 5, TX1, RY0 - 5));
L.main.push(line(TX0, TY1 + 6, TX1, TY1 + 6));
for (let i = 0; i < FIELDS.length; i++) {
  const x = FX0 + CW * i;
  L.main.push(line(x, TY0 + 5, x, RY0 - 5));
  for (const g of GROUPS) L.main.push(line(x, g.y0 + GH, x, g.torn[0]));
}
L.det.push(line(TX0, TY0 + 5, FX0, RY0 - 5)); // the corner diagonal
L.lbl.push(mono(FX0 - 12, TY0 + 34, "FIELD", { size: 18, ls: 2, anchor: "end" }));
L.lbl.push(mono(TX0 + 14, RY0 - 18, "PAGE", { size: 18, ls: 2 }));
FIELDS.forEach(([name], i) => L.lbl.push(rotMono(colMid(i) + 7, RY0 - 13, name, { size: 18, ls: 0.5 })));

for (const g of GROUPS) {
  // the term's head row: its word and its posting count
  L.main.push(line(TX0, g.y0, TX1, g.y0));
  L.det.push(line(TX0, g.y0 + 4, TX1, g.y0 + 4));
  L.main.push(line(TX0, g.y0 + GH, TX1, g.y0 + GH));
  L.lbl.push(mono(TX0 + 14, g.mid + 8, g.term, { size: 21, ls: 1, weight: 700 }));
  L.lbl.push(mono(TX1 - 14, g.mid + 7, `${g.pages} PAGES`, { size: 18, ls: 2, anchor: "end" }));
  g.rows.forEach(([page, fields, isTop, mark], i) => {
    const m = g.rowMid[i];
    if (i > 0) L.det.push(line(TX0, m - RH / 2, TX1, m - RH / 2));
    L.lbl.push(mono(TX0 + 14, m + 6, (mark ? `${mark} ` : "") + page, { size: 18, ls: 0 }));
    if (!isTop) for (const f of fields) L.det.push(circle(colMid(f), m, 8));
  });
  // torn continuation: the rest of this term's postings
  const [t0, t1] = g.torn, mid = (t0 + t1) / 2;
  L.main.push(line(TX0, t0, TX1, t0));
  let w = `M${P(FX0 + 4, mid)}`;
  for (let x = FX0 + 4; x <= TX1 - 4; x += 4) w += `L${P(x, mid + 4 * Math.sin((x - FX0) / 9))}`;
  L.main.push(path_(w));
  L.det.push(hatch(FX0 + 2, t0 + 2, TX1 - FX0 - 4, TH - 4, 7, -45));
  L.lbl.push(mono(TX0 + 14, mid + 6, `${g.more} MORE`, { size: 18, ls: 2 }));
}

// AND, then OR
L.lbl.push(note(TX1, TY1 + 46, "AND first: every word must match, 25 pages.", { anchor: "end" }));
L.lbl.push(note(TX1, TY1 + 74, "OR adds pages with some of the words,", { anchor: "end" }));
L.lbl.push(note(TX1, TY1 + 100, "only when AND finds fewer than 5.", { anchor: "end" }));
L.main.push(circle(JX, MY, 6));
L.lbl.push(mono(JX + 18, MY - 12, "AND · 25 PAGES", { size: 18, ls: 1.5, weight: 600 }));
{
  // the OR branch: a dashed line that stays shut (a closed gate across it)
  const ox = 1100, oy = TY1 + 68;
  const ly = 690, gy = 724, vw = 9, vh = 12;
  L.det.push(dashed([[JX + 5, MY + 5], [ox, MY + 20], [ox, ly - 18]]));
  L.det.push(dashed([[ox, gy + vh], [ox, oy - 12]]));
  L.det.push(path_(`M${P(ox, ly + 8)}L${P(ox, gy - vh)}`));
  L.det.push(path_(route([[ox, oy - 12], [ox, oy], [TX1 + 14, oy]], 10) + arrowHead(TX1 + 14, oy, Math.PI, 9)));
  // a valve drawn shut across it: two triangles tip to tip, hatched
  L.main.push(path_(`M${P(ox - vw, gy - vh)}L${P(ox + vw, gy - vh)}L${P(ox - vw, gy + vh)}L${P(ox + vw, gy + vh)}Z`));
  L.det.push(hatchIn((px, py) => Math.abs(px - ox) <= (Math.abs(py - gy) / vh) * vw - 1.5 && Math.abs(py - gy) < vh - 1.5, [ox - vw, gy - vh, 2 * vw, 2 * vh], 3.6, 0));
  L.main.push(line(ox - vw - 5, gy, ox + vw + 5, gy));
  L.lbl.push(mono(ox + 1, ly + 6, "OR", { size: 18, ls: 1, anchor: "middle", weight: 600 }));
}

// =====================================================================
// 04 PRIOR: three gauges into the multiplier
// =====================================================================
const GAUGES = [
  ["ARTICLE", 1.8, "×1.8", "STUB ×1", 1],
  ["SHALLOW", 1 / 1.2, "×0.83", "DEPTH 4"],
  ["RECENT", 1.114, "×1.11", "MAX ×1.25", 1.25],
];
L.lbl.push(mono(RX, 82, "04  PRIOR", { size: 18, ls: 3 }));
for (const [v, s] of [[0, "0"], [1, "1"], [2, "2"]]) L.lbl.push(mono(GX[0] - 40, GB - v * GU + 6, s, { size: 18, ls: 0, anchor: "end" }));
GAUGES.forEach(([name, v, val, sub, mark], i) => {
  const x = GX[i], tw = 28, yv = GB - v * GU;
  L.main.push(rect(x - tw / 2, GT - 8, tw, GB - GT + 16, 14));
  L.det.push(hatchIn((px, py) => py > yv && inRoundRect(x - tw / 2 + 3, GT - 5, tw - 6, GB - GT + 10, 11)(px, py), [x - tw / 2, yv, tw, GB - yv + 8], 4.5, -45));
  L.main.push(line(x - tw / 2 - 8, yv, x + tw / 2 + 8, yv));
  let s = "";
  for (let k = 0; k <= 8; k++) {
    const yy = GB - (k / 4) * GU, len = k % 4 === 0 ? 12 : 6;
    s += `M${P(x - tw / 2 - 4, yy)}L${P(x - tw / 2 - 4 - len, yy)}`;
  }
  L.det.push(path_(s));
  if (mark) {
    const ym = GB - mark * GU;
    L.det.push(path_(`M${P(x + tw / 2 + 4, ym)}L${P(x + tw / 2 + 14, ym - 6)}L${P(x + tw / 2 + 14, ym + 6)}Z`));
  }
  L.lbl.push(mono(x, GB + 36, name, { size: 18, ls: 2, anchor: "middle" }));
  L.lbl.push(display(x, GB + 76, val, { size: 36, anchor: "middle" }));
  L.lbl.push(mono(x, GB + 102, sub, { size: 18, ls: 1, anchor: "middle" }));
});
// manifold: the three factors close into one stem
L.det.push(path_(`M${P(GX[0], GB + 114)}L${P(GX[0], GB + 124)}L${P(GX[2], GB + 124)}L${P(GX[2], GB + 114)}M${P(GX[1], GB + 114)}L${P(GX[1], GB + 132)}`));
L.lbl.push(mono(GX[1], GB + 160, "1.8 × 0.83 × 1.11 ≈ 1.67", { size: 18, ls: 0.5, anchor: "middle" }));
L.det.push(path_(`M${P(GX[1], GB + 172)}L${P(GX[1], MY - MR - 2)}` + arrowHead(GX[1], MY - MR - 2, Math.PI / 2, 8)));
L.main.push(circle(MX, MY, MR));
L.main.push(path_(`M${P(MX - 7, MY - 7)}L${P(MX + 7, MY + 7)}M${P(MX + 7, MY - 7)}L${P(MX - 7, MY + 7)}`));
L.lbl.push(mono(MX + 32, MY - 9, "SCORE ≈ 735", { size: 18, ls: 1.5 }));
L.lbl.push(mono(MX + 32, MY + 19, "440 × 1.67", { size: 18, ls: 0.5 }));

// =====================================================================
// 05 OPERATORS, then the results page and its knowledge panel
// =====================================================================
L.main.push(line(RX, SVY, MX - 16, SVY), line(MX + 16, SVY, BX1 - 24, SVY));
{
  let d = "";
  for (let x = RX + 4; x <= BX1 - 26; x += 8) if (Math.abs(x - MX) > 18) d += `M${P(x, SVY)}L${P(x, SVY + 7)}`;
  L.det.push(path_(d));
}
for (const [x, s] of [[RX + 2, "lang:"], [RX + 104, "in:"], [MX + 24, "kind:"], [MX + 100, "fw:"], [MX + 150, "is:"]]) L.lbl.push(mono(x, SVY - 10, s, { size: 20, ls: 0 }));
L.lbl.push(mono(RX + 2, SVY + 34, "05  OPERATORS", { size: 18, ls: 3 }));
L.lbl.push(note(BX1 - 24, SVY + 34, "filter after scoring", { anchor: "end" }));

L.main.push(rect(RX, RY, RW, RHt));
L.det.push(hatch(RX + RW, RY + 8, 7, RHt - 8, 5, -45), hatch(RX + 8, RY + RHt, RW, 7, 5, -45));
L.det.push(path_(`M${P(RX + 8, RY + RHt + 7)}L${P(RX + RW + 7, RY + RHt + 7)}L${P(RX + RW + 7, RY + 8)}`));
L.lbl.push(mono(RX + 20, RY + 30, "ABOUT 25 RESULTS", { size: 18, ls: 0.5 }));
L.lbl.push(note(KX + KW, RY + 30, "knowledge panel", { anchor: "end" }));
const RES = [["linear-clone", TY + 7], ["docs (linear-clone)", TY + 86], [null, TY + 156]];
RES.forEach(([t, ty], i) => {
  if (t) L.lbl.push(mono(RX + 20, ty, t, { size: i === 0 ? 21 : 18, ls: 0, weight: i === 0 ? 600 : undefined }));
  else L.main.push(line(RX + 20, ty - 6, RX + 150, ty - 6));
  L.det.push(writing(RX + 20, ty + 22, 196, 2, 15, i + 3));
});
// matched words are marked in the snippets: two in the first, one in the second
for (const [x, yy, w] of [[RX + 34, TY + 29, 50], [RX + 128, TY + 29, 30], [RX + 118, TY + 108, 62]]) {
  L.det.push(hatch(x, yy - 5, w, 10, 3, -45));
}
L.main.push(rect(KX, KY, KW, KH, 6));
{
  const sx = KX + 14, sy = KY + 14, ss = 48, sr = ss * 0.3;
  L.main.push(rect(sx, sy, ss, ss, sr));
  const inside = inRoundRect(sx + 2.5, sy + 2.5, ss - 5, ss - 5, sr - 2);
  const band = (px, py) => ((px - sx) + (py - sy)) / (2 * ss);
  L.det.push(hatchIn((px, py) => inside(px, py) && band(px, py) < 0.36, [sx, sy, ss, ss], 4.2, 90));
  L.det.push(hatchIn((px, py) => inside(px, py) && band(px, py) >= 0.36 && band(px, py) < 0.64, [sx, sy, ss, ss], 4.2, -45));
  L.det.push(hatchIn((px, py) => inside(px, py) && band(px, py) >= 0.64, [sx, sy, ss, ss], 4.2, 0));
  L.lbl.push(mono(sx + ss + 10, sy + ss / 2 + 6, "PROJECT", { size: 18, ls: 0 }));
  L.lbl.push(display(sx, sy + ss + 42, "linear-clone", { size: 27 }));
  L.det.push(line(sx, sy + ss + 56, KX + KW - 14, sy + ss + 56));
  L.lbl.push(mono(sx, sy + ss + 82, "TYPESCRIPT", { size: 18, ls: 0 }));
  L.lbl.push(mono(sx, sy + ss + 106, "NEXT.JS", { size: 18, ls: 0 }));
  L.det.push(writing(sx, sy + ss + 128, KW - 28, 2, 14, 9));
}

// =====================================================================
// privacy: the boundary is the machine, and the line says so
// =====================================================================
{
  const cx0 = 392, cx1 = 1208, cy0 = BY1 - 20, cy1 = BY1 + 20;
  L.det.push(rect(cx0, cy0, cx1 - cx0, cy1 - cy0, 4), rect(cx0 + 5, cy0 + 5, cx1 - cx0 - 10, cy1 - cy0 - 10, 2));
  padlock(cx0 + 30, BY1 - 1, 1);
  L.lbl.push(mono(cx0 + 54, BY1 + 6, "IN MEMORY ON 127.0.0.1 · YOUR QUERY NEVER LEAVES THIS MACHINE", { size: 18, ls: 1.5 }));
}

// =====================================================================
// L-acc: the query's path, from the box through the index to the top result
// =====================================================================
{
  L.acc.push(path_(`M${P(120, QY + QH)}L${P(120, 195)}`));
  L.acc.push(routeArrow([[120, 205], [120, slabY[0] - 13]], 0, 10));
  L.acc.push(routeArrow([[115, 200], [66, 200], [66, GROUPS[1].mid], [SX - 4, GROUPS[1].mid]], 16, 10));
  const yThread = [];
  GROUPS.forEach((g) => {
    const k = g.rows.findIndex((r) => r[2]);
    const m = g.rowMid[k];
    yThread.push(m);
    L.acc.push(routeArrow([[SX + SW + 14, g.mid], [GUT, g.mid], [GUT, m], [TX0 - 2, m]], 14, 10));
    // the thread through the fields that hold the word, a bead at each
    const fields = g.rows[k][1].slice().sort((a, b) => a - b);
    let x = FX0;
    for (const f of fields) {
      const cx = colMid(f);
      if (cx - 9 > x + 1) L.acc.push(path_(`M${P(x, m)}L${P(cx - 9, m)}`));
      L.acc.push(circle(cx, m, 9));
      x = cx + 9;
    }
    L.acc.push(path_(`M${P(x, m)}L${P(TX1, m)}`));
  });
  // the AND bracket closes both threads into one
  L.acc.push(path_(route([[TX1, yThread[0]], [JX, yThread[0]], [JX, MY - 6]], 14)));
  L.acc.push(path_(route([[TX1, yThread[1]], [JX, yThread[1]], [JX, MY + 6]], 14)));
  L.acc.push(path_(`M${P(JX + 6, MY)}L${P(MX - MR, MY)}`));
  // through the multiplier and the sieve, down to the tee
  L.acc.push(path_(`M${P(MX, MY + MR)}L${P(MX, TY - 4)}`));
  L.acc.push(circle(MX, TY, 4));
  L.acc.push(path_(`M${P(MX - 4, TY)}L${P(RX + 186, TY)}` + arrowHead(RX + 186, TY, Math.PI, 10)));
  L.acc.push(path_(`M${P(MX + 4, TY)}L${P(KX - 3, TY)}` + arrowHead(KX - 3, TY, 0, 10)));
  L.acc.push(path_(`M${P(RX + 20, TY + 16)}L${P(RX + 172, TY + 16)}`));
}

writePlate("search", "How search ranks: a query cut into tokens, looked up in the inverted index, weighed by the prior, and laid out as results", L);
