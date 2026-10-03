import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { getPages } from "@/lib/data";
import { isRemote, sourceHref, wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";
import { article, descriptor, fullPath, placeText, remoteLink, splitTitle } from "./lead";
import { PathText } from "./parts";

// "See also" and "External links", the two lists that close an article.

/** One line about a page: its own summary when it has one, else what and where it is. */
export function gloss(p: Page): string {
  if (p.summary && p.summary !== p.agentNotes) {
    const first = p.summary.match(/^.{20,}?[.!?](?=\s|$)/)?.[0] ?? p.summary;
    return first.length > 140 ? first.slice(0, 138).replace(/\s+\S*$/, "") + "…" : first;
  }
  const d = descriptor(p);
  const where = placeText(p);
  const s = `${article(d)} ${d}${where ? ` ${where}` : ""}.`;
  return s[0].toUpperCase() + s.slice(1);
}

export function SeeAlso({ page }: { page: Page }) {
  const pages = getPages(page.related);
  if (!pages.length) return null;
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
      {pages.map((p) => {
        const [name, qualifier] = splitTitle(p.title);
        return (
          <li key={p.slug}>
            <Link href={wikiHref(p.slug)} className="group -mx-2.5 flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-bg-sunk">
              <PageSigil page={p} size={32} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] text-link group-hover:text-link-hover group-hover:underline group-hover:underline-offset-[3px]">
                  {name}
                  {qualifier && <span className="text-muted"> {qualifier}</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted [overflow-wrap:anywhere]">{gloss(p)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Arrow() {
  return (
    <svg aria-hidden width="11" height="11" viewBox="0 0 12 12" className="ml-1 inline-block align-[-1px] text-faint">
      <path d="M4 2.5h5.5V8M9.5 2.5 3 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExternalLinks({ page }: { page: Page }) {
  // In the demo the folder itself is on GitHub, and for a repository that is its remote.
  const onGitHub = isRemote(page.path);
  const remote = remoteLink(page.git?.remote ?? null);
  return (
    <ul className="space-y-2.5 font-serif text-[17px] leading-snug">
      <li className="flex gap-3">
        <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-faint" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {onGitHub ? (
            <a href={sourceHref(page.path)} target="_blank" rel="noopener noreferrer" className="link">
              View {page.name} on GitHub
              <Arrow />
            </a>
          ) : (
            <a href={sourceHref(page.path)} className="link">
              Open {page.name} in VS Code
            </a>
          )}
          <span className="text-muted">{onGitHub ? ", at " : ", on this machine at "}</span>
          <PathText path={fullPath(page)} className="text-[13px] text-ink-2" />
          {onGitHub && page.git?.branch && <span className="text-muted"> ({page.git.branch})</span>}
        </span>
      </li>
      {remote && remote.href !== page.path && (
        <li className="flex gap-3">
          <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-faint" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <a href={remote.href} target="_blank" rel="noopener noreferrer" className="link">
              {remote.label}
              <Arrow />
            </a>
            <span className="text-muted">, the Git remote{page.git?.branch ? ` (${page.git.branch})` : ""}</span>
          </span>
        </li>
      )}
    </ul>
  );
}
