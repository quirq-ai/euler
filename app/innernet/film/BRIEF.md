---
workflow: general-video
flow: automation
storyboard: yes
message: "Your folders are a web of their own: Innernet crawls them into a search engine and an encyclopedia, any folder can become a site, and anyone can help build it"
destination: embed
aspect: 1920x1080
language: en
audience: the user and future contributors to Innernet
length: ~120s
angle: field-guide walkthrough
voice: elevenlabs:lily:pFZP5JQG7iQjIQuC4Bku
---

## Intent

The explainer film for Innernet, embedded at the top of the in-app field guide (`/guide`).
Three chapters, about 40 seconds each: how it works (crawl, index, the two readers:
search and Innerpedia), how to add a site (what each ingredient of a folder becomes on its
page, the five steps, new roots), and how to contribute (the codebase map, the loop, the
conventions). A visual walkthrough, engaging.

User direction, verbatim: "use soothing pleasing aesthetic appealing voices", "look at
/brag skill for help", "make sure to make videos the quality of evolution of computing in
transitions and aesthetics".

## Assets

- ../DESIGN.md (the app at the repo root), brand truth: warm paper and ink, one link blue, the aurora,
  Instrument Serif / Newsreader / Inter / JetBrains Mono, per-folder sigils.
- the app at the repo root (running at http://localhost:3470), the real app; its screens are captured
  as plates for the "show the thing" beats.
- the computing-age film (a separate local project), the quality reference ("Hephaestus"): engraved plates drawn on layer
  by layer (L-con, L-main, L-det, L-acc, L-lbl), a running HUD index, a timeline ruler,
  chapter cards, chromatic aberration on cuts, film grain and flicker. Match its craft in
  transitions and aesthetics, translated into Innernet's palette and landscape 16:9.

## Customizations

- AI voiceover with synced captions: ElevenLabs **Lily** (velvety British, warm and
  clear), picked by ear from four samples (River, Lily, George, Brian).
- Music: a cinematic ambient bed (ElevenLabs music), "more cinematic" than the first
  sample: more movement, swells at the chapter turns, carved under the voice.
- Privacy made explicit (user, at plan review): "add that every thing remains private
  secure locally on your machine and nothing leaves your machine". A dedicated beat in
  chapter I plus the closing line carry it.
- Diagram plates are shared with the /guide page (`../public/guide/plates/<id>.svg`):
  pipeline, crawl, anatomy, search, names, add-site, codebase, contribute, privacy.

## Notes

- From /brag: hook in the first 2 seconds, show the real product, specific not generic,
  every line held long enough to read, narration complements the visuals instead of
  reading them.
- No em or en dashes in any on-screen copy.
- Facts come from the guide's verified fact sheet (FACTS.md), never from memory.
