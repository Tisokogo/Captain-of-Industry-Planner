import type { CalcResult, OptimizationState, PlanState } from '../../types';
import { isRecipeAllowed, recipeOptions } from '../solver/recipeSelection';
import { calculateCore } from '../solver/materialBalance';

const BEAM_WIDTH = 2;
const EVALUATION_BUDGET = 8;
const MAX_DECISION_NODES = 8;
const EXACT_EVALUATION_BUDGET = 128;
const optimizationCache = new Map<
  string,
  {
    choices: Record<string, string>;
    decisionNodes: number;
    method: 'bounded-beam-search' | 'exact-enumeration';
    optimality: 'heuristic' | 'proven';
    evaluationBudget: number;
  }
>();

export function constraintViolation(result: CalcResult, opt: OptimizationState) {
  let violation = 0;
  const add = (used: number, limit: number | null) => {
    if (limit != null && limit >= 0 && used > limit)
      violation += (used - limit) / Math.max(1, limit);
  };
  add(result.workers, opt.maxWorkers);
  add(result.power, opt.maxPower);
  add(
    result.machines.reduce((sum, machine) => sum + machine.count, 0),
    opt.maxMachines
  );
  add(result.computing, opt.maxComputing);
  add(result.maintenance, opt.maxMaintenance);
  for (const [id, limit] of Object.entries(opt.resourceLimits || {}))
    add(result.inputs[id] || 0, limit);
  return violation;
}

export function globalObjective(result: CalcResult, opt: OptimizationState, state: PlanState) {
  const machinesTotal = result.machines.reduce((sum, machine) => sum + machine.count, 0);
  if (opt.goal === 'minimizeWorkers') return result.workers;
  if (opt.goal === 'minimizePower') return result.power;
  if (opt.goal === 'minimizeMachines') return machinesTotal;
  if (opt.goal === 'minimizeMaintenance') return result.maintenance;
  if (opt.goal === 'minimizeComputing') return result.computing;
  const ratios: number[] = [];
  if (opt.maxWorkers != null) ratios.push(opt.maxWorkers / Math.max(result.workers, 1e-9));
  if (opt.maxPower != null) ratios.push(opt.maxPower / Math.max(result.power, 1e-9));
  if (opt.maxMachines != null) ratios.push(opt.maxMachines / Math.max(machinesTotal, 1e-9));
  if (opt.maxComputing != null) ratios.push(opt.maxComputing / Math.max(result.computing, 1e-9));
  if (opt.maxMaintenance != null)
    ratios.push(opt.maxMaintenance / Math.max(result.maintenance, 1e-9));
  for (const [id, limit] of Object.entries(opt.resourceLimits || {}))
    ratios.push(limit / Math.max(result.inputs[id] || 0, 1e-9));
  const targetRate = state.goals.reduce((sum, goal) => sum + goal.rate, 0);
  return ratios.length
    ? -Math.min(...ratios) * targetRate
    : machinesTotal / Math.max(targetRate, 1e-9);
}

type BeamEntry = {
  choices: Record<string, string>;
  result: CalcResult;
  violation: number;
  objective: number;
  signature: string;
};

const compareEntries = (a: BeamEntry, b: BeamEntry) =>
  a.violation - b.violation || a.objective - b.objective || a.signature.localeCompare(b.signature);

export function calculate(state: PlanState): CalcResult {
  const opt = state.optimization;
  if (!opt?.enabled) return calculateCore(state);

  const cacheKey = JSON.stringify({
    goals: state.goals,
    recipeChoices: state.recipeChoices,
    autoExpandChain: state.autoExpandChain,
    includeByproducts: state.includeByproducts,
    recipeFilter: state.recipeFilter,
    optimization: opt,
  });
  const cached = optimizationCache.get(cacheKey);
  if (cached) {
    const result = calculateCore({ ...state, recipeChoices: cached.choices });
    return {
      ...result,
      optimizationReport: {
        method: cached.method,
        optimality: cached.optimality,
        evaluatedPlans: 0,
        decisionNodes: cached.decisionNodes,
        beamWidth: cached.method === 'exact-enumeration' ? 0 : BEAM_WIDTH,
        evaluationBudget: cached.evaluationBudget,
        constraintViolation: constraintViolation(result, opt),
        objectiveValue: globalObjective(result, opt, state),
        cacheHit: true,
      },
    };
  }

  const manual = new Set(Object.keys(state.recipeChoices));
  const seed = calculateCore(state, false);
  const seedChoices = { ...state.recipeChoices };
  for (const node of seed.graphNodes)
    if (node.recipeId && !manual.has(node.productId)) seedChoices[node.productId] = node.recipeId;

  const allCandidates = seed.graphNodes
    .filter(
      (node) =>
        !manual.has(node.productId) &&
        recipeOptions(node.productId).filter((recipe) =>
          isRecipeAllowed(recipe, state.recipeFilter)
        ).length > 1
    )
    .sort((a, b) => b.rate - a.rate || a.productId.localeCompare(b.productId));
  const optionsByProduct = new Map(
    allCandidates.map((node) => [
      node.productId,
      recipeOptions(node.productId).filter((recipe) => isRecipeAllowed(recipe, state.recipeFilter)),
    ])
  );
  let combinations = 1;
  for (const node of allCandidates)
    combinations = Math.min(
      EXACT_EVALUATION_BUDGET + 1,
      combinations * (optionsByProduct.get(node.productId)?.length || 1)
    );
  const useExactEnumeration = combinations <= EXACT_EVALUATION_BUDGET;
  const candidates = useExactEnumeration
    ? allCandidates
    : allCandidates.slice(0, MAX_DECISION_NODES);

  let evaluatedPlans = 0;
  const evaluate = (choices: Record<string, string>): BeamEntry => {
    const result = calculateCore(
      {
        ...state,
        recipeChoices: choices,
        optimization: { ...opt, enabled: false },
      },
      false
    );
    evaluatedPlans += 1;
    return {
      choices,
      result,
      violation: constraintViolation(result, opt),
      objective: globalObjective(result, opt, state),
      signature: Object.entries(choices)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([product, recipe]) => `${product}:${recipe}`)
        .join('|'),
    };
  };

  let finalists: BeamEntry[];
  if (useExactEnumeration) {
    finalists = [];
    const enumerate = (index: number, choices: Record<string, string>) => {
      if (index >= candidates.length) {
        finalists.push(evaluate(choices));
        return;
      }
      const node = candidates[index];
      for (const recipe of optionsByProduct.get(node.productId) || [])
        enumerate(index + 1, { ...choices, [node.productId]: recipe.id });
    };
    enumerate(0, seedChoices);
  } else {
    let beam = [evaluate(seedChoices)];
    for (const node of candidates) {
      if (evaluatedPlans >= EVALUATION_BUDGET) break;
      const expanded = new Map<string, BeamEntry>();
      for (const entry of beam) {
        for (const recipe of optionsByProduct.get(node.productId) || []) {
          if (evaluatedPlans >= EVALUATION_BUDGET) break;
          const nextChoices = { ...entry.choices, [node.productId]: recipe.id };
          const next = evaluate(nextChoices);
          const previous = expanded.get(next.signature);
          if (!previous || compareEntries(next, previous) < 0) expanded.set(next.signature, next);
        }
      }
      if (expanded.size) beam = [...expanded.values()].sort(compareEntries).slice(0, BEAM_WIDTH);
    }
    finalists = beam;
  }

  const best = [...finalists].sort(compareEntries)[0];
  if (optimizationCache.size >= 64)
    optimizationCache.delete(optimizationCache.keys().next().value!);
  const method = useExactEnumeration ? 'exact-enumeration' : 'bounded-beam-search';
  const optimality = useExactEnumeration ? 'proven' : 'heuristic';
  const evaluationBudget = useExactEnumeration ? EXACT_EVALUATION_BUDGET : EVALUATION_BUDGET;
  optimizationCache.set(cacheKey, {
    choices: best.choices,
    decisionNodes: candidates.length,
    method,
    optimality,
    evaluationBudget,
  });
  const result = calculateCore({ ...state, recipeChoices: best.choices });
  return {
    ...result,
    optimizationReport: {
      method,
      optimality,
      evaluatedPlans,
      decisionNodes: candidates.length,
      beamWidth: useExactEnumeration ? 0 : BEAM_WIDTH,
      evaluationBudget,
      constraintViolation: constraintViolation(result, opt),
      objectiveValue: globalObjective(result, opt, state),
    },
  };
}
