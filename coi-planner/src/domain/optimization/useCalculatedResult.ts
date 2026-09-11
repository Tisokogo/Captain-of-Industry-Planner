import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalcResult, PlanState } from '../../types';
import { calculate } from './heuristicOptimizer';
import { markEnd, markStart } from '../../shared/performanceMarks';

type WorkerResult = { state: PlanState; result: CalcResult };

/** Expensive recipe optimization runs on demand off the UI thread. */
export function useCalculatedResult(state: PlanState) {
  const requestId = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const optimized = state.optimization?.enabled === true;
  const synchronous = useMemo(() => (!optimized ? calculate(state) : null), [optimized, state]);
  const baseline = useMemo(
    () =>
      optimized
        ? calculate({
            ...state,
            optimization: state.optimization
              ? { ...state.optimization, enabled: false }
              : undefined,
          })
        : null,
    [optimized, state]
  );
  const fallback = useMemo(
    () => (optimized && typeof Worker === 'undefined' ? calculate(state) : null),
    [optimized, state]
  );
  const [workerResult, setWorkerResult] = useState<WorkerResult | null>(null);
  const currentResult = workerResult?.state === state ? workerResult.result : null;

  useEffect(() => {
    if (!optimized || typeof Worker === 'undefined') return;
    const currentRequest = ++requestId.current;
    const worker =
      workerRef.current ||
      new Worker(new URL('./calculation.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const measurement = `coi-optimization-worker-${currentRequest}`;
    markStart(measurement);
    worker.onmessage = (event: MessageEvent<{ requestId: number; result: CalcResult }>) => {
      if (event.data.requestId !== currentRequest) return;
      markEnd(measurement);
      setWorkerResult({ state, result: event.data.result });
    };
    worker.onerror = () => {
      if (requestId.current !== currentRequest) return;
      worker.terminate();
      workerRef.current = null;
      setWorkerResult({ state, result: calculate(state) });
    };
    worker.postMessage({ requestId: currentRequest, state });
  }, [optimized, state]);
  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    []
  );

  const result = synchronous || currentResult || fallback || baseline!;
  return { result, pending: optimized && !currentResult && !fallback };
}
