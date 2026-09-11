# Umsetzungsfortschritt zum Maßnahmenplan

Stand: 11.09.2026

> Die Dateinamen `App.tsx` und `calc.ts` in den historischen Rückblicken
> beziehen sich auf die frühere Struktur. Der aktuelle Code liegt unter
> `src/app/App.tsx` und `src/domain/solver/planCalculator.ts`.

## Abgeschlossen: Phase 0 – Baseline und Stabilisierung

- Abhängigkeiten auf konkrete Versionen festgeschrieben; Projektversion auf 0.2.0 erhöht.
- Reproduzierbare Installation über `npm ci` und `.npmrc` vorbereitet.
- ESLint, TypeScript-ESLint, React-Hooks-Regeln, Prettier und EditorConfig eingerichtet.
- Vollständigen TypeScript-, TSX- und CSS-Code aus Einzeilenformat in reviewfähiges Format überführt.
- `npm run check` als einheitliches Quality Gate eingerichtet.
- Versehentliche Datei `./{}` entfernt.
- Externen Google-Font-Import entfernt.
- Historische `priority3.css` semantisch in `responsive.css` umbenannt.
- Nicht mehr genutztes `TreeNode`-/`roots`-Laufzeitmodell entfernt.
- Legacy-`outputSinks` aus `PlanState` und Berechnung entfernt; es wird nur noch beim Import migriert.
- Explizite Warnung für das Sicherheitslimit von 20.000 Produktionsjobs ergänzt.

## Abgeschlossen: Phase 1 – erstes Test- und Schemafundament

- Vitest, jsdom und Testing Library eingerichtet.
- 25 automatisierte Tests in sechs Testdateien:
  - deterministische Defaultberechnung,
  - Nichtnegativität und Überschussinvariante,
  - vollständige interne Bedarfsbilanz,
  - Filter-/External-Fallback,
  - Auto-Expand-Verhalten,
  - Datenreferenzintegrität,
  - UTF-8-Linkcodec,
  - acht Golden-Szenarien,
  - Import-/Migrationsschema,
  - sichere LocalStorage-Helfer,
  - erstes Performancebudget,
  - Capability-Coverage, Referenzintegrität, fachliche Anker und Filterwirkung.
- Zod-basiertes Planformat- und Importschema eingeführt.
- Importnormalisierung und Legacy-Migration aus `App.tsx` in `features/import-export/planSchema.ts` ausgelagert.
- React Error Boundary mit Diagnoseexport ergänzt.
- Sichere Storage-Helfer eingeführt und für Hauptplan, Sprache und gespeicherte Pläne angebunden.
- GitHub-Actions-CI für `npm ci` und `npm run check` ergänzt.

## Wichtiger gefundener und behobener Fehler

Die neuen Bilanztests zeigten beim Defaultplan einen Restfehler von 0,0517936963/min für `aluminum_scrap`. Ursache war eine explosionsartige Expansion zyklischer Recyclingrezepte bis zum 20.000-Job-Limit. Die Rezeptwahl verwirft nun Produktionspfade, deren Inputgraph wieder zum angefragten Produkt zurückführt. Der Defaultplan und alle acht Szenarien schließen ihre interne Bedarfsbilanz jetzt unter 1e-6 und erreichen das Joblimit nicht.

## Phase 2 – Modularisierung (laufend)

- Produktionsdiagramm nach `features/diagram` ausgelagert.
- Quellenkompatibilität nach `features/external-sources` ausgelagert.
- Linkcodec nach `features/import-export` ausgelagert.
- Gemeinsame Bild- und Modal-Komponenten nach `shared` ausgelagert.
- Rezeptbibliothek, gespeicherte Pläne, Planner-Modale, Planner-Hauptansicht, Zusammenfassung und Rezeptfilter in Featuremodule zerlegt.
- Rezeptwahl, Filterfreigabe und Routenverfügbarkeit aus der früheren Berechnungsfassade nach `domain/solver/recipeSelection.ts` verschoben.
- Materialrechnung nach `domain/solver/materialBalance.ts` und heuristische Optimierung nach `domain/optimization/heuristicOptimizer.ts` getrennt; die öffentliche Plan-/Solver-Fassade liegt in `domain/solver/planCalculator.ts`.
- Das deterministische Diagrammmodell und Layout aus React nach `features/diagram/diagramModel.ts` extrahiert und direkt getestet.
- Strukturierte `DiagnosticCode`-Ergebnisse statt lokalisierter Solver-/Constraint-Strings eingeführt; die UI lokalisiert diese Diagnosen zentral.
- Tote Tree-, Flow-Node- und frühere Merged-View-Styles entfernt; CSS-Build von 33,36 kB auf 29,62 kB reduziert.
- Die frühere monolithische `App.tsx`- und `calc.ts`-Struktur wurde in `src/app/App.tsx`, `src/domain/solver/planCalculator.ts` und die fachlichen Feature-/Domainmodule aufgeteilt.

## Phase 3 – Datenpipeline und Capabilities (begonnen)

- Deterministischen `product-capabilities.json`-Generator mit expliziten, geprüften Overrides eingeführt.
- Capability-Audit für alle 222 Produkte generiert.
- Capability-Schema v2 ergänzt Lageranlagen und -kapazitäten, Transporttypen, Cargo-/Handelskompatibilität, unbekannte Kapazitäten und verfügbare Forschungsstufen.
- Aktuellen Versionsstand v0.8.7b und geeigneten Live-Datenexporter geprüft; der fehlende direkte v0.8.7b-Snapshot und die Freigabekriterien sind in `DATA-SOURCE-STATUS.md` transparent dokumentiert.
- Die erneute öffentliche Recherche vom 10.09.2026 ist in `PUBLIC-DATA-AUDIT-2026-09-10.md` protokolliert. Geprüft wurden insbesondere der GPL-Exporter von FelixZett, captain-of-data, coi-graph, aktuelle Calculator-Repositories und öffentliche Releases. Es existiert weiterhin kein vollständig prüfbarer öffentlicher v0.8.7b-Produktionssnapshot; der vorhandene Datensatz wird deshalb nicht irreführend umetikettiert.
- Reproduzierbares `data-manifest.json` mit Datenstand, Quellenstatus, Transformationsversion, Dateigrößen und SHA-256-Hashes eingeführt.
- Nullmengen-Förderrezepte werden nicht mehr still als Menge 1 gerechnet: unbekannter Durchsatz bleibt als externer Bedarf offen und erzeugt eine Diagnose.
- Anwendungshardcodes für Quellen- und Ausgangsrouten durch den generierten Index ersetzt.
- Validator und `--check`-Modus verhindern fehlende, referenziell ungültige oder veraltete Artefakte.
- Allgemeiner Datenvalidator prüft positive Dauern und Inputs, nichtnegative Outputs, Produkt-/Maschinen-/Kategorie-Referenzen sowie die explizit bekannten Nullkapazitäts- und Sink-Datensätze.
- Cargo-Metadaten geprüft: Die normalisierten Cargo-Maschinen enthalten keine Rezepte oder Produktkompatibilitäten. Exportoptionen werden daher derzeit bewusst nicht geraten; die Quellenlücke ist im Audit dokumentiert.

## Phase 4 – Materialsolver v2 (begonnen)

- Kanonisches Materialmodell mit einer Bilanzzeile und einer ausgewählten Rezeptaktivität je intern produziertem Material eingeführt.
- Numerischen linearen Gleichungslöser mit partieller Pivotisierung und vollständigem Residuum eingeführt.
- Singuläre, inkonsistente und mathematisch negative Aktivitätslösungen werden getrennt erkannt.
- Nichtnegative Active-Set-Behandlung ergänzt: Wenn vollständige Nebenprodukt-Reuse negative Eigenproduktion erfordern würde, wird die Aktivität auf null gesetzt und der unvermeidbare Überschuss als nichtnegative Slack-Variable gelöst.
- Die aktive Planberechnung verwendet für reguläre Pläne und unbeschränkte interne Wiederverwendung die exakte lineare Bilanz.
- Gedeckelte und einem Verbraucher/Rezept/Ziel zugewiesene Reuse wird über einen klar begrenzten äußeren Fixpunkt bestimmt; jeder innere Materialschritt wird anschließend exakt linear gelöst. Der Fallback bleibt nur für singuläre oder im kanonischen Modell nicht repräsentierbare Sonderfälle.
- Das äußere Residuum umfasst Outputs, Reuse, externe Inputs, Bedarfe, Aktivitätsraten und Maschinenzahlen statt nur Überschüsse.
- Solver-Methode und Residuum werden im Ergebnis geführt und in der Zusammenfassung ehrlich unterschieden: `exact-linear`, `exact-linear-constrained` und `iterative-fallback`.
- Tests vergleichen das kanonische Modell mit dem etablierten Defaultplan und decken Mehrfachziele, Nullkapazitäten, Wasser-/Dampf-Reuse, Singularität, Inkonsistenz, Nichtnegativität und Eingabeimmutabilität ab.
- Bei partieller Wiederverwendung wird der nicht zugewiesene Rest nun explizit als eigene Ausgangsroute ausgegeben.

## Phase 5 – Zielzerlegung und Diagrammsemantik (begonnen)

- Globale Knoten-, Kanten- und Ausgangsraten werden für die getrennte Ansicht deterministisch auf einzelne Ziele zerlegt.
- Gemeinsam verwendete Aktivitäten erhalten dokumentierte proportionale Anteile anhand der Zielraten.
- Die Summe aller Zielanteile reproduziert für jeden globalen Knoten, jede Kante und jede Ausgangsroute exakt die globale Lösung; dies wird automatisiert geprüft.
- Nebenprodukte aus relevanten Produktionsketten werden in die Zielanteile einbezogen.
- Ausgangsrouten besitzen stabile `routeId`-Werte; die Diagrammzuordnung verwendet keinen Label- oder Stringteilvergleich mehr.
- Reine Nebenprodukt-/Überschussprodukte werden nun als eigene Graphknoten mit korrekter Bruttorate dargestellt, sodass auch ihre Sink- und Restrouten vollständig sichtbar sind.
- Die Diagrammsuche findet sichtbare Produkt-, Rezept-, Ziel- und Routenknoten, fokussiert das Ergebnis und zentriert es im Viewport.
- Der Fokus markiert zyklussicher den vollständigen vor- und nachgelagerten Pfad; nicht zugehörige Zweige und Minimap-Knoten werden gedimmt.
- Diagrammkarten sind per Tastatur erreichbar. Die Pfeiltasten wechseln deterministisch zum räumlich nächsten Knoten, setzen den DOM-Fokus und halten ihn durch Zentrierung sichtbar; Escape hebt den Pfadfokus auf.

## Phase 6 – Performancebudgets (begonnen)

- Defaultplan-Budget auf p95 unter 50 ms verschärft.
- Gemeinsames Multi-Ziel-Endgame-Fixture mit p95-Budget unter 150 ms ergänzt.
- Unnötige zweite exakte Lösung für Pläne ohne Reuse entfernt; beide Kernbudgets bestehen im Quality Gate.
- Testdateien werden für belastbare Performancewerte ohne parallele CPU-Konkurrenz ausgeführt.
- Die teure Rezeptwahl wird per Objektidentität unveränderlicher Auswahl-, Filter- und Optimierungszustände memoisiert; wiederholte Kreisversorgungsprüfungen entfallen.
- Rezeptkatalog, gespeicherte Pläne, Planner-Modale und Rezeptfilter werden über `React.lazy` erst bei ihrer ersten Nutzung geladen. Der Einstiegschunk sank dadurch von ca. 1,760 MB auf aktuell 317,28 kB; große gemeinsam benötigte Spiel-/Bilddaten liegen separat bei 1,428 MB.
- Eine Worker-Auslagerung des Solvers ist vorerst bewusst zurückgestellt: Die gemessenen Kernbudgets liegen bereits unter 50/150 ms, während ein Worker den großen Datenbestand serialisieren oder duplizieren und die synchrone UI-/Persistenzarchitektur deutlich verkomplizieren würde.
- Die bisherige einmalige Koordinatensuche wurde durch einen hybriden Optimierer ersetzt: Passen alle aktiven Rezeptkombinationen in das harte Budget von 128 Auswertungen, werden sie vollständig enumeriert und das Optimum für diesen vollständigen aktiven Alternativenraum bewiesen. Größere Räume verwenden weiterhin die deterministische, budgetierte Beam-Suche und werden ausdrücklich als heuristisch gekennzeichnet. Der Ergebnisbericht nennt Methode, Beweisstatus, Suchbudget, geprüfte Pläne, Entscheidungsknoten und Constraint-Verletzung.
- Die sechs Optimierungsalternativen im Filterdialog werden nicht mehr beim Öffnen synchron berechnet, sondern erst auf ausdrückliche Anforderung.
- `App.tsx` trennt Berechnungszustand von reinen Diagrammpositionen und Ein-/Ausklappzuständen. Verschieben und Aufklappen lösen deshalb keine neue Materialrechnung aus.
- Die budgetierte Rezeptoptimierung hält bis zu 64 Rezeptwahlergebnisse in einem begrenzten Cache. Ausgangsrouten gehören absichtlich nicht zum Schlüssel: Eine geänderte Ausgangsaktion berechnet Bilanz, Routen und Diagramm neu, ohne die unveränderte Beam-Suche zu wiederholen.
- Automatische Ausgangsentscheidungen werden während der Beam-Bewertung unterdrückt und nur für das finale Ergebnis bestimmt; dadurch bleiben die Suchauswertungen klein und vergleichbar.

## Phase 7 – Accessibility, E2E und Releasevorbereitung (begonnen)

- Gemeinsame Fokusfalle mit Escape-Behandlung und Rückkehr zum auslösenden Element für Standard- und Rezeptfilterdialoge eingeführt und getestet.
- Global sichtbarer Tastaturfokus und `prefers-reduced-motion`-Regeln ergänzt.
- Automatisierten Axe-Audit für WCAG 2.0/2.1/2.2 A/AA ergänzt und gefundene Kontrast-, Beschriftungs-, Button- und Zielgrößenprobleme behoben; die Aussagegrenzen stehen in `ACCESSIBILITY-AUDIT.md`.
- Playwright-E2E-Suite für Desktop und Mobile ergänzt: Sprache, Zielanlage, Speichern/Laden und Diagramm-Pfeiltastennavigation.
- CI installiert Chromium samt Systemabhängigkeiten und führt die E2E-Suite nach dem vollständigen Quality Gate aus.
- Fachtexte der externen Quellen wurden aus dem Solver entfernt; die Domäne liefert jetzt strukturierte Annahmecodes, die UI lokalisiert sie.
- Sichtbare Datenangaben behaupten keine v0.8.x-Kompatibilität mehr, sondern unterscheiden verifizierten Stand v0.8.2c und aktuell bekannte Version v0.8.7b.
- `../README.md` konsolidiert und `RELEASE-READINESS.md` mit technischer Freigabe, externen Blockern und verbindlichem Releaseverfahren ergänzt.
- Regression aus einem realen Construction-Parts-IV-Diagnoseexport behoben: Elektronik II, Elektronik und Stahl werden nicht mehr wegen zyklischer, aber ungewählter Rezeptvarianten fälschlich als externe Endpunkte behandelt.
- Luft- und Wasserverschmutzung werden als unvermeidbare Emissionen automatisch vollständig zugewiesen und nicht mehr als konfigurierbare Nettoausgänge angeboten.
- Pointer-Pan liest nun einen stabilen Drag-Snapshot, behandelt `pointercancel` und prüft Pointer-Capture vor der Freigabe; damit ist der gemeldete Firefox-Absturz beseitigt.
- Produktbegriffe in Ziel-, gespeicherten Plan-, Rezeptfluss-, Ressourcenlimit- und Diagrammkontexten verwenden konsistent die aktive Sprache; Bauteile IV wurde ergänzt.
- Die Diagrammsemantik wurde gebäudezentriert: Jedes Produktionsgebäude enthält seine Eingänge links, Maschine und Rezept in der Mitte sowie Haupt- und Nebenprodukte rechts mit tatsächlichen Raten.
- Interne Produkt-Zwischenkarten werden nicht mehr doppelt dargestellt; externe Inputs, Ziele und Ausgangsrouten bleiben als eigenständige Karten sichtbar.
- Jede sichtbare Gebäude-, Quellen-, Ziel- und Routenkarte kann unabhängig verschoben werden. Positionen werden im Plan gespeichert, exportiert und beim erneuten Öffnen wiederhergestellt; `AUTO` setzt auf das deterministische Layout zurück.
- Gebäude-Eingangsketten lassen sich weiterhin direkt an der Gebäudekarte einklappen. Suche, Fokuspfad, Minimap und Pfeiltastennavigation berücksichtigen die gebäudezentrierte Darstellung.
- Das Mausrad wird im Diagramm über einen nicht-passiven nativen Listener exklusiv abgefangen: Es zoomt am Mauszeiger, ohne gleichzeitig die Dokumentseite zu scrollen; `overscroll-behavior` verhindert Scroll-Chaining zusätzlich.
- Ausgangskarten sind vollständig aus Darstellung, Suche, sichtbarer Kartenzahl und Minimap entfernt. Interne Routenknoten bleiben ausschließlich als stabile Graphendpunkte erhalten; sichtbar sind am erzeugenden Gebäude nur kompakte semantische SVG-Terminals für Lager, Weiterverarbeitung, Emission/Fackel/Abwasser und sonstige Enden.
- Eingebettete Haupt- und Nebenprodukte behalten interne Junction-Knoten nur für exakte Kantenführung; ihre Koordinaten folgen der Gebäudekarte, sodass Verbindungspfeile beim Verschieben und bei Rezeptänderungen aktuell bleiben.
- Das automatische Layout folgt jetzt echten Produktionsstufen von Rohstoffquellen links bis zu den Zielen rechts. Stufen werden ohne leere Anfangsspalten normalisiert, Zweige nach Zielzugehörigkeit gruppiert und jede Spalte anhand der tatsächlichen Kartenhöhen mit festen Sicherheitsabständen gepackt; ein Regressionstest schließt Kartenüberlappungen aus.
- Drei deterministische Barycenter-Doppeldurchläufe ordnen die Karten innerhalb benachbarter Produktionsstufen anhand ihrer verbundenen Nachbarn neu und reduzieren dadurch Leitungskreuzungen, ohne die Zielgruppierung oder reproduzierbare Anordnung aufzugeben.
- Verbindungen werden nun orthogonal über horizontale und vertikale Kanäle geführt. Vorwärtsflüsse nutzen den Zwischenraum zwischen Produktionsstufen; Rück- und Recyclingkanten erhalten gestrichelte Rückführungsspuren oberhalb der Karten statt durch Gebäudeinhalte zu laufen.
- Große Pläne öffnen in einer lesbaren Arbeitsansicht statt in einer unlesbar kleinen Gesamtansicht. Die separate Einpassen-Funktion liefert weiterhin die vollständige Übersicht, während Minimap, Zoom und Verschieben für die Detailarbeit erhalten bleiben.
- Gebäudekarten sind auf 560 Pixel verbreitert und besitzen klar getrennte, gleichmäßige Eingangs-, Maschinen-/Rezept- und Ausgangsbereiche. Mehrzeilige Materialnamen, größere Icons, stabile 38-Pixel-Portzeilen und exakte Anschlussanker verbessern Lesbarkeit und Verbindungssicherheit.
- Semantische Ausgangs- und Entsorgungsterminals sind nun direkt verschiebbar; ihre Positionen werden wie Gebäudepositionen im Plan gespeichert. Die Symbole bleiben kompakte Endpunkte und werden nicht wieder zu Ausgangskarten.
- Ein Klick auf ein Ausgangsterminal öffnet eine kompakte Detailfläche mit Produkt, Rate und den aktuell fachlich verfügbaren Verwendungen. Die Verwendung kann dort direkt geändert werden; unvermeidbare Emissionen bleiben gesperrt.
- Gespeicherte Diagrammpositionen werden gegen die aktuelle Topologie abgeglichen: entfernte Knoten werden bereinigt, neue Karten kollisionsfrei um vorhandene manuelle Positionen eingeordnet und eingebettete Produktanker immer aus der aktuellen Gebäudeposition regeneriert.
- Gebäudekarten besitzen getrennte Aktionen für reine Kompaktdarstellung und das Ausblenden der gesamten Eingangskette. Kompaktansicht, Zweigzustand und manuelle Position bleiben voneinander unabhängig.
- Umschalt-/Strg-/Cmd-Klick ermöglicht Mehrfachauswahl von Diagrammkarten; das Ziehen einer ausgewählten Karte verschiebt die gesamte Auswahl gemeinsam.
- Eine Änderung der Ausgangsaktion berechnet das Plan- und Diagrammmodell neu. Ein Regressionstest weist für Kohlendioxid den Wechsel des semantischen Endpunkts von automatischer Lagerung zur expliziten Fackel nach.
- Unkonfigurierte Nettoausgänge erhalten konservative sinnvolle Standardaktionen: zuerst interne Wiederverwendung, wenn dadurch ein vorhandener externer Bedarf desselben Produkts ersetzt wird, dann Lagerung, soweit möglich, sonst Entsorgung. Beliebige Folgerezepte werden nicht automatisch gestartet, weil sie zusätzliche Ketten, Inputs und Nebenprodukte erzeugen können.
- Förderbare Minenprodukte bleiben korrekt als externe Anforderungen sichtbar, erzeugen wegen unbekannter Förderkapazität aber keine Warnung mehr.
- Die Nettoausgangs-UI erklärt jetzt direkt den Unterschied: interne Wiederverwendung deckt vorhandenen Bedarf, Weiterverarbeitung startet das ausgewählte Folgerezept samt Gebäude, Zusatzinputs und Folgeprodukten.
- Die drei rechten Bereiche Gebäude, externe Eingänge und Netto-Ausgänge besitzen jetzt einen echten geschlossenen Zustand. Ein geöffneter Bereich kann geschlossen werden, ohne dass zwangsweise ein anderer Bereich aufspringt; `aria-expanded` bildet den Zustand zugänglich ab.
- Eine auf 100 Schritte begrenzte Planhistorie unterstützt Rückgängig/Wiederholen über sichtbare Schaltflächen sowie Strg/Cmd+Z, Strg/Cmd+Umschalt+Z und Strg/Cmd+Y. Eingabefelder behalten ihre nativen Bearbeitungs-Shortcuts.
- Weitere fest codierte Planner-Begriffe und Optimierungsziele reagieren jetzt konsistent auf den Sprachwechsel. Eine vollständige offizielle Übersetzung aller 1.587 Rezept- und 179 Maschinennamen bleibt mangels öffentlichem offiziellen Lokalisierungsexport ausdrücklich unbehauptet.

## Abgeschlossen: Vereinfachter Ziel-zuerst-Workflow

- Die Zielerfassung bleibt dauerhaft sichtbar; Rezeptfilter, Nebenproduktoptionen und Optimierung liegen standardmäßig geschlossen unter „Erweiterte Einstellungen“.
- Der frühere permanente rechte Ergebnisblock wurde entfernt. Diagramm, Materialien, Gebäude, Bilanz und Ein-/Ausgangskonfiguration sind nun getrennte Ergebnisansichten, sodass nur die aktuell benötigte Darstellung gerendert wird.
- Materialien werden in benötigte Rohstoffe und Netto-Ausgänge gegliedert; Gebäude erhalten eine sortierte Maschinenliste; die Bilanz bündelt Maschinen, Strom, Arbeiter, Computing, Wartung, Solverresiduum und fachliche Hinweise.
- Produktionsgebäude starten als kompakte 330×76-Karten. Die vollständige Drei-Spalten-Ansicht mit Ein- und Ausgängen wird gezielt pro Karte aufgeklappt.
- Externe Quellen starten ebenfalls kompakt; ihre Detailansicht ist unabhängig vom Ausblenden einer Eingangskette.
- Verbindungsmengen sind im Normalzustand ausgeblendet und erscheinen für den fokussierten Pfad. Unter Zoomstufe 0,3 werden Karten als reduzierte Icon-/Name-/Raten-Zusammenfassung gerendert.
- Semantische Endpunkte wurden auf zugängliche Zielgrößen vergrößert und nachträglich kollisionsfrei gepackt; ihre direkte Konfiguration und Verschiebbarkeit bleiben erhalten.
- Für schmalere Desktopfenster werden die linke Zielspalte reduziert, Ergebnistabs horizontal scrollbar und zweispaltige Ergebnislisten einspaltig. Eine eigenständige Mobile-Neugestaltung war ausdrücklich nicht Bestandteil dieser Maßnahme.
- Playwright deckt progressive Einstellungen, alle Ergebnisansichten, Kartenaufklappen, kontextuelle Kantenbeschriftungen, Low-Zoom-Vereinfachung sowie die weiterhin vorhandenen Interaktionen ab.

## Abgeschlossen: Performanceoptimierung nach dem Progressive-Disclosure-Redesign

- Das Diagramm rendert nur noch Karten und semantische Endpunkte im sichtbaren Weltbereich einschließlich eines großzügigen Overscan-Rands. Suche, Navigation, vollständiges Modell und Minimap bleiben davon unabhängig vollständig.
- SVG-Verbindungen werden ebenfalls viewportbezogen reduziert. Mengenbeschriftungen werden nicht mehr unsichtbar im DOM vorgehalten, sondern ausschließlich für den aktuell fokussierten Pfad erzeugt.
- Pan-, Zoom- und Kartenbewegungen werden über `requestAnimationFrame` auf höchstens eine React-Aktualisierung pro Browserframe begrenzt. Dauerhafte Planpositionen und Undo/Redo-Historie werden weiterhin erst am Ende des Ziehvorgangs geschrieben.
- Gebäude- und Endpunktkomponenten sind memoisiert. `applyDiagramPositions` behält unveränderte Knotenreferenzen bei, damit nicht betroffene Karten beim Verschieben nicht erneut rendern.
- Die orthogonale Routengeometrie besitzt einen koordinatenabhängigen `WeakMap`-Cache. Beim Verschieben werden nur Verbindungen mit tatsächlich geänderten Endpunkten neu berechnet.
- Diagrammstruktur und manuelle Positionen sind getrennte Cacheebenen. Reine Positionsänderungen bauen weder Produktionslösung noch automatische Topologie und Packung erneut auf.
- Der Diagrammaufbau verwendet vorberechnete Ein- und Ausgangsindizes statt wiederholter vollständiger Kanten-Scans. Große Diagramme ab 80 Graphknoten werden in einem eigenen Web Worker angeordnet; kleine Diagramme bleiben ohne Worker-Startkosten synchron.
- Aktivierte Rezeptoptimierung läuft in einem langlebigen, nur bei Bedarf geladenen Web Worker. Währenddessen bleibt eine schnell berechnete fachlich gültige Basislösung bedienbar; veraltete Workerantworten werden verworfen und der Abschluss wird atomar übernommen.
- Materialien, Gebäude, Bilanz, I/O-Konfiguration und das Produktionsdiagramm sind eigene dynamische Chunks. Der initiale Hauptchunk sank gegenüber dem Stand vor der Maßnahme von rund 339 kB auf rund 300 kB minifiziert; die großen Spieldaten bleiben wegen des synchron benötigten vollständigen Rezeptgraphen separat.
- Zahlenformatierer werden nach Nachkommastellenzahl wiederverwendet, Suchtexte einmal je Modell und Sprache normalisiert und Planpersistenz bei schnellen Eingabefolgen um 100 ms entprellt.
- Worker-Laufzeiten werden über die User-Timing-API als `coi-optimization-worker-*` und `coi-diagram-worker-*` messbar. Zusätzlich prüft Vitest nun auch ein p95-Budget von 50 ms für den Diagrammmodellaufbau.
- Browserregressionen kontrollieren Viewport-Culling, bedarfsgeladene Ergebnisansichten und den tatsächlichen Start des Optimierungs-Workers.

## Aktueller Quality-Gate-Status

`npm run check` ist nach den jüngsten Extraktionen und Datenänderungen vollständig grün:

- Prettier: bestanden
- ESLint: bestanden
- TypeScript: bestanden
- Vitest: 56/56 in 14 Testdateien bestanden
- Playwright: 26/26 funktionale und automatisierte Accessibility-Prüfungen bestanden
- Progression: 631 Rezepte, T0–T5 bestanden
- Capabilities und Datenmanifest: aktuell und validiert
- Produktionsbuild: bestanden

Bekannter Hinweis: Der große gemeinsame Spieldatenchunk liegt weiterhin bei ca. 1,430 MB minifiziert / 124 kB gzip. Der Einstiegschunk liegt nun bei ca. 300 kB / 91 kB gzip. Die Optimierungs-Worker-Datei enthält den vollständigen Solver samt Daten nochmals, wird jedoch ausschließlich beim Aktivieren der Optimierung geladen und außerhalb des UI-Threads ausgeführt.

## Als Nächstes

Der technische Stand ist als Release Candidate prüfbar. Der nächste Meilenstein
ist ein öffentlicher Preview nach direkt exportiertem und validiertem v0.8.7b-
Datensatz. Die Fanprojekt-/Assetfreigabe wird gemäß Projektvorgabe vorausgesetzt.
Für Version 1.0 folgen zusätzlich der manuelle WCAG-2.2-AA-Audit, die
abschließende Produktnamensstrategie und der Produktionshosting-Test.

Der verbindliche aktuelle Überblick steht in [`PROJECT-STATUS.md`](PROJECT-STATUS.md).
