export type FlowItem = { id: string; name: string; quantity: number };
export type Recipe = {
  id: string;
  name: string;
  machine: string;
  duration: number;
  inputs: FlowItem[];
  outputs: FlowItem[];
};
export type Product = {
  id: string;
  game_id?: string;
  name: string;
  icon: string;
  category_id?: string;
  recipes: { input: string[]; output: string[] };
};
export type Machine = {
  id: string;
  name: string;
  icon: string;
  category_id: string;
  category_name: string;
  isMine: boolean;
  isStorage: boolean;
  isFarm: boolean;
  workers: number;
  maintenance_cost_units: string | null;
  maintenance_cost_quantity: number;
  electricity_consumed: number;
  electricity_generated: number;
  computing_consumed: number;
  computing_generated: number;
  recipes: string[];
};
export type Goal = { id: string; productId: string; rate: number };
export type RecipeSort =
  'name' | 'input' | 'output' | 'workers' | 'power' | 'computing' | 'techLevel';
export type OptimizationGoal =
  | 'minimizeWorkers'
  | 'minimizePower'
  | 'minimizeMachines'
  | 'minimizeMaintenance'
  | 'minimizeComputing'
  | 'maximizeProduction';
export type RecipeFilterState = {
  disabledRecipeIds: string[];
  onlyUnlockedRecipes: boolean;
  enabledTechTiers: number[];
  machineFilter: string | 'all';
  maxVisibleTechTier: number | null;
  sortBy: RecipeSort;
  showDisabledOnly: boolean;
  allowedExceptions: string[];
  profileName?: string;
  progressionVersion?: number;
};
export type OptimizationState = {
  enabled: boolean;
  goal: OptimizationGoal;
  maxWorkers: number | null;
  maxPower: number | null;
  maxMachines: number | null;
  maxComputing: number | null;
  maxMaintenance: number | null;
  resourceLimits: Record<string, number>;
};
export type OutputDispositionType =
  | 'unassigned'
  | 'internal-reuse'
  | 'storage'
  | 'further-processing'
  | 'export'
  | 'dump'
  | 'flare'
  | 'wastewater'
  | 'emission';
export type OutputDisposition = {
  type: OutputDispositionType;
  recipeId?: string;
  targetProductId?: string;
  consumerProductId?: string;
  consumerRecipeId?: string;
  amountMode: 'all' | 'capped';
  maxRate?: number;
  facilityId?: string;
  note?: string;
};
export type PlanState = {
  goals: Goal[];
  recipeChoices: Record<string, string>;
  expanded: Record<string, boolean>;
  diagramCompact?: Record<string, boolean>;
  mergeGoals?: boolean;
  autoExpandChain?: boolean;
  includeByproducts?: boolean;
  externalSources?: Record<string, string>;
  outputDispositions?: Record<string, OutputDisposition>;
  recipeFilter?: RecipeFilterState;
  optimization?: OptimizationState;
  diagramPositions?: Record<string, { x: number; y: number }>;
};
export type MachineTotal = {
  machineId: string;
  recipeId: string;
  count: number;
  power: number;
  workers: number;
};
export type GraphNode = {
  productId: string;
  rate: number;
  recipeId?: string;
  machines: number;
  stage: number;
  external: boolean;
};
export type GraphEdge = {
  from: string;
  to: string;
  rate: number;
  kind: 'input' | 'goal' | 'byproduct' | 'reuse' | 'sink';
  goalId?: string;
  label?: string;
};
export type OutputRouteResult = {
  routeId: string;
  productId: string;
  type: OutputDispositionType;
  rate: number;
  recipeId?: string;
  label: string;
  valid: boolean;
};
export type ExternalAssumptionCode =
  | 'source.mineEstimate'
  | 'source.shipEstimate'
  | 'source.tradeEstimate'
  | 'source.storageBuffer'
  | 'source.manual'
  | 'source.unassigned';

export type ExternalRequirement = {
  productId: string;
  source: string;
  rate: number;
  facilityCount: number;
  vehicleCount: number;
  unityPerMinute: number;
  bufferCapacity: number;
  assumptionCode: ExternalAssumptionCode;
};
export type DiagnosticCode =
  | 'solver.nonConverged'
  | 'solver.jobLimit'
  | 'solver.routeLimit'
  | 'solver.balanceResidual'
  | 'data.unknownCapacity'
  | 'route.invalidDisposition'
  | 'source.missing'
  | 'constraint.exceeded';

export type Diagnostic = {
  code: DiagnosticCode;
  params?: Record<string, string | number>;
};

export type OptimizationReport = {
  method: 'bounded-beam-search' | 'exact-enumeration';
  optimality: 'heuristic' | 'proven';
  evaluatedPlans: number;
  decisionNodes: number;
  beamWidth: number;
  evaluationBudget: number;
  constraintViolation: number;
  objectiveValue: number;
  cacheHit?: boolean;
};

export type CalcResult = {
  machines: MachineTotal[];
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  net: Record<string, number>;
  grossSurplus: Record<string, number>;
  assignedSurplus: Record<string, number>;
  openSurplus: Record<string, number>;
  balanceResiduals: Record<string, number>;
  power: number;
  workers: number;
  computing: number;
  maintenance: number;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  outputRoutes: OutputRouteResult[];
  externalRequirements: ExternalRequirement[];
  constraintWarnings: Diagnostic[];
  solverWarnings: Diagnostic[];
  solverMethod: 'exact-linear' | 'exact-linear-constrained' | 'iterative-fallback';
  solverResidual: number;
  optimizationReport?: OptimizationReport;
};
