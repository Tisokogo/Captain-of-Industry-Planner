import fs from 'node:fs';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const products = read('../src/data/products.json');
const recipes = read('../src/data/recipes.json');
const machines = read('../src/data/machines.json');
const capabilities = read('../src/data/product-capabilities.json');
const overrides = read('./capability-overrides.json');

if (capabilities.version !== 2)
  throw new Error(`Unsupported capability version ${capabilities.version}`);

const missingProducts = Object.keys(products).filter((id) => !capabilities.products[id]);
const unknownProducts = Object.keys(capabilities.products).filter((id) => !products[id]);
if (missingProducts.length || unknownProducts.length) {
  throw new Error(
    `Capability product mismatch: missing=${missingProducts.join(',')} unknown=${unknownProducts.join(',')}`
  );
}

for (const [productId, capability] of Object.entries(capabilities.products)) {
  for (const facility of capability.storageFacilities) {
    if (!machines[facility.machineId])
      throw new Error(`${productId}: unknown storage machine ${facility.machineId}`);
    if (!recipes[facility.recipeId])
      throw new Error(`${productId}: unknown storage recipe ${facility.recipeId}`);
    if (!Number.isFinite(facility.capacity) || facility.capacity < 0)
      throw new Error(`${productId}: invalid storage capacity for ${facility.machineId}`);
  }
  if (capability.tradeable !== capability.importable)
    throw new Error(`${productId}: tradeable/importable mismatch`);
  if (
    !Array.isArray(capability.researchTiers) ||
    capability.researchTiers.some((tier) => tier < 0 || tier > 5)
  )
    throw new Error(`${productId}: invalid research tiers`);
  for (const [kind, recipeIds] of Object.entries(capability.routes)) {
    for (const recipeId of recipeIds) {
      const recipe = recipes[recipeId];
      if (!recipe) throw new Error(`${productId}/${kind}: unknown recipe ${recipeId}`);
      if (!recipe.inputs.some((input) => input.id === productId)) {
        throw new Error(`${productId}/${kind}: recipe ${recipeId} does not consume product`);
      }
    }
  }
}

for (const machineId of Object.keys(overrides.storageTransport)) {
  if (!machines[machineId]) throw new Error(`Unknown storage-transport override ${machineId}`);
}
for (const machineId of overrides.extractionMachines) {
  if (!machines[machineId]) throw new Error(`Unknown extraction-machine override ${machineId}`);
}
for (const machineId of Object.keys(overrides.machineDisposition)) {
  if (!machines[machineId]) throw new Error(`Unknown disposition-machine override ${machineId}`);
}

for (const productId of overrides.importableProducts) {
  if (!products[productId]) throw new Error(`Unknown importable override ${productId}`);
}

console.log(`Capabilities valid: ${Object.keys(capabilities.products).length} products`);
