import { describe, expect, it } from 'vitest';
import { solveNonNegativeLinearSystem } from './linearSystem';

describe('non-negative linear material solver', () => {
  it('solves a coupled recycling system exactly', () => {
    // x - 0.25y = 10; -0.5x + y = 0
    const result = solveNonNegativeLinearSystem(
      [
        [1, -0.25],
        [-0.5, 1],
      ],
      [10, 0]
    );

    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    expect(result.solution[0]).toBeCloseTo(80 / 7, 10);
    expect(result.solution[1]).toBeCloseTo(40 / 7, 10);
    expect(result.residual).toBeLessThan(1e-10);
  });

  it('reports singular and inconsistent systems separately', () => {
    expect(
      solveNonNegativeLinearSystem(
        [
          [1, -1],
          [2, -2],
        ],
        [0, 0]
      ).status
    ).toBe('singular');
    expect(
      solveNonNegativeLinearSystem(
        [
          [1, -1],
          [2, -2],
        ],
        [1, 3]
      ).status
    ).toBe('inconsistent');
  });

  it('rejects mathematically valid solutions with negative activities', () => {
    const result = solveNonNegativeLinearSystem([[1]], [-2]);
    expect(result.status).toBe('negative');
    if (result.status === 'negative') expect(result.value).toBe(-2);
  });

  it('does not mutate matrix fixtures', () => {
    const matrix = [
      [2, 1],
      [1, 3],
    ];
    const copy = structuredClone(matrix);
    solveNonNegativeLinearSystem(matrix, [1, 2]);
    expect(matrix).toEqual(copy);
  });
});
