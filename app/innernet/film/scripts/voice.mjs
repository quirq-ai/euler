// Renders the narration with ElevenLabs (Lily), one file per frame, with word timings.
//
//   node scripts/voice.mjs            all lines whose text changed since the last run
//   node scripts/voice.mjs 05 07      only these frames
//
// Writes assets/audio/vo/<id>.mp3 and assets/audio/vo/meta.json:
//   { [id]: { text, file, duration, words: [{ text, start, end }] } }

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LINES, VOICE, spoken } from "../src/script.mjs";
import { tts } from "./eleven.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "assets/audio/vo");
const metaFile = path.join(dir, "meta.json");
fs.mkdirSync(dir, { recursive: true });
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};
const ids = Object.keys(LINES);
const only = process.argv.slice(2);
const todo = ids.filter((id) => (only.length ? only.includes(id) : meta[id]?.text !== LINES[id]));

// Character alignment -> word timings.
function words(alignment) {
  if (!alignment) return [];
  const { characters, character_start_times_seconds: s, character_end_times_seconds: e } = alignment;
  const out = [];
  let cur = null;
  characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
    } else {
      if (!cur) cur = { text: "", start: s[i], end: e[i] };
      cur.text += ch;
      cur.end = e[i];
    }
  });
  if (cur) out.push(cur);
  return out.map((w) => ({ text: w.text, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
}

// Timings come back for the spoken words ("read me"); fold them onto the written ones
// ("README") so captions and scene cues use the words on screen.
function written(text, said) {
  const out = [];
  let k = 0;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const n = spoken(w).split(/\s+/).filter(Boolean).length;
    const part = said.slice(k, k + n);
    k += n;
    if (part.length) out.push({ text: w, start: part[0].start, end: part[part.length - 1].end });
  }
  if (k !== said.length) console.warn(`word count mismatch (${k} vs ${said.length}) in: ${text.slice(0, 40)}`);
  return out;
}

const run = async (id) => {
  const i = ids.indexOf(id);
  const file = path.join(dir, `${id}.mp3`);
  const alignment = await tts(VOICE.id, spoken(LINES[id]), file, null, {
    model: VOICE.model,
    voice_settings: { speed: VOICE.speed },
    previous_text: ids[i - 1] ? spoken(LINES[ids[i - 1]]) : undefined,
    next_text: ids[i + 1] ? spoken(LINES[ids[i + 1]]) : undefined,
  });
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
  meta[id] = { text: LINES[id], file: `assets/audio/vo/${id}.mp3`, duration: +duration.toFixed(3), words: written(LINES[id], words(alignment)) };
  console.log(`${id}  ${duration.toFixed(2)}s  ${LINES[id].slice(0, 60)}`);
};

// Four at a time keeps within the API's concurrency.
for (let k = 0; k < todo.length; k += 4) await Promise.all(todo.slice(k, k + 4).map(run));
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
const total = ids.reduce((a, id) => a + (meta[id]?.duration ?? 0), 0);
console.log(`narration: ${ids.length} lines, ${total.toFixed(1)}s of speech`);
