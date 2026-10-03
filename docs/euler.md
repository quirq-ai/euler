# Using Euler

Euler is the root application in [quirq-ai/euler](https://github.com/quirq-ai/euler). Follow the [repository setup instructions](../README.md) to install, build, and launch it at http://localhost:2713.

## Home and dock

Home shows running apps as simple icons. The floating dock sits at the bottom center above page content, with device safe-area spacing. It appears on Home, app pages, and `/manage`; its icons update as apps start or stop.

**Dock appearance** changes the glass background opacity between 20% and 100% (default 72%). Icons stay opaque. This preference is saved in browser storage for the Euler address and synchronized across tabs.

Use **Alt+0** for Home and **Alt+1** through **Alt+9** for running apps in dock order. Typing fields are excluded. Tab focuses controls; Left/Right and Home/End move focus within the dock. Escape closes the appearance panel.

Switching uses same-origin links. Supporting browsers animate document changes with native View Transitions; reduced-motion preferences disable animations. Other browsers navigate normally. The dock remembers each app's last URL and window scroll position for the current tab. App-controlled scrolling areas and arbitrary unsaved form/component state are outside this restoration.

## Personalize Euler

Home includes a local Blobatar editor. Adjust the seed, Shape, Color, Eyes, and Details, or use **Randomize**. The preview is a draft: **Save avatar** applies it to Euler's logo and Home dock icon, while **Cancel** returns to the saved avatar. **Reset** previews the default and takes effect after saving.

Saved choices belong to this browser and Euler address. Other tabs update when a choice is saved. If storage is unavailable, the editor reports the failure. No external avatar service is contacted.

## Manage apps

Open **Manage apps** from Home or the dock appearance panel. **Enable in Euler** determines whether an app is available immediately, starts with the next Euler session, and is included in the default build. Saving applies the setting immediately.

**Start** mounts an existing build. **Stop** unmounts its route for the current session. **Restart** reactivates the existing build. These controls do not open separate listening ports. Prepared Next runtimes remain in memory while routes are disabled and close when Euler exits.

Stop Euler before rebuilding changed source with `npm run build`, then run `npm start`. To build one app even while disabled, use `npm run build -- --app innernet`; this does not change its enabled setting.

Settings are stored in `.workspace-state/euler/config.json`. The original dashboard has a separate checkout and separate settings.

## App routes

| App | Route | Handler |
| --- | --- | --- |
| Innernet | `/app/innernet` | Next pages, assets, and APIs |
| Quitter | `/app/quitter/` | Built Vite assets and client routes |
| Instants | `/app/instants` | Next pages, assets, and APIs |

Innernet's `/api/suggest`, for example, is mounted at `/app/innernet/api/suggest`. Next canonicalizes its home URL without the final slash. API responses and assets do not receive the dock; HTML documents do.

The repository's `euler.workspace.json` selects the tracked app folders and their compile commands. Commands are argument arrays, executed without a shell. Build directories stay separate from standalone app development output. Import revisions and adaptation details are recorded in [apps/upstream.json](../apps/upstream.json); changes are ordinary source files and require no patch-preparation step.
