import { PageSigil } from "@/components/page-sigil";
import { cap, gloss, indexTime, news, undash } from "@/components/wiki/main/insights";
import { Box, Dotted, Lead, PageLink } from "@/components/wiki/main/section";
import { timeAgo } from "@/lib/format";
import type { Page } from "@/lib/types";

const DAY = 86_400_000;
const clip = (s: string, n = 64) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + " …");

/** A headline in the newspaper's voice: new projects are "started", the rest "updated". */
function Headline({ page }: { page: Page }) {
  const t = indexTime();
  const created = page.created ? Date.parse(page.created) : NaN;
  const modified = page.modified ? Date.parse(page.modified) : NaN;
  const isNew = t - created < 14 * DAY;
  if (isNew && modified - created < DAY)
    return (
      <>
        <Lead page={page} /> was started {timeAgo(page.created)}.
      </>
    );
  if (isNew)
    return (
      <>
        <Lead page={page} />, started {timeAgo(page.created)}, was updated {timeAgo(page.modified)}.
      </>
    );
  return (
    <>
      <Lead page={page} /> was updated {timeAgo(page.modified)}.
    </>
  );
}

export function InTheNews({ delay, className }: { delay?: number; className?: string }) {
  const { items, ongoing, quiet } = news();
  return (
    <Box id="news" title="In the news" delay={delay} className={className}>
      <ul className="space-y-4">
        {items.map(({ page, commit }) => (
          <li key={page.slug} className="flex gap-3.5">
            <PageSigil page={page} size={22} muted={false} className="mt-[3px]" />
            <div className="min-w-0">
              <p className="font-serif text-[16.5px] leading-[1.45] text-ink">
                <Headline page={page} />
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted">
                {cap(gloss(page))}
                {commit && (
                  <>
                    <span aria-hidden className="px-1.5 text-faint">·</span>
                    <span className="text-ink-2">“{clip(undash(commit.subject))}”</span>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {(ongoing.length > 0 || quiet.length > 0) && (
        <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[13px] leading-relaxed text-muted">
          {ongoing.length > 0 && <Roll label="Ongoing" pages={ongoing} />}
          {quiet.length > 0 && <Roll label="Gone quiet" pages={quiet} />}
        </dl>
      )}
    </Box>
  );
}

function Roll({ label, pages }: { label: string; pages: Page[] }) {
  return (
    <>
      <dt className="font-medium text-ink-2">{label}</dt>
      <dd className="min-w-0">
        <Dotted>
          {pages.map((p) => (
            <PageLink key={p.slug} page={p} title={p.git?.lastCommit ? `Last commit ${timeAgo(p.git.lastCommit)}` : undefined} />
          ))}
        </Dotted>
      </dd>
    </>
  );
}
