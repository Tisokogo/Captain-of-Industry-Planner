import { lazy, Suspense, useState, type Dispatch, type SetStateAction } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Factory,
  Filter,
  GitBranch,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  bestRecipe,
  calculate,
  defaultOptimization,
  iconProduct,
  machines,
  products,
} from '../../domain/solver/planCalculator';
import { productName, tr, type Lang } from '../../i18n';
import { GameImage as Img } from '../../shared/GameImage';
import type { OptimizationGoal, PlanState } from '../../types';

const MergedFlow = lazy(() =>
  import('../diagram/ProductionDiagram').then((module) => ({ default: module.MergedFlow }))
);
const SeparatedFlows = lazy(() =>
  import('../diagram/ProductionDiagram').then((module) => ({ default: module.SeparatedFlows }))
);
const Summary = lazy(() =>
  import('../summary/PlanSummary').then((module) => ({ default: module.Summary }))
);
const ResultListView = lazy(() =>
  import('./PlannerResultViews').then((module) => ({ default: module.ResultListView }))
);

export function Planner({
  lang,
  state,
  setState,
  result,
  onPicker,
  onRecipe,
  onFilter,
}: {
  lang: Lang;
  state: PlanState;
  setState: Dispatch<SetStateAction<PlanState>>;
  result: ReturnType<typeof calculate>;
  onPicker: () => void;
  onRecipe: (id: string) => void;
  onFilter: () => void;
}) {
  const [fitSignal, setFitSignal] = useState(0);
  const [view, setView] = useState<'diagram' | 'materials' | 'buildings' | 'balance' | 'configure'>(
    'diagram'
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return (
    <main className="planner-grid">
      <aside className="left-panel panel">
        <div className="panel-title">
          <span>
            <Sparkles />
            {tr(lang, 'productionGoals')}
          </span>
          <b>{state.goals.length}</b>
        </div>
        <div className="goal-list">
          {state.goals.map((g, i) => {
            const p = products[g.productId];
            const r = bestRecipe(
              g.productId,
              state.recipeChoices,
              state.recipeFilter,
              state.optimization
            );
            return (
              <div className="goal-card" key={g.id}>
                <div className="goal-head">
                  <span className="step">{i + 1}</span>
                  <Img src={iconProduct(g.productId)} />
                  <div>
                    <b>{productName(p.id, p.name, lang)}</b>
                    <small>{r ? machines[r.machine]?.name : tr(lang, 'noRecipe')}</small>
                  </div>
                  <button
                    aria-label={`${productName(p.id, p.name, lang)} entfernen`}
                    onClick={() =>
                      setState((s) => ({ ...s, goals: s.goals.filter((x) => x.id !== g.id) }))
                    }
                  >
                    <X />
                  </button>
                </div>
                <label>
                  {tr(lang, 'targetRate')}
                  <div className="rate-input">
                    <button
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          goals: s.goals.map((x) =>
                            x.id === g.id ? { ...x, rate: Math.max(0.1, x.rate - 1) } : x
                          ),
                        }))
                      }
                    >
                      <Minus />
                    </button>
                    <input
                      type="number"
                      min=".1"
                      value={g.rate}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          goals: s.goals.map((x) =>
                            x.id === g.id ? { ...x, rate: +e.target.value || 0 } : x
                          ),
                        }))
                      }
                    />
                    <span>/ min</span>
                    <button
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          goals: s.goals.map((x) =>
                            x.id === g.id ? { ...x, rate: x.rate + 1 } : x
                          ),
                        }))
                      }
                    >
                      <Plus />
                    </button>
                  </div>
                </label>
                {r && (
                  <button className="recipe-choice" onClick={() => onRecipe(g.productId)}>
                    <Settings2 />
                    <span>{r.name}</span>
                    <ChevronRight />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button className="add-goal" onClick={onPicker}>
          <Plus />
          {tr(lang, 'addProduct')}
        </button>
        <button
          className={`advanced-toggle ${advancedOpen ? 'open' : ''}`}
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
        >
          <Settings2 />
          <span>
            <b>{lang === 'de' ? 'Erweiterte Einstellungen' : 'Advanced settings'}</b>
            <small>
              {lang === 'de'
                ? 'Rezepte, Nebenprodukte und Optimierung'
                : 'Recipes, byproducts and optimization'}
            </small>
          </span>
          {advancedOpen ? <ChevronDown /> : <ChevronRight />}
        </button>
        {advancedOpen && (
          <div className="settings-card">
            <h3>
              <Settings2 />
              {tr(lang, 'settings')}
            </h3>
            <label>
              <span>{tr(lang, 'autoExpand')}</span>
              <input
                type="checkbox"
                checked={state.autoExpandChain !== false}
                onChange={(e) => setState((s) => ({ ...s, autoExpandChain: e.target.checked }))}
              />
            </label>
            <label>
              <span>{tr(lang, 'byproducts')}</span>
              <input
                type="checkbox"
                checked={state.includeByproducts !== false}
                onChange={(e) => setState((s) => ({ ...s, includeByproducts: e.target.checked }))}
              />
            </label>
            <button className="settings-filter" onClick={onFilter}>
              <Filter />
              <span>
                <b>{lang === 'de' ? 'Rezeptverfügbarkeit' : 'Recipe availability'}</b>
                <small>
                  {state.recipeFilter?.profileName ? `${state.recipeFilter.profileName} · ` : ''}
                  {state.recipeFilter?.disabledRecipeIds.length || 0} deaktiviert · T
                  {Math.max(...(state.recipeFilter?.enabledTechTiers || [0]))}
                </small>
              </span>
              <ChevronRight />
            </button>
            <label className="optimization-switch">
              <span>{lang === 'de' ? 'Automatische Optimierung' : 'Automatic optimization'}</span>
              <input
                type="checkbox"
                checked={state.optimization?.enabled || false}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    optimization: {
                      ...(s.optimization || defaultOptimization()),
                      enabled: e.target.checked,
                    },
                  }))
                }
              />
            </label>
            {state.optimization?.enabled && (
              <select
                className="optimization-select"
                value={state.optimization.goal}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    optimization: {
                      ...(s.optimization || defaultOptimization()),
                      goal: e.target.value as OptimizationGoal,
                    },
                  }))
                }
              >
                <option value="minimizeWorkers">
                  {lang === 'de' ? 'Arbeiter minimieren' : 'Minimize workers'}
                </option>
                <option value="minimizePower">
                  {lang === 'de' ? 'Strom minimieren' : 'Minimize power'}
                </option>
                <option value="minimizeMachines">
                  {lang === 'de' ? 'Maschinen minimieren' : 'Minimize machines'}
                </option>
                <option value="minimizeMaintenance">
                  {lang === 'de' ? 'Wartung minimieren' : 'Minimize maintenance'}
                </option>
                <option value="minimizeComputing">
                  {lang === 'de' ? 'Computing minimieren' : 'Minimize computing'}
                </option>
                <option value="maximizeProduction">
                  {lang === 'de' ? 'Produktion maximieren' : 'Maximize production'}
                </option>
              </select>
            )}
          </div>
        )}
      </aside>
      <section className="flow-panel panel">
        <div className="panel-title result-title">
          <span>
            {view === 'diagram' ? (
              <GitBranch />
            ) : view === 'buildings' ? (
              <Factory />
            ) : (
              <BarChart3 />
            )}
            {view === 'diagram'
              ? tr(lang, 'diagram')
              : view === 'materials'
                ? lang === 'de'
                  ? 'Materialien'
                  : 'Materials'
                : view === 'buildings'
                  ? tr(lang, 'buildings')
                  : view === 'balance'
                    ? lang === 'de'
                      ? 'Bilanz'
                      : 'Balance'
                    : lang === 'de'
                      ? 'Ein- und Ausgänge'
                      : 'Inputs and outputs'}
          </span>
          {view === 'diagram' && (
            <div className="flow-actions">
              <button
                className={`mini merge-toggle ${state.mergeGoals !== false ? 'on' : ''}`}
                onClick={() => setState((s) => ({ ...s, mergeGoals: s.mergeGoals === false }))}
              >
                <GitBranch />
                {state.mergeGoals !== false ? tr(lang, 'separateGoals') : tr(lang, 'mergeGoals')}
              </button>
              <button className="mini" onClick={() => setFitSignal((x) => x + 1)}>
                <RotateCcw />
                {tr(lang, 'fit')}
              </button>
            </div>
          )}
        </div>
        <div
          className="result-tabs"
          role="tablist"
          aria-label={lang === 'de' ? 'Ergebnisansicht' : 'Result view'}
        >
          {(
            [
              ['diagram', lang === 'de' ? 'Diagramm' : 'Diagram'],
              ['materials', lang === 'de' ? 'Materialien' : 'Materials'],
              ['buildings', lang === 'de' ? 'Gebäude' : 'Buildings'],
              ['balance', lang === 'de' ? 'Bilanz' : 'Balance'],
              ['configure', lang === 'de' ? 'Ein-/Ausgänge' : 'I/O setup'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <Suspense
          fallback={
            <div className="result-loading" role="status">
              {lang === 'de' ? 'Ansicht wird geladen …' : 'Loading view …'}
            </div>
          }
        >
          {!state.goals.length ? (
            <div className="empty">
              <GitBranch />
              <p>{tr(lang, 'empty')}</p>
            </div>
          ) : view === 'diagram' ? (
            <div
              className={`flow-canvas ${state.mergeGoals !== false ? 'flow-canvas--merged' : ''}`}
            >
              {state.mergeGoals !== false ? (
                <MergedFlow
                  result={result}
                  state={state}
                  setState={setState}
                  lang={lang}
                  onRecipe={onRecipe}
                  fitSignal={fitSignal}
                />
              ) : (
                <SeparatedFlows
                  result={result}
                  state={state}
                  setState={setState}
                  lang={lang}
                  onRecipe={onRecipe}
                  fitSignal={fitSignal}
                />
              )}
            </div>
          ) : view === 'configure' ? (
            <div className="result-scroll configuration-view">
              <Summary
                lang={lang}
                result={result}
                state={state}
                setState={setState}
                onFilter={onFilter}
              />
            </div>
          ) : (
            <ResultListView view={view} result={result} lang={lang} />
          )}
        </Suspense>
      </section>
    </main>
  );
}
