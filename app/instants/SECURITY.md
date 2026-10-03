# Security policy

## Scope

Security fixes target the current default branch. There are no separately supported release lines or guaranteed response times.

Instants is a collaboration prototype. Activity is private per browser session: a local Node server stores journals under `session/<UUID>/session.json`, while Vercel uses origin-scoped browser localStorage. It does not provide verified identity, team authorization, external message delivery, shared team storage, or cross-device synchronization.

The local session API selects a random UUID through an `HttpOnly`, `SameSite=Lax` cookie, validates events and request origins, and bounds journal size. Those controls do not make this a production account system. The server owner can read local files, and someone using the same browser profile can access its demo state. Session files, localStorage, pending-write outboxes, and downloaded JSON are unencrypted. Selected photos saved as posts may be included in these journals; in file mode the browser sends that data to the local server.

Runtime journals are ignored by Git and excluded from Next.js deployment traces through `next.config.ts`. The filesystem adapter also opts out of tracing runtime paths. Do not publish journals or session exports. Clearing site data can remove browser journals, and deleting a session cookie can detach its local file. Export is a manual backup; the prototype does not implement account deletion, a retention policy, or shared-team recovery. The repository also contains hosting and connector scaffolding; review any such integration before enabling it.

The default demo loads remote photographs and a font stylesheet. Those providers receive the ordinary browser requests needed to load their assets. Keep secrets and personal data out of mock data, screenshots, issue reports, and local hosting configuration committed to Git.

## Report a vulnerability

Use **Report a vulnerability** in the repository's [Security tab](https://github.com/quirq-ai/instants/security) when private reporting is available. Include:

- The affected commit or version and the component involved.
- Reproduction steps or a minimal proof of concept using fictional data.
- The impact and relevant browser or runtime details.
- A proposed fix, if you have one.

If private reporting is unavailable, open a public issue asking maintainers for a private reporting channel. Do not include exploit details, tokens, personal data, or sensitive logs in that issue. Do not test against systems or accounts you do not control.

Ordinary UI bugs and feature requests belong in the public issue tracker.
