// Sound marks for the Innernet field guide film.
//
//   node assets/audio/sfx/sfx.mjs generate [name ...]   render takes into sfx/takes/ (ElevenLabs, costs credits; TAKES=n env)
//   node assets/audio/sfx/sfx.mjs build                 cut the picked take of each mark into sfx/<name>.mp3
//
// build trims the leading silence (keeping a few ms of pre roll), cuts to the mark's length with
// a short fade so nothing clicks, and normalises the sample peak to -6 dBFS. Reads
// ELEVENLABS_API_KEY from .env and never prints it.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const TAKES = path.join(here, "takes");
const SR = 44100;
const PEAK_DB = -6;
const TAKE_COUNT = Number(process.env.TAKES || 2);

// take: which rendered take build uses (1-based). seconds: the final length.
export const MARKS = {
  pencil: {
    seconds: 1.6,
    take: 2,
    fadeIn: 0.05,
    use: "plate line work drawing on",
    text: "a single soft graphite pencil line drawn slowly across thick textured paper, close and intimate, quiet, dry room, no other sounds",
  },
  bell: {
    seconds: 2.5,
    take: 1,
    // Take 1 rings at G#6 (1662 Hz), a tritone against the bed's D major; tune it to A6.
    rate: 1760 / 1662.2,
    fade: 0.9,
    use: "chapter cards",
    text: "a single soft distant chime, one small bell struck gently, warm and pure, long gentle decay, calm, no music",
  },
  keys: {
    seconds: 1.4,
    take: 2,
    use: "typing a query or a command",
    text: "four quiet mechanical keyboard keystrokes, soft and unhurried, close, dry room, no other sounds",
  },
  whoosh: {
    seconds: 0.7,
    take: 1,
    use: "plate cuts",
    text: "a soft airy whoosh, gentle breath of air passing by, subtle and smooth, no tone, no impact",
  },
  seal: {
    seconds: 0.9,
    take: 1,
    // Take 1 is one low thump, then a second tap at 0.42 s; keep the first only. Its right
    // channel is polarity inverted (L/R correlation -0.87), which hollows it out and cancels in mono.
    keep: 0.4,
    flipRight: true,
    use: "a stamp or seal landing (privacy plate, the close)",
    text: "a single soft muffled thud, a rubber stamp pressed firmly onto paper on a wooden desk, one low gentle impact, close and dry, nothing else",
  },
  page: {
    seconds: 1.0,
    take: 2,
    fadeIn: 0.06,
    use: "camera pans across the sheet",
    text: "a single sheet of paper sliding softly across a wooden desk, quick and gentle, no crinkle",
  },
  tick: {
    seconds: 0.25,
    take: 1,
    // Every take holds several ticks over a floor 33 dB down; gate on the first tick, keep only it.
    gate: -15,
    keep: 0.1,
    use: "the index counter ticking 958 to 959",
    text: "a single tiny soft mechanical tick, like a small counter wheel clicking once, quiet and precise",
  },
  lock: {
    seconds: 0.8,
    take: 1,
    use: "the HUD padlock closing at F07 (private by design)",
    text: "a small brass padlock clicking shut, one soft precise click, quiet and close, no rattle",
  },
};

function key() {
  const envFile = path.join(root, ".env");
  const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const k = process.env.ELEVENLABS_API_KEY || env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!k) throw new Error("No ELEVENLABS_API_KEY in .env");
  return k;
}

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 28 });
export const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

async function generate(names) {
  const k = key();
  fs.mkdirSync(TAKES, { recursive: true });
  for (const name of names) {
    const m = MARKS[name];
    if (!m) throw new Error(`unknown mark ${name}`);
    // Render a little long so trimming the lead-in still leaves the full length.
    const duration_seconds = Math.max(0.5, +(m.seconds + 0.3).toFixed(2));
    for (let n = 1; n <= TAKE_COUNT; n++) {
      const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192", {
        method: "POST",
        headers: { "xi-api-key": k, "Content-Type": "application/json" },
        body: JSON.stringify({ text: m.text, duration_seconds, prompt_influence: 0.55, model_id: "eleven_text_to_sound_v2" }),
      });
      if (!res.ok) throw new Error(`${name} take ${n}: POST /v1/sound-generation -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const out = path.join(TAKES, `${name}-${n}.mp3`);
      fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
      console.log(`${path.relative(root, out)}  ${probe(out).toFixed(2)}s`);
    }
  }
}

function decode(file, rate = 1) {
  const af = rate === 1 ? [] : ["-af", `asetrate=${(SR * rate).toFixed(2)},aresample=${SR}`];
  const buf = ff(["-i", file, ...af, "-ac", "2", "-ar", String(SR), "-f", "f32le", "-"]);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export function cut(src, seconds, out, { rate = 1, keep = seconds, fade: fadeOut, fadeIn: fadeInS = 0.002, gate: gateDb = -40, flipRight = false } = {}) {
  const pcm = decode(src, rate);
  if (flipRight) for (let i = 1; i < pcm.length; i += 2) pcm[i] = -pcm[i];
  const frames = pcm.length / 2;
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  if (peak === 0) throw new Error(`${src} is silent`);
  // First frame within gateDb of the peak, less 6 ms of pre roll.
  const gate = peak * Math.pow(10, gateDb / 20);
  let first = 0;
  while (first < frames && Math.max(Math.abs(pcm[first * 2]), Math.abs(pcm[first * 2 + 1])) < gate) first++;
  const start = Math.max(0, first - Math.round(0.006 * SR));
  const len = Math.round(seconds * SR);
  const end = Math.round(keep * SR); // content stops here; silence after
  const fade = Math.round((fadeOut ?? Math.min(0.12, keep * 0.2)) * SR);
  const fadeIn = Math.max(1, Math.round(fadeInS * SR));
  const outPcm = new Float32Array(len * 2);
  let outPeak = 0;
  for (let i = 0; i < len; i++) {
    let g = 1;
    if (i < fadeIn) g *= Math.sin((i / fadeIn) * (Math.PI / 2)) ** 2;
    if (i >= end) g = 0;
    else if (i > end - fade) g *= Math.sin(((end - i) / fade) * (Math.PI / 2)) ** 2;
    for (let c = 0; c < 2; c++) {
      const v = (pcm[(start + i) * 2 + c] ?? 0) * g;
      outPcm[i * 2 + c] = v;
      outPeak = Math.max(outPeak, Math.abs(v));
    }
  }
  const gain = Math.pow(10, PEAK_DB / 20) / outPeak;
  for (let i = 0; i < outPcm.length; i++) outPcm[i] *= gain;
  const tmp = out + ".f32";
  fs.writeFileSync(tmp, Buffer.from(outPcm.buffer));
  try {
    ff(["-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", tmp, "-c:a", "libmp3lame", "-b:a", "192k", out]);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return { lead: +(start / SR).toFixed(3) };
}

function build() {
  for (const [name, m] of Object.entries(MARKS)) {
    const src = path.join(TAKES, `${name}-${m.take}.mp3`);
    if (!fs.existsSync(src)) throw new Error(`missing ${path.relative(root, src)}; run generate ${name}`);
    const out = path.join(here, `${name}.mp3`);
    const { lead } = cut(src, m.seconds, out, { rate: m.rate, keep: m.keep, fade: m.fade, fadeIn: m.fadeIn, gate: m.gate, flipRight: m.flipRight });
    console.log(`${name.padEnd(7)} take ${m.take}  trimmed ${lead}s lead  ->  ${path.relative(root, out)} ${probe(out).toFixed(3)}s`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd = "build", ...rest] = process.argv.slice(2);
  try {
    if (cmd === "generate") await generate(rest.length ? rest : Object.keys(MARKS));
    else if (cmd === "build") build();
    else throw new Error(`unknown command ${cmd}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
