#!/usr/bin/env bash
# macOS: double-click this file to play (Finder opens .command files in Terminal).
# It just runs start-game.sh from this folder. Ctrl+C to stop.
# First time only, make it runnable:   chmod +x start-game.command start-game.sh
cd "$(dirname "$0")" || exit 1
exec bash ./start-game.sh "$@"
