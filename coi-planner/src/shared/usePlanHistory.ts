import { useCallback, useEffect, useReducer, type Dispatch, type SetStateAction } from 'react';
import type { PlanState } from '../types';

type History = { past: PlanState[]; present: PlanState; future: PlanState[] };
type Action =
  { type: 'set'; update: SetStateAction<PlanState> } | { type: 'undo' } | { type: 'redo' };

const LIMIT = 100;

function reducer(history: History, action: Action): History {
  if (action.type === 'undo') {
    const previous = history.past.at(-1);
    if (!previous) return history;
    return {
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future].slice(0, LIMIT),
    };
  }
  if (action.type === 'redo') {
    const next = history.future[0];
    if (!next) return history;
    return {
      past: [...history.past, history.present].slice(-LIMIT),
      present: next,
      future: history.future.slice(1),
    };
  }
  const next =
    typeof action.update === 'function'
      ? (action.update as (current: PlanState) => PlanState)(history.present)
      : action.update;
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: next,
    future: [],
  };
}

export function usePlanHistory(initializer: () => PlanState) {
  const [history, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: initializer(),
    future: [],
  }));
  const setState = useCallback<Dispatch<SetStateAction<PlanState>>>(
    (update) => dispatch({ type: 'set', update }),
    []
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
