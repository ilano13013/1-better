import { describe, expect, it } from 'vitest';
import { buildPlan } from '../planner';
import { eligibleRecipes } from '../mealPlan';
import { suggestNext } from '../progression';
import { LIMITS, limitsFor, withinHistory } from '../entitlements';
import { demoState } from '../../store/state';
import type { AppState, Performance } from '../../types';

const free = (): AppState => ({ ...demoState(), plan: 'free' });
const plus = (): AppState => ({ ...demoState(), plan: 'plus' });

describe('formules', () => {
  /*
   * L'enjeu de cette suite : une limite qui n'existerait que dans l'interface
   * n'est pas une limite. On vérifie donc ce que les MOTEURS produisent, pas ce
   * que les écrans montrent.
   */

  it('ne planifie que trois jours de repas en gratuit', () => {
    expect(buildPlan(free()).mealPlan.days).toHaveLength(3);
    expect(buildPlan(plus()).mealPlan.days).toHaveLength(7);
  });

  it('plafonne les séances à trois par semaine en gratuit', () => {
    const state = free();
    state.profile.sessionsPerWeek = 5;
    expect(buildPlan(state).workoutPlan.workouts).toHaveLength(3);

    const ouvert = plus();
    ouvert.profile.sessionsPerWeek = 5;
    expect(buildPlan(ouvert).workoutPlan.workouts).toHaveLength(5);
  });

  it('ne descend pas en dessous de ce que la personne a demandé', () => {
    // Un plafond n'est pas un plancher : deux séances demandées restent deux.
    const state = free();
    state.profile.sessionsPerWeek = 2;
    expect(buildPlan(state).workoutPlan.workouts).toHaveLength(2);
  });

  it('ignore les machines de la salle en gratuit', () => {
    const state = free();          // Basic-Fit : poulies, presse, hack squat…
    const gratuit = buildPlan(state);
    const complet = buildPlan(plus());
    expect(gratuit.equipment).not.toContain('presse');
    expect(complet.equipment).toContain('presse');

    // Le programme gratuit reste exécutable avec le matériel de base.
    const used = gratuit.workoutPlan.workouts.flatMap((w) => w.exercises);
    expect(used.length).toBeGreaterThan(0);
  });

  it('limite le choix de recettes sans jamais vider un créneau', () => {
    const state = free();
    for (const slot of ['petit_dejeuner', 'dejeuner', 'diner', 'collation'] as const) {
      const limitees = eligibleRecipes(state.profile, slot, LIMITS.free);
      const toutes = eligibleRecipes(state.profile, slot, LIMITS.plus);
      expect(limitees.length).toBeLessThanOrEqual(LIMITS.free.recipesPerSlot!);
      expect(limitees.length).toBeGreaterThanOrEqual(2);
      expect(toutes.length).toBeGreaterThanOrEqual(limitees.length);
    }
  });

  it('remplit malgré tout tous les créneaux du plan gratuit', () => {
    // Une formule bridée ne doit pas produire un plan troué.
    for (const day of buildPlan(free()).mealPlan.days) {
      expect(day.unmetSlots).toEqual([]);
      expect(day.meals.length).toBeGreaterThan(0);
    }
  });

  it('ne calcule pas de progression en gratuit', () => {
    const we = { exerciseId: 'developpe_couche_halteres', sets: 3, repMin: 8, repMax: 12,
      repUnit: 'reps' as const, restSec: 120 };
    const history: Performance[] = [{
      id: 'p1', exerciseId: 'developpe_couche_halteres', date: '2026-09-20',
      sets: [{ weightKg: 20, reps: 12 }, { weightKg: 20, reps: 12 }, { weightKg: 20, reps: 12 }],
      cleanExecution: true,
    }];
    // Douze répétitions propres au plafond : la formule complète monte la charge.
    expect(suggestNext(we, history, LIMITS.plus).kind).toBe('charge');
    expect(suggestNext(we, history, LIMITS.free).kind).toBe('formule');
    expect(suggestNext(we, history, LIMITS.free).weightKg).toBe(0);
  });

  it('borne la lecture de l\'historique sans rien supprimer', () => {
    const now = new Date('2026-09-23T12:00:00Z');
    const entries = [
      { date: '2026-09-20', weightKg: 63 },
      { date: '2026-08-20', weightKg: 64 },   // 34 jours : hors fenêtre
    ];
    expect(withinHistory(entries, LIMITS.free, now)).toHaveLength(1);
    expect(withinHistory(entries, LIMITS.plus, now)).toHaveLength(2);
    // La source n'est pas touchée : changer de formule fait tout revenir.
    expect(entries).toHaveLength(2);
  });

  it('n\'entame jamais le calcul nutritionnel', () => {
    // Un plan gratuit qui minorerait les calories serait dangereux, pas limité.
    expect(buildPlan(free()).targets).toEqual(buildPlan(plus()).targets);
  });

  it('retombe sur la formule gratuite pour une valeur inconnue', () => {
    expect(limitsFor('inconnue' as never)).toEqual(LIMITS.free);
  });
});
