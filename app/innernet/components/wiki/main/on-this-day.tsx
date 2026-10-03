import { indexTime, onThisDay, undash } from "@/components/wiki/main/insights";
import { Box, joinNodes, Lead } from "@/components/wiki/main/section";
import { longDate, plural } from "@/lib/format";

const ago = (n: number) => (n === 1 ? "a year ago" : `${plural(n, "year")} ago`);
const clip = (s: string, n = 70) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + " …");

export function OnThisDay({ delay, className }: { delay?: number; className?: string }) {
  const otd = onThisDay();
  const t = indexTime();
  const today = longDate(new Date(t).toISOString()).replace(/ \d{4}$/, "");
  const thisYear = new Date(t).getFullYear();

  return (
    <Box id="otd" title={`On this day · ${today}`} delay={delay} className={className}>
      {otd.type === "commits" && (
        <>
          <ol className="space-y-5">
            {otd.years.map(({ year, entries }) => (
              <li key={year} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[4.25rem_minmax(0,1fr)] sm:gap-x-4">
                <div className="pt-px">
                  <span className="block font-display text-[26px] leading-none tabular-nums text-ink">{year}</span>
                  <span className="mt-1.5 hidden text-[11px] tabular-nums text-muted sm:block">{ago(thisYear - Number(year))}</span>
                </div>
                <ul className="space-y-2.5 border-l border-line pl-4">
                  {entries.map((e) => (
                    <li key={e.pages[0].slug + e.lead.hash} className="font-serif text-[16px] leading-[1.5] text-ink">
                      {joinNodes(e.pages.slice(0, 3).map((p) => <Lead key={p.slug} page={p} />))}
                      {": "}
                      {e.commits.length > 1 && (
                        <span className="text-ink-2">
                          {e.pages.length > 1 ? "shared " : ""}
                          {plural(e.commits.length, "commit")}, among them{" "}
                        </span>
                      )}
                      <q className="italic">{clip(undash(e.lead.subject))}</q>
                      <span className="ml-2 align-[1px] font-mono text-[11px] text-muted">{e.lead.hash.slice(0, 7)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-line pt-3 text-[13px] text-muted">
            {plural(otd.total, "commit")} landed on {today} in earlier years.
          </p>
        </>
      )}

      {otd.type === "anniversaries" && (
        <>
          <p className="mb-4 font-serif text-[16px] italic text-ink-2">
            No commits were made on this date in earlier years. Projects begun {otd.exact ? "on it" : "around it"}:
          </p>
          <ul className="space-y-2.5">
            {otd.items.map((p) => (
              <li key={p.slug} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 font-serif text-[16px] leading-[1.5] sm:grid-cols-[4.25rem_minmax(0,1fr)] sm:gap-x-4">
                <span className="font-display text-[22px] leading-none tabular-nums">{p.created!.slice(0, 4)}</span>
                <span>
                  <Lead page={p} /> <span className="text-[14px] text-muted">{longDate(p.created)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {otd.type === "none" && (
        <p className="font-serif text-[16px] italic text-ink-2">Nothing in the index happened on {today}. Perhaps this is the year.</p>
      )}
    </Box>
  );
}
