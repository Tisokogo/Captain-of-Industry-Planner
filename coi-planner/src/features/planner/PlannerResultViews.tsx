import {
  calculate,
  format,
  iconMachine,
  iconProduct,
  machines,
  products,
  recipes,
} from '../../domain/solver/planCalculator';
import { productName, type Lang } from '../../i18n';
import { diagnosticText } from '../../shared/diagnostics';
import { GameImage as Img } from '../../shared/GameImage';

export function ResultListView({
  view,
  result,
  lang,
}: {
  view: 'materials' | 'buildings' | 'balance';
  result: ReturnType<typeof calculate>;
  lang: Lang;
}) {
  if (view === 'materials') {
    const inputs = Object.entries(result.inputs)
      .filter(([, rate]) => rate > 0.005)
      .sort((a, b) => b[1] - a[1]);
    const outputs = Object.entries(result.grossSurplus)
      .filter(([, rate]) => rate > 0.005)
      .sort((a, b) => b[1] - a[1]);
    return (
      <div className="result-scroll result-columns">
        <ResultGroup
          title={lang === 'de' ? 'Benötigte Rohstoffe' : 'Required resources'}
          count={inputs.length}
        >
          {inputs.map(([id, rate]) => (
            <ResultRow
              key={id}
              icon={iconProduct(id)}
              name={productName(id, products[id]?.name || id, lang)}
              value={`${format(rate)}/min`}
            />
          ))}
        </ResultGroup>
        <ResultGroup
          title={lang === 'de' ? 'Netto-Ausgänge' : 'Net outputs'}
          count={outputs.length}
        >
          {outputs.map(([id, rate]) => (
            <ResultRow
              key={id}
              icon={iconProduct(id)}
              name={productName(id, products[id]?.name || id, lang)}
              value={`${format(rate)}/min`}
            />
          ))}
        </ResultGroup>
      </div>
    );
  }

  if (view === 'buildings') {
    return (
      <div className="result-scroll">
        <ResultGroup
          title={lang === 'de' ? 'Produktionsgebäude' : 'Production buildings'}
          count={result.machines.length}
        >
          {[...result.machines]
            .sort((a, b) => b.count - a.count)
            .map((entry) => (
              <ResultRow
                key={entry.recipeId}
                icon={iconMachine(entry.machineId)}
                name={machines[entry.machineId]?.name || entry.machineId}
                detail={recipes[entry.recipeId]?.name || entry.recipeId}
                value={`× ${format(entry.count)}`}
                meta={`${format(entry.power / 1000)} MW · ${format(entry.workers, 0)} ${lang === 'de' ? 'Arbeiter' : 'workers'}`}
              />
            ))}
        </ResultGroup>
      </div>
    );
  }

  const machineCount = result.machines.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <div className="result-scroll balance-view">
      <div className="balance-kpis">
        <div>
          <small>{lang === 'de' ? 'Maschinen' : 'Machines'}</small>
          <b>{format(machineCount, 1)}</b>
        </div>
        <div>
          <small>{lang === 'de' ? 'Strom' : 'Power'}</small>
          <b>{format(result.power / 1000, 2)} MW</b>
        </div>
        <div>
          <small>{lang === 'de' ? 'Arbeiter' : 'Workers'}</small>
          <b>{format(result.workers, 0)}</b>
        </div>
        <div>
          <small>Computing</small>
          <b>{format(result.computing, 1)}</b>
        </div>
        <div>
          <small>{lang === 'de' ? 'Wartung' : 'Maintenance'}</small>
          <b>{format(result.maintenance, 1)}</b>
        </div>
        <div>
          <small>{lang === 'de' ? 'Solver-Residuum' : 'Solver residual'}</small>
          <b>{format(result.solverResidual, 8)}</b>
        </div>
      </div>
      <ResultGroup
        title={
          result.constraintWarnings.length
            ? lang === 'de'
              ? 'Hinweise und Probleme'
              : 'Notices and issues'
            : lang === 'de'
              ? 'Plan vollständig bilanziert'
              : 'Plan fully balanced'
        }
        count={result.constraintWarnings.length}
      >
        {result.constraintWarnings.length ? (
          result.constraintWarnings.map((warning, index) => (
            <div className="result-notice" key={`${warning.code}:${index}`}>
              {diagnosticText(warning, lang)}
            </div>
          ))
        ) : (
          <div className="result-success">
            {lang === 'de'
              ? 'Keine fachlichen Warnungen. Alle internen Bedarfe sind ausgeglichen.'
              : 'No domain warnings. All internal demands are balanced.'}
          </div>
        )}
      </ResultGroup>
    </div>
  );
}

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="result-group">
      <header>
        <h3>{title}</h3>
        <b>{count}</b>
      </header>
      <div>{children}</div>
    </section>
  );
}

function ResultRow({
  icon,
  name,
  detail,
  value,
  meta,
}: {
  icon: string;
  name: string;
  detail?: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="result-row">
      <Img src={icon} />
      <span>
        <b>{name}</b>
        {detail && <small>{detail}</small>}
        {meta && <em>{meta}</em>}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
