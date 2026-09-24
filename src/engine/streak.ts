import type { DayIndex } from '../types';
import { addDays, daysBetween, toDay, weekdayOf } from './schedule';

/**
 * LE CYCLE 1 % — la série, portée par le nom de l'application.
 *
 * Une séance validée ajoute **un point de pourcentage**. Cent séances font un
 * cycle complet. Les jours de repos ne comptent pas et ne cassent rien : ils
 * sont prévus, les ignorer serait punir quelqu'un de suivre son programme.
 * Manquer une séance **prévue** et passée, en revanche, remet le compteur à
 * zéro — sans quoi ce ne serait pas une série.
 *
 * La journée en cours ne casse jamais rien : tant qu'elle n'est pas finie, une
 * séance non encore faite n'est pas une séance manquée.
 *
 * Ce qu'on gagne à 100 %
 * ----------------------
 * Pas une médaille : un chiffre vrai. Progresser de 1 % par jour n'additionne
 * pas, cela compose — 1,01^100 ≈ 2,70. Cent séances ne rendent donc pas
 * « 100 % meilleur » : elles multiplient par 2,7. C'est la promesse du nom,
 * prise au mot, et elle continue au cycle suivant : 200 séances, ×7,3.
 */

export interface Streak {
  /** Séances consécutives validées, tous cycles confondus. */
  total: number;
  /** Progression dans le cycle en cours, de 0 à 100. */
  percent: number;
  /** Cycles de cent séances achevés. */
  cycles: number;
  /** Facteur composé, 1,01 puissance `total`. */
  multiplier: number;
  /** Vrai le jour exact où un cycle vient de se boucler. */
  completed: boolean;
  /** Une séance est prévue aujourd'hui et n'est pas encore validée. */
  dueToday: boolean;
  /** Date de la dernière séance validée. */
  lastDate: string | null;
}

/** Jours de la semaine où une séance est prévue. */
export function trainingWeekdays(workoutDays: DayIndex[]): Set<number> {
  return new Set(workoutDays);
}

/**
 * Remonte le temps depuis aujourd'hui jusqu'à ce que la chaîne casse.
 *
 * Remonter plutôt que descendre évite d'avoir à choisir une origine : la série
 * en cours est par définition celle qui touche aujourd'hui.
 */
export function computeStreak(
  validated: string[],
  workoutDays: DayIndex[],
  today: Date = new Date(),
  startDate: string | null = null,
  maxLookbackDays = 500,
): Streak {
  const trained = new Set(validated);
  const scheduled = trainingWeekdays(workoutDays);
  const todayIso = toDay(today);

  let total = 0;
  let lastDate: string | null = null;
  let cursor = todayIso;

  for (let i = 0; i < maxLookbackDays; i++) {
    // Rien n'est attendu avant le début du programme.
    if (startDate && daysBetween(startDate, cursor) < 0) break;

    if (scheduled.has(weekdayOf(cursor))) {
      if (trained.has(cursor)) {
        total++;
        if (!lastDate) lastDate = cursor;
      } else if (cursor !== todayIso) {
        break;                       // séance prévue et manquée : la série casse
      }
      // Aujourd'hui sans séance encore faite : la journée n'est pas finie.
    }
    cursor = addDays(cursor, -1);
  }

  const cycles = Math.floor(total / 100);
  const rest = total % 100;
  const completed = total > 0 && rest === 0;

  return {
    total,
    percent: completed ? 100 : rest,
    cycles,
    multiplier: Math.round(1.01 ** total * 100) / 100,
    completed,
    dueToday: scheduled.has(weekdayOf(todayIso)) && !trained.has(todayIso),
    lastDate,
  };
}

/** Texte affiché du pourcentage : « 7 % », et « 1,0 % » au tout début. */
export function formatPercent(percent: number): string {
  if (percent === 0) return '0';
  if (percent === 1) return '1,0';
  return String(percent);
}

/**
 * Les paliers du cycle. Ils ne débloquent rien : ils nomment où l'on en est,
 * ce qui vaut mieux qu'une barre nue.
 */
export interface Milestone { at: number; label: string }

export const MILESTONES: Milestone[] = [
  { at: 1, label: 'Le premier pour cent' },
  { at: 10, label: 'Dix séances' },
  { at: 25, label: 'Un quart du cycle' },
  { at: 50, label: 'La moitié' },
  { at: 75, label: 'Trois quarts' },
  { at: 100, label: 'Cycle complet' },
];

/** Le palier suivant, ou `null` quand le cycle est bouclé. */
export function nextMilestone(percent: number): Milestone | null {
  return MILESTONES.find((m) => m.at > percent) ?? null;
}

/** Ce que le cycle achevé a réellement produit, en toutes lettres. */
export function cycleReward(streak: Streak): string {
  const x = streak.multiplier.toFixed(2).replace('.', ',');
  return `Cent séances d'affilée. Un pour cent par jour ne s'additionne pas, `
    + `il se compose : tu n'es pas 100 % meilleur, tu es multiplié par ${x}.`;
}
