import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalcResult, PlanState } from '../../types';
import { buildDiagramModel, type DiagramModel } from './diagramModel';
import { markEnd, markStart } from '../../shared/performanceMarks';

const WORKER_THRESHOLD = 80;
const EMPTY_MODEL: DiagramModel = {
  nodes: [],
  edges: [],
  pos: new Map(),
  width: 900,
  height: 500,
};

type WorkerResult = {
  result: CalcResult;
  state: PlanState;
  goalLabel: string;
  model: DiagramModel;
};

/**
 * Small and medium graphs stay synchronous to avoid worker startup overhead. Large layouts are
 * calculated away from the main thread; stale worker responses are ignored.
 */
export function useDiagramModel(result: CalcResult, state: PlanState, goalLabel: string) {
  const requestId = useRef(0);
  const synchronous = useMemo(
    () =>
      result.graphNodes.length < WORKER_THRESHOLD
        ? buildDiagramModel(result, state, goalLabel)
        : null,
    [goalLabel, result, state]
  );
  const fallback = useMemo(
    () =>
      !synchronous && typeof Worker === 'undefined'
        ? buildDiagramModel(result, state, goalLabel)
        : null,
    [goalLabel, result, state, synchronous]
  );
  const [workerResult, setWorkerResult] = useState<WorkerResult | null>(null);
  const currentWorkerResult =
    workerResult?.result === result &&
    workerResult.state === state &&
    workerResult.goalLabel === goalLabel
      ? workerResult.model
      : null;

  useEffect(() => {
    if (synchronous || fallback || typeof Worker === 'undefined') return;
    const currentRequest = ++requestId.current;
    const worker = new Worker(new URL('./diagramModel.worker.ts', import.meta.url), {
      type: 'module',
    });
    const measurement = `coi-diagram-worker-${currentRequest}`;
    markStart(measurement);
    worker.onmessage = (event: MessageEvent<{ requestId: number; model: DiagramModel }>) => {
      if (event.data.requestId !== currentRequest) return;
      markEnd(measurement);
      setWorkerResult({ result, state, goalLabel, model: event.data.model });
      worker.terminate();
    };
    worker.onerror = () => {
      if (requestId.current !== currentRequest) return;
      markEnd(measurement);
      setWorkerResult({
        result,
        state,
        goalLabel,
        model: buildDiagramModel(result, state, goalLabel),
      });
      worker.terminate();
    };
    worker.postMessage({ requestId: currentRequest, result, state, goalLabel });
    return () => worker.terminate();
  }, [fallback, goalLabel, result, state, synchronous]);

  const model = synchronous || fallback || currentWorkerResult || EMPTY_MODEL;
  return { model, pending: model === EMPTY_MODEL };
}
