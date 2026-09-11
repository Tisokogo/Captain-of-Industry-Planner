import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { ChevronDown, GitBranch, Minus, Plus, RotateCcw, Search, X } from 'lucide-react';
import {
  availableDispositions,
  calculate,
  format,
  iconMachine,
  iconProduct,
  machines,
  products,
  recipeOptions,
  recipeTechTier,
  recipes,
} from '../../domain/solver/planCalculator';
import { productName, tr, type Lang } from '../../i18n';
import type { PlanState } from '../../types';
import { sourceOptions } from '../external-sources/sourceOptions';
import { GameImage as Img } from '../../shared/GameImage';
import { applyDiagramPositions, type DiagramNode } from './diagramModel';
import { routeDiagramEdgeCached } from './diagramRouting';
import { useDiagramModel } from './useDiagramModel';
import { decomposeResultByGoal } from './goalDecomposition';
import { nextDiagramNode, traceDiagramFocus, type SpatialDirection } from './diagramFocus';

type DiagramView = { x: number; y: number; scale: number };

function useAnimationFrameView(initial: DiagramView) {
  const [view, setViewState] = useState(initial);
  const current = useRef(view);
  const pending = useRef<DiagramView | null>(null);
  const frame = useRef<number | null>(null);

  const setView = useCallback((next: DiagramView | ((value: DiagramView) => DiagramView)) => {
    const previous = pending.current || current.current;
    pending.current = typeof next === 'function' ? next(previous) : next;
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!pending.current) return;
      current.current = pending.current;
      setViewState(pending.current);
      pending.current = null;
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    []
  );
  return [view, setView] as const;
}

export function SeparatedFlows({
  result,
  state,
  setState,
  lang,
  onRecipe,
  fitSignal,
}: {
  result: ReturnType<typeof calculate>;
  state: PlanState;
  setState: Dispatch<SetStateAction<PlanState>>;
  lang: Lang;
  onRecipe: (id: string) => void;
  fitSignal: number;
}) {
  return (
    <div className="separated-flows">
      {decomposeResultByGoal(result, state).map(({ goal, result: scoped }, index) => {
        return (
          <section key={goal.id}>
            <h3>
              {index + 1}.{' '}
              {productName(goal.productId, products[goal.productId]?.name || goal.productId, lang)}{' '}
              · {format(goal.rate)}/min{' '}
              <small>
                · {lang === 'de' ? 'proportionaler Zielanteil' : 'proportional goal allocation'}
              </small>
            </h3>
            <MergedFlow
              result={scoped}
              state={{ ...state, goals: [goal] }}
              setState={setState}
              lang={lang}
              onRecipe={onRecipe}
              fitSignal={fitSignal}
            />
          </section>
        );
      })}
    </div>
  );
}

export function MergedFlow({
  result,
  state,
  setState,
  lang,
  onRecipe,
  fitSignal,
}: {
  result: ReturnType<typeof calculate>;
  state: PlanState;
  setState: Dispatch<SetStateAction<PlanState>>;
  lang: Lang;
  onRecipe: (id: string) => void;
  fitSignal: number;
}) {
  return (
    <FlowDiagram
      result={result}
      state={state}
      setState={setState}
      lang={lang}
      onRecipe={onRecipe}
      fitSignal={fitSignal}
    />
  );
}
function FlowDiagram({
  result,
  state,
  setState,
  lang,
  onRecipe,
  fitSignal,
}: {
  result: ReturnType<typeof calculate>;
  state: PlanState;
  setState: Dispatch<SetStateAction<PlanState>>;
  lang: Lang;
  onRecipe: (id: string) => void;
  fitSignal: number;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null),
    fittedOnce = useRef(false),
    lastFitSignal = useRef(fitSignal);
  const [view, setView] = useAnimationFrameView({ x: 24, y: 24, scale: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 700, height: 500 });
  const [query, setQuery] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>(
    {}
  );
  const pendingManualPositions = useRef<Record<string, { x: number; y: number }>>({});
  const manualPositionFrame = useRef<number | null>(null);
  const scheduleManualUpdate = useCallback((updates: Record<string, { x: number; y: number }>) => {
    pendingManualPositions.current = { ...pendingManualPositions.current, ...updates };
    if (manualPositionFrame.current != null) return;
    manualPositionFrame.current = requestAnimationFrame(() => {
      manualPositionFrame.current = null;
      const next = pendingManualPositions.current;
      pendingManualPositions.current = {};
      setManualPositions((current) => ({ ...current, ...next }));
    });
  }, []);
  useEffect(
    () => () => {
      if (manualPositionFrame.current != null) cancelAnimationFrame(manualPositionFrame.current);
    },
    []
  );
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () =>
      setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect(),
        px = event.clientX - rect.left,
        py = event.clientY - rect.top,
        factor = event.deltaY < 0 ? 1.12 : 0.89;
      setView((current) => {
        const scale = Math.max(0.12, Math.min(2, current.scale * factor));
        return {
          scale,
          x: px - ((px - current.x) * scale) / current.scale,
          y: py - ((py - current.y) * scale) / current.scale,
        };
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [setView]);
  const layoutState = useMemo(
    () =>
      ({
        goals: state.goals,
        expanded: state.expanded,
        diagramCompact: state.diagramCompact,
      }) as PlanState,
    [state.goals, state.expanded, state.diagramCompact]
  );
  const { model: baseModel, pending: layoutPending } = useDiagramModel(
    result,
    layoutState,
    tr(lang, 'goalOutput')
  );
  const model = useMemo(
    () =>
      applyDiagramPositions(baseModel, {
        ...(state.diagramPositions || {}),
        ...manualPositions,
      }),
    [baseModel, manualPositions, state.diagramPositions]
  );
  const modelRef = useRef(model);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    const stored = state.diagramPositions || {};
    const validIds = new Set(
      baseModel.nodes.filter((node) => !node.embedded).map((node) => node.id)
    );
    const pruned = Object.fromEntries(Object.entries(stored).filter(([id]) => validIds.has(id)));
    if (Object.keys(pruned).length !== Object.keys(stored).length)
      setState((current) => ({ ...current, diagramPositions: pruned }));
  }, [baseModel.nodes, setState, state.diagramPositions]);
  const searchEntries = useMemo(
    () =>
      model.nodes
        .filter((node) => node.kind !== 'route' && (node.kind !== 'product' || !node.embedded))
        .map((node) => {
          const label = [
            node.productId
              ? productName(node.productId, products[node.productId]?.name || node.productId, lang)
              : node.recipeId
                ? recipes[node.recipeId]?.name || node.recipeId
                : node.label || node.id,
            ...(node.outputs || []).map((output) =>
              productName(
                output.productId,
                products[output.productId]?.name || output.productId,
                lang
              )
            ),
          ].join(' · ');
          return { node, label, searchText: label.toLocaleLowerCase(lang) };
        }),
    [model.nodes, lang]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase(lang);
  const matches = normalizedQuery
    ? searchEntries.filter((entry) => entry.searchText.includes(normalizedQuery)).slice(0, 8)
    : [];
  const activeFocusedId = focusedId && model.pos.has(focusedId) ? focusedId : null;
  const selectedRoute = selectedRouteId ? model.pos.get(selectedRouteId) : undefined;
  const focus = useMemo(
    () => (activeFocusedId ? traceDiagramFocus(model.edges, activeFocusedId) : null),
    [model.edges, activeFocusedId]
  );
  const focusNode = (nodeId: string) => {
    const node = model.pos.get(nodeId),
      element = viewport.current;
    if (!node || !element) return;
    setFocusedId(nodeId);
    setQuery('');
    setView((current) => ({
      ...current,
      x: element.clientWidth / 2 - (node.x + node.width / 2) * current.scale,
      y: element.clientHeight / 2 - (node.y + node.height / 2) * current.scale,
    }));
  };
  const navigateNode = (fromId: string, direction: SpatialDirection) => {
    const nextId = nextDiagramNode(model.nodes, fromId, direction);
    if (!nextId) return;
    focusNode(nextId);
    requestAnimationFrame(() => {
      const element = [
        ...(viewport.current?.querySelectorAll<HTMLElement>('[data-node-id]') || []),
      ].find((candidate) => candidate.dataset.nodeId === nextId);
      element?.focus();
    });
  };
  const fit = () => {
    const el = viewport.current;
    if (!el) return;
    const scale = Math.max(
      0.12,
      Math.min(1, (el.clientWidth - 48) / model.width, (el.clientHeight - 48) / model.height)
    );
    setView({
      scale,
      x: (el.clientWidth - model.width * scale) / 2,
      y: (el.clientHeight - model.height * scale) / 2,
    });
  };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (fittedOnce.current && lastFitSignal.current === fitSignal) return;
    fittedOnce.current = true;
    lastFitSignal.current = fitSignal;
    const fitScale = Math.max(
      0.12,
      Math.min(
        1,
        (element.clientWidth - 48) / baseModel.width,
        (element.clientHeight - 48) / baseModel.height
      )
    );
    // Keep the first view readable. Very large plans start at the upper-left at a usable scale;
    // the explicit fit control remains available when an all-plan overview is preferred.
    const scale = Math.max(0.36, fitScale);
    setView({
      scale,
      x:
        baseModel.width * scale > element.clientWidth
          ? 24
          : (element.clientWidth - baseModel.width * scale) / 2,
      y:
        baseModel.height * scale > element.clientHeight
          ? 24
          : (element.clientHeight - baseModel.height * scale) / 2,
    });
  }, [fitSignal, baseModel.width, baseModel.height, setView]);
  const selectNode = (id: string, additive: boolean) =>
    setSelectedIds((current) => {
      if (!additive) return current.has(id) ? current : new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const moveSelection = (anchorId: string, x: number, y: number, persist: boolean) => {
    const currentModel = modelRef.current;
    const currentSelection = selectedIdsRef.current;
    const anchor = currentModel.pos.get(anchorId);
    if (!anchor) return;
    const ids = currentSelection.has(anchorId) ? currentSelection : new Set([anchorId]);
    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const updates: Record<string, { x: number; y: number }> = {};
    for (const id of ids) {
      const node = currentModel.pos.get(id);
      if (node && !node.embedded) updates[id] = { x: node.x + dx, y: node.y + dy };
    }
    if (persist) {
      if (manualPositionFrame.current != null) {
        cancelAnimationFrame(manualPositionFrame.current);
        manualPositionFrame.current = null;
      }
      pendingManualPositions.current = {};
      setManualPositions((current) => ({ ...current, ...updates }));
      setState((current) => ({
        ...current,
        diagramPositions: { ...currentModel.validPositions, ...updates },
      }));
      return;
    }
    scheduleManualUpdate(updates);
  };
  const zoom = (factor: number, cx?: number, cy?: number) =>
    setView((v) => {
      const ns = Math.max(0.12, Math.min(2, v.scale * factor)),
        el = viewport.current,
        px = cx ?? (el?.clientWidth || 0) / 2,
        py = cy ?? (el?.clientHeight || 0) / 2;
      return {
        scale: ns,
        x: px - ((px - v.x) * ns) / v.scale,
        y: py - ((py - v.y) * ns) / v.scale,
      };
    });
  const visibleBounds = useMemo(() => {
    const overscan = 420 / view.scale;
    return {
      left: -view.x / view.scale - overscan,
      top: -view.y / view.scale - overscan,
      right: (viewportSize.width - view.x) / view.scale + overscan,
      bottom: (viewportSize.height - view.y) / view.scale + overscan,
    };
  }, [view, viewportSize]);
  const visibleNodes = useMemo(
    () =>
      model.nodes.filter(
        (node) =>
          !node.embedded &&
          node.x < visibleBounds.right &&
          node.x + node.width > visibleBounds.left &&
          node.y < visibleBounds.bottom &&
          node.y + node.height > visibleBounds.top
      ),
    [model.nodes, visibleBounds]
  );
  const routedEdges = useMemo(
    () =>
      model.edges.flatMap((edge, edgeIndex) => {
        if (edge.kind === 'production' || edge.kind === 'byproduct') return [];
        const from = model.pos.get(edge.from);
        const to = model.pos.get(edge.to);
        if (!from || !to) return [];
        const routed = routeDiagramEdgeCached(edge, model.pos, edgeIndex);
        if (!routed) return [];
        return [{ edge, routed, from, to }];
      }),
    [model.edges, model.pos]
  );
  const visibleEdges = useMemo(
    () =>
      routedEdges.filter(({ edge, from, to }) => {
        if (focus?.edgeIds.has(edge.id)) return true;
        const left = Math.min(from.x, to.x);
        const top = Math.min(from.y, to.y);
        const right = Math.max(from.x + from.width, to.x + to.width);
        const bottom = Math.max(from.y + from.height, to.y + to.height);
        return (
          left < visibleBounds.right &&
          right > visibleBounds.left &&
          top < visibleBounds.bottom &&
          bottom > visibleBounds.top
        );
      }),
    [focus, routedEdges, visibleBounds]
  );
  return (
    <div className="diagram-shell">
      <div className="diagram-banner">
        <GitBranch />
        <span>
          <b>{tr(lang, 'mergedChain')}</b>
          <small>
            {state.goals.length} {tr(lang, 'goals')} ·{' '}
            {
              model.nodes.filter(
                (node) => node.kind !== 'route' && (node.kind !== 'product' || !node.embedded)
              ).length
            }{' '}
            {lang === 'de' ? 'Karten' : 'cards'} ·{' '}
            {lang === 'de'
              ? 'Ziehen zum Anordnen · Umschalt-Klick für Mehrfachauswahl'
              : 'Drag to arrange · Shift-click to select multiple'}
          </small>
        </span>
        <div className="diagram-search">
          <Search />
          <input
            value={query}
            placeholder={lang === 'de' ? 'Knoten suchen' : 'Search nodes'}
            aria-label={lang === 'de' ? 'Diagrammknoten suchen' : 'Search diagram nodes'}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches[0]) focusNode(matches[0].node.id);
              if (event.key === 'Escape') setQuery('');
            }}
          />
          {activeFocusedId && (
            <button
              onClick={() => setFocusedId(null)}
              aria-label={lang === 'de' ? 'Fokus aufheben' : 'Clear focus'}
            >
              <X />
            </button>
          )}
          {matches.length > 0 && (
            <div className="diagram-search-results" role="listbox">
              {matches.map((entry) => (
                <button
                  key={entry.node.id}
                  role="option"
                  aria-selected={entry.node.id === activeFocusedId}
                  onClick={() => focusNode(entry.node.id)}
                >
                  <span>{entry.label}</span>
                  <small>{entry.node.kind}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        ref={viewport}
        className="diagram-viewport"
        aria-busy={layoutPending}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('.diagram-node, button')) return;
          setSelectedIds(new Set());
          drag.current = { x: e.clientX, y: e.clientY, tx: view.x, ty: view.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const origin = drag.current;
          if (!origin) return;
          setView((v) => ({
            ...v,
            x: origin.tx + e.clientX - origin.x,
            y: origin.ty + e.clientY - origin.y,
          }));
        }}
        onPointerUp={(e) => {
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {layoutPending && (
          <div className="diagram-layout-pending" role="status">
            {lang === 'de' ? 'Großes Diagramm wird angeordnet …' : 'Arranging large diagram …'}
          </div>
        )}
        <div
          className="diagram-world"
          style={{
            width: model.width,
            height: model.height,
            transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`,
          }}
        >
          <svg className="diagram-edges" width={model.width} height={model.height}>
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            {visibleEdges.map(({ edge, routed }) => {
              const edgeFocused = !!focus?.edgeIds.has(edge.id);
              return (
                <g
                  className={`diagram-edge ${edge.kind} ${routed.backwards ? 'is-back-edge' : ''} ${focus ? (edgeFocused ? 'is-focused' : 'is-dimmed') : ''}`}
                  key={edge.id}
                >
                  <path d={routed.path} markerEnd="url(#flow-arrow)" />
                  {edgeFocused && (
                    <text x={routed.labelX} y={routed.labelY}>
                      {format(edge.rate)}/min
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {visibleNodes
            .filter((node) => node.kind === 'route')
            .map((node) => (
              <DiagramEndpoint
                key={node.id}
                node={node}
                lang={lang}
                viewScale={view.scale}
                dimmed={!!focus && !focus.nodeIds.has(node.id)}
                selected={selectedRouteId === node.id}
                onActivate={() => setSelectedRouteId(node.id)}
                onMoveNode={(x, y) => scheduleManualUpdate({ [node.id]: { x, y } })}
                onMoveEnd={(x, y) =>
                  setState((current) => ({
                    ...current,
                    diagramPositions: {
                      ...modelRef.current.validPositions,
                      [node.id]: { x, y },
                    },
                  }))
                }
              />
            ))}
          {visibleNodes
            .filter((node) => node.kind !== 'route')
            .map((n) => (
              <DiagramCard
                key={n.id}
                node={n}
                state={state}
                setState={setState}
                lang={lang}
                onRecipe={onRecipe}
                focused={n.id === activeFocusedId}
                selected={selectedIds.has(n.id)}
                dimmed={!!focus && !focus.nodeIds.has(n.id)}
                onSelect={(additive) => selectNode(n.id, additive)}
                onFocusNode={() => setFocusedId(n.id)}
                onNavigateNode={(direction) => navigateNode(n.id, direction)}
                viewScale={view.scale}
                simplified={view.scale < 0.3}
                onMoveNode={(x, y) => moveSelection(n.id, x, y, false)}
                onMoveEnd={(x, y) => moveSelection(n.id, x, y, true)}
              />
            ))}
        </div>
        <div className="diagram-controls">
          <button onClick={() => zoom(1.2)} aria-label="Vergrößern">
            <Plus />
          </button>
          <button onClick={() => zoom(0.8)} aria-label="Verkleinern">
            <Minus />
          </button>
          <button onClick={fit} aria-label={tr(lang, 'fit')}>
            <RotateCcw />
          </button>
          <button
            onClick={() => {
              setManualPositions({});
              setState((current) => ({ ...current, diagramPositions: {} }));
            }}
            aria-label={
              lang === 'de' ? 'Automatisches Layout wiederherstellen' : 'Restore auto layout'
            }
            title={lang === 'de' ? 'Layout zurücksetzen' : 'Reset layout'}
          >
            AUTO
          </button>
        </div>
        {selectedRoute?.productId && (
          <div className="endpoint-inspector">
            <button
              className="endpoint-inspector-close"
              onClick={() => setSelectedRouteId(null)}
              aria-label={lang === 'de' ? 'Ausgangsdetails schließen' : 'Close output details'}
            >
              <X />
            </button>
            <span>
              <Img src={iconProduct(selectedRoute.productId)} />
              <b>
                {productName(
                  selectedRoute.productId,
                  products[selectedRoute.productId]?.name || selectedRoute.productId,
                  lang
                )}
              </b>
              <em>{format(selectedRoute.rate)}/min</em>
            </span>
            <label>
              {lang === 'de' ? 'Verwendung' : 'Disposition'}
              <select
                value={selectedRoute.routeType || 'unassigned'}
                disabled={selectedRoute.routeType === 'emission'}
                onChange={(event) => {
                  const type = event.target.value as NonNullable<DiagramNode['routeType']>;
                  const hasDemand = result.graphEdges.some(
                    (edge) =>
                      edge.from === selectedRoute.productId &&
                      edge.kind === 'input' &&
                      !edge.to.startsWith('sink:')
                  );
                  const option = availableDispositions(
                    selectedRoute.productId!,
                    state,
                    hasDemand
                  ).find((candidate) => candidate.type === type);
                  const route = option?.routes[0];
                  setState((current) => ({
                    ...current,
                    outputDispositions: {
                      ...(current.outputDispositions || {}),
                      [selectedRoute.productId!]:
                        type === 'storage' || type === 'export'
                          ? { type, amountMode: 'all', facilityId: route?.id }
                          : { type, amountMode: 'all', recipeId: route?.id },
                    },
                  }));
                }}
              >
                {availableDispositions(
                  selectedRoute.productId,
                  state,
                  result.graphEdges.some(
                    (edge) =>
                      edge.from === selectedRoute.productId &&
                      edge.kind === 'input' &&
                      !edge.to.startsWith('sink:')
                  )
                ).map((option) => (
                  <option key={option.type} value={option.type}>
                    {lang === 'de'
                      ? option.label
                      : {
                          unassigned: 'Not assigned',
                          'internal-reuse': 'Internal reuse',
                          storage: 'Store',
                          'further-processing': 'Further processing',
                          export: 'Export',
                          dump: 'Dump',
                          flare: 'Flare / vent',
                          wastewater: 'Wastewater treatment',
                          emission: 'Emission',
                        }[option.type]}
                  </option>
                ))}
                {selectedRoute.routeType === 'emission' && (
                  <option value="emission">Emission</option>
                )}
              </select>
            </label>
          </div>
        )}
        <div className="diagram-minimap">
          <svg viewBox={`0 0 ${model.width} ${model.height}`}>
            {model.nodes
              .filter((n) => n.kind !== 'route' && (n.kind !== 'product' || !n.embedded))
              .map((n) => (
                <rect
                  key={n.id}
                  x={n.x}
                  y={n.y}
                  width={n.width}
                  height={n.height}
                  className={`${n.kind} ${focus && !focus.nodeIds.has(n.id) ? 'is-dimmed' : ''}`}
                />
              ))}
            <rect
              className="viewport-box"
              x={Math.max(0, -view.x / view.scale)}
              y={Math.max(0, -view.y / view.scale)}
              width={viewportSize.width / view.scale}
              height={viewportSize.height / view.scale}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
const DiagramEndpoint = memo(
  function DiagramEndpoint({
    node,
    lang,
    viewScale,
    dimmed,
    selected,
    onActivate,
    onMoveNode,
    onMoveEnd,
  }: {
    node: DiagramNode;
    lang: Lang;
    viewScale: number;
    dimmed: boolean;
    selected: boolean;
    onActivate: () => void;
    onMoveNode: (x: number, y: number) => void;
    onMoveEnd: (x: number, y: number) => void;
  }) {
    const endpointDrag = useRef<{
      x: number;
      y: number;
      nodeX: number;
      nodeY: number;
      lastX: number;
      lastY: number;
    } | null>(null);
    const symbols: Partial<Record<NonNullable<DiagramNode['routeType']>, string>> = {
      storage: '▣',
      'further-processing': '↻',
      'internal-reuse': '↺',
      emission: '♨',
      flare: '♨',
      wastewater: '≋',
      dump: '▼',
      export: '→',
    };
    const description = `${node.label || node.routeType || (lang === 'de' ? 'Ausgang' : 'output')}: ${format(node.rate)}/min`;
    return (
      <button
        type="button"
        className={`diagram-endpoint ${node.routeType || 'unassigned'} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
        style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
        data-node-id={node.id}
        aria-label={`${description}. ${lang === 'de' ? 'Zum Verschieben ziehen' : 'Drag to move'}`}
        title={description}
        onPointerDown={(event) => {
          event.stopPropagation();
          endpointDrag.current = {
            x: event.clientX,
            y: event.clientY,
            nodeX: node.x,
            nodeY: node.y,
            lastX: node.x,
            lastY: node.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const origin = endpointDrag.current;
          if (!origin) return;
          event.stopPropagation();
          origin.lastX = origin.nodeX + (event.clientX - origin.x) / viewScale;
          origin.lastY = origin.nodeY + (event.clientY - origin.y) / viewScale;
          onMoveNode(origin.lastX, origin.lastY);
        }}
        onPointerUp={(event) => {
          const origin = endpointDrag.current;
          endpointDrag.current = null;
          if (origin) {
            const moved = Math.hypot(origin.lastX - origin.nodeX, origin.lastY - origin.nodeY) > 3;
            if (moved) onMoveEnd(origin.lastX, origin.lastY);
            else onActivate();
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          endpointDrag.current = null;
        }}
      >
        <span aria-hidden="true">{symbols[node.routeType || 'unassigned'] || '◆'}</span>
      </button>
    );
  },
  (previous, next) =>
    previous.node === next.node &&
    previous.lang === next.lang &&
    previous.viewScale === next.viewScale &&
    previous.dimmed === next.dimmed &&
    previous.selected === next.selected
);

const DiagramCard = memo(
  function DiagramCard({
    node,
    state,
    setState,
    lang,
    onRecipe,
    focused,
    selected,
    dimmed,
    onSelect,
    onFocusNode,
    onNavigateNode,
    viewScale,
    simplified,
    onMoveNode,
    onMoveEnd,
  }: {
    node: DiagramNode;
    state: PlanState;
    setState: Dispatch<SetStateAction<PlanState>>;
    lang: Lang;
    onRecipe: (id: string) => void;
    focused: boolean;
    selected: boolean;
    dimmed: boolean;
    onSelect: (additive: boolean) => void;
    onFocusNode: () => void;
    onNavigateNode: (direction: SpatialDirection) => void;
    viewScale: number;
    simplified: boolean;
    onMoveNode: (x: number, y: number) => void;
    onMoveEnd: (x: number, y: number) => void;
  }) {
    const nodeDrag = useRef<{
      x: number;
      y: number;
      nodeX: number;
      nodeY: number;
      lastX: number;
      lastY: number;
    } | null>(null);
    const p = node.productId ? products[node.productId] : undefined,
      r = node.recipeId ? recipes[node.recipeId] : undefined,
      m = r ? machines[r.machine] : undefined,
      toggle = () =>
        node.productId &&
        setState((current) =>
          node.external
            ? {
                ...current,
                diagramCompact: {
                  ...(current.diagramCompact || {}),
                  [node.productId!]: node.compact ? false : true,
                },
              }
            : {
                ...current,
                expanded: {
                  ...current.expanded,
                  [node.productId!]: current.expanded[node.productId!] === false,
                },
              }
        );
    return (
      <article
        className={`diagram-node ${node.kind} ${node.external ? 'external' : ''} ${node.compact ? 'is-compact' : ''} ${node.productId && state.expanded[node.productId] === false ? 'is-collapsed' : ''} ${focused ? 'is-focused' : ''} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
        style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
        data-node-id={node.id}
        tabIndex={0}
        onFocus={onFocusNode}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button, input, select')) return;
          event.stopPropagation();
          onSelect(event.shiftKey || event.ctrlKey || event.metaKey);
          nodeDrag.current = {
            x: event.clientX,
            y: event.clientY,
            nodeX: node.x,
            nodeY: node.y,
            lastX: node.x,
            lastY: node.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const origin = nodeDrag.current;
          if (!origin) return;
          event.stopPropagation();
          origin.lastX = origin.nodeX + (event.clientX - origin.x) / viewScale;
          origin.lastY = origin.nodeY + (event.clientY - origin.y) / viewScale;
          onMoveNode(origin.lastX, origin.lastY);
        }}
        onPointerUp={(event) => {
          const origin = nodeDrag.current;
          nodeDrag.current = null;
          if (origin) onMoveEnd(origin.lastX, origin.lastY);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          nodeDrag.current = null;
        }}
        aria-label={`${node.kind}: ${p && node.productId ? productName(node.productId, p.name, lang) : r?.name || node.label || node.id}, ${format(node.rate)} ${lang === 'de' ? 'pro Minute' : 'per minute'}`}
        onKeyDown={(e) => {
          const directionByKey: Partial<Record<string, SpatialDirection>> = {
            ArrowLeft: 'left',
            ArrowRight: 'right',
            ArrowUp: 'up',
            ArrowDown: 'down',
          };
          const direction = directionByKey[e.key];
          if (direction) {
            e.preventDefault();
            onNavigateNode(direction);
          } else if (node.kind === 'product' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {simplified ? (
          <div className="diagram-zoom-summary">
            <Img
              src={
                node.kind === 'recipe'
                  ? iconMachine(r?.machine || '')
                  : iconProduct(node.productId || '')
              }
            />
            <span>
              <b>
                {node.kind === 'recipe'
                  ? m?.name || r?.name
                  : node.productId
                    ? productName(node.productId, p?.name || node.productId, lang)
                    : node.label}
              </b>
              <small>{format(node.rate)}/min</small>
            </span>
          </div>
        ) : (
          <>
            {node.kind === 'product' && (
              <>
                <div className="diagram-node-head">
                  <Img src={iconProduct(node.productId!)} />
                  <span>
                    <b>{productName(node.productId!, p?.name || node.productId!, lang)}</b>
                    <small>
                      {node.external
                        ? sourceOptions(lang, node.productId!).find(
                            (x) => x.id === (state.externalSources?.[node.productId!] || 'unused')
                          )?.label
                        : 'Material'}
                    </small>
                  </span>
                  <button
                    onClick={toggle}
                    aria-label={
                      node.external
                        ? node.compact
                          ? lang === 'de'
                            ? 'Quelldetails anzeigen'
                            : 'Show source details'
                          : lang === 'de'
                            ? 'Quelle kompakt darstellen'
                            : 'Compact source'
                        : state.expanded[node.productId!] === false
                          ? lang === 'de'
                            ? 'Eingangskette aufklappen'
                            : 'Expand input chain'
                          : lang === 'de'
                            ? 'Eingangskette einklappen'
                            : 'Collapse input chain'
                    }
                  >
                    {node.compact || state.expanded[node.productId!] === false ? (
                      <Plus />
                    ) : (
                      <Minus />
                    )}
                  </button>
                </div>
                {!node.compact && state.expanded[node.productId!] !== false && (
                  <strong>{format(node.rate)} / min</strong>
                )}
              </>
            )}
            {node.kind === 'recipe' && (
              <div className="building-node-grid">
                <div className="building-ports input-ports">
                  <small>{lang === 'de' ? 'EINGÄNGE' : 'INPUTS'}</small>
                  {(node.inputs || []).map((input) => (
                    <span key={input.productId}>
                      <Img src={iconProduct(input.productId)} />
                      <b>
                        {productName(
                          input.productId,
                          products[input.productId]?.name || input.productId,
                          lang
                        )}
                      </b>
                      <em>{format(input.rate)}/min</em>
                    </span>
                  ))}
                </div>
                <div className="building-machine">
                  <div className="diagram-node-head">
                    <Img src={iconMachine(r?.machine || '')} />
                    <span>
                      <b>{m?.name || r?.name}</b>
                      <small>
                        {r?.name} · T{r ? recipeTechTier(r) : 0}
                      </small>
                    </span>
                    {node.productId && recipeOptions(node.productId).length > 1 && (
                      <button
                        aria-label={lang === 'de' ? 'Rezept wechseln' : 'Change recipe'}
                        onClick={() => onRecipe(node.productId!)}
                      >
                        <ChevronDown />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        node.productId &&
                        setState((current) => ({
                          ...current,
                          diagramCompact: {
                            ...(current.diagramCompact || {}),
                            [node.productId!]: node.compact ? false : true,
                          },
                        }))
                      }
                      aria-label={
                        node.compact
                          ? lang === 'de'
                            ? 'Gebäudedetails anzeigen'
                            : 'Show building details'
                          : lang === 'de'
                            ? 'Nur Gebäude kompakt darstellen'
                            : 'Compact building card only'
                      }
                      title={lang === 'de' ? 'Kartendetails umschalten' : 'Toggle card details'}
                    >
                      {node.compact ? <Plus /> : <ChevronDown />}
                    </button>
                    <button
                      onClick={toggle}
                      aria-label={
                        lang === 'de'
                          ? 'Ganze Eingangskette einklappen'
                          : 'Collapse entire input chain'
                      }
                      title={
                        lang === 'de' ? 'Ganze Eingangskette ausblenden' : 'Hide entire input chain'
                      }
                    >
                      <Minus />
                    </button>
                  </div>
                  <strong>× {format(node.machines || 0)}</strong>
                </div>
                <div className="building-ports output-ports">
                  <small>{lang === 'de' ? 'AUSGÄNGE' : 'OUTPUTS'}</small>
                  {(node.outputs || []).map((output) => (
                    <span key={output.productId}>
                      <Img src={iconProduct(output.productId)} />
                      <b>
                        {productName(
                          output.productId,
                          products[output.productId]?.name || output.productId,
                          lang
                        )}
                      </b>
                      <em>{format(output.rate)}/min</em>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {node.kind === 'goal' && (
              <>
                <div className="diagram-node-head">
                  <Img src={iconProduct(node.productId!)} />
                  <span>
                    <b>{productName(node.productId!, p?.name || node.productId!, lang)}</b>
                    <small>{node.label || node.kind}</small>
                  </span>
                </div>
                <strong>{format(node.rate)} / min</strong>
              </>
            )}
          </>
        )}
      </article>
    );
  },
  (previous, next) =>
    previous.node === next.node &&
    previous.state.expanded === next.state.expanded &&
    previous.state.diagramCompact === next.state.diagramCompact &&
    previous.state.externalSources === next.state.externalSources &&
    previous.lang === next.lang &&
    previous.focused === next.focused &&
    previous.selected === next.selected &&
    previous.dimmed === next.dimmed &&
    previous.viewScale === next.viewScale &&
    previous.simplified === next.simplified
);
