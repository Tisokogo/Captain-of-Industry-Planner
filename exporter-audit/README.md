# DataExporter

JSON exporter for *Captain of Industry*. The mod loads the game prototype database, extracts products, recipes, buildings, contracts, and game settings, then writes a JSON snapshot plus a small status log.

## What It Produces

- `coi_database.json`: the main export file.
- `icons/`: PNG exports for product and building icons, split into `products/` and `buildings/`.
- `coi_exporter_status.txt`: a short success marker with the JSON path.
- `coi_exporter_log.txt`: sample output and counts for debugging reflection-based extraction.
- `coi_exporter_error.txt`: written only when export fails.

The database uses schema version `3` and additionally contains `research`.
Each research record includes its id, display name, tier when available,
parent research ids, and typed unlock references for recipes, products and
buildings. Unknown game members are exported as empty or `null` values rather
than guessed data.

The exporter writes these files next to the mod DLL when possible. If that location is unavailable, it falls back to `/tmp`.

## Database Structure

The JSON export currently uses `schema_version: 3`. The root object contains:

- `game_version`: the Captain of Industry version string detected at runtime.
- `schema_version`: the output schema version, currently `3`.
- `products`: an array of product records.
- `recipes`: an array of recipe records.
- `buildings`: an array of building records.
- `contracts`: an array of contract records.
- `research`: an array of research and unlock records.
- `game_settings`: game difficulty and mechanics data captured at mod load.

Schema 3 uses a flat, collection-based layout. Expect these record shapes:

- `products`: `{ type, name, id, state, is_storable, radioactivity, is_trash }`
- `recipes`: `{ machine, duration, inputs, outputs }`
- `buildings`: `{ type, name, id, stats }`
- `contracts`: `{ type, reputation_level, inputs, outputs }`
- `research`: `{ id, name, tier, parent_ids, unlocks }`
- `game_settings`: `{ difficulty_options, difficulty_current_values, mechanics_options, mechanics_current_values, original_preset }`

Nested `inputs`, `outputs`, and maintenance costs are arrays or objects with `product_id` and `amount` fields. `difficulty_options` contains the full catalog of settings extracted from `GameDifficultyConfig`, including each setting's title, kind, current value, and possible values when available. `difficulty_current_values` is the current live value for each setting key. `mechanics_options` lists the available game mechanics presets, and `mechanics_current_values` lists the currently selected mechanics. The template in [`templates/schema.v1.json`](/mnt/ssd2/projects/coi_data_scraper/templates/schema.v1.json) shows the exact expected keys and value types.

Product and building icons are exported as `.png` files into `icons/products/` and `icons/buildings/` next to the database file. Each file uses the normalized proto id as its filename.

## Code Layout

The implementation is split into small pieces so the responsibilities are easy to follow:

- `src/Mod/DataExporterMod.cs`: the game mod entrypoint.
- `src/Export/ExportPipeline.cs`: the export workflow and file writing.
- `src/Reflection/ProtoSelection.cs`: reflection helpers and normalization rules.
- `src/Export/ProtoBuilders.cs`: object-to-JSON mapping for each exported proto type.
- `src/Serialization/JsonExporter.cs`: the custom JSON writer.
- `src/Diagnostics/ExportDiagnostics.cs`: debug log generation.

## Local Setup

Run the setup script for your platform from the repo root. Both scripts prompt for the Captain of Industry `Managed` folder and the `Mods` folder, verify that each path exists, and then create or replace `game_libs` and `mods_folder` in this repo.

### Linux/macOS

```bash
bash setup.sh
```

### Windows, PowerShell

```powershell
pwsh -File setup.ps
```

If `pwsh` is not available, use the Windows PowerShell equivalent:

```powershell
powershell -File setup.ps
```

## Build

Run a normal build from the repo root:

```bash
dotnet build -p:SkipModCopy=true
```

The project targets `netstandard2.1`, reads game DLLs from `game_libs`, and copies `coi_data_scraper.dll` plus `manifest.json` into `mods_folder/DataExporter` unless `SkipModCopy=true` is set.

## Runtime Flow

On load, the mod resolves `ProtosDb`, the current game difficulty config, and the Unity asset database, gathers the relevant proto types and settings metadata, and writes the export files immediately. No manual export step is required.

## Troubleshooting

- If the build cannot resolve `Mafi.dll` or `Mafi.Core.dll`, check the `game_libs` link.
- If the mod DLL does not appear in the game’s Mods folder, check the `mods_folder` link and the MSBuild copy target.
- If you see an error file instead of JSON, inspect `coi_exporter_error.txt` first.
- If some fields are missing in the export, the reflection rules in `ProtoSelection.cs` or the game-settings extraction in `GameSettingsBuilders.cs` likely need an update for the current game version.
