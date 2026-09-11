import { machines, products } from '../data/gameData';
import type { Goal, PlanState } from '../../types';

export { machines, products, recipeProgression, recipes } from '../data/gameData';

import { defaultOptimization, defaultRecipeFilter, recipeOptions } from './recipeSelection';
export {
  availableDispositions,
  bestRecipe,
  defaultOptimization,
  defaultRecipeFilter,
  isRecipeAllowed,
  recipeOptions,
  recipeTechTier,
  tierLabels,
} from './recipeSelection';

export { calculate } from '../optimization/heuristicOptimizer';

export function searchableProducts() {
  return Object.values(products)
    .filter((p) => recipeOptions(p.id).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function iconProduct(id: string) {
  const f = products[id]?.icon;
  return f ? `/assets/products/${f}` : '';
}
export function iconMachine(id: string) {
  const f = machines[id]?.icon;
  return f ? `/assets/buildings/${f}` : '';
}
const numberFormatters = new Map<number, Intl.NumberFormat>();
export const format = (value: number, digits = 2) => {
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits });
    numberFormatters.set(digits, formatter);
  }
  return formatter.format(value);
};
export const uid = () => Math.random().toString(36).slice(2, 9);
export function defaultState(): PlanState {
  const initial = products['construction_parts_iii']
    ? 'construction_parts_iii'
    : products['electronics_iii']
      ? 'electronics_iii'
      : searchableProducts()[0].id;
  return {
    goals: [{ id: uid(), productId: initial, rate: 12 }],
    recipeChoices: {},
    expanded: {},
    mergeGoals: true,
    autoExpandChain: true,
    includeByproducts: true,
    externalSources: {},
    outputDispositions: {},
    recipeFilter: defaultRecipeFilter(),
    optimization: defaultOptimization(),
  };
}
export type { Goal };
