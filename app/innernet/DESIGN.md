# Innernet design spec

Innernet is a personal internet: a search engine whose web is the folders on this
machine, and **Innerpedia**, an encyclopedia with an article for every project and a
stub for every other folder. It should feel like the early web's best ideas (a single
search box, blue links, the encyclopedia) remade with the calm and typographic care of a
good printed book.

**Mood:** a private library in morning light. Warm paper, black ink, one blue for links,
generous margins, nothing shouting. Delight comes from craft and from small jokes that
reward attention (stubs asking for a README, "Innnnnernet" pagination), never from
decoration for its own sake.

## Principles

1. **Type does the work.** Hierarchy comes from the four typefaces and scale, not from
   boxes, borders or colour. Prefer a hairline (`border-line`) to a card; prefer
   whitespace to a hairline.
2. **One accent.** `--link` blue is the only saturated colour in the chrome. All other
   colour comes from sigils and the home-page aurora.
3. **Every folder has an identity.** The `<Sigil>` (components/sigil.tsx) is a
   deterministic three-hue gradient per slug; a repository or project whose folder holds
   its own logo shows that instead, on a tile chosen from the logo's colours. Server
   components use `<PageSigil page>` (components/page-sigil.tsx), which picks the logo
   when there is one, wherever a page is represented: results, knowledge panel, infobox,
   lists of related pages, the Main page's boxes.
4. **The web's conventions are features.** Blue links that turn violet once visited,
   breadcrumbs above result titles, "About N results (0.01 seconds)", Wikipedia's lead
   paragraph, infobox, contents, hatnotes, "See also", categories at the foot. Keep them;
   make them beautiful.
5. **Server first.** Pages are Server Components that read `lib/data.ts` and
   `lib/search.ts` directly. The browser fetches from two of our own routes and nothing
   else: the search box asks `/api/suggest`, and the history recorder posts each page
   visited to `/api/activity` (same origin only). On the demo it posts only when the demo
   keeps a database, and the history page then reads and clears the visitor's own
   sessions there; otherwise the demo keeps history in the visitor's `localStorage`. No
   external requests from the browser, ever. Links out (GitHub, quirq, the AI
   assistants) are plain links that open in a new tab.
6. **Calm motion.** `rise` (fade + 6px lift) on first paint, staggered by ~40ms in
   lists; the slow aurora drift; things that ease in once as they scroll into view (the
   field guide's plates, the Main page's boxes); the home page's hand-off, where the
   first screen's aurora dims and the wordmark lifts as the guide arrives (only where
   the browser ties animation to scrolling); and the Innerpedia globe's slow turn.
   Everything respects `prefers-reduced-motion`: under it nothing moves on its own.
7. **Private by default.** What Innernet knows about this machine stays on it: the index,
   the history and their copy in PGlite (`~/.innernet/db`) never reach a server. The demo
   is the one exception, and it says so wherever history is mentioned (the banner, the
   history page, the guide, the README), at every width: visitors' pages and searches are
   kept 30 days, anonymously, under a hash of each tab's id, with no IP address or cookie,
   and a button clears them.

## Tokens (app/globals.css)

Use the Tailwind utilities generated from the tokens; never hard-code hex values in
components.

| Role | Utility | Notes |
| --- | --- | --- |
| Page | `bg-bg` | warm paper / near-black |
| Sunken (code, hover rows, chips) | `bg-bg-sunk` | |
| Raised surface (search box, panels, infobox) | `bg-surface` | |
| Primary text | `text-ink` | |
| Secondary text | `text-ink-2` | body copy that should recede a little |
| Meta text | `text-muted` | dates, counts, captions |
| Faint text | `text-faint` | placeholders, separators, kbd hints |
| Hairlines | `border-line`, `border-line-strong` | |
| Links | `.link` class, or `text-link hover:text-link-hover` | `.link` adds the visited colour |
| Notices (stub box, hatnote) | `bg-notice border-notice-line` | |
| Shadows | `shadow-soft`, `shadow-lift` | soft for resting surfaces, lift for popovers |

Dark mode is automatic (`prefers-color-scheme`) with a manual override
(`data-theme` on `<html>`, set by `<ThemeToggle>`). Every page must look right in both.

## Typography

| Face | Utility | Use |
| --- | --- | --- |
| Instrument Serif | `font-display` | wordmarks, article titles (44 to 52px), h2 (30px), big numbers, the knowledge-panel title |
| Newsreader | `font-serif` | encyclopedia prose (`.prose-wiki`, 18px / 1.68), lead paragraphs, Main page blurbs |
| Inter | `font-sans` (default) | UI, results, infobox labels, h3 |
| JetBrains Mono | `font-mono` | paths, breadcrumbs, file names, commit hashes, counts in tables |

- Italic Instrument Serif is the brand flourish (`<em>inner</em>net`). Use it sparingly
  for emphasis in display text only.
- Small caps style labels: `text-[11px] uppercase tracking-[0.12em] text-muted` (infobox
  section heads, panel labels).
- Numbers in tables and meta lines: `tabular-nums`.

## Shared pieces (already built, reuse them)

- `components/quirq-credit.tsx` `<BrandCredit>`: "Powered by quirq" in small muted
  type, with quirq in the display serif. A plain link goes to quirq's GitHub profile.
  Home centres the credit below its footer row; other pages keep it at the end of the
  footer, right-aligned on desktop and centred on phones. Keep attribution in the
  small print and use local type and colour tokens. Always spell the brand `quirq`
  in lowercase, including accessible labels, metadata and documentation. Use the
  approved quirq logo for attribution and preserve its artwork and proportions.
- `components/top-bar.tsx` `<TopBar q variant="search"|"wiki">`: sticky header with
  the quirq mark home, wordmark, compact `<SearchBox>`, link across, `<BrandLinks
  compact>` and the theme toggle.
- `components/brand-nav.tsx` `<BrandLinks>`: what every header carries on its right:
  the trail (`<HistoryNav>`: back, forward and the clock to `/activity`), the Guide
  button (to `/#guide`), quirq and GitHub. `compact` lets them give way on narrow
  screens (the Guide to its icon, GitHub off phones), to a search box in `<TopBar>` and
  to the Innerpedia link on home. Every header also has exactly one `<ThemeToggle>`,
  beside it.
- `components/search-box.tsx` `<SearchBox size="hero"|"compact">`: combobox with live
  suggestions, `/` to focus, Enter to search, arrow keys to pick a page.
- `components/sigil.tsx` `<Sigil seed={slug} name kind muted={!isArticle} size logo logoSurface>`;
  in server components, `components/page-sigil.tsx` `<PageSigil page={page|slug} size>`.
- `components/wordmark.tsx` `<Wordmark>` and `<PediaMark>`.
- `components/site-footer.tsx` `<SiteFooter links>`: the small print under results and
  Innerpedia pages (ways onward, index freshness, the `pnpm index` hint). Home keeps its
  own centred footer.
- `lib/data.ts`: `getIndex()`, `getPage()`, `getPages()`, `ancestors()`, `resolveSlug()`,
  `randomArticle()`.
- `lib/search.ts`: `search(q, {tab, page})` (its `best` picks the knowledge panel, its
  `didYouMean` covers near misses as well as empty results), `suggest()`, `displayPath()`,
  `fallbackDescription()`, `pageSummary()` (the summary minus agent instructions), `TABS`.
- `lib/format.ts`: `longDate`, `monthYear`, `timeAgo`, `bytes`, `plural`, `num`,
  `shortMonth`.
- `lib/links.ts`: `wikiHref`, `categoryHref`, `searchHref`, `vscodeHref`. Always build
  links with these; slugs contain parentheses, commas and spaces.
- `lib/text.ts`: `markdownToText`, `tidyGaps`, `undash`, `firstParagraph`,
  `redactSecrets`, `readsAsInstructions` (CLAUDE.md text that gives orders rather than
  describing), `isListableName`. Shared with the indexer.
- `lib/normalize.ts`: `normalizeIndex()`, run by the indexer before writing and by
  `getIndex()` on load, so an older index still meets the current rules.

## Pages

### Home `/`

One page in two movements: the search engine, then the field guide.

- **The first screen** is full-viewport, vertically centred slightly above the middle,
  with the `.aurora` field (three `<span>`s) behind the wordmark and search box, masked
  to a pool of light so the paper shows around it at every width.
- A header row across the top: the quirq mark home on the left; Innerpedia (kept on
  phones, where the footer is a whole guide away), `<BrandLinks compact>` (trail, Guide,
  quirq, GitHub) and the theme toggle on the right.
- Wordmark large (Instrument Serif ~96px desktop, ~64px mobile), `<em>inner</em>net`.
- One line beneath in `text-muted`: what this is, with live counts, e.g.
  "Your personal internet · 5,479 folders · 958 articles". Separators are middots; each
  count is a quiet link to where those things are listed.
- `<SearchBox size="hero" autoFocus>` at max-width ~620px, then two quiet pill buttons
  (**Search** and **I'm feeling curious**, which goes to `/wiki/Special:Random`), then a
  "Try" row of example operators.
- One quiet invitation to an AI (`<AskAnAiRow>`): "Work on Innernet with an AI like
  Claude, ChatGPT or Grok" (the demo: "Run Innernet on your own folders with..."), each
  name a plain link that opens the assistant in a new tab with the prompt written, and a
  **Copy prompt** button. Its headline links to the full card.
- "Recently touched": 6 to 8 articles with the most recent `modified`, each a sigil or
  logo + name chip linking to the article.
- At the foot of the screen, the cue: "The field guide" in small mono caps over a
  hairline with a drop of ink running down it.
- **The field guide** (`components/guide/field-guide.tsx`, `<section id="guide">`)
  follows: the title page (revealed as it scrolls in), the five chapters beside their
  sticky rail (a sticky chapter bar on phones), then the full AI card (`<AskAnAiCard>`,
  `#ask-an-ai`: the assistants as buttons, the prompt to copy, `claude` and `codex`
  one-liners), then the colophon. `/guide` redirects here for good (308 to `/#guide`).
- Footer, at the end of the page: Innerpedia, Field guide and Back to the top; "Indexed
  12 minutes ago from ~/Programming"; the `pnpm index` hint in mono; the quirq credit.
- If the index is missing, the home page says so plainly and shows `pnpm index`.

### Results `/search?q=&t=&p=`

- `<TopBar q>`. Under it a tab row (All, Projects, Repositories, Documents, Folders) with
  counts in `text-faint`, active tab ink with a 2px underline. Tabs keep `q`.
- Meta line: "About 36 results (0.004 seconds)" in `text-muted`, 13px.
- Two columns on desktop: results (max-width ~652px) and the knowledge panel (~360px,
  only when `best` exists). One column on mobile, panel moves above results.
- Each result:
  - Row 1: `<Sigil size={26}>` + a two-line source label: page name (14px ink) over the
    mono breadcrumb path (12px muted), like a site name over its URL.
  - Row 2: the title as a link (`font-sans` 20px, `.link`).
  - Row 3: snippet (14.5px `text-ink-2`, 1.55 line-height) with `<mark>` for hit
    segments; render segments as React nodes, never `dangerouslySetInnerHTML`.
  - Row 4: meta chips in `text-muted` 12.5px: primary language with a small coloured
    dot, up to two frameworks, "updated 3 days ago", commit count for repos, "stub" for
    non-articles.
  - Results rise in with a 40ms stagger.
- Knowledge panel: surface card with large sigil (64px), title in `font-display` 34px,
  kind line ("Next.js application in experiments"), the summary in `font-serif`, a fact
  table (Language, Frameworks, Created, Last touched, Files, Size, Commits, Location in
  mono), "See also" sigil chips, and "Read on Innerpedia →".
- Operators: `lang:rust`, `in:experiments`, `kind:repo`, `fw:next`, `is:article`. When
  present, show them as removable chips above the meta line.
- No results: a kind message, "Did you mean *x*?" when `didYouMean`, and three
  suggestions (check spelling, try fewer words, browse Innerpedia).
- Pagination at the foot: the wordmark stretched to the page count, "I n n n e r n e t"
  style: one `n` per page, current page's `n` in ink, others link-blue, with
  Previous / Next. Cap at 10 visible pages.

### Article `/wiki/[slug]` (page with `isArticle`)

Modern Wikipedia structure, book-quality typography.

- `<TopBar variant="wiki">`.
- Three columns on wide screens: sticky contents (left, ~200px), article (~720px),
  infobox floated right inside the article column on large screens, stacked above the
  lead on small screens.
- Hatnote when the page is a primary topic with namesakes: italic, indented, "For other
  folders named *XO*, see XO (disambiguation)."
- Title: `font-display` ~48px, then a hairline, then "From Innerpedia, the encyclopedia
  of you" in muted italic serif, 14px.
- **Lead paragraph** generated from metadata in encyclopedia voice, in `font-serif`
  with the title in bold: "**linear-clone** is a TypeScript Next.js application in the
  experiments collection of the XO workspace. Created in March 2026, it was last touched
  3 days ago. It holds 214 files across 31 folders." Then the summary as its own
  paragraph if present.
- Sections (only render ones with data; each gets an `id` for the contents list):
  - **Overview**: the README rendered with `react-markdown` + `remark-gfm` inside
    `.prose-wiki`, headings demoted so the README's h1 never competes with the title,
    raw HTML not rendered, images hidden, relative links made inert.
  - **Structure**: the folder's children as a tidy tree (sigil-dot, name link, file
    counts, kind), plus excluded folders ("node_modules, .git excluded") and notable
    files in mono.
  - **Technology**: language bar (stacked horizontal bar, each language its own
    muted hue, legend beneath), frameworks, dependencies as mono chips (show 24, "and
    N more").
  - **History** (repos): commits-per-month sparkline for 24 months (inline SVG bars),
    first and latest commit, authors, and the 10 most recent commits as a timeline
    (date in mono, subject, short hash).
  - **See also**: related pages as sigil + title + one-line summary.
  - **External links**: Open in VS Code (`vscodeHref`), the git remote if any.
- Infobox: `bg-surface`, hairline border, 300px. Sigil (88px) centred on a soft tint
  of its own gradient, title in display serif, then label/value rows: Type, Location
  (mono, links up the tree), Language, Frameworks, Package, Version, Created, Last
  touched, Files, Size, Commits, Branch, Repository.
- Footer: categories box ("Categories: TypeScript projects · Next.js · ...", each linking
  to `Category:` pages), then "This page was generated from ~/Programming/... on
  2 October 2026." in faint text.

### Stub `/wiki/[slug]` (page without `isArticle`)

Same chrome, much shorter. Lead sentence from `fallbackDescription`, a Contents list of
children and files, then the stub box (`bg-notice`, small sigil, italic):
"*This folder is a stub. You can help Innerpedia by adding a README.*" Breadcrumb of
ancestors links upward. "Part of *linear-clone*" when `partOf`.

### Disambiguation

"**src** may refer to:" then a list grouped by enclosing project, each line a link plus
a short gloss ("source folder in linear-clone, 9 files"). Footer note in the Wikipedia
manner: "This disambiguation page lists folders that share the same name."

### Category `/wiki/Category:Name`

Title "Category: Next.js". Count line. Pages listed alphabetically under letter headings
in a responsive 3-column flow (CSS columns), each with a small sigil.

### Main page `/wiki`

Innerpedia's front page, a love letter to Wikipedia's.

- **The first screen** is the welcome and the globe. On the left: "Welcome to
  *Inner*pedia, the encyclopedia of you." with counts ("958 articles about 5,479
  folders"), a "Written from" line, and rows of portal links to the largest collections
  (or, in the demo, repositories) and languages. On the right: the globe, every tile a
  project (its logo, or its sigil) on a slowly turning sphere with latitude rings and
  orbits, over a soft pool of aurora. Drag or swipe to turn it, hover or focus for a
  name, arrow keys between tiles; it holds still under reduced motion. In the demo the
  organisation's avatar glows at its core.
- A cue at the foot of the screen, "Today on Innerpedia · date", leads to the boxes,
  which ease in as they scroll into view (they render visible without JavaScript).
- Two-column grid of boxes, each with a small-caps heading and a hairline:
  - **Featured article**: the most substantial recently-active article with a README.
    Sigil, title, first ~80 words of its summary, "Read more".
  - **In the news**: the 5 most recently modified articles, phrased as headlines
    ("linear-clone was updated 3 days ago").
  - **Did you know...**: 5 facts computed from the index ("...that the largest project
    is makepad, with 4,210 files?", oldest article, most commits, most-used framework,
    deepest folder).
  - **On this day**: commits from `git.onThisDay` across all repos, grouped by year.
    If none, the oldest anniversaries by `created` month/day.
  - **Browse by category**: top categories with counts.
- `Special:Random`, `Special:AllPages`, `Special:Statistics` linked in a quiet footer.

### Special pages

- `Special:Random`: redirect to a random article.
- `Special:AllPages`: every article A to Z, compact columns.
- `Special:Statistics`: counts, languages across everything, biggest folders, busiest
  repos. A small, handsome table page.

### History `/activity`

- `<TopBar>`, then "History" in the display serif with the stats (sessions, events,
  apps) and a two-week strip of small bars.
- Sessions newest first, grouped by day: start time, duration, event count, app badges,
  "This tab" for the current one, and a strip of the articles' sigils. Each opens onto
  its events merged across apps: time in mono, kind, app badge, the page as a link.
- A side column opens with the Database card (where the copy lives, its counts, the
  index it holds, Store now as a plain form, and `pnpm db:load`), then explains the
  format (one folder per session, one JSON Lines file per app), names the folder and
  gives the shell one-liner.
- In the demo the list is read from this browser's `localStorage`, merged with the copy
  the demo's database keeps when it has one (the fuller copy of each session wins). The
  header and the card say where it is kept and for how long, and one button clears both.
  Without a database the page says that nothing reaches the server.

## Voice

Plain, warm, slightly wry. Encyclopedia voice in article prose ("is a", "was created
in"). No exclamation marks. Never use em or en dashes in UI copy; use commas, colons or
middots.

## Accessibility

Semantic landmarks (`header`, `main`, `nav`, `aside`, `footer`), every icon button has a
label, focus rings visible (`:focus-visible` is styled globally), colour is never the
only signal, text contrast passes AA in both themes.
