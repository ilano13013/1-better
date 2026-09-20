import type {
  DayIndex, FoodCategory, MealPlan, PantryItem, Profile, ShoppingList, ShoppingListItem,
} from '../types';
import { getFood } from '../data/foods';
import { getRecipe } from '../data/recipes';
import { findProduct } from '../data/products';
import { ingredientQty, resolveRecipe } from './recipes';

/**
 * Moteur de liste de courses.
 * Agrège les ingrédients de la semaine, déduit ce qui est déjà à la maison,
 * puis convertit les besoins en formats d'achat réels (conditionnements).
 */

export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  proteines: 'Protéines',
  feculents: 'Féculents',
  fruits: 'Fruits',
  legumes: 'Légumes',
  laitiers: 'Produits laitiers',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
  autres: 'Autres',
};

export const CATEGORY_ORDER: FoodCategory[] = [
  'proteines', 'feculents', 'fruits', 'legumes', 'laitiers', 'epicerie', 'surgeles', 'autres',
];

export interface ShoppingOptions {
  /** Jours pris en compte. Par défaut la semaine entière. */
  days?: DayIndex[];
  pantry?: PantryItem[];
  swaps?: Record<string, string>;
  manualPrices?: Record<string, number>;
  packOverrides?: Record<string, number>;
  budget?: number;
}

/** Besoin brut par aliment, toutes recettes confondues. */
export function aggregateNeeds(
  plan: MealPlan,
  swaps: Record<string, string> = {},
  days?: DayIndex[],
): Map<string, number> {
  const wanted = days ? new Set(days) : null;
  const needs = new Map<string, number>();

  for (const day of plan.days) {
    if (wanted && !wanted.has(day.day)) continue;
    for (const meal of day.meals) {
      const recipe = resolveRecipe(getRecipe(meal.recipeId), swaps);
      for (const ing of recipe.ingredients) {
        const qty = ingredientQty(ing, meal.scale);
        needs.set(ing.foodId, (needs.get(ing.foodId) ?? 0) + qty);
      }
    }
  }
  return needs;
}

/** Construit la liste de courses complète. */
export function buildShoppingList(
  plan: MealPlan,
  profile: Profile,
  options: ShoppingOptions = {},
): ShoppingList {
  const swaps = options.swaps ?? {};
  const pantry = new Map((options.pantry ?? []).map((p) => [p.foodId, p.qty]));
  const manualPrices = options.manualPrices ?? {};
  const packOverrides = options.packOverrides ?? {};
  const needs = aggregateNeeds(plan, swaps, options.days);

  const items: ShoppingListItem[] = [];

  for (const [foodId, rawNeed] of needs) {
    const food = getFood(foodId);
    const neededQty = round1(rawNeed);
    const available = pantry.get(foodId) ?? 0;
    const pantryQty = Math.min(available, neededQty);
    const toBuyQty = round1(Math.max(0, neededQty - pantryQty));

    const product = findProduct(profile.storeId, foodId);
    const packSize = product?.packSize ?? 0;
    const autoPacks = toBuyQty <= 0 || !product ? 0 : Math.ceil(toBuyQty / packSize - 1e-6);
    const packs = packOverrides[foodId] ?? autoPacks;

    const manual = manualPrices[product?.id ?? ''];
    const unitPriceValue = manual ?? product?.price ?? 0;
    const status = manual !== undefined ? 'estime' : product?.priceStatus ?? 'inconnu';
    const source =
      manual !== undefined ? 'Prix saisi manuellement' : product?.priceSource ?? 'Produit non référencé';

    items.push({
      id: foodId,
      foodId,
      foodName: food.name,
      category: food.category,
      neededQty,
      pantryQty: round1(pantryQty),
      toBuyQty,
      unit: food.unit,
      productId: product?.id ?? null,
      productLabel: product?.label ?? 'Produit non référencé',
      packSize,
      packs,
      unitPrice: unitPriceValue,
      totalPrice: round2(packs * unitPriceValue),
      priceStatus: status,
      priceSource: source,
    });
  }

  items.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.foodName.localeCompare(b.foodName, 'fr');
  });

  const purchased = items.filter((it) => it.packs > 0);
  const total = round2(purchased.reduce((s, it) => s + it.totalPrice, 0));
  const uncertainTotal = round2(
    purchased.filter((it) => it.priceStatus !== 'verifie').reduce((s, it) => s + it.totalPrice, 0),
  );

  return {
    items,
    total,
    budget: options.budget ?? profile.weeklyBudget,
    storeId: profile.storeId,
    uncertainTotal,
  };
}

/** Lignes réellement à acheter (le reste est couvert par le garde-manger). */
export function purchasableItems(list: ShoppingList): ShoppingListItem[] {
  return list.items.filter((it) => it.packs > 0);
}

/** Lignes intégralement couvertes par les stocks à domicile. */
export function coveredItems(list: ShoppingList): ShoppingListItem[] {
  return list.items.filter((it) => it.packs === 0 && it.pantryQty > 0);
}

export function groupByCategory(items: ShoppingListItem[]): [FoodCategory, ShoppingListItem[]][] {
  const map = new Map<FoodCategory, ShoppingListItem[]>();
  for (const it of items) {
    const arr = map.get(it.category) ?? [];
    arr.push(it);
    map.set(it.category, arr);
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!]);
}

export function formatQty(qty: number, unit: 'g' | 'ml' | 'piece'): string {
  if (unit === 'piece') return `${trim(qty)} ${qty > 1 ? 'pièces' : 'pièce'}`;
  if (qty >= 1000) return `${trim(qty / 1000)} ${unit === 'g' ? 'kg' : 'L'}`;
  return `${trim(qty)} ${unit}`;
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Texte de la liste, pour le presse-papiers, le partage ou l'export. */
export function shoppingListToText(list: ShoppingList, storeName: string): string {
  const lines: string[] = [`Liste de courses — ${storeName}`, ''];
  for (const [category, items] of groupByCategory(purchasableItems(list))) {
    lines.push(CATEGORY_LABELS[category].toUpperCase());
    for (const it of items) {
      const price = it.priceStatus === 'inconnu' ? 'prix inconnu' : `${it.totalPrice.toFixed(2)} €`;
      lines.push(`- ${it.packs} × ${it.productLabel} — ${price}`);
    }
    lines.push('');
  }
  lines.push(`TOTAL : ${list.total.toFixed(2)} €`);
  lines.push(`Budget : ${list.budget.toFixed(2)} €`);
  const rest = list.budget - list.total;
  lines.push(`${rest >= 0 ? 'Reste' : 'Dépassement'} : ${Math.abs(rest).toFixed(2)} €`);
  lines.push('');
  lines.push('Prix estimés — non actualisés.');
  return lines.join('\n');
}

export function shoppingListToCsv(list: ShoppingList): string {
  const rows = [['Catégorie', 'Produit', 'Quantité', 'Conditionnements', 'Prix', 'Statut prix']];
  for (const it of purchasableItems(list)) {
    rows.push([
      CATEGORY_LABELS[it.category],
      it.productLabel,
      formatQty(it.toBuyQty, it.unit),
      String(it.packs),
      it.totalPrice.toFixed(2),
      it.priceStatus,
    ]);
  }
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
}
