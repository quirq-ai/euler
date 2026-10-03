// Headless screenshot of a running page, taken once it has settled: fonts loaded and
// every finite animation (the staggered `rise`) finished. Drives chrome-headless-shell
// over the DevTools protocol, because its --screenshot flag fires mid-animation.
// CHROME_BIN overrides the browser; SHOT_SCALE=2 captures at 2x pixel density;
// SHOT_BASE points it at another server (default http://localhost:3470); SHOT_SCROLL
// scrolls the window first, to a number of pixels or to an element (`#guide`).
//
//   node scripts/shot.mjs <url-path> <out.png> [width] [height] [light|dark]
//
// Prints the document size, and flags horizontal overflow with the elements causing it.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [route = "/", out = "shot.png", w = "1440", h = "1000", scheme = "light"] = process.argv.slice(2);
const width = Number(w);
const height = Number(h);
const base = (process.env.SHOT_BASE || "http://localhost:3470").replace(/\/$/, "");
const scrollTo = process.env.SHOT_SCROLL || "";

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const shells = fs.existsSync(cache)
    ? fs
        .readdirSync(cache)
        .filter((d) => d.startsWith("chromium_headless_shell-"))
        .sort()
        .flatMap((d) => fs.readdirSync(path.join(cache, d)).filter((s) => s.startsWith("chrome-headless-shell")).map((s) => path.join(cache, d, s, "chrome-headless-shell")))
        .filter((f) => fs.existsSync(f))
    : [];
  return shells.at(-1) ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "innernet-shot-"));
const chrome = spawn(findChrome(), ["--headless", "--remote-debugging-port=0", `--user-data-dir=${userDir}`, "--disable-gpu", "--hide-scrollbars", `--window-size=${width},${height}`, "about:blank"], {
  stdio: "ignore",
});

function cleanup(code) {
  chrome.once("exit", () => {
    try {
      fs.rmSync(userDir, { recursive: true, force: true });
    } catch {
      /* chrome still letting go of a file; the OS clears tmp */
    }
    process.exit(code);
  });
  chrome.kill();
}
setTimeout(() => {
  console.error("shot: timed out");
  cleanup(1);
}, 30_000).unref();

// Chrome writes the port it picked to DevToolsActivePort.
let port = null;
for (let i = 0; i < 100 && !port; i++) {
  try {
    port = fs.readFileSync(path.join(userDir, "DevToolsActivePort"), "utf8").split("\n")[0];
  } catch {
    await sleep(50);
  }
}
let target = null;
for (let i = 0; i < 50 && !target; i++) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  } catch {
    await sleep(100);
  }
}
if (!target) {
  console.error("shot: could not reach chrome");
  cleanup(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const waiters = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method && waiters.has(m.method)) {
    waiters.get(m.method)();
    waiters.delete(m.method);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const once = (event) => new Promise((r) => waiters.set(event, r));
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: Number(process.env.SHOT_SCALE || 1), mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme === "dark" ? "dark" : "light" }] });
const loaded = once("Page.loadEventFired");
await send("Page.navigate", { url: `${base}${route}` });
await Promise.race([loaded, sleep(10_000)]);

// Settle: fonts loaded and every animation that ends finished (the aurora drifts
// forever, and motion tied to scrolling never finishes, so both are skipped). Headless
// Chrome draws only when asked, and a composited fade that is never drawn while it runs
// stays half-faded in the capture, so keep asking for frames until everything has landed.
const settled = `document.fonts.status === "loaded" && document.getAnimations().every((a) => !(a.timeline instanceof DocumentTimeline) || a.effect?.getComputedTiming().endTime === Infinity || a.playState === "finished")`;
const frame = () => send("Page.captureScreenshot", { format: "jpeg", quality: 1 });
const settle = async (ms) => {
  for (let t = Date.now(); Date.now() - t < ms; ) {
    await frame();
    if (await evaluate(settled)) break;
    await sleep(40);
  }
  await frame();
  await sleep(100);
};
await settle(5000);
// The top of the page, unless asked otherwise, even if focus scrolled the window.
if (!scrollTo) await evaluate(`window.scrollTo({ top: 0, behavior: "instant" })`);
if (scrollTo) {
  // Instant, so smooth scrolling on the page cannot leave the capture mid-way.
  await evaluate(`(() => {
    const y = ${JSON.stringify(scrollTo)};
    const el = /^\\d+$/.test(y) ? null : document.querySelector(y);
    window.scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY : Number(y), behavior: "instant" });
  })()`);
  await sleep(150);
  await settle(4000);
}

// The window is as tall as the shot, so the capture stays inside the viewport. Chrome's
// beyond-viewport capture redraws composited animations from a stale frame.
const size = await evaluate(`({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, y: scrollY })`);
const shot = await send("Page.captureScreenshot", {
  format: "png",
  clip: { x: 0, y: size.y, width, height: Math.min(height, size.h - size.y), scale: 1 },
});
fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(`${out}  doc ${size.w}x${size.h}${size.w > width ? "  HORIZONTAL OVERFLOW" : ""}`);
if (size.w > width) {
  // Name the outermost elements that stick out, so the culprit is easy to find.
  const culprits = await evaluate(`[...document.querySelectorAll("body *")]
    .filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !(e.parentElement?.getBoundingClientRect().right > innerWidth + 1))
    .slice(0, 6)
    .map((e) => e.tagName.toLowerCase() + "." + String(e.className).split(" ").slice(0, 6).join(".") + "  right=" + Math.round(e.getBoundingClientRect().right))`);
  for (const c of culprits ?? []) console.log("  " + c);
}
ws.close();
cleanup(0);
