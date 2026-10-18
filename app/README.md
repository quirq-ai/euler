# Euler application sources

- [`home`](./home/README.md) - Euler's Home, app controls, and avatar editor.
- `innernet` - local search and the personal encyclopedia.
- `quitter` — the agent activity workspace.
- `instants` — the visual workspace and replies.

Home is maintained directly in Euler and owns all Euler UI. Its `public/`
directory contains the Home page, controller, dock, avatar editor and renderer,
icons, and locally vendored Blobatar. Its server module serves these assets and
provides document hooks that add the dock to mounted app pages. UI tests live
alongside Home in `home/tests/`; the repository root handles hosting, security,
configuration, builds, and app lifecycle. Run `npm run dev` or `npm start` inside
`home/` to launch the existing Euler host at http://localhost:2713/. Home's build
validates browser-ready files, setup needs no dependencies, and `npm test` runs
its focused tests. Its Nx project is `euler-home`. Home always remains available
and has no pin.

The three other applications are not stored here. Each is pinned to one commit of
its own repository in [`infra/repo.toml`](../infra/repo.toml). `qq sync` fetches
that commit, and `npm run setup` copies it into `innernet/`, `quitter/`, or
`instants/` and applies Euler's subpath adapter from [`adapters/`](./adapters).
Only each app's Nx `project.json` is tracked in its folder; the rest is ignored by
Git. Innernet's adapter also replaces its shell-specific `dev:demo` environment
assignment with `scripts/dev-demo.mjs`, preserving the development server's default
address, demo behavior, and forwarded arguments.

To move an app to a newer commit or change its adapter, see
[Maintaining Euler's app sources](../docs/app-updates.md).
