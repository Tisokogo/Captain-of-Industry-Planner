# Accessibility-Audit

Stand: 09.09.2026  
Prüfart: automatisiert, Desktop und Mobile Chromium

## Umfang

Die Playwright-Suite verwendet `@axe-core/playwright` mit den Tags `wcag2a`, `wcag2aa`, `wcag21aa` und `wcag22aa`.

Automatisch geprüft werden:

- Hauptansicht des Produktionsplaners mit Defaultplan
- Rezeptfilterdialog mit repräsentativer Rezeptzeile
- Desktop-Chromium
- mobile Pixel-7-Emulation
- kritische und schwerwiegende Verstöße
- Farbkontrast, zugängliche Namen, Formularbeschriftungen, Dialogstruktur und Zielgrößen, soweit Axe diese automatisiert bestimmen kann

## Ergebnis

**0 kritische oder schwerwiegende Axe-Verstöße in den geprüften Zuständen.**

Während der Prüfung wurden folgende Befunde behoben:

- unzureichender Kontrast bei Ratenzusätzen, Filterstatus, Footer und Rezeptmetadaten
- unbeschriftete Profil- und Ressourcenauswahl
- unbenannter Button zum Hinzufügen eines Ressourcenlimits
- interaktives Checkbox-Element innerhalb eines Buttons
- zu kleine Statusziele in Rezeptzeilen

Zusätzlich bestehen bereits:

- sichtbare `:focus-visible`-Kennzeichnung
- `prefers-reduced-motion`-Regeln
- Fokusfalle und Fokusrückgabe für Dialoge
- Escape-Schließen
- räumliche Diagrammnavigation per Pfeiltasten

## Automatisierte Ausführung

```bash
npm run test:e2e
```

Die Accessibility-Prüfungen sind Bestandteil der Playwright-Suite und laufen in CI.

## Aussagegrenze

Ein automatisierter Axe-Lauf ist **kein vollständiger WCAG-2.2-AA-Nachweis**. Auf Wunsch des Auftraggebers wurde ausschließlich automatisiert geprüft. Folgende Punkte bleiben für eine öffentliche Freigabe manuell abzunehmen:

- NVDA/Firefox oder NVDA/Chrome unter Windows
- VoiceOver/Safari unter macOS beziehungsweise iOS
- sinnvolle Lesereihenfolge und verständliche Ansagen komplexer Diagrammzustände
- Bedienung bei 200 % und 400 % Zoom
- Reflow ohne Informationsverlust
- Tastaturprüfung sämtlicher Filter- und Ausgangsroutenkombinationen
- Prüfung nicht automatisierbarer Kontrastfälle in Spielgrafiken
- kognitive Verständlichkeit und Fehlerhilfe
