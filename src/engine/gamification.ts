import type { AppState, Performance, WeeklyCheckIn } from '../types';
import { personalRecords } from './progression';

/**
 * Gamification discrète : compteurs factuels, pas de récompenses infantilisantes.
 */

export interface Badge {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  progress: number; // 0 → 1
}

/** Une séance = une date à laquelle au moins une performance a été saisie. */
export function sessionCount(performances: Performance[]): number {
  return new Set(performances.map((p) => p.date.slice(0, 10))).size;
}

/** Semaines consécutives où toutes les séances prévues ont été réalisées. */
export function weekStreak(checkIns: WeeklyCheckIn[], sessionsPerWeek: number): number {
  const sorted = [...checkIns].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const c of sorted) {
    if (c.sessionsDone >= sessionsPerWeek) streak++;
    else break;
  }
  return streak;
}

export function buildBadges(state: AppState): Badge[] {
  const sessions = sessionCount(state.performances);
  const streak = weekStreak(state.checkIns, state.profile.sessionsPerWeek);
  const prs = personalRecords(state.performances).length;
  const weighIns = state.weightEntries.length;

  const mk = (id: string, label: string, description: string, value: number, target: number): Badge => ({
    id, label, description,
    unlocked: value >= target,
    progress: Math.min(1, target > 0 ? value / target : 0),
  });

  return [
    mk('first_session', 'Première séance', 'Enregistre ta première séance.', sessions, 1),
    mk('ten_sessions', '10 séances', 'Dix séances enregistrées.', sessions, 10),
    mk('fifty_sessions', '50 séances', 'Cinquante séances enregistrées.', sessions, 50),
    mk('streak_4', '4 semaines pleines', 'Quatre semaines consécutives complètes.', streak, 4),
    mk('streak_12', '12 semaines pleines', 'Douze semaines consécutives complètes.', streak, 12),
    mk('records_5', '5 records', 'Cinq records personnels établis.', prs, 5),
    mk('weighin_10', 'Suivi régulier', 'Dix pesées enregistrées.', weighIns, 10),
    mk('checkins_4', 'Quatre check-ins', 'Quatre bilans hebdomadaires complétés.', state.checkIns.length, 4),
  ];
}

export function progressToGoal(current: number, start: number, target: number): number {
  if (start === target) return 1;
  const done = (current - start) / (target - start);
  return Math.max(0, Math.min(1, done));
}
