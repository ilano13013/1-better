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
  /**
   * Recherches de code-barres par jour. `null` : sans limite.
   * Seule la recherche en ligne est comptée : la base d'aliments locale reste
   * illimitée, puisqu'elle ne coûte rien et fonctionne hors ligne.
   */
  barcodeLookupsPerDay: number | null;
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
    barcodeLookupsPerDay: 3,
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
    barcodeLookupsPerDay: null,
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
  { label: 'Journal des repas et aliments', free: 'oui', plus: 'oui' },
  { label: 'Scanner code-barres', free: '3 par jour', plus: 'Illimité' },
  { label: 'Historique des mensurations', free: '30 jours', plus: 'Illimité', planned: true },
];

/* ----------------------------- Abonnement ----------------------------- */

export type BillingPeriod = 'monthly' | 'yearly';

/**
 * Tarifs, en centimes — jamais en flottants : `4.99 * 12` ne vaut pas
 * exactement 59,88 en virgule flottante, et une remise calculée dessus
 * afficherait un centime de travers.
 */
export const PRICES: Record<BillingPeriod, number> = {
  monthly: 499,
  yearly: 3900,
};

export const PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: 'Mensuel',
  yearly: 'Annuel',
};

/** Ce que l'annuel coûte par mois, en centimes (arrondi au centime). */
export function monthlyEquivalent(period: BillingPeriod): number {
  return period === 'yearly' ? Math.round(PRICES.yearly / 12) : PRICES.monthly;
}

/** Économie de l'annuel face à douze mensualités, en centimes. */
export function yearlySavings(): number {
  return PRICES.monthly * 12 - PRICES.yearly;
}

/** La même économie en pourcentage entier. */
export function yearlySavingsPct(): number {
  return Math.round((yearlySavings() / (PRICES.monthly * 12)) * 100);
}

export interface Subscription {
  period: BillingPeriod;
  /** Date de souscription, au format `AAAA-MM-JJ`. */
  startedAt: string;
  /** Échéance de la période en cours, au format `AAAA-MM-JJ`. */
  renewsAt: string;
}

function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Échéance d'une période.
 *
 * Le cas qui casse les implémentations naïves : le 31 janvier plus un mois.
 * `setMonth` déborde alors sur le 3 mars. On ramène donc au dernier jour du
 * mois visé — ce que fait toute facturation mensuelle.
 */
export function renewalDate(startIso: string, period: BillingPeriod): string {
  const start = parseDay(startIso);
  if (!start) return startIso;
  const day = start.getDate();
  const next = new Date(start.getTime());
  if (period === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  if (next.getDate() !== day) next.setDate(0);
  return toDay(next);
}

export function startSubscription(period: BillingPeriod, now: Date = new Date()): Subscription {
  const startedAt = toDay(now);
  return { period, startedAt, renewsAt: renewalDate(startedAt, period) };
}

/** Une période échue n'ouvre plus rien : il n'existe aucun renouvellement. */
export function isSubscriptionActive(
  subscription: Subscription | null, now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  return toDay(now) <= subscription.renewsAt;
}

/** Jours restants avant l'échéance, jamais négatif. */
export function daysLeft(subscription: Subscription | null, now: Date = new Date()): number {
  if (!subscription) return 0;
  const end = parseDay(subscription.renewsAt);
  if (!end) return 0;
  const start = parseDay(toDay(now))!;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

/**
 * Formule réellement en vigueur.
 *
 * `plan` enregistre l'intention ; c'est l'abonnement qui décide. Un abonnement
 * échu retombe donc en gratuit sans qu'aucun écran n'ait à y penser.
 */
export function effectivePlan(
  state: { plan: Plan; subscription: Subscription | null }, now: Date = new Date(),
): Plan {
  if (state.plan !== 'plus') return 'free';
  return isSubscriptionActive(state.subscription, now) ? 'plus' : 'free';
}
