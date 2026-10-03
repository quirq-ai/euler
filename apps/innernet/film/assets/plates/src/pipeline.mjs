// PLATE: THE PIPELINE. Guide chapter I (Fig. 1) and the ground of film frame 06.
//
// Left to right: the folder tree under ~/Programming, the indexer (a two-roller mill with
// a stopwatch dial), data/index.json (a bound ledger whose foot carries the totals), then
// the two readers that share that one file, search (a lens) above and Innerpedia (an open
// book) below, and finally you (an eye). The whole drawing sits inside one dashed
// boundary, this machine, sealed at the foot: nothing leaves it.
// L-acc is the main flow line, cut into short stations so it draws on in order.
// Every name and number is real (data/index.json of 2 October 2026, see FACTS.md).

import {
  W, H, P, r1, line, circle, rect, path_, polyline, mono, note, display,
  centreLine, arrow, curveArrow, arrowHead, dimLine, hatch, hatchCircle, ticks, folder,
  writing, register, rand, writePlate,
} from "./lib.mjs";

const con = [], main = [], det = [], acc = [], lbl = [];
const AX = 490; // the flow axis

// ---------------------------------------------------------------- local helpers
const TAU = Math.PI * 2;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const M = (pts, close = false) => "M" + pts.map(([x, y]) => P(x, y)).join("L") + (close ? "Z" : "");
const arcD = (cx, cy, r, a0, a1, n = 32) => M(Array.from({ length: n + 1 }, (_, i) => pol(cx, cy, r, a0 + ((a1 - a0) * i) / n)));
const quad = (x1, y1, cx, cy, x2, y2) => `M${P(x1, y1)}Q${P(cx, cy)} ${P(x2, y2)}`;
const qAt = (x1, y1, cx, cy, x2, y2, t) => [
  (1 - t) ** 2 * x1 + 2 * t * (1 - t) * cx + t * t * x2,
  (1 - t) ** 2 * y1 + 2 * t * (1 - t) * cy + t * t * y2,
];

/** Parallel hatching clipped to any polygon (even-odd), one path. */
function hatchPoly(poly, deg = -45, sp = 8) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const pr = poly.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
  const vs = pr.map((p) => p[1]);
  let d = "";
  for (let v = Math.min(...vs) + sp / 2; v < Math.max(...vs); v += sp) {
    const xs = [];
    for (let i = 0; i < pr.length; i++) {
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

/** A dashed line as one path. */
function dashed(x1, y1, x2, y2, on = 10, off = 7) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  let d = "";
  for (let t = 0; t < L; t += on + off) {
    const e = Math.min(t + on, L);
    d += `M${P(x1 + ux * t, y1 + uy * t)}L${P(x1 + ux * e, y1 + uy * e)}`;
  }
  return path_(d);
}

/** Dotted leader (table-of-contents style). */
function dots(x1, x2, y, gap = 7) {
  let d = "";
  for (let x = x1; x <= x2; x += gap) d += `M${P(x, y)}L${P(x + 0.6, y)}`;
  return path_(d);
}

// ================================================================ the boundary: this machine
const B = { x0: 26, y0: 44, x1: 1574, y1: 930, r: 30 };
{
  // dashed rounded rectangle, broken at the foot for the seal and its legend
  const { x0, y0, x1, y1, r } = B;
  const gap = [586, 1084];
  det.push(dashed(x0 + r, y0, x1 - r, y0, 14, 8));
  det.push(dashed(x1, y0 + r, x1, y1 - r, 14, 8));
  det.push(dashed(x0, y1 - r, x0, y0 + r, 14, 8));
  det.push(dashed(x1 - r, y1, gap[1], y1, 14, 8));
  det.push(dashed(gap[0], y1, x0 + r, y1, 14, 8));
  for (const [cx, cy, a0] of [[x0 + r, y0 + r, Math.PI], [x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2]])
    det.push(path_(arcD(cx, cy, r, a0, a0 + Math.PI / 2, 8)));
}

// ================================================================ I. the folder tree
// Real folders in crawl order (depth first, names sorted), kinds from the index.
const TREE = [
  [0, "~/Programming", "root"],
  [1, "Auto-GPT", "repo"],
  [1, "magnet", "repo"],
  [1, "solidity", "folder"],
  [1, "XO", "project"],
  [2, "ClaudeWorkspace", "repo"],
  [3, "experiments", "folder"],
  [4, "computing-age", "project"],
  [4, "innernet", "project"],
  [5, "app", "code"],
  [5, "components", "code"],
  [5, "lib", "code"],
  [5, "scripts", "code"],
  [4, "linear-clone", "project"],
  [4, "space-walk", "repo"],
  [3, "xo-swarm", "repo"],
];
const TX = 58, IND = 24, ROW = 33, TY = 214, GW = 24, GH = 18;
const BRACE_X = 370;
const rowY = (i) => TY + i * ROW;
{
  const parentOf = [];
  const stack = [];
  TREE.forEach(([d], i) => {
    stack[d] = i;
    parentOf[i] = d > 0 ? stack[d - 1] : -1;
  });
  TREE.forEach(([d, name, kind], i) => {
    const x = TX + d * IND, y = rowY(i);
    const article = kind !== "folder" && kind !== "code";
    (article ? main : det).push(folder(x, y - GH / 2, GW, GH));
    if (kind === "repo") det.push(circle(x + GW / 2, y + 2, 3.6));
    if (kind === "root") det.push(circle(x + GW / 2, y + 2, 3.6), circle(x + GW / 2, y + 2, 1.2));
    lbl.push(mono(x + GW + 8, y + 6, name, { size: 18, ls: 0.6 }));
    // elbow connector from the parent
    const p = parentOf[i];
    if (p >= 0) {
      const px = TX + TREE[p][0] * IND + 7, py = rowY(p) + GH / 2 + 1;
      det.push(path_(`M${P(px, py)}L${P(px, y)}L${P(x - 3, y)}`));
    }
    // dotted leader to the collecting brace
    const tw = name.length * 11.4 + 6;
    const lx = x + GW + 8 + tw + 8;
    if (lx < BRACE_X - 16) det.push(dots(lx, BRACE_X - 12, y + 1));
  });
}
lbl.push(mono(TX + 120, 752, "YOUR FOLDERS", { size: 22, ls: 3, anchor: "middle" }));
lbl.push(mono(TX + 120, 780, "depth first, by name", { size: 18, ls: 0.6, anchor: "middle" }));
// the brace that gathers every folder into one stream
{
  const y0 = rowY(0) - 6, y1 = rowY(TREE.length - 1) + 6, ym = AX, x = BRACE_X, k = 14;
  main.push(path_(`M${P(x - k, y0)}Q${P(x, y0)} ${P(x, y0 + k)}L${P(x, ym - k)}Q${P(x, ym)} ${P(x + k, ym)}`));
  main.push(path_(`M${P(x + k, ym)}Q${P(x, ym)} ${P(x, ym + k)}L${P(x, y1 - k)}Q${P(x, y1)} ${P(x - k, y1)}`));
}
// depth ruler and pages-per-depth step histogram above the tree (real counts)
{
  const DEPTH = [1, 40, 192, 476, 1089, 1591, 2095];
  const base = 160, top = 92, cx = (d) => TX + d * IND + GW / 2;
  con.push(line(cx(0) - 12, base, cx(6) + 12, base));
  det.push(ticks(cx(0), base, cx(6), base, 6, 6, 1, 1));
  let d = `M${P(cx(0) - IND / 2, base)}`;
  DEPTH.forEach((n, i) => {
    const h = ((base - top) * n) / 2095, x0 = cx(i) - IND / 2, x1 = cx(i) + IND / 2;
    d += `L${P(x0, base - h)}L${P(x1, base - h)}`;
  });
  d += `L${P(cx(6) + IND / 2, base)}`;
  main.push(path_(d));
  DEPTH.forEach((n, i) => {
    const h = ((base - top) * n) / 2095;
    if (h > 6) det.push(hatch(cx(i) - IND / 2 + 2, base - h + 2, IND - 4, h - 4, 5, -45));
  });
  for (let i = 0; i <= 6; i++) lbl.push(mono(cx(i), base + 26, String(i), { size: 18, ls: 0, anchor: "middle" }));
  lbl.push(mono(cx(6) + 26, top + 8, "2,095", { size: 18, ls: 1 }));
  lbl.push(mono(cx(6) + 26, top + 32, "PAGES AT DEPTH 6", { size: 18, ls: 1.5 }));
  lbl.push(mono(cx(6) + 26, base + 26, "DEPTH", { size: 18, ls: 2 }));
}

// ================================================================ II. the indexer, a roller press
// Drawn as an engraver's rolling press in elevation, cut away to show both rollers: the
// folders ride the bed through the nip and come out as the ledger. A crank turns the top
// roller; a stopwatch above it stands at 51 seconds (the last run, 51,029 ms).
const EX = 520, RR = 50, RY1 = AX - 60, RY2 = AX + 62;
const BED = [392, 672];
{
  // cast frame: arched crown concentric with the top roller, sides slotted for the bed, flared feet
  const FR = 70, fx0 = EX - FR, fx1 = EX + FR, slot = [AX - 9, AX + 13];
  main.push(path_(`M${P(fx0 - 22, 664)}L${P(fx0, 616)}L${P(fx0, slot[1])}`));
  main.push(path_(`M${P(fx0, slot[0])}L${P(fx0, RY1)}A${FR} ${FR} 0 0 1 ${P(fx1, RY1)}L${P(fx1, slot[0])}`));
  main.push(path_(`M${P(fx1, slot[1])}L${P(fx1, 616)}L${P(fx1 + 22, 664)}`));
  det.push(path_(`M${P(fx0 + 8, slot[0])}L${P(fx0 + 8, RY1)}A${FR - 8} ${FR - 8} 0 0 1 ${P(fx1 - 8, RY1)}L${P(fx1 - 8, slot[0])}`));
  det.push(path_(`M${P(fx0 + 8, slot[1])}L${P(fx0 + 8, 612)}M${P(fx1 - 8, slot[1])}L${P(fx1 - 8, 612)}`));
  det.push(path_(`M${P(fx0 - 8, slot[0])}L${P(fx0 + 8, slot[0])}M${P(fx0 - 8, slot[1])}L${P(fx0 + 8, slot[1])}M${P(fx1 - 8, slot[0])}L${P(fx1 + 8, slot[0])}M${P(fx1 - 8, slot[1])}L${P(fx1 + 8, slot[1])}`));
  // cross-tie low in the frame, hatched as a cut section
  main.push(rect(fx0 + 8, 616, fx1 - fx0 - 16, 14));
  det.push(hatch(fx0 + 8, 616, fx1 - fx0 - 16, 14, 6, -45));
  // bed with feed and delivery tables, carried on small rollers and stands
  main.push(rect(BED[0], AX + 3, BED[1] - BED[0], 7));
  // the tables are cantilevered from the frame on diagonal brackets
  main.push(path_(`M${P(BED[0] + 14, AX + 10)}L${P(fx0, AX + 58)}`), path_(`M${P(BED[1] - 14, AX + 10)}L${P(fx1, AX + 58)}`));
  det.push(path_(`M${P(BED[0] + 30, AX + 10)}L${P(fx0, AX + 40)}`), path_(`M${P(BED[1] - 30, AX + 10)}L${P(fx1, AX + 40)}`));
  // the shaded (right) cheek of the frame
  det.push(hatch(fx1 - 7, slot[1] + 3, 6, 612 - slot[1] - 6, 6, -45));
  // plinth, bolts, ground section
  main.push(rect(BED[0] - 4, 664, BED[1] - BED[0] + 8, 16));
  for (let x = BED[0] + 14; x < BED[1]; x += 40) det.push(circle(x, 672, 2.6));
  det.push(hatch(BED[0] - 4, 681, BED[1] - BED[0] + 8, 14, 8, -50));
  // rollers: rim, inner rim, knurl, hub, five tapered spokes
  for (const [cy, ph] of [[RY1, 0.2], [RY2, 0.83]]) {
    main.push(circle(EX, cy, RR), circle(EX, cy, 14));
    det.push(circle(EX, cy, RR - 8), circle(EX, cy, 5));
    let k = "";
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU, [x1, y1] = pol(EX, cy, RR - 2, a), [x2, y2] = pol(EX, cy, RR - 7, a);
      k += `M${P(x1, y1)}L${P(x2, y2)}`;
    }
    det.push(path_(k));
    for (let i = 0; i < 5; i++) {
      const a = ph + (i / 5) * TAU;
      const [a1x, a1y] = pol(EX, cy, 14, a - 0.22), [a2x, a2y] = pol(EX, cy, RR - 8, a - 0.07);
      const [b1x, b1y] = pol(EX, cy, 14, a + 0.22), [b2x, b2y] = pol(EX, cy, RR - 8, a + 0.07);
      main.push(path_(`M${P(a1x, a1y)}L${P(a2x, a2y)}M${P(b1x, b1y)}L${P(b2x, b2y)}`));
    }
  }
  // the crank on the top roller
  {
    const a = -0.72, L = 112, u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]];
    const p0 = [EX + u[0] * 16, RY1 + u[1] * 16], p1 = [EX + u[0] * L, RY1 + u[1] * L];
    main.push(path_(`M${P(p0[0] + n[0] * 6, p0[1] + n[1] * 6)}L${P(p1[0] + n[0] * 4, p1[1] + n[1] * 4)}M${P(p0[0] - n[0] * 6, p0[1] - n[1] * 6)}L${P(p1[0] - n[0] * 4, p1[1] - n[1] * 4)}`));
    main.push(circle(p1[0], p1[1], 11));
    det.push(circle(p1[0], p1[1], 6), hatchCircle(p1[0], p1[1], 6, 3, 45));
  }
  // turning arrow: the top roller runs back over its crown, so the nip carries the bed right
  con.push(path_(arcD(EX, RY1, FR + 18, -1.95, -2.75, 16) + arrowHead(...pol(EX, RY1, FR + 18, -2.75), -2.75 - Math.PI / 2, 9)));
  // centre lines
  con.push(centreLine(EX, RY1 - FR - 22, EX, RY2 + RR + 20));
  con.push(centreLine(EX - FR - 28, RY1, EX + FR + 28, RY1));
  con.push(centreLine(EX - FR - 28, RY2, EX + FR + 28, RY2));
  // the stopwatch on its bracket: 51 seconds of 60
  const DX = EX, DY = 262, DR = 44;
  main.push(path_(`M${P(DX - 6, DY + DR)}L${P(DX - 6, RY1 - FR)}M${P(DX + 6, DY + DR)}L${P(DX + 6, RY1 - FR)}`));
  main.push(circle(DX, DY, DR), rect(DX - 7, DY - DR - 13, 14, 11, 2), path_(`M${P(DX - 12, DY - DR - 17)}L${P(DX + 12, DY - DR - 17)}`));
  det.push(circle(DX, DY, DR - 6));
  let tk = "";
  for (let s = 0; s < 60; s++) {
    const a = -Math.PI / 2 + (s / 60) * TAU, [x1, y1] = pol(DX, DY, DR - 6, a), [x2, y2] = pol(DX, DY, DR - (s % 5 ? 10 : 15), a);
    tk += `M${P(x1, y1)}L${P(x2, y2)}`;
  }
  det.push(path_(tk));
  const aEnd = -Math.PI / 2 + (51 / 60) * TAU;
  const sector = [[DX, DY], ...Array.from({ length: 41 }, (_, i) => pol(DX, DY, DR - 17, -Math.PI / 2 + (aEnd + Math.PI / 2) * (i / 40)))];
  det.push(hatchPoly(sector, 30, 5));
  main.push(path_(`M${P(...pol(DX, DY, 10, aEnd + Math.PI))}L${P(...pol(DX, DY, DR - 8, aEnd))}`), circle(DX, DY, 4));
  lbl.push(mono(DX - DR - 16, DY - 4, "51 s", { size: 20, ls: 1, anchor: "end" }));
  lbl.push(mono(DX - DR - 16, DY + 22, "OF 60", { size: 18, ls: 1.5, anchor: "end" }));
  // captions
  lbl.push(mono(EX, 752, "THE INDEXER", { size: 22, ls: 3, anchor: "middle" }));
  lbl.push(mono(EX, 780, "pnpm index", { size: 18, ls: 1, anchor: "middle" }));
}

// ================================================================ III. data/index.json, a ledger
const LX0 = 740, LX1 = 1020, LY0 = 196, LY1 = 806;
{
  // page stack behind (right and bottom edges only), cover, binding
  for (const o of [4, 8, 12]) det.push(path_(M([[LX0 + o, LY1 + o], [LX1 + o, LY1 + o], [LX1 + o, LY0 + o]])));
  main.push(rect(LX0, LY0, LX1 - LX0, LY1 - LY0));
  main.push(line(LX0 + 24, LY0, LX0 + 24, LY1));
  let st = "";
  for (let y = LY0 + 18; y < LY1 - 8; y += 26) st += `M${P(LX0 + 8, y)}L${P(LX0 + 16, y)}`;
  det.push(path_(st));
  det.push(hatch(LX0 + 1, LY0 + 1, 22, LY1 - LY0 - 2, 6, -45));
  // header
  const cx0 = LX0 + 40;
  lbl.push(mono(cx0, LY0 + 38, "data/index.json", { size: 20, ls: 0.8 }));
  main.push(line(LX0 + 24, LY0 + 56, LX1, LY0 + 56));
  det.push(line(LX0 + 24, LY0 + 61, LX1, LY0 + 61));
  // column rules: sigil, slug, depth
  const cDepth = LX1 - 22, ty = 664, rule = ty - 20;
  det.push(line(cx0 + 22, LY0 + 61, cx0 + 22, rule));
  det.push(line(cDepth - 13, LY0 + 61, cDepth - 13, rule));
  // entries in crawl order, real slugs; the sigil shape follows the kind (round for repos)
  const ENTRIES = [
    ["Programming", "root", 0], ["Auto-GPT", "repo", 1], ["magnet", "repo", 1], ["XO", "project", 1],
    ["ClaudeWorkspace", "repo", 2], ["computing-age", "project", 4], ["innernet", "project", 4],
    ["app_(innernet)", "code", 5], ["lib_(innernet)", "code", 5], ["linear-clone", "project", 4], ["xo-swarm", "repo", 3],
  ];
  ENTRIES.forEach(([slug, kind, depth], i) => {
    const y = LY0 + 90 + i * 30;
    const sx = cx0 + 10, sy = y - 6;
    const stub = kind === "code";
    if (kind === "repo") main.push(circle(sx, sy, 6.5));
    else (stub ? det : main).push(rect(sx - 6.5, sy - 6.5, 13, 13, kind === "root" ? 2.5 : stub ? 2.3 : 4));
    lbl.push(mono(cx0 + 30, y, slug, { size: 18, ls: 0.2 }));
    lbl.push(mono(cDepth + 4, y, String(depth), { size: 18, ls: 0, anchor: "middle" }));
    det.push(line(cx0 + 22, y + 9, LX1 - 4, y + 9));
  });
  // and so on, down the page
  for (const dy of [-8, 0, 8]) det.push(circle(cx0 + 90, LY0 + 90 + ENTRIES.length * 30 - 10 + dy, 1.4));
  // totals under a single rule, closed by a double rule
  main.push(line(LX0 + 24, rule, LX1, rule));
  const TOT = [["FOLDERS", "5,484"], ["ARTICLES", "958"], ["REPOSITORIES", "172"]];
  TOT.forEach(([k, v], i) => {
    const y = ty + 22 + i * 42;
    lbl.push(mono(cx0, y, k, { size: 18, ls: 2 }));
    lbl.push(display(LX1 - 14, y + 6, v, { size: 42, anchor: "end" }));
  });
  main.push(line(LX0 + 24, LY1 - 14, LX1, LY1 - 14));
  det.push(line(LX0 + 24, LY1 - 9, LX1, LY1 - 9));
}

// ================================================================ IV. the readers
const SX = 1228, SY = 292, SR = 78; // search lens
{
  main.push(circle(SX, SY, SR));
  det.push(circle(SX, SY, SR - 8));
  // handle up and to the right: neck, ferrule, grip
  const ha = -Math.PI / 4, u = [Math.cos(ha), Math.sin(ha)], n = [-u[1], u[0]];
  const seg = (d0, d1, w) => {
    const a = [SX + u[0] * d0, SY + u[1] * d0], b = [SX + u[0] * d1, SY + u[1] * d1];
    return [[a[0] + n[0] * w, a[1] + n[1] * w], [b[0] + n[0] * w, b[1] + n[1] * w], [b[0] - n[0] * w, b[1] - n[1] * w], [a[0] - n[0] * w, a[1] - n[1] * w]];
  };
  main.push(path_(M(seg(SR, SR + 14, 6))));
  const fer = seg(SR + 14, SR + 34, 11);
  main.push(path_(M(fer, true)));
  det.push(hatchPoly(fer, 45 + 90, 4));
  const grip = seg(SR + 34, SR + 120, 13);
  const end = [SX + u[0] * (SR + 120), SY + u[1] * (SR + 120)];
  main.push(path_(`M${P(...grip[0])}L${P(...grip[1])}A13 13 0 0 1 ${P(...grip[2])}L${P(...grip[3])}`));
  det.push(hatchPoly(seg(SR + 40, SR + 114, 7), -45 + 90, 9));
  void end;
  // inside the glass: a query box and three results (title rule and two snippet rules)
  const inC = (y, pad = 14) => {
    const h = Math.sqrt(Math.max(0, (SR - pad) ** 2 - (y - SY) ** 2));
    return [SX - h, SX + h];
  };
  det.push(rect(SX - 46, SY - 52, 92, 16, 8));
  det.push(path_(`M${P(SX + 30, SY - 44)}L${P(SX + 34, SY - 40)}`), circle(SX + 27, SY - 47, 4));
  let rows = "";
  for (let k = 0; k < 3; k++) {
    const y0 = SY - 18 + k * 30;
    const [a, b] = inC(y0 + 12, 16);
    rows += `M${P(Math.max(a, SX - 56), y0 + 6)}L${P(Math.max(a, SX - 56) + 18, y0 + 6)}`;
    rows += `M${P(Math.max(a, SX - 56), y0 + 13)}L${P(Math.min(b, SX + 56), y0 + 13)}`;
    rows += `M${P(Math.max(a, SX - 56), y0 + 20)}L${P(Math.min(b, SX + 56) - 22, y0 + 20)}`;
    main.push(path_(`M${P(Math.max(a, SX - 56), y0)}L${P(Math.max(a, SX - 56) + 64 - k * 10, y0)}`));
  }
  det.push(path_(rows));
  det.push(path_(arcD(SX, SY, SR - 16, 3.6, 4.3, 10)), path_(arcD(SX, SY, SR - 24, 3.75, 4.1, 6)));
  {
    const a0 = -0.35, a1 = 1.95, n = 30;
    const ring = [...Array.from({ length: n + 1 }, (_, i) => pol(SX, SY, SR - 1, a0 + ((a1 - a0) * i) / n)), ...Array.from({ length: n + 1 }, (_, i) => pol(SX, SY, SR - 7, a1 - ((a1 - a0) * i) / n))];
    det.push(hatchPoly(ring, 45, 4));
  }
  con.push(circle(SX, SY, SR + 16));
  con.push(centreLine(SX - SR - 26, SY, SX + SR + 26, SY), centreLine(SX, SY - SR - 26, SX, SY + SR + 26));
  lbl.push(mono(SX, SY + SR + 50, "SEARCH", { size: 22, ls: 3, anchor: "middle" }));
  lbl.push(note(SX, SY + SR + 78, "finds anything you type", { size: 22, anchor: "middle" }));
}
const BX = 1228, BY = 700; // Innerpedia, an open book (spine at BX)
{
  const half = 142, top = BY - 58, bot = BY + 76, dip = 14, lift = 16;
  // pages: outer edges, top and bottom curves meeting at the spine
  const L0 = BX - half, R0 = BX + half;
  main.push(path_(`M${P(L0, top)}Q${P(BX - half / 2, top - lift)} ${P(BX, top + dip)}`));
  main.push(path_(`M${P(R0, top)}Q${P(BX + half / 2, top - lift)} ${P(BX, top + dip)}`));
  main.push(path_(`M${P(L0, bot)}Q${P(BX - half / 2, bot - lift)} ${P(BX, bot + dip)}`));
  main.push(path_(`M${P(R0, bot)}Q${P(BX + half / 2, bot - lift)} ${P(BX, bot + dip)}`));
  main.push(line(L0, top, L0, bot), line(R0, top, R0, bot), line(BX, top + dip, BX, bot + dip));
  // page block under the leaves, and the cover
  for (const o of [5, 10]) det.push(path_(`M${P(L0 - o * 0.4, bot + o * 0.5)}Q${P(BX - half / 2, bot - lift + o)} ${P(BX, bot + dip + o * 0.7)}Q${P(BX + half / 2, bot - lift + o)} ${P(R0 + o * 0.4, bot + o * 0.5)}`));
  main.push(path_(`M${P(L0 - 10, top + 8)}L${P(L0 - 10, bot + 14)}Q${P(BX - half / 2, bot - lift + 18)} ${P(BX, bot + dip + 14)}Q${P(BX + half / 2, bot - lift + 18)} ${P(R0 + 10, bot + 14)}L${P(R0 + 10, top + 8)}`));
  // cast shadow under the cover, engraved as short level strokes
  {
    let d = "";
    for (let i = 0; i < 4; i++) {
      const y = bot + 30 + i * 6, w = half - 4 - i * 24;
      d += `M${P(BX - w, y + (i ? 0 : -2))}L${P(BX - 10, y)}M${P(BX + 10, y)}L${P(BX + w, y + (i ? 0 : -2))}`;
    }
    det.push(path_(d));
  }
  // left page: title rule, lead, prose
  const yAt = (x, y0) => {
    // follow the page curve a little: rows dip toward the spine
    const t = 1 - Math.abs(x - BX) / half;
    return y0 + t * t * dip * 0.9;
  };
  const rowsOn = (xa, xb, y0, n, gap, seed) => {
    let d = "";
    for (let i = 0; i < n; i++) {
      const k = rand(i, seed), len = i === n - 1 ? 0.45 + 0.3 * k : 0.85 + 0.15 * k;
      const xe = xa + (xb - xa) * len, y = y0 + i * gap;
      d += `M${P(xa, yAt(xa, y))}Q${P((xa + xe) / 2, yAt((xa + xe) / 2, y) + 1)} ${P(xe, yAt(xe, y))}`;
    }
    return path_(d);
  };
  main.push(path_(`M${P(L0 + 18, top + 14)}L${P(L0 + 74, top + 12)}`));
  det.push(rowsOn(L0 + 18, BX - 16, top + 34, 7, 12, 3));
  det.push(rowsOn(L0 + 18, BX - 16, top + 34 + 7 * 12 + 4, 1, 12, 9));
  // right page: infobox with a round sigil, prose beside it
  const ix = R0 - 66, iy = top + 6;
  det.push(rect(ix, iy, 52, 92));
  main.push(circle(ix + 26, iy + 20, 11));
  det.push(hatchCircle(ix + 26, iy + 20, 11, 4, -30));
  for (let i = 0; i < 5; i++) det.push(line(ix + 7, iy + 42 + i * 10, ix + (i % 2 ? 38 : 45), iy + 42 + i * 10));
  det.push(rowsOn(BX + 14, ix - 10, top + 20, 8, 12, 5));
  con.push(centreLine(BX, top - 30, BX, bot + 40));
  lbl.push(mono(BX, BY - 116, "INNERPEDIA", { size: 22, ls: 3, anchor: "middle" }));
  lbl.push(note(BX, BY - 90, "958 articles, 4,526 stubs", { size: 22, anchor: "middle" }));
}

// ================================================================ V. you, the reader
const EYX = 1478, EYY = AX;
{
  const x0 = EYX - 74, x1 = EYX + 74;
  main.push(path_(quad(x0, EYY, EYX, EYY - 64, x1, EYY)), path_(quad(x0, EYY, EYX, EYY + 58, x1, EYY)));
  det.push(path_(quad(x0 + 10, EYY - 12, EYX, EYY - 86, x1 - 10, EYY - 12)));
  det.push(path_(quad(x0 + 14, EYY + 9, EYX, EYY + 66, x1 - 14, EYY + 9)));
  // lashes along the upper lid
  let ls = "";
  for (let i = 1; i < 12; i++) {
    const t = i / 12, [x, y] = qAt(x0, EYY, EYX, EYY - 64, x1, EYY, t);
    const tx = 2 * (1 - t) * (EYX - x0) + 2 * t * (x1 - EYX), ty = 2 * (1 - t) * (EYY - 64 - EYY) + 2 * t * (EYY - (EYY - 64));
    const m = Math.hypot(tx, ty), nx = ty / m, ny = -tx / m;
    ls += `M${P(x, y)}L${P(x + nx * 9 + (t - 0.5) * 6, y + ny * 9)}`;
  }
  det.push(path_(ls));
  // iris, pupil, striations, catch light
  main.push(circle(EYX, EYY - 2, 29));
  det.push(circle(EYX, EYY - 2, 24));
  let st = "";
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    if (a > 3.7 && a < 4.5) continue;
    const [x1, y1] = pol(EYX, EYY - 2, 14, a), [x2, y2] = pol(EYX, EYY - 2, 23, a);
    st += `M${P(x1, y1)}L${P(x2, y2)}`;
  }
  det.push(path_(st));
  main.push(circle(EYX, EYY - 2, 12));
  det.push(hatchCircle(EYX, EYY - 2, 12, 3, -45), hatchCircle(EYX, EYY - 2, 12, 3, 45));
  det.push(circle(EYX - 10, EYY - 14, 4));
  con.push(centreLine(EYX, EYY - 96, EYX, EYY + 80), circle(EYX, EYY - 2, 44));
  lbl.push(mono(EYX, EYY + 112, "YOU", { size: 22, ls: 3, anchor: "middle" }));
  lbl.push(note(EYX, EYY + 140, "the reader", { size: 22, anchor: "middle" }));
  lbl.push(mono(EYX, EYY + 170, "localhost:3470", { size: 18, ls: 0.6, anchor: "middle" }));
}

// ================================================================ the flow (L-acc), station by station
const FORK = [1052, AX];
acc.push(arrow(BRACE_X + 16, AX, EX - RR - 26, AX, 12));                       // the folders, gathered, onto the bed
acc.push(path_(`M${P(EX - RR - 14, AX)}L${P(EX + RR + 14, AX)}`));             // through the nip
acc.push(arrow(EX + RR + 26, AX, LX0 - 8, AX, 12));                            // into the ledger
acc.push(path_(`M${P(LX1 + 20, AX)}L${P(FORK[0] - 6, AX)}`), circle(FORK[0], FORK[1], 6)); // out of the ledger, to the fork
acc.push(curveArrow(FORK[0] + 3, AX - 6, 1088, 336, SX - SR - 10, SY + 20, 12));   // read as search
acc.push(curveArrow(FORK[0] + 3, AX + 6, 1084, 656, BX - 160, BY - 4, 12));        // read as Innerpedia
acc.push(curveArrow(SX + SR * 0.8, SY + SR * 0.6, 1354, 424, EYX - 84, EYY - 8, 12)); // and on to you
acc.push(curveArrow(BX + 154, BY - 48, 1362, 556, EYX - 84, EYY + 8, 12));
lbl.push(note(FORK[0] + 24, AX + 8, "two readers share it", { size: 22 }));
// the flow axis itself, as a centre line where nothing stands on it
con.push(centreLine(44, AX, BRACE_X - 4, AX));
con.push(centreLine(EYX + 86, AX, B.x1 - 8, AX));

// ================================================================ dimensions in time: a chain under the plate
{
  const y = 878, lc = (LX0 + LX1) / 2;
  con.push(line(BRACE_X, 724, BRACE_X, y + 12), line(LX0, LY1 + 20, LX0, y + 12), line(LX1, LY1 + 20, LX1, y + 12), line(EYX, EYY + 184, EYX, y + 12));
  con.push(dimLine(BRACE_X + 2, y, LX0 - 2, y), dimLine(LX0 + 2, y, LX1 - 2, y), dimLine(LX1 + 2, y, EYX - 2, y));
  lbl.push(note((BRACE_X + LX0) / 2, y - 12, "indexed in under a minute", { size: 24, anchor: "middle" }));
  lbl.push(note(lc, y - 12, "one file, 7.9 MB", { size: 24, anchor: "middle" }));
  lbl.push(note((LX1 + EYX) / 2, y - 12, "read in milliseconds", { size: 24, anchor: "middle" }));
}

// ================================================================ the seal at the foot: nothing leaves
{
  const cx = 800, cy = B.y1;
  // a small engraved padlock sitting on the boundary
  main.push(rect(cx - 15, cy - 12, 30, 24, 3));
  main.push(path_(`M${P(cx - 9, cy - 12)}L${P(cx - 9, cy - 20)}A9 9 0 0 1 ${P(cx + 9, cy - 20)}L${P(cx + 9, cy - 12)}`));
  det.push(circle(cx, cy - 2, 3), line(cx, cy + 1, cx, cy + 6));
  lbl.push(mono(cx - 30, cy + 6, "THIS MACHINE", { size: 18, ls: 3, anchor: "end" }));
  lbl.push(mono(cx + 30, cy + 6, "NOTHING LEAVES IT", { size: 18, ls: 3 }));
}

// registration marks at the boundary corners
for (const [x, y] of [[B.x0 + 54, B.y0 + 26], [B.x1 - 54, B.y0 + 26], [B.x0 + 54, B.y1 - 26], [B.x1 - 54, B.y1 - 26]]) con.push(register(x, y, 12));

void W; void H; void r1; void polyline; void dimLine; void writing;
writePlate("pipeline", "The pipeline: your folders, the indexer, data/index.json, search and Innerpedia, and you", { con, main, det, acc, lbl });
