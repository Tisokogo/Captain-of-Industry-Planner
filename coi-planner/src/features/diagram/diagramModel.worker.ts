/// <reference lib="webworker" />

import type { CalcResult, PlanState } from '../../types';
import { buildDiagramModel } from './diagramModel';

type Request = {
  requestId: number;
  result: CalcResult;
  state: PlanState;
  goalLabel: string;
};

self.onmessage = (event: MessageEvent<Request>) => {
  const { requestId, result, state, goalLabel } = event.data;
  const startedAt = performance.now();
  const model = buildDiagramModel(result, state, goalLabel);
  self.postMessage({ requestId, model, duration: performance.now() - startedAt });
};
