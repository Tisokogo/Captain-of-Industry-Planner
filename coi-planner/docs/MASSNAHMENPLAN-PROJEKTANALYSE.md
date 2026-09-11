# Projektanalyse und Maßnahmenplan

**Projekt:** Harbor Production Planner für Captain of Industry  
**Stand der Analyse:** 11.09.2026  
**Rolle:** Softwareentwicklung, Systemarchitektur und Game-UX

> **Status-Hinweis:** Dieses Dokument enthält die historische Analyse und den
> ursprünglichen Maßnahmenplan. Für den aktuellen Reifegrad sind
> [`PROJECT-STATUS.md`](PROJECT-STATUS.md),
> [`RELEASE-READINESS.md`](RELEASE-READINESS.md) und
> [`UMSETZUNGSFORTSCHRITT.md`](UMSETZUNGSFORTSCHRITT.md) maßgeblich.

## 1. Management Summary

Das Projekt ist ein funktionsreicher, lauffähiger Prototyp mit guter fachlicher Breite. Es verarbeitet 222 Produkte, 1.587 Rezeptdatensätze, 179 Maschinen und eine validierte T0–T5-Progression für 631 produktionsrelevante Rezepte. TypeScript- und Vite-Build sowie die Progressionsvalidierung bestehen.

Der größte Handlungsbedarf liegt nicht mehr bei zusätzlichen sichtbaren Features, sondern bei **Beweisbarkeit der fachlichen Korrektheit, Architektur, Testautomatisierung und Performance unter Last**. Mehrere Funktionen werden in Dokumentation und UI stärker bezeichnet, als ihre derzeitige Implementierung garantiert:

- Der Materialsolver erkennt SCCs, löst sie aber numerisch per gedämpftem Fixpunkt und nicht als exaktes Materialgleichungssystem.
- Die „globale“ Optimierung ist eine begrenzte Koordinatensuche über maximal acht Kandidaten und garantiert kein globales Optimum.
- Die getrennte Ansicht ist ein Teilgraph der globalen Lösung, enthält aber keine belastbare Flusszerlegung je Ziel.
- Externe Herkunftswerte sind feste Planungsannahmen und noch keine spielgenaue Infrastruktur- oder Kostenrechnung.
- Daten- und Capability-Metadaten sind teilweise im Code hart kodiert.

**Empfehlung:** Zuerst eine Stabilisierungsschleife mit Tests, Messwerten und einer modularen Architektur durchführen. Danach Solver, Optimierung und Datenpipeline fachlich härten. Neue Komfortfeatures erst anschließend ergänzen.

---

## 2. Geprüfter Projektumfang

### Anwendung

| Datei/Bereich | Beobachtung |
|---|---|
| `src/app/App.tsx` | Aktuelle App-Shell und Komposition der Planner-Oberfläche; historische Monolith-Bewertung in diesem Dokument ist überholt. |
| `src/domain/solver/planCalculator.ts` | Öffentliche Solver-Fassade für Datenzugriff, Rezeptwahl, Berechnung, Formatierung und Plan-Defaults. |
| `src/types.ts` | Zentrales Typmodell, derzeit sehr kompakt und teilweise noch von Legacy-Typen geprägt. |
| `src/i18n.ts` | Zweisprachiges Wörterbuch, aber viele Texte liegen weiterhin direkt in UI und Berechnungskern. |
| `src/app/styles/styles.css` | Globale App- und Hauptdesignregeln. |
| `src/app/styles/diagram.css` | Diagrammregeln für Knoten, SVG-Kanten, Minimap und Controls. |
| `src/priority3.css` | Nachträgliche Hilfs- und Mobile-Regeln; Name beschreibt keine dauerhafte fachliche Verantwortung. |
| `src/app/main.tsx` | Schlanker Einstiegspunkt und globale Style-Imports. |

### Daten und Daten-Build

| Datei/Bereich | Beobachtung |
|---|---|
| `src/data/recipes.json` | 1.587 Datensätze, ca. 924 KB; 14 Rezepte besitzen mindestens einen Output mit Menge 0. |
| `src/data/products.json` | 222 Produkte; keine fehlenden Rezept-Produktverweise. |
| `src/data/machines.json` | 179 Maschinen; alle von Rezepten verwendeten Maschinen existieren. |
| `src/data/categories.json` | 16 Kategorien. |
| `src/data/recipe-progression.json` | Progression für alle 1.587 Datensätze; 631 produktionsrelevante Rezepte werden validiert. |
| `scripts/reference-update3.json` | Ca. 1,9 MB große Update-3-Referenz als Progressionsquelle. |
| `scripts/build_recipe_progression.py` | Deterministischer Generator mit direkten Unlocks, Signaturabgleich und Fallbacks. |
| `scripts/validate-progression.mjs` | Coverage-, Tier-, Anchor- und Unresolved-Prüfung; derzeit nur Progressionstests. |

### Assets und Build

- 524 Dateien in `public/assets`, zusammen ca. 18,9 MB.
- JavaScript-Bundle: ca. 1,442 MB minifiziert / 177,5 KB gzip.
- CSS: ca. 33,1 KB / 7,7 KB gzip.
- Vite meldet den bekannten Chunk-Größenhinweis.
- Das Arbeitsverzeichnis belegt mit installierten Abhängigkeiten ca. 196 MB.
- Es existiert eine versehentliche leere Datei `./{}`.

### Dokumentation

Die Konzept- und Auditdokumente sind fachlich wertvoll, enthalten aber historische Aussagen und spätere Statusnachträge gleichzeitig. Dadurch widerspricht beispielsweise `FUNKTIONS-AUDIT.md` in frühen Kapiteln den weiter unten ergänzten „umgesetzt“-Blöcken.

---

## 3. Stärken

1. **Breiter Funktionsumfang:** Mehrfachziele, Filter, Progression, Netto-Ausgänge, Routen, Diagramm, Import/Export und Optimierung sind in einem bedienbaren Produkt verbunden.
2. **Striktes TypeScript:** `strict: true`, moderne ES2022-Zielplattform und bundlerbasierte Modulauflösung.
3. **Deterministische Progression:** Generator, Provenienz, Confidence und Golden Anchors sind eine gute Grundlage.
4. **Datenreferenzintegrität:** Keine fehlenden Maschinen- oder Produktreferenzen in den normalisierten Rezeptdaten.
5. **Materialflussdarstellung:** Getrennte Produkt-/Rezept-/Ziel-/Routenknoten und ratengelabelte SVG-Kanten sind game-designerisch deutlich verständlicher als der frühere Baum.
6. **Rückwärtskompatibilität:** Legacy-Planwerte und alte unkomprimierte Links werden weiterhin gelesen.
7. **Performancebewusstsein:** Exponentielle rekursive UI-Strukturen wurden vermieden; Optimierung ist bewusst begrenzt.

---

## 4. Risiken und Lücken

## 4.1 Kritisch – fachliche Korrektheit

### K1. Kein exakter Materialgleichungslöser

Die aktive Implementierung führt Tarjan-SCC-Erkennung und bis zu 80 gedämpfte Fixpunktiterationen aus. Sie löst SCCs nicht als lineares Gleichungssystem. Geschlossene oder beinahe geschlossene Wasser-, Dampf-, Recycling- und Nuklearkreisläufe können daher konvergieren, oszillieren oder durch Pfadabbruch als externer Input enden, ohne dass die physikalische Eindeutigkeit bewiesen ist.

Zusätzlich prüft das Residuum im Wesentlichen Output- und Reuse-Mengen, nicht alle Aktivitäten, Inputs und Kanten.

### K2. Stille Produktionsjob-Grenze

Die Jobqueue endet bei 20.000 Jobs. Anders als bei den Routen- und Fixpunktgrenzen wird dafür keine explizite Warnung erzeugt. Ein sehr großer oder ungünstig zyklischer Plan kann dadurch unvollständig wirken.

### K3. Heuristische globale Optimierung

Die Optimierung:

- betrachtet höchstens acht alternative Produktknoten,
- verwendet eine einmalige Koordinatensuche,
- hängt von der Startlösung und Reihenfolge ab,
- garantiert weder globale Optimalität noch vollständige Constraint-Erfüllung,
- berechnet im Filterdialog mehrere vollständige Varianten synchron im UI-Thread.

Die Bezeichnung „global“ ist nur im Sinne der Bewertungsfunktion korrekt, nicht im Sinne eines global gelösten Optimierungsproblems.

### K4. Getrennte Zielansicht ohne Flusszerlegung

Die getrennte Ansicht filtert den globalen Graphen nach Vorfahren. Gemeinsame Knoten zeigen weiterhin globale Raten. Eine eindeutige Zuordnung „welcher Anteil gehört zu Ziel A?“ ist nicht berechnet. Bei gemeinsamen Inputs und Nebenprodukten kann die Ansicht daher fachlich missverständlich sein.

### K5. Nullmengen und Pseudorezepte

14 Rezepte enthalten Output-Menge 0. Der Berechnungskern verwendet bei fehlender oder falsy Menge teilweise `|| 1`. Das verhindert Division durch null, ersetzt aber unbekannte Förderleistung durch eine willkürliche Rate und kann Maschinen-/Quellenwerte verfälschen.

---

## 4.2 Hoch – Architektur und Wartbarkeit

### A1. Monolithische Dateien

`App.tsx` und `calc.ts` vereinen jeweils zahlreiche Verantwortlichkeiten. Da große Teile auf einzelne physische Zeilen komprimiert sind, sind Reviews, Debugging, Merge-Konflikte und gezielte Tests unnötig schwierig.

### A2. Domänenlogik und Präsentation vermischt

Beispiele:

- Berechnungskern erzeugt deutsche Labels und Warntexte.
- Externe Herkunftsregeln existieren teilweise in `App.tsx`, operative Annahmen in `calc.ts`.
- Diagrammlayout wird innerhalb einer React-Komponente erzeugt.
- URL-Kompression befindet sich im Produktionsrechner.

### A3. Capability-Modell nur teilweise datengetrieben

Maschinen-IDs und Importproduktlisten sind als Sets im Quellcode hinterlegt. Der im Konzept beschriebene generierte `ProductCapabilities`-Index existiert nicht als versioniertes Datenartefakt. Neue Spielversionen können deshalb unbemerkt falsche Optionen erzeugen.

### A4. Legacy und tote Strukturen

- `TreeNode` und `roots` bleiben im Laufzeitmodell, obwohl die Tree-UI entfernt wurde.
- `outputSinks` bleibt in `PlanState` und Berechnung statt ausschließlich in einer Importmigration.
- Alte `.tree`, `.flow-node`, `.merged-*`-CSS-Regeln sind weiterhin vorhanden.
- `priority3.css` ist ein historischer Dateiname statt einer semantischen Stylestruktur.
- Leere Datei `./{}` ist zu entfernen.

### A5. Unkontrollierte Paketversionen

`package.json` verwendet überall `latest`. Der Lockfile stabilisiert aktuelle Installationen nur bei konsequentem `npm ci`; spätere Updates sind nicht geplant oder geprüft.

---

## 4.3 Hoch – Qualitätssicherung

### Q1. Keine automatisierten Anwendungstests

Es existieren keine Unit-, Integrations-, Komponenten-, E2E- oder Performance-Tests. Die einzige automatisierte Fachprüfung betrifft die Progression.

### Q2. Kein Linter, Formatter oder CI

Es fehlen ESLint, Prettier, ein CI-Workflow, Coverage-Grenzen und reproduzierbare Quality Gates.

### Q3. Importvalidierung ist handgeschrieben

Der Import prüft wichtige Felder, besitzt aber kein deklaratives, versioniertes Schema. Filterprofile aus `localStorage` werden separat und weniger streng gelesen. Der LZW-Linkzustand besitzt keine Prüfsumme und keine explizite Codecversion außerhalb des Präfixes.

### Q4. Keine Fehlergrenze

Ein unerwarteter Rendering- oder Datenfehler kann die gesamte React-Oberfläche entfernen. Eine Error Boundary mit Recovery und Diagnoseexport fehlt.

---

## 4.4 Mittel – Performance

1. Berechnung, Optimierung und Layout laufen im UI-Thread.
2. Der Filterdialog berechnet Vorher/Nachher und sechs Alternativen; jede globale Optimierung kann wiederum viele vollständige Pläne rechnen.
3. Diagramm und Rezeptbibliothek rendern alle sichtbaren DOM-/SVG-Elemente ohne Virtualisierung.
4. Das Diagrammlayout ist ein einfaches Stufenraster ohne Crossing-Minimierung oder inkrementelles Layout.
5. Alle großen JSON-Daten werden statisch in den Hauptchunk eingebunden.
6. 18,9 MB öffentliche PNG-Assets werden nicht als optimierte WebP/AVIF-Varianten ausgeliefert.
7. Google Fonts werden extern per CSS importiert; das erzeugt Datenschutz-, Offline- und Ladezeitrisiken.
8. Es gibt keine gemessenen p50/p95-Zeiten für Berechnung, Interaktion oder Endgame-Pläne.

---

## 4.5 Mittel – Game Design und UX

1. **Planungsannahmen:** 60 Einheiten/min, 180 Einheiten/min und 0,02 Unity sind fest kodiert. Nutzer können sie nicht konfigurieren; sie sind keine bestätigten Spieldaten.
2. **Konflikte:** Ungültige Ausgangsrouten erzeugen Warnungen, aber keinen geführten Reparaturdialog.
3. **Optimierungstransparenz:** Die UI erklärt nicht, dass nur ein begrenzter Suchraum geprüft wurde.
4. **Getrennte Ansicht:** Globale statt zielanteilige Werte sind nicht deutlich genug gekennzeichnet.
5. **Diagramm:** Keine Knotensuche, kein Fokuspfad, keine Kantenhervorhebung und keine Kreuzungsreduktion.
6. **Mobile:** Das Diagramm besitzt weiterhin eine Mindestbreite und ist eher horizontal scrollbar als mobil optimiert.
7. **Onboarding:** Hilfe existiert, aber es fehlen ein geführtes erstes Szenario, Presets und konkrete Warnungsaktionen.
8. **Kapazitäten:** Lagerfüllzeit, Cargo-Vertrag, Reisezeit und exakte Frachtermodule sind nur geschätzt oder fehlen.

---

## 4.6 Mittel – Lokalisierung und Accessibility

- Viele Filter-, Optimierungs-, Warn- und Importtexte sind weiterhin direkt deutsch kodiert.
- Der Berechnungskern erzeugt deutsche Fachtexte.
- Produktnamen besitzen nur eine kleine manuelle deutsche Teilmenge.
- 48 Buttons stehen nur 15 `aria-label`-Vorkommen gegenüber; viele Buttons haben sichtbaren Text, reine Iconfälle müssen jedoch systematisch geprüft werden.
- Standardmodale besitzen eine Fokusfalle; der große Filterdialog besitzt nur Dialogsemantik und ESC, aber keine vollständige Fokusfalle/Rückkehrlogik.
- Graphknoten sind fokussierbar, aber es fehlt räumliche Pfeiltastennavigation.
- Farbstatus benötigen zusätzlich Symbole/Text und Kontrasttests.

---

## 4.7 Datenstand und Reproduzierbarkeit

- Produktionsdaten werden als v0.8.2c/Update 4 bezeichnet.
- Die Progressionsreferenz stammt aus Update 3 und wird per IDs, Namen und Signaturen zugeordnet.
- Im Projekttext wird Kompatibilität bis v0.8.7b angenommen, aber nicht durch einen direkten v0.8.7b-Export bewiesen.
- Es fehlt ein durchgängiges Datenmanifest mit Spielversion, Quell-Commit, Exportzeitpunkt, Hashes, Lizenz und Transformationsversion.

---

## 5. Zielarchitektur

```text
src/
  app/                 App-Shell, Routing, Error Boundary
  domain/
    model/             IDs, Mengen, Einheiten, Plan- und Ergebnis-Schemas
    solver/            Graphaufbau, SCC, lineare Bilanz, Routen
    optimization/      Zielfunktion, Constraints, Solveradapter
    capabilities/      generierter Capability-Index
  features/
    goals/
    recipe-filter/
    outputs/
    external-sources/
    diagram/
    import-export/
    saved-plans/
  workers/
    calculation.worker.ts
    layout.worker.ts
  data/                generierte Laufzeitdaten + Manifest
  i18n/                de.ts, en.ts, Produktübersetzungen
  shared/              UI, Formatierung, Fehler, Hooks
scripts/
  data-build/
  validation/
tests/
  fixtures/
  unit/
  integration/
  e2e/
  performance/
```

Grundregeln:

- Domäne liefert strukturierte Codes, niemals lokalisierte Texte.
- Mengen verwenden explizite Einheiten und keine stillen Fallbacks.
- Importmigrationen sind versionierte, reine Funktionen.
- Berechnungsergebnisse sind deterministisch und serialisierbar.
- UI und Worker konsumieren denselben validierten Datenindex.

---

## 6. Maßnahmenplan

## Phase 0 – Baseline und Ehrlichkeit (1–2 Personentage)

**Ziel:** Reproduzierbaren Ausgangspunkt schaffen.

1. Versionen in `package.json` festschreiben; `npm ci` als Standard.
2. ESLint, Prettier und EditorConfig einführen; Dateien regulär formatieren.
3. Leere Datei `./{}` und eindeutig tote CSS-Regeln entfernen.
4. Build-Baseline dokumentieren: Bundle, Datenmenge, Defaultplan-Zeit, großer Referenzplan.
5. UI-Texte anpassen:
   - „SCC-stabilisierte Iteration“ statt „exakter SCC-Solver“.
   - „heuristische Kettenoptimierung“ samt geprüftem Suchraum.
   - getrennte Ansicht als globaler Teilgraph kennzeichnen.
6. Auditdokument in „historische Befunde“, „aktueller Stand“ und „offene Punkte“ aufteilen.

**Abnahme:** Ein neuer Entwickler kann mit `npm ci && npm run check` exakt denselben Stand erzeugen.

## Phase 1 – Testfundament und Schemas (3–5 Personentage)

1. Vitest und React Testing Library einführen.
2. Playwright für kritische Nutzerpfade ergänzen.
3. Zod oder JSON Schema für Planformat v4, Filterprofile und gespeicherte Pläne verwenden.
4. Versionierte Migrationen `v1 -> v2 -> v3 -> v4` erstellen.
5. Unit-Tests für LZW einschließlich Unicode, beschädigter Daten und Größenlimits.
6. Error Boundary, Diagnoseexport und sichere LocalStorage-Zugriffe ergänzen.
7. CI mit Gates:
   - Typecheck
   - Lint/Format
   - Unit/Integration
   - Progression
   - Build
   - E2E-Smoke

**Mindesttests:** Defaultplan, Mehrfachziele, Nebenprodukt mit Teilreuse, ungültige Route, Filterkonflikt, Importmigration, komprimierter Link.

## Phase 2 – Modularisierung ohne Funktionsänderung (4–7 Personentage)

1. `App.tsx` in Feature-Komponenten zerlegen.
2. `calc.ts` in Datenindex, Auswahl, Bilanz, Routen, Optimierung und Codec trennen.
3. URL-Codec in `features/import-export` verschieben.
4. Diagrammmodell und Layout aus React herauslösen.
5. `TreeNode`, `roots` und Legacy-`outputSinks` aus dem aktiven Modell entfernen; Legacy nur im Migrator lesen.
6. Semantische Stylesheets oder CSS Modules verwenden; `priority3.css` auflösen.
7. Strukturierte `WarningCode`-/`ConflictCode`-Typen statt deutscher Strings einführen.

**Abnahme:** Snapshot- und Golden-Tests zeigen für bestehende Fixtures identische Ergebnisse.

## Phase 3 – Datenpipeline und Capabilities (4–6 Personentage)

1. `data-manifest.json` mit Versionen, Hashes, Quellen und Lizenzhinweisen erzeugen.
2. Direkten aktuellen Spiel-/Exporter-Datensatz beschaffen und Update-3-Mapping ablösen oder eindeutig als Fallback markieren.
3. Generierten `product-capabilities.json` einführen:
   - Aggregatzustand/Transporttyp
   - Lagerkompatibilität und Kapazität
   - Förderbarkeit
   - Cargo-/Handelsfähigkeit
   - Dump/Flare/Wastewater-Routen
   - Research-Verfügbarkeit
4. Harte Sets wie `importableProducts`, `extractionMachines` und `capabilityByMachineId` aus Anwendungscode entfernen.
5. Nullmengen als `unknownCapacity` modellieren, nicht als Menge 1 behandeln.
6. Datenvalidatoren für positive Dauer, Mengen, Einheiten, IDs, Ports und Routeklassifikation ergänzen.
7. Capability-Audit für alle 222 Produkte generieren.

**Abnahme:** Keine fachliche Verfügbarkeit wird anhand eines UI-Namens oder einer ungeprüften Liste entschieden.

## Phase 4 – Materialsolver v2 (7–12 Personentage)

1. Kanonisches bipartites Modell aus RecipeActivity- und MaterialBalance-Knoten erstellen.
2. SCCs topologisch zerlegen.
3. Lineare Teilprobleme als `A*x=b` lösen; Nichtnegativität und Singularität explizit behandeln.
4. Externe Zuführung, Ziele, Reuse-Caps und Ausgangsrouten als Constraints modellieren.
5. Für nichtlineare/entscheidungsabhängige Fälle klaren äußeren Fixpunkt mit vollständigem Residuum verwenden.
6. Massenbilanzinvariante je Produkt ausgeben:
   
   ```text
   Produktion + Import = Verbrauch + Ziel + Sink + offen
   ```
7. Job-, Iterations- und Routenlimits immer als strukturierte Fehler melden.
8. Golden Fixtures für Wasser/Dampf, Raffinerie, Sour Water, Abgaswäsche, Recycling und Nuklear erstellen.

**Abnahme:** Residuum jedes Produkts unter definierter Toleranz; kein stiller Abbruch; deterministische Ergebnisse unabhängig von Queue-Reihenfolge.

## Phase 5 – Zielzerlegung und exakte Diagrammsemantik (4–7 Personentage)

1. Nach globaler Lösung eine Flow-Decomposition pro Ziel durchführen.
2. Gemeinsame Produktionen proportional oder anhand einer dokumentierten Allokationsregel auf Ziele verteilen.
3. Zielübergreifende Reuse-Kanten spiegelbildlich darstellen.
4. Route-Nodes über stabile IDs statt Label-/Stringabgleich zuordnen.
5. Diagrammlayout mit Dagre/ELK oder eigenem Crossing-Reduction-Schritt erzeugen.
6. Knotensuche, Pfadhervorhebung, Legende und Konfliktfokus ergänzen.
7. Große Graphen virtualisieren; Kanten ggf. Canvas, Labels selektiv.

**Abnahme:** Summe der Zielanteile entspricht für jede Aktivität exakt der globalen Lösung.

## Phase 6 – Optimierung v2 und Performance (6–10 Personentage)

1. Zunächst Produktentscheidung treffen:
   - **Fast:** transparent heuristische Beam Search mit Budget und Optimalitätsstatus.
   - **Exact:** LP/MILP-Adapter für Rezeptaktivitäten und diskrete Rezeptwahl.
2. Constraints formal modellieren: Ressourcen, Arbeiter, Strom, Computing, Wartung, Maschinen.
3. Pareto-Front statt sechs möglicherweise identischer Einzelalternativen erzeugen.
4. Rechencore in Web Worker verschieben; Abbruch alter Requests mittels Request-ID/Abort.
5. Memoisierte Teilgraphen und inkrementelle Invalidierung einführen.
6. Filterdialog-Alternativen lazy berechnen.
7. JSON-Daten nach Feature splitten oder binär/kompakt vorverarbeiten.
8. Assetpipeline für WebP/AVIF und responsive Größen.
9. Externe Google-Fonts entfernen oder lokal bündeln.

**Performancebudgets:**

- Standardplan p95 < 50 ms Rechenkern
- großer Endgame-Plan p95 < 150 ms oder progressive Worker-Antwort
- Interaktion Pan/Zoom p95 < 16,7 ms pro Frame
- Filterdialog Time-to-Interactive < 200 ms
- Hauptchunk < 500 KB minifiziert, sofern Daten gesplittet werden

## Phase 7 – Game-UX, Lokalisierung und Release (4–7 Personentage)

1. Alle Texte über i18n-Keys führen; Berechnung liefert nur Codes und Parameter.
2. Vollständige deutsche Produktübersetzung als versionierte Datendatei oder klarer offizieller Fallbackstatus.
3. Externe Quellen als editierbare Szenarien:
   - Durchsatz
   - Modulanzahl
   - Reisezeit
   - Unity/Kosten
   - Pufferdauer
4. Konfliktassistent mit „Alternative wählen“, „Filterausnahme“ und „offen lassen“.
5. Optimierungsbericht mit Suchbudget, Constraints, Verbesserung und Optimalitätsstatus.
6. Geführtes Onboarding und Presets für frühes/mittleres/spätes Spiel.
7. Mobile Diagrammansicht mit Fokusmodus statt nur Mindestbreite.
8. WCAG-2.2-AA-Audit: Kontrast, Tastatur, Screenreader, Reduced Motion, Fokus.
9. Lizenz-, Quellen- und Fanprojektseite vor Veröffentlichung finalisieren.

---

## 7. Testmatrix

### Unit

- Rezeptfilter und Techfreigabe
- Capability-Abfragen
- SCC-Zerlegung und lineare Gleichungen
- Routen-Caps und Restmengen
- Zielfunktions- und Constraintbewertung
- Migrationen und URL-Codec
- Mengenformatierung und Einheiten

### Integration

- Zwei Ziele mit gemeinsamem Zwischenprodukt
- Zielübergreifende interne Wiederverwendung
- Verarbeitungsroute mit Extra-Input und Folgeoutput
- Filteränderung invalidiert Route
- Externe Quelle verändert Infrastruktur und Kosten
- getrennte Zielanteile summieren sich zur Gesamtlösung

### E2E

- Plan erstellen, speichern, neu laden
- Export v4 und Reimport mit Bericht
- Link teilen und Zustand wiederherstellen
- Sprache umschalten
- Diagramm zoomen, einpassen, einklappen
- mobiler Navigationspfad

### Property-/Invariantentests

- Keine negative Aktivität oder Rate
- Jede Kante verweist auf existierende Knoten
- Jede Materialbilanz schließt innerhalb Toleranz
- Zugewiesen + offen = Bruttoüberschuss
- Gefilterte Rezepte erscheinen nie in automatischen Lösungen
- Gleicher Zustand erzeugt deterministisch das gleiche Ergebnis

### Performance

Mindestens drei versionierte Fixtures: klein, mittel, Endgame. Ergebnisse und p50/p95 werden in CI gespeichert und gegen Regressionsbudgets geprüft.

---

## 8. Priorisierung nach Nutzen/Risiko

| Rang | Maßnahme | Nutzen | Risiko bei Aufschub |
|---:|---|---|---|
| 1 | Tests, Schemas, CI | Sehr hoch | Fehler bleiben unentdeckt; Refactoring riskant |
| 2 | Solver v2 + Invarianten | Sehr hoch | Fachlich falsche Pläne in komplexen Kreisläufen |
| 3 | Modularisierung | Hoch | Entwicklung verlangsamt sich, Regressionen nehmen zu |
| 4 | Daten-/Capability-Pipeline | Hoch | Falsche Optionen nach Spielupdates |
| 5 | Zielzerlegung | Hoch | Getrennte Ansicht bleibt missverständlich |
| 6 | Worker und Performancebudgets | Hoch | Endgame-Pläne blockieren UI |
| 7 | Optimierung v2 | Mittel bis hoch | „Optimal“-Erwartung wird nicht erfüllt |
| 8 | UX/i18n/A11y | Mittel | Geringere Nutzbarkeit und Releasequalität |

---

## 9. Empfohlene Releases

### Release 0.2 – Stabilisierung

Phasen 0–2: Tooling, Tests, Schemas, modulare Struktur, keine neue Fachlogik.

### Release 0.3 – Verifizierte Berechnung

Phasen 3–5: Datenmanifest, Capability-Index, Solver v2, exakte Zielzerlegung.

### Release 0.4 – Schnelle Planung

Phase 6: Worker, Performance, transparente Optimierung, Pareto-Alternativen.

### Release 1.0 – Veröffentlichungsreif

Phase 7 plus vollständige Regression, Accessibility, Lokalisierung, Lizenz- und Quellenprüfung.

---

## 10. Definition of Done für Version 1.0

1. Jede Produktbilanz ist maschinell geprüft und geschlossen.
2. Zyklen werden exakt gelöst oder als unlösbar/singulär erklärt.
3. Jede Optimierung nennt Methode, Suchraum und Optimalitätsstatus.
4. Getrennte Zielansichten summieren sich zur globalen Lösung.
5. Capabilities und externe Quellen stammen aus versionierten Daten, nicht aus UI-Hardcodes.
6. Import, gespeicherte Pläne und Links sind schemavalidiert und migrierbar.
7. Kritische Pfade besitzen Unit-, Integrations- und E2E-Abdeckung.
8. CI blockiert Type-, Lint-, Test-, Progressions- und Performancefehler.
9. Definierte p95-Performancebudgets werden eingehalten.
10. Deutsch und Englisch sind vollständig; WCAG 2.2 AA ist geprüft.
11. Datenversion, Quelle, Hash und Lizenzstatus sind sichtbar und reproduzierbar.
12. Dokumentation beschreibt den aktuellen Stand ohne widersprüchliche historische Statusangaben.

---

## 11. Unmittelbar empfohlener nächster Sprint

**Sprintziel:** Eine belastbare Basis schaffen, bevor Solver und Optimierung erneut verändert werden.

1. Versionen pinnen, ESLint/Prettier/Vitest installieren.
2. Quellcode formatieren und `App.tsx`/`calc.ts` ohne Verhaltensänderung aufteilen.
3. Acht Golden-Fixtures für Kernketten definieren.
4. Materialbilanz-Invarianten und Warnung für das 20.000-Job-Limit ergänzen.
5. Planformat v4 durch ein deklaratives Schema ersetzen.
6. Legacy-`outputSinks`, `TreeNode`, tote Styles und `./{}` bereinigen.
7. Drei Performancefixtures und Messskript einführen.
8. Dokumentation konsolidieren und heuristische Funktionen korrekt kennzeichnen.

**Sprint-Abnahme:** `npm run check` führt Format, Lint, Typecheck, Unit-Tests, Progressionsprüfung und Build aus; alle acht Fixtures schließen ihre Materialbilanz oder liefern einen erwarteten strukturierten Konflikt.
