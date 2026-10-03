# The Innernet field guide film

A 2:49 explainer for Innernet, narrated by Lily (ElevenLabs), built as one HyperFrames
composition in an engraved-plate style. It plays at the top of the in-app field guide
(`/guide`) of the Innernet app at the repo root.

```bash
# from film/, after `pnpm install && pnpm index` at the repo root (the film draws your index)
npm install
node scripts/voice.mjs          # narration (only changed lines); needs ELEVENLABS_API_KEY in .env
node scripts/stt-check.mjs      # hear it back: transcribes each line, lists words that came out wrong
node assets/plates/src/<id>.mjs # re-engrave a plate (writes the film and guide copies)
./scripts/finish.sh             # build index.html, carve the music under the voice, lint
npx hyperframes check           # the gate: runtime, layout, motion, contrast
npx hyperframes render --quality delivery -o renders/innernet-explainer.mp4
node scripts/deliver.mjs renders/innernet-explainer.mp4   # web copy, captions, poster, into the guide
```

| Path | What |
| --- | --- |
| `BRIEF.md`, `STORYBOARD.md`, `storyboard.html` | the brief, the frame plan, the approved sketch sheet |
| `FACTS.md` | the verified fact sheet every line and label is checked against |
| `src/script.mjs` | the narration, and `SAY`: how Lily should pronounce words she slurs (README, Innernet, Innerpedia); captions keep the written words |
| `src/film.mjs` | frames and timing (scene length follows the real voice) |
| `src/runtime.js`, `src/film.css`, `src/build.mjs` | the engine: theme blend, HUD, captions, cut effects, assembly |
| `src/scenes/*.mjs` | one module per scene; contract in `src/ENGINE.md` |
| `assets/plates/` | the nine engraved plates, shared with the guide |
| `assets/audio/` | narration, the cinematic bed, sound marks |
| `scripts/frame.mjs` | screenshot any time of the film without HyperFrames |
