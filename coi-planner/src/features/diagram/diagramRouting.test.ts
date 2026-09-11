import { describe, expect, it } from 'vitest';
import type { DiagramEdge, DiagramNode } from './diagramModel';
import { routeDiagramEdge, routeDiagramEdgeCached } from './diagramRouting';

const node = (id: string, x: number, y: number): DiagramNode => ({
  id,
  kind: 'product',
  x,
  y,
  width: 100,
  height: 60,
  productId: id,
  rate: 1,
});

describe('orthogonal diagram routing', () => {
  it('routes forward edges through a channel using only horizontal and vertical segments', () => {
    const positions = new Map([
      ['a', node('a', 0, 40)],
      ['b', node('b', 300, 180)],
    ]);
    const edge: DiagramEdge = { id: 'a:b', from: 'a', to: 'b', rate: 1, kind: 'input' };
    const routed = routeDiagramEdge(edge, positions, 0)!;

    expect(routed.backwards).toBe(false);
    expect(routed.points).toHaveLength(4);
    for (let index = 1; index < routed.points.length; index += 1) {
      const previous = routed.points[index - 1];
      const current = routed.points[index];
      expect(current.x === previous.x || current.y === previous.y).toBe(true);
    }
  });

  it('reuses unaffected connector geometry and invalidates it after movement', () => {
    const a = node('a', 0, 40);
    const positions = new Map([
      ['a', a],
      ['b', node('b', 300, 180)],
    ]);
    const edge: DiagramEdge = { id: 'cache', from: 'a', to: 'b', rate: 1, kind: 'input' };
    const first = routeDiagramEdgeCached(edge, positions, 0)!;
    expect(routeDiagramEdgeCached(edge, positions, 0)).toBe(first);
    a.x = 25;
    expect(routeDiagramEdgeCached(edge, positions, 0)).not.toBe(first);
  });

  it('moves back edges into a dedicated lane above cards', () => {
    const positions = new Map([
      ['a', node('a', 400, 200)],
      ['b', node('b', 100, 100)],
    ]);
    const edge: DiagramEdge = { id: 'a:b', from: 'a', to: 'b', rate: 1, kind: 'reuse' };
    const routed = routeDiagramEdge(edge, positions, 1)!;

    expect(routed.backwards).toBe(true);
    expect(Math.min(...routed.points.map((point) => point.y))).toBeLessThan(70);
  });
});
