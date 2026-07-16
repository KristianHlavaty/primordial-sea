#!/usr/bin/env bash
# Primordial Sea — start the multiplayer host (double-click on macOS).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to host multiplayer. Install it once from https://nodejs.org"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
node server/relay.mjs "$@"
