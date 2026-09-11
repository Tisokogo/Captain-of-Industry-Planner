import { calculate, format } from '../../domain/solver/planCalculator';
import { productCapabilities } from '../../domain/data/gameData';
import { tr, type Lang } from '../../i18n';

export type SourceOption = { id: string; label: string };

export function sourceOptions(lang: Lang, productId?: string): SourceOption[] {
  const options: SourceOption[] = [{ id: 'unused', label: tr(lang, 'unused') }];
  if (!productId) {
    return [
      ...options,
      { id: 'mine', label: tr(lang, 'mine') },
      { id: 'ship', label: tr(lang, 'shipImport') },
      { id: 'trade', label: tr(lang, 'trade') },
      { id: 'storage', label: tr(lang, 'storage') },
      { id: 'manual', label: tr(lang, 'manual') },
    ];
  }

  const capability = productCapabilities[productId];
  if (capability?.extractable) {
    options.push({ id: 'mine', label: tr(lang, 'mine') });
  }
  if (capability?.importable) {
    options.push(
      { id: 'ship', label: tr(lang, 'shipImport') },
      { id: 'trade', label: tr(lang, 'trade') }
    );
  }
  if (capability?.routes.storage.length) {
    options.push({ id: 'storage', label: tr(lang, 'storage') });
  }
  options.push({ id: 'manual', label: tr(lang, 'manual') });
  return options;
}

export function sourceRequirementText(
  lang: Lang,
  requirement: ReturnType<typeof calculate>['externalRequirements'][number]
) {
  const notes = {
    'source.mineEstimate': {
      de: 'Schätzung: 60 Einheiten/min je Förderlinie und Fahrzeug',
      en: 'Estimate: 60 units/min per extraction line and vehicle',
    },
    'source.shipEstimate': {
      de: 'Schätzung: 180 Einheiten/min je Cargo-Modul',
      en: 'Estimate: 180 units/min per cargo module',
    },
    'source.tradeEstimate': {
      de: 'Planungsannahme: 0,02 Unity je Einheit',
      en: 'Planning assumption: 0.02 Unity per unit',
    },
    'source.storageBuffer': {
      de: 'Auslegung für 60 Minuten Puffer',
      en: 'Sized for a 60-minute buffer',
    },
    'source.manual': { de: 'Manuell bereitgestellte Rate', en: 'Manually supplied rate' },
    'source.unassigned': { de: 'Herkunft noch nicht zugewiesen', en: 'Source not assigned' },
  } as const;
  const note = notes[requirement.assumptionCode][lang];

  return `${note}${
    requirement.facilityCount
      ? ` · ${format(requirement.facilityCount, 2)} ${lang === 'de' ? 'Anlagen' : 'facilities'}`
      : ''
  }${
    requirement.vehicleCount
      ? ` · ${format(requirement.vehicleCount, 1)} ${
          lang === 'de' ? 'Fahrzeuge/Frachter' : 'vehicles/ships'
        }`
      : ''
  }${requirement.unityPerMinute ? ` · ${format(requirement.unityPerMinute, 2)} Unity/min` : ''}${
    requirement.bufferCapacity
      ? ` · ${format(requirement.bufferCapacity, 0)} ${lang === 'de' ? 'Kapazität' : 'capacity'}`
      : ''
  }`;
}
