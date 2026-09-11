import { describe, expect, it } from 'vitest';
import { defaultState } from '../../domain/solver/planCalculator';
import { CURRENT_PLAN_VERSION, sanitizeImported } from './planSchema';

describe('plan import schema', () => {
  it('imports a current export', () => {
    const state = defaultState();
    const result = sanitizeImported({
      format: 'harbor-planner',
      version: CURRENT_PLAN_VERSION,
      state,
    });

    expect(result.state.goals).toEqual(state.goals);
    expect(result.report.at(-1)).toContain('1 Ziele');
  });

  it('removes unknown recipes, routes, and sources with a report', () => {
    const state = defaultState();
    const productId = state.goals[0].productId;
    const result = sanitizeImported({
      ...state,
      recipeChoices: { [productId]: 'missing-recipe' },
      outputDispositions: {
        [productId]: { type: 'invalid', amountMode: 'all' },
      },
      externalSources: { [productId]: 'teleport' },
    });

    expect(result.state.recipeChoices).toEqual({});
    expect(result.state.outputDispositions).toEqual({});
    expect(result.state.externalSources).toEqual({});
    expect(result.report.some((line) => line.includes('Rezeptwahl'))).toBe(true);
    expect(result.report.some((line) => line.includes('Ausgangsroute'))).toBe(true);
    expect(result.report.some((line) => line.includes('Herkunft'))).toBe(true);
  });

  it('rejects plans without a valid goal', () => {
    expect(() => sanitizeImported({ goals: [] })).toThrow('PLAN_REQUIRES_VALID_GOAL');
  });

  it('rejects malformed calculation options', () => {
    const state = defaultState();

    expect(() =>
      sanitizeImported({
        ...state,
        autoExpandChain: 'yes',
      })
    ).toThrow('INVALID_PLAN_SCHEMA');
  });

  it('migrates legacy output sinks', () => {
    const state = defaultState();
    const productId = state.goals[0].productId;
    const result = sanitizeImported({
      ...state,
      outputSinks: { [productId]: 'recycle' },
    });

    expect(result.state.outputDispositions?.[productId]).toEqual({
      type: 'internal-reuse',
      amountMode: 'all',
    });
  });
});
