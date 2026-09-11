#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const sourcePath = process.argv[2];
if (!sourcePath || process.argv.includes('--help')) {
  console.error('Usage: npm run import:current-data -- /path/to/coi_database.json');
  process.exit(sourcePath ? 0 : 2);
}

const source = path.resolve(sourcePath);
const database = JSON.parse(fs.readFileSync(source, 'utf8'));
const failures = [];

if (!Number.isInteger(database.schema_version) || database.schema_version < 3)
  failures.push('schema_version 3 oder neuer erforderlich');
if (typeof database.game_version !== 'string' || !database.game_version)
  failures.push('game_version fehlt');
for (const collection of ['products', 'recipes', 'buildings', 'contracts', 'research']) {
  if (!Array.isArray(database[collection])) failures.push(`${collection} muss ein Array sein`);
}

const ids = (records, collection) => {
  const seen = new Set();
  for (const record of records ?? []) {
    if (typeof record.id !== 'string' || !record.id) {
      failures.push(`${collection}: Datensatz ohne id`);
      continue;
    }
    if (seen.has(record.id)) failures.push(`${collection}: doppelte id ${record.id}`);
    seen.add(record.id);
  }
};
for (const collection of ['products', 'buildings', 'research'])
  ids(database[collection], collection);

for (const recipe of database.recipes ?? []) {
  if (!Array.isArray(recipe.machine))
    failures.push(`recipe: ${recipe.id ?? '<ohne id>'}: machine muss ein Array sein`);
  if (!Array.isArray(recipe.inputs) || !Array.isArray(recipe.outputs))
    failures.push(`recipe: ${recipe.id ?? '<ohne id>'}: inputs/outputs fehlen`);
}
for (const node of database.research ?? []) {
  if (!Array.isArray(node.parent_ids) || !Array.isArray(node.unlocks))
    failures.push(`research: ${node.id ?? '<ohne id>'}: parent_ids/unlocks fehlen`);
  for (const unlock of node.unlocks ?? []) {
    if (!['recipe', 'product', 'building', 'other'].includes(unlock.type))
      failures.push(`research ${node.id}: ungültiger Unlock-Typ ${unlock.type}`);
    if (typeof unlock.id !== 'string' || !unlock.id)
      failures.push(`research ${node.id}: Unlock ohne id`);
  }
}
if (failures.length) {
  console.error(`Exportprüfung fehlgeschlagen:\n${failures.join('\n')}`);
  process.exit(1);
}

const outputDir = new URL('./src/data/', root);
const write = (name, value) =>
  fs.writeFileSync(new URL(name, outputDir), `${JSON.stringify(value, null, 2)}\n`);
const research = Object.fromEntries(
  database.research
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => [
      node.id,
      {
        name: node.name,
        tier: node.tier,
        parentIds: node.parent_ids,
        unlocks: node.unlocks,
      },
    ])
);
const manifest = {
  schemaVersion: 1,
  gameVersion: database.game_version,
  sourceFile: path.basename(source),
  importedAt: new Date().toISOString(),
  counts: Object.fromEntries(
    ['products', 'recipes', 'buildings', 'contracts', 'research'].map((collection) => [
      collection,
      database[collection].length,
    ])
  ),
};

write('current-export.json', database);
write('current-research.json', research);
write('current-export-manifest.json', manifest);
console.log(
  `Imported ${database.game_version}: ${database.recipes.length} recipes, ${database.research.length} research nodes`
);
