# Datenquellenstatus

Stand: 09.09.2026

## Laufzeitdaten

- Der derzeit normalisierte Produktionsdatensatz stammt aus Captain of Industry Update 4, Version **v0.8.2c**.
- Die aktuell bekannte Spielversion ist **v0.8.7b** vom 22.08.2026.
- Ein direkter v0.8.7b-Prototypdatenexport liegt im Projekt derzeit **nicht** vor. Deshalb wird die fachliche Verifikation im Manifest korrekt mit v0.8.2c angegeben und nicht mit v0.8.7b gleichgesetzt.
- Die Patchnotes für v0.8.7 und v0.8.7b betreffen insbesondere Rampen, Züge, Suche, Determinismus, Performance und Fehlerkorrekturen. Das ist kein hinreichender Beweis dafür, dass sämtliche Produktionsdaten seit v0.8.2c unverändert sind.

## Geprüfte aktuelle Exportmöglichkeit

Als geeignete Quelle für den nächsten direkten Export wurde `FelixZett/captain-of-industry-data-exporter` geprüft. Der Exporter liest die laufende Prototypdatenbank und exportiert:

- erkannte Spielversion,
- Produkte inklusive Zustand und Lagerfähigkeit,
- Rezepte,
- Gebäude,
- Verträge,
- Spieleinstellungen,
- Produkt- und Gebäudeicons.

Schema 3 enthält zusätzlich Forschungszweige und typisierte Freischaltungen.
Der Exporter schreibt diesen Snapshot beim Laden des Spiels automatisch.
Der Browser kann private Spieldateien nicht direkt durchsuchen; der Button in
der App öffnet deshalb die Dateiauswahl für diesen Export. Ein tatsächlicher
Spieler-Forschungsstand ist in der Prototypdatenbank nicht enthalten. Die
Option „Nur freigeschaltete aktiv“ nutzt daher Startrezepte und explizite
Forschungszuordnungen. Für den exakten Stand eines Spielstands wäre zusätzlich
ein Savegame- oder Ingame-Forschungs-Export erforderlich.
Mit `npm run import:current-data -- /pfad/zu/coi_database.json` werden daraus
ein Rohsnapshot, ein Forschungsindex und ein Versionsmanifest für den Planner
erzeugt. Die Übernahme in die produktiven Laufzeitdaten bleibt absichtlich ein
separater, validierter Schritt.

Damit deckt er mehrere derzeit fehlende Metadaten ab, insbesondere Produktzustand, Lagerfähigkeit und Verträge. Das Repository enthält jedoch keinen fertigen aktuellen Spieldaten-Snapshot; der Export muss gegen eine installierte, lizenzierte v0.8.7b-Spielversion ausgeführt werden.

## Quellen

- Changelog v0.8.7b: https://coigame.com/Changelog
- Exporter: https://github.com/FelixZett/captain-of-industry-data-exporter
- Bisherige normalisierte Quelle: https://github.com/David-Melo/captains-calculator

## Freigabekriterium für die Datenumstellung

Ein neuer Datensatz wird erst als aktuelle Laufzeitquelle übernommen, wenn:

1. `game_version` im Rohdatensatz v0.8.7b oder neuer ausweist,
2. Rohdaten und Quell-Commit archiviert und gehasht sind,
3. IDs, Mengen, Dauern, Maschinen und Verträge validiert wurden,
4. Progressions- und Capability-Artefakte deterministisch neu erzeugt wurden,
5. Golden-Szenarien und Materialbilanzen unverändert bestehen oder fachlich geprüfte Diffs dokumentiert sind,
6. Asset- und Datenlizenzstatus für die Veröffentlichung geklärt ist.
