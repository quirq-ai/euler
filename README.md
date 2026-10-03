# Euler

Euler is a local home for **Innernet**, **Quitter**, and **Instants**. One Node.js server serves the home screen, management controls, and all three applications at [localhost:2713](http://localhost:2713). The shared dock stays above every app; its opacity and Euler's Blobatar logo can be customized from Home.

This is [quirq-ai/euler](https://github.com/quirq-ai/euler). Euler is the application at the repository root. The original Quirq dashboard lives separately in [quirq-ai/quirq on `feat/standalone-dashboard`](https://github.com/quirq-ai/quirq/tree/feat/standalone-dashboard), with its original iframe viewer and port 4400.

## Install and run

Use Node.js **22.13 or newer** (Node 24 recommended) on Windows, macOS, or Linux:

```sh
git clone https://github.com/quirq-ai/euler.git
cd euler
npm ci
npm run setup
npm run build
npm start
```

Open http://localhost:2713. All three apps are enabled initially. Setup installs each app's dependencies from its committed lockfile. Build compiles enabled apps with their Euler route prefix; start serves those builds. Source changes require another build and a server restart. Stop the server with Ctrl+C before rebuilding apps it is serving.

No patch application or sibling repositories are needed. Application source and routing adapters are tracked directly under `apps/`. [apps/upstream.json](apps/upstream.json) records the imported revisions. The source snapshot deliberately excludes uncommitted changes from other local checkouts.

If a Windows npm launcher is unavailable, invoke npm's JavaScript entrypoint with Node; the setup script itself never requires Bash or Windows command-shell syntax.

## Workspace layout

```text
bin/euler.mjs             Euler's executable
src/                     HTTP host, build manager, settings, dock injection
public/                  Home, avatar editor, management UI, shared dock
euler.workspace.json     Apps and their build commands
apps/innernet/           Adapted Innernet source (Next.js)
apps/quitter/            Adapted Quitter source (Vite)
apps/instants/           Adapted Instants source (Next.js)
scripts/setup.mjs        Portable, lockfile-based dependency setup
nx.json                  Nx task configuration
```

The root manifest is resolved from this repository, regardless of the terminal's current directory. Euler does not discover a parent dashboard workspace or fall back to a demo. For a custom installation, use `npm start -- --workspace /path/to/euler` or `--config /path/to/euler.workspace.json`. Use `--port 2800` to change the host port.

## Nx and individual apps

Euler has its own Nx workspace:

```sh
npx nx show projects
npx nx run euler-app:start
npx nx run euler-app:build
npx nx run euler-innernet:build
npx nx run euler-quitter:dev
```

Per-app Nx builds use the same Euler build engine and produce the required mount metadata. Runtime/build targets do not use Nx caching because settings and local data affect their behavior. `npm run build -- --app quitter` explicitly builds that app, even if it is disabled; it does not enable its routes. Without `--app`, the build includes only enabled apps.

You can also work in any app folder using its original commands:

```sh
cd apps/quitter
npm run dev
```

Standalone app commands use their own development ports and root URLs. Euler-specific builds use separate `.next-euler` or `dist-euler` directories. For Innernet demo development, use `npm run dev:demo`; the imported app includes a portable launcher. App READMEs document their own features and data setup.

When this checkout sits inside the larger Quirq workspace at `apps/euler`, outer-root `npm run euler` starts it and `npm run build:euler` builds it. Outer-root `npm start` continues to launch the original dashboard. The unrelated Python repository at outer-root `euler/` keeps its existing Nx project and port.

## How requests work

- `/` serves Euler Home and the avatar editor.
- `/manage` controls enabled apps, start/stop/restart, and logs.
- `/app/innernet` and every nested asset/API route go to Innernet's production Next handler.
- `/app/quitter/` serves Quitter's built assets and client-side routes.
- `/app/instants` and its nested routes go to Instants's production Next handler.

These handlers share Euler's HTTP listener. Each app has the base-path changes in its own tracked source; no iframe or separate app HTTP server is used. HTML responses receive the shared dock, while API responses, assets, and React server component streams pass through unchanged. The apps keep their framework boundaries, so ordinary links navigate between documents. Supported browsers use native view transitions; others use normal navigation. Scroll/location restoration is supported; unsaved in-memory state is not guaranteed across app switches.

Stopping an app unmounts its route. Restart reactivates its already prepared build; it does not compile source changes. Enabled settings persist in `.workspace-state/euler/config.json`. The host binds to loopback and validates local request origins. Browser preferences (avatar and dock opacity) remain local to this host/port, so keeping port 2713 preserves them.

Innernet's index/data and Instants's session files belong to their app directories. Fresh clones contain source and bundled sample material, not another checkout's private state. Existing personal data can be copied locally into these ignored app data directories; it must not be committed.

## Validation

```sh
npm test
npm run build
```

Host tests cover manifest selection, CLI arguments, configuration persistence, direct app routing, security boundaries, lifecycle behavior, streaming dock injection, and avatar preferences. CI runs the host tests on Windows, macOS, and Linux with Node 22 and 24. App dependency installation and build checks run on all three operating systems too.

Blobatar is vendored locally under `public/vendor/blobatar` with its MIT license and provenance. Euler does not contact Blobatar to render or save your avatar.
