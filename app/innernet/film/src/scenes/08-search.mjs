// 08 · Search. The real results page for "linear", mounted as a plate. It slides in from
// the right and the camera pushes gently toward the knowledge panel while callouts draw on
// their words: the highlighted snippet, the timing line, the panel.

// Capture geometry: 1600 css px wide (3200 px at 2x). We show css x 300..1400, y 0..688.
const CROP = { x: 300, y: 0, w: 1100 };
// The mount, its hairline and crop marks stay between the FIG line and the captions even
// at the end of the push (scale 1.05 about the mount's centre).
const M = { x: 420, y: 230, w: 1120, h: 620 };
const s = M.w / CROP.w;
const X = (x) => Math.round(M.x + (x - CROP.x) * s);
const Y = (y) => Math.round(M.y + (y - CROP.y) * s);

const CALLOUTS = [
  { id: "snip", word: "Search", label: "highlighted snippets", side: "left", tx: X(330), ty: Y(262), ly: Y(262) },
  { id: "time", word: "milliseconds", label: "0.002 seconds", side: "left", tx: X(330), ty: Y(138), ly: Y(138) },
  { id: "panel", word: "anything", label: "the knowledge panel", side: "right", tx: X(1394), ty: Y(255), ly: Y(255) },
];

export default {
  id: "08",
  css: `
#s08 .cam { position: absolute; inset: 0; transform-origin: ${X(1215)}px ${M.y + M.h / 2}px; }
#s08 .mount { left: ${M.x}px; top: ${M.y}px; width: ${M.w}px; height: ${M.h}px; }
#s08 .mount img { position: absolute; width: ${Math.round(1600 * s)}px; height: auto; left: ${Math.round(-CROP.x * s)}px; top: ${Math.round(-CROP.y * s)}px; max-width: none; }
#s08 .callout-label.left { text-align: right; }
`,
  html(ctx) {
    const paths = CALLOUTS.map((c) => {
      const lx = c.side === "left" ? 400 : 1556;
      return `<path pathLength="100" class="co-${c.id}" d="M${lx} ${c.ly}L${c.tx} ${c.ty}"/><circle pathLength="100" class="co-${c.id}" cx="${c.tx}" cy="${c.ty}" r="7"/>`;
    }).join("");
    const labels = CALLOUTS.map((c) => `<div class="callout-label ${c.side} lb-${c.id}" style="${c.side === "left" ? `right:${1920 - 386}px` : "left:1570px"};top:${c.ly - 19}px">${ctx.esc(c.label)}</div>`).join("");
    return `${ctx.fig(5, "SEARCH · /search?q=linear")}
<div class="cam" id="s08-cam">
  <div class="mount" id="s08-mount"><div class="shot"><img src="${ctx.capture("search-linear@2x.png")}" alt=""></div></div>
  <svg class="callouts" viewBox="0 0 1920 1080" width="1920" height="1080">${paths}</svg>
  ${labels}
</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s);
    tl.fromTo($("#s08-mount"), { x: 420, opacity: 0, rotationY: -10, transformPerspective: 2000 }, { x: 0, opacity: 1, rotationY: 0, duration: 0.9, ease: "expo.out" }, S);
    tl.fromTo($("#s08-cam"), { scale: 1 }, { scale: 1.05, duration: T - 0.6, ease: "power1.inOut" }, S + 0.6);
    const ids = ["snip", "time", "panel"];
    const words = ["Search", "milliseconds", "anything"];
    ids.forEach((id, i) => {
      const t = k.word(seg, words[i]);
      k.draw(Array.from(el.querySelectorAll(".co-" + id)), t - 0.1, 0.5, 0.15, "power2.out");
      k.rise($(".lb-" + id), t, { y: 8, dur: 0.45 });
    });
  },
};
