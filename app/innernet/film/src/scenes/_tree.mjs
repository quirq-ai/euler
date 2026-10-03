// Shared by scenes 01, 02 and 21: the real ~/Programming tree laid out as a radial map.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(fs.readFileSync(path.resolve(here, "../../../data/index.json"), "utf8"));
const bySlug = new Map(index.pages.map((p) => [p.slug, p]));
const root = index.pages.find((p) => p.depth === 0);
const focus = index.pages.find((p) => p.slug === "linear-clone");
const focusPath = new Set();
for (let p = focus; p; p = bySlug.get(p.parent)) focusPath.add(p.slug);

// Keep the tree legible: the biggest children at each depth, plus the path to linear-clone.
const KEEP = [0, 13, 4, 3, 2];
const CX = 960, CY = 515, RY = [0, 118, 200, 272, 336], STRETCH = 1.6;
const nodes = [];
// Log weights keep giant folders from swallowing the circle.
const weight = (p) => 1 + Math.log10(p.totalFiles + 10);
function place(p, depth, a0, a1) {
  const a = (a0 + a1) / 2;
  const r = RY[depth];
  nodes.push({ p, depth, a, x: CX + Math.cos(a) * r * STRETCH, y: CY + Math.sin(a) * r });
  if (depth >= 4) return;
  const kids = p.children.map((s) => bySlug.get(s)).filter(Boolean).sort((x, y) => y.totalFiles - x.totalFiles);
  const keep = kids.slice(0, KEEP[depth + 1]);
  for (const k of kids) if (focusPath.has(k.slug) && !keep.includes(k)) keep.push(k);
  const total = keep.reduce((s, k) => s + weight(k), 0);
  let cur = a0;
  for (const k of keep) {
    const span = ((a1 - a0) * weight(k)) / total;
    place(k, depth + 1, cur, cur + span);
    cur += span;
  }
}
place(root, 0, -Math.PI * 0.62, Math.PI * 1.38);
const at = new Map(nodes.map((n) => [n.p.slug, n]));

const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function branch(n) {
  const par = at.get(n.p.parent);
  if (!par) return "";
  // curve out from the parent along its own angle, then into the child
  const rMid = (RY[n.depth] + RY[n.depth - 1]) / 2;
  const cx = CX + Math.cos(n.a) * rMid * STRETCH, cy = CY + Math.sin(n.a) * rMid;
  const acc = focusPath.has(n.p.slug);
  return `<path pathLength="100" class="br d${n.depth}${acc ? " acc" : ""}" d="M${r1(par.x)} ${r1(par.y)}Q${r1(cx)} ${r1(cy)} ${r1(n.x)} ${r1(n.y)}"/>`;
}
// Label the focus path, then the biggest folders, skipping any label that would crowd one
// already placed on the same side.
const labelled = new Set(focusPath);
const placed = nodes.filter((n) => focusPath.has(n.p.slug));
const clear = (n) => placed.every((m) => Math.cos(m.a) >= 0 !== Math.cos(n.a) >= 0 || Math.abs(m.y - n.y) > 22 || Math.abs(m.x - n.x) > 190);
for (const [d, max] of [[1, 9], [2, 6]]) {
  let c = 0;
  for (const n of nodes.filter((x) => x.depth === d).sort((a, b) => b.p.totalFiles - a.p.totalFiles)) {
    if (c >= max) break;
    if (labelled.has(n.p.slug) || !clear(n)) continue;
    labelled.add(n.p.slug);
    placed.push(n);
    c++;
  }
}
function label(n) {
  if (!labelled.has(n.p.slug) || n.depth === 0) return "";
  const right = Math.cos(n.a) >= 0;
  const acc = focusPath.has(n.p.slug);
  const dx = right ? 12 : -12;
  return `<text class="lb d${n.depth}${acc ? " acc" : ""}" x="${r1(n.x + dx)}" y="${r1(n.y + 5)}" text-anchor="${right ? "start" : "end"}">${esc(n.p.name.length > 20 ? n.p.name.slice(0, 18) + "…" : n.p.name)}</text>`;
}
const rings = RY.slice(1).map((r, i) => `<ellipse pathLength="100" class="ring" cx="${CX}" cy="${CY}" rx="${r1(r * STRETCH)}" ry="${r}"/>`).join("");
export const f = at.get("linear-clone");


export { nodes, focusPath, CX, CY, RY, STRETCH, rings, branch, label };

/** The tree as SVG markup (no wrapper). `colored` gives each depth-1 node its folder's sigil hues. */
export function treeSvg({ colored = false } = {}) {
  const hue = (slug) => {
    let h = 2166136261;
    for (const c of slug) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    return h % 360;
  };
  return `<g class="rings">${rings}</g>
  <path pathLength="100" class="axis" d="M${CX - 600} ${CY}H${CX + 600}M${CX} ${CY - 360}V${CY + 360}"/>
  <g class="branches">${nodes.map(branch).join("")}</g>
  <g class="nodes">${nodes.filter((n) => n.depth > 0).map((n) => `<circle class="nd d${n.depth}${focusPath.has(n.p.slug) ? " acc" : ""}" cx="${r1(n.x)}" cy="${r1(n.y)}" r="${[0, 4.2, 3.2, 2.6, 2.2][n.depth] * (colored ? 1.9 : 1)}"${colored ? ` style="fill:oklch(0.7 0.14 ${hue(n.p.slug)})"` : ""}/>`).join("")}</g>
  <circle cx="${CX}" cy="${CY}" r="7" class="nd"/>
  <g class="labels">${nodes.map(label).join("")}</g>`;
}

export const TREE_CSS = (id) => `
#${id} .ring { stroke: var(--con); stroke-width: 1.1; fill: none; stroke-dasharray: 3 7; }
#${id} .axis { stroke: var(--con); stroke-width: 1; stroke-dasharray: 100 110; }
#${id} .br { fill: none; stroke: var(--ink2); stroke-width: 1.15; stroke-dasharray: 100 110; }
#${id} .br.d1 { stroke: var(--ink); stroke-width: 1.7; }
#${id} .br.acc { stroke: var(--link); stroke-width: 2.6; }
#${id} .nd { fill: var(--ink); }
#${id} .nd.d3, #${id} .nd.d4 { fill: var(--ink2); }
#${id} .nd.acc { fill: var(--link); }
#${id} .lb { paint-order: stroke; stroke: var(--bg); stroke-width: 6px; stroke-linejoin: round; fill: var(--ink2); font: 400 15px "JetBrains Mono", monospace; letter-spacing: .5px; }
#${id} .lb.d1 { fill: var(--ink); font-size: 17px; }
#${id} .lb.acc { fill: var(--link); font-weight: 600; }
`;
