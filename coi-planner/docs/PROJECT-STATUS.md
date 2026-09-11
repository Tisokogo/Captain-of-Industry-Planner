# Projektstatus

Stand: 11.09.2026

## Produktentscheidung

Harbor Production Planner wird als clientseitige Web-App betrieben. Die Kernanwendung ist interaktiv und arbeitet ohne Backend mit lokaler Speicherung, Planimport/-export und teilbaren Links.

## Aktueller Reifegrad

**Technischer Release Candidate für private Nutzung.** Die automatisierten Quality Gates, die Kernberechnung, die Diagrammfunktionen und die kritischen Desktop-/Mobile-Flows sind implementiert und geprüft.

## Bereits abgesichert

- React-, TypeScript- und Vite-Build mit reproduzierbarem `npm ci`
- strikter TypeScript-Build, ESLint, Prettier und CI
- Zod-validierter Planimport mit Version 4 und Legacy-Migration
- Error Boundary und sichere lokale Speicherung
- exakte lineare Materialbilanz für unterstützte Modelle
- begrenzte, diagnostizierte Verfahren für constrained/fallback Fälle
- strukturierte Diagnosen für Job-, Routen-, Konvergenz- und Bilanzgrenzen
- deterministische Zielzerlegung und Diagrammsemantik
- Pan, Zoom, Suche, Pfadfokus, Minimap und Tastaturnavigation
- lokale Planhistorie, Speicherung, Import, Export und teilbare Links
- automatisierte Unit-, Integrations-, Szenario-, Performance- und E2E-Tests
- automatisierter Axe-Audit für die geprüften Zustände

## Verbleibende Gates

1. Einen direkt validierten Export der aktuellen Spielversion erzeugen.
2. Datenmanifest, Capabilities und Progression aus diesem Export neu generieren.
3. Golden-Szenarien und fachliche Anker gegen den neuen Datenstand prüfen.
4. Sonderfälle mit iterativem Solver-Fallback weiter reduzieren oder sichtbar erklären.
5. Manuelle Accessibility-Prüfung für Screenreader, Zoom, Reflow und komplexe Diagramme durchführen.
6. Statisches Produktionshosting inklusive Deep-Link-Refresh, Cacheverhalten und Reload von gespeicherten Plänen prüfen.

## Bewusste Produktgrenzen

- Die Optimierung ist für größere Suchräume heuristisch und behauptet keine globale Optimalität.
- Ohne aktuellen Spielexport wird der verifizierte Datenstand nicht umetikettiert.
- Lager-, Transport- und Exportkapazitäten werden nur dort bilanziert, wo die Datenquelle belastbare Capabilities liefert.
- Eine Website ist optional; das Kernprodukt bleibt die Web-App.

## Releasekriterien

Ein öffentlicher Preview-Release ist möglich, sobald Datenstand und technische Gates bestätigt sind. Version 1.0 setzt zusätzlich die manuelle Accessibility-Abnahme und einen dokumentierten Produktionshosting-Test voraus.
