// Writes storyboard.html: the sketch sheet reviewed before the build. One static 1920x1080
// SVG per frame (real copy, real fonts, real folder names; plain line stand-ins where the
// engraved plates will go), plus a seam map and a tokens cell. Opens from file://.
//
//   node scripts/sheet.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = "v2";
const TOTAL = 141.5;

const C = {
  paper: "#f7f5f0", ink: "#1c1b18", ink2: "#46433c", muted: "#7b766c", line: "rgba(28,27,24,.22)", link: "#2a52c4",
  night: "#0f0f0e", nightInk: "#eceae3", nightMuted: "#8f8a7f", nightLine: "rgba(236,234,227,.2)", nightLink: "#9db6ff",
};

// Real folder names from the index for the tree in frames 1 and 21.
const index = JSON.parse(fs.readFileSync(path.join(root, "../data/index.json"), "utf8"));
const byDepth = (d) => index.pages.filter((p) => p.depth === d && p.isArticle).sort((a, b) => b.totalFiles - a.totalFiles).map((p) => p.name);
const names1 = byDepth(1).slice(0, 10);
const names2 = byDepth(2).slice(0, 14);
const names3 = byDepth(3).slice(0, 18);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const hues = (seed) => {
  const h = hash(seed), a = h % 360;
  return [a, (a + 35 + ((h >>> 9) % 90)) % 360, (a + 180 + ((h >>> 17) % 60) - 30) % 360];
};

// ---------------------------------------------------------------- shared chrome

function chrome(f, t) {
  const night = f.theme === "night";
  const ink = night ? C.nightInk : C.ink, muted = night ? C.nightMuted : C.muted, line = night ? C.nightLine : C.line, link = night ? C.nightLink : C.link;
  const x = 150 + (t / TOTAL) * 1620;
  const stations = [["~/Programming", 0], ["I", 14], ["II", 70], ["III", 107], ["fin", 133.5]];
  return `
  <g fill="none" stroke="${line}" stroke-width="1.5">
    <rect x="44" y="40" width="1832" height="1000"/>
    <path d="M44 70V40H74M1846 40H1876V70M1876 1010V1040H1846M74 1040H44V1010" stroke="${ink}" stroke-width="2"/>
  </g>
  <text x="84" y="92" class="mono" font-size="20" letter-spacing="5" fill="${ink}">INNERNET · FIELD GUIDE</text>
  <text x="84" y="122" class="mono" font-size="17" letter-spacing="4" fill="${muted}">${esc(f.chapter)}</text>
  ${f.counter ? `<text x="1836" y="80" text-anchor="end" class="mono" font-size="16" letter-spacing="4" fill="${muted}">${f.counter[0]}${f.lock ? "  🔒" : ""}</text>
  <text x="1836" y="126" text-anchor="end" class="display" font-size="46" fill="${night ? C.nightLink : C.link}">${f.counter[1]}</text>
  <path d="M1636 140H1836" stroke="${line}" stroke-width="1.5" stroke-dasharray="3 5"/>` : ""}
  <g>
    <path d="M150 1000H1770" stroke="${ink}" stroke-width="1.5"/>
    ${stations.map(([s, st]) => { const sx = 150 + (st / TOTAL) * 1620; return `<path d="M${sx} 992V1008" stroke="${ink}" stroke-width="1.5"/><text x="${sx}" y="1030" text-anchor="middle" class="mono" font-size="15" letter-spacing="2" fill="${muted}">${s}</text>`; }).join("")}
    <path d="M${x} 990L${x - 8} 976H${x + 8}Z" fill="${link}"/>
  </g>
  ${f.vo ? `<text x="960" y="948" text-anchor="middle" class="serif-i" font-size="33" fill="${night ? C.nightInk : C.ink2}">${esc(f.vo)}</text>` : ""}`;
}

// Bottom-left caption block, the reference film's grammar.
const block = (f, { big, unit, title, line }, x = 120, y = 760) => {
  const night = f.theme === "night", ink = night ? C.nightInk : C.ink, muted = night ? C.nightMuted : C.muted;
  return `<text x="${x}" y="${y}" class="display" font-size="120" fill="${ink}">${esc(big)}</text>
  <text x="${x + 18 + String(big).length * 52}" y="${y}" class="mono" font-size="20" letter-spacing="4" fill="${muted}">${esc(unit)}</text>
  <path d="M${x} ${y + 26}H${x + 640}" stroke="${ink}" stroke-width="1.5"/>
  <text x="${x}" y="${y + 74}" class="display" font-size="46" fill="${ink}">${esc(title)}</text>
  <text x="${x}" y="${y + 112}" class="serif-i" font-size="27" fill="${muted}">${esc(line)}</text>`;
};

const fig = (f, n, title, x = 120, y = 186) => {
  const muted = f.theme === "night" ? C.nightMuted : C.muted;
  return `<text x="${x}" y="${y}" class="mono" font-size="17" letter-spacing="4" fill="${muted}">FIG. ${n} · ${esc(title)}</text>`;
};

const rings = (cx, cy, n, step, color, w = 1.3, dash = "") =>
  Array.from({ length: n }, (_, i) => `<circle cx="${cx}" cy="${cy}" r="${(i + 1) * step}" fill="none" stroke="${color}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`).join("");

function tree(cx, cy, colored = false, scale = 1) {
  let s = rings(cx, cy, 7, 56 * scale, C.line, 1, "2 6");
  const branch = (names, r, spread, offset) =>
    names.map((n, i) => {
      const a = offset + (i / names.length) * Math.PI * 2;
      const x = cx + Math.cos(a) * r * scale, y = cy + Math.sin(a) * r * scale;
      const [h] = hues(n);
      const dot = colored ? `oklch(0.7 0.14 ${h})` : C.ink;
      return `<path d="M${cx + Math.cos(a) * (r - spread) * scale} ${cy + Math.sin(a) * (r - spread) * scale}L${x} ${y}" stroke="${C.ink2}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="${colored ? 7 : 3.5}" fill="${dot}"/><text x="${x + 10}" y="${y + 5}" class="mono" font-size="${r < 150 ? 15 : 13}" fill="${C.muted}">${esc(n)}</text>`;
    }).join("");
  s += branch(names1, 112, 112, 0.2) + branch(names2, 224, 112, 0.5) + branch(names3, 336, 112, 0.9);
  return s;
}

const fileGlyph = (x, y, label, ink = C.ink) =>
  `<path d="M${x} ${y}h56l18 18v74h-74Z M${x + 56} ${y}v18h18" fill="none" stroke="${ink}" stroke-width="2"/><text x="${x + 37}" y="${y + 126}" text-anchor="middle" class="mono" font-size="18" fill="${ink}">${esc(label)}</text>`;

const card = (x, y, w, h, night = false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${night ? "#1a1a18" : "#fffefb"}" stroke="${night ? C.nightLine : C.line}" stroke-width="2"/>`;

const sigilDot = (x, y, r, seed) => {
  const [a, b, c] = hues(seed);
  const id = `g${hash(seed + x)}`;
  return `<defs><radialGradient id="${id}" cx="35%" cy="30%"><stop offset="0" stop-color="oklch(0.88 0.14 ${a})"/><stop offset=".55" stop-color="oklch(0.74 0.15 ${b})"/><stop offset="1" stop-color="oklch(0.6 0.13 ${c})"/></radialGradient></defs><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/><text x="${x}" y="${y + r * 0.22}" text-anchor="middle" class="display" font-size="${r}" fill="#fff">${esc(seed[0].toUpperCase())}</text>`;
};

const capture = (href, x, y, w, h, crop = 0) => `<g><rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="none" stroke="${C.line}" stroke-width="1.5"/><path d="M${x - 14} ${y + 16}V${y - 14}H${x + 16}M${x + w - 2} ${y - 14}H${x + w + 14}V${y + 16}" stroke="${C.ink}" stroke-width="2" fill="none"/><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 ${crop} 1600 ${1600 * (h / w)}" preserveAspectRatio="xMidYMin slice"><image href="${href}" width="1600" height="${1600 * 6}" preserveAspectRatio="xMidYMin meet"/></svg></g>`;

const callout = (x1, y1, x2, y2, text, anchor = "start", ink = C.link) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${ink}" stroke-width="2"/><circle cx="${x1}" cy="${y1}" r="6" fill="none" stroke="${ink}" stroke-width="2"/><text x="${x2 + (anchor === "start" ? 12 : -12)}" y="${y2 + 7}" text-anchor="${anchor}" class="serif-i" font-size="27" fill="${ink}">${esc(text)}</text>`;

const chapterCard = (f, numeral, word, gloss) => {
  const night = f.theme === "night", ink = night ? C.nightInk : C.ink, muted = night ? C.nightMuted : C.muted;
  return `<text x="960" y="700" text-anchor="middle" class="display" font-size="620" fill="${ink}" opacity=".07">${numeral}</text>
  <text x="960" y="520" text-anchor="middle" class="display" font-size="140" fill="${ink}">${esc(word)}</text>
  <path d="M760 566H1160" stroke="${ink}" stroke-width="1.5"/>
  <text x="960" y="618" text-anchor="middle" class="serif-i" font-size="34" fill="${muted}">${esc(gloss)}</text>
  <text x="960" y="380" text-anchor="middle" class="mono" font-size="20" letter-spacing="8" fill="${muted}">CHAPTER ${numeral}</text>`;
};

// ---------------------------------------------------------------- frames

const F = [];
const add = (o) => F.push(o);

add({ id: "01", name: "Folders", t: 0, d: 7, chapter: "~/PROGRAMMING", counter: ["FOLDERS", "5,484"], seam: "cut", vo: "Somewhere on your machine are thousands of folders.",
  note: "<b>Moves first:</b> ink lines already drawing from the centre at 0.1s; one slow pull-back reveals the whole tree while FOLDERS counts up. Pencil on paper.",
  body: () => `<g>${tree(960, 500)}</g><text x="960" y="508" text-anchor="middle" class="mono" font-size="22" fill="${C.ink}">linear-clone</text>` });

add({ id: "02", name: "A web of your own", t: 7, d: 7, chapter: "~/PROGRAMMING", counter: ["FOLDERS", "5,484"], seam: "crossfade", vo: "Innernet turns them into a web of your own.",
  note: "<b>Moves first:</b> the tree sinks to a 15% ghost while the wordmark outline draws, then fills; the italic <i>inner</i> lands last. Two tabs settle beneath.",
  body: () => `<g opacity=".16">${tree(960, 500)}</g>
  <text x="960" y="540" text-anchor="middle" class="display" font-size="230" fill="${C.ink}"><tspan class="display-i">inner</tspan>net</text>
  <text x="960" y="616" text-anchor="middle" class="serif-i" font-size="38" fill="${C.ink2}">A search engine and an encyclopedia, for everything you have made.</text>
  ${card(640, 680, 400, 70)}<circle cx="680" cy="715" r="11" fill="none" stroke="${C.muted}" stroke-width="2"/><text x="708" y="724" class="sans" font-size="26" fill="${C.muted}">Search your internet</text>
  ${card(1070, 680, 210, 70)}<text x="1175" y="726" text-anchor="middle" class="display" font-size="36" fill="${C.ink}"><tspan class="display-i">Inner</tspan>pedia</text>` });

add({ id: "03", name: "Chapter I", t: 14, d: 2.5, chapter: "I · HOW IT WORKS", counter: ["FOLDERS", "5,484"], seam: "light leak", vo: "",
  note: "<b>Moves first:</b> a warm light leak sweeps left to right; the ghost numeral breathes in behind the title. Soft bell. No voice: a breath.",
  body: (f) => chapterCard(f, "I", "How it works", "crawl · index · read") });

add({ id: "04", name: "The crawl", t: 16.5, d: 9.5, chapter: "I · HOW IT WORKS", counter: ["FOLDERS", "5,484"], seam: "chromatic cut", vo: "The indexer walks six levels deep, and quietly skips the noise.",
  note: "<b>Moves first:</b> the depth rings draw outward one by one (construction layer), then branches; the strike-throughs land in blue on the word <i>noise</i>. Camera pushes toward ring 6.",
  body: (f) => `${fig(f, 1, "THE CRAWL")}${rings(1240, 470, 7, 52, C.ink, 1.4)}${[0, 1, 2, 3, 4, 5, 6].map((i) => `<text x="${1240 + (i + 1) * 52 - 8}" y="462" class="mono" font-size="15" fill="${C.muted}">${i}</text>`).join("")}
  ${[["node_modules", 1530, 260], [".git", 1600, 420], ["dist", 1570, 640], [".next", 1420, 760]].map(([n, x, y]) => `<text x="${x}" y="${y}" class="mono" font-size="24" fill="${C.ink2}">${n}</text><path d="M${x - 6} ${y - 8}H${x + n.length * 14.5 + 6}" stroke="${C.link}" stroke-width="3"/>`).join("")}
  <path d="M1240 470L1580 300" stroke="${C.link}" stroke-width="2.5"/><path d="M1240 470m-120 0a120 120 0 0 1 104 -60" fill="none" stroke="${C.link}" stroke-width="2"/>
  ${block(f, { big: "6", unit: "LEVELS DEEP", title: "The crawl", line: "Dependencies, builds and caches are skipped." }, 120, 640)}` });

add({ id: "05", name: "What it reads", t: 26, d: 10, chapter: "I · HOW IT WORKS", counter: ["FOLDERS", "5,484"], seam: "chromatic cut", vo: "The README, the package file, the git history, notes for agents.",
  note: "<b>Moves first:</b> the folder splits open like an exploded drawing; each leader line draws as the narrator names its file. On <i>Never your secrets</i> the .env glyph is sealed and everything else dims.",
  body: (f) => `${fig(f, 2, "WHAT IT READS")}
  <path d="M240 360h120l26 30h214v300H240Z" fill="none" stroke="${C.ink}" stroke-width="2.5"/><text x="420" y="740" text-anchor="middle" class="mono" font-size="20" fill="${C.muted}">a folder</text>
  ${[["README.md", "the summary, and the Overview", 300], ["package.json", "frameworks and the infobox", 420], [".git", "a History section", 540], ["CLAUDE.md", "notes for agents", 660]].map(([n, l, y], i) => `${fileGlyph(780, y - 70, "")}<text x="890" y="${y - 20}" class="mono" font-size="26" fill="${C.ink}">${n}</text><path d="M1110 ${y - 28}H1300" stroke="${C.link}" stroke-width="2"/><text x="1316" y="${y - 20}" class="serif-i" font-size="30" fill="${C.link}">${l}</text>`).join("")}
  <rect x="1316" y="700" width="420" height="96" rx="8" fill="none" stroke="${C.ink}" stroke-width="2"/><text x="1346" y="758" class="mono" font-size="26" fill="${C.ink}">.env · keys · tokens</text><circle cx="1690" cy="748" r="28" fill="none" stroke="${C.link}" stroke-width="3"/><path d="M1676 748l10 10 18-20" stroke="${C.link}" stroke-width="3" fill="none"/><text x="1316" y="834" class="serif-i" font-size="28" fill="${C.muted}">never read</text>` });

add({ id: "06", name: "One small index", t: 36, d: 7, chapter: "I · HOW IT WORKS", counter: ["ARTICLES", "958"], seam: "chromatic cut", vo: "In under a minute, it all becomes one small index.",
  note: "<b>Moves first:</b> the ledger page rules draw top to bottom; three numerals count up in sequence, each settling with a tick. The HUD counter turns from FOLDERS to ARTICLES.",
  body: (f) => `${fig(f, 3, "THE INDEX")}
  ${card(220, 230, 1480, 560)}<text x="270" y="300" class="mono" font-size="26" fill="${C.ink}">data/index.json</text><path d="M270 326H1650" stroke="${C.line}" stroke-width="2"/>
  ${[["5,484", "folders", 320], ["958", "articles", 820], ["172", "repositories", 1260]].map(([n, l, x]) => `<text x="${x}" y="560" class="display" font-size="190" fill="${C.ink}">${n}</text><text x="${x + 6}" y="620" class="mono" font-size="24" letter-spacing="5" fill="${C.muted}">${l.toUpperCase()}</text>`).join("")}
  <text x="270" y="740" class="serif-i" font-size="32" fill="${C.ink2}">under a minute · 7.9 MB · one file</text>` });

add({ id: "07", name: "Stays on your machine", t: 43, d: 7, chapter: "I · HOW IT WORKS", counter: ["ARTICLES", "958"], lock: true, seam: "chromatic cut", vo: "It lives on your machine, and nothing ever leaves it.",
  note: "<b>Moves first:</b> the enclosure wall draws around the three readers; arrows reach outward, hit the wall and are struck through in blue on <i>nothing ever leaves it</i>. A seal closes the gate; half a second of stillness. The padlock joins the HUD and stays.",
  body: (f) => `${fig(f, 4, "PRIVATE BY DESIGN")}
  <rect x="820" y="230" width="640" height="520" rx="60" fill="none" stroke="${C.ink}" stroke-width="3"/><text x="1140" y="280" text-anchor="middle" class="mono" font-size="20" letter-spacing="5" fill="${C.muted}">THIS MACHINE</text>
  ${[["index.json", 340], ["search", 470], ["Innerpedia", 600]].map(([n, y]) => `${card(960, y - 50, 360, 80)}<text x="1140" y="${y + 2}" text-anchor="middle" class="mono" font-size="26" fill="${C.ink}">${n}</text>`).join("")}
  <rect x="1446" y="450" width="28" height="80" fill="${C.paper}" stroke="${C.ink}" stroke-width="3"/><text x="1140" y="800" text-anchor="middle" class="mono" font-size="22" fill="${C.ink2}">the only door: 127.0.0.1 · localhost</text><path d="M1460 540C1470 700 1300 760 1260 780" stroke="${C.ink2}" stroke-width="1.5" fill="none" stroke-dasharray="4 5"/>
  ${[["cloud", 320], ["telemetry", 420], ["third parties", 640]].map(([n, y]) => `<path d="M1470 ${y}H1640" stroke="${C.muted}" stroke-width="2" stroke-dasharray="6 6"/><text x="1656" y="${y + 9}" class="mono" font-size="24" fill="${C.muted}">${n}</text><path d="M1650 ${y}H${1656 + n.length * 14.5}" stroke="${C.link}" stroke-width="3"/>`).join("")}
  ${block(f, { big: "0", unit: "BYTES SENT", title: "Private by design", line: "Secrets are never read. Only this machine is served." }, 120, 600)}` });

add({ id: "08", name: "Search", t: 50, d: 7, chapter: "I · HOW IT WORKS", counter: ["ARTICLES", "958"], lock: true, seam: "chromatic cut", vo: "Search finds anything you type, in a few milliseconds.",
  note: "<b>Moves first:</b> the real results page slides in as a mounted plate with a slow push toward the knowledge panel; callout leaders draw to snippet, panel and operators. Real capture, not a rebuild.",
  body: (f) => `${fig(f, 5, "SEARCH · /search?q=linear")}${capture("assets/captures/search-linear.png", 300, 220, 1150, 640)}
  ${callout(560, 420, 220, 470, "highlighted snippets", "end")}${callout(1300, 360, 1560, 300, "the knowledge panel")}${callout(520, 300, 220, 700, "tabs and operators", "end")}` });

add({ id: "09", name: "Innerpedia", t: 57, d: 7, chapter: "I · HOW IT WORKS", counter: ["ARTICLES", "958"], lock: true, seam: "whip left", vo: "Innerpedia gives every project an article, written from what is inside it.",
  note: "<b>Moves first:</b> a leftward whip lands on the real linear-clone article; the camera drifts down from title to infobox while three callouts draw.",
  body: (f) => `${fig(f, 6, "INNERPEDIA · /wiki/linear-clone")}${capture("assets/captures/article-linear-clone.png", 300, 220, 1150, 640)}
  ${callout(560, 520, 270, 640, "a lead written", "end")}<text x="258" y="680" text-anchor="end" class="serif-i" font-size="27" fill="${C.link}">from metadata</text>${callout(1240, 470, 1560, 420, "the infobox")}${callout(1250, 800, 1560, 760, "history from git")}` });

add({ id: "10", name: "Namesakes", t: 64, d: 6, chapter: "I · HOW IT WORKS", counter: ["ARTICLES", "958"], lock: true, seam: "chromatic cut", vo: "Two hundred and four folders called src, one tidy page.",
  note: "<b>Moves first:</b> hundreds of tiny <i>src</i> labels scatter across the plate, then gather into one ruled list. The held frame: one full second where nothing moves.",
  body: (f) => `${fig(f, 7, "NAMESAKES")}
  ${Array.from({ length: 90 }, (_, i) => { const h = hash("src" + i); const x = 160 + (h % 820), y = 230 + ((h >>> 10) % 560); return `<text x="${x}" y="${y}" class="mono" font-size="${14 + (h % 7)}" fill="${C.muted}" opacity="${0.35 + ((h >>> 4) % 50) / 100}">src</text>`; }).join("")}
  <text x="1180" y="420" class="display" font-size="260" fill="${C.ink}">204</text>
  ${card(1180, 470, 560, 330)}<text x="1210" y="520" class="serif" font-size="30" fill="${C.ink}"><tspan font-weight="700">src</tspan> may refer to:</text>
  ${["src (linear-clone)", "src (space-walk)", "src (makepad)", "src (quirq)", "and 200 more"].map((s, i) => `<text x="1230" y="${570 + i * 44}" class="serif" font-size="27" fill="${i < 4 ? C.link : C.muted}">${esc(s)}</text>`).join("")}` });

add({ id: "11", name: "Chapter II", t: 70, d: 2.5, chapter: "II · ADD A SITE", counter: ["ARTICLES", "958"], lock: true, seam: "light leak", vo: "",
  note: "<b>Moves first:</b> light leak; the ruler marker slides to II. Soft bell, music swells.",
  body: (f) => chapterCard(f, "II", "Add a site", "every folder is already one") });

add({ id: "12", name: "Every folder is a site", t: 72.5, d: 6.5, chapter: "II · ADD A SITE", counter: ["ARTICLES", "958"], lock: true, seam: "chromatic cut", vo: "Every folder is already a site. A little care makes it a great one.",
  note: "<b>Moves first:</b> the five stations draw left to right along one long rule; tide-pool's sigil appears at station 1 and the camera frames it. Frames 12 to 15 are one continuous pan.",
  body: (f) => `${fig(f, 8, "ADD A SITE")}<path d="M220 520H1700" stroke="${C.ink}" stroke-width="2"/>
  ${[["1", "a folder"], ["2", "a README"], ["3", "a package file"], ["4", "git"], ["5", "pnpm index"]].map(([n, l], i) => { const x = 260 + i * 350; return `<circle cx="${x}" cy="520" r="44" fill="${C.paper}" stroke="${C.ink}" stroke-width="2.5"/><text x="${x}" y="536" text-anchor="middle" class="display" font-size="48" fill="${C.ink}">${n}</text><text x="${x}" y="620" text-anchor="middle" class="serif-i" font-size="30" fill="${C.ink2}">${l}</text>`; }).join("")}
  ${sigilDot(260, 380, 46, "tide-pool")}<text x="320" y="390" class="mono" font-size="24" fill="${C.ink}">tide-pool/</text>
  <path d="M170 300H350M170 300V340M350 300V340M170 700H350M170 700V660M350 700V660" stroke="${C.link}" stroke-width="2" fill="none"/>` });

add({ id: "13", name: "README", t: 79, d: 7, chapter: "II · ADD A SITE", counter: ["ARTICLES", "958"], lock: true, seam: "camera pan", vo: "Its first paragraph becomes the summary you see in search.",
  note: "<b>Moves first:</b> pan arrives at station 2; the README's first paragraph is underlined in blue, stroke by stroke, then a leader carries it into the real search snippet.",
  body: (f) => `${card(220, 240, 620, 560)}<text x="260" y="300" class="mono" font-size="24" fill="${C.ink}">README.md</text><text x="260" y="370" class="display" font-size="54" fill="${C.ink}">linear-clone</text>
  ${[0, 1, 2].map((i) => `<rect x="260" y="${410 + i * 44}" width="${[520, 500, 300][i]}" height="12" rx="4" fill="${C.ink2}" opacity=".55"/><path d="M260 ${430 + i * 44}h${[520, 500, 300][i]}" stroke="${C.link}" stroke-width="3"/>`).join("")}
  ${[0, 1, 2, 3].map((i) => `<rect x="260" y="${580 + i * 40}" width="${[480, 520, 410, 260][i]}" height="10" rx="4" fill="${C.muted}" opacity=".3"/>`).join("")}
  <path d="M860 460C980 460 1000 520 1080 520" stroke="${C.link}" stroke-width="2.5" fill="none"/>
  ${card(1080, 400, 640, 250)}<text x="1110" y="452" class="mono" font-size="20" fill="${C.muted}">~/Programming › XO › … › experiments</text><text x="1110" y="502" class="sans" font-size="34" fill="${C.link}">linear-clone</text>
  <text x="1110" y="552" class="sans" font-size="23" fill="${C.ink2}">A Linear-style project tracker: issues, OKRs,</text><text x="1110" y="586" class="sans" font-size="23" fill="${C.ink2}">sprints, calendar, members, and an internal wiki…</text>
  <text x="1110" y="700" class="serif-i" font-size="28" fill="${C.muted}">the real summary, from the real README</text>` });

add({ id: "14", name: "Frameworks and history", t: 86, d: 7, chapter: "II · ADD A SITE", counter: ["ARTICLES", "958"], lock: true, seam: "camera pan", vo: "Add a package file, and it learns your frameworks. Add git, and it gains a history.",
  note: "<b>Moves first:</b> \"next\" lights in package.json and three chips spring out of it; then 24 commit bars rise left to right from .git.",
  body: (f) => `${card(200, 240, 640, 360)}<text x="240" y="300" class="mono" font-size="24" fill="${C.ink}">package.json</text>
  ${['"dependencies": {', '  "next": "^16",', '  "react": "^19",', '  "tailwindcss": "^4"', "}"].map((l, i) => `<text x="240" y="${360 + i * 44}" class="mono" font-size="25" fill="${i === 1 ? C.link : C.ink2}">${esc(l)}</text>`).join("")}
  ${["Next.js", "React", "Tailwind CSS"].map((c, i) => `<rect x="${200 + i * 215}" y="640" width="${[150, 130, 200][i]}" height="54" rx="27" fill="none" stroke="${C.ink}" stroke-width="2"/><text x="${200 + i * 215 + [75, 65, 100][i]}" y="676" text-anchor="middle" class="sans" font-size="24" fill="${C.ink}">${c}</text>`).join("")}
  <text x="1000" y="300" class="mono" font-size="24" fill="${C.ink}">.git</text><path d="M1000 640H1720" stroke="${C.ink}" stroke-width="2"/>
  ${Array.from({ length: 24 }, (_, i) => { const v = [2, 0, 1, 4, 3, 0, 6, 9, 5, 2, 0, 3, 8, 12, 7, 4, 10, 14, 9, 11, 16, 13, 18, 22][i]; return `<rect x="${1010 + i * 29}" y="${640 - v * 14}" width="18" height="${v * 14}" fill="${i > 19 ? C.link : C.ink2}" opacity="${i > 19 ? 1 : 0.6}"/>`; }).join("")}
  <text x="1000" y="700" class="serif-i" font-size="28" fill="${C.muted}">commits per month, 24 months</text>` });

add({ id: "15", name: "One command", t: 93, d: 8, chapter: "II · ADD A SITE", counter: ["ARTICLES", "959"], lock: true, seam: "camera pan", vo: "Then run one command. Your new site appears, with its own colours.",
  note: "<b>Moves first:</b> the caret types <i>pnpm index</i> with key ticks; the real-format output line prints; ARTICLES ticks 958 to 959 (callback to frame 06) and tide-pool's sigil blooms.",
  body: (f) => `${card(200, 250, 1020, 420)}<circle cx="240" cy="290" r="9" fill="${C.muted}" opacity=".5"/><circle cx="270" cy="290" r="9" fill="${C.muted}" opacity=".5"/><circle cx="300" cy="290" r="9" fill="${C.muted}" opacity=".5"/>
  <text x="240" y="380" class="mono" font-size="34" fill="${C.ink}">$ pnpm index</text><rect x="510" y="352" width="18" height="36" fill="${C.link}"/>
  <text x="240" y="450" class="mono" font-size="22" fill="${C.ink2}">indexed 5485 folders (959 articles, 172 repos,</text><text x="240" y="484" class="mono" font-size="22" fill="${C.ink2}">183 categories) from ~/Programming in 51029 ms</text>
  ${sigilDot(1480, 450, 120, "tide-pool")}<text x="1480" y="640" text-anchor="middle" class="display" font-size="54" fill="${C.ink}">tide-pool</text><text x="1480" y="690" text-anchor="middle" class="serif-i" font-size="28" fill="${C.muted}">a new article on Innerpedia</text>` });

add({ id: "16", name: "More roots", t: 101, d: 6, chapter: "II · ADD A SITE", counter: ["ARTICLES", "959"], lock: true, seam: "chromatic cut", vo: "Add a root, and the crawl reaches further.",
  note: "<b>Moves first:</b> the second root types into the config; a second set of depth rings opens beside the first and the two fields meet.",
  body: (f) => `${fig(f, 9, "ROOTS")}${card(160, 300, 700, 300)}<text x="200" y="360" class="mono" font-size="24" fill="${C.muted}">innernet.config.json</text>
  ${["{", '  "roots": [', '    "~/Programming",', '    "~/Documents/notes"', "  ],", '  "maxDepth": 6', "}"].map((l, i) => `<text x="200" y="${410 + i * 32}" class="mono" font-size="24" fill="${i === 3 ? C.link : C.ink2}">${esc(l)}</text>`).join("")}
  ${rings(1180, 480, 5, 46, C.ink, 1.3)}${rings(1560, 480, 4, 46, C.link, 1.6)}<text x="1180" y="770" text-anchor="middle" class="mono" font-size="20" fill="${C.muted}">~/Programming</text><text x="1560" y="770" text-anchor="middle" class="mono" font-size="20" fill="${C.link}">~/Documents/notes</text>` });

add({ id: "17", name: "Chapter III", t: 107, d: 2.5, theme: "night", chapter: "III · CONTRIBUTE", counter: ["ARTICLES", "959"], lock: true, seam: "dusk", vo: "",
  note: "<b>Moves first:</b> dusk: the paper dims through amber light into ink; lines turn paper-coloured. Bell, the music darkens and swells.",
  body: (f) => chapterCard(f, "III", "Contribute", "small, readable, yours") });

add({ id: "18", name: "The codebase", t: 109.5, d: 8.5, theme: "night", chapter: "III · CONTRIBUTE", counter: ["ARTICLES", "959"], lock: true, seam: "chromatic cut", vo: "One script writes the index. Two libraries read it. Pages render on the server.",
  note: "<b>Moves first:</b> boxes draw in reading order; blue light travels along each arrow as the narrator names the step. proxy.ts sits at the gate.",
  body: (f) => `${fig(f, 10, "THE CODEBASE")}
  ${[["scripts/build-index.ts", 160, 300], ["data/index.json", 160, 520], ["lib/data.ts", 720, 400], ["lib/search.ts", 720, 560], ["app/ (pages)", 1220, 400], ["components/", 1220, 560]].map(([n, x, y]) => `${card(x, y - 50, 420, 84, true)}<text x="${x + 210}" y="${y + 4}" text-anchor="middle" class="mono" font-size="26" fill="${C.nightInk}">${n}</text>`).join("")}
  <path d="M370 334V470M580 520C650 520 650 400 720 400M580 520C650 520 650 560 720 560M1140 400H1220M1140 560H1220" stroke="${C.nightLink}" stroke-width="2.5" fill="none"/>
  ${card(1660, 350, 160, 260, true)}<text x="1740" y="490" text-anchor="middle" class="mono" font-size="22" fill="${C.nightInk}">proxy.ts</text><text x="1740" y="660" text-anchor="middle" class="serif-i" font-size="24" fill="${C.nightMuted}">the gate</text>
  <text x="160" y="760" class="serif-i" font-size="32" fill="${C.nightMuted}">Server Components by default. One browser request: /api/suggest.</text>` });

add({ id: "19", name: "Recipes", t: 118, d: 7.5, theme: "night", chapter: "III · CONTRIBUTE", counter: ["ARTICLES", "959"], lock: true, seam: "chromatic cut", vo: "Each change lives in one known place.",
  note: "<b>Moves first:</b> four index cards deal in from the right with a short stagger and settle in a row; each file path types on in mono.",
  body: (f) => `${[["A search operator", "lib/search.ts"], ["A special page", "components/wiki/special-view.tsx"], ["A framework", "scripts/build-index.ts"], ["An article section", "components/wiki/article-view.tsx"]].map(([t, p], i) => { const x = 140 + i * 420; return `${card(x, 260, 380, 460, true)}<text x="${x + 30}" y="320" class="mono" font-size="17" letter-spacing="4" fill="${C.nightMuted}">RECIPE ${i + 1}</text><path d="M${x + 30} 340H${x + 350}" stroke="${C.nightLine}"/><text x="${x + 30}" y="420" class="display" font-size="46" fill="${C.nightInk}">${esc(t)}</text><text x="${x + 30}" y="660" class="mono" font-size="${p.length > 26 ? 15 : 19}" fill="${C.nightLink}">${esc(p)}</text>`; }).join("")}` });

add({ id: "20", name: "The loop", t: 125.5, d: 8, theme: "night", chapter: "III · CONTRIBUTE", counter: ["ARTICLES", "959"], lock: true, seam: "chromatic cut", vo: "Make the change. Check the types. Crawl the pages. Open a pull request.",
  note: "<b>Moves first:</b> the orbit draws; a blue marker travels the circle and each station lights exactly as it is named.",
  body: (f) => `${fig(f, 11, "THE LOOP")}<circle cx="1120" cy="500" r="250" fill="none" stroke="${C.nightLine}" stroke-width="2"/>
  ${[["edit", -90], ["typecheck", -18], ["crawl", 54], ["screenshot", 126], ["pull request", 198]].map(([n, a], i) => { const r = (a * Math.PI) / 180, x = 1120 + Math.cos(r) * 250, y = 500 + Math.sin(r) * 250; return `<circle cx="${x}" cy="${y}" r="16" fill="${i === 1 ? C.nightLink : C.night}" stroke="${C.nightInk}" stroke-width="2.5"/><text x="${x + (Math.cos(r) >= 0 ? 32 : -32)}" y="${y + 9}" text-anchor="${Math.cos(r) >= 0 ? "start" : "end"}" class="mono" font-size="26" fill="${C.nightInk}">${n}</text>`; }).join("")}
  ${block(f, { big: "5", unit: "STEPS", title: "The loop", line: "pnpm typecheck · crawl · scripts/shot.sh" }, 120, 600)}` });

add({ id: "21", name: "Close", t: 133.5, d: 8, chapter: "FIN", counter: ["ARTICLES", "959"], lock: true, seam: "dawn", vo: "Now you can wander it, and it never leaves your machine.",
  note: "<b>Moves first:</b> dawn: ink lifts back to paper; the folder tree from frame 01 returns lit in sigil colours (callback), the wordmark settles. Three seconds of hold; the music resolves.",
  body: (f) => `<g opacity=".55">${tree(960, 470, true)}</g><rect x="560" y="400" width="800" height="250" fill="${C.paper}" opacity=".85"/>
  <text x="960" y="540" text-anchor="middle" class="display" font-size="200" fill="${C.ink}"><tspan class="display-i">inner</tspan>net</text>
  <text x="960" y="604" text-anchor="middle" class="serif-i" font-size="36" fill="${C.ink2}">Private · local · yours</text>
  <text x="960" y="840" text-anchor="middle" class="mono" font-size="26" fill="${C.link}">localhost:3470/guide</text>` });

// ---------------------------------------------------------------- page

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(t % 1 ? 1 : 0).padStart(t % 1 ? 4 : 2, "0")}`;
const svgFor = (f) => {
  const night = f.theme === "night";
  const bg = night
    ? `<rect width="1920" height="1080" fill="${C.night}"/><radialGradient id="an${f.id}" cx=".7" cy=".2" r=".7"><stop offset="0" stop-color="oklch(0.4 0.14 285)" stop-opacity=".45"/><stop offset="1" stop-color="${C.night}" stop-opacity="0"/></radialGradient><rect width="1920" height="1080" fill="url(#an${f.id})"/>`
    : `<rect width="1920" height="1080" fill="${C.paper}"/><radialGradient id="a1${f.id}" cx=".25" cy=".2" r=".55"><stop offset="0" stop-color="oklch(0.86 0.09 40)" stop-opacity=".5"/><stop offset="1" stop-color="${C.paper}" stop-opacity="0"/></radialGradient><radialGradient id="a2${f.id}" cx=".8" cy=".3" r=".55"><stop offset="0" stop-color="oklch(0.84 0.08 285)" stop-opacity=".45"/><stop offset="1" stop-color="${C.paper}" stop-opacity="0"/></radialGradient><rect width="1920" height="1080" fill="url(#a1${f.id})"/><rect width="1920" height="1080" fill="url(#a2${f.id})"/>`;
  return `<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">${bg}${f.body(f)}${chrome(f, f.t + f.d * 0.6)}<rect width="1920" height="1080" filter="url(#grain)" opacity="${night ? 0.1 : 0.07}"/></svg>`;
};

const cells = F.map((f) => `
  <article class="cell" id="frame-${f.id}">
    <div class="frame">${svgFor(f)}</div>
    <div class="label"><b>${f.id} · ${esc(f.name.toUpperCase())}</b><span>s${f.id} · ${fmt(f.t)} → ${fmt(f.t + f.d)}</span></div>
    <p class="note">${f.note}</p>
    <span class="chip">into ${F[F.indexOf(f) + 1] ? F[F.indexOf(f) + 1].id : "end"}: ${esc(F[F.indexOf(f) + 1]?.seam ?? "fade to paper")}</span>
  </article>`).join("");

const seamMap = `<article class="cell"><div class="frame meta"><div class="pad"><h3>Seam map</h3><ol class="seams">${F.map((f, i) => `<li><span>${f.id}</span><i>${esc(i === 0 ? "open" : f.seam)}</i></li>`).join("")}</ol><p>Plates advance leftward. Every plate cut carries a chromatic spike and a flicker. Chapter cards enter on a light leak; chapter III on dusk; the close on dawn.</p></div></div><div class="label"><b>SEAMS</b><span>21 frames · ${fmt(TOTAL)}</span></div></article>`;

const tokens = `<article class="cell"><div class="frame meta"><div class="pad"><h3>Tokens</h3>
  <div class="sw">${[["paper", C.paper], ["ink", C.ink], ["ink-2", C.ink2], ["muted", C.muted], ["link", C.link], ["night", C.night], ["night ink", C.nightInk], ["night link", C.nightLink]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</div>
  <p class="types"><span class="d">Instrument Serif</span> display · <span class="s">Newsreader italic</span> lines and captions · <span class="m">JetBrains Mono</span> HUD, paths · <span class="i">Inter</span> UI only</p>
  <p><b>Bans:</b> no fake UI (real captures only), no decorative glow, no gradient text, no neon, no dashes on screen; no slideshow, no screensaver.</p></div></div><div class="label"><b>TOKENS</b><span>from innernet/DESIGN.md</span></div></article>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Innernet field guide film · storyboard ${VERSION}</title>
<style>
@font-face{font-family:"Instrument Serif";src:url(assets/fonts/instrument-serif-normal-400.woff2) format("woff2");font-style:normal}
@font-face{font-family:"Instrument Serif";src:url(assets/fonts/instrument-serif-italic-400.woff2) format("woff2");font-style:italic}
@font-face{font-family:"Newsreader";src:url(assets/fonts/newsreader-normal-var.woff2) format("woff2");font-weight:200 800;font-style:normal}
@font-face{font-family:"Newsreader";src:url(assets/fonts/newsreader-italic-var.woff2) format("woff2");font-weight:200 800;font-style:italic}
@font-face{font-family:"Inter";src:url(assets/fonts/inter-normal-var.woff2) format("woff2");font-weight:100 900}
@font-face{font-family:"JetBrains Mono";src:url(assets/fonts/jetbrains-mono-normal-var.woff2) format("woff2");font-weight:100 800}
:root{--paper:${C.paper};--ink:${C.ink};--muted:${C.muted};--line:${C.line};--link:${C.link}}
*{box-sizing:border-box}
body{margin:0;background:#ecE9e2;color:var(--ink);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
header{max-width:1680px;margin:0 auto;padding:56px 32px 28px;display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap}
header h1{font:400 56px/1 "Instrument Serif",serif;margin:0}
header h1 em{font-style:italic}
header p{margin:0 0 6px;font:italic 20px/1.4 Newsreader,serif;color:#46433c;flex:1;min-width:280px}
.tag{font:500 12px/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:8px 12px;color:var(--muted)}
.act{max-width:1680px;margin:28px auto 0;padding:0 32px;font:500 12px/1 "JetBrains Mono",monospace;letter-spacing:.2em;color:var(--muted);display:flex;align-items:center;gap:14px}
.act::after{content:"";flex:1;height:1px;background:var(--line)}
main{max-width:1680px;margin:0 auto;padding:16px 32px 80px;display:grid;grid-template-columns:repeat(3,1fr);gap:36px 28px}
@media (max-width:1100px){main{grid-template-columns:1fr 1fr}}@media (max-width:700px){main{grid-template-columns:1fr}}
.frame{aspect-ratio:16/9;container-type:inline-size;border-radius:6px;overflow:hidden;box-shadow:0 1px 2px rgba(28,27,24,.08),0 12px 30px -14px rgba(28,27,24,.3);background:var(--paper)}
.frame svg{display:block;width:100%;height:100%}
.label{display:flex;justify-content:space-between;gap:10px;margin-top:12px;font:500 11.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;color:var(--muted)}
.label b{color:var(--ink);font-weight:600}
.note{margin:8px 0 10px;font:15px/1.5 Newsreader,serif;color:#46433c}
.note b{font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:var(--ink)}
.chip{display:inline-block;font:500 11px/1 "JetBrains Mono",monospace;letter-spacing:.06em;color:var(--link);border:1px solid color-mix(in oklab,var(--link) 35%,transparent);border-radius:999px;padding:6px 10px}
svg .display{font-family:"Instrument Serif",serif}svg .display-i{font-family:"Instrument Serif",serif;font-style:italic}
svg .serif{font-family:Newsreader,serif}svg .serif-i{font-family:Newsreader,serif;font-style:italic}
svg .mono{font-family:"JetBrains Mono",monospace}svg .sans{font-family:Inter,sans-serif}
.meta{display:flex;background:#fffefb}.pad{padding:5cqw;font-size:2.4cqw;line-height:1.45;color:#46433c}
.pad h3{margin:0 0 3cqw;font:400 6cqw/1 "Instrument Serif",serif;color:var(--ink)}
.seams{list-style:none;margin:0 0 3cqw;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:1cqw 3cqw;font:500 2.1cqw/1.2 "JetBrains Mono",monospace}
.seams li{display:flex;gap:1.5cqw}.seams span{color:var(--ink)}.seams i{font-style:normal;color:var(--link)}
.pad p{margin:0 0 2cqw}.sw{display:grid;grid-template-columns:repeat(4,1fr);gap:2cqw;margin-bottom:3cqw;font:500 2cqw/1.2 "JetBrains Mono",monospace}
.sw span{display:flex;align-items:center;gap:1.4cqw}.sw i{width:4cqw;height:4cqw;border-radius:1cqw;border:1px solid var(--line)}
.types .d{font-family:"Instrument Serif";font-size:3cqw;color:var(--ink)}.types .s{font-family:Newsreader;font-style:italic}.types .m{font-family:"JetBrains Mono";font-size:2cqw}.types .i{font-family:Inter}
</style></head><body>
<svg width="0" height="0" style="position:absolute"><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></svg>
<header><h1>The <em>Inner</em>net field guide · film</h1><p>Every beat an engraved plate in one surveyor frame. Real screens, real numbers, Lily narrating. Sketch fidelity: the plates are line stand-ins; the build engraves them.</p><span class="tag">${VERSION} · 1920×1080 · ${fmt(TOTAL)} · 21 frames</span></header>
<div class="act">OPEN</div><main>${cells.split('<article class="cell" id="frame-03">')[0]}</main>
<div class="act">CHAPTER I · HOW IT WORKS</div><main><article class="cell" id="frame-03">${cells.split('<article class="cell" id="frame-03">')[1].split('<article class="cell" id="frame-11">')[0]}</main>
<div class="act">CHAPTER II · ADD A SITE</div><main><article class="cell" id="frame-11">${cells.split('<article class="cell" id="frame-11">')[1].split('<article class="cell" id="frame-17">')[0]}</main>
<div class="act">CHAPTER III · CONTRIBUTE · AND THE CLOSE</div><main><article class="cell" id="frame-17">${cells.split('<article class="cell" id="frame-17">')[1]}${seamMap}${tokens}</main>
</body></html>`;

fs.writeFileSync(path.join(root, "storyboard.html"), html);
console.log(`storyboard.html ${VERSION}: ${F.length} frames, ${(html.length / 1024).toFixed(0)} KB`);
