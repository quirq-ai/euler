import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { ancestors } from "@/lib/data";
import { plural } from "@/lib/format";
import { wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";
import { ContentsBox, ContentsNav, type ContentsItem } from "./article/contents-nav";
import { article, count, descriptor, placeSegs, splitTitle } from "./article/lead";
import { PageHeader, Segs } from "./article/parts";

// "src may refer to:", the list of every folder sharing a name, grouped by the
// project (or top-level folder) that holds it, in Wikipedia's manner.

interface Group {
  id: string;
  page: Page | null; // the enclosing project, or null for the catch-all
  label: string;
  items: Page[];
}

const ELSEWHERE = "g-elsewhere";
/** Groups this small sit side by side in long lists instead of each taking a full row. */
const MINOR = 3;

/** The outermost project or repository above a page, else its top-level folder. */
function home(p: Page): Page | null {
  const chain = ancestors(p).filter((a) => a.depth > 0);
  return chain.find((a) => a.kind === "repo" || !!a.manifest) ?? chain[0] ?? null;
}

const idFor = (s: string) => `g-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function group(pages: Page[]): Group[] {
  const by = new Map<string, Group>();
  for (const p of pages) {
    const h = home(p);
    const key = h?.slug ?? "";
    const g = by.get(key) ?? { id: idFor(key || "root"), page: h, label: h?.name ?? "At the top", items: [] };
    g.items.push(p);
    by.set(key, g);
  }
  let groups = [...by.values()];
  // Lone entries read better together than as a run of one-line sections.
  const singles = groups.filter((g) => g.items.length === 1);
  if (groups.length > 4 && singles.length > 1) {
    groups = groups.filter((g) => g.items.length > 1);
    groups.push({ id: ELSEWHERE, page: null, label: "Elsewhere", items: singles.flatMap((g) => g.items) });
  }
  for (const g of groups) g.items.sort((a, b) => a.title.localeCompare(b.title));
  return groups.sort((a, b) => (a.id === ELSEWHERE ? 1 : b.id === ELSEWHERE ? -1 : b.items.length - a.items.length || a.label.localeCompare(b.label)));
}

/** What a page is and where, without repeating what its title or group already says. */
function describe(p: Page, g: Group): { what: string; where: string; files: string } {
  const [, qualifier] = splitTitle(p.title);
  const chain = ancestors(p);
  const ctx = chain.find((a) => a.slug === p.partOf) ?? chain[chain.length - 1];
  const where = ctx && ctx.depth > 0 && ctx.slug !== g.page?.slug && !(qualifier ?? "").includes(ctx.name) ? ctx.name : "";
  const d = descriptor(p);
  const n = p.totalFiles;
  return {
    what: n ? d : `empty ${d}`,
    where,
    files: n === 0 ? "" : n === 1 ? "a single file" : `${count(n)} files`,
  };
}

/** Prose gloss: "a source folder in linear-clone with seven files". */
function gloss(p: Page, g: Group): string {
  const { what, where, files } = describe(p, g);
  return `${article(what)} ${what}${where ? ` in ${where}` : ""}${files ? `${where ? "," : ""} with ${files}` : ""}`;
}

/** Index caption: "Source folder in linear-clone · 7 files". */
function caption(p: Page, g: Group): string {
  const { what, where } = describe(p, g);
  const head = `${what[0].toUpperCase()}${what.slice(1)}${where ? ` in ${where}` : ""}`;
  return p.totalFiles ? `${head} · ${plural(p.totalFiles, "file")}` : head;
}

/** Long folder names may break after underscores, dots and slashes, not mid-word. */
function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[_./])/);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <wbr />}
          {part}
        </span>
      ))}
    </>
  );
}

function Entry({ p, g, name: shared, stacked }: { p: Page; g: Group; name: string; stacked: boolean }) {
  const [name, qualifier] = splitTitle(p.title);
  // In a long index every title starts with the shared name, so the qualifier, the
  // part that differs, is set a little heavier to carry the eye.
  const lead = stacked && qualifier && name.toLowerCase() === shared.toLowerCase();
  const link = (
    <Link href={wikiHref(p.slug)} className="link">
      <span>{name}</span>
      {qualifier && (
        <span className={lead ? "font-medium" : undefined}>
          {" "}
          <Breakable text={qualifier} />
        </span>
      )}
    </Link>
  );
  if (stacked)
    return (
      <li className="break-inside-avoid py-[5px]">
        <span className="block [overflow-wrap:break-word]">{link}</span>
        <span className="mt-px block font-sans text-[12.5px] leading-snug text-muted">{caption(p, g)}</span>
      </li>
    );
  return (
    <li className="flex gap-3 py-[3px]">
      <span aria-hidden className="mt-[0.64em] size-1 shrink-0 rounded-full bg-faint" />
      <span className="min-w-0">
        {link}
        <span className="text-ink-2">, {gloss(p, g)}</span>
      </span>
    </li>
  );
}

function GroupHeading({ g, small }: { g: Group; small?: boolean }) {
  const size = small ? "text-[21px]" : "text-[25px]";
  return (
    <h2 id={`${g.id}-h`} className="mb-3 flex items-center gap-2.5 border-b border-line pb-2">
      {g.page ? (
        <>
          <PageSigil page={g.page} size={small ? 20 : 22} />
          <span className="font-sans text-[13px] text-muted">In</span>
          <Link href={wikiHref(g.page.slug)} className={`min-w-0 truncate font-display leading-[1.15] text-ink hover:text-link ${size}`}>
            {g.page.name}
          </Link>
        </>
      ) : (
        <span className={`font-display leading-[1.15] text-ink ${size}`}>{g.label}</span>
      )}
      <span className="ml-auto pl-2 font-mono text-[12px] tabular-nums text-muted">{g.items.length}</span>
    </h2>
  );
}

export function DisambiguationView({ name, primary, pages }: { name: string; primary: Page | null; pages: Page[] }) {
  const others = pages.filter((p) => p.slug !== primary?.slug);
  const groups = group(others);
  const nav = groups.length >= 4;
  const stacked = others.length > 16;
  const headed = groups.length > 1;
  // Groups are landmarks only while there are few enough to be worth jumping between.
  const labelled = (g: Group) => (headed && groups.length <= 4 ? `${g.id}-h` : undefined);
  const items: ContentsItem[] = [{ id: "top", label: "(Top)" }, ...groups.map((g) => ({ id: g.id, label: g.label, count: g.items.length }))];
  const d = primary ? descriptor(primary) : "";

  // In long lists, small groups pair up in two columns; the rest keep a full row each.
  const minor = (g: Group) => stacked && headed && g.id !== ELSEWHERE && g.items.length <= MINOR;
  const runs: { minor: boolean; groups: Group[] }[] = [];
  for (const g of groups) {
    const last = runs[runs.length - 1];
    if (last && last.minor && minor(g)) last.groups.push(g);
    else runs.push({ minor: minor(g), groups: [g] });
  }

  const list = (g: Group, cols: boolean) => (
    <ul className={`font-serif text-[17px] leading-[1.5] ${cols ? "sm:columns-2 sm:gap-10" : ""}`}>
      {g.items.map((p) => (
        <Entry key={p.slug} p={p} g={g} name={name} stacked={stacked} />
      ))}
    </ul>
  );

  return (
    <main className="xl:grid xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-12">
      <div className="hidden pt-1 xl:block">{nav && <ContentsNav items={items} />}</div>

      <article className="mx-auto min-w-0 max-w-[640px] lg:max-w-[944px] xl:mx-0">
        <div className="max-w-[760px]">
          <PageHeader title={primary ? `${name} (disambiguation)` : name} />

          <div className="prose-wiki rise mt-7">
            {primary && (
              <p>
                <b className="font-semibold">{name}</b> most commonly refers to{" "}
                <Link href={wikiHref(primary.slug)} className="link">
                  {primary.name}
                </Link>
                , {article(d)} {d} <Segs segs={placeSegs(primary)} />.
              </p>
            )}
            <p className="!mb-2">
              <b className="font-semibold">{name}</b> {primary ? "may also refer to" : "may refer to"}:
            </p>
          </div>
          {others.length > 8 && (
            <p className="text-[13px] text-muted">
              {plural(others.length, "folder")}
              {headed && <>, grouped by the {groups.length > 2 ? `${count(groups.length)} projects and places` : "projects"} that hold them</>}.
            </p>
          )}

          {nav && <ContentsBox items={items} title="Groups" className="mt-6 xl:hidden" />}

          <div className={headed ? "mt-8" : "mt-4"}>
            {runs.map((run, i) =>
              run.minor && run.groups.length > 1 ? (
                <div key={run.groups[0].id} className={`grid gap-x-10 gap-y-10 sm:grid-cols-2 ${i > 0 ? "mt-12" : ""}`}>
                  {run.groups.map((g) => (
                    <section key={g.id} id={g.id} aria-labelledby={labelled(g)} className="min-w-0 scroll-mt-24">
                      <GroupHeading g={g} small />
                      {list(g, false)}
                    </section>
                  ))}
                </div>
              ) : (
                run.groups.map((g) => (
                  <section key={g.id} id={g.id} aria-labelledby={labelled(g)} className={`scroll-mt-24 ${i > 0 ? "mt-12" : ""}`}>
                    {headed && <GroupHeading g={g} />}
                    {list(g, stacked && g.items.length >= 4)}
                  </section>
                ))
              ),
            )}
          </div>

          <footer className="mt-16 border-t border-line pt-4">
            <p className="font-serif text-[14.5px] italic leading-relaxed text-muted">
              This disambiguation page lists folders that share the name <span className="not-italic text-ink-2">{name}</span>. If a link led you here,
              you may wish to point it straight at the folder you meant.
            </p>
          </footer>
        </div>
      </article>
    </main>
  );
}
