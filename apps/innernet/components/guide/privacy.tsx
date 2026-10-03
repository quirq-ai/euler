import { DAILY_CAP, RETENTION_DAYS, SESSION_CAP } from "@/lib/db/demo-history";
import { num } from "@/lib/format";
import { redactSecrets } from "@/lib/text";
import { CHAPTERS } from "./chapters";
import { C, ChapterHead, Excerpt, Fine, Prose, SectionHead } from "./parts";
import { Figure, Plate } from "./plate";
import { cite } from "./source";

// Chapter V: what is read, what is only counted, what is blacked out, who may ask, and
// what the database keeps, here and on the public demo.

const LEDGER: { title: string; mark: string; items: React.ReactNode[] }[] = [
  {
    title: "Read",
    mark: "R",
    items: [
      <>The README, its first 14,000 bytes.</>,
      <>
        <C>CLAUDE.md</C>, else <C>AGENTS.md</C>: its first paragraph of prose.
      </>,
      <>
        One manifest: <C>package.json</C>, <C>pyproject.toml</C>, <C>Cargo.toml</C>, <C>go.mod</C> or <C>requirements.txt</C>.
      </>,
      <>Git metadata from five commands: commits, branch, remote, count, first commit. Authors by name, never by email.</>,
      <>
        A project&apos;s own logo, found by its name (<C>logo</C>, <C>icon</C>, <C>mark</C>, <C>favicon</C>), within 64 KB for SVG and 96 KB for an image.
      </>,
    ],
  },
  {
    title: "Counted, never opened",
    mark: "C",
    items: [
      <>Every other file: its size, its dates and its extension, which becomes a language.</>,
      <>Source code, configuration, Dockerfiles, documents, and every image but a logo.</>,
      <>
        Dotfiles such as <C>.env</C>: not even counted, only noticed when one is <C>.git</C>.
      </>,
      <>Symlinks and Python virtualenvs: never followed.</>,
    ],
  },
  {
    title: "Blacked out",
    mark: "B",
    items: [
      <>
        Credential-shaped values become <C>[redacted]</C>: private keys, passwords in URLs, Stripe, Anthropic, OpenAI, GitHub, Slack, AWS and Google keys, JWTs, Bearer
        tokens, and long random <C>KEY=value</C> pairs.
      </>,
      <>
        File names such as <C>.env</C>, <C>*.pem</C>, <C>id_rsa</C> and anything with secret, token or password in it are never listed.
      </>,
      <>Folders named like cred, secret, private or keys: their README, notes and manifest are never opened, and their file names never listed.</>,
      <>Git remotes lose any login written into them.</>,
    ],
  },
  {
    title: "Refused",
    mark: "X",
    items: [
      <>Any request not addressed to localhost: a 403 before anything is read.</>,
      <>Scripts, styles, images and connections from any other origin.</>,
      <>Being framed by another page. Every page also asks search engines to look away.</>,
      <>
        Any write but one: the history of what you open, from this app&apos;s own pages, to a folder in your home and its copy in <C>~/.innernet/db</C>.
      </>,
    ],
  },
];

// Made-up credentials, assembled at run time so no scanner mistakes this file for a leak,
// and run through the same redactSecrets the indexer uses.
const SAMPLES = [
  `DATABASE_URL=postgres://admin:${["s3cret", "horse", "battery"].join("-")}@db.internal:5432/app`,
  `curl -H "Authorization: Bearer ${"9fQ2xLr7" + "Tz4mWk8sPa1v"}" https://api.example.test`,
  `GITHUB_TOKEN=${"gh" + "p_" + "A1b2C3d4E5f6G7h8I9j0" + "K1l2M3n4O5p6Q7r8"}`,
];

export function Privacy() {
  return (
    <section aria-labelledby="privacy-title">
      <ChapterHead chapter={CHAPTERS[4]} kicker="Innernet reads very little, keeps it on this machine, blacks out anything that looks like a key, and answers to no one but you.">
        <Prose>
          <p>
            A search engine over your own folders sees a great deal that was never meant to be published. Innernet is built so that the index holds as little as
            it needs, and so that the little it holds never leaves the room.
          </p>
        </Prose>
      </ChapterHead>

      <Plate
        id="privacy"
        fig={11}
        title="Private by design"
        className="mt-10"
        alt="This machine drawn as a walled enclosure holding the index, search and Innerpedia. One gate, 127.0.0.1, is the only way in; arrows toward the cloud, telemetry and third parties stop at the wall and are struck through. A dial reads 0 bytes sent."
        caption={<>Private by design. Everything Innernet makes stays inside this machine; the only door is localhost, and nothing is sent anywhere.</>}
      />

      <SectionHead id="ledger" mark="V.1" title="The ledger" />
      <Figure
        fig={12}
        title="What crosses the line"
        className="mt-10"
        bodyClassName="grid sm:grid-cols-2 xl:grid-cols-4"
        caption={<>What crosses the line. Four columns, from what the indexer reads to what the server refuses outright.</>}
        imprint={
          <>
            <span>{cite("scripts/build-index.ts", "function crawl(")}</span>
            <span>{cite("lib/text.ts", "export function redactSecrets")}</span>
          </>
        }
      >
        {LEDGER.map((col, i) => (
          <div key={col.title} className={`min-w-0 border-line px-5 pb-6 pt-5 ${i > 0 ? "max-sm:border-t" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:max-xl:border-t" : ""} ${i === 2 ? "xl:border-l" : ""}`}>
            <div className="flex items-baseline gap-3">
              <span aria-hidden className="font-display text-[34px] italic leading-none text-faint">
                {col.mark}
              </span>
              <h4 className="font-display text-[23px] leading-tight text-ink">{col.title}</h4>
            </div>
            <ul className="mt-4 space-y-3">
              {col.items.map((it, j) => (
                <li key={j} className="relative pl-4 text-[13.5px] leading-[1.55] text-ink-2">
                  <span aria-hidden className="absolute left-0 top-[9px] h-px w-2 bg-line-strong" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Figure>

      <Prose className="mt-12">
        <p>
          Redaction runs twice: when the index is written, and again whenever the server loads it, so an index written by an older version is cleaned by the rules of
          today. Agent notes that held a credential are dropped altogether. These three lines were run through the same function as this page was served:
        </p>
      </Prose>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-bg-sunk/50" data-reveal>
        <div className="grid border-b border-line max-md:hidden md:grid-cols-2">
          <div className="fg-label px-4 py-2">In a README</div>
          <div className="fg-label border-l border-line px-4 py-2">In the index</div>
        </div>
        {SAMPLES.map((s, i) => (
          <div key={s} className={`grid md:grid-cols-2 ${i > 0 ? "border-t border-line" : ""}`}>
            <div className="min-w-0 px-4 py-3">
              {/* On a phone the pair stacks, so each half names itself. */}
              <div className="fg-label mb-1 md:hidden">In a README</div>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                <code>{s}</code>
              </pre>
            </div>
            <div className="min-w-0 border-line bg-surface px-4 py-3 max-md:border-t md:border-l">
              <div className="fg-label mb-1 md:hidden">In the index</div>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink [overflow-wrap:anywhere]">
                <code>
                  {redactSecrets(s)
                    .split(/(\[redacted\])/)
                    .map((part, j) => (part === "[redacted]" ? <mark key={j}>{part}</mark> : <span key={j}>{part}</span>))}
                </code>
              </pre>
            </div>
          </div>
        ))}
      </div>

      <SectionHead id="localhost" mark="V.2" title="Only localhost" />
      <Prose className="mt-8">
        <p>
          <C>pnpm dev</C> and <C>pnpm start</C> listen on 127.0.0.1, so no other machine can reach the server. A page on the web can still try a trick called DNS
          rebinding, pointing a name of its own at 127.0.0.1 and asking from inside your browser. It cannot change the name it asks by, though, and{" "}
          <C>proxy.ts</C> answers anything not addressed to localhost with a 403, on every path, before a single file is read:
        </p>
      </Prose>
      <Excerpt file="proxy.ts" from="const LOCAL" lines={6} mark={["const LOCAL", "403"]} className="mt-6" />
      <Prose className="mt-8">
        <p>
          In the browser, a Content-Security-Policy holds every page to its own origin; under <C>next dev</C> it also lets the hot-reload websocket through. The fonts are served by the app itself, the pages ask search engines to look
          away, and apart from moving between pages a page makes two requests, both to this app: the search box asks <C>/api/suggest</C> for suggestions as you
          type, and the history posts the page you opened to <C>/api/activity</C>, which refuses anything not sent from this app&apos;s own pages on localhost. The
          public demo is the one place it answers anyone else, and only when the demo keeps a database; the next section says what it keeps.
        </p>
      </Prose>
      <Excerpt file="next.config.ts" from="const csp = [" lines={11} mark={["default-src", "frame-ancestors"]} className="mt-6" />
      <Fine className="mt-6 max-w-[680px]">
        One caveat: <C>next dev</C> records request URLs, search queries included, in <C>.next/dev/trace</C>. It is gitignored and recreated; delete it whenever you
        like.
      </Fine>

      <SectionHead id="database" mark="V.3" title="The database" />
      <Prose className="mt-8">
        <p>
          Innernet keeps a copy of its index and its history in a small Postgres database. On your machine it is PGlite, Postgres compiled to WebAssembly, running
          inside the server on a folder at <C>~/.innernet/db</C> (folder mode 700). Nothing listens on a port, and local mode refuses to open a remote database
          whatever the environment says, before a byte is sent:
        </p>
      </Prose>
      <Excerpt file="lib/db/neon.ts" from="export async function openNeon" lines={2} mark={["if (!DEMO) throw"]} className="mt-6" />
      <Prose className="mt-8">
        <p>
          The history folders stay the record. After each page you open, and whenever the history page is read, the files that changed are read into the database,
          only the new bytes of each. A session folder you delete, or a line you take out of a file, is forgotten there too. Only when the history folder itself is
          lost or replaced (the database notes which folder it read) does it keep the sessions that did not come with the new one, so <C>pnpm db:load</C> can write
          them back. Set <C>INNERNET_DB=off</C> and Innernet runs on its files alone; delete <C>~/.innernet/db</C> to forget the copy.
        </p>
        <p>
          The public demo is different, and it is the one place anything you do is written to a server. When it has a database (Neon Postgres, in US East), it keeps
          the pages and searches its visitors open for {RETENTION_DAYS} days: per event, the kind of event, the page&apos;s path (none of the rest of its address
          but the search&apos;s own), its title or the search words, whether the back and forward buttons took you there, and the server&apos;s time, under a hash of
          the id the visitor&apos;s tab made, which gives back neither the id nor the time in it. Never an IP address, a user agent, a cookie or any other header.
          Nothing lists sessions, ids travel only in request bodies, so only a browser holding a session&apos;s id can read it back, and the Clear button on the
          history page deletes every one that browser sent. Each session holds at most {num(SESSION_CAP)} events and the whole demo stores at most{" "}
          {num(DAILY_CAP)} a day. A fork without a database keeps every visitor&apos;s history in their own browser, as the demo did before.
        </p>
      </Prose>
      <Fine className="mt-6 max-w-[680px]">
        The demo&apos;s rules: {cite("lib/db/demo-history.ts", "export const RETENTION_DAYS")}, its route {cite("app/api/activity/route.ts", "export async function POST")}.
        This machine&apos;s: {cite("lib/db/ingest.ts", "async function ingest(")}.
      </Fine>
    </section>
  );
}
