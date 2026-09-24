import { useState, type ReactNode } from 'react';
import {
  PERIOD_LABELS, PLAN_LABELS, PLAN_TABLE, PRICES, TRIAL_DAYS, daysLeft, effectivePlan,
  inTrial, isSubscriptionActive, monthlyEquivalent, renewalDate, trialAvailable,
  trialEndDate, yearlySavings, yearlySavingsPct,
  type BillingPeriod,
} from '../engine/entitlements';
import type { LegalDocId } from '../engine/legal';
import { useApp } from '../store/AppContext';
import { Confirm } from './Confirm';
import { LegalSheet } from './Legal';
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

/**
 * Une formule.
 *
 * Le mensuel met l'essai en avant *à la place* du prix quand il est encore
 * disponible : annoncer « 4,99 € » en gros au-dessus de « 7 jours gratuits »
 * ferait de l'offre une petite ligne. Le prix qui suit l'essai reste écrit
 * juste en dessous, jamais renvoyé aux conditions générales.
 */
function PriceOption({
  period, selected, trial, onSelect,
}: { period: BillingPeriod; selected: boolean; trial: boolean; onSelect: () => void }) {
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
        {trial && <PlusBadge>{TRIAL_DAYS} jours offerts</PlusBadge>}
      </span>
      {trial ? (
        <span className="price-amount num">
          {TRIAL_DAYS} jours
          <span className="price-unit">gratuits</span>
        </span>
      ) : (
        <span className="price-amount num">
          {price(PRICES[period])}
          <span className="price-unit">{yearly ? '/ an' : '/ mois'}</span>
        </span>
      )}
      <span className="xs dim">
        {trial
          ? `puis ${price(PRICES.monthly)} / mois — sans engagement`
          : yearly
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
  const [legal, setLegal] = useState<LegalDocId | null>(null);
  const [confirming, setConfirming] = useState(false);
  const active = effectivePlan(state);
  const sub = state.subscription;
  const today = new Date().toISOString().slice(0, 10);

  /* L'essai suit la formule sélectionnée : c'est le moteur qui dit s'il reste
     ouvert, jamais l'écran. */
  const trial = trialAvailable(state, period);
  const trialEnd = trialEndDate(today);
  const running = inTrial(sub);

  const subscribe = () => {
    dispatch({ type: 'subscribe', period });
    notify(trial
      ? `Essai de ${TRIAL_DAYS} jours ouvert`
      : `1% Better+ activé — ${PERIOD_LABELS[period].toLowerCase()}`);
    onClose();
  };

  const cancel = () => {
    dispatch({ type: 'unsubscribe' });
    notify(running ? 'Essai arrêté' : 'Retour à la formule gratuite');
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
              <div className="card-title" style={{ margin: 0 }}>
                {running ? 'Essai gratuit en cours' : 'Abonnement en cours'}
              </div>
              <div className="metric num" style={{ marginTop: 4 }}>
                {running ? '0,00 €' : price(PRICES[sub.period])}
                <span className="sm"> {running ? 'aujourd\u2019hui' : sub.period === 'yearly' ? '/ an' : '/ mois'}</span>
              </div>
              <div className="sm" style={{ marginTop: 8 }}>
                {running ? 'Essai jusqu\u2019au' : 'Échéance le'} {day(sub.renewsAt)} — {daysLeft(sub)} jour
                {daysLeft(sub) > 1 ? 's' : ''} restant{daysLeft(sub) > 1 ? 's' : ''}.
              </div>
              {running && (
                <div className="sm" style={{ marginTop: 6 }}>
                  Ensuite {price(PRICES.monthly)} / mois. Arrête avant cette date
                  et rien n'est dû.
                </div>
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-block"
              onClick={() => setConfirming(true)}>
              {running ? "Arrêter l'essai" : 'Revenir à la formule gratuite'}
            </button>

            {/* La résiliation doit être aussi simple que la souscription
                (C. conso., art. L224-45-1) : une confirmation, au même
                endroit, et rien de plus. */}
            <Confirm
              open={confirming}
              title={running ? "Arrêter l'essai" : 'Revenir à la formule gratuite'}
              confirmLabel={running ? 'Arrêter maintenant' : 'Revenir au gratuit'}
              cancelLabel={running ? "Continuer l'essai" : "Garder l'abonnement"}
              onConfirm={cancel}
              onClose={() => setConfirming(false)}
            >
              {running
                ? `Rien n'a été prélevé et rien ne le sera. Le plan repasse
                   à 3 jours de repas et 3 séances par semaine, et l'essai ne
                   pourra pas être rouvert.`
                : `Le plan repasse à 3 jours de repas et 3 séances par semaine.
                   Tes données, elles, restent intactes.`}
            </Confirm>
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
                trial={trialAvailable(state, 'monthly')}
                onSelect={() => setPeriod('monthly')} />
              <PriceOption period="yearly" selected={period === 'yearly'}
                trial={false}
                onSelect={() => setPeriod('yearly')} />
            </div>

            {/* Récapitulatif avant engagement : durée, prix, échéance et
                résiliation, sur le même écran que le bouton. Les boutiques
                d'applications l'exigent, et c'est de toute façon ce qu'on
                voudrait lire avant d'appuyer. */}
            <div className="card card-flat">
              <div className="card-title" style={{ margin: 0 }}>Ce que tu engages</div>
              <ul className="bullets sm" style={{ marginTop: 8 }}>
                {trial ? (
                  <>
                    <li>{TRIAL_DAYS} jours gratuits, jusqu'au {day(trialEnd)}.</li>
                    <li>Puis {price(PRICES.monthly)} par mois, le premier
                      prélèvement au {day(trialEnd)}.</li>
                    <li>Arrêt possible à tout moment avant cette date : rien
                      n'est prélevé.</li>
                    <li>Un seul essai par appareil.</li>
                  </>
                ) : (
                  <>
                    <li>{price(PRICES[period])} TTC{period === 'yearly' ? ' par an' : ' par mois'}, prélevés à la
                      souscription.</li>
                    <li>Période jusqu'au {day(renewalDate(today, period))}.</li>
                    <li>Sans engagement : la résiliation prend effet à la fin de
                      la période en cours.</li>
                    {!trialAvailable(state, 'monthly') && state.trialUsed && period === 'monthly' && (
                      <li>Essai gratuit déjà utilisé sur cet appareil.</li>
                    )}
                  </>
                )}
              </ul>
            </div>

            <div className="card card-notice">
              <div className="card-title">Aucun paiement n'est encaissé</div>
              <p className="sm muted">
                Il n'y a pas de serveur, donc ni encaissement ni vérification
                d'abonnement : le bouton active la formule sur cet appareil
                jusqu'au {day(trial ? trialEnd : renewalDate(today, period))},
                sans rien débiter, et rien ne se reconduit — la formule gratuite
                revient d'elle-même à l'échéance. Les tarifs ci-dessus sont
                l'offre prévue, pas une transaction.
              </p>
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={subscribe}>
              {trial
                ? `Commencer l'essai — ${TRIAL_DAYS} jours gratuits`
                : `Activer — ${price(PRICES[period])}${period === 'yearly' ? ' / an' : ' / mois'}`}
            </button>
            {trial && (
              <p className="xs dim center">
                Puis {price(PRICES.monthly)} / mois à partir du {day(trialEnd)}.
              </p>
            )}
            <p className="xs dim center">
              Prix TTC. En souscrivant, tu acceptes les{' '}
              <button type="button" className="link" onClick={() => setLegal('cgv')}>
                conditions de vente
              </button>{' '}
              et la{' '}
              <button type="button" className="link" onClick={() => setLegal('confidentialite')}>
                politique de confidentialité
              </button>.
            </p>
          </>
        )}

        <div className="divider" />
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="link xs" onClick={() => setLegal('cgv')}>
            Conditions de vente
          </button>
          <button type="button" className="link xs" onClick={() => setLegal('confidentialite')}>
            Confidentialité
          </button>
          <button type="button" className="link xs" onClick={() => setLegal('mentions')}>
            Mentions légales
          </button>
        </div>

        <p className="xs dim center">Formule active : {PLAN_LABELS[active]}</p>

        <LegalSheet open={legal !== null} docId={legal} onClose={() => setLegal(null)} />
      </div>
    </Sheet>
  );
}
