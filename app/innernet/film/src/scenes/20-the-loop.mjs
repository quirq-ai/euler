// 20 · The loop. The contribute plate draws on; the loop marker turns once around it, a
// 72 degree step on each spoken station, drawing the blue arrow behind it, and each station
// lights as it is named (lamp, halo, label). The caption numeral counts the steps. On
// "everything stays local" the centre seals: the legend ring turns into place, a link-blue
// ring closes, the padlock's shackle drops shut and the HUD privacy meter glows.
//
// Plate geometry (stations, arrows, marker, lock) is read from the plate itself at build
// time, so the scene follows the plate if it is re-engraved.

const PS = 0.8; // plate scale: 1600x1000 -> 1280x800
const PX = 668, PY = 121; // plate wrapper position on the frame

function group(svg, cls) {
  const open = svg.indexOf(`<g class="${cls}"`);
  if (open < 0) return null;
  let depth = 0, i = open;
  const re = /<\/?g\b[^>]*>/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(svg))) {
    if (m[0].startsWith("</")) depth--;
    else if (!m[0].endsWith("/>")) depth++;
    if (depth === 0) { i = m.index + m[0].length; break; }
  }
  return { start: open, end: i, text: svg.slice(open, i) };
}
const attr = (tag, a) => {
  const m = tag.match(new RegExp(`\\s${a}="([^"]*)"`));
  return m ? m[1] : null;
};
const nums = (s) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
const r1 = (v) => Math.round(v * 10) / 10;

function readPlate(svg) {
  // the loop centre and the marker's resting angle
  const mk = svg.match(/<g class="loop-marker"[^>]*>/);
  const cx = mk ? +attr(mk[0], "data-cx") : 800, cy = mk ? +attr(mk[0], "data-cy") : 525;
  const deg = mk ? +attr(mk[0], "data-deg") : -54;
  const ang = (x, y) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  const norm = (a) => { while (a < -90) a += 360; while (a >= 270) a -= 360; return a; };

  // stations: the medallion circles of the main layer
  const main = group(svg, "L-main");
  const st = [];
  for (const c of (main?.text.match(/<circle\b[^>]*>/g) || [])) {
    const x = +attr(c, "cx"), y = +attr(c, "cy"), r = +attr(c, "r");
    if (r >= 38 && r <= 64 && Math.hypot(x - cx, y - cy) > 150) st.push({ x, y, r, a: norm(ang(x, y)) });
  }
  st.sort((p, q) => p.a - q.a);
  const R = st.length ? st.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / st.length : 290;

  // the padlock at the centre: a small rect body and an arched shackle above it
  let lock = null;
  for (const t of (main?.text.match(/<rect\b[^>]*>/g) || [])) {
    const x = +attr(t, "x"), y = +attr(t, "y"), w = +attr(t, "width"), h = +attr(t, "height");
    if (w < 16 || w > 60 || h < 12 || h > 50 || Math.hypot(x + w / 2 - cx, y + h / 2 - cy) > 120) continue;
    const sh = (main.text.match(/<path\b[^>]*>/g) || []).find((p) => {
      const d = attr(p, "d") || "";
      if (!/A/i.test(d)) return false;
      const n = nums(d);
      return n.length >= 2 && n[0] >= x - 2 && n[0] <= x + w + 2 && Math.abs(n[1] - y) < 6;
    });
    if (sh) lock = { body: t, shackle: sh, x: x + w / 2, y, w, h };
  }
  return { cx, cy, deg, st, R, lock, norm, ang };
}

export default {
  id: "20",
  css: `
#s20 .cam { position: absolute; inset: 0; transform-origin: ${PX + 800 * PS}px ${PY + 525 * PS}px; }
#s20 .pl { position: absolute; left: ${PX}px; top: ${PY}px; width: ${1600 * PS}px; height: ${1000 * PS}px; clip-path: inset(0 11% 0 6.5%); }
#s20 .pl > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
#s20 .s20-acc { color: var(--link); }
#s20 .s20-acc > path { stroke-dasharray: 1000 1000; }
#s20 .s20-lbl { color: var(--ink2); }
#s20 .s20-lbl .lb-title { fill: var(--ink); }
#s20 .under .mk { color: var(--link); stroke-width: 3.4; stroke-linecap: round; }
#s20 .under .mk circle, #s20 .under .mk path { stroke-dasharray: 100 110; }
#s20 .under .occ { fill: var(--bg); stroke: none; }
#s20 .under .lamp { fill: var(--link); fill-opacity: .2; stroke: none; }
#s20 .under .core { fill: var(--link); fill-opacity: .07; stroke: none; }
#s20 .over .halo { fill: none; stroke: var(--link); stroke-width: 3; stroke-dasharray: 100 110; }
#s20 .over .seal { fill: none; stroke: var(--link); stroke-width: 3.4; stroke-dasharray: 100 110; }
#s20 .over .seal2 { fill: none; stroke: var(--link); stroke-width: 1.2; stroke-dasharray: 100 110; opacity: .7; }
#s20 .over .lock-lit { color: var(--link); filter: url(#glow); }
#s20 .over .lock-lit * { stroke: currentColor; stroke-width: 2.2; stroke-dasharray: none; }
#s20 .over .lock-lit circle { fill: currentColor; stroke: none; }
#s20 .over .seal { filter: url(#glow); }
#s20 .over .wave { fill: none; stroke: var(--link); stroke-width: 3.2; filter: url(#glow); }
#s20 .under .flash { fill: var(--link); fill-opacity: .42; stroke: none; }
#s20 .roll { display: inline-grid; clip-path: inset(-4% -20% -2% -20%); }
#s20 .roll b { grid-area: 1 / 1; font-weight: 400; }
`,
  html(ctx) {
    let svg = ctx.plate("contribute");
    const g = readPlate(svg);
    const { cx, cy, deg, st, R, lock, norm, ang } = g;
    const n = st.length || 5;
    const stA = st.length ? st.map((p) => p.a) : [-90, -18, 54, 126, 198];

    // The plate's own marker moves under the plate, so the medallions can hide it as it
    // passes through a station.
    const acc = group(svg, "L-acc");
    let marker = "";
    if (acc) {
      const mg = group(acc.text, "loop-marker");
      let body = acc.text;
      if (mg) {
        marker = mg.text.replace('class="loop-marker"', 'class="loop-marker mk"');
        body = acc.text.slice(0, mg.start) + acc.text.slice(mg.end);
      }
      svg = svg.slice(0, acc.start) + body.replace('class="L-acc"', 'class="s20-acc"') + svg.slice(acc.end);
    }

    // Arrows: each top-level path of the accent layer, as an angle range on the marker's
    // one unwrapped turn, from its resting place round to the same place.
    const accNow = group(svg, "s20-acc");
    const turn0 = deg, turn1 = deg + 360;
    const arcs = [];
    for (const p of (accNow?.text.match(/<path\b[^>]*>/g) || [])) {
      const d = attr(p, "d") || "";
      const first = d.split(/(?=M)/i)[0];
      const v = nums(first);
      if (v.length < 4) { arcs.push(null); continue; }
      let a0 = norm(ang(v[0], v[1]));
      let span = ang(v[v.length - 2], v[v.length - 1]) - ang(v[0], v[1]);
      while (span <= 0) span += 360;
      while (a0 < turn0) a0 += 360;
      if (a0 + span > turn1 + 0.5) a0 -= 360;
      if (a0 < turn0 - 0.5) { arcs.push(null); continue; }
      arcs.push([r1(a0), r1(a0 + span)]);
    }

    // Labels: lift the label layer out of drawPlate's hands and tag each text by what it
    // belongs to (a station, the centre seal, or the footer legend).
    const lbl = group(svg, "L-lbl");
    if (lbl) {
      let t = lbl.text.replace('class="L-lbl"', 'class="s20-lbl"');
      t = t.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (m, a, inner) => {
        const content = inner.replace(/<[^>]+>/g, "").trim();
        const x = +attr(" " + a, "x"), y = +attr(" " + a, "y");
        let cls;
        if (/textPath/.test(inner)) cls = "lb-ring";
        else if (Math.hypot(x - cx, y - cy) < 130) cls = "lb-ctr";
        else if (/STEPS|TURN/i.test(content)) cls = "lb-leg";
        else {
          let best = 0, bd = 1e9;
          st.forEach((p, i) => { const dd = Math.hypot(x - p.x, y - p.y); if (dd < bd) { bd = dd; best = i; } });
          const isTitle = /^[A-Z ]{3,}$/.test(content) && !/^[IVX]+$/.test(content);
          cls = `lb-st lb-st${best}${isTitle ? " lb-title" : ""}`;
        }
        const c0 = attr(" " + a, "class");
        const a2 = c0 != null ? a.replace(/\sclass="[^"]*"/, ` class="${c0} ${cls}"`) : `${a} class="${cls}"`;
        return `<text${a2}>${inner}</text>`;
      });
      svg = svg.slice(0, lbl.start) + t + svg.slice(lbl.end);
    }

    // The padlock: tag the plate's own small lock, and build a larger link-blue one in
    // its place that takes over on "everything" and shuts on "local".
    let lockLit = "", lk = null;
    if (lock) {
      svg = svg.replace(lock.shackle, lock.shackle.replace("<path", '<path class="s20-lockp"'));
      svg = svg.replace(lock.body, lock.body.replace("<rect", '<rect class="s20-lockp"'));
      const strip = (t) => t.replace(/\spathLength="[^"]*"/, "");
      lk = { x: r1(lock.x), y: r1(lock.y + lock.h / 2) };
      const kh = `<circle cx="${lk.x}" cy="${r1(lk.y - 2)}" r="2.6"/><path d="M${lk.x} ${r1(lk.y - 1)}V${r1(lk.y + 5)}"/>`;
      lockLit = `<g transform="translate(${lk.x} ${lk.y}) scale(1.5) translate(${-lk.x} ${-lk.y})"><g class="lock-lit">${strip(lock.body)}${kh}<g class="lock-sh">${strip(lock.shackle)}</g></g></g>`;
    }

    const lamps = st.map((p, i) => `<circle class="lamp st${i}" cx="${p.x}" cy="${p.y}" r="${p.r - 1}"/>`).join("");
    const occ = st.map((p) => `<circle class="occ" cx="${p.x}" cy="${p.y}" r="${p.r}"/>`).join("");
    const halos = st.map((p, i) => `<circle pathLength="100" class="halo st${i}" cx="${p.x}" cy="${p.y}" r="${p.r + 13}" transform="rotate(${r1(p.a + 180)} ${p.x} ${p.y})"/>`).join("");
    const geo = { cx, cy, deg, st: stA, arcs, turn0: r1(turn0), turn1: r1(turn1), lock: lk };
    const flashes = st.map((p) => `<circle class="flash" cx="${p.x}" cy="${p.y}" r="${p.r - 1}"/>`).join("");
    // the outer wall of the loop: the wave of light stops here
    const wall = st.length ? Math.round(R + st[0].r + 6) : 346;

    const cap = ctx.cap("s20c", { big: "5", unit: "steps", title: "The loop", line: "Every check runs on this machine." })
      .replace(/(<span class="cap-big" id="s20c-big">)5(<\/span>)/, `$1<span class="roll">${[1, 2, 3, 4, 5].map((v) => `<b>${v}</b>`).join("")}</span>$2`)
      .replace(/(<span class="cap-unit" id="s20c-unit">)steps(<\/span>)/, '$1step<span class="pl-s">s</span>$2');

    return `${ctx.fig(ctx.seg.fig, "THE LOOP")}
<div class="cam" id="s20-cam">
  <div class="pl" id="s20-pl" data-geo='${JSON.stringify(geo)}'>
    <svg class="under" viewBox="0 0 1600 1000" fill="none" stroke="currentColor"><circle class="core" cx="${cx}" cy="${cy}" r="160"/>${marker}${occ}${lamps}${flashes}</svg>
    ${svg}
    <svg class="over" viewBox="0 0 1600 1000" fill="none" stroke="currentColor">${halos}
      <circle pathLength="100" class="seal" cx="${cx}" cy="${cy}" r="172" transform="rotate(-90 ${cx} ${cy})"/>
      <circle pathLength="100" class="seal2" cx="${cx}" cy="${cy}" r="178" transform="rotate(-90 ${cx} ${cy})"/>
      <circle class="wave" cx="${cx}" cy="${cy}" r="${wall}"/>
      ${lockLit}
    </svg>
  </div>
</div>
${cap}`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s, r) => (r || el).querySelector(s);
    const $$ = (s, r) => Array.from((r || el).querySelectorAll(s));
    const pl = $("#s20-pl");
    const G = JSON.parse(pl.dataset.geo);
    const n = G.st.length;
    const step = 360 / n;
    const plate = $(".plate-svg", pl);

    // line work: construction, main, detail (labels and accents are this scene's own)
    k.drawPlate(plate, S, T, { mainSpread: 0.07, detSpread: 0.12 });
    k.camera($("#s20-cam"), S, T, { from: { scale: 1.035, x: 0, y: 8 }, mid: { scale: 1, x: 0, y: 0 }, to: { scale: 1.006, x: -4, y: 2 }, settle: 1.4 });
    k.capBlock("s20c", S + 0.05);

    // When each station is named.
    const lit = [k.word(seg, "change"), k.word(seg, "types"), k.word(seg, "crawl"), k.word(seg, "screenshot"), k.word(seg, "pull")].slice(0, n);
    const promise = k.word(seg, "promise"), every = k.word(seg, "everything"), local = k.word(seg, "local");

    // The marker appears at its resting place as the loop begins on "change", then takes
    // one 72 degree step per station, crossing it on the word; the last step brings it
    // home: one turn.
    const marker = $(".under .mk", pl);
    const sweeps = [];
    let u = G.turn0;
    lit.slice(1).forEach((t) => { sweeps.push({ a: u, b: u + step, t0: t - 0.42, d: 0.84 }); u += step; });
    sweeps.push({ a: u, b: G.turn1, t0: promise - 0.55, d: 1.1 });
    const og = `${G.cx} ${G.cy}`;
    if (marker) {
      k.draw($$("circle, path", marker), lit[0] + 0.05, 0.6, 0.25, "power2.out");
      sweeps.forEach((w, i) => {
        tl.fromTo(marker, { rotation: w.a - G.deg, svgOrigin: og }, { rotation: w.b - G.deg, svgOrigin: og, duration: w.d, ease: "power2.inOut", immediateRender: i === 0 }, w.t0);
      });
    }
    // The arrows draw behind the marker: each arc's drawn length is linear in the marker's
    // angle, so a tween with the sweep's own ease keeps them in step (dasharray 1000 1000
    // clamps anything outside the arc).
    const arcs = $$(".s20-acc > path", plate);
    arcs.forEach((p, j) => {
      const r = G.arcs[j];
      if (!r) return;
      const x = (ang) => Math.max(-900, Math.min(1000, (100 * (ang - r[0])) / (r[1] - r[0])));
      tl.set(p, { strokeDashoffset: 1000 }, 0);
      sweeps.forEach((w) => {
        if (w.b <= r[0] || w.a >= r[1]) return;
        tl.fromTo(p, { strokeDashoffset: 1000 - x(w.a) }, { strokeDashoffset: 1000 - x(w.b), duration: w.d, ease: "power2.inOut", immediateRender: false }, w.t0);
      });
    });

    // Stations light as they are named; the caption numeral counts them.
    const roll = $$("#s20c-big .roll b");
    roll.forEach((b, i) => tl.set(b, { opacity: i === 0 ? 1 : 0, yPercent: 0 }, 0));
    tl.fromTo($("#s20c-unit .pl-s"), { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none" }, lit[1] + 0.1);
    // the medallions turn solid as they are engraved, so the marker can pass behind them
    tl.fromTo($$(".under .occ", pl), { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "none" }, S + 1.0);
    lit.forEach((t, i) => {
      tl.fromTo($(".under .lamp.st" + i, pl), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, t - 0.05);
      k.draw([$(".over .halo.st" + i, pl)], t - 0.05, 0.7, 0, "expo.out");
      const lb = $$(".s20-lbl .lb-st" + i, plate);
      tl.fromTo(lb, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.07 }, t - 0.08);
      if (i > 0 && roll[i]) {
        // an odometer: the old count rolls up out of its window as the new one rolls in
        tl.fromTo(roll[i - 1], { yPercent: 0 }, { yPercent: -110, duration: 0.42, ease: "power3.inOut", immediateRender: false }, t - 0.05);
        tl.fromTo(roll[i], { opacity: 1, yPercent: 110 }, { opacity: 1, yPercent: 0, duration: 0.42, ease: "power3.inOut", immediateRender: false }, t - 0.05);
      }
    });
    // one turn: the footer legend lands as the marker comes home
    tl.fromTo($$(".s20-lbl .lb-leg", plate), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "none" }, promise + 0.3);

    // "everything stays local": the centre seals.
    const ctr = $$(".s20-lbl .lb-ctr", plate);
    tl.fromTo(ctr, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.18 }, every - 0.05);
    $$(".s20-lbl .lb-ring", plate).forEach((t, i) => {
      tl.fromTo(t, { opacity: 0, rotation: i ? 28 : -28, svgOrigin: og }, { opacity: 1, rotation: 0, svgOrigin: og, duration: 1.5, ease: "expo.out" }, every + 0.1);
    });
    tl.fromTo($(".under .core", pl), { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power1.inOut" }, every + 0.2);
    k.draw([$(".over .seal", pl)], every, local - every + 0.15, 0, "power2.inOut");
    k.draw([$(".over .seal2", pl)], every + 0.2, local - every + 0.15, 0, "power2.inOut");
    if (G.lock) {
      // the plate's small padlock hands over to a larger lit one, shackle standing open;
      // on "local" the shackle drops shut
      const lit2 = $(".over .lock-lit", pl), lsh = $(".over .lock-sh", pl);
      const lo = `${G.lock.x} ${G.lock.y}`;
      tl.fromTo($$(".s20-lockp", plate), { opacity: 1 }, { opacity: 0, duration: 0.4, ease: "none" }, every);
      tl.fromTo(lit2, { opacity: 0, scale: 0.8, svgOrigin: lo }, { opacity: 1, scale: 1, svgOrigin: lo, duration: 0.6, ease: "power3.out" }, every);
      tl.fromTo(lsh, { y: -8 }, { y: 0, duration: 0.42, ease: "back.out(2.4)" }, local - 0.04);
    }
    // ...and a ring of light runs out from the lock to the loop's outer wall and stops
    // there, lighting the five stations as it passes: nothing leaves the loop.
    const wave = $(".over .wave", pl);
    tl.fromTo(wave, { scale: 0.18, svgOrigin: og }, { scale: 1, svgOrigin: og, duration: 1.0, ease: "power2.out" }, local + 0.05);
    tl.fromTo(wave, { opacity: 0 }, { opacity: 0.95, duration: 0.12, ease: "none" }, local + 0.05);
    tl.fromTo(wave, { opacity: 0.95 }, { opacity: 0, duration: 0.55, ease: "power1.in", immediateRender: false }, local + 0.62);
    const fl = $$(".under .flash", pl);
    tl.fromTo(fl, { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "none" }, local + 0.4);
    tl.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: 0.7, ease: "power1.out", immediateRender: false }, local + 0.56);
    k.pulseMeter(every, 2.7);
  },
  sfx(ctx) {
    return [{ name: "lock", at: ctx.word("local") + 0.02, vol: 0.4 }, { name: "seal", at: ctx.word("local") + 0.06, vol: 0.22 }];
  },
};
