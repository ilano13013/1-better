import type { Food, MealPlan, Profile, ShoppingList, Substitution } from '../types';
import { FOODS, getFood } from '../data/foods';
import { findProduct } from '../data/products';
import { filterFromProfile, isFoodAllowed } from './filters';
import { buildShoppingList, ShoppingOptions } from './shopping';

/**
 * Optimisation du budget.
 *
 * Principe : chercher, aliment par aliment, une substitution moins chère qui
 * reste cohérente nutritionnellement (même catégorie, apports proches), puis
 * appliquer les économies les plus fortes jusqu'à repasser sous le budget.
 * Les substitutions sont proposées, jamais imposées.
 */

/** Apport pour 100 g / 100 ml, quelle que soit l'unité de l'aliment. */
export function per100(f: Food, key: 'kcal' | 'protein' | 'fat'): number {
  return f.unit === 'piece' ? (f[key] / (f.gramsPerPiece ?? 100)) * 100 : f[key];
}

/**
 * Un aliment compte comme source de protéines dès 8 g pour 100 g, quelle que
 * soit sa catégorie : un skyr ou une whey pèsent autant dans la ration qu'un
 * blanc de poulet, et les remplacer par un produit pauvre en protéines
 * dégraderait le plan sans que l'utilisateur en soit averti.
 */
export function isProteinSource(food: Food): boolean {
  return per100(food, 'protein') >= 8;
}

/** Une substitution est acceptable si les apports restent comparables. */
export function isCoherentSwap(from: Food, to: Food): boolean {
  if (from.id === to.id) return false;
  if (from.category !== to.category) return false;

  if (isProteinSource(from)) {
    const fp = per100(from, 'protein');
    const tp = per100(to, 'protein');
    // On tolère une perte modérée de densité protéique, pas un effondrement.
    if (tp < fp * 0.65) return false;
    // On évite de remplacer un aliment maigre par un aliment nettement plus gras.
    if (per100(to, 'fat') > per100(from, 'fat') + 8) return false;
    return true;
  }

  const fk = per100(from, 'kcal');
  const tk = per100(to, 'kcal');
  if (fk <= 0) return tk <= 0;
  const ratio = tk / fk;
  return ratio > 0.55 && ratio < 1.8;
}

/** Candidats de substitution pour un aliment, compatibles avec le profil. */
export function swapCandidates(food: Food, profile: Profile): Food[] {
  const filter = filterFromProfile(profile);
  const declared = (food.substitutes ?? []).map((id) => getFood(id));
  const sameCategory = FOODS.filter((f) => f.category === food.category);
  const pool = [...declared, ...sameCategory];

  const seen = new Set<string>([food.id]);
  const out: Food[] = [];
  for (const candidate of pool) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    if (!isFoodAllowed(candidate, filter)) continue;
    if (!isCoherentSwap(food, candidate)) continue;
    if (!findProduct(profile.storeId, candidate.id)) continue;
    out.push(candidate);
  }
  return out;
}

export interface OptimizeResult {
  substitutions: Substitution[];
  swaps: Record<string, string>;
  before: number;
  after: number;
  /** true si le panier repasse sous le budget. */
  withinBudget: boolean;
}

/**
 * Cherche un jeu de substitutions ramenant le panier sous le budget.
 * Approche gloutonne : à chaque tour, on retient l'échange le plus économique.
 */
export function optimizeBudget(
  plan: MealPlan,
  profile: Profile,
  options: ShoppingOptions = {},
  maxSwaps = 10,
): OptimizeResult {
  const budget = options.budget ?? profile.weeklyBudget;
  const swaps: Record<string, string> = { ...(options.swaps ?? {}) };
  const substitutions: Substitution[] = [];

  const listOf = (s: Record<string, string>): ShoppingList =>
    buildShoppingList(plan, profile, { ...options, swaps: s });

  const before = listOf(swaps).total;
  let current = before;

  for (let round = 0; round < maxSwaps; round++) {
    if (current <= budget) break;

    const list = listOf(swaps);
    // On n'examine que les lignes qui pèsent réellement dans le panier.
    const targets = list.items
      .filter((it) => it.packs > 0 && it.totalPrice > 0)
      .sort((a, b) => b.totalPrice - a.totalPrice)
      .slice(0, 12);

    let bestSaving = 0;
    let bestSub: Substitution | null = null;
    let bestSwaps: Record<string, string> | null = null;

    for (const item of targets) {
      const sourceId = originalFoodId(item.foodId, swaps);
      if (swaps[sourceId]) continue;
      const food = getFood(item.foodId);
      for (const candidate of swapCandidates(food, profile)) {
        const trial = { ...swaps, [sourceId]: candidate.id };
        const saving = round2(current - listOf(trial).total);
        if (saving > bestSaving + 0.01) {
          bestSaving = saving;
          bestSwaps = trial;
          bestSub = {
            fromFoodId: food.id,
            toFoodId: candidate.id,
            fromName: food.name,
            toName: candidate.name,
            saving,
            reason: reasonFor(food, candidate),
          };
        }
      }
    }

    if (!bestSub || !bestSwaps) break;
    Object.assign(swaps, bestSwaps);
    substitutions.push(bestSub);
    current = round2(current - bestSaving);
  }

  const after = listOf(swaps).total;
  return { substitutions, swaps, before, after, withinBudget: after <= budget };
}

/** Retrouve l'aliment d'origine derrière un aliment déjà substitué. */
function originalFoodId(foodId: string, swaps: Record<string, string>): string {
  for (const [from, to] of Object.entries(swaps)) {
    if (to === foodId) return from;
  }
  return foodId;
}

function reasonFor(from: Food, to: Food): string {
  if (isProteinSource(from)) {
    return `Apport protéique équivalent (${to.protein} g/100 g), prix au kilo plus bas.`;
  }
  if (from.category === 'laitiers') return 'Format plus économique à apport comparable.';
  return 'Apports proches pour un coût inférieur.';
}

/**
 * Suggestions sans contrainte de budget : les meilleures économies possibles,
 * utilisées pour l'écran « optimiser mon panier » même sous le budget.
 */
export function bestSavings(
  plan: MealPlan,
  profile: Profile,
  options: ShoppingOptions = {},
  limit = 5,
): Substitution[] {
  const baseTotal = buildShoppingList(plan, profile, options).total;
  const list = buildShoppingList(plan, profile, options);
  const out: Substitution[] = [];

  for (const item of list.items.filter((it) => it.packs > 0).slice(0, 20)) {
    const food = getFood(item.foodId);
    let best: Substitution | null = null;
    for (const candidate of swapCandidates(food, profile)) {
      const trial = { ...(options.swaps ?? {}), [food.id]: candidate.id };
      const saving = round2(baseTotal - buildShoppingList(plan, profile, { ...options, swaps: trial }).total);
      if (saving > 0.2 && (!best || saving > best.saving)) {
        best = {
          fromFoodId: food.id, toFoodId: candidate.id,
          fromName: food.name, toName: candidate.name,
          saving, reason: reasonFor(food, candidate),
        };
      }
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.saving - a.saving).slice(0, limit);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
