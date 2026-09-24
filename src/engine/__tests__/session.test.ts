import { describe, expect, it } from 'vitest';
import {
  durationMin, durationNote, elapsedSec, findCompleted, formatChrono, isRunning,
  pauseSession, resumeSession, sessionDateFor, startSession, validatedDates,
  type CompletedWorkout,
} from '../session';
import {
  addRest, isRestOver, pauseRest, restLeft, restProgress, resumeRest, startRest,
} from '../session';
import { computeStreak } from '../streak';
import type { DayIndex } from '../../types';

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


describe('récupération entre les séries', () => {
  /*
   * Le minuteur retient l'instant de FIN, pas un décompte. Un décompte
   * incrémenté se serait figé dès l'écran éteint — précisément le moment où
   * l'on pose son téléphone entre deux séries.
   */
  it('décompte depuis l\'instant de fin', () => {
    const r = startRest('squat_barre', 105, t('2026-09-24T18:00:00Z'));
    expect(restLeft(r, t('2026-09-24T18:00:00Z'))).toBe(105);
    expect(restLeft(r, t('2026-09-24T18:00:45Z'))).toBe(60);
    // Écran éteint une minute : au retour, le temps restant est juste.
    expect(restLeft(r, t('2026-09-24T18:01:45Z'))).toBe(0);
  });

  it('ne descend jamais sous zéro', () => {
    const r = startRest('squat_barre', 60, t('2026-09-24T18:00:00Z'));
    expect(restLeft(r, t('2026-09-24T18:10:00Z'))).toBe(0);
    expect(isRestOver(r, t('2026-09-24T18:10:00Z'))).toBe(true);
    expect(isRestOver(r, t('2026-09-24T18:00:30Z'))).toBe(false);
    expect(restLeft(null)).toBe(0);
  });

  it('fige le décompte en pause et le reprend là où il en était', () => {
    let r = startRest('squat_barre', 120, t('2026-09-24T18:00:00Z'));
    r = pauseRest(r, t('2026-09-24T18:00:30Z'));
    expect(restLeft(r, t('2026-09-24T18:05:00Z'))).toBe(90);   // la pause ne court pas
    r = resumeRest(r, t('2026-09-24T18:05:00Z'));
    expect(restLeft(r, t('2026-09-24T18:05:30Z'))).toBe(60);
  });

  it('allonge le repos sans faire déborder la jauge', () => {
    // `totalSec` suit l'ajout : sinon l'anneau afficherait plus que plein.
    let r = startRest('squat_barre', 60, t('2026-09-24T18:00:00Z'));
    r = addRest(r, 30, t('2026-09-24T18:00:10Z'));
    expect(restLeft(r, t('2026-09-24T18:00:10Z'))).toBe(80);
    expect(r.totalSec).toBe(90);
    expect(restProgress(r, t('2026-09-24T18:00:10Z'))).toBeCloseTo(10 / 90, 3);
  });

  it('peut être rallongé une fois terminé', () => {
    const fini = startRest('squat_barre', 30, t('2026-09-24T18:00:00Z'));
    const relance = addRest(fini, 30, t('2026-09-24T18:05:00Z'));
    expect(restLeft(relance, t('2026-09-24T18:05:00Z'))).toBe(30);
  });

  it('remplit l\'anneau de zéro à un, sans jamais sortir', () => {
    const r = startRest('squat_barre', 100, t('2026-09-24T18:00:00Z'));
    expect(restProgress(r, t('2026-09-24T18:00:00Z'))).toBe(0);
    expect(restProgress(r, t('2026-09-24T18:00:50Z'))).toBeCloseTo(0.5, 2);
    expect(restProgress(r, t('2026-09-24T18:09:00Z'))).toBe(1);
    expect(restProgress(null)).toBe(0);
  });
});

describe('date portée au crédit d\'une séance', () => {
  /*
   * Le défaut trouvé à l'usage : l'écran Training ouvre sur la PROCHAINE
   * séance, souvent à venir. Valider enregistrait alors une date future, que
   * la série — qui remonte le temps depuis aujourd'hui — n'atteignait jamais.
   * Le pourcentage ne bougeait pas.
   */
  it('porte à aujourd\'hui une séance faite en avance', () => {
    expect(sessionDateFor('2026-09-26', '2026-09-24')).toBe('2026-09-24');
  });

  it('laisse sa date à une séance déjà passée', () => {
    // Saisie rétroactive : elle est légitime, on ne la déplace pas.
    expect(sessionDateFor('2026-09-22', '2026-09-24')).toBe('2026-09-22');
  });

  it('ne touche à rien le jour même', () => {
    expect(sessionDateFor('2026-09-24', '2026-09-24')).toBe('2026-09-24');
  });

  it('fait bien avancer le cycle, bout en bout', () => {
    // Le cas signalé : on est mercredi, l'écran montre la séance de jeudi.
    const jours: DayIndex[] = [1, 3, 5];           // mardi, jeudi, samedi
    const today = '2026-09-23';                    // mercredi
    const date = sessionDateFor('2026-09-24', today);
    const dates = validatedDates([], [{ id: 'a', date, workoutId: 'w1', durationSec: 0 }]);
    expect(computeStreak(dates, jours, t('2026-09-23T20:00:00')).total).toBe(1);
  });
});

describe('une séance compte quel que soit le jour', () => {
  it('accorde son point à une séance décalée', () => {
    // Prévu mardi, jeudi, samedi ; fait le mercredi. S'entraîner un jour plus
    // tard reste s'entraîner : ne rien accorder aurait puni le décalage.
    const dates = validatedDates([], [{ id: 'a', date: '2026-09-23', workoutId: 'w1', durationSec: 0 }]);
    expect(computeStreak(dates, [1, 3, 5] as DayIndex[], t('2026-09-23T20:00:00')).total).toBe(1);
  });

  it('casse toujours sur une séance prévue et manquée', () => {
    // Le décalage est accordé, l'absence non : jeudi prévu, rien fait.
    const dates = ['2026-09-22', '2026-09-26'];    // mardi et samedi
    expect(computeStreak(dates, [1, 3, 5] as DayIndex[], t('2026-09-26T20:00:00')).total).toBe(1);
  });
});
