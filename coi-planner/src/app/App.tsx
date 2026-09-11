import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleHelp,
  Copy,
  Database,
  Download,
  Factory,
  FileUp,
  Filter,
  FolderOpen,
  GitBranch,
  Languages,
  LayoutGrid,
  Menu,
  Plus,
  Redo2,
  Save,
  Share2,
  Undo2,
} from 'lucide-react';
import { defaultRecipeFilter, defaultState, uid } from '../domain/solver/planCalculator';
import { tr, type Lang } from '../i18n';
import { normalizeState, sanitizeImported } from '../features/import-export/planSchema';
import { encodeState, stateFromHash } from '../features/import-export/linkCodec';
import type { SavedPlan } from '../features/catalog/PlanCatalog';
import { Planner } from '../features/planner/Planner';
import { readJson, readString, writeJson, writeString } from '../shared/storage';
import { Modal } from '../shared/Modal';
import { usePlanHistory } from '../shared/usePlanHistory';
import type { PlanState } from '../types';
import { useCalculatedResult } from '../domain/optimization/useCalculatedResult';

const RecipeLibrary = lazy(() =>
  import('../features/catalog/PlanCatalog').then((module) => ({ default: module.RecipeLibrary }))
);
const Saved = lazy(() =>
  import('../features/catalog/PlanCatalog').then((module) => ({ default: module.Saved }))
);
const ProductPicker = lazy(() =>
  import('../features/planner/PlannerModals').then((module) => ({ default: module.ProductPicker }))
);
const RecipePicker = lazy(() =>
  import('../features/planner/PlannerModals').then((module) => ({ default: module.RecipePicker }))
);
const SaveModal = lazy(() =>
  import('../features/planner/PlannerModals').then((module) => ({ default: module.SaveModal }))
);
const RecipeFilterModal = lazy(() =>
  import('../features/recipe-filter/RecipeFilterModal').then((module) => ({
    default: module.RecipeFilterModal,
  }))
);

type Tab = 'planner' | 'recipes' | 'saved';
const loadSaved = (): SavedPlan[] =>
  readJson<SavedPlan[]>('harbor-saved', []).map((plan) => ({
    ...plan,
    state: normalizeState(plan.state),
  }));
export function App() {
  const [lang, setLang] = useState<Lang>(() => readString('harbor-lang', 'de') as Lang);
  const [tab, setTab] = useState<Tab>('planner');
  const { state, setState, undo, redo, canUndo, canRedo } = usePlanHistory(() =>
    normalizeState(stateFromHash() || readJson<PlanState>('harbor-plan', defaultState()))
  );
  const [picker, setPicker] = useState(false),
    [recipeFor, setRecipeFor] = useState<string | null>(null),
    [saveOpen, setSaveOpen] = useState(false),
    [filterOpen, setFilterOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [importReport, setImportReport] = useState<string[] | null>(null),
    [toast, setToast] = useState('');
  const [saved, setSaved] = useState<SavedPlan[]>(loadSaved);
  const fileRef = useRef<HTMLInputElement>(null);
  const currentDataRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => writeJson('harbor-plan', state), 100);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    writeString('harbor-lang', lang);
  }, [lang]);
  const calculationState = useMemo<PlanState>(
    () => ({
      goals: state.goals,
      recipeChoices: state.recipeChoices,
      expanded: {},
      autoExpandChain: state.autoExpandChain,
      includeByproducts: state.includeByproducts,
      externalSources: state.externalSources,
      outputDispositions: state.outputDispositions,
      recipeFilter: state.recipeFilter,
      optimization: state.optimization,
    }),
    [
      state.goals,
      state.recipeChoices,
      state.autoExpandChain,
      state.includeByproducts,
      state.externalSources,
      state.outputDispositions,
      state.recipeFilter,
      state.optimization,
    ]
  );
  const { result, pending: calculationPending } = useCalculatedResult(calculationState);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 2200);
  };
  const exportPlan = () => {
    const blob = new Blob(
      [JSON.stringify({ format: 'harbor-planner', version: 4, state }, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'coi-production-plan.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const share = async () => {
    const url = `${location.origin}${location.pathname}#p=${encodeState(state)}`;
    await navigator.clipboard.writeText(url);
    notify(tr(lang, 'copied'));
  };
  const importPlan = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(String(r.result)),
          imported = sanitizeImported(j);
        setState(imported.state);
        setImportReport(imported.report);
        setTab('planner');
      } catch {
        notify(tr(lang, 'importError'));
      }
    };
    r.readAsText(f);
  };
  const importCurrentData = (f?: File) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const collections = ['products', 'recipes', 'buildings', 'contracts', 'research'];
        const valid =
          Number.isInteger(data.schema_version) &&
          data.schema_version >= 3 &&
          typeof data.game_version === 'string' &&
          collections.every((key) => Array.isArray(data[key]));
        if (!valid) throw new Error('INVALID_CURRENT_DATA');
        localStorage.setItem('harbor-current-export', JSON.stringify(data));
        notify(`${data.game_version}: Daten geladen. Die App wird neu gestartet …`);
        window.setTimeout(() => window.location.reload(), 500);
      } catch {
        notify('Spieldatenexport ungültig oder nicht unterstützt');
      }
    };
    reader.readAsText(f);
  };
  const reset = () => {
    setState(defaultState());
    setTab('planner');
  };
  return (
    <div className="shell">
      <header>
        <button className="brand" onClick={() => setTab('planner')}>
          <span className="brandmark">
            <Factory />
          </span>
          <span>
            <b>HARBOR</b>
            <small>PRODUCTION PLANNER</small>
          </span>
        </button>
        <nav className={mobileOpen ? 'mobile-open' : ''}>
          {(['planner', 'recipes', 'saved'] as Tab[]).map((x) => (
            <button
              key={x}
              className={tab === x ? 'active' : ''}
              onClick={() => {
                setTab(x);
                setMobileOpen(false);
              }}
            >
              {x === 'planner' ? <GitBranch /> : x === 'recipes' ? <LayoutGrid /> : <FolderOpen />}
              {tr(lang, x)}
            </button>
          ))}
        </nav>
        <div className="head-actions">
          <span className="version">data v0.8.2c</span>
          <button
            className="icon-btn lang"
            onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            aria-label={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
          >
            <Languages />
            <span>{lang.toUpperCase()}</span>
          </button>
          <button className="icon-btn" onClick={() => setHelpOpen(true)} aria-label="Hilfe">
            <CircleHelp />
          </button>
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen((x) => !x)}
            aria-label="Menü"
          >
            <Menu />
          </button>
        </div>
      </header>
      <div className="toolbar">
        <div>
          <button className="soft" onClick={reset}>
            <Plus />
            {tr(lang, 'newPlan')}
          </button>
          <button className="soft" onClick={() => setSaveOpen(true)}>
            <Save />
            {tr(lang, 'save')}
          </button>
          <button
            className="soft history-action"
            onClick={undo}
            disabled={!canUndo}
            aria-label={lang === 'de' ? 'Rückgängig' : 'Undo'}
            title={`${lang === 'de' ? 'Rückgängig' : 'Undo'} · Ctrl/⌘ Z`}
          >
            <Undo2 />
          </button>
          <button
            className="soft history-action"
            onClick={redo}
            disabled={!canRedo}
            aria-label={lang === 'de' ? 'Wiederholen' : 'Redo'}
            title={`${lang === 'de' ? 'Wiederholen' : 'Redo'} · Ctrl/⌘ Shift Z`}
          >
            <Redo2 />
          </button>
          <button
            className={`soft filter-launch ${(state.recipeFilter?.disabledRecipeIds.length || 0) > 0 ? 'filtered' : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            <Filter />
            {lang === 'de' ? 'Rezeptfilter' : 'Recipe filters'}{' '}
            {(state.recipeFilter?.disabledRecipeIds.length || 0) > 0 && (
              <b>{state.recipeFilter!.disabledRecipeIds.length}</b>
            )}
          </button>
        </div>
        {calculationPending && (
          <span className="calculation-status" role="status">
            {lang === 'de' ? 'Optimierung läuft …' : 'Optimizing …'}
          </span>
        )}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => importPlan(e.target.files?.[0])}
          />
          <input
            ref={currentDataRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => importCurrentData(e.target.files?.[0])}
          />
          <button className="soft" onClick={() => currentDataRef.current?.click()}>
            <Database />
            {lang === 'de' ? 'Aktuelle Spieldaten laden' : 'Load current game data'}
          </button>
          <button className="soft" onClick={() => fileRef.current?.click()}>
            <FileUp />
            {tr(lang, 'import')}
          </button>
          <button className="soft" onClick={exportPlan}>
            <Download />
            {tr(lang, 'export')}
          </button>
          <button className="primary" onClick={share}>
            <Share2 />
            {tr(lang, 'share')}
          </button>
        </div>
      </div>
      <Suspense fallback={<main aria-busy="true" />}>
        {tab === 'planner' ? (
          <Planner
            lang={lang}
            state={state}
            setState={setState}
            result={result}
            onPicker={() => setPicker(true)}
            onRecipe={setRecipeFor}
            onFilter={() => setFilterOpen(true)}
          />
        ) : tab === 'recipes' ? (
          <RecipeLibrary
            lang={lang}
            filter={state.recipeFilter || defaultRecipeFilter()}
            onUse={(id) => {
              setState((s) => ({
                ...s,
                goals: [...s.goals, { id: uid(), productId: id, rate: 12 }],
              }));
              setTab('planner');
            }}
          />
        ) : (
          <Saved
            lang={lang}
            plans={saved}
            load={(p) => {
              setState(p.state);
              setTab('planner');
            }}
            remove={(id) => {
              const n = saved.filter((x) => x.id !== id);
              setSaved(n);
              writeJson('harbor-saved', n);
            }}
          />
        )}
      </Suspense>
      <footer>
        <span>{tr(lang, 'version')}</span>
        <span>{tr(lang, 'dataNote')}</span>
      </footer>
      <Suspense fallback={null}>
        {picker && (
          <ProductPicker
            lang={lang}
            close={() => setPicker(false)}
            select={(id) => {
              setState((s) => ({
                ...s,
                goals: [...s.goals, { id: uid(), productId: id, rate: 12 }],
              }));
              setPicker(false);
            }}
          />
        )}
        {recipeFor && (
          <RecipePicker
            lang={lang}
            productId={recipeFor}
            selected={state.recipeChoices[recipeFor]}
            filter={state.recipeFilter || defaultRecipeFilter()}
            close={() => setRecipeFor(null)}
            choose={(id) => {
              setState((s) => ({ ...s, recipeChoices: { ...s.recipeChoices, [recipeFor]: id } }));
              setRecipeFor(null);
            }}
          />
        )}
        {filterOpen && (
          <RecipeFilterModal
            lang={lang}
            state={state}
            close={() => setFilterOpen(false)}
            apply={(filter, optimization) => {
              setState((s) => ({ ...s, recipeFilter: filter, optimization }));
              setFilterOpen(false);
              notify('Rezeptfilter angewendet');
            }}
          />
        )}
        {saveOpen && (
          <SaveModal
            lang={lang}
            close={() => setSaveOpen(false)}
            save={(name) => {
              const n = [{ id: uid(), name, date: new Date().toISOString(), state }, ...saved];
              setSaved(n);
              writeJson('harbor-saved', n);
              setSaveOpen(false);
              notify(tr(lang, 'savePlan'));
            }}
          />
        )}
      </Suspense>
      {importReport && (
        <Modal
          title={lang === 'de' ? 'Importbericht' : 'Import report'}
          close={() => setImportReport(null)}
        >
          <div className="help-content">
            <ul>
              {importReport.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <button className="primary" onClick={() => setImportReport(null)}>
              {tr(lang, 'close')}
            </button>
          </div>
        </Modal>
      )}
      {helpOpen && (
        <Modal
          title={lang === 'de' ? 'Hilfe zum Produktionsplaner' : 'Production planner help'}
          close={() => setHelpOpen(false)}
        >
          <div className="help-content">
            <h3>{lang === 'de' ? 'Schnellstart' : 'Quick start'}</h3>
            <ol>
              <li>
                {lang === 'de'
                  ? 'Links Produktionsziele und gewünschte Raten hinzufügen.'
                  : 'Add production goals and target rates on the left.'}
              </li>
              <li>
                {lang === 'de'
                  ? 'Rezeptfilter, Technologiestufen und Optimierung unter Einstellungen festlegen.'
                  : 'Configure recipes, technology tiers and optimization in settings.'}
              </li>
              <li>
                {lang === 'de'
                  ? 'Im Diagramm ziehen, mit dem Mausrad zoomen und über − an Produktknoten Teilketten einklappen.'
                  : 'Drag and zoom the diagram; use − on product nodes to collapse subchains.'}
              </li>
              <li>
                {lang === 'de'
                  ? 'Unter Ein-/Ausgänge externe Quellen sowie Brutto-, zugewiesene und offene Ausgänge konfigurieren.'
                  : 'Configure external sources and gross, assigned and open outputs under I/O setup.'}
              </li>
            </ol>
            <h3>{lang === 'de' ? 'Flussfarben' : 'Flow colors'}</h3>
            <p>
              {lang === 'de'
                ? 'Grün: Produktion · Blau: interne Wiederverwendung · Orange: Ziele/Nebenprodukte · Rotbraun: Ausgangsrouten.'
                : 'Green: production · Blue: internal reuse · Orange: goals/byproducts · Brown: output routes.'}
            </p>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast">
          <Copy />
          {toast}
        </div>
      )}
    </div>
  );
}
