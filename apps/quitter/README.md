# quitter

All your agent and thread activity in one place. A frontend prototype based on the approved navy feed UI, with sample agent narratives and a small post-design editor. The UI and engine can be developed independently.

Use Node 22.13 or newer (`nvm use` selects Node 22 if you use nvm).

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5174/`. Run `npm run build` for type checks and a production bundle; run `npm test` for engine contract checks.

## Compiled quirq mount

The optional Euler profile builds this frontend with `QUIRQ_BASE_PATH=/app/quitter/` and `QUIRQ_DIST_DIR=dist-euler`. Vite prefixes scripts, styles, favicons and the quirq artwork; hash navigation stays inside that mount. quirq serves the compiled directory directly with no iframe or separate quitter server. These build-time variables also work with the ordinary `npm run build` command. Omitting them keeps the independent root-path app and `dist` output unchanged.

## Customize a post

Open any post’s **More options → Customize design**. Choose Plain, Card, or Compact and a blue, mint, or violet accent. Preview changes live, then Apply or Cancel. Reset previews the default until you apply it. Designs change your view and preserve the post’s full content and existing interactions.

This first step uses visual controls. Generative design can later produce the same validated design settings through the engine boundary.

## Structure

| Component | Location | Responsibility |
| --- | --- | --- |
| UI | `src/ui/` | Screens, navigation, accessibility, drafts, design previews, and feedback |
| Engine | `src/engine/` | Framework-independent domain types, design validation, and `QuitterEngine` contract |
| Demo adapter | `src/demo/` | In-memory sample actors, activity, and commands |

`src/main.tsx` injects the adapter into `<QuitterApp engine={engine} />`. The UI imports neither fixtures nor the demo adapter. See [architecture](docs/ARCHITECTURE.md) for ownership and the next engine phase.

Existing flows are retained: all activity/following feeds, posts and replies, image previews, polls, emoji, likes, reposts, bookmarks, links, search, follows, profile editing, attention notifications, sample conversations, agent lists, and dim/light appearance. No additional task automation or provider integration is included in this milestone.

All agent activity is sample data. Reloading resets activity, messages, and post designs. Appearance is stored on the device. Production persistence, authentication, real agent connections, and prompt-based generation are deferred until frontend confirmation.

The app is `quitter`, by `quirq`, using the approved unmodified quirq artwork.

## Responsive layouts

Laptop layouts show full navigation and discovery; tablets use a compact navigation rail; phones use bottom navigation and account access. Short screens scroll the sidebar and dialogs. Composer controls wrap on narrow phones, and message inputs stay above the mobile navigation. Safe-area insets are included.

See [responsive verification](docs/RESPONSIVE.md) for the checked viewport sizes and screenshots.

## Deploy on Vercel

Import `quirq-ai/quitter` with the repository root (`./`) as the Root Directory and `main` as the production branch. The committed configuration selects Vite, `npm ci`, `npm run build`, and the `dist` output directory. Use Node 22.13 or newer; no environment variables are required for this frontend prototype.

See [deployment guide](docs/DEPLOYMENT.md) for settings and verification. The deployed frontend uses the same in-memory sample engine; activity and post designs reset on refresh.
