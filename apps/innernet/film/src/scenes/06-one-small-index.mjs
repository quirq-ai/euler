// 06 · One small index. data/index.json as an engraved ledger page: rules draw down the
// page, the file name types on, and the three real counts count up in turn.

const ROWS = 9;

export default {
  id: "06",
  css: `
#s06 .ledger { position: absolute; left: 220px; top: 236px; width: 1480px; height: 560px; background: var(--surface); border: 2px solid var(--line); border-radius: 14px; box-shadow: 0 2px 6px rgba(28,27,24,.05), 0 40px 80px -36px rgba(28,27,24,.32); overflow: hidden; }
#s06 .rules { position: absolute; inset: 0; }
#s06 .rules line { stroke: var(--line); stroke-width: 1.4; stroke-dasharray: 100 110; }
#s06 .rules .margin { stroke: color-mix(in oklab, var(--link) 45%, transparent); }
#s06 .file { position: absolute; left: 70px; top: 46px; font: 500 28px/1 "JetBrains Mono", monospace; color: var(--ink); }
#s06 .size { position: absolute; right: 60px; top: 50px; font: 400 20px/1 "JetBrains Mono", monospace; letter-spacing: 3px; color: var(--muted); }
#s06 .cols { position: absolute; left: 70px; right: 60px; top: 170px; display: grid; grid-template-columns: 1.25fr 1fr 1fr; }
#s06 .n { font: 400 196px/0.9 "Instrument Serif", serif; color: var(--ink); font-variant-numeric: tabular-nums; }
#s06 .l { margin-top: 18px; font: 400 22px/1 "JetBrains Mono", monospace; letter-spacing: 6px; color: var(--muted); }
#s06 .foot { position: absolute; left: 70px; bottom: 50px; font: italic 400 32px/1 Newsreader, Georgia, serif; color: var(--ink2); }
#s06 .foot b { font-style: normal; font-weight: 400; font-family: "JetBrains Mono", monospace; font-size: 22px; letter-spacing: 3px; color: var(--link); display: inline-flex; align-items: center; gap: 10px; vertical-align: 2px; }
#s06 .foot b svg { width: 17px; height: 20px; stroke: var(--link); stroke-width: 2; fill: none; overflow: visible; }
`,
  html(ctx) {
    const rules = Array.from({ length: ROWS }, (_, i) => `<line pathLength="100" x1="0" y1="${110 + i * 52}" x2="1480" y2="${110 + i * 52}"/>`).join("");
    return `${ctx.fig(3, "THE INDEX")}
<div class="ledger" id="s06-ledger">
  <svg class="rules" viewBox="0 0 1480 560" width="1480" height="560">${rules}<line pathLength="100" class="margin" x1="46" y1="0" x2="46" y2="560"/></svg>
  <div class="file" id="s06-file" data-text="data/index.json">data/index.json</div>
  <div class="size" id="s06-size">7.9 MB · ONE FILE</div>
  <div class="cols">
    <div><div class="n" id="s06-n1">5,484</div><div class="l">FOLDERS</div></div>
    <div><div class="n" id="s06-n2">958</div><div class="l">ARTICLES</div></div>
    <div><div class="n" id="s06-n3">172</div><div class="l">REPOSITORIES</div></div>
  </div>
  <div class="foot" id="s06-foot">indexed in under a minute, <b><svg viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path id="s06-shackle" d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>ON THIS MACHINE</b></div>
</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s);
    tl.fromTo($("#s06-ledger"), { opacity: 0, y: 40, rotationX: 8, transformPerspective: 1600 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.7, ease: "power3.out" }, S);
    tl.fromTo($("#s06-ledger"), { scale: 1 }, { scale: 1.02, duration: T - 0.7, ease: "none" }, S + 0.7);
    k.draw(Array.from(el.querySelectorAll(".rules line")), S + 0.15, 0.6, 0.5, "power2.out");
    k.typeOn("#s06-file", S + 0.25, 0.5);
    k.fade($("#s06-size"), S + 0.6, 0.4);
    const cols = Array.from(el.querySelectorAll(".cols > div"));
    k.rise(cols, S + 0.45, { y: 26, dur: 0.6, stagger: 0.18 });
    k.countUp("#s06-n1", S + 0.5, 1.5, 0, 5484);
    k.countUp("#s06-n2", S + 0.7, 1.4, 0, 958);
    k.countUp("#s06-n3", S + 0.9, 1.3, 0, 172);
    // the one privacy note on this page: the index is built here, and its padlock clicks shut
    const m = k.word(seg, "minute");
    k.rise($("#s06-foot"), m - 0.15, { y: 10, dur: 0.6 });
    tl.fromTo($("#s06-shackle"), { y: -3.5 }, { y: 0, duration: 0.18, ease: "power2.in" }, m + 0.35);
    k.pulseMeter(m + 0.3, 1.8);
  },
  sfx(ctx) {
    const S = ctx.seg.start;
    return [{ name: "tick", at: S + 2.0, vol: 0.25 }, { name: "tick", at: S + 2.1, vol: 0.22 }, { name: "tick", at: S + 2.2, vol: 0.2 }];
  },
};
