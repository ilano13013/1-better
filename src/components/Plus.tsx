import { useState, type ReactNode } from 'react';
import {
  PERIOD_LABELS, PLAN_LABELS, PLAN_TABLE, PRICES, daysLeft, effectivePlan,
  isSubscriptionActive, monthlyEquivalent, renewalDate, yearlySavings, yearlySavingsPct,
  type BillingPeriod,
} from '../engine/entitlements';
import { useApp } from '../store/AppContext';
import { Sheet, day, eur } from './ui';

/**
 * Formules — présentation, tarifs et verrous.
 *
 * Un verrou n'est jamais un mur muet : il dit ce qu'il retient et ouvre le
 * comparatif. Et comme les limites sont appliquées dans les moteurs, ce que
 * l'écran cache n'a pas été calculé.
 */

/** Les centimes des tarifs deviennent des euros pour l'affichage. */
const price = (cents: number) => eur(cents / 100);

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

function PriceOption({
  period, selected, onSelect,
}: { period: BillingPeriod; selected: boolean; onSelect: () => void }) {
  const yearly = period === 'yearly';
  return (
    <button
      type="button"
      className="price-option"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="price-head">
        <span className="strong">{PERIOD_LABELS[period]}</span>
        {yearly && <PlusBadge>−{yearlySavingsPct()} %</PlusBadge>}
      </span>
      <span className="price-amount num">
        {price(PRICES[period])}
        <span className="price-unit">{yearly ? '/ an' : '/ mois'}</span>
      </span>
      <span className="xs dim">
        {yearly
          ? `${price(monthlyEquivalent('yearly'))} par mois — ${price(yearlySavings())} économisés`
          : 'Sans engagement'}
      </span>
    </button>
  );
}

/** Comparatif des deux formules, tarifs, et souscription. */
export function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, notify } = useApp();
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const active = effectivePlan(state);
  const sub = state.subscription;

  const subscribe = () => {
    dispatch({ type: 'subscribe', period });
    notify(`1% Better+ activé — ${PERIOD_LABELS[period].toLowerCase()}`);
    onClose();
  };

  const cancel = () => {
    if (!window.confirm('Revenir à la formule gratuite ? Le plan repasse à 3 jours et 3 séances.')) return;
    dispatch({ type: 'unsubscribe' });
    notify('Retour à la formule gratuite');
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

        {active === 'plus' && sub ? (
          <>
            <div className="card card-ink">
              <div className="card-title" style={{ margin: 0 }}>Abonnement en cours</div>
              <div className="metric num" style={{ marginTop: 4 }}>
                {price(PRICES[sub.period])}
                <span className="sm"> {sub.period === 'yearly' ? '/ an' : '/ mois'}</span>
              </div>
              <div className="sm" style={{ marginTop: 8 }}>
                Échéance le {day(sub.renewsAt)} — {daysLeft(sub)} jour
                {daysLeft(sub) > 1 ? 's' : ''} restant{daysLeft(sub) > 1 ? 's' : ''}.
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-block" onClick={cancel}>
              Revenir à la formule gratuite
            </button>
          </>
        ) : (
          <>
            {state.plan === 'plus' && !isSubscriptionActive(sub) && (
              <div className="card card-alert">
                <p className="sm notice">
                  Ton abonnement est arrivé à échéance : la formule gratuite
                  s'applique à nouveau.
                </p>
              </div>
            )}

            <div className="card-title" style={{ margin: 0 }}>1% Better+</div>
            <div className="price-grid">
              <PriceOption period="monthly" selected={period === 'monthly'}
                onSelect={() => setPeriod('monthly')} />
              <PriceOption period="yearly" selected={period === 'yearly'}
                onSelect={() => setPeriod('yearly')} />
            </div>

            <div className="card card-notice">
              <div className="card-title">Aucun paiement n'est encaissé</div>
              <p className="sm muted">
                Il n'y a pas de serveur, donc ni encaissement ni vérification
                d'abonnement : le bouton active la formule sur cet appareil
                jusqu'au {day(renewalDate(new Date().toISOString().slice(0, 10), period))},
                sans rien débiter. Les tarifs ci-dessus sont l'offre prévue, pas
                une transaction.
              </p>
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={subscribe}>
              Activer — {price(PRICES[period])}{period === 'yearly' ? ' / an' : ' / mois'}
            </button>
            <p className="xs dim center">
              Prix TTC annoncés. Les conditions de vente restent à écrire avec le
              prestataire de paiement.
            </p>
          </>
        )}

        <p className="xs dim center">Formule active : {PLAN_LABELS[active]}</p>
      </div>
    </Sheet>
  );
}
