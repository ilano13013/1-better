import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  MILESTONES, computeStreak, cycleReward, formatPercent, nextMilestone,
} from '../engine/streak';
import { Sheet } from './ui';

/**
 * Le cycle 1 %.
 *
 * Une séance validée vaut un point. Cent points font un cycle. La carte se lit
 * d'un coup d'œil à l'ouverture de l'application ; la feuille explique la règle
 * — parce qu'une série dont on ne comprend pas ce qui la casse est une série
 * qu'on abandonne à la première surprise.
 */
export function StreakCard() {
  const { state, plan } = useApp();
  const [open, setOpen] = useState(false);

  const streak = computeStreak(
    state.performances,
    plan.workoutPlan.workouts.map((w) => w.day),
    new Date(),
    state.startDate,
  );
  const next = nextMilestone(streak.percent);

  return (
    <>
      <button type="button" className="card card-ink streak-card" onClick={() => setOpen(true)}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>
              {streak.cycles > 0 ? `Cycle ${streak.cycles + (streak.completed ? 0 : 1)}` : 'Le cycle 1 %'}
            </div>
            <div className="streak-pct num">
              {formatPercent(streak.percent)}<span className="streak-sign">%</span>
            </div>
          </div>
          {streak.total > 0 && (
            <div className="center">
              <div className="sm strong num">×{streak.multiplier.toFixed(2).replace('.', ',')}</div>
              <div className="xs">composé</div>
            </div>
          )}
        </div>

        <div className="streak-rail" style={{ marginTop: 14 }}>
          <i style={{ width: `${streak.percent}%` }} />
        </div>

        <div className="sm" style={{ marginTop: 10, textAlign: 'left' }}>
          {streak.completed
            ? 'Cycle bouclé. Appuie pour voir ce que ça vaut.'
            : streak.total === 0
              ? streak.dueToday
                ? 'Une séance est prévue aujourd’hui. Elle lance le cycle.'
                : 'Valide une séance pour lancer le cycle.'
              : streak.dueToday
                ? `Séance prévue aujourd’hui — elle te mène à ${streak.percent + 1} %.`
                : next
                  ? `Prochain palier : ${next.label}, à ${next.at} %.`
                  : 'Continue.'}
        </div>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}
        title={<div className="strong">Le cycle 1 %</div>}>
        <div className="stack">
          {streak.completed && (
            <div className="card card-ink">
              <div className="card-title" style={{ margin: 0 }}>Cycle {streak.cycles} bouclé</div>
              <div className="display num" style={{ fontSize: 40, marginTop: 6 }}>
                ×{streak.multiplier.toFixed(2).replace('.', ',')}
              </div>
              <p className="sm" style={{ marginTop: 10 }}>{cycleReward(streak)}</p>
            </div>
          )}

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
    </>
  );
}
