# Web-App mit einem Klick starten

## Windows

Doppelklick auf:

```text
START-WEB-APP.cmd
```

## macOS

Doppelklick auf:

```text
START-WEB-APP.command
```

Falls macOS den ersten Start blockiert: Rechtsklick auf die Datei, **Öffnen**, danach nochmals **Öffnen** bestätigen.

## Linux

Doppelklick auf `START-WEB-APP.sh` und **Im Terminal ausführen** wählen. Alternativ:

```bash
./START-WEB-APP.sh
```

## Was automatisch passiert

1. Beim ersten Start werden die festgeschriebenen Abhängigkeiten mit `npm ci` installiert.
2. Der lokale Webserver startet.
3. Die Web-App öffnet sich automatisch im Standardbrowser.
4. Solange das Terminalfenster geöffnet bleibt, ist die App verfügbar.
5. Fenster schließen oder `Strg+C` drücken, um die App zu beenden.

Beim Start läuft zusätzlich ein kleiner lokaler Datenservice mit. Er sucht
automatisch nach einem aktuellen `coi_database.json`-Export und lädt ihn ohne
weitere Einrichtung. Wird kein Export gefunden, verwendet der Planner den
integrierten geprüften Datenstand. In der Toolbar kann die Suche mit
**Aktuelle Daten suchen** erneut gestartet werden.

## Einzige Voraussetzung

Auf dem Computer muss **Node.js 20** installiert sein. Falls Node.js fehlt, zeigen die Startdateien eine verständliche Meldung und öffnen die offizielle Downloadseite:

<https://nodejs.org/en/download>

Es ist keine globale Vite-, React- oder Playwright-Installation erforderlich.

## Manueller Ersatzweg

```bash
npm ci
npm run dev
```

Danach im Browser die von Vite ausgegebene Adresse öffnen, normalerweise `http://localhost:5173`.
