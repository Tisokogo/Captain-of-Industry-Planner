import { describe, expect, it } from 'vitest';
import {
  calculate,
  defaultRecipeFilter,
  defaultState,
  isRecipeAllowed,
  machines,
  products,
  recipeOptions,
  recipes,
  recipeProgression,
} from './planCalculator';
import { encodeState, stateFromHash } from '../../features/import-export/linkCodec';
import { solveCanonicalMaterialModel } from './materialModel';

describe('production calculation invariants', () => {
  it('can restrict active recipes to explicit unlock records', () => {
    const recipe = Object.values(recipes).find((candidate) => recipeProgression[candidate.id]);
    expect(recipe).toBeDefined();

    const filter = { ...defaultRecipeFilter(), onlyUnlockedRecipes: true };
    expect(isRecipeAllowed(recipe!, filter)).toBe(true);
    expect(
      isRecipeAllowed(recipe!, {
        ...filter,
        disabledRecipeIds: [recipe!.id],
      })
    ).toBe(false);
  });

  it('calculates the default plan deterministically without negative rates', () => {
    const state = defaultState();
    const first = calculate(state);
    const second = calculate(state);

    expect(second).toEqual(first);
    expect(first.graphNodes.length).toBeGreaterThan(0);
    expect(first.solverMethod).toBe('exact-linear');
    expect(first.solverResidual).toBeLessThan(1e-8);
    expect(first.machines.every((machine) => machine.count >= 0)).toBe(true);
    expect(Object.values(first.inputs).every((rate) => rate >= 0)).toBe(true);
    const worstBalance = Object.entries(first.balanceResiduals).sort(
      (a, b) => Math.abs(b[1]) - Math.abs(a[1])
    )[0];
    expect(worstBalance, JSON.stringify(worstBalance)).toSatisfy(
      ([, residual]) => Math.abs(residual) < 1e-6
    );

    for (const productId of Object.keys(first.grossSurplus)) {
      expect(
        (first.assignedSurplus[productId] ?? 0) + (first.openSurplus[productId] ?? 0)
      ).toBeCloseTo(first.grossSurplus[productId] ?? 0, 7);
    }
  });

  it('turns unavailable goal recipes into an external input', () => {
    const state = defaultState();
    const goalProduct = state.goals[0].productId;
    const disabledRecipeIds = recipeOptions(goalProduct).map((recipe) => recipe.id);
    state.recipeFilter = { ...defaultRecipeFilter(), disabledRecipeIds };

    const result = calculate(state);
    const goalNode = result.graphNodes.find((node) => node.productId === goalProduct);

    expect(goalNode?.external).toBe(true);
    expect(result.inputs[goalProduct]).toBeCloseTo(state.goals[0].rate, 7);
  });

  it('keeps mine throughput external without producing a capacity warning', () => {
    const state = defaultState();
    state.goals = [{ id: 'coal-goal', productId: 'coal', rate: 60 }];
    state.recipeChoices.coal = 'coal_mining';

    const result = calculate(state);

    expect(result.inputs.coal).toBe(60);
    expect(result.machines.some((machine) => machine.recipeId === 'coal_mining')).toBe(false);
    expect(result.solverWarnings.some((warning) => warning.code === 'data.unknownCapacity')).toBe(
      false
    );
  });

  it('solves an unconstrained water/steam byproduct cycle with the exact linear model', () => {
    const state = defaultState();
    state.goals = [{ id: 'sulfur-goal', productId: 'sulfur', rate: 12 }];
    state.recipeChoices = {
      sulfur: 'sour_water_stripping_recovery',
      steam_high: 'steam_generation',
      water: 'rainwater_harvester',
    };
    state.outputDispositions = {
      water: { type: 'internal-reuse', amountMode: 'all' },
    };

    const exact = solveCanonicalMaterialModel(state);
    const result = calculate(state);

    expect(exact.linear.status, JSON.stringify(exact.model)).toBe('solved');
    expect(result.solverMethod).toBe('exact-linear');
    expect(result.solverResidual).toBeLessThan(1e-8);
    expect(
      result.outputRoutes.some((route) => route.type === 'internal-reuse' && route.rate > 0)
    ).toBe(true);
    const waterRoutes = result.outputRoutes.filter((route) => route.productId === 'water');
    expect(result.graphNodes.find((node) => node.productId === 'water')?.rate).toBeCloseTo(
      result.grossSurplus.water,
      8
    );
    expect(
      result.graphEdges.some(
        (edge) => edge.kind === 'sink' && edge.from === 'water' && edge.to.includes('remainder')
      )
    ).toBe(true);
    expect(waterRoutes.reduce((sum, route) => sum + route.rate, 0)).toBeCloseTo(
      result.grossSurplus.water,
      8
    );
  });

  it('solves a capped consumer-specific reuse constraint with an exact inner system', () => {
    const state = defaultState();
    state.goals = [{ id: 'sulfur-goal', productId: 'sulfur', rate: 12 }];
    state.recipeChoices = {
      sulfur: 'sour_water_stripping_recovery',
      steam_high: 'steam_generation',
      water: 'rainwater_harvester',
    };
    state.outputDispositions = {
      water: {
        type: 'internal-reuse',
        amountMode: 'capped',
        maxRate: 2,
        consumerProductId: 'steam_high',
        consumerRecipeId: 'steam_generation',
      },
    };

    const result = calculate(state);
    const reused = result.outputRoutes.find((route) => route.type === 'internal-reuse');
    expect(result.solverMethod).toBe('exact-linear-constrained');
    expect(result.solverResidual).toBeLessThan(1e-7);
    expect(reused?.rate).toBeCloseTo(2, 7);
  });

  it('expands the complete Construction Parts IV chain instead of externalizing intermediates', () => {
    const state = defaultState();
    state.goals = [{ id: 'cp4-goal', productId: 'construction_parts_iv', rate: 12 }];

    const result = calculate(state);

    for (const productId of ['electronics_ii', 'electronics', 'steel']) {
      const node = result.graphNodes.find((candidate) => candidate.productId === productId);
      expect(node, productId).toBeDefined();
      expect(node?.external, productId).toBe(false);
      expect(node?.recipeId, productId).toBeTruthy();
      expect(result.inputs[productId] || 0, productId).toBe(0);
    }
  });

  it('assigns unavoidable pollution automatically as an emission', () => {
    const state = defaultState();
    state.goals = [{ id: 'sulfur-goal', productId: 'sulfur', rate: 12 }];
    state.recipeChoices.sulfur = 'sour_water_stripping_recovery';
    state.outputDispositions = {
      ammonia: { type: 'flare', amountMode: 'all', recipeId: 'ammonia_disposal' },
    };
    const result = calculate(state);
    expect(result.outputRoutes.find((route) => route.productId === 'ammonia')).toMatchObject({
      type: 'flare',
      recipeId: 'ammonia_disposal',
      valid: true,
    });
    expect(result.outputRoutes.find((route) => route.productId === 'air_pollution')).toMatchObject({
      type: 'emission',
      valid: true,
    });
    expect(result.openSurplus.air_pollution || 0).toBe(0);
  });

  it('reports the bounded heuristic optimization search transparently', () => {
    const state = defaultState();
    state.optimization = {
      enabled: true,
      goal: 'minimizeWorkers',
      maxWorkers: null,
      maxPower: null,
      maxMachines: null,
      maxComputing: null,
      maxMaintenance: null,
      resourceLimits: {},
    };

    const result = calculate(state);

    expect(result.optimizationReport).toMatchObject({
      method: 'bounded-beam-search',
      optimality: 'heuristic',
      beamWidth: 2,
      evaluationBudget: 8,
    });
    expect(result.optimizationReport!.evaluatedPlans).toBeLessThanOrEqual(8);
    expect(result.optimizationReport!.constraintViolation).toBeGreaterThanOrEqual(0);

    const routeOnlyChange = calculate({
      ...state,
      outputDispositions: {
        carbon_dioxide: { type: 'unassigned', amountMode: 'all' },
      },
    });
    expect(routeOnlyChange.optimizationReport).toMatchObject({
      cacheHit: true,
      evaluatedPlans: 0,
    });
  });

  it('proves the optimum when every active recipe combination fits the exact budget', () => {
    const state = defaultState();
    const recipeChoices = Object.fromEntries(
      Object.keys(products).flatMap((productId) => {
        const recipe = recipeOptions(productId)[0];
        return recipe ? [[productId, recipe.id] as const] : [];
      })
    );
    const exact = calculate({
      ...state,
      recipeChoices,
      optimization: { ...state.optimization!, enabled: true },
    });

    expect(exact.optimizationReport).toMatchObject({
      method: 'exact-enumeration',
      optimality: 'proven',
    });
  });

  it('stops expanding upstream recipes when auto expansion is disabled', () => {
    const state = defaultState();
    state.autoExpandChain = false;
    const result = calculate(state);
    const goalProduct = state.goals[0].productId;

    expect(result.graphNodes.find((node) => node.productId === goalProduct)?.external).toBe(false);
    expect(Object.keys(result.inputs).length).toBeGreaterThan(0);
  });
});

describe('data integrity', () => {
  it('contains all products and machines referenced by recipes', () => {
    for (const recipe of Object.values(recipes)) {
      expect(machines[recipe.machine], `${recipe.id} references ${recipe.machine}`).toBeDefined();
      for (const item of [...recipe.inputs, ...recipe.outputs]) {
        expect(products[item.id], `${recipe.id} references ${item.id}`).toBeDefined();
      }
    }
  });
});

describe('shared-link codec', () => {
  it('round-trips UTF-8 plan state and keeps the compressed prefix', () => {
    const state = defaultState();
    state.outputDispositions = {
      test: { type: 'unassigned', amountMode: 'all', note: 'Grüße 世界' },
    };

    const encoded = encodeState(state);
    expect(encoded.startsWith('z')).toBe(true);
    window.location.hash = `#p=${encoded}`;

    expect(stateFromHash()).toEqual(state);
  });
});
