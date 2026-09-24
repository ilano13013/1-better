import { describe, expect, it } from 'vitest';
import {
  durationMin, durationNote, elapsedSec, findCompleted, formatChrono, isRunning,
  pauseSession, resumeSession, startSession, validatedDates,
  type CompletedWorkout,
} from '../session';
import { computeStreak } from '../streak';

const t = (iso: string) => new Date(iso);

describe('chronomètre de séance', () => {
  /*
   * Le chronomètre retient QUAND il a démarré, il ne compte pas. Un compteur
   * incrémenté dérive dès que l'onglet passe en arrière-plan et repart de zéro
   * au rechargement ; le temps lu ici se déduit de l'horloge.
   */
  it('déduit le temps écoulé de l\'horloge', () => {
    const s = startSession('w1', '2026-09-24', t('2026-09-24T18:00:00Z'));
    expect(elapsedSec(s, t('2026-09-24T18:00:00Z'))).toBe(0);
    expect(elapsedSec(s, t('2026-09-24T18:12:34Z'))).toBe(754);
    // Un rendu sauté ne perd rien : une heure plus tard, une heure est comptée.
    expect(elapsedSec(s, t('2026-09-24T19:00:00Z'))).toBe(3600);
  });

  it('fige le temps en pause et le reprend sans le perdre', () => {
    let s = startSession('w1', '2026-09-24', t('2026-09-24T18:00:00Z'));
    s = pauseSession(s, t('2026-09-24T18:10:00Z'));
    expect(isRunning(s)).toBe(false);
    expect(elapsedSec(s, t('2026-09-24T18:40:00Z'))).toBe(600);   // la pause ne court pas

    s = resumeSession(s, t('2026-09-24T18:40:00Z'));
    expect(isRunning(s)).toBe(true);
    expect(elapsedSec(s, t('2026-09-24T18:45:00Z'))).toBe(900);   // 10 min + 5 min
  });

  it('ignore une pause ou une reprise sans effet', () => {
    const s = startSession('w1', '2026-09-24', t('2026-09-24T18:00:00Z'));
    expect(resumeSession(s, t('2026-09-24T18:05:00Z'))).toBe(s);  // déjà en marche
    const p = pauseSession(s, t('2026-09-24T18:05:00Z'));
    expect(pauseSession(p, t('2026-09-24T18:09:00Z'))).toBe(p);   // déjà en pause
  });

  it('ne recule jamais si l\'horloge recule', () => {
    // Changement d'heure ou correction réseau : le chronomètre ne doit pas
    // afficher un temps négatif ni redescendre.
    const s = startSession('w1', '2026-09-24', t('2026-09-24T18:00:00Z'));
    expect(elapsedSec(s, t('2026-09-24T17:00:00Z'))).toBe(0);
    expect(elapsedSec(null)).toBe(0);
  });

  it('écrit la durée comme un chronomètre', () => {
    expect(formatChrono(0)).toBe('0:00');
    expect(formatChrono(9)).toBe('0:09');
    expect(formatChrono(754)).toBe('12:34');
    expect(formatChrono(3723)).toBe('1:02:03');
    expect(formatChrono(-5)).toBe('0:00');
  });

  it('arrondit la durée sans jamais annoncer zéro minute', () => {
    expect(durationMin(0)).toBe(1);
    expect(durationMin(100)).toBe(2);
    expect(durationMin(2700)).toBe(45);
  });

  it('compare la durée réelle à l\'estimation', () => {
    expect(durationNote(2700, 45)).toContain('conforme');
    expect(durationNote(3600, 45)).toContain('15 de plus');
    expect(durationNote(1800, 45)).toContain('15 de moins');
    // Sans chronomètre, on n'invente pas une durée.
    expect(durationNote(0, 45)).toBe('Estimée à 45 min.');
  });
});

describe('séance terminée', () => {
  const done = (date: string, workoutId: string): CompletedWorkout =>
    ({ id: `${date}-${workoutId}`, date, workoutId, durationSec: 0 });

  it('retrouve une séance déjà validée, ce jour-là et pas un autre', () => {
    const logs = [done('2026-09-24', 'w1')];
    expect(findCompleted(logs, '2026-09-24', 'w1')).not.toBeNull();
    expect(findCompleted(logs, '2026-09-24', 'w2')).toBeNull();
    expect(findCompleted(logs, '2026-09-25', 'w1')).toBeNull();
  });

  it('valide la journée sans aucune charge enregistrée', () => {
    // S'entraîner sans rien noter reste s'entraîner : fabriquer des
    // performances vides aurait pollué l'historique et faussé les records.
    const jours = [3] as const;   // jeudi
    const sansRien = computeStreak([], [...jours], t('2026-09-24T20:00:00'));
    expect(sansRien.total).toBe(0);

    const dates = validatedDates([], [done('2026-09-24', 'w1')]);
    expect(computeStreak(dates, [...jours], t('2026-09-24T20:00:00')).total).toBe(1);
  });

  it('ne compte pas deux fois le même jour', () => {
    // Une charge notée ET une séance déclarée terminée : un seul point.
    const dates = validatedDates(
      [{ date: '2026-09-24' }],
      [done('2026-09-24', 'w1')],
    );
    expect(dates).toEqual(['2026-09-24']);
  });
});
