# Give an app its own dock

Each mounted app can keep Euler's standard dock, theme it with CSS, or provide
its own interface. Home always uses the standard dock. An app's choice applies
only while that app is open; navigation still uses Euler's running apps, saved
routes, avatar, opacity preference, and connection state.

## Configure an app

Add an optional `dock` object to that app's existing entry in
[`euler.workspace.json`](../euler.workspace.json). For example, add this field
inside `projects.quitter`, keeping its other fields:

```json
"dock": {
  "module": "euler/dock.js",
  "stylesheet": "euler/dock.css"
}
```

These are **browser asset paths relative to the app's mounted URL**, not source
file paths. Quitter's `euler/dock.js` is served at `/app/quitter/euler/dock.js`.
Use app-relative paths without a leading slash, URL scheme, or `..` traversal.
At least one of `module` or `stylesheet` is required when `dock` is present.

| Configuration | Result |
| --- | --- |
| Omit `dock` | Standard Euler dock. |
| `stylesheet` only | Standard dock with an app stylesheet loaded inside its shadow root. |
| `module` only | App-provided dock; the module supplies its own presentation. |
| `module` and `stylesheet` | App-provided dock with a separate stylesheet inside its shadow root. |

For the bundled Next.js and Vite apps, place the files in their `public/euler/`
folder so they are available at the configured URLs:

```text
app/quitter/
└── public/
    └── euler/
        ├── dock.js
        └── dock.css
```

Stop Euler, build the affected app, and restart Euler after changing the assets
or manifest. From the repository root:

```sh
npm run build -- --app quitter
npm start
```

Use `innernet` or `instants` in the command when configuring those apps. Refresh
the browser after restarting. The app's standalone development server does not
inject Euler's dock; test the integration at Euler's `/app/<name>` URL.

## Theme the standard dock

To change its appearance while retaining its existing controls, configure only
the stylesheet:

```json
"dock": { "stylesheet": "euler/dock.css" }
```

The stylesheet runs inside the dock's Shadow DOM. Normal page styles cannot
reach those internals. For example, `public/euler/dock.css` can contain:

```css
.dock {
  background: rgb(32 24 61 / var(--dock-opacity, .72));
  border-color: #c6b3f866;
  border-radius: 22px;
}
.dock-item[aria-current='page'] {
  background: #c6b3f826;
}
.running-dot {
  background: #c6b3f8;
}
```

These selectors refer to the standard dock's current markup in
[`euler-dock.js`](../app/home/public/euler-dock.js) and
[`euler-dock-ui.css`](../app/home/public/euler-dock-ui.css). Keep text and focus
indicators readable, preserve the opacity variable, and check your theme when
updating Euler. Prefer changing colors and surface styling here; a substantially
different layout is easier to own as a custom module.

## Replace the dock interface

A module is a browser ES module with a named `mount(context)` export. Euler calls
it when that app's dock is ready. Mount your interface inside `context.root`,
subscribe to state, and return an optional cleanup function. `mount` may also be
async and resolve to that function.

Use the complete, dependency-free example:

- [`dock.js`](examples/app-dock/dock.js) renders Home, running apps, active state,
  connection status, and an opacity control. It keeps links stable during updates,
  supports keyboard navigation, measures clearance, and releases resources.
- [`dock.css`](examples/app-dock/dock.css) supplies responsive styling, horizontal
  overflow for many apps, visible focus, and reduced-motion and high-contrast
  support.

Copy both files into the chosen app's `public/euler/` folder and configure both
`module` and `stylesheet` as shown above. Customize the example there; the files
under `docs/examples/` are a reusable starting point and are not loaded by Euler.
No framework or package installation is required for this example.

### Context

| Member | Purpose |
| --- | --- |
| `root` | The dock's `ShadowRoot`; append your interface here. Preserve styles and other nodes Euler supplies. |
| `host` | The `EulerDock` element that owns the shadow root. |
| `appId` | The ID of the app whose custom dock is being mounted. |
| `homeUrl` | `/`, the Home URL. |
| `signal` | An `AbortSignal` for this mount's lifetime. Use it for event listeners and cancellable work. |
| `getState()` | Read the current dock state. |
| `subscribe(fn)` | Subscribe to state changes; calls `fn` immediately and returns an unsubscribe function. |
| `navigate(id)` | Navigate to `'home'` or a running app ID, preserving Euler's saved-route and window-scroll behavior. |
| `setOpacity(number)` | Update the shared dock opacity preference, bounded to 20–100. |
| `setClearance(px)` | Set the document's dock clearance in pixels, bounded to 0–400. |

Each state snapshot contains:

```js
{
  apps: [
    { id: 'quitter', name: 'Quitter', url: '/app/quitter/', active: true }
  ],
  currentAppId: 'quitter',
  online: true,
  opacity: 72,
  avatarUrl: 'data:image/svg+xml,...'
}
```

`apps` contains the currently running apps. `url` can be a remembered route within
that app; use it as a link's `href` and call `navigate(app.id)` for ordinary
same-tab activation. Keep native behavior for modified clicks and new tabs.
`avatarUrl` is Euler's current avatar image; update it when the subscription
changes. `online` describes the host connection, not a guarantee that each app's
backend service is healthy.

Use text nodes for app names and `aria-current="page"` for the active app. Keep a
visible Home action, accessible link names, focus indicators, and controls usable
at narrow widths. Measure the occupied bottom area and call `setClearance` so
apps that honor `--euler-dock-clearance` leave room for your dock. The example
includes its bottom offset and safe area in that measurement.

### Cleanup and recovery

Dispose of subscriptions, observers, timers, and any resources you create when
the mount ends. Event listeners can use `{ signal: context.signal }`; return a
cleanup function for other resources. Cleanup should be safe to call more than
once. Respect the abort signal during asynchronous setup so abandoned work does
not add UI after Euler has switched back to its standard dock.

If a configured asset is missing, a stylesheet fails to load, a module cannot be
loaded, `mount` fails, or mounting times out, Euler falls back to the standard
Home dock on that app page. Inspect the browser console and the configured asset
URLs, correct the files, rebuild, restart Euler, and refresh. Keep module setup
quick; ongoing asynchronous work belongs after the initial mount and should
respect its abort signal.

Custom modules run with the same browser privileges as the app itself. This is
an extension point for trusted app source, not an isolation boundary. Euler's
HTTP protections and lifecycle APIs remain owned by the host; a dock extension
does not add another server, app runtime, or iframe.
