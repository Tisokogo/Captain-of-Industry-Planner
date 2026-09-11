import { z } from 'zod';
import {
  defaultOptimization,
  defaultRecipeFilter,
  defaultState,
  products,
  recipes,
} from '../../domain/solver/planCalculator';
import type { OutputDisposition, OutputDispositionType, PlanState } from '../../types';

export const CURRENT_PLAN_VERSION = 4;

const rawPlanSchema = z
  .object({
    goals: z.array(z.unknown()).default([]),
    recipeChoices: z.record(z.string(), z.unknown()).default({}),
    expanded: z.record(z.string(), z.unknown()).optional(),
    autoExpandChain: z.boolean().optional(),
    includeByproducts: z.boolean().optional(),
    diagramCompact: z.record(z.string(), z.unknown()).optional(),
    externalSources: z.record(z.string(), z.unknown()).optional(),
    outputSinks: z.record(z.string(), z.unknown()).optional(),
    outputDispositions: z.record(z.string(), z.unknown()).optional(),
    recipeFilter: z.unknown().optional(),
    optimization: z.unknown().optional(),
    diagramPositions: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();

const exportSchema = z
  .object({
    format: z.string().optional(),
    version: z.coerce.number().int().positive().optional(),
    state: rawPlanSchema,
  })
  .loose();

const goalSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  rate: z.number().positive().finite(),
});

const dispositionSchema = z
  .object({
    type: z.enum([
      'unassigned',
      'internal-reuse',
      'storage',
      'further-processing',
      'export',
      'dump',
      'flare',
      'wastewater',
      'emission',
    ]),
    recipeId: z.string().optional(),
    targetProductId: z.string().optional(),
    consumerProductId: z.string().optional(),
    consumerRecipeId: z.string().optional(),
    amountMode: z.enum(['all', 'capped']),
    maxRate: z.number().nonnegative().finite().optional(),
    facilityId: z.string().optional(),
    note: z.string().max(2_000).optional(),
  })
  .strict();

const sourceSchema = z.enum(['unused', 'mine', 'ship', 'trade', 'storage', 'manual']);

type LegacyPlanState = PlanState & { outputSinks?: Record<string, string> };

export function normalizeState(raw: LegacyPlanState): PlanState {
  const legacyProgression = raw.recipeFilter && !raw.recipeFilter.progressionVersion;
  const migrated = { ...(raw.outputDispositions || {}) };
  for (const [id, value] of Object.entries(raw.outputSinks || {})) {
    if (!migrated[id]) {
      migrated[id] = {
        type: (value === 'recycle'
          ? 'internal-reuse'
          : value || 'unassigned') as OutputDispositionType,
        amountMode: 'all',
      };
    }
  }
  const current = { ...raw };
  delete current.outputSinks;
  return {
    ...defaultState(),
    ...current,
    outputDispositions: migrated,
    recipeFilter: {
      ...defaultRecipeFilter(),
      ...(raw.recipeFilter || {}),
      enabledTechTiers: legacyProgression
        ? [0, 1, 2, 3, 4, 5]
        : raw.recipeFilter?.enabledTechTiers || [0, 1, 2, 3, 4, 5],
      progressionVersion: 2,
    },
    optimization: { ...defaultOptimization(), ...(raw.optimization || {}) },
  };
}

export function sanitizeImported(value: unknown): { state: PlanState; report: string[] } {
  const wrapperResult = exportSchema.safeParse(value);
  const directResult = rawPlanSchema.safeParse(value);
  if (!wrapperResult.success && !directResult.success) throw new Error('INVALID_PLAN_SCHEMA');

  const wrapper = wrapperResult.success ? wrapperResult.data : undefined;
  const raw = (wrapper?.state ?? directResult.data) as z.infer<typeof rawPlanSchema>;
  const report: string[] = [];
  if (wrapper?.version && wrapper.version < CURRENT_PLAN_VERSION) {
    report.push(`Format ${wrapper.version} auf Version ${CURRENT_PLAN_VERSION} migriert.`);
  }

  const goals = raw.goals.flatMap((candidate) => {
    const parsed = goalSchema.safeParse(candidate);
    if (!parsed.success || !products[parsed.data.productId]) {
      report.push('Ungültiges Produktionsziel ignoriert.');
      return [];
    }
    return [parsed.data];
  });
  if (!goals.length) throw new Error('PLAN_REQUIRES_VALID_GOAL');

  const recipeChoices: Record<string, string> = {};
  for (const [productId, candidate] of Object.entries(raw.recipeChoices)) {
    if (products[productId] && typeof candidate === 'string' && recipes[candidate]) {
      recipeChoices[productId] = candidate;
    } else {
      report.push(`Unbekannte Rezeptwahl entfernt: ${productId}`);
    }
  }

  const outputDispositions: Record<string, OutputDisposition> = {};
  for (const [productId, candidate] of Object.entries(raw.outputDispositions || {})) {
    const parsed = dispositionSchema.safeParse(candidate);
    if (products[productId] && parsed.success) {
      outputDispositions[productId] = parsed.data;
    } else {
      report.push(`Ungültige Ausgangsroute entfernt: ${productId}`);
    }
  }

  const externalSources: Record<string, string> = {};
  for (const [productId, candidate] of Object.entries(raw.externalSources || {})) {
    const parsed = sourceSchema.safeParse(candidate);
    if (products[productId] && parsed.success) {
      externalSources[productId] = parsed.data;
    } else {
      report.push(`Ungültige externe Herkunft entfernt: ${productId}`);
    }
  }

  const state = normalizeState({
    ...(raw as Partial<PlanState>),
    goals,
    recipeChoices,
    outputDispositions,
    externalSources,
    expanded:
      raw.expanded && typeof raw.expanded === 'object'
        ? Object.fromEntries(
            Object.entries(raw.expanded).filter(([, item]) => typeof item === 'boolean')
          )
        : {},
    diagramCompact:
      raw.diagramCompact && typeof raw.diagramCompact === 'object'
        ? Object.fromEntries(
            Object.entries(raw.diagramCompact).filter(([, item]) => typeof item === 'boolean')
          )
        : {},
    diagramPositions:
      raw.diagramPositions && typeof raw.diagramPositions === 'object'
        ? Object.fromEntries(
            Object.entries(raw.diagramPositions).flatMap(([id, value]) => {
              if (!value || typeof value !== 'object') return [];
              const { x, y } = value as { x?: unknown; y?: unknown };
              return typeof x === 'number' &&
                Number.isFinite(x) &&
                typeof y === 'number' &&
                Number.isFinite(y)
                ? [[id, { x, y }]]
                : [];
            })
          )
        : {},
    recipeFilter:
      raw.recipeFilter && typeof raw.recipeFilter === 'object'
        ? (raw.recipeFilter as PlanState['recipeFilter'])
        : defaultRecipeFilter(),
    optimization:
      raw.optimization && typeof raw.optimization === 'object'
        ? (raw.optimization as PlanState['optimization'])
        : defaultOptimization(),
  } as PlanState);

  report.push(
    `${goals.length} Ziele und ${Object.keys(recipeChoices).length} Rezeptwahlen importiert.`
  );
  return { state, report };
}
