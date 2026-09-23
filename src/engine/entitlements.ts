import type { EquipmentId } from '../types';

/**
 * FORMULES — la source unique de vérité des limites.
 *
 * Un point de vigilance, et c'est tout l'objet de ce module : une limite qui
 * n'existerait que dans l'interface n'est pas une limite. Masquer un bouton
 * tout en calculant sept jours de repas laisserait le contenu à portée de la
 * console du navigateur, et ferait du gratuit une version complète mal
 * affichée. Les limites sont donc appliquées **dans les moteurs** — le plan
 * gratuit ne calcule pas ce qu'il ne montre pas.
 *
 * Ce qui est offert reste entier : profil, salle, magasin, budget, calories et
 * macros ne sont jamais bridés. Un plan gratuit qui mentirait sur les calories
 * serait un plan dangereux, pas un plan restreint.
 */
export type Plan = 'free' | 'plus';

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Gratuit',
  plus: '1% Better+',
};

export interface Limits {
  /** Séances hebdomadaires calculées. `null` : sans limite. */
  maxSessionsPerWeek: number | null;
  /** Jours de repas réellement planifiés. */
  mealPlanDays: number;
  /** Recettes retenues par créneau. `null` : toute la base. */
  recipesPerSlot: number | null;
  /** Détail de la liste : prix par article, couverture, « il me reste X € ». */
  detailedShoppingList: boolean;
  /** Substitutions d'aliments quand le panier dépasse le budget. */
  foodAlternatives: boolean;
  /** Exercices choisis d'après le matériel réel de la salle. */
  gymEquipment: boolean;
  /** Charges et répétitions suggérées d'après les séances enregistrées. */
  autoProgression: boolean;
  /** Profondeur d'historique consultable, en jours. `null` : sans limite. */
  historyDays: number | null;
  /** Export de la liste de courses. */
  exportShoppingList: boolean;
  /** Préparation du panier Drive. */
  drivePrep: boolean;
}

/**
 * Matériel du plan gratuit : ce qu'on trouve dans n'importe quelle salle, et
 * même chez soi. Le programme reste cohérent et exécutable — il ignore
 * simplement les machines particulières de l'enseigne choisie.
 */
export const BASIC_EQUIPMENT: EquipmentId[] = [
  'poids_corps', 'halteres', 'banc', 'elastique',
];

export const LIMITS: Record<Plan, Limits> = {
  free: {
    maxSessionsPerWeek: 3,
    mealPlanDays: 3,
    recipesPerSlot: 6,
    detailedShoppingList: false,
    foodAlternatives: false,
    gymEquipment: false,
    autoProgression: false,
    historyDays: 30,
    exportShoppingList: false,
    drivePrep: false,
  },
  plus: {
    maxSessionsPerWeek: null,
    mealPlanDays: 7,
    recipesPerSlot: null,
    detailedShoppingList: true,
    foodAlternatives: true,
    gymEquipment: true,
    autoProgression: true,
    historyDays: null,
    exportShoppingList: true,
    drivePrep: true,
  },
};

export function limitsFor(plan: Plan): Limits {
  return LIMITS[plan] ?? LIMITS.free;
}

/** Applique un plafond éventuel. */
export function capped(value: number, max: number | null): number {
  return max === null ? value : Math.min(value, max);
}

/** Vrai si ce jour de la semaine (0 = lundi) est planifié par la formule. */
export function dayIsPlanned(day: number, limits: Limits): boolean {
  return day < limits.mealPlanDays;
}

/**
 * Borne une série d'entrées datées à la fenêtre d'historique.
 *
 * Les entrées hors fenêtre ne sont pas supprimées : elles restent enregistrées
 * et réapparaissent si la formule change. Une limite de lecture ne doit pas
 * détruire les données de quelqu'un.
 */
export function withinHistory<T extends { date: string }>(
  entries: T[], limits: Limits, now: Date = new Date(),
): T[] {
  if (limits.historyDays === null) return entries;
  const floor = new Date(now);
  floor.setDate(floor.getDate() - limits.historyDays);
  const iso = floor.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= iso);
}

/** Les lignes du comparatif, telles que l'écran de formules les affiche. */
export interface PlanFeature {
  label: string;
  free: string;
  plus: string;
  /** Fonction annoncée mais pas encore construite. */
  planned?: boolean;
}

export const PLAN_TABLE: PlanFeature[] = [
  { label: 'Profil : âge, taille, poids, objectif', free: 'oui', plus: 'oui' },
  { label: 'Choix de la salle', free: 'oui', plus: 'oui' },
  { label: 'Choix du supermarché', free: 'oui', plus: 'oui' },
  { label: 'Budget courses', free: 'oui', plus: 'oui' },
  { label: 'Calcul calories & macros', free: 'oui', plus: 'oui' },
  { label: "Programme d'entraînement", free: '3 séances/sem.', plus: 'Illimité' },
  { label: 'Plan alimentaire', free: '3 jours', plus: '7 jours' },
  { label: 'Liste de courses', free: 'Basique', plus: 'Complète' },
  { label: 'Recettes adaptées aux macros', free: 'Limitées', plus: 'Illimitées' },
  { label: 'Alternatives aux aliments', free: 'non', plus: 'oui' },
  { label: 'Adaptation aux machines de ta salle', free: 'non', plus: 'oui' },
  { label: 'Ajustement automatique selon progression', free: 'non', plus: 'oui' },
  { label: 'Historique poids et charges', free: '30 jours', plus: 'Illimité' },
  { label: 'Export de la liste de courses', free: 'non', plus: 'oui' },
  { label: "Préparation d'un panier Drive", free: 'non', plus: 'oui' },
  { label: 'Scanner code-barres', free: 'Limité', plus: 'Illimité', planned: true },
  { label: 'Historique des mensurations', free: '30 jours', plus: 'Illimité', planned: true },
];
