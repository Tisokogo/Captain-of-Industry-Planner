# Umsetzungsplan: wirksame Netto-Ausgänge und vollständiger Produktionsfluss

## 1. Zielbild

Die Auswahl bei einem Netto-Ausgang soll künftig keine reine Notiz mehr sein. Sie wird Teil des Produktionsmodells und erscheint als echter Materialfluss im Diagramm.

Beispiele:

```text
Schlacke 18/min → Lager
Abgas 24/min → Luftwäscher → CO₂ + Schwefel
Überschüssiges Wasser 12/min → interne Wiederverwendung → Betonmischer
Schwefel 6/min → Export
Sauerwasser 8/min → Aufbereitung
```

Die Auswahl beeinflusst dabei:

- Materialbilanzen,
- interne Wiederverwendung,
- benötigte Entsorgungs- und Verarbeitungsmaschinen,
- zusätzliche Eingänge der gewählten Verarbeitungsroute,
- deren Nebenprodukte,
- Strom, Arbeiter, Computing und Wartung,
- externe Eingänge,
- weitere Netto-Ausgänge,
- beide Diagrammmodi.

Der Produktionsfluss zeigt anschließend die **gesamte Kette ohne feste Tiefenbegrenzung**.

---

## 2. Derzeitige Einschränkungen

### Netto-Ausgänge

Der aktuelle Plan speichert nur einen einfachen Textwert wie:

```ts
outputSinks: Record<string, string>
```

Diese Auswahl verändert die Berechnung nicht und wird nicht als Zielknoten im Diagramm dargestellt.

### Produktionsfluss

- Die getrennte Baumansicht wird derzeit nach drei Ebenen abgeschnitten.
- Die gemeinsame Ansicht enthält zwar alle berechneten Bedarfsprodukte, stellt aber Netto-Ausgänge und deren Verwendungen nicht als vollständige Flusskette dar.
- Produkt- und Rezeptknoten sind teilweise zusammengefasst. Dadurch ist bei komplexen Nebenproduktketten nicht immer eindeutig, welches Rezept welchen Ausgang erzeugt.

---

## 3. Neues Datenmodell für Verwendungen

Der einfache String wird durch eine strukturierte Zuweisung ersetzt:

```ts
type OutputDispositionType =
  | "unassigned"
  | "internal-reuse"
  | "storage"
  | "further-processing"
  | "export"
  | "dump"
  | "flare"
  | "wastewater";

interface OutputDisposition {
  type: OutputDispositionType;

  // Bei Verarbeitung, Dumping, Flare oder Abwasserbehandlung
  recipeId?: string;

  // Optionales gewünschtes Folgeprodukt
  targetProductId?: string;

  // Bei interner Wiederverwendung: konkreter Verbraucher oder automatisch
  consumerProductId?: string;
  consumerRecipeId?: string;

  // Standard: gesamte verfügbare Nettomenge
  amountMode: "all" | "capped";
  maxRate?: number;

  // Optional bei Lager/Export
  facilityId?: string;

  // Für bewusst offen gelassene Überschüsse
  note?: string;
}

interface PlanState {
  outputDispositions: Record<string, OutputDisposition>;
}
```

Die bisherige Eigenschaft `outputSinks` wird beim Laden automatisch migriert.

---

## 4. Ermittlung aktuell möglicher Verwendungen

Eine zentrale Funktion ermittelt für jeden Netto-Ausgang die momentan tatsächlich erlaubten Optionen:

```ts
getAvailableDispositions(
  productId,
  planState,
  calculationContext
): AvailableDisposition[]
```

Jede Option besitzt:

```ts
interface AvailableDisposition {
  type: OutputDispositionType;
  label: string;
  routes: DispositionRoute[];
  reason?: string;
}
```

In der Auswahl werden ausschließlich mögliche Optionen angezeigt. Nicht mögliche Verwendungen erscheinen nicht im Dropdown.

### 4.1 Interne Wiederverwendung

Nur verfügbar, wenn:

- dasselbe Produkt an einer anderen Stelle der aktuellen Gesamtkette benötigt wird,
- dort noch nicht vollständig durch andere Nebenprodukte gedeckter Bedarf besteht,
- der Materialfluss keinen unzulässigen Selbstversorgungszyklus erzeugt.

Die Auswahl zeigt mögliche Verbraucher:

```text
Intern verwenden
├─ automatisch optimal verteilen
├─ 8/min → Betonmischer
└─ 4/min → Säureproduktion
```

### 4.2 Lager

Nur verfügbar, wenn:

- das Produkt lagerfähig ist,
- mindestens ein kompatibler Lagertyp existiert,
- der Lagertyp im gewählten Technologiestand verfügbar ist.

Bei mehreren Lagertypen kann optional ein konkretes Lager gewählt werden. Die Lagerwahl verändert nicht die Materialmenge, erscheint aber als Endpunkt im Diagramm.

### 4.3 Weiterverarbeitung

Nur verfügbar, wenn mindestens ein aktuell erlaubtes Rezept das Produkt verbraucht.

Berücksichtigt werden:

- globaler Rezeptfilter,
- T0–T5-Technologiestand,
- deaktivierte Maschinen,
- manuelle Rezeptausnahmen,
- Zyklusprüfung.

Nach Auswahl von „Weiterverarbeiten“ folgt ein zweiter Picker:

```text
Schwefel weiterverarbeiten zu …
├─ Säure – Mixer
├─ Dünger – Chemical Plant
└─ Gummi – Air Separator / weitere Kette
```

Die gewählte Verarbeitung erzeugt einen echten neuen Rezeptzweig einschließlich aller Inputs und Outputs.

### 4.4 Export

Nur verfügbar, wenn das Produkt für mindestens eine unterstützte Export-, Handels- oder Frachterroute geeignet ist und die entsprechende Anlage bzw. Route im Technologiestand verfügbar ist.

Optional auswählbar:

- Handel
- Cargo Ship
- Vertrag
- benutzerdefinierter Export

### 4.5 Dumping

Nur verfügbar, wenn ein erlaubtes Dump-/Disposal-Rezept für das Produkt existiert. Lose Feststoffe und Flüssigkeiten werden getrennt behandelt.

### 4.6 Flare / Ablassen

Nur verfügbar, wenn das Produkt von einer aktuell verfügbaren Flare-, Vent- oder Smoke-Stack-Route angenommen wird.

### 4.7 Abwasserbehandlung

Nur verfügbar, wenn:

- das Produkt für eine Abwasseranlage geeignet ist,
- mindestens ein erlaubtes Behandlungs- oder Einleitungsrezept existiert.

Die Behandlung kann zusätzliche Inputs und weitere Outputs erzeugen. Diese werden wiederum vollständig berechnet.

### 4.8 Nicht zugewiesen

„Nicht festgelegt“ bleibt immer als sichere Option verfügbar. Der Ausgang wird dann als offener Netto-Ausgang mit Warnstatus dargestellt.

---

## 5. Fähigkeitsindex statt Namensprüfung

Verwendungen werden nicht anhand von Begriffen wie „Dump“ oder „Flare“ im Namen geraten. Beim Daten-Build wird ein Fähigkeitsindex erzeugt:

```ts
interface ProductCapabilities {
  storable: boolean;
  compatibleStorageIds: string[];
  consumerRecipeIds: string[];
  disposalRecipeIds: string[];
  flareRecipeIds: string[];
  wastewaterRecipeIds: string[];
  exportRouteIds: string[];
}
```

Datenquellen:

- Produktzustand: loose, fluid, unit, molten, virtual
- Storage-Kompatibilität
- Maschinenports
- Recipe Inputs/Outputs
- Machine-Klassifikation
- Cargo-/Trade-/Contract-Daten
- Research-/Progressionsdaten
- Rezeptfilter des aktuellen Plans

Der Build erzeugt zusätzlich einen Auditbericht für alle Produkte. Ungeklärte Entsorgungsmöglichkeiten werden nicht automatisch freigegeben.

---

## 6. Neuer Berechnungskern

### 6.1 Materialbilanz

Für jedes Produkt gilt:

```text
Primärproduktion
+ Nebenproduktproduktion
+ externe Zuführung
=
interner Verbrauch
+ Produktionsziele
+ Lager/Export/Entsorgung
+ offener Überschuss
```

Die aktuelle Berechnung expandiert Ziele im Wesentlichen rückwärts. Für wirksame Nebenprodukte reicht das nicht mehr aus, weil Nebenprodukte gleichzeitig den Bedarf anderer Zweige decken können.

### 6.2 Berechnungsphasen

#### A – Bruttobedarf

Alle Produktionsziele und expliziten Weiterverarbeitungen werden vollständig expandiert.

#### B – Nebenproduktpool

Alle Nebenprodukte werden rezeptgenau in einen gemeinsamen Pool geschrieben:

```ts
Map<ProductId, ByproductBatch[]>
```

Jeder Batch kennt Ursprung, Rate und Rezeptaktivität.

#### C – interne Wiederverwendung

Ausgänge mit `internal-reuse` werden gegen passende offene Bedarfe verrechnet. Die Kanten speichern exakt:

- Ursprungrezept,
- Zielrezept,
- verwendete Rate,
- verbleibenden Überschuss.

#### D – Neuberechnung

Sinkt durch Wiederverwendung die benötigte Primärproduktion, werden Maschinenaktivitäten und deren Inputs reduziert. Anschließend werden Nebenprodukte erneut ausgewertet.

#### E – Fixpunkt / lineares Gleichungssystem

Die Iteration läuft bis zu einem stabilen Ergebnis. Für Recyclingkreise und Mehrfachausgänge werden stark zusammenhängende Komponenten erkannt und als kleines lineares Gleichungssystem gelöst.

Damit werden unter anderem vermieden:

- Endlosschleifen bei Wasser-/Dampfkreisen,
- doppelte Anrechnung desselben Nebenprodukts,
- künstliche Erzeugung aus einem geschlossenen Kreislauf,
- oszillierende Neuberechnungen.

#### F – gewählte Ausgangsrouten

Verbleibende Netto-Ausgänge werden entsprechend ihrer Zuweisung verarbeitet. Entsorgungs- oder Weiterverarbeitungsrezepte können neue Inputs und Outputs erzeugen; diese werden erneut in die Bilanz aufgenommen.

#### G – offene Ausgänge und Konflikte

Nicht zuweisbare Restmengen werden als offene Netto-Ausgänge mit Warnung ausgegeben.

---

## 7. Eindeutiger Flussgraph

Das Diagramm erhält getrennte Knotentypen:

```ts
type FlowNode =
  | ProductNode
  | RecipeNode
  | ExternalSourceNode
  | GoalNode
  | StorageSinkNode
  | ExportSinkNode
  | DisposalSinkNode
  | OpenOutputNode;
```

### Produktknoten

Zeigt verfügbare und verteilte Gesamtmenge.

### Rezeptknoten

Zeigt:

- Rezept
- Maschine
- Anzahl Maschinen
- Forschungsstufe
- Inputs und Outputs
- Strom, Arbeiter, Computing und Wartung

### Kanten

Jede Kante besitzt:

```ts
interface FlowEdge {
  productId: string;
  rate: number;
  fromNodeId: string;
  toNodeId: string;
  purpose:
    | "recipe-input"
    | "recipe-output"
    | "goal"
    | "reuse"
    | "storage"
    | "export"
    | "disposal"
    | "open-output";
}
```

Die vollständige Herkunft und Verwendung jeder Menge ist damit eindeutig nachvollziehbar.

---

## 8. Gemeinsamer Modus

Die gemeinsame Ansicht zeigt den vollständigen konsolidierten Graphen:

```text
Externe Quellen
      ↓
Produktions- und Verarbeitungskette
      ↓
Ziele + Lager + Wiederverwendung + Export + Entsorgung
```

Regeln:

- identische Rezeptaktivitäten werden zusammengeführt,
- gemeinsame Zwischenprodukte erscheinen einmal,
- Ziele bleiben eigene Sink-Knoten,
- interne Wiederverwendung erhält direkte Querverbindungen,
- Netto-Ausgänge stehen rechts bei ihren gewählten Verwendungen,
- offene Ausgänge werden rot markiert,
- jede Kante zeigt die Rate pro Minute.

Die bisherige feste Grenze von drei Ebenen entfällt.

---

## 9. Getrennter Modus

Auch die getrennte Ansicht bildet jede Zielkette vollständig ab.

### Gemeinsame Inputs

In jeder Zielkette wird der zugehörige Anteil gezeigt. Ein Verweis nennt zusätzlich die konsolidierte Gesamtproduktion.

### Nebenprodukte

Nebenprodukte erscheinen am verursachenden Rezept. Ihre Verwendung wird direkt als Unterzweig dargestellt:

```text
Rezept
├─ Hauptprodukt → Zielkette
└─ Nebenprodukt
   ├─ 6/min → Lager
   └─ 4/min → Verwendung in Ziel 2
```

### Zielübergreifende Wiederverwendung

Wird ein Nebenprodukt einer anderen Zielkette zugeführt, zeigt die Quellkette einen Link-Knoten:

```text
→ verwendet in „Bauteile II“, Stufe 4
```

Die Zielkette zeigt spiegelbildlich:

```text
← 4/min Nebenprodukt aus „Diesel“, Stufe 3
```

Dadurch bleibt die Ansicht getrennt, ohne den tatsächlichen Materialfluss zu verschleiern.

Auch hier gibt es keine Tiefenbegrenzung.

---

## 10. Bedienoberfläche für Netto-Ausgänge

Jede Ausgangszeile erhält:

```text
[Icon] Schwefel                 +12/min
Verwendung: [ Weiterverarbeiten ▼ ]
Route:      [ Säure – Mixer ▼ ]
Menge:      [ Gesamter Überschuss ▼ ]
Status:     12/min vollständig zugewiesen
```

### Statusfarben

- Grün: gesamte Nettomenge sinnvoll zugewiesen
- Orange: teilweise zugewiesen
- Rot: Verwendung nicht mehr möglich oder Restmenge offen
- Blau: interne Wiederverwendung

Nach einer Änderung zeigt eine kleine Vorschau unmittelbar:

```text
+1,25 Mixer
+0,8 MW
+6 Arbeiter
-12/min offener Schwefel
+9/min Säure
```

Erst anschließend wird die Änderung bestätigt oder direkt live übernommen, abhängig von der gewählten UX-Einstellung.

---

## 11. Reaktion auf Rezept- und Techfilter

Ändert sich der globale Rezeptfilter:

1. werden alle Ausgangsrouten neu validiert,
2. verschwinden nicht mehr mögliche Optionen aus neuen Auswahllisten,
3. bestehende, jetzt ungültige Zuweisungen werden nicht still ersetzt,
4. stattdessen entsteht ein Konflikt:

```text
Die gewählte Schwefel-Entsorgung ist in T0–T2 nicht verfügbar.
[Alternative wählen] [Als Filterausnahme zulassen] [Nicht zugewiesen]
```

Manuelle Filterausnahmen werden wie bei Produktionsrezepten explizit gespeichert und markiert.

---

## 12. Vollständigkeit und Performance

Eine komplette späte Produktionskette kann mehrere hundert Knoten enthalten. Die bisherige rekursive DOM-Baumdarstellung wird deshalb ersetzt.

### Berechnung

- Materialbilanz in einem Web Worker
- memoisiertes Rezeptmodell
- inkrementelle Neuberechnung nur betroffener Komponenten
- Cache-Key aus Zielen, Rezepten, Filtern, Quellen und Ausgangszuweisungen
- Zykluskomponenten separat lösen

### Darstellung

- Graphlayout ebenfalls im Worker
- virtuelle Darstellung außerhalb des sichtbaren Bereichs
- SVG-/Canvas-Kanten statt verschachtelter CSS-Bäume
- Detailkarten erst beim Heranzoomen rendern
- Minimap und „Alles einpassen“
- Suchfunktion für Knoten
- Ein-/Ausklappen verändert nur die Darstellung, nicht die Vollständigkeit der Berechnung

Zielwerte:

- normale Neuberechnung unter 50 ms
- große Endgame-Kette unter 150 ms
- flüssiges Zoomen und Verschieben mit 60 FPS
- keine feste Rekursionstiefe

---

## 13. Migration bestehender Pläne

Alte Werte werden wie folgt umgewandelt:

```text
storage     → { type: "storage", amountMode: "all" }
recycle     → { type: "internal-reuse", amountMode: "all" }
export      → { type: "export", amountMode: "all" }
dump        → { type: "dump", amountMode: "all" }
flare       → { type: "flare", amountMode: "all" }
wastewater  → { type: "wastewater", amountMode: "all" }
unused      → { type: "unassigned", amountMode: "all" }
```

Nach der Migration wird jede Route validiert. Ungültige Altzuweisungen werden als Konflikt angezeigt und nicht ausgeführt.

Exportformat und URL-Zustand erhalten eine neue Formatversion.

---

## 14. Testplan

### Verfügbarkeitsregeln

- Flüssigkeit zeigt nur kompatible Fluid-Lager.
- Molten-Produkte zeigen kein normales Unit Storage.
- Pollution kann nicht eingelagert oder exportiert werden.
- Flare erscheint nur bei akzeptierten Gasen/Flüssigkeiten.
- Dump erscheint nur bei vorhandenem Disposal-Rezept.
- Weiterverarbeitung zeigt nur durch Filter und Techstand erlaubte Rezepte.

### Materialbilanzen

- Ein Nebenprodukt darf nur einmal verwendet werden.
- Teilweise Wiederverwendung lässt die Restmenge als Netto-Ausgang stehen.
- Vollständige Wiederverwendung entfernt den offenen Netto-Ausgang.
- Entsorgungsrezepte verändern Maschinen, Strom und Inputs.
- Nebenprodukte einer Entsorgungsroute werden erneut bilanziert.

### Beispielketten

1. Bauteile I + II mit gemeinsamem Zwischenprodukt
2. Hochofen mit Schlacke und Abgas
3. Ölraffinerie mit mehreren gleichzeitig nutzbaren Nebenprodukten
4. Sauerwasseraufbereitung
5. Abgaswäsche mit Schwefelgewinnung
6. Wasser-/Dampfkreislauf
7. Uran- und Wiederaufbereitungskreislauf
8. Landwirtschaft mit Biomasse/Kompost

### Diagramme

- Beide Modi enthalten alle Kettenstufen.
- Jede Materialmenge besitzt Quelle und Ziel.
- Alle Ziele und Verwendungen werden dargestellt.
- Zielübergreifende Wiederverwendung ist in beiden Modi nachvollziehbar.
- Zyklen werden korrekt und ohne Endlosrekursion dargestellt.

---

## 15. Umsetzungsphasen

### Phase 1 – Fähigkeitsindex und neues Datenmodell

- Produktzustände und kompatible Anlagen importieren
- mögliche Verwendungen je Produkt generieren
- strukturierte `OutputDisposition`
- Migration alter Pläne
- Auditbericht

### Phase 2 – wirksame Ausgangsrouten

- Lager-, Export-, Dump-, Flare- und Abwasserknoten
- ausgewählte Routen in Materialbilanz aufnehmen
- zusätzliche Maschinen und Inputs berechnen
- dynamische Auswahl nur möglicher Verwendungen

### Phase 3 – interne Wiederverwendung

- gemeinsamer Nebenproduktpool
- Zuordnung zu konkreten Verbrauchern
- Teilmengen und automatische Verteilung
- Fixpunkt-/Zykluslösung
- Konfliktbehandlung

### Phase 4 – vollständiger Flussgraph

- getrennte Product-, Recipe-, Source-, Goal- und Sink-Knoten
- vollständige Kanten mit Raten
- keine Tiefenbegrenzung
- vollständiger gemeinsamer Modus

### Phase 5 – vollständiger getrennter Modus

- komplette Zielbäume
- anteilige Nebenprodukte
- zielübergreifende Link-Knoten
- keine Tiefenbegrenzung

### Phase 6 – Performance, Migration und Tests

- Worker für Berechnung und Layout
- Virtualisierung
- Golden Tests
- Import-/Exportversion erhöhen
- Performance-Benchmarks

---

## 16. Abnahmekriterien

Die Umsetzung ist abgeschlossen, wenn:

1. jede sichtbare Verwendung für das jeweilige Produkt aktuell ausführbar ist,
2. nicht mögliche Verwendungen nicht im Picker erscheinen,
3. jede gewählte Verwendung die Berechnung tatsächlich verändert,
4. Verarbeitungs- und Entsorgungsrouten vollständig mit Inputs und Outputs berechnet werden,
5. interne Wiederverwendung Primärproduktion korrekt reduziert,
6. jede Materialrate genau einer oder mehreren nachvollziehbaren Verwendungen zugeordnet ist,
7. beide Diagrammmodi die vollständige Kette ohne Tiefenlimit abbilden,
8. alle externen Quellen, Ziele und Netto-Ausgänge als eigene Endpunkte erscheinen,
9. Rezept- und Techfilter ungültige Routen zuverlässig erkennen,
10. große Endgame-Ketten innerhalb der Performance-Ziele bleiben.
