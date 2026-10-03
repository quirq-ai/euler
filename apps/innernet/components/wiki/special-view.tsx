import Link from "next/link";
import { IndexEntry } from "@/components/wiki/main/browse";
import { allCategories, letterGroups, type CategoryKind } from "@/components/wiki/main/insights";
import { LetterColumns } from "@/components/wiki/main/letter-columns";
import { PageTitle, SectionHeading } from "@/components/wiki/main/section";
import { StatisticsView } from "@/components/wiki/main/statistics";
import { getIndex } from "@/lib/data";
import { num, plural } from "@/lib/format";
import { wikiHref } from "@/lib/links";

// Special: pages, the ones Innerpedia writes about itself. Special:Random is handled
// by the route (it redirects before rendering).

const SPECIALS = [
  { name: "Random", title: "Random article", text: "Takes you to an article chosen by chance." },
  { name: "AllPages", title: "All pages", text: "Every article from A to Z, with a letter index." },
  { name: "Categories", title: "Categories", text: "Every category, grouped by what it collects." },
  { name: "Statistics", title: "Statistics", text: "Counts, languages, activity, and the biggest and busiest folders." },
];

export function SpecialView({ name }: { name: string }) {
  const key = name.toLowerCase().replace(/[\s_]/g, "");
  if (key === "allpages") return <AllPages />;
  if (key === "statistics") return <StatisticsView />;
  if (key === "categories") return <Categories />;
  return <Unknown name={name} />;
}

function AllPages() {
  const { articles, index } = getIndex();
  const groups = letterGroups(articles);
  const letters = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
  const present = new Map(groups.map((g) => [g.letter, g.pages.length]));

  return (
    <main>
      <PageTitle prefix="Special: " title="All pages" />
      <p className="rise mt-6 max-w-[720px] font-serif text-[18px] leading-[1.68] text-ink" style={{ animationDelay: "40ms" }}>
        Every article in Innerpedia, from A to Z: {plural(articles.length, "article")}. Stubs are left out; there are{" "}
        {num(index.meta.counts.stubs)} of those, one for each folder without a project of its own.
      </p>

      <nav
        aria-label="Jump to letter"
        className="rise sticky top-16 z-30 mt-8 border-y border-line bg-bg/90 py-2 backdrop-blur-md"
        style={{ animationDelay: "80ms" }}
      >
        {/* One scrolling line on a phone, so the bar never eats the screen; wraps from md up. */}
        <ul className="-ml-1 flex gap-x-0.5 overflow-x-auto pr-10 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:-ml-1.5 md:flex-wrap md:gap-y-1 md:overflow-visible md:pr-0 md:[mask-image:none]">
          {letters.map((l) => {
            const n = present.get(l);
            const text = l === "#" ? "0-9" : l;
            return (
              <li key={l} className="shrink-0">
                {n ? (
                  <a
                    href={`#letter-${l === "#" ? "0" : l}`}
                    title={`${text}: ${plural(n, "article")}`}
                    className="grid h-8 min-w-7 place-items-center rounded-md px-1 font-display text-[18px] leading-none text-link transition-colors hover:bg-bg-sunk hover:text-link-hover lg:min-w-8 lg:px-1.5 lg:text-[19px]"
                  >
                    {text}
                  </a>
                ) : (
                  <span aria-hidden className="grid h-8 min-w-7 place-items-center px-1 font-display text-[18px] leading-none text-faint/60 lg:min-w-8 lg:px-1.5 lg:text-[19px]">
                    {text}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="rise mt-8" style={{ animationDelay: "120ms" }}>
        <LetterColumns groups={groups} dense anchors level={2} />
      </div>
    </main>
  );
}

const GROUPS: { kind: CategoryKind; title: string; text: string }[] = [
  { kind: "collection", title: "Collections", text: "Folders that hold three or more articles." },
  { kind: "language", title: "Languages", text: "By each project’s leading programming language." },
  { kind: "framework", title: "Frameworks", text: "Spotted in manifests and dependencies." },
  { kind: "kind", title: "Kinds", text: "Repositories, documents, and projects ready for agents." },
  { kind: "year", title: "Eras", text: "By the year a project was begun." },
  { kind: "part", title: "Parts of projects", text: "Projects whose packages, apps and services have pages of their own." },
  { kind: "maintenance", title: "Maintenance", text: "Lists of articles that could use some help." },
];

function Categories() {
  const all = allCategories();
  return (
    <main className="max-w-[1120px]">
      <PageTitle prefix="Special: " title="Categories" />
      <p className="rise mt-6 max-w-[720px] font-serif text-[18px] leading-[1.68] text-ink" style={{ animationDelay: "40ms" }}>
        Innerpedia files every article into categories as it writes it: by the folder it lives in, the language it is written in, the
        frameworks it uses and the year it was begun. There are {plural(all.length, "category", "categories")} in all.
      </p>
      {GROUPS.map((g, i) => {
        const items = all.filter((c) => c.kind === g.kind).sort((a, b) => (g.kind === "year" ? b.subject.localeCompare(a.subject) : 0));
        if (!items.length) return null;
        return (
          <section key={g.kind} aria-labelledby={`cats-${g.kind}`} className="rise mt-12" style={{ animationDelay: `${80 + i * 40}ms` }}>
            <SectionHeading id={`cats-${g.kind}`} aside={plural(items.length, "category", "categories")}>
              {g.title}
            </SectionHeading>
            <p className="-mt-1 mb-4 text-[14px] text-muted">{g.text}</p>
            <ul className="grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => (
                <li key={c.name} className="min-w-0">
                  <IndexEntry c={c} label={c.kind === "year" || c.kind === "language" || c.kind === "part" ? c.subject : undefined} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function Unknown({ name }: { name: string }) {
  return (
    <main className="max-w-[760px]">
      <PageTitle title="No such special page" />
      <div className="rise mt-6" style={{ animationDelay: "40ms" }}>
        <p className="font-serif text-[18px] leading-[1.68] text-ink">
          There is no special page called <q className="italic">{name}</q>. Special pages are the ones Innerpedia writes about itself rather
          than about a folder, and there are only a few of them.
        </p>
        <h2 className="mt-10 mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Available special pages</h2>
        <ul className="border-t border-line">
          {SPECIALS.map((s) => (
            <li key={s.name} className="border-b border-line">
              <Link href={wikiHref(`Special:${s.name}`)} className="group flex flex-col gap-0.5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-44 shrink-0 font-display text-[24px] leading-tight text-link group-hover:text-link-hover">{s.title}</span>
                <span className="min-w-0 flex-1 text-[14.5px] text-ink-2">{s.text}</span>
                <span className="font-mono text-[11.5px] text-muted">Special:{s.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[14px]">
          <Link href="/wiki" className="link">
            ← Back to the Main page
          </Link>
        </p>
      </div>
    </main>
  );
}
