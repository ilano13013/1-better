import type { WeightEntry } from '../types';

/**
 * Suivi du poids. Une pesée isolée ne signifie rien : toutes les décisions
 * s'appuient sur une moyenne glissante.
 */

export function sortedEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

/** Moyenne glissante sur `window` pesées (par défaut 7). */
export function movingAverage(entries: WeightEntry[], window = 7): { date: string; value: number }[] {
  const sorted = sortedEntries(entries);
  return sorted.map((entry, idx) => {
    const slice = sorted.slice(Math.max(0, idx - window + 1), idx + 1);
    const avg = slice.reduce((s, e) => s + e.weightKg, 0) / slice.length;
    return { date: entry.date, value: Math.round(avg * 100) / 100 };
  });
}

/**
 * Variation hebdomadaire en pourcentage du poids de corps, calculée sur les
 * moyennes glissantes pour lisser les fluctuations.
 */
export function weeklyTrendPct(entries: WeightEntry[]): number | null {
  const avg = movingAverage(entries);
  if (avg.length < 4) return null;

  const last = avg[avg.length - 1];
  // On compare à la pesée lissée la plus proche de sept jours en arrière.
  // Sans point de comparaison récent, aucune tendance n'est affirmée.
  const candidates = avg
    .slice(0, -1)
    .map((a) => ({ point: a, days: daysBetween(a.date, last.date) }))
    .filter((c) => c.days >= 3 && c.days <= 21);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => Math.abs(a.days - 7) - Math.abs(b.days - 7));
  const { point: previous, days } = candidates[0];
  if (previous.value <= 0) return null;

  const weekly = ((last.value - previous.value) / days) * 7;
  return Math.round((weekly / previous.value) * 10000) / 100;
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86400000);
}

export function latestWeight(entries: WeightEntry[], fallback: number): number {
  const sorted = sortedEntries(entries);
  return sorted.length ? sorted[sorted.length - 1].weightKg : fallback;
}
