import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { longDate, startOptions, toDay, weekdayOf } from '../engine/schedule';
import { DAY_NAMES } from '../engine/training';
import { Card, Field } from '../components/ui';

/**
 * « On commence quand ? »
 *
 * Posée une fois le plan construit, parce que la réponse change ce qui est
 * planifié : une semaine qui démarre le jeudi planifie jeudi, vendredi,
 * samedi. Poser la question avant aurait été une case de plus dans le
 * questionnaire ; la poser après, c'est un choix sur un plan qu'on a sous les
 * yeux.
 */
export default function StartDay({ onDone }: { onDone: () => void }) {
  const { state, plan, dispatch } = useApp();
  const options = startOptions();
  const [custom, setCustom] = useState('');
  const [picked, setPicked] = useState<string>(options[0].date);

  const date = custom || picked;
  const sessions = plan.workoutPlan.workouts.length;
  const days = plan.limits.mealPlanDays;

  const confirm = () => {
    dispatch({ type: 'setStartDate', date });
    onDone();
  };

  return (
    <div className="screen start-day">
      <div className="start-head">
        <div className="eyebrow">Ton plan est prêt</div>
        <h1 className="display">On commence quand ?</h1>
        <p className="muted" style={{ marginTop: 14, fontSize: 16, lineHeight: 1.5 }}>
          Le jour choisi devient le premier jour du programme. Les {days} jours
          de repas et les {sessions} séances se placent à partir de là.
        </p>
      </div>

      <div className="stack-sm" style={{ marginTop: 26 }}>
        {options.map((o) => (
          <button key={o.id} type="button" className="option"
            aria-pressed={!custom && picked === o.date}
            onClick={() => { setPicked(o.date); setCustom(''); }}>
            <span className="option-mark">
              {!custom && picked === o.date && <Tick />}
            </span>
            <span className="grow">
              <span className="strong" style={{ display: 'block' }}>{o.label}</span>
              <span className="sm dim">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <Field label="Ou une autre date">
          <input type="date" value={custom} min={toDay(new Date())}
            onChange={(e) => setCustom(e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: 20 }}>
      <Card className="card-ink">
        <div className="card-title" style={{ margin: 0 }}>Premier jour</div>
        <div className="strong" style={{ fontSize: 19, marginTop: 4 }}>
          {longDate(date)}
        </div>
        <div className="sm" style={{ marginTop: 8 }}>
          Jours planifiés : {plannedLabels(date, days)}.
        </div>
      </Card>
      </div>

      <button type="button" className="btn btn-primary btn-block"
        style={{ marginTop: 20 }} onClick={confirm} disabled={!date}>
        C'est parti
      </button>
      <p className="xs dim center" style={{ marginTop: 10 }}>
        Modifiable à tout moment depuis ton profil.
      </p>
      {state.startDate && (
        <button type="button" className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }} onClick={onDone}>
          Garder {longDate(state.startDate)}
        </button>
      )}
    </div>
  );
}

/** Les jours de la semaine couverts, dans l'ordre du programme. */
function plannedLabels(date: string, count: number): string {
  const start = weekdayOf(date);
  return Array.from({ length: count }, (_, i) => DAY_NAMES[(start + i) % 7].toLowerCase())
    .join(', ');
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
      strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L19 7" /></svg>
  );
}
