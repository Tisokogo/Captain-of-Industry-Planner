import type { CalcResult, Goal, PlanState } from '../../types';

export type GoalFlowAllocation = {
  goal: Goal;
  result: CalcResult;
};

function relevantProducts(result: CalcResult, goal: Goal) {
  const keep = new Set<string>([goal.productId]);
  const upstream = [goal.productId];
  while (upstream.length) {
    const consumer = upstream.shift()!;
    for (const edge of result.graphEdges) {
      if (edge.to !== consumer || !['input', 'reuse'].includes(edge.kind)) continue;
      if (edge.from.startsWith('sink:') || edge.from.startsWith('goal:') || keep.has(edge.from))
        continue;
      keep.add(edge.from);
      upstream.push(edge.from);
    }
  }

  // Attribute byproducts created by this goal's upstream activities as well.
  const downstream = [...keep];
  while (downstream.length) {
    const producer = downstream.shift()!;
    for (const edge of result.graphEdges) {
      if (edge.from !== producer || edge.kind !== 'byproduct' || keep.has(edge.to)) continue;
      if (edge.to.startsWith('sink:') || edge.to.startsWith('goal:')) continue;
      keep.add(edge.to);
      downstream.push(edge.to);
    }
  }
  return keep;
}

/**
 * Proportionally attributes every globally solved rate to relevant goals.
 * Shared activities use goal-rate weights. The allocations are conservative:
 * summing all goal shares reproduces each global node, edge, and route rate.
 */
export function decomposeResultByGoal(
  result: CalcResult,
  state: Pick<PlanState, 'goals'>
): GoalFlowAllocation[] {
  const relevance = new Map(state.goals.map((goal) => [goal.id, relevantProducts(result, goal)]));
  const eligibleGoals = (productId: string) =>
    state.goals.filter((goal) => relevance.get(goal.id)?.has(productId));
  const share = (goal: Goal, eligible: Goal[]) => {
    const total = eligible.reduce((sum, candidate) => sum + Math.max(0, candidate.rate), 0);
    return total > 0 ? Math.max(0, goal.rate) / total : 1 / Math.max(1, eligible.length);
  };

  return state.goals.map((goal) => {
    const keep = relevance.get(goal.id)!;
    const graphNodes = result.graphNodes
      .filter((node) => keep.has(node.productId))
      .map((node) => {
        const eligible = eligibleGoals(node.productId);
        return { ...node, rate: node.rate * share(goal, eligible) };
      });
    const graphEdges = result.graphEdges
      .filter((edge) => {
        if (edge.kind === 'goal') return edge.goalId === goal.id;
        if (edge.from.startsWith('sink:') || edge.from.startsWith('goal:')) return false;
        if (!keep.has(edge.from)) return false;
        return edge.to.startsWith('sink:') || edge.to.startsWith('goal:') || keep.has(edge.to);
      })
      .map((edge) => {
        if (edge.kind === 'goal') return { ...edge };
        const eligible = eligibleGoals(edge.from).filter((candidate) => {
          const candidateKeep = relevance.get(candidate.id)!;
          return (
            edge.to.startsWith('sink:') || edge.to.startsWith('goal:') || candidateKeep.has(edge.to)
          );
        });
        return { ...edge, rate: edge.rate * share(goal, eligible) };
      });
    const outputRoutes = result.outputRoutes
      .filter((route) => keep.has(route.productId))
      .map((route) => {
        const eligible = eligibleGoals(route.productId);
        return { ...route, rate: route.rate * share(goal, eligible) };
      });

    return {
      goal,
      result: { ...result, graphNodes, graphEdges, outputRoutes },
    };
  });
}
