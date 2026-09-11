import { machines, productCapabilities, products, recipes } from '../data/gameData';
import { availableDispositions, bestRecipe } from './recipeSelection';
import { solveCanonicalMaterialModel } from './materialModel';
import type {
  CalcResult,
  Diagnostic,
  ExternalAssumptionCode,
  MachineTotal,
  OutputDispositionType,
  PlanState,
  Recipe,
} from '../../types';

export function calculateCore(state: PlanState, applyAutomaticDispositions = true): CalcResult {
  type Edge = CalcResult['graphEdges'][number];
  type CreditRule = {
    rate: number;
    consumerProductId?: string;
    consumerRecipeId?: string;
    targetProductId?: string;
  };
  type Run = {
    machineMap: Map<string, MachineTotal>;
    inputs: Record<string, number>;
    outputs: Record<string, number>;
    demand: Record<string, number>;
    edges: Map<string, Edge>;
    reused: Record<string, number>;
    activity: Record<string, { rate: number; machines: number; recipeId: string }>;
    unknownCapacityProducts: Set<string>;
    solverMethod: 'exact-linear' | 'exact-linear-constrained' | 'iterative-fallback';
    exactResidual: number;
    jobLimitHit: boolean;
  };
  const run = (creditSeed: Record<string, CreditRule>): Run => {
    const machineMap = new Map<string, MachineTotal>(),
      inputs: Record<string, number> = {},
      outputs: Record<string, number> = {},
      demand: Record<string, number> = {},
      reused: Record<string, number> = {},
      activity: Record<string, { rate: number; machines: number; recipeId: string }> = {},
      unknownCapacityProducts = new Set<string>(),
      edges = new Map<string, Edge>(),
      credits = Object.fromEntries(Object.entries(creditSeed).map(([id, r]) => [id, { ...r }]));
    const addEdge = (
      from: string,
      to: string,
      rate: number,
      kind: Edge['kind'],
      goalId?: string,
      label?: string
    ) => {
      const key = `${kind}:${from}:${to}:${goalId || ''}`;
      const old = edges.get(key);
      if (old) old.rate += rate;
      else edges.set(key, { from, to, rate, kind, goalId, label });
    };
    const addMachine = (recipe: Recipe, count: number) => {
      const m = machines[recipe.machine],
        old = machineMap.get(recipe.id);
      machineMap.set(recipe.id, {
        machineId: recipe.machine,
        recipeId: recipe.id,
        count: (old?.count || 0) + count,
        power:
          (old?.power || 0) +
          ((m?.electricity_consumed || 0) - (m?.electricity_generated || 0)) * count,
        workers: (old?.workers || 0) + (m?.workers || 0) * count,
      });
    };
    {
      const fixedReuseCredits = Object.fromEntries(
        Object.entries(creditSeed).map(([productId, rule]) => [productId, rule.rate])
      );
      const exact = solveCanonicalMaterialModel(state, fixedReuseCredits);
      const creditsRepresented = Object.keys(fixedReuseCredits).every((productId) =>
        exact.model.productIds.includes(productId)
      );
      if (exact.linear.status === 'solved' && creditsRepresented) {
        for (const goal of state.goals) {
          demand[goal.productId] = (demand[goal.productId] || 0) + goal.rate;
          addEdge(goal.productId, `goal:${goal.id}`, goal.rate, 'goal', goal.id);
        }
        for (const modelActivity of exact.model.activities) {
          const recipe = recipes[modelActivity.recipeId],
            cycles = exact.cyclesByProduct[modelActivity.productId] || 0,
            rate = exact.ratesByProduct[modelActivity.productId] || 0,
            count = (cycles * recipe.duration) / 60;
          if (rate <= 1e-8) continue;
          addMachine(recipe, count);
          activity[modelActivity.productId] = {
            rate,
            machines: count,
            recipeId: recipe.id,
          };
          for (const input of recipe.inputs) {
            const amount = input.quantity * cycles;
            demand[input.id] = (demand[input.id] || 0) + amount;
            addEdge(input.id, modelActivity.productId, amount, 'input');
            if (!(input.id in exact.ratesByProduct))
              inputs[input.id] = (inputs[input.id] || 0) + amount;
          }
          if (state.includeByproducts !== false)
            for (const output of recipe.outputs)
              if (output.id !== modelActivity.productId) {
                const amount = output.quantity * cycles;
                outputs[output.id] = (outputs[output.id] || 0) + amount;
                addEdge(modelActivity.productId, output.id, amount, 'byproduct');
              }
        }
        for (const [productId, grossOutput] of Object.entries(outputs)) {
          if (state.outputDispositions?.[productId]?.type !== 'internal-reuse') continue;
          let remaining = Math.min(
            grossOutput,
            Math.max(
              0,
              (demand[productId] || 0) - (activity[productId]?.rate || 0) - (inputs[productId] || 0)
            )
          );
          if (remaining <= 1e-8) continue;
          reused[productId] = remaining;
          const creditRule = creditSeed[productId];
          for (const goal of state.goals) {
            if (
              goal.productId !== productId ||
              remaining <= 1e-8 ||
              (creditRule?.targetProductId && goal.productId !== creditRule.targetProductId) ||
              creditRule?.consumerProductId ||
              creditRule?.consumerRecipeId
            )
              continue;
            const amount = Math.min(goal.rate, remaining);
            addEdge(
              productId,
              `goal:${goal.id}`,
              amount,
              'reuse',
              goal.id,
              'Interne Wiederverwendung'
            );
            remaining -= amount;
          }
          for (const consumer of exact.model.activities) {
            if (remaining <= 1e-8) break;
            if (
              (creditRule?.consumerProductId &&
                consumer.productId !== creditRule.consumerProductId) ||
              (creditRule?.consumerRecipeId && consumer.recipeId !== creditRule.consumerRecipeId) ||
              creditRule?.targetProductId
            )
              continue;
            const requested =
              recipes[consumer.recipeId].inputs.find((input) => input.id === productId)?.quantity ||
              0;
            if (requested <= 0) continue;
            const amount = Math.min(
              requested * (exact.cyclesByProduct[consumer.productId] || 0),
              remaining
            );
            addEdge(
              productId,
              consumer.productId,
              amount,
              'reuse',
              undefined,
              'Interne Wiederverwendung'
            );
            remaining -= amount;
          }
        }
        for (const goal of state.goals)
          if (!(goal.productId in exact.ratesByProduct))
            inputs[goal.productId] = (inputs[goal.productId] || 0) + goal.rate;
        for (const productId of exact.model.externalProductIds) {
          const recipe = bestRecipe(
            productId,
            state.recipeChoices,
            state.recipeFilter,
            state.optimization
          );
          const quantity = recipe?.outputs.find((output) => output.id === productId)?.quantity;
          if (recipe && quantity === 0) unknownCapacityProducts.add(productId);
        }
        return {
          machineMap,
          inputs,
          outputs,
          demand,
          edges,
          reused,
          activity,
          unknownCapacityProducts,
          solverMethod:
            Object.keys(creditSeed).length > 0 ? 'exact-linear-constrained' : 'exact-linear',
          exactResidual: exact.linear.residual,
          jobLimitHit: false,
        };
      }
    }
    type Job = { id: string; rate: number; path: Set<string>; consumer: string };
    const queue: Job[] = [];
    for (const goal of state.goals) {
      demand[goal.productId] = (demand[goal.productId] || 0) + goal.rate;
      queue.push({
        id: goal.productId,
        rate: goal.rate,
        path: new Set(),
        consumer: `goal:${goal.id}`,
      });
      addEdge(goal.productId, `goal:${goal.id}`, goal.rate, 'goal', goal.id);
    }
    let cursor = 0;
    while (cursor < queue.length && cursor < 20000) {
      const job = queue[cursor++];
      let rate = job.rate;
      const rule = credits[job.id];
      const goal = job.consumer.startsWith('goal:')
        ? state.goals.find((g) => `goal:${g.id}` === job.consumer)
        : undefined;
      const consumerRecipe = !job.consumer.startsWith('goal:')
        ? bestRecipe(job.consumer, state.recipeChoices, state.recipeFilter, state.optimization)?.id
        : undefined;
      const targetMatches = !rule?.targetProductId || goal?.productId === rule.targetProductId;
      const consumerMatches = !rule?.consumerProductId || job.consumer === rule.consumerProductId;
      const recipeMatches = !rule?.consumerRecipeId || consumerRecipe === rule.consumerRecipeId;
      const credit =
        rule && targetMatches && consumerMatches && recipeMatches ? Math.min(rate, rule.rate) : 0;
      if (credit > 1e-8) {
        rule.rate -= credit;
        reused[job.id] = (reused[job.id] || 0) + credit;
        addEdge(job.id, job.consumer, credit, 'reuse', undefined, 'Interne Wiederverwendung');
        rate -= credit;
      }
      if (rate <= 1e-8) continue;
      if (state.autoExpandChain === false && job.path.size > 0) {
        inputs[job.id] = (inputs[job.id] || 0) + rate;
        continue;
      }
      const recipe = bestRecipe(
        job.id,
        state.recipeChoices,
        state.recipeFilter,
        state.optimization
      );
      if (!recipe || job.path.has(job.id)) {
        inputs[job.id] = (inputs[job.id] || 0) + rate;
        continue;
      }
      const qty = recipe.outputs.find((x) => x.id === job.id)?.quantity;
      if (qty == null || qty <= 0) {
        unknownCapacityProducts.add(job.id);
        inputs[job.id] = (inputs[job.id] || 0) + rate;
        continue;
      }
      const cycles = rate / qty,
        count = (cycles * recipe.duration) / 60;
      addMachine(recipe, count);
      const a = activity[job.id];
      activity[job.id] = {
        rate: (a?.rate || 0) + rate,
        machines: (a?.machines || 0) + count,
        recipeId: recipe.id,
      };
      const next = new Set(job.path);
      next.add(job.id);
      for (const item of recipe.inputs) {
        const amount = item.quantity * cycles;
        demand[item.id] = (demand[item.id] || 0) + amount;
        addEdge(item.id, job.id, amount, 'input');
        queue.push({ id: item.id, rate: amount, path: next, consumer: job.id });
      }
      if (state.includeByproducts !== false)
        for (const item of recipe.outputs)
          if (item.id !== job.id) {
            const amount = item.quantity * cycles;
            outputs[item.id] = (outputs[item.id] || 0) + amount;
            addEdge(job.id, item.id, amount, 'byproduct');
          }
    }
    return {
      machineMap,
      inputs,
      outputs,
      demand,
      edges,
      reused,
      activity,
      unknownCapacityProducts,
      solverMethod: 'iterative-fallback',
      exactResidual: Number.NaN,
      jobLimitHit: cursor < queue.length,
    };
  };
  // Material-balance solver. Reuse feedback is solved as a damped fixed point;
  // targeted/capped credits are applied only to their selected consumer. This is
  // stable for SCCs (water/steam/recycling loops) and reports non-convergence.
  const requiresReuseIteration = Object.values(state.outputDispositions || {}).some(
    (disposition) =>
      disposition.type === 'internal-reuse' &&
      (disposition.amountMode === 'capped' ||
        !!disposition.consumerProductId ||
        !!disposition.consumerRecipeId ||
        !!disposition.targetProductId)
  );
  let current = run({}),
    converged = !requiresReuseIteration,
    residual = requiresReuseIteration ? Infinity : current.exactResidual;
  const creditRates: Record<string, number> = {};
  // Tarjan decomposition of the active material dependency graph. Cyclic SCCs
  // receive damping; acyclic components are solved directly in one update.
  const active = new Set(Object.keys(current.demand)),
    adj = new Map<string, string[]>();
  for (const id of active) {
    const r = bestRecipe(id, state.recipeChoices, state.recipeFilter, state.optimization);
    adj.set(
      id,
      (r?.inputs || []).map((x) => x.id).filter((x) => active.has(x))
    );
  }
  const index = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    onStack = new Set<string>(),
    cyclic = new Set<string>();
  let serial = 0;
  const visit = (v: string) => {
    index.set(v, serial);
    low.set(v, serial++);
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) || [])
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1 || (adj.get(v) || []).includes(v))
        component.forEach((x) => cyclic.add(x));
    }
  };
  active.forEach((v) => {
    if (!index.has(v)) visit(v);
  });
  for (let iteration = 0; requiresReuseIteration && iteration < 80; iteration++) {
    const rules: Record<string, CreditRule> = {};
    for (const [id, amount] of Object.entries(current.outputs)) {
      const d = state.outputDispositions?.[id];
      if (d?.type !== 'internal-reuse') continue;
      const wanted = Math.min(
          amount,
          current.demand[id] || 0,
          d?.amountMode === 'capped' ? Math.max(0, d.maxRate || 0) : amount
        ),
        damping = cyclic.has(id) ? 0.5 : 1;
      const solved =
        iteration === 0 ? wanted : (creditRates[id] || 0) * (1 - damping) + wanted * damping;
      creditRates[id] = solved;
      rules[id] = {
        rate: solved,
        consumerProductId: d?.consumerProductId,
        consumerRecipeId: d?.consumerRecipeId,
        targetProductId: d?.targetProductId,
      };
    }
    const next = run(rules);
    const ids = new Set([
      ...Object.keys(current.outputs),
      ...Object.keys(next.outputs),
      ...Object.keys(current.reused),
      ...Object.keys(next.reused),
      ...Object.keys(current.inputs),
      ...Object.keys(next.inputs),
      ...Object.keys(current.demand),
      ...Object.keys(next.demand),
      ...Object.keys(current.activity),
      ...Object.keys(next.activity),
    ]);
    residual = 0;
    for (const id of ids)
      residual = Math.max(
        residual,
        Math.abs((current.outputs[id] || 0) - (next.outputs[id] || 0)),
        Math.abs((current.reused[id] || 0) - (next.reused[id] || 0)),
        Math.abs((current.inputs[id] || 0) - (next.inputs[id] || 0)),
        Math.abs((current.demand[id] || 0) - (next.demand[id] || 0)),
        Math.abs((current.activity[id]?.rate || 0) - (next.activity[id]?.rate || 0)),
        Math.abs((current.activity[id]?.machines || 0) - (next.activity[id]?.machines || 0))
      );
    current = next;
    if (residual < 1e-7) {
      converged = true;
      break;
    }
  }
  const {
    machineMap,
    inputs,
    outputs,
    demand,
    edges,
    reused,
    activity,
    unknownCapacityProducts,
    solverMethod,
    exactResidual,
    jobLimitHit,
  } = current;
  const warnings: Diagnostic[] = [],
    solverWarnings: Diagnostic[] = [];
  if (
    !converged &&
    Object.values(state.outputDispositions || {}).some((d) => d.type === 'internal-reuse')
  )
    solverWarnings.push({ code: 'solver.nonConverged', params: { residual } });
  if (jobLimitHit) solverWarnings.push({ code: 'solver.jobLimit', params: { limit: 20000 } });
  const addMachine = (recipe: Recipe, count: number) => {
    const m = machines[recipe.machine],
      old = machineMap.get(recipe.id);
    machineMap.set(recipe.id, {
      machineId: recipe.machine,
      recipeId: recipe.id,
      count: (old?.count || 0) + count,
      power:
        (old?.power || 0) +
        ((m?.electricity_consumed || 0) - (m?.electricity_generated || 0)) * count,
      workers: (old?.workers || 0) + (m?.workers || 0) * count,
    });
  };
  const expandExtra = (id: string, rate: number, path: Set<string>, consumer: string) => {
    if (rate <= 1e-8) return;
    demand[id] = (demand[id] || 0) + rate;
    const recipe = bestRecipe(id, state.recipeChoices, state.recipeFilter, state.optimization);
    if (state.autoExpandChain === false || !recipe || path.has(id)) {
      inputs[id] = (inputs[id] || 0) + rate;
      edges.set(`routeinput:${id}:${consumer}`, { from: id, to: consumer, rate, kind: 'input' });
      return;
    }
    const qty = recipe.outputs.find((x) => x.id === id)?.quantity;
    if (qty == null || qty <= 0) {
      unknownCapacityProducts.add(id);
      inputs[id] = (inputs[id] || 0) + rate;
      edges.set(`routeinput:${id}:${consumer}`, { from: id, to: consumer, rate, kind: 'input' });
      return;
    }
    const cycles = rate / qty;
    const machineCount = (cycles * recipe.duration) / 60;
    addMachine(recipe, machineCount);
    const existingActivity = activity[id];
    activity[id] = {
      rate: (existingActivity?.rate || 0) + rate,
      machines: (existingActivity?.machines || 0) + machineCount,
      recipeId: recipe.id,
    };
    edges.set(`routeinput:${id}:${consumer}`, { from: id, to: consumer, rate, kind: 'input' });
    const next = new Set(path);
    next.add(id);
    for (const item of recipe.inputs) expandExtra(item.id, item.quantity * cycles, next, id);
    if (state.includeByproducts !== false)
      for (const item of recipe.outputs)
        if (item.id !== id) outputs[item.id] = (outputs[item.id] || 0) + item.quantity * cycles;
  };
  const outputRoutes: CalcResult['outputRoutes'] = [];
  const assignedSurplus: Record<string, number> = { ...reused };
  const processed = new Set<string>();
  let routePass = 0,
    routesConverged = false;
  while (routePass++ < 32) {
    let changed = false;
    for (const [id, gross] of Object.entries({ ...outputs })) {
      if (processed.has(id)) continue;
      const available = Math.max(0, gross - (reused[id] || 0));
      const disposition = state.outputDispositions?.[id] || {
        type: 'unassigned' as OutputDispositionType,
        amountMode: 'all' as const,
      };
      if (disposition.type === 'internal-reuse' && (reused[id] || 0) > 0) {
        outputRoutes.push({
          routeId: `reuse:${id}`,
          productId: id,
          type: 'internal-reuse',
          rate: Math.min(gross, reused[id] || 0),
          label: 'Interne Wiederverwendung',
          valid: true,
        });
        if (available > 1e-8) {
          outputRoutes.push({
            routeId: `sink:${id}:remainder`,
            productId: id,
            type: 'unassigned',
            rate: available,
            label: 'Nicht zugewiesener Rest',
            valid: true,
          });
          edges.set(`sink:${id}:remainder`, {
            from: id,
            to: `sink:${id}:remainder`,
            rate: available,
            kind: 'sink',
            label: 'Nicht zugewiesener Rest',
          });
        }
        processed.add(id);
        continue;
      }
      if (available <= 1e-8) {
        processed.add(id);
        continue;
      }
      if (id === 'air_pollution' || id === 'water_pollution') {
        const label = id === 'air_pollution' ? 'Air emission' : 'Water emission';
        outputRoutes.push({
          routeId: `sink:${id}:emission`,
          productId: id,
          type: 'emission',
          rate: available,
          label,
          valid: true,
        });
        assignedSurplus[id] = (assignedSurplus[id] || 0) + available;
        edges.set(`sink:${id}:emission`, {
          from: id,
          to: `sink:${id}:emission`,
          rate: available,
          kind: 'sink',
          label,
        });
        processed.add(id);
        continue;
      }
      const options = availableDispositions(id, state, (demand[id] || 0) > 0),
        option = options.find((x) => x.type === disposition.type);
      let type = disposition.type;
      const valid = !!option;
      if (!valid && type !== 'unassigned') {
        warnings.push({
          code: 'route.invalidDisposition',
          params: { productId: id, product: products[id]?.name || id },
        });
        type = 'unassigned';
      }
      const amount =
        disposition.amountMode === 'capped'
          ? Math.min(available, disposition.maxRate || 0)
          : available;
      let label = options.find((x) => x.type === type)?.label || 'Nicht festgelegt',
        routeRecipe: Recipe | undefined;
      if (valid && (type === 'storage' || type === 'export')) {
        const facility =
          option?.routes.find((r) => r.id === disposition.facilityId) || option?.routes[0];
        if (facility) label = `${label}: ${machines[facility.machine]?.name || facility.name}`;
      }
      if (valid && ['further-processing', 'dump', 'flare', 'wastewater'].includes(type)) {
        routeRecipe =
          (disposition.recipeId && option?.routes.find((r) => r.id === disposition.recipeId)) ||
          option?.routes[0];
        if (routeRecipe) {
          label = `${label}: ${routeRecipe.name}`;
          const inputQty = routeRecipe.inputs.find((x) => x.id === id)?.quantity || 1,
            cycles = amount / inputQty;
          addMachine(routeRecipe, (cycles * routeRecipe.duration) / 60);
          const routeNode = `sink:${id}:${type}`;
          edges.set(`sink:${id}:${type}`, {
            from: id,
            to: routeNode,
            rate: amount,
            kind: 'sink',
            label,
          });
          for (const item of routeRecipe.inputs)
            if (item.id !== id)
              expandExtra(item.id, item.quantity * cycles, new Set([id]), routeNode);
          if (state.includeByproducts !== false)
            for (const item of routeRecipe.outputs) {
              outputs[item.id] = (outputs[item.id] || 0) + item.quantity * cycles;
              edges.set(`routeout:${routeNode}:${item.id}`, {
                from: routeNode,
                to: item.id,
                rate: item.quantity * cycles,
                kind: 'byproduct',
              });
              if (!processed.has(item.id)) changed = true;
            }
        }
      } else
        edges.set(`sink:${id}:${type}`, {
          from: id,
          to: `sink:${id}:${type}`,
          rate: amount,
          kind: 'sink',
          label,
        });
      outputRoutes.push({
        routeId: `sink:${id}:${type}`,
        productId: id,
        type,
        rate: amount,
        recipeId: routeRecipe?.id,
        label,
        valid,
      });
      if (type !== 'unassigned') assignedSurplus[id] = (assignedSurplus[id] || 0) + amount;
      if (amount + 1e-8 < available) {
        const rest = available - amount;
        outputRoutes.push({
          routeId: `sink:${id}:remainder`,
          productId: id,
          type: 'unassigned',
          rate: rest,
          label: 'Nicht zugewiesener Rest',
          valid: true,
        });
        edges.set(`sink:${id}:remainder`, {
          from: id,
          to: `sink:${id}:remainder`,
          rate: rest,
          kind: 'sink',
          label: 'Nicht zugewiesener Rest',
        });
      }
      processed.add(id);
    }
    if (!changed) {
      routesConverged = true;
      break;
    }
  }
  if (!routesConverged) solverWarnings.push({ code: 'solver.routeLimit', params: { limit: 32 } });
  // Route processing can create emissions in a later pass. Reconcile their final gross rate so
  // unavoidable pollution is always fully assigned and never presented as user-configurable.
  for (const id of ['air_pollution', 'water_pollution']) {
    const rate = Math.max(0, outputs[id] || 0);
    if (rate <= 1e-8) continue;
    const label = id === 'air_pollution' ? 'Air emission' : 'Water emission';
    const routeId = `sink:${id}:emission`;
    const existing = outputRoutes.find((route) => route.routeId === routeId);
    if (existing) existing.rate = rate;
    else outputRoutes.push({ routeId, productId: id, type: 'emission', rate, label, valid: true });
    assignedSurplus[id] = rate;
    edges.set(routeId, { from: id, to: routeId, rate, kind: 'sink', label });
  }
  for (const productId of unknownCapacityProducts) {
    if (productCapabilities[productId]?.extractable) continue;
    solverWarnings.push({
      code: 'data.unknownCapacity',
      params: { productId, product: products[productId]?.name || productId },
    });
  }
  const rankMemo = new Map<string, number>();
  const rank = (id: string, path = new Set<string>()): number => {
    if (rankMemo.has(id)) return rankMemo.get(id)!;
    const recipe = bestRecipe(id, state.recipeChoices, state.recipeFilter, state.optimization);
    if (!recipe || path.has(id)) {
      rankMemo.set(id, 0);
      return 0;
    }
    const next = new Set(path);
    next.add(id);
    const value = 1 + Math.max(0, ...recipe.inputs.map((x) => rank(x.id, next)));
    rankMemo.set(id, Math.min(value, 30));
    return Math.min(value, 30);
  };
  const graphIds = new Set([
    ...Object.keys(demand),
    ...Object.keys(inputs),
    ...Object.keys(activity),
    ...Object.keys(outputs),
  ]);
  const graphNodes = [...graphIds]
    .map((productId) => {
      const a = activity[productId],
        outputOnly = !a && !((inputs[productId] || 0) > 0) && (outputs[productId] || 0) > 0,
        recipe =
          a || outputOnly
            ? a
              ? recipes[a.recipeId]
              : undefined
            : bestRecipe(productId, state.recipeChoices, state.recipeFilter, state.optimization),
        external = !a && !!inputs[productId],
        byproductStage = Math.max(
          0,
          ...[...edges.values()]
            .filter(
              (edge) =>
                edge.kind === 'byproduct' && edge.to === productId && !edge.from.startsWith('sink:')
            )
            .map((edge) => rank(edge.from) + 1)
        );
      return {
        productId,
        rate: outputOnly
          ? outputs[productId] || 0
          : (a?.rate ?? inputs[productId] ?? demand[productId] ?? outputs[productId] ?? 0),
        recipeId: a?.recipeId ?? recipe?.id,
        machines: a?.machines ?? 0,
        stage: outputOnly ? byproductStage : rank(productId),
        external,
      };
    })
    .sort((a, b) => a.stage - b.stage || b.rate - a.rate);
  const grossSurplus: Record<string, number> = {},
    openSurplus: Record<string, number> = {},
    net: Record<string, number> = {};
  for (const id of new Set([
    ...Object.keys(inputs),
    ...Object.keys(outputs),
    ...Object.keys(assignedSurplus),
  ])) {
    grossSurplus[id] = Math.max(0, outputs[id] || 0);
    assignedSurplus[id] = Math.min(grossSurplus[id], Math.max(0, assignedSurplus[id] || 0));
    openSurplus[id] = Math.max(0, grossSurplus[id] - assignedSurplus[id]);
    net[id] = openSurplus[id] - (inputs[id] || 0);
  }
  const balanceResiduals: Record<string, number> = {};
  for (const [id, requested] of Object.entries(demand)) {
    balanceResiduals[id] =
      requested - (activity[id]?.rate || 0) - (inputs[id] || 0) - (reused[id] || 0);
  }
  const maximumBalanceResidual = Math.max(
    0,
    ...Object.values(balanceResiduals).map((value) => Math.abs(value))
  );
  if (maximumBalanceResidual > 1e-6) {
    solverWarnings.push({
      code: 'solver.balanceResidual',
      params: { residual: maximumBalanceResidual },
    });
  }

  const machineList = [...machineMap.values()],
    power = machineList.reduce((s, x) => s + x.power, 0),
    workers = machineList.reduce((s, x) => s + x.workers, 0),
    machineCount = machineList.reduce((s, x) => s + x.count, 0),
    computing = machineList.reduce((s, x) => {
      const m = machines[x.machineId];
      return (
        s + Math.max(0, (m?.computing_consumed || 0) - (m?.computing_generated || 0)) * x.count
      );
    }, 0),
    maintenance = machineList.reduce(
      (s, x) => s + (machines[x.machineId]?.maintenance_cost_quantity || 0) * x.count,
      0
    ),
    constraintWarnings = [...warnings, ...solverWarnings];
  const opt = state.optimization;
  const addExceeded = (resource: string, used: number, limit: number, unit = '') =>
    constraintWarnings.push({
      code: 'constraint.exceeded',
      params: { resource, used, limit, unit },
    });
  if (opt?.enabled) {
    if (opt.maxWorkers != null && workers > opt.maxWorkers)
      addExceeded('Workers', workers, opt.maxWorkers);
    if (opt.maxPower != null && power > opt.maxPower) addExceeded('Power', power, opt.maxPower);
    if (opt.maxMachines != null && machineCount > opt.maxMachines)
      addExceeded('Machines', machineCount, opt.maxMachines);
    if (opt.maxComputing != null && computing > opt.maxComputing)
      addExceeded('Computing', computing, opt.maxComputing);
    if (opt.maxMaintenance != null && maintenance > opt.maxMaintenance)
      addExceeded('Maintenance', maintenance, opt.maxMaintenance);
    for (const [id, limit] of Object.entries(opt.resourceLimits || {})) {
      const used = Math.max(0, inputs[id] || 0);
      if (used > limit) addExceeded(products[id]?.name || id, used, limit, '/min');
    }
  }
  const externalRequirements = Object.entries(inputs)
    .filter(([, rate]) => rate > 1e-8)
    .map(([productId, rate]) => {
      const source = state.externalSources?.[productId] || 'unused',
        storageCaps = (products[productId]?.recipes?.input || [])
          .map((id) => recipes[id])
          .filter(
            (r) =>
              machines[r?.machine]?.isStorage || machines[r?.machine]?.category_id === 'storage'
          )
          .flatMap((r) => r.outputs.filter((x) => x.id === productId).map((x) => x.quantity)),
        bufferCapacity = source === 'storage' ? Math.max(0, ...storageCaps) : 0;
      let facilityCount = 0,
        vehicleCount = 0,
        unityPerMinute = 0;
      let assumptionCode: ExternalAssumptionCode;
      if (source === 'mine') {
        facilityCount = rate / 60;
        vehicleCount = rate / 60;
        assumptionCode = 'source.mineEstimate';
      } else if (source === 'ship') {
        facilityCount = rate / 180;
        vehicleCount = Math.ceil(facilityCount);
        assumptionCode = 'source.shipEstimate';
      } else if (source === 'trade') {
        unityPerMinute = rate * 0.02;
        assumptionCode = 'source.tradeEstimate';
      } else if (source === 'storage') {
        facilityCount = bufferCapacity ? (rate * 60) / bufferCapacity : 0;
        assumptionCode = 'source.storageBuffer';
      } else if (source === 'manual') assumptionCode = 'source.manual';
      else assumptionCode = 'source.unassigned';
      return {
        productId,
        source,
        rate,
        facilityCount,
        vehicleCount,
        unityPerMinute,
        bufferCapacity,
        assumptionCode,
      };
    });
  for (const req of externalRequirements)
    if (req.source === 'unused')
      constraintWarnings.push({
        code: 'source.missing',
        params: {
          productId: req.productId,
          product: products[req.productId]?.name || req.productId,
        },
      });
  const calculated: CalcResult = {
    machines: machineList,
    inputs,
    outputs,
    net,
    grossSurplus,
    assignedSurplus,
    openSurplus,
    balanceResiduals,
    power,
    workers,
    computing,
    maintenance,
    graphNodes,
    graphEdges: [...edges.values()],
    outputRoutes,
    externalRequirements,
    constraintWarnings,
    solverWarnings,
    solverMethod,
    solverResidual: solverMethod.startsWith('exact-linear')
      ? Math.max(exactResidual, residual)
      : residual,
  };
  if (applyAutomaticDispositions) {
    const recommendations = { ...(state.outputDispositions || {}) };
    let changed = false;
    for (const [productId, rate] of Object.entries(grossSurplus)) {
      if (rate <= 1e-8 || recommendations[productId]) continue;
      const options = availableDispositions(productId, state, (demand[productId] || 0) > 0);
      const reuse =
        (inputs[productId] || 0) > 1e-8
          ? options.find((option) => option.type === 'internal-reuse')
          : undefined;
      const storage = options.find((option) => option.type === 'storage');
      const disposal = options.find((option) =>
        ['wastewater', 'flare', 'dump'].includes(option.type)
      );
      // Automatic choices remain conservative: arbitrary follow-up recipes can create additional
      // imports and byproducts. Reuse existing demand first, preserve value in storage, and only
      // dispose when storage is impossible.
      const selected = reuse || storage || disposal;
      if (!selected) continue;
      const route = selected.routes[0];
      recommendations[productId] =
        selected.type === 'storage' || selected.type === 'export'
          ? { type: selected.type, amountMode: 'all', facilityId: route?.id }
          : { type: selected.type, amountMode: 'all', recipeId: route?.id };
      changed = true;
    }
    if (changed) return calculateCore({ ...state, outputDispositions: recommendations }, false);
  }
  return calculated;
}
