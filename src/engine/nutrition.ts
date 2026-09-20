import type { Macros, MealSlot, NutritionTargets, Profile } from '../types';
import { ACTIVITY_FACTORS, GOALS } from '../data/goals';

/**
 * Moteur nutritionnel déterministe.
 * Formule de base : Mifflin-St Jeor, puis facteur d'activité (NEAT) et
 * ajout de la dépense d'entraînement, enfin ajustement selon l'objectif.
 *
 * Toutes les valeurs sont des ESTIMATIONS et ne remplacent pas l'avis
 * d'un professionnel de santé ou de nutrition.
 */

/** Métabolisme de base (kcal/jour), Mifflin-St Jeor. */
export function computeBMR(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(p.sex === 'homme' ? base + 5 : base - 161);
}

/** Dépense calorique moyenne d'une séance de musculation, en kcal. */
export function sessionBurn(weightKg: number, durationMin: number): number {
  // ≈ 0,09 kcal par kg et par minute pour un entraînement en résistance.
  return Math.round(0.09 * weightKg * durationMin);
}

/** Dépense énergétique journalière estimée (kcal/jour). */
export function computeTDEE(p: Profile): number {
  const bmr = computeBMR(p);
  const neat = bmr * ACTIVITY_FACTORS[p.activity];
  const weeklyTraining = p.sessionsPerWeek * sessionBurn(p.weightKg, p.sessionDurationMin);
  return Math.round(neat + weeklyTraining / 7);
}

/** Objectif calorique et macros, avant éventuel réglage manuel. */
export function computeTargets(p: Profile): NutritionTargets {
  const bmr = computeBMR(p);
  const tdee = computeTDEE(p);
  const goal = GOALS[p.goal];

  const kcal = Math.round((tdee * goal.kcalFactor) / 10) * 10;

  // Les protéines sont calculées sur le poids objectif lorsqu'il est plus bas
  // (sèche) afin de ne pas surestimer les besoins.
  const proteinRef = p.goal === 'seche' ? Math.min(p.weightKg, p.targetWeightKg || p.weightKg) : p.weightKg;
  const protein = Math.round(proteinRef * goal.proteinPerKg);

  const fat = Math.round((kcal * goal.fatRatio) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return { bmr, tdee, kcal, protein, carbs, fat, manual: false };
}

/** Recalcule les kcal depuis des macros saisies manuellement. */
export function kcalFromMacros(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
}

/* ------------------------------------------------------------------ */
/* Répartition des repas dans la journée                                */
/* ------------------------------------------------------------------ */

const SLOT_WEIGHTS: Record<MealSlot, number> = {
  petit_dejeuner: 2.2,
  dejeuner: 3.2,
  diner: 3.0,
  collation: 1.3,
};

export const SLOT_LABELS: Record<MealSlot, string> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  collation: 'Collation',
  diner: 'Dîner',
};

export interface MealSlotShare {
  slot: MealSlot;
  ratio: number;
}

/**
 * Construit la liste ordonnée des repas de la journée et la part de calories
 * allouée à chacun. Déterministe pour un couple (nombre de repas, petit-déjeuner).
 */
export function buildDaySlots(mealsPerDay: number, breakfast: boolean): MealSlotShare[] {
  const meals = Math.max(2, Math.min(6, Math.round(mealsPerDay)));
  let order: MealSlot[];

  if (meals === 2) {
    order = breakfast ? ['petit_dejeuner', 'diner'] : ['dejeuner', 'diner'];
  } else {
    const snacks = meals - 2 - (breakfast ? 1 : 0);
    order = [];
    if (breakfast) order.push('petit_dejeuner');
    if (snacks >= 3) order.push('collation');
    order.push('dejeuner');
    if (snacks >= 1) order.push('collation');
    order.push('diner');
    if (snacks >= 2) order.push('collation');
  }

  const total = order.reduce((s, slot) => s + SLOT_WEIGHTS[slot], 0);
  return order.map((slot) => ({ slot, ratio: SLOT_WEIGHTS[slot] / total }));
}

/** Cible macros d'un repas donné, proportionnelle à sa part calorique. */
export function slotTarget(day: Macros, ratio: number): Macros {
  return {
    kcal: Math.round(day.kcal * ratio),
    protein: Math.round(day.protein * ratio),
    carbs: Math.round(day.carbs * ratio),
    fat: Math.round(day.fat * ratio),
  };
}

export function emptyMacros(): Macros {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein),
    carbs: Math.round(m.carbs),
    fat: Math.round(m.fat),
  };
}
