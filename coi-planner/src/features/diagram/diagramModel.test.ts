import { describe, expect, it } from 'vitest';
import { calculate, defaultState } from '../../domain/solver/planCalculator';
import { applyDiagramPositions, buildDiagramModel } from './diagramModel';

describe('diagram model', () => {
  it('builds a deterministic graph whose edges reference visible nodes', () => {
    const state = defaultState();
    const result = calculate(state);
    const first = buildDiagramModel(result, state, 'Goal output');
    const second = buildDiagramModel(result, state, 'Goal output');
    const nodeIds = new Set(first.nodes.map((node) => node.id));

    expect(second).toEqual(first);
    expect(nodeIds.size).toBe(first.nodes.length);
    expect(first.edges.length).toBeGreaterThan(0);
    expect(first.edges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))).toBe(true);
    expect(first.nodes.some((node) => node.kind === 'goal')).toBe(true);
    const building = first.nodes.find((node) => node.kind === 'recipe');
    expect(building?.inputs?.length).toBeGreaterThan(0);
    expect(building?.outputs?.some((output) => output.productId === building.productId)).toBe(true);
    expect(building?.width).toBeGreaterThanOrEqual(300);
    expect(first.width).toBeGreaterThanOrEqual(900);
    expect(first.height).toBeGreaterThanOrEqual(500);
  });

  it('packs visible cards without overlaps and anchors products to building output rows', () => {
    const state = defaultState();
    const model = buildDiagramModel(calculate(state), state, 'Goal output');
    const cards = model.nodes.filter(
      (node) => node.kind !== 'route' && (node.kind !== 'product' || !node.embedded)
    );

    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        const a = cards[i];
        const b = cards[j];
        const overlap =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }

    const endpoints = model.nodes.filter((node) => node.kind === 'route');
    for (let i = 0; i < endpoints.length; i += 1) {
      for (let j = i + 1; j < endpoints.length; j += 1) {
        const a = endpoints[i];
        const b = endpoints[j];
        const overlap =
          a.x < b.x + b.width + 10 &&
          a.x + a.width + 10 > b.x &&
          a.y < b.y + b.height + 10 &&
          a.y + a.height + 10 > b.y;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }

    for (const product of model.nodes.filter((node) => node.embedded)) {
      const producers = model.nodes.filter(
        (node) =>
          node.kind === 'recipe' &&
          (node.outputs || []).some((output) => output.productId === product.productId)
      );
      expect(producers.some((producer) => product.x === producer.x + producer.width)).toBe(true);
    }
  });

  it('prunes stale positions, preserves valid manual cards, and regenerates embedded anchors', () => {
    const state = defaultState();
    const base = buildDiagramModel(calculate(state), state, 'Goal output');
    const building = base.nodes.find((node) => node.kind === 'recipe')!;
    const positioned = applyDiagramPositions(base, {
      obsolete: { x: 1, y: 1 },
      [building.id]: { x: 777, y: 333 },
      [`p:${building.productId}`]: { x: 2, y: 2 },
    });

    expect(positioned.validPositions).toEqual({ [building.id]: { x: 777, y: 333 } });
    expect(positioned.pos.get(building.id)).toMatchObject({ x: 777, y: 333 });
    expect(positioned.pos.get(`p:${building.productId}`)?.x).toBe(777 + building.width);
  });

  it('regenerates semantic endpoints when an output action changes', () => {
    const automaticState = defaultState();
    const automatic = buildDiagramModel(calculate(automaticState), automaticState, 'Goal output');
    expect(
      automatic.nodes.some((node) => node.kind === 'route' && node.routeType === 'storage')
    ).toBe(true);

    const changedState = {
      ...automaticState,
      outputDispositions: {
        carbon_dioxide: {
          type: 'flare' as const,
          amountMode: 'all' as const,
          recipeId: 'product_disposal_16',
        },
      },
    };
    const changed = buildDiagramModel(calculate(changedState), changedState, 'Goal output');
    expect(
      changed.nodes.some(
        (node) =>
          node.kind === 'route' && node.productId === 'carbon_dioxide' && node.routeType === 'flare'
      )
    ).toBe(true);
    expect(changed).not.toEqual(automatic);
  });

  it('keeps compact building cards distinct from collapsed input branches', () => {
    const state = defaultState();
    const result = calculate(state);
    const firstBuilding = buildDiagramModel(result, state, 'Goal output').nodes.find(
      (node) => node.kind === 'recipe'
    )!;
    const detailedState = {
      ...state,
      diagramCompact: { [firstBuilding.productId!]: false },
    };
    const building = buildDiagramModel(result, detailedState, 'Goal output').pos.get(
      firstBuilding.id
    )!;
    const compact = buildDiagramModel(result, state, 'Goal output');
    const compactBuilding = compact.pos.get(building.id)!;

    expect(compactBuilding.kind).toBe('recipe');
    expect(compactBuilding.compact).toBe(true);
    expect(compactBuilding.height).toBeLessThan(building.height);
  });

  it('honors collapsed products without mutating the calculation result', () => {
    const state = defaultState();
    const result = calculate(state);
    const productId = state.goals[0].productId;
    const originalNodeCount = result.graphNodes.length;
    const expanded = buildDiagramModel(result, state, 'Goal output');
    const collapsed = buildDiagramModel(
      result,
      { ...state, expanded: { ...state.expanded, [productId]: false } },
      'Goal output'
    );

    expect(collapsed.nodes.length).toBeLessThan(expanded.nodes.length);
    expect(result.graphNodes).toHaveLength(originalNodeCount);
  });
});
