// Preview a plate the way the film and the guide colour it: ink on paper and paper on
// night, accent in link blue, plus a mid-draw state (construction and main layers only).
//
//   node scripts/plate-preview.mjs <id> [out.png]
// Writes a 1600x2000 PNG (paper on top, night below) and prints its path.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];
if (!id) {
  console.error("usage: node scripts/plate-preview.mjs <id> [out.png]");
  process.exit(1);
}
const svg = fs.readFileSync(path.join(root, "assets/plates", `${id}.svg`), "utf8");
const out = path.resolve(process.argv[3] ?? path.join(root, ".hyperframes/plates", `${id}.png`));
fs.mkdirSync(path.dirname(out), { recursive: true });
const fonts = path.join(root, "assets/fonts");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Instrument Serif";src:url(${fonts}/instrument-serif-normal-400.woff2)}
@font-face{font-family:"Newsreader";src:url(${fonts}/newsreader-italic-var.woff2);font-style:italic;font-weight:200 800}
@font-face{font-family:"JetBrains Mono";src:url(${fonts}/jetbrains-mono-normal-var.woff2);font-weight:100 800}
body{margin:0;width:1600px}
.p{width:1600px;height:1000px;position:relative}
.paper{background:#f7f5f0;color:#1c1b18}.night{background:#0f0f0e;color:#eceae3}
.p svg{width:1600px;height:1000px;display:block}
.p .L-con{opacity:.42}.p .L-det{opacity:.8}
.paper .L-acc{color:#2a52c4}.night .L-acc{color:#9db6ff}
.paper .L-lbl{color:#46433c}.night .L-lbl{color:#c8c5bb}
</style></head><body><div class="p paper">${svg}</div><div class="p night">${svg}</div></body></html>`;

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "plate-")), "p.html");
fs.writeFileSync(tmp, html);
const shells = path.join(os.homedir(), "Library/Caches/ms-playwright");
const bin = fs
  .readdirSync(shells)
  .filter((d) => d.startsWith("chromium_headless_shell-"))
  .sort()
  .map((d) => {
    const sub = fs.readdirSync(path.join(shells, d)).find((s) => s.startsWith("chrome-headless-shell"));
    return path.join(shells, d, sub, "chrome-headless-shell");
  })
  .at(-1);
execFileSync(bin, ["--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--window-size=1600,2000", "--virtual-time-budget=2500", `--screenshot=${out}`, `file://${tmp}`], { stdio: "ignore" });
console.log(out);
