import type { Exercise, Performance, PerformanceSet, WorkoutExercise } from '../types';
import { getExercise } from '../data/exercises';

/**
 * Suivi de progression — règle de double progression.
 *
 * Tant que la borne haute de répétitions n'est pas atteinte sur toutes les
 * séries, on cherche à ajouter des répétitions. Une fois la borne atteinte
 * partout, on propose une augmentation raisonnable de la charge et un retour
 * en bas de fourchette.
 */

export function lastPerformance(exerciseId: string, performances: Performance[]): Performance | null {
  const forExercise = performances
    .filter((p) => p.exerciseId === exerciseId)
    .sort((a, b) => b.date.localeCompare(a.date));
  return forExercise[0] ?? null;
}

export function historyFor(exerciseId: string, performances: Performance[]): Performance[] {
  return performances
    .filter((p) => p.exerciseId === exerciseId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Incrément de charge conseillé selon le type d'exercice et le muscle. */
export function loadIncrement(ex: Exercise): number {
  if (ex.type === 'cardio') return 0;
  const lowerBody = ['quadriceps', 'ischios', 'fessiers'].includes(ex.primary);
  if (ex.type === 'polyarticulaire') return lowerBody ? 5 : 2.5;
  return ex.primary === 'epaules' || ex.primary === 'biceps' || ex.primary === 'triceps' ? 1 : 2.5;
}

export interface ProgressionSuggestion {
  kind: 'charge' | 'repetitions' | 'premiere_seance' | 'stagnation';
  weightKg: number;
  reps: number;
  message: string;
}

export function suggestNext(
  we: WorkoutExercise,
  performances: Performance[],
): ProgressionSuggestion {
  const ex = getExercise(we.exerciseId);
  const history = historyFor(we.exerciseId, performances);
  const last = history[0];

  if (!last || last.sets.length === 0) {
    return {
      kind: 'premiere_seance', weightKg: 0, reps: we.repMin,
      message: we.repUnit === 'reps'
        ? `Première séance : trouve une charge où ${we.repMax} répétitions restent difficiles.`
        : `Première séance : vise ${we.repMin} à ${we.repMax} ${unitLabel(we.repUnit)} en maîtrisant la position.`,
    };
  }

  // Exercices en temps ou en distance : la charge n'est pas le levier.
  if (we.repUnit !== 'reps') {
    const best = Math.max(...last.sets.map((s) => s.reps));
    return {
      kind: 'repetitions',
      weightKg: Math.max(...last.sets.map((s) => s.weightKg)),
      reps: Math.min(we.repMax, best + (we.repUnit === 'sec' ? 5 : 1)),
      message: `Dernière fois : ${best} ${unitLabel(we.repUnit)}. Vise ${Math.min(we.repMax, best + (we.repUnit === 'sec' ? 5 : 1))}.`,
    };
  }

  const topWeight = Math.max(...last.sets.map((s) => s.weightKg));
  const workingSets = last.sets.filter((s) => s.weightKg >= topWeight - 0.01);
  const allAtTop = workingSets.length >= Math.max(1, we.sets - 1)
    && workingSets.every((s) => s.reps >= we.repMax);

  // La borne haute atteinte avec une exécution jugée approximative ne
  // justifie pas d'ajouter de la charge : on consolide la technique d'abord.
  if (allAtTop && last.cleanExecution === false) {
    return {
      kind: 'repetitions',
      weightKg: round(topWeight),
      reps: we.repMax,
      message: `${we.repMax} répétitions atteintes, mais l'exécution n'était pas maîtrisée : garde ${round(topWeight)} kg et soigne la technique avant d'ajouter de la charge.`,
    };
  }

  if (allAtTop) {
    const inc = loadIncrement(ex);
    return {
      kind: 'charge',
      weightKg: round(topWeight + inc),
      reps: we.repMin,
      message: `${we.repMax} répétitions atteintes sur toutes les séries : passe à ${round(topWeight + inc)} kg et repars à ${we.repMin} répétitions.`,
    };
  }

  // Trois séances consécutives sans progression : on signale la stagnation.
  if (history.length >= 3) {
    const volumes = history.slice(0, 3).map(totalVolume);
    if (volumes[0] <= volumes[1] && volumes[1] <= volumes[2]) {
      return {
        kind: 'stagnation',
        weightKg: round(topWeight),
        reps: bestReps(last.sets, topWeight),
        message: 'Trois séances sans progression : réduis la charge de 10 % et reconstruis, ou vérifie sommeil et calories.',
      };
    }
  }

  const reps = bestReps(last.sets, topWeight);
  return {
    kind: 'repetitions',
    weightKg: round(topWeight),
    reps: Math.min(we.repMax, reps + 1),
    message: `Garde ${round(topWeight)} kg et vise ${Math.min(we.repMax, reps + 1)} répétitions.`,
  };
}

export function unitLabel(unit: 'reps' | 'sec' | 'min'): string {
  return unit === 'sec' ? 'secondes' : unit === 'min' ? 'minutes' : 'répétitions';
}

function bestReps(sets: PerformanceSet[], weight: number): number {
  const matching = sets.filter((s) => s.weightKg >= weight - 0.01);
  return matching.length ? Math.max(...matching.map((s) => s.reps)) : 0;
}

export function totalVolume(p: Performance): number {
  return p.sets.reduce((s, set) => s + set.weightKg * set.reps, 0);
}

/** Estimation du maximum théorique (formule d'Epley). */
export function estimated1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return round(weightKg * (1 + reps / 30));
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1RM: number;
  date: string;
}

export function personalRecords(performances: Performance[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const p of performances) {
    for (const set of p.sets) {
      // Sans charge (gainage, poids du corps), il n'y a pas de record de force.
      if (set.weightKg <= 0) continue;
      const e1rm = estimated1RM(set.weightKg, set.reps);
      const current = best.get(p.exerciseId);
      if (!current || e1rm > current.estimated1RM) {
        best.set(p.exerciseId, {
          exerciseId: p.exerciseId,
          exerciseName: safeName(p.exerciseId),
          weightKg: set.weightKg,
          reps: set.reps,
          estimated1RM: e1rm,
          date: p.date,
        });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.estimated1RM - a.estimated1RM);
}

function safeName(exerciseId: string): string {
  try {
    return getExercise(exerciseId).name;
  } catch {
    return exerciseId;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
