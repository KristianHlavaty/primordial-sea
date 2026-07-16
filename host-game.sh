#!/usr/bin/env bash
# Primordial Sea — start the local-network multiplayer host (Linux/macOS).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to host multiplayer. Install it once from https://nodejs.org"
  exit 1
fi
exec node server/relay.mjs "$@"
