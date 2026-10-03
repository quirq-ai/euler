// 14 · Frameworks and history. Stations 3 and 4. On "package" the camera reaches
// package.json and it engraves itself; on "learns" the "next" dependency is boxed and three
// leaders run out of the file; on "frameworks" the three chips spring out (Next.js,
// React, Tailwind CSS). On "git" the camera drops to station 4: the .git log and its
// strand of commits engrave, and on "gains" the 24 monthly bars rise left to right, the
// busiest month in the accent.

import { CAM_CSS, journey } from "./_addsite.mjs";

export default {
  id: "14",
  css: CAM_CSS("#s14") + `
#s14 .chip14 { position: absolute; display: flex; align-items: center; justify-content: center; background: var(--surface); border: 2px solid var(--ink); font: 500 17px/1 Inter, sans-serif; color: var(--ink); white-space: nowrap; box-shadow: 0 8px 18px -12px rgba(28,27,24,.45); }
#s14 .chip14.acc { border-color: var(--link); color: var(--link); }
`,
  html(ctx) {
    const { A } = journey(ctx);
    const chips = A.chips.map((c, i) => `<div class="chip14${c.acc ? " acc" : ""}" id="s14-chip${i}" style="left:${c.x}px;top:${c.y}px;width:${Math.round(c.w)}px;height:${c.h}px;border-radius:${c.h / 2}px">${ctx.esc(c.name)}</div>`).join("");
    return `<div class="vp12"><div class="cam12">${chips}</div></div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const X = document.getElementById("s12x");
    const pkg = k.word(seg, "package"), learns = k.word(seg, "learns"), fw = k.word(seg, "frameworks");
    const git = k.word(seg, "git"), gains = k.word(seg, "gains"), history = k.word(seg, "history");
    const out = S + T - 0.35; // the camera leaves for station 5
    const chips = Array.from(el.querySelectorAll(".chip14"));

    if (X) {
      const q = (s) => Array.from(X.querySelectorAll(s));
      const show = (e, t) => tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, t);
      const drawOn = (els, t, dur, spread, ease) => {
        els.forEach((e, i) => show(e, t + (spread / els.length) * i));
        k.draw(els, t, dur, spread, ease);
      };
      // station 3: package.json engraves as the camera arrives
      show(X.querySelector(".pg-st3"), S + 0.05);
      k.drawPlate(X.querySelector(".pg-st3"), S + 0.05, 2.6, { lbl: 0.4, mainSpread: 0.25, detSpread: 0.3 });
      drawOn(q(".acc-st3 > *"), learns - 0.12, 0.5, 0.1, "power2.inOut");
      drawOn(q(".sp-chiparr :is(path, line, circle, rect)"), learns + 0.12, 0.5, 0.3, "power2.out");
      // station 2 recedes as the camera passes on to station 4
      const dim = (e, t) => e && tl.fromTo(e, { opacity: 1 }, { opacity: 0.32, duration: 0.8, ease: "power1.inOut", immediateRender: false }, t);
      [".pg-st2", ".pg-key", ".sp-snip", ".acc-st2"].forEach((sel) => dim(X.querySelector(sel), git - 0.7));
      dim(X.querySelector(".pg-st1"), S + 0.2);
      // station 4: the log and its commits, then the bars rise
      show(X.querySelector(".pg-st4"), git - 0.6);
      k.drawPlate(X.querySelector(".pg-st4"), git - 0.6, 2.2, { lbl: 0.45, mainSpread: 0.3, detSpread: 0.35 });
      q(".sp-bars .bar").forEach((b, i) => {
        const o = `${b.dataset.ox} ${b.dataset.oy}`;
        tl.fromTo(b, { scaleY: 0, svgOrigin: o }, { scaleY: 1, svgOrigin: o, duration: 0.55, ease: "power3.out" }, gains + 0.05 + i * 0.045);
      });
      drawOn(q(".acc-st4 > *"), history + 0.75, 0.5, 0.1, "expo.out");
      // as the camera leaves, the chips settle back into the engraving
      tl.fromTo(X.querySelector(".sp-chips"), { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.inOut" }, out);
    }

    // scale, not fade: a half-transparent light chip turns grey under the film's chromatic filter
    tl.fromTo(chips, { scale: 0 }, { scale: 1, duration: 0.6, ease: "back.out(2.2)", stagger: 0.12 }, fw - 0.14);
    tl.fromTo(chips, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: "none", immediateRender: false }, out + 0.2);
  },
  sfx(ctx) {
    const S = ctx.seg.start;
    return [
      { name: "pencil", at: S + 0.55, vol: 0.13 },
      { name: "tick", at: ctx.word("frameworks") - 0.1, vol: 0.2 },
      { name: "pencil", at: ctx.word("git") - 0.55, vol: 0.13 },
    ];
  },
};
