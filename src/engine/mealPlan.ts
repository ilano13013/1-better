import type {
  DayIndex, DayPlan, Macros, Meal, MealPlan, MealSlot, NutritionTargets,
  PantryItem, Profile, Recipe,
} from '../types';
import { RECIPES, getRecipe } from '../data/recipes';
import { findProduct } from '../data/products';
import { filterFromProfile, isRecipeAllowed } from './filters';
import { bestScale, recipeCost, recipeMacros } from './recipes';
import { addMacros, buildDaySlots, emptyMacros, slotTarget } from './nutrition';
import { Basket, basketFromPlan, commitRecipe, createBasket, marginalCost } from './basket';

/**
 * Moteur de planification alimentaire, déterministe.
 *
 * Entrées : profil + cibles nutritionnelles + magasin + restrictions + budget
 *           + aliments déjà disponibles à domicile
 * Sorties : repas de la semaine, recettes, facteurs de portion, macros
 *
 * La sélection est un score à minimiser : écart calorique, écart protéique,
 * COÛT MARGINAL du repas dans le panier en cours, variété, préférences.
 * Raisonner en coût marginal (et non au prorata) est ce qui permet au plan
 * de tenir un budget réel : le moteur réutilise les ingrédients déjà achetés
 * et consomme le garde-manger avant d'ajouter des produits.
 */

export interface MealPlanOptions {
  /** Jours à régénérer. Les autres sont repris depuis `base`. */
  days?: DayIndex[];
  /** Plan existant, conservé pour les jours non régénérés. */
  base?: MealPlan;
  /** Budget disponible pour la période planifiée, en euros. */
  budget?: number;
  /** Recettes à éviter. */
  exclude?: string[];
  /** Aliments déjà disponibles à domicile. */
  pantry?: PantryItem[];
  /** Substitutions d'aliments déjà validées. */
  swaps?: Record<string, string>;
}

/** Une recette n'est retenue que si chacun de ses ingrédients est achetable. */
export function isRecipePurchasable(recipe: Recipe, storeId: string): boolean {
  return recipe.ingredients.every((ing) => findProduct(storeId, ing.foodId) !== null);
}

export function eligibleRecipes(profile: Profile, slot: MealSlot): Recipe[] {
  const filter = filterFromProfile(profile);
  return RECIPES.filter(
    (r) => r.slots.includes(slot) && isRecipeAllowed(r, filter) && isRecipePurchasable(r, profile.storeId),
  );
}

export interface ScoreContext {
  target: Macros;
  storeId: string;
  /** Enveloppe budgétaire indicative pour ce repas, en euros. */
  mealBudget: number;
  likedFoods: string[];
  weeklyUse: Map<string, number>;
  usedToday: Set<string>;
  /** Panier en cours : sert au calcul du coût marginal. */
  basket: Basket | null;
  /** Budget de la période planifiée, en euros. */
  budget: number;
  /** Poids du coût dans le score — calibré sur le budget (voir generateMealPlan). */
  thrift: number;
}

export interface ScoredRecipe {
  recipe: Recipe;
  scale: number;
  macros: Macros;
  /** Coût marginal dans le panier courant (ce que le repas ajoute vraiment). */
  cost: number;
  /** Coût au prorata des quantités, pour l'affichage « coût par portion ». */
  portionCost: number;
  score: number;
}

/** Score d'adéquation d'une recette à un repas. Plus bas = meilleur. */
export function scoreRecipe(recipe: Recipe, ctx: ScoreContext): ScoredRecipe {
  const scale = bestScale(recipe, ctx.target.kcal);
  const macros = recipeMacros(recipe, scale);
  const portionCost = recipeCost(recipe, ctx.storeId, scale);
  const cost = ctx.basket ? marginalCost(ctx.basket, recipe, scale) : portionCost;

  const kcalGap = Math.abs(macros.kcal - ctx.target.kcal) / Math.max(1, ctx.target.kcal);
  // Le manque de protéines est pénalisé fortement, l'excès légèrement :
  // dépasser la cible coûte cher et se fait au détriment des glucides.
  const proteinRef = Math.max(1, ctx.target.protein);
  const proteinShort = Math.max(0, ctx.target.protein - macros.protein) / proteinRef;
  const proteinOver = Math.max(0, macros.protein - ctx.target.protein * 1.15) / proteinRef;
  // Les lipides sont encadrés des deux côtés : trop haut, ils évincent les
  // glucides ; trop bas, la ration devient difficile à tenir.
  const fatRef = Math.max(1, ctx.target.fat);
  const fatOver = Math.max(0, macros.fat - ctx.target.fat * 1.2) / fatRef;
  const fatShort = Math.max(0, ctx.target.fat * 0.75 - macros.fat) / fatRef;
  // Le budget est une CONTRAINTE portant sur le PANIER ENTIER, pas sur chaque
  // repas : un paquet de riz acheté lundi sert toute la semaine. Tant que le
  // panier projeté tient dans l'enveloppe, le prix n'entre pas dans le score ;
  // au-delà, la pénalité croît avec le dépassement. Un terme léger départage
  // deux recettes équivalentes en faveur de la moins chère.
  // Coût marginal rapporté à l'enveloppe du repas. Le budget n'est pas traité
  // ici comme une contrainte dure : la sélection vise d'abord la nutrition et
  // la variété, et une passe de réparation dédiée ramène ensuite le panier
  // sous l'enveloppe (voir `fitToBudget`). Ce terme sert à départager deux
  // recettes équivalentes en faveur de la moins chère.
  const allowance = Math.max(0.5, ctx.mealBudget);
  const thrift = cost / allowance;
  const thriftWeight = ctx.thrift;

  const likedCount = recipe.ingredients.filter((ing) => ctx.likedFoods.includes(ing.foodId)).length;
  const liked = Math.min(0.3, likedCount * 0.1);

  // Répéter une recette ne coûte presque rien : sans pénalité nette, le moteur
  // servirait sept fois le même repas. La variété est donc explicitement dotée,
  // et plafonnée plus haut par une limite dure de répétitions.
  const repeatWeek = (ctx.weeklyUse.get(recipe.id) ?? 0) * 0.6;

  const score =
    kcalGap * 1.6 +
    proteinShort * 5 +
    proteinOver * 1.2 +
    fatOver * 0.9 +
    fatShort * 0.5 +
    thrift * thriftWeight +
    repeatWeek -
    liked;

  return { recipe, scale, macros, cost, portionCost, score };
}

export function rankRecipes(
  profile: Profile,
  slot: MealSlot,
  target: Macros,
  ctx: Partial<ScoreContext> = {},
): ScoredRecipe[] {
  const full: ScoreContext = {
    target,
    storeId: profile.storeId,
    mealBudget: ctx.mealBudget ?? (profile.weeklyBudget / 7) * 0.3,
    budget: ctx.budget ?? profile.weeklyBudget,
    thrift: ctx.thrift ?? 0.45,
    likedFoods: ctx.likedFoods ?? profile.likedFoods,
    weeklyUse: ctx.weeklyUse ?? new Map(),
    usedToday: ctx.usedToday ?? new Set(),
    basket: ctx.basket ?? null,
  };
  return eligibleRecipes(profile, slot)
    .map((r) => scoreRecipe(r, full))
    .sort((a, b) => a.score - b.score || a.recipe.id.localeCompare(b.recipe.id));
}

/**
 * Poids de parcimonie essayés successivement. Le premier qui fait tenir le
 * panier dans le budget est retenu ; à défaut, le plan le moins cher.
 * C'est ce qui rend le budget réellement contraignant sans sacrifier la
 * nutrition quand l'enveloppe est confortable.
 */
export const THRIFT_STEPS = [0.45, 0.7, 1, 1.35, 1.75, 2.2, 2.8, 3.6, 4.8, 6.5, 9];

/** Génère le plan alimentaire de la semaine. */
export function generateMealPlan(
  profile: Profile,
  targets: NutritionTargets,
  options: MealPlanOptions = {},
): MealPlan {
  const budget = options.budget ?? profile.weeklyBudget;
  const pantry = options.pantry ?? [];

  // Chaque passe est un compromis différent entre budget et nutrition.
  // On les note sur une échelle commune : dépassement du budget d'un côté,
  // déficit protéique de l'autre. Parmi les passes qui tiennent dans
  // l'enveloppe, la mieux notée est celle qui nourrit le mieux — et non
  // simplement la moins chère, qui laisserait du budget inutilisé.
  let best: { plan: MealPlan; score: number } | null = null;

  for (const thrift of THRIFT_STEPS) {
    const plan = buildPass(profile, targets, options, thrift);
    const cost = basketFromPlan(plan, profile.storeId, pantry).cost;
    const avgProtein = plan.days.reduce((s, d) => s + d.totals.protein, 0) / plan.days.length;

    const overrun = budget > 0 ? Math.max(0, cost - budget) / budget : 0;
    const proteinGap = targets.protein > 0
      ? Math.max(0, targets.protein - avgProtein) / targets.protein
      : 0;
    const score = overrun * 1.3 + proteinGap;

    if (!best || score < best.score - 1e-9) best = { plan, score };
    // Une passe sans dépassement ni déficit ne peut pas être battue.
    if (score <= 0) break;
  }

  return best!.plan;
}

export { buildPass as buildPassForDiagnostics };

function buildPass(
  profile: Profile,
  targets: NutritionTargets,
  options: MealPlanOptions,
  thrift: number,
): MealPlan {
  const slots = buildDaySlots(profile.mealsPerDay, profile.breakfast);
  const dayTarget: Macros = {
    kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat,
  };
  const budget = options.budget ?? profile.weeklyBudget;
  const exclude = new Set(options.exclude ?? []);
  const regenerate = options.days ? new Set(options.days) : null;
  const plannedDays = regenerate ? Math.max(1, regenerate.size) : 7;

  const weeklyUse = new Map<string, number>();
  const basket = createBasket(profile.storeId, options.pantry ?? []);
  const days: DayPlan[] = [];

  // Les jours conservés pèsent déjà sur la variété et sur le panier.
  if (regenerate && options.base) {
    for (const day of options.base.days) {
      if (regenerate.has(day.day)) continue;
      for (const meal of day.meals) {
        weeklyUse.set(meal.recipeId, (weeklyUse.get(meal.recipeId) ?? 0) + 1);
      }
    }
  }

  for (let d = 0 as DayIndex; d < 7; d = (d + 1) as DayIndex) {
    if (regenerate && !regenerate.has(d)) {
      const kept = options.base?.days.find((x) => x.day === d);
      if (kept) { days.push(kept); continue; }
    }

    const usedToday = new Set<string>();
    const meals: Meal[] = [];
    const unmetSlots: MealSlot[] = [];
    let totals = emptyMacros();

    for (const share of slots) {
      const target = slotTarget(dayTarget, share.ratio);
      const mealBudget = (budget / plannedDays) * share.ratio;
      const ranked = rankRecipes(profile, share.slot, target, {
        mealBudget, weeklyUse, usedToday, basket, budget, thrift,
      }).filter((r) => !exclude.has(r.recipe.id));

      // Limite dure de répétitions : personne ne veut sept fois le même plat.
      // Le plafond s'assouplit quand le choix disponible est trop étroit.
      // Jamais deux fois le même plat dans la même journée, et pas plus de
      // `cap` fois dans la semaine.
      const cap = repeatCap(plannedDays, ranked.length, thrift);
      const varied = ranked.filter(
        (r) => !usedToday.has(r.recipe.id) && (weeklyUse.get(r.recipe.id) ?? 0) < cap,
      );
      const fallback = ranked.filter((r) => !usedToday.has(r.recipe.id));
      const chosen = varied[0] ?? fallback[0] ?? ranked[0];
      if (!chosen) {
        // Aucune recette compatible : on le signale au lieu de l'escamoter.
        unmetSlots.push(share.slot);
        continue;
      }

      commitRecipe(basket, chosen.recipe, chosen.scale);
      meals.push({
        slot: share.slot,
        recipeId: chosen.recipe.id,
        scale: chosen.scale,
        macros: chosen.macros,
      });
      totals = addMacros(totals, chosen.macros);
      usedToday.add(chosen.recipe.id);
    }

    // Réparation protéique : la sélection repas par repas peut accumuler de
    // petits déficits. On vérifie donc le TOTAL du jour et on échange, si
    // besoin, le repas dont le remplacement rapporte le plus de protéines au
    // moindre coût calorique et budgétaire.
    const dayPlan = repairProtein(
      rebalanceDay({ day: d, meals, totals, target: dayTarget, unmetSlots }),
      profile,
      basket,
      { weeklyUse, cap: repeatCap(plannedDays, 8, thrift), thrift },
    );

    days.push(dayPlan);
    rebuildBasket(basket, days, options.pantry ?? []);

    // La variété se compte sur le plan RÉELLEMENT retenu, réparation comprise.
    for (const meal of dayPlan.meals) {
      weeklyUse.set(meal.recipeId, (weeklyUse.get(meal.recipeId) ?? 0) + 1);
    }
  }

  return { days, generatedAt: new Date().toISOString() };
}

/**
 * Nombre maximal de fois qu'une même recette peut revenir sur la période.
 * Plus le budget est serré (parcimonie élevée), plus la répétition est
 * tolérée : cuisiner en plus grande quantité est la façon la plus efficace
 * de faire baisser un panier.
 */
export function repeatCap(plannedDays: number, poolSize: number, thrift = 0.45): number {
  const base = thrift >= 4 ? 6 : thrift >= 2 ? 5 : thrift >= 1 ? 4 : 3;
  if (poolSize <= 0) return plannedDays;
  return Math.max(base, Math.ceil(plannedDays / poolSize));
}

/**
 * Part de la cible protéique que la réparation cherche à atteindre.
 *
 * Elle s'abaisse quand le budget devient contraignant : à 45 €/semaine, une
 * cible de 136 g de protéines par jour n'est tout simplement pas achetable.
 * Forcer la cible produirait un panier au double du budget, donc inutilisable.
 * Le moteur préfère un plan réalisable et l'écart restant est affiché à
 * l'utilisateur plutôt que masqué.
 */
export function proteinFloor(thrift: number): number {
  if (thrift <= 1) return 0.92;
  if (thrift <= 2.2) return 0.88;
  if (thrift <= 3.6) return 0.83;
  return 0.75;
}

/**
 * Corrige un déficit protéique sur la journée entière.
 *
 * La sélection repas par repas optimise chaque créneau isolément ; rien ne
 * garantit que la somme atteigne la cible. Cette passe remplace, tant que le
 * déficit persiste, le repas dont l'échange apporte le plus de protéines par
 * unité de dégradation (écart calorique et coût marginal).
 */
export function repairProtein(
  day: DayPlan,
  profile: Profile,
  basket: Basket,
  opts: { weeklyUse: Map<string, number>; cap: number; thrift: number },
): DayPlan {
  const goal = day.target.protein * proteinFloor(opts.thrift);
  let current = day;

  for (let round = 0; round < 5 && current.totals.protein < goal; round++) {
    let best: { index: number; recipe: Recipe; scale: number; macros: Macros } | null = null;
    let bestRatio = 0;

    const usedToday = new Set(current.meals.map((m) => m.recipeId));
    const kcalGapBefore = Math.abs(current.totals.kcal - current.target.kcal);

    for (let index = 0; index < current.meals.length; index++) {
      const meal = current.meals[index];
      const mealKcal = meal.macros.kcal;

      for (const candidate of eligibleRecipes(profile, meal.slot)) {
        if (usedToday.has(candidate.id)) continue;
        if ((opts.weeklyUse.get(candidate.id) ?? 0) >= opts.cap) continue;

        const scale = bestScale(candidate, mealKcal);
        const macros = recipeMacros(candidate, scale);
        const gain = macros.protein - meal.macros.protein;
        if (gain < 3) continue;

        const kcalAfter = current.totals.kcal - mealKcal + macros.kcal;
        const kcalPenalty = Math.max(0, Math.abs(kcalAfter - current.target.kcal) - kcalGapBefore);
        // Le surcoût est celui du repas entrant, le repas sortant étant retiré.
        const costDelta = Math.max(0, marginalCost(basket, candidate, scale));

        // Plus le budget est serré (parcimonie élevée), plus un échange coûteux
        // doit rapporter de protéines pour être retenu.
        const ratio = gain / (1 + kcalPenalty / 40 + costDelta * (0.8 + opts.thrift));
        if (ratio > bestRatio) {
          bestRatio = ratio;
          best = { index, recipe: candidate, scale, macros };
        }
      }
    }

    if (!best) break;
    const meals = current.meals.map((m, i) =>
      i === best!.index
        ? { ...m, recipeId: best!.recipe.id, scale: best!.scale, macros: best!.macros }
        : m,
    );
    // Rééquilibrer ici, et non après la boucle : sinon l'ajustement des
    // portions sur les calories reprendrait une partie du gain protéique
    // sans que la réparation puisse le constater.
    current = rebalanceDay({ ...current, meals });
  }

  return current;
}

/** Reconstruit le panier à partir des jours déjà planifiés. */
function rebuildBasket(basket: Basket, days: DayPlan[], pantry: PantryItem[]): void {
  const fresh = createBasket(basket.storeId, pantry);
  for (const day of days) {
    for (const meal of day.meals) commitRecipe(fresh, getRecipe(meal.recipeId), meal.scale);
  }
  basket.available = fresh.available;
  basket.used = fresh.used;
  basket.cost = fresh.cost;
}

/**
 * Réajuste les portions d'une journée pour rapprocher le total de la cible.
 * Utilisé après un remplacement manuel de repas.
 */
export function rebalanceDay(day: DayPlan): DayPlan {
  const gap = day.target.kcal - day.totals.kcal;
  if (Math.abs(gap) < 60 || day.meals.length === 0) return recomputeTotals(day);

  const meals = day.meals.map((m) => ({ ...m }));
  let remaining = gap;

  for (const meal of meals) {
    if (Math.abs(remaining) < 40) break;
    const recipe = getRecipe(meal.recipeId);
    const perScale = recipeMacros(recipe, 1).kcal;
    if (perScale <= 0) continue;
    const wanted = meal.scale + remaining / perScale;
    const next = Math.round(Math.min(recipe.maxScale, Math.max(recipe.minScale, wanted)) * 20) / 20;
    if (next === meal.scale) continue;
    const before = meal.macros.kcal;
    meal.scale = next;
    meal.macros = recipeMacros(recipe, next);
    remaining -= meal.macros.kcal - before;
  }

  return recomputeTotals({ ...day, meals });
}

/** Créneaux non pourvus sur l'ensemble de la semaine, sans doublon. */
export function unmetSlots(plan: MealPlan): MealSlot[] {
  return [...new Set(plan.days.flatMap((d) => d.unmetSlots))];
}

export function recomputeTotals(day: DayPlan): DayPlan {
  let totals = emptyMacros();
  for (const m of day.meals) totals = addMacros(totals, m.macros);
  return { ...day, totals };
}

/** Applique un remplacement de repas et recalcule la journée. */
export function replaceMeal(
  plan: MealPlan,
  dayIndex: DayIndex,
  mealIndex: number,
  recipeId: string,
): MealPlan {
  const days = plan.days.map((d) => {
    if (d.day !== dayIndex) return d;
    const meals = d.meals.map((m, idx) => {
      if (idx !== mealIndex) return m;
      const recipe = getRecipe(recipeId);
      const target = m.macros.kcal || d.target.kcal / Math.max(1, d.meals.length);
      const scale = bestScale(recipe, target);
      return { ...m, recipeId, scale, macros: recipeMacros(recipe, scale) };
    });
    return rebalanceDay({ ...d, meals });
  });
  return { ...plan, days };
}

/** Change manuellement la portion d'un repas. */
export function setMealScale(
  plan: MealPlan,
  dayIndex: DayIndex,
  mealIndex: number,
  scale: number,
): MealPlan {
  const days = plan.days.map((d) => {
    if (d.day !== dayIndex) return d;
    const meals = d.meals.map((m, idx) => {
      if (idx !== mealIndex) return m;
      const recipe = getRecipe(m.recipeId);
      const clamped = Math.round(Math.min(recipe.maxScale, Math.max(recipe.minScale, scale)) * 20) / 20;
      return { ...m, scale: clamped, macros: recipeMacros(recipe, clamped) };
    });
    return recomputeTotals({ ...d, meals });
  });
  return { ...plan, days };
}

/** Somme des coûts par portion — indicatif, voir shopping.ts pour le panier réel. */
export function mealPlanCost(plan: MealPlan, storeId: string): number {
  let total = 0;
  for (const day of plan.days) {
    for (const meal of day.meals) {
      total += recipeCost(getRecipe(meal.recipeId), storeId, meal.scale);
    }
  }
  return Math.round(total * 100) / 100;
}
