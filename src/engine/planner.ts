import type {
  AppState, DayIndex, EquipmentId, MealPlan, NutritionTargets, ShoppingList,
  Workout, WorkoutPlan,
} from '../types';
import { computeTargets, kcalFromMacros } from './nutrition';
import { generateWorkoutPlan, repairPlanForEquipment, toWorkoutExercise } from './training';
import { generateMealPlan, recomputeTotals } from './mealPlan';
import { buildShoppingList } from './shopping';
import { recipeMacros, resolveRecipe } from './recipes';
import { getRecipe } from '../data/recipes';
import { getExercise } from '../data/exercises';
import { resolveEquipment } from '../data/gyms';
import { BASIC_EQUIPMENT, effectivePlan, limitsFor, type Limits } from './entitlements';
import { weekdayOf } from './schedule';

/**
 * MOTEUR DE PLANIFICATION — cœur déterministe de l'application.
 *
 *   profil + objectif + activité + budget + magasin + restrictions + placard
 *     → calories + macros + repas + quantités + recettes + courses + coût
 *
 *   profil + objectif + niveau + fréquence + salle + équipements + temps
 *     → split + séances + exercices + séries + répétitions + récupération
 *
 * Toute modification de l'état repasse par ici : changer le budget recalcule
 * les repas, changer un repas recalcule macros et courses, changer de salle
 * remplace les exercices devenus impossibles.
 */

export interface PlanResult {
  /** Limites de la formule active, pour que l'interface s'aligne sur les moteurs. */
  limits: Limits;
  targets: NutritionTargets;
  equipment: EquipmentId[];
  workoutPlan: WorkoutPlan;
  mealPlan: MealPlan;
  shoppingList: ShoppingList;
}

/** Cibles nutritionnelles, en tenant compte d'un éventuel réglage manuel. */
export function resolveTargets(state: AppState): NutritionTargets {
  const computed = computeTargets(state.profile);
  const override = state.targetsOverride;
  if (!override) return computed;
  return {
    ...computed,
    kcal: override.kcal || kcalFromMacros(override),
    protein: override.protein,
    carbs: override.carbs,
    fat: override.fat,
    manual: true,
  };
}

/** Applique les exercices remplacés manuellement. */
export function applyExerciseOverrides(
  plan: WorkoutPlan,
  overrides: Record<string, string>,
  state: AppState,
): WorkoutPlan {
  if (!Object.keys(overrides).length) return plan;
  const workouts: Workout[] = plan.workouts.map((w) => {
    const exercises = w.exercises.map((we, idx) => {
      const replacement = overrides[`${w.id}:${idx}`];
      if (!replacement) return we;
      try {
        return toWorkoutExercise(getExercise(replacement), state.profile.level, state.profile.goal);
      } catch {
        return we;
      }
    });
    return { ...w, exercises };
  });
  return { ...plan, workouts };
}

/** Applique les repas remplacés manuellement (clé `${jour}:${index}`). */
export function applyMealOverrides(plan: MealPlan, overrides: Record<string, string>): MealPlan {
  if (!Object.keys(overrides).length) return plan;
  const days = plan.days.map((day) => {
    let touched = false;
    const meals = day.meals.map((meal, idx) => {
      const recipeId = overrides[`${day.day}:${idx}`];
      if (!recipeId || recipeId === meal.recipeId) return meal;
      try {
        const recipe = getRecipe(recipeId);
        touched = true;
        const scale = Math.min(recipe.maxScale, Math.max(recipe.minScale, meal.scale));
        return { ...meal, recipeId, scale, macros: recipeMacros(recipe, scale) };
      } catch {
        return meal;
      }
    });
    return touched ? recomputeTotals({ ...day, meals }) : day;
  });
  return { ...plan, days };
}

/**
 * Répercute les substitutions d'aliments sur les macros des repas :
 * la liste de courses et le plan alimentaire restent ainsi cohérents.
 */
export function applySwapsToPlan(plan: MealPlan, swaps: Record<string, string>): MealPlan {
  if (!Object.keys(swaps).length) return plan;
  const days = plan.days.map((day) => {
    const meals = day.meals.map((meal) => {
      const recipe = resolveRecipe(getRecipe(meal.recipeId), swaps);
      return { ...meal, macros: recipeMacros(recipe, meal.scale) };
    });
    return recomputeTotals({ ...day, meals });
  });
  return { ...plan, days };
}

/** Recalcule l'intégralité du plan à partir de l'état. */
export function buildPlan(state: AppState): PlanResult {
  // Un abonnement échu retombe en gratuit sans qu'aucun écran n'ait à y penser.
  const limits = limitsFor(effectivePlan(state));
  const targets = resolveTargets(state);
  // Le matériel affiché suit celui qui a servi à construire le programme.
  const equipment = limits.gymEquipment
    ? resolveEquipment(state.profile.gymId, state.profile.customEquipment)
    : [...BASIC_EQUIPMENT];

  let workoutPlan = generateWorkoutPlan(state.profile, limits);
  workoutPlan = applyExerciseOverrides(workoutPlan, state.exerciseOverrides, state);
  // Garde-fou : un changement de salle ne doit jamais laisser d'exercice impossible.
  workoutPlan = repairPlanForEquipment(
    workoutPlan, equipment, state.profile.level, state.profile.goal,
  ).plan;

  let mealPlan = generateMealPlan(state.profile, targets, {
    pantry: state.pantry,
    swaps: state.foodSwaps,
    limits,
    startWeekday: state.startDate ? weekdayOf(state.startDate) : 0,
  });
  mealPlan = applyMealOverrides(mealPlan, state.mealOverrides);
  mealPlan = applySwapsToPlan(mealPlan, state.foodSwaps);

  const shoppingList = buildShoppingList(mealPlan, state.profile, {
    pantry: state.pantry,
    swaps: state.foodSwaps,
    manualPrices: state.manualPrices,
    packOverrides: state.packOverrides,
    budget: state.profile.weeklyBudget,
  });

  return { limits, targets, equipment, workoutPlan, mealPlan, shoppingList };
}

/** Séance programmée un jour donné, s'il y en a une. */
export function workoutForDay(plan: WorkoutPlan, day: DayIndex): Workout | null {
  return plan.workouts.find((w) => w.day === day) ?? null;
}
