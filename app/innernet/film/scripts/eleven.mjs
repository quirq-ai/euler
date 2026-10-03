// Small ElevenLabs client for this film. Reads ELEVENLABS_API_KEY from .env and never
// prints it.
//
//   node scripts/eleven.mjs voices                      list voices (name, labels, id)
//   node scripts/eleven.mjs tts <voiceId> <text|@file> <out.mp3> [timestamps.json]
//   node scripts/eleven.mjs music "<prompt>" <seconds> <out.mp3>
//   node scripts/eleven.mjs sfx "<prompt>" <seconds> <out.mp3>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "";
const KEY = process.env.ELEVENLABS_API_KEY || env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
if (!KEY) {
  console.error("No ELEVENLABS_API_KEY in .env");
  process.exit(1);
}
const API = "https://api.elevenlabs.io";
const headers = { "xi-api-key": KEY, "Content-Type": "application/json" };

async function call(url, init = {}) {
  const res = await fetch(API + url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    throw new Error(`${init.method || "GET"} ${url} -> ${res.status}: ${body}`);
  }
  return res;
}

export const VOICE_SETTINGS = { stability: 0.62, similarity_boost: 0.78, style: 0.12, use_speaker_boost: true, speed: 0.94 };

export async function tts(voiceId, text, out, timestampsOut, opts = {}) {
  const body = {
    text,
    model_id: opts.model ?? "eleven_multilingual_v2",
    voice_settings: { ...VOICE_SETTINGS, ...(opts.voice_settings || {}) },
    ...(opts.previous_text ? { previous_text: opts.previous_text } : {}),
    ...(opts.next_text ? { next_text: opts.next_text } : {}),
  };
  const res = await call(`/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_192`, { method: "POST", body: JSON.stringify(body) });
  const json = await res.json();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(json.audio_base64, "base64"));
  if (timestampsOut) fs.writeFileSync(timestampsOut, JSON.stringify(json.alignment ?? json.normalized_alignment ?? null));
  return json.alignment;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
const [cmd, ...rest] = isMain ? process.argv.slice(2) : [];
if (isMain) try {
  if (cmd === "voices") {
    const res = await call("/v1/voices");
    const { voices } = await res.json();
    for (const v of voices) {
      const l = v.labels || {};
      console.log([v.name, v.voice_id, v.category, l.gender, l.age, l.accent, l.descriptive || l.description, l.use_case || l.use_case].filter(Boolean).join(" | "), v.description ? `:: ${v.description.slice(0, 120)}` : "");
    }
  } else if (cmd === "tts") {
    const [voiceId, textArg, out, ts] = rest;
    const text = textArg.startsWith("@") ? fs.readFileSync(textArg.slice(1), "utf8").trim() : textArg;
    await tts(voiceId, text, out, ts);
    console.log(out);
  } else if (cmd === "music") {
    const [prompt, seconds, out] = rest;
    const res = await call("/v1/music?output_format=mp3_44100_192", { method: "POST", body: JSON.stringify({ prompt, music_length_ms: Math.round(Number(seconds) * 1000) }) });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(out);
  } else if (cmd === "sfx") {
    const [prompt, seconds, out] = rest;
    const res = await call("/v1/sound-generation?output_format=mp3_44100_192", { method: "POST", body: JSON.stringify({ text: prompt, duration_seconds: Number(seconds), prompt_influence: 0.45 }) });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(out);
  } else if (cmd) {
    console.error(`unknown command ${cmd}`);
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
