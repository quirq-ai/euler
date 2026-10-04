# Euler Home

Home is Euler's built-in application for app status, lifecycle controls, workspace
statistics, and avatar customization. It owns Euler's built-in UI, including the shared
dock shown on mounted app pages. Its source lives beside the other apps in
`app/home`, and its page remains at `/` on Euler's address.

## Run from this folder

With Node.js 22.13 or newer installed:

```sh
cd app/home
npm run build
npm test
npm start
```

Open `http://localhost:2713`. `npm run dev` starts the same Euler host; Home's
HTML, CSS, and JavaScript are read from source on each request, so refresh the
browser after editing. For another port, use `npm start -- --port 2800`.
Stop a currently running Euler instance before starting another on the same port.

Home has no package dependencies to install. `npm run setup` confirms this.
Starting Home also loads the repository's workspace and enabled application builds.
Run the repository's setup and build commands to prepare Innernet, Quitter, and
Instants; Home remains accessible when an app needs a build.

## Run from the repository root

```sh
npm run build -- --app home
npm run nx -- run euler-home:build
npm run nx -- run euler-home:test
npm run nx -- run euler-home:dev
```

The root `npm run build` includes Home. Root `npm start` and Home's `npm start`
use the same host, configuration, default port, and app routes. No extra server
or iframe is added. Home cannot stop or disable itself through the app controls.

## Source and build

- `public/` contains the Home page, styling, app controller, dock, avatar editor
  and renderer, icons, and locally vendored Blobatar with its license.
- `assets.mjs` declares the exact UI files and HTTP routes the app may serve.
- `server.mjs` serves Home assets and the favicon, redirects legacy `/manage`
  links, and supplies document hooks to the host.
- `src/dock.mjs` integrates the dock into mounted app HTML, while preserving
  non-HTML responses and streams.
- `tests/` contains Home's UI, avatar, and dock regression tests.
- `build.mjs` verifies required files and checks JavaScript syntax. These assets
  are already browser-ready, so there is no transpilation or generated copy.

The repository root provides HTTP hosting and security, workspace configuration,
build orchestration, and app lifecycle APIs. Home provides the UI and its document
integration through that host, so the dock remains shared across app pages while
its implementation stays here.

## App-provided docks

Mounted apps may optionally declare a `dock` stylesheet, module, or both in their
workspace manifest entry. A stylesheet themes the standard dock inside its
shadow root; a module exports `mount(context)` and supplies that app's interface.
Home still owns state, remembered-route navigation, avatar and opacity updates,
and fallback to its standard dock when loading or mounting fails. Home itself
always uses the standard dock.

See [per-app docks](../../docs/app-docks.md) for the context API, configuration,
and a complete dependency-free example. An app's dock assets live in that app's
`public/euler/` folder and are served through its mounted route. Build the app and
restart Euler after changing its assets or manifest.

Home is maintained directly in the Euler repository. It has no separate upstream
repository and is not included in the `apps:sync` subtree workflow.
