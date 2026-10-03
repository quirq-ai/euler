# Innernet: the facts

The single source of truth for the film narrator, the guide page builder and the diagram
designer. Every claim here was checked against the code or the live index on 2 October
2026. Paths are relative to `experiments/innernet`. `B` = `scripts/build-index.ts`,
`N` = `lib/normalize.ts`, `T` = `lib/text.ts`, `S` = `lib/search.ts`, `D` = `lib/data.ts`.
When this file and DESIGN.md or README.md disagree, this file follows the code.

## Numbers at a glance

From `data/index.json` meta, generated 2026-10-02T15:02:54Z.

| Fact | Value |
| --- | --- |
| Roots | `~/Programming` (one root) |
| Depth read | `maxDepth` 6, so 7 levels of pages (depth 0 to 6) |
| Folders indexed (pages) | 5,484 |
| Articles | 958 (637 projects, 172 repositories, 149 document collections) |
| Stubs | 4,526 (2,843 source folders, 1,258 plain folders, 361 asset folders, 64 small docs folders) |
| Git repositories | 172 |
| Categories | 183 (91 "Parts of", 11 language, 9 "Started in" years, 72 others: collections, frameworks, kinds, maintenance) |
| Shared folder names | 638 disambiguation groups, 74 of them with a primary topic |
| Pages with a `partOf` project | 4,410 |
| Folders at the depth limit with a "deeper" tally | 769 |
| Files under the root | 55,626, about 8.0 GB |
| Index time | 51,029 ms (about 51 s; README.md and CONTRIBUTING.md say "about a minute") |
| Index file | about 7.9 MB of compact JSON |
| First search after a re-index | about 240 ms (engine build included); later searches 0 to 3 ms |
| Pages per depth | 0: 1 · 1: 40 · 2: 192 · 3: 476 · 4: 1,089 · 5: 1,591 · 6: 2,095 |
| Most-used frameworks | React 133 · Tailwind CSS 105 · Next.js 85 · Vite 43 · Radix UI 39 |
| Biggest categories | XO 690 · Started in 2026 549 · ClaudeWorkspace 522 · Articles lacking a README 517 |

Live home count line: "Your personal internet · 5,484 folders · 958 articles · 172 repositories".

## What Innernet is

Innernet is a personal internet: a search engine whose web is the folders on this
machine, and Innerpedia, an encyclopedia with an article for every project and a stub for
every other folder. One command (`pnpm index`) walks the configured roots, reads only
READMEs, CLAUDE.md or AGENTS.md, project manifests and git history, and writes one local
JSON file. A Next.js 16 app on `http://localhost:3470`, bound to 127.0.0.1 and refusing
any Host that is not localhost, turns that file into Google-style results ("About N
results (0.004 seconds)", blue links, a knowledge panel) and Wikipedia-style pages
(lead, infobox, contents, hatnotes, categories, See also). Nothing leaves the machine.
DESIGN.md calls the mood "a private library in morning light".

## The pipeline end to end

Stations for a diagram, in order. Numbers are the live ones.

1. **Config.** `innernet.config.json` is `{"roots": ["~/Programming"], "maxDepth": 6}`.
   `INNERNET_ROOTS` (comma list) replaces the roots, `INNERNET_MAX_DEPTH` the depth,
   `INNERNET_OUT` the output path (B:29-31).
2. **Walk.** Depth-first, synchronous (`readdirSync`, `statSync`), subfolders sorted with
   `localeCompare` (B:408). Pages exist for depth 0 to 6. Junk, dot-folders and
   virtualenvs are pruned. Result: 5,484 folders; 769 folders at depth 6 carry a tally of
   what lies below.
3. **Read.** Per folder: README (first 14,000 bytes), CLAUDE.md else AGENTS.md (first
   20,000 bytes, only its first prose paragraph kept), one manifest, and for a folder with
   its own `.git`, five `git` commands (up to 6,000 commits read).
4. **Classify.** Each folder gets a kind (repo, project, docs, assets, code, folder) and
   becomes an article or a stub: 958 articles, 4,526 stubs.
5. **Name.** Unique folder names keep a bare slug; 638 shared names get qualifiers or a
   primary topic (74 primaries) and a disambiguation list.
6. **Link.** Parent and children, `partOf` (4,410 pages), categories (183, articles only),
   See also (up to 8 per article, every non-root article has some).
7. **Normalize and write.** `normalizeIndex` redacts, undashes, rolls dates up the tree in
   UTC, then the file is written to `data/index.json.<pid>.tmp` and renamed into place
   (atomic, B:629-634). Console: `indexed 5484 folders (958 articles, 172 repos, 183
   categories) from ~/Programming in 51029 ms`.
8. **Load.** The server stats `data/index.json` on every data access and reloads when the
   mtime changes (D:32-64). No restart, no file watcher.
9. **Search and read.** A MiniSearch engine is built lazily on the first search after a
   change (about 240 ms), then `/`, `/search`, `/wiki` and `/api/suggest` serve from it.

## The crawl (rules)

- **Roots.** A leading `~` becomes the home folder (B:95; note `~foo` becomes
  `$HOME/foo`), then `path.resolve`. A missing root logs `skip missing root ...` and is
  skipped. A root is labelled with `~` in place of the home path (`~/Programming`).
- **Depth.** Children are crawled while `depth < maxDepth` (B:409), so maxDepth is
  inclusive. At depth 6 a folder with subfolders gets `deeper = {names, folders, files}`
  from `tally()` (B:239-277, a 200,000 file budget per folder); their files, bytes, dates
  and languages fold into it. Repos below the limit get no page and no git info.
- **Pruned folders** (B:39-45, B:102-103, case-sensitive): `node_modules`,
  `bower_components`, `jspm_packages`, `vendor`, `.git`, `.hg`, `.svn`, `.next`, `.nuxt`,
  `.svelte-kit`, `.turbo`, `.vercel`, `.cache`, `.parcel-cache`, `.output`, `dist`,
  `build`, `out`, `coverage`, `target`, `DerivedData`, `Pods`, `__pycache__`, `venv`,
  `.venv`, `site-packages`, `.mypy_cache`, `.pytest_cache`, `.ruff_cache`, `.gradle`,
  `.dart_tool`, `.idea`, `.vscode`, `.expo`, `storybook-static`; plus any name starting
  with `.`, ending `.app` or `.xcassets`, and Innernet's own `data/` folder.
- **Shown as left out.** `hiddenChildren` lists pruned names that do not start with `.`,
  plus `.git` (B:303). Other dot-folders vanish silently. The innernet page lists
  `data` and `node_modules`.
- **Never followed.** Symlinks (files and folders). A folder holding `pyvenv.cfg` (a
  Python virtualenv, any name) below the root returns nothing: no page, not counted.
  An unreadable folder is absent.
- **Files.** Dotfiles are noted only for `.git` detection: never stat'd, listed or
  counted, so `.env` never appears. Other files are stat'd for size, birth and mtime and
  counted by extension into languages. `fileCount` counts them all; `files` keeps up to 24
  names with secret-looking ones removed.
- **What is read.** README: the first file matching
  `/^readme(\.(md|mdx|markdown|txt|rst))?$/i`, first 14,000 bytes. `CLAUDE.md`, else
  `AGENTS.md` (exact case), first 20,000 bytes. One manifest by precedence:
  `package.json` (400,000 bytes; falls through on bad JSON) > `pyproject.toml` >
  `Cargo.toml` > `go.mod` > `requirements.txt` (60,000 bytes each). Nothing else is ever
  opened: not `pubspec.yaml`, `Dockerfile`, `*.config.*`, source code or `.env`.
- **Git** (B:177-223), only with the folder's own `.git` (folder or file):
  `log --no-merges -n 6000`, `rev-parse --abbrev-ref HEAD`, `config --get
  remote.origin.url`, `rev-list --count --no-merges HEAD`, root-commit dates. Each call
  has a 10 s timeout. Dates are author dates; authors are names only, never emails.
  It keeps 15 recent commits, top 8 authors, 24 months of activity, and "on this day"
  commits (today's month and day in earlier years, frozen at index time).

## From folder to page

- **Kind** (B:443-451, first match wins):
  1. Own `.git`: `repo`.
  2. A manifest, or `pubspec.yaml`, or a README of at least 25 words: `project`.
  3. 2+ direct files, at least 60% documents (md, mdx, html, pdf, txt, docx, doc, rtf,
     pages, key, pptx, numbers, csv, xlsx): `docs`.
  4. 3+ direct files at least 60% media, or only media files and no subfolders: `assets`.
  5. Named like source (`src`, `lib`, `app`, `apps`, `packages`, `components`, `public`,
     `scripts`, `templates` and 30 more, B:49-54) or at least half code files: `code`.
  6. Otherwise `folder`.
  Then: a CLAUDE.md or AGENTS.md whose first prose paragraph qualifies turns any non-repo
  into `project` (B:451). Normalize turns a media-only `code` stub into `assets` (N:83).
- **Article or stub** (B:452): article when it is a root, a repo, a project, a docs folder
  with 4+ direct files, or has agent notes. Everything else is a stub. Docs folders with
  2 or 3 files stay stubs.
- **Summary** (effective rule in N:54-59): the first qualifying README paragraph (undashed),
  else the manifest description, else the agent notes if they describe rather than
  instruct. `firstParagraph` (T:79-96) skips headings, lists, tables, quotes, images,
  badges, HTML, link rows and anything under 40 letters, drops a closing lead-in sentence
  that ends in a colon, and clips to 420 characters at a sentence end. Notes that read as
  orders ("You...", "Always...", "This file provides guidance...") never become a summary.
- **Frameworks** (B:353-362): only from the folder's own manifest. `package.json`: exact
  dependency or devDependency name in `FRAMEWORKS` (B:69-84, e.g. `next` Next.js, `ai` AI
  SDK, `pg` PostgreSQL, `@radix-ui/react-dialog` Radix UI). Any other manifest: regexes in
  `PY_FRAMEWORKS` (B:85-91) over the joined dependency names (also for Cargo and go.mod).
  `pubspec.yaml` adds Flutter, `foundry.toml` adds Foundry. `*.config.*` files only add
  markers.
- **Git.** A repo with neither commits nor a branch has `git = null` (9 live). Remotes
  lose any login and become `https://` (B:117-122). A repo's first and last commit widen
  the folder's created and modified dates.
- **Dates.** `modified` = newest mtime of direct files; `created` = oldest birthtime,
  capped at that mtime (copied files keep old mtimes). Normalize rolls both up the tree,
  deepest first, through children and git, in UTC (N:88-92).
- **Categories** (articles only, B:550-581, then N:94-109), in this order: collection
  folders (an ancestor at depth > 0 with 3+ article children, not a code-dir name, not
  part of a project, with no manifest or kind folder/docs/assets; named after the folder,
  so same-named folders merge); `<Language> projects` (first non-markup language, not for
  docs); each framework; `Git repositories`; `Document collections`; `Started in YYYY`
  (not for kind folder); `Agent-ready projects` (has CLAUDE.md or AGENTS.md);
  `Articles lacking a README`; `Parts of <project>`.
  Example, the innernet article: experiments · ClaudeWorkspace · XO · TypeScript projects
  · Next.js · React · Tailwind CSS · Started in 2026.
- **See also** (B:584-612): articles below the root only. Features: frameworks (weight
  1.5), first 40 runtime dependencies, categories (minus Started and lacking README),
  name tokens longer than 2 letters (weight 2). Score = weighted overlap / (size A + size
  B - overlap + 1), +0.05 for the same parent folder, +0.03 if the other has a README,
  ×0.35 if the other belongs to a different project. Ancestors and descendants never
  pair. Keep scores above 0.12, top 8.
- **partOf** (B:533-548): the nearest ancestor below the root that has a manifest. Repos
  without a manifest and CLAUDE.md-only projects are never a partOf target; the root's own
  `package.json` is ignored. Set on stubs too.
- **Title** is the folder name, or `name (qualifier)` for a non-primary namesake. Never
  the manifest name (the comment at `lib/types.ts:45` is stale).

## Names

- Pages are grouped by lowercased folder name. `base()` only turns whitespace into `_`;
  case, parentheses and commas stay.
- A unique name keeps its bare slug: `/wiki/innernet`.
- In a shared group the **primary topic** (B:484-492) is a root if one is in the group,
  else the shallowest article when no other article shares its depth and every other
  namesake (stubs too) is deeper. Otherwise there is no primary.
- The primary keeps the bare slug. The others get `name_(nearest ancestor)`, growing to
  `name_(ancestor,_next_ancestor)` until the slug is free; if all ancestors are used up,
  `_2`, `_3`. Crawl order decides who gets the shorter qualifier.
- Disambiguation list order: articles first, then shallower, then newer (B:526-529).
  With a primary, the list lives at `<name>_(disambiguation)` and the primary article
  carries a hatnote. Without one, the bare name is the list. Lookups are case-insensitive
  (D:66-69); a trailing space is not trimmed.

Three real examples:

1. **xo-swarm**: six folders share the name. The primary is `xo-swarm`
   (`XO/ClaudeWorkspace/xo-swarm`, a repo at depth 3, shallower than the rest). The
   others: `xo-swarm_(quirq)` (a repo at depth 4), `xo-swarm_(docs-live-view)`,
   `xo-swarm_(by-project)`, `xo-swarm_(thoughts)` (under `research/observe/thoughts`)
   and `xo-swarm_(thoughts,_observe)` (under `xo/observe/thoughts`, crawled later, so its
   one-word qualifier was already taken). The article opens with the hatnote "For the
   five other folders named xo-swarm, see xo-swarm (disambiguation)."
2. **web**: five folders. The primary is the depth-3 article
   `ETHParis/safe-core-protocol-demo/web`, since every other `web` is deeper. Crawl order
   shows in the rest: `XO/ClaudeWorkspace/experiments/space-walk/web` is reached first
   ("experiments" sorts before "space-walk"), so it is `web_(space-walk)`, and the
   shallower `XO/ClaudeWorkspace/space-walk/web` becomes `web_(space-walk,_ClaudeWorkspace)`,
   titled "web (space-walk, ClaudeWorkspace)".
3. **src**: 204 folders and no primary, so `/wiki/src` is the disambiguation page itself
   (h1 "src", tab title "src (disambiguation) · Innerpedia · Innernet"). Entries read like
   `src (magnet)` or `src (client-direct, packages)`.

Bonus: the root `Programming` keeps the bare slug; a folder of the same name deep inside
the workspace is `Programming_(surshar)`.

## Search

- **Engine.** MiniSearch 7.2.0 over every page (S:96-126), rebuilt when the index file
  changes. Fields and boosts: name 6, title 3, summary 2, frameworks 1.6, categories 1.2,
  languages 1.2, path segments 1, dependencies (runtime and dev) 1, agent notes 1, README
  text (first 5,000 characters) 0.6. Agent notes are searchable even when they read as
  instructions, though they are then never shown.
- **Tokens.** Lowercased, split on whitespace and punctuation, so `linear_clone`,
  `LINEAR-CLONE` and `clone linear` behave alike.
- **Retrieval** (S:203-225). Terms of 2+ characters match as prefixes; terms of 5+
  characters allow typos (fuzzy 0.2: one edit for 5 to 7 letters, two for 8 to 12, three
  for 13 to 17; no transpositions). First every word must match (AND). If that finds
  fewer than 5 pages, pages matching some words (OR) are added below (the threshold is
  counted before filters).
- **Ranking.** Score = MiniSearch score × prior × name bonus.
  Prior (S:174-185): 1.8 for an article, 1 for a stub; ×1.25 repo; ×0.55 source-folder
  stub; ×0.8 when part of a project; ×1/(1 + 0.05 × depth); ×(1 + 0.25 × e^(-days/60))
  for recency, at most ×1.25. Name bonus: ×4 when the folder name equals the query, ×1.6
  when it starts with it. Sort by tier first: full matches, and articles whose name holds
  a distinctive query word (shared by at most 3 article names), sit above partial matches.
- **Operators** (`parseQuery` S:130-141, `matchesFilters` S:145-156). Operator names are
  case-insensitive, values are lowercased, quotes allow spaces (`in:"my folder"`), the
  last repeat wins, and there is no negation (`agent -in:x` is the same search as
  `agent in:x`; a lone `-in:x` leaves `-` as the search text, which matches nothing, so it
  finds 0 pages). Filters run after scoring; with no words at all, every page that passes
  is listed by prior.

| Operator | Exact meaning |
| --- | --- |
| `lang:X` | One of the page's top 3 languages (counted over its whole subtree) equals X. Aliases: ts, js, py, rs, sol, rb, sh. Big parent folders match too. |
| `in:X` | X is a substring of one of the page's ancestor folder names below the root. The page's own folder and the root never count, so `in:experiments` lists what is inside experiments. `in:xo` matched 3,742 pages. |
| `kind:X` | Exactly repo, project, docs, assets, code or folder. `kind:repos` finds nothing. |
| `fw:X` | A framework name, lowercased with dots and spaces removed, contains X. `fw:next`, `fw:nextjs`, `fw:next.js` are the same; `fw:react` also matches React Native. |
| `is:article` / `is:stub` | Articles only / stubs only. Any other `is:` value filters nothing but still shows a chip; `is:foo` alone lists all 5,484 pages. |

- **Tabs** (S:12-18, 158-171), overlapping: All · Projects (id `articles`: articles that
  are not docs, repos included) · Repositories (`kind repo`) · Documents (`kind docs`,
  articles and stubs) · Folders (every stub). 10 results per page; `?p=` is clamped to
  the last page.
- **Did you mean** (S:243-250, 383-414). Only words of 4+ letters that appear nowhere in
  the index are changed, and only into words from article names, within 1 edit (4 to 6
  letters) or 2 (7+), counting a swap of neighbours as one edit. It is offered only when
  the fixed query finds at least twice as many full matches. Example: `linaer` suggests
  `linear` (37 full matches against 5). With zero results and no fix, the nearest article
  name is offered instead. A suggestion hides the knowledge panel and related searches.
- **Knowledge panel** (S:255-261): the top result, if it is an article, when its name
  equals the query ignoring case, spaces, dashes and underscores (`xo swarm` finds
  xo-swarm), or it scores over 1.35× the second hit. Shown only on page 1 of the All tab.
- **Snippets** (S:322-345): from the summary, else README text, else descriptive agent
  notes, else a generated sentence. A 230-character window around the first hit; whole
  words starting with a matched term are marked, so typo matches highlight too. Rendered
  as React `<mark>` nodes, never HTML.
- **Related searches** (components/search/query-tools.ts:141-185): up to 8 `fw:`,
  `lang:`, `in:` refinements drawn from the top 30 hits, each kept only if it narrows the
  results to between 2 and 90% of the total.
- **Suggestions** (`suggest`, S:277-300; `/api/suggest`). Up to 7, over name, title,
  summary and frameworks only, OR-combined, prefix on every term, light typo tolerance.
  Operators are stripped, so `lang:rust` alone suggests nothing. The box debounces 90 ms,
  aborts the previous request, offers a last "Search everything for ..." row, and `/`
  focuses it from anywhere.
- **Terminal check.** `pnpm tsx --conditions=react-server scripts/try-search.ts "linear clone"`
  gives 25 results with best = linear-clone.

## Innerpedia

Page types, all served by `/wiki` and the one dispatcher `app/wiki/[slug]/page.tsx`
through `resolveSlug` (D:95-135):

| Type | URL | Notes |
| --- | --- | --- |
| Main page | `/wiki` | Welcome card with a globe of article sigils, Featured article, In the news, Did you know, On this day, Browse by category, Other areas. Times are relative to the index time. |
| Article | `/wiki/<slug>` | Projects, repos, docs collections, roots. |
| Stub | `/wiki/<slug>` | Every other folder. |
| Disambiguation | `/wiki/<name>_(disambiguation)`, or a bare shared name with no primary | "X may refer to:", grouped by enclosing project. |
| Category | `/wiki/Category:<Name>` | Case-insensitive, `_` reads as a space. Seven kinds: collection, language, framework, year, kind, maintenance, part. |
| Special | `Special:Random` (307 to a random article), `Special:AllPages`, `Special:Categories`, `Special:Statistics` | Names ignore case, spaces and underscores (Random needs exactly "random"). An unknown special returns 200 with a "No such special page" list. |
| Not found | anything else | "Nothing here, yet" (404). `/wiki/Help:Contents` and `/wiki/Help:Guide` (any case) answer 307 to the field guide at `/guide`; any other `Help:` page is a 404. |

**Article anatomy**, top to bottom (components/wiki/article-view.tsx):

1. Header: mono breadcrumb, title in Instrument Serif 40px (50px from sm) with the
   qualifier muted, tools ("Open in VS Code", "Search inside"), byline "From Innerpedia,
   the encyclopedia of you".
2. Hatnote, only on a primary topic.
3. Infobox (floats right from lg): sigil, name, Type, Location, Languages, Frameworks;
   Package (Name, Version, Manifest); Activity (Created, Last touched); Contents (Files,
   Size); Git (Commits, Branch, Repository).
4. Lead, written from facts as React segments. Live example: "innernet is a TypeScript
   Next.js application in the experiments collection of the XO workspace. It was created
   in October 2026. It holds 80 files across 15 folders, 637 KB in all." Then the summary.
5. Without a README, a notice: "This article was written from the folder alone. You can
   help Innerpedia by adding a README."
6. Contents: a sticky scroll-spy rail at xl, a folded box below.
7. Sections, each only when it has something to say: Overview (the README, or the
   CLAUDE.md quote), Structure (folder tree with share bars, files, deeper and left-out
   folders), Technology (language bar, frameworks, scripts, dependencies), History
   (commits, authors, 24-month sparkline, recent commits), See also, External links.
8. Foot: categories box and "This page was generated from <path> on <date>."

**Stubs** swap the contents rail for a Location rail (ancestors and up to 11 siblings),
use a compact infobox, a generated lead, a Contents section, a "Part of" chip, and close
with "This folder is a stub. You can help Innerpedia by adding a README."

**Identity.** Every page has a Sigil: the slug hashed (FNV-1a) into three hues, an oklch
gradient; circle for repos, 30% radius for projects and docs, 18% otherwise, muted for
stubs. Type: Instrument Serif (display), Newsreader (prose), Inter (UI), JetBrains Mono
(paths). Motion: `rise` (0.5 s fade and 6px lift, staggered 40 ms) and a slow aurora on
home; all cut under reduced motion.

## Privacy and security

- **Reads.** Only README, CLAUDE.md or AGENTS.md, and one manifest per folder, plus git
  metadata. Never `.env`, keys or source.
- **Secret-looking folders** (`/cred|secret|private|keys?$/i`, B:47): no file names,
  README, agent notes or manifest. Their sizes, languages, git subjects and authors are
  still collected, and their subfolders are crawled normally (the header comment at B:7-8
  overstates this). The regex also catches "monkey", "hotkeys", "Private Equity".
- **Secret-looking file names** (N:15-20) are hidden from listings: `.env*`, `*.pem`,
  `*.key`, `id_rsa`, names with secret, credential, token, password, cookie, and more.
  Harmless names like `tokenizer.py` or Keynote `.key` files are hidden too.
- **Redaction** (`redactSecrets`, T:176-193) replaces credential-shaped values with
  `[redacted]` in README text, manifest descriptions, commit subjects and git remotes:
  private keys, `user:pass@` URLs, Stripe, Anthropic, OpenAI, GitHub, Slack, AWS and
  Google key formats, JWTs, high-entropy `KEY=value` pairs, Bearer tokens. It runs at
  index time and again on every load, so older indexes are cleaned too. Agent notes that
  held a credential are dropped. Remotes lose embedded logins.
- **Own output.** `data/` is never crawled and is gitignored (`data/*.json`,
  `data/*.tmp`).
- **Network.** `pnpm dev` and `pnpm start` bind to 127.0.0.1. `proxy.ts` (the Next 16
  proxy) answers 403 "Innernet only answers to localhost." unless the Host is
  `localhost`, `127.0.0.1`, `[::1]` or a single-label `*.localhost`, on every path,
  static files included. This defeats DNS rebinding.
- **Browser.** CSP `default-src 'self'`, `connect-src 'self'` (under `next dev` also
  `ws: wss:` for hot reload, and `'unsafe-eval'` in `script-src`), `img-src 'self' data:`,
  `frame-ancestors 'none'`, `form-action 'self'`; plus `Referrer-Policy: no-referrer`,
  `nosniff`, `X-Frame-Options: DENY` (next.config.ts). The only browser request is the
  search box calling `/api/suggest`. Fonts are self-hosted by `next/font`. Pages are
  `noindex`. Every route is a GET read; nothing writes.
- **Rendering.** READMEs go through react-markdown with `skipHtml`; images are dropped;
  only http(s) links become links (new tab, `noopener noreferrer`). Snippets and leads
  are React nodes. `dangerouslySetInnerHTML` appears twice, never with index content: the
  static theme script (`app/layout.tsx`) and the guide's plates, SVG files read from
  `public/guide/plates/` (`components/guide/plate.tsx`; none are drawn yet, so sketches show).
- **One caveat.** `next dev` records request URLs, search queries included, in
  `.next/dev/trace`.

## Adding a site

A "site" on your internet is a folder. To give one a full article:

1. **Put it under a root** (`~/Programming`), no more than six folders down
   (`~/Programming/a/b/c/d/e/f` is the deepest that gets a page).
2. **Name it so the crawler reads it**: not starting with `.`, not a pruned name (`dist`,
   `build`, `vendor`...), not ending `.app`, not a symlink, no `pyvenv.cfg` inside. Avoid
   names matching `cred`, `secret`, `private` or ending in `key`/`keys`, or its README and
   manifest are never opened.
3. **Give it at least one ingredient below.**
4. **Run `pnpm index`** (about 51 s for `~/Programming`). The running server picks up the
   new file on the next request.
5. **Open it** at `/wiki/<folder-name>` (any case), or search for its name. If the name is
   shared, look for `name (parent)` or the disambiguation page.

What each ingredient changes:

| Ingredient | Kind and status | What appears on the page and elsewhere |
| --- | --- | --- |
| `README.md` with 25+ words | project, article | Summary (first prose paragraph of 40+ letters, up to 420 characters) as the second lead paragraph, in snippets, the knowledge panel, suggestions and See also glosses. Overview section renders it. Removes the "written from the folder alone" notice and the "Articles lacking a README" category. README text becomes searchable. Makes it eligible for Featured article (also needs a 120+ character summary, recent activity, and no enclosing project). |
| A manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `requirements.txt`) | project, article | Frameworks from dependency names: framework categories, the Frameworks infobox row, the noun in the lead ("Next.js application"), `fw:` matches. Technology section: scripts and dependencies (runtime solid, dev dashed). Infobox Package group (Name, Version, Manifest). Its description is the summary fallback. It becomes the `partOf` project for everything inside: "Part of" chips on stubs, "Parts of X" categories on inner articles. |
| `git init` plus a commit | repo, article | Round sigil. History section (figures, sparkline when 2+ active months, authors when 2+, recent commits). Infobox Git group. Lead sentence "Its Git history runs to N commits...". "Git repositories" category, Repositories tab, `kind:repo`, a 1.25× ranking lift, its latest commit subject under its In the news item, and a place in Ongoing, Gone quiet and On this day. |
| `CLAUDE.md` or `AGENTS.md` | project and article if its first prose paragraph qualifies | "Agent-ready projects" category and the lead line "It keeps instructions for coding agents in CLAUDE.md." Its first paragraph is searchable; if it describes rather than instructs, it can be the summary and is quoted in Overview when there is no README. |
| 4+ files, 60%+ of them documents (md, pdf, txt, html, docx...) | docs, article | "Document collections" category, Documents tab. Three documents and one other file is enough (4 files, 75%); four documents beside three code files is not (57%, a plain stub). With only 2 or 3 files in all it stays a docs stub. |
| Subfolders | (each its own page) | Structure section with a folder tree; three or more article children (and no manifest) make the folder a collection category for everything inside it. |

Every article that is not a plain `folder` also gets `Started in YYYY` (from its rolled-up
created date); a language category only when it holds a code language (a README, a
`package.json` and nothing else give none); and See also links computed from frameworks,
dependencies, categories and name words, when another article shares enough.

Verified by doing it (2 October 2026), in a scratch root indexed with `INNERNET_ROOTS`
and `INNERNET_OUT`: the guide's five steps, typed as printed (`pnpm init` here is pnpm
10.33, which also writes a `packageManager` line), give `weather-station`: kind repo,
article, summary from the README, frameworks Next.js and React, categories Next.js ·
React · Git repositories · Started in 2026, slug `weather-station`, lead "a Next.js
application ... Its Git history is a single commit by <author>". A README alone (30 words)
gives a project article; a title-only README a plain stub; `package.json` alone a project
whose summary is its description; `git init` and one commit a repo; a describing
CLAUDE.md a project with that paragraph as summary, an ordering one a project with none,
and one under 40 letters nothing; a plain folder a stub; `node_modules` and `build` are
listed as left out, `.hidden`, a symlink and a `pyvenv.cfg` folder vanish; `a/b/c/d/e/f`
gets a page and `g` below it only the tally. The folder recipe's `simulate()` was run on
all 228 of its states against the real indexer and the real lead: kind, article, summary,
files, frameworks, categories, tabs, operators, type label, sections and lead all agree.
Its slug agrees too, except when adding the folder would change an existing namesake's
slug (see Gotchas); no such namesake exists in the live index.

## Adding a root

- Add the path to `roots` in `innernet.config.json`, or run once with
  `INNERNET_ROOTS=~/a,~/b pnpm index` (replaces the config roots; an empty value indexes
  nothing). Then re-index.
- A root becomes a depth-0 article (always, B:452), typed "Root folder", the primary topic
  for its name (B:485), labelled `~/...`, never a collection and never a `partOf`
  target. Its own folder name is never part of `relPath`, so `in:<root name>` does not
  list the root's contents; it finds only pages under some other folder of that name
  (`in:programming` finds 1 page here, inside the deeper `Programming_(surshar)`).
- Footers list every root: "Indexed X ago from ~/Programming".
- The server only reads `<cwd>/data/index.json`; an index written elsewhere with
  `INNERNET_OUT` cannot be previewed in the browser. Terminal scripts can read it: run
  `try-search` from a folder whose `data/index.json` is the test file (verified).

## Contributing

**Setup.** `pnpm install`, `pnpm index`, `pnpm dev` (port 3470, 127.0.0.1). The dev server
must run from the project folder (the index path is cwd-relative). The first run needs
network once to fetch the fonts. Installed: next 16.3.8, react 19.3.0, tailwindcss
4.3.3, typescript 5.9.3, minisearch 7.2.0; pnpm 10, node 23.

**The loop.** There is no lint, test or format tooling.

| Check | Command | Today |
| --- | --- | --- |
| Types | `pnpm -s typecheck` | exits 0 in about 1.1 s |
| Search core | `pnpm tsx --conditions=react-server scripts/try-search.ts "linear clone"` | 25 results, best linear-clone. Without the condition it throws (`server-only`). |
| Visual | `scripts/shot.sh "/wiki/innernet" out.png 1440 2400 dark` | about 1.1 s; reports `HORIZONTAL OVERFLOW` and culprits. Port fixed at 3470, emulates `prefers-color-scheme`, no mobile UA. |
| Indexer | `INNERNET_ROOTS=~/small/dir INNERNET_OUT=/tmp/x.json pnpm index` | keeps the real index untouched (verified: `data/index.json` mtime and size unchanged across every test run; a 35-folder root indexes in about 0.5 s) |
| Routes | a 211-route crawler, `scratchpad/shots/crawl.mjs` in this session | 211 checked, 0 failing, median 40 ms. Not in the repo yet; copy it into `scripts/` and fix its hard-coded ROOT. |
| Dashes | `rg -n "[\x{2013}\x{2014}]" -g '!node_modules' -g '!.next' -g '!data' .` | 0 matches |

**Conventions.**

- Server first: 4 client components in the site (`search-box`, `theme-toggle`,
  `home/hero-search`, `wiki/article/contents-nav`) and 4 in the guide
  (`guide/copy-button`, `guide/folder-recipe`, `guide/guide-motion`, `guide/guide-ruler`);
  the only browser fetch is `/api/suggest`. Every route is `force-dynamic`. `lib/data.ts`,
  `lib/search.ts`, `components/search/query-tools.ts`, `components/wiki/main/insights.ts`,
  `components/guide/data.ts` and `components/guide/source.ts` import `server-only`. The indexer imports `lib/text.ts`, `normalize.ts` and `types.ts`;
  those and `links.ts`, `format.ts`, `lang-colors.ts` stay importable anywhere.
- Tokens: colours live in `app/globals.css` in four places (`:root`, the dark media query
  guarded by `:not([data-theme="light"])`, `[data-theme="dark"]`, `@theme inline`). Use
  the utilities (`bg-surface`, `text-muted`, `border-line`...), never hex in components.
- Links through `lib/links.ts`: `wikiHref`, `categoryHref`, `searchHref`, `vscodeHref`.
- Index text is rendered as React nodes (`Segment[]`, `Seg[]`) or react-markdown with
  `skipHtml`; no `dangerouslySetInnerHTML` with index content.
- No em or en dashes anywhere; `undash()` cleans indexed text. Encyclopedia voice, no
  exclamation marks.

**Recipe: a search operator.**
1. `lib/search.ts`: add the key to `ParsedQuery.filters` (:29) and `OPS` (:128), to the
   parse regex (:133), to the copy in `correction()` (:411), and the test to
   `matchesFilters()` (:145-156).
2. `components/search/query-tools.ts`: add it to `OP_RE` (:13) and `OP_LABEL` (:15-21;
   a `Record`, so typecheck fails until it is there). Optionally feed `relatedSearches()`.
3. Chips appear on their own (`operator-chips.tsx`). Optionally add a home example to
   `EXAMPLES` (`components/home/example-queries.tsx:8`), and update README.md and
   DESIGN.md. New `lang:` aliases go in both `search.ts:143` and `query-tools.ts:81`.

**Recipe: a Special page.**
1. Routing needs nothing: any `Special:` slug reaches `SpecialView`.
2. A redirect special goes in `app/wiki/[slug]/page.tsx` before render (like Random,
   :33-36).
3. A rendered one: a branch in `SpecialView` (`components/wiki/special-view.tsx:21-27`,
   key lowercased with spaces and underscores removed), an entry in `SPECIALS` (:14-19),
   a view built like `StatisticsView` with `PageTitle prefix="Special: "`, heavy work in
   `insights.ts` behind `once()`.
4. Link it from `LINKS` (`components/wiki/wiki-shell.tsx:9`, entries use
   `wikiHref("Special:Name")`) and `AREAS` (`components/wiki/main/browse.tsx:55`, entries
   use `slug: "Special:Name"`; the list calls `wikiHref` itself).

**Recipe: a framework detector.**
1. JavaScript: add `["dep-name", "Display Name"]` to `FRAMEWORKS` (B:69-84).
   Everything else: add `[/\bregex\b/i, "Display Name"]` to `PY_FRAMEWORKS` (B:85-91).
2. Optional prose: a noun in `NOUNS` (`components/wiki/article/lead.ts:53`, most specific
   first) and `APP_FRAMEWORKS` (`components/search/query-tools.ts:52`).
3. Re-index. The category, See also weight, `fws` search field, `fw:` operator, infobox,
   knowledge panel and result chips follow automatically.

**Recipe: an article section.**
1. New data: an optional field on `Page` (`lib/types.ts`), filled in `crawl()` (B:365-441),
   backfilled in `normalizeIndex` if it can be derived without the disk.
2. `components/wiki/article/<name>.tsx` exporting `hasX(page)` and `X({ page })`, like
   `technology.tsx` (:14, :77), using `Sub` from `parts.tsx`.
3. In `components/wiki/article-view.tsx`: add the id to `SECTION_IDS` (:19) so README
   headings cannot steal it, push a contents item (:43-52), render `<Section id title>`
   in order (:101-142). Stubs are separate (`stub-view.tsx`).

## Gotchas

- The last run took 51 s ("about a minute" in the docs), and `durationMs` is measured
  before normalize and the write.
- `INNERNET_ROOTS=""` writes an empty index; a non-numeric `INNERNET_MAX_DEPTH` gives
  NaN and only roots get pages. `INNERNET_OUT` and `INNERNET_MAX_DEPTH` are documented in
  README.md, CONTRIBUTING.md and the header of `scripts/build-index.ts`.
- Adding a folder can rename an existing one. A name held by one folder is a bare slug;
  when a second folder of that name appears, neither keeps it unless one is the primary
  topic. And when two namesakes need the same qualifier, the one the crawl reaches first
  takes the short one, so a new folder can push an old one to `name_(parent,_grandparent)`.
- A lone `-` (as in `-in:x` with no other words) is searched as text and matches
  nothing, so the query finds 0 pages instead of listing the filter's matches.
- maxDepth is inclusive: 6 means 7 levels of pages.
- A README alone needs 25+ words to make a project; agent notes promote only when their
  first prose paragraph qualifies.
- A README paragraph that held a credential can still become the summary, with
  `[redacted]` in it (one live summary does).
- Only one manifest is parsed; frameworks never roll up from children. TOML dependency
  parsing is loose and picks up keys like `build-backend`.
- Collection categories use the folder name, so two same-named folders merge into one
  category.
- Two different names that slug alike (`my app`, `my_app`) are not checked against each
  other; none collide today.
- `in:` is a substring match on ancestors only; `in:xo` matches 3,742 pages.
- `is:` knows only `article` and `stub`; anything else silently filters nothing.
- Suggestions ignore operators entirely.
- The Projects tab (id `articles`) includes repos and excludes docs articles; Folders
  means every stub.
- Unknown `Special:` pages return 200. The only `Help:` pages are `Help:Contents` and
  `Help:Guide`, both 307 redirects to `/guide`.
- The operator regex is copied in three places and `LANG_ALIASES` in two.
- `splitTitle`, `gloss` and the non-code language set each exist in more than one copy.
- The home page has no TopBar and its own aurora mask; Recently touched computes 8 chips
  but shows 3 to 6 by breakpoint.
- Stale docs: DESIGN.md omits `Special:Categories` and `is:stub`, gives article titles as
  44 to 52px (code: 40/50), and says tab counts are faint (code: muted).
  (The stale `lib/types.ts` comments on `title` and on the `project` and `docs` kinds
  were corrected on 2 October 2026.)
- The project folder is not yet under git (untracked in the ClaudeWorkspace repo).
