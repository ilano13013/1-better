import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { getStore } from '../data/stores';
import { GOALS } from '../data/goals';
import { purchasableItems } from '../engine/shopping';
import { eur, num } from '../components/ui';
import { IconCheck } from '../components/icons';

/**
 * Écran de construction affiché à la sortie du questionnaire.
 *
 * Le moteur est déterministe et s'exécute en quelques dizaines de
 * millisecondes : ce rythme est donc délibéré, pas une attente technique. Il
 * sert à montrer l'enchaînement qui fait la valeur de l'application — objectif,
 * besoins, programme, repas, courses — en révélant les chiffres réellement
 * calculés plutôt qu'en faisant tourner un sablier.
 *
 * Chaque étape franchie vaut 0,2 %, pour un total de 1 % : c'est la promesse
 * du nom, la progression par petits incréments répétés.
 */

const STEP_MS = 480;
const FIRST_MS = 260;
const HOLD_MS = 900;

export default function BuildingWeek({ onDone }: { onDone: () => void }) {
  const { state, plan } = useApp();
  const [done, setDone] = useState(0);

  const steps = useMemo(() => {
    const store = getStore(state.profile.storeId);
    const meals = plan.mealPlan.days.reduce((s, d) => s + d.meals.length, 0);
    const recipes = new Set(plan.mealPlan.days.flatMap((d) => d.meals.map((m) => m.recipeId))).size;
    const products = purchasableItems(plan.shoppingList).length;
    return [
      { label: 'Profil analysé', value: GOALS[state.profile.goal].label },
      {
        label: 'Besoins énergétiques calculés',
        value: `${num(plan.targets.kcal)} kcal · ${plan.targets.protein} g de protéines`,
      },
      {
        label: 'Programme d\'entraînement construit',
        value: `${plan.workoutPlan.splitName} · ${plan.workoutPlan.workouts.length} séances`,
      },
      {
        label: 'Repas de la semaine sélectionnés',
        value: `${meals} repas · ${recipes} recettes`,
      },
      {
        label: 'Liste de courses établie',
        value: `${products} produits · ${eur(plan.shoppingList.total)} chez ${store.name}`,
      },
    ];
  }, [state.profile, plan]);

  useEffect(() => {
    // Un utilisateur qui a demandé moins d'animation ne doit pas attendre.
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDone(steps.length);
      const id = window.setTimeout(onDone, 250);
      return () => window.clearTimeout(id);
    }

    const timers = steps.map((_, i) =>
      window.setTimeout(() => setDone(i + 1), FIRST_MS + i * STEP_MS),
    );
    timers.push(window.setTimeout(onDone, FIRST_MS + steps.length * STEP_MS + HOLD_MS));
    return () => timers.forEach(window.clearTimeout);
  }, [steps.length, onDone]);

  // Calcul en dixièmes pour éviter la dérive du flottant (0,2 × 3 ≠ 0,6 exact),
  // puis la décimale est retirée quand le chiffre est rond : « 1 % », pas « 1,0 % ».
  const tenths = done * 2;
  const pct = tenths % 10 === 0
    ? String(tenths / 10)
    : (tenths / 10).toFixed(1).replace('.', ',');
  const complete = done >= steps.length;

  return (
    <div
      className="building"
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDone(); }}
      aria-label="Construction de ta semaine — toucher pour continuer"
    >
      <div className="building-inner">
        <div className="building-mark" aria-hidden="true">
          <div className={`building-pct num ${complete ? 'is-complete' : ''}`}>
            {pct}<span className="building-pct-sign"> %</span>
          </div>
          <div className="building-word">Better</div>
          <div className="building-rail">
            <i style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
        </div>

        <h1 className="building-title">Construction de ta semaine</h1>

        <ul className="building-steps">
          {steps.map((step, i) => {
            const state_ = i < done ? 'done' : i === done ? 'current' : 'todo';
            return (
              <li key={step.label} className={`building-step is-${state_}`}>
                <span className="building-tick">{i < done && <IconCheck size={11} />}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="building-step-label">{step.label}</span>
                  {i < done && <span className="building-step-value num">{step.value}</span>}
                </span>
                <span className="building-step-gain xs num">+0,2 %</span>
              </li>
            );
          })}
        </ul>

        <p className="building-hint xs dim">
          {complete ? 'Ta semaine est prête.' : 'Toucher pour passer'}
        </p>
      </div>
    </div>
  );
}
