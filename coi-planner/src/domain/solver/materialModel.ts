import { products, recipes } from '../data/gameData';
import type { PlanState, Recipe } from '../../types';
import { selectedRecipeForExactModel } from './recipeSelection';
import { solveNonNegativeLinearSystem, type LinearSolveResult } from './linearSystem';

export type MaterialActivity = {
  productId: string;
  recipeId: string;
  primaryOutput: number;
};

export type CanonicalMaterialModel = {
  productIds: string[];
  activities: MaterialActivity[];
  matrix: number[][];
  rhs: number[];
  externalProductIds: string[];
};

export type CanonicalMaterialSolution = {
  model: CanonicalMaterialModel;
  linear: LinearSolveResult;
  cyclesByProduct: Record<string, number>;
  ratesByProduct: Record<string, number>;
  externalInputs: Record<string, number>;
  surplusByProduct: Record<string, number>;
  balanceResiduals: Record<string, number>;
};

function reusableByproduct(
  recipe: Recipe,
  productId: string,
  state: PlanState,
  fixedReuseCredits: Readonly<Record<string, number>>
) {
  const disposition = state.outputDispositions?.[productId];
  return (
    !(productId in fixedReuseCredits) &&
    state.includeByproducts !== false &&
    recipe.outputs.some((output) => output.id === productId) &&
    disposition?.type === 'internal-reuse' &&
    disposition.amountMode !== 'capped' &&
    !disposition.consumerProductId &&
    !disposition.consumerRecipeId &&
    !disposition.targetProductId
  );
}

/** Builds one recipe-activity variable and one balance row per internally produced material. */
export function buildCanonicalMaterialModel(
  state: PlanState,
  fixedReuseCredits: Readonly<Record<string, number>> = {}
): CanonicalMaterialModel {
  const selected = new Map<string, MaterialActivity>();
  const external = new Set<string>();
  const queue = state.goals.map((goal) => goal.productId);
  const visited = new Set<string>();

  while (queue.length) {
    const productId = queue.shift()!;
    if (visited.has(productId)) continue;
    visited.add(productId);
    const recipe = selectedRecipeForExactModel(
      productId,
      state.recipeChoices,
      state.recipeFilter,
      state.optimization
    );
    const primaryOutput = recipe?.outputs.find((output) => output.id === productId)?.quantity;
    if (!recipe || primaryOutput == null || primaryOutput <= 0) {
      external.add(productId);
      continue;
    }
    selected.set(productId, { productId, recipeId: recipe.id, primaryOutput });
    if (state.autoExpandChain !== false) {
      for (const input of recipe.inputs) queue.push(input.id);
    }
  }

  const activities = [...selected.values()].sort((a, b) => a.productId.localeCompare(b.productId));
  const productIds = activities.map((activity) => activity.productId);
  const rowByProduct = new Map(productIds.map((productId, index) => [productId, index]));
  const matrix = productIds.map(() => activities.map(() => 0));
  const rhs = productIds.map(() => 0);

  for (const goal of state.goals) {
    const row = rowByProduct.get(goal.productId);
    if (row != null) rhs[row] += goal.rate;
  }
  for (const [productId, credit] of Object.entries(fixedReuseCredits)) {
    const row = rowByProduct.get(productId);
    if (row != null) rhs[row] -= Math.max(0, credit);
  }
  activities.forEach((activity, column) => {
    const recipe = recipes[activity.recipeId];
    for (const output of recipe.outputs) {
      const row = rowByProduct.get(output.id);
      if (row == null) continue;
      if (
        output.id === activity.productId ||
        reusableByproduct(recipe, output.id, state, fixedReuseCredits)
      )
        matrix[row][column] += output.quantity;
    }
    for (const input of recipe.inputs) {
      const row = rowByProduct.get(input.id);
      if (row == null) external.add(input.id);
      else matrix[row][column] -= input.quantity;
    }
  });

  return {
    productIds,
    activities,
    matrix,
    rhs,
    externalProductIds: [...external].sort(),
  };
}

function solveWithReuseActiveSet(model: CanonicalMaterialModel, state: PlanState) {
  const matrix = model.matrix.map((row) => [...row]);
  const surplusColumns = new Set<number>();
  for (let pass = 0; pass <= model.activities.length; pass += 1) {
    const linear = solveNonNegativeLinearSystem(matrix, model.rhs);
    if (linear.status !== 'negative') return { linear, matrix, surplusColumns };
    const column = linear.index;
    const productId = model.activities[column]?.productId;
    if (
      !productId ||
      surplusColumns.has(column) ||
      state.outputDispositions?.[productId]?.type !== 'internal-reuse'
    )
      return { linear, matrix, surplusColumns };

    // The tentative all-reuse solution would require negative production.
    // Disable that production activity and repurpose its column as a
    // non-negative surplus variable in the corresponding balance row.
    for (const row of matrix) row[column] = 0;
    const productRow = model.productIds.indexOf(productId);
    matrix[productRow][column] = -1;
    surplusColumns.add(column);
  }
  return {
    linear: { status: 'singular', rank: 0 } as LinearSolveResult,
    matrix,
    surplusColumns,
  };
}

export function solveCanonicalMaterialModel(
  state: PlanState,
  fixedReuseCredits: Readonly<Record<string, number>> = {}
): CanonicalMaterialSolution {
  const model = buildCanonicalMaterialModel(state, fixedReuseCredits);
  if (!model.activities.length) {
    const externalInputs = Object.fromEntries(
      state.goals.map((goal) => [goal.productId, goal.rate])
    );
    return {
      model,
      linear: { status: 'singular', rank: 0 },
      cyclesByProduct: {},
      ratesByProduct: {},
      externalInputs,
      surplusByProduct: {},
      balanceResiduals: {},
    };
  }
  const activeSet = solveWithReuseActiveSet(model, state);
  const { linear } = activeSet;
  const cyclesByProduct: Record<string, number> = {};
  const ratesByProduct: Record<string, number> = {};
  const externalInputs: Record<string, number> = {};
  const surplusByProduct: Record<string, number> = {};
  const balanceResiduals: Record<string, number> = {};
  if (linear.status !== 'solved') {
    return {
      model,
      linear,
      cyclesByProduct,
      ratesByProduct,
      externalInputs,
      surplusByProduct,
      balanceResiduals,
    };
  }

  model.activities.forEach((activity, index) => {
    const cycles = activeSet.surplusColumns.has(index) ? 0 : linear.solution[index];
    if (activeSet.surplusColumns.has(index))
      surplusByProduct[activity.productId] = linear.solution[index];
    cyclesByProduct[activity.productId] = cycles;
    ratesByProduct[activity.productId] = cycles * activity.primaryOutput;
    const recipe = recipes[activity.recipeId];
    for (const input of recipe.inputs) {
      if (model.productIds.includes(input.id)) continue;
      externalInputs[input.id] = (externalInputs[input.id] || 0) + input.quantity * cycles;
    }
  });
  for (const productId of model.productIds) {
    const row = model.productIds.indexOf(productId);
    const actual = activeSet.matrix[row].reduce(
      (sum, coefficient, column) => sum + coefficient * linear.solution[column],
      0
    );
    balanceResiduals[productId] = model.rhs[row] - actual;
  }
  for (const goal of state.goals) {
    if (!model.productIds.includes(goal.productId))
      externalInputs[goal.productId] = (externalInputs[goal.productId] || 0) + goal.rate;
  }

  return {
    model,
    linear,
    cyclesByProduct,
    ratesByProduct,
    externalInputs,
    surplusByProduct,
    balanceResiduals,
  };
}

export function materialProductName(productId: string) {
  return products[productId]?.name || productId;
}
