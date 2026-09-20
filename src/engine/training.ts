import type {
  DayIndex, EquipmentId, Exercise, ExerciseType, GoalId, MuscleGroup,
  Profile, TrainingLevel, Workout, WorkoutExercise, WorkoutPlan,
} from '../types';
import { EXERCISES, getExercise } from '../data/exercises';
import { resolveEquipment } from '../data/gyms';

/**
 * Moteur de programmation sportive, déterministe.
 *
 * Entrées  : profil + objectif + niveau + fréquence + salle + équipements + durée
 * Sorties  : split + séances + exercices + séries + répétitions + récupération
 *
 * Aucune génération de contenu : les exercices proviennent exclusivement de
 * la base `EXERCISES`, filtrée par les équipements réellement disponibles.
 */

const LEVEL_RANK: Record<TrainingLevel, number> = { debutant: 0, intermediaire: 1, avance: 2 };

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const DAY_SHORT = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

interface SessionSlot {
  muscle: MuscleGroup;
  type: ExerciseType;
}

interface SessionTemplate {
  name: string;
  focus: MuscleGroup[];
  slots: SessionSlot[];
}

const c = (muscle: MuscleGroup): SessionSlot => ({ muscle, type: 'polyarticulaire' });
const i = (muscle: MuscleGroup): SessionSlot => ({ muscle, type: 'isolation' });

const TEMPLATES: Record<string, SessionTemplate> = {
  push: {
    name: 'Push', focus: ['pectoraux', 'epaules', 'triceps'],
    slots: [c('pectoraux'), c('pectoraux'), c('epaules'), i('epaules'), i('triceps'), i('pectoraux'), i('triceps')],
  },
  pull: {
    name: 'Pull', focus: ['dos', 'biceps'],
    slots: [c('dos'), c('dos'), c('dos'), i('epaules'), i('biceps'), i('biceps'), i('dos')],
  },
  legs: {
    name: 'Legs', focus: ['quadriceps', 'ischios', 'fessiers'],
    slots: [c('quadriceps'), c('ischios'), c('quadriceps'), c('fessiers'), i('quadriceps'), i('ischios'), i('mollets'), i('abdos')],
  },
  upper: {
    name: 'Upper', focus: ['pectoraux', 'dos', 'epaules'],
    slots: [c('pectoraux'), c('dos'), c('epaules'), c('dos'), i('pectoraux'), i('epaules'), i('biceps'), i('triceps')],
  },
  lower: {
    name: 'Lower', focus: ['quadriceps', 'ischios', 'fessiers'],
    slots: [c('quadriceps'), c('ischios'), c('quadriceps'), c('fessiers'), i('mollets'), i('abdos')],
  },
  full_a: {
    name: 'Full Body A', focus: ['quadriceps', 'pectoraux', 'dos'],
    slots: [c('quadriceps'), c('pectoraux'), c('dos'), i('epaules'), i('triceps'), i('abdos')],
  },
  full_b: {
    name: 'Full Body B', focus: ['ischios', 'dos', 'epaules'],
    slots: [c('ischios'), c('dos'), c('pectoraux'), c('epaules'), i('biceps'), i('mollets')],
  },
  full_c: {
    name: 'Full Body C', focus: ['quadriceps', 'dos', 'pectoraux'],
    slots: [c('quadriceps'), c('dos'), c('pectoraux'), i('epaules'), i('biceps'), i('triceps')],
  },
};

interface Split {
  name: string;
  sessions: string[];
}

/** Choix du split selon la fréquence et le niveau. */
export function pickSplit(sessionsPerWeek: number, level: TrainingLevel): Split {
  switch (sessionsPerWeek) {
    case 2:
      return { name: 'Full Body ×2', sessions: ['full_a', 'full_b'] };
    case 3:
      return level === 'debutant'
        ? { name: 'Full Body ×3', sessions: ['full_a', 'full_b', 'full_c'] }
        : { name: 'Push / Pull / Legs', sessions: ['push', 'pull', 'legs'] };
    case 4:
      return { name: 'Upper / Lower ×2', sessions: ['upper', 'lower', 'upper', 'lower'] };
    case 5:
      return { name: 'PPL + Upper / Lower', sessions: ['push', 'pull', 'legs', 'upper', 'lower'] };
    case 6:
      return { name: 'Push / Pull / Legs ×2', sessions: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] };
    default:
      return { name: 'Full Body ×3', sessions: ['full_a', 'full_b', 'full_c'] };
  }
}

/** Répartit les séances sur les jours disponibles, le plus espacé possible. */
export function assignDays(availableDays: DayIndex[], sessions: number): DayIndex[] {
  const days = [...new Set(availableDays)].sort((a, b) => a - b);
  if (days.length === 0) {
    // Repli : répartition régulière sur la semaine.
    return Array.from({ length: sessions }, (_, k) =>
      Math.round((k * 6) / Math.max(1, sessions - 1)) as DayIndex,
    );
  }
  if (days.length <= sessions) {
    const out = [...days];
    let k = 0;
    while (out.length < sessions) {
      out.push(days[k % days.length]);
      k++;
    }
    return out.sort((a, b) => a - b);
  }
  // Sélection régulière d'un sous-ensemble des jours disponibles.
  const picked: DayIndex[] = [];
  for (let k = 0; k < sessions; k++) {
    const idx = Math.round((k * (days.length - 1)) / (sessions - 1 || 1));
    const day = days[Math.min(idx, days.length - 1)];
    if (picked.includes(day)) {
      const free = days.find((d) => !picked.includes(d));
      picked.push(free ?? day);
    } else {
      picked.push(day);
    }
  }
  return picked.sort((a, b) => a - b);
}

export function equipmentOk(ex: Exercise, available: EquipmentId[]): boolean {
  return ex.equipment.every((e) => available.includes(e));
}

export function levelOk(ex: Exercise, level: TrainingLevel): boolean {
  return LEVEL_RANK[ex.minLevel] <= LEVEL_RANK[level];
}

/** Exercices réalisables avec le matériel et le niveau donnés. */
export function availableExercises(available: EquipmentId[], level: TrainingLevel): Exercise[] {
  return EXERCISES.filter((e) => equipmentOk(e, available) && levelOk(e, level));
}

/** Séries recommandées selon le niveau. */
function setsFor(ex: Exercise, level: TrainingLevel): number {
  const [lo, hi] = ex.sets;
  if (level === 'debutant') return lo;
  if (level === 'avance') return hi;
  return Math.round((lo + hi) / 2);
}

/** Plage de répétitions ajustée à l'objectif. */
function repsFor(ex: Exercise, goal: GoalId): [number, number] {
  const [lo, hi] = ex.reps;
  if (ex.type === 'cardio') return [lo, hi];
  const span = hi - lo;
  if (goal === 'masse') return [lo, Math.max(lo + 1, hi - Math.round(span * 0.25))];
  if (goal === 'seche') return [lo + Math.round(span * 0.25), hi];
  return [lo, hi];
}

function restFor(ex: Exercise, goal: GoalId): number {
  if (ex.type === 'cardio') return 0;
  if (goal === 'seche') return Math.max(45, ex.restSec - 15);
  if (goal === 'masse') return ex.restSec;
  return ex.restSec;
}

/** Durée estimée d'un exercice, en secondes (exécution + récupération + mise en place). */
export function exerciseDurationSec(we: WorkoutExercise, ex: Exercise): number {
  if (ex.type === 'cardio') return we.repMax * 60;
  const avgReps = (we.repMin + we.repMax) / 2;
  const workPerSet = avgReps * 3;
  return we.sets * (workPerSet + we.restSec) + 60;
}

export function workoutDurationMin(workout: Workout): number {
  const total = workout.exercises.reduce(
    (s, we) => s + exerciseDurationSec(we, getExercise(we.exerciseId)),
    0,
  );
  return Math.round(total / 60);
}

/**
 * Sélectionne le meilleur exercice pour un emplacement donné.
 * Le score privilégie : le muscle principal visé, le type attendu, la priorité
 * de l'exercice, et pénalise les exercices déjà programmés dans la semaine.
 */
function pickForSlot(
  slot: SessionSlot,
  pool: Exercise[],
  usedInSession: Set<string>,
  weeklyUse: Map<string, number>,
): Exercise | null {
  const candidates = pool.filter((e) => !usedInSession.has(e.id));
  let best: Exercise | null = null;
  let bestScore = -Infinity;

  for (const ex of candidates) {
    let score = 0;
    if (ex.primary === slot.muscle) score += 100;
    else if (ex.secondary.includes(slot.muscle)) score += 30;
    else continue;

    if (ex.type === slot.type) score += 40;
    else if (slot.type === 'polyarticulaire') score -= 25;

    score += ex.priority / 10;
    score -= (weeklyUse.get(ex.id) ?? 0) * 18;

    // Départage stable par identifiant pour garantir la reproductibilité.
    if (score > bestScore || (score === bestScore && best && ex.id < best.id)) {
      best = ex;
      bestScore = score;
    }
  }
  return best;
}

function toWorkoutExercise(ex: Exercise, level: TrainingLevel, goal: GoalId): WorkoutExercise {
  const [repMin, repMax] = repsFor(ex, goal);
  return { exerciseId: ex.id, sets: setsFor(ex, level), repMin, repMax, restSec: restFor(ex, goal) };
}

/** Construit le programme complet de la semaine. */
export function generateWorkoutPlan(profile: Profile): WorkoutPlan {
  const equipment = resolveEquipment(profile.gymId, profile.customEquipment);
  const pool = availableExercises(equipment, profile.level);
  const split = pickSplit(profile.sessionsPerWeek, profile.level);
  const days = assignDays(profile.availableDays, split.sessions.length);
  const budgetSec = profile.sessionDurationMin * 60;

  const weeklyUse = new Map<string, number>();
  const workouts: Workout[] = [];

  split.sessions.forEach((templateId, index) => {
    const template = TEMPLATES[templateId];
    const usedInSession = new Set<string>();
    const exercises: WorkoutExercise[] = [];
    let elapsed = 0;

    for (const slot of template.slots) {
      const ex = pickForSlot(slot, pool, usedInSession, weeklyUse);
      if (!ex) continue;
      const we = toWorkoutExercise(ex, profile.level, profile.goal);
      const cost = exerciseDurationSec(we, ex);
      // On garde au minimum 3 exercices, puis on s'arrête au budget temps.
      if (exercises.length >= 3 && elapsed + cost > budgetSec) continue;
      exercises.push(we);
      usedInSession.add(ex.id);
      weeklyUse.set(ex.id, (weeklyUse.get(ex.id) ?? 0) + 1);
      elapsed += cost;
    }

    const workout: Workout = {
      id: `w${index + 1}`,
      day: days[index] ?? (index as DayIndex),
      name: template.name,
      focus: template.focus,
      exercises,
      estimatedMin: 0,
    };
    workout.estimatedMin = workoutDurationMin(workout);
    workouts.push(workout);
  });

  workouts.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
  return { splitName: split.name, workouts, generatedAt: new Date().toISOString() };
}

/**
 * Remplacement d'exercice : même muscle principal, matériel disponible,
 * niveau compatible, absent de la séance en cours.
 * Les alternatives déclarées dans la base remontent en tête.
 */
export function findReplacements(
  exerciseId: string,
  equipment: EquipmentId[],
  level: TrainingLevel,
  workout: Workout,
): Exercise[] {
  const current = getExercise(exerciseId);
  const inSession = new Set(workout.exercises.map((e) => e.exerciseId));
  const pool = availableExercises(equipment, level).filter(
    (e) => e.id !== exerciseId && !inSession.has(e.id) && e.primary === current.primary,
  );
  return pool.sort((a, b) => {
    const aAlt = current.alternatives.indexOf(a.id);
    const bAlt = current.alternatives.indexOf(b.id);
    const aRank = aAlt === -1 ? 99 : aAlt;
    const bRank = bAlt === -1 ? 99 : bAlt;
    if (aRank !== bRank) return aRank - bRank;
    if (a.type !== b.type) return a.type === current.type ? -1 : 1;
    return b.priority - a.priority;
  });
}

/**
 * Remplace les exercices devenus incompatibles après un changement de salle.
 * Retourne le plan corrigé et la liste des substitutions appliquées.
 */
export function repairPlanForEquipment(
  plan: WorkoutPlan,
  equipment: EquipmentId[],
  level: TrainingLevel,
  goal: GoalId,
): { plan: WorkoutPlan; changes: { from: string; to: string }[] } {
  const changes: { from: string; to: string }[] = [];
  const workouts = plan.workouts.map((w) => {
    const exercises = w.exercises.map((we) => {
      const ex = getExercise(we.exerciseId);
      if (equipmentOk(ex, equipment) && levelOk(ex, level)) return we;
      const replacement = findReplacements(we.exerciseId, equipment, level, w)[0];
      if (!replacement) return null;
      changes.push({ from: ex.name, to: replacement.name });
      return toWorkoutExercise(replacement, level, goal);
    });
    const kept = exercises.filter((e): e is WorkoutExercise => e !== null);
    const next: Workout = { ...w, exercises: kept, estimatedMin: 0 };
    next.estimatedMin = workoutDurationMin(next);
    return next;
  });
  return { plan: { ...plan, workouts }, changes };
}

export { TEMPLATES, toWorkoutExercise };
