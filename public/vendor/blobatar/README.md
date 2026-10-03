# Blobatar 2.7.0

Euler vendors the actual, unmodified browser ESM bundles from the MIT-licensed
[Blobatar project](https://github.com/Alain00/blobatar). Avatar generation runs
locally; it does not call an avatar service or require a package installation.

- Package: `blobatar@2.7.0`.
- Upstream revision: `ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b`.
- Source: [published npm archive](https://registry.npmjs.org/blobatar/-/blobatar-2.7.0.tgz).
- License: [MIT](LICENSE), copyright (c) 2026 Alain.
- Vendored files: `dist/index.js`, `dist/expression.js`, their source maps, and
  the package license. JavaScript files have no external runtime dependencies.
- Integrity: the archive was checked against npm's SHA-512 integrity value.
  [provenance.json](provenance.json) records that value and SHA-256 hashes of
  every unmodified vendored file.

`index.js` provides the renderer and seeded trait sampler. `expression.js`
provides official expression poses. Euler's `../../euler-avatar.js` is a small
configuration/storage adapter. It restricts editable settings and maps shape
names to the midpoint of each official Blobatar 2 shape band. The SVG output is
used as a data URL in an image, with no inline SVG mutation or custom geometry.

The editor uses static poses, including a static frame of Thinking. Blobatar's
animation, gaze, framework adapters, and optional peer dependencies are not
included. User customization never changes these vendored files.

To update, choose an explicit version, verify the new npm archive integrity,
copy the same distribution files and license, update provenance and version
tests, and check shape-band compatibility before changing the pinned major.
