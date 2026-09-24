import { daysBetween } from './weight';

/**
 * GÉOMÉTRIE DE LA COURBE DE POIDS.
 *
 * Séparée du rendu pour être vérifiable : une courbe qui ment le fait dans ses
 * coordonnées, pas dans ses couleurs.
 *
 * Trois partis pris, et ce sont des corrections de défauts réels :
 *
 * 1. **L'abscisse suit les dates, pas le rang.** Espacer les points
 *    régulièrement faisait se ressembler deux pesées à un jour d'écart et deux
 *    pesées à trois semaines d'écart. La pente affichée n'était pas la pente
 *    réelle.
 * 2. **Les pesées brutes ne sont pas reliées.** Les relier donne à du bruit
 *    l'allure d'un signal, alors que toute l'application répète qu'une pesée
 *    isolée ne signifie rien. Seule la moyenne glissante est une courbe.
 * 3. **L'échelle verticale inclut l'objectif** quand il est proche, et se
 *    borne à un minimum de 2 kg. Sans plancher, trois pesées à 200 g d'écart
 *    dessinaient des montagnes russes.
 */

export interface Point { x: number; y: number; date: string; value: number }

export interface Domain { min: number; max: number }

/** Amplitude minimale de l'axe vertical, en kilogrammes. */
export const MIN_SPAN_KG = 2;

/** Écart au-delà duquel l'objectif cesse d'être un repère lisible. */
export const TARGET_REACH_KG = 5;

/**
 * Bornes de l'axe vertical.
 *
 * L'objectif entre dans le calcul s'il n'est pas absurdement loin : le montrer
 * hors d'atteinte écraserait la courbe sur une ligne plate.
 */
export function weightDomain(values: number[], target?: number): Domain {
  if (values.length === 0) return { min: 0, max: MIN_SPAN_KG };

  let lo = Math.min(...values);
  let hi = Math.max(...values);

  if (target !== undefined) {
    /*
     * L'objectif entre dans l'échelle tant qu'il reste un repère utile. Un
     * seuil trop serré l'écartait alors qu'il ne l'était que de 2,6 kg — la
     * carte annonçait « objectif 66,0 kg » et la courbe ne le montrait pas.
     * Au-delà de cinq kilos, c'est un objectif de long terme : l'afficher
     * écraserait la courbe sur une ligne plate.
     */
    const reach = Math.max(TARGET_REACH_KG, (hi - lo) * 2);
    if (target >= lo - reach && target <= hi + reach) {
      lo = Math.min(lo, target);
      hi = Math.max(hi, target);
    }
  }

  const span = hi - lo;
  if (span < MIN_SPAN_KG) {
    const pad = (MIN_SPAN_KG - span) / 2;
    lo -= pad;
    hi += pad;
  } else {
    const pad = span * 0.12;
    lo -= pad;
    hi += pad;
  }
  return { min: Math.round(lo * 10) / 10, max: Math.round(hi * 10) / 10 };
}

/**
 * Convertit une série datée en points, l'abscisse proportionnelle au temps.
 *
 * Une seule pesée, ou plusieurs le même jour : tout se superpose en abscisse.
 * On centre alors plutôt que de diviser par zéro.
 */
export function toPoints(
  series: { date: string; value: number }[],
  domain: Domain,
  width: number,
  height: number,
  first: string,
  last: string,
): Point[] {
  const totalDays = daysBetween(first, last);
  const span = Math.max(0.001, domain.max - domain.min);
  return series.map((s) => ({
    x: totalDays <= 0 ? width / 2 : (daysBetween(first, s.date) / totalDays) * width,
    y: height - ((s.value - domain.min) / span) * height,
    date: s.date,
    value: s.value,
  }));
}

/** Ordonnée d'une valeur, pour une ligne de référence. */
export function yFor(value: number, domain: Domain, height: number): number {
  const span = Math.max(0.001, domain.max - domain.min);
  return height - ((value - domain.min) / span) * height;
}

/** Chemin SVG d'une ligne. Vide si moins de deux points. */
export function linePath(points: Point[]): string {
  if (points.length < 2) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

/**
 * Point le plus proche d'une abscisse — pour le survol.
 *
 * On cherche en abscisse seulement : viser en deux dimensions obligerait à
 * pointer le point au pixel près, alors qu'on désigne une date.
 */
export function nearestPoint(points: Point[], x: number): Point | null {
  if (points.length === 0) return null;
  return points.reduce((best, p) =>
    Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best);
}

/** `2026-09-24` → `24 sept.` */
const SHORT_MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${SHORT_MONTHS[Number(m[2]) - 1]}`;
}

/** `63.4` → `63,4`. Les décimales séparées par une virgule, comme partout. */
export function kgLabel(value: number): string {
  return value.toFixed(1).replace('.', ',');
}
