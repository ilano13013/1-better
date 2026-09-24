import type { AppState, Profile } from '../types';
import { startSubscription } from '../engine/entitlements';
import { DEMO_PANTRY, DEMO_PERFORMANCES, DEMO_PROFILE, DEMO_WEIGHTS } from '../data/demo';

export const STATE_VERSION = 1;

/** Lundi de la semaine courante, au format ISO. */
export function currentWeekStart(today = new Date()): string {
  const d = new Date(today);
  d.setHours(12, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - shift);
  return d.toISOString().slice(0, 10);
}

/** Index du jour courant, 0 = lundi. */
/** Date ISO du jour `day` (0 = lundi) dans la semaine courante. */
export function isoForDay(day: number, today = new Date()): string {
  const d = new Date(today);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + day);
  return d.toISOString().slice(0, 10);
}

export function todayIndex(today = new Date()): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return ((today.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Thème de départ : celui du système. L'utilisateur peut le changer ensuite,
 * et son choix est conservé. Sans cette lecture, le premier rendu peut
 * clignoter lorsque l'appareil est en mode clair.
 */
export function preferredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export const EMPTY_PROFILE: Profile = {
  firstName: '',
  sex: 'homme',
  age: 25,
  heightCm: 175,
  weightKg: 70,
  targetWeightKg: 70,
  goal: 'maintien',
  activity: 'modere',
  level: 'debutant',
  experienceMonths: 0,
  gymId: 'basic_fit',
  customEquipment: [],
  sessionsPerWeek: 3,
  availableDays: [0, 2, 4],
  sessionDurationMin: 60,
  storeId: 'lidl',
  weeklyBudget: 60,
  mealsPerDay: 4,
  breakfast: true,
  diet: 'classique',
  restrictions: [],
  likedFoods: [],
  dislikedFoods: [],
  allergies: [],
};

export function createInitialState(): AppState {
  return {
    version: STATE_VERSION,
    onboarded: false,
    plan: 'free',
    subscription: null,
    intake: [],
    startDate: null,
    tourSeen: false,
    profile: { ...EMPTY_PROFILE },
    targetsOverride: null,
    pantry: [],
    mealOverrides: {},
    exerciseOverrides: {},
    foodSwaps: {},
    checkedItems: [],
    manualPrices: {},
    packOverrides: {},
    driveAdded: [],
    brandLogos: {},
    recipePhotos: {},
    performances: [],
    weightEntries: [],
    checkIns: [],
    theme: preferredTheme(),
    weekStart: currentWeekStart(),
  };
}

/** État complet du profil de démonstration, prêt à explorer. */
export function demoState(): AppState {
  return {
    ...createInitialState(),
    onboarded: true,
    // La démonstration montre le produit entier : sept jours, quatre séances,
    // liste complète. C'est ce que décrit le cahier des charges.
    plan: 'plus',
    startDate: currentWeekStart(),
    tourSeen: true,
    subscription: startSubscription('yearly'),
    profile: { ...DEMO_PROFILE },
    pantry: DEMO_PANTRY.map((p) => ({ ...p })),
    performances: DEMO_PERFORMANCES.map((p) => ({ ...p })),
    weightEntries: DEMO_WEIGHTS.map((w) => ({ ...w })),
  };
}

/** Réinitialise ce qui dépend d'un plan : appelé quand le plan est régénéré. */
export function clearPlanOverrides(state: AppState): AppState {
  return {
    ...state,
    mealOverrides: {},
    exerciseOverrides: {},
    foodSwaps: {},
    checkedItems: [],
    packOverrides: {},
    driveAdded: [],
  };
}
