// 01 · Folders. The real ~/Programming tree as an engraved radial map. The camera opens
// tight on linear-clone and pulls back while the branches draw outward, depth by depth,
// and FOLDERS counts to 5,484.

import { CX, CY, TREE_CSS, f, treeSvg } from "./_tree.mjs";

export default {
  id: "01",
  css: TREE_CSS("s01") + `
#s01 .scene-in { -webkit-mask-image: linear-gradient(to bottom, transparent 104px, #000 176px, #000 832px, transparent 892px), linear-gradient(to right, transparent 52px, #000 112px, #000 1808px, transparent 1868px); -webkit-mask-composite: source-in; mask-image: linear-gradient(to bottom, transparent 104px, #000 176px, #000 832px, transparent 892px), linear-gradient(to right, transparent 52px, #000 112px, #000 1808px, transparent 1868px); mask-composite: intersect; }
#s01 .cam { position: absolute; inset: 0; transform-origin: 0 0; will-change: transform; }
#s01 svg { position: absolute; inset: 0; overflow: visible; }
#s01 .rl { fill: var(--muted); font: 400 13px "JetBrains Mono", monospace; opacity: .7; }
#s01 .root-bg { fill: var(--bg); opacity: .9; }
#s01 .root-lb { fill: var(--ink); font: 500 19px "JetBrains Mono", monospace; letter-spacing: 1px; }
#s01 .focus-ring { fill: none; stroke: var(--link); stroke-width: 2; stroke-dasharray: 100 110; }
`,
  html() {
    return `<div class="cam" id="s01-cam"><svg viewBox="0 0 1920 1080" width="1920" height="1080">
  ${treeSvg()}
  <circle pathLength="100" cx="${CX}" cy="${CY}" r="16" class="focus-ring"/>
  <rect x="${CX - 92}" y="${CY + 22}" width="184" height="30" rx="4" class="root-bg"/><text class="root-lb" x="${CX}" y="${CY + 43}" text-anchor="middle">~/Programming</text>
  <circle pathLength="100" class="focus-ring lc" cx="${Math.round(f.x * 10) / 10}" cy="${Math.round(f.y * 10) / 10}" r="15"/>
</svg></div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const cam = el.querySelector("#s01-cam");
    const focus = el.querySelector(".focus-ring.lc");
    const fx = +focus.getAttribute("cx"), fy = +focus.getAttribute("cy");
    const Z = 3.1;
    // open tight on linear-clone, then one long decelerating pull-back to the whole tree
    tl.fromTo(cam, { scale: Z, x: 960 - Z * fx, y: 500 - Z * fy }, { scale: 1, x: 0, y: 0, duration: 4.4, ease: "power3.inOut" }, S);
    tl.fromTo(cam, { scale: 1, x: 0, y: 0 }, { scale: 1.025, x: -24, y: -12, duration: Math.max(0.2, T - 4.4), ease: "none", immediateRender: false }, S + 4.4);

    const q = (s) => Array.from(el.querySelectorAll(s));
    k.draw(q(".br.acc"), S + 0.02, 0.9, 0.25, "power2.out");
    tl.fromTo(focus, { strokeDashoffset: 101 }, { strokeDashoffset: 0, duration: 0.7, ease: "power2.out" }, S + 0.1);
    tl.fromTo(q(".lb.acc"), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none", stagger: 0.08 }, S + 0.05);
    k.draw(q(".ring"), S + 0.4, 1.4, 0.5, "power1.inOut");
    k.draw(q(".axis"), S + 0.3, 1.6, 0, "power1.inOut");
    [1, 2, 3, 4].forEach((d, i) => {
      k.draw(q(`.br.d${d}:not(.acc)`), S + 0.5 + i * 0.55, 0.9, 0.7, "power2.out");
      tl.fromTo(q(`.nd.d${d}:not(.acc)`), { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)", stagger: { each: 0.7 / Math.max(1, q(`.nd.d${d}`).length) } }, S + 0.9 + i * 0.55);
      tl.fromTo(q(`.lb.d${d}:not(.acc)`), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "none", stagger: 0.04 }, S + 1.2 + i * 0.55);
    });
    tl.fromTo(q(".nd.acc"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, S);
    tl.fromTo(q(".root-lb"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, S + 2.2);
    k.counter(S + 0.3, "FOLDERS", 5484, 4.3);
  },
  sfx(ctx) {
    return [{ name: "pencil", at: ctx.seg.start + 0.4, vol: 0.2 }];
  },
};
