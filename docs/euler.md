# Using Euler

Euler is the shared host in [quirq-ai/euler](https://github.com/quirq-ai/euler), with Home and the bundled applications maintained in `app/`. Follow the [repository setup instructions](../README.md) to install, build, and launch it at http://localhost:2713.

## Home and dock

Home brings every app's status, launch controls, enabled setting, and lifecycle actions together with Euler's avatar editor. Summary counts show the workspace at a glance; each app has a status dot and a text label. The floating dock sits at the bottom center above page content, with device safe-area spacing. It appears on Home and app pages; its icons update as apps start or stop and show only running apps.

Home lives in [`app/home`](../app/home/README.md) and remains available at `/`, even when every bundled app is stopped. It has no enable switch. For Home development, run `npm run dev` or `npm start` from that folder to launch the same Euler host on port 2713; stop an existing Euler process first. Run `npm run build` there to validate Home's source and `npm test` for its focused tests. No separate Home dependencies or generated bundle are needed.

The dock, avatar, icons, and their UI logic also belong to Home. Home supplies the shared dock on mounted app pages; the repository root provides the HTTP host, security, configuration, builds, and app lifecycle. This source organization keeps the same pages, URLs, and controls.

**Dock appearance** changes the glass background opacity between 20% and 100% (default 72%). Icons stay opaque. This preference is saved in browser storage for the Euler address and synchronized across tabs.

Use **Alt+0** for Home and **Alt+1** through **Alt+9** for running apps in dock order. Typing fields are excluded. Tab focuses controls; Left/Right and Home/End move focus within the dock. Escape closes the appearance panel.

Switching uses same-origin links. Supporting browsers animate document changes with native View Transitions; reduced-motion preferences disable animations. Other browsers navigate normally. The dock remembers each app's last URL and window scroll position for the current tab. App-controlled scrolling areas and arbitrary unsaved form/component state are outside this restoration.

## Personalize Euler

Choose **Personalize** in Home's header or expand **Make Euler yours.** below the apps to open the local Blobatar editor. Adjust the seed, Shape, Color, Eyes, and Details, or use **Randomize**. The preview is a draft: **Save avatar** applies it to Euler's logo and Home dock icon, while **Cancel** returns to the saved avatar. **Reset** previews the default and takes effect after saving. App status refreshes and lifecycle actions preserve the draft.

Saved choices belong to this browser and Euler address. Other tabs update when a choice is saved. If storage is unavailable, the editor reports the failure. No external avatar service is contacted.

## Manage apps

Use **Your apps** on Home to launch and manage apps. Older `/manage` links redirect to `/#applications`; there is no separate management page or dock icon. **Running**, **Enabled**, and **Connected** summarize all registered apps, including apps outside the current search or filter. Stopped apps remain visible under **All apps**.

Each card's **On / Off** switch determines whether an app is available immediately, starts with the next Euler session, and is included in the default build. Changing it applies and saves the setting immediately. You can also open **Settings**, change **Enable in Euler**, and choose **Save settings**; cancelling that dialog discards its draft. An enabled app can still be stopped for the current session, so its saved preference and running status are shown separately.

**Start** mounts an existing build. **Stop** unmounts its route for the current session. **Restart** reactivates the existing build. These controls do not open separate listening ports. Prepared Next runtimes remain in memory while routes are disabled and close when Euler exits.

**Logs** shows recent lifecycle output and errors for the selected app. Build failures remain visible on Home so you can identify which app needs attention.

Use **Start enabled** or **Stop all** to control app routes together. **Find an app** searches the list, and **All apps**, **Running**, **Enabled**, and **Stopped** filter it without changing app settings. Clearing the filters restores the full list. If Euler disconnects, the last known cards remain visible while controls wait for a successful reconnection.

Stop Euler before rebuilding changed source with `npm run build`, then run `npm start`. To build one app even while disabled, use `npm run build -- --app innernet`; this does not change its enabled setting.

Settings are stored in `.workspace-state/euler/config.json`. The original dashboard has a separate checkout and separate settings.

## App routes

| App | Route | Handler |
| --- | --- | --- |
| Home | `/` | Browser-ready UI served by Euler's host |
| Innernet | `/app/innernet` | Next pages, assets, and APIs |
| Quitter | `/app/quitter/` | Built Vite assets and client routes |
| Instants | `/app/instants` | Next pages, assets, and APIs |

Innernet's `/api/suggest`, for example, is mounted at `/app/innernet/api/suggest`. Next canonicalizes its home URL without the final slash. API responses and assets do not receive the dock; HTML documents do.

The repository's `euler.workspace.json` selects the tracked app folders and their compile commands. Commands are argument arrays, executed without a shell. Build directories stay separate from standalone app development output. Import revisions and adaptation details are recorded in [app/upstream.json](../app/upstream.json); changes are ordinary source files and require no patch-preparation step.
