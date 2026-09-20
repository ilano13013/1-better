import type { DayIndex, MealPlan, NutritionTargets, PantryItem, Profile, ShoppingList } from '../types';
import { generateMealPlan } from './mealPlan';
import { buildShoppingList } from './shopping';
import { addMacros, emptyMacros } from './nutrition';
import type { Macros } from '../types';

/**
 * Mode « Il me reste X € jusqu'à … ».
 *
 * Le moteur reprend les aliments déjà disponibles à domicile, les repas
 * restants et le budget annoncé, puis reconstruit uniquement la fin de semaine
 * en privilégiant les recettes qui s'appuient sur le garde-manger.
 */

export interface RemainingInput {
  profile: Profile;
  targets: NutritionTargets;
  plan: MealPlan;
  pantry: PantryItem[];
  /** Premier jour à replanifier (0 = lundi). */
  fromDay: DayIndex;
  /** Dernier jour inclus. */
  untilDay: DayIndex;
  /** Budget restant, en euros. */
  amount: number;
  swaps?: Record<string, string>;
}

export interface RemainingResult {
  days: DayIndex[];
  plan: MealPlan;
  shoppingList: ShoppingList;
  mealsRemaining: number;
  macrosRemaining: Macros;
  /** Part du budget restant réellement utilisée. */
  spend: number;
  withinBudget: boolean;
}

export function remainingDays(fromDay: DayIndex, untilDay: DayIndex): DayIndex[] {
  const out: DayIndex[] = [];
  for (let d = fromDay; d <= untilDay; d++) out.push(d as DayIndex);
  return out;
}

export function planRemaining(input: RemainingInput): RemainingResult {
  const days = remainingDays(input.fromDay, input.untilDay);

  const plan = generateMealPlan(input.profile, input.targets, {
    days,
    base: input.plan,
    budget: input.amount,
    pantry: input.pantry,
    swaps: input.swaps,
  });

  const shoppingList = buildShoppingList(plan, input.profile, {
    days,
    pantry: input.pantry,
    swaps: input.swaps,
    budget: input.amount,
  });

  let macrosRemaining = emptyMacros();
  let mealsRemaining = 0;
  for (const day of plan.days) {
    if (!days.includes(day.day)) continue;
    mealsRemaining += day.meals.length;
    macrosRemaining = addMacros(macrosRemaining, day.totals);
  }

  return {
    days,
    plan,
    shoppingList,
    mealsRemaining,
    macrosRemaining,
    spend: shoppingList.total,
    withinBudget: shoppingList.total <= input.amount,
  };
}
