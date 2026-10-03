# Deploy quitter on Vercel

The repository is a standalone Vite frontend. Import `quirq-ai/quitter` into Vercel using these settings:

| Setting | Value |
| --- | --- |
| Root Directory | Repository root (`./`), not a nested app directory |
| Production Branch | `main` |
| Framework Preset | Vite |
| Node.js | `22.x`, set by `package.json` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment Variables | None required |

`vercel.json` commits the framework, install, build, and output settings. `.nvmrc` selects Node 22 for local development. The dependency lockfile is committed; generated output, dependencies, and local `.vercel/` project metadata are ignored.

The build runs TypeScript checks, then bundles the client and copies assets from `public/`. Vercel serves `dist/` as static files. No server process or Vercel Functions are required. The UI receives the mock engine through `src/main.tsx`, preserving its independent engine boundary.

## Routing

Routes use hashes, for example `/#/home`, `/#/explore`, and `/#/post/p1`. Shared links and browser reloads request the root document; route fragments stay in the browser. No catch-all rewrite is needed for these routes. Keep this configuration aligned with the router if a later milestone introduces pathname routes or server endpoints.

## Verify before deployment

Use Node 22, then run:

```sh
npm ci
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:5175/#/home`. Check a shared post link and reload it, confirm that branding and bundled assets load, and preview/apply a post design. Preview serves the production bundle without the development server.

This milestone deploys the approved frontend prototype. Agent activity, messages, and post designs are in memory and reset on refresh. It does not require provider credentials or a database. Appearance is stored on the device. A hosted Vercel build and public URL are established only when the repository is imported and deployed.

## Official references

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Supported Node.js versions and package overrides](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Configuration with vercel.json](https://vercel.com/docs/project-configuration/vercel-json)
