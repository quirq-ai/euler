// 02 · A web of your own. The folder tree from 01 sinks to a ghost; the wordmark draws its
// outline and fills; the two readers arrive as small tabs on their words; on "Private" a
// LOCAL · 0 B SENT seal stamps under them and the HUD meter glows.

import { TREE_CSS, treeSvg } from "./_tree.mjs";

export default {
  id: "02",
  css: TREE_CSS("s02") + `
#s02 .ghost { position: absolute; inset: 0; }
#s02 .ghost svg { position: absolute; inset: 0; overflow: visible; }
#s02 .ghost .labels { display: none; }
#s02 .wm { position: absolute; left: 0; right: 0; top: 250px; height: 300px; }
#s02 .wm svg { width: 100%; height: 100%; overflow: visible; }
#s02 .wm text { font-family: "Instrument Serif", serif; font-size: 236px; fill: var(--ink); stroke: var(--ink); stroke-width: 1.3; stroke-dasharray: 2400; paint-order: stroke; }
#s02 .wm tspan.i { font-style: italic; }
#s02 .dek { position: absolute; left: 0; right: 0; top: 548px; text-align: center; font: italic 400 40px/1.2 Newsreader, Georgia, serif; color: var(--ink2); }
#s02 .tabs { position: absolute; left: 0; right: 0; top: 640px; display: flex; justify-content: center; gap: 26px; }
#s02 .tab { height: 74px; display: flex; align-items: center; gap: 16px; padding: 0 30px; background: var(--surface); border: 2px solid var(--line); border-radius: 37px; box-shadow: 0 1px 2px rgba(28,27,24,.05), 0 18px 40px -22px rgba(28,27,24,.35); }
#s02 .tab.search { width: 470px; }
#s02 .tab .glass { width: 26px; height: 26px; border: 2.5px solid var(--muted); border-radius: 50%; position: relative; flex: none; }
#s02 .tab .glass::after { content: ""; position: absolute; width: 11px; height: 2.5px; background: var(--muted); right: -9px; bottom: -4px; transform: rotate(45deg); }
#s02 .tab .ph { font: 400 28px Inter, sans-serif; color: var(--muted); }
#s02 .tab .pedia { font: 400 40px/1 "Instrument Serif", serif; color: var(--ink); }
#s02 .tab .pedia i { font-style: italic; }
#s02 .seal { position: absolute; left: 50%; top: 768px; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 12px 22px 12px 18px; border: 2px solid var(--link); border-radius: 999px; font: 500 21px/1 "JetBrains Mono", monospace; letter-spacing: 4px; color: var(--link); background: color-mix(in oklab, var(--surface) 80%, transparent); }
#s02 .seal svg { width: 20px; height: 24px; stroke: var(--link); stroke-width: 2.2; fill: none; }
#s02 .seal b { color: var(--ink); font-weight: 600; letter-spacing: 1px; }
`,
  html() {
    return `<div class="ghost" id="s02-ghost" data-layout-ignore><svg viewBox="0 0 1920 1080" width="1920" height="1080">${treeSvg()}</svg></div>
<div class="wm" id="s02-wm"><svg viewBox="0 0 1920 300"><text x="960" y="210" text-anchor="middle"><tspan class="i">inner</tspan>net</text></svg></div>
<div class="dek" id="s02-dek">A search engine and an encyclopedia, for everything you have made.</div>
<div class="tabs"><div class="tab search" id="s02-search"><span class="glass"></span><span class="ph">Search your internet</span></div><div class="tab" id="s02-pedia"><span class="pedia"><i>Inner</i>pedia</span></div></div>
<div class="seal" id="s02-seal"><svg viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>PRIVATE <span>·</span> LOCAL <span>·</span> <b>0 B</b> SENT</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s);
    // The tree arrives already drawn (a dissolve from 01) and sinks to a ghost.
    tl.fromTo($("#s02-ghost"), { opacity: 1, scale: 1.025, x: -24, y: -12, transformOrigin: "0 0" }, { opacity: 0.13, scale: 1.08, x: -60, y: -30, duration: 1.6, ease: "power2.inOut" }, S);
    tl.fromTo($("#s02-ghost"), { scale: 1.08 }, { scale: 1.12, duration: Math.max(0.2, T - 1.6), ease: "none", immediateRender: false }, S + 1.6);
    // The wordmark draws its outline on "Innernet", then fills.
    const text = $("#s02-wm text");
    const w0 = k.word(seg, "Innernet");
    tl.fromTo(text, { strokeDashoffset: 2400, fillOpacity: 0 }, { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" }, w0 - 0.2);
    tl.fromTo(text, { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.8, ease: "power1.inOut", immediateRender: false }, w0 + 1.0);
    tl.fromTo($("#s02-wm"), { scale: 1.04, y: 10 }, { scale: 1, y: 0, duration: 2.2, ease: "expo.out" }, w0 - 0.2);
    k.rise($("#s02-dek"), k.word(seg, "web") - 0.1, { y: 14, dur: 0.8 });
    k.rise($("#s02-search"), k.word(seg, "search") - 0.15, { y: 22, dur: 0.7, ease: "back.out(1.6)" });
    k.rise($("#s02-pedia"), k.word(seg, "encyclopedia") - 0.15, { y: 22, dur: 0.7, ease: "back.out(1.6)" });
    // Private: the seal stamps in, the HUD meter answers.
    const p = k.word(seg, "Private");
    tl.fromTo($("#s02-seal"), { opacity: 0, scale: 1.35, xPercent: -50, x: 0 }, { opacity: 1, scale: 1, xPercent: -50, x: 0, duration: 0.5, ease: "power4.out" }, p - 0.1);
    k.pulseMeter(p, 3.0);
  },
  sfx(ctx) {
    return [{ name: "seal", at: ctx.word("Private") - 0.05, vol: 0.32 }];
  },
};
