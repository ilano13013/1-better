import type { MealPlan, PantryItem, Recipe } from '../types';
import { findProduct } from '../data/products';
import { getRecipe } from '../data/recipes';
import { ingredientQty, resolveRecipe } from './recipes';

/**
 * Panier courant de la semaine.
 *
 * Le coût réel d'un repas n'est pas le prix des ingrédients au prorata :
 * c'est le nombre de conditionnements SUPPLÉMENTAIRES qu'il oblige à acheter.
 * Ajouter du riz à une recette quand un paquet d'un kilo est déjà au panier
 * ne coûte rien ; ajouter 80 g de quinoa oblige à acheter un sachet entier.
 *
 * Le moteur de planification raisonne donc en coût marginal, ce qui le pousse
 * naturellement à réutiliser les ingrédients et à vider le garde-manger.
 */
export interface Basket {
  storeId: string;
  /** Quantité disponible par aliment (placard + conditionnements achetés). */
  available: Map<string, number>;
  /** Quantité déjà engagée dans les repas planifiés. */
  used: Map<string, number>;
  cost: number;
}

export function createBasket(storeId: string, pantry: PantryItem[] = []): Basket {
  const available = new Map<string, number>();
  for (const item of pantry) {
    if (item.qty > 0) available.set(item.foodId, (available.get(item.foodId) ?? 0) + item.qty);
  }
  return { storeId, available, used: new Map(), cost: 0 };
}

export function cloneBasket(basket: Basket): Basket {
  return {
    storeId: basket.storeId,
    available: new Map(basket.available),
    used: new Map(basket.used),
    cost: basket.cost,
  };
}

/** Coût des conditionnements supplémentaires imposés par une recette. */
export function marginalCost(basket: Basket, recipe: Recipe, scale: number): number {
  const extraUsed = new Map<string, number>();
  let cost = 0;

  for (const ing of recipe.ingredients) {
    const qty = ingredientQty(ing, scale);
    extraUsed.set(ing.foodId, (extraUsed.get(ing.foodId) ?? 0) + qty);
  }

  for (const [foodId, qty] of extraUsed) {
    const product = findProduct(basket.storeId, foodId);
    if (!product || product.packSize <= 0) continue;
    const used = (basket.used.get(foodId) ?? 0) + qty;
    const available = basket.available.get(foodId) ?? 0;
    const missing = used - available;
    if (missing <= 1e-6) continue;
    const packs = Math.ceil(missing / product.packSize - 1e-6);
    cost += packs * product.price;
  }

  return Math.round(cost * 100) / 100;
}

/** Enregistre une recette dans le panier et achète ce qui manque. */
export function commitRecipe(basket: Basket, recipe: Recipe, scale: number): void {
  for (const ing of recipe.ingredients) {
    const qty = ingredientQty(ing, scale);
    const used = (basket.used.get(ing.foodId) ?? 0) + qty;
    basket.used.set(ing.foodId, used);

    const product = findProduct(basket.storeId, ing.foodId);
    if (!product || product.packSize <= 0) continue;
    let available = basket.available.get(ing.foodId) ?? 0;
    while (used - available > 1e-6) {
      available += product.packSize;
      basket.cost = Math.round((basket.cost + product.price) * 100) / 100;
    }
    basket.available.set(ing.foodId, available);
  }
}

/**
 * Reconstruit le panier d'un plan existant, en excluant éventuellement un
 * repas — utile pour évaluer le coût marginal d'un remplacement.
 */
export function basketFromPlan(
  plan: MealPlan,
  storeId: string,
  pantry: PantryItem[] = [],
  swaps: Record<string, string> = {},
  exclude?: { day: number; index: number },
): Basket {
  const basket = createBasket(storeId, pantry);
  for (const day of plan.days) {
    day.meals.forEach((meal, index) => {
      if (exclude && exclude.day === day.day && exclude.index === index) return;
      commitRecipe(basket, resolveRecipe(getRecipe(meal.recipeId), swaps), meal.scale);
    });
  }
  return basket;
}
