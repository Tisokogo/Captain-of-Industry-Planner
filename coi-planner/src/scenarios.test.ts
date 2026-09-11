import { describe, expect, it } from 'vitest';
import { calculate, defaultState, products } from './domain/solver/planCalculator';

const scenarios = [
  ['Construction Parts I', 'construction_parts', 12],
  ['Construction Parts II', 'construction_parts_ii', 12],
  ['Construction Parts III', 'construction_parts_iii', 12],
  ['Diesel', 'diesel', 24],
  ['Water', 'water', 48],
  ['High-pressure steam', 'steam_high', 24],
  ['Sulfur', 'sulfur', 12],
  ['Electronics III', 'electronics_iii', 6],
] as const;

describe('golden scenario invariants', () => {
  for (const [name, productId, rate] of scenarios) {
    it(`${name} closes its internal demand balance`, () => {
      expect(products[productId], `Missing scenario product ${productId}`).toBeDefined();
      const state = defaultState();
      state.goals = [{ id: `scenario-${productId}`, productId, rate }];
      state.optimization = { ...state.optimization!, enabled: false };

      const result = calculate(state);
      const maximumResidual = Math.max(
        0,
        ...Object.values(result.balanceResiduals).map((value) => Math.abs(value))
      );

      expect(result.graphNodes.length).toBeGreaterThan(0);
      expect(maximumResidual).toBeLessThan(1e-6);
      expect(result.solverWarnings.some((warning) => warning.code === 'solver.jobLimit')).toBe(
        false
      );
    });
  }
});
