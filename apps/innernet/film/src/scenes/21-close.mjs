// 21 · Close. Dawn returns (the engine blends night to paper over the first 2.2 s) while
// the folder tree from 01 draws itself again, this time lit in its folders' own colours.
// On "Now" it steps back and the wordmark settles over it; "Private · local · yours" lands
// word by word, the HUD privacy meter glows through it, and the guide's address arrives
// sealed with the lock, and the maker's credit settles under it (Made by QuirqAI, with the
// quirq mark). Then stillness while the music resolves.

import { TREE_CSS, treeSvg } from "./_tree.mjs";

export default {
  id: "21",
  css: TREE_CSS("s21") + `
#s21 .cam { position: absolute; inset: 0; transform-origin: 960px 515px; }
#s21 .cam svg { position: absolute; inset: 0; overflow: visible; }
#s21 .lb { stroke: none; }
#s21 .wm { position: absolute; left: 0; right: 0; top: 248px; height: 300px; }
#s21 .wm svg { width: 100%; height: 100%; overflow: visible; }
#s21 .wm text { font-family: "Instrument Serif", serif; font-size: 236px; fill: var(--ink); stroke: var(--ink); stroke-width: 1.3; stroke-dasharray: 2400; paint-order: stroke; }
#s21 .wm tspan.i { font-style: italic; }
#s21 .tag { position: absolute; left: 0; right: 0; top: 560px; display: flex; justify-content: center; align-items: baseline; gap: 22px; font: italic 400 46px/1.2 Newsreader, Georgia, serif; color: var(--ink2); }
#s21 .tag .dot { font-style: normal; color: var(--muted); }
#s21 .url { position: absolute; left: 50%; top: 772px; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 13px 26px 13px 22px; border: 2px solid var(--link); border-radius: 999px; font: 500 26px/1 "JetBrains Mono", monospace; letter-spacing: 1px; color: var(--link); background: var(--surface); white-space: nowrap; box-shadow: 0 18px 40px -24px rgba(28,27,24,.4); }
#s21 .url svg { width: 21px; height: 25px; stroke: var(--link); stroke-width: 2.2; fill: none; overflow: visible; }
#s21 .credit { position: absolute; left: 50%; top: 836px; transform: translateX(-50%); display: flex; justify-content: center; align-items: center; gap: 14px; padding: 8px 24px 8px 12px; border-radius: 999px; background: color-mix(in oklab, var(--bg) 90%, transparent); box-shadow: 0 0 24px 10px color-mix(in oklab, var(--bg) 85%, transparent); white-space: nowrap; }
#s21 .credit svg { width: 30px; height: 30px; }
#s21 .credit .tile { fill: var(--ink); }
#s21 .credit .q { fill: var(--bg); }
#s21 .credit .by { font: 500 15px/1 "JetBrains Mono", monospace; letter-spacing: 5px; color: var(--muted); }
#s21 .credit .name { font: 400 34px/1 "Instrument Serif", serif; color: var(--ink); letter-spacing: 0.01em; }
`,
  html() {
    // The wordmark needs clear paper under it. A translucent scrim would grey out under the
    // film's chromatic filter, so the tree itself is masked: an elliptical hole opens in it.
    return `<div class="cam" id="s21-cam" data-layout-ignore><svg viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <radialGradient id="s21-hole-g"><stop offset="0" stop-color="black"/><stop offset="0.72" stop-color="black"/><stop offset="1" stop-color="white"/></radialGradient>
    <mask id="s21-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="2320" height="1480"><rect x="-200" y="-200" width="2320" height="1480" fill="white"/><ellipse id="s21-hole" cx="960" cy="462" rx="640" ry="244" fill="url(#s21-hole-g)"/></mask>
  </defs>
  <g mask="url(#s21-mask)">${treeSvg({ colored: true })}</g>
</svg></div>
<div class="wm" id="s21-wm"><svg viewBox="0 0 1920 300"><text x="960" y="232" text-anchor="middle"><tspan class="i">inner</tspan>net</text></svg></div>
<div class="tag"><span class="w" id="s21-w1">Private</span><span class="dot" id="s21-d1">·</span><span class="w" id="s21-w2">local</span><span class="dot" id="s21-d2">·</span><span class="w" id="s21-w3">yours</span></div>
<div class="url" id="s21-url"><svg viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path id="s21-sh" d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>localhost:3470/guide</div>
<div class="credit" id="s21-credit"><svg viewBox="0 0 64 64" aria-hidden="true"><rect class="tile" width="64" height="64" rx="14"/><path class="q" transform="translate(15,9) scale(0.34)" d="M50 0A50 50 0 0 1 100 50V118A14 14 0 0 1 86 132A14 14 0 0 1 72 118V94.87A50 50 0 1 1 50 0ZM50 33A17 17 0 1 0 50 67A17 17 0 1 0 50 33Z"/></svg><span class="by">MADE BY</span><span class="name">QuirqAI</span></div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s);
    const q = (s) => Array.from(el.querySelectorAll(s));
    const cam = $("#s21-cam");

    // The tree draws itself again from the centre as the light comes up.
    k.draw(q(".ring"), S + 0.08, 1.3, 0.5, "power1.inOut");
    k.draw(q(".axis"), S + 0.1, 1.4, 0, "power1.inOut");
    k.draw(q(".br.acc"), S + 0.15, 0.9, 0.25, "power2.out");
    [1, 2, 3, 4].forEach((d, i) => {
      k.draw(q(".br.d" + d + ":not(.acc)"), S + 0.15 + i * 0.3, 0.8, 0.5, "power2.out");
      const nd = q(".nd.d" + d);
      tl.fromTo(nd, { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)", stagger: { each: 0.55 / Math.max(1, nd.length) } }, S + 0.45 + i * 0.3);
      const lb = q(".lb.d" + d);
      if (lb.length) tl.fromTo(lb, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "none", stagger: 0.03 }, S + 0.75 + i * 0.3);
    });
    tl.fromTo(q("g > circle.nd:not([class*=d])"), { opacity: 0 }, { opacity: 1, duration: 0.4 }, S + 0.1);

    // Camera: a gentle pull-back (the echo of 01), then on "Now" the tree steps back.
    const now = k.word(seg, "now");
    tl.fromTo(cam, { scale: 1.07 }, { scale: 1, duration: now - S - 0.1, ease: "power3.out" }, S);
    tl.fromTo(cam, { scale: 1 }, { scale: 0.955, duration: 1.6, ease: "power2.inOut", immediateRender: false }, now - 0.1);

    // The wordmark settles over it: the tree opens at its centre, then outline, then ink.
    tl.fromTo($("#s21-hole"), { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power1.inOut" }, now - 0.15);
    // and its names step back with it, all but linear-clone (the callback to 01): half-masked
    // names around the wordmark would read as debris
    const names = q(".lb").filter((t) => !(t.classList.contains("acc") && t.classList.contains("d4")));
    tl.fromTo(names, { opacity: 1 }, { opacity: 0, duration: 0.8, ease: "power1.inOut", immediateRender: false }, now - 0.1);
    const text = $("#s21-wm text");
    tl.fromTo(text, { strokeDashoffset: 2400, fillOpacity: 0 }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" }, now - 0.05);
    tl.fromTo(text, { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.8, ease: "power1.inOut", immediateRender: false }, now + 0.85);
    tl.fromTo($("#s21-wm"), { scale: 1.05, y: 12 }, { scale: 1, y: 0, duration: 2.4, ease: "expo.out" }, now - 0.05);

    // Private · local · yours, each on its word; the privacy meter glows through them.
    const words = ["private", "local", "yours"].map((w) => k.word(seg, w));
    k.rise($("#s21-w1"), words[0] - 0.08, { y: 14, dur: 0.7 });
    k.rise([$("#s21-d1"), $("#s21-w2")], words[1] - 0.12, { y: 14, dur: 0.7, stagger: 0.06 });
    k.rise([$("#s21-d2"), $("#s21-w3")], words[2] - 0.12, { y: 14, dur: 0.7, stagger: 0.06 });
    k.pulseMeter(words[0], 3.6);

    // The address arrives at the end of the line, sealed: its shackle drops shut.
    const end = seg.voStart + seg.vo.duration;
    const url = $("#s21-url");
    tl.fromTo(url, { opacity: 0, y: 16, xPercent: -50, x: 0 }, { opacity: 1, y: 0, xPercent: -50, x: 0, duration: 0.7, ease: "power3.out" }, end - 0.2);
    tl.fromTo($("#s21-sh"), { y: -3 }, { y: 0, duration: 0.35, ease: "back.out(2.4)" }, end + 0.3);
    // the maker's credit settles under it, then stillness to the end
    tl.fromTo($("#s21-credit"), { opacity: 0, y: 12, xPercent: -50, x: 0 }, { opacity: 1, y: 0, xPercent: -50, x: 0, duration: 0.9, ease: "power2.out" }, end + 0.85);
  },
  sfx(ctx) {
    const end = ctx.seg.voStart + ctx.seg.vo.duration;
    return [{ name: "pencil", at: ctx.seg.start + 0.2, vol: 0.14 }, { name: "seal", at: end + 0.28, vol: 0.26 }];
  },
};
