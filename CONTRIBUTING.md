# Contributing to Instants

Instants is a team collaboration prototype with private per-person activity. Contributions should keep the demo easy to run, the interactions accessible, and the boundary between demo state and real delivery clear.

## Set up

Use Node.js 22.13 or newer and npm. Fork the repository, clone your fork, and create a branch for your change.

```sh
npm ci
npm run dev
```

The Next.js app runs on port 5180. `/motion` is the playground for shared motion primitives. No credentials or local hosting configuration are needed. The optional Sites scaffold uses separate commands described in [the architecture guide](docs/architecture.md#build-and-hosting-boundary).

## Make a focused change

- Describe the problem and the observable result you want. Open an issue before a large feature or architectural change so maintainers can discuss scope.
- Keep brand values in `config/brand.json`, motion values in `config/motion.json`, and seed content in `data/mock.json`.
- Keep presentation in the [UI layer](docs/ui.md) and persistent behavior in the [engine](docs/engine.md). Reuse components and derive shared state through the session projection.
- For a new persistent action, update its TypeScript payload, runtime validation, and projection together. Use stable IDs, explicit desired values, and deterministic replay. Do not read files or create a second storage format inside a view component.
- Preserve native touch and wheel scrolling. Give gestures visible and keyboard-accessible alternatives, and respect reduced motion.
- Use sample content. Do not commit `session/` runtime journals, downloaded session exports, credentials, personal conversations, production data, local hosting identity, or generated build output.
- Preserve upstream license notices. Include the source and license for any new third-party code or assets.

## Validate

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Install Playwright once per browser setup; on Linux use `npx playwright install --with-deps chromium` if system dependencies are missing. Add or update tests when behavior changes, especially gesture classification, persistence boundaries, or shared state.

Local browser tests use Next.js development mode by default. CI builds Next.js first and runs the same tests against its production server. To inspect the production app locally, run `npm run build` followed by `npm start`; it serves on port 5180. Set `PLAYWRIGHT_BASE_URL` to the running server's URL when testing a server you started yourself.

For deployment changes, preserve the standard Next.js build and the settings in `vercel.json`. Vercel imports use the repository root (`.`); see [the deployment guide](README.md#deploy-to-vercel). The optional `dev:sites`, `build:sites`, and `start:sites` scripts do not participate in Vercel deployments.

For session changes, check append validation, idempotent retries, replay after refresh, and separate browser-session isolation. Exercise both the local file mode and the Vercel/browser mode. Do not turn a failed save into a successful status, or overwrite an unreadable journal to hide an error. The local file store is intended for one Node process, not multi-process coordination.

For UI changes, inspect both themes at a narrow mobile width and a desktop width. Follow DM and post-related requests through reply and resolve; check that the result reaches the appropriate demo thread or comments. Check keyboard focus, Escape dismissal, relevant touch/mouse gestures, and reduced motion. Include a screenshot or short recording when it helps explain the result. Record any checks you could not run and why.

## Open a pull request

Explain the problem, the resulting behavior, and how you checked it. Link related issues. Keep unrelated refactors and dependency changes in separate pull requests. Update documentation when setup, controls, configuration, or prototype limitations change.

By contributing, you agree that your contributions may be distributed under the project's [MIT license](LICENSE). Only submit work you have the right to contribute. Discuss people and ideas respectfully; prefer concrete examples and reproducible reports.

For security issues, follow [SECURITY.md](SECURITY.md) instead of posting sensitive details in a public issue.
