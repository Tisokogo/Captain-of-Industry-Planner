import {
  machines,
  productCapabilities,
  products,
  recipeProgression,
  recipes,
} from '../data/gameData';
import type {
  OptimizationState,
  OutputDispositionType,
  PlanState,
  Recipe,
  RecipeFilterState,
} from '../../types';

const blockedCategories = new Set(['storage', 'storages', 'cargo_docks']);
export function recipeOptions(productId: string) {
  const p = products[productId];
  if (!p) return [];
  return (p.recipes?.output || [])
    .map((id) => recipes[id])
    .filter((r): r is Recipe => {
      if (!r || !r.outputs.some((o) => o.id === productId)) return false;
      const m = machines[r.machine];
      return !!m && !m.isStorage && !blockedCategories.has(m.category_id);
    });
}
export const defaultRecipeFilter = (): RecipeFilterState => ({
  disabledRecipeIds: [],
  onlyUnlockedRecipes: false,
  enabledTechTiers: [0, 1, 2, 3, 4, 5],
  machineFilter: 'all',
  maxVisibleTechTier: null,
  sortBy: 'name',
  showDisabledOnly: false,
  allowedExceptions: [],
  progressionVersion: 2,
});
export const defaultOptimization = (): OptimizationState => ({
  enabled: false,
  goal: 'minimizeWorkers',
  maxWorkers: null,
  maxPower: null,
  maxMachines: null,
  maxComputing: null,
  maxMaintenance: null,
  resourceLimits: {},
});
export const tierLabels = [
  'T0 · Start',
  'T1 · Aufbau',
  'T2 · Industrie',
  'T3 · Fortgeschritten',
  'T4 · High-Tech',
  'T5 · Endgame',
];
export function recipeTechTier(recipe: Recipe) {
  return recipeProgression[recipe.id]?.researchTier ?? 0;
}
export function isRecipeAllowed(recipe: Recipe, filter?: RecipeFilterState) {
  const f = filter || defaultRecipeFilter();
  return (
    (!f.disabledRecipeIds.includes(recipe.id) &&
      f.enabledTechTiers.includes(recipeTechTier(recipe)) &&
      (!f.onlyUnlockedRecipes || isRecipeKnownToBeUnlocked(recipe))) ||
    f.allowedExceptions.includes(recipe.id)
  );
}

function isRecipeKnownToBeUnlocked(recipe: Recipe) {
  const progression = recipeProgression[recipe.id];
  return recipeTechTier(recipe) === 0 || progression?.unlockResearchId != null;
}
function recipeScore(r: Recipe, goal: OptimizationState['goal']) {
  const m = machines[r.machine];
  const out = Math.max(...r.outputs.map((x) => x.quantity), 1),
    cycles = 60 / r.duration;
  const machinesPerRate = 1 / (out * cycles),
    workers = (m?.workers || 0) * machinesPerRate,
    power =
      Math.max(0, (m?.electricity_consumed || 0) - (m?.electricity_generated || 0)) *
      machinesPerRate,
    maintenance = (m?.maintenance_cost_quantity || 0) * machinesPerRate,
    computing = Math.max(0, m?.computing_consumed || 0) * machinesPerRate;
  return goal === 'minimizeWorkers'
    ? workers
    : goal === 'minimizePower'
      ? power
      : goal === 'minimizeMachines'
        ? machinesPerRate
        : goal === 'minimizeMaintenance'
          ? maintenance
          : goal === 'minimizeComputing'
            ? computing
            : -(out * cycles);
}
export type DispositionOption = { type: OutputDispositionType; label: string; routes: Recipe[] };
// Capability classification is based exclusively on normalized machine metadata.
// No localized machine or recipe names participate in route availability.
export function availableDispositions(
  productId: string,
  state: PlanState,
  hasInternalDemand = false
): DispositionOption[] {
  const groups = new Map<OutputDispositionType, Recipe[]>();
  const capability = productCapabilities[productId];
  if (capability) {
    for (const [kind, recipeIds] of Object.entries(capability.routes)) {
      const allowed = recipeIds
        .map((recipeId) => recipes[recipeId])
        .filter(
          (recipe): recipe is Recipe => !!recipe && isRecipeAllowed(recipe, state.recipeFilter)
        );
      groups.set(kind as OutputDispositionType, allowed);
    }
  }
  const out: DispositionOption[] = [{ type: 'unassigned', label: 'Nicht festgelegt', routes: [] }];
  if (hasInternalDemand)
    out.push({ type: 'internal-reuse', label: 'Intern wiederverwenden', routes: [] });
  for (const type of [
    'storage',
    'further-processing',
    'export',
    'dump',
    'flare',
    'wastewater',
  ] as OutputDispositionType[]) {
    const routes = groups.get(type) || [];
    if (routes.length)
      out.push({
        type,
        label:
          type === 'storage'
            ? 'Einlagern'
            : type === 'further-processing'
              ? 'Weiterverarbeiten'
              : type === 'export'
                ? 'Exportieren'
                : type === 'dump'
                  ? 'Deponieren'
                  : type === 'flare'
                    ? 'Abfackeln / Ablassen'
                    : 'Abwasserbehandlung',
        routes,
      });
  }
  return out;
}
function excludesCircularFeed(recipe: Recipe, productId: string, filter?: RecipeFilterState) {
  const queue = recipe.inputs.map((input) => input.id);
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.pop()!;
    if (current === productId) return false;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const option of recipeOptions(current)) {
      if (!isRecipeAllowed(option, filter)) continue;
      for (const input of option.inputs) queue.push(input.id);
    }
  }
  return true;
}

export function selectedRecipeForExactModel(
  productId: string,
  choices: Record<string, string>,
  filter?: RecipeFilterState,
  opt?: OptimizationState
) {
  const picked = recipes[choices[productId]];
  if (
    picked &&
    picked.outputs.some((output) => output.id === productId && output.quantity > 0) &&
    isRecipeAllowed(picked, filter)
  )
    return picked;
  return bestRecipe(productId, choices, filter, opt);
}

const missingFilter = {};
const missingOptimization = {};
const bestRecipeCache = new WeakMap<
  object,
  WeakMap<object, WeakMap<object, Map<string, Recipe | undefined>>>
>();

export function bestRecipe(
  productId: string,
  choices: Record<string, string>,
  filter?: RecipeFilterState,
  opt?: OptimizationState
) {
  const filterKey = filter || missingFilter,
    optimizationKey = opt || missingOptimization;
  let byFilter = bestRecipeCache.get(choices);
  if (!byFilter) {
    byFilter = new WeakMap();
    bestRecipeCache.set(choices, byFilter);
  }
  let byOptimization = byFilter.get(filterKey);
  if (!byOptimization) {
    byOptimization = new WeakMap();
    byFilter.set(filterKey, byOptimization);
  }
  let byProduct = byOptimization.get(optimizationKey);
  if (!byProduct) {
    byProduct = new Map();
    byOptimization.set(optimizationKey, byProduct);
  }
  if (byProduct.has(productId)) return byProduct.get(productId);

  const allowed = recipeOptions(productId).filter((r) => isRecipeAllowed(r, filter));
  const acyclic = allowed.filter((recipe) => excludesCircularFeed(recipe, productId, filter));
  const opts = acyclic.length
    ? acyclic
    : allowed.filter(
        (recipe) =>
          recipe.inputs.length === 0 || !recipe.inputs.some((input) => input.id === productId)
      );
  const picked = recipes[choices[productId]];
  let selected: Recipe | undefined;
  if (picked && opts.some((x) => x.id === picked.id)) selected = picked;
  else {
    const useful = opts.filter((r) => !r.name.toLowerCase().includes('dump'));
    const pool = useful.length ? useful : opts;
    selected = opt?.enabled
      ? [...pool].sort((a, b) => recipeScore(a, opt.goal) - recipeScore(b, opt.goal))[0]
      : pool[0];
  }
  byProduct.set(productId, selected);
  return selected;
}
