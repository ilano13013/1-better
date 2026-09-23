import type { Food, Macros, MealSlot } from '../types';
import { emptyMacros } from './nutrition';

/**
 * JOURNAL DE CONSOMMATION — ce qui a réellement été mangé.
 *
 * Le plan dit ce qui est prévu ; ce journal dit ce qui a été avalé. Les deux
 * coexistent volontairement : une journée sans aucune saisie reste une journée
 * complète et valide, avec son plan et ses macros. **Le journal est un plus,
 * jamais une obligation** — rien ne le réclame, aucun écran ne se bloque sans
 * lui, et un plan non pointé n'est pas un plan en échec.
 *
 * Avant, la part « consommée » de la journée était devinée à partir de l'heure.
 * C'était une approximation commode et fausse : quelqu'un qui saute un repas
 * voyait ses calories monter quand même. Une saisie explicite remplace la
 * devinette, et l'absence de saisie ne prétend plus rien.
 */

export type IntakeKind = 'meal' | 'food';

export interface IntakeEntry {
  id: string;
  /** Jour concerné, au format `AAAA-MM-JJ`. */
  date: string;
  kind: IntakeKind;
  /** Libellé affiché, figé à la saisie. */
  label: string;
  /** `meal` : recette du plan. */
  recipeId?: string;
  slot?: MealSlot;
  /** `food` : aliment de la base, ou produit scanné. */
  foodId?: string;
  barcode?: string;
  grams?: number;
  /**
   * Macros figées au moment de la saisie.
   *
   * Recalculer après coup ferait bouger l'historique quand la base d'aliments
   * change ou qu'une recette est corrigée. Un journal dont le passé bouge n'est
   * pas un journal.
   */
  macros: Macros;
  /** Horodatage de la saisie, pour l'ordre d'affichage. */
  at: string;
}

/** Valeurs pour 100 g, telles que la base et Open Food Facts les expriment. */
export interface Per100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function entriesForDay(entries: IntakeEntry[], date: string): IntakeEntry[] {
  return entries
    .filter((e) => e.date === date)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function intakeTotals(entries: IntakeEntry[]): Macros {
  return entries.reduce<Macros>((sum, e) => ({
    kcal: sum.kcal + e.macros.kcal,
    protein: sum.protein + e.macros.protein,
    carbs: sum.carbs + e.macros.carbs,
    fat: sum.fat + e.macros.fat,
  }), emptyMacros());
}

/** Macros d'une quantité, arrondies à l'unité comme partout ailleurs. */
export function macrosForGrams(per100g: Per100g, grams: number): Macros {
  const k = Math.max(0, grams) / 100;
  return {
    kcal: Math.round(per100g.kcal * k),
    protein: Math.round(per100g.protein * k),
    carbs: Math.round(per100g.carbs * k),
    fat: Math.round(per100g.fat * k),
  };
}

/**
 * Valeurs pour 100 g d'un aliment de la base.
 *
 * Un aliment compté à la pièce — un œuf, une tortilla — porte ses valeurs
 * pour une pièce, pas pour 100 g. Sans `gramsPerPiece` on ne peut pas
 * convertir, et inventer un poids moyen fausserait la saisie.
 */
export function per100gOf(food: Food): Per100g | null {
  if (food.unit !== 'piece') {
    return { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat };
  }
  if (!food.gramsPerPiece || food.gramsPerPiece <= 0) return null;
  const factor = 100 / food.gramsPerPiece;
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

/** Un repas du plan est-il déjà pointé pour ce jour ? */
export function isMealLogged(
  entries: IntakeEntry[], date: string, slot: MealSlot, recipeId: string,
): boolean {
  return entries.some(
    (e) => e.kind === 'meal' && e.date === date && e.slot === slot && e.recipeId === recipeId,
  );
}

/** Recherches de code-barres déjà faites ce jour-là, pour le quota de la formule. */
export function lookupsUsed(entries: IntakeEntry[], date: string): number {
  return entries.filter((e) => e.date === date && e.barcode).length;
}

export function lookupsLeft(
  entries: IntakeEntry[], date: string, perDay: number | null,
): number | null {
  if (perDay === null) return null;
  return Math.max(0, perDay - lookupsUsed(entries, date));
}

/** Part de la cible déjà couverte, bornée à 1 pour l'affichage d'une barre. */
export function intakeRatio(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, consumed / target);
}
