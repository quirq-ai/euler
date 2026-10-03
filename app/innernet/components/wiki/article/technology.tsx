import Link from "next/link";
import { getIndex } from "@/lib/data";
import { num, plural } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { categoryHref } from "@/lib/links";
import type { Page } from "@/lib/types";
import { Sub } from "./parts";
import { More } from "./structure";

// Languages as one stacked bar, then frameworks, scripts and dependencies.

const SHOWN = 24;

export function hasTechnology(p: Page): boolean {
  return p.languages.length > 0 || p.frameworks.length > 0 || !!p.manifest;
}

function LanguageBar({ page }: { page: Page }) {
  const total = page.languages.reduce((s, l) => s + l.files, 0);
  if (!total) return null;
  const pct = (n: number) => (n / total) * 100;
  const fmt = (n: number) => {
    const v = pct(n);
    return v < 1 ? "<1%" : `${v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)}%`;
  };
  return (
    <figure>
      <div role="img" aria-label={page.languages.map((l) => `${l.name} ${fmt(l.files)}`).join(", ")} className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {page.languages.map((l) => (
          <span key={l.name} title={`${l.name}: ${plural(l.files, "file")}`} className="h-full min-w-[3px] opacity-90 first:rounded-l-full last:rounded-r-full" style={{ width: `${pct(l.files)}%`, background: langColor(l.name) }} />
        ))}
      </div>
      <figcaption className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
        {page.languages.map((l) => (
          <span key={l.name} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: langColor(l.name) }} />
            <span className="text-ink-2">{l.name}</span>
            <span className="tabular-nums text-muted">{fmt(l.files)}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function Chips({ items, mono }: { items: string[]; mono?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((d) => (
        <li key={d} className={`rounded-md border border-line bg-bg-sunk px-2 py-[3px] text-ink-2 ${mono ? "font-mono text-[12px]" : "text-[13px]"}`}>
          {d}
        </li>
      ))}
    </ul>
  );
}

/** Runtime dependencies solid, development ones dashed. */
function DepChips({ list, offset, devFrom }: { list: string[]; offset: number; devFrom: number }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {list.map((d, i) =>
        i + offset < devFrom ? (
          <li key={d} className="rounded-md border border-line bg-bg-sunk px-2 py-[3px] font-mono text-[12px] text-ink-2">
            {d}
          </li>
        ) : (
          <li key={d} title="development dependency" className="rounded-md border border-dashed border-line-strong px-2 py-[3px] font-mono text-[12px] text-muted">
            {d}
          </li>
        ),
      )}
    </ul>
  );
}

export function Technology({ page }: { page: Page }) {
  const { categories } = getIndex();
  const m = page.manifest;
  const deps = m ? [...m.dependencies, ...m.devDependencies.filter((d) => !m.dependencies.includes(d))] : [];
  const devFrom = m ? m.dependencies.length : 0;
  const cut = deps.length > SHOWN + 4 ? SHOWN : deps.length;
  const head = deps.slice(0, cut);
  const rest = deps.slice(cut);
  return (
    <>
      {page.languages.length > 0 && (
        <Sub label="Languages" aside={`share of ${plural(page.languages.reduce((s, l) => s + l.files, 0), "file")}`}>
          <LanguageBar page={page} />
        </Sub>
      )}
      {page.frameworks.length > 0 && (
        <Sub label="Frameworks and libraries">
          <ul className="flex flex-wrap gap-2">
            {page.frameworks.map((f) => (
              <li key={f}>
                {categories.has(f) ? (
                  <Link href={categoryHref(f)} className="inline-flex rounded-full border border-line px-3 py-1 text-[13.5px] text-ink transition-colors hover:border-line-strong hover:bg-bg-sunk">
                    {f}
                  </Link>
                ) : (
                  <span className="inline-flex rounded-full border border-line px-3 py-1 text-[13.5px] text-ink">{f}</span>
                )}
              </li>
            ))}
          </ul>
        </Sub>
      )}
      {m && m.scripts.length > 0 && (
        <Sub label="Scripts" aside={<span className="font-mono">{m.file}</span>}>
          <Chips items={m.scripts.slice(0, 16)} mono />
        </Sub>
      )}
      {deps.length > 0 && (
        <Sub
          label="Dependencies"
          aside={
            <span className="inline-flex items-center gap-1.5">
              {m!.dependencies.length > 0 && <span>{num(m!.dependencies.length)} runtime</span>}
              {m!.dependencies.length > 0 && m!.devDependencies.length > 0 && <span aria-hidden>·</span>}
              {m!.devDependencies.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  {m!.dependencies.length > 0 && <span aria-hidden className="inline-block h-2.5 w-3.5 rounded-[3px] border border-dashed border-line-strong" />}
                  {num(m!.devDependencies.length)} development
                </span>
              )}
            </span>
          }
        >
          <DepChips list={head} offset={0} devFrom={devFrom} />
          {rest.length > 0 && (
            <More count={rest.length} noun={rest.length === 1 ? "dependency" : "dependencies"}>
              <div className="mt-2">
                <DepChips list={rest} offset={cut} devFrom={devFrom} />
              </div>
            </More>
          )}
        </Sub>
      )}
      {m && !deps.length && !m.scripts.length && (
        <p className="mt-6 text-[13.5px] text-muted">
          Declared in <span className="font-mono text-[12.5px] text-ink-2">{m.file}</span>, with no dependencies listed.
        </p>
      )}
    </>
  );
}
