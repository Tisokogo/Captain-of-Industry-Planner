import { describe, expect, it } from 'vitest';
import { calculate, defaultState, uid } from '../../domain/solver/planCalculator';
import { decomposeResultByGoal } from './goalDecomposition';

const edgeKey = (edge: { kind: string; from: string; to: string; goalId?: string }) =>
  `${edge.kind}:${edge.from}:${edge.to}:${edge.goalId ?? ''}`;
const routeKey = (route: { routeId: string }) => route.routeId;

describe('per-goal flow decomposition', () => {
  it('conserves every global node and edge rate', () => {
    const state = defaultState();
    state.goals.push({ ...state.goals[0], id: uid(), rate: 8 });
    const global = calculate(state);
    const allocations = decomposeResultByGoal(global, state);

    expect(allocations).toHaveLength(2);
    for (const node of global.graphNodes) {
      const allocated = allocations.reduce(
        (sum, allocation) =>
          sum +
          (allocation.result.graphNodes.find((candidate) => candidate.productId === node.productId)
            ?.rate || 0),
        0
      );
      expect(allocated, node.productId).toBeCloseTo(node.rate, 8);
    }
    for (const edge of global.graphEdges) {
      const key = edgeKey(edge);
      const allocated = allocations.reduce(
        (sum, allocation) =>
          sum +
          (allocation.result.graphEdges.find((candidate) => edgeKey(candidate) === key)?.rate || 0),
        0
      );
      expect(allocated, key).toBeCloseTo(edge.rate, 8);
    }
    for (const route of global.outputRoutes) {
      const key = routeKey(route);
      const allocated = allocations.reduce(
        (sum, allocation) =>
          sum +
          (allocation.result.outputRoutes.find((candidate) => routeKey(candidate) === key)?.rate ||
            0),
        0
      );
      expect(allocated, key).toBeCloseTo(route.rate, 8);
    }
  });

  it('uses documented goal-rate weights for shared activities', () => {
    const state = defaultState();
    state.goals = [
      { ...state.goals[0], id: 'goal-a', rate: 12 },
      { ...state.goals[0], id: 'goal-b', rate: 8 },
    ];
    const global = calculate(state);
    const allocations = decomposeResultByGoal(global, state);
    const productId = state.goals[0].productId;
    const rateA = allocations[0].result.graphNodes.find(
      (node) => node.productId === productId
    )!.rate;
    const rateB = allocations[1].result.graphNodes.find(
      (node) => node.productId === productId
    )!.rate;

    expect(rateA / rateB).toBeCloseTo(12 / 8, 8);
    expect(rateA + rateB).toBeCloseTo(
      global.graphNodes.find((node) => node.productId === productId)!.rate,
      8
    );
  });
});
