#!/usr/bin/env bash
# Rebuild the film, carve the music bed under the narration, and lint.
# The carve writes onto the bed <audio> in index.html, so it runs after every build.
set -euo pipefail
cd "$(dirname "$0")/.."
node src/build.mjs
node "$HOME/.claude/skills/hyperframes-audio/scripts/carve.mjs" --comp index.html
npx --yes hyperframes@0.8.111 lint
