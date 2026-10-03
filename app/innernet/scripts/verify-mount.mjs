import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const basePath = process.env.INNERNET_BASE_PATH || "/app/innernet";
process.env.NODE_ENV = "production";
process.env.INNERNET_BASE_PATH = basePath;
process.env.INNERNET_DIST_DIR ||= ".next-euler";
process.env.INNERNET_PROJECT_ROOT = project;
process.env.INNERNET_DB = "off";

// Exercise the real custom handler from outside the app's working directory.
process.chdir(path.dirname(project));
const require = createRequire(path.join(project, "package.json"));
const app = require("next")({ dev: false, dir: project, hostname: "127.0.0.1" });
let server;
let checks = 0;
try {
  await app.prepare();
  const handle = app.getRequestHandler();
  server = createServer((req, res) => handle(req, res));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = async (route, status = 200) => {
    const response = await fetch(origin + basePath + route, { redirect: "manual" });
    assert.equal(response.status, status, route);
    checks++;
    return response;
  };
  const home = await get("");
  const html = await home.text();
  assert.match(html, /Innernet/);
  const resources = [...html.matchAll(/(?:src|href|action)="(\/[^\"]*)"/g)].map((match) => match[1]);
  const outside = resources.filter((url) => !["/", "?", "#"].some((suffix) => url.startsWith(basePath + suffix)) && url !== basePath);
  assert.deepEqual(outside, [], "all page resources and links must remain under the mount");
  checks++;
  for (const resource of [...new Set(resources.filter((url) => url.includes("/_next/")))]) {
    const response = await fetch(origin + resource);
    assert.equal(response.status, 200, resource);
    checks++;
  }
  for (const route of ["/wiki", "/wiki/Special%3AAllPages", "/search?q=quirq", "/activity", "/icon.svg", "/apple-icon", "/guide/innernet-explainer.vtt"]) await get(route);
  const guide = await get("/guide", 308);
  assert.equal(guide.headers.get("location"), basePath + "/#guide");
  const search = await get("/search", 307);
  assert.equal(search.headers.get("location"), basePath + "/");
  const suggestions = await get("/api/suggest?q=quirq");
  assert.match(suggestions.headers.get("content-type"), /application\/json/);
  const mutations = ["/api/activity", "/api/db/store"];
  if (existsSync(path.join(project, "app", "api", "sources", "sync", "route.ts"))) mutations.push("/api/sources/sync");
  for (const endpoint of mutations) {
    const response = await fetch(origin + basePath + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://unrelated.invalid" },
      body: "{}",
    });
    assert.equal(response.status, 403, endpoint + " must retain its origin guard");
    checks++;
  }
  console.log(`Innernet mounted production checks passed (${checks} checks).`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await app.close();
}
