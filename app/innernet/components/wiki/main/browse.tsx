import Link from "next/link";
import { allCategories, browseGroups, type CategoryInfo } from "@/components/wiki/main/insights";
import { Box } from "@/components/wiki/main/section";
import { getIndex } from "@/lib/data";
import { num } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { categoryHref, wikiHref } from "@/lib/links";

/** A category link with its count set against a dotted leader, like a book's index. */
export function IndexEntry({ c, label }: { c: CategoryInfo; label?: string }) {
  return (
    <Link href={categoryHref(c.name)} className="group flex items-baseline gap-1.5 py-[3px] text-[14px] sm:gap-2 sm:text-[14.5px]">
      {c.kind === "language" && <span aria-hidden className="size-2 shrink-0 -translate-y-px rounded-full" style={{ background: langColor(c.subject) }} />}
      <span className="link min-w-0 truncate group-hover:underline">{label ?? c.name}</span>
      <span aria-hidden className="min-w-2 flex-1 -translate-y-[3px] border-b border-dotted border-line-strong sm:min-w-4" />
      <span className="shrink-0 text-[12.5px] tabular-nums text-muted">{num(c.count)}</span>
    </Link>
  );
}

const SHORT: Record<string, string> = { "Git repositories": "Repositories", "Document collections": "Documents", "Agent-ready projects": "Agent-ready" };
const shortLabel = (c: CategoryInfo) => (c.kind === "language" || c.kind === "year" ? c.subject : (SHORT[c.name] ?? c.name));

export function BrowseByCategory({ delay }: { delay?: number }) {
  const groups = browseGroups();
  return (
    <Box
      id="browse"
      title="Browse by category"
      delay={delay}
      action={
        <Link href={wikiHref("Special:Categories")} className="link">
          All {num(allCategories().length)} categories
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-10 md:grid-cols-3 lg:grid-cols-5">
        {groups.map((g) => (
          <div key={g.label} className="min-w-0">
            <h3 className="mb-2 font-display text-[21px] leading-none text-ink">{g.label}</h3>
            <ul>
              {g.items.map((c) => (
                <li key={c.name}>
                  <IndexEntry c={c} label={shortLabel(c)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Box>
  );
}

const AREAS = [
  { slug: "Special:Random", title: "Random article", text: "A page chosen by chance. The quickest way to rediscover something you made and forgot." },
  { slug: "Special:AllPages", title: "All pages", text: "Every article from A to Z, in one long and satisfying index." },
  { slug: "Special:Categories", title: "Categories", text: "Collections, languages, frameworks and eras: the same folders, sliced different ways." },
  { slug: "Special:Statistics", title: "Statistics", text: "Counts and languages, the biggest folders and the busiest repositories." },
];

export function OtherAreas({ delay }: { delay?: number }) {
  const { index } = getIndex();
  return (
    <Box id="areas" title="Other areas of Innerpedia" delay={delay}>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-6 sm:gap-x-10 lg:grid-cols-4">
        {AREAS.map((a) => (
          <li key={a.slug}>
            <Link href={wikiHref(a.slug)} className="link font-display text-[22px] leading-tight">
              {a.title}
            </Link>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{a.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-center font-serif text-[14.5px] italic text-muted">
        Innerpedia is written by your file system and edited by you. It holds {num(index.meta.counts.articles)} articles, and
        every one of them is yours.
      </p>
    </Box>
  );
}
