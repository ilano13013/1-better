import { useMemo, useState } from 'react';
import type { DayIndex, Performance, PerformanceSet, Workout, WorkoutExercise } from '../types';
import { useApp } from '../store/AppContext';
import { todayIndex } from '../store/state';
import { MUSCLE_LABELS, getExercise } from '../data/exercises';
import { EQUIPMENT_LABELS, GYM_BY_ID } from '../data/gyms';
import { DAY_NAMES, DAY_SHORT, findReplacements } from '../engine/training';
import { historyFor, lastPerformance, personalRecords, suggestNext, unitLabel } from '../engine/progression';
import { Card, Checkbox, Disclaimer, Empty, Sheet, num } from '../components/ui';
import { PlanSheet, PlusLock } from '../components/Plus';
import { CoachCard } from '../components/CoachCard';
import type { Limits } from '../engine/entitlements';
import { GymMark } from '../components/BrandMark';

const LEVEL_LABELS = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' } as const;
import {
  IconCheck, IconClock, IconInfo, IconMedal, IconPlus, IconRest, IconSwap, IconTrash,
} from '../components/icons';

/**
 * Écran Training : planning de la semaine, détail de séance, remplacement
 * d'exercice et enregistrement des performances (double progression).
 */
export default function Training() {
  const { state, plan, dispatch, notify } = useApp();
  const today = todayIndex();

  const [selectedDay, setSelectedDay] = useState<DayIndex>(() => {
    const t = plan.workoutPlan.workouts.find((w) => w.day >= today) ?? plan.workoutPlan.workouts[0];
    return t?.day ?? today;
  });

  const workout = plan.workoutPlan.workouts.find((w) => w.day === selectedDay) ?? null;
  const [replacing, setReplacing] = useState<{ workout: Workout; index: number } | null>(null);
  const [logging, setLogging] = useState<{ workout: Workout; we: WorkoutExercise } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [plans, setPlans] = useState(false);

  const gym = GYM_BY_ID[state.profile.gymId];
  const records = useMemo(() => personalRecords(state.performances), [state.performances]);

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <div className="eyebrow">{plan.workoutPlan.splitName}</div>
          <h1>Training</h1>
        </div>
        {gym && (
          <span className="row" style={{ gap: 8 }}>
            <GymMark gym={gym} size={24} />
            <span className="sm strong">{gym.name}</span>
          </span>
        )}
      </div>

      {/* Sélecteur de jour */}
      <div className="scroller" style={{ marginBottom: 16 }}>
        {DAY_SHORT.map((label, i) => {
          const w = plan.workoutPlan.workouts.find((x) => x.day === i);
          const active = selectedDay === i;
          return (
            <button
              key={label}
              type="button"
              className="card"
              onClick={() => setSelectedDay(i as DayIndex)}
              style={{
                width: 76, padding: '12px 8px', textAlign: 'center',
                borderColor: active ? 'var(--invert-bg)' : undefined,
                background: active ? 'var(--invert-bg)' : undefined,
                color: active ? 'var(--invert-fg)' : undefined,
                cursor: 'pointer',
              }}
            >
              <div className="xs dim">{label}</div>
              <div className="sm strong truncate" style={{ marginTop: 4, color: w ? undefined : 'var(--ink-3)' }}>
                {w ? w.name : 'Repos'}
              </div>
              {i === today && <div className="xs ink" style={{ marginTop: 2 }}>auj.</div>}
            </button>
          );
        })}
      </div>

      {!workout ? (
        <Card className="card-flat">
          <div className="row" style={{ gap: 10 }}>
            <IconRest size={18} />
            <div>
              <div className="strong">Jour de repos</div>
              <div className="sm dim" style={{ marginTop: 2 }}>
                {DAY_NAMES[selectedDay]} — récupération programmée.
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="stack">
          <Card className="card-ink">
            <div className="row-between">
              <div>
                <div className="card-title" style={{ margin: 0 }}>{DAY_NAMES[workout.day]}</div>
                <div className="metric" style={{ marginTop: 4 }}>{workout.name}</div>
              </div>
              <div className="center">
                <div className="row sm strong" style={{ gap: 5 }}>
                  <IconClock size={14} />{workout.estimatedMin} min
                </div>
                <div className="xs dim" style={{ marginTop: 2 }}>{workout.exercises.length} exercices</div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
              {workout.focus.map((m) => <span key={m} className="badge">{MUSCLE_LABELS[m]}</span>)}
            </div>
          </Card>

          {workout.exercises.map((we, index) => (
            <ExerciseCard
              key={`${we.exerciseId}-${index}`}
              we={we}
              index={index}
              performances={state.performances}
              limits={plan.limits}
              onReplace={() => setReplacing({ workout, index })}
              onLog={() => setLogging({ workout, we })}
              onDetail={() => setDetail(we.exerciseId)}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <CoachCard />
      </div>

      {(!plan.limits.gymEquipment || plan.limits.maxSessionsPerWeek !== null) && (
        <div style={{ marginTop: 20 }}>
          <PlusLock
            title="Programme complet"
            hint={`Séances illimitées, exercices choisis d'après le matériel réel de ${gym.name}, `
              + 'et charges ajustées à partir de tes séances enregistrées.'}
            onOpen={() => setPlans(true)}
          />
        </div>
      )}

      <PlanSheet open={plans} onClose={() => setPlans(false)} />

      {records.length > 0 && (
        <>
          <div className="card-title" style={{ marginTop: 28 }}>Records personnels</div>
          <Card className="card-flat">
            {records.slice(0, 5).map((r) => (
              <div key={r.exerciseId} className="list-row">
                <IconMedal size={15} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="sm strong truncate">{r.exerciseName}</div>
                  <div className="xs dim">{r.date}</div>
                </div>
                <div className="center">
                  <div className="sm strong num">{r.weightKg} kg × {r.reps}</div>
                  <div className="xs dim num">1RM ≈ {Math.round(r.estimated1RM)} kg</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Remplacement d'exercice */}
      <Sheet
        open={Boolean(replacing)}
        onClose={() => setReplacing(null)}
        title={<><div className="card-title" style={{ margin: 0 }}>Remplacer</div>
          <div className="strong">
            {replacing ? getExercise(replacing.workout.exercises[replacing.index].exerciseId).name : ''}
          </div></>}
      >
        {replacing && (
          <ReplacementList
            workout={replacing.workout}
            index={replacing.index}
            onPick={(exerciseId) => {
              dispatch({ type: 'replaceExercise', workoutId: replacing.workout.id, index: replacing.index, exerciseId });
              notify(`Exercice remplacé par ${getExercise(exerciseId).name}`);
              setReplacing(null);
            }}
          />
        )}
      </Sheet>

      {/* Saisie de performance */}
      <Sheet
        open={Boolean(logging)}
        onClose={() => setLogging(null)}
        title={<><div className="card-title" style={{ margin: 0 }}>Enregistrer</div>
          <div className="strong">{logging ? getExercise(logging.we.exerciseId).name : ''}</div></>}
      >
        {logging && (
          <LogForm
            limits={plan.limits}
            we={logging.we}
            performances={state.performances}
            onSave={(sets, cleanExecution) => {
              const perf: Performance = {
                id: `${logging.we.exerciseId}-${Date.now()}`,
                exerciseId: logging.we.exerciseId,
                date: new Date().toISOString().slice(0, 10),
                sets,
                cleanExecution,
              };
              dispatch({ type: 'logPerformance', performance: perf });
              notify('Séance enregistrée');
              setLogging(null);
            }}
          />
        )}
      </Sheet>

      {/* Fiche exercice */}
      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={<div className="strong">{detail ? getExercise(detail).name : ''}</div>}
      >
        {detail && <ExerciseDetail exerciseId={detail} performances={state.performances} />}
      </Sheet>
    </div>
  );
}

function ExerciseCard({
  we, index, performances, limits, onReplace, onLog, onDetail,
}: {
  we: WorkoutExercise; index: number; performances: Performance[]; limits: Limits;
  onReplace: () => void; onLog: () => void; onDetail: () => void;
}) {
  const ex = getExercise(we.exerciseId);
  const last = lastPerformance(we.exerciseId, performances);
  const suggestion = suggestNext(we, performances, limits);

  return (
    <Card>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="xs dim num">{index + 1}</span>
            <button type="button" onClick={onDetail}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
              <span className="strong" style={{ fontSize: 16 }}>{ex.name}</span>
            </button>
          </div>
          <div className="row xs dim wrap" style={{ marginTop: 6, gap: 10 }}>
            <span>{MUSCLE_LABELS[ex.primary]}</span>
            <span>·</span>
            <span>{ex.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 6, flex: 'none' }}>
          <button type="button" className="icon-btn" onClick={onDetail}
            aria-label={`Exécution du mouvement : ${ex.name}`}>
            <IconInfo />
          </button>
          <button type="button" className="icon-btn" onClick={onReplace} aria-label="Remplacer">
            <IconSwap />
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14, gap: 18 }}>
        <div>
          <div className="metric num">{we.sets} × {we.repMin}-{we.repMax}</div>
          <div className="xs dim">
            séries × {we.repUnit === 'reps' ? 'répétitions' : unitLabel(we.repUnit)}
          </div>
        </div>
        <div>
          <div className="sm strong num">{we.restSec}s</div>
          <div className="xs dim">récupération</div>
        </div>
      </div>

      <div className="divider" style={{ margin: '14px 0 12px' }} />

      <div className="row-between">
        <div style={{ minWidth: 0 }}>
          {last ? (
            <>
              <div className="xs dim">Dernière séance · {last.date}</div>
              <div className="sm strong num">
                {last.sets
                  .map((s) => (s.weightKg > 0
                    ? `${s.weightKg} kg × ${s.reps}`
                    : `${s.reps} ${we.repUnit === 'sec' ? 's' : 'reps'}`))
                  .join(' · ')}
              </div>
            </>
          ) : (
            <div className="xs dim">Aucune performance enregistrée</div>
          )}
        </div>
        <button type="button" className="btn btn-sm" onClick={onLog}>
          <IconPlus size={14} /> Saisir
        </button>
      </div>

      <div className="card card-flat" style={{ marginTop: 12, padding: 12 }}>
        <div className="row xs" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="ink" style={{ flex: 'none', marginTop: 1 }}><IconInfo size={13} /></span>
          <span className="muted">{suggestion.message}</span>
        </div>
      </div>
    </Card>
  );
}

function ReplacementList({
  workout, index, onPick,
}: { workout: Workout; index: number; onPick: (id: string) => void }) {
  const { plan, state } = useApp();
  const current = workout.exercises[index];
  const options = findReplacements(current.exerciseId, plan.equipment, state.profile.level, workout);

  if (options.length === 0) {
    return <Empty title="Aucune alternative disponible" hint="Ton matériel ne permet pas d'autre exercice sur ce muscle." />;
  }

  return (
    <div className="stack-sm">
      <p className="sm dim" style={{ marginBottom: 6 }}>
        Même muscle principal, compatible avec ton matériel et ton niveau.
      </p>
      {options.map((ex) => (
        <button key={ex.id} type="button" className="option" onClick={() => onPick(ex.id)} aria-pressed={false}>
          <span className="grow">
            <span className="strong" style={{ display: 'block' }}>{ex.name}</span>
            <span className="sm dim" style={{ display: 'block', marginTop: 2 }}>
              {ex.type === 'polyarticulaire' ? 'Polyarticulaire' : 'Isolation'} ·{' '}
              {ex.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}
            </span>
          </span>
          <span className="badge num">
            {ex.sets[1]} × {ex.reps[0]}-{ex.reps[1]}
            {ex.repUnit && ex.repUnit !== 'reps' ? (ex.repUnit === 'sec' ? ' s' : ' min') : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

function LogForm({
  we, performances, limits, onSave,
}: {
  we: WorkoutExercise;
  performances: Performance[];
  limits: Limits;
  onSave: (sets: PerformanceSet[], cleanExecution: boolean) => void;
}) {
  const suggestion = suggestNext(we, performances, limits);
  const [clean, setClean] = useState(true);
  const [sets, setSets] = useState<PerformanceSet[]>(() =>
    Array.from({ length: we.sets }, () => ({
      weightKg: suggestion.weightKg, reps: suggestion.reps,
    })),
  );

  const update = (i: number, patch: Partial<PerformanceSet>) =>
    setSets(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="stack">
      <div className="card card-flat" style={{ padding: 12 }}>
        <div className="xs muted">{suggestion.message}</div>
      </div>

      {sets.map((s, i) => (
        <div key={i} className="row" style={{ gap: 10 }}>
          <span className="xs dim num" style={{ width: 22 }}>S{i + 1}</span>
          <div className="suffix grow">
            <input type="number" inputMode="decimal" step="0.5" value={s.weightKg}
              onChange={(e) => update(i, { weightKg: Number(e.target.value) })} />
            <span>kg</span>
          </div>
          <div className="suffix grow">
            <input type="number" inputMode="numeric" value={s.reps}
              onChange={(e) => update(i, { reps: Number(e.target.value) })} />
            <span>{we.repUnit === 'sec' ? 's' : we.repUnit === 'min' ? 'min' : 'reps'}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="Supprimer la série"
            onClick={() => setSets(sets.filter((_, idx) => idx !== i))}>
            <IconTrash size={13} />
          </button>
        </div>
      ))}

      <button type="button" className="btn btn-sm btn-ghost"
        onClick={() => setSets([...sets, sets[sets.length - 1] ?? { weightKg: 0, reps: we.repMin }])}>
        <IconPlus size={14} /> Ajouter une série
      </button>

      <Checkbox checked={clean} onChange={() => setClean(!clean)}>
        <span className="sm">Exécution maîtrisée</span>
        <span className="xs dim" style={{ display: 'block', marginTop: 2 }}>
          La charge n'augmente que si la technique a tenu sur toutes les séries.
        </span>
      </Checkbox>

      <button type="button" className="btn btn-primary btn-block"
        disabled={sets.length === 0}
        onClick={() => onSave(sets.filter((s) => s.reps > 0), clean)}>
        <IconCheck size={15} /> Enregistrer
      </button>
    </div>
  );
}

function ExerciseDetail({
  exerciseId, performances,
}: { exerciseId: string; performances: Performance[] }) {
  const ex = getExercise(exerciseId);
  const history = historyFor(exerciseId, performances);

  return (
    <div className="stack">
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="badge badge-ink">{MUSCLE_LABELS[ex.primary]}</span>
        {ex.secondary.map((m) => <span key={m} className="badge">{MUSCLE_LABELS[m]}</span>)}
      </div>

      <Card className="card-flat">
        <div className="row-between sm"><span className="dim">Type</span>
          <span className="strong">{ex.type === 'polyarticulaire' ? 'Polyarticulaire' : ex.type === 'cardio' ? 'Cardio' : 'Isolation'}</span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Matériel</span>
          <span className="strong">{ex.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}</span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Niveau minimum</span>
          <span className="strong">{LEVEL_LABELS[ex.minLevel]}</span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Recommandé</span>
          <span className="strong num">
            {ex.sets[0]}-{ex.sets[1]} × {ex.reps[0]}-{ex.reps[1]}
            {ex.repUnit && ex.repUnit !== 'reps' ? ` ${ex.repUnit === 'sec' ? 's' : 'min'}` : ''}
          </span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Récupération</span>
          <span className="strong num">{ex.restSec}s</span></div>
      </Card>

      <div>
        <div className="card-title">Exécution du mouvement</div>
        <Card className="card-flat">
          <ol className="move-list">
            {ex.execution.map((step, i) => (
              <li key={i}>
                <span className="move-mark num">{i + 1}</span>
                <span className="sm">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div>
        <div className="card-title">À éviter</div>
        <Card className="card-flat">
          <ul className="move-list">
            {ex.mistakes.map((m, i) => (
              <li key={i}>
                <span className="move-mark move-mark-alert" aria-hidden="true">✕</span>
                <span className="sm muted">{m}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Disclaimer>
        Ces repères d'exécution sont généraux : ils ne remplacent pas la correction
        d'un coach sur place. En cas de douleur, arrête la série et fais vérifier
        ton placement.
      </Disclaimer>

      <div>
        <div className="card-title">Historique</div>
        {history.length === 0 ? (
          <Empty title="Pas encore d'historique" hint="Enregistre ta première séance sur cet exercice." />
        ) : (
          <Card className="card-flat">
            {history.slice(0, 10).map((p) => (
              <div key={p.id} className="list-row">
                <span className="xs dim num" style={{ width: 86 }}>{p.date}</span>
                <span className="sm num grow">
                  {p.sets
                    .map((s) => (s.weightKg > 0 ? `${s.weightKg}×${s.reps}` : `${s.reps}`))
                    .join('  ·  ')}
                </span>
                <span className="xs dim num">
                  {num(p.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0))} kg
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
