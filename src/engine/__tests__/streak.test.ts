import { describe, expect, it } from 'vitest';
import {
  addDays, daysBetween, daysUntilStart, hasStarted, longDate, plannedDays,
  startOptions, weekdayOf,
} from '../schedule';
import { computeStreak, cycleReward, formatPercent, nextMilestone } from '../streak';
import { buildPlan } from '../planner';
import { demoState } from '../../store/state';
import type { DayIndex, Performance } from '../../types';

const perf = (date: string): Performance => ({
  id: `p${date}`, exerciseId: 'developpe_couche_halteres', date,
  sets: [{ weightKg: 20, reps: 10 }], cleanExecution: true,
});

/** Lundi 21 septembre 2026. */
const LUNDI = '2026-09-21';
const at = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

describe('date de départ', () => {
  it('lit le jour de la semaine, lundi en tête', () => {
    expect(weekdayOf(LUNDI)).toBe(0);
    expect(weekdayOf('2026-09-24')).toBe(3);   // jeudi
    expect(weekdayOf('2026-09-27')).toBe(6);   // dimanche
  });

  it('compte les jours dans les deux sens, changement de mois compris', () => {
    expect(daysBetween('2026-09-21', '2026-09-24')).toBe(3);
    expect(daysBetween('2026-09-24', '2026-09-21')).toBe(-3);
    expect(daysBetween('2026-09-30', '2026-10-01')).toBe(1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('planifie à partir du jour choisi, en bouclant sur la semaine', () => {
    // Un départ le jeudi planifie jeudi, vendredi, samedi — pas lundi à mercredi.
    expect(plannedDays(3, 3)).toEqual([3, 4, 5]);
    expect(plannedDays(5, 3)).toEqual([5, 6, 0]);   // samedi, dimanche, lundi
    expect(plannedDays(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(plannedDays(4, 7)).toHaveLength(7);
    expect(new Set(plannedDays(4, 7)).size).toBe(7); // aucun doublon
  });

  it('n\'offre « lundi prochain » que s\'il dit autre chose', () => {
    // Lundi, il ferait doublon avec « aujourd'hui » ; dimanche, avec « demain ».
    expect(startOptions(at(LUNDI)).map((o) => o.id)).toEqual(['today', 'tomorrow']);
    expect(startOptions(at('2026-09-27')).map((o) => o.id)).toEqual(['today', 'tomorrow']);
    // Mardi, il propose vraiment autre chose : attendre la semaine entière.
    expect(startOptions(at('2026-09-22')).map((o) => o.id))
      .toEqual(['today', 'tomorrow', 'monday']);
    const jeudi = startOptions(at('2026-09-24'));
    expect(jeudi.map((o) => o.id)).toEqual(['today', 'tomorrow', 'monday']);
    expect(jeudi[2].date).toBe('2026-09-28');    // le lundi suivant
  });

  it('sait si le programme a commencé', () => {
    expect(hasStarted('2026-09-24', at('2026-09-23'))).toBe(false);
    expect(hasStarted('2026-09-24', at('2026-09-24'))).toBe(true);  // le jour même
    expect(hasStarted('2026-09-24', at('2026-09-25'))).toBe(true);
    // Départ non choisi : rien n'attend.
    expect(hasStarted(null, at('2026-09-23'))).toBe(true);
    expect(daysUntilStart('2026-09-28', at('2026-09-23'))).toBe(5);
    expect(daysUntilStart('2026-09-20', at('2026-09-23'))).toBe(0);
  });

  it('écrit la date en toutes lettres', () => {
    expect(longDate('2026-09-24')).toBe('jeudi 24 septembre');
    expect(longDate('2026-01-01')).toBe('jeudi 1 janvier');
  });

  it('décale réellement les jours planifiés du plan', () => {
    const jeudi = { ...demoState(), plan: 'free' as const, startDate: '2026-09-24' };
    const jours = buildPlan(jeudi).mealPlan.days.map((d) => d.day);
    expect(jours).toEqual([3, 4, 5]);          // jeudi, vendredi, samedi
    const lundi = { ...demoState(), plan: 'free' as const, startDate: LUNDI };
    expect(buildPlan(lundi).mealPlan.days.map((d) => d.day)).toEqual([0, 1, 2]);
  });
});

describe('cycle 1 %', () => {
  // Séances prévues le mardi (1), jeudi (3) et samedi (5).
  const jours: DayIndex[] = [1, 3, 5];

  it('part de zéro sans aucune séance', () => {
    const s = computeStreak([], jours, at('2026-09-24'));
    expect(s.total).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.multiplier).toBe(1);
  });

  it('ajoute un point par séance validée', () => {
    // Mardi 22 et jeudi 24 validés.
    const s = computeStreak([perf('2026-09-22'), perf('2026-09-24')], jours, at('2026-09-24'));
    expect(s.total).toBe(2);
    expect(s.percent).toBe(2);
  });

  it('ne casse pas sur un jour de repos', () => {
    // Mercredi 23 n'est pas un jour d'entraînement : il ne compte ni ne casse.
    const s = computeStreak([perf('2026-09-22'), perf('2026-09-24')], jours, at('2026-09-25'));
    expect(s.total).toBe(2);
  });

  it('casse sur une séance prévue et manquée', () => {
    // Jeudi 24 manqué : seule la séance du samedi 26 reste.
    const s = computeStreak([perf('2026-09-22'), perf('2026-09-26')], jours, at('2026-09-26'));
    expect(s.total).toBe(1);
  });

  it('ne casse jamais sur la journée en cours', () => {
    // Jeudi 24, séance prévue mais pas encore faite : la journée n'est pas finie.
    const s = computeStreak([perf('2026-09-22')], jours, at('2026-09-24'));
    expect(s.total).toBe(1);
    expect(s.dueToday).toBe(true);
  });

  it('ignore ce qui précède le début du programme', () => {
    const s = computeStreak([perf('2026-09-22')], jours, at('2026-09-24'), '2026-09-23');
    expect(s.total).toBe(0);    // le mardi 22 est avant le départ
  });

  it('boucle un cycle à cent séances, et compose', () => {
    // Cent séances d'affilée sur les jours prévus.
    const dates: string[] = [];
    let cursor = at('2026-09-22');
    while (dates.length < 100) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (jours.includes(weekdayOf(iso) as DayIndex)) dates.push(iso);
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    const dernier = dates[dates.length - 1];
    const s = computeStreak(dates.map(perf), jours, at(dernier));
    expect(s.total).toBe(100);
    expect(s.percent).toBe(100);
    expect(s.cycles).toBe(1);
    expect(s.completed).toBe(true);
    // 1,01^100 ≈ 2,70 : cent séances ne rendent pas « 100 % meilleur ».
    expect(s.multiplier).toBeCloseTo(2.7, 1);
    expect(cycleReward(s)).toContain('2,70');
  });

  it('nomme les paliers, et s\'arrête à cent', () => {
    expect(nextMilestone(0)?.at).toBe(1);
    expect(nextMilestone(1)?.at).toBe(10);
    expect(nextMilestone(74)?.at).toBe(75);
    expect(nextMilestone(100)).toBeNull();
  });

  it('écrit « 1,0 » au tout premier point', () => {
    // Le même parti pris que l'écran de construction : le premier pour cent
    // se lit « 1,0 % », pas « 1 % ».
    expect(formatPercent(0)).toBe('0');
    expect(formatPercent(1)).toBe('1,0');
    expect(formatPercent(42)).toBe('42');
  });
});
