# Funktionsaudit: Was ist noch nicht oder nur teilweise aktiv?

Stand: 11.09.2026

> **Einordnung:** Die Abschnitte weiter unten enthalten historische Befunde aus
> früheren Entwicklungsständen. Für den aktuellen Status ist zuerst die
> Übersicht in diesem Abschnitt maßgeblich. Erledigte Punkte bleiben als
> Nachweis der Entwicklungshistorie erhalten.

## Aktueller Status

### Funktioniert und ist automatisiert geprüft

- Zielerfassung, Zielraten und Mehrzielplanung
- automatische Kettenauflösung und Nebenproduktsteuerung
- Rezeptfilter, Forschungsstufen T0-T5 und Rezeptwahl
- exakte lineare beziehungsweise begrenzte Solvermethoden mit Residuum
- strukturierte Solver- und Daten-Diagnosen
- interne Wiederverwendung, Caps und Restmengen
- externe Quellen und Ausgangsrouten mit Capability-Prüfung
- getrennte Zielansichten mit deterministischer Zielzerlegung
- Diagramm mit Layout, Pan, Zoom, Suche, Pfadfokus, Minimap und Tastaturnavigation
- gespeicherte Diagrammpositionen, Einklappen und Mehrfachauswahl
- Import, Export, Planformat v4, Legacy-Migration und teilbare Links
- Rückgängig/Wiederholen, lokale Speicherung und sichere Storage-Helfer
- deutsche und englische UI für die zentralen Planner-Flows
- Desktop-/Mobile-E2E und automatisierter Axe-Audit für geprüfte Zustände

### Verbleibende technische Einschränkungen

- komplexe Sonderkreisläufe können weiterhin den iterativen Fallback verwenden
- Lagerfüllzeit, Exportvertrag und Reise-/Transportkapazitäten sind nicht für
	alle Datensätze vollständig modelliert
- die Optimierung ist nur bei vollständig enumerierbarem Alternativenraum exakt;
	größere Suchräume bleiben deterministische Heuristiken
- die vollständige offizielle deutsche Benennung aller Spielobjekte ist nicht
	aus einer öffentlichen Quelle verfügbar
- die fachliche Veröffentlichung benötigt weiterhin einen direkt validierten
	aktuellen Spieldatenexport

### Nächste Prüfungen

1. Aktuelles Funktionsaudit gegen die nächsten v0.8.7b-Datenartefakte ausführen.
2. Golden-Szenarien für Kreisläufe, Zielzerlegung und Ausgangsrouten erweitern.
3. Manuelle Accessibility-Prüfung mit Screenreader, Zoom und Reflow ergänzen.
4. Ungültige gespeicherte Routen und nicht konvergierte Berechnungen mit
	 geführten Reparaturaktionen prüfen.

## Zusammenfassung

Der Produktionsplaner baut erfolgreich und die Kernfunktionen sind bedienbar. Mehrere sichtbare Bedienelemente sind jedoch noch ohne Funktion, und einige bereits eingebundene Funktionen wirken nur teilweise oder nur auf die Darstellung. Besonders relevant sind der vollständige Flussgraph, die Ausgangsrouten und die globale Optimierung.

### Statusübersicht

| Status | Anzahl geprüfter Bereiche |
|---|---:|
| Sichtbar, aber ohne Funktion | 6 |
| Teilweise aktiv | 12 |
| Aktiv, aber technisch eingeschränkt | 8 |
| Voll aktiv | Kernfunktionen für Ziele, Raten, Filter, Speicherung und Grundberechnung |

---

# A. Sichtbar, aber derzeit ohne Funktion

## A1. „Kette automatisch auflösen“

**Status:** nicht aktiv

Die Checkbox verwendet nur `defaultChecked`. Sie schreibt keinen Wert in `PlanState` und wird im Berechnungsmodul nicht ausgewertet.

**Derzeitiges Verhalten:** Die Kette wird unabhängig von der Checkbox immer automatisch aufgelöst.

**Erforderliche Korrektur:**

```ts
autoExpandChain: boolean
```

Bei deaktivierter Option müssten nicht explizit verbundene Vorprodukte zu externen Eingängen werden.

---

## A2. „Nebenprodukte berücksichtigen“

**Status:** nicht aktiv

Auch diese Checkbox besitzt weder Zustand noch Event-Handler.

**Derzeitiges Verhalten:** Nebenprodukte werden immer berechnet.

**Erforderliche Korrektur:**

```ts
includeByproducts: boolean
```

Die Einstellung muss Berechnung, Netto-Ausgänge und interne Wiederverwendung steuern.

---

## A3. „Einpassen“ im Produktionsfluss

**Status:** nicht aktiv

Der Button besitzt keinen `onClick`-Handler.

**Fehlend:**

- Zoom auf alle Knoten
- Rücksetzen der Verschiebung
- Berechnung des sichtbaren Graph-Rechtecks

---

## A4. Hilfe-Schaltfläche

**Status:** nicht aktiv

Das Fragezeichen in der Kopfzeile besitzt keinen Handler und öffnet keine Hilfe.

---

## A5. Mobiles Menü

**Status:** nicht aktiv

Der Menübutton wird auf kleinen Bildschirmen angezeigt, öffnet aber kein Navigationsmenü.

---

## A6. `expanded` im Planstatus

**Status:** Datenfeld ohne aktive Nutzung

`expanded` wird gespeichert, aber weder gelesen noch verändert. Es gibt derzeit kein funktionierendes Ein-/Ausklappen von Graphknoten.

---

# B. Teilweise aktive Ausgangs- und Nettofunktionen

## B1. Interne Wiederverwendung ohne Verbraucherauswahl

**Status:** teilweise aktiv

Interne Wiederverwendung reduziert Produktionsbedarf iterativ. Die im Datenmodell vorgesehenen Felder werden aber nicht benutzt:

- `consumerProductId`
- `consumerRecipeId`
- `targetProductId`

**Folge:** Die Verteilung erfolgt automatisch und kann nicht auf einen konkreten Verbraucher begrenzt werden.

---

## B2. Mengenbegrenzung bei interner Wiederverwendung

**Status:** nicht wirksam

`amountMode` und `maxRate` funktionieren bei Lagerung, Export und Routen. Die interne Wiederverwendung verwendet dagegen immer den gesamten verfügbaren Nebenproduktpool.

---

## B3. Routenklassifikation basiert teilweise auf Namen

**Status:** technisch aktiv, aber nicht belastbar

Die Erkennung von Dump, Flare, Wastewater und Export sucht derzeit Begriffe wie:

- `dump`
- `disposal`
- `flare`
- `smoke stack`
- `wastewater`
- `cargo`

Das im Plan vorgesehene, datenbasierte Capability-Modell ist noch nicht umgesetzt.

**Risiko:** Falsch benannte, lokalisierte oder neue Maschinen können falsch klassifiziert werden.

---

## B4. Lagerkapazität

**Status:** Route auswählbar, Kapazität nicht berechnet

Ein kompatibler Lagertyp kann ausgewählt werden. Die Anzahl der Lager, deren Kapazität und die Zeit bis zur Füllung werden jedoch nicht berechnet.

---

## B5. Exportkapazität

**Status:** Route auswählbar, Durchsatz nicht berechnet

Cargo-/Exportanlagen erscheinen als Ziel. Frachterkapazität, Vertragsrate, Reisezeit und benötigte Module werden nicht bilanziert.

---

## B6. Weiterverarbeitungsroute nicht als eigener sichtbarer Rezeptknoten

**Status:** Berechnung teilweise aktiv, Darstellung unvollständig

Eine gewählte Weiterverarbeitung fügt Maschinen, zusätzliche Eingänge und neue Outputs hinzu. Im Diagramm erscheint sie aber primär als beschrifteter Sink-Knoten. Ein eigener Recipe-Node mit allen Ein- und Ausgangskanten fehlt.

---

## B7. Sekundäre Ausgangskanten werden nicht vollständig gerendert

Das Berechnungsmodell erzeugt Kanten von einer Ausgangsroute zu deren Folgeprodukten. Die Oberfläche rendert aber nur ausgehende Kanten normaler Produktknoten. Kanten eines virtuellen Route-/Sink-Knotens bleiben unsichtbar.

---

## B8. Zugewiesene Menge bleibt in `net` positiv

**Status:** Darstellung und Materialbilanz verwenden unterschiedliche Begriffe

Eine gelagerte oder entsorgte Menge bleibt als positiver Netto-Ausgang vorhanden. Zusätzlich existiert ein `outputRoutes`-Eintrag.

Das ist für „erzeugter Überschuss“ verständlich, aber nicht für „offener Überschuss“. Es fehlen getrennte Kennzahlen:

```ts
grossSurplus
assignedSurplus
openSurplus
```

---

## B9. Feste Iterationsgrenzen ohne sichtbare Warnung

- interne Wiederverwendung: maximal 6 Iterationen
- Ausgangsrouten: maximal 8 Durchläufe
- Produktionsjobs: maximal 20.000

Wird keine Konvergenz erreicht, sieht der Nutzer derzeit keine Warnung.

---

## B10. Kein echter SCC-/Gleichungslöser

Wasser-, Dampf-, Nuklear- und Recyclingkreise werden iterativ angenähert. Der geplante Solver für stark zusammenhängende Komponenten bzw. lineare Materialbilanzen ist noch nicht implementiert.

**Risiko:** Oszillation, Rundungsreste oder falsche Ergebnisse bei komplexen Kreisläufen.

---

## B11. Ungültige gespeicherte Route

Die Berechnung erkennt eine nicht mehr mögliche Verwendung und fällt auf „Nicht festgelegt“ zurück. Ein eigener Konfliktdialog mit Alternativauswahl oder Filterausnahme existiert für Ausgangsrouten noch nicht.

---

## B12. `note` im Ausgangsmodell

**Status:** definiert, aber nicht verwendet

Freie Hinweise zu einer Verwendung können weder eingegeben noch angezeigt werden.

---

# C. Produktionsfluss: nur teilweise vollständig

## C1. Kein echter visueller Kantenplan

Die Karten listen ihre ausgehenden Materialflüsse als Textzeilen. Es werden jedoch keine geometrischen Verbindungslinien zwischen den zugehörigen Knoten gezeichnet.

**Folge:** „Was geht wohin?“ ist textlich sichtbar, aber nicht als vollständiges Flussdiagramm.

---

## C2. Product- und Recipe-Node sind noch kombiniert

Ein Produktknoten enthält direkt Maschine und Rezept. Das geplante Modell mit getrennten Knoten ist noch nicht umgesetzt:

- ProductNode
- RecipeNode
- SourceNode
- GoalNode
- SinkNode

Dadurch sind Mehrfachausgänge und Weiterverarbeitungsrouten schwer eindeutig darzustellen.

---

## C3. Getrennter Modus berechnet jedes Ziel unabhängig

**Status:** vollständig tief, aber nicht global allokiert

Jede Zielansicht wird separat neu berechnet. Bei begrenzten oder gemeinsam genutzten Nebenprodukten kann dadurch dieselbe globale Menge in mehreren getrennten Ansichten vollständig verwendet werden.

**Beispiel:** Ein global auf 10/min begrenzter Ausgang kann in zwei Einzelketten jeweils bis zu 10/min erscheinen.

Für eine exakte Darstellung müssten die Einzelansichten Anteile aus dem bereits gelösten Gesamtplan verwenden.

---

## C4. Maschinenzahl am Produktknoten kann bei Wiederverwendung abweichen

`graphNodes.rate` basiert auf dem Bruttobedarf. Die Maschinenliste basiert auf der nach Wiederverwendung reduzierten tatsächlichen Aktivität.

Die Maschinenzahl auf einer Graphkarte kann deshalb von der Zusammenfassung abweichen.

---

## C5. Zielknoten sind Endkarten, aber nicht geometrisch verbunden

Ziele erscheinen rechts als Sink-Karten. Die eigentliche Verbindung wird nur in der Textliste des Produktknotens gezeigt.

---

## C6. Kein Ein-/Ausklappen

Die vollständige DAG-Ansicht ist berechnet, bietet aber keine aktive Knotenexpansion, obwohl `expanded` im Zustand vorhanden ist.

---

## C7. Kein Pan, Zoom oder Minimap

Diese im Plan vorgesehenen Funktionen fehlen noch vollständig.

---

## C8. Keine Graphvirtualisierung / kein Worker

Berechnung und Darstellung laufen im UI-Thread. Für sehr große Endgame-Pläne sind noch nicht aktiv:

- Berechnungs-Web-Worker
- Layout-Web-Worker
- virtuelle Knoten
- Detailkarten nach Zoomstufe
- inkrementelles Graphlayout

---

# D. Optimierung: teilweise aktiv

## D1. Optimierung ist lokal statt global

Die Auswahl bewertet ein Rezept anhand seiner unmittelbaren Maschine. Die gesamte vorgelagerte Kette wird nicht als Optimierungsproblem verglichen.

**Beispiel:** Ein Rezept mit wenig direktem Strombedarf kann eine sehr stromintensive Vorproduktkette besitzen und trotzdem gewinnen.

---

## D2. Ressourcenlimits optimieren nicht

Ressourcenlimits erzeugen Warnungen, ändern aber nicht die Rezeptwahl. Sie sind daher aktuell Prüfgrenzen, keine Optimierungsconstraints.

---

## D3. Maximale Maschinenzahl

`maxMachines` wird nach der Berechnung geprüft, aber nicht bei der Auswahl von Rezeptkombinationen berücksichtigt.

---

## D4. Globale und maschinenbezogene Grenzwerte sind vermischt

Ein Teil der Grenzwerte wird bei einzelnen Rezeptmaschinen geprüft. Anschließend werden dieselben Werte teilweise gegen Gesamtsummen geprüft. Die UI bezeichnet sie als „pro Maschine“, die Warnungen sind teilweise global.

---

## D5. Alternativen können identisch sein

Manuell gewählte Rezepte haben Vorrang. Dadurch können alle sechs angezeigten Optimierungsalternativen denselben Plan liefern.

Es fehlt eine Kennzeichnung „identisch mit Alternative X“.

---

## D6. `maximizeProduction`

Die Bewertung verwendet den größten Output eines Rezepts, nicht zwingend den Output des aktuell angefragten Produkts. Bei Mehrfachausgangsrezepten kann die Bewertung falsch sein.

---

## D7. Wartung und Computing in der Gesamtausgabe

Sie beeinflussen Optimierungsbewertungen teilweise, werden aber nicht als vollständige KPIs in der normalen Zusammenfassung angezeigt.

---

# E. Rezeptfilter und Progression

## E1. Rezeptbibliothek ignoriert den aktiven Planfilter

Der globale Rezeptfilter wirkt auf die Produktionsberechnung und den Recipe-Picker. Die separate Rezeptbibliothek zeigt trotzdem ungefiltert alle Rezepte.

---

## E2. Rezeptbibliothek ist begrenzt

- maximal 150 Produkte sichtbar
- maximal 3 Rezepte je Produkt sichtbar
- keine Pagination oder „mehr anzeigen“

Weitere Datensätze sind vorhanden, aber nicht nutzbar dargestellt.

---

## E3. Produktpicker ist auf 120 Treffer begrenzt

Ohne Suche sind nicht alle Produkte erreichbar. Eine gezielte Suche findet sie meistens, aber eine vollständige browsbare Liste fehlt.

---

## E4. `profileName`

Der Profilname wird gespeichert, aber im normalen Planer nicht angezeigt.

---

## E5. Progressionsquelle

Die Progression ist vollständig zugeordnet und validiert. Der Research-Snapshot stammt jedoch aus der verfügbaren Update-3-Referenz und wird auf den Update-4-Produktionsdatensatz gemappt. Ein direkter v0.8.7b-Research-Export ist noch nicht vorhanden.

---

# F. Externe Eingänge

## F1. Herkunftsauswahl beeinflusst die Berechnung nicht

Mine, Frachter, Handel, Lager und manuelle Zuführung werden gespeichert und im Graph angezeigt. Sie verändern aber weder:

- Fördermaschinen,
- Fahrzeuge,
- Frachter,
- Handelskosten,
- Lagerabnahme,
- Unity-Kosten,
- Kapazitätsgrenzen.

Die Auswahl ist damit derzeit eine Klassifikation, keine operative Berechnung.

---

## F2. Herkunftsoptionen sind nicht produktspezifisch

Jeder externe Eingang erhält dieselben fünf Optionen. Es wird nicht geprüft, ob das Produkt tatsächlich:

- abgebaut,
- gehandelt,
- per Frachter importiert,
- oder sinnvoll gelagert werden kann.

---

# G. Speicherung, Import und Teilen

## G1. Importbericht fehlt

Veraltete oder unbekannte IDs werden teilweise tolerant verarbeitet. Ein sichtbarer Bericht über ignorierte Rezepte, ungültige Routen oder migrierte Felder fehlt.

---

## G2. URL-Zustand ist unkomprimiert

Der gesamte Plan wird Base64-kodiert in den Hash geschrieben. Große Pläne mit vielen Filter- und Routeneinstellungen können die praktische URL-Länge überschreiten.

---

## G3. Keine Schema-Validierung

Importiertes JSON wird geparst, aber nicht mit einem Schema validiert. Formell gültiges, strukturell falsches JSON kann zu Laufzeitproblemen führen.

---

# H. Sprache und Bedienung

## H1. Übersetzung ist unvollständig

Viele neue Funktionen sind fest auf Deutsch geschrieben, obwohl die Oberfläche zwischen Deutsch und Englisch umschaltbar ist.

Betroffen sind unter anderem:

- Rezeptfilter
- Optimierung
- Tech-Stufen
- Ausgangsverwendungen
- Konflikt- und Warntexte

## H2. Produktübersetzungen sind nur teilweise vorhanden

Nur ein kleiner Teil der Produkte besitzt deutsche Namen. Der Rest fällt auf den englischen Spielnamen zurück.

## H3. Barrierefreiheit

Es fehlen teilweise:

- `aria-label` für reine Iconbuttons
- Fokusmanagement in Modalen
- ESC zum Schließen
- Fokusfalle
- Tastaturnavigation im Graphen

---

# I. Nicht mehr verwendeter Code

## I1. Alte `Tree`-Komponente

Die rekursive `Tree`-Komponente ist noch vorhanden, wird im aktuellen Planner aber nicht mehr gerendert. Sie ist toter UI-Code.

## I2. `sinkOptions`

Die alte statische Liste der Ausgangsverwendungen ist noch definiert, obwohl jetzt `availableDispositions()` verwendet wird.

## I3. Legacy `outputSinks`

Das Feld wird noch für Migration und Rückwärtskompatibilität gelesen. Neue Änderungen schreiben ausschließlich `outputDispositions`. Es sollte nach einer definierten Migrationsfrist aus dem Laufzeitmodell entfernt werden.

---

# Umsetzungsstand der Prioritäten

## Priorität 1 – fachliche Korrektheit (umgesetzt am 09.09.2026)

- Materialbilanzen werden mit einem gedämpften, residualgeprüften Fixpunktlöser bis zu 80 Iterationen stabilisiert; Nichtkonvergenz und Routenlimits werden sichtbar gemeldet.
- Interne Wiederverwendung unterstützt Mengenbegrenzung und die Auswahl eines konkreten Verbraucherprodukts samt Rezeptbindung.
- `grossSurplus`, `assignedSurplus` und `openSurplus` sind getrennte Berechnungsergebnisse und werden in der Ausgangsübersicht gemeinsam angezeigt.
- Getrennte Zielansichten werden nicht mehr unabhängig neu berechnet, sondern als Teilgraphen aus dem global gelösten Gesamtplan abgeleitet.
- Graph-Maschinenzahlen und Produktraten stammen aus der tatsächlichen Aktivität nach Wiederverwendung.
- Ausgangs-Capabilities verwenden normalisierte Maschinen-IDs, Kategorien und Storage-Metadaten; lokalisierte Namen werden nicht mehr ausgewertet.

## Priorität 2 – vollständiger Produktionsfluss (umgesetzt am 09.09.2026)

- Produkte und Rezepte werden als getrennte, geometrisch positionierte Knoten dargestellt.
- Eingangs-, Produktions-, Nebenprodukt-, Wiederverwendungs-, Ziel- und Ausgangskanten werden als SVG-Bézierverbindungen mit Rate und Pfeilrichtung gezeichnet.
- Verarbeitungs-/Entsorgungsrouten sind eigene Knoten; zusätzliche Routeneingänge und Folgeoutputs werden verbunden.
- Das Diagramm unterstützt Ziehen, Mausrad-Zoom, Zoomtasten, Einpassen und eine Minimap mit aktuellem Viewport.
- Produktknoten können eingeklappt werden; vorgelagerte Teilgraphen werden dabei ausgeblendet und `PlanState.expanded` wird persistent verwendet.
- Dieselbe Diagrammkomponente arbeitet in zusammengeführter und getrennter Ansicht.

## Priorität 3 – sichtbare Bedienelemente (umgesetzt am 09.09.2026)

- `autoExpandChain` ist persistenter Planstatus; deaktiviert werden Vorprodukte als externe Eingänge behandelt.
- `includeByproducts` ist persistenter Planstatus und steuert Nebenproduktmengen, -kanten und Folgeoutputs.
- Der Einpassen-Button steuert das aktive Diagramm und berechnet Zoom sowie Versatz aus dessen Abmessungen.
- Die Hilfe-Schaltfläche öffnet eine zweisprachige Kurzanleitung mit Bedien- und Farberklärung.
- Der mobile Menübutton öffnet und schließt eine responsive Navigation.
- Alle vorherigen `defaultChecked`-Attrappen wurden durch kontrollierte Zustände ersetzt.

## Priorität 4 – globale Optimierung (umgesetzt am 09.09.2026)

- Rezeptkandidaten werden anhand wiederholt berechneter vollständiger Produktionsketten statt nur anhand der unmittelbaren Maschine bewertet.
- Die Suche arbeitet als begrenzte, schnelle Koordinatensuche über die mengenmäßig wichtigsten alternativen Rezeptknoten; manuelle Rezeptwahlen bleiben verbindlich.
- Arbeiter-, Strom-, Maschinen-, Computing-, Wartungs- und produktspezifische Ressourcenlimits werden als globale Constraints in der Kandidatenrangfolge verwendet.
- Zulässige Lösungen werden gegenüber verletzenden Lösungen bevorzugt; nur wenn kein geprüfter Kandidat alle Limits erfüllt, wird die kleinste normalisierte Verletzung gewählt und weiterhin sichtbar gemeldet.
- `maximizeProduction` bewertet die unter den globalen Limits mögliche Skalierung der konkreten Zielraten, nicht mehr den größten beliebigen Rezeptoutput.
- Computing und Wartung sind vollständige Ergebnis-KPIs und werden in der Zusammenfassung angezeigt.
- Identische Optimierungsalternativen werden anhand ihrer Rezept-/Maschinenlösung erkannt und gekennzeichnet.
- Die UI bezeichnet Limits nicht mehr widersprüchlich als Werte „pro Maschine“.

## Priorität 5 – Daten und UX (Kernumfang umgesetzt am 09.09.2026)

- Externe Herkunftsoptionen werden produktspezifisch aus Förder-, Import- und Lagermetadaten angeboten.
- Gewählte Herkünfte erzeugen operative Planungswerte: geschätzte Förderlinien, Fahrzeuge/Frachter, Unity/min sowie einen 60-Minuten-Lagerpuffer. Fehlende Herkünfte erzeugen eine Planwarnung.
- Die Rezeptbibliothek übernimmt den aktiven Rezept-/Technologiefilter und besitzt keine festen Produkt- oder Rezeptlimits mehr; auch der Produktpicker ist nicht mehr auf 120 Treffer begrenzt.
- Der aktive Filterprofilname wird im Planer angezeigt.
- Importformat 4 prüft Ziele, Produkte, Rezepte und Ausgangsrouten, entfernt unbekannte IDs kontrolliert und zeigt einen Migrations-/Importbericht.
- Freigabelinks verwenden eine UTF-8-fähige LZW-Kompression mit URL-sicherem Base64; alte unkomprimierte Links bleiben lesbar. Ein Roundtrip mit Unicode und einem 11-kB-Testzustand wurde geprüft (komprimiert 1.384 Zeichen).
- Standardmodale unterstützen Fokusübernahme, Fokusfalle, ESC, Fokuswiederherstellung und Dialogsemantik. Graphknoten sind fokussierbar und per Enter/Leertaste ein-/ausklappbar; zentrale Iconbuttons erhielten zugängliche Beschriftungen.
- Neue Ausgangs-, Herkunfts-, Hilfe- und KPI-Texte wurden Deutsch/Englisch ergänzt. Englische Spielnamen bleiben bei Produkten ohne offizielle deutsche Datenübersetzung weiterhin der definierte Fallback.
- Tote `Tree`-UI und die obsolete statische `sinkOptions`-Liste wurden entfernt.

# Priorisierte Korrekturreihenfolge

## Priorität 1 – fachliche Korrektheit

1. Echten Materialbilanz-/SCC-Solver implementieren.
2. Interne Wiederverwendung mit Teilmenge und konkretem Verbraucher.
3. `grossSurplus`, `assignedSurplus` und `openSurplus` trennen.
4. Getrennte Ansicht aus dem gelösten Gesamtplan ableiten.
5. Graph-Maschinenzahlen aus tatsächlicher Aktivität berechnen.
6. Datenbasierten Capability-Index statt Namensprüfung verwenden.

## Priorität 2 – vollständiger Produktionsfluss

1. Product- und Recipe-Nodes trennen.
2. Alle Kanten geometrisch rendern.
3. Route-Nodes und deren Folgeoutputs sichtbar verbinden.
4. Pan, Zoom, Einpassen und Minimap aktivieren.
5. Ein-/Ausklappen an `expanded` anbinden.

## Priorität 3 – bisher sichtbare Attrappen aktivieren

1. Auto-Expand-Checkbox.
2. Nebenprodukt-Checkbox.
3. Einpassen-Button.
4. Hilfe.
5. mobiles Menü.

## Priorität 4 – Optimierung

1. Ganze Ketten statt einzelner Maschinen bewerten.
2. Ressourcenlimits als echte Constraints verwenden.
3. Globale Grenzwerte konsistent lösen.
4. identische Alternativen zusammenfassen.

## Priorität 5 – Daten und UX

1. Externe Herkunft produktspezifisch und berechnungswirksam machen.
2. Rezeptbibliothek an Planfilter anbinden und Limits entfernen.
3. vollständige Lokalisierung.
4. Import-Schema und Migrationsbericht.
5. URL-Kompression.
6. Accessibility.

---

# Empfohlener nächster Sprint

Ein sinnvoll abgegrenzter nächster Sprint sollte diese Punkte gemeinsam lösen:

1. `includeByproducts` und `autoExpandChain` aktivieren.
2. Materialbilanz in Brutto, zugewiesen und offen aufteilen.
3. konkrete Verbraucherwahl für interne Wiederverwendung.
4. getrennten Modus aus der globalen Lösung ableiten.
5. sichtbare Recipe-/Sink-Kanten rendern.
6. Einpassen-Button funktionsfähig machen.

Damit werden zuerst die fachlich wichtigsten Abweichungen behoben, bevor Komfortfunktionen wie Hilfe, Mobile-Menü und Minimap folgen.
