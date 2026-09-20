import { useState } from 'react';
import type { DayIndex } from '../types';
import { useApp } from '../store/AppContext';
import { todayIndex } from '../store/state';
import { getRecipe } from '../data/recipes';
import { getExercise } from '../data/exercises';
import { SLOT_LABELS } from '../engine/nutrition';
import { DAY_NAMES } from '../engine/training';
import { workoutForDay } from '../engine/planner';
import { Bar, Card, Sheet, eur, num } from '../components/ui';
import { IconClock, IconFlame, IconRest } from '../components/icons';
import type { Screen } from '../App';

/**
 * Vue calendrier : la semaine d'un coup d'œil, séance et calories par jour.
 */
export default function Week({ go }: { go: (s: Screen) => void }) {
  const { state, plan } = useApp();
  const today = todayIndex();
  const [open, setOpen] = useState<DayIndex | null>(null);

  const weekKcal = plan.mealPlan.days.reduce((s, d) => s + d.totals.kcal, 0);
  const sessions = plan.workoutPlan.workouts.length;

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <div className="eyebrow">Semaine du {formatWeek(state.weekStart)}</div>
          <h1>Ma semaine</h1>
        </div>
      </div>

      <div className="stack">
        <div className="grid-3">
          <Card className="card-flat">
            <div className="metric num">{sessions}</div>
            <div className="xs dim">séances</div>
          </Card>
          <Card className="card-flat">
            <div className="metric num">{num(Math.round(weekKcal / 1000))}k</div>
            <div className="xs dim">kcal / semaine</div>
          </Card>
          <Card className="card-flat">
            <div className="metric num">{eur(plan.shoppingList.total)}</div>
            <div className="xs dim">panier</div>
          </Card>
        </div>

        {plan.mealPlan.days.map((day) => {
          const workout = workoutForDay(plan.workoutPlan, day.day);
          return (
            <button key={day.day} type="button"
              className={`day-cell ${day.day === today ? 'today' : ''}`}
              onClick={() => setOpen(day.day)}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <span className="strong">{DAY_NAMES[day.day]}</span>
                {day.day === today && <span className="badge badge-ink">aujourd'hui</span>}
              </div>

              <div className="row" style={{ gap: 9, marginBottom: 6 }}>
                <span style={{ flex: 'none' }}>🏋️</span>
                <span className={`sm ${workout ? 'strong' : 'dim'}`}>
                  {workout ? `${workout.name} · ${workout.estimatedMin} min` : 'Repos'}
                </span>
              </div>
              <div className="row" style={{ gap: 9 }}>
                <span style={{ flex: 'none' }}>🍽</span>
                <span className="sm strong num">{num(day.totals.kcal)} kcal</span>
                <span className="xs dim num">{day.totals.protein} g P</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <Bar value={day.totals.kcal} max={day.target.kcal} />
              </div>
            </button>
          );
        })}
      </div>

      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open !== null ? <div className="strong">{DAY_NAMES[open]}</div> : ''}
      >
        {open !== null && <DayDetail day={open} go={go} onClose={() => setOpen(null)} />}
      </Sheet>
    </div>
  );
}

function DayDetail({
  day, go, onClose,
}: { day: DayIndex; go: (s: Screen) => void; onClose: () => void }) {
  const { plan } = useApp();
  const dayPlan = plan.mealPlan.days[day];
  const workout = workoutForDay(plan.workoutPlan, day);

  return (
    <div className="stack">
      <Card className="card-ink">
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Nutrition</div>
            <div className="metric num">{num(dayPlan.totals.kcal)} kcal</div>
          </div>
          <div className="center xs dim">
            <div className="sm strong num">{dayPlan.totals.protein} / {dayPlan.totals.carbs} / {dayPlan.totals.fat} g</div>
            <div>P / G / L</div>
          </div>
        </div>
      </Card>

      <div>
        <div className="card-title">Repas</div>
        <Card className="card-flat">
          {dayPlan.meals.map((meal, i) => (
            <div key={i} className="list-row">
              <span className="xs dim" style={{ width: 88, flex: 'none' }}>{SLOT_LABELS[meal.slot]}</span>
              <span className="grow sm truncate">{getRecipe(meal.recipeId).name}</span>
              <span className="xs dim num">{num(meal.macros.kcal)}</span>
            </div>
          ))}
        </Card>
      </div>

      <div>
        <div className="card-title">Entraînement</div>
        {workout ? (
          <Card className="card-flat">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="strong">{workout.name}</span>
              <span className="row xs dim" style={{ gap: 5 }}>
                <IconClock size={12} />{workout.estimatedMin} min
              </span>
            </div>
            {workout.exercises.map((we, i) => (
              <div key={i} className="list-row">
                <span className="grow sm truncate">{getExercise(we.exerciseId).name}</span>
                <span className="xs dim num">{we.sets} × {we.repMin}-{we.repMax}</span>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="card-flat">
            <div className="row" style={{ gap: 9 }}>
              <IconRest size={16} />
              <span className="sm muted">Jour de repos — récupération programmée.</span>
            </div>
          </Card>
        )}
      </div>

      <div className="grid-2">
        <button type="button" className="btn btn-ghost" onClick={() => { onClose(); go('nutrition'); }}>
          <IconFlame size={15} /> Nutrition
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { onClose(); go('training'); }}>
          Training
        </button>
      </div>
    </div>
  );
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
