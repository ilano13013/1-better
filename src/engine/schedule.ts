import type { DayIndex } from '../types';

/**
 * DATE DE DÉPART — le jour où le programme commence vraiment.
 *
 * Quelqu'un qui finit son questionnaire un jeudi soir n'a pas envie d'un plan
 * dont les trois premiers jours sont déjà passés. Le départ choisi décide donc
 * **quels jours sont planifiés**, pas seulement à partir de quand on les
 * regarde : une semaine qui commence le jeudi planifie jeudi, vendredi,
 * samedi — et non lundi, mardi, mercredi.
 *
 * Les indices de jour restent ceux de la semaine (0 = lundi). C'est ce qui
 * permet aux disponibilités d'entraînement, saisies en jours de la semaine, de
 * rester vraies quel que soit le départ : « je m'entraîne mardi et jeudi »
 * veut dire mardi et jeudi, pas « le deuxième et le quatrième jour ».
 */

const DAY_MS = 86_400_000;

/** Jour de la semaine d'une date ISO, 0 = lundi. */
export function weekdayOf(iso: string): DayIndex {
  const d = parseDay(iso);
  if (!d) return 0;
  return ((d.getDay() + 6) % 7) as DayIndex;
}

export function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toDay(d);
}

/** Écart en jours entiers, négatif si `from` est postérieur à `to`. */
export function daysBetween(from: string, to: string): number {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * Les jours de la semaine réellement planifiés, à partir du jour de départ.
 *
 * Renvoyés dans l'ordre du programme — jeudi, vendredi, samedi — et non dans
 * l'ordre de la semaine : c'est la suite vécue, pas le calendrier.
 */
export function plannedDays(startWeekday: DayIndex, count: number): DayIndex[] {
  const n = Math.max(0, Math.min(7, count));
  return Array.from({ length: n }, (_, i) => ((startWeekday + i) % 7) as DayIndex);
}

export interface StartOption {
  id: 'today' | 'tomorrow' | 'monday';
  label: string;
  hint: string;
  date: string;
}

/**
 * Les trois départs proposés.
 *
 * « Lundi prochain » disparaît quand on est déjà lundi : proposer d'attendre
 * sept jours un jour où l'on peut commencer tout de suite n'aide personne.
 */
export function startOptions(today: Date = new Date()): StartOption[] {
  const todayIso = toDay(today);
  const weekday = weekdayOf(todayIso);
  const untilMonday = weekday === 0 ? 0 : 7 - weekday;

  const options: StartOption[] = [
    { id: 'today', label: "Aujourd'hui", hint: 'Le programme démarre maintenant.', date: todayIso },
    { id: 'tomorrow', label: 'Demain', hint: 'Une journée pour faire les courses.', date: addDays(todayIso, 1) },
  ];
  if (untilMonday >= 2) {
    options.push({
      id: 'monday',
      label: 'Lundi prochain',
      hint: `Dans ${untilMonday} jours, sur une semaine entière.`,
      date: addDays(todayIso, untilMonday),
    });
  }
  return options;
}

/** Le programme a-t-il déjà commencé ? */
export function hasStarted(startDate: string | null, today: Date = new Date()): boolean {
  if (!startDate) return true;             // pas encore choisi : rien n'attend
  return daysBetween(startDate, toDay(today)) >= 0;
}

/** Jours restants avant le départ, 0 si le programme a commencé. */
export function daysUntilStart(startDate: string | null, today: Date = new Date()): number {
  if (!startDate) return 0;
  return Math.max(0, daysBetween(toDay(today), startDate));
}

const LONG_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** `2026-09-24` → `jeudi 24 septembre`. Une date de départ se lit. */
export function longDate(iso: string): string {
  const d = parseDay(iso);
  if (!d) return iso;
  return `${LONG_DAYS[weekdayOf(iso)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
