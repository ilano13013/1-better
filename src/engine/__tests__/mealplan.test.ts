import { describe, expect, it } from 'vitest';
import { generateMealPlan, eligibleRecipes, replaceMeal, setMealScale, mealPlanCost } from '../mealPlan';
import { computeTargets } from '../nutrition';
import { isRecipeAllowed, filterFromProfile, isFoodAllowed, needsCertification } from '../filters';
import { recipeMacros } from '../recipes';
import { getRecipe, RECIPES } from '../../data/recipes';
import { getFood } from '../../data/foods';
import { DEMO_PANTRY, DEMO_PROFILE } from '../../data/demo';
import type { Profile } from '../../types';

const targets = computeTargets(DEMO_PROFILE);

describe('moteur alimentaire', () => {
  it('planifie sept jours complets', () => {
    const plan = generateMealPlan(DEMO_PROFILE, targets);
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.meals).toHaveLength(DEMO_PROFILE.mealsPerDay);
    }
  });

  it('approche la cible calorique de chaque journée', () => {
    const plan = generateMealPlan(DEMO_PROFILE, targets);
    for (const day of plan.days) {
      const gap = Math.abs(day.totals.kcal - targets.kcal) / targets.kcal;
      expect(gap).toBeLessThan(0.14);
    }
  });

  it('atteint une part substantielle de l\'objectif protéique', () => {
    const plan = generateMealPlan(DEMO_PROFILE, targets);
    for (const day of plan.days) {
      expect(day.totals.protein).toBeGreaterThan(targets.protein * 0.75);
    }
  });

  it('varie les recettes et ne sert jamais deux fois le même plat par jour', () => {
    const plan = generateMealPlan(DEMO_PROFILE, targets, { pantry: DEMO_PANTRY });
    const ids = plan.days.flatMap((d) => d.meals.map((m) => m.recipeId));
    expect(new Set(ids).size).toBeGreaterThanOrEqual(6);
    for (const day of plan.days) {
      const dayIds = day.meals.map((m) => m.recipeId);
      expect(new Set(dayIds).size).toBe(dayIds.length);
    }
    // Aucune recette ne revient plus que le plafond autorisé.
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(6);
  });

  it('gagne en variété quand le budget augmente', () => {
    const tight = generateMealPlan({ ...DEMO_PROFILE, weeklyBudget: 40 }, targets);
    const large = generateMealPlan({ ...DEMO_PROFILE, weeklyBudget: 160 }, targets);
    const distinct = (p: ReturnType<typeof generateMealPlan>) =>
      new Set(p.days.flatMap((d) => d.meals.map((m) => m.recipeId))).size;
    expect(distinct(large)).toBeGreaterThan(distinct(tight));
  });

  it('se rapproche de la cible protéique quand le budget le permet', () => {
    const avgProtein = (budget: number) => {
      const p = { ...DEMO_PROFILE, weeklyBudget: budget };
      const plan = generateMealPlan(p, targets);
      return plan.days.reduce((s, d) => s + d.totals.protein, 0) / 7;
    };
    expect(avgProtein(140)).toBeGreaterThanOrEqual(targets.protein * 0.92);
  });

  it('respecte un régime vegan', () => {
    const vegan: Profile = { ...DEMO_PROFILE, diet: 'vegan' };
    const plan = generateMealPlan(vegan, computeTargets(vegan));
    const filter = filterFromProfile(vegan);
    for (const day of plan.days) {
      expect(day.meals.length).toBeGreaterThan(0);
      for (const meal of day.meals) {
        const recipe = getRecipe(meal.recipeId);
        expect(isRecipeAllowed(recipe, filter)).toBe(true);
        for (const ing of recipe.ingredients) {
          expect(getFood(ing.foodId).tags.vegan).toBe(true);
        }
      }
    }
  });

  it('respecte les restrictions combinées (halal + sans lactose)', () => {
    const p: Profile = { ...DEMO_PROFILE, restrictions: ['halal', 'sans_lactose'] };
    const plan = generateMealPlan(p, computeTargets(p));
    for (const day of plan.days) {
      expect(day.meals.length).toBe(p.mealsPerDay);
      for (const meal of day.meals) {
        for (const ing of getRecipe(meal.recipeId).ingredients) {
          const food = getFood(ing.foodId);
          expect(food.tags.pork).toBeFalsy();
          expect(food.tags.alcohol).toBeFalsy();
          expect(food.tags.lactose).toBeFalsy();
        }
      }
    }
  });

  it('signale la viande à faire certifier plutôt que de la supprimer', () => {
    const p: Profile = { ...DEMO_PROFILE, restrictions: ['halal'] };
    const filter = filterFromProfile(p);
    expect(isFoodAllowed(getFood('poulet_filet'), filter)).toBe(true);
    expect(needsCertification(getFood('poulet_filet'), filter)).toBe(true);
    expect(isFoodAllowed(getFood('porc_filet'), filter)).toBe(false);
    expect(needsCertification(getFood('tofu_ferme'), filter)).toBe(false);
  });

  it('couvre chaque créneau pour les restrictions courantes', () => {
    const combos: Profile['restrictions'][] = [
      ['sans_gluten'], ['sans_lactose'], ['halal'], ['casher'],
      ['sans_gluten', 'sans_lactose'], ['halal', 'sans_gluten'],
    ];
    for (const restrictions of combos) {
      const p: Profile = { ...DEMO_PROFILE, restrictions };
      for (const slot of ['petit_dejeuner', 'dejeuner', 'diner', 'collation'] as const) {
        expect(eligibleRecipes(p, slot).length, `${restrictions.join('+')} / ${slot}`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('exclut les aliments refusés et les allergies', () => {
    const p: Profile = { ...DEMO_PROFILE, dislikedFoods: ['poulet_filet'], allergies: ['oeuf'] };
    const plan = generateMealPlan(p, computeTargets(p));
    const used = new Set(
      plan.days.flatMap((d) => d.meals.flatMap((m) => getRecipe(m.recipeId).ingredients.map((i) => i.foodId))),
    );
    expect(used.has('poulet_filet')).toBe(false);
    expect(used.has('oeuf')).toBe(false);
  });

  it('conserve au moins une recette par créneau pour chaque régime', () => {
    for (const diet of ['classique', 'vegetarien', 'vegan'] as const) {
      const p: Profile = { ...DEMO_PROFILE, diet };
      for (const slot of ['petit_dejeuner', 'dejeuner', 'diner', 'collation'] as const) {
        expect(eligibleRecipes(p, slot).length).toBeGreaterThan(0);
      }
    }
  });

  it('est reproductible', () => {
    const a = generateMealPlan(DEMO_PROFILE, targets);
    const b = generateMealPlan({ ...DEMO_PROFILE }, computeTargets(DEMO_PROFILE));
    expect(a.days.map((d) => d.meals.map((m) => [m.recipeId, m.scale])))
      .toEqual(b.days.map((d) => d.meals.map((m) => [m.recipeId, m.scale])));
  });

  it('recalcule la journée après un remplacement de repas', () => {
    const plan = generateMealPlan(DEMO_PROFILE, targets);
    const day = plan.days[0];
    const alternative = RECIPES.find(
      (r) => r.slots.includes(day.meals[1].slot) && r.id !== day.meals[1].recipeId,
    )!;
    const next = replaceMeal(plan, 0, 1, alternative.id);
    expect(next.days[0].meals[1].recipeId).toBe(alternative.id);
    const recomputed = next.days[0].meals.reduce((s, m) => s + m.macros.kcal, 0);
    expect(next.days[0].totals.kcal).toBe(recomputed);
    expect(Math.abs(next.days[0].totals.kcal - targets.kcal) / targets.kcal).toBeLessThan(0.18);
  });

  it('borne la portion aux limites de la recette', () => {
    const plan = generateMealPlan(DEMO_PROFILE, targets);
    const recipe = getRecipe(plan.days[0].meals[0].recipeId);
    const next = setMealScale(plan, 0, 0, 99);
    expect(next.days[0].meals[0].scale).toBe(recipe.maxScale);
    expect(next.days[0].meals[0].macros).toEqual(recipeMacros(recipe, recipe.maxScale));
  });

  it('adapte le plan au budget', () => {
    const cheap: Profile = { ...DEMO_PROFILE, weeklyBudget: 35 };
    const rich: Profile = { ...DEMO_PROFILE, weeklyBudget: 150 };
    const cheapCost = mealPlanCost(generateMealPlan(cheap, targets), cheap.storeId);
    const richCost = mealPlanCost(generateMealPlan(rich, targets), rich.storeId);
    expect(cheapCost).toBeLessThan(richCost);
  });

  it('n\'utilise que des aliments compatibles avec le profil', () => {
    const p: Profile = { ...DEMO_PROFILE, restrictions: ['sans_gluten'] };
    const filter = filterFromProfile(p);
    const plan = generateMealPlan(p, computeTargets(p));
    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const ing of getRecipe(meal.recipeId).ingredients) {
          expect(isFoodAllowed(getFood(ing.foodId), filter)).toBe(true);
        }
      }
    }
  });
});
