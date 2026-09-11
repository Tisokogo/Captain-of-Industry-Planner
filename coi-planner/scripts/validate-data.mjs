import fs from 'node:fs';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const products = read('../src/data/products.json');
const recipes = read('../src/data/recipes.json');
const machines = read('../src/data/machines.json');
const categories = read('../src/data/categories.json');

const failures = [];
const unknownCapacityRecipes = new Set();
let recipesWithoutOutputs = 0;
for (const [recipeId, recipe] of Object.entries(recipes)) {
  if (!machines[recipe.machine]) failures.push(`${recipeId}: unknown machine ${recipe.machine}`);
  if (!Number.isFinite(recipe.duration) || recipe.duration <= 0)
    failures.push(`${recipeId}: duration must be positive`);
  if (!recipe.outputs.length) recipesWithoutOutputs += 1;

  for (const input of recipe.inputs) {
    if (!products[input.id]) failures.push(`${recipeId}: unknown input product ${input.id}`);
    if (!Number.isFinite(input.quantity) || input.quantity <= 0)
      failures.push(`${recipeId}/${input.id}: input quantity must be positive`);
  }
  for (const output of recipe.outputs) {
    if (!products[output.id]) failures.push(`${recipeId}: unknown output product ${output.id}`);
    if (!Number.isFinite(output.quantity) || output.quantity < 0)
      failures.push(`${recipeId}/${output.id}: output quantity must be non-negative`);
    if (output.quantity === 0) unknownCapacityRecipes.add(recipeId);
  }
}

for (const [machineId, machine] of Object.entries(machines)) {
  if (machine.category_id && !categories[machine.category_id])
    failures.push(`${machineId}: unknown category ${machine.category_id}`);
  for (const recipeId of machine.recipes ?? []) {
    if (!recipes[recipeId]) failures.push(`${machineId}: unknown recipe ${recipeId}`);
  }
}

if (unknownCapacityRecipes.size !== 14)
  failures.push(
    `Expected 14 recipes with explicitly unknown output capacities, found ${unknownCapacityRecipes.size}`
  );
if (recipesWithoutOutputs !== 21)
  failures.push(
    `Expected 21 sink/research recipes without outputs, found ${recipesWithoutOutputs}`
  );
if (failures.length) throw new Error(`Data validation failed:\n${failures.join('\n')}`);

console.log(
  `Data valid: ${Object.keys(products).length} products, ${Object.keys(recipes).length} recipes, ${Object.keys(machines).length} machines; ${unknownCapacityRecipes.size} recipes with unknown capacities, ${recipesWithoutOutputs} sink/research recipes`
);
