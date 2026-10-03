// 04 · The crawl. The crawl plate engraves itself outward from ~/Programming; the walk
// descends to depth 6 on "indexer walks six" while the caption numeral counts 0 to 6 and
// each folder on the way is named; on "noise" the pruned names are struck through in link
// blue. One slow push toward ring 6.
//
// The plate is read at build time (./_carve.mjs): its parts (rings, the two side columns,
// the strike-throughs, the pruned marks) are found from the plate's own geometry and text,
// so a redrawn plate still lands its strikes on "noise".

import { XL_CSS, dropCorners, emit, fit, parsePlate, splitPath, tag, take, wrap } from "./_carve.mjs";

// Pruned folder names (FACTS.md, "The crawl"): a label naming one of these gets struck.
const PRUNED = new Set(["node_modules", "bower_components", "jspm_packages", "vendor", ".git", ".hg", ".svn", ".next", ".nuxt", ".svelte-kit", ".turbo", ".vercel", ".cache", ".parcel-cache", ".output", "dist", "build", "out", "coverage", "target", "DerivedData", "Pods", "__pycache__", "venv", ".venv", "site-packages", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".gradle", ".dart_tool", ".idea", ".vscode", ".expo", "storybook-static"]);
const HEADERS = ["DEPENDENCIES", "BUILDS", "CACHES"]; // named by the narrator, in order

// Plate placement: 1600x1000 at 0.75 on the right; the caption block sits left.
const P = fit(0.75, 618, 132);

function carve(svg) {
  const p = parsePlate(svg);
  dropCorners(p);
  const L = (n) => p.layers[n]?.items ?? [];
  const all = Object.values(p.layers).flatMap((l) => l.items);

  // The depth rings' centre and radius: the largest circle on the plate.
  const big = all.filter((i) => i.tag === "circle" && i.box).sort((a, b) => b.box.w - a.box.w)[0]?.box;
  const C = big ? { x: big.cx, y: big.cy, r: big.w / 2 } : { x: 800, y: 490, r: 390 };
  const radial = (b) => Math.max(Math.hypot(b.cx - C.x, b.cy - C.y), Math.min(b.w, b.h) / 2);
  const left = (b) => b.cx < C.x - C.r * 1.05;
  const right = (b) => b.cx > C.x + C.r * 1.05 && b.cy < C.y + C.r * 0.9;

  // Pruned labels, and the strikes that run through them.
  const pruned = L("L-lbl").filter((t) => t.tag === "text" && PRUNED.has(t.text));
  pruned.forEach((t) => tag(t, "s04-pruned"));
  const strikes = take(p, (it, l) => l === "L-acc" && it.box && it.box.h < 5 && it.box.w > 40 &&
    pruned.some((t) => Math.abs(it.box.cy - t.box.cy) < 14 && it.box.x0 < t.box.x1 && it.box.x1 > t.box.x0));
  // Pruned marks in the tree: small crosses (two strokes in a square box).
  const marks = take(p, (it, l) => l === "L-acc" && it.tag === "path" && it.box && it.box.w >= 5 && it.box.w <= 16 &&
    Math.abs(it.box.w - it.box.h) < 3 && ((it.open.match(/\sd="[^"]*/) || [""])[0].match(/M/gi) || []).length >= 2);
  // The walk's end: the accent ring around the depth-6 folder (the topmost accent circle).
  const focus = L("L-acc").filter((i) => i.tag === "circle" && i.box).sort((a, b) => a.box.cy - b.box.cy)[0]?.box ?? { cx: C.x, cy: C.y - C.r };

  // Underlines for the three category headers, drawn as the narrator names them.
  const heads = HEADERS.map((h) => L("L-lbl").find((t) => t.tag === "text" && t.text === h)).map((t, i) =>
    t ? `<path pathLength="100" class="s04-u${i}" d="M${t.box.x0.toFixed(1)} ${(t.box.y1 + 7).toFixed(1)}H${(t.box.x1 - 2).toFixed(1)}"/>` : "").join("");

  // The two side columns (the pages-per-depth chart, the pruned list) leave their layers
  // and are drawn on as blocks; labels are timed by region.
  const colL = take(p, (it, l) => l !== "L-acc" && it.box && left(it.box));
  const colR = take(p, (it, l) => l !== "L-acc" && it.box && right(it.box));
  const labels = take(p, (it, l) => l === "L-lbl");
  const tree = [], notes = [];
  for (const t of labels) (t.box && radial(t.box) < C.r * 1.02 ? tree : notes).push(t);
  // Tree labels carry their distance from the root (0 to 1): they appear as the walk passes.
  for (const t of tree) t.src = t.src.replace(/^<(\w+)/, `<$1 data-d="${Math.min(1, radial(t.box) / C.r).toFixed(3)}"`);

  // The walk's arrowheads follow their arcs (one element per subpath).
  if (p.layers["L-acc"]) p.layers["L-acc"].items = p.layers["L-acc"].items.flatMap(splitPath);

  // Rings and branches draw outward from the root: sort each layer by distance.
  for (const n of ["L-con", "L-main", "L-det"]) if (p.layers[n]) p.layers[n].items.sort((a, b) => radial(a.box) - radial(b.box));

  const extra = [
    `<g class="s04-colL">${wrap(p, colL)}</g>`,
    `<g class="s04-colR">${wrap(p, colR)}</g>`,
    wrap(p, strikes, "s04-strikes"),
    wrap(p, marks, "s04-marks"),
    `<g class="xL-acc s04-heads" stroke-width="2.4" stroke-linecap="round">${heads}</g>`,
    `<g class="xL-lbl s04-tree">${tree.map((t) => t.src).join("")}</g>`,
    `<g class="xL-lbl s04-notes">${notes.map((t) => t.src).join("")}</g>`,
  ].join("\n");
  return { svg: emit(p, extra), focus };
}

export default {
  id: "04",
  css: XL_CSS("s04") + `
#s04 .cam { position: absolute; inset: 0; will-change: transform; }
#s04 .plate { position: absolute; left: ${P.ox}px; top: ${P.oy}px; width: ${1600 * P.s}px; height: ${1000 * P.s}px; }
#s04 .s04-heads path { fill: none; stroke: currentColor; }
#s04 .cap { width: 540px; }
#s04 .cap-line { max-width: 540px; }
`,
  html(ctx) {
    const { svg, focus } = carve(ctx.plate("crawl"));
    return `${ctx.fig(ctx.seg.fig, "THE CRAWL")}
<div class="cam" id="s04-cam" style="transform-origin:${P.X(focus.cx)}px ${P.Y(focus.cy)}px">
  <div class="plate" id="s04-plate">${svg}</div>
</div>
${ctx.cap("s04c", { big: "6", unit: "LEVELS DEEP", title: "The crawl", line: "Dependencies, builds and caches are skipped." })}`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s), $$ = (s, sc) => Array.from((sc || el).querySelectorAll(s));
    const W = (w) => k.word(seg, w);
    const SH = "path,line,circle,ellipse,rect,polyline,polygon";
    const tCrawl = W("crawl"), tIdx = W("indexer"), tSix = W("six"), tNoise = W("noise");
    const svg = $(".plate-svg");

    // One calm push toward ring 6, easing out to stillness.
    tl.fromTo($("#s04-cam"), { scale: 0.99, y: 10 }, { scale: 1.04, y: 0, duration: T, ease: "sine.inOut" }, S);

    // The plate engraves outward from the root (started a beat early, so the cut lands on
    // lines already moving); the walk (the accent left in L-acc) descends from "indexer"
    // and reaches depth 6 on "six".
    const walk = tIdx - 0.05;
    k.drawPlate(svg, S - 0.25, T, { acc: walk, mainSpread: 0.2, detSpread: 0.22, accSpread: 1.0 });

    // Side columns: the pages-per-depth chart, then the pruned list, before the walk.
    const colL = $(".s04-colL"), colR = $(".s04-colR");
    k.draw($$(SH, colL), S + 0.7, 0.7, 1.0, "power2.out");
    k.rise($$("text", colL), S + 1.0, { y: 6, dur: 0.45, stagger: 0.04 });
    k.draw($$(SH, colR), S + 1.5, 0.6, 1.0, "power2.out");
    k.rise($$("text", colR), S + 1.7, { y: 6, dur: 0.45, stagger: 0.06 });

    // Folder names inside the rings appear as the walk passes their depth.
    $$(".s04-tree text").forEach((t) => {
      tl.fromTo(t, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "none" }, walk + 0.05 + 0.8 * +(t.getAttribute("data-d") || 0));
    });
    k.rise($$(".s04-notes text"), walk + 0.8, { y: 6, dur: 0.5, stagger: 0.12 });

    // On "noise": strikes through the pruned names, then the crosses in the tree; the
    // struck names fade back, skipped.
    k.draw($$(".s04-strikes path, .s04-strikes line"), tNoise - 0.06, 0.5, 0.75, "power2.inOut");
    k.draw($$(".s04-marks path"), tNoise + 0.15, 0.35, 0.7, "power2.out");
    const pr = $$(".s04-pruned");
    if (pr.length) tl.fromTo(pr, { opacity: 1 }, { opacity: 0.42, duration: 0.6, ease: "power1.inOut", stagger: 0.08, immediateRender: false }, tNoise + 0.35);
    // Each category is underlined as it is named.
    ["dependencies", "builds", "caches"].forEach((w, i) => k.draw($$(`.s04-u${i}`), W(w) - 0.04, 0.45, 0, "power2.out"));

    // Caption block, word by word: the title on "crawl"; the numeral counts the levels as
    // the walk descends and lands on "six"; the line on "dependencies".
    tl.fromTo("#s04c-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.inOut" }, tCrawl - 0.4);
    tl.fromTo("#s04c-title", { opacity: 0, y: 24, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.6, ease: "power3.out" }, tCrawl - 0.2);
    tl.fromTo("#s04c-big", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" }, walk);
    k.countUp("#s04c-big", walk + 0.05, tSix - walk + 0.12, 0, 6);
    tl.fromTo("#s04c-unit", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "none" }, W("levels") - 0.1);
    k.rise($("#s04c-line"), W("dependencies") - 0.25, { y: 12, dur: 0.6 });

    // The whole walk happens on this machine: the HUD meter answers softly as it begins.
    k.pulseMeter(tCrawl, 2.6);
  },
  sfx(ctx) {
    return [
      { name: "tick", at: ctx.word("six") + 0.02, vol: 0.22 },
      { name: "pencil", at: ctx.word("noise") - 0.05, vol: 0.16 },
    ];
  },
};
