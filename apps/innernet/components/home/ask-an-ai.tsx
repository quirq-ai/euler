import { CopyButton } from "@/components/guide/copy-button";
import { DEMO, DEMO_REPO_URL } from "@/lib/mode";
// The card is set in the field guide's grammar: its plate frame, labels and commands.
import "@/components/guide/guide.css";

// The call to action: hand Innernet to an AI assistant with a prompt already written.
// The demo invites a reader to run Innernet on their own folders; this machine's copy
// invites its owner to work on Innernet itself. Plain links that open the assistant in
// a new tab with the prompt filled in, and copyable one-liners for the terminal agents.
// Nothing here loads from the providers, and the prompt holds nothing from the index.
//
// A compact row sits under the search box (<AskAnAiRow>), the full card at the end of
// the field guide (<AskAnAiCard>, at #ask-an-ai).

const REPO = DEMO_REPO_URL;
const REPO_LABEL = REPO.replace(/^https:\/\//, "");

const COPY = DEMO
  ? {
      headline: "Run Innernet on your own folders",
      title: (
        <>
          Run Innernet on your <em>own</em> folders
        </>
      ),
      joiner: "with",
      tag: "Your own Innernet",
      lead: "Everything in this guide, on your machine. Hand this prompt to an AI assistant and it will clone the repository, read the README and the contributing guide, install with pnpm, index the folders you choose and open your own Innernet at localhost:3470.",
      where: "Run either in the folder that should hold the clone.",
    }
  : {
      headline: "Work on Innernet with an AI",
      title: (
        <>
          Work on <em>Inner</em>net with an AI
        </>
      ),
      joiner: "like",
      tag: "Your next change",
      lead: "Innernet is small enough for an assistant to hold in its head. Hand it this prompt and it will read the README, the contributing guide and the design spec, get the app running, help you choose an open issue, and see it through to a pull request.",
      where: "Run either in your checkout of Innernet, or where a fresh clone should go.",
    };

// Written for a chat assistant and a terminal agent alike, and safe inside double quotes
// in a shell: no double quotes, dollar signs, backticks, backslashes or exclamation marks.
export const AI_PROMPT = (
  DEMO
    ? [
        "Help me run Innernet on my own computer. Innernet turns the folders on a machine into a private search engine and an encyclopedia of its projects.",
        `The code is at ${REPO}. Clone it, and read README.md and CONTRIBUTING.md before you change anything.`,
        "Check that I have Node.js 20.9 or newer and pnpm, then install with pnpm install.",
        "Ask me which folders to index, set them as the roots in innernet.config.json, and run pnpm index.",
        "Then start the app with pnpm dev and open http://localhost:3470.",
        "If you cannot run commands yourself, walk me through each step.",
        "Everything stays on my machine: the index is a local file, and the server answers only to localhost.",
      ]
    : [
        "Help me work on Innernet, the open-source app that turns the folders on a machine into a private search engine and an encyclopedia of its projects.",
        `The code is at ${REPO}: use my checkout if I have one, or clone it. Read README.md, CONTRIBUTING.md and DESIGN.md before you change anything.`,
        "Install with pnpm install, build the index with pnpm index, and start pnpm dev on http://localhost:3470.",
        `Then look through the open issues at ${REPO}/issues and suggest two or three that would make a good change.`,
        "Once I pick one, make it in the house style, run pnpm -s typecheck, check light and dark at desktop and phone widths, and prepare a pull request with the checklist from CONTRIBUTING.md.",
        "If you cannot run commands yourself, walk me through each step.",
      ]
).join(" ");

/** The prompt as one double-quoted shell word, escaped in case it ever changes. */
const shellWord = (s: string) => `"${s.replace(/!/g, ".").replace(/[\\"$`]/g, "\\$&")}"`;

const q = encodeURIComponent(AI_PROMPT);

const ASSISTANTS: { name: string; href: string; Mark: () => React.ReactElement }[] = [
  { name: "Claude", href: `https://claude.ai/new?q=${q}`, Mark: SparkMark },
  { name: "ChatGPT", href: `https://chatgpt.com/?q=${q}`, Mark: HexMark },
  { name: "Grok", href: `https://grok.com/?q=${q}`, Mark: SlashMark },
];

const TERMINALS = [
  { name: "Claude Code", command: `claude ${shellWord(AI_PROMPT)}` },
  { name: "Codex", command: `codex ${shellWord(AI_PROMPT)}` },
];

const AURORA_DOT = { background: "linear-gradient(135deg, var(--aurora-1), var(--aurora-2) 55%, var(--aurora-3))" };

/** One quiet line under the search box: the invitation, three assistants, and the prompt to copy. */
export function AskAnAiRow() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center text-[13px] text-muted">
      <a href="#ask-an-ai" className="inline-flex items-center gap-2 decoration-line-strong underline-offset-[5px] transition-colors hover:text-ink hover:underline">
        <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={AURORA_DOT} />
        {COPY.headline}
      </a>
      <span className="inline-flex items-center gap-x-2">
        <span>
          {COPY.joiner}{" "}
          {ASSISTANTS.map((a, i) => (
            <span key={a.name}>
              {i > 0 && (i === ASSISTANTS.length - 1 ? " or " : ", ")}
              <a
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${a.name} in a new tab with the prompt written`}
                className="text-ink-2 underline decoration-line-strong underline-offset-[5px] transition-colors hover:text-ink hover:decoration-ink"
              >
                {a.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </span>
          ))}
        </span>
        <span aria-hidden className="text-faint">
          ·
        </span>
        <CopyButton text={AI_PROMPT} label="Copy prompt" ariaLabel="Copy prompt" quiet className="text-[13px]" />
      </span>
    </p>
  );
}

/** The full invitation, set as the guide's last plate: an envoi before the colophon. */
export function AskAnAiCard() {
  return (
    <section id="ask-an-ai" aria-labelledby="ask-an-ai-title" className="scroll-mt-12 pt-24 sm:pt-32 lg:scroll-mt-0">
      <div className="fg-smallcaps flex items-center gap-4" data-reveal>
        <span aria-hidden>Envoi</span>
        <span aria-hidden className="h-px flex-1 bg-line-strong" />
        <span>{COPY.tag}</span>
      </div>

      <div className="fg-plate mt-8" data-reveal>
        <span aria-hidden className="fg-ticks" />
        <div className="fg-frame isolate">
          <div className="fg-head">
            <span>One prompt away</span>
            <span className="fg-head-rule" aria-hidden />
            <span className="text-right max-sm:hidden">Claude · ChatGPT · Grok</span>
          </div>

          <div className="relative overflow-hidden px-5 pb-10 pt-10 sm:px-12 sm:pb-12 sm:pt-14">
            <div className="aurora" aria-hidden style={CARD_AURORA}>
              <span />
              <span />
              <span />
            </div>
            <div className="relative">
              <h2 id="ask-an-ai-title" className="max-w-[640px] font-display text-[44px] leading-[1] tracking-[-0.02em] text-ink sm:text-[64px]">
                {COPY.title}
              </h2>
              <p className="mt-6 max-w-[600px] font-serif text-[18.5px] leading-[1.6] text-ink-2 sm:text-[19.5px]">{COPY.lead}</p>
              <ul className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
                {ASSISTANTS.map(({ name, href, Mark }) => (
                  <li key={name}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex h-11 items-center gap-2.5 rounded-full border border-line-strong bg-surface/85 pl-4 pr-4 text-[14.5px] text-ink shadow-[var(--shadow-sm)] backdrop-blur-sm transition-[border-color,box-shadow] duration-150 hover:border-ink hover:shadow-soft"
                    >
                      <span className="text-ink-2 transition-colors group-hover:text-ink">
                        <Mark />
                      </span>
                      Ask {name}
                      <svg aria-hidden width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-faint max-sm:ml-auto transition-[color,transform] duration-150 group-hover:translate-x-px group-hover:-translate-y-px group-hover:text-ink motion-reduce:transition-none">
                        <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" />
                      </svg>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] text-muted">Each opens the assistant in a new tab with the prompt below already written.</p>
            </div>
          </div>

          <div className="grid border-t border-line md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="min-w-0 border-line px-5 py-7 sm:px-8 md:border-r">
              <div className="flex items-center justify-between gap-3">
                <h3 className="fg-label">The prompt</h3>
                <CopyButton text={AI_PROMPT} label="Copy the prompt" ariaLabel="Copy the prompt" />
              </div>
              <blockquote className="mt-4 border-l border-line-strong pl-4 font-serif text-[15.5px] leading-[1.62] text-ink-2 [overflow-wrap:anywhere]">{AI_PROMPT}</blockquote>
            </div>
            <div className="min-w-0 border-t border-line px-5 py-7 sm:px-8 md:border-t-0">
              <h3 className="fg-label flex h-7 items-center">In a terminal</h3>
              <ul className="mt-4 space-y-3">
                {TERMINALS.map((t) => (
                  <li key={t.name} className="fg-command">
                    <div className="fg-command-cap">{t.name}</div>
                    <div className="flex items-center">
                      {/* The whole command is here to select; the line shows its start. */}
                      <code className="block min-w-0 flex-1 truncate py-3 pl-4 pr-3 font-mono text-[12.5px] text-ink">
                        <span aria-hidden className="select-none text-faint">
                          ${" "}
                        </span>
                        {t.command}
                      </code>
                      <CopyButton text={t.command} ariaLabel={`Copy the ${t.name} command`} className="mr-2.5 shrink-0" />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="fg-fine mt-4">{COPY.where} Both start an agent with the prompt as its first message.</p>
            </div>
          </div>

          <div className="fg-imprint">
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap normal-case tracking-normal transition-colors hover:text-ink">
              {REPO_LABEL}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <span className="max-sm:hidden">Plain links · nothing loads from them here</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// A pool of the aurora in the card's upper corner, behind the title.
const CARD_MASK = "radial-gradient(ellipse 72% 92% at 94% 0%, #000 8%, transparent 76%)";
const CARD_AURORA = { maskImage: CARD_MASK, WebkitMaskImage: CARD_MASK };

// Small monochrome marks drawn here, in the guide's line, rather than any provider's
// artwork: a spark, a hexagon and a slashed ring.

function SparkMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 1.6v4.1M8 10.3v4.1M1.6 8h4.1M10.3 8h4.1M3.5 3.5l2.9 2.9M9.6 9.6l2.9 2.9M12.5 3.5 9.6 6.4M6.4 9.6l-2.9 2.9" />
    </svg>
  );
}

function HexMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M8 1.8 13.4 4.9v6.2L8 14.2 2.6 11.1V4.9Z" />
      <circle cx="8" cy="8" r="2.2" />
    </svg>
  );
}

function SlashMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M12.6 5.2A5.4 5.4 0 1 0 13.4 8.6" />
      <path d="M2.8 13.2 13.6 2.4" />
    </svg>
  );
}
