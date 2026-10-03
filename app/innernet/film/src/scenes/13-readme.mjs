// 13 · README. The camera arrives at station 2 on "README": the README page and the key
// (what it reads, what it never reads) engrave themselves. The key quietly marks README.md
// as read and seals the never-read list under a small lock. On "paragraph" the first
// paragraph is underlined stroke by stroke; on "becomes" a leader carries it across; on
// "summary" the real search result for linear-clone mounts where the schematic card sits,
// its summary underlined to rhyme with the paragraph. As the camera leaves, the real card
// settles back into the engraved one.

import { CAM_CSS, journey } from "./_addsite.mjs";

// the linear-clone result in the real capture, in css px of the 1600-wide page
const CROP = { x: 312, y: 168, w: 672, h: 162 };
const SUMMARY = [
  { x0: 327, x1: 966, y: 272 },
  { x0: 327, x1: 646, y: 295 },
];

export default {
  id: "13",
  css: CAM_CSS("#s13") + `
#s13 .snip { overflow: visible; }
#s13 .snip .shot img { position: absolute; max-width: none; }
#s13 .note { position: absolute; font: italic 400 23px/1.2 Newsreader, Georgia, serif; color: var(--link); white-space: nowrap; }
#s13 .ov line, #s13 .ov path { stroke: var(--link); fill: none; stroke-linecap: round; stroke-dasharray: 100 110; }
#s13 .ov .mk { stroke-width: 2.4; }
#s13 .ov .st { stroke-width: 2; }
#s13 .ov .sum { stroke-width: 2.2; }
#s13 .lock13 { position: absolute; }
#s13 .lock13 svg { display: block; width: 100%; height: 100%; overflow: visible; }
#s13 .lock13 rect, #s13 .lock13 path { stroke: var(--link); stroke-width: 1.8; fill: none; }
#s13 .lock13 rect { fill: color-mix(in oklab, var(--link) 14%, transparent); }
`,
  html(ctx) {
    const { A } = journey(ctx);
    const M = A.snipMount;
    const k = M.w / CROP.w;
    const h = Math.round(CROP.h * k);
    const wx = (x) => +(M.x + (x - CROP.x) * k).toFixed(1);
    const wy = (y) => +(M.y + (y - CROP.y) * k).toFixed(1);
    const key = A.key;
    // marks on the key: README.md underlined (read), the never-read names struck through
    const marks = [];
    if (key.readme) marks.push(`<line pathLength="100" class="mk" x1="${key.readme.x}" y1="${key.readme.y + 6}" x2="${key.readme.x + key.readme.w}" y2="${key.readme.y + 6}"/>`);
    const strikes = [key.env, key.keys, key.src].filter(Boolean).map((t) => `<line pathLength="100" class="st" x1="${t.x - 3}" y1="${t.y - 6}" x2="${t.x + t.w + 3}" y2="${t.y - 6}"/>`);
    const sums = SUMMARY.map((s) => `<line pathLength="100" class="sum" x1="${wx(s.x0)}" y1="${wy(s.y)}" x2="${wx(s.x1)}" y2="${wy(s.y)}"/>`);
    const lk = key.never ? { x: key.never.x + key.never.w + 12, y: key.never.y - 17 } : null;
    return `<div class="vp12"><div class="cam12">
  <svg class="ov" viewBox="0 0 1600 1000" width="1600" height="1000">
    <g id="s13-mk">${marks.join("")}</g>
    <g id="s13-st">${strikes.join("")}</g>
  </svg>
  ${lk ? `<div class="lock13" id="s13-lock" style="left:${lk.x}px;top:${lk.y}px;width:15px;height:18px"><svg viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path id="s13-shackle" d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg></div>` : ""}
  <div class="mount snip" id="s13-snip" style="left:${M.x}px;top:${M.y}px;width:${M.w}px;height:${h}px"><div class="shot"><img src="${ctx.capture("search-linear@2x.png")}" alt="" style="width:${Math.round(1600 * k)}px;left:${-Math.round(CROP.x * k)}px;top:${-Math.round(CROP.y * k)}px"></div></div>
  <svg class="ov" viewBox="0 0 1600 1000" width="1600" height="1000"><g id="s13-sum">${sums.join("")}</g></svg>
  <div class="note" id="s13-note" style="left:${M.x}px;top:${M.y + h + 28}px">the real summary, from the real README</div>
</div></div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const X = document.getElementById("s12x");
    const $ = (s) => el.querySelector(s);
    const readme = k.word(seg, "README"), para = k.word(seg, "paragraph"), becomes = k.word(seg, "becomes");
    const summary = k.word(seg, "summary"), search = k.word(seg, "search");
    const out = S + T - 0.4; // the camera leaves for station 3

    if (X) {
      // the station engraves itself as the camera arrives
      const show = (e, t) => tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, t);
      const drawOn = (els, t, dur, spread, ease) => {
        els.forEach((e, i) => show(e, t + (spread / els.length) * i));
        k.draw(els, t, dur, spread, ease);
      };
      show(X.querySelector(".pg-st2"), S + 0.3);
      k.drawPlate(X.querySelector(".pg-st2"), S + 0.3, 2.4, { lbl: 0.55, mainSpread: 0.3, detSpread: 0.35 });
      show(X.querySelector(".pg-key"), S + 0.5);
      k.drawPlate(X.querySelector(".pg-key"), S + 0.5, 2.0, { lbl: 0.5, mainSpread: 0.2, detSpread: 0.3 });
      const acc = Array.from(X.querySelectorAll(".acc-st2 > *"));
      const paraEls = acc.filter((e) => e.dataset.role === "para").sort((p, q) => +p.dataset.y - +q.dataset.y);
      const lead = acc.filter((e) => e.dataset.role === "leader");
      drawOn(paraEls, para - 0.08, 0.42, 0.75, "power2.inOut");
      drawOn(lead, becomes - 0.05, 0.75, 0.1, "power2.inOut");
      // as the camera leaves, the real card settles back into the engraved one
      tl.fromTo(X.querySelector(".sp-snip"), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power1.inOut" }, out);
    }

    // the key: README.md is read; the never-read list is struck through and locked
    k.draw(Array.from(el.querySelectorAll("#s13-mk line")), readme + 0.12, 0.45, 0.1, "power2.out");
    k.draw(Array.from(el.querySelectorAll("#s13-st line")), readme + 0.55, 0.35, 0.3, "power2.inOut");
    const lock = $("#s13-lock");
    if (lock) {
      tl.fromTo(lock, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, readme + 0.85);
      tl.fromTo($("#s13-shackle"), { y: -3.5 }, { y: 0, duration: 0.22, ease: "power3.in" }, readme + 1.1);
      k.pulseMeter(readme + 1.0, 1.8);
    }

    // the real result, on "summary"
    // (wipes, not fades: a half-transparent light card turns grey under the film's
    // chromatic filter)
    const snip = $("#s13-snip");
    const w = parseFloat(snip.style.width);
    const shown = "inset(-24px -24px -110px -24px)", hidden = `inset(-24px ${w + 24}px -110px -24px)`;
    tl.fromTo(snip, { clipPath: hidden, y: 14 }, { clipPath: shown, y: 0, duration: 0.6, ease: "power3.out" }, summary - 0.2);
    k.draw(Array.from(el.querySelectorAll("#s13-sum line")), summary + 0.35, 0.5, 0.4, "power2.inOut");
    k.rise($("#s13-note"), search - 0.15, { y: 10, dur: 0.55 });
    tl.fromTo(snip, { clipPath: shown }, { clipPath: hidden, duration: 0.36, ease: "power2.in", immediateRender: false }, out);
    tl.fromTo([$("#s13-note"), $("#s13-sum")], { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power1.in", immediateRender: false }, out);
  },
  sfx(ctx) {
    const S = ctx.seg.start;
    return [
      { name: "pencil", at: S + 0.6, vol: 0.14 },
      { name: "lock", at: ctx.word("README") + 1.12, vol: 0.28 },
    ];
  },
};
