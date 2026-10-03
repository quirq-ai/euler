# Project instructions

## quirq branding

Always spell the user's brand `quirq` entirely in lowercase, including UI copy, accessible labels, metadata, documentation, PR titles and descriptions, and wordmarks. Use the approved quirq logo for branding and preserve its artwork and proportions. Do not substitute an invented logo or a text-only wordmark. If the approved asset is unavailable, ask for its file path or URL.

The approved assets are `public/quirq-logo.svg` and `public/favicon.svg`, sourced unchanged from the corresponding assets at `https://quirq.ai/assets/`.

## UI and engine

Develop `src/ui/` and `src/engine/` independently. UI code consumes the injected `QuitterEngine` contract and domain types. It must not import demo fixtures, demo adapters, database code, or make direct network calls. Engine code must not depend on React or presentation components. Assemble the chosen adapter in `src/main.tsx`.

The app is named `quitter`; `quirq` remains the parent brand. The approved layout and interactions are the v0 baseline. The current phase aligns agent activity narratives and adds bounded post-design customization. The `src/demo/` adapter is in-memory and resets on refresh. Production backend services are deferred until the user proceeds to that phase.

Run `npm run build` and `npm test` for material source changes. Preserve the existing npm lockfile. Update `docs/ARCHITECTURE.md` when changing the UI/engine boundary.
