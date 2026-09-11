# Captain of Industry Planner

## Sofort starten

Die eigentliche Web-App liegt in `coi-planner/`.

1. Öffne den Ordner `coi-planner`.
2. Starte das passende Skript per Doppelklick:

| Betriebssystem | Startdatei |
| --- | --- |
| Windows | `START-WEB-APP.cmd` |
| macOS | `START-WEB-APP.command` |
| Linux | `START-WEB-APP.sh` |

Die Anwendung installiert beim ersten Start automatisch ihre Abhängigkeiten,
startet den lokalen Webserver und öffnet den Planer im Browser.

**Voraussetzung:** Node.js 20.

## Orientierung

| Bereich | Zweck |
| --- | --- |
| [`coi-planner/`](coi-planner/) | Die nutzbare Produktionsplaner-Web-App |
| [`coi-planner/START-HIER.md`](coi-planner/START-HIER.md) | Kurzanleitung für den Start |
| [`coi-planner/README.md`](coi-planner/README.md) | Funktionen und Entwicklung |
| [`coi-planner/docs/`](coi-planner/docs/) | Audits, Datenstand und Projektentscheidungen |
| [`coi-planner/docs/PROJECT-STATUS.md`](coi-planner/docs/PROJECT-STATUS.md) | Aktueller Reifegrad und Release-Gates |
| [`coi-graph-current/`](coi-graph-current/) | Separates Rezeptgraph-Projekt für Entwickler |
| [`exporter-audit/`](exporter-audit/) | Datenexporter für Entwickler und Datenpflege |

Für die normale Nutzung werden nur `coi-planner/` und das passende Startskript
benötigt. `src/`, `scripts/`, `tests/`, `exporter-audit/` und
`coi-graph-current/` müssen zum Starten der Web-App nicht geöffnet werden.

## Entwickler

Die vollständige Entwicklungsdokumentation und die Quality Gates stehen in
[`coi-planner/README.md`](coi-planner/README.md).