import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defaultState } from '../domain/solver/planCalculator';
import { usePlanHistory } from './usePlanHistory';

describe('plan history', () => {
  it('undoes and redoes planner changes without mutating snapshots', () => {
    const initial = defaultState();
    const { result } = renderHook(() => usePlanHistory(() => initial));

    act(() =>
      result.current.setState((current) => ({
        ...current,
        goals: current.goals.map((goal) => ({ ...goal, rate: 42 })),
      }))
    );
    expect(result.current.state.goals[0].rate).toBe(42);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.state.goals[0].rate).toBe(initial.goals[0].rate);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.state.goals[0].rate).toBe(42);
  });
});
