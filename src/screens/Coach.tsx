import { CoachProfile } from '../components/CoachCard';
import { COACH } from '../data/coach';

/** Onglet Coach : la même fiche que la feuille, accessible en permanence. */
export default function Coach() {
  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <div className="eyebrow">Méthode validée par</div>
          <h1>{COACH.name}</h1>
        </div>
      </div>
      <CoachProfile />
    </div>
  );
}
