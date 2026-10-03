import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const basePath = (process.env.INSTANTS_BASE_PATH || process.env.QUIRQ_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath,
  distDir: process.env.INSTANTS_DIST_DIR || process.env.QUIRQ_DIST_DIR || ".next",
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Keep nested local checkouts and Vercel builds scoped to this repository.
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  // A local build must never package someone's private activity journals.
  outputFileTracingExcludes: { "/*": ["./session/**/*"] },
};

export default nextConfig;
