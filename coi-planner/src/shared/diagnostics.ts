import type { Lang } from '../i18n';
import type { Diagnostic } from '../types';

const value = (diagnostic: Diagnostic, key: string) => diagnostic.params?.[key] ?? '';
const number = (diagnostic: Diagnostic, key: string, lang: Lang, digits = 3) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(
    Number(diagnostic.params?.[key] ?? 0)
  );

export function diagnosticText(diagnostic: Diagnostic, lang: Lang): string {
  const de = lang === 'de';
  switch (diagnostic.code) {
    case 'solver.nonConverged':
      return de
        ? `Materialbilanz nicht vollständig konvergiert (Restfehler ${number(diagnostic, 'residual', lang, 6)}/min).`
        : `Material balance did not fully converge (residual ${number(diagnostic, 'residual', lang, 6)}/min).`;
    case 'solver.jobLimit':
      return de
        ? `Produktionsberechnung erreichte das Sicherheitslimit von ${number(diagnostic, 'limit', lang, 0)} Jobs.`
        : `Production calculation reached its safety limit of ${number(diagnostic, 'limit', lang, 0)} jobs.`;
    case 'solver.routeLimit':
      return de
        ? `Ausgangsrouten erreichten das Durchlauflimit von ${value(diagnostic, 'limit')}.`
        : `Output routes reached the pass limit of ${value(diagnostic, 'limit')}.`;
    case 'solver.balanceResidual':
      return de
        ? `Interne Bedarfsbilanz weist einen Restfehler von ${number(diagnostic, 'residual', lang, 8)}/min auf.`
        : `Internal demand balance has a residual of ${number(diagnostic, 'residual', lang, 8)}/min.`;
    case 'data.unknownCapacity':
      return de
        ? `${value(diagnostic, 'product')}: Förderkapazität ist unbekannt; Bedarf bleibt extern offen.`
        : `${value(diagnostic, 'product')}: extraction capacity is unknown; demand remains external.`;
    case 'route.invalidDisposition':
      return de
        ? `${value(diagnostic, 'product')}: gewählte Verwendung ist aktuell nicht möglich.`
        : `${value(diagnostic, 'product')}: the selected disposition is currently unavailable.`;
    case 'source.missing':
      return de
        ? `${value(diagnostic, 'product')}: externe Herkunft fehlt.`
        : `${value(diagnostic, 'product')}: external source is missing.`;
    case 'constraint.exceeded':
      return `${value(diagnostic, 'resource')}: ${number(diagnostic, 'used', lang)} > ${number(diagnostic, 'limit', lang)}${value(diagnostic, 'unit')}`;
  }
}
