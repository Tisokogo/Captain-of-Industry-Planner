import { describe, expect, it } from 'vitest';
import { nextDiagramNode, traceDiagramFocus } from './diagramFocus';
import type { DiagramEdge, DiagramNode } from './diagramModel';

const edge = (id: string, from: string, to: string): DiagramEdge => ({
  id,
  from,
  to,
  rate: 1,
  kind: 'input',
});

describe('diagram focus tracing', () => {
  it('includes upstream and downstream paths without unrelated sibling branches', () => {
    const result = traceDiagramFocus(
      [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ad', 'a', 'd')],
      'b'
    );

    expect([...result.nodeIds].sort()).toEqual(['a', 'b', 'c']);
    expect([...result.edgeIds].sort()).toEqual(['ab', 'bc']);
  });

  it('terminates deterministically for cycles', () => {
    const result = traceDiagramFocus(
      [edge('ab', 'a', 'b'), edge('ba', 'b', 'a'), edge('bc', 'b', 'c')],
      'a'
    );
    expect([...result.nodeIds].sort()).toEqual(['a', 'b', 'c']);
    expect(result.edgeIds.size).toBe(3);
  });

  it('selects the nearest spatial node for arrow-key navigation', () => {
    const node = (id: string, x: number, y: number): DiagramNode => ({
      id,
      x,
      y,
      width: 100,
      height: 60,
      kind: 'product',
      rate: 1,
    });
    const nodes = [
      node('center', 100, 100),
      node('right', 300, 110),
      node('far-right', 500, 0),
      node('down', 110, 300),
    ];

    expect(nextDiagramNode(nodes, 'center', 'right')).toBe('right');
    expect(nextDiagramNode(nodes, 'center', 'down')).toBe('down');
    expect(nextDiagramNode(nodes, 'center', 'left')).toBeUndefined();
    expect(nextDiagramNode(nodes, 'missing', 'right')).toBeUndefined();
    expect(
      nextDiagramNode(
        [node('center', 100, 100), node('right-z', 300, 110), node('right-a', 300, 110)],
        'center',
        'right'
      )
    ).toBe('right-a');
  });
});
