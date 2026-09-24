import { useEffect, useState } from 'react';
import type { Workout } from '../types';
import { useApp } from '../store/AppContext';
import {
  durationNote, elapsedSec, findCompleted, formatChrono, isRunning,
} from '../engine/session';
import { IconCheck, IconClock } from './icons';

/**
 * Chronomètre de séance et bouton « séance terminée ».
 *
 * Le chronomètre affiché est **dérivé de l'horloge**, pas incrémenté : l'état
 * ne retient que l'instant de démarrage. La minuterie ci-dessous ne sert donc
 * qu'à rafraîchir l'affichage — si le navigateur la ralentit en arrière-plan,
 * ou si la page est rechargée, le temps lu reste juste.
 *
 * Terminer une séance la valide pour la série, même sans aucune charge notée :
 * s'entraîner sans rien noter reste s'entraîner.
 */
export function SessionBar({ workout, date }: { workout: Workout; date: string }) {
  const { state, dispatch, notify } = useApp();
  const [, tick] = useState(0);

  const session = state.activeSession;
  const mine = session?.workoutId === workout.id && session?.date === date;
  const done = findCompleted(state.completedWorkouts, date, workout.id);
  const running = mine && isRunning(session);

  // Une seconde suffit : l'affichage ne descend pas plus bas.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (done) {
    return (
      <div className="card card-ink session-bar" data-tour="session">
        <div className="row-between">
          <div>
            <div className="card-title" style={{ margin: 0 }}>Séance terminée</div>
            <div className="sm" style={{ marginTop: 4 }}>
              {durationNote(done.durationSec, workout.estimatedMin)}
            </div>
          </div>
          <button type="button" className="btn btn-sm"
            onClick={() => {
              dispatch({ type: 'uncompleteWorkout', id: done.id });
              notify('Séance rouverte');
            }}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  const seconds = mine ? elapsedSec(session) : 0;

  return (
    <div className="card session-bar" data-tour="session">
      <div className="row-between">
        <div className="row" style={{ gap: 12 }}>
          <span className={`chrono-dot${running ? ' is-running' : ''}`} aria-hidden="true" />
          <div>
            <div className="chrono num">{formatChrono(seconds)}</div>
            <div className="xs dim">
              {running ? 'en cours' : mine ? 'en pause' : `estimée ${workout.estimatedMin} min`}
            </div>
          </div>
        </div>

        {!mine ? (
          <button type="button" className="btn btn-sm"
            onClick={() => dispatch({ type: 'startChrono', workoutId: workout.id, date })}>
            <IconClock size={14} /> Démarrer
          </button>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-sm"
              onClick={() => dispatch({ type: running ? 'pauseChrono' : 'resumeChrono' })}>
              {running ? 'Pause' : 'Reprendre'}
            </button>
            <button type="button" className="btn btn-sm btn-ghost"
              onClick={() => dispatch({ type: 'stopChrono' })}>
              Remettre à zéro
            </button>
          </div>
        )}
      </div>

      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }}
        onClick={() => {
          dispatch({
            type: 'completeWorkout',
            workoutId: workout.id,
            date,
            estimatedMin: workout.estimatedMin,
          });
          notify('Séance validée — le cycle avance');
        }}>
        <IconCheck size={14} /> Séance terminée
      </button>
      <p className="xs dim center" style={{ marginTop: 8 }}>
        Valide la journée pour ton cycle, même sans charge enregistrée.
      </p>
    </div>
  );
}
