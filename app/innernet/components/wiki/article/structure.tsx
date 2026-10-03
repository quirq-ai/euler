import Link from "next/link";
import { sigilGradient } from "@/components/sigil";
import { getIndex, getPages } from "@/lib/data";
import { num, plural } from "@/lib/format";
import { wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";
import { count, shortKind } from "./lead";
import { Sub } from "./parts";

// A folder's insides as a tidy tree: subfolders with their share of the files,
// what was left out of the index, and the files that sit at the top.

const SHOWN = 24;

function Row({ child, max }: { child: Page; max: number }) {
  // Square-root scale, so one giant sibling doesn't flatten the rest into dots.
  const share = max > 0 && child.totalFiles > 0 ? Math.max(0.04, Math.sqrt(child.totalFiles / max)) : 0;
  return (
    <li className="relative pl-6 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-line-strong last:before:bottom-1/2 after:absolute after:left-0 after:top-1/2 after:h-px after:w-3.5 after:bg-line-strong">
      {/* The name's link covers the whole row, so the row is the target. */}
      <div className="relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-[7px] transition-colors hover:bg-bg-sunk">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: sigilGradient(child.slug, !child.isArticle) }} />
        <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
          <Link href={wikiHref(child.slug)} className="link truncate font-mono text-[13.5px] before:absolute before:inset-0 before:rounded-lg before:content-['']">
            {child.name}
          </Link>
          <span className="hidden shrink-0 text-[12.5px] text-muted sm:inline">{shortKind(child)}</span>
        </span>
        <span aria-hidden className="hidden h-[3px] w-14 shrink-0 overflow-hidden rounded-full bg-bg-sunk sm:block">
          <span className="block h-full rounded-full bg-muted/55" style={{ width: `${share * 100}%` }} />
        </span>
        <span className="w-[88px] shrink-0 whitespace-nowrap text-right font-mono text-[12px] tabular-nums text-muted">
          {child.totalFiles ? plural(child.totalFiles, "file") : <span className="font-sans italic">empty</span>}
        </span>
      </div>
    </li>
  );
}

function More({ count, noun, children }: { count: number; noun: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="mt-2 inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-0 text-[13.5px] text-link hover:text-link-hover [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">and {num(count)} more {noun}</span>
        <span className="hidden group-open:inline">Show fewer</span>
        <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="transition-transform group-open:rotate-180">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      {children}
    </details>
  );
}

export function FolderTree({ page, limit = SHOWN }: { page: Page; limit?: number }) {
  const kids = getPages(page.children);
  if (!kids.length) return null;
  const max = Math.max(...kids.map((k) => k.totalFiles));
  const cut = kids.length > limit + 4 ? limit : kids.length;
  const head = kids.slice(0, cut);
  const rest = kids.slice(cut);
  return (
    <div>
      <ul className="ml-1">
        {head.map((c) => (
          <Row key={c.slug} child={c} max={max} />
        ))}
      </ul>
      {rest.length > 0 && (
        <More count={rest.length} noun={rest.length === 1 ? "folder" : "folders"}>
          <ul className="ml-1 mt-1">
            {rest.map((c) => (
              <Row key={c.slug} child={c} max={max} />
            ))}
          </ul>
        </More>
      )}
    </div>
  );
}

export function FileList({ page }: { page: Page }) {
  if (!page.files.length) return null;
  const unseen = page.fileCount - page.files.length;
  const wide = page.files.some((f) => f.length > 24);
  return (
    <div>
      <ul className={`grid gap-x-6 gap-y-[5px] font-mono text-[12.5px] text-ink-2 ${wide ? "grid-cols-1 min-[420px]:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {page.files.map((f) => (
          <li key={f} className="flex min-w-0 items-center gap-2" title={f}>
            <span aria-hidden className="size-1 shrink-0 rounded-full bg-faint" />
            <span className="truncate">{f}</span>
          </li>
        ))}
      </ul>
      {unseen > 0 && <p className="mt-2.5 text-[13px] text-muted">and {plural(unseen, "more file")} not listed here.</p>}
    </div>
  );
}

export function Excluded({ page }: { page: Page }) {
  if (!page.hiddenChildren.length) return null;
  const names = page.hiddenChildren;
  return (
    <p className="mt-4 text-[13px] text-muted">
      {names.map((n, i) => (
        <span key={n}>
          {i > 0 && (i === names.length - 1 ? " and " : ", ")}
          <code className="font-mono text-[12px] text-ink-2">{n}</code>
        </span>
      ))}{" "}
      {names.length === 1 ? "is" : "are"} left out of the index.
    </p>
  );
}

/** Subfolders past the indexer's depth limit: named and counted, without pages. */
export function Deeper({ page }: { page: Page }) {
  const d = page.deeper;
  if (!d) return null;
  const shown = d.names.slice(0, SHOWN);
  return (
    <div className="mt-4">
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((n) => (
          <li key={n} className="max-w-full truncate rounded-md bg-bg-sunk px-1.5 py-0.5 font-mono text-[12px] text-ink-2">
            {n}
          </li>
        ))}
        {d.names.length > shown.length && <li className="px-1 py-0.5 text-[12.5px] text-muted">and {num(d.names.length - shown.length)} more</li>}
      </ul>
      <p className="mt-2.5 text-[13px] text-muted">
        Past the {count(getIndex().index.meta.maxDepth)} levels Innerpedia reads: {plural(d.folders, "folder")} and {plural(d.files, "file")}, counted
        but without pages of their own.
      </p>
    </div>
  );
}

/** The article's Structure section body. */
export function Structure({ page }: { page: Page }) {
  const kids = page.children.length;
  return (
    <>
      {kids + (page.deeper?.names.length ?? 0) > 0 && (
        <Sub label="Folders" aside={plural(kids + (page.deeper?.names.length ?? 0), "subfolder")}>
          <FolderTree page={page} />
          <Deeper page={page} />
          <Excluded page={page} />
        </Sub>
      )}
      {kids + (page.deeper?.names.length ?? 0) === 0 && <Excluded page={page} />}
      {page.files.length > 0 && (
        <Sub label="Files" aside={`${plural(page.fileCount, "file")} at the top level`}>
          <FileList page={page} />
        </Sub>
      )}
    </>
  );
}

export { More };
