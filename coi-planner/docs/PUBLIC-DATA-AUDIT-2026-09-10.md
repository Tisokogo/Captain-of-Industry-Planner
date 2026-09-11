# Audit öffentlicher Spieldaten – 10.09.2026

## Ziel

Einen öffentlich verfügbaren, nachvollziehbar aus Captain of Industry v0.8.7b exportierten Datensatz zu finden, der Produkte, Rezepte, Gebäude, Durchsätze und technische Kosten vollständig genug für den Produktionsplaner enthält.

## Geprüfte Quellen

| Quelle | Ergebnis |
| --- | --- |
| https://github.com/FelixZett/captain-of-industry-data-exporter | GPL-3.0-Exporter mit sauber dokumentiertem Schema und Versionsfeld, aber kein veröffentlichter Datensnapshot im Repository. Der letzte öffentliche Commit ist vom 03.04.2026 und kann daher keinen nachgewiesenen v0.8.7b-Export enthalten. |
| https://github.com/David-Melo/captain-of-data | Enthält einen Export für v0.8.1a, nicht v0.8.7b. Laut eigener Dokumentation fehlen zudem Teile der Gebäudedaten. |
| https://github.com/sterling-archer154/captian_of_industry_calculator | Öffentliche Beta-Veröffentlichung, das Repository enthält jedoch nur eine README und keinen prüfbaren Rezept-/Gebäudedatensatz. |
| https://github.com/av/coi-graph | Öffentliches Extraktionswerkzeug, aber der zuletzt auffindbare Datenstand ist älter als Update 4. |
| https://github.com/ben-shepherd/captain-of-industry-calculator | Wiki-basierte Pipeline; kein nachgewiesener vollständiger v0.8.7b-Liveexport. |
| https://coigame.com/Changelog | Bestätigt v0.8.7 und die nachfolgenden Patches, stellt aber keinen maschinenlesbaren Produktionsdatensatz bereit. |

Zusätzlich wurden GitHub und das öffentliche Web gezielt nach Kombinationen aus `0.8.7`, `recipes.json`, `products.json`, `game_version` und Captain of Industry durchsucht. Es wurde kein vollständiger, prüfbarer v0.8.7b-Snapshot gefunden.

## Ergebnis

**Punkt 1 kann mit den derzeit öffentlich auffindbaren Daten nicht seriös geschlossen werden.** Den vorhandenen v0.8.2c-Datensatz still als v0.8.7b umzubenennen wäre fachlich falsch. Auch aus Mod-Binärdateien oder inoffiziellen Spieldownloads werden keine Daten übernommen.

## Professioneller Abschlussweg

1. Den GPL-3.0-Exporter von FelixZett gegen eine rechtmäßig installierte v0.8.7b-Version ausführen.
2. Das erzeugte `coi_database.json` zusammen mit Exporter-Commit, erkanntem `game_version` und SHA-256-Prüfsumme archivieren.
3. Den Snapshot in einer separaten Staging-Pipeline gegen Referenzen, positive Dauern/Mengen und bekannte fachliche Anker validieren.
4. Unterschiede zu v0.8.2c als maschinenlesbaren Bericht prüfen.
5. Erst nach geklärter Weitergabe der extrahierten Daten und Assets den Produktivdatensatz ersetzen.

Bis ein solcher Snapshot vorliegt, bleibt die UI-Angabe „verifizierter Datenstand v0.8.2c“ bestehen.
