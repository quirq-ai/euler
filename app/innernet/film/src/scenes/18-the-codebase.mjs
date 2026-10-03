// 18 · The codebase (night). The codebase plate as one machine room: press, ledger, lens
// and gears, the app cabinets, and proxy.ts as the gatehouse. The plate draws on while
// Lily says "small and readable"; then the data's path lights in link blue as she names
// each part (the script, the two libraries, the server), a pulse of light running down
// every arrow. On "gate" the portcullis drops, the padlock snaps shut, a request from
// anywhere else is struck at the wall and the HUD meter glows; on "this computer" the one
// browser request comes back through, and THIS MACHINE, nothing leaves it lights.
//
// The plate is read, never hard-coded: html() parses the inlined plate (and the gate's
// numbers from its source) at build time, so a redrawn plate is followed on rebuild.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SC = 0.84; // plate scale: its drawing (y 52 to 915) fills y 156 to 880
const PW = Math.round(1600 * SC), PH = Math.round(1000 * SC);
const PL = Math.round(960 - 795 * SC), PT = Math.round(156 - 52 * SC);
const CROP = { top: Math.round(52 * SC), bottom: Math.round(PH - 915 * SC) };

const attr = (s, n) => {
  const m = s.match(new RegExp(`\\s${n}="([^"]*)"`));
  return m ? m[1] : null;
};
/** Absolute points of a path (M L H V Q C and their relative forms; enough for plates). */
function pts(d) {
  const t = d.match(/[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)/g) || [];
  const N = { m: 2, l: 2, h: 1, v: 1, q: 4, c: 6, t: 2, s: 4, a: 7, z: 0 };
  const out = [];
  let i = 0, c = "M", x = 0, y = 0;
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) c = t[i++];
    const lc = c.toLowerCase(), rel = c !== c.toUpperCase(), n = N[lc];
    if (n === undefined) break;
    if (n === 0) continue;
    const a = t.slice(i, i + n).map(Number);
    if (a.length < n || a.some(Number.isNaN)) break;
    i += n;
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (lc === "h") x = ox + a[0];
    else if (lc === "v") y = oy + a[0];
    else if (lc === "a") { x = ox + a[5]; y = oy + a[6]; }
    else { x = ox + a[n - 2]; y = oy + a[n - 1]; }
    out.push([x, y]);
    if (lc === "m") c = rel ? "l" : "L";
  }
  return out;
}
const box = (p) => {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** The gate's numbers, from the plate's own source (fallback: the shipped values). */
function gate(cx) {
  let g = { x0: 1262, x1: 1326, top: 92, p0: 420, p1: 590 };
  try {
    const src = fs.readFileSync(path.resolve(here, "../../assets/plates/src/codebase.mjs"), "utf8");
    const m = src.match(/const GATE = \{\s*x0:\s*([\d.]+),\s*x1:\s*([\d.]+),\s*top:\s*([\d.]+),\s*p0:\s*([\d.]+),\s*p1:\s*([\d.]+)/);
    if (m) g = { x0: +m[1], x1: +m[2], top: +m[3], p0: +m[4], p1: +m[5] };
  } catch {}
  if (cx && Math.abs((g.x0 + g.x1) / 2 - cx) > 2) {
    const w = g.x1 - g.x0;
    g.x0 = cx - w / 2;
    g.x1 = cx + w / 2;
  }
  g.cx = (g.x0 + g.x1) / 2;
  return g;
}

export default {
  id: "18",
  css: `
#s18 .cam { position: absolute; inset: 0; transform-origin: 1300px 500px; }
#s18 .pw { position: absolute; left: ${PL}px; top: ${PT}px; width: ${PW}px; height: ${PH}px; clip-path: inset(${CROP.top}px 0 ${CROP.bottom}px 0); }
#s18 .pw > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
#s18 .L-flow { color: var(--link); }
#s18 .ov { pointer-events: none; }
#s18 .ov .hl { color: var(--link); }
#s18 .ov .hl text { paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; }
#s18 .ov .pl { fill: none; stroke: color-mix(in oklab, var(--link) 55%, var(--ink)); stroke-width: 7; stroke-linecap: round; stroke-dasharray: 11 300; opacity: 0; }
#s18 .ov .pc path { fill: none; stroke: var(--ink); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
#s18 .ov .pc .tooth { stroke-width: 2; }
#s18 .ov .lk { fill: none; stroke: var(--link); stroke-width: 3; stroke-linecap: round; }
#s18 .ov .lk-glow { fill: none; stroke: var(--link); stroke-width: 6; opacity: 0; }
#s18 .ov .no { fill: none; stroke: var(--link); stroke-width: 3.6; stroke-linecap: round; stroke-dasharray: 100 110; }
#s18 .ov .dimhl path { fill: none; stroke: var(--link); stroke-width: 2.2; stroke-linecap: round; stroke-dasharray: 100 110; }
`,
  html(ctx) {
    let svg = ctx.plate("codebase");
    const texts = [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => ({ src: m[0], text: m[1].trim(), x: +attr(m[0], "x"), y: +attr(m[0], "y") }));
    const T = (s) => texts.find((t) => t.text === s);

    // The data's path (the plate's accent layer) becomes our own flow layer, each arrow
    // tagged by the part that owns it: script (press), lib (lens, gears), srv (app), ask
    // (the dashed request back from the browser).
    const flows = [];
    svg = svg.replace(/<g class="L-acc"([^>]*)>([\s\S]*?)<\/g>/, (m, a, body) => {
      const tagged = body.replace(/<path\b[^>]*\/>/g, (p) => {
        const d = attr(p, "d") || "";
        const q = pts(d);
        if (!q.length) return p;
        const b = box(q), tiny = Math.max(b.x1 - b.x0, b.y1 - b.y0) <= 24;
        const st = tiny ? "ask" : q[0][0] < 600 ? "script" : q[0][0] < 985 ? "lib" : "srv";
        flows.push({ st, d, q, tiny, i: flows.length });
        return p.replace("<path", `<path class="fl fl-${st}" data-i="${flows.length - 1}"`);
      });
      return `<g class="L-flow"${a}>${tagged}</g>`;
    });

    // Light pulses: the shaft of each arrow; the request back as one polyline.
    const pulses = flows.filter((f) => !f.tiny).map((f) => `<path pathLength="100" class="pl pl-${f.st}" data-i="${f.i}" d="${f.d.split(/(?=M)/)[0]}"/>`);
    const ask = flows.filter((f) => f.st === "ask");
    if (ask.length) {
      const seq = [];
      for (const f of ask) {
        if (f.q.length === 2) seq.push(...f.q);
        else if (f.q.length === 3) seq.push(f.q[1]); // the arrowhead's tip
      }
      if (seq.length > 1) pulses.push(`<path pathLength="100" class="pl pl-ask" d="M${seq.map((p) => p.join(",")).join("L")}"/>`);
    }

    // Labels to light, copied from the plate so they sit exactly on its own.
    const hl = (key, ...names) => names.map(T).filter(Boolean).map((t) => `<g class="hl hl-${key}">${t.src}</g>`).join("");
    const hls = [
      hl("script", "scripts/build-index.ts"),
      hl("index", "data/index.json"),
      hl("lib", "lib/data.ts", "lib/search.ts"),
      hl("pages", "app/", "components/"),
      hl("server", "Server Components render every page"),
      hl("proxy", "proxy.ts"),
      hl("addr", "127.0.0.1"),
      hl("other", "any other Host: 403"),
      hl("mach", "THIS MACHINE", "nothing leaves it"),
    ].join("");

    // The gate: a portcullis that drops through the passage, and the padlock above it.
    const g = gate(T("proxy.ts")?.x);
    const bars = [];
    const ytop = g.p0 - (g.p1 - g.p0);
    for (let x = g.x0 + 10; x < g.x1 - 4; x += 11) bars.push(`M${x} ${ytop}L${x} ${g.p1 - 10}`);
    let teeth = "";
    for (let x = g.x0 + 10; x < g.x1 - 4; x += 11) teeth += `M${x} ${g.p1 - 10}l-3 0l3 8l3 -8l-3 0`;
    let rails = "";
    for (let y = g.p1 - 28; y > ytop; y -= 26) rails += `M${g.x0 + 6} ${y}L${g.x1 - 6} ${y}`;
    const lift = g.p1 - g.p0 - 30;
    const lockY = (() => {
      const m = [...svg.matchAll(/<rect\b[^>]*\/>/g)].map((r) => r[0]).find((r) => +attr(r, "width") === 22 && +attr(r, "height") === 18 && Math.abs(+attr(r, "x") + 11 - g.cx) < 3);
      return m ? +attr(m, "y") : 150;
    })();

    // A request from anywhere else: its arrow, found under its note, gets struck.
    const other = T("any other Host: 403");
    let strike = "";
    if (other) {
      const dd = [...svg.matchAll(/\sd="(M[^"]+)"/g)].map((m) => m[1]).find((d) => {
        const q = pts(d);
        return q.length > 1 && q[0][1] > other.y + 4 && q[0][1] < other.y + 28 && Math.abs(q[1][1] - q[0][1]) < 0.5 && q[0][0] > g.x1 + 60;
      });
      if (dd) {
        const q = pts(dd), y = q[0][1], mx = Math.min(q[0][0], q[1][0]) + 30;
        strike = `<path pathLength="100" class="no no-x" d="M${mx - 8} ${y + 13}L${mx + 8} ${y - 13}"/><path pathLength="100" class="no no-bar" d="M${g.x1 + 6} ${y - 15}L${g.x1 + 6} ${y + 15}"/>`;
      }
    }

    // THIS MACHINE: the plate's overall dimension line, relit in blue.
    const mach = T("THIS MACHINE");
    let dim = "";
    if (mach) {
      const DY = mach.y - 7;
      dim = [...svg.matchAll(/\sd="(M[^"]+)"/g)].map((m) => m[1]).filter((d) => {
        const q = pts(d);
        return q.length > 1 && Math.abs(q[0][1] - DY) < 0.5 && Math.abs(q[1][1] - DY) < 0.5 && Math.abs(q[1][0] - q[0][0]) > 200;
      }).map((d) => `<path pathLength="100" d="${d}"/>`).join("");
    }

    const ov = `<svg class="ov" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid meet">
  <defs>
    <filter id="s18-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="s18-pass"><rect x="${g.x0 + 8}" y="${g.p0 + 6}" width="${g.x1 - g.x0 - 16}" height="${g.p1 - g.p0 - 6}"/></clipPath>
  </defs>
  <g class="pulses" filter="url(#s18-glow)">${pulses.join("")}</g>
  <g clip-path="url(#s18-pass)"><g class="pc" id="s18-pc" data-lift="${lift}"><path d="${bars.join("")}"/><path d="${rails}"/><path class="tooth" d="${teeth}"/></g></g>
  <g class="lock" id="s18-lock" data-cx="${g.cx}" data-cy="${lockY + 9}">
    <path class="lk-glow" filter="url(#s18-glow)" d="M${g.cx - 11} ${lockY}h22v18h-22z"/>
    <rect class="lk" x="${g.cx - 11}" y="${lockY}" width="22" height="18" rx="2"/>
    <path class="lk shackle" d="M${g.cx - 7} ${lockY}L${g.cx - 7} ${lockY - 7}A7 7 0 0 1 ${g.cx + 7} ${lockY - 7}L${g.cx + 7} ${lockY}"/>
  </g>
  ${strike}
  <g class="dimhl">${dim}</g>
  ${hls}
</svg>`;
    return `${ctx.fig(10, "THE CODEBASE")}
<div class="cam" id="s18-cam">
  <div class="pw" id="s18-pw">${svg}${ov}</div>
</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const $ = (s) => el.querySelector(s);
    const $$ = (s) => Array.from(el.querySelectorAll(s));
    const W = (w, n) => k.word(seg, w, n);

    k.camera($("#s18-cam"), S, T, { from: { scale: 1.04, x: 30, y: 8 }, mid: { scale: 1, x: 0, y: 0 }, to: { scale: 1.03, x: -6, y: -2 }, settle: 1.4 });
    k.fade($(".fig"), S + 0.15, 0.5);
    // the machine room draws on while "small and readable" is said
    k.drawPlate($("#s18-pw"), S - 0.2, 4.6, { lbl: 1.5, mainSpread: 0.35, detSpread: 0.38 });

    // a label lights while its part is named, then returns to the plate
    const lightUp = (key, at, hold) => {
      const g = $$(".hl-" + key);
      if (!g.length) return;
      tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" }, at);
      if (hold) tl.fromTo(g, { opacity: 1 }, { opacity: 0, duration: 0.7, ease: "power1.inOut", immediateRender: false }, at + hold);
    };
    // an arrow draws on, then a pulse of light runs down it
    const flow = (paths, at, dur = 0.6) => {
      paths.forEach((p, i) => {
        const t = at + i * 0.16;
        tl.fromTo(p, { strokeDashoffset: 101 }, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, t);
        const pl = $(`.pl[data-i="${p.dataset.i}"]`);
        if (!pl) return;
        tl.fromTo(pl, { strokeDashoffset: 11, opacity: 0 }, { strokeDashoffset: -100, opacity: 1, duration: dur + 0.25, ease: "power1.inOut" }, t + 0.1);
        tl.fromTo(pl, { opacity: 1 }, { opacity: 0, duration: 0.15, ease: "none", immediateRender: false }, t + dur + 0.25);
      });
    };
    const fl = (st) => $$(".fl-" + st);

    // "One script writes the index"
    const sc = W("script");
    flow(fl("script"), sc - 0.15, 0.55);
    lightUp("script", sc - 0.05, 1.7);
    lightUp("index", W("index") - 0.05, 1.3);
    // "two libraries read it"
    const li = W("libraries");
    flow(fl("lib"), li - 0.2, 0.55);
    lightUp("lib", li - 0.05, 1.9);
    // "and pages render on the server"
    const pg = W("pages"), sv = W("server");
    const srv = fl("srv");
    flow(srv.slice(0, 1), pg - 0.1, 0.45);
    flow(srv.slice(1), sv - 0.3, 0.6);
    lightUp("pages", pg - 0.05, 1.5);
    lightUp("server", sv - 0.1, 1.4);

    // "behind a gate": the portcullis drops, the padlock snaps shut, the meter answers
    const gt = W("gate");
    const pc = $("#s18-pc"), lift = +pc.dataset.lift;
    tl.fromTo(pc, { opacity: 0 }, { opacity: 1, duration: 0.05, ease: "none" }, gt - 0.25);
    tl.fromTo(pc, { y: -lift }, { y: 0, duration: 0.55, ease: "bounce.out" }, gt - 0.2);
    const lk = $("#s18-lock"), sh = $("#s18-lock .shackle");
    tl.fromTo(lk, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, gt - 0.1);
    tl.fromTo(sh, { y: -6 }, { y: 0, duration: 0.18, ease: "power4.in" }, gt + 0.25);
    tl.fromTo($("#s18-lock .lk-glow"), { opacity: 0 }, { opacity: 0.9, duration: 0.15, ease: "none" }, gt + 0.4);
    tl.fromTo($("#s18-lock .lk-glow"), { opacity: 0.9 }, { opacity: 0, duration: 1.2, ease: "power2.out", immediateRender: false }, gt + 0.55);
    lightUp("proxy", gt - 0.05);
    k.pulseMeter(gt, 2.8);
    // a request from anywhere else stops at the wall, struck
    const no = $$(".no");
    if (no.length) k.draw(no, gt + 0.35, 0.35, 0.2, "power3.out");
    lightUp("other", gt + 0.3);
    // "only this computer can open": the one browser request comes back through
    const th = W("this");
    lightUp("addr", W("only") - 0.05);
    const askSegs = fl("ask");
    if (askSegs.length) tl.fromTo(askSegs, { strokeDashoffset: 101 }, { strokeDashoffset: 0, duration: 0.12, ease: "none", stagger: 0.6 / askSegs.length }, th - 0.1);
    const pa = $(".pl-ask");
    if (pa) {
      tl.fromTo(pa, { strokeDashoffset: 11, opacity: 0 }, { strokeDashoffset: -100, opacity: 1, duration: 0.85, ease: "power1.inOut" }, th);
      tl.fromTo(pa, { opacity: 1 }, { opacity: 0, duration: 0.15, ease: "none", immediateRender: false }, th + 0.85);
    }
    // and the machine's own bounds light: nothing leaves it
    const cm = W("computer");
    const dims = $$(".dimhl path");
    if (dims.length) k.draw(dims, cm - 0.1, 0.9, 0, "power2.inOut");
    lightUp("mach", cm + 0.2);
    const op = W("open");
    ["script", "lib", "srv"].flatMap((st) => $$(".pl-" + st)).forEach((pl, i) => {
      const t = op - 0.15 + i * 0.09;
      tl.fromTo(pl, { strokeDashoffset: 11, opacity: 0 }, { strokeDashoffset: -100, opacity: 0.75, duration: 0.7, ease: "power1.inOut", immediateRender: false }, t);
      tl.fromTo(pl, { opacity: 0.75 }, { opacity: 0, duration: 0.12, ease: "none", immediateRender: false }, t + 0.7);
    });
  },
  sfx(ctx) {
    return [
      { name: "seal", at: ctx.word("gate") + 0.12, vol: 0.4 },
      { name: "lock", at: ctx.word("gate") + 0.4, vol: 0.45 },
    ];
  },
};
