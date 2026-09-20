import type { ActivityLevel, Goal, GoalId } from '../types';

export const GOALS: Record<GoalId, Goal> = {
  masse: {
    id: 'masse', label: 'Prise de masse',
    description: 'Construire du muscle avec un léger surplus calorique.',
    kcalFactor: 1.1, proteinPerKg: 2.2, fatRatio: 0.25,
  },
  seche: {
    id: 'seche', label: 'Perte de poids / sèche',
    description: 'Perdre de la masse grasse en préservant le muscle.',
    kcalFactor: 0.8, proteinPerKg: 2.2, fatRatio: 0.28,
  },
  maintien: {
    id: 'maintien', label: 'Maintien',
    description: 'Stabiliser le poids et progresser à l\'entraînement.',
    kcalFactor: 1.0, proteinPerKg: 1.8, fatRatio: 0.28,
  },
  recomp: {
    id: 'recomp', label: 'Recomposition corporelle',
    description: 'Gagner du muscle et perdre du gras simultanément.',
    kcalFactor: 0.95, proteinPerKg: 2.3, fatRatio: 0.27,
  },
};

export const GOAL_LIST: Goal[] = Object.values(GOALS);

/** Facteur d'activité hors entraînement (NEAT). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentaire: 1.2,
  leger: 1.3,
  modere: 1.4,
  actif: 1.5,
  tres_actif: 1.6,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentaire: 'Sédentaire — bureau, peu de marche',
  leger: 'Légèrement actif — quelques déplacements',
  modere: 'Modérément actif — debout ou marche régulière',
  actif: 'Actif — métier physique',
  tres_actif: 'Très actif — métier physique intense',
};
