// 16 · More roots. innernet.config.json as an engraved code card; beside it the depth
// rings of ~/Programming (the real tree from 01, as a ghost) on one survey baseline. On
// "machine" a dimension line marks THIS MACHINE and the HUD meter answers; on "Add a root"
// the second root types into the config, and a second set of rings opens beside the
// first, in link blue, its branches reaching outward as the crawl reaches further.
// ~/Documents/notes is illustrative (FACTS: the live index has one root); its branches
// are a seeded sketch, never named.

import { nodes, branch } from "./_tree.mjs";

const A = { x: 1160, y: 470 };
const RA = [45, 77, 104, 129, 150, 170]; // depth 1 to 6; 1 to 4 match 01's tree, scaled
const ST = 1.6; // 01's ellipse stretch
const TS = RA[3] / 336; // 01's depth-4 radius lands on ring 4
const KB = 0.78;
const RB = RA.map((r) => Math.round(r * KB));
const B = { x: 1788 - Math.round(RB[5] * ST), y: A.y };
const DIM = { y: 770, x0: 890, x1: 1788, gap: 290 };
const LH = 50; // code line height

const r1 = (v) => Math.round(v * 10) / 10;

function rings(c, R, cls) {
  const dashed = R.slice(0, 5).map((r, i) => `<ellipse class="rg ${cls} d${i + 1}" cx="${c.x}" cy="${c.y}" rx="${r1(r * ST)}" ry="${r}"/>`).join("");
  const rx = r1(R[5] * ST), ry = R[5], sx = cls === "b" ? -rx : rx;
  const lim = `<path pathLength="100" class="rg-lim ${cls}" d="M${c.x + sx} ${c.y}A${rx} ${ry} 0 1 ${cls === "b" ? 1 : 0} ${c.x - sx} ${c.y}A${rx} ${ry} 0 1 ${cls === "b" ? 1 : 0} ${c.x + sx} ${c.y}"/>`;
  // a surveyor's dial: ticks every 10 degrees just outside the depth limit
  let d = "";
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2, long = i % 9 === 0 ? 9 : 4;
    const ox = R[5] * ST + 5, oy = R[5] + 5 / ST;
    const x = c.x + Math.cos(a) * ox, y = c.y + Math.sin(a) * oy;
    const ux = Math.cos(a) * ST, uy = Math.sin(a), n = Math.hypot(ux, uy);
    d += `M${r1(x)} ${r1(y)}l${r1((ux / n) * long)} ${r1((uy / n) * long)}`;
  }
  return `<g class="rings-${cls}">${dashed}${lim}<path class="dial ${cls}" d="${d}"/></g>`;
}

// The second root's branches: a seeded sketch (mulberry32), laid out like 01's tree.
function sketchTree() {
  let s = 0x9e3779b9;
  const rnd = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [];
  const R = [0, ...RB];
  const grow = (px, py, a0, a1, depth) => {
    const a = (a0 + a1) / 2;
    const x = B.x + Math.cos(a) * R[depth] * ST, y = B.y + Math.sin(a) * R[depth];
    const rm = (R[depth] + R[depth - 1]) / 2;
    const cx = B.x + Math.cos(a) * rm * ST, cy = B.y + Math.sin(a) * rm;
    out.push({ depth, d: `M${r1(px)} ${r1(py)}Q${r1(cx)} ${r1(cy)} ${r1(x)} ${r1(y)}`, x: r1(x), y: r1(y) });
    if (depth >= 6) return;
    const kids = depth === 1 ? 2 + Math.floor(rnd() * 2) : rnd() < 0.86 - depth * 0.1 ? 1 + (rnd() < 0.35 ? 1 : 0) : 0;
    for (let i = 0; i < kids; i++) grow(x, y, a0 + ((a1 - a0) * i) / kids, a0 + ((a1 - a0) * (i + 1)) / kids, depth + 1);
  };
  const N = 7, off = -Math.PI * 0.5;
  for (let i = 0; i < N; i++) {
    const w = (Math.PI * 2) / N;
    grow(B.x, B.y, off + i * w + w * 0.12, off + (i + 1) * w - w * 0.12, 1);
  }
  return out;
}

const lock = `<svg class="lk" viewBox="0 0 16 18" width="16" height="18"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>`;

export default {
  id: "16",
  css: `
#s16 .cam { position: absolute; inset: 0; transform-origin: 1160px 520px; }
#s16 .card { position: absolute; left: 150px; top: 262px; width: 660px; height: 500px; background: var(--surface); border: 2px solid var(--line); border-radius: 14px; box-shadow: 0 2px 6px rgba(28,27,24,.05), 0 40px 80px -36px rgba(28,27,24,.32); overflow: hidden; }
#s16 .card .rules { position: absolute; inset: 0; }
#s16 .card .rules line { stroke: var(--line); stroke-width: 1.4; stroke-dasharray: 100 110; }
#s16 .card .rules .margin { stroke: color-mix(in oklab, var(--link) 45%, transparent); }
#s16 .file { position: absolute; left: 100px; top: 40px; font: 500 26px/1 "JetBrains Mono", monospace; color: var(--ink); }
#s16 .kind { position: absolute; right: 40px; top: 44px; font: 400 18px/1 "JetBrains Mono", monospace; letter-spacing: 4px; color: var(--muted); }
#s16 .code { position: absolute; left: 0; right: 0; top: 128px; }
#s16 .shift { position: absolute; left: 0; right: 0; top: 0; }
#s16 .ln { position: absolute; left: 0; right: 0; height: ${LH}px; font: 400 30px/${LH}px "JetBrains Mono", monospace; white-space: pre; color: var(--ink2); }
#s16 .ln .tx { position: absolute; left: 100px; }
#s16 .ln .k { color: var(--ink); }
#s16 .ln .p { color: var(--muted); }
#s16 .ln .s { color: var(--ink2); }
#s16 .ln.new .tx { color: var(--link); }
#s16 .hl { position: absolute; left: 78px; right: 26px; top: 4px; height: ${LH - 8}px; border-radius: 6px; background: color-mix(in oklab, var(--link) 11%, transparent); transform-origin: 0 50%; }
#s16 .plus { position: absolute; left: 62px; top: 0; font: 600 24px/${LH}px "JetBrains Mono", monospace; color: var(--link); }
#s16 .caret { display: inline-block; width: 15px; height: 32px; margin-left: 3px; vertical-align: -6px; background: var(--link); opacity: 0; }
#s16 .gno { position: absolute; left: 0; width: 56px; text-align: right; font: 400 19px/${LH}px "JetBrains Mono", monospace; color: var(--muted); }
#s16 svg.field { position: absolute; inset: 0; overflow: visible; }
#s16 .rg { fill: none; stroke: var(--con); stroke-width: 1.2; stroke-dasharray: 3 7; }
#s16 .rg-lim { fill: none; stroke: var(--ink2); stroke-width: 1.7; stroke-dasharray: 100 110; }
#s16 .dial { fill: none; stroke: var(--con); stroke-width: 1.2; }
#s16 .rg.b { stroke: color-mix(in oklab, var(--link) 62%, transparent); }
#s16 .rg-lim.b { stroke: var(--link); stroke-width: 2; }
#s16 .dial.b { stroke: color-mix(in oklab, var(--link) 55%, transparent); }
#s16 .axis { fill: none; stroke: var(--con); stroke-width: 1.1; stroke-dasharray: 100 110; }
#s16 .tree { opacity: .78; }
#s16 .tree .br { fill: none; stroke: var(--ink2); stroke-width: 2.6; stroke-dasharray: 100 110; }
#s16 .tree .br.d1 { stroke: var(--ink); stroke-width: 3.6; }
#s16 .tree .nd { fill: var(--ink); }
#s16 .tree .nd.d3, #s16 .tree .nd.d4 { fill: var(--ink2); }
#s16 .bt { fill: none; stroke: var(--link); stroke-width: 1.15; stroke-dasharray: 100 110; }
#s16 .bt.d1 { stroke-width: 1.7; }
#s16 .bn { fill: var(--link); }
#s16 .core { fill: var(--ink); }
#s16 .core.b { fill: var(--link); }
#s16 .focus { fill: none; stroke: var(--link); stroke-width: 2; stroke-dasharray: 100 110; }
#s16 .dim { fill: none; stroke: var(--ink2); stroke-width: 1.5; stroke-dasharray: 100 110; }
#s16 .rl { position: absolute; width: 420px; margin-left: -210px; text-align: center; font: 400 22px/1 "JetBrains Mono", monospace; color: var(--ink2); white-space: nowrap; }
#s16 .rl.b { color: var(--link); font-weight: 500; }
#s16 .rl small { display: block; margin-top: 10px; text-align: center; font: italic 400 22px/1 Newsreader, Georgia, serif; color: var(--muted); letter-spacing: 0; }
#s16 .rl.b small { color: color-mix(in oklab, var(--link) 75%, var(--muted)); }
#s16 .mach { position: absolute; left: ${(DIM.x0 + DIM.x1) / 2 - 200}px; width: 400px; top: ${DIM.y - 11}px; display: flex; justify-content: center; align-items: center; gap: 10px; font: 500 18px/1 "JetBrains Mono", monospace; letter-spacing: 5px; color: var(--ink2); white-space: nowrap; }
#s16 .mach .lk { stroke: var(--link); stroke-width: 1.9; fill: none; }
`,
  html(ctx) {
    const tx = (s) => ctx.esc(s);
    // lines: [number, markup]. Line 4 is the new root; 5 to 7 sit one line lower in the end state.
    const L = [
      [1, `<span class="p">{</span>`],
      [2, `  <span class="k">"roots"</span><span class="p">: [</span>`],
      [3, `    <span class="s">"~/Programming"</span><span class="p cm">,</span>`],
      [5, `  <span class="p">],</span>`],
      [6, `  <span class="k">"maxDepth"</span><span class="p">: </span><span class="s">6</span>`],
      [7, `<span class="p">}</span>`],
    ];
    const ln = ([n, m]) => `<div class="ln ${n >= 5 ? "after" : "before"}" style="top:${(n - 1) * LH}px"><span class="tx">${m}</span></div>`;
    const lines = L.filter(([n]) => n < 5).map(ln).join("") + `<div class="shift" id="s16-shift">${L.filter(([n]) => n >= 5).map(ln).join("")}</div>`;
    const newLine = `<div class="ln new" style="top:${3 * LH}px"><span class="hl"></span><span class="plus">+</span><span class="tx">    <span class="typed" data-text="&quot;~/Documents/notes&quot;">"~/Documents/notes"</span><span class="caret"></span></span></div>`;
    // the gutter stays put: 1 to 6 from the start, 7 arrives with the new line
    const no6 = [1, 2, 3, 4, 5, 6, 7].map((n) => `<div class="gno${n === 7 ? " g7" : ""}" style="top:${(n - 1) * LH}px">${n}</div>`).join("");
    const cardRules = `<svg class="rules" viewBox="0 0 660 500" width="660" height="500"><line pathLength="100" x1="0" y1="102" x2="660" y2="102"/><line pathLength="100" class="margin" x1="78" y1="0" x2="78" y2="500"/></svg>`;

    // the field: baseline, two ring sets, the ghost tree, the second root's sketch
    const s = TS;
    const tree = `<g class="tree" transform="translate(${r1(A.x - 960 * s)} ${r1(A.y - 515 * s)}) scale(${r1(s * 1000) / 1000})">
      <g class="branches">${nodes.map(branch).join("").replace(/ acc"/g, '"')}</g>
      <g class="nodes">${nodes.filter((n) => n.depth > 0).map((n) => `<circle class="nd d${n.depth}" cx="${r1(n.x)}" cy="${r1(n.y)}" r="${[0, 4.2, 3.2, 2.6, 2.2][n.depth] * 1.7}"/>`).join("")}</g>
    </g>`;
    const bt = sketchTree();
    const btree = `<g class="btree">${bt.map((b) => `<path pathLength="100" class="bt d${b.depth}" d="${b.d}"/>`).join("")}${bt.map((b) => `<circle class="bn d${b.depth}" cx="${b.x}" cy="${b.y}" r="${[0, 3.8, 3, 2.4, 2, 1.8, 1.7][b.depth]}"/>`).join("")}</g>`;
    const half = DIM.gap / 2, mid = (DIM.x0 + DIM.x1) / 2;
    const ah = (x, dir) => `M${x + dir * 12} ${DIM.y - 6}L${x} ${DIM.y}L${x + dir * 12} ${DIM.y + 6}`;
    const dim = `<path pathLength="100" class="dim dl" d="M${mid - half} ${DIM.y}L${DIM.x0} ${DIM.y}${ah(DIM.x0, 1)}M${DIM.x0} ${DIM.y - 16}V${DIM.y + 16}"/>
      <path pathLength="100" class="dim dr" d="M${mid + half} ${DIM.y}L${DIM.x1} ${DIM.y}${ah(DIM.x1, -1)}M${DIM.x1} ${DIM.y - 16}V${DIM.y + 16}"/>`;
    const field = `<svg class="field" viewBox="0 0 1920 1080" width="1920" height="1080">
      <path pathLength="100" class="axis ax-h" d="M${DIM.x0 - 4} ${A.y}H${DIM.x1 + 4}"/>
      <path pathLength="100" class="axis ax-a" d="M${A.x} ${A.y - RA[5] - 22}V${A.y + RA[5] + 22}"/>
      <path pathLength="100" class="axis ax-b" d="M${B.x} ${B.y - RB[5] - 22}V${B.y + RB[5] + 22}"/>
      ${rings(A, RA, "a")}
      ${tree}
      <circle class="core" cx="${A.x}" cy="${A.y}" r="7"/>
      ${rings(B, RB, "b")}
      ${btree}
      <circle class="core b" cx="${B.x}" cy="${B.y}" r="7"/>
      <circle pathLength="100" class="focus" cx="${B.x}" cy="${B.y}" r="15"/>
      ${dim}
    </svg>`;
    return `${ctx.fig(9, "MORE ROOTS")}
<div class="cam" id="s16-cam">
  <div class="card" id="s16-card">${cardRules}
    <div class="file" id="s16-file" data-text="innernet.config.json">innernet.config.json</div>
    <div class="kind" id="s16-kind">CONFIG</div>
    <div class="code" id="s16-code">${lines}${newLine}${no6}</div>
  </div>
  ${field}
  <div class="rl a" id="s16-la" style="left:${A.x}px;top:${A.y + RA[5] + 34}px">${tx("~/Programming")}<small>5,484 folders</small></div>
  <div class="rl b" id="s16-lb" style="left:${B.x}px;top:${B.y + RA[5] + 34}px">${tx("~/Documents/notes")}<small>a second root</small></div>
  <div class="mach" id="s16-mach">${lock}<span>THIS MACHINE</span></div>
</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s);
    const $$ = (s) => Array.from(el.querySelectorAll(s));
    const A = { x: 1160, y: 470 };
    const card = $("#s16-card");
    const bAxis = $(".ax-b");
    const bx = +bAxis.getAttribute("d").match(/^M([\d.]+)/)[1];

    // camera: settle in, then a slow drift toward the second root
    k.camera($("#s16-cam"), S, T, { from: { scale: 1.035, x: 18, y: 10 }, mid: { scale: 1, x: 0, y: 0 }, to: { scale: 1.018, x: -8, y: -4 }, settle: 1.2 });
    k.fade($(".fig"), S + 0.15, 0.5);

    // the card arrives as a page; its file name types on, its lines settle in
    tl.fromTo(card, { opacity: 0, y: 34, rotationX: 8, transformPerspective: 1600 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.7, ease: "power3.out" }, S + 0.02);
    k.draw($$(".card .rules line"), S + 0.2, 0.6, 0.2, "power2.out");
    k.typeOn("#s16-file", S + 0.25, 0.55);
    k.fade($("#s16-kind"), S + 0.6, 0.4);
    k.rise($$(".ln.before, .ln.after"), S + 0.42, { y: 12, dur: 0.5, stagger: 0.06 });
    k.fade($$(".gno:not(.g7)"), S + 0.5, 0.5);

    // the first root: baseline and rings open from the centre, the ghost tree grows by depth
    k.draw($$(".ax-h, .ax-a"), S + 0.05, 1.1, 0.15, "power2.inOut");
    tl.fromTo($$(".rg.a"), { opacity: 0, scale: 0.55, svgOrigin: `${A.x} ${A.y}` }, { opacity: 1, scale: 1, svgOrigin: `${A.x} ${A.y}`, duration: 0.8, ease: "expo.out", stagger: 0.07 }, S + 0.08);
    k.draw([$(".rg-lim.a")], S + 0.3, 1.0, 0, "power2.inOut");
    k.fade($(".dial.a"), S + 0.9, 0.6);
    tl.fromTo($(".core:not(.b)"), { opacity: 0, scale: 0.2, svgOrigin: `${A.x} ${A.y}` }, { opacity: 1, scale: 1, svgOrigin: `${A.x} ${A.y}`, duration: 0.45, ease: "back.out(2)" }, S + 0.05);
    [1, 2, 3, 4].forEach((d, i) => {
      k.draw($$(`.tree .br.d${d}`), S + 0.25 + i * 0.28, 0.6, 0.35, "power2.out");
      tl.fromTo($$(`.tree .nd.d${d}`), { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "none", stagger: { each: 0.35 / Math.max(1, $$(`.tree .nd.d${d}`).length) } }, S + 0.5 + i * 0.28);
    });
    k.rise($("#s16-la"), S + 1.0, { y: 10, dur: 0.6 });

    // "machine": the dimension marks this machine, the HUD meter answers
    const m = k.word(seg, "machine");
    k.draw($$(".dim"), m - 0.1, 0.8, 0, "power2.inOut");
    k.rise($("#s16-mach"), m, { y: 6, dur: 0.5, ease: "power2.out" });
    tl.fromTo($("#s16-mach .lk"), { scale: 1.6, transformOrigin: "50% 60%" }, { scale: 1, duration: 0.45, ease: "back.out(2.4)" }, m + 0.05);
    k.pulseMeter(m, 2.6);

    // "Add a root": the lines below open, the new root types on
    const add = k.word(seg, "Add");
    tl.fromTo($("#s16-shift"), { y: -50 }, { y: 0, duration: 0.42, ease: "power3.inOut" }, add - 0.05);
    k.fade($(".g7"), add + 0.15, 0.3);
    k.fade($(".cm"), add + 0.05, 0.15);
    k.strike($(".hl"), add + 0.25, 0.45, 0);
    tl.fromTo($(".plus"), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, add + 0.3);
    const caret = $(".caret");
    const t0 = add + 0.36, tdur = 0.85;
    tl.fromTo(caret, { opacity: 0 }, { opacity: 1, duration: 0.05, ease: "none" }, t0 - 0.05);
    k.typeOn($(".typed"), t0, tdur);
    // the caret blinks twice after typing, then rests out
    [0.3, 0.6, 0.9, 1.2, 1.5].forEach((d, i) => tl.fromTo(caret, { opacity: i % 2 ? 0 : 1 }, { opacity: i % 2 ? 1 : 0, duration: 0.04, ease: "none", immediateRender: false }, t0 + tdur + d));

    // "root": a second set of rings opens beside the first, in link blue
    const root = k.word(seg, "root");
    tl.fromTo($(".core.b"), { opacity: 0, scale: 0.2, svgOrigin: `${bx} ${A.y}` }, { opacity: 1, scale: 1, svgOrigin: `${bx} ${A.y}`, duration: 0.5, ease: "back.out(2.2)" }, root + 0.05);
    k.draw([$(".focus")], root + 0.1, 0.6, 0, "power2.out");
    k.draw([bAxis], root, 0.7, 0, "power2.out");
    tl.fromTo($$(".rg.b"), { opacity: 0, scale: 0.3, svgOrigin: `${bx} ${A.y}` }, { opacity: 1, scale: 1, svgOrigin: `${bx} ${A.y}`, duration: 0.9, ease: "expo.out", stagger: 0.09 }, root + 0.15);
    k.draw([$(".rg-lim.b")], root + 0.4, 0.9, 0, "power2.inOut");
    k.fade($(".dial.b"), root + 1.0, 0.6);
    k.rise($("#s16-lb"), root + 0.55, { y: 10, dur: 0.6 });

    // "the crawl reaches further": the second root's branches grow outward, depth by depth
    const crawl = k.word(seg, "crawl");
    for (let d = 1; d <= 6; d++) {
      k.draw($$(`.bt.d${d}`), crawl - 0.15 + (d - 1) * 0.17, 0.42, 0.18, "power2.out");
      tl.fromTo($$(`.bn.d${d}`), { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "none" }, crawl + 0.12 + (d - 1) * 0.17);
    }
  },
  sfx(ctx) {
    const S = ctx.seg.start;
    return [
      { name: "pencil", at: S + 0.2, vol: 0.2 },
      { name: "keys", at: ctx.word("Add") + 0.3, vol: 0.32 },
    ];
  },
};
