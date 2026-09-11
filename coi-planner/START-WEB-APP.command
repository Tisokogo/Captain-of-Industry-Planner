#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
printf '\033]0;Harbor Production Planner\007'

if [ ! -f package.json ]; then
  echo "FEHLER: package.json wurde nicht gefunden."
  echo "ERROR: package.json was not found."
  echo "Die Startdatei muss im vollständigen Projektordner bleiben."
  read -r -p "Enter drücken, um zu schließen … / Press Enter to close …"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js wurde nicht gefunden. / Node.js was not found."
  echo "Bitte Node.js installieren: https://nodejs.org/en/download"
  open "https://nodejs.org/en/download" 2>/dev/null || true
  read -r -p "Enter drücken, um zu schließen … / Press Enter to close …"
  exit 1
fi

if [ ! -x node_modules/.bin/vite ]; then
  echo "Erster Start: Abhängigkeiten werden installiert …"
  echo "First launch: installing dependencies …"
  npm ci
fi

echo "Die Web-App startet und öffnet sich im Browser."
echo "The web app is starting and will open in your browser."
echo "Zum Beenden dieses Fenster schließen oder Strg+C drücken."
npm run dev -- --open
