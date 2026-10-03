---
format: 1920x1080
duration: 169s
message: "Your folders are a web of their own: Innernet crawls them into a search engine and an encyclopedia, any folder can become a site, and anyone can help build it"
arc: Hook (your folders) → Promise (a web of your own) → I How it works → II Add a site → III Contribute → Close (callback to the folders)
audience: the user and future contributors to Innernet
mode: collaborative
---

# INNERNET · A field guide in plates

**Message.** Your folders are already a web. Innernet lets you search it and read it, any
folder can become a good site, and the code is small enough for anyone to help.

**Format.** 1920x1080, ~130s, soothing ElevenLabs narrator (picked by ear), synced captions,
a soft ambient music bed carved under the voice, quiet sound marks (pencil scratch on
draw-ons, a soft bell on chapter cards, key ticks on typing). Caption keep-out: content
lives in the top 83%; captions sit on a quiet band above the bottom ruler.

**The spine.** Every beat is an engraved plate in one surveyor frame, the way the
computing-age film is built: line work draws itself on in layers (construction, main,
detail, accent, labels), a persistent HUD holds the frame together, and real Innernet
screens are mounted as plates with FIG. numbers. Two running devices thread every beat:

- **The index counter** (top right, like the reference's ops/second): FOLDERS counts to
  5,484 in the open, ARTICLES reads 958 through chapter I, and ticks to 959 when the demo
  folder is indexed in chapter II (callback to F06). From F07 on, a small closed padlock
  sits beside it: private by design.
- **The path ruler** (bottom): a breadcrumb line `~/Programming ·· I ·· II ·· III` with a
  marker that travels as the film does, the landscape counterpart of the reference's year
  ruler.

**Brand (from ../DESIGN.md, the brand truth).**
Paper `#f7f5f0`, ink `#1c1b18`, ink-2 `#46433c`, muted `#7b766c`, hairline ink at 17%,
link blue `#2a52c4` (the only saturated accent, used for L-acc strokes and the counter),
aurora light peach `oklch(0.86 0.09 40)`, lavender `oklch(0.84 0.08 285)`, mint
`oklch(0.89 0.08 165)` as low glows. Night (chapter III): ink `#0f0f0e`, lines `#eceae3`,
link `#9db6ff`, aurora at 55%. Type: Instrument Serif (display, numerals, titles, the
*inner*net wordmark), Newsreader italic (plate lines, captions), JetBrains Mono (HUD,
labels, paths, commands), Inter (UI captures only). Per-folder sigils (three-hue gradients
from the slug) are the only other colour.

**Bans.** No fake Innernet UI: screens are real captures from localhost:3470. No glow
blobs as decoration (the aurora is light, motivated, low). No gradient text, no neon, no
cyan. No em or en dashes on screen. Motion failures to avoid: the slideshow (every beat a
fresh card: plates share the frame, HUD and ruler) and the screensaver (line work that
draws but says nothing: every plate carries one labelled idea).

**Held frame.** F10 (namesakes): the 204 `src` labels settle into one list and nothing
moves for a full second while the line lands.

**Truthfulness.** Every number, path, file name and screen is real (index of 2 October
2026). The demo folder in chapter II ("tide-pool") is illustrative; the command and its
output format are real, and the 958 → 959 tick shows that folder joining the index.

**Seams.** One direction rule: plates advance leftward. Cuts between plates carry a
chromatic-aberration spike and a flicker (as in the reference). Chapter cards enter on a
light leak. Chapter III arrives on a dusk fall (paper dims through amber light into
ink); the close returns on dawn.

## Changes from v1

- Voice: "Lily" (picked by ear from River, Lily, George, Brian).
- Music: "More cinematic" (more movement, swells at the chapter turns).
- Storyboard note, verbatim: "add that every thing remains private secure locally on your
  machine and nothing leaves your machine". Added Frame 7 "Stays on your machine" (plate:
  privacy), a persistent padlock in the HUD from F07, F06's line trimmed so privacy has its
  own beat, and the closing line now ends "and it never leaves your machine".
- Sketches: yes, sketches first.

## Locked

Layout confirmed at the sketch review; the build dressed it. Final timing, from the real
narration (`node src/film.mjs`):

    01  0:00.0    5.95s  Folders
    02  0:06.0   10.53s  A web of your own
    03  0:16.5    2.60s  Chapter I
    04  0:19.1   11.52s  The crawl
    05  0:30.6   15.78s  What it reads
    06  0:46.4    4.82s  One small index
    07  0:51.2   11.28s  Stays on your machine
    08  1:02.5    6.44s  Search
    09  1:08.9    5.66s  Innerpedia
    10  1:14.6    8.19s  Namesakes
    11  1:22.8    2.60s  Chapter II
    12  1:25.4    6.69s  Every folder is a site
    13  1:32.1    6.21s  README
    14  1:38.3    7.84s  Frameworks and history
    15  1:46.1    8.79s  One command
    16  1:54.9    6.54s  More roots
    17  2:01.4    2.60s  Chapter III
    18  2:04.0   12.07s  The codebase
    19  2:16.1    8.53s  Recipes
    20  2:24.6   12.57s  The loop
    21  2:37.2   11.62s  Close
    total 2:48.8 (168.837s)

## Frame 1: Folders (0:00 to 0:07)

- scene: An engraved radial tree of the real ~/Programming folders draws on from the centre; FOLDERS counts up
- duration: 7s
- transition_in: cut
- voiceover: "Somewhere on your machine are thousands of folders. Everything you ever started."
- blueprint: zoom-out-workspace-reveal
- rules: svg-path-draw, counting-dynamic-scale, ambient-glow-bloom
- src: index.html#s01
- poster: 5s
- status: animated

Open tight on one real label (`linear-clone`) at the centre of the plate, ink lines
already moving at 0.1s. One decelerating pull-back reveals the whole tree: rings for depth
0 to 6, hundreds of hairline branches with faint mono names. The HUD and frame draw in at
the edges; FOLDERS 0 → 5,484. Morning aurora light rises behind. Sound: pencil on paper.
No: generic folder icons, stock "data" particles.

## Frame 2: A web of your own (0:07 to 0:14)

- scene: The tree recedes into light; the *inner*net wordmark draws on; dek "A search engine and an encyclopedia, for everything you have made"
- duration: 7s
- transition_in: crossfade
- voiceover: "Innernet turns them into a web of your own. A search engine, and an encyclopedia."
- blueprint: logo-assemble-lockup
- rules: svg-path-draw, ambient-glow-bloom
- src: index.html#s02
- poster: 5s
- status: animated

The tree stays as a ghost texture at 15%. The wordmark's outline draws, then fills ink,
the italic *inner* last. Two small plate tabs land under it: a search box line and the
*Inner*pedia mark. This is the value claim, landed by beat 2.

## Frame 3: Chapter I card (0:14 to 0:16.5)

- scene: Ghost numeral I fills the plate; "How it works" in display serif; gloss "crawl · index · read"
- duration: 2.5s
- transition_in: light-leak
- voiceover: none (breath)
- blueprint: titlecard-reveal
- src: index.html#c1
- status: animated

The ruler marker slides to I. Soft bell.

## Frame 4: The crawl (0:16.5 to 0:26)

- scene: FIG. 1 THE CRAWL: depth rings 0 to 6, the indexer's lens sweeping, node_modules / .git / dist / .next drawn then struck through in link blue
- duration: 9.5s
- transition_in: chromatic cut
- voiceover: "It starts with a crawl. The indexer walks six levels deep, and quietly skips the noise: dependencies, builds, caches."
- blueprint: none (plate)
- rules: svg-path-draw, multi-phase-camera, css-marker-patterns
- plate: crawl
- src: index.html#s04
- status: animated

Caption block bottom-left like the reference: big numeral "6", "LEVELS DEEP", title "The
crawl", line "Dependencies, builds and caches are skipped." Camera pushes slowly toward
ring 6. Strike-throughs land on the word "noise".

## Frame 5: What it reads (0:26 to 0:36)

- scene: FIG. 2 WHAT IT READS: an exploded folder, leader lines from README / package.json / .git / CLAUDE.md to "summary", "frameworks", "history", "notes for agents"; a sealed .env with "never read"
- duration: 10s
- transition_in: chromatic cut
- voiceover: "From each folder it reads only a few things: the README, the package file, the git history, notes left for agents. Never your secrets."
- rules: svg-path-draw, depth-of-field-blur
- plate: anatomy
- src: index.html#s05
- status: animated

Each ingredient's leader line draws as the narrator names it. On "Never your secrets" the
.env glyph closes under a ruled seal and everything else dims for a breath.

## Frame 6: One small index (0:36 to 0:43)

- scene: An engraved ledger page titled data/index.json; three numerals count up: 5,484 folders · 958 articles · 172 repositories; "under a minute · 7.9 MB"
- duration: 7s
- transition_in: chromatic cut
- voiceover: "In under a minute, it all becomes one small index."
- blueprint: dataviz-countup
- rules: counting-dynamic-scale, svg-path-draw
- plate: pipeline
- src: index.html#s06
- status: animated

The HUD counter switches from FOLDERS to ARTICLES 958 here and keeps it.

## Frame 7: Stays on your machine (0:43 to 0:50)

- scene: FIG. 3 PRIVATE BY DESIGN: the machine drawn as a sealed engraved enclosure; inside it index.json, search and Innerpedia; one gate marked "127.0.0.1 · localhost only"; outside, three arrows toward "cloud", "telemetry", "third parties" stop at the wall and are struck through; a ruled seal closes the gate
- duration: 7s
- transition_in: chromatic cut
- voiceover: "And all of it stays private. The index, the search, every page: it lives on your machine, and nothing ever leaves it."
- rules: svg-path-draw, depth-of-field-blur, ambient-glow-bloom
- plate: privacy
- src: index.html#s07
- poster: 5s
- status: animated

Caption block: big "0", "BYTES SENT", title "Private by design", line "Secrets are never read.
The server answers only this machine." The outward arrows draw, hit the wall, and are
struck through in link blue on "nothing ever leaves it". Held stillness for half a second
after the seal lands. The HUD gains a small closed-padlock glyph beside the counter and
keeps it for the rest of the film.

## Frame 8: Search (0:50 to 0:57)

- scene: FIG. 3: the real results page for "linear" mounted as a plate, slow 3D push; callouts "highlighted snippets", "knowledge panel", "operators: lang:rust"
- duration: 7s
- transition_in: chromatic cut
- voiceover: "Two readers share it. Search finds anything you type, in a few milliseconds."
- blueprint: device-surface-showcase
- rules: coordinate-target-zoom, svg-path-draw
- capture: /search?q=linear (light, 1600x1000 @2x)
- src: index.html#s07
- status: animated

## Frame 9: Innerpedia (0:57 to 1:04)

- scene: FIG. 4: the real linear-clone article as a plate; callouts "lead written from metadata", "infobox", "history from git"
- duration: 7s
- transition_in: whip (leftward)
- voiceover: "And Innerpedia gives every project an article, written from what is inside it."
- blueprint: device-surface-showcase
- rules: coordinate-target-zoom
- capture: /wiki/linear-clone (light, 1600x1000 @2x)
- src: index.html#s08
- status: animated

## Frame 10: Namesakes (1:04 to 1:10)

- scene: FIG. 5 NAMESAKES: 204 tiny "src" labels scattered across the plate gather into one list; numeral "204"; the real src disambiguation page edge visible
- duration: 6s
- transition_in: chromatic cut
- voiceover: "Even namesakes are handled. Two hundred and four folders called src, one tidy page."
- rules: depth-scatter-assemble, svg-path-draw
- plate: names
- src: index.html#s09
- status: animated

The held frame: once the list settles, one second of stillness.

## Frame 11: Chapter II card (1:10 to 1:12.5)

- scene: Ghost numeral II; "Add a site"; gloss "every folder is already one"
- duration: 2.5s
- transition_in: light-leak
- voiceover: none (breath)
- blueprint: titlecard-reveal
- src: index.html#c2
- status: animated

## Frame 12: Every folder is a site (1:12.5 to 1:19)

- scene: FIG. 6 ADD A SITE: five engraved stations on one long plate (folder, README, manifest, git, index); a fresh folder sigil "tide-pool" appears at station 1
- duration: 6.5s
- transition_in: chromatic cut
- voiceover: "Every folder is already a site. A little care makes it a great one."
- blueprint: spatial-pan-stations
- rules: svg-path-draw, nudge-curve
- plate: add-site
- src: index.html#s11
- status: animated

Frames 12 to 15 are one continuous camera pan across this plate, station by station.

## Frame 13: README (1:19 to 1:26)

- scene: Station 2: an engraved README page, its first paragraph underlined in link blue, a leader line carrying it into a real search snippet (linear-clone's actual summary)
- duration: 7s
- transition_in: camera pan
- voiceover: "Start with a README. Its first paragraph becomes the summary you see in search."
- blueprint: spatial-pan-stations
- rules: css-marker-patterns
- src: index.html#s12
- status: animated

## Frame 14: Frameworks and history (1:26 to 1:33)

- scene: Stations 3 and 4: package.json with "next" → chips Next.js · React · Tailwind CSS; .git → a 24-month commit sparkline draws on
- duration: 7s
- transition_in: camera pan
- voiceover: "Add a package file, and it learns your frameworks. Add git, and it gains a history."
- blueprint: spatial-pan-stations
- rules: stat-bars-and-fills
- src: index.html#s13
- status: animated

## Frame 15: One command (1:33 to 1:41)

- scene: Station 5: an engraved terminal; "pnpm index" types on; the output line in the real format; ARTICLES 958 → 959; tide-pool's sigil blooms in its own three hues
- duration: 8s
- transition_in: camera pan
- voiceover: "Then run one command. Your new site appears, with its own article and its own colours."
- blueprint: typewriter-reveal
- rules: context-sensitive-cursor, counting-dynamic-scale, ambient-glow-bloom
- src: index.html#s14
- status: animated

Key ticks while typing. The counter tick is the callback to F06.

## Frame 16: More roots (1:41 to 1:47)

- scene: innernet.config.json engraved: roots ["~/Programming", "~/Documents/notes"]; the second root draws in and a second set of depth rings opens beside the first
- duration: 6s
- transition_in: chromatic cut
- voiceover: "Want more of your machine in it? Add a root folder, and the crawl reaches further."
- rules: svg-path-draw, center-outward-expansion
- plate: crawl (second centre)
- src: index.html#s15
- status: animated

## Frame 17: Chapter III card (1:47 to 1:49.5)

- scene: Dusk fall: paper dims through amber light into ink; ghost numeral III; "Contribute"; gloss "small, readable, yours"
- duration: 2.5s
- transition_in: dusk (theme crossfade through light leak)
- voiceover: none (breath)
- blueprint: titlecard-reveal
- rules: theme-crossfade-morph
- src: index.html#c3
- status: animated

## Frame 18: The codebase (1:49.5 to 1:58)

- scene: FIG. 7 THE CODEBASE (night): scripts/build-index.ts → data/index.json → lib/data.ts and lib/search.ts → app/ pages → components/, with proxy.ts at the gate; link-blue light flows along the arrows
- duration: 8.5s
- transition_in: chromatic cut
- voiceover: "Innernet is small and readable. One script writes the index. Two libraries read it. Pages render on the server."
- rules: svg-path-draw, svg-icon-enrichment
- plate: codebase
- src: index.html#s17
- status: animated

## Frame 19: Recipes (1:58 to 2:05.5)

- scene: Four engraved index cards: "A search operator · lib/search.ts", "A special page · components/wiki/special-view.tsx", "A framework · scripts/build-index.ts", "An article section · components/wiki/article-view.tsx"
- duration: 7.5s
- transition_in: chromatic cut
- voiceover: "A new search operator, a special page, a section on every article: each lives in one known place."
- blueprint: grid-card-assemble
- src: index.html#s18
- status: animated

## Frame 20: The loop (2:05.5 to 2:13.5)

- scene: FIG. 8 THE LOOP: an engraved cycle, edit → typecheck → crawl → screenshot → pull request, a marker orbiting
- duration: 8s
- transition_in: chromatic cut
- voiceover: "Make the change. Check the types. Crawl the pages. Look at a screenshot. Then open a pull request."
- rules: svg-path-draw, orbit-3d-entry
- plate: contribute
- src: index.html#s19
- status: animated

Each station lights as it is named.

## Frame 21: Close (2:13.5 to 2:21.5)

- scene: Dawn returns; the folder tree from F01 comes back lit with sigil colours; the *inner*net wordmark; "Private · local · yours" and "localhost:3470/guide"
- duration: 8s
- transition_in: dawn (theme crossfade)
- voiceover: "Your folders were always a web. Now you can wander it, and it never leaves your machine."
- blueprint: logo-assemble-lockup
- rules: ambient-glow-bloom
- src: index.html#s20
- poster: 6s
- status: animated

Callback to F01. Three seconds of hold after the line. The music resolves.
