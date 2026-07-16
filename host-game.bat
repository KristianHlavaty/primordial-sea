@echo off
title Primordial Sea - Multiplayer Host
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is required to host multiplayer.
  echo   Install it once from https://nodejs.org  ^(or run: winget install OpenJS.NodeJS.LTS^)
  echo.
  pause
  exit /b 1
)
node "%~dp0server\relay.mjs" %*
echo.
echo   Host stopped.
pause
