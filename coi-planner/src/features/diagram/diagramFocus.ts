import type { DiagramEdge, DiagramNode } from './diagramModel';

export type SpatialDirection = 'left' | 'right' | 'up' | 'down';

export type DiagramFocus = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
};

export function traceDiagramFocus(edges: readonly DiagramEdge[], focusId: string): DiagramFocus {
  const nodeIds = new Set<string>([focusId]);
  const edgeIds = new Set<string>();
  const walk = (direction: 'upstream' | 'downstream') => {
    const queue = [focusId];
    const visited = new Set<string>(queue);
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of edges) {
        const matches = direction === 'upstream' ? edge.to === current : edge.from === current;
        if (!matches) continue;
        edgeIds.add(edge.id);
        const next = direction === 'upstream' ? edge.from : edge.to;
        nodeIds.add(next);
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  };
  walk('upstream');
  walk('downstream');
  return { nodeIds, edgeIds };
}

export function nextDiagramNode(
  nodes: readonly DiagramNode[],
  currentId: string,
  direction: SpatialDirection
) {
  const current = nodes.find((node) => node.id === currentId);
  if (!current) return undefined;
  const cx = current.x + current.width / 2,
    cy = current.y + current.height / 2,
    horizontal = direction === 'left' || direction === 'right';
  return nodes
    .filter((node) => node.id !== currentId)
    .map((node) => {
      const nx = node.x + node.width / 2,
        ny = node.y + node.height / 2,
        primary = horizontal ? nx - cx : ny - cy,
        secondary = horizontal ? Math.abs(ny - cy) : Math.abs(nx - cx),
        pointsForward = direction === 'left' || direction === 'up' ? primary < -1 : primary > 1,
        valid = pointsForward && Math.abs(primary) >= secondary;
      return { node, valid, score: Math.abs(primary) * 2 + secondary };
    })
    .filter((candidate) => candidate.valid)
    .sort((a, b) => a.score - b.score || a.node.id.localeCompare(b.node.id))[0]?.node.id;
}
