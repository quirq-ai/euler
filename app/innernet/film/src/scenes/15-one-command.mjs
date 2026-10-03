// 15 · One command. The camera reaches station 5: the terminal engraves and "pnpm index"
// types on with key ticks. On "right on your machine" a LOCAL tag stamps onto the
// terminal and the HUD privacy meter glows while the crawl runs. The output prints in the
// real console format; on "appears" ARTICLES ticks 958 to 959 and the article below draws
// itself; on "colours" tide-pool's sigil, muted at station 1, blooms round and in its own
// three hues (it is a repository now).

import { CAM_CSS, journey, sigilGradient, sigilHues } from "./_addsite.mjs";

// The real console line (scripts/build-index.ts), with tide-pool added: one more folder,
// one more article, one more repository; its categories already exist.
const OUT = ["indexed 5485 folders (959 articles,", "173 repos, 183 categories) from", "~/Programming in 51029 ms"];

export default {
  id: "15",
  css: CAM_CSS("#s15") + `
#s15 .ov text { font-family: "JetBrains Mono", monospace; fill: var(--ink); stroke: none; }
#s15 .ov .o { fill: var(--ink2); }
#s15 .ov .caret { fill: var(--link); stroke: none; }
#s15 .ov .acc { stroke: var(--link); stroke-width: 2.6; fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 100 110; }
#s15 .ov .prog { stroke-width: 2; stroke-linecap: butt; }
#s15 .ov .track { stroke: var(--line); stroke-width: 2; stroke-dasharray: 2 4; }
#s15 .tag { position: absolute; display: flex; align-items: center; gap: 6px; padding: 0 9px 0 8px; border: 1.6px solid var(--link); border-radius: 999px; background: var(--surface); font: 600 12px/1 "JetBrains Mono", monospace; letter-spacing: 2.5px; color: var(--link); white-space: nowrap; }
#s15 .tag svg { width: 10px; height: 12px; stroke: var(--link); stroke-width: 2; fill: none; overflow: visible; }
#s15 .sig5 { position: absolute; display: grid; place-items: center; overflow: hidden; border-radius: 50%; box-shadow: 0 0 0 3px var(--surface); }
#s15 .sig5 span { font: 400 30px/1 "Instrument Serif", serif; color: rgba(255,255,255,.95); text-shadow: 0 1px 2px rgba(0,0,0,.18); transform: translateY(4%); }
#s15 .ov .bl { fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-dasharray: 100 110; }
#s15 .ov .ray { stroke-width: 1.7; }
`,
  html(ctx) {
    const { A } = journey(ctx);
    const cw = A.cmd.size * 0.6, ow = 15 * 0.6;
    const ox = A.out.x, oy = A.out.y - 2;
    const lines = OUT.map((s, i) => `<text class="o" id="s15-o${i}" x="${ox}" y="${oy + i * 22}" font-size="15">${ctx.esc(s)}</text>`).join("");
    const ux0 = ox + 22 * ow, ux1 = ox + 34 * ow, uy = oy + 5;
    const ax = ox + 33 * ow, ay0 = oy + 9, ay1 = A.article[1] - 6;
    const right = (A.about ? A.about[2] : A.term[2] - 18);
    const tagH = 22, tagW = 88;
    const tagX = A.term[2] - 12 - tagW, tagY = (A.term[1] + A.titleY) / 2 - tagH / 2;
    const [a, b, c] = sigilHues("tide-pool");
    const g = A.sigil, d = 52;
    // the bloom, engraved: three rings and a crown of rays in the sigil's own hues
    const hue = (h) => `oklch(0.64 0.14 ${h})`;
    const rings = [[b, 34], [c, 39.5]].map(([h, r]) => `<circle pathLength="100" class="bl" cx="${g.cx}" cy="${g.cy}" r="${r}" style="stroke:${hue(h)}" transform="rotate(${-90 + r * 3} ${g.cx} ${g.cy})"/>`).join("");
    const rays = Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2 + 0.13, r0 = 47, r1 = i % 2 ? 51.5 : 55;
      const p = (r) => `${(g.cx + r * Math.cos(t)).toFixed(1)} ${(g.cy + r * Math.sin(t)).toFixed(1)}`;
      return `<path pathLength="100" class="bl ray" d="M${p(r0)}L${p(r1)}" style="stroke:${hue([a, b, c][i % 3])}"/>`;
    }).join("");
    return `<div class="vp12"><div class="cam12">
  <svg class="ov" viewBox="0 0 1600 1000" width="1600" height="1000">
    <text id="s15-ps" x="${A.cmd.x}" y="${A.cmd.y}" font-size="${A.cmd.size}">$</text>
    <text id="s15-cmd" x="${+(A.cmd.x + 2 * cw).toFixed(1)}" y="${A.cmd.y}" font-size="${A.cmd.size}" data-text="pnpm index">pnpm index</text>
    <rect class="caret" id="s15-caret" x="${+(A.cmd.x + 2 * cw).toFixed(1)}" y="${A.cmd.y - 17}" width="11" height="21"/>
    <g id="s15-run"><line class="track" x1="${A.cmd.x}" y1="${A.cmd.y + 14}" x2="${right}" y2="${A.cmd.y + 14}"/><line pathLength="100" class="acc prog" id="s15-prog" x1="${A.cmd.x}" y1="${A.cmd.y + 14}" x2="${right}" y2="${A.cmd.y + 14}"/></g>
    ${lines}
    <line pathLength="100" class="acc" id="s15-ul" x1="${ux0}" y1="${uy}" x2="${ux1}" y2="${uy}"/>
    <g id="s15-bloom">${rings}${rays}</g>
    <path pathLength="100" class="acc" id="s15-arrow" d="M${ax} ${ay0}L${ax} ${ay1}M${ax - 4.3} ${ay1 - 11.3}L${ax} ${ay1}L${ax + 4.3} ${ay1 - 11.3}"/>
  </svg>
  <div class="tag" id="s15-tag" style="left:${tagX}px;top:${tagY}px;height:${tagH}px;width:${tagW}px"><svg viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>LOCAL</div>
  <div class="sig5" id="s15-sig" style="left:${g.cx - d / 2}px;top:${g.cy - d / 2}px;width:${d}px;height:${d}px;background:${sigilGradient("tide-pool")}"><span>T</span></div>
</div></div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const X = document.getElementById("s12x");
    const $ = (s) => el.querySelector(s);
    const command = k.word(seg, "command"), machine = k.word(seg, "machine");
    const appears = k.word(seg, "appears"), article = k.word(seg, "article"), colours = k.word(seg, "colours");

    // the station behind recedes as the camera arrives here
    if (X) {
      const dim = (e, t) => e && tl.fromTo(e, { opacity: 1 }, { opacity: 0.32, duration: 0.8, ease: "power1.inOut", immediateRender: false }, t);
      [".pg-st3", ".sp-chips", ".sp-chiparr", ".acc-st3"].forEach((sel) => dim(X.querySelector(sel), S + 0.25));
      // and the labels of the stations already passed
      const n5 = Array.from(X.querySelectorAll(".pg-path text")).find((t) => t.textContent.trim() === "5");
      const x5 = n5 ? +n5.getAttribute("x") : Infinity;
      const passed = Array.from(X.querySelectorAll(".pg-path text")).filter((t) => +t.getAttribute("x") < x5 - 120);
      tl.fromTo(passed, { opacity: 1 }, { opacity: 0.3, duration: 0.8, ease: "power1.inOut", immediateRender: false }, S + 0.25);
    }
    // the terminal engraves as the camera arrives; the prompt, then the command types on
    const show = (e, t) => tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, t);
    if (X) {
      show(X.querySelector(".pg-st5t"), S + 0.1);
      k.drawPlate(X.querySelector(".pg-st5t"), S + 0.1, 1.6, { lbl: 0.45, mainSpread: 0.25, detSpread: 0.3 });
    }
    const t0 = command - 0.5, td = 0.62;
    k.fade($("#s15-ps"), S + 0.7, 0.2);
    tl.fromTo($("#s15-caret"), { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none" }, S + 0.7);
    k.typeOn("#s15-cmd", t0, td);
    const cw = +$("#s15-cmd").getAttribute("font-size") * 0.6;
    // the caret steps with the typed characters: typeOn shows round(10p) of them, GSAP's
    // steps(10) gives floor(11q)/10, so q runs half a step early over 1.1 of the typing
    tl.fromTo($("#s15-caret"), { x: 0 }, { x: 10 * cw, duration: td * 1.1, ease: "steps(10)" }, t0 - td * 0.05);
    tl.fromTo($("#s15-caret"), { opacity: 1 }, { opacity: 0, duration: 0.08, ease: "none", immediateRender: false }, command + 0.35);

    // right on your machine: the crawl runs locally; the tag stamps, the meter glows
    k.fade($("#s15-run"), command + 0.3, 0.25);
    k.draw([$("#s15-prog")], command + 0.4, Math.max(0.6, appears - command - 0.95), 0, "power1.inOut");
    tl.fromTo($("#s15-run"), { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power1.in", immediateRender: false }, appears - 0.5);
    tl.fromTo($("#s15-tag"), { opacity: 0 }, { opacity: 1, duration: 0.07, ease: "none" }, machine - 0.08);
    tl.fromTo($("#s15-tag"), { scale: 1.45 }, { scale: 1, duration: 0.5, ease: "power4.out" }, machine - 0.08);
    k.pulseMeter(machine - 0.1, 2.8);

    // the output prints, line by line; 958 becomes 959 on "appears"
    [0, 1, 2].forEach((i) => k.fade($("#s15-o" + i), appears - 0.45 + i * 0.11, 0.06));
    k.draw([$("#s15-ul")], appears - 0.08, 0.4, 0, "power2.inOut");
    k.counter(appears, "ARTICLES", 959, 1.0);
    k.draw([$("#s15-arrow")], appears + 0.18, 0.5, 0, "power2.inOut");

    // its own article draws itself; then its own colours
    if (X) {
      show(X.querySelector(".pg-st5a"), appears + 0.3);
      k.drawPlate(X.querySelector(".pg-st5a"), appears + 0.3, 1.8, { lbl: 0.4, mainSpread: 0.3, detSpread: 0.35 });
      const ring = Array.from(X.querySelectorAll(".acc-st5a > *"));
      show(ring, article - 0.05);
      k.draw(ring, article - 0.05, 0.7, 0.1, "expo.out");
    }
    tl.fromTo($("#s15-sig"), { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.9, ease: "back.out(1.7)" }, colours - 0.28);
    const rings = Array.from(el.querySelectorAll("#s15-bloom circle")), rays = Array.from(el.querySelectorAll("#s15-bloom .ray"));
    tl.fromTo([...rings, ...rays], { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, colours - 0.05);
    k.draw(rings, colours - 0.05, 1.0, 0.3, "power2.out");
    k.draw(rays, colours + 0.15, 0.45, 0.7, "power2.out");
  },
  sfx(ctx) {
    return [
      { name: "keys", at: ctx.word("command") - 0.52, vol: 0.38 },
      { name: "seal", at: ctx.word("machine") - 0.06, vol: 0.3 },
      { name: "tick", at: ctx.word("appears"), vol: 0.32 },
      { name: "pencil", at: ctx.word("appears") + 0.3, vol: 0.13 },
    ];
  },
};
