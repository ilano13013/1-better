import type { AppState, Performance, Profile, WeightEntry } from '../types';

/**
 * Profil de démonstration, conforme au cahier des charges :
 * homme, 26 ans, 175 cm, 63 kg, prise de masse, objectif 66 kg,
 * 4 entraînements par semaine, Basic-Fit, Lidl, 60 € par semaine.
 */
export const DEMO_PROFILE: Profile = {
  firstName: 'Alex',
  sex: 'homme',
  age: 26,
  heightCm: 175,
  weightKg: 63,
  targetWeightKg: 66,
  goal: 'masse',
  activity: 'modere',
  level: 'intermediaire',
  experienceMonths: 18,
  gymId: 'basic_fit',
  customEquipment: [],
  sessionsPerWeek: 4,
  availableDays: [0, 1, 3, 4],
  sessionDurationMin: 60,
  storeId: 'lidl',
  weeklyBudget: 60,
  mealsPerDay: 4,
  breakfast: true,
  diet: 'classique',
  restrictions: [],
  likedFoods: ['poulet_filet', 'riz_blanc', 'banane', 'fromage_blanc'],
  dislikedFoods: [],
  allergies: [],
};

export const DEMO_PANTRY: AppState['pantry'] = [
  { foodId: 'riz_blanc', qty: 750 },
  { foodId: 'pates', qty: 400 },
  { foodId: 'huile_olive', qty: 500 },
  { foodId: 'whey', qty: 500 },
  { foodId: 'epices', qty: 40 },
  { foodId: 'curry', qty: 30 },
  { foodId: 'oeuf', qty: 4 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export const DEMO_WEIGHTS: WeightEntry[] = [
  { date: isoDaysAgo(21), weightKg: 62.2 },
  { date: isoDaysAgo(18), weightKg: 62.5 },
  { date: isoDaysAgo(15), weightKg: 62.4 },
  { date: isoDaysAgo(12), weightKg: 62.8 },
  { date: isoDaysAgo(9), weightKg: 62.7 },
  { date: isoDaysAgo(6), weightKg: 63.1 },
  { date: isoDaysAgo(3), weightKg: 63.0 },
  { date: isoDaysAgo(0), weightKg: 63.4 },
];

export const DEMO_PERFORMANCES: Performance[] = [
  // Séances « Upper » du lundi
  {
    id: 'demo-1', exerciseId: 'developpe_couche', date: isoDaysAgo(10),
    sets: [{ weightKg: 55, reps: 8 }, { weightKg: 55, reps: 7 }, { weightKg: 55, reps: 7 }, { weightKg: 50, reps: 9 }],
  },
  {
    id: 'demo-2', exerciseId: 'developpe_couche', date: isoDaysAgo(3),
    sets: [{ weightKg: 57.5, reps: 9 }, { weightKg: 57.5, reps: 9 }, { weightKg: 57.5, reps: 8 }, { weightKg: 55, reps: 9 }],
  },
  {
    id: 'demo-3', exerciseId: 'traction', date: isoDaysAgo(3),
    sets: [{ weightKg: 0, reps: 9 }, { weightKg: 0, reps: 9 }, { weightKg: 0, reps: 9 }, { weightKg: 0, reps: 9 }],
  },
  {
    id: 'demo-4', exerciseId: 'developpe_militaire', date: isoDaysAgo(3),
    sets: [{ weightKg: 35, reps: 8 }, { weightKg: 35, reps: 7 }, { weightKg: 32.5, reps: 9 }, { weightKg: 32.5, reps: 8 }],
  },
  {
    id: 'demo-5', exerciseId: 'rowing_barre', date: isoDaysAgo(3),
    sets: [{ weightKg: 50, reps: 9 }, { weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }, { weightKg: 45, reps: 9 }],
  },
  // Séance « Lower » du mardi
  {
    id: 'demo-6', exerciseId: 'squat_barre', date: isoDaysAgo(9),
    sets: [{ weightKg: 70, reps: 7 }, { weightKg: 70, reps: 6 }, { weightKg: 70, reps: 6 }, { weightKg: 65, reps: 8 }],
  },
  {
    id: 'demo-7', exerciseId: 'squat_barre', date: isoDaysAgo(2),
    sets: [{ weightKg: 72.5, reps: 8 }, { weightKg: 72.5, reps: 7 }, { weightKg: 72.5, reps: 7 }, { weightKg: 70, reps: 8 }],
  },
  {
    id: 'demo-8', exerciseId: 'souleve_terre_roumain', date: isoDaysAgo(2),
    sets: [{ weightKg: 60, reps: 9 }, { weightKg: 60, reps: 9 }, { weightKg: 60, reps: 8 }, { weightKg: 55, reps: 10 }],
  },
  // Séance « Upper » du jeudi
  {
    id: 'demo-9', exerciseId: 'developpe_incline_halteres', date: isoDaysAgo(7),
    sets: [{ weightKg: 22, reps: 9 }, { weightKg: 22, reps: 8 }, { weightKg: 22, reps: 8 }, { weightKg: 20, reps: 9 }],
  },
  {
    id: 'demo-10', exerciseId: 'developpe_incline_halteres', date: isoDaysAgo(4),
    // Borne haute atteinte sur toutes les séries : le moteur proposera +2,5 kg.
    sets: [{ weightKg: 24, reps: 9 }, { weightKg: 24, reps: 9 }, { weightKg: 24, reps: 9 }, { weightKg: 24, reps: 9 }],
  },
  {
    id: 'demo-11', exerciseId: 'tirage_vertical', date: isoDaysAgo(4),
    sets: [{ weightKg: 50, reps: 11 }, { weightKg: 50, reps: 10 }, { weightKg: 45, reps: 12 }, { weightKg: 45, reps: 11 }],
  },
  {
    id: 'demo-12', exerciseId: 'elevations_laterales', date: isoDaysAgo(4),
    sets: [{ weightKg: 10, reps: 14 }, { weightKg: 10, reps: 13 }, { weightKg: 8, reps: 14 }, { weightKg: 8, reps: 14 }],
  },
];
