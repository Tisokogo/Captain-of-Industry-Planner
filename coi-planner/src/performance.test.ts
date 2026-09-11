import { describe, expect, it } from 'vitest';
import { calculate, defaultState, products } from './domain/solver/planCalculator';
import { buildDiagramModel } from './features/diagram/diagramModel';

describe('calculation performance budget', () => {
  it('keeps the warmed default calculation below the 50 ms p95 core budget', () => {
    const state = defaultState();
    calculate(state);

    const samples: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const start = performance.now();
      calculate(state);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1];

    expect(
      p95,
      `default samples: ${samples.map((value) => value.toFixed(2)).join(', ')}`
    ).toBeLessThan(50);
  });

  it('keeps indexed diagram-model generation below a 50 ms p95 budget', () => {
    const state = defaultState();
    const result = calculate(state);
    buildDiagramModel(result, state, 'Goal output');
    const samples = Array.from({ length: 8 }, () => {
      const start = performance.now();
      buildDiagramModel(result, state, 'Goal output');
      return performance.now() - start;
    }).sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
    expect(p95).toBeLessThan(50);
  });

  it('keeps a shared multi-goal endgame plan below the 150 ms p95 core budget', () => {
    const state = defaultState();
    const productIds = [
      'construction_parts_iii',
      'electronics_iii',
      'air_separation_unit',
      'vehicle_parts_ii',
      'server',
      'microchip',
    ].filter((productId) => products[productId]);
    state.goals = productIds.map((productId, index) => ({
      id: `performance-goal-${index}`,
      productId,
      rate: 12 + index * 3,
    }));
    calculate(state);

    const samples = Array.from({ length: 5 }, () => {
      const start = performance.now();
      calculate(state);
      return performance.now() - start;
    }).sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1];

    expect(p95).toBeLessThan(150);
  });
});
