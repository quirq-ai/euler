// 19 · Recipes. Four engraved index cards deal in from the right, one per recipe in the
// contributing guide. Each card is lit on its word: its header rule turns link blue, the
// card comes up to full ink and its file path types on in mono. On "one known place" the
// four file names are underlined together. Symbols and line numbers are the real ones.

const CARDS = [
  { title: "A search operator", code: '"lang", "in", "kind", "fw"', sym: "OPS · LINE 128", dir: "lib/", file: "search.ts" },
  { title: "A special page", code: '{ name: "Random", … }', sym: "SPECIALS · LINE 14", dir: "components/wiki/", file: "special-view.tsx" },
  { title: "A framework", code: '["next", "Next.js"]', sym: "FRAMEWORKS · LINE 69", dir: "scripts/", file: "build-index.ts" },
  { title: "An article section", code: '"technology", "history"', sym: "SECTION_IDS · LINE 19", dir: "components/wiki/", file: "article-view.tsx" },
];
const W = 388, H = 560, GAP = 30, TOP = 236, LEFT = 132;
const RULES = [214, 262, 310, 358];

export default {
  id: "19",
  css: `
#s19 .cam { position: absolute; inset: 0; transform-origin: 960px 520px; }
#s19 .card { position: absolute; top: ${TOP}px; width: ${W}px; height: ${H}px; background: var(--surface); border: 1.5px solid var(--line); border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,.12), 0 40px 70px -34px rgba(0,0,0,.6); }
#s19 .eng { position: absolute; left: 0; top: 0; overflow: visible; }
#s19 .eng line, #s19 .eng circle { fill: none; stroke-dasharray: 100 110; }
#s19 .eng .hd { stroke: var(--ink2); stroke-width: 1.6; }
#s19 .eng .hd2 { stroke: var(--line); stroke-width: 1.2; }
#s19 .eng .rl { stroke: var(--line); stroke-width: 1.2; }
#s19 .eng .hole { stroke: var(--con); stroke-width: 1.6; }
#s19 .lit { position: absolute; left: 34px; top: 74px; width: ${W - 68}px; height: 3px; background: var(--link); transform-origin: 0 50%; border-radius: 2px; }
#s19 .body { position: absolute; inset: 0; }
#s19 .kick { position: absolute; left: 34px; top: 34px; font: 400 17px/1 "JetBrains Mono", monospace; letter-spacing: 5px; color: var(--muted); }
#s19 .no { position: absolute; right: 34px; top: 34px; font: 400 17px/1 "JetBrains Mono", monospace; letter-spacing: 2px; color: var(--muted); }
#s19 .ttl { position: absolute; left: 34px; top: 104px; font: 400 50px/1 "Instrument Serif", serif; color: var(--ink); white-space: nowrap; }
#s19 .code { position: absolute; left: 34px; top: 184px; font: 400 19px/1 "JetBrains Mono", monospace; color: var(--ink2); white-space: nowrap; }
#s19 .sym { position: absolute; left: 34px; top: 238px; font: 500 15px/1 "JetBrains Mono", monospace; letter-spacing: 3px; color: var(--muted); white-space: nowrap; }
#s19 .lv { position: absolute; left: 34px; top: 396px; font: 400 14px/1 "JetBrains Mono", monospace; letter-spacing: 5px; color: var(--muted); }
#s19 .dir { position: absolute; left: 34px; top: 424px; height: 22px; font: 400 20px/1 "JetBrains Mono", monospace; color: var(--muted); white-space: nowrap; }
#s19 .file { position: absolute; left: 34px; top: 452px; height: 34px; font: 500 28px/1 "JetBrains Mono", monospace; color: var(--link); white-space: nowrap; }
#s19 .ul { position: absolute; left: 34px; top: 494px; height: 2.5px; background: var(--link); transform-origin: 0 50%; border-radius: 2px; }
`,
  html(ctx) {
    // mono advance is 0.6em: size the underline to the file name, not the card
    const cards = CARDS.map((c, i) => {
      const rules = RULES.map((y) => `<line pathLength="100" class="rl" x1="34" y1="${y}" x2="${W - 34}" y2="${y}"/>`).join("");
      return `<div class="card" id="s19-c${i + 1}" style="left:${LEFT + i * (W + GAP)}px">
  <svg class="eng" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <line pathLength="100" class="hd" x1="34" y1="76" x2="${W - 34}" y2="76"/>
    <line pathLength="100" class="hd2" x1="34" y1="83" x2="${W - 34}" y2="83"/>
    ${rules}
    <circle pathLength="100" class="hole" cx="${W / 2}" cy="${H - 34}" r="9"/>
  </svg>
  <i class="lit"></i>
  <div class="body">
    <div class="kick">RECIPE</div><div class="no">${i + 1} / 4</div>
    <div class="ttl">${ctx.esc(c.title)}</div>
    <div class="code">${ctx.esc(c.code)}</div>
    <div class="sym">${ctx.esc(c.sym)}</div>
    <div class="lv">LIVES IN</div>
    <div class="dir" data-text="${ctx.esc(c.dir)}">${ctx.esc(c.dir)}</div>
    <div class="file" data-text="${ctx.esc(c.file)}">${ctx.esc(c.file)}</div>
    <i class="ul" style="width:${Math.round(c.file.length * 28 * 0.6)}px"></i>
  </div>
</div>`;
    }).join("\n");
    return `${ctx.fig(ctx.seg.fig, "RECIPES")}
<div class="cam" id="s19-cam">${cards}</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s, r) => (r || el).querySelector(s);
    const cards = [1, 2, 3, 4].map((n) => $("#s19-c" + n));
    // When each card is named. The framework card has no word of its own: it takes the
    // pause after "page," so the four light left to right.
    const page = k.word(seg, "page");
    const at = [k.word(seg, "operator"), page, page + 0.42, k.word(seg, "section")];

    // The deal: from a deck just off the right edge, nearest card last to leave.
    cards.forEach((c, i) => {
      const left = 132 + i * (388 + 30);
      const t0 = S + 0.04 + i * 0.13;
      tl.fromTo(c, { x: 1990 - left, y: -26, rotation: 6 - i, opacity: 1 }, { x: 0, y: 0, rotation: 0, duration: 1.0, ease: "expo.out" }, t0);
      const body = $(".body", c);
      // dealt face-up but quiet; full ink when named
      tl.fromTo(body, { opacity: 0 }, { opacity: 0.4, duration: 0.5, ease: "none" }, t0 + 0.35);
      tl.fromTo(body, { opacity: 0.4 }, { opacity: 1, duration: 0.35, ease: "power1.out", immediateRender: false }, at[i] - 0.08);
      k.draw(Array.from(c.querySelectorAll(".eng line")), t0 + 0.45, 0.6, 0.35, "power2.out");
      k.draw(Array.from(c.querySelectorAll(".eng circle")), t0 + 0.7, 0.5, 0, "power2.out");
      k.strike($(".lit", c), at[i] - 0.1, 0.5);
      k.typeOn($(".dir", c), at[i] - 0.05, 0.22);
      k.typeOn($(".file", c), at[i] + 0.12, 0.34);
    });
    // "each lives in one known place": the four file names underlined together
    k.strike(Array.from(el.querySelectorAll(".ul")), k.word(seg, "one") - 0.05, 0.55, 0.09);
    // camera: a slow drift once the deal has landed
    tl.fromTo($("#s19-cam"), { scale: 1, y: 0 }, { scale: 1.014, y: -3, duration: T - 1.3, ease: "sine.inOut" }, S + 1.3);
  },
  sfx(ctx) {
    const S = ctx.seg.start, page = ctx.word("page");
    return [
      { name: "page", at: S + 0.08, vol: 0.14 },
      { name: "page", at: S + 0.4, vol: 0.1 },
      { name: "keys", at: ctx.word("operator") - 0.02, vol: 0.16 },
      { name: "keys", at: page, vol: 0.14 },
      { name: "keys", at: ctx.word("section") - 0.02, vol: 0.14 },
    ];
  },
};
