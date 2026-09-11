# Integrationsvorschlag: globaler Rezeptfilter

## Ziel

Der Rezeptfilter wird nicht nur zu einer Suchansicht, sondern zu einer **globalen Verfügbarkeitsregel des Produktionsplans**. Ein deaktiviertes Rezept darf weder automatisch gewählt noch manuell verwendet oder von einer späteren Optimierung vorgeschlagen werden.

Damit beeinflusst der Filter unmittelbar:

- alle Produktionsziele,
- die gemeinsame Produktionskette,
- die Aufteilung gemeinsamer Zwischenprodukte,
- externe Eingänge und Netto-Ausgänge,
- Maschinen-, Strom-, Computing-, Wartungs- und Arbeiterbedarf,
- Alternativrezepte,
- gespeicherte, exportierte und geteilte Pläne.

---

## 1. Position in der Oberfläche

Im linken Bereich unter **Ketten-Einstellungen** kommt ein neuer Eintrag:

```text
REZEPTVERFÜGBARKEIT
[ Filter öffnen ]    23 deaktiviert
Technologiestand: T0–T2
```

Zusätzlich erhält die obere Werkzeugleiste ein Filtersymbol mit Status-Badge:

```text
[ Filter 23 ]
```

- Graues Badge: kein Filter aktiv.
- Oranges Badge: Rezepte oder Technologiestufen eingeschränkt.
- Rotes Badge: eine bestehende manuelle Rezeptwahl steht im Konflikt mit dem Filter.

Der Filter öffnet sich als großer Dialog über dem Planer. Änderungen werden zunächst lokal im Dialog vorgenommen und erst mit **„Auf Produktionsplan anwenden“** übernommen. **„Abbrechen“** verwirft alle Änderungen.

---

## 2. Vollständiger Funktionsumfang des Filterdialogs

### 2.1 Volltextsuche

Ein gemeinsames Suchfeld durchsucht:

- Rezeptname,
- interne Rezept-ID,
- Maschine bzw. Gebäude,
- Eingangsprodukte,
- Ausgangsprodukte.

Die Suche beeinflusst nur die sichtbare Liste. Die bereits gesetzten Aktivierungszustände bleiben bestehen.

### 2.2 Technologiestufen T0–T5

Schnellschalter:

- **Alle Technologien**
- **T0 – Basis / Start**
- **T1 – frühes Spiel**
- **T2 – mittleres Spiel**
- **T3 – spätes Spiel**
- **T4 – Endgame**
- **T5 – Postgame**

Die Stufen können einzeln ein- oder ausgeschaltet werden. Mit **„Stufenauswahl übernehmen“** werden alle Rezepte außerhalb der gewählten Stufen deaktiviert.

Zusätzlich gibt es einen kumulativen Filter:

- nur T0,
- T0–T1,
- T0–T2,
- T0–T3,
- T0–T4,
- T0–T5.

Der kumulative Filter schränkt die angezeigte Liste ein; die Schnellaktion deaktiviert Rezepte tatsächlich. Diese Trennung entspricht dem Verhalten der Referenzseite und verhindert versehentliche Massenänderungen.

### 2.3 Maschinenfilter

Dropdown mit:

- Alle Maschinen
- anschließend alle Gebäude, die mindestens ein Rezept besitzen.

Beispiele: Assembly I, Assembly II, Blast Furnace, Air Separator, Chemical Plant.

### 2.4 Sortierung

Die Rezeptliste kann sortiert werden nach:

1. Name A–Z
2. erstem Eingangsprodukt
3. erstem Ausgangsprodukt
4. Arbeitern, aufsteigend
5. Stromverbrauch, aufsteigend
6. Computing, aufsteigend
7. Technologiestufe, aufsteigend

### 2.5 Aktivierungsfunktionen

- Rezept einzeln aktivieren/deaktivieren
- **Alle aktivieren**
- **Alle gefilterten deaktivieren**
- Nur deaktivierte Rezepte anzeigen
- Anzahl deaktivierter Rezepte
- Anzahl aktivierter Rezepte
- Anzahl aktuell sichtbarer Rezepte

Wichtig: „Alle gefilterten deaktivieren“ wirkt nur auf die momentan durch Suche, Maschine und Technologiestufe gefilterte Ergebnismenge.

### 2.6 Informationsgehalt jeder Rezeptzeile

Jede Zeile zeigt:

- Aktivierungs-Checkbox
- Technologiestufen-Badge
- Ein- und Ausgangsprodukte mit Mengen
- Rezeptname
- Maschine
- Arbeiter
- Stromverbrauch bzw. -erzeugung
- Computing
- Dauer eines Rezeptzyklus

Ein deaktiviertes Rezept wird abgedunkelt und durchgestrichen, bleibt aber sichtbar und kann wieder aktiviert werden.

### 2.7 Dialogabschluss

Footer des Dialogs:

```text
23 Rezepte deaktiviert · 309 aktiviert · 41 angezeigt
[ Abbrechen ] [ Auf Produktionsplan anwenden ]
```

---

## 3. Einfluss auf die Rezeptwahl

Die Auswahlreihenfolge sollte eindeutig sein:

1. Globale Rezeptfilter bestimmen die erlaubte Rezeptmenge.
2. Eine manuelle Rezeptwahl darf nur ein erlaubtes Rezept verwenden.
3. Ohne manuelle Wahl wird aus den erlaubten Rezepten automatisch eine Standardvariante gewählt.
4. Eine spätere automatische Optimierung darf ausschließlich erlaubte Rezepte untersuchen.
5. Gibt es für ein Produkt kein erlaubtes Produktionsrezept, wird es als externer Eingang behandelt.

### Konflikt mit einer manuellen Rezeptwahl

Wird ein aktuell fest ausgewähltes Rezept deaktiviert, erscheint vor dem Anwenden:

```text
3 manuelle Rezeptwahlen werden ungültig.

(•) Automatisch durch ein erlaubtes Rezept ersetzen
( ) Als bewusste Ausnahme weiterhin zulassen
( ) Anwendung abbrechen und Konflikte anzeigen
```

Empfehlung: Standardmäßig automatisch ersetzen. Ausnahmen werden im Plan deutlich mit einem orangefarbenen „Filter-Ausnahme“-Badge gekennzeichnet.

---

## 4. Einfluss auf die gemeinsame Produktionskette

Nach dem Anwenden wird die gesamte gemeinsame Kette neu berechnet.

### Beispiel: Bauteile I und Bauteile II

Sind Bauteile I und Bauteile II Ziele, bleibt Bauteile I ein gemeinsamer Produktionsknoten:

```text
Bauteile I: 36/min
├─ 12/min → Produktionsziel Bauteile I
└─ 24/min → Bauteile II
```

Wird das bisherige Rezept für Bauteile I deaktiviert:

- wird ein anderes erlaubtes Rezept gewählt,
- dessen Eingänge ersetzen die bisherigen Eingänge,
- Maschinenzahl, Strom, Arbeiter und Nebenprodukte werden aktualisiert,
- die Aufteilung 12/min zum Ziel und 24/min zu Bauteile II bleibt nachvollziehbar.

### Statuskennzeichnungen in der Kette

Jeder Produktionsknoten erhält optional:

- **T2** – Technologiestufe des Rezepts
- **AUTO** – automatisch gewähltes Rezept
- **MANUELL** – fest ausgewähltes Rezept
- **GEFILTERT** – vorherige Wahl wurde ersetzt
- **AUSNAHME** – deaktiviertes Rezept wurde bewusst zugelassen
- **EXTERN** – kein erlaubtes Rezept verfügbar

Beim Klick auf einen Knoten öffnet die Rezeptauswahl nur erlaubte Rezepte. Ein Schalter **„Deaktivierte anzeigen“** zeigt ausgefilterte Varianten mit Begründung an.

---

## 5. Externe Eingänge und Netto-Ausgänge

### Externe Eingänge

Wenn alle Produktionsrezepte eines Produkts deaktiviert sind, wird dieses Produkt automatisch zu einem externen Eingang. Die vorhandene Herkunftsauswahl bleibt nutzbar:

- Mine / Förderung
- Frachter / Weltmine
- Handel
- Lagerbestand
- manuelle Zuführung

Zusätzlicher Hinweis:

```text
Elektronik · 18/min
Herkunft: Handel
Grund: Kein erlaubtes Produktionsrezept
[ Filter für Elektronik öffnen ]
```

Der Button öffnet den Rezeptfilter bereits auf das betroffene Produkt eingeschränkt.

### Netto-Ausgänge

Alternative Rezepte können andere Nebenprodukte erzeugen. Nach jeder Filteränderung werden deshalb alle Netto-Ausgänge neu berechnet.

Bestehende Verwendungszuweisungen bleiben anhand der Produkt-ID erhalten:

- Einlagern
- Weiterverarbeiten
- Exportieren
- Deponieren
- Abfackeln / Ablassen
- Abwasserentsorgung

Verschwindet ein Netto-Ausgang durch die neue Rezeptkombination, bleibt seine Zuweisung im Plan gespeichert, wird aber inaktiv. Taucht das Produkt später wieder auf, wird die bisherige Verwendung automatisch wiederhergestellt.

---

## 6. Filterprofile

Zusätzlich zur Referenzfunktion empfehle ich speicherbare Profile:

- Frühes Spiel T0–T1
- Mittleres Spiel T0–T2
- Spätes Spiel T0–T3
- Nur moderne Maschinen
- Ohne Recycling
- Eigene Profile

Ein Profil speichert:

- aktive Technologiestufen,
- deaktivierte Rezept-IDs,
- optional deaktivierte Maschinen,
- bevorzugte Sortierung und Ansichtsfilter.

Profile sind planbezogen. Beim Anlegen eines neuen Plans kann ein Profil als Standard ausgewählt werden.

---

## 7. Datenmodell

Erweiterung von `PlanState`:

```ts
interface RecipeFilterState {
  disabledRecipeIds: string[];
  enabledTechTiers: number[];       // 0–5
  machineFilter: string | "all";   // nur UI-Filter
  maxVisibleTechTier: number | null;
  sortBy:
    | "name"
    | "input"
    | "output"
    | "workers"
    | "power"
    | "computing"
    | "techLevel";
  showDisabledOnly: boolean;        // nur UI-Filter
  allowedExceptions: string[];
}

interface PlanState {
  // bestehende Felder
  recipeFilter: RecipeFilterState;
}
```

Das Rezeptmodell benötigt zusätzlich:

```ts
interface Recipe {
  // bestehende Felder
  techTier: 0 | 1 | 2 | 3 | 4 | 5;
}
```

Die Technologiestufe sollte nicht nur aus dem Namen der Maschine geschätzt werden. Sie sollte aus den Forschungs-/Freischaltungsdaten des Spiels importiert oder in einer separat versionierten Zuordnungstabelle gepflegt werden.

---

## 8. Änderungen am Berechnungsmodul

Die zentrale Funktion wird von

```ts
bestRecipe(productId, recipeChoices)
```

zu

```ts
bestRecipe(productId, recipeChoices, recipeFilter)
```

erweitert.

Prinzip:

```ts
const allowed = recipeOptions(productId).filter(recipe =>
  !filter.disabledRecipeIds.includes(recipe.id) &&
  filter.enabledTechTiers.includes(recipe.techTier)
);
```

Die gemeinsame DAG-Berechnung muss nach jeder relevanten Filteränderung vollständig invalidiert werden. Für schnelle Reaktionen empfiehlt sich ein Cache-Key aus:

```text
Ziele + Zielraten + manuelle Rezeptwahlen + deaktivierte Rezept-IDs + Techstufen
```

Nur „Apply“ verändert diesen Key. Suche, Sortierung oder „nur deaktivierte anzeigen“ lösen keine Produktionsberechnung aus.

---

## 9. Speichern, Teilen und Importieren

Der vollständige Filterzustand wird übernommen in:

- lokale automatische Speicherung,
- benannte Pläne,
- JSON-Export,
- JSON-Import,
- teilbare URL.

Beim Import eines älteren Plans ohne Filter wird automatisch migriert:

```ts
recipeFilter = {
  disabledRecipeIds: [],
  enabledTechTiers: [0, 1, 2, 3, 4, 5],
  machineFilter: "all",
  maxVisibleTechTier: null,
  sortBy: "name",
  showDisabledOnly: false,
  allowedExceptions: []
};
```

Existiert eine Rezept-ID nach einem Spielupdate nicht mehr, wird sie ignoriert und im Importbericht genannt.

---

## 10. Empfohlene Umsetzungsschritte

### Phase 1 – Filterkern

- `disabledRecipeIds` im Plan speichern
- einzelne Rezepte aktivieren/deaktivieren
- Suche, Maschine, Sortierung und Aktivstatus
- Filter in `bestRecipe` und gemeinsame Berechnung einbauen
- Konfliktbehandlung bei manuellen Rezepten

### Phase 2 – Technologiestufen

- Forschungsdaten bzw. Tier-Zuordnung importieren
- T0–T5-Schnellwahl
- kumulativer Techfilter
- Tier-Badges an Rezepten und Produktionsknoten

### Phase 3 – Komfort

- Filterprofile
- direkter Sprung vom externen Eingang zum passenden Filter
- Änderungsvergleich vor dem Anwenden
- Anzeige der Auswirkungen: Maschinen, Strom, Arbeiter, Inputs und Outputs vorher/nachher

### Phase 4 – Optimierung

- erlaubte Rezepte automatisch vergleichen
- Optimierungsziele: Arbeiter, Strom, Maschinen, Wartung, Computing
- optionale Grenzwerte
- alternative zulässige Produktionspläne anzeigen

---

## Empfehlung

Für den bestehenden Harbor Planner sollte der Filter als **planweite harte Rezept-Constraint mit Apply-Schritt** umgesetzt werden. Das ist besser als ein einfacher Filter in der Rezeptbibliothek: Jede Änderung bleibt kontrollierbar, verändert aber nach dem Anwenden konsequent alle Ziele, Zwischenprodukte, Materialflüsse, externen Eingänge, Netto-Ausgänge und Kennzahlen.
