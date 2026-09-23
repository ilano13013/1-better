import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { dayPlanFor } from '../engine/mealPlan';
import { entriesForDay, intakeTotals, isMealLogged } from '../engine/intake';
import { isoForDay, todayIndex } from '../store/state';
import { GOALS } from '../data/goals';
import { getStore } from '../data/stores';
import { getRecipe } from '../data/recipes';
import { GYM_BY_ID } from '../data/gyms';
import { SLOT_LABELS } from '../engine/nutrition';
import { workoutForDay } from '../engine/planner';
import { DAY_NAMES } from '../engine/training';
import { purchasableItems } from '../engine/shopping';
import { latestWeight, weeklyTrendPct } from '../engine/weight';
import { isCheckInDue } from '../engine/checkin';
import { sessionCount, weekStreak } from '../engine/gamification';
import { Bar, Card, Ring, eur, kg, num, type BarTone } from '../components/ui';
import { IconCart, IconChevron, IconClock, IconFlame, IconMedal, IconRest, IconWallet } from '../components/icons';
import { StoreMark } from '../components/BrandMark';
import { RecipeThumb } from '../components/RecipePhoto';
import type { Screen } from '../App';

/**
 * Dashboard : ce que l'utilisateur doit savoir en ouvrant l'application —
 * quoi manger, quoi acheter, combien dépenser, quoi faire à la salle.
 */
export default function Dashboard({ go }: { go: (s: Screen) => void }) {
  const { state, plan } = useApp();
  const today = todayIndex();
  const day = dayPlanFor(plan.mealPlan, today);
  const workout = workoutForDay(plan.workoutPlan, today);
  const goal = GOALS[state.profile.goal];
  const store = getStore(state.profile.storeId);

  const weight = latestWeight(state.weightEntries, state.profile.weightKg);
  const trend = weeklyTrendPct(state.weightEntries);

  const spent = useMemo(() => {
    const items = purchasableItems(plan.shoppingList);
    const checked = new Set(state.checkedItems);
    return items.filter((i) => checked.has(i.id)).reduce((s, i) => s + i.totalPrice, 0);
  }, [plan.shoppingList, state.checkedItems]);

  const budget = state.profile.weeklyBudget;
  const cart = plan.shoppingList.total;
  const overBudget = cart - budget;

  /*
   * « Consommé » vient du journal, plus d'une estimation par l'heure. L'ancien
   * calcul faisait monter les calories de quelqu'un qui avait sauté un repas ;
   * une journée non pointée affiche désormais zéro, ce qui est la vérité.
   */
  const meals = day?.meals ?? [];
  const logged = entriesForDay(state.intake, isoForDay(today));
  const consumed = intakeTotals(logged);
  const eaten = consumed.kcal;
  const eatenProtein = consumed.protein;
  // Prochain repas : le premier du plan qui n'a pas encore été pointé.
  const nextMeal = meals.find(
    (m) => !isMealLogged(state.intake, isoForDay(today), m.slot, m.recipeId),
  ) ?? null;

  const nextWorkout = useMemo(() => {
    const upcoming = plan.workoutPlan.workouts.find((w) => w.day >= today);
    return upcoming ?? plan.workoutPlan.workouts[0] ?? null;
  }, [plan.workoutPlan, today]);

  const sessions = sessionCount(state.performances);
  const streak = weekStreak(state.checkIns, state.profile.sessionsPerWeek);

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <div className="eyebrow">{DAY_NAMES[today]}</div>
          <h1>Bonjour{state.profile.firstName ? ` ${state.profile.firstName}` : ''} 👋</h1>
        </div>
        {streak > 0 && (
          <span className="badge badge-ink"><IconMedal size={13} /> {streak} sem.</span>
        )}
      </div>

      <div className="stack">
        {/* Nutrition du jour */}
        <Card onClick={() => go('nutrition')}>
          <div className="row" style={{ gap: 18 }}>
            <Ring value={eaten} max={plan.targets.kcal} size={96} stroke={9}>
              <div>
                <div className="num strong" style={{ fontSize: 19 }}>{num(eaten)}</div>
                <div className="xs dim">/ {num(plan.targets.kcal)}</div>
              </div>
            </Ring>
            <div className="grow stack-sm">
              <div className="row-between">
                <span className="card-title" style={{ margin: 0 }}>Nutrition</span>
                <IconChevron />
              </div>
              <MacroLine label="Protéines" value={eatenProtein} max={plan.targets.protein} unit="g" />
              <MacroLine label="Glucides" value={consumed.carbs} max={plan.targets.carbs} unit="g" tone="muted" />
              <MacroLine label="Lipides" value={consumed.fat} max={plan.targets.fat} unit="g" tone="hatch" />
            </div>
          </div>
        </Card>

        <div className="grid-2">
          {/* Objectif */}
          <Card>
            <div className="card-title">Objectif</div>
            <div className="strong">{goal.label}</div>
            <div className="row" style={{ marginTop: 14, gap: 6, alignItems: 'baseline' }}>
              <span className="metric num">{kg(weight)}</span>
            </div>
            <div className="xs dim">→ {kg(state.profile.targetWeightKg)}</div>
            {trend !== null && (
              <div className="xs" style={{ marginTop: 6, color: 'var(--ink-2)' }}>
                {trend > 0 ? '+' : ''}{trend.toFixed(2).replace('.', ',')} %/sem.
              </div>
            )}
          </Card>

          {/* Séance du jour */}
          <Card onClick={() => go('training')}>
            <div className="card-title">Aujourd'hui</div>
            {workout ? (
              <>
                <div className="strong">{workout.name}</div>
                <div className="row xs dim" style={{ marginTop: 14 }}>
                  <IconClock size={13} /> {workout.estimatedMin} min
                </div>
                <div className="xs dim" style={{ marginTop: 4 }}>
                  {workout.exercises.length} exercices
                </div>
              </>
            ) : (
              <>
                <div className="row strong" style={{ gap: 7 }}><IconRest size={15} /> Repos</div>
                <div className="xs dim" style={{ marginTop: 14 }}>
                  Prochaine séance : {nextWorkout ? `${nextWorkout.name} · ${DAY_NAMES[nextWorkout.day]}` : '—'}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Budget de la semaine */}
        <Card onClick={() => go('shopping')} className={overBudget > 0 ? 'card-notice' : ''}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <span className="row" style={{ gap: 9 }}>
              <StoreMark store={store} size={22} />
              <span className="card-title" style={{ margin: 0 }}>Budget semaine</span>
            </span>
            <IconChevron />
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
            <span className="metric num">{eur(cart)}</span>
            <span className="sm dim">/ {eur(budget)}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Bar value={cart} max={budget} tone={overBudget > 0 ? 'notice' : 'ink'} />
          </div>
          <div className="row-between xs" style={{ marginTop: 8 }}>
            <span className="dim">
              {purchasableItems(plan.shoppingList).length} produits · {eur(spent)} cochés
            </span>
            <span className={overBudget > 0 ? 'notice strong' : 'ink strong'}>
              {overBudget > 0 ? `Dépassement ${eur(overBudget)}` : `Reste ${eur(-overBudget)}`}
            </span>
          </div>
        </Card>

        {/* Prochain repas */}
        {nextMeal && (
          <Card onClick={() => go('nutrition')}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="card-title" style={{ margin: 0 }}>Prochain repas</span>
              <span className="badge">{SLOT_LABELS[nextMeal.slot]}</span>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <RecipeThumb recipe={getRecipe(nextMeal.recipeId)} size={52} />
              <div className="strong grow" style={{ fontSize: 17, minWidth: 0 }}>
                {getRecipe(nextMeal.recipeId).name}
              </div>
            </div>
            <div className="row xs dim" style={{ marginTop: 8, gap: 12 }}>
              <span className="row" style={{ gap: 5 }}><IconFlame size={13} />{num(nextMeal.macros.kcal)} kcal</span>
              <span>{nextMeal.macros.protein} g protéines</span>
              <span className="row" style={{ gap: 5 }}>
                <IconClock size={12} />{getRecipe(nextMeal.recipeId).prepTimeMin} min
              </span>
            </div>
          </Card>
        )}

        {/* Accès direct à la liste de courses */}
        <button type="button" className="btn btn-primary btn-block" onClick={() => go('shopping')}>
          <IconCart size={17} /> Ma liste de courses
        </button>

        {/* Check-in */}
        {isCheckInDue(state.checkIns) && (
          <Card onClick={() => go('profile')} className="card-ink">
            <div className="row-between">
              <div>
                <div className="strong">Check-in hebdomadaire</div>
                <div className="sm muted" style={{ marginTop: 3 }}>
                  Sept jours écoulés : faisons le point pour ajuster le plan.
                </div>
              </div>
              <IconChevron />
            </div>
          </Card>
        )}

        <div className="grid-3">
          <MiniStat label="Séances" value={String(sessions)} icon={<IconMedal size={14} />} />
          <MiniStat label="Salle" value={GYM_BY_ID[state.profile.gymId]?.name ?? '—'} icon={<IconClock size={14} />} />
          <MiniStat label="Budget/jour" value={eur(budget / 7)} icon={<IconWallet size={14} />} />
        </div>
      </div>
    </div>
  );
}

function MacroLine({
  label, value, max, unit, tone = 'ink',
}: { label: string; value: number; max: number; unit: string; tone?: BarTone }) {
  return (
    <div>
      <div className="row-between xs" style={{ marginBottom: 4 }}>
        <span className="dim">{label}</span>
        <span className="num muted">{Math.round(value)} / {max} {unit}</span>
      </div>
      <Bar value={value} max={max} tone={tone} />
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card card-flat" style={{ padding: 13 }}>
      <div className="dim" style={{ marginBottom: 6 }}>{icon}</div>
      <div className="sm strong truncate">{value}</div>
      <div className="xs dim">{label}</div>
    </div>
  );
}


