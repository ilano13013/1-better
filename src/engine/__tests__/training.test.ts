import { describe, expect, it } from 'vitest';
import {
  assignDays, availableExercises, equipmentOk, findReplacements,
  generateWorkoutPlan, pickSplit, repairPlanForEquipment,
} from '../training';
import { getExercise } from '../../data/exercises';
import { resolveEquipment } from '../../data/gyms';
import { DEMO_PROFILE } from '../../data/demo';
import type { DayIndex, Profile } from '../../types';

describe('moteur sportif', () => {
  it('choisit un split adapté à la fréquence', () => {
    expect(pickSplit(2, 'debutant').sessions).toHaveLength(2);
    expect(pickSplit(3, 'debutant').name).toContain('Full Body');
    expect(pickSplit(3, 'avance').name).toContain('Push');
    expect(pickSplit(6, 'avance').sessions).toHaveLength(6);
  });

  it('répartit les séances sur les jours disponibles', () => {
    const days = assignDays([0, 1, 3, 4], 4);
    expect(days).toEqual([0, 1, 3, 4]);
    const spread = assignDays([0, 1, 2, 3, 4, 5, 6], 3);
    expect(new Set(spread).size).toBe(3);
  });

  it('ne programme que des exercices réalisables à domicile', () => {
    const home: Profile = {
      ...DEMO_PROFILE, gymId: 'domicile', customEquipment: ['halteres', 'banc'],
    };
    const equipment = resolveEquipment(home.gymId, home.customEquipment);
    const plan = generateWorkoutPlan(home);
    for (const workout of plan.workouts) {
      for (const we of workout.exercises) {
        expect(equipmentOk(getExercise(we.exerciseId), equipment)).toBe(true);
      }
    }
  });

  it('respecte le niveau de l\'utilisateur', () => {
    const beginner: Profile = { ...DEMO_PROFILE, level: 'debutant' };
    const plan = generateWorkoutPlan(beginner);
    for (const w of plan.workouts) {
      for (const we of w.exercises) {
        expect(getExercise(we.exerciseId).minLevel).toBe('debutant');
      }
    }
  });

  it('tient dans l\'enveloppe de temps demandée', () => {
    const short: Profile = { ...DEMO_PROFILE, sessionDurationMin: 45 };
    const plan = generateWorkoutPlan(short);
    for (const w of plan.workouts) {
      expect(w.exercises.length).toBeGreaterThanOrEqual(3);
      expect(w.estimatedMin).toBeLessThanOrEqual(45 + 12);
    }
    const long = generateWorkoutPlan({ ...DEMO_PROFILE, sessionDurationMin: 90 });
    const longTotal = long.workouts.reduce((s, w) => s + w.exercises.length, 0);
    const shortTotal = plan.workouts.reduce((s, w) => s + w.exercises.length, 0);
    expect(longTotal).toBeGreaterThan(shortTotal);
  });

  it('ne répète pas un exercice dans une même séance', () => {
    const plan = generateWorkoutPlan(DEMO_PROFILE);
    for (const w of plan.workouts) {
      const ids = w.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('est reproductible', () => {
    const a = generateWorkoutPlan(DEMO_PROFILE);
    const b = generateWorkoutPlan({ ...DEMO_PROFILE });
    expect(a.workouts.map((w) => w.exercises.map((e) => e.exerciseId)))
      .toEqual(b.workouts.map((w) => w.exercises.map((e) => e.exerciseId)));
  });

  it('propose des remplacements ciblant le même muscle', () => {
    const plan = generateWorkoutPlan(DEMO_PROFILE);
    const workout = plan.workouts[0];
    const target = workout.exercises[0].exerciseId;
    const equipment = resolveEquipment(DEMO_PROFILE.gymId, DEMO_PROFILE.customEquipment);
    const options = findReplacements(target, equipment, DEMO_PROFILE.level, workout);
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.primary).toBe(getExercise(target).primary);
      expect(equipmentOk(option, equipment)).toBe(true);
      expect(workout.exercises.some((e) => e.exerciseId === option.id)).toBe(false);
    }
  });

  it('remplace les exercices impossibles après un changement de salle', () => {
    const gymPlan = generateWorkoutPlan(DEMO_PROFILE);
    const homeEquipment = resolveEquipment('domicile', ['halteres', 'banc']);
    const { plan, changes } = repairPlanForEquipment(gymPlan, homeEquipment, 'intermediaire', 'masse');
    expect(changes.length).toBeGreaterThan(0);
    for (const w of plan.workouts) {
      for (const we of w.exercises) {
        expect(equipmentOk(getExercise(we.exerciseId), homeEquipment)).toBe(true);
      }
    }
  });

  it('couvre tous les grands groupes musculaires sur la semaine', () => {
    const plan = generateWorkoutPlan(DEMO_PROFILE);
    const muscles = new Set(
      plan.workouts.flatMap((w) => w.exercises.map((e) => getExercise(e.exerciseId).primary)),
    );
    for (const m of ['pectoraux', 'dos', 'quadriceps', 'epaules']) {
      expect(muscles.has(m as never)).toBe(true);
    }
  });

  it('expose au moins 50 exercices utilisables en salle complète', () => {
    const equipment = resolveEquipment('fitness_park', []);
    expect(availableExercises(equipment, 'avance').length).toBeGreaterThanOrEqual(50);
  });

  it('accepte une semaine sans jour déclaré', () => {
    const plan = generateWorkoutPlan({ ...DEMO_PROFILE, availableDays: [] as DayIndex[] });
    expect(plan.workouts).toHaveLength(4);
  });
});
