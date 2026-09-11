import recipesRaw from '../../data/recipes.json';
import productsRaw from '../../data/products.json';
import machinesRaw from '../../data/machines.json';
import progressionRaw from '../../data/recipe-progression.json';
import capabilitiesRaw from '../../data/product-capabilities.json';
import type { Machine, Product, Recipe } from '../../types';

type CurrentExport = {
  schema_version: number;
  game_version: string;
  products: Array<{ id: string; name: string; state?: string }>;
  recipes: Array<{
    id: string;
    name: string;
    machine: string[];
    duration?: number;
    inputs: Array<{ product_id: string; amount: number }>;
    outputs: Array<{ product_id: string; amount: number }>;
  }>;
  buildings: Array<{ id: string; name: string; stats?: Record<string, number> }>;
  research: Array<{
    id: string;
    name: string;
    tier: number | null;
    unlocks: Array<{ type: string; id: string; name: string }>;
  }>;
};

function currentExport(): CurrentExport | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem('harbor-current-export') || 'null');
    return value?.schema_version >= 3 && Array.isArray(value?.recipes) ? value : null;
  } catch {
    return null;
  }
}

function normalizeCurrentExport(data: CurrentExport) {
  const recipes = Object.fromEntries(
    data.recipes.map((recipe) => [
      recipe.id,
      {
        id: recipe.id,
        name: recipe.name || recipe.id,
        machine: recipe.machine[0] || 'unknown',
        duration: recipe.duration || 60,
        inputs: recipe.inputs.map((item) => ({
          id: item.product_id,
          name: item.product_id,
          quantity: item.amount,
        })),
        outputs: recipe.outputs.map((item) => ({
          id: item.product_id,
          name: item.product_id,
          quantity: item.amount,
        })),
      } satisfies Recipe,
    ])
  );
  const products: Record<string, Product> = Object.fromEntries(
    data.products.map((product) => [
      product.id,
      {
        id: product.id,
        name: product.name,
        icon: '',
        recipes: { input: [], output: [] },
      } satisfies Product,
    ])
  );
  for (const recipe of Object.values(recipes)) {
    for (const output of recipe.outputs) products[output.id]?.recipes.output.push(recipe.id);
    for (const input of recipe.inputs) products[input.id]?.recipes.input.push(recipe.id);
  }
  const machines = Object.fromEntries(
    data.buildings.map((building) => [
      building.id,
      {
        id: building.id,
        name: building.name,
        icon: '',
        category_id: 'unknown',
        category_name: 'Unknown',
        isMine: false,
        isStorage: false,
        isFarm: false,
        workers: building.stats?.workers || 0,
        maintenance_cost_units: null,
        maintenance_cost_quantity: 0,
        electricity_consumed: building.stats?.electricity_kw || 0,
        electricity_generated: 0,
        computing_consumed: building.stats?.computing_tflops || 0,
        computing_generated: 0,
        recipes: data.recipes
          .filter((recipe) => recipe.machine.includes(building.id))
          .map((recipe) => recipe.id),
      } satisfies Machine,
    ])
  );
  const progression = Object.fromEntries(
    data.recipes.map((recipe) => {
      const unlock = data.research.find((node) =>
        node.unlocks.some((item) => item.type === 'recipe' && item.id === recipe.id)
      );
      const tier = unlock?.tier ?? 0;
      return [
        recipe.id,
        {
          researchTier: tier,
          rawResearchTier: unlock?.tier ?? 0,
          machineTier: null,
          variantTier: null,
          unlockResearchId: unlock?.id ?? null,
          unlockResearchName: unlock?.name ?? 'Available at start',
          provenance: unlock ? 'DIRECT_RECIPE_UNLOCK' : 'AVAILABLE_AT_START',
          confidence: unlock ? 'high' : 'medium',
          gameId: recipe.id,
          isPseudoRecipe: false,
        } satisfies RecipeProgression,
      ];
    })
  );
  return { products, recipes, machines, progression };
}

const current = currentExport();
const normalized = current ? normalizeCurrentExport(current) : null;

export type RecipeProgression = {
  researchTier: number;
  rawResearchTier: number | null;
  machineTier: number | null;
  variantTier: number | null;
  unlockResearchId: string | null;
  unlockResearchName: string | null;
  provenance: string;
  confidence: 'high' | 'medium' | 'low';
  gameId: string | null;
  isPseudoRecipe: boolean;
};

export const products = (normalized?.products || productsRaw) as Record<string, Product>;
export const recipes = (normalized?.recipes || recipesRaw) as Record<string, Recipe>;
export const machines = (normalized?.machines || machinesRaw) as Record<string, Machine>;
export type CapabilityRouteKind =
  'storage' | 'further-processing' | 'export' | 'dump' | 'flare' | 'wastewater';

export type StorageTransport = 'fluid' | 'loose' | 'unit' | 'thermal' | 'radioactive';

export type ProductCapability = {
  extractable: boolean;
  importable: boolean;
  tradeable: boolean;
  cargoCompatible: boolean;
  unknownCapacity: boolean;
  transportTypes: StorageTransport[];
  storageFacilities: Array<{
    machineId: string;
    recipeId: string;
    capacity: number;
    transport: StorageTransport | null;
  }>;
  researchTiers: number[];
  routes: Record<CapabilityRouteKind, string[]>;
};

export const recipeProgression = (normalized?.progression || progressionRaw) as Record<
  string,
  RecipeProgression
>;
export const productCapabilities = capabilitiesRaw.products as Record<string, ProductCapability>;
