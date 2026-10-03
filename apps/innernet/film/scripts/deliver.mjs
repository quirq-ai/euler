// Delivers a rendered film to the Innernet field guide:
//   node scripts/deliver.mjs renders/innernet-explainer.mp4 [posterSeconds]
// From the delivery-quality master it makes the web copy (H.264 CRF 24, loudness
// normalised to -16 LUFS / -1.5 dBTP), renders/innernet-explainer.vtt (captions from the
// narration word timings, the same phrasing the film shows) and a poster JPEG, then copies
// all three into the app's public/guide/ (the repo root) as innernet-explainer.mp4 / .vtt
// and film-poster.jpg.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timing } from "../src/film.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [mp4Arg, posterArg] = process.argv.slice(2);
if (!mp4Arg) {
  console.error("usage: node scripts/deliver.mjs <render.mp4> [posterSeconds]");
  process.exit(1);
}
const master = path.resolve(mp4Arg);
const mp4 = path.join(path.dirname(master), "innernet-explainer-1080p.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", master, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-tune", "film", "-pix_fmt", "yuv420p", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", mp4]);
const { segs } = timing();

// Same phrase rules as the runtime's captions.
const phrases = [];
for (const seg of segs) {
  if (!seg.vo) continue;
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    phrases.push({ start: seg.voStart + cur[0].start - 0.08, end: seg.voStart + cur.at(-1).end + 0.35, text: cur.map((w) => w.text).join(" ") });
    cur = [];
  };
  for (const w of seg.vo.words) {
    cur.push(w);
    if (/[.,:;?!]$/.test(w.text) && cur.length >= 3) flush();
    else if (cur.length >= 8) flush();
  }
  flush();
}
for (let i = 0; i < phrases.length - 1; i++) phrases[i].end = Math.min(phrases[i].end, phrases[i + 1].start);
const ts = (t) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
};
const vtt = "WEBVTT\n\n" + phrases.map((p, i) => `${i + 1}\n${ts(Math.max(0, p.start))} --> ${ts(p.end)}\n${p.text}\n`).join("\n");

const renders = path.join(root, "renders");
fs.mkdirSync(renders, { recursive: true });
const vttFile = path.join(renders, "innernet-explainer.vtt");
fs.writeFileSync(vttFile, vtt);

const posterAt = Number(posterArg ?? 13.6);
const poster = path.join(renders, "film-poster.jpg");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(posterAt), "-i", mp4, "-frames:v", "1", "-q:v", "2", poster]);

const guide = path.resolve(root, "../public/guide");
fs.mkdirSync(guide, { recursive: true });
fs.copyFileSync(mp4, path.join(guide, "innernet-explainer.mp4"));
fs.copyFileSync(vttFile, path.join(guide, "innernet-explainer.vtt"));
fs.copyFileSync(poster, path.join(guide, "film-poster.jpg"));
const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(1) + " MB";
console.log(`captions: ${phrases.length} cues -> ${path.relative(root, vttFile)}`);
console.log(`poster at ${posterAt}s -> ${path.relative(root, poster)}`);
console.log(`guide: innernet-explainer.mp4 (${mb(mp4)}), .vtt, film-poster.jpg -> ${guide}`);
