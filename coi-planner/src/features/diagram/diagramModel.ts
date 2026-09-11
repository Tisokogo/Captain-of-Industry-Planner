import type { CalcResult, OutputDispositionType, PlanState } from '../../types';

export type DiagramNode = {
  id: string;
  kind: 'product' | 'recipe' | 'goal' | 'route';
  x: number;
  y: number;
  width: number;
  height: number;
  productId?: string;
  recipeId?: string;
  rate: number;
  label?: string;
  external?: boolean;
  machines?: number;
  goalId?: string;
  inputs?: { productId: string; rate: number }[];
  outputs?: { productId: string; rate: number }[];
  routeType?: OutputDispositionType;
  embedded?: boolean;
  compact?: boolean;
};

export type DiagramEdge = {
  id: string;
  from: string;
  to: string;
  rate: number;
  kind: string;
  label?: string;
};

const TOP = 70;
const SOURCE_X = 40;
const SOURCE_WIDTH = 220;
const BUILDING_X = 380;
const BUILDING_WIDTH = 560;
const STAGE_STEP = 720;
const ROW_GAP = 56;
const PORT_TOP = 46;
const PORT_STEP = 38;
const ENDPOINT_SIZE = 68;

type GraphEdge = CalcResult['graphEdges'][number];

type GraphIndex = {
  incoming: Map<string, GraphEdge[]>;
  outgoing: Map<string, GraphEdge[]>;
};

function indexGraph(edges: CalcResult['graphEdges']): GraphIndex {
  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const to = incoming.get(edge.to) || [];
    to.push(edge);
    incoming.set(edge.to, to);
    const from = outgoing.get(edge.from) || [];
    from.push(edge);
    outgoing.set(edge.from, from);
  }
  return { incoming, outgoing };
}

/** Assign every material to its earliest goal lane so related chains stay together vertically. */
function goalLanes(state: PlanState, graph: GraphIndex) {
  const lanes = new Map<string, number>();
  state.goals.forEach((goal, lane) => {
    const queue = [goal.productId];
    const seen = new Set<string>();
    while (queue.length) {
      const productId = queue.shift()!;
      if (seen.has(productId)) continue;
      seen.add(productId);
      lanes.set(productId, Math.min(lanes.get(productId) ?? lane, lane));
      for (const edge of graph.incoming.get(productId) || []) {
        if ((edge.kind === 'input' || edge.kind === 'reuse') && !edge.from.startsWith('sink:'))
          queue.push(edge.from);
      }
    }
  });
  return lanes;
}

export function buildDiagramModel(result: CalcResult, state: PlanState, goalLabel: string) {
  const graph = indexGraph(result.graphEdges);
  const keep = new Set<string>();
  const queue = state.goals.map((goal) => goal.productId);
  for (const route of result.outputRoutes) queue.push(route.productId);
  while (queue.length) {
    const id = queue.shift()!;
    if (keep.has(id)) continue;
    keep.add(id);
    if (state.expanded[id] === false) continue;
    for (const edge of graph.incoming.get(id) || [])
      if ((edge.kind === 'input' || edge.kind === 'reuse') && !edge.from.startsWith('sink:'))
        queue.push(edge.from);
  }
  if (!keep.size) result.graphNodes.forEach((node) => keep.add(node.productId));

  const visible = result.graphNodes.filter((node) => keep.has(node.productId));
  const lanes = goalLanes(state, graph);
  const nodes: DiagramNode[] = [];
  const pos = new Map<string, DiagramNode>();
  for (const graphNode of visible) {
    if (
      graphNode.recipeId &&
      !graphNode.external &&
      state.expanded[graphNode.productId] !== false
    ) {
      const inputs = (graph.incoming.get(graphNode.productId) || [])
        .filter((edge) => edge.kind === 'input' || edge.kind === 'reuse')
        .map((edge) => ({ productId: edge.from, rate: edge.rate }));
      const outputs = [
        { productId: graphNode.productId, rate: graphNode.rate },
        ...(graph.outgoing.get(graphNode.productId) || [])
          .filter((edge) => edge.kind === 'byproduct')
          .map((edge) => ({ productId: edge.to, rate: edge.rate })),
      ];
      const portRows = Math.max(inputs.length, outputs.length, 1);
      const recipeNode: DiagramNode = {
        id: `r:${graphNode.productId}`,
        kind: 'recipe',
        x: 0,
        y: 0,
        width: state.diagramCompact?.[graphNode.productId] !== false ? 330 : BUILDING_WIDTH,
        height:
          state.diagramCompact?.[graphNode.productId] !== false
            ? 76
            : Math.max(164, 68 + portRows * PORT_STEP),
        productId: graphNode.productId,
        compact: state.diagramCompact?.[graphNode.productId] !== false,
        recipeId: graphNode.recipeId,
        rate: graphNode.rate,
        machines: graphNode.machines,
        inputs,
        outputs,
      };
      nodes.push(recipeNode);
      pos.set(recipeNode.id, recipeNode);
    }

    const productNode: DiagramNode = {
      id: `p:${graphNode.productId}`,
      kind: 'product',
      x: 0,
      y: 0,
      width: SOURCE_WIDTH,
      height:
        state.expanded[graphNode.productId] === false ||
        (graphNode.external && state.diagramCompact?.[graphNode.productId] !== false)
          ? 58
          : 116,
      productId: graphNode.productId,
      rate: graphNode.rate,
      external: graphNode.external,
      compact: graphNode.external && state.diagramCompact?.[graphNode.productId] !== false,
      embedded:
        !graphNode.external &&
        state.expanded[graphNode.productId] !== false &&
        (!!graphNode.recipeId ||
          (graph.incoming.get(graphNode.productId) || []).some(
            (edge) => edge.kind === 'byproduct'
          )),
    };
    nodes.push(productNode);
    pos.set(productNode.id, productNode);
  }

  // Pack every visual column independently. Heights, not item counts, determine spacing, so
  // large buildings can never overlap. Goal lanes keep branches for the same goal adjacent.
  const columns = new Map<number, DiagramNode[]>();
  const internalStages = visible.filter((node) => !node.external).map((node) => node.stage);
  const firstInternalStage = internalStages.length ? Math.min(...internalStages) : 0;
  for (const graphNode of visible) {
    const productNode = pos.get(`p:${graphNode.productId}`)!;
    const visualNode =
      pos.get(`r:${graphNode.productId}`) || (!productNode.embedded ? productNode : null);
    if (!visualNode) continue;
    const column = graphNode.external ? -1 : graphNode.stage - firstInternalStage;
    const list = columns.get(column) || [];
    list.push(visualNode);
    columns.set(column, list);
  }
  const baseCompare = (a: DiagramNode, b: DiagramNode) => {
    const laneA = lanes.get(a.productId || '') ?? Number.MAX_SAFE_INTEGER;
    const laneB = lanes.get(b.productId || '') ?? Number.MAX_SAFE_INTEGER;
    return laneA - laneB || b.rate - a.rate || a.id.localeCompare(b.id);
  };
  for (const columnNodes of columns.values()) columnNodes.sort(baseCompare);

  // Barycenter sweeps reduce crossings without sacrificing deterministic goal grouping. Each
  // pass orders a layer around the average position of its already ordered neighbours.
  const columnKeys = [...columns.keys()].sort((a, b) => a - b);
  const order = new Map<string, number>();
  const refreshOrder = () => {
    order.clear();
    for (const key of columnKeys)
      columns.get(key)?.forEach((node, index) => order.set(node.productId || node.id, index));
  };
  const reorder = (keys: number[], upstream: boolean) => {
    refreshOrder();
    for (const key of keys) {
      const list = columns.get(key)!;
      const barycenter = (node: DiagramNode) => {
        const neighbours = (
          upstream
            ? graph.incoming.get(node.productId || '') || []
            : graph.outgoing.get(node.productId || '') || []
        )
          .filter((edge) =>
            upstream
              ? edge.kind === 'input' || edge.kind === 'reuse'
              : edge.kind === 'input' || edge.kind === 'reuse' || edge.kind === 'goal'
          )
          .map((edge) => order.get(upstream ? edge.from : edge.to))
          .filter((value): value is number => value != null);
        return neighbours.length
          ? neighbours.reduce((sum, value) => sum + value, 0) / neighbours.length
          : Number.POSITIVE_INFINITY;
      };
      list.sort((a, b) => barycenter(a) - barycenter(b) || baseCompare(a, b));
      refreshOrder();
    }
  };
  for (let sweep = 0; sweep < 3; sweep += 1) {
    reorder(columnKeys, true);
    reorder([...columnKeys].reverse(), false);
  }

  for (const [column, columnNodes] of columns) {
    let y = TOP;
    for (const node of columnNodes) {
      node.x = column === -1 ? SOURCE_X : BUILDING_X + column * STAGE_STEP;
      node.y = y;
      y += node.height + ROW_GAP;
    }
  }

  // Invisible product junctions sit exactly on the corresponding output row. Connectors and
  // endpoints therefore follow their building without covering the readable card content.
  for (const productNode of nodes.filter((node) => node.kind === 'product' && node.embedded)) {
    const byproductEdge = (graph.incoming.get(productNode.productId || '') || []).find(
      (edge) => edge.kind === 'byproduct' && !edge.from.startsWith('sink:')
    );
    const producer = pos.get(`r:${byproductEdge?.from || productNode.productId}`);
    if (!producer) continue;
    const outputIndex = Math.max(
      0,
      (producer.outputs || []).findIndex((output) => output.productId === productNode.productId)
    );
    productNode.x = producer.x + producer.width;
    productNode.y = producer.y + PORT_TOP + outputIndex * PORT_STEP;
    productNode.width = 0;
    productNode.height = 0;
  }

  const visualNodes = nodes.filter((node) => !node.embedded);
  const maxVisualX = Math.max(300, ...visualNodes.map((node) => node.x + node.width));
  const goalX = maxVisualX + 260;
  let goalCursor = TOP;
  state.goals.forEach((goal) => {
    const source = pos.get(`p:${goal.productId}`);
    const desiredY = source ? source.y + source.height / 2 - 46 : goalCursor;
    const node: DiagramNode = {
      id: `goal:${goal.id}`,
      kind: 'goal',
      x: goalX,
      y: Math.max(goalCursor, desiredY),
      width: 230,
      height: 92,
      productId: goal.productId,
      goalId: goal.id,
      rate: goal.rate,
      label: goalLabel,
    };
    goalCursor = node.y + node.height + 34;
    nodes.push(node);
    pos.set(node.id, node);
  });

  const sinkEdges = result.graphEdges.filter((edge) => edge.kind === 'sink');
  const sinkById = new Map(sinkEdges.map((edge) => [edge.to, edge]));
  const routeById = new Map(result.outputRoutes.map((route) => [route.routeId, route]));
  const routeCountByProduct = new Map<string, number>();
  sinkById.forEach((edge, id) => {
    const route = routeById.get(id);
    const source = pos.get(`p:${edge.from}`);
    const routeIndex = routeCountByProduct.get(edge.from) || 0;
    routeCountByProduct.set(edge.from, routeIndex + 1);
    const sourceCenterY = source ? source.y + source.height / 2 : TOP;
    const node: DiagramNode = {
      id,
      kind: 'route',
      x: source ? source.x + source.width + 72 : goalX,
      y: sourceCenterY - ENDPOINT_SIZE / 2 + routeIndex * (ENDPOINT_SIZE + 10),
      width: ENDPOINT_SIZE,
      height: ENDPOINT_SIZE,
      productId: edge.from,
      recipeId: route?.recipeId,
      routeType: route?.type,
      rate: edge.rate,
      label: edge.label || route?.label,
    };
    nodes.push(node);
    pos.set(id, node);
  });

  const placedEndpoints: DiagramNode[] = [];
  nodes
    .filter((node) => node.kind === 'route')
    .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id))
    .forEach((node) => {
      let collision: DiagramNode | undefined;
      do {
        collision = placedEndpoints.find(
          (placed) =>
            Math.abs(placed.x - node.x) < ENDPOINT_SIZE + 10 &&
            node.y < placed.y + placed.height + 10 &&
            node.y + node.height + 10 > placed.y
        );
        if (collision) node.y = collision.y + collision.height + 10;
      } while (collision);
      placedEndpoints.push(node);
    });

  const edges: DiagramEdge[] = [];
  const add = (
    id: string,
    from: string,
    to: string,
    rate: number,
    kind: string,
    label?: string
  ) => {
    if (pos.has(from) && pos.has(to) && rate > 1e-8)
      edges.push({ id, from, to, rate, kind, label });
  };
  for (const edge of result.graphEdges) {
    if (edge.kind === 'input')
      add(
        `i:${edge.from}:${edge.to}`,
        `p:${edge.from}`,
        edge.to.startsWith('sink:') ? edge.to : `r:${edge.to}`,
        edge.rate,
        'input'
      );
    else if (edge.kind === 'byproduct')
      add(
        `b:${edge.from}:${edge.to}`,
        edge.from.startsWith('sink:') ? edge.from : `r:${edge.from}`,
        `p:${edge.to}`,
        edge.rate,
        'byproduct'
      );
    else if (edge.kind === 'reuse')
      add(
        `u:${edge.from}:${edge.to}`,
        `p:${edge.from}`,
        edge.to.startsWith('goal:') ? edge.to : `r:${edge.to}`,
        edge.rate,
        'reuse',
        edge.label
      );
    else if (edge.kind === 'goal')
      add(`g:${edge.goalId}`, `p:${edge.from}`, `goal:${edge.goalId}`, edge.rate, 'goal');
    else if (edge.kind === 'sink')
      add(`s:${edge.from}:${edge.to}`, `p:${edge.from}`, edge.to, edge.rate, 'sink', edge.label);
  }
  for (const graphNode of visible)
    if (graphNode.recipeId && !graphNode.external && state.expanded[graphNode.productId] !== false)
      add(
        `production:${graphNode.productId}`,
        `r:${graphNode.productId}`,
        `p:${graphNode.productId}`,
        graphNode.rate,
        'production'
      );

  const width = Math.max(900, ...nodes.map((node) => node.x + node.width + 60));
  const height = Math.max(500, ...nodes.map((node) => node.y + node.height + 70));
  return { nodes, edges, pos, width, height };
}

export const diagramPortY = (node: DiagramNode, productId: string) => {
  if (node.compact) return node.y + node.height / 2;
  const index = (node.inputs || []).findIndex((input) => input.productId === productId);
  return node.y + PORT_TOP + Math.max(0, index) * PORT_STEP;
};

export const diagramOutputPortY = (node: DiagramNode, productId: string) => {
  if (node.compact) return node.y + node.height / 2;
  const index = (node.outputs || []).findIndex((output) => output.productId === productId);
  return node.y + PORT_TOP + Math.max(0, index) * PORT_STEP;
};

export type DiagramModel = ReturnType<typeof buildDiagramModel>;
type DiagramPositions = Record<string, { x: number; y: number }>;

const boxesOverlap = (a: DiagramNode, b: DiagramNode, gap = 18) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;

/**
 * Applies durable user positions without letting obsolete topology coordinates corrupt a new
 * graph. New cards retain the automatic layout and move down only when an existing manual card
 * occupies their slot. Embedded product anchors are always regenerated from their building.
 */
export function applyDiagramPositions(model: DiagramModel, positions: DiagramPositions = {}) {
  const validIds = new Set(model.nodes.filter((node) => !node.embedded).map((node) => node.id));
  const validPositions = Object.fromEntries(
    Object.entries(positions).filter(([id]) => validIds.has(id))
  ) as DiagramPositions;
  const nodes = model.nodes.map((node) => {
    const position = !node.embedded ? validPositions[node.id] : undefined;
    return node.embedded || position ? { ...node, ...position } : node;
  });
  const pos = new Map(nodes.map((node) => [node.id, node]));

  const visualCards = nodes.filter(
    (node) => node.kind !== 'route' && (node.kind !== 'product' || !node.embedded)
  );
  const placed = visualCards.filter((node) => validPositions[node.id]);
  for (const node of visualCards.filter((candidate) => !validPositions[candidate.id])) {
    let blocker = placed.find((candidate) => boxesOverlap(node, candidate));
    while (blocker) {
      node.y = blocker.y + blocker.height + ROW_GAP;
      blocker = placed.find((candidate) => boxesOverlap(node, candidate));
    }
    placed.push(node);
  }

  for (const product of nodes.filter((node) => node.embedded)) {
    const producer = nodes.find(
      (node) =>
        node.kind === 'recipe' &&
        (node.outputs || []).some((output) => output.productId === product.productId)
    );
    if (!producer || !product.productId) continue;
    product.x = producer.x + producer.width;
    product.y = diagramOutputPortY(producer, product.productId);
  }

  return {
    ...model,
    nodes,
    pos,
    validPositions,
    width: Math.max(900, ...nodes.map((node) => node.x + node.width + 60)),
    height: Math.max(500, ...nodes.map((node) => node.y + node.height + 70)),
  };
}
