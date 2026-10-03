// Hears the narration back: transcribes every line with ElevenLabs speech-to-text and
// lists the words the transcript disagrees with, which is where Lily mispronounced or
// slurred something. A reviewer that cannot listen can still read this.
//
//   node scripts/stt-check.mjs            all lines
//   node scripts/stt-check.mjs 05 13      only these

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LINES } from "../src/script.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(root, ".env"), "utf8");
const KEY = process.env.ELEVENLABS_API_KEY || env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
const only = process.argv.slice(2);
const ids = Object.keys(LINES).filter((id) => !only.length || only.includes(id));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);

async function transcribe(file) {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("language_code", "en");
  form.append("tag_audio_events", "false");
  form.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), path.basename(file));
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: form });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).text;
}

// Word-level diff (LCS) between what was written and what was heard.
function diff(a, b) {
  const m = a.length, n = b.length, L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0, said = [], heard = [];
  const flush = () => {
    if (said.length || heard.length) out.push({ said: said.join(" "), heard: heard.join(" ") });
    said = [];
    heard = [];
  };
  while (i < m && j < n) {
    if (a[i] === b[j]) { flush(); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) said.push(a[i++]);
    else heard.push(b[j++]);
  }
  while (i < m) said.push(a[i++]);
  while (j < n) heard.push(b[j++]);
  flush();
  return out;
}

const report = {};
await Promise.all(ids.map(async (id) => {
  const heard = await transcribe(path.join(root, "assets/audio/vo", `${id}.mp3`));
  report[id] = { heard, diffs: diff(norm(LINES[id]), norm(heard)) };
}));
for (const id of ids) {
  const r = report[id];
  console.log(`${id}  ${r.diffs.length ? r.diffs.map((d) => `"${d.said}" heard as "${d.heard}"`).join("; ") : "clean"}`);
}
fs.mkdirSync(path.join(root, ".hyperframes"), { recursive: true });
fs.writeFileSync(path.join(root, ".hyperframes/stt-report.json"), JSON.stringify(report, null, 2));
