import { describe, expect, it } from 'vitest';
import { estimated1RM, loadIncrement, personalRecords, suggestNext, lastPerformance } from '../progression';
import { movingAverage, weeklyTrendPct, latestWeight } from '../weight';
import { evaluateCheckIn, isCheckInDue } from '../checkin';
import { buildBadges, sessionCount, weekStreak } from '../gamification';
import {
  buildSearchUrl, driveStatus, getHandoff, handoffPlan, handoffProgress,
  prepareCart, searchTerm,
} from '../drive';
import { buildPlan, resolveTargets, workoutForDay } from '../planner';
import { computeTargets } from '../nutrition';
import { getExercise } from '../../data/exercises';
import { buildShoppingList, purchasableItems } from '../shopping';
import { createInitialState, demoState } from '../../store/state';
import type { Performance, WeeklyCheckIn, WeightEntry, WorkoutExercise } from '../../types';

describe('progression', () => {
  const we: WorkoutExercise = {
    exerciseId: 'developpe_incline_halteres', sets: 4, repMin: 8, repMax: 10,
    repUnit: 'reps', restSec: 120,
  };

  it('propose une charge de départ à la première séance', () => {
    expect(suggestNext(we, []).kind).toBe('premiere_seance');
  });

  it('augmente la charge quand la borne haute est atteinte partout', () => {
    const perf: Performance[] = [{
      id: '1', exerciseId: we.exerciseId, date: '2026-01-10',
      sets: [{ weightKg: 24, reps: 10 }, { weightKg: 24, reps: 10 }, { weightKg: 24, reps: 10 }, { weightKg: 24, reps: 10 }],
    }];
    const next = suggestNext(we, perf);
    expect(next.kind).toBe('charge');
    expect(next.weightKg).toBe(24 + loadIncrement(getExercise(we.exerciseId)));
    expect(next.reps).toBe(8);
  });

  it('n\'augmente pas la charge si l\'exécution n\'était pas maîtrisée', () => {
    const perf: Performance[] = [{
      id: '1', exerciseId: we.exerciseId, date: '2026-01-10',
      cleanExecution: false,
      sets: [{ weightKg: 24, reps: 10 }, { weightKg: 24, reps: 10 }, { weightKg: 24, reps: 10 }, { weightKg: 24, reps: 10 }],
    }];
    const next = suggestNext(we, perf);
    expect(next.kind).toBe('repetitions');
    expect(next.weightKg).toBe(24);
    expect(next.message).toContain('technique');
  });

  it('ajoute une répétition tant que la borne haute n\'est pas atteinte', () => {
    const perf: Performance[] = [{
      id: '1', exerciseId: we.exerciseId, date: '2026-01-10',
      sets: [{ weightKg: 24, reps: 9 }, { weightKg: 24, reps: 8 }, { weightKg: 24, reps: 8 }, { weightKg: 22, reps: 9 }],
    }];
    const next = suggestNext(we, perf);
    expect(next.kind).toBe('repetitions');
    expect(next.weightKg).toBe(24);
    expect(next.reps).toBe(10);
  });

  it('détecte une stagnation sur trois séances', () => {
    const sets = [{ weightKg: 24, reps: 8 }, { weightKg: 24, reps: 8 }];
    const perf: Performance[] = [
      { id: '3', exerciseId: we.exerciseId, date: '2026-01-15', sets },
      { id: '2', exerciseId: we.exerciseId, date: '2026-01-12', sets },
      { id: '1', exerciseId: we.exerciseId, date: '2026-01-09', sets },
    ];
    expect(suggestNext(we, perf).kind).toBe('stagnation');
  });

  it('gère les exercices comptés en temps sans toucher à la charge', () => {
    const plank: WorkoutExercise = {
      exerciseId: 'gainage', sets: 3, repMin: 30, repMax: 60, repUnit: 'sec', restSec: 60,
    };
    const first = suggestNext(plank, []);
    expect(first.message).toContain('secondes');
    const next = suggestNext(plank, [{
      id: 'p', exerciseId: 'gainage', date: '2026-01-10',
      sets: [{ weightKg: 0, reps: 40 }, { weightKg: 0, reps: 38 }],
    }]);
    expect(next.reps).toBe(45);
    expect(next.weightKg).toBe(0);
  });

  it('charge les incréments par type d\'exercice', () => {
    expect(loadIncrement(getExercise('squat_barre'))).toBe(5);
    expect(loadIncrement(getExercise('developpe_couche'))).toBe(2.5);
    expect(loadIncrement(getExercise('elevations_laterales'))).toBe(1);
  });

  it('calcule les records et le 1RM estimé', () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(100, 10)).toBeCloseTo(133.33, 1);
    const prs = personalRecords(demoState().performances);
    expect(prs.length).toBeGreaterThan(0);
    expect(prs[0].estimated1RM).toBeGreaterThanOrEqual(prs[prs.length - 1].estimated1RM);
  });

  it('retrouve la dernière séance d\'un exercice', () => {
    const last = lastPerformance('developpe_incline_halteres', demoState().performances);
    expect(last).not.toBeNull();
    expect(last!.date >= '2020-01-01').toBe(true);
  });
});

describe('suivi du poids', () => {
  const entries: WeightEntry[] = [
    { date: '2026-01-01', weightKg: 62.8 },
    { date: '2026-01-03', weightKg: 63.4 },
    { date: '2026-01-05', weightKg: 62.9 },
    { date: '2026-01-07', weightKg: 63.3 },
    { date: '2026-01-09', weightKg: 63.6 },
  ];

  it('lisse les pesées par moyenne glissante', () => {
    const avg = movingAverage(entries, 3);
    expect(avg).toHaveLength(entries.length);
    expect(avg[0].value).toBe(62.8);
    expect(avg[2].value).toBeCloseTo((62.8 + 63.4 + 62.9) / 3, 2);
  });

  it('exprime la tendance en % du poids par semaine', () => {
    const trend = weeklyTrendPct(entries);
    expect(trend).not.toBeNull();
    expect(trend!).toBeGreaterThan(0);
  });

  it('refuse de conclure avec trop peu de pesées', () => {
    expect(weeklyTrendPct(entries.slice(0, 2))).toBeNull();
  });

  it('refuse de conclure sans point de comparaison récent', () => {
    expect(weeklyTrendPct([
      ...entries.slice(0, 4),
      { date: '2026-06-01', weightKg: 64 },
    ])).toBeNull();
  });

  it('retourne la dernière pesée', () => {
    expect(latestWeight(entries, 60)).toBe(63.6);
    expect(latestWeight([], 60)).toBe(60);
  });
});

describe('check-in hebdomadaire', () => {
  const state = demoState();
  const dayAgo = (n: number) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const base: WeeklyCheckIn = {
    date: new Date().toISOString().slice(0, 10),
    weightKg: 63.4, sessionsDone: 4, hunger: 3, energy: 3, difficulty: 2,
    planAdherence: 85, budgetSpent: 58,
  };

  it('propose des calories en plus si la prise de poids est trop lente', () => {
    const flat: WeightEntry[] = Array.from({ length: 8 }, (_, i) => ({
      date: dayAgo(14 - i * 2), weightKg: 63,
    }));
    const result = evaluateCheckIn({
      profile: state.profile, targets: computeTargets(state.profile),
      checkIn: { ...base, weightKg: 63 }, weightEntries: flat,
    });
    expect(result.kcalDelta).toBeGreaterThan(0);
  });

  it('propose de réduire si la prise est trop rapide', () => {
    const fast: WeightEntry[] = Array.from({ length: 8 }, (_, i) => ({
      date: dayAgo(14 - i * 2), weightKg: 63 + i * 0.4,
    }));
    const result = evaluateCheckIn({
      profile: state.profile, targets: computeTargets(state.profile),
      checkIn: { ...base, weightKg: 65.8 }, weightEntries: fast,
    });
    expect(result.kcalDelta).toBeLessThan(0);
  });

  it('propose un ajustement de budget en cas de dépassement', () => {
    const result = evaluateCheckIn({
      profile: state.profile, targets: computeTargets(state.profile),
      checkIn: { ...base, budgetSpent: 80 }, weightEntries: state.weightEntries,
    });
    expect(result.budgetDelta).toBeGreaterThan(0);
    expect(result.messages.join(' ')).toContain('Budget dépassé');
  });

  it('ne descend jamais sous le métabolisme de base', () => {
    const profile = { ...state.profile, goal: 'seche' as const };
    const targets = { ...computeTargets(profile), kcal: 1620, bmr: 1600 };
    const fast: WeightEntry[] = Array.from({ length: 8 }, (_, i) => ({
      date: dayAgo(14 - i * 2), weightKg: 70 - i * 0.5,
    }));
    const result = evaluateCheckIn({
      profile, targets, checkIn: { ...base, weightKg: 66.5 }, weightEntries: fast,
    });
    expect(targets.kcal + result.kcalDelta).toBeGreaterThanOrEqual(targets.bmr);
  });

  it('sait quand un check-in est dû', () => {
    expect(isCheckInDue([])).toBe(true);
    expect(isCheckInDue([{ ...base, date: new Date().toISOString().slice(0, 10) }])).toBe(false);
  });
});

describe('gamification', () => {
  it('compte les séances par date', () => {
    expect(sessionCount(demoState().performances)).toBeGreaterThan(0);
    expect(sessionCount([])).toBe(0);
  });

  it('compte les semaines complètes consécutives', () => {
    const checkIns: WeeklyCheckIn[] = [
      { date: '2026-01-15', weightKg: 63, sessionsDone: 4, hunger: 3, energy: 3, difficulty: 3, planAdherence: 90, budgetSpent: 55 },
      { date: '2026-01-08', weightKg: 63, sessionsDone: 4, hunger: 3, energy: 3, difficulty: 3, planAdherence: 90, budgetSpent: 55 },
      { date: '2026-01-01', weightKg: 63, sessionsDone: 2, hunger: 3, energy: 3, difficulty: 3, planAdherence: 90, budgetSpent: 55 },
    ];
    expect(weekStreak(checkIns, 4)).toBe(2);
  });

  it('construit des badges avec progression bornée', () => {
    const badges = buildBadges(demoState());
    expect(badges.length).toBeGreaterThan(4);
    for (const b of badges) {
      expect(b.progress).toBeGreaterThanOrEqual(0);
      expect(b.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('intégration Drive', () => {
  it('n\'invente aucun connecteur', async () => {
    const status = driveStatus('carrefour');
    expect(status.state).toBe('connecteur_absent');
    const plan = buildPlan(demoState());
    const cart = await prepareCart(plan.shoppingList, purchasableItems(plan.shoppingList));
    expect(cart).toBeNull();
  });

  it('retombe sur la page d\'accueil tant qu\'aucun gabarit n\'est renseigné', () => {
    const handoff = getHandoff('carrefour')!;
    expect(handoff.searchTemplate).toBeUndefined();
    // Un lien de recherche inventé enverrait sur une page d'erreur : mieux vaut
    // l'accueil, avec le nom du produit dans le presse-papiers.
    expect(buildSearchUrl(handoff, 'poulet')).toBe(handoff.homeUrl);
  });

  it('construit une recherche dès qu\'un gabarit valide est renseigné', () => {
    const handoff = { storeId: 'test', homeUrl: 'https://exemple.fr', searchTemplate: 'https://exemple.fr/s?q={q}' };
    expect(buildSearchUrl(handoff, 'filets de poulet')).toBe('https://exemple.fr/s?q=filets%20de%20poulet');
  });

  it('refuse un gabarit non https ou malformé', () => {
    const home = 'https://exemple.fr';
    expect(buildSearchUrl({ storeId: 't', homeUrl: home, searchTemplate: 'http://x.fr/?q={q}' }, 'riz')).toBe(home);
    expect(buildSearchUrl({ storeId: 't', homeUrl: home, searchTemplate: 'pas une url {q}' }, 'riz')).toBe(home);
    expect(buildSearchUrl({ storeId: 't', homeUrl: home, searchTemplate: 'https://x.fr/sans-jeton' }, 'riz')).toBe(home);
  });

  it('nettoie le conditionnement du terme recherché', () => {
    const plan = buildPlan(demoState());
    const items = purchasableItems(plan.shoppingList);
    for (const item of items) {
      const term = searchTerm(item);
      expect(term.length).toBeGreaterThanOrEqual(3);
      // Ni unité de conditionnement, ni multiplicateur.
      expect(term).not.toMatch(/\d+\s*(g|kg|ml|cl|l)\b/i);
      expect(term).not.toMatch(/[x×]\s*\d+/i);
    }
    const eggs = items.find((i) => i.foodId === 'oeuf');
    if (eggs) expect(searchTerm(eggs)).toBe('Œufs frais');
  });

  it('suit l\'avancement et reprend au premier produit restant', () => {
    const plan = buildPlan(demoState());
    const items = purchasableItems(plan.shoppingList).slice(0, 5);

    const fresh = handoffProgress(handoffPlan(items, []));
    expect(fresh.done).toBe(0);
    expect(fresh.nextIndex).toBe(0);

    // On saute le premier : la reprise doit pointer sur le deuxième.
    const partial = handoffProgress(handoffPlan(items, [items[0].id]));
    expect(partial.done).toBe(1);
    expect(partial.nextIndex).toBe(1);
    expect(partial.doneTotal).toBeCloseTo(items[0].totalPrice, 2);

    const all = handoffProgress(handoffPlan(items, items.map((i) => i.id)));
    expect(all.done).toBe(items.length);
    expect(all.nextIndex).toBe(-1);
  });

  it('conserve l\'ordre par rayon de la liste de courses', () => {
    const plan = buildPlan(demoState());
    const items = purchasableItems(plan.shoppingList);
    const steps = handoffPlan(items, []);
    expect(steps.map((s) => s.item.id)).toEqual(items.map((i) => i.id));
  });
});

describe('moteur de planification', () => {
  it('relie profil, nutrition, entraînement et courses', () => {
    const state = demoState();
    const plan = buildPlan(state);
    expect(plan.targets.kcal).toBeGreaterThan(0);
    expect(plan.workoutPlan.workouts).toHaveLength(state.profile.sessionsPerWeek);
    expect(plan.mealPlan.days).toHaveLength(7);
    expect(plan.shoppingList.items.length).toBeGreaterThan(0);
    expect(workoutForDay(plan.workoutPlan, 0)).not.toBeNull();
  });

  it('respecte un objectif calorique saisi manuellement', () => {
    const state = { ...createInitialState(), targetsOverride: { kcal: 0, protein: 180, carbs: 300, fat: 70 } };
    const targets = resolveTargets(state);
    expect(targets.manual).toBe(true);
    expect(targets.kcal).toBe(180 * 4 + 300 * 4 + 70 * 9);
  });

  it('recalcule les courses quand le magasin change', () => {
    const state = demoState();
    const lidl = buildPlan(state).shoppingList;
    const mono = buildPlan({ ...state, profile: { ...state.profile, storeId: 'monoprix' } }).shoppingList;
    expect(mono.storeId).toBe('monoprix');
    expect(mono.total).not.toBe(lidl.total);
  });

  it('remplace les exercices impossibles quand la salle change', () => {
    const state = demoState();
    const home = buildPlan({
      ...state,
      profile: { ...state.profile, gymId: 'domicile', customEquipment: ['halteres'] },
    });
    for (const w of home.workoutPlan.workouts) {
      for (const we of w.exercises) {
        const ex = getExercise(we.exerciseId);
        expect(ex.equipment.every((e) => home.equipment.includes(e))).toBe(true);
      }
    }
  });

  it('déduit le garde-manger des courses', () => {
    const state = demoState();
    const withPantry = buildPlan(state).shoppingList;
    const without = buildShoppingList(
      buildPlan(state).mealPlan, state.profile, { budget: state.profile.weeklyBudget },
    );
    expect(withPantry.total).toBeLessThanOrEqual(without.total);
  });

  it('répercute un budget plus serré sur le plan et les courses', () => {
    const state = demoState();
    const rich = buildPlan({ ...state, profile: { ...state.profile, weeklyBudget: 150 } });
    const poor = buildPlan({ ...state, profile: { ...state.profile, weeklyBudget: 40 } });
    expect(poor.shoppingList.total).toBeLessThan(rich.shoppingList.total);
  });
});
