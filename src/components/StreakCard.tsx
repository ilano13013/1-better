import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  MILESTONES, computeStreak, cycleReward, formatPercent, nextMilestone, type Streak,
} from '../engine/streak';
import { validatedDates } from '../engine/session';
import { Sheet } from './ui';

/**
 * Le cycle 1 %, affiché comme un niveau.
 *
 * L'anneau EST la barre de progression : un arc qui se referme à mesure que les
 * séances s'accumulent, le pourcentage au centre et le numéro de cycle en
 * dessous. Posé en haut à droite, il se lit à l'ouverture sans rien déplacer.
 *
 * La feuille explique la règle, parce qu'une série dont on ne comprend pas ce
 * qui la casse est une série qu'on abandonne à la première surprise.
 */

const SIZE = 56;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function StreakRing() {
  const { state, plan } = useApp();
  const [open, setOpen] = useState(false);

  const streak = computeStreak(
    validatedDates(state.performances, state.completedWorkouts),
    plan.workoutPlan.workouts.map((w) => w.day),
    new Date(),
    state.startDate,
  );

  return (
    <>
      <button
        type="button"
        className={`level${streak.completed ? ' is-complete' : ''}`}
        onClick={() => setOpen(true)}
        data-tour="cycle"
        aria-label={`Cycle 1 % : ${streak.percent} %. Voir la règle.`}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="level-ring">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="level-track" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R} className="level-arc" strokeWidth={STROKE}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - streak.percent / 100)}
          />
        </svg>
        <span className="level-value num">{formatPercent(streak.percent)}</span>
        <span className="level-cycle">
          {streak.cycles > 0 ? `C${streak.cycles + (streak.completed ? 0 : 1)}` : '%'}
        </span>
      </button>

      <StreakSheet streak={streak} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function StreakSheet({
  streak, open, onClose,
}: { streak: Streak; open: boolean; onClose: () => void }) {
  const next = nextMilestone(streak.percent);

  return (
    <Sheet open={open} onClose={onClose} title={<div className="strong">Le cycle 1 %</div>}>
      <div className="stack">
        <div className="card card-ink">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>
                {streak.cycles > 0 ? `Cycle ${streak.cycles + (streak.completed ? 0 : 1)}` : 'Cycle 1'}
              </div>
              <div className="display num" style={{ fontSize: 44, marginTop: 4 }}>
                {formatPercent(streak.percent)}<span style={{ fontSize: '.42em' }}>%</span>
              </div>
            </div>
            {streak.total > 0 && (
              <div className="center">
                <div className="metric num">×{streak.multiplier.toFixed(2).replace('.', ',')}</div>
                <div className="xs">composé</div>
              </div>
            )}
          </div>
          <p className="sm" style={{ marginTop: 12 }}>
            {streak.completed
              ? cycleReward(streak)
              : streak.total === 0
                ? streak.dueToday
                  ? 'Une séance est prévue aujourd’hui. Elle lance le cycle.'
                  : 'Valide une séance pour lancer le cycle.'
                : streak.dueToday
                  ? `Séance prévue aujourd’hui — elle te mène à ${streak.percent + 1} %.`
                  : next
                    ? `Prochain palier : ${next.label}, à ${next.at} %.`
                    : 'Continue.'}
          </p>
        </div>

        <div>
          <div className="card-title">La règle</div>
          <ul className="move-list">
            <li>
              <span className="move-mark" aria-hidden="true">+1</span>
              <span className="sm">Une séance validée ajoute un point de pourcentage.</span>
            </li>
            <li>
              <span className="move-mark" aria-hidden="true">=</span>
              <span className="sm">
                Un jour de repos ne compte pas et ne casse rien : il est prévu.
              </span>
            </li>
            <li>
              <span className="move-mark move-mark-alert" aria-hidden="true">0</span>
              <span className="sm">
                Une séance prévue et non faite remet le compteur à zéro. La journée
                en cours ne casse jamais rien tant qu'elle n'est pas finie.
              </span>
            </li>
          </ul>
        </div>

        <div>
          <div className="card-title">Les paliers</div>
          <ul className="move-list">
            {MILESTONES.map((m) => (
              <li key={m.at}>
                <span className={`move-mark${streak.percent >= m.at ? '' : ' move-mark-todo'}`}
                  aria-hidden="true">
                  {streak.percent >= m.at ? '✓' : m.at}
                </span>
                <span className={`sm${streak.percent >= m.at ? '' : ' dim'}`}>{m.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card card-flat">
          <div className="card-title">Pourquoi 100 % ne veut pas dire deux fois mieux</div>
          <p className="sm muted">
            Un pour cent par jour ne s'additionne pas, il se compose.
            1,01<sup>100</sup> vaut 2,70 — pas 2. Et le cycle suivant ne repart
            pas de zéro : à deux cents séances, le facteur est de 7,32.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
