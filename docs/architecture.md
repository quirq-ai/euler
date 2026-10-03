# Euler architecture

Euler is the root application in this repository. Its Node HTTP server serves three precompiled applications under one origin, plus Home and management. Application source is committed under apps/; the original dynamic dashboard is maintained separately in quirq-ai/quirq on the feat/standalone-dashboard branch.

## Startup and builds

The CLI loads euler.workspace.json relative to its own repository. Explicit --workspace and --config options select another manifest; missing or invalid manifests fail without falling back. npm start binds to IPv4 loopback on port 2713 and mounts enabled builds. npm run build compiles enabled applications and exits. --build --app ID builds one named app even when disabled, preserving all enabled settings.

Each manifest project declares a relative app directory, a static or next adapter, an output directory, and an executable/argument array. Build arguments substitute {node}, {port}, {workspaceRoot}, and {projectRoot} without invoking a shell. Commands are trusted local configuration, never supplied by the browser. The port/scripts fields retain standalone development metadata; production app routes share Euler's port.

Next apps use separate .next-euler output; Quitter uses dist-euler. The build manager supplies each app's base path and records a build marker after success. Startup checks that marker against the requested application, adapter, and mount. Application-specific environment values keep Next's config loading and checkout-local data paths correct when multiple versions run in one process.

## HTTP and lifecycle

Home is served at /, management at /manage, and applications below /app/<id>. Static builds use confined real paths and HTML-only SPA fallbacks. Next applications retain their production request handler for pages, APIs, assets, and React streams. The host does not proxy to a child listener or embed an iframe.

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

The framework-free host UI polls state while visible, reconciles existing rows/icons to preserve focus, and uses native dialogs. Text from the server is inserted as text, and URLs are validated. Home shows running applications and the avatar editor; management offers lifecycle controls, an enabled toggle, search, and logs.

## Dock and avatar

`public/euler-dock.js` defines a shared custom element. Its Shadow DOM isolates dock styles from each app's CSS. The isolated UI stylesheet is preloaded, and the element mounts once the document has been parsed without waiting for images to finish loading. A manual popover places it in the browser's top layer, with a fixed-position fallback for browsers without that API. It sits at the bottom center with safe-area spacing. The dock's opacity setting changes the glass background rather than fading its controls, and is stored in local storage. App status refreshes reconcile existing icons, preserving keyboard focus and open preferences.

Compiled HTML pages load the shared dock resources so Home, app documents, and management display the same controls. The dock is browser navigation chrome; apps still render their own documents and handle their own routes. Server-side API responses and assets keep their original content. The dock does not use an iframe, execute a copied app document inside another DOM, or require a separate HTTP listener.

The document stylesheet exposes `--euler-dock-clearance`, including the bottom safe-area inset, for app layout integration. App-specific selectors are scoped by `data-euler-app`: Quitter and Instants move their mobile fixed navigation and nearby controls above this clearance, while their scrollable content reserves space below. Innernet's landing section accounts for the same reserved area. These targeted adjustments keep app controls reachable beneath the floating dock without applying a global transform or padding change to every app layout. Additional apps with bottom-fixed controls should use the clearance variable in their own layout.

Cross-app navigation uses ordinary links. CSS cross-document View Transitions progressively enhance supporting browsers, with a separate named transition for the dock so it appears steady above the changing page. Reduced-motion settings disable animation, and unsupported browsers retain normal navigation. Each newly loaded document creates its own dock element; the persistent layer is a visual presentation, not one DOM element surviving document replacement.

Session storage remembers each app's last same-origin URL and window scroll position. Stored routes must remain inside that app's `/app/<id>` prefix; invalid values fall back to its home route. Route restoration does not preserve arbitrary unsaved forms, framework component state, or nested scrolling areas. App-owned persistent state and the browser's normal Back/Forward cache remain available. No unload handler prevents that cache.

Keyboard users can reach all controls with Tab, move dock focus with arrow keys or Home/End, and close preferences with Escape. Alt+0 opens Home and Alt+1 through Alt+9 select apps in dock order when focus is outside typing fields. App labels and saved values are validated before being used; unavailable browser storage falls back to session defaults.

The home avatar editor uses the actual Blobatar 2.7.0 renderer, vendored locally under its MIT license. It makes no external requests and adds no runtime installation step. The editor separates draft controls from saved preferences: rendering a preview does not change the saved Euler logo or the dock's Home icon. The shared avatar module validates the stored settings and generates SVG images locally; arbitrary user-supplied SVG is not stored or inserted into the document. A same-document event updates consumers after saving, the browser's storage event updates other tabs, and restored documents reread the preference on `pageshow`. Avatar preferences use browser local storage for the current origin, independently of the server's workspace settings.

## Nx and verification

The root Nx project euler-app exposes startup, setup, build, and tests. Each embedded app has its own named Nx project, development command, setup target, and a build target calling the same Euler build engine. Framework dependencies remain isolated within each app. Targets that depend on local state have caching disabled.

The portable setup script installs each committed app lockfile using Node to launch npm or the pinned pnpm runtime. Host tests exercise CLI/manifest independence, build selection, configuration persistence, HTTP protections, route confinement, streaming injection, and browser preference helpers. CI runs host tests with Node 22/24 and app builds with Node 24 on Windows, macOS, and Linux.
