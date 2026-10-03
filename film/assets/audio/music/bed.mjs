// Music bed for the Innernet field guide film.
//
//   node assets/audio/music/bed.mjs plan       print the chunk plan against the current timing
//   node assets/audio/music/bed.mjs generate   compose bed-raw.mp3 from the plan (ElevenLabs, costs credits)
//   node assets/audio/music/bed.mjs build      fit bed-raw.mp3 to the current film timing, write bed.mp3 and audio.json
//   node assets/audio/music/bed.mjs manifest   rewrite assets/audio/audio.json from the files on disk
//
// The plan is a list of chunks whose edges are pinned to film events (a chapter card, the first
// word of a line), read from src/film.mjs. Each chapter turn has its own short swell chunk that
// rises through the silent card and settles as the voice comes in; the privacy beat (F07) gets
// an intimate chunk where the pulse falls away. "build" never calls the API: when the narration
// changes and the events move, it time-stretches each raw chunk to its new length (pitch kept),
// so the swells stay on the turns. Then it carves the bed under the voice (a gentle dip in the
// speech band, a soft duck under each line, a lift on each card), fades it, and sets it to
// -20 LUFS integrated. Reads ELEVENLABS_API_KEY from .env and never prints it.

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { timing } from "../../../src/film.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const RAW = path.join(here, "bed-raw.mp3");
const PLAN = path.join(here, "plan.json");
const OUT = path.join(here, "bed.mp3");
const SR = 44100;
const FADE_IN = 1.5;
const FADE_OUT = 3.0;
const TARGET_LUFS = -20;
const MODEL = "music_v2_5";

// Envelope (dB): a soft duck under each spoken line, a lift on each chapter card.
const DUCK = -3.0;
const LIFT = 1.5;
const ATTACK = 0.6; // starts easing down this long before the voice
const RELEASE = 1.2; // eases back up after the line ends
const PRE_CARD = 1.2; // a turn's swell starts this long before its card

// Gain trims on the raw render (dB, smoothstep ramps), pinned to film events like the chunks.
// The render's dawn intro arrives about 15 dB under the body, and its last chord dies early.
const TRIMS = [
  { from: [null, "zero", 0], to: ["03", "start", -PRE_CARD - 0.3], db: 10, rampIn: 0, rampOut: 1.2 },
  { from: ["21", "voEnd", -4.5], to: [null, "end", 0], db: 6, rampIn: 2.0, rampOut: 0 },
];

// The privacy beat (F07 "Stays on your machine"): the bed closes in around the line, a low pass
// sweeping down to PRIVACY_HZ and a small dip, then opens again as the readers arrive.
const PRIVACY = { from: ["07", "start", 0], to: ["08", "start", 0], hz: 2200, db: -2, ramp: 1.4 };

const NEG = ["vocals", "lyrics", "singing", "choir", "humming", "spoken word", "drum kit", "cymbals", "EDM", "busy lead melody", "bright synth lead"];

// Each chunk ends at `to`: [frame id, event, offset seconds]. The last one ends at the film's end.
const CHUNKS = [
  {
    to: ["03", "start", -PRE_CARD],
    label: "Dawn (open)",
    text: "[Intro]",
    positive: [
      "cinematic ambient underscore",
      "instrumental only",
      "documentary film score",
      "felt piano, soft and close",
      "warm analog pads",
      "dawn light, hopeful and calm",
      "spacious and sparse",
      "gentle low mid register",
      "68 BPM",
      "D major",
      "great production quality",
    ],
    negative: [...NEG, "percussion", "fast tempo"],
  },
  {
    to: ["04", "voStart", 0],
    label: "Turn into I (swell)",
    text: "[Swell]\n{strings swell}",
    positive: ["a slow rising swell", "legato strings bloom in", "warm pads open up", "crescendo into a new section, then settle", "D major"],
    negative: [...NEG, "abrupt"],
  },
  {
    to: ["07", "start", 0],
    label: "I: crawl, read, index",
    text: "[Chapter One]",
    positive: ["gentle forward pulse", "soft low arpeggio on felt piano", "a sense of wonder", "legato strings enter softly", "warm pads", "steady and patient", "melody sparse, leaving room for a narrator"],
    negative: [...NEG, "staccato brass", "high busy melody"],
  },
  {
    to: ["08", "start", 0],
    label: "I: privacy beat (the bed closes in)",
    text: "[Interlude]\n{the pulse falls away}",
    positive: ["intimate and sheltered", "just felt piano and a warm low pad", "quiet, close, reassuring", "a held breath", "very sparse", "safe and still"],
    negative: [...NEG, "pulse", "arpeggio", "strings swell", "bright"],
  },
  {
    to: ["11", "start", -PRE_CARD],
    label: "I: the two readers",
    text: "[Chapter One, continued]",
    positive: ["the gentle pulse returns", "curious wonder", "strings and felt piano", "soft momentum", "warm", "D major"],
    negative: [...NEG, "high busy melody"],
  },
  {
    to: ["12", "voStart", 0],
    label: "Turn into II (swell)",
    text: "[Swell]\n{plucked strings bloom}",
    positive: ["a gentle swell", "plucked strings bloom in", "lifting and lighter", "crescendo, then settle", "D major"],
    negative: [...NEG, "abrupt"],
  },
  {
    to: ["17", "start", -PRE_CARD],
    label: "II: add a site",
    text: "[Chapter Two]",
    positive: ["lighter and curious", "plucked textures", "soft pizzicato strings", "felt piano", "airy pads", "playful but calm", "D major"],
    negative: [...NEG, "heavy", "dark"],
  },
  {
    to: ["18", "voStart", 0],
    label: "Turn into III (dusk swell)",
    text: "[Dusk]\n{a slow swell into night}",
    positive: ["dusk falling", "a slow swell sinking into darkness", "low cello enters", "pads deepen", "moving to B minor"],
    negative: [...NEG, "bright", "plucks"],
  },
  {
    to: ["20", "start", 0],
    label: "III: night",
    text: "[Night]",
    positive: ["night", "deep warm pads", "low solo cello", "introspective", "slow and still", "sparse felt piano notes", "low register", "B minor"],
    negative: [...NEG, "bright", "pizzicato", "fast", "high melody"],
  },
  {
    to: ["21", "start", -PRE_CARD],
    label: "III: swell before dawn",
    text: "[Night, before dawn]",
    positive: ["a slow swell building", "cello and pads rising", "anticipation of dawn", "light returning", "gradual crescendo"],
    negative: [...NEG, "abrupt"],
  },
  {
    to: ["21", "voEnd", 0],
    label: "Close: dawn returns",
    text: "[Dawn returns]",
    positive: ["dawn returns", "full warm swell", "strings and felt piano together", "the opening theme returns", "radiant but gentle", "D major"],
    negative: [...NEG, "bombastic"],
  },
  {
    to: null,
    label: "Close: resolve",
    text: "[Outro]",
    positive: ["soft resolve", "a final sustained D major chord", "let it ring", "gentle ending", "one last felt piano note"],
    negative: [...NEG, "abrupt ending", "building"],
  },
];

// Chunk edges (and trim windows) for the current timing.
export function edges() {
  const { segs, total } = timing();
  const at = ([id, ev, off]) => {
    if (ev === "zero") return off;
    if (ev === "end") return +(total + off).toFixed(3);
    const s = segs.find((x) => x.id === id);
    if (!s) throw new Error(`frame ${id} not in film timing`);
    const t = ev === "start" ? s.start : ev === "voStart" ? s.voStart : ev === "voEnd" ? s.voStart + s.vo.duration : s.start + s.dur;
    return +(t + off).toFixed(3);
  };
  const ends = CHUNKS.map((c) => (c.to ? at(c.to) : total));
  const bounds = ends.map((e, i) => [i ? ends[i - 1] : 0, e]);
  bounds.forEach(([a, b], i) => {
    if (b - a < 3) throw new Error(`chunk ${i} ${CHUNKS[i].text.split("\n")[0]} is ${(b - a).toFixed(2)}s; the API needs at least 3s`);
  });
  const trims = TRIMS.map((x) => ({ ...x, a: at(x.from), b: at(x.to) }));
  const privacy = { ...PRIVACY, a: at(PRIVACY.from), b: at(PRIVACY.to) };
  return { segs, total, bounds, trims, privacy };
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// 0 outside [a, b], 1 inside, smoothstep ramps of rampIn after a and rampOut before b.
function windowWeight(t, a, b, rampIn, rampOut) {
  if (t < a || t > b) return 0;
  const up = rampIn > 0 ? smooth((t - a) / rampIn) : 1;
  const down = rampOut > 0 ? smooth((b - t) / rampOut) : 1;
  return Math.min(up, down);
}

function key() {
  const envFile = path.join(root, ".env");
  const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const k = process.env.ELEVENLABS_API_KEY || env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!k) throw new Error("No ELEVENLABS_API_KEY in .env");
  return k;
}

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 30 });
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

export function ebur128(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const s = r.stderr;
  return {
    I: Number(s.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/)?.[1]),
    LRA: Number(s.match(/Loudness range:\s+LRA:\s+(-?[\d.]+) LU/)?.[1]),
    peak: Number(s.match(/True peak:\s+Peak:\s+(-?[\d.]+) dBFS/)?.[1]),
  };
}

function request() {
  const { bounds } = edges();
  const ms = bounds.map(([a, b]) => Math.round((b - a) * 1000));
  const chunks = CHUNKS.map((c, i) => ({
    text: c.text,
    duration_ms: ms[i],
    positive_styles: c.positive,
    negative_styles: c.negative,
    context_adherence: "high",
  }));
  let t = 0;
  const rawBounds = ms.map((d) => [t / 1000, (t += d) / 1000]);
  return { body: { composition_plan: { chunks }, model_id: MODEL }, rawBounds, total: t / 1000 };
}

async function generate() {
  const { body, rawBounds, total } = request();
  const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /v1/music -> ${res.status}: ${(await res.text()).slice(0, 600)}`);
  fs.writeFileSync(RAW, Buffer.from(await res.arrayBuffer()));
  fs.writeFileSync(PLAN, JSON.stringify({ total, bounds: rawBounds, songId: res.headers.get("song-id"), request: body }, null, 2) + "\n");
  console.log(`wrote ${path.relative(root, RAW)} (${probe(RAW).toFixed(2)}s, plan ${total}s)`);
}

function decode(file) {
  const buf = ff(["-i", file, "-ac", "2", "-ar", String(SR), "-f", "f32le", "-"]);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

// Fit the raw render to the current edges: stretch each chunk to its new length and join the
// chunks with short equal-power crossfades. Unchanged timing uses the raw render as is.
export function fitted(plan, now, tmp) {
  const same = plan.bounds.length === now.bounds.length && plan.bounds.every(([a, b], i) => Math.abs(a - now.bounds[i][0]) < 0.05 && Math.abs(b - now.bounds[i][1]) < 0.05);
  if (same) return decode(RAW);
  if (plan.bounds.length !== now.bounds.length) throw new Error("the chunk list changed since generate; run generate again");
  const XF = 0.3;
  const last = plan.bounds.length - 1;
  const files = plan.bounds.map(([a, b], i) => {
    const [na, nb] = now.bounds[i];
    const pre = i > 0 ? XF / 2 : 0;
    const post = i < last ? XF / 2 : 0;
    const srcA = Math.max(0, a - pre);
    const srcB = b + post;
    const tempo = (srcB - srcA) / (nb - na + pre + post);
    if (tempo < 0.8 || tempo > 1.25) throw new Error(`chunk ${i} would stretch by ${tempo.toFixed(2)}x; run generate again`);
    if (Math.abs(tempo - 1) > 0.005) console.log(`chunk ${i}: ${(b - a).toFixed(2)}s -> ${(nb - na).toFixed(2)}s (atempo ${tempo.toFixed(4)})`);
    const f = path.join(tmp, `c${i}.wav`);
    ff(["-ss", String(srcA), "-to", String(srcB), "-i", RAW, "-af", `atempo=${tempo.toFixed(6)}`, "-ac", "2", "-ar", String(SR), f]);
    return f;
  });
  let graph = "";
  let prev = "[0:a]";
  for (let i = 1; i < files.length; i++) {
    const out = i === last ? "[out]" : `[x${i}]`;
    graph += `${prev}[${i}:a]acrossfade=d=${XF}:c1=qsin:c2=qsin${out};`;
    prev = out;
  }
  const joined = path.join(tmp, "joined.wav");
  ff([...files.flatMap((f) => ["-i", f]), "-filter_complex", graph.slice(0, -1), "-map", "[out]", joined]);
  return decode(joined);
}

function envelopeDb(segs) {
  const lines = segs.filter((s) => s.vo).map((s) => [s.voStart, s.voStart + s.vo.duration]);
  const cards = segs.filter((s) => s.card).map((s) => [s.start, s.start + s.dur]);
  return (t) => {
    let duck = 0;
    for (const [a, b] of lines) {
      let w = 0;
      if (t >= a && t <= b) w = 1;
      else if (t < a && t > a - ATTACK) w = smooth(1 - (a - t) / ATTACK);
      else if (t > b && t < b + RELEASE) w = smooth(1 - (t - b) / RELEASE);
      duck = Math.max(duck, w);
    }
    let lift = 0;
    for (const [a, b] of cards) {
      if (t > a - 0.8 && t < b + 1.0) {
        const x = t < a ? (t - (a - 0.8)) / 0.8 : t > b ? 1 - (t - b) / 1.0 : 1;
        lift = Math.max(lift, smooth(Math.min(1, Math.max(0, x))));
      }
    }
    return DUCK * duck + LIFT * lift;
  };
}

function build() {
  if (!fs.existsSync(RAW) || !fs.existsSync(PLAN)) throw new Error("no bed-raw.mp3 yet; run generate first");
  const plan = JSON.parse(fs.readFileSync(PLAN, "utf8"));
  const now = edges();
  const tmp = fs.mkdtempSync(path.join(here, ".build-"));
  try {
    const pcm = fitted(plan, now, tmp);
    const n = Math.round(now.total * SR);
    const out = new Float32Array(n * 2);
    const env = envelopeDb(now.segs);
    const pv = now.privacy;
    // Two cascaded one-pole low passes per channel, cutoff swept in log space during the
    // privacy beat. Fully open (20 kHz) the pair is effectively transparent.
    const lp = [0, 0, 0, 0];
    const OPEN = 20000;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let db = env(t);
      for (const x of now.trims) db += x.db * windowWeight(t, x.a, x.b, x.rampIn, x.rampOut);
      const w = windowWeight(t, pv.a, pv.b, pv.ramp, pv.ramp);
      db += pv.db * w;
      let g = Math.pow(10, db / 20);
      if (t < FADE_IN) g *= Math.sin((t / FADE_IN) * (Math.PI / 2)) ** 2;
      const tail = now.total - t;
      if (tail < FADE_OUT) g *= Math.sin((Math.max(0, tail) / FADE_OUT) * (Math.PI / 2)) ** 2;
      const j = i * 2;
      let l = pcm[j] ?? 0;
      let r = pcm[j + 1] ?? 0;
      if (w > 0) {
        const fc = OPEN * Math.pow(pv.hz / OPEN, w);
        const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
        lp[0] += a * (l - lp[0]);
        lp[1] += a * (lp[0] - lp[1]);
        lp[2] += a * (r - lp[2]);
        lp[3] += a * (lp[2] - lp[3]);
        l = lp[1];
        r = lp[3];
      } else {
        lp[0] = lp[1] = l;
        lp[2] = lp[3] = r;
      }
      out[j] = l * g;
      out[j + 1] = r * g;
    }
    const shaped = path.join(tmp, "shaped.f32");
    fs.writeFileSync(shaped, Buffer.from(out.buffer));
    // Speech-band carve: keep the bed low-mid and out of the voice's presence range.
    const carve = ["highpass=f=32:poles=2", "equalizer=f=1200:t=q:w=0.9:g=-2", "equalizer=f=2800:t=q:w=1.1:g=-4", "highshelf=f=7000:g=-2"].join(",");
    const carved = path.join(tmp, "carved.wav");
    ff(["-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", shaped, "-af", carve, "-c:a", "pcm_f32le", carved]);
    // Gain to target, then one correction pass for the encoder's small shift.
    const encode = (gain) => ff(["-i", carved, "-af", `volume=${gain.toFixed(3)}dB`, "-c:a", "libmp3lame", "-b:a", "192k", "-ar", String(SR), OUT]);
    let gain = TARGET_LUFS - ebur128(carved).I;
    encode(gain);
    let f = ebur128(OUT);
    if (Math.abs(f.I - TARGET_LUFS) > 0.05) {
      gain += TARGET_LUFS - f.I;
      encode(gain);
      f = ebur128(OUT);
    }
    const info = { file: path.relative(root, OUT), duration: +probe(OUT).toFixed(3), total: now.total, lufs: f.I, lra: f.LRA, truePeak: f.peak };
    console.log(JSON.stringify(info));
    return info;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// audio.json: the bed, the sound marks and a suggested mix, all measured from the files.
async function manifest() {
  const { MARKS } = await import("../sfx/sfx.mjs");
  const now = edges();
  const plan = JSON.parse(fs.readFileSync(PLAN, "utf8"));
  const m = ebur128(OUT);
  const rel = (f) => path.relative(root, f);
  const peakRms = (file) => {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "astats=measure_perchannel=none", "-f", "null", "-"], { encoding: "utf8" }).stderr;
    return { peak: Number(r.match(/Peak level dB:\s+(-?[\d.]+)/)?.[1]), rms: Number(r.match(/RMS level dB:\s+(-?[\d.]+)/)?.[1]) };
  };
  const card = (id) => now.segs.find((s) => s.id === id);
  const VOL = { pencil: 0.25, bell: 0.4, keys: 0.4, whoosh: 0.3, seal: 0.45, page: 0.25, tick: 0.35, lock: 0.45 };
  const sfx = {};
  for (const [name, mk] of Object.entries(MARKS)) {
    const f = path.join(here, "../sfx", `${name}.mp3`);
    const { peak, rms } = peakRms(f);
    sfx[name] = { file: rel(f), duration: +probe(f).toFixed(3), peak_dbfs: +peak.toFixed(1), rms_db: +rms.toFixed(1), use: mk.use };
  }
  const json = {
    bed: {
      file: rel(OUT),
      duration: +probe(OUT).toFixed(3),
      lufs: m.I,
      true_peak_dbfs: m.peak,
      lra: m.LRA,
      fade_in: FADE_IN,
      fade_out: FADE_OUT,
      source: { model: plan.request.model_id, song_id: plan.songId, raw: rel(RAW), plan: rel(PLAN), script: rel(fileURLToPath(import.meta.url)) },
      sections: now.bounds.map(([a, b], i) => ({ name: CHUNKS[i].label, start: a, end: b })),
      turns: ["03", "11", "17", "21"].map((id) => ({ at: card(id).start, frame: id, swell: card(id).card ? "rises through the card, settles as the voice enters" : "dawn swell, then the resolve" })),
      baked: `Already carved: ${DUCK} dB duck under every spoken line (${ATTACK}s in, ${RELEASE}s out), +${LIFT} dB lift across each chapter card, a speech-band dip (-2 dB at 1.2 kHz, -4 dB at 2.8 kHz), and on the privacy beat F07 a low pass closing to ${PRIVACY.hz} Hz with ${PRIVACY.db} dB. Play it at a constant volume; do not add a second duck.`,
    },
    sfx,
    mix: {
      vo: 1.0,
      bed: 0.22,
      bed_range: [0.18, 0.25],
      sfx: VOL,
      sfx_range: [0.25, 0.5],
      notes: [
        "Bed at one constant volume: its duck, card lifts and privacy close-in are baked in.",
        "Sustained marks (pencil, page, whoosh) sit lower than the transients (keys, tick, lock, seal).",
        "Bell on each chapter card start; it is tuned to A, which sits in the bed's D major and B minor.",
        "Lock on the HUD padlock closing at F07, with seal as the privacy plate lands; the pair carries the privacy beat.",
      ],
    },
  };
  const out = path.join(here, "../audio.json");
  fs.writeFileSync(out, JSON.stringify(json, null, 2) + "\n");
  console.log(`wrote ${rel(out)}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const cmd = isMain ? process.argv[2] ?? "build" : null;
if (cmd) try {
  if (cmd === "plan") {
    const { bounds, total, trims, privacy } = edges();
    bounds.forEach(([a, b], i) => console.log(`${String(i).padStart(2)}  ${a.toFixed(3).padStart(8)}  ${b.toFixed(3).padStart(8)}  ${(b - a).toFixed(2).padStart(6)}s  ${CHUNKS[i].text.split("\n")[0]}`));
    for (const x of trims) console.log(`trim ${x.db > 0 ? "+" : ""}${x.db} dB  ${x.a} to ${x.b}`);
    console.log(`privacy close-in ${privacy.hz} Hz, ${privacy.db} dB  ${privacy.a} to ${privacy.b}`);
    console.log(`total ${total}s`);
  } else if (cmd === "generate") await generate();
  else if (cmd === "build") {
    build();
    await manifest();
  } else if (cmd === "manifest") await manifest();
  else throw new Error(`unknown command ${cmd}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
