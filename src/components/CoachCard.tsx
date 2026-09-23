import { useState } from 'react';
import { COACH, instagramUrl } from '../data/coach';
import { IconInstagram } from './icons';
import { Sheet } from './ui';

/**
 * Caution professionnelle.
 *
 * La carte annonce qui valide la méthode ; `CoachProfile` dit ce que cette
 * validation couvre, et ce qu'elle ne couvre pas. Les deux vont ensemble : une
 * caution sans périmètre laisserait croire que la nutrition l'est aussi.
 *
 * Le même contenu sert à la feuille — accessible depuis l'accueil, où il n'y a
 * pas encore de navigation — et à l'onglet Coach.
 */

/** Ouvre le compte dans un nouvel onglet ; sans `window.open`, rien ne bouge. */
function openInstagram() {
  window.open(instagramUrl(COACH.instagram), '_blank', 'noopener,noreferrer');
}

export function InstagramButton({ block = false }: { block?: boolean }) {
  return (
    <button type="button" className={`btn${block ? ' btn-block' : ''}`} onClick={openInstagram}>
      <IconInstagram /> @{COACH.instagram}
    </button>
  );
}

/** Fiche complète : portrait, identité, réseau, périmètre. */
export function CoachProfile() {
  return (
    <div className="stack">
      <img className="coach-portrait" src={COACH.photo} alt={COACH.name} />

      <div className="center">
        <div className="strong" style={{ fontSize: 17 }}>
          {COACH.role}{COACH.credential && `, ${COACH.credential}`}
        </div>
        <div className="sm dim">{COACH.age} ans</div>
      </div>

      <InstagramButton block />

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
  );
}

/**
 * Carte d'appel. `onOpen` mène à l'onglet Coach quand la navigation existe ;
 * sans lui — sur l'écran d'accueil — la fiche s'ouvre en feuille.
 */
export function CoachCard({ onOpen }: { onOpen?: () => void }) {
  const [sheet, setSheet] = useState(false);

  return (
    <>
      <button type="button" className="card card-flat coach-card"
        onClick={() => (onOpen ? onOpen() : setSheet(true))}>
        <img className="coach-photo" src={COACH.photo} alt={COACH.name}
          width={120} height={120} loading="lazy" />
        <span className="coach-text">
          <span className="card-title" style={{ margin: 0 }}>Méthode validée par</span>
          <span className="strong">{COACH.name}</span>
          <span className="xs dim">
            {COACH.age} ans · {COACH.role}
            {COACH.credential && ` · ${COACH.credential}`}
          </span>
          <span className="sm coach-cta">Ce que cela couvre</span>
        </span>
      </button>

      {!onOpen && (
        <Sheet open={sheet} onClose={() => setSheet(false)}
          title={<div className="strong">{COACH.name}</div>}>
          <CoachProfile />
        </Sheet>
      )}
    </>
  );
}
