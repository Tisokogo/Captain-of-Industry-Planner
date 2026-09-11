# Release-Readiness

Stand: 11.09.2026

## Entscheidung

**Technischer Release Candidate für private Nutzung: bereit. Öffentliche Preview: nach Datenprüfung möglich. Öffentliche Version 1.0: technisch noch nicht freigegeben.**

Die Anwendung erfüllt die technischen Kernanforderungen an Solver, Zielzerlegung, Performance, Import, CI und kritische Bedienpfade. Der Build kann gemäß Projektvorgabe als Fanprojekt betrieben werden. Der verbleibende fachliche Blocker ist der fehlende direkt validierte aktuelle Spieldatenexport:

1. direkter, validierter und lizenzkonformer Export der aktuellen Spielversion v0.8.7b;

Die Weitergabe von Assets und abgeleiteten Daten wird für dieses Fanprojekt als freigegeben vorausgesetzt und ist daher kein aktueller Umsetzungblocker.

## Automatisch geprüft

- [x] reproduzierbare Installation mit festgeschriebenen Paketversionen
- [x] Formatierung, ESLint und strikter TypeScript-Build
- [x] Unit-, Integrations-, Szenario-, Invarianten- und Performanceprüfungen
- [x] Desktop- und Mobile-E2E-Smoke mit Playwright/Chromium
- [x] automatisierter Axe-Audit für WCAG 2.0/2.1/2.2 A/AA ohne kritische oder schwerwiegende Befunde in den geprüften Zuständen
- [x] Daten-, Progressions-, Capability- und Manifestvalidatoren
- [x] Produktionsbuild und Lazy-Loading-Grenzen
- [x] exakte beziehungsweise explizit gekennzeichnete Solvermethoden
- [x] transparente heuristische Optimierung ohne falschen Optimalitätsanspruch
- [x] Tastaturbedienung des Diagramms und Fokusfalle/Fokusrückgabe für Dialoge
- [x] Reduced-Motion-Regeln und global sichtbarer Tastaturfokus

## Fachlich geprüft

- [x] gemeinsame Mehrzielbilanz
- [x] interne Wiederverwendung, Caps und Restmengen
- [x] stabile Ausgangsrouten-IDs
- [x] konservative Zielzerlegung mit Summeninvarianten
- [x] T0–T5-Progression für 631 produktionsrelevante Rezepte
- [x] 222 datengetriebene Produkt-Capabilities
- [x] keine erfundene Förderleistung für Nullmengenrezepte

## Vor öffentlichem Preview zwingend

- [ ] v0.8.7b direkt exportieren und gegen alle Validatoren laufen lassen
- [ ] Datenmanifest und Capability-Artefakte aus diesem Export neu erzeugen
- [ ] fachliche Golden-Anker gegen den aktuellen Spielstand stichprobenartig prüfen
- [x] Fanprojekt-/Assetfreigabe gemäß Projektvorgabe als gegeben dokumentieren

## Zusätzlich vor öffentlicher Version 1.0 zwingend

- [ ] vollständigen manuellen WCAG-2.2-AA-Test mit Screenreader und Kontrastmessgerät protokollieren; der Auftraggeber hat für den aktuellen privaten Stand ausschließlich die automatisierte Prüfung gewählt
- [ ] vollständige offizielle deutsche Produktnamensquelle lizenzieren oder den englischen Fallback beibehalten und sichtbar dokumentieren

## Freigabeverfahren

1. Aktuellen Export gemäß `DATA-SOURCE-STATUS.md` einspielen.
2. `npm ci && npm run check` ausführen.
3. `npx playwright install --with-deps chromium && npm run test:e2e` ausführen.
4. Manuellen Accessibility-Nachweis beifügen.
5. Erst danach Version, Changelog und sichtbaren Datenstand auf 1.0 beziehungsweise v0.8.7b setzen.
