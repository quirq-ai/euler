import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { facts, type Fact } from "@/components/wiki/main/insights";
import { Box, Lead } from "@/components/wiki/main/section";
import { getIndex, getPage } from "@/lib/data";
import { monthYear, num, plural } from "@/lib/format";
import { categoryHref } from "@/lib/links";
import { DEMO } from "@/lib/mode";
import type { Page } from "@/lib/types";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? num(n);

export function DidYouKnow({ delay, className }: { delay?: number; className?: string }) {
  const list = facts();
  const root = getIndex().index.meta.roots[0]?.label ?? "this machine";
  const pictured = list.map(subjectOf).find((p): p is Page => !!p);

  return (
    <Box id="dyk" title="Did you know…" delay={delay} className={className}>
      <div className="flow-root">
        {pictured && (
          <figure className="float-right mb-3 ml-5 mt-1 w-[76px] text-center">
            <PageSigil page={pictured} size={64} muted={false} className="shadow-soft" />
            <figcaption className="mt-1.5 truncate text-[11.5px] italic text-muted">{pictured.name}</figcaption>
          </figure>
        )}
        <ul className="space-y-3 font-serif text-[16.5px] leading-[1.5] text-ink">
          {list.map((f, i) => (
            <li key={i} className="relative pl-4">
              <span aria-hidden className="absolute left-0 top-[0.62em] size-[5px] rounded-full bg-line-strong" />
              … that {sentence(f, root)}?
            </li>
          ))}
        </ul>
      </div>
    </Box>
  );
}

function subjectOf(f: Fact): Page | null {
  return "page" in f ? f.page : null;
}

function sentence(f: Fact, root: string): React.ReactNode {
  switch (f.type) {
    case "largest":
      return f.busiest ? (
        <>
          <Lead page={f.page} /> is both the largest project in <span className="font-mono text-[0.84em]">{root}</span>, with{" "}
          {plural(f.page.totalFiles, "file")}, and the busiest repository, with {plural(f.busiest.git!.commitCount, "commit")}
        </>
      ) : (
        <>
          the largest project in <span className="font-mono text-[0.84em]">{root}</span> is <Lead page={f.page} />, with{" "}
          {plural(f.page.totalFiles, "file")}
        </>
      );
    case "oldest":
      return (
        <>
          <Lead page={f.page} />, begun in {monthYear(f.page.created)}, is the oldest project on Innerpedia
        </>
      );
    case "commits":
      return (
        <>
          <Lead page={f.page} /> holds {plural(f.page.git!.commitCount, "commit")}, more than any other repository{" "}
          {DEMO ? (
            <>
              in <span className="font-mono text-[0.84em]">{root}</span>
            </>
          ) : (
            "on this machine"
          )}
        </>
      );
    case "framework":
      return (
        <>
          <Link href={categoryHref(f.name)} className="link font-semibold">
            {f.name}
          </Link>{" "}
          is the most used framework, appearing in {num(f.count)} articles{f.second ? `, ahead of ${f.second}` : ""}
        </>
      );
    case "deepest": {
      const home = getPage(f.page.partOf) ?? getPage(f.page.parent);
      return (
        <>
          Innerpedia reads {word(f.depth)} folders deep, as far down as <Lead page={f.page}>{f.page.name}</Lead>
          {home ? <> in {home.name}</> : null}, one of {num(f.atDepth)} folders at that depth
        </>
      );
    }
    case "readme":
      return (
        <>
          <Link href={categoryHref("Articles lacking a README")} className="link font-semibold">
            {num(f.count)} of the {num(f.total)} articles
          </Link>{" "}
          were written without a README to go on
        </>
      );
    case "busiestMonth":
      return (
        <>
          the busiest month on record was {monthYear(`${f.month}-15`)}, with {plural(f.count, "commit")} across every repository
        </>
      );
    case "agents":
      return (
        <>
          <Link href={categoryHref("Agent-ready projects")} className="link font-semibold">
            {plural(f.count, "project")}
          </Link>{" "}
          carry a CLAUDE.md or AGENTS.md for whichever agent arrives next
        </>
      );
  }
}
