// What the database layer says, and how it keeps a secret out of what it says.
//
// A database that fails must never break a page, so every failure is caught and told
// here instead, once per process for each kind of trouble. Messages pass through
// `redact` on the way out: the demo's connection string, its password and any
// postgres:// address become "[database url]", whatever an error chose to quote.

const G = globalThis as typeof globalThis & { __innernetDbLog?: { told: Set<string>; quiet: boolean } };
const state = (G.__innernetDbLog ??= { told: new Set(), quiet: false });

/** The text with every database address and password taken out. */
export function redact(text: string): string {
  let out = text;
  for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
    const url = process.env[name];
    if (!url) continue;
    out = out.split(url).join("[database url]");
    try {
      const pass = decodeURIComponent(new URL(url).password);
      if (pass.length >= 6) out = out.split(pass).join("[redacted]");
    } catch {
      /* not a URL: nothing more to find */
    }
  }
  return out.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[database url]");
}

/** An error's message, redacted and on one line. */
export function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return redact(raw).replace(/\s+/g, " ").trim().slice(0, 300) || "unknown error";
}

/** Silence the server's notes (the CLI says things its own way). */
export function quietDb(quiet = true): void {
  state.quiet = quiet;
}

export function say(message: string): void {
  if (!state.quiet) console.warn(`[innernet db] ${redact(message)}`);
}

/** Say it the first time only: a failing database is reported once, not on every request. */
export function sayOnce(key: string, message: string): void {
  if (state.told.has(key)) return;
  state.told.add(key);
  say(message);
}
