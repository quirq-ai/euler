// Runs once as the server starts, before it answers anything (Next.js waits for it).
// On this machine it opens the database early, and when data/index.json is missing it
// waits for the stored index, so the first page shows it rather than an empty site
// (lib/db/sync.ts). The demo needs nothing here: it asks Neon on first use.
//
// INNERNET_DEMO_BUILD is written into the build by next.config.ts, so in a demo build
// the import below is dead code and is left out: the demo's functions never carry the
// database layer through this file (Vercel traces instrumentation into every one).

export async function register() {
  if (process.env.INNERNET_DEMO_BUILD === "1" || process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warmDb } = await import("./lib/db/sync");
  await warmDb();
}
