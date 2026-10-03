# Euler Home

Home is Euler's built-in application for app status, lifecycle controls, workspace
statistics, and avatar customization. Its source lives beside the other apps in
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

- `public/` contains the Home page, styling, app controller, and avatar editor.
- `assets.mjs` declares the exact Home files and HTTP routes the host may serve.
- `build.mjs` verifies required files and checks JavaScript syntax. These assets
  are already browser-ready, so there is no transpilation or generated copy.
- The shared dock, avatar renderer, icons, and locally vendored Blobatar remain
  in the repository's root `public/`, available to every mounted app.

Home is maintained directly in the Euler repository. It has no separate upstream
repository and is not included in the `apps:sync` subtree workflow.
