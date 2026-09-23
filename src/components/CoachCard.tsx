import { useState } from 'react';
import { COACH } from '../data/coach';
import { Sheet } from './ui';

/**
 * Caution professionnelle.
 *
 * La carte annonce qui valide la méthode ; la fiche dit ce que cette validation
 * couvre, et ce qu'elle ne couvre pas. Les deux vont ensemble : une caution
 * sans périmètre laisserait croire que la nutrition l'est aussi.
 */
export function CoachCard({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="card card-flat coach-card" onClick={() => setOpen(true)}>
        <img className="coach-photo" src={COACH.photo} alt={COACH.name}
          width={112} height={112} loading="lazy" />
        <span className="coach-text">
          <span className="card-title" style={{ margin: 0 }}>Méthode validée par</span>
          <span className="strong">{COACH.name}</span>
          <span className="xs dim">
            {COACH.age} ans · {COACH.role}
            {COACH.credential && ` · ${COACH.credential}`}
          </span>
          {!compact && <span className="sm coach-cta">Ce que cela couvre</span>}
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}
        title={<div className="strong">{COACH.name}</div>}>
        <div className="stack">
          <img className="coach-portrait" src={COACH.photo} alt={COACH.name} />

          <div>
            <div className="strong">{COACH.role}{COACH.credential && `, ${COACH.credential}`}</div>
            <div className="sm dim">{COACH.age} ans</div>
          </div>

          <div>
            <div className="card-title">Ce que sa validation couvre</div>
            <ul className="move-list">
              {COACH.scope.map((line) => (
                <li key={line}>
                  <span className="move-mark" aria-hidden="true">✓</span>
                  <span className="sm">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card card-notice">
            <div className="card-title">Ce qu'elle ne couvre pas</div>
            <p className="sm muted">{COACH.outOfScope}</p>
          </div>
        </div>
      </Sheet>
    </>
  );
}
