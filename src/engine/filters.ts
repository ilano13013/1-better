import type { DietId, Food, Profile, Recipe, RestrictionId } from '../types';
import { getFood } from '../data/foods';

/**
 * Règles de compatibilité alimentaire.
 * Un aliment est retenu s'il satisfait simultanément le régime, toutes les
 * restrictions, l'absence d'allergie et l'absence de refus explicite.
 */

export const DIET_LABELS: Record<DietId, string> = {
  classique: 'Classique',
  vegetarien: 'Végétarien',
  vegan: 'Vegan',
};

export const RESTRICTION_LABELS: Record<RestrictionId, string> = {
  halal: 'Halal',
  casher: 'Casher',
  sans_porc: 'Sans porc',
  sans_lactose: 'Sans lactose',
  sans_gluten: 'Sans gluten',
};

export interface DietFilter {
  diet: DietId;
  restrictions: RestrictionId[];
  allergies: string[];
  dislikes: string[];
}

export function filterFromProfile(p: Profile): DietFilter {
  return {
    diet: p.diet,
    restrictions: p.restrictions,
    allergies: p.allergies,
    dislikes: p.dislikedFoods,
  };
}

/** Un aliment respecte-t-il le régime et les restrictions ? */
export function isFoodAllowed(food: Food, f: DietFilter): boolean {
  if (f.allergies.includes(food.id)) return false;
  if (f.dislikes.includes(food.id)) return false;

  const t = food.tags;
  if (f.diet === 'vegetarien' && !t.vegetarian) return false;
  if (f.diet === 'vegan' && !t.vegan) return false;

  for (const r of f.restrictions) {
    switch (r) {
      case 'sans_porc':
        if (t.pork) return false;
        break;
      case 'halal':
        // Porc et alcool exclus. Les volailles et viandes rouges restent
        // proposées : c'est en magasin que l'utilisateur choisit une
        // référence certifiée (voir `needsCertification`).
        if (t.pork || t.alcohol) return false;
        break;
      case 'casher':
        if (t.pork || t.shellfish || t.alcohol) return false;
        break;
      case 'sans_lactose':
        if (t.lactose) return false;
        break;
      case 'sans_gluten':
        if (t.gluten) return false;
        break;
    }
  }
  return true;
}

/** Une recette est retenue si tous ses ingrédients le sont. */
export function isRecipeAllowed(recipe: Recipe, f: DietFilter): boolean {
  for (const ing of recipe.ingredients) {
    if (!isFoodAllowed(getFood(ing.foodId), f)) return false;
  }
  // Casher : pas de mélange viande / produit laitier dans un même plat.
  if (f.restrictions.includes('casher')) {
    let meat = false;
    let dairy = false;
    for (const ing of recipe.ingredients) {
      const food = getFood(ing.foodId);
      if (food.category === 'proteines' && !food.tags.vegetarian) meat = true;
      if (food.tags.lactose) dairy = true;
    }
    if (meat && dairy) return false;
  }
  return true;
}

/**
 * Aliments pour lesquels l'utilisateur doit vérifier la certification en
 * magasin (halal / casher). L'application ne peut pas la garantir.
 */
export function needsCertification(food: Food, f: DietFilter): boolean {
  if (!f.restrictions.includes('halal') && !f.restrictions.includes('casher')) return false;
  return Boolean(food.tags.nonCertifiedMeat);
}

/**
 * Cherche un aliment de remplacement compatible, en suivant la liste de
 * substituts déclarée puis, à défaut, la même catégorie.
 */
export function findAllowedSubstitute(
  food: Food,
  f: DietFilter,
  pool: Food[],
): Food | null {
  for (const id of food.substitutes ?? []) {
    const candidate = pool.find((x) => x.id === id);
    if (candidate && isFoodAllowed(candidate, f)) return candidate;
  }
  const sameCategory = pool
    .filter((x) => x.category === food.category && x.id !== food.id && isFoodAllowed(x, f))
    .sort((a, b) => Math.abs(a.protein - food.protein) - Math.abs(b.protein - food.protein));
  return sameCategory[0] ?? null;
}
