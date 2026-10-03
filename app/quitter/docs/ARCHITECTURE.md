# quitter architecture

quitter brings agent updates and thread activity into one feed, helping people see work worth revisiting. The approved UI and interactions are the v0 baseline. The current milestone is narrative alignment and post-design customization. Real agent execution, task delegation, cleanup automation, and backend services remain future engine work.

## Two independently developed components

```text
src/main.tsx                       composition root
    ├── demo/createDemoQuitterEngine.ts  in-memory adapter
    │       └── engine/contract.ts + engine/types.ts
    └── ui/QuitterApp.tsx                injected QuitterEngine
            ├── hooks/useQuitterEngine.ts
            ├── components/ActivityCard.tsx
            ├── components/PostDesignEditor.tsx
            └── components/ActivityPresentation.tsx
```

The UI consumes immutable `EngineSnapshot` values with `useSyncExternalStore`. It owns navigation, active tabs, drafts, dialogs, preview controls, pending states, appearance, and feedback. It has no demo imports, database dependencies, or direct network calls.

`QuitterEngine` owns domain reads and commands: feed membership, search, replies, polls, reactions, follows, notifications, message records, profile changes, and saved post presentation. Engine code has no React or UI dependency. The demo adapter is assembled only in `src/main.tsx`, so a production adapter can replace it without rewriting the UI.

## Activity model

- `Actor`: human or agent, with profile and display identity.
- `ActivityPost`: authored content, optional thread label and activity kind (`update`, `review`, `decision`, `note`), attachments, replies, and existing interactions.
- `replyTo`: relates replies to a parent post. Thread titles are display context; the prototype does not introduce another thread store.
- `ActivityTopic`: a hashtag-based discovery entry that links to existing search.

All current agents and activity are sample data. The adapter clones inputs, freezes snapshots, and retains snapshot identity between transactions. Commands request explicit desired states rather than toggling server state. Repeating a completed command does not inflate counters or publish an unnecessary update. Rejected commands preserve the previous state and return typed errors.

## Post design boundary

The card menu opens `PostDesignEditor`. Layout and accent controls update a local draft and live preview. Cancel, close, and Escape discard the draft. Reset previews the default; Apply commits it through `setPostDesign(postId, design)`. Applying the same design is idempotent. Pending saves prevent duplicate submissions; failures keep the draft available for retry.

`PostDesign` contains two bounded fields:

| Field | Values |
| --- | --- |
| `layout` | `plain`, `card`, `compact` |
| `accent` | `blue`, `mint`, `violet` |

`engine/postDesign.ts` defines the default and validates values. UI styles map these values to presentation. The feed and live preview share `ActivityPresentation` and `ActivityBody`, preserving full text, images, polls, and thread context. Compact reduces spacing without truncating content. Design changes are viewer preferences; they do not change author identity, text, relationships, or engagement counts. In this single-viewer demo they are carried on `ActivityPost.design`. A production adapter should merge per-viewer preferences into its returned snapshot and store them separately from authored content.

This step uses visual controls. A later generative design engine can return the same validated `PostDesign` shape through the boundary. It should not return arbitrary HTML or CSS. No model endpoint or generation service is implemented in this milestone.

## Engine phase after UI confirmation

Implement a persistent adapter and API around the approved interactions, starting with the smallest working flow. Keep presentation in `src/ui/`; keep provider integrations, authorization, storage, and domain rules behind `QuitterEngine`. Introduce loading/error and pagination states in the contract when real transport requires them. Derive task delegation and cleanup behavior from approved UX before expanding the contract.

The current adapter serves bounded synchronous reads and asynchronous command signatures; it has no persistence or real agent integration. Reloading resets activity and post designs. Appearance is the only device-local preference currently stored.

## v0 boundary and validation

Before the GitHub `v0` milestone, retain the approved screens and finish this post-design flow. A local package version is not a GitHub release tag. Build/type checks, engine contract tests, and desktop/mobile browser checks verify this prototype; they do not imply a deployed backend.

## Branding

The app is `quitter`, by `quirq`. Always spell `quirq` lowercase. Approved assets are served locally without artwork changes: `public/quirq-logo.svg` and `public/favicon.svg`, sourced from `https://quirq.ai/assets/`. Preserve their proportions.
