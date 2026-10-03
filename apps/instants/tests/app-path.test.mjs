import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";

function paths(basePath) {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { appPath } from './lib/app-path.mjs';
    console.log(JSON.stringify([
      '/', '/api/session', '/work/example.svg', '/motion?view=1#demo',
      '/app/instants/api/session', 'https://example.com/photo.png',
      '//example.com/photo.png', 'data:image/png;base64,abc', 'blob:example'
    ].map(appPath)));
  `], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath },
    encoding: "utf8",
  }));
}

test("mounted URLs stay under the app while external media remains unchanged", () => {
  assert.deepEqual(paths("/app/instants"), [
    '/app/instants/', '/app/instants/api/session', '/app/instants/work/example.svg',
    '/app/instants/motion?view=1#demo', '/app/instants/api/session',
    'https://example.com/photo.png', '//example.com/photo.png',
    'data:image/png;base64,abc', 'blob:example',
  ]);
});

test("independent builds preserve their original root URLs", () => {
  assert.deepEqual(paths("").slice(0, 4), [
    '/', '/api/session', '/work/example.svg', '/motion?view=1#demo',
  ]);
});
