/**
 * Modèle de données de l'application.
 * Séparation nette : profil / nutrition / moteur sportif / catalogue alimentaire /
 * recettes / magasins / produits / prix / budget / intégrations Drive.
 */

/* ------------------------------------------------------------------ */
/* Profil utilisateur                                                   */
/* ------------------------------------------------------------------ */

export type GoalId = 'masse' | 'seche' | 'maintien' | 'recomp';
export type Sex = 'homme' | 'femme';
export type TrainingLevel = 'debutant' | 'intermediaire' | 'avance';
export type ActivityLevel = 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif';
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = lundi

export interface Goal {
  id: GoalId;
  label: string;
  description: string;
  /** Multiplicateur appliqué à la DEJ pour obtenir l'objectif calorique. */
  kcalFactor: number;
  /** Protéines en g par kg de poids de corps. */
  proteinPerKg: number;
  /** Part des calories provenant des lipides. */
  fatRatio: number;
}

export interface Profile {
  firstName: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: GoalId;
  activity: ActivityLevel;
  level: TrainingLevel;
  /** Ancienneté en musculation, en mois. */
  experienceMonths: number;
  gymId: string;
  /** Équipements sélectionnés manuellement (salle indépendante / domicile). */
  customEquipment: EquipmentId[];
  sessionsPerWeek: number;
  availableDays: DayIndex[];
  sessionDurationMin: number;
  storeId: string;
  weeklyBudget: number;
  mealsPerDay: number;
  breakfast: boolean;
  diet: DietId;
  restrictions: RestrictionId[];
  /** ids d'aliments appréciés — favorisés par le moteur. */
  likedFoods: string[];
  /** ids d'aliments refusés — exclus. */
  dislikedFoods: string[];
  /** ids d'aliments allergènes ou mal tolérés — exclus strictement. */
  allergies: string[];
}

/* ------------------------------------------------------------------ */
/* Nutrition                                                            */
/* ------------------------------------------------------------------ */

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionTargets extends Macros {
  bmr: number;
  tdee: number;
  /** true si l'utilisateur a saisi ses propres valeurs. */
  manual: boolean;
}

export type DietId = 'classique' | 'vegetarien' | 'vegan';
export type RestrictionId =
  | 'halal'
  | 'casher'
  | 'sans_porc'
  | 'sans_lactose'
  | 'sans_gluten';

/** Étiquettes portées par un aliment, utilisées pour le filtrage des régimes. */
export interface FoodTags {
  vegetarian: boolean;
  vegan: boolean;
  pork: boolean;
  alcohol: boolean;
  lactose: boolean;
  gluten: boolean;
  /** Viande non certifiée : incompatible halal / casher. */
  nonCertifiedMeat: boolean;
  shellfish: boolean;
}

/* ------------------------------------------------------------------ */
/* Catalogue alimentaire                                                */
/* ------------------------------------------------------------------ */

export type FoodCategory =
  | 'proteines'
  | 'feculents'
  | 'fruits'
  | 'legumes'
  | 'laitiers'
  | 'epicerie'
  | 'surgeles'
  | 'autres';

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  /** Unité de mesure des quantités dans les recettes. */
  unit: 'g' | 'ml' | 'piece';
  /** Poids d'une pièce en grammes (pour unit = 'piece'). */
  gramsPerPiece?: number;
  /** Valeurs nutritionnelles pour 100 g / 100 ml / 1 pièce selon l'unité. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: Partial<FoodTags>;
  /** Aliments de substitution possibles, du plus proche au plus éloigné. */
  substitutes?: string[];
}

export interface Store {
  id: string;
  name: string;
  /** Fichier logo officiel, s'il a été ajouté. Voir src/assets/logos/. */
  logo?: string;
  /** Indice de prix relatif utilisé pour les estimations (1 = référence). */
  priceIndex: number;
  color: string;
  /** Une intégration Drive existe-t-elle (aucune n'est active à ce stade). */
  driveSupported: boolean;
}

export type PriceStatus = 'verifie' | 'estime' | 'inconnu';

export interface Product {
  id: string;
  foodId: string;
  storeId: string;
  label: string;
  /** Contenu du conditionnement, exprimé dans l'unité de l'aliment. */
  packSize: number;
  packUnit: 'g' | 'ml' | 'piece';
  price: number;
  priceStatus: PriceStatus;
  /** Source du prix, affichée à l'utilisateur. */
  priceSource: string;
}

/* ------------------------------------------------------------------ */
/* Recettes                                                             */
/* ------------------------------------------------------------------ */

export type MealSlot = 'petit_dejeuner' | 'dejeuner' | 'collation' | 'diner';

export interface RecipeIngredient {
  foodId: string;
  /** Quantité pour une portion, dans l'unité de l'aliment. */
  qty: number;
  /** false pour les condiments : la quantité ne suit pas la mise à l'échelle. */
  scalable?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  slots: MealSlot[];
  ingredients: RecipeIngredient[];
  steps: string[];
  prepTimeMin: number;
  /** Bornes de mise à l'échelle des portions. */
  minScale: number;
  maxScale: number;
}

/* ------------------------------------------------------------------ */
/* Moteur sportif                                                       */
/* ------------------------------------------------------------------ */

export type EquipmentId =
  | 'halteres'
  | 'barre'
  | 'rack'
  | 'smith'
  | 'poulie'
  | 'machine'
  | 'presse'
  | 'hack_squat'
  | 'tapis'
  | 'velo'
  | 'rameur'
  | 'banc'
  | 'barre_traction'
  | 'elastique'
  | 'poids_corps'
  | 'kettlebell';

export type MuscleGroup =
  | 'pectoraux'
  | 'dos'
  | 'epaules'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'ischios'
  | 'fessiers'
  | 'mollets'
  | 'abdos'
  | 'avant_bras'
  | 'cardio';

export type ExerciseType = 'polyarticulaire' | 'isolation' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  /** Tous les équipements listés sont nécessaires. */
  equipment: EquipmentId[];
  minLevel: TrainingLevel;
  type: ExerciseType;
  sets: [number, number];
  reps: [number, number];
  /** Unité de la plage `reps` : répétitions, secondes de maintien, minutes. */
  repUnit?: 'reps' | 'sec' | 'min';
  restSec: number;
  /** Plus la valeur est élevée, plus l'exercice est prioritaire dans la séance. */
  priority: number;
  alternatives: string[];
  cues?: string;
}

export interface Gym {
  id: string;
  name: string;
  /** Fichier logo officiel, s'il a été ajouté. Voir src/assets/logos/. */
  logo?: string;
  equipment: EquipmentId[];
  /** true si l'utilisateur doit choisir lui-même ses équipements. */
  custom: boolean;
  color: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  repUnit: 'reps' | 'sec' | 'min';
  restSec: number;
}

export interface Workout {
  id: string;
  /** Jour de la semaine, 0 = lundi. */
  day: DayIndex;
  name: string;
  focus: MuscleGroup[];
  exercises: WorkoutExercise[];
  estimatedMin: number;
}

export interface WorkoutPlan {
  splitName: string;
  workouts: Workout[];
  generatedAt: string;
}

export interface PerformanceSet {
  weightKg: number;
  reps: number;
}

export interface Performance {
  id: string;
  exerciseId: string;
  date: string; // ISO
  sets: PerformanceSet[];
  /**
   * Exécution jugée maîtrisée par l'utilisateur. La règle de double
   * progression ne propose une augmentation de charge que dans ce cas.
   */
  cleanExecution?: boolean;
}

/* ------------------------------------------------------------------ */
/* Plan alimentaire                                                     */
/* ------------------------------------------------------------------ */

export interface Meal {
  slot: MealSlot;
  recipeId: string;
  /** Facteur appliqué aux ingrédients pour atteindre la cible calorique. */
  scale: number;
  macros: Macros;
}

export interface DayPlan {
  day: DayIndex;
  meals: Meal[];
  totals: Macros;
  target: Macros;
  /**
   * Créneaux qu'aucune recette compatible n'a pu remplir. Le moteur ne
   * supprime jamais un repas en silence : l'écart est remonté à l'interface.
   */
  unmetSlots: MealSlot[];
}

export interface MealPlan {
  days: DayPlan[];
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Courses / budget                                                     */
/* ------------------------------------------------------------------ */

export interface PantryItem {
  foodId: string;
  qty: number;
}

export interface ShoppingListItem {
  id: string;
  foodId: string;
  foodName: string;
  category: FoodCategory;
  /** Besoin total de la semaine, avant déduction du garde-manger. */
  neededQty: number;
  /** Quantité déjà disponible à domicile et déduite. */
  pantryQty: number;
  /** Besoin réel à acheter. */
  toBuyQty: number;
  unit: 'g' | 'ml' | 'piece';
  productId: string | null;
  productLabel: string;
  packSize: number;
  packs: number;
  unitPrice: number;
  totalPrice: number;
  priceStatus: PriceStatus;
  priceSource: string;
  /**
   * Nombre de semaines couvertes par les conditionnements achetés, au rythme
   * de consommation du plan. Un pot de miel acheté pour 12 g par jour couvre
   * plusieurs semaines : le signaler évite de faire porter tout son prix à la
   * semaine en cours.
   */
  weeksOfSupply: number;
}

export interface ShoppingList {
  items: ShoppingListItem[];
  total: number;
  budget: number;
  storeId: string;
  /** Somme des lignes dont le prix est estimé ou inconnu. */
  uncertainTotal: number;
  /** Somme des lignes dont le conditionnement couvre plus de trois semaines. */
  longLifeTotal: number;
}

export interface Substitution {
  fromFoodId: string;
  toFoodId: string;
  fromName: string;
  toName: string;
  saving: number;
  reason: string;
}

/* ------------------------------------------------------------------ */
/* Suivi                                                                */
/* ------------------------------------------------------------------ */

export interface WeightEntry {
  date: string; // ISO yyyy-mm-dd
  weightKg: number;
}

export interface WeeklyCheckIn {
  date: string;
  weightKg: number;
  sessionsDone: number;
  hunger: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  difficulty: 1 | 2 | 3 | 4 | 5;
  planAdherence: number; // 0-100
  budgetSpent: number;
}

export interface CheckInAdjustment {
  kcalDelta: number;
  budgetDelta: number;
  messages: string[];
}

/* ------------------------------------------------------------------ */
/* État applicatif                                                      */
/* ------------------------------------------------------------------ */

export interface AppState {
  version: number;
  onboarded: boolean;
  profile: Profile;
  targetsOverride: Macros | null;
  pantry: PantryItem[];
  /** Repas remplacés manuellement : clé `${day}:${slot}` → recipeId. */
  mealOverrides: Record<string, string>;
  /** Exercices remplacés manuellement : clé `${workoutId}:${index}` → exerciseId. */
  exerciseOverrides: Record<string, string>;
  /** Substitutions d'aliments validées par l'optimiseur de budget. */
  foodSwaps: Record<string, string>;
  checkedItems: string[];
  /** Prix saisis manuellement pour les produits au prix inconnu. */
  manualPrices: Record<string, number>;
  /** Nombre de conditionnements forcé par l'utilisateur. */
  packOverrides: Record<string, number>;
  performances: Performance[];
  weightEntries: WeightEntry[];
  checkIns: WeeklyCheckIn[];
  theme: 'light' | 'dark';
  /** Semaine de référence du plan, format ISO du lundi. */
  weekStart: string;
}
