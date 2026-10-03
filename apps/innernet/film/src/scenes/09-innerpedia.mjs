// 09 · Innerpedia. A leftward whip lands on the real linear-clone article in the same mount
// as 08; the camera drifts while two callouts draw: the lead written from metadata, and the
// infobox in the project's own colours.

const CROP = { x: 190, y: 0, w: 1220 };
const M = { x: 420, y: 230, w: 1120, h: 620 };
const s = M.w / CROP.w;
const X = (x) => Math.round(M.x + (x - CROP.x) * s);
const Y = (y) => Math.round(M.y + (y - CROP.y) * s);

export default {
  id: "09",
  css: `
#s09 .cam { position: absolute; inset: 0; transform-origin: 980px ${M.y + M.h / 2}px; }
#s09 .mount { left: ${M.x}px; top: ${M.y}px; width: ${M.w}px; height: ${M.h}px; }
#s09 .mount img { position: absolute; width: ${Math.round(1600 * s)}px; height: auto; left: ${Math.round(-CROP.x * s)}px; top: ${Math.round(-CROP.y * s)}px; max-width: none; }
#s09 .callout-label.left { text-align: right; }
`,
  html(ctx) {
    return `${ctx.fig(6, "INNERPEDIA · /wiki/linear-clone")}
<div class="cam" id="s09-cam">
  <div class="mount" id="s09-mount"><div class="shot"><img src="${ctx.capture("article-linear-clone@2x.png")}" alt=""></div></div>
  <svg class="callouts" viewBox="0 0 1920 1080" width="1920" height="1080">
    <path pathLength="100" class="co-lead" d="M400 ${Y(268)}L${X(452) - 10} ${Y(268)}"/><circle pathLength="100" class="co-lead" cx="${X(452) - 2}" cy="${Y(268)}" r="7"/>
    <path pathLength="100" class="co-box" d="M1556 ${Y(406)}L${X(1395) + 6} ${Y(406)}"/><circle pathLength="100" class="co-box" cx="${X(1395) - 2}" cy="${Y(406)}" r="7"/>
  </svg>
  <div class="callout-label left lb-lead" style="right:${1920 - 386}px;top:${Y(268) - 36}px">a lead, written<br>from metadata</div>
  <div class="callout-label lb-box" style="left:1570px;top:${Y(406) - 36}px">an infobox, in<br>its own colours</div>
</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s);
    // whip: arrives fast from the right with a blur that clears
    tl.fromTo($("#s09-cam"), { x: 520, filter: "blur(18px)" }, { x: 0, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }, S);
    tl.fromTo($("#s09-mount .shot img"), { y: 0 }, { y: -70, duration: T - 0.4, ease: "power1.inOut" }, S + 0.4);
    tl.fromTo($("#s09-cam"), { scale: 1 }, { scale: 1.03, duration: T - 0.5, ease: "none", immediateRender: false }, S + 0.5);
    const lead = k.word(seg, "written"), box = k.word(seg, "article");
    k.draw(Array.from(el.querySelectorAll(".co-box")), box - 0.15, 0.5, 0.15, "power2.out");
    k.rise($(".lb-box"), box - 0.05, { y: 8, dur: 0.45 });
    k.draw(Array.from(el.querySelectorAll(".co-lead")), lead - 0.15, 0.5, 0.15, "power2.out");
    k.rise($(".lb-lead"), lead - 0.05, { y: 8, dur: 0.45 });
    // the callout targets ride with the page drift
    tl.fromTo(el.querySelectorAll(".callouts, .lb-lead, .lb-box"), { y: 0 }, { y: -70 * 0.918, duration: T - 0.4, ease: "power1.inOut" }, S + 0.4);
  },
};
