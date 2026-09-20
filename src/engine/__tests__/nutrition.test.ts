import { describe, expect, it } from 'vitest';
import { buildDaySlots, computeBMR, computeTargets, computeTDEE, kcalFromMacros } from '../nutrition';
import { DEMO_PROFILE } from '../../data/demo';
import type { Profile } from '../../types';

describe('moteur nutritionnel', () => {
  it('calcule le métabolisme de base (Mifflin-St Jeor)', () => {
    expect(computeBMR({ sex: 'homme', weightKg: 63, heightCm: 175, age: 26 })).toBe(1599);
    expect(computeBMR({ sex: 'femme', weightKg: 60, heightCm: 165, age: 30 })).toBe(1320);
  });

  it('intègre les séances dans la dépense journalière', () => {
    const sedentary: Profile = { ...DEMO_PROFILE, sessionsPerWeek: 0 };
    expect(computeTDEE(DEMO_PROFILE)).toBeGreaterThan(computeTDEE(sedentary));
  });

  it('produit des macros cohérentes avec l\'objectif calorique', () => {
    const t = computeTargets(DEMO_PROFILE);
    expect(t.kcal).toBeGreaterThan(2400);
    expect(t.kcal).toBeLessThan(2900);
    expect(Math.abs(kcalFromMacros(t) - t.kcal)).toBeLessThanOrEqual(12);
  });

  it('augmente les calories en prise de masse et les réduit en sèche', () => {
    const masse = computeTargets({ ...DEMO_PROFILE, goal: 'masse' });
    const seche = computeTargets({ ...DEMO_PROFILE, goal: 'seche' });
    const maintien = computeTargets({ ...DEMO_PROFILE, goal: 'maintien' });
    expect(masse.kcal).toBeGreaterThan(maintien.kcal);
    expect(seche.kcal).toBeLessThan(maintien.kcal);
    expect(seche.protein).toBeGreaterThan(masse.protein / 63 * 63 * 0.9);
  });

  it('est déterministe', () => {
    expect(computeTargets(DEMO_PROFILE)).toEqual(computeTargets({ ...DEMO_PROFILE }));
  });

  it('répartit les repas selon le nombre choisi', () => {
    const slots = buildDaySlots(4, true);
    expect(slots).toHaveLength(4);
    expect(slots[0].slot).toBe('petit_dejeuner');
    expect(slots.map((s) => s.ratio).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);

    expect(buildDaySlots(3, false).map((s) => s.slot)).toEqual(['dejeuner', 'collation', 'diner']);
    expect(buildDaySlots(2, false).map((s) => s.slot)).toEqual(['dejeuner', 'diner']);
    expect(buildDaySlots(6, true)).toHaveLength(6);
  });
});
