import type { Food, Macros, Recipe, RecipeIngredient } from '../types';
import { getFood } from '../data/foods';
import { findProduct } from '../data/products';

/**
 * Calcul des valeurs nutritionnelles et du coût d'une recette.
 * Rien n'est stocké dans la base de recettes : tout dérive du catalogue
 * alimentaire et du référentiel produits de l'enseigne choisie.
 */

/** Quantité d'un ingrédient pour un facteur d'échelle donné. */
export function ingredientQty(ing: RecipeIngredient, scale: number): number {
  const q = ing.scalable === false ? ing.qty : ing.qty * scale;
  // Les pièces (œufs, bananes) se comptent au demi près.
  const food = getFood(ing.foodId);
  if (food.unit === 'piece') return Math.max(0.5, Math.round(q * 2) / 2);
  return Math.round(q * 10) / 10;
}

/** Macros apportées par une quantité d'aliment. */
export function foodMacros(food: Food, qty: number): Macros {
  const factor = food.unit === 'piece' ? qty : qty / 100;
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

/** Macros d'une portion de recette, au facteur d'échelle donné. */
export function recipeMacros(recipe: Recipe, scale = 1): Macros {
  let kcal = 0, protein = 0, carbs = 0, fat = 0;
  for (const ing of recipe.ingredients) {
    const m = foodMacros(getFood(ing.foodId), ingredientQty(ing, scale));
    kcal += m.kcal; protein += m.protein; carbs += m.carbs; fat += m.fat;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

/**
 * Coût approximatif d'une portion : prix au prorata de la quantité utilisée
 * dans le conditionnement disponible en magasin.
 */
export function recipeCost(recipe: Recipe, storeId: string, scale = 1): number {
  let cost = 0;
  for (const ing of recipe.ingredients) {
    const product = findProduct(storeId, ing.foodId);
    if (!product || product.price <= 0) continue;
    const qty = ingredientQty(ing, scale);
    cost += (qty / product.packSize) * product.price;
  }
  return Math.round(cost * 100) / 100;
}

/**
 * Facteur d'échelle permettant d'approcher au mieux la cible calorique,
 * borné par les limites de la recette. La protéine sert d'arbitre secondaire.
 */
export function bestScale(recipe: Recipe, targetKcal: number): number {
  const base = recipeMacros(recipe, 1).kcal;
  if (base <= 0) return 1;
  const raw = targetKcal / base;
  const clamped = Math.min(recipe.maxScale, Math.max(recipe.minScale, raw));
  // Pas de 0,05 pour rester lisible dans les quantités affichées.
  return Math.round(clamped * 20) / 20;
}

export function recipeTimeLabel(recipe: Recipe): string {
  return `${recipe.prepTimeMin} min`;
}

/* ------------------------------------------------------------------ */
/* Substitutions d'aliments                                             */
/* ------------------------------------------------------------------ */

/** Apport pour 100 g / 100 ml, quelle que soit l'unité de l'aliment. */
function per100(f: Food, key: 'kcal' | 'protein' | 'fat'): number {
  return f.unit === 'piece' ? (f[key] / (f.gramsPerPiece ?? 100)) * 100 : f[key];
}

/**
 * Convertit une quantité d'un aliment vers un autre.
 * Dès que l'aliment d'origine est une source de protéines (≥ 8 g/100 g), on
 * conserve l'apport protéique ; sinon on conserve la masse (ou le nombre de
 * pièces converti en grammes).
 */
export function convertQty(from: Food, to: Food, qty: number): number {
  const grams = from.unit === 'piece' ? qty * (from.gramsPerPiece ?? 100) : qty;

  let targetGrams: number;
  if (per100(from, 'protein') >= 8 && to.protein > 0) {
    targetGrams = grams * (per100(from, 'protein') / Math.max(0.1, per100(to, 'protein')));
  } else {
    targetGrams = grams;
  }

  if (to.unit === 'piece') {
    const pieces = targetGrams / (to.gramsPerPiece ?? 100);
    return Math.max(0.5, Math.round(pieces * 2) / 2);
  }
  return Math.round(targetGrams * 10) / 10;
}

/**
 * Applique les substitutions validées (optimisation du budget) à une recette.
 * Le résultat sert à la fois au calcul des macros et à la liste de courses :
 * les deux restent ainsi cohérents.
 */
export function resolveRecipe(recipe: Recipe, swaps: Record<string, string>): Recipe {
  if (!Object.keys(swaps).length) return recipe;
  let changed = false;
  const ingredients = recipe.ingredients.map((ing) => {
    const toId = swaps[ing.foodId];
    if (!toId || toId === ing.foodId) return ing;
    const from = getFood(ing.foodId);
    const to = getFood(toId);
    changed = true;
    return { ...ing, foodId: toId, qty: convertQty(from, to, ing.qty) };
  });
  return changed ? { ...recipe, ingredients } : recipe;
}
