import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  // Keep nested local checkouts and Vercel builds scoped to this repository.
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  // A local build must never package someone's private activity journals.
  outputFileTracingExcludes: { "/*": ["./session/**/*"] },
};

export default nextConfig;
