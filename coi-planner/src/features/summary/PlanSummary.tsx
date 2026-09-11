import { useState, type Dispatch, type SetStateAction } from 'react';
import { Box, ChevronDown, ChevronRight, Cpu, Factory, Filter, Zap } from 'lucide-react';
import {
  availableDispositions,
  bestRecipe,
  calculate,
  format,
  iconMachine,
  iconProduct,
  machines,
  products,
} from '../../domain/solver/planCalculator';
import { productName, tr, type Lang } from '../../i18n';
import { sourceOptions, sourceRequirementText } from '../external-sources/sourceOptions';
import { GameImage as Img } from '../../shared/GameImage';
import { diagnosticText } from '../../shared/diagnostics';
import type { OutputDisposition, OutputDispositionType, PlanState } from '../../types';

const dispositionLabel = (lang: Lang, type: OutputDispositionType, fallback: string) =>
  lang === 'de'
    ? fallback
    : (
        {
          unassigned: 'Not assigned',
          'internal-reuse': 'Internal reuse',
          storage: 'Store',
          'further-processing': 'Further processing',
          export: 'Export',
          dump: 'Dump',
          flare: 'Flare / vent',
          wastewater: 'Wastewater treatment',
          emission: 'Unavoidable emission',
        } as Record<OutputDispositionType, string>
      )[type];
export function Summary({
  lang,
  result,
  state,
  setState,
  onFilter,
}: {
  lang: Lang;
  result: ReturnType<typeof calculate>;
  state: PlanState;
  setState: Dispatch<SetStateAction<PlanState>>;
  onFilter: () => void;
}) {
  const [open, setOpen] = useState<'buildings' | 'inputs' | 'outputs' | null>('buildings');
  const groups = new Map<string, { count: number; power: number; workers: number }>();
  for (const x of result.machines) {
    const v = groups.get(x.machineId) || { count: 0, power: 0, workers: 0 };
    v.count += x.count;
    v.power += x.power;
    v.workers += x.workers;
    groups.set(x.machineId, v);
  }
  const inputs = Object.entries(result.inputs)
    .filter(([, v]) => v > 0.005)
    .map(([id, v]) => [id, v] as const)
    .sort((a, b) => b[1] - a[1]);
  const outs = Object.entries(result.grossSurplus)
    .filter(([, v]) => v > 0.005)
    .sort((a, b) => b[1] - a[1]);
  const setSource = (id: string, value: string) =>
    setState((s) => ({ ...s, externalSources: { ...(s.externalSources || {}), [id]: value } }));
  const setDisposition = (id: string, value: OutputDisposition) =>
    setState((s) => ({
      ...s,
      outputDispositions: { ...(s.outputDispositions || {}), [id]: value },
    }));
  return (
    <aside className="right-panel panel">
      <div className="panel-title">
        <span>
          <Box />
          {tr(lang, 'summary')}
        </span>
      </div>
      <div className="kpis">
        <div>
          <span>
            <Factory />
            {tr(lang, 'machines')}
          </span>
          <b>
            {format(
              result.machines.reduce((s, x) => s + x.count, 0),
              1
            )}
          </b>
        </div>
        <div>
          <span>
            <Zap />
            {tr(lang, 'power')}
          </span>
          <b>{format(result.power / 1000, 2)} MW</b>
        </div>
        <div>
          <span>♟ {tr(lang, 'workers')}</span>
          <b>{format(result.workers, 0)}</b>
        </div>
        <div>
          <span>
            <Cpu />
            Computing
          </span>
          <b>{format(result.computing, 1)}</b>
        </div>
        <div>
          <span>⚙ {lang === 'de' ? 'Wartung' : 'Maintenance'}</span>
          <b>{format(result.maintenance, 1)}</b>
        </div>
      </div>
      <div className={`solver-status solver-status--${result.solverMethod}`}>
        <span>
          {result.solverMethod === 'exact-linear'
            ? lang === 'de'
              ? 'Exakte lineare Materialbilanz'
              : 'Exact linear material balance'
            : result.solverMethod === 'exact-linear-constrained'
              ? lang === 'de'
                ? 'Exakter Kern · Constraint-Fixpunkt'
                : 'Exact core · constraint fixed point'
              : lang === 'de'
                ? 'Iterative Fallback-Bilanz'
                : 'Iterative fallback balance'}
        </span>
        <b>
          {lang === 'de' ? 'Residuum' : 'Residual'}: {format(result.solverResidual, 8)}
        </b>
      </div>
      {result.optimizationReport && (
        <div className="solver-status solver-status--optimization">
          <span>
            {result.optimizationReport.method === 'exact-enumeration'
              ? lang === 'de'
                ? 'Exakte Rezeptkombinationssuche'
                : 'Exact recipe-combination search'
              : lang === 'de'
                ? 'Heuristische Beam-Suche'
                : 'Heuristic beam search'}{' '}
            ·{' '}
            {result.optimizationReport.cacheHit
              ? lang === 'de'
                ? 'Rezeptwahl aus schnellem Cache'
                : 'recipe choice from fast cache'
              : `${result.optimizationReport.evaluatedPlans}/${result.optimizationReport.evaluationBudget} ${lang === 'de' ? 'Pläne geprüft' : 'plans evaluated'}`}
          </span>
          <b>
            {result.optimizationReport.optimality === 'proven'
              ? lang === 'de'
                ? 'Optimum für alle aktiven Rezeptalternativen bewiesen'
                : 'Optimum proven across all active recipe alternatives'
              : lang === 'de'
                ? 'Kein globaler Optimalitätsbeweis'
                : 'No global optimality proof'}{' '}
            · {result.optimizationReport.decisionNodes}{' '}
            {lang === 'de' ? 'Entscheidungsknoten' : 'decision nodes'}
          </b>
        </div>
      )}
      {result.constraintWarnings.length > 0 && (
        <div className="constraint-warnings">
          <b>{lang === 'de' ? 'Grenzwerte / Hinweise' : 'Constraints / notices'}</b>
          {result.constraintWarnings.map((warning, index) => (
            <span key={`${warning.code}:${index}`}>{diagnosticText(warning, lang)}</span>
          ))}
        </div>
      )}
      <SummarySection
        title={tr(lang, 'buildings')}
        count={groups.size}
        open={open === 'buildings'}
        toggle={() => setOpen(open === 'buildings' ? null : 'buildings')}
      >
        {[...groups]
          .sort((a, b) => b[1].count - a[1].count)
          .map(([id, v]) => (
            <Row
              key={id}
              img={iconMachine(id)}
              name={machines[id]?.name || id}
              value={`× ${format(v.count)}`}
            />
          ))}
      </SummarySection>
      <SummarySection
        title={tr(lang, 'rawInputs')}
        count={inputs.length}
        open={open === 'inputs'}
        toggle={() => setOpen(open === 'inputs' ? null : 'inputs')}
      >
        {inputs.map(([id, v]) => (
          <AssignmentRow
            key={id}
            img={iconProduct(id)}
            name={productName(id, products[id]?.name || id, lang)}
            value={`${format(v)} / min`}
            label={tr(lang, 'source')}
            selected={state.externalSources?.[id] || 'unused'}
            options={sourceOptions(lang, id)}
            detail={(() => {
              const r = result.externalRequirements.find((x) => x.productId === id);
              if (!r || r.source === 'unused') return undefined;
              return sourceRequirementText(lang, r);
            })()}
            change={(value) => setSource(id, value)}
            action={onFilter}
          />
        ))}
      </SummarySection>
      <SummarySection
        title={tr(lang, 'byproductOutput')}
        count={outs.length}
        open={open === 'outputs'}
        toggle={() => setOpen(open === 'outputs' ? null : 'outputs')}
      >
        {outs.length > 0 && (
          <div className="route-explanation">
            {lang === 'de'
              ? 'Intern wiederverwenden deckt einen bestehenden Bedarf direkt. Weiterverarbeiten startet das ausgewählte Folgerezept einschließlich Gebäude, Zusatzinputs und Folgeprodukten.'
              : 'Internal reuse directly covers existing demand. Further processing runs the selected follow-up recipe including its building, additional inputs, and subsequent products.'}
          </div>
        )}
        {outs.map(([id, v]) => (
          <OutputDispositionRow
            key={id}
            id={id}
            rate={v}
            lang={lang}
            state={state}
            result={result}
            value={
              state.outputDispositions?.[id] ||
              (() => {
                const automatic = result.outputRoutes.find(
                  (route) => route.productId === id && route.type !== 'emission'
                );
                return automatic
                  ? {
                      type: automatic.type,
                      amountMode: 'all' as const,
                      recipeId: automatic.recipeId,
                    }
                  : { type: 'unassigned' as const, amountMode: 'all' as const };
              })()
            }
            change={(value) => setDisposition(id, value)}
          />
        ))}
      </SummarySection>
    </aside>
  );
}
function OutputDispositionRow({
  id,
  rate,
  lang,
  state,
  result,
  value,
  change,
}: {
  id: string;
  rate: number;
  lang: Lang;
  state: PlanState;
  result: ReturnType<typeof calculate>;
  value: OutputDisposition;
  change: (v: OutputDisposition) => void;
}) {
  const environmentalEmission = id === 'air_pollution' || id === 'water_pollution';
  if (environmentalEmission) {
    return (
      <div className="assignment-row output-disposition">
        <div className="assignment-main">
          <Img src={iconProduct(id)} />
          <span>
            {productName(id, products[id]?.name || id, lang)}
            <small>
              {lang === 'de'
                ? 'Unvermeidbare Emission · entsteht automatisch'
                : 'Unavoidable emission · generated automatically'}
            </small>
          </span>
          <b>{format(rate)} / min</b>
        </div>
      </div>
    );
  }
  const consumers = [
      ...new Set(
        result.graphEdges
          .filter((e) => e.from === id && e.kind === 'input' && !e.to.startsWith('sink:'))
          .map((e) => e.to)
      ),
    ],
    hasDemand = consumers.length > 0,
    options = availableDispositions(id, state, hasDemand),
    selected = options.some((o) => o.type === value.type) ? value.type : 'unassigned',
    routes = options.find((o) => o.type === selected)?.routes || [];
  return (
    <div
      className={`assignment-row output-disposition ${selected === 'unassigned' ? 'open-output' : ''}`}
    >
      <div className="assignment-main">
        <Img src={iconProduct(id)} />
        <span>
          {productName(id, products[id]?.name || id, lang)}
          <small>
            {lang === 'de' ? 'Brutto' : 'Gross'} {format(rate)} ·{' '}
            {lang === 'de' ? 'zugewiesen' : 'assigned'} {format(result.assignedSurplus[id] || 0)} ·{' '}
            {lang === 'de' ? 'offen' : 'open'} {format(result.openSurplus[id] || 0)}/min
          </small>
        </span>
        <b className="green">+{format(result.openSurplus[id] || 0)} / min</b>
      </div>
      <label>
        <span>{tr(lang, 'destination')}</span>
        <select
          value={selected}
          onChange={(e) => {
            const type = e.target.value as OutputDispositionType,
              route = options.find((o) => o.type === type)?.routes[0];
            change(
              type === 'storage' || type === 'export'
                ? { type, amountMode: 'all', facilityId: route?.id }
                : { type, amountMode: 'all', recipeId: route?.id }
            );
          }}
        >
          {options.map((o) => (
            <option value={o.type} key={o.type}>
              {dispositionLabel(lang, o.type, o.label)}
            </option>
          ))}
        </select>
      </label>
      {selected === 'internal-reuse' && consumers.length > 0 && (
        <label>
          <span>{lang === 'de' ? 'Verbraucher' : 'Consumer'}</span>
          <select
            value={value.consumerProductId || ''}
            onChange={(e) =>
              change({
                ...value,
                type: selected,
                consumerProductId: e.target.value || undefined,
                consumerRecipeId: e.target.value
                  ? bestRecipe(
                      e.target.value,
                      state.recipeChoices,
                      state.recipeFilter,
                      state.optimization
                    )?.id
                  : undefined,
              })
            }
          >
            <option value="">
              {lang === 'de' ? 'Automatisch verteilen' : 'Distribute automatically'}
            </option>
            {consumers.map((cid) => (
              <option value={cid} key={cid}>
                {productName(cid, products[cid]?.name || cid, lang)} ·{' '}
                {bestRecipe(cid, state.recipeChoices, state.recipeFilter, state.optimization)
                  ?.name || 'extern'}
              </option>
            ))}
          </select>
        </label>
      )}
      {routes.length > 0 && selected !== 'unassigned' && selected !== 'internal-reuse' && (
        <label>
          <span>Route</span>
          <select
            value={
              (selected === 'storage' || selected === 'export'
                ? value.facilityId
                : value.recipeId) || routes[0]?.id
            }
            onChange={(e) =>
              change(
                selected === 'storage' || selected === 'export'
                  ? { ...value, type: selected, facilityId: e.target.value }
                  : { ...value, type: selected, recipeId: e.target.value }
              )
            }
          >
            {routes.map((r) => (
              <option value={r.id} key={r.id}>
                {r.name} · {machines[r.machine]?.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span>{lang === 'de' ? 'Menge' : 'Amount'}</span>
        <select
          value={value.amountMode}
          onChange={(e) =>
            change({ ...value, type: selected, amountMode: e.target.value as 'all' | 'capped' })
          }
        >
          <option value="all">{lang === 'de' ? 'Gesamter Überschuss' : 'All surplus'}</option>
          <option value="capped">{lang === 'de' ? 'Begrenzen' : 'Cap amount'}</option>
        </select>
        {value.amountMode === 'capped' && (
          <input
            className="cap-input"
            type="number"
            min="0"
            max={rate}
            value={value.maxRate ?? rate}
            onChange={(e) => change({ ...value, type: selected, maxRate: Number(e.target.value) })}
          />
        )}
      </label>
    </div>
  );
}
function AssignmentRow({
  img,
  name,
  value,
  label,
  selected,
  options,
  change,
  action,
  detail,
  green = false,
}: {
  img: string;
  name: string;
  value: string;
  label: string;
  selected: string;
  options: { id: string; label: string }[];
  change: (v: string) => void;
  action?: () => void;
  detail?: string;
  green?: boolean;
}) {
  return (
    <div className="assignment-row">
      <div className="assignment-main">
        <Img src={img} />
        <span>{name}</span>
        <b className={green ? 'green' : ''}>{value}</b>
      </div>
      {detail && <small className="source-detail">{detail}</small>}
      <label>
        <span>{label}</span>
        <select value={selected} onChange={(e) => change(e.target.value)}>
          {options.map((o) => (
            <option value={o.id} key={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {action && (
          <button title="Passende Rezepte filtern" onClick={action}>
            <Filter />
          </button>
        )}
      </label>
    </div>
  );
}

function SummarySection({
  title,
  count,
  open,
  toggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  toggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="summary-section">
      <button onClick={toggle} aria-expanded={open}>
        <span>
          {open ? <ChevronDown /> : <ChevronRight />}
          {title}
        </span>
        <b>{count}</b>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
function Row({
  img,
  name,
  value,
  green = false,
}: {
  img: string;
  name: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="summary-row">
      <Img src={img} />
      <span>{name}</span>
      <b className={green ? 'green' : ''}>{value}</b>
    </div>
  );
}
