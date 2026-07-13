#!/usr/bin/env bash
# Primordial Sea — cross-platform launcher (macOS & Linux).
# Starts a tiny local web server and opens the game in your browser.
# (ES modules can't load from file://, so the game must be served over http.)
#
# First time only, make it runnable:   chmod +x start-game.sh
# Run it:                               ./start-game.sh          (or:  bash start-game.sh)
# Custom port:                          ./start-game.sh 9000
# Stop the server with Ctrl+C.
#
# Needs ONE of: python3, python, php, or node/npx (Python 3 is easiest;
# most Macs/Linux already have it — otherwise get it from https://www.python.org/).

cd "$(dirname "$0")" || exit 1
PORT="${1:-8888}"
URL="http://localhost:${PORT}/"

open_url() {
  if   command -v open       >/dev/null 2>&1; then open "$1"        # macOS
  elif command -v xdg-open   >/dev/null 2>&1; then xdg-open "$1"    # Linux (most desktops)
  else echo "Open your browser at: $1"
  fi
}

# open the browser a moment after the server comes up
( sleep 1; open_url "$URL" ) >/dev/null 2>&1 &

echo "Primordial Sea running at ${URL}  (Ctrl+C to stop)"

if   command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT"
elif command -v python  >/dev/null 2>&1; then exec python  -m http.server "$PORT"
elif command -v php     >/dev/null 2>&1; then exec php -S "localhost:${PORT}"
elif command -v npx     >/dev/null 2>&1; then exec npx --yes http-server -p "$PORT" -c-1
else
  echo ""
  echo "No python3, python, php, or node found on your PATH."
  echo "Install Python 3 from https://www.python.org/ and run this again."
  read -r -p "Press Enter to close..." _
  exit 1
fi
