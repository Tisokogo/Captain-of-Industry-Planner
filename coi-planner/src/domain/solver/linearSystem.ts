export type LinearSolveResult =
  | { status: 'solved'; solution: number[]; residual: number }
  | { status: 'singular'; rank: number }
  | { status: 'inconsistent'; rank: number; row: number }
  | { status: 'negative'; solution: number[]; index: number; value: number; residual: number };

function maximumResidual(
  matrix: readonly (readonly number[])[],
  rhs: readonly number[],
  x: number[]
) {
  return matrix.reduce((maximum, row, index) => {
    const actual = row.reduce((sum, coefficient, column) => sum + coefficient * x[column], 0);
    return Math.max(maximum, Math.abs(actual - rhs[index]));
  }, 0);
}

/**
 * Solves a square material-balance system using Gaussian elimination with
 * partial pivoting. Inputs are copied, so fixtures and cached matrices remain immutable.
 */
export function solveNonNegativeLinearSystem(
  matrix: readonly (readonly number[])[],
  rhs: readonly number[],
  tolerance = 1e-10
): LinearSolveResult {
  const size = matrix.length;
  if (!size || rhs.length !== size || matrix.some((row) => row.length !== size)) {
    throw new Error('Linear system must be a non-empty square matrix with a matching RHS');
  }
  if (
    !matrix.every((row) => row.every(Number.isFinite)) ||
    !rhs.every(Number.isFinite) ||
    tolerance <= 0
  ) {
    throw new Error('Linear system contains non-finite values or an invalid tolerance');
  }

  const augmented = matrix.map((row, index) => [...row, rhs[index]]);
  let rank = 0;
  for (let column = 0; column < size; column += 1) {
    let pivot = rank;
    for (let row = rank + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot]?.[column] ?? 0)) pivot = row;
    }
    if (Math.abs(augmented[pivot]?.[column] ?? 0) <= tolerance) continue;
    [augmented[rank], augmented[pivot]] = [augmented[pivot], augmented[rank]];

    const divisor = augmented[rank][column];
    for (let entry = column; entry <= size; entry += 1) augmented[rank][entry] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === rank) continue;
      const factor = augmented[row][column];
      if (Math.abs(factor) <= tolerance) continue;
      for (let entry = column; entry <= size; entry += 1)
        augmented[row][entry] -= factor * augmented[rank][entry];
    }
    rank += 1;
  }

  for (let row = rank; row < size; row += 1) {
    const coefficientsZero = augmented[row]
      .slice(0, size)
      .every((value) => Math.abs(value) <= tolerance);
    if (coefficientsZero && Math.abs(augmented[row][size]) > tolerance)
      return { status: 'inconsistent', rank, row };
  }
  if (rank < size) return { status: 'singular', rank };

  const solution = Array.from({ length: size }, () => 0);
  for (let row = 0; row < size; row += 1) {
    const pivot = augmented[row].findIndex(
      (value, column) => column < size && Math.abs(value) > tolerance
    );
    if (pivot >= 0) solution[pivot] = augmented[row][size];
  }
  const residual = maximumResidual(matrix, rhs, solution);
  const negativeIndex = solution.findIndex((value) => value < -tolerance);
  if (negativeIndex >= 0) {
    return {
      status: 'negative',
      solution,
      index: negativeIndex,
      value: solution[negativeIndex],
      residual,
    };
  }
  return {
    status: 'solved',
    solution: solution.map((value) => (Math.abs(value) <= tolerance ? 0 : value)),
    residual,
  };
}
