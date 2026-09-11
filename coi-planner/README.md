# Harbor Production Planner

Ein schneller, zweisprachiger Produktionsplaner für **Captain of Industry**, entwickelt mit React, TypeScript und Vite.

## Sofort starten

| Betriebssystem | Aktion |
| --- | --- |
| Windows | `START-WEB-APP.cmd` doppelklicken |
| macOS | `START-WEB-APP.command` doppelklicken |
| Linux | `START-WEB-APP.sh` ausführen oder doppelklicken |

Voraussetzung ist **Node.js 20**. Beim ersten Start werden die Abhängigkeiten
automatisch installiert, danach öffnet sich die Web-App im Browser. Eine kurze
Schritt-für-Schritt-Anleitung steht in [`START-HIER.md`](START-HIER.md).

## Fähigkeiten

- Gemeinsame Materialbilanz für mehrere Produktionsziele
- Exakte lineare Lösung regulärer und unbeschränkter Reuse-Pläne
- Exakter innerer Solver mit begrenztem Fixpunkt für gedeckelte oder zielgebundene Wiederverwendung
- Vollständige Brutto-, Zuweisungs-, Rest- und Materialbilanzen
- Konservative, geprüfte Zielzerlegung für getrennte Diagrammansichten
- Konfigurierbare externe Quellen sowie dynamisch gültige Lager-, Export-, Verarbeitungs- und Entsorgungsrouten
- Rezeptfilter mit getrennten Forschungs-, Maschinen- und Variantenstufen T0–T5
- Transparente, begrenzte heuristische Beam-Suche mit Ressourcen- und Infrastrukturgrenzen
- Gebäudezentriertes Produktionsdiagramm: Eingänge links, Maschine/Rezept mittig und Haupt-/Nebenprodukte rechts
- Frei verschiebbare und im Plan gespeicherte Karten mit Auto-Layout-Reset, Pfadfokus, Minimap, Pan/Zoom und räumlicher Tastaturnavigation
- Versioniertes Planformat v4, validierter Import, lokale Speicherung und teilbare Links
- Deutsche und englische Benutzeroberfläche
- Responsive Desktop- und Mobilansicht

## Entwicklung

Voraussetzung ist Node.js 20.20.2.

```bash
npm ci
npm run dev
```

### Aktuelle Spieldaten importieren

Der DataExporter schreibt beim Laden des Spiels `coi_database.json` neben die
Mod-DLL. Der Planner kann diesen Export nach einer erfolgreichen Prüfung
übernehmen:

```bash
npm run import:current-data -- /pfad/zu/coi_database.json
```

Dabei werden `src/data/current-export.json`,
`src/data/current-research.json` und ein Versionsmanifest erzeugt. Der Export
enthält ab Schema-Version 3 zusätzlich Forschungszweige und typisierte
Freischaltungen. Die bestehenden Datenvalidatoren und die fachliche Prüfung
des Datensatzes bleiben vor einer Veröffentlichung erforderlich.

## Projektstruktur

Die Laufzeitstruktur folgt den fachlichen Verantwortlichkeiten:

```text
src/
	app/              Einstiegspunkt, App-Shell und globale Styles
	domain/           Spieldaten, Solver, Optimierung und Worker
	features/         Nutzerfunktionen wie Planner, Diagramm und Import/Export
	shared/           Wiederverwendbare UI-, Storage- und Fehlerbausteine
	data/             Generierte Laufzeitdaten und Manifest
	types.ts          Gemeinsames Domänenmodell
tests/e2e/          Kritische Desktop- und Mobile-Nutzerpfade
scripts/            Datenaufbau und Validierung
```

Neue fachliche Berechnung gehört nach `src/domain/`; sichtbare Nutzerfunktionen
gehören nach `src/features/`. `src/app/` bleibt auf Bootstrap und App-Komposition
begrenzt, `src/shared/` auf wiederverwendbare Bausteine ohne Planner-Fachlogik.

## Quality Gates

```bash
npm run check
npm run test:e2e
```

`npm run check` umfasst Prettier, ESLint, TypeScript, Unit-/Integrations-/Szenario- und Performanceprüfungen, Daten-/Progressions-/Capability-/Manifestvalidatoren sowie den Produktionsbuild. Playwright prüft kritische Desktop- und Mobilpfade einschließlich Sprache, Zielanlage, Speicherung und Diagrammtastatur.

In CI wird Chromium einschließlich Systemabhängigkeiten installiert und die E2E-Suite nach dem regulären Quality Gate ausgeführt.

## Datenstand

Beim Start sucht der mitgelieferte lokale Datenservice automatisch nach einem
aktuellen DataExporter-Export. Wird keiner gefunden, läuft die App mit dem
integrierten geprüften Datenstand weiter. Der Button **Aktuelle Daten suchen**
startet die Suche erneut; **Export auswählen** bleibt als manueller Fallback.

- Verifizierter Produktionsdatensatz: **v0.8.2c**
- Aktuell bekannte Spielversion: **v0.8.7b** vom 22.08.2026
- Umfang: 222 Produkte, 1.587 Rezepte und 179 Maschinen
- Progression: 631 produktionsrelevante Rezepte, vollständig über T0–T5 validiert

Ein direkter, lizenzkonformer v0.8.7b-Export liegt noch nicht vor. Der Planer behauptet deshalb ausdrücklich keine vollständige v0.8.7b-Datengenauigkeit. Quellenlage, Hashes, Transformationsstand und Freigabekriterien stehen in [`docs/DATA-SOURCE-STATUS.md`](docs/DATA-SOURCE-STATUS.md) und `src/data/data-manifest.json`.

Der aktuelle technische Reifegrad und die verbleibenden Release-Gates stehen in
[`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md).

## Solver und Optimierung

Die Materialrechnung meldet ihre tatsächliche Methode (`exact-linear`, `exact-linear-constrained` oder `iterative-fallback`) und das vollständige Residuum. Die Optimierung ist eine deterministische, budgetierte Beam-Suche und liefert **keinen globalen Optimalitätsbeweis**. Im Ergebnis werden Methode, Anzahl geprüfter Pläne, Suchbudget, Entscheidungsknoten und Constraint-Verletzung offengelegt.

## Performance

Automatisierte Budgets:

- Standardplan: p95 unter 50 ms
- gemeinsamer Multi-Ziel-Endgame-Plan: p95 unter 150 ms

Rezeptkatalog, gespeicherte Pläne und große Modale werden lazy geladen. Der Einstiegschunk liegt bei rund 317 kB minifiziert. Der gemeinsame Spiel-/Bilddatenchunk bleibt wegen des synchron benötigten Rezeptgraphen größer und ist als weitere Optimierungsgrenze dokumentiert.

## Fanprojekt-Hinweis

Dies ist ein inoffizielles Fanprojekt und steht in keiner Verbindung zu MaFi Games.
Die Nutzung und Weitergabe der benötigten Fanprojekt-Assets wird für dieses
Projekt als freigegeben vorausgesetzt. Der sichtbare Datenstand bleibt trotzdem
an den tatsächlich validierten Spielexport gebunden; aktuell ist v0.8.2c
verifiziert, während v0.8.7b nur als aktuell bekannte Spielversion dokumentiert
ist.
