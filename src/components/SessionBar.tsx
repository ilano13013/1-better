import { useEffect, useRef, useState } from 'react';
import type { Workout } from '../types';
import { useApp } from '../store/AppContext';
import { getExercise } from '../data/exercises';
import {
  durationNote, elapsedSec, findCompleted, formatChrono, isRestOver, restLeft, restProgress,
} from '../engine/session';
import { IconCheck, IconClock } from './icons';

/**
 * Récupération entre les séries, et fin de séance.
 *
 * Le minuteur retient **l'instant de fin**, pas un décompte. Un décompte
 * incrémenté se serait figé dès l'écran éteint — précisément le moment où l'on
 * pose son téléphone entre deux séries. Revenir sur l'application affiche donc
 * le temps réellement restant, ou zéro.
 *
 * Terminer une séance la valide pour la série, même sans aucune charge notée :
 * s'entraîner sans rien noter reste s'entraîner.
 */

const SIZE = 96;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function SessionBar({ workout, date }: { workout: Workout; date: string }) {
  const { state, dispatch, notify } = useApp();
  const [, tick] = useState(0);
  const rang = useRef(false);

  const timer = state.restTimer;
  const done = findCompleted(state.completedWorkouts, date, workout.id);
  const running = Boolean(timer?.endsAt);
  const left = restLeft(timer);
  const over = isRestOver(timer);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Fin du repos : vibration si l'appareil la propose, et un état visuel net.
  // Le son n'est pas garanti par les navigateurs, on ne compte donc pas dessus.
  useEffect(() => {
    if (!timer) { rang.current = false; return; }
    if (over && !rang.current) {
      rang.current = true;
      navigator.vibrate?.([120, 80, 120]);
    }
    if (!over) rang.current = false;
  }, [over, timer]);

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

  const spent = state.activeSession ? elapsedSec(state.activeSession) : 0;

  return (
    <div className="card session-bar" data-tour="session">
      {timer ? (
        <div className="rest">
          <div className={`rest-dial${over ? ' is-over' : ''}`}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="rest-track" strokeWidth={STROKE} />
              <circle
                cx={SIZE / 2} cy={SIZE / 2} r={R} className="rest-arc" strokeWidth={STROKE}
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * restProgress(timer)}
              />
            </svg>
            <span className="rest-value num">{formatChrono(left)}</span>
          </div>

          <div className="grow" style={{ minWidth: 0 }}>
            <div className="card-title" style={{ margin: 0 }}>
              {over ? 'Repos terminé' : running ? 'Récupération' : 'En pause'}
            </div>
            <div className="sm strong truncate">{getExercise(timer.exerciseId).name}</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
              {!over && (
                <button type="button" className="btn btn-sm"
                  onClick={() => dispatch({ type: running ? 'pauseRest' : 'resumeRest' })}>
                  {running ? 'Pause' : 'Reprendre'}
                </button>
              )}
              <button type="button" className="btn btn-sm"
                onClick={() => dispatch({ type: 'addRest', seconds: 30 })}>
                +30 s
              </button>
              <button type="button" className="btn btn-sm btn-ghost"
                onClick={() => dispatch({ type: 'stopRest' })}>
                {over ? 'Fermer' : 'Passer'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row-between">
          <div>
            <div className="card-title" style={{ margin: 0 }}>Récupération</div>
            <p className="sm muted" style={{ marginTop: 4 }}>
              Le minuteur part du temps de repos de l'exercice — le bouton
              <span className="strong"> Repos </span>
              sur chaque carte, ou automatiquement après une saisie.
            </p>
          </div>
          <span className="row xs dim" style={{ gap: 5, flex: 'none' }}>
            <IconClock size={13} />{spent > 0 ? formatChrono(spent) : `${workout.estimatedMin} min`}
          </span>
        </div>
      )}

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
