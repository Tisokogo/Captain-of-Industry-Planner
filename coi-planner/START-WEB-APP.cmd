@echo off
setlocal
cd /d "%~dp0"
title Harbor Production Planner

if not exist "package.json" (
  echo FEHLER: package.json wurde nicht gefunden.
  echo ERROR: package.json was not found.
  echo.
  echo Bitte die Startdatei im vollstaendigen Projektordner belassen.
  echo Keep this launcher inside the complete project folder.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden.
  echo Node.js was not found.
  echo.
  echo Bitte Node.js 20 installieren: https://nodejs.org/
  echo Please install Node.js 20: https://nodejs.org/
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo.
  echo Erster Start: Abhaengigkeiten werden installiert ...
  echo First launch: installing dependencies ...
  echo.
  call npm ci
  if errorlevel 1 (
    echo.
    echo FEHLER: Die Installation ist fehlgeschlagen.
    echo ERROR: Dependency installation failed.
    pause
    exit /b 1
  )
)

echo.
echo Die Web-App startet und oeffnet sich im Browser.
echo The web app is starting and will open in your browser.
echo Dieses Fenster zum Beenden schliessen oder Strg+C druecken.
echo Close this window or press Ctrl+C to stop.
echo.

call npm run start:local
if errorlevel 1 pause
