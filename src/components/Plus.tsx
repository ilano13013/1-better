import type { ReactNode } from 'react';
import { PLAN_TABLE, PLAN_LABELS, type Plan } from '../engine/entitlements';
import { useApp } from '../store/AppContext';
import { Sheet } from './ui';

/**
 * Formules — présentation et verrous.
 *
 * Un verrou n'est jamais un mur muet : il dit ce qu'il retient et ouvre le
 * comparatif. Et comme les limites sont appliquées dans les moteurs, ce que
 * l'écran cache n'a pas été calculé.
 */

export function PlusBadge({ children = '1% Better+' }: { children?: ReactNode }) {
  return <span className="plus-badge">{children}</span>;
}

/** Bloc à la place d'une fonction réservée. */
export function PlusLock({
  title, hint, onOpen,
}: { title: string; hint?: string; onOpen: () => void }) {
  return (
    <button type="button" className="card card-flat plus-lock" onClick={onOpen}>
      <PlusBadge />
      <span className="strong">{title}</span>
      {hint && <span className="sm dim">{hint}</span>}
      <span className="sm plus-lock-cta">Voir les formules</span>
    </button>
  );
}

function Mark({ value }: { value: string }) {
  if (value === 'oui') return <span className="plan-yes" aria-label="inclus">✓</span>;
  if (value === 'non') return <span className="plan-no" aria-label="non inclus">—</span>;
  return <span className="plan-value">{value}</span>;
}

/** Comparatif des deux formules, et changement de formule. */
export function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, notify } = useApp();
  const current = state.plan;

  const choose = (plan: Plan) => {
    dispatch({ type: 'setPlan', plan });
    notify(plan === 'plus' ? '1% Better+ activé' : 'Retour à la formule gratuite');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={<div className="strong">Formules</div>}>
      <div className="stack">
        <table className="plan-table">
          <thead>
            <tr>
              <th>Fonction</th>
              <th>Gratuit</th>
              <th>Better+</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_TABLE.map((f) => (
              <tr key={f.label} className={f.planned ? 'is-planned' : undefined}>
                <th scope="row">
                  {f.label}
                  {f.planned && <span className="plan-soon">à venir</span>}
                </th>
                <td><Mark value={f.free} /></td>
                <td><Mark value={f.plus} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="xs dim">
          Les lignes « à venir » décrivent des fonctions qui ne sont pas encore
          construites : elles ne sont bridées ni dans un cas, ni dans l'autre.
        </p>

        <div className="divider" />

        <div className="card card-notice">
          <div className="card-title">Aucun paiement n'est branché</div>
          <p className="sm muted">
            Il n'y a pas de serveur, donc ni encaissement ni vérification
            d'abonnement : le bouton ci-dessous bascule simplement la formule sur
            cet appareil. C'est de quoi essayer et développer, pas de quoi
            vendre.
          </p>
        </div>

        {current === 'free' ? (
          <button type="button" className="btn btn-primary btn-block" onClick={() => choose('plus')}>
            Activer 1% Better+
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => choose('free')}>
            Revenir à la formule gratuite
          </button>
        )}
        <p className="xs dim center">Formule active : {PLAN_LABELS[current]}</p>
      </div>
    </Sheet>
  );
}
