@echo off
rem Double-click to play: starts a tiny local web server and opens the game.
rem Keep this window open while playing; close it (or Ctrl+C) to stop.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" -OpenBrowser
pause
