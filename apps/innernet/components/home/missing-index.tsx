import { DEMO, DEMO_ORG, INDEX_COMMAND } from "@/lib/mode";

// Shown in place of the search box before the first `pnpm index`: plain words, one command.

export function MissingIndex() {
  return (
    <div className="rise w-full max-w-[460px] rounded-2xl border border-line bg-surface/80 p-6 text-center shadow-soft backdrop-blur-sm" style={{ animationDelay: "120ms" }}>
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted">No index yet</h2>
      <p className="mx-auto mt-3 max-w-[340px] text-balance font-serif text-[17px] leading-[1.55] text-ink-2">
        {DEMO
          ? "The demo index has not been built yet. Run this in the project folder, then reload the page."
          : "Innernet has not read your folders yet. Run this in the project folder, then reload the page."}
      </p>
      <code className="mt-5 inline-flex items-center gap-2.5 rounded-xl border border-line bg-bg-sunk px-4 py-2.5 font-mono text-[14px] text-ink">
        <span aria-hidden className="select-none text-faint">$</span>
        {INDEX_COMMAND}
      </code>
      <p className="mt-4 text-[12.5px] text-muted">
        {DEMO ? (
          <>
            It reads the public repositories of <span className="font-mono text-[11.5px] text-ink-2">github.com/{DEMO_ORG}</span>.
          </>
        ) : (
          <>
            It reads the roots in <span className="font-mono text-[11.5px] text-ink-2">innernet.config.json</span>.
          </>
        )}
      </p>
    </div>
  );
}
