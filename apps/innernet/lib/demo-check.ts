import { DEMO_ORG, DEMO_ORG_URL } from "./mode";

// Is this index fit for the public demo? The same leak checks scripts/build-demo-index.ts
// applies before it writes data/demo/index.json, for an index that arrives another way:
// `pnpm db:store --demo` runs them before anything reaches Neon, `pnpm db:load --demo`
// before Neon's copy is written to the committed file, and the demo's server before it
// serves an index read from Neon.
//
//   - meta.demo is there and names the organization: a local index never qualifies
//   - every page's path, root and remote is under https://github.com/quirq-ai/
//   - no string anywhere (keys included, SVG logos decoded) holds /Users/, /private/var/,
//     /private/tmp/ or vscode://, or any of the names the caller passes: the CLI passes
//     this machine's own (its home folder, its user, this checkout, the demo's clone
//     cache; see scripts/db.ts), which the server has no business knowing
//
// No server-only, no Next imports and no file system, so the CLI can use it as is and
// the server's build traces nothing through it.

/** Text shapes that only ever name a machine, never a public repository. */
const MACHINE: [RegExp, string][] = [
  [/\/Users\//, "/Users/"],
  [/\/private\/(?:var|tmp)\//, "/private/"],
  [/vscode(?:-insiders)?:\/\//i, "vscode://"],
];

function walk(value: unknown, at: string, fn: (s: string, at: string) => void): void {
  if (typeof value === "string") fn(value, at);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${at}[${i}]`, fn));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      fn(k, `${at}.(key)`);
      walk(v, `${at}.${k}`, fn);
    }
  }
}

const under = (url: unknown) => typeof url === "string" && (url === DEMO_ORG_URL || url.startsWith(`${DEMO_ORG_URL}/`));

/**
 * Every reason this index may not be served by the demo, empty when it may. `names` are
 * extra strings to refuse (the CLI passes this machine's names). Problems name where they are,
 * never what the offending text says.
 */
export function demoIndexProblems(index: unknown, names: string[] = []): string[] {
  const problems: string[] = [];
  const add = (p: string) => {
    if (problems.length < 40) problems.push(p);
  };
  const idx = index as { meta?: Record<string, unknown>; pages?: unknown; disambiguation?: unknown } | null;
  if (!idx || typeof idx !== "object" || !idx.meta || !Array.isArray(idx.pages)) return ["not an index: meta or pages is missing"];

  const demo = idx.meta.demo as { org?: unknown; repos?: unknown } | undefined;
  if (!demo || typeof demo !== "object") return ["not a demo index: meta.demo is missing, and an index of this machine never goes to the demo"];
  if (demo.org !== DEMO_ORG) add(`meta.demo.org is not ${DEMO_ORG}`);
  if (!Array.isArray(demo.repos) || !demo.repos.length) add("meta.demo.repos is empty");
  else demo.repos.forEach((r, i) => !under((r as { url?: unknown }).url) && add(`meta.demo.repos[${i}].url is not under ${DEMO_ORG_URL}/`));
  const roots = idx.meta.roots;
  if (!Array.isArray(roots) || roots.some((r) => !under((r as { path?: unknown }).path))) add(`meta.roots are not under ${DEMO_ORG_URL}/`);

  for (const p of idx.pages as Record<string, unknown>[]) {
    const where = `pages[${typeof p?.slug === "string" ? p.slug : "?"}]`;
    if (!under(p?.path)) add(`${where}.path is not under ${DEMO_ORG_URL}/`);
    const git = p?.git as { remote?: unknown } | null | undefined;
    if (git && git.remote != null && !under(git.remote)) add(`${where}.git.remote is not under ${DEMO_ORG_URL}/`);
  }

  const banned = names.filter((n) => n.length >= 4);
  const check = (s: string, at: string) => {
    for (const [re, label] of MACHINE) if (re.test(s)) add(`${at} holds a machine path (${label})`);
    for (const n of banned) if (s.includes(n)) add(`${at} holds one of this machine's names`);
  };
  for (const [key, value] of Object.entries(idx)) {
    if (key === "pages") (value as Record<string, unknown>[]).forEach((p) => walk(p, `pages[${String(p?.slug)}]`, check));
    else walk(value, key, check);
  }
  // Logos travel as base64, which the walk cannot read. An SVG is text: decode and check it.
  for (const p of idx.pages as Record<string, unknown>[]) {
    const svg = typeof p?.logo === "string" ? p.logo.match(/^data:image\/svg\+xml;base64,(.*)$/)?.[1] : undefined;
    if (svg) check(Buffer.from(svg, "base64").toString("utf8"), `pages[${String(p.slug)}].logo`);
  }
  return problems;
}
