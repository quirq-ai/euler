// Builds index.html from src/film.mjs, src/scenes/*.mjs, the plates and the audio.
//
//   node src/build.mjs              the film -> index.html
//   node src/build.mjs --only 04,05 a preview with only those scenes -> previews/04-05.html
//
// Scene modules live in src/scenes/NN-name.mjs; see src/ENGINE.md for the contract.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CHAPTERS, H, W, timing } from "./film.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(rel(p));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg > 0 ? process.argv[onlyArg + 1].split(",").map((s) => s.trim().padStart(2, "0")) : null;

const { segs, total } = timing();

// ------------------------------------------------------------------ plates
const SHAPES = /<(path|line|circle|ellipse|rect|polyline|polygon)\b(?![^>]*pathLength)/g;
const plateCache = {};
function plate(id, cls = "") {
  if (!plateCache[id]) {
    const f = rel(`assets/plates/${id}.svg`);
    let s = fs.existsSync(f)
      ? fs.readFileSync(f, "utf8")
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" fill="none" stroke="currentColor"><g class="L-con" stroke-width="1.2"><rect x="40" y="40" width="1520" height="920"/></g><g class="L-main" stroke-width="2.6"><circle cx="800" cy="500" r="300"/></g><g class="L-det"/><g class="L-acc" stroke-width="3.4"><circle cx="800" cy="500" r="60"/></g><g class="L-lbl" stroke="none"><text x="800" y="512" text-anchor="middle" class="mono" font-size="28" fill="currentColor">PLATE ${id} (being engraved)</text></g></svg>`;
    s = s.replace(/<\?xml[^>]*>/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
    s = s.replace(SHAPES, '<$1 pathLength="100"');
    // Tag the corner registration marks (a crosshair and its ring at each corner) so the
    // film can hide them: they collide with the HUD and the FIG line, and the frame has its own.
    const corner = (x, y) => (x < 100 || x > 1500) && (y < 100 || y > 900);
    s = s.replace(/<path pathLength="100" d="M([\d.]+),([\d.]+)L([\d.]+),\2M([\d.]+),([\d.]+)L\4,([\d.]+)"/g, (m, x1, y, x2, xc, y1, y2) =>
      Math.abs(x2 - x1 - 28) < 0.5 && Math.abs(y2 - y1 - 28) < 0.5 && corner(+xc, +y) ? m.replace("<path ", '<path class="reg" ') : m);
    s = s.replace(/<circle pathLength="100" cx="([\d.]+)" cy="([\d.]+)" r="5\.9"/g, (m, x, y) => (corner(+x, +y) ? m.replace("<circle ", '<circle class="reg" ') : m));
    s = s.replace(/<svg\b([^>]*)>/, (m, a) => `<svg${a.replace(/\s(width|height|class)="[^"]*"/g, "")} class="plate-svg CLS" preserveAspectRatio="xMidYMid meet">`);
    plateCache[id] = s;
  }
  return plateCache[id].replace("CLS", `plate-${id} ${cls}`);
}

// ------------------------------------------------------------------ scenes
const modules = {};
for (const f of fs.readdirSync(rel("src/scenes")).filter((n) => /^\d\d-.*\.mjs$/.test(n)).sort()) {
  const url = pathToFileURL(rel(`src/scenes/${f}`)).href + `?v=${fs.statSync(rel(`src/scenes/${f}`)).mtimeMs}`;
  const m = (await import(url)).default;
  if (!m?.id) throw new Error(`${f}: default export needs an id`);
  modules[m.id] = m;
}

function ctxFor(seg) {
  return {
    seg, segs, total, W, H, esc, plate,
    capture: (name) => `assets/captures/${name}`,
    /** Absolute time of a word in this scene's narration. */
    word(w, nth = 0) {
      if (!seg.vo) return seg.start;
      const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
      const hits = seg.vo.words.filter((x) => norm(x.text) === norm(w));
      const hit = hits[Math.min(nth, hits.length - 1)];
      return +(seg.voStart + (hit ? hit.start : 0)).toFixed(3);
    },
    fig: (n, title) => `<div class="fig"><span>FIG. ${n}</span><i></i><span>${esc(title)}</span></div>`,
    /** Standard caption block (numeral, unit, rule, title, line); animate with k.capBlock(prefix, S). */
    cap: (p, o) => `<div class="cap ${o.cls ?? ""}"><div class="cap-top"><span class="cap-big" id="${p}-big">${esc(o.big ?? "")}</span><span class="cap-unit" id="${p}-unit">${esc(o.unit ?? "")}</span></div><div class="cap-rule" id="${p}-rule"></div><div class="cap-title" id="${p}-title">${esc(o.title ?? "")}</div>${o.line ? `<div class="cap-line" id="${p}-line">${esc(o.line)}</div>` : ""}</div>`,
  };
}

const glyphs = (w) => [...w].map((c) => (c === " " ? `<span class="gl">&nbsp;</span>` : `<span class="gl">${esc(c)}</span>`)).join("");
function cardHtml(seg) {
  const c = CHAPTERS[seg.ch];
  return `<div class="card-in"><div class="card-ghost" data-layout-ignore>${c.roman}</div><div class="card-kicker">CHAPTER ${c.roman}</div><div class="card-word">${glyphs(c.word)}</div><div class="card-rule"></div><div class="card-gloss">${esc(c.gloss ?? "")}</div></div>`;
}

const fnSource = (fn) => {
  const s = fn.toString().trim();
  return /^(async\s+)?function\b|^\(|^[A-Za-z_$][\w$]*\s*=>/.test(s) ? s : `function ${s}`;
};

const shown = segs.filter((s) => !ONLY || ONLY.includes(s.id));
const clips = [], motions = [], css = [], extraClips = [];
for (const seg of shown) {
  const m = modules[seg.id];
  const ctx = ctxFor(seg);
  const inner = seg.card ? cardHtml(seg) : m ? m.html(ctx) : `<div class="todo"><div class="todo-id">${seg.id}</div><div class="todo-name">${esc(seg.name)}</div></div>`;
  clips.push(`<div id="s${seg.id}" class="clip scene${seg.card ? " card" : ""}" data-start="${seg.start}" data-duration="${seg.dur}" data-track-index="1"><div class="scene-in" id="s${seg.id}-in">${inner}</div></div>`);
  if (m?.motion) motions.push(`"${seg.id}": ${fnSource(m.motion)}`);
  if (m?.css) css.push(m.css);
  if (m?.extra) extraClips.push(m.extra(ctx));
}

// ------------------------------------------------------------------ cuts and sound
const SEAM = { "02": "cross", "09": "whip", "13": "pan", "14": "pan", "15": "pan", "17": "dusk", "21": "dawn" };
const cuts = segs.slice(1).map((s) => ({ t: s.start, kind: s.card && s.theme !== "night" ? "leak" : SEAM[s.id] ?? "chroma" }));

const audioMeta = exists("assets/audio/audio.json") ? JSON.parse(fs.readFileSync(rel("assets/audio/audio.json"), "utf8")) : {};
const sfxFile = (name) => {
  const f = audioMeta.sfx?.[name]?.file ?? `assets/audio/sfx/${name}.mp3`;
  return exists(f) ? f : null;
};
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", rel(f)], { encoding: "utf8" }).trim());
const cues = [];
for (const c of cuts) {
  const name = { chroma: "whoosh", whip: "whoosh", pan: "page", leak: "bell", dusk: "bell", dawn: "bell", cross: null }[c.kind];
  if (name) cues.push({ name, at: Math.max(0, c.t - (name === "whoosh" ? 0.12 : 0)), vol: { whoosh: 0.2, page: 0.22, bell: 0.32 }[name] });
}
for (const seg of segs) if (seg.plate && !["13", "14", "15"].includes(seg.id)) cues.push({ name: "pencil", at: seg.start + 0.15, vol: 0.18 });
for (const seg of segs) {
  const m = modules[seg.id];
  if (m?.sfx) for (const c of m.sfx(ctxFor(seg))) cues.push(c);
}

const audio = [];
if (!ONLY) {
  for (const seg of segs) if (seg.vo) audio.push(`<audio id="vo-${seg.id}" src="${seg.vo.file}" data-start="${seg.voStart}" data-duration="${seg.vo.duration}" data-track-index="10" data-volume="1"></audio>`);
  const bed = audioMeta.bed?.file ?? "assets/audio/music/bed.mp3";
  if (exists(bed)) audio.push(`<audio id="bed" src="${bed}" data-start="0" data-duration="${total}" data-track-index="11" data-volume="${audioMeta.mix?.bed ?? 0.22}"></audio>`);
  cues.sort((a, b) => a.at - b.at).forEach((c, i) => {
    const f = sfxFile(c.name);
    if (!f) return;
    audio.push(`<audio id="sfx-${String(i).padStart(2, "0")}-${c.name}" src="${f}" data-start="${c.at.toFixed(3)}" data-duration="${Math.min(dur(f), total - c.at).toFixed(3)}" data-track-index="${12 + (i % 3)}" data-volume="${c.vol ?? audioMeta.mix?.sfx?.[c.name] ?? 0.25}"></audio>`);
  });
}

// ------------------------------------------------------------------ chrome
const RULER = { x0: 150, x1: 1770, y: 1002 };
const stationAt = [["~/Programming", 0], ...segs.filter((s) => s.card).map((s) => [CHAPTERS[s.ch].roman, s.start]), ["fin", segs[segs.length - 1].start]];
const rx = (t) => (RULER.x0 + ((RULER.x1 - RULER.x0) * t) / total).toFixed(1);
const ruler = `<svg id="ruler" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <line class="r-base" x1="${RULER.x0}" y1="${RULER.y}" x2="${RULER.x1}" y2="${RULER.y}"/>
  <line id="ruler-prog" class="r-prog" x1="${RULER.x0}" y1="${RULER.y}" x2="${RULER.x0}" y2="${RULER.y}"/>
  ${segs.map((s) => `<line class="r-tick" x1="${rx(s.start)}" y1="${RULER.y - 5}" x2="${rx(s.start)}" y2="${RULER.y + 5}"/>`).join("")}
  ${stationAt.map(([l, t]) => `<line class="r-major" x1="${rx(t)}" y1="${RULER.y - 11}" x2="${rx(t)}" y2="${RULER.y + 11}"/><text class="r-lab" x="${rx(t)}" y="${RULER.y + 32}" text-anchor="middle">${esc(l)}</text>`).join("")}
  <g id="ruler-mark"><path class="r-head" d="M0 ${RULER.y - 13}l-8 -14h16z"/></g>
</svg>`;
const frameLines = `<svg id="frame-lines" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none">
  <rect pathLength="100" x="44" y="40" width="1832" height="1000"/>
  <path pathLength="100" class="fl-c" d="M44 72V40H76M1844 40H1876V72M1876 1008V1040H1844M76 1040H44V1008"/>
</svg>`;
const lock = `<svg class="lock" viewBox="0 0 16 18" width="15" height="17"><rect x="2" y="8" width="12" height="9" rx="1.5"/><path class="shackle" d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></svg>`;
const hud = `<div id="hud" class="layer">
  <div class="hud-l"><div class="hud-name">INNERNET · FIELD GUIDE</div><div class="hud-ch" id="hud-ch"></div></div>
  <div class="hud-r"><div class="hud-lab" id="hud-lab">FOLDERS</div><div class="hud-val" id="hud-val">0</div>
    <div class="hud-meter" id="hud-meter">${lock}<span>LOCAL</span><i>·</i><b>0 B</b><span>SENT</span></div></div>
  ${ruler}
</div>`;

// ------------------------------------------------------------------ page
const DATA = { total, segs, cuts, ruler: RULER, chapters: CHAPTERS.map(({ n, roman, word }) => ({ n, roman, word })) };
const fonts = [
  ["Instrument Serif", "instrument-serif-normal-400.woff2", "normal", "400"],
  ["Instrument Serif", "instrument-serif-italic-400.woff2", "italic", "400"],
  ["Newsreader", "newsreader-normal-var.woff2", "normal", "200 800"],
  ["Newsreader", "newsreader-italic-var.woff2", "italic", "200 800"],
  ["Inter", "inter-normal-var.woff2", "normal", "100 900"],
  ["JetBrains Mono", "jetbrains-mono-normal-var.woff2", "normal", "100 800"],
].map(([f, file, st, w]) => `@font-face{font-family:"${f}";src:url("assets/fonts/${file}") format("woff2");font-style:${st};font-weight:${w};font-display:block}`).join("\n");

const STYLE = fs.readFileSync(rel("src/film.css"), "utf8");
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />${ONLY ? `\n    <base href="../" />` : ""}
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
${fonts}
${STYLE}
${css.join("\n")}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}" data-fps="30">
      <svg width="0" height="0" style="position:absolute" aria-hidden="true">
        <filter id="ca" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset id="ca-r" in="r" dx="0.6" dy="0" result="ro" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
          <feOffset id="ca-gb" in="gb" dx="-0.6" dy="0" result="gbo" />
          <feBlend in="ro" in2="gbo" mode="screen" />
        </filter>
        <filter id="glow" filterUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </svg>
      <div id="content">
        <div id="bg" class="layer"></div>
        <div class="aurora layer" data-layout-ignore><i></i><i></i><i></i></div>
        ${frameLines}
        ${clips.join("\n        ")}
        ${extraClips.join("\n        ")}
      </div>
      ${hud}
      <div id="caption" data-layout-ignore></div>
      <div id="vig" class="layer" data-layout-ignore></div>
      <div id="leak" class="layer" data-layout-ignore></div>
      <div id="grain" class="layer" data-layout-ignore></div>
      <div id="flicker" class="layer" data-layout-ignore></div>
      <div id="flash" class="layer" data-layout-ignore></div>
      ${audio.join("\n      ")}
    </div>
    <script>
      window.FILM_DATA = ${JSON.stringify(DATA)};
      window.SCENE_MOTION = {${motions.join(",\n")}};
    </script>
    <script>
${fs.readFileSync(rel("src/geo.js"), "utf8")}
    </script>
    <script>
${fs.readFileSync(rel("src/runtime.js"), "utf8")}
    </script>
  </body>
</html>
`;

const out = ONLY ? rel(`previews/${ONLY.join("-")}.html`) : rel("index.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
const missing = segs.filter((s) => !s.card && !modules[s.id]).map((s) => s.id);
console.log(`${path.relative(ROOT, out)}: ${shown.length} scenes, ${total}s, ${(html.length / 1024).toFixed(0)} KB, ${audio.length} audio${missing.length ? `, still to build: ${missing.join(" ")}` : ""}`);
