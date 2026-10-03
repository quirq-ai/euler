# Euler application sources

These directories contain ordinary source code tracked by the Euler repository:

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
and is not part of the upstream synchronization manifest.

The three other applications' initial source snapshots were exported from the
exact upstream commits in [`upstream.json`](./upstream.json). The existing Euler
subpath adapters were applied
once during import. Their resulting source changes are checked in here, including
Innernet's explicit Apple icon route and component relocation. Building and starting
Euler do not apply patches or fetch source repositories.

All tracked upstream media, application assets, documentation, and license files
were retained. No nested Git repositories, installed dependencies, build outputs,
generated parent-workspace Nx files, or personal working-tree data were imported.
Innernet's tracked `data/demo/index.json` and Instants' `session/README.md` are part
of their source snapshots; personal index and session files remain local state.

Euler also replaces Innernet's shell-specific `dev:demo` environment assignment
with `scripts/dev-demo.mjs`, preserving the development server's default address,
demo behavior, and forwarded arguments on Windows, macOS, and Linux.

Application development can continue inside each directory. Root setup, build, and
run commands are documented in the [Euler README](../README.md).
