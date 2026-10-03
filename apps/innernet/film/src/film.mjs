// Film data and timing. Scene length comes from the real narration (assets/audio/vo/
// meta.json): a short lead-in, the line, a breath. Chapter cards are silent.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const W = 1920;
export const H = 1080;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VO = JSON.parse(fs.readFileSync(path.join(root, "assets/audio/vo/meta.json"), "utf8"));

export const CHAPTERS = [
  { n: 0, roman: "", word: "~/Programming", theme: "paper" },
  { n: 1, roman: "I", word: "How it works", gloss: "crawl · index · read", theme: "paper" },
  { n: 2, roman: "II", word: "Add a site", gloss: "every folder is already one", theme: "paper" },
  { n: 3, roman: "III", word: "Contribute", gloss: "small, readable, yours", theme: "night" },
  { n: 4, roman: "", word: "fin", theme: "paper" },
];

// counter: the HUD's running index. fig: plate number shown in the HUD plate line.
// hold / tail / lead tune the pauses. After the pronunciation re-takes (3 Oct) they were
// set so every chapter card still lands where the music bed swells (bed.mjs is cut to
// the original chapter times).
export const FRAMES = [
  { id: "01", name: "Folders", ch: 0, counter: ["FOLDERS", 5484], lead: 0.7 },
  { id: "02", name: "A web of your own", ch: 0, counter: ["FOLDERS", 5484], hold: 0.975 },
  { id: "03", name: "Chapter I", ch: 1, card: true },
  { id: "04", name: "The crawl", ch: 1, plate: "crawl", fig: 1, counter: ["FOLDERS", 5484], lead: 0.6 },
  { id: "05", name: "What it reads", ch: 1, plate: "anatomy", fig: 2, counter: ["FOLDERS", 5484], hold: 0.743 },
  { id: "06", name: "One small index", ch: 1, fig: 3, counter: ["ARTICLES", 958] },
  { id: "07", name: "Stays on your machine", ch: 1, plate: "privacy", fig: 4, counter: ["ARTICLES", 958], hold: 0.8 },
  { id: "08", name: "Search", ch: 1, fig: 5, counter: ["ARTICLES", 958] },
  { id: "09", name: "Innerpedia", ch: 1, fig: 6, counter: ["ARTICLES", 958] },
  { id: "10", name: "Namesakes", ch: 1, plate: "names", fig: 7, counter: ["ARTICLES", 958], hold: 0.768 },
  { id: "11", name: "Chapter II", ch: 2, card: true },
  { id: "12", name: "Every folder is a site", ch: 2, plate: "add-site", fig: 8, counter: ["ARTICLES", 958], lead: 0.6 },
  { id: "13", name: "README", ch: 2, plate: "add-site", fig: 8, counter: ["ARTICLES", 958] },
  { id: "14", name: "Frameworks and history", ch: 2, plate: "add-site", fig: 8, counter: ["ARTICLES", 958], tail: 0.357 },
  { id: "15", name: "One command", ch: 2, plate: "add-site", fig: 8, counter: ["ARTICLES", 959] },
  { id: "16", name: "More roots", ch: 2, fig: 9, counter: ["ARTICLES", 959] },
  { id: "17", name: "Chapter III", ch: 3, card: true },
  { id: "18", name: "The codebase", ch: 3, plate: "codebase", fig: 10, counter: ["ARTICLES", 959], lead: 0.4, tail: 0.3 },
  { id: "19", name: "Recipes", ch: 3, fig: 11, counter: ["ARTICLES", 959], tail: 0.35 },
  { id: "20", name: "The loop", ch: 3, plate: "contribute", fig: 12, counter: ["ARTICLES", 959], tail: 0.35 },
  { id: "21", name: "Close", ch: 4, counter: ["ARTICLES", 959], lead: 1.0, hold: 3.0 },
];

export const CARD_DUR = 2.6;
const LEAD = 0.45; // silence before the line starts
const TAIL = 0.7; // breath after it ends

export function timing() {
  let t = 0;
  const segs = FRAMES.map((f) => {
    const vo = VO[f.id] ?? null;
    const lead = f.card ? 0 : f.lead ?? LEAD;
    const dur = f.card ? CARD_DUR : +(lead + (vo?.duration ?? 4) + (f.tail ?? TAIL) + (f.hold ?? 0)).toFixed(3);
    const seg = {
      ...f,
      theme: CHAPTERS[f.ch].theme,
      start: +t.toFixed(3),
      dur,
      voStart: vo ? +(t + lead).toFixed(3) : null,
      vo: vo ? { text: vo.text, file: vo.file, duration: vo.duration, words: vo.words } : null,
    };
    t += dur;
    return seg;
  });
  return { segs, total: +t.toFixed(3) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { segs, total } = timing();
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  for (const s of segs) console.log(`${s.id}  ${fmt(s.start)}  ${s.dur.toFixed(2).padStart(6)}s  ${s.name}`);
  console.log(`total ${fmt(total)} (${total}s)`);
}
