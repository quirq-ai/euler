import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Innernet makes no requests beyond its own origin (DESIGN.md, principle 5); the
// Content-Security-Policy holds the browser to that. Development also needs eval for
// React's debugging and a websocket for hot reload.
const dev = process.env.NODE_ENV !== "production";
// Quirq's Euler profile mounts a production build inside its own HTTP server.
// Keep that build separate so ordinary `next dev` / `next start` still use /.
const basePath = process.env.INNERNET_BASE_PATH || process.env.QUIRQ_BASE_PATH || "";
const distDir = process.env.INNERNET_DIST_DIR || process.env.QUIRQ_DIST_DIR || ".next";
if (basePath && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)) {
  throw new Error("QUIRQ_BASE_PATH must be a URL path without a trailing slash.");
}
if (!/^\.[a-zA-Z0-9._-]+$/.test(distDir) || distDir.includes("..")) {
  throw new Error("QUIRQ_DIST_DIR must be a hidden build directory inside Innernet.");
}
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// The guide's film, poster and captions present in public/guide when the app was built.
// A server function on Vercel cannot see public/ (it is served from the CDN), so the
// guide falls back on this list when it cannot find a file itself.
const guideMedia = (() => {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), "public", "guide"))
      .filter((f) => /\.(mp4|jpg|vtt)$/.test(f))
      .join(",");
  } catch {
    return "";
  }
})();

// The field guide (components/guide/source.ts) quotes these files of Innernet's own as
// it serves them, and counts the TypeScript files in its four component folders. It is
// bound into the home page, so "/" is the route that carries them.
const GUIDE_SOURCES = [
  "scripts/build-index.ts",
  "scripts/try-search.ts",
  "scripts/shot.mjs",
  "lib/types.ts",
  "lib/text.ts",
  "lib/normalize.ts",
  "lib/data.ts",
  "lib/search.ts",
  "lib/links.ts",
  "lib/activity.ts",
  "lib/db/*.ts",
  "app/page.tsx",
  "app/search/page.tsx",
  "app/wiki/*/page.tsx",
  "app/activity/page.tsx",
  "app/api/suggest/route.ts",
  "app/api/activity/route.ts",
  "app/api/db/store/route.ts",
  "app/globals.css",
  "components/sigil.tsx",
  "components/home/*.tsx",
  "components/search/*.{ts,tsx}",
  "components/wiki/**/*.{ts,tsx}",
  "components/guide/*.{ts,tsx}",
  "proxy.ts",
  "next.config.ts",
  "innernet.config.json",
  "DESIGN.md",
  "CONTRIBUTING.md",
];

// Whether this build is the demo (lib/mode.ts). Written into the build, so the demo
// does not depend on VERCEL reaching the deployed functions at run time.
const demoBuild = process.env.INNERNET_DEMO === "1" || process.env.VERCEL === "1";

// PGlite, the database on this machine (lib/db/pglite.ts): a WebAssembly Postgres that
// reads its own .wasm and data files from node_modules, so it is required at run time
// rather than bundled. The demo never opens it, so its server functions never carry it.
const PGLITE = "@electric-sql/pglite";
// Its files, and the link the build makes to them (.next/node_modules/@electric-sql/pglite-<hash>).
const PGLITE_FILES = [`node_modules/${PGLITE}/**`, `node_modules/${PGLITE}-*`, `node_modules/.pnpm/${PGLITE.replace("/", "+")}@*/**`];

// Turbopack's persistent cache (.next/cache) saves the whole environment the build ran
// in, and its files are world-readable. A build that can see the demo's connection
// string (DATABASE_URL, from .env.neon.local or Vercel) therefore keeps no such cache,
// so the string never lands on disk outside the file meant to hold it.
const secretInEnv = !!(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

const nextConfig: NextConfig = {
  basePath,
  distDir,
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: [PGLITE],
  experimental: {
    turbopackFileSystemCacheForBuild: !secretInEnv,
    turbopackFileSystemCacheForDev: !secretInEnv,
  },
  env: { INNERNET_GUIDE_MEDIA: guideMedia, INNERNET_DEMO_BUILD: demoBuild ? "1" : "", NEXT_PUBLIC_BASE_PATH: basePath },
  // What each server function carries when deployed: Vercel ships only traced files.
  // Every page reads the demo index, and the home page's field guide reads its sources
  // and plates. The local index, the film, its renders and the demo's clones never ship,
  // and nor does PGlite in a demo build.
  // (Turbopack matches these patterns anywhere below the project, not only at its top,
  // so they name files exactly rather than whole folders.)
  outputFileTracingIncludes: {
    "/**": ["data/demo/index.json"],
    // The home page alone. Turbopack matches each key anywhere inside an entry's name
    // ("app/page", "app/wiki/[slug]/page"), so a bare "/" would ship the guide with
    // every function; "app/page" names the home page's entry and no other.
    "app/page": [...GUIDE_SOURCES, "public/guide/plates/*.svg"],
  },
  outputFileTracingExcludes: {
    "/**": [
      "film/**",
      "brand/**",
      ".demo-cache/**",
      "data/index.json",
      "data/*.tmp",
      "data/demo/*.tmp",
      "public/guide/*.mp4",
      ...(demoBuild ? PGLITE_FILES : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Project logos (app/api/logo/[id]/route.ts): images only, so an SVG opened on
        // its own can load and run nothing. Listed last, so it replaces the policy above.
        source: "/api/logo/:id",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox" }],
      },
    ];
  },
};

export default nextConfig;
