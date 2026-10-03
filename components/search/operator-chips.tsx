import Link from "next/link";
import { searchHref } from "@/lib/links";
import type { ParsedQuery, Tab } from "@/lib/search";
import { OP_LABEL, withoutOperator, withoutOperators, type OpKey } from "./query-tools";

// Operators in the query (lang:rust, in:experiments...) shown as removable chips.
// Each chip is a link to the same search without it; removing the last one with no
// words left goes home.

export function OperatorChips({ query, tab }: { query: ParsedQuery; tab: Tab }) {
  const ops = Object.entries(query.filters) as [OpKey, string][];
  if (!ops.length) return null;
  const href = (q: string) => (q ? searchHref(q, { t: tab === "all" ? undefined : tab }) : "/");

  return (
    <ul aria-label="Search operators" className="flex flex-wrap items-center gap-2">
      {ops.map(([key, value]) => (
        <li key={key} className="max-w-full">
          <Link
            href={href(withoutOperator(query.raw, key))}
            aria-label={`Remove ${key}:${value}`}
            title={`Remove the ${OP_LABEL[key].toLowerCase()} filter, ${key}:${value}`}
            className="group inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface pl-3 pr-1.5 shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong hover:bg-bg-sunk"
          >
            <span className="min-w-0 truncate font-mono text-[12.5px]">
              <span className="text-muted">{key}:</span>
              <span className="text-ink">{value}</span>
            </span>
            <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full text-muted transition-colors group-hover:bg-line-strong group-hover:text-ink">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </span>
          </Link>
        </li>
      ))}
      {ops.length > 1 && (
        <li>
          <Link href={href(withoutOperators(query.raw))} className="inline-flex h-8 items-center px-1.5 text-[12.5px] text-muted hover:text-ink">
            Clear filters
          </Link>
        </li>
      )}
    </ul>
  );
}
