import { describe, expect, it } from 'vitest';
import { buildPlan } from '../planner';
import { eligibleRecipes } from '../mealPlan';
import { suggestNext } from '../progression';
import {
  LIMITS, PRICES, daysLeft, effectivePlan, isSubscriptionActive, limitsFor,
  monthlyEquivalent, renewalDate, startSubscription, withinHistory, yearlySavings,
  yearlySavingsPct,
} from '../entitlements';
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

describe('abonnement', () => {
  it('chiffre correctement les deux formules', () => {
    expect(PRICES.monthly).toBe(499);
    expect(PRICES.yearly).toBe(3900);
    // 4,99 × 12 = 59,88 ; l'annuel économise 20,88 €, soit 35 %.
    expect(yearlySavings()).toBe(2088);
    expect(yearlySavingsPct()).toBe(35);
    expect(monthlyEquivalent('yearly')).toBe(325);
    expect(monthlyEquivalent('monthly')).toBe(499);
  });

  it('calcule une échéance mensuelle sans déborder sur le mois suivant', () => {
    // Le piège classique : `setMonth` sur un 31 renvoie le 3 mars.
    expect(renewalDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(renewalDate('2024-01-31', 'monthly')).toBe('2024-02-29'); // bissextile
    expect(renewalDate('2026-03-31', 'monthly')).toBe('2026-04-30');
    expect(renewalDate('2026-09-23', 'monthly')).toBe('2026-10-23');
    expect(renewalDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('calcule une échéance annuelle, 29 février compris', () => {
    expect(renewalDate('2026-09-23', 'yearly')).toBe('2027-09-23');
    expect(renewalDate('2024-02-29', 'yearly')).toBe('2025-02-28');
  });

  it('ouvre les fonctions jusqu\'à l\'échéance, pas au-delà', () => {
    const sub = startSubscription('monthly', new Date(2026, 8, 23));
    expect(sub.renewsAt).toBe('2026-10-23');
    expect(isSubscriptionActive(sub, new Date(2026, 9, 23))).toBe(true);  // le jour même
    expect(isSubscriptionActive(sub, new Date(2026, 9, 24))).toBe(false);
    expect(isSubscriptionActive(null)).toBe(false);
  });

  it('retombe en gratuit quand l\'abonnement est échu', () => {
    // Rien ne renouvelle : une période échue doit refermer les fonctions,
    // sans qu'aucun écran n'ait à y penser.
    const sub = startSubscription('monthly', new Date(2026, 8, 23));
    const state = { plan: 'plus' as const, subscription: sub };
    expect(effectivePlan(state, new Date(2026, 9, 1))).toBe('plus');
    expect(effectivePlan(state, new Date(2026, 10, 1))).toBe('free');
    // Sans abonnement, « plus » ne vaut rien.
    expect(effectivePlan({ plan: 'plus', subscription: null })).toBe('free');
  });

  it('referme réellement les moteurs à l\'échéance', () => {
    const state = { ...demoState(), subscription: startSubscription('monthly', new Date(2020, 0, 1)) };
    // L'abonnement de 2020 est échu depuis longtemps.
    expect(buildPlan(state).mealPlan.days).toHaveLength(3);
  });

  it('ne compte jamais de jours restants négatifs', () => {
    const sub = startSubscription('monthly', new Date(2026, 8, 23));
    expect(daysLeft(sub, new Date(2026, 8, 23))).toBe(30);
    expect(daysLeft(sub, new Date(2027, 0, 1))).toBe(0);
  });
});
