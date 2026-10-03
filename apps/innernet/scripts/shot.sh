#!/usr/bin/env bash
# Headless screenshot of a running page, for visual checks without a browser window.
#   scripts/shot.sh <url-path> <out.png> [width] [height] [light|dark]
#   scripts/shot.sh "/search?q=linear" /tmp/results.png 1440 1000 dark
# Use a tall height (e.g. 2400) to see a whole page. The capture waits for fonts and
# for the rise animations to finish; see scripts/shot.mjs.
set -euo pipefail
exec node "$(dirname "$0")/shot.mjs" "$1" "$2" "${3:-1440}" "${4:-1000}" "${5:-light}"
