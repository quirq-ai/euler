# Euler architecture

Euler's root Node HTTP host serves Home and three precompiled applications under one origin. Application source is committed under app/: Home lives in app/home alongside innernet, quitter, and instants. Home owns Euler's built-in UI, including the dock and shared browser resources; app-specific dock extensions live with their apps. The repository root owns hosting, security, configuration, builds, and app lifecycle. The original dynamic dashboard is maintained separately in quirq-ai/quirq on the feat/standalone-dashboard branch.

## Startup and builds

The CLI loads euler.workspace.json relative to its own repository. Explicit --workspace and --config options select another manifest; missing or invalid manifests fail without falling back. npm start binds to IPv4 loopback on port 2713 and mounts enabled builds. npm run build validates Home's browser-ready source, compiles enabled applications, and exits. --build --app ID builds one named app even when disabled, preserving all enabled settings. --build --app home validates only Home and leaves the other applications untouched.

Home is a local package with its own development, start, setup, build, and test commands. Its dev and start commands launch the existing Euler host with the same manifest, API, port, and routes. Home has no framework dependencies or generated bundle: setup is a no-op, and build validates its source files. It remains available as the host's control surface and is not a lifecycle-managed entry in workspace.projects or an upstream subtree in app/upstream.json.

Each manifest project declares a relative app directory, a static or next adapter, an output directory, and an executable/argument array. Build arguments substitute {node}, {port}, {workspaceRoot}, and {projectRoot} without invoking a shell. Commands are trusted local configuration, never supplied by the browser. The port/scripts fields retain standalone development metadata; production app routes share Euler's port.

Next apps use separate .next-euler output; Quitter uses dist-euler. The build manager supplies each app's base path and records a build marker after success. Startup checks that marker against the requested application, adapter, and mount. Application-specific environment values keep Next's config loading and checkout-local data paths correct when multiple versions run in one process.

## HTTP and lifecycle

Home is served at / and applications below /app/<id>. Legacy /manage links redirect to /#applications, the controls section on Home. Static builds use confined real paths and HTML-only SPA fallbacks. Next applications retain their production request handler for pages, APIs, assets, and React streams. The host does not proxy to a child listener or embed an iframe.

Root `src/server.mjs` enforces HTTP security and exposes the lifecycle and configuration APIs. It delegates Home assets, the favicon, and legacy management redirects to `app/home/server.mjs`. Root `src/compiled.mjs` handles app runtimes and accepts document integration from Home; it does not own dock markup or UI asset paths. Home's server module supplies the document hooks implemented in `app/home/src/dock.mjs`, keeping UI integration with the app that owns it.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/state | App states and Euler context |
| GET | /api/projects/:id/logs | Recent lifecycle output |
| POST | /api/projects/:id/start | Mount an existing build |
| POST | /api/projects/:id/stop | Unmount its route |
| POST | /api/projects/:id/restart | Reactivate the existing build |
| PUT | /api/projects/:id/config | Save and apply an enabled boolean |
| POST | /api/start-enabled | Mount all enabled apps |
| POST | /api/stop-all | Unmount all app routes |

Mutations accept JSON bodies, return refreshed state, and serialize through the manager queue. Host, Origin, Fetch Metadata, content type, and body-size checks protect the local API. Unknown IDs and operations are rejected. App scripts share this browser origin and its resources; the registry therefore contains trusted local applications.

Start prepares a runtime once. Stop removes its handler from routing while retaining the prepared runtime; restarting reuses it. Final shutdown closes each runtime once. This prevents reusing Next request contexts after closing them. Source changes require stopping Euler, rebuilding, and starting it again.

Saved settings use .workspace-state/euler/config.json with queued atomic writes. The HTTP API accepts only enabled; legacy port/mode metadata remains in the internal store for compatibility but never changes production routing. Default builds read the full registry so per-app operations preserve sibling settings. The old dashboard's state is separate.

## Browser interface

`app/home/public/` owns the Home page, stylesheet, app controller, avatar editor and renderer, dock scripts and styles, app icons, and vendored Blobatar with its license. `app/home/assets.mjs` declares the asset routes and `app/home/server.mjs` serves them at their existing browser URLs, with Home at `/`. Home also owns UI unit tests in `app/home/tests/`. This keeps the complete UI in one application without changing bookmarks or introducing another HTTP server.

The framework-free host UI presents workspace counts and an app card for every registry entry on Home. Cards combine an icon, status dot and text, launch and lifecycle actions, an enabled toggle, and logs. Running state and the saved enabled preference remain distinct. These controls use the existing state, lifecycle, configuration, and logs APIs; they do not introduce another manager or server.

The UI polls state while visible and reconciles existing app controls to preserve focus. Text from the server is inserted as text, and URLs are validated. The avatar editor stays on Home with its own draft and saved-state lifecycle, so app refreshes do not replace its controls or discard an unsaved avatar.

Search and status filters operate on the current registry snapshot; summary counts always describe the full workspace. The card switch applies its enabled setting immediately, while the Settings dialog holds a draft until saved. Logs use a separate native dialog. Appearance is a collapsed disclosure containing the existing Blobatar editor, with a header link that opens it directly.

Lifecycle mutations temporarily disable conflicting controls, invalidate older state reads, and notify the dock before and after the request. Both consumers reject stale poll results so a delayed response cannot restore an app that was just stopped. A disconnected Home retains its last known cards, disables actions, and offers an explicit retry while background reconnection continues.

## Dock and avatar

`app/home/public/euler-dock.js` defines a shared custom element. Its Shadow DOM isolates dock styles from each app's CSS. The isolated UI stylesheet is preloaded, and the element mounts once the document has been parsed without waiting for images to finish loading. A manual popover places it in the browser's top layer, with a fixed-position fallback for browsers without that API. It sits at the bottom center with safe-area spacing. The dock's opacity setting changes the glass background rather than fading its controls, and is stored in local storage. App status refreshes reconcile existing icons, preserving keyboard focus and open preferences.

Home's document integration adds its shared dock resources to compiled HTML pages so Home and app documents display the same controls. Home is the single entry point for app management; the dock has no separate Manage destination. The dock is browser navigation chrome; apps still render their own documents and handle their own routes. Server-side API responses and assets keep their original content. The dock does not use an iframe, execute a copied app document inside another DOM, or require a separate HTTP listener.

Each mounted app can optionally declare a `dock` module, stylesheet, or both in its manifest entry. Paths resolve beneath that app's mounted URL. Home supplies the shared state, navigation, avatar, opacity, and document integration; the app may theme the standard dock inside its Shadow DOM or provide an interface through `mount(context)`. The context supplies subscriptions, lifecycle cancellation, navigation to running apps, and a bounded clearance setter. Missing or failed assets, failed mounts, and mount timeouts restore the standard dock. Home always uses that standard dock. See [per-app docks](app-docks.md) for the contract and a complete reusable example.

The document stylesheet exposes `--euler-dock-clearance`, including the bottom safe-area inset, for app layout integration. App-specific selectors are scoped by `data-euler-app`: Quitter and Instants move their mobile fixed navigation and nearby controls above this clearance, while their scrollable content reserves space below. Innernet's landing section accounts for the same reserved area. These targeted adjustments keep app controls reachable beneath the floating dock without applying a global transform or padding change to every app layout. Additional apps with bottom-fixed controls should use the clearance variable in their own layout.

Cross-app navigation uses ordinary links. CSS cross-document View Transitions progressively enhance supporting browsers, with a separate named transition for the dock so it appears steady above the changing page. Reduced-motion settings disable animation, and unsupported browsers retain normal navigation. Each newly loaded document creates its own dock element; the persistent layer is a visual presentation, not one DOM element surviving document replacement.

Session storage remembers each app's last same-origin URL and window scroll position. Stored routes must remain inside that app's `/app/<id>` prefix; invalid values fall back to its home route. Route restoration does not preserve arbitrary unsaved forms, framework component state, or nested scrolling areas. App-owned persistent state and the browser's normal Back/Forward cache remain available. No unload handler prevents that cache.

Keyboard users can reach all controls with Tab, move dock focus with arrow keys or Home/End, and close preferences with Escape. Alt+0 opens Home and Alt+1 through Alt+9 select apps in dock order when focus is outside typing fields. App labels and saved values are validated before being used; unavailable browser storage falls back to session defaults.

The home avatar editor uses the actual Blobatar 2.7.0 renderer, vendored locally under its MIT license. It makes no external requests and adds no runtime installation step. The editor separates draft controls from saved preferences: rendering a preview does not change the saved Euler logo or the dock's Home icon. The shared avatar module validates the stored settings and generates SVG images locally; arbitrary user-supplied SVG is not stored or inserted into the document. A same-document event updates consumers after saving, the browser's storage event updates other tabs, and restored documents reread the preference on `pageshow`. Avatar preferences use browser local storage for the current origin, independently of the server's workspace settings.

## Nx and verification

The root Nx project euler-app exposes startup, setup, build, and tests. Home's euler-home project exposes dev, start, setup, build, and test targets; its tests cover browser assets, avatar behavior, and dock integration. The root host tests cover HTTP security, runtime lifecycle, routing, and launch integration. Each upstream app has its own named Nx project, development command, setup target, and a build target calling the same Euler build engine. Framework dependencies remain isolated within each app. Targets that depend on local state have caching disabled.

The portable setup script installs each committed app lockfile using Node to launch npm or the pinned pnpm runtime. Host tests exercise CLI/manifest independence, build selection, configuration persistence, HTTP protections, route confinement, streaming injection, and browser preference helpers. CI runs host tests with Node 22/24 and app builds with Node 24 on Windows, macOS, and Linux.
