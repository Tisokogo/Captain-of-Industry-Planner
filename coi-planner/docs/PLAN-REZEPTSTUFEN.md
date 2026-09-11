# Prüf- und Korrekturplan für Rezeptstufen

## 1. Ausgangslage und bestätigtes Problem

Die derzeitige Zuordnung im Harbor Planner ist nur eine Heuristik. Sie sucht römische oder arabische Ziffern in:

- Maschinenname,
- Rezeptname,
- interner Rezept-ID.

Das ist fachlich nicht ausreichend, weil drei unterschiedliche Dinge vermischt werden:

1. **Forschungsstufe**, in der ein Rezept freigeschaltet wird,
2. **Maschinenstufe**, etwa Assembly I bis Assembly V,
3. **Rezeptvariante**, etwa „CP assembly (T1)“ innerhalb einer bestimmten Maschine.

Eine Rezeptvariante mit „T1“ im Namen ist nicht automatisch Forschungsstufe T1. Umgekehrt ist ein Rezept ohne Zahl im Namen nicht automatisch T0.

### Aktueller Zustand des Harbor-Planners

Im Rezeptfilter werden derzeit 631 relevante, nicht als Lager klassifizierte Datensätze angeboten. Die Heuristik ordnet sie so zu:

| aktuelle Zuordnung | Anzahl |
|---|---:|
| T0 | 183 |
| T1 | 69 |
| T2 | 257 |
| T3 | 71 |
| T4 | 25 |
| T5 | 26 |

Der auffällige T0-Bereich entsteht vor allem dadurch, dass Rezepte ohne Stufenzahl standardmäßig T0 erhalten. Dadurch landen beispielsweise fortgeschrittene Aluminium-, Chemie-, Nuklear- und Aufbereitungsrezepte fälschlich im Startbereich.

## 2. Erkenntnisse aus der Referenzimplementierung

Die Implementierung von `coicalculator.com` ermittelt die Stufe nicht aus dem Namen. Ihr Verfahren lautet:

1. Besitzt ein Rezept einen direkten Research-Unlock, wird die Stufe dieses Research-Knotens verwendet.
2. Ansonsten wird geprüft, durch welche Maschine das Rezept ausgeführt wird.
3. Besitzt diese Maschine einen Research-Unlock, wird dessen Stufe verwendet.
4. Nur wenn keine Zuordnung gefunden wird, fällt das Rezept auf 0 zurück.

Im derzeit ausgelieferten Basisdatensatz der Referenzseite sind 505 echte Basisrezepte, 88 Maschinen und 218 Research-Knoten enthalten. Die dort berechnete Verteilung lautet:

| Research-Tier | Anzahl im Referenzdatensatz |
|---|---:|
| T0 | 51 |
| T1 | 0 |
| T2 | 126 |
| T3 | 148 |
| T4 | 109 |
| T5 | 71 |

Wichtige Erkenntnis: **T1 ist im Rohdatensatz nicht belegt.** Die Research-Tiers des Spiels springen von 0 auf 2. Die Oberfläche der Referenzseite bietet trotzdem einen T1-Schalter an. Das bedeutet nicht, dass Maschinen- oder Rezeptvarianten mit „T1“ dort einsortiert werden dürfen.

Der untersuchte Referenzdatensatz trägt allerdings die Metadaten „Update 3, 11/12/2025“. Er ist daher eine wertvolle Kontrollquelle, aber nicht die alleinige Wahrheit für unseren Update-4-Datensatz.

## 3. Zieldefinition

Die Stufe soll künftig die **tatsächliche Freischaltungsstufe im Forschungsbaum** abbilden.

Folgende Werte werden getrennt gespeichert:

```ts
interface RecipeProgression {
  researchTier: 0 | 2 | 3 | 4 | 5 | null;
  machineTier: 1 | 2 | 3 | 4 | 5 | null;
  variantTier: number | null;
  unlockResearchId: string | null;
  unlockResearchName: string | null;
  provenance:
    | "DIRECT_RECIPE_UNLOCK"
    | "PRODUCT_ALL_RECIPES"
    | "PRODUCT_RECIPE_LIST"
    | "MACHINE_UNLOCK"
    | "AVAILABLE_AT_START"
    | "PSEUDO_RECIPE"
    | "MANUAL_OVERRIDE"
    | "UNRESOLVED";
}
```

Ein nicht auflösbarer Datensatz wird künftig **nicht mehr stillschweigend T0**, sondern erhält den Status **„Ungeklärt“**.

## 4. Korrekte Bedeutung der Filterstufen

Die Oberfläche soll die Rohwerte des Spiels verständlich benennen:

| Rohwert | Anzeige | Bedeutung |
|---|---|---|
| 0 | Start / Basis | Starttechnologien und Forschung vor dem nächsten Labortier |
| 1 | nicht verwendet | Im aktuellen Forschungsdatensatz nicht belegt |
| 2 | Forschung II | erste fortgeschrittene Forschungsphase |
| 3 | Forschung III | mittlere Forschungsphase |
| 4 | Forschung IV | späte Forschungsphase |
| 5 | Forschung V | Endgame / Postgame |
| null | Ungeklärt | keine belastbare Freischaltung gefunden |

T1 wird entweder deaktiviert mit dem Hinweis „vom Spiel derzeit nicht verwendet“ oder vollständig aus dem Schnellfilter entfernt. Die interne Zahl bleibt unverändert, damit importierte Pläne kompatibel bleiben.

Eine alternative, nutzerfreundlichere Beschriftung kann nach Prüfung der aktuellen Labornamen erfolgen. Wichtig ist, dass keine künstliche lückenlose Stufenfolge erfunden wird.

## 5. Benötigte Datenquelle

### Primärquelle

Ein neuer Export direkt aus der aktuell unterstützten Spielversion muss enthalten:

- `recipes`
- `machines`
- `products`
- `research`
- direkte Recipe-Unlocks
- Machine-Unlocks
- Product-Unlocks einschließlich `allRecipesUnlocked`
- explizite `recipeIds` an Product-Unlocks
- Parent-Beziehungen der Forschung
- Spielversion und Exportdatum

Der aktuelle Harbor-Datensatz v0.8.2c enthält Rezept- und Maschinendaten, aber keine vollständigen Research-Unlocks. Daher kann eine exakte Zuordnung allein aus den vorhandenen JSON-Dateien nicht hergestellt werden.

### Vorgehen

1. Den vorhandenen Game-Data-Exporter um Research-Knoten und Unlocks erweitern.
2. Export gegen die aktuelle v0.8.7b-Installation ausführen.
3. Rohdaten unverändert versioniert unter `src/data/raw/<game-version>/` ablegen.
4. Daraus beim Build eine kompakte Datei `recipe-progression.json` generieren.
5. Die Referenzdaten von coicalculator.com nur als Gegenprobe verwenden.

## 6. Auflösungsalgorithmus

Für jedes echte Produktionsrezept wird in dieser Reihenfolge gesucht:

### Regel A – direkter Rezept-Unlock

```text
Research.unlocks enthält type=recipe und recipe.id
```

Dies ist die stärkste und eindeutigste Zuordnung.

### Regel B – Produkt schaltet alle Rezepte frei

```text
Research.unlocks enthält type=product,
allRecipesUnlocked=true,
und das Rezept erzeugt oder verwendet dieses Produkt gemäß Spieldefinition.
```

Diese Fälle fehlen in der vereinfachten Referenzlogik und müssen ausdrücklich geprüft werden.

### Regel C – Produkt enthält konkrete Rezeptliste

```text
Research.unlocks enthält type=product
und recipeIds enthält recipe.id
```

### Regel D – Maschinen-Unlock

Wenn das Rezept nicht separat freigeschaltet wird, wird die früheste Forschung verwendet, die eine ausführende Maschine freischaltet und das Rezept unmittelbar verfügbar macht.

### Regel E – tatsächlich am Spielstart verfügbar

Nur Rezepte, Maschinen und Produkte, die laut Export ohne Research verfügbar sind, erhalten T0 über diese Regel.

### Regel F – ungeklärt

Kein Treffer bedeutet `researchTier: null`, nicht T0.

## 7. Sonderfallklassen

Die 631 derzeit angezeigten Datensätze sind nicht alle gleichartige Produktionsrezepte. Vor der Stufenzuordnung werden sie klassifiziert.

### 7.1 Echte Herstellungsrezepte

Normale Inputs → Maschine → Outputs. Diese erhalten eine Research-Stufe.

### 7.2 Farm- und Crop-Rezepte

Die Freischaltung hängt sowohl vom Farmgebäude als auch vom Crop-Research ab. Maßgeblich ist die **spätere** der beiden Freischaltungen:

```text
max(Farm-Unlock, Crop-Unlock, Dünger-Rezept-Unlock)
```

Die derzeitige Namensheuristik ordnet beispielsweise „Fertilizer I“ fälschlich nach der I im Namen ein.

### 7.3 Reaktormodi und Leistungsstufen

„PowerLevel 1/2/3“ bezeichnet einen Betriebsmodus, keine Research-Stufe. Maßgeblich sind Reaktor- und Brennstofffreischaltung.

### 7.4 Mining- und Quellen-Pseudorezepte

Einträge wie „Iron Mining“, „Dirt Mining“ oder „Water Pumping“ werden als **Quelle** klassifiziert. Sie erhalten entweder die Freischaltung des Fördergebäudes oder einen eigenen Filtertyp „Quellen“; sie dürfen nicht aufgrund fehlender Zahlen automatisch T0 werden.

### 7.5 Entsorgung

Dumping, Flare, Smoke Stack und Abwasser erhalten die Freischaltung der jeweiligen Entsorgungsmaschine bzw. der direkten Disposal-Forschung.

### 7.6 Forschungs-, Strom- und Betriebsrezepte

Research Labs, Turbinen, Generatoren und Reaktoren werden als Betriebsrezepte markiert. Ihre Freischaltung ergibt sich aus Maschine plus Brennstoff/Prozess, nicht aus Ziffern im Rezeptnamen.

### 7.7 Lagerrezepte

Lager-Passthroughs bleiben aus dem Rezeptfilter ausgeschlossen. Die Stufe eines Lagers gehört in einen Gebäudefilter, nicht in die Rezeptfreischaltung.

## 8. ID-Migration

Der aktuelle Datensatz verwendet normalisierte IDs wie:

```text
cp2_assembly
acid_mixing_2
microchip_manufacturing_stage_1a
```

Der Spiel-Export verwendet IDs wie:

```text
Cp2AssemblyT1
AcidMixMixing
MicrochipMachine_MicrochipProdStage1A
```

Eine dauerhafte fuzzy Zuordnung ist zu riskant. Der Daten-Build muss jedem Rezept ein `game_id` geben.

Für den einmaligen Übergang wird in dieser Reihenfolge gematcht:

1. vorhandene `game_id`
2. ausführende `machine.game_id`
3. normalisierter Rezeptname
4. vollständige Input-/Output-Signatur pro Zyklus
5. Rezeptdauer

Vorläufige Überlappungsprüfung mit den Update-3-Referenzdaten:

- 631 filterrelevante Harbor-Datensätze
- 349 bereits eindeutig über Maschinen-ID + Rezeptname matchbar
- 135 mehrdeutige Namensmatches, die über I/O-Signatur aufgelöst werden müssen
- 147 nicht direkt matchbar; überwiegend Farmen, Minen, Reaktormodi, Labs und Update-Unterschiede

Kein fuzzy Match wird ohne Validierungsbericht in die Produktion übernommen.

## 9. Auditbericht

Das Build-Skript erzeugt `recipe-progression-audit.json` und eine lesbare Markdown-Tabelle mit:

- Harbor-ID
- Game-ID
- Rezeptname
- Maschine
- Research-Tier
- Machine-Tier
- Variant-Tier
- Freischaltforschung
- Herkunft der Zuordnung
- Konfidenz
- Warnungen

Zusätzlich werden Summen ausgegeben:

```text
Gesamt
Eindeutig direkt zugeordnet
Über Maschine zugeordnet
Über Produkt zugeordnet
Startrezepte
Pseudorezepte
Ungeklärt
Mehrdeutig
```

Freigabekriterium: **0 ungeklärte echte Herstellungsrezepte**. Pseudorezepte müssen vollständig klassifiziert sein.

## 10. Manuelle Kontrollliste

Mindestens folgende Ketten werden im Spiel bzw. im aktuellen Export einzeln geprüft:

### Start / Basis

- Basic Diesel
- Construction Parts I
- Construction Parts II
- Maintenance I
- einfache Eisen- und Kupferkette
- Basic Concrete

### frühe bis mittlere Forschung

- Construction Parts III
- Stahl
- Glas
- Air Separation
- Diesel-Destillation
- Electronics I und II
- Düngerketten

### späte Forschung

- Electronics III und IV
- Microchips I und II
- Aluminium
- Gold
- Uranaufbereitung
- Nuclear Reactor und Fast Breeder Reactor
- Titanium
- Datacenter und Computing
- Raumfahrtteile

Für jedes Beispiel werden Rezept, Maschine, erforderliche Forschung und erwartete Filterstufe dokumentiert.

## 11. Tests

### Unit-Tests

- direkter Recipe-Unlock gewinnt vor Machine-Unlock
- Product-Unlock mit `allRecipesUnlocked`
- Product-Unlock mit `recipeIds`
- Farmstufe ist Maximum aus Farm- und Crop-Unlock
- Reaktor-`PowerLevel` verändert die Research-Stufe nicht
- unbekanntes Rezept wird `null`, niemals automatisch T0
- Maschinenziffer verändert die Research-Stufe nicht
- Rezeptvariantenziffer verändert die Research-Stufe nicht

### Golden Tests

Eine geprüfte Liste repräsentativer Recipe-IDs wird mit erwarteten Stufen festgeschrieben. Ein Spielupdate darf diese Datei nur durch einen bewusst bestätigten Datenimport verändern.

### UI-Tests

- T0 zeigt ausschließlich bestätigte Start-/Basisrezepte
- T1 ist leer bzw. als unbenutzt gekennzeichnet
- „Ungeklärt“ ist separat filterbar
- Filterprofile aktivieren exakt die vorgesehenen Research-Tiers
- deaktivierte Stufen verändern den Produktionsplan
- manuell gewählte Rezepte zeigen korrekte Konflikte
- Import älterer Pläne migriert alte Stufenfilter sicher

## 12. Auswirkungen auf bestehende Pläne

Die bisher gespeicherten `disabledRecipeIds` bleiben gültig. Stufenprofile werden jedoch neu berechnet.

Beim ersten Öffnen nach der Migration erscheint:

```text
Die Rezeptstufen wurden auf offizielle Forschungsdaten umgestellt.
Deine einzeln deaktivierten Rezepte bleiben erhalten.
Das bisherige Tech-Stufenprofil wurde überprüft und gegebenenfalls angepasst.
[Änderungen ansehen]
```

Die Migrationsansicht zeigt vorherige und neue Stufe pro betroffenem Rezept.

## 13. Umsetzungsreihenfolge

### Schritt 1 – Heuristik abschalten

- Unbekannte Zuordnung als „Ungeklärt“ behandeln
- Machine- und Variant-Tier separat anzeigen
- T0 nicht mehr als Fallback verwenden

### Schritt 2 – aktuelle Research-Daten exportieren

- Exporter erweitern
- v0.8.7b-Daten erzeugen
- Version und Prüfsumme speichern

### Schritt 3 – eindeutige Game-IDs herstellen

- `game_id` für jedes Rezept
- deterministisches Mapping
- Auditbericht erzeugen

### Schritt 4 – Sonderfälle auflösen

- Farmen
- Reaktoren
- Minen und Quellen
- Entsorgung
- Betriebsrezepte

### Schritt 5 – UI korrigieren

- korrekte Namen der Forschungsphasen
- T1 als unbenutzt kennzeichnen
- Filter „Ungeklärt“ und „Quellen/Betrieb“
- getrennte Badges für Research-, Maschinen- und Variant-Tier

### Schritt 6 – Migration und Tests

- bestehende Pläne migrieren
- Golden Tests
- Kontrollketten
- Produktions-Build und Performance-Test

## 14. Abnahmekriterien

Die Korrektur gilt als abgeschlossen, wenn:

1. kein echtes Rezept mehr allein anhand seines Namens klassifiziert wird,
2. kein unbekanntes Rezept automatisch T0 erhält,
3. alle echten Produktionsrezepte eine belegbare Research-Quelle besitzen,
4. T0 ausschließlich bestätigte Start-/Basisrezepte enthält,
5. Maschinen- und Rezeptvariantenstufen getrennt dargestellt werden,
6. der Auditbericht keine ungeklärten echten Produktionsrezepte enthält,
7. Filteränderungen weiterhin alle gemeinsamen Produktionsketten, Inputs, Outputs und Optimierungen korrekt beeinflussen,
8. die Datenversion sichtbar und reproduzierbar ist.

## Quellen für die Prüfung

- Referenzfilter: https://coicalculator.com/calculator
- offizieller Changelog: https://www.captain-of-industry.com/recent-changes
- offizielles Wiki: https://wiki.coigame.com/
- Update-3-Änderungen: https://www.captain-of-industry.com/post/update3-is-out
- Beispiel Assembly III / Required Research: https://wiki.coigame.com/Assembly_(Electric)_II
