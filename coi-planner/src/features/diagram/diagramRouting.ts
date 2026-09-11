import type { DiagramEdge, DiagramNode } from './diagramModel';
import { diagramPortY } from './diagramModel';

export type RoutedEdge = {
  path: string;
  labelX: number;
  labelY: number;
  points: Array<{ x: number; y: number }>;
  backwards: boolean;
};

/**
 * Deterministic orthogonal edge routing for the layered production graph. Forward flows use a
 * dedicated channel between layers. Reuse/back edges use lanes above the cards, making cycles
 * visually distinct and preventing them from cutting through building content.
 */
export function routeDiagramEdge(
  edge: DiagramEdge,
  positions: Map<string, DiagramNode>,
  edgeIndex: number
): RoutedEdge | null {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return null;
  const x1 = from.x + from.width;
  const y1 = from.embedded ? from.y : from.y + from.height / 2;
  const x2 = to.x;
  const y2 =
    to.kind === 'recipe' && from.productId
      ? diagramPortY(to, from.productId)
      : to.y + to.height / 2;
  const backwards = x2 <= x1 + 24;

  if (backwards) {
    const laneY = 24 + (edgeIndex % 3) * 12;
    const points = [
      { x: x1, y: y1 },
      { x: x1 + 26, y: y1 },
      { x: x1 + 26, y: laneY },
      { x: x2 - 26, y: laneY },
      { x: x2 - 26, y: y2 },
      { x: x2, y: y2 },
    ];
    return {
      path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '),
      labelX: (x1 + x2) / 2,
      labelY: laneY - 6,
      points,
      backwards,
    };
  }

  const channelX = x1 + Math.max(32, (x2 - x1) / 2);
  const points = [
    { x: x1, y: y1 },
    { x: channelX, y: y1 },
    { x: channelX, y: y2 },
    { x: x2, y: y2 },
  ];
  return {
    path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '),
    labelX: channelX + 5,
    labelY: (y1 + y2) / 2 - 6,
    points,
    backwards,
  };
}

const routeCache = new WeakMap<DiagramEdge, { key: string; routed: RoutedEdge }>();

/** Reuses unaffected connector geometry while cards are dragged. */
export function routeDiagramEdgeCached(
  edge: DiagramEdge,
  positions: Map<string, DiagramNode>,
  edgeIndex: number
) {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return null;
  const key = [
    from.x,
    from.y,
    from.width,
    from.height,
    from.compact ? 1 : 0,
    to.x,
    to.y,
    to.width,
    to.height,
    to.compact ? 1 : 0,
    edgeIndex,
  ].join(':');
  const cached = routeCache.get(edge);
  if (cached?.key === key) return cached.routed;
  const routed = routeDiagramEdge(edge, positions, edgeIndex);
  if (routed) routeCache.set(edge, { key, routed });
  return routed;
}
