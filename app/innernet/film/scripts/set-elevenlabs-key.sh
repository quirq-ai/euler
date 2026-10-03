#!/usr/bin/env bash
# Asks for the ElevenLabs API key without echoing it, saves it to .env (gitignored,
# readable only by you), and checks it against ElevenLabs. The key is never printed.
set -euo pipefail
cd "$(dirname "$0")/.."

printf "Paste your ElevenLabs API key (input is hidden), then press Enter: "
IFS= read -rs key
echo
key="${key//[[:space:]]/}"
if [ -z "$key" ]; then
  echo "No key entered. Nothing saved."
  exit 1
fi

umask 077
grep -v '^ELEVENLABS_API_KEY=' .env 2>/dev/null > .env.tmp || true
printf 'ELEVENLABS_API_KEY=%s\n' "$key" >> .env.tmp
mv .env.tmp .env
chmod 600 .env
echo "Saved to $(pwd)/.env"

code=$(curl -s -o /dev/null -w '%{http_code}' -H "xi-api-key: $key" "https://api.elevenlabs.io/v1/voices?page_size=1" || echo 000)
case "$code" in
  200) echo "Key works. You can close this tab." ;;
  401) echo "ElevenLabs rejected this key (401). Run this again with the right one." ;;
  403) echo "Saved, but this key may not have the Voices permission (403). Text to speech may still work." ;;
  *) echo "Could not confirm the key (HTTP $code). It is saved; Claude will retry." ;;
esac
