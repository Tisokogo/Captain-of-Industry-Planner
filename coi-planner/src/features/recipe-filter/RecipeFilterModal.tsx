import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Cpu, Filter, Plus, Save, Search, Users, X, Zap } from 'lucide-react';
import {
  calculate,
  defaultOptimization,
  defaultRecipeFilter,
  format,
  iconProduct,
  machines,
  products,
  recipeOptions,
  recipeProgression,
  recipeTechTier,
  recipes,
  searchableProducts,
  tierLabels,
} from '../../domain/solver/planCalculator';
import { productName, tr, type Lang } from '../../i18n';
import { GameImage as Img } from '../../shared/GameImage';
import { useDialogFocus } from '../../shared/useDialogFocus';
import type { OptimizationGoal, PlanState, RecipeFilterState } from '../../types';

const allProducts = searchableProducts();
const allRecipes = [
  ...new Map(allProducts.flatMap((p) => recipeOptions(p.id)).map((r) => [r.id, r])).values(),
];

export function RecipeFilterModal({
  lang,
  state,
  close,
  apply,
}: {
  lang: Lang;
  state: PlanState;
  close: () => void;
  apply: (f: RecipeFilterState, o: NonNullable<PlanState['optimization']>) => void;
}) {
  const [draft, setDraft] = useState<RecipeFilterState>({
    ...defaultRecipeFilter(),
    ...(state.recipeFilter || {}),
  });
  const [opt, setOpt] = useState({ ...defaultOptimization(), ...(state.optimization || {}) });
  const [q, setQ] = useState('');
  const [conflictMode, setConflictMode] = useState<'replace' | 'exception' | 'block'>('replace');
  const [machine, setMachine] = useState(state.recipeFilter?.machineFilter || 'all');
  const [tech, setTech] = useState<number | null>(state.recipeFilter?.maxVisibleTechTier ?? null);
  const [resourceId, setResourceId] = useState('');
  const [resourceLimit, setResourceLimit] = useState('');
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState(new Set(draft.enabledTechTiers));
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, close);
  const conflicts = Object.values(state.recipeChoices).filter(
    (id) => draft.disabledRecipeIds.includes(id) && !draft.allowedExceptions.includes(id)
  );
  const machineList = useMemo(
    () =>
      [...new Set(allRecipes.map((r) => r.machine))].sort((a, b) =>
        (machines[a]?.name || a).localeCompare(machines[b]?.name || b)
      ),
    []
  );
  const visible = useMemo(() => {
    const list = allRecipes.filter((r) => {
      const text =
        `${r.name} ${r.id} ${machines[r.machine]?.name || ''} ${r.inputs.map((x) => x.name).join(' ')} ${r.outputs.map((x) => x.name).join(' ')}`.toLowerCase();
      return (
        (!q || text.includes(q.toLowerCase())) &&
        (machine === 'all' || r.machine === machine) &&
        (tech == null || recipeTechTier(r) <= tech) &&
        (!draft.showDisabledOnly || draft.disabledRecipeIds.includes(r.id))
      );
    });
    return list.sort((a, b) => {
      const ma = machines[a.machine],
        mb = machines[b.machine];
      switch (draft.sortBy) {
        case 'input':
          return (a.inputs[0]?.name || '').localeCompare(b.inputs[0]?.name || '');
        case 'output':
          return (a.outputs[0]?.name || '').localeCompare(b.outputs[0]?.name || '');
        case 'workers':
          return (ma?.workers || 0) - (mb?.workers || 0);
        case 'power':
          return (ma?.electricity_consumed || 0) - (mb?.electricity_consumed || 0);
        case 'computing':
          return (ma?.computing_consumed || 0) - (mb?.computing_consumed || 0);
        case 'techLevel':
          return recipeTechTier(a) - recipeTechTier(b);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [q, machine, tech, draft.showDisabledOnly, draft.sortBy, draft.disabledRecipeIds]);
  const toggle = (id: string) =>
    setDraft((f) => {
      const enabling = f.disabledRecipeIds.includes(id),
        tier = recipeTechTier(recipes[id]);
      return {
        ...f,
        disabledRecipeIds: enabling
          ? f.disabledRecipeIds.filter((x) => x !== id)
          : [...f.disabledRecipeIds, id],
        allowedExceptions:
          enabling && !f.enabledTechTiers.includes(tier)
            ? [...new Set([...f.allowedExceptions, id])]
            : f.allowedExceptions.filter((x) => x !== id),
      };
    });
  const before = useMemo(() => calculate(state), [state]);
  const after = useMemo(
    () => calculate({ ...state, recipeFilter: draft, optimization: opt }),
    [state, draft, opt]
  );
  const alternatives = useMemo(() => {
    if (!showAlternatives) return [];
    const raw = (
        [
          'minimizeWorkers',
          'minimizePower',
          'minimizeMachines',
          'minimizeMaintenance',
          'minimizeComputing',
          'maximizeProduction',
        ] as OptimizationGoal[]
      ).map((goal) => ({
        goal,
        result: calculate({
          ...state,
          recipeFilter: draft,
          optimization: { ...opt, enabled: true, goal },
        }),
      })),
      signature = (r: ReturnType<typeof calculate>) =>
        r.machines
          .map((x) => `${x.recipeId}:${x.count.toFixed(5)}`)
          .sort()
          .join('|');
    return raw.map((a, i) => ({
      ...a,
      duplicateOf: raw.findIndex((b, j) => j < i && signature(b.result) === signature(a.result)),
    }));
  }, [state, draft, opt, showAlternatives]);
  const applyTiers = () => {
    const enabled = [...selectedTiers];
    setDraft((f) => ({
      ...f,
      enabledTechTiers: enabled,
      disabledRecipeIds: allRecipes
        .filter((r) => !selectedTiers.has(recipeTechTier(r)))
        .map((r) => r.id),
      allowedExceptions: [],
    }));
  };
  const saveProfile = () => {
    const name = window.prompt(lang === 'de' ? 'Profilname' : 'Profile name');
    if (!name) return;
    const profiles = JSON.parse(localStorage.getItem('harbor-filter-profiles') || '[]');
    localStorage.setItem(
      'harbor-filter-profiles',
      JSON.stringify([
        { name, filter: draft },
        ...profiles.filter((p: { name: string }) => p.name !== name),
      ])
    );
  };
  const loadProfile = (key: string) => {
    if (!key) return;
    if (key.startsWith('tier')) {
      const max = Number(key.slice(4)),
        tiers = Array.from({ length: max + 1 }, (_, i) => i);
      setSelectedTiers(new Set(tiers));
      setDraft((f) => ({
        ...f,
        profileName: `T0–T${max}`,
        enabledTechTiers: tiers,
        disabledRecipeIds: allRecipes.filter((r) => recipeTechTier(r) > max).map((r) => r.id),
      }));
      return;
    }
    const profiles = JSON.parse(localStorage.getItem('harbor-filter-profiles') || '[]');
    const p = profiles.find((x: { name: string }) => x.name === key);
    if (p) {
      const legacy = !p.filter.progressionVersion,
        loaded = {
          ...defaultRecipeFilter(),
          ...p.filter,
          enabledTechTiers: legacy ? [0, 1, 2, 3, 4, 5] : p.filter.enabledTechTiers,
          progressionVersion: 2,
        };
      setDraft(loaded);
      setSelectedTiers(new Set(loaded.enabledTechTiers));
    }
  };
  const profiles: { name: string }[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('harbor-filter-profiles') || '[]');
    } catch {
      return [];
    }
  })();
  return (
    <div className="modal-back">
      <div
        className="filter-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-filter-title"
        tabIndex={-1}
      >
        <div className="modal-title">
          <div>
            <h2 id="recipe-filter-title">
              <Filter /> {lang === 'de' ? 'Rezeptfilter' : 'Recipe filters'}
            </h2>
            <small>
              {allRecipes.length} Rezepte geprüft · Forschungs-, Maschinen- und Variantenstufe
              getrennt · T0 bis T5 durchgängig
            </small>
          </div>
          <button onClick={close} aria-label={tr(lang, 'close')}>
            <X />
          </button>
        </div>
        <div className="filter-tools">
          <div className="filter-profile">
            <select
              aria-label={lang === 'de' ? 'Filterprofil laden' : 'Load filter profile'}
              defaultValue=""
              onChange={(e) => loadProfile(e.target.value)}
            >
              <option value="">Filterprofil laden …</option>
              <option value="tier1">Frühes Spiel · T0–T1</option>
              <option value="tier2">Mittleres Spiel · T0–T2</option>
              <option value="tier3">Spätes Spiel · T0–T3</option>
              {profiles.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
            <button onClick={saveProfile}>
              <Save /> Profil speichern
            </button>
          </div>
          <div className="search filter-search">
            <Search />
            <input
              autoFocus
              placeholder="Rezepte, Maschinen oder Produkte suchen …"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="tier-row">
            <b>TECH-STUFEN</b>
            <button
              className={selectedTiers.size === 6 ? 'active' : ''}
              onClick={() => setSelectedTiers(new Set([0, 1, 2, 3, 4, 5]))}
            >
              Alle
            </button>
            {[0, 1, 2, 3, 4, 5].map((t) => (
              <button
                title={tierLabels[t]}
                key={t}
                className={selectedTiers.has(t) ? 'active' : ''}
                onClick={() =>
                  setSelectedTiers((s) => {
                    const n = new Set(s);
                    if (n.has(t)) n.delete(t);
                    else n.add(t);
                    return n;
                  })
                }
              >
                {tierLabels[t]}
              </button>
            ))}
            <button className="apply-tier" onClick={applyTiers}>
              Stufen anwenden
            </button>
          </div>
          <div className="filter-actions">
            <button
              onClick={() => {
                setSelectedTiers(new Set([0, 1, 2, 3, 4, 5]));
                setDraft((f) => ({
                  ...f,
                  disabledRecipeIds: [],
                  enabledTechTiers: [0, 1, 2, 3, 4, 5],
                  allowedExceptions: [],
                }));
              }}
            >
              ✓ Alle aktivieren
            </button>
            <button
              className="disable"
              onClick={() =>
                setDraft((f) => ({
                  ...f,
                  disabledRecipeIds: [
                    ...new Set([...f.disabledRecipeIds, ...visible.map((r) => r.id)]),
                  ],
                  allowedExceptions: f.allowedExceptions.filter(
                    (id) => !visible.some((r) => r.id === id)
                  ),
                }))
              }
            >
              ✕ Gefilterte deaktivieren
            </button>
            <label>
              <input
                type="checkbox"
                checked={draft.showDisabledOnly}
                onChange={(e) => setDraft((f) => ({ ...f, showDisabledOnly: e.target.checked }))}
              />{' '}
              Nur deaktivierte
            </label>
            <label title="Startrezepte und Rezepte mit einer expliziten Forschungszuordnung bleiben aktiv.">
              <input
                type="checkbox"
                checked={draft.onlyUnlockedRecipes}
                onChange={(e) => setDraft((f) => ({ ...f, onlyUnlockedRecipes: e.target.checked }))}
              />{' '}
              Nur freigeschaltete aktiv
            </label>
          </div>
          <div className="filter-selects">
            <label>
              Sortierung
              <select
                value={draft.sortBy}
                onChange={(e) =>
                  setDraft((f) => ({ ...f, sortBy: e.target.value as RecipeFilterState['sortBy'] }))
                }
              >
                <option value="name">Name A–Z</option>
                <option value="input">Eingangsprodukt</option>
                <option value="output">Ausgangsprodukt</option>
                <option value="workers">Arbeiter ↑</option>
                <option value="power">Strom ↑</option>
                <option value="computing">Computing ↑</option>
                <option value="techLevel">Tech-Stufe ↑</option>
              </select>
            </label>
            <label>
              Maschine
              <select
                value={machine}
                onChange={(e) => {
                  setMachine(e.target.value);
                  setDraft((f) => ({ ...f, machineFilter: e.target.value }));
                }}
              >
                <option value="all">Alle Maschinen</option>
                {machineList.map((id) => (
                  <option value={id} key={id}>
                    {machines[id]?.name || id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tech-Filter
              <select
                value={tech ?? 'all'}
                onChange={(e) => {
                  const v = e.target.value === 'all' ? null : Number(e.target.value);
                  setTech(v);
                  setDraft((f) => ({ ...f, maxVisibleTechTier: v }));
                }}
              >
                <option value="all">Alle Stufen</option>
                {[0, 1, 2, 3, 4, 5].map((t) => (
                  <option value={t} key={t}>
                    T0–T{t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {conflicts.length > 0 && (
          <div className="filter-conflict">
            <b>{conflicts.length} manuelle Rezeptwahlen werden ungültig</b>
            <label>
              <input
                type="radio"
                checked={conflictMode === 'replace'}
                onChange={() => setConflictMode('replace')}
              />{' '}
              Automatisch ersetzen
            </label>
            <label>
              <input
                type="radio"
                checked={conflictMode === 'exception'}
                onChange={() => setConflictMode('exception')}
              />{' '}
              Als Ausnahme zulassen
            </label>
            <label>
              <input
                type="radio"
                checked={conflictMode === 'block'}
                onChange={() => setConflictMode('block')}
              />{' '}
              Erst Konflikte korrigieren
            </label>
          </div>
        )}
        <div className="filter-body">
          <div className="recipe-filter-list">
            {visible.map((r) => {
              const disabled = draft.disabledRecipeIds.includes(r.id),
                m = machines[r.machine];
              return (
                <button
                  className={disabled ? 'disabled' : ''}
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  aria-pressed={!disabled}
                  aria-label={`${disabled ? (lang === 'de' ? 'Aktivieren' : 'Enable') : lang === 'de' ? 'Deaktivieren' : 'Disable'}: ${r.name}`}
                >
                  <span className="recipe-enabled-mark" aria-hidden="true">
                    {disabled ? '✕' : '✓'}
                  </span>
                  <em
                    title={recipeProgression[r.id]?.unlockResearchName || 'Progressionszuordnung'}
                  >
                    T{recipeTechTier(r)}
                  </em>
                  <div className="mini-flow">
                    <span>
                      {r.inputs.slice(0, 3).map((x) => (
                        <Img key={x.id} src={iconProduct(x.id)} />
                      ))}
                    </span>
                    <ChevronRight />
                    <span>
                      {r.outputs.slice(0, 3).map((x) => (
                        <Img key={x.id} src={iconProduct(x.id)} />
                      ))}
                    </span>
                  </div>
                  <span className="filter-recipe-name">
                    <b>{r.name}</b>
                    <small>
                      {m?.name} · Forschung:{' '}
                      {recipeProgression[r.id]?.unlockResearchName || tierLabels[recipeTechTier(r)]}
                      {recipeProgression[r.id]?.machineTier
                        ? ` · Maschine T${recipeProgression[r.id].machineTier}`
                        : ''}
                      {recipeProgression[r.id]?.variantTier
                        ? ` · Variante T${recipeProgression[r.id].variantTier}`
                        : ''}
                    </small>
                  </span>
                  <span className="recipe-metrics">
                    <i>
                      <Users />
                      {m?.workers || 0}
                    </i>
                    <i>
                      <Zap />
                      {format((m?.electricity_consumed || 0) / 1000)} MW
                    </i>
                    {(m?.computing_consumed || 0) > 0 && (
                      <i>
                        <Cpu />
                        {m.computing_consumed}
                      </i>
                    )}
                    <i>{r.duration}s</i>
                  </span>
                </button>
              );
            })}
            {!visible.length && (
              <div className="filter-empty">Keine Rezepte entsprechen den Filtern.</div>
            )}
          </div>
          <aside className="optimization-panel">
            <h3>Phase 4 · Optimierung</h3>
            <label className="opt-toggle">
              <input
                type="checkbox"
                checked={opt.enabled}
                onChange={(e) => setOpt((o) => ({ ...o, enabled: e.target.checked }))}
              />{' '}
              Automatische Rezeptwahl
            </label>
            <label>
              Optimierungsziel
              <select
                value={opt.goal}
                onChange={(e) =>
                  setOpt((o) => ({ ...o, goal: e.target.value as OptimizationGoal }))
                }
              >
                <option value="minimizeWorkers">Arbeiter minimieren</option>
                <option value="minimizePower">Strom minimieren</option>
                <option value="minimizeMachines">Maschinen minimieren</option>
                <option value="minimizeMaintenance">Wartung minimieren</option>
                <option value="minimizeComputing">Computing minimieren</option>
                <option value="maximizeProduction">Produktion maximieren</option>
              </select>
            </label>
            <h4>Globale Grenzwerte des Gesamtplans</h4>
            {(
              [
                ['maxWorkers', 'Max. Arbeiter'],
                ['maxPower', 'Max. Strom (kW)'],
                ['maxMachines', 'Max. Maschinen'],
                ['maxComputing', 'Max. Computing'],
                ['maxMaintenance', 'Max. Wartung'],
              ] as const
            ).map(([key, label]) => (
              <label className="constraint" key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  placeholder="Aus"
                  value={opt[key] ?? ''}
                  onChange={(e) =>
                    setOpt((o) => ({
                      ...o,
                      [key]: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
            <h4>Ressourcenlimits</h4>
            <div className="resource-limit-add">
              <select
                aria-label={lang === 'de' ? 'Ressource auswählen' : 'Select resource'}
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              >
                <option value="">Ressource …</option>
                {allProducts.map((p) => (
                  <option value={p.id} key={p.id}>
                    {productName(p.id, p.name, lang)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Max/min"
                value={resourceLimit}
                onChange={(e) => setResourceLimit(e.target.value)}
              />
              <button
                disabled={!resourceId || !resourceLimit}
                aria-label={lang === 'de' ? 'Ressourcenlimit hinzufügen' : 'Add resource limit'}
                onClick={() => {
                  setOpt((o) => ({
                    ...o,
                    resourceLimits: { ...o.resourceLimits, [resourceId]: Number(resourceLimit) },
                  }));
                  setResourceId('');
                  setResourceLimit('');
                }}
              >
                <Plus />
              </button>
            </div>
            {Object.entries(opt.resourceLimits).map(([id, value]) => (
              <div className="resource-limit" key={id}>
                <span>
                  {productName(id, products[id]?.name || id, lang)} ≤ {value}/min
                </span>
                <button
                  onClick={() =>
                    setOpt((o) => {
                      const limits = { ...o.resourceLimits };
                      delete limits[id];
                      return { ...o, resourceLimits: limits };
                    })
                  }
                >
                  <X />
                </button>
              </div>
            ))}
            <div className="impact">
              <h4>Auswirkung auf den Plan</h4>
              <p>
                <span>Maschinen</span>
                <b>
                  {format(
                    before.machines.reduce((s, x) => s + x.count, 0),
                    1
                  )}{' '}
                  →{' '}
                  {format(
                    after.machines.reduce((s, x) => s + x.count, 0),
                    1
                  )}
                </b>
              </p>
              <p>
                <span>Strom</span>
                <b>
                  {format(before.power / 1000)} → {format(after.power / 1000)} MW
                </b>
              </p>
              <p>
                <span>Arbeiter</span>
                <b>
                  {format(before.workers, 0)} → {format(after.workers, 0)}
                </b>
              </p>
              <p>
                <span>Externe Inputs</span>
                <b>
                  {Object.keys(before.inputs).length} → {Object.keys(after.inputs).length}
                </b>
              </p>
            </div>
            <h4>{lang === 'de' ? 'Zulässige Alternativen' : 'Feasible alternatives'}</h4>
            {!showAlternatives && (
              <button className="soft" onClick={() => setShowAlternatives(true)}>
                {lang === 'de'
                  ? 'Alternativen bei Bedarf berechnen'
                  : 'Calculate alternatives on demand'}
              </button>
            )}
            <div className="alternative-list" aria-live="polite">
              {alternatives.map((a) => (
                <button
                  className={opt.goal === a.goal ? 'active' : ''}
                  key={a.goal}
                  onClick={() => setOpt((o) => ({ ...o, enabled: true, goal: a.goal }))}
                >
                  <b>{a.goal.replace('minimize', 'Min. ').replace('maximize', 'Max. ')}</b>
                  <small>
                    {a.duplicateOf >= 0
                      ? `Identisch mit ${alternatives[a.duplicateOf].goal} · `
                      : ''}
                    {format(a.result.workers, 0)} A · {format(a.result.power / 1000)} MW ·{' '}
                    {format(
                      a.result.machines.reduce((s, x) => s + x.count, 0),
                      1
                    )}{' '}
                    M
                  </small>
                </button>
              ))}
            </div>
          </aside>
        </div>
        <div className="filter-footer">
          <span>
            <b className="red">{draft.disabledRecipeIds.length}</b> deaktiviert ·{' '}
            <b className="green">{allRecipes.length - draft.disabledRecipeIds.length}</b> aktiviert
            · {visible.length} angezeigt
          </span>
          <div>
            <button className="soft" onClick={close}>
              Abbrechen
            </button>
            <button
              className="primary"
              disabled={conflicts.length > 0 && conflictMode === 'block'}
              onClick={() =>
                apply(
                  conflictMode === 'exception'
                    ? {
                        ...draft,
                        allowedExceptions: [...new Set([...draft.allowedExceptions, ...conflicts])],
                      }
                    : draft,
                  opt
                )
              }
            >
              Auf Produktionsplan anwenden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
