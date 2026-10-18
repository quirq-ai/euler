# Maintaining Euler's app sources

Euler does not carry the sources of Innernet, Quitter, and Instants. Each app keeps
its own repository, and Euler pins one commit of it in
[`infra/repo.toml`](../infra/repo.toml), read through qq's `sync`:

| App | Repository | Euler's adapter |
| --- | --- | --- |
| Innernet | [quirq-ai/innernet](https://github.com/quirq-ai/innernet) | [`app/adapters/innernet.patch`](../app/adapters/innernet.patch) |
| Quitter | [quirq-ai/quitter](https://github.com/quirq-ai/quitter) | [`app/adapters/quitter.patch`](../app/adapters/quitter.patch) |
| Instants | [quirq-ai/instants](https://github.com/quirq-ai/instants) | [`app/adapters/instants.patch`](../app/adapters/instants.patch) |

The adapter holds the only changes Euler makes to an app: what it needs to run
under `/app/<name>` (its base path and build directory) and the cross-platform
development scripts. Each app's Nx `project.json` stays tracked in Euler.

## How an app gets into `app/`

```mermaid
flowchart TB
    Pin["infra/repo.toml<br/>deps.name = git:commit"] -->|qq sync| Store[".qq/deps/name<br/>read-only checkout at the pin"]
    Store -->|npm run setup| Copy["app/name<br/>pinned files + adapter"]
    Copy -->|npm run build| Build["/app/name build"]
```

1. `qq sync` (or `qq fetch`, which clones and then syncs) fetches each pin once per
   machine into qq's store, checks it against its commit, and links it at
   `.qq/deps/<name>`. The store copy is read only.
2. `npm run setup` checks that `.qq/deps/<name>` is a clean checkout at the pin and
   that `infra/repo.toml` has not changed since the last `qq sync` (otherwise it
   asks you to run `qq sync`). It then builds the pinned files plus the adapter in
   `.workspace-tmp/sources/<name>`, brings `app/<name>` to exactly that tree, and
   installs the app from its lockfile. If the adapter does not apply, `app/<name>`
   is left as it was.
3. `app/<name>/.euler-source.json` records the hash of every file setup wrote.
   Setup only replaces or removes a file whose bytes are still the ones it wrote,
   and takes over a file in the way only when it is identical to the one it would
   write. Files it did not write stay: local indexes, journals, `.env` files,
   dependencies, and builds.

If you have changed a file setup wrote, or a different file is where it would
write one, setup stops, names the files, and changes nothing. Make app changes in
the app's own repository or in its adapter. To keep going anyway, run
`npm run setup -- <name> --backup`: it moves exactly those files to
`app/<name>.setup-backup-<time>/` and continues. If the record is lost or
damaged, setup rebuilds it from the files that match.

## Move an app to a newer commit

Commit your local Euler changes first. Then, from the Euler repository root:

```sh
qqsync pin deps innernet --digest git:<commit>
qq sync
npm run setup -- innernet
npm run build -- --app innernet
npm test
```

`qqsync` comes with the qq [install guide](https://docs.quirq.dev/docs/install).
Stop Euler before rebuilding an app it is serving. Start Euler again with
`npm start`, open the app, and check its pages, assets, and API behavior under
`/app/innernet`. Replace `innernet` with `quitter` or `instants` as needed.

If setup reports that the adapter does not apply, the new commit changed lines
the adapter touches, and `app/<name>` is unchanged. Regenerate the adapter, then
run setup again and commit the pin and the adapter together.

## Regenerate an adapter

Apply the current adapter to a clone of the app at the new commit, resolve what
does not apply, and save the result without rename detection:

```sh
git clone https://github.com/quirq-ai/innernet /tmp/innernet-adapter
cd /tmp/innernet-adapter
git checkout --quiet <new commit>
git apply --3way /path/to/euler/app/adapters/innernet.patch
# resolve any conflicts, then:
git add -A
git diff --cached --no-renames --binary > /path/to/euler/app/adapters/innernet.patch
```

The same steps change an adapter on purpose: edit the files in the clone after
`git apply`, then save the diff. Files Euler adds to an app, such as dock
assets under `public/euler/`, are new files in its adapter.

Running `git pull` in Euler brings the pins and adapters others have published;
run `qq sync` and `npm run setup` after it.

## Upgrade from the `apps/` folder

Older Euler checkouts kept the sources in `apps/`. Stop Euler and any standalone
app servers, commit the source changes you want to keep, and back up your local
app data. Then run from the Euler repository root:

```sh
git pull --ff-only
qq sync
npm ci
npm run setup
npm run migrate:app-data
npm run build
npm start
```

The migration command moves local app data left in the old `apps/<name>`
directories to matching paths under `app/<name>`. It preserves local environment
files, Innernet indexes, Instants journals, and other files that are not
generated. Before moving any files, it checks all destinations and refuses
collisions, unknown old app directories, and data symlinks or junctions. It skips
generated dependencies and build output; setup and build recreate those in the new
paths. Use `npm run migrate:app-data -- --dry-run` to preview the migration. Fresh
clones and repeated migrations have nothing to move. Existing `.workspace-state`
settings and browser preferences keep their locations.

If the command reports a collision, compare and back up both copies before
resolving it and rerunning the command. The helper does not overwrite either copy
or remove the old directory; skipped generated artifacts remain there. Update any
custom manifests, editor tasks, and external scripts from `apps/<name>` to
`app/<name>`. Hosting projects deploy each app from its own repository
([Vercel](../README.md#vercel-individual-apps)).

Local indexes, journals, and browser preferences are separate from the app
sources. Continue to back them up as described in
[Data and settings](../README.md#data-and-settings).
