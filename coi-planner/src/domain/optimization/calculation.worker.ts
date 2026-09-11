/// <reference lib="webworker" />

import { calculate } from './heuristicOptimizer';
import type { PlanState } from '../../types';

type Request = { requestId: number; state: PlanState };

self.onmessage = (event: MessageEvent<Request>) => {
  const { requestId, state } = event.data;
  const startedAt = performance.now();
  const result = calculate(state);
  self.postMessage({ requestId, result, duration: performance.now() - startedAt });
};
