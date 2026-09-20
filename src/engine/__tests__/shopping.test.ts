import { describe, expect, it } from 'vitest';
import { buildShoppingList, aggregateNeeds, purchasableItems, shoppingListToText } from '../shopping';
import { generateMealPlan } from '../mealPlan';
import { computeTargets } from '../nutrition';
import { optimizeBudget, isCoherentSwap, swapCandidates } from '../budget';
import { planRemaining } from '../remaining';
import { getFood } from '../../data/foods';
import { findProduct } from '../../data/products';
import { DEMO_PANTRY, DEMO_PROFILE } from '../../data/demo';
import type { Profile } from '../../types';

const targets = computeTargets(DEMO_PROFILE);
const plan = generateMealPlan(DEMO_PROFILE, targets);

describe('liste de courses', () => {
  it('agrège les besoins de la semaine', () => {
    const needs = aggregateNeeds(plan);
    expect(needs.size).toBeGreaterThan(10);
    for (const qty of needs.values()) expect(qty).toBeGreaterThan(0);
  });

  it('convertit les besoins en conditionnements réels', () => {
    const list = buildShoppingList(plan, DEMO_PROFILE);
    for (const item of purchasableItems(list)) {
      const product = findProduct(DEMO_PROFILE.storeId, item.foodId)!;
      expect(item.packs).toBe(Math.ceil(item.toBuyQty / product.packSize - 1e-6));
      expect(item.packs * item.packSize).toBeGreaterThanOrEqual(item.toBuyQty - 0.01);
    }
  });

  it('déduit les quantités déjà disponibles à la maison', () => {
    const withoutPantry = buildShoppingList(plan, DEMO_PROFILE);
    const withPantry = buildShoppingList(plan, DEMO_PROFILE, { pantry: DEMO_PANTRY });
    expect(withPantry.total).toBeLessThan(withoutPantry.total);

    const rice = withPantry.items.find((i) => i.foodId === 'riz_blanc');
    if (rice) {
      expect(rice.pantryQty).toBeGreaterThan(0);
      expect(rice.toBuyQty).toBe(Math.round((rice.neededQty - rice.pantryQty) * 10) / 10);
    }
  });

  it('ne rachète pas un aliment entièrement couvert par le placard', () => {
    const needs = aggregateNeeds(plan);
    const pantry = [...needs].map(([foodId, qty]) => ({ foodId, qty: qty * 2 }));
    const list = buildShoppingList(plan, DEMO_PROFILE, { pantry });
    expect(purchasableItems(list)).toHaveLength(0);
    expect(list.total).toBe(0);
  });

  it('signale les prix non vérifiés', () => {
    const list = buildShoppingList(plan, DEMO_PROFILE);
    for (const item of purchasableItems(list)) {
      expect(['estime', 'inconnu', 'verifie']).toContain(item.priceStatus);
      // Aucun prix embarqué n'est présenté comme vérifié.
      expect(item.priceStatus).not.toBe('verifie');
    }
    expect(list.uncertainTotal).toBeCloseTo(list.total, 2);
  });

  it('accepte un prix saisi manuellement', () => {
    const coffee = findProduct(DEMO_PROFILE.storeId, 'cafe')!;
    expect(coffee.priceStatus).toBe('inconnu');
    const list = buildShoppingList(plan, DEMO_PROFILE, { manualPrices: { [coffee.id]: 3.5 } });
    const line = list.items.find((i) => i.foodId === 'cafe');
    if (line) expect(line.unitPrice).toBe(3.5);
  });

  it('suit l\'enseigne choisie', () => {
    const lidl = buildShoppingList(plan, DEMO_PROFILE);
    const monoprix = buildShoppingList(plan, { ...DEMO_PROFILE, storeId: 'monoprix' });
    expect(monoprix.total).toBeGreaterThan(lidl.total);
  });

  it('produit un export texte lisible', () => {
    const list = buildShoppingList(plan, DEMO_PROFILE, { pantry: DEMO_PANTRY });
    const text = shoppingListToText(list, 'Lidl');
    expect(text).toContain('TOTAL');
    expect(text).toContain('Budget');
    expect(text).toContain('Prix estimés');
  });
});

describe('optimisation du budget', () => {
  it('n\'accepte que des substitutions cohérentes', () => {
    expect(isCoherentSwap(getFood('saumon_frais'), getFood('poulet_filet'))).toBe(true);
    expect(isCoherentSwap(getFood('poulet_filet'), getFood('riz_blanc'))).toBe(false);
    expect(isCoherentSwap(getFood('cabillaud'), getFood('sardines_boite'))).toBe(false);
  });

  it('ne propose que des aliments disponibles et compatibles', () => {
    const vegan: Profile = { ...DEMO_PROFILE, diet: 'vegan' };
    for (const candidate of swapCandidates(getFood('tofu_ferme'), vegan)) {
      expect(candidate.tags.vegan).toBe(true);
      expect(findProduct(vegan.storeId, candidate.id)).not.toBeNull();
    }
  });

  it('réduit le total du panier quand le budget est dépassé', () => {
    const tight: Profile = { ...DEMO_PROFILE, weeklyBudget: 40, storeId: 'monoprix' };
    const tightPlan = generateMealPlan(tight, targets);
    const before = buildShoppingList(tightPlan, tight).total;
    expect(before).toBeGreaterThan(tight.weeklyBudget);

    const result = optimizeBudget(tightPlan, tight);
    expect(result.substitutions.length).toBeGreaterThan(0);
    expect(result.after).toBeLessThan(result.before);
    for (const sub of result.substitutions) {
      expect(sub.saving).toBeGreaterThan(0);
      expect(getFood(sub.toFoodId).category).toBe(getFood(sub.fromFoodId).category);
    }
  });

  it('ne touche à rien si le panier tient dans le budget', () => {
    const generous: Profile = { ...DEMO_PROFILE, weeklyBudget: 500 };
    const result = optimizeBudget(generateMealPlan(generous, targets), generous);
    expect(result.substitutions).toHaveLength(0);
    expect(result.after).toBe(result.before);
    expect(result.withinBudget).toBe(true);
  });
});

describe('mode « il me reste X € »', () => {
  it('replanifie uniquement les jours restants', () => {
    const result = planRemaining({
      profile: DEMO_PROFILE, targets, plan, pantry: DEMO_PANTRY,
      fromDay: 3, untilDay: 6, amount: 32,
    });
    expect(result.days).toEqual([3, 4, 5, 6]);
    for (const day of result.plan.days) {
      if (day.day < 3) {
        expect(day.meals.map((m) => m.recipeId))
          .toEqual(plan.days[day.day].meals.map((m) => m.recipeId));
      }
    }
    expect(result.mealsRemaining).toBe(4 * DEMO_PROFILE.mealsPerDay);
  });

  it('privilégie les aliments déjà disponibles', () => {
    const base = planRemaining({
      profile: DEMO_PROFILE, targets, plan, pantry: [],
      fromDay: 4, untilDay: 6, amount: 25,
    });
    const withPantry = planRemaining({
      profile: DEMO_PROFILE, targets, plan, pantry: DEMO_PANTRY,
      fromDay: 4, untilDay: 6, amount: 25,
    });
    expect(withPantry.spend).toBeLessThan(base.spend);
  });

  it('ne facture pas ce qui est déjà à la maison', () => {
    const result = planRemaining({
      profile: DEMO_PROFILE, targets, plan, pantry: DEMO_PANTRY,
      fromDay: 5, untilDay: 6, amount: 20,
    });
    const rice = result.shoppingList.items.find((i) => i.foodId === 'riz_blanc');
    if (rice) expect(rice.pantryQty).toBeGreaterThan(0);
  });
});
