// 05 · What it reads. The anatomy plate: the folder opens like an exploded drawing, and
// each read path lands as the narrator names it (README, package, git, notes), the caption
// numeral counting the sources. On "Never your secrets" everything else falls out of focus
// and the sealed row engraves itself; the seal stamps on "closed", the passwords are
// blacked out on "blacked", and the caption gains "0 SECRETS OPENED" beside the HUD meter.
//
// The plate is split at build time (./_carve.mjs) from its own geometry and text: one SVG
// for what is read, one for the sealed row, so the depth of field can blur one and not the
// other. A redrawn plate still lands every path on its word.

import { XL_CSS, blank, dropCorners, emit, fit, parsePlate, splitPath, tag, take, wrap } from "./_carve.mjs";

const P = fit(0.78, 599, 127);
// The four sources, in the order the narrator names them.
const SOURCES = [/^README(\.md)?$/i, /^package\.json$/i, /^\.git$/i, /^(CLAUDE|AGENTS)\.md$/i];

const LOCK = `<svg viewBox="0 0 16 18" aria-hidden="true"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>`;

function carve(svg) {
  const p = parsePlate(svg);
  const L = (n) => p.layers[n]?.items ?? [];

  dropCorners(p);

  const anchors = SOURCES.map((re) => L("L-lbl").find((t) => t.tag === "text" && re.test(t.text)));
  if (anchors.some((a) => !a)) return { rest: emit(p), sec: emit(blank(p)), ok: false, focus: { x: 1300, y: 800 } };
  const ay = anchors.map((a) => a.box.cy);
  const gap = (ay[3] - ay[0]) / 3;
  const bands = ay.map((y, i) => [i ? (ay[i - 1] + y) / 2 : y - gap / 2, i < 3 ? (y + ay[i + 1]) / 2 : y + gap / 2]);
  const splitY = bands[3][1];
  const labelX = Math.min(...anchors.map((a) => a.box.x0)) - 30;
  const rowOf = (y) => bands.findIndex(([a, b]) => y >= a && y < b);

  // Read paths: long accent curves; each ends at its document (the point furthest right).
  const arrows = L("L-acc").filter((it) => it.tag === "path" && it.box && it.box.w > 120);
  const tips = arrows.map((a) => a.pts.reduce((m, q) => (q[0] > m[0] ? q : m), [-1e9, 0]));
  const docLeft = tips.length ? Math.min(...tips.map((t) => t[0])) : labelX - 230;
  const inSecret = (b) => b.cy > splitY && b.cx > docLeft - 40;

  // Row groups: the arrow, the leader beside the file name, and the three labels.
  const rows = [0, 1, 2, 3].map(() => ({ shapes: [], texts: [] }));
  arrows.forEach((a, i) => {
    const r = rowOf(tips[i][1]);
    if (r < 0) return;
    // One element per subpath, each carrying its length, so the path can travel in order
    // (lead-in, curve, then its head).
    for (const part of splitPath(take(p, (it) => it === a)[0])) {
      const len = part.pts.reduce((sum, q, j) => (j ? sum + Math.hypot(q[0] - part.pts[j - 1][0], q[1] - part.pts[j - 1][1]) : 0), 0);
      tag(part, "s05-arrow");
      part.src = part.src.replace(/^<path/, `<path data-len="${Math.max(1, len).toFixed(0)}"`);
      rows[r].shapes.push(part);
    }
  });
  for (const it of take(p, (it, l) => l !== "L-lbl" && l !== "L-acc" && it.box && it.box.cx >= labelX && !inSecret(it.box) && rowOf(it.box.cy) >= 0)) rows[rowOf(it.box.cy)].shapes.push(it);
  for (const it of take(p, (it, l) => l === "L-lbl" && it.box && it.box.x0 >= labelX && !inSecret(it.box) && rowOf(it.box.cy) >= 0)) rows[rowOf(it.box.cy)].texts.push(it);
  rows.forEach((r) => r.texts.sort((a, b) => a.box.cy - b.box.cy));

  // Documents in the column between the paths and the labels: they slide out of the folder
  // and engrave as they go, so they leave the layers and travel as one group per row.
  const docs = [0, 1, 2, 3].map(() => []);
  for (const it of take(p, (it, l) => l !== "L-lbl" && it.box && it.box.cx > docLeft - 30 && it.box.cx < labelX && !inSecret(it.box) && rowOf(it.box.cy) >= 0)) docs[rowOf(it.box.cy)].push(it);

  // Everything in the sealed row moves to its own SVG, layer for layer.
  const sp = blank(p);
  const secItems = take(p, (it) => it.box && inSecret(it.box));
  // Labels in the column of the redacted lines belong to the indexed excerpt; the rest
  // describe the key file.
  const red = secItems.filter((it) => it.layer === "L-lbl" && /\[redacted\]/.test(it.text));
  const idxX = red.length ? Math.min(...red.map((t) => t.box.x0)) - 8 : Infinity;
  const seal = [], secText = [], idx = [];
  for (const it of secItems) {
    if (it.layer === "L-acc") seal.push(it);
    else if (it.layer === "L-lbl") (it.box.x0 >= idxX ? idx : secText).push(it);
    else sp.layers[it.layer].items.push(it);
  }
  secText.sort((a, b) => a.box.cy - b.box.cy);
  idx.sort((a, b) => a.box.cy - b.box.cy);

  // Redaction: each "[redacted]" value becomes a knocked-out word on an ink bar that is drawn
  // across it on "blacked". Monospace advance is 0.6em plus the letter spacing.
  const idxParts = [], bars = [], kos = [];
  for (const t of idx) {
    const at = t.text.indexOf("[redacted]");
    const mono = /mono/i.test(t.open);
    if (at < 0 || !mono || /text-anchor="(middle|end)"/.test(t.open)) { idxParts.push(t.src); continue; }
    const fs = +(t.open.match(/font-size="([\d.]+)"/) || [0, 20])[1];
    const ls = +(t.open.match(/letter-spacing="([-\d.]+)"/) || [0, 0])[1];
    const x = +(t.open.match(/\sx="([-\d.]+)"/) || [0, 0])[1], y = +(t.open.match(/\sy="([-\d.]+)"/) || [0, 0])[1];
    const adv = 0.6 * fs + ls, open = (nx) => t.open.replace(/\sx="[-\d.]+"/, ` x="${nx.toFixed(1)}"`);
    const pre = t.text.slice(0, at), post = t.text.slice(at + 10), xr = x + at * adv;
    if (pre) idxParts.push(`${open(x)}${esc(pre)}</text>`);
    if (post) idxParts.push(`${open(x + (at + 10) * adv)}${esc(post)}</text>`);
    bars.push(`<path pathLength="100" class="s05-bar" stroke-width="${(fs * 1.3).toFixed(1)}" d="M${(xr - 1.5).toFixed(1)} ${(y - fs * 0.34).toFixed(1)}H${(xr + 10 * adv - ls + 1.5).toFixed(1)}"/>`);
    kos.push(`${open(xr).replace(/\sclass="([^"]*)"/, ' class="$1 s05-ko"')}[redacted]</text>`);
  }

  // The seal's centre (its circle) for the stamp; the row's box for the focus pull.
  const sc = seal.find((s) => s.tag === "circle")?.box ?? seal[0]?.box ?? { cx: docLeft + 100, cy: splitY + 120 };
  const sb = secItems.reduce((b, it) => ({ x0: Math.min(b.x0, it.box.x0), y0: Math.min(b.y0, it.box.y0), x1: Math.max(b.x1, it.box.x1), y1: Math.max(b.y1, it.box.y1) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });

  // Any accent left (the legend's arrow) draws its line before its head.
  if (p.layers["L-acc"]) p.layers["L-acc"].items = p.layers["L-acc"].items.flatMap(splitPath);

  // Left-to-right engraving: the folder first, then the documents.
  for (const n of ["L-con", "L-main", "L-det"]) if (p.layers[n]) p.layers[n].items.sort((a, b) => (a.box?.cx ?? 0) - (b.box?.cx ?? 0));

  const rowsSvg = rows.map((r, i) => `<g class="s05-doc" data-row="${i}">${wrap(p, docs[i])}</g><g class="s05-row" data-row="${i}">${wrap(p, r.shapes)}<g class="xL-lbl">${r.texts.map((t) => t.src).join("")}</g></g>`).join("\n");
  const secSvg = [
    `<g class="xL-lbl s05-sectext">${secText.map((t) => t.src).join("")}</g>`,
    `<g class="s05-seal" data-cx="${sc.cx.toFixed(1)}" data-cy="${sc.cy.toFixed(1)}">${wrap(p, seal)}</g>`,
    `<g class="s05-bars" stroke-linecap="butt">${bars.join("")}</g>`,
    `<g class="xL-lbl s05-idx">${idxParts.join("")}</g>`,
    `<g class="s05-kos">${kos.join("")}</g>`,
  ].join("\n");
  return {
    ok: true,
    rest: emit(p, rowsSvg),
    sec: emit(sp, secSvg, "s05-secsvg"),
    // the focus pull grows away from the row's right edge, so nothing leaves the frame
    focus: { x: P.X(sb.x1), y: P.Y((sb.y0 + sb.y1) / 2) },
  };
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default {
  id: "05",
  css: XL_CSS("s05") + `
#s05 .cam, #s05 .focus { position: absolute; inset: 0; will-change: transform; }
#s05 .cam { transform-origin: ${P.X(800)}px ${P.Y(520)}px; }
#s05 .plate { position: absolute; left: ${P.ox}px; top: ${P.oy}px; width: ${1600 * P.s}px; height: ${1000 * P.s}px; }
#s05 .lay { position: absolute; inset: 0; }
#s05 .s05-bar { fill: none; stroke: var(--ink); }
#s05 .s05-ko { fill: var(--bg); }
#s05 .cap { width: 450px; }
#s05 .pill { display: inline-flex; align-items: center; gap: 12px; margin-top: 30px; padding: 11px 20px 11px 16px; border: 2px solid var(--link); border-radius: 999px; font: 500 19px/1 "JetBrains Mono", monospace; letter-spacing: 3.5px; color: var(--link); background: color-mix(in oklab, var(--surface) 80%, transparent); transform-origin: 0 50%; }
#s05 .pill svg { width: 18px; height: 21px; stroke: var(--link); stroke-width: 2.2; fill: none; flex: none; }
#s05 .pill b { font-weight: 600; color: var(--ink); letter-spacing: 1px; }
`,
  html(ctx) {
    const { rest, sec, focus } = carve(ctx.plate("anatomy"));
    const pill = `<div class="pill" id="s05-pill">${LOCK}<b>0</b> SECRETS OPENED</div>`;
    const cap = ctx.cap("s05c", { big: "4", unit: "SOURCES READ", title: "What it reads", line: "Only what a page needs." }).replace(/<\/div>$/, `${pill}</div>`);
    return `${ctx.fig(ctx.seg.fig, "WHAT IT READS")}
<div class="cam" id="s05-cam"><div class="focus" id="s05-focus" style="transform-origin:${focus.x}px ${focus.y}px">
  <div class="plate">
    <div class="lay" id="s05-rest">${rest}</div>
    <div class="lay" id="s05-sec">${sec}</div>
  </div>
</div></div>
${cap}`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s, sc) => (sc || el).querySelector(s), $$ = (s, sc) => Array.from((sc || el).querySelectorAll(s));
    const W = (w) => k.word(seg, w);
    const SH = "path,line,circle,ellipse,rect,polyline,polygon";
    const rest = $("#s05-rest .plate-svg"), sec = $("#s05-sec .plate-svg");
    const tRows = ["README", "package", "git", "notes"].map(W);
    const tNever = W("never"), tSecrets = W("secrets"), tClosed = W("closed"), tPass = W("passwords"), tBlack = W("blacked");
    const tRelease = W("out") + 0.3;

    // Camera: a gentle settle and drift; a focus pull toward the sealed row on "Never".
    tl.fromTo($("#s05-cam"), { scale: 1.03, y: 12 }, { scale: 1, y: 0, duration: 1.4, ease: "expo.out" }, S);
    tl.fromTo($("#s05-cam"), { scale: 1 }, { scale: 1.015, duration: T - 1.4, ease: "none", immediateRender: false }, S + 1.4);
    tl.fromTo($("#s05-focus"), { scale: 1 }, { scale: 1.035, duration: 2.2, ease: "power2.inOut" }, tNever);
    tl.fromTo($("#s05-focus"), { scale: 1.035 }, { scale: 1, duration: 1.1, ease: "power2.inOut", immediateRender: false }, tRelease);

    // The folder and the documents engrave left to right; the documents slide out of it.
    k.drawPlate(rest, S - 0.35, T, { acc: tRows[0] - 0.1, lbl: 1.25, mainSpread: 0.16, detSpread: 0.18 });
    $$(".s05-doc").forEach((g, i) => {
      const t0 = S + 0.85 + i * 0.24;
      tl.fromTo(g, { x: -150, y: 60, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.2, ease: "expo.out" }, t0);
      k.draw($$(SH, g), t0, 0.9, 0.35, "power2.out");
    });

    // Each read path lands on its word: the arrow and leader draw, the labels rise, the
    // caption counts the source.
    $$(".s05-row").forEach((g, i) => {
      const t = tRows[i];
      // the read path travels out of the folder at one speed and lands its head on the word
      const arrow = $$(".s05-arrow", g), lens = arrow.map((x) => +(x.getAttribute("data-len") || 1));
      const total = lens.reduce((a, b) => a + b, 0) || 1;
      let at = t - 0.22;
      arrow.forEach((x, j) => {
        const d = Math.max(0.06, 0.6 * (lens[j] / total));
        tl.fromTo(x, { strokeDashoffset: 101 }, { strokeDashoffset: 0, duration: d, ease: "none" }, at);
        at += d;
      });
      k.draw($$(SH, g).filter((x) => !arrow.includes(x)), at - 0.1, 0.55, 0.12, "power2.out");
      k.rise($$("text", g), t + 0.05, { y: 8, dur: 0.5, stagger: 0.13 });
    });
    const big = $("#s05c-big"), unit = $("#s05c-unit"), ct = tRows.map((t) => t - 0.06), o = { t: ct[0] };
    const shown = () => {
      const n = Math.max(1, ct.filter((x) => o.t >= x).length);
      big.textContent = String(n);
      unit.textContent = n === 1 ? "SOURCE READ" : "SOURCES READ";
    };
    tl.fromTo(o, { t: ct[0] - 0.01 }, { t: ct[3] + 0.01, duration: ct[3] - ct[0] + 0.02, ease: "none", onUpdate: shown }, ct[0] - 0.01);
    tl.fromTo(big, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" }, ct[0] - 0.02);
    tl.fromTo("#s05c-unit", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "none" }, ct[0] + 0.2);
    tl.fromTo("#s05c-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.inOut" }, W("reads") - 0.45);
    tl.fromTo("#s05c-title", { opacity: 0, y: 24, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.6, ease: "power3.out" }, W("reads") - 0.25);
    k.rise($("#s05c-line"), W("only") - 0.1, { y: 12, dur: 0.6 });

    // "Never your secrets": everything read falls out of focus; the sealed row engraves.
    const restWrap = $("#s05-rest");
    tl.fromTo(restWrap, { opacity: 1, filter: "blur(0px)" }, { opacity: 0.2, filter: "blur(3px)", duration: 1.0, ease: "power2.inOut" }, tNever + 0.05);
    tl.fromTo(restWrap, { opacity: 0.2, filter: "blur(3px)" }, { opacity: 1, filter: "blur(0px)", duration: 1.0, ease: "power2.inOut", immediateRender: false }, tRelease);
    k.drawPlate(sec, tNever - 0.05, 2.2, { acc: tClosed });
    const st = $$(".s05-sectext text");
    if (st[0]) k.rise(st[0], tSecrets + 0.05, { y: 8, dur: 0.55 });
    if (st.length > 1) k.rise(st.slice(1), tClosed + 0.12, { y: 8, dur: 0.55, stagger: 0.15 });
    tl.fromTo("#s05-pill", { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power4.out" }, tSecrets - 0.05);
    k.pulseMeter(tSecrets, 3.2);

    // "Key files stay closed": the seal stamps onto the key file.
    const seal = $(".s05-seal");
    if (seal) {
      const cx = seal.getAttribute("data-cx"), cy = seal.getAttribute("data-cy");
      k.draw($$(SH, seal), tClosed - 0.3, 0.45, 0.15, "power2.out");
      tl.fromTo(seal, { scale: 1.6, opacity: 0, svgOrigin: `${cx} ${cy}` }, { scale: 1, opacity: 1, svgOrigin: `${cx} ${cy}`, duration: 0.42, ease: "power4.out" }, tClosed - 0.3);
    }

    // "passwords are blacked out": the indexed lines appear, then ink bars run over the values.
    k.rise($$(".s05-idx text"), tPass - 0.05, { y: 8, dur: 0.5, stagger: 0.1 });
    k.draw($$(".s05-bar"), tBlack - 0.06, 0.42, 0.2, "power2.inOut");
    tl.fromTo($$(".s05-ko"), { opacity: 0 }, { opacity: 1, duration: 0.05, ease: "none" }, tBlack - 0.06);
    k.pulseMeter(tBlack, 2.0);
  },
  sfx(ctx) {
    return [
      ...["README", "package", "git", "notes"].map((w) => ({ name: "tick", at: ctx.word(w) - 0.04, vol: 0.2 })),
      { name: "seal", at: ctx.word("closed") - 0.08, vol: 0.4 },
      { name: "pencil", at: ctx.word("blacked") - 0.06, vol: 0.14 },
    ];
  },
};
