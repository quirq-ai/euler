import Link from "next/link";
import { searchHref } from "@/lib/links";
import type { Page } from "@/lib/types";

// A quiet line of operator examples, so the syntax is learnt by clicking rather than
// reading. Each is shown only when this index has something for it to find.

const EXAMPLES: { op: string; value: string; finds: (p: Page) => boolean }[] = [
  { op: "kind", value: "repo", finds: (p) => p.kind === "repo" },
  { op: "lang", value: "rust", finds: (p) => p.languages.slice(0, 3).some((l) => l.name === "Rust") },
  { op: "in", value: "experiments", finds: (p) => p.relPath.toLowerCase().split(/[\\/]/).slice(0, -1).includes("experiments") },
  { op: "fw", value: "next", finds: (p) => p.frameworks.includes("Next.js") },
];

export function ExampleQueries({ pages }: { pages: Page[] }) {
  const shown = EXAMPLES.filter((e) => pages.some(e.finds));
  if (!shown.length) return null;
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-1 gap-y-1 text-[13px] text-muted">
      <span className="mr-1">Try</span>
      {shown.map((e, i) => (
        <Link
          key={e.op}
          href={searchHref(`${e.op}:${e.value}`)}
          className={`-my-1.5 rounded-md px-1.5 py-2 font-mono text-[12.5px] transition-colors hover:bg-bg-sunk ${i >= 3 ? "hidden sm:inline" : ""}`}
        >
          <span className="text-muted">{e.op}:</span>
          <span className="text-ink-2">{e.value}</span>
        </Link>
      ))}
    </p>
  );
}
