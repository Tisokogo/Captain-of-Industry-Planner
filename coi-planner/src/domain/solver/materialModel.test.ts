import { describe, expect, it } from 'vitest';
import { calculate, defaultState, uid } from './planCalculator';
import { solveCanonicalMaterialModel } from './materialModel';

describe('canonical material model', () => {
  it('matches the established default-plan activities and external inputs', () => {
    const state = defaultState();
    const established = calculate(state);
    const exact = solveCanonicalMaterialModel(state);

    expect(exact.linear.status).toBe('solved');
    if (exact.linear.status !== 'solved') return;
    expect(exact.linear.residual).toBeLessThan(1e-8);

    for (const node of established.graphNodes.filter((candidate) => candidate.machines > 0)) {
      expect(exact.ratesByProduct[node.productId], node.productId).toBeCloseTo(node.rate, 6);
    }
    for (const [productId, rate] of Object.entries(established.inputs)) {
      expect(exact.externalInputs[productId] ?? 0, productId).toBeCloseTo(rate, 6);
    }
    expect(Math.max(...Object.values(exact.balanceResiduals).map(Math.abs))).toBeLessThan(1e-8);
  });

  it('merges shared activities for multiple goals into one equation system', () => {
    const state = defaultState();
    state.goals.push({ ...state.goals[0], id: uid(), rate: 8 });
    const exact = solveCanonicalMaterialModel(state);

    expect(exact.linear.status).toBe('solved');
    expect(exact.ratesByProduct[state.goals[0].productId]).toBeCloseTo(20, 8);
    expect(new Set(exact.model.activities.map((activity) => activity.productId)).size).toBe(
      exact.model.activities.length
    );
  });

  it('keeps zero-throughput extraction outside the activity matrix', () => {
    const state = defaultState();
    state.goals = [{ id: 'coal', productId: 'coal', rate: 60 }];
    state.recipeChoices.coal = 'coal_mining';
    const exact = solveCanonicalMaterialModel(state);

    expect(exact.model.productIds).not.toContain('coal');
    expect(exact.externalInputs.coal).toBe(60);
  });
});
