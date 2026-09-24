import { useMemo, useState } from 'react';
import type { DayIndex, EquipmentId, Macros, RestrictionId, WeeklyCheckIn } from '../types';
import { useApp } from '../store/AppContext';
import { GOAL_LIST, ACTIVITY_LABELS } from '../data/goals';
import { ALL_EQUIPMENT, EQUIPMENT_LABELS, GYMS } from '../data/gyms';
import { STORES } from '../data/stores';
import { computeTargets, kcalFromMacros } from '../engine/nutrition';
import { DIET_LABELS, RESTRICTION_LABELS } from '../engine/filters';
import { DAY_NAMES } from '../engine/training';
import { movingAverage, sortedEntries, weeklyTrendPct } from '../engine/weight';
import { providerLabel } from '../engine/auth';
import { PLAN_LABELS, effectivePlan, withinHistory } from '../engine/entitlements';
import { longDate, startOptions, weekdayOf } from '../engine/schedule';
import { PlanSheet } from '../components/Plus';
import { evaluateCheckIn, isCheckInDue } from '../engine/checkin';
import { buildBadges, sessionCount, weekStreak, progressToGoal } from '../engine/gamification';
import { personalRecords } from '../engine/progression';
import { Bar, Card, Chip, Empty, Field, Option, Segmented, Sheet, day, eur, kg, num } from '../components/ui';
import { GymMark, StoreMark } from '../components/BrandMark';
import { IconCheck, IconMedal, IconSpark, IconTrend } from '../components/icons';

/**
 * Profil : suivi du poids, check-in hebdomadaire, réglages du moteur,
 * objectifs manuels, gamification discrète.
 */
export default function ProfileScreen() {
  const { state, plan, dispatch, notify, session, signOut, eraseAccount } = useApp();
  const [sheet, setSheet] = useState<
    null | 'weight' | 'checkin' | 'macros' | 'goal' | 'gym' | 'store' | 'budget'
    | 'diet' | 'schedule' | 'start'
  >(null);
  const [plans, setPlans] = useState(false);

  // La fenêtre d'historique de la formule ne supprime rien : elle borne la
  // lecture, et tout réapparaît si la formule change.
  const entries = withinHistory(sortedEntries(state.weightEntries), plan.limits);
  const current = entries.length ? entries[entries.length - 1].weightKg : state.profile.weightKg;
  const trend = weeklyTrendPct(state.weightEntries);
  const badges = useMemo(() => buildBadges(state), [state]);
  const unlocked = badges.filter((b) => b.unlocked).length;
  const records = useMemo(
    () => personalRecords(withinHistory(state.performances, plan.limits)),
    [state.performances, plan.limits],
  );
  const gym = GYMS.find((g) => g.id === state.profile.gymId);
  const store = STORES.find((s) => s.id === state.profile.storeId);

  const goalProgress = progressToGoal(
    current, entries[0]?.weightKg ?? state.profile.weightKg, state.profile.targetWeightKg,
  );

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <div className="eyebrow">Profil</div>
          <h1>{state.profile.firstName || 'Mon profil'}</h1>
        </div>
        <button type="button" className="btn btn-sm btn-ghost"
          onClick={() => dispatch({ type: 'setTheme', theme: state.theme === 'dark' ? 'light' : 'dark' })}>
          {state.theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        </button>
      </div>

      <div className="stack">
        {/* Poids */}
        <Card>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <span className="card-title" style={{ margin: 0 }}>Suivi du poids</span>
            <button type="button" className="btn btn-sm" onClick={() => setSheet('weight')}>
              Enregistrer
            </button>
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
            <span className="display num" style={{ fontSize: 34 }}>{kg(current)}</span>
            {trend !== null && (
              <span className={`badge ${trend > 0 ? 'badge-ink' : 'badge-muted'}`}>
                <IconTrend size={12} /> {trend > 0 ? '+' : ''}{trend.toFixed(2).replace('.', ',')} %/sem.
              </span>
            )}
          </div>
          <div className="xs dim" style={{ marginTop: 2 }}>
            objectif {kg(state.profile.targetWeightKg)}
          </div>

          <div style={{ marginTop: 14 }}>
            <Bar value={goalProgress * 100} max={100} tone="muted" />
          </div>

          <WeightChart entries={entries} />

          <p className="xs dim" style={{ marginTop: 10 }}>
            La courbe claire est la moyenne glissante : elle seule sert aux
            décisions d'ajustement. Une pesée isolée ne signifie rien.
          </p>
        </Card>

        {/* Check-in */}
        <Card className={isCheckInDue(state.checkIns) ? 'card-ink' : ''}
          onClick={() => setSheet('checkin')}>
          <div className="row-between">
            <div>
              <div className="strong">Check-in hebdomadaire</div>
              <div className="sm muted" style={{ marginTop: 3 }}>
                {isCheckInDue(state.checkIns)
                  ? 'Sept jours écoulés — faisons le point.'
                  : `${state.checkIns.length} bilan${state.checkIns.length > 1 ? 's' : ''} enregistré${state.checkIns.length > 1 ? 's' : ''}.`}
              </div>
            </div>
            <span className="badge">{state.checkIns.length}</span>
          </div>
        </Card>

        {/* Objectifs nutritionnels */}
        <Card onClick={() => setSheet('macros')}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <span className="card-title" style={{ margin: 0 }}>Objectif quotidien</span>
            {plan.targets.manual && <span className="badge badge-muted">manuel</span>}
          </div>
          <div className="metric num">{num(plan.targets.kcal)} kcal</div>
          <div className="row xs dim" style={{ marginTop: 8, gap: 14 }}>
            <span>{plan.targets.protein} g protéines</span>
            <span>{plan.targets.carbs} g glucides</span>
            <span>{plan.targets.fat} g lipides</span>
          </div>
        </Card>

        {/* Réglages du moteur */}
        <div>
          <div className="card-title">Réglages</div>
          <Card className="card-flat">
            <SettingRow label="Objectif" value={GOAL_LIST.find((g) => g.id === state.profile.goal)!.label} onClick={() => setSheet('goal')} />
            <SettingRow label="Salle" value={gym?.name ?? '—'} onClick={() => setSheet('gym')}
              mark={gym && <GymMark gym={gym} size={20} />} />
            <SettingRow label="Disponibilités" value={`${state.profile.sessionsPerWeek} × ${state.profile.sessionDurationMin} min`} onClick={() => setSheet('schedule')} />
            <SettingRow label="Supermarché" value={store?.name ?? '—'} onClick={() => setSheet('store')}
              mark={store && <StoreMark store={store} size={20} />} />
            <SettingRow label="Budget" value={`${eur(state.profile.weeklyBudget)} / sem.`} onClick={() => setSheet('budget')} />
            <SettingRow label="Alimentation" value={DIET_LABELS[state.profile.diet]} onClick={() => setSheet('diet')} />
            <SettingRow label="Départ du programme"
              value={state.startDate ? longDate(state.startDate) : '—'}
              onClick={() => setSheet('start')} />
          </Card>
        </div>

        {/* Gamification */}
        <div>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="card-title" style={{ margin: 0 }}>Progression</span>
            <span className="xs dim num">{unlocked} / {badges.length}</span>
          </div>
          <div className="grid-3">
            <Card className="card-flat">
              <div className="metric num">{sessionCount(state.performances)}</div>
              <div className="xs dim">séances</div>
            </Card>
            <Card className="card-flat">
              <div className="metric num">{weekStreak(state.checkIns, state.profile.sessionsPerWeek)}</div>
              <div className="xs dim">semaines pleines</div>
            </Card>
            <Card className="card-flat">
              <div className="metric num">{records.length}</div>
              <div className="xs dim">records</div>
            </Card>
          </div>

          <div className="stack-sm" style={{ marginTop: 12 }}>
            {badges.map((b) => (
              <div key={b.id} className="card card-flat" style={{ padding: 13, opacity: b.unlocked ? 1 : 0.62 }}>
                <div className="row-between">
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className={b.unlocked ? 'ink' : 'dim'} style={{ flex: 'none' }}>
                      {b.unlocked ? <IconCheck size={14} /> : <IconMedal size={14} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="sm strong truncate">{b.label}</div>
                      <div className="xs dim truncate">{b.description}</div>
                    </div>
                  </div>
                  <span className="xs dim num">{Math.round(b.progress * 100)} %</span>
                </div>
                {!b.unlocked && (
                  <div style={{ marginTop: 8 }}><Bar value={b.progress * 100} max={100} tone="muted" /></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Formule */}
        <div>
          <div className="card-title">Formule</div>
          <Card className="card-flat">
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <div className="strong">{PLAN_LABELS[effectivePlan(state)]}</div>
                <div className="xs dim">
                  {effectivePlan(state) === 'plus' && state.subscription
                    ? `${state.subscription.period === 'yearly' ? '39,00 € / an' : '4,99 € / mois'}`
                      + ` — échéance le ${day(state.subscription.renewsAt)}`
                    : '3 séances, 3 jours de repas, liste basique.'}
                </div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setPlans(true)}>
                {effectivePlan(state) === 'plus' ? 'Gérer' : 'Comparer'}
              </button>
            </div>
          </Card>
        </div>

        <PlanSheet open={plans} onClose={() => setPlans(false)} />

        {/* Compte */}
        <div>
          <div className="card-title">Compte</div>
          <Card className="card-flat">
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <div className="strong truncate">
                  {session?.provider === 'local' || !session
                    ? 'Sans compte'
                    : session.name || session.email || 'Compte'}
                </div>
                <div className="xs dim truncate">
                  {session && session.provider !== 'local'
                    ? `${providerLabel(session.provider)}${session.email ? ` · ${session.email}` : ''}`
                    : 'Données enregistrées sur cet appareil'}
                </div>
              </div>
              <button type="button" className="btn btn-sm" onClick={signOut}>
                {session && session.provider !== 'local' ? 'Se déconnecter' : 'Changer'}
              </button>
            </div>
          </Card>
          <p className="xs dim" style={{ marginTop: 10 }}>
            {session?.provider === 'email'
              ? `Se déconnecter ne supprime rien : les données de ce compte restent
                 sur cet appareil, chiffrées, et ton mot de passe les rouvre.`
              : `Se déconnecter ne supprime rien : les données de ce compte restent
                 sur cet appareil et reviennent à la prochaine connexion.`}
          </p>
        </div>

        {/* Données */}
        <div>
          <div className="card-title">Données</div>
          <div className="stack-sm">
            <button type="button" className="btn btn-ghost btn-block"
              onClick={() => { dispatch({ type: 'regeneratePlan' }); notify('Plan régénéré'); }}>
              <IconSpark size={15} /> Régénérer mon plan
            </button>
            <button type="button" className="btn btn-ghost btn-block"
              onClick={() => { dispatch({ type: 'setTourSeen', seen: false }); notify('Guide relancé'); }}>
              Revoir le guide pas à pas
            </button>
            <button type="button" className="btn btn-ghost btn-block"
              onClick={() => { dispatch({ type: 'loadDemo' }); notify('Profil de démonstration chargé'); }}>
              Charger le profil de démonstration
            </button>
            <button type="button" className="btn btn-alert btn-block"
              onClick={() => {
                if (!window.confirm('Effacer toutes tes données locales, images comprises ? Cette action est définitive.')) return;
                eraseAccount();
              }}>
              Tout effacer
            </button>
          </div>
          <p className="xs dim" style={{ marginTop: 12 }}>
            Toutes tes données restent sur cet appareil. Le seul échange avec
            l'extérieur est facultatif : chercher un code-barres envoie ce code
            à Open Food Facts, et rien d'autre.
          </p>
        </div>
      </div>

      {/* --- feuilles --- */}
      <Sheet open={sheet === 'weight'} onClose={() => setSheet(null)} title={<div className="strong">Enregistrer mon poids</div>}>
        <WeightForm onDone={() => setSheet(null)} />
      </Sheet>

      <Sheet open={sheet === 'checkin'} onClose={() => setSheet(null)} title={<div className="strong">Check-in hebdomadaire</div>}>
        <CheckInForm onDone={() => setSheet(null)} />
      </Sheet>

      <Sheet open={sheet === 'macros'} onClose={() => setSheet(null)} title={<div className="strong">Objectif quotidien</div>}>
        <MacroEditor onDone={() => setSheet(null)} />
      </Sheet>

      <Sheet open={sheet === 'goal'} onClose={() => setSheet(null)} title={<div className="strong">Objectif</div>}>
        <div className="stack-sm">
          {GOAL_LIST.map((g) => (
            <button key={g.id} type="button" className="option" aria-pressed={state.profile.goal === g.id}
              onClick={() => { dispatch({ type: 'patchProfile', patch: { goal: g.id } }); notify('Nutrition et programme recalculés'); setSheet(null); }}>
              <span className="option-mark">{state.profile.goal === g.id && <IconCheck />}</span>
              <span className="grow">
                <span className="strong" style={{ display: 'block' }}>{g.label}</span>
                <span className="sm dim">{g.description}</span>
              </span>
            </button>
          ))}
          <div className="divider" />
          <Field label="Niveau d'activité hors entraînement">
            <select value={state.profile.activity}
              onChange={(e) => dispatch({ type: 'patchProfile', patch: { activity: e.target.value as never } })}>
              {(Object.keys(ACTIVITY_LABELS) as (keyof typeof ACTIVITY_LABELS)[]).map((a) => (
                <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
              ))}
            </select>
          </Field>
          <Field label="Poids objectif">
            <div className="suffix">
              <input type="number" step="0.1" value={state.profile.targetWeightKg}
                onChange={(e) => dispatch({ type: 'patchProfile', patch: { targetWeightKg: Number(e.target.value) } })} />
              <span>kg</span>
            </div>
          </Field>
        </div>
      </Sheet>

      <Sheet open={sheet === 'gym'} onClose={() => setSheet(null)} title={<div className="strong">Salle & matériel</div>}>
        <GymEditor onDone={() => setSheet(null)} />
      </Sheet>

      <Sheet open={sheet === 'schedule'} onClose={() => setSheet(null)} title={<div className="strong">Disponibilités</div>}>
        <ScheduleEditor />
      </Sheet>

      <Sheet open={sheet === 'start'} onClose={() => setSheet(null)} title={<div className="strong">Départ du programme</div>}>
        <StartEditor onDone={() => setSheet(null)} />
      </Sheet>

      <Sheet open={sheet === 'store'} onClose={() => setSheet(null)} title={<div className="strong">Supermarché</div>}>
        <div className="stack-sm">
          {STORES.map((s) => (
            <Option
              key={s.id}
              selected={state.profile.storeId === s.id}
              onClick={() => { dispatch({ type: 'patchProfile', patch: { storeId: s.id } }); notify('Prix et liste recalculés'); setSheet(null); }}
              title={s.name}
              leading={<StoreMark store={s} />}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'budget'} onClose={() => setSheet(null)} title={<div className="strong">Budget hebdomadaire</div>}>
        <BudgetEditor />
      </Sheet>

      <Sheet open={sheet === 'diet'} onClose={() => setSheet(null)} title={<div className="strong">Alimentation</div>}>
        <DietEditor />
      </Sheet>
    </div>
  );
}

function SettingRow({
  label, value, onClick, mark,
}: { label: string; value: string; onClick: () => void; mark?: React.ReactNode }) {
  return (
    <button type="button" className="list-row" onClick={onClick}
      style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
      <span className="grow sm dim">{label}</span>
      {mark}
      <span className="sm strong truncate">{value}</span>
    </button>
  );
}

function WeightChart({ entries }: { entries: { date: string; weightKg: number }[] }) {
  if (entries.length < 2) {
    return <div className="sm dim" style={{ marginTop: 14 }}>Enregistre au moins deux pesées pour voir la courbe.</div>;
  }
  const avg = movingAverage(entries);
  const values = entries.map((e) => e.weightKg);
  const min = Math.min(...values, ...avg.map((a) => a.value)) - 0.4;
  const max = Math.max(...values, ...avg.map((a) => a.value)) + 0.4;
  const w = 100;
  const h = 46;
  const x = (i: number) => (i / (entries.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / Math.max(0.1, max - min)) * h;

  const path = (pts: number[]) => pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');

  return (
    <div style={{ marginTop: 16 }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 92, overflow: 'visible' }}>
        <path d={path(values)} fill="none" stroke="var(--line-strong)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <path d={path(avg.map((a) => a.value))} fill="none" stroke="var(--ink)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="1.4" fill="var(--ink-3)" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="row-between xs dim num" style={{ marginTop: 6 }}>
        <span>{entries[0].weightKg.toFixed(1).replace('.', ',')} kg</span>
        <span>{entries[entries.length - 1].weightKg.toFixed(1).replace('.', ',')} kg</span>
      </div>
    </div>
  );
}

function WeightForm({ onDone }: { onDone: () => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState(
    state.weightEntries.length
      ? state.weightEntries[state.weightEntries.length - 1].weightKg
      : state.profile.weightKg,
  );

  return (
    <div className="stack">
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Poids">
        <div className="suffix">
          <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          <span>kg</span>
        </div>
      </Field>
      <button type="button" className="btn btn-primary btn-block"
        onClick={() => {
          dispatch({ type: 'logWeight', entry: { date, weightKg: weight } });
          dispatch({ type: 'patchProfile', patch: { weightKg: weight } });
          notify('Pesée enregistrée — besoins recalculés');
          onDone();
        }}>
        Enregistrer
      </button>
      {state.weightEntries.length > 0 && (
        <>
          <div className="card-title" style={{ marginTop: 10 }}>Historique</div>
          <Card className="card-flat">
            {withinHistory(sortedEntries(state.weightEntries), plan.limits)
              .slice().reverse().slice(0, 12).map((e) => (
              <div key={e.date} className="list-row">
                <span className="grow sm dim">{e.date}</span>
                <span className="sm strong num">{kg(e.weightKg)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function CheckInForm({ onDone }: { onDone: () => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const [form, setForm] = useState<WeeklyCheckIn>({
    date: new Date().toISOString().slice(0, 10),
    weightKg: state.weightEntries.length
      ? state.weightEntries[state.weightEntries.length - 1].weightKg
      : state.profile.weightKg,
    sessionsDone: state.profile.sessionsPerWeek,
    hunger: 3, energy: 3, difficulty: 3,
    planAdherence: 80,
    budgetSpent: Math.round(plan.shoppingList.total),
  });
  const [result, setResult] = useState<ReturnType<typeof evaluateCheckIn> | null>(null);

  const set = (patch: Partial<WeeklyCheckIn>) => { setForm({ ...form, ...patch }); setResult(null); };

  const scale = (label: string, key: 'hunger' | 'energy' | 'difficulty') => (
    <div>
      <div className="card-title">{label}</div>
      <Segmented
        value={form[key]}
        onChange={(v) => set({ [key]: v } as Partial<WeeklyCheckIn>)}
        options={[1, 2, 3, 4, 5].map((n) => ({ value: n as 1 | 2 | 3 | 4 | 5, label: String(n) }))}
      />
    </div>
  );

  return (
    <div className="stack">
      <Field label="Poids du jour">
        <div className="suffix">
          <input type="number" step="0.1" value={form.weightKg}
            onChange={(e) => set({ weightKg: Number(e.target.value) })} />
          <span>kg</span>
        </div>
      </Field>

      <div>
        <div className="card-title">Séances réalisées</div>
        <Segmented value={form.sessionsDone} onChange={(v) => set({ sessionsDone: v })}
          options={[0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
      </div>

      {scale('Faim (1 faible → 5 forte)', 'hunger')}
      {scale('Énergie (1 basse → 5 haute)', 'energy')}
      {scale('Difficulté du plan (1 facile → 5 dure)', 'difficulty')}

      <Field label={`Respect du plan : ${form.planAdherence} %`}>
        <input type="range" min={0} max={100} step={5} value={form.planAdherence}
          onChange={(e) => set({ planAdherence: Number(e.target.value) })} />
      </Field>

      <Field label="Budget réellement dépensé">
        <div className="suffix">
          <input type="number" step="0.5" value={form.budgetSpent}
            onChange={(e) => set({ budgetSpent: Number(e.target.value) })} />
          <span>€</span>
        </div>
      </Field>

      <button type="button" className="btn btn-block"
        onClick={() => setResult(evaluateCheckIn({
          profile: state.profile, targets: plan.targets,
          checkIn: form, weightEntries: state.weightEntries,
        }))}>
        Analyser ma semaine
      </button>

      {result && (
        <>
          <Card className="card-ink">
            <div className="card-title">Proposition du moteur</div>
            <div className="stack-sm">
              {result.messages.map((m, i) => (
                <div key={i} className="row sm" style={{ gap: 9, alignItems: 'flex-start' }}>
                  <span className="dot ink" style={{ marginTop: 8 }} />
                  <span className="muted">{m}</span>
                </div>
              ))}
            </div>
            {(result.kcalDelta !== 0 || result.budgetDelta !== 0) && (
              <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
                {result.kcalDelta !== 0 && (
                  <span className="badge badge-ink num">
                    {result.kcalDelta > 0 ? '+' : ''}{result.kcalDelta} kcal / jour
                  </span>
                )}
                {result.budgetDelta !== 0 && (
                  <span className="badge badge-notice num">+{eur(result.budgetDelta)} / semaine</span>
                )}
              </div>
            )}
          </Card>

          <p className="xs dim">
            Aucun ajustement n'est appliqué sans ta validation.
          </p>

          <div className="stack-sm">
            {(result.kcalDelta !== 0 || result.budgetDelta !== 0) && (
              <button type="button" className="btn btn-primary btn-block"
                onClick={() => {
                  dispatch({ type: 'logCheckIn', checkIn: form });
                  dispatch({ type: 'logWeight', entry: { date: form.date, weightKg: form.weightKg } });
                  if (result.kcalDelta !== 0) {
                    const t = plan.targets;
                    const kcal = t.kcal + result.kcalDelta;
                    const fat = Math.round((kcal * 0.27) / 9);
                    const carbs = Math.max(0, Math.round((kcal - t.protein * 4 - fat * 9) / 4));
                    dispatch({ type: 'setTargets', targets: { kcal, protein: t.protein, carbs, fat } });
                  }
                  if (result.budgetDelta !== 0) {
                    dispatch({
                      type: 'patchProfile',
                      patch: { weeklyBudget: state.profile.weeklyBudget + result.budgetDelta },
                    });
                  }
                  notify('Ajustements appliqués — plan recalculé');
                  onDone();
                }}>
                Appliquer les ajustements
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-block"
              onClick={() => {
                dispatch({ type: 'logCheckIn', checkIn: form });
                dispatch({ type: 'logWeight', entry: { date: form.date, weightKg: form.weightKg } });
                notify('Check-in enregistré sans modification');
                onDone();
              }}>
              Enregistrer sans modifier
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MacroEditor({ onDone }: { onDone: () => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const computed = computeTargets(state.profile);
  const [m, setM] = useState<Macros>({
    kcal: plan.targets.kcal,
    protein: plan.targets.protein,
    carbs: plan.targets.carbs,
    fat: plan.targets.fat,
  });
  const kcal = kcalFromMacros(m);

  return (
    <div className="stack">
      <Card className="card-flat">
        <div className="row-between sm"><span className="dim">Métabolisme de base</span>
          <span className="strong num">{num(computed.bmr)} kcal</span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Dépense estimée</span>
          <span className="strong num">{num(computed.tdee)} kcal</span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Calcul automatique</span>
          <span className="strong num">{num(computed.kcal)} kcal</span></div>
      </Card>

      <Card className="card-ink center">
        <div className="display num" style={{ fontSize: 32 }}>{num(kcal)} kcal</div>
        <div className="xs dim" style={{ marginTop: 4 }}>calculé depuis tes macros</div>
      </Card>

      <div className="field-row">
        <Field label="Protéines (g)">
          <input type="number" value={m.protein} onChange={(e) => setM({ ...m, protein: Number(e.target.value) })} />
        </Field>
        <Field label="Glucides (g)">
          <input type="number" value={m.carbs} onChange={(e) => setM({ ...m, carbs: Number(e.target.value) })} />
        </Field>
        <Field label="Lipides (g)">
          <input type="number" value={m.fat} onChange={(e) => setM({ ...m, fat: Number(e.target.value) })} />
        </Field>
      </div>

      <button type="button" className="btn btn-primary btn-block"
        onClick={() => {
          dispatch({ type: 'setTargets', targets: { ...m, kcal } });
          notify('Objectifs mis à jour — repas recalculés');
          onDone();
        }}>
        Enregistrer mes valeurs
      </button>

      {plan.targets.manual && (
        <button type="button" className="btn btn-ghost btn-block"
          onClick={() => { dispatch({ type: 'setTargets', targets: null }); notify('Retour au calcul automatique'); onDone(); }}>
          Revenir au calcul automatique
        </button>
      )}

      <p className="xs dim">
        Ces valeurs sont des estimations. Elles ne remplacent pas l'avis d'un
        professionnel de santé ou de nutrition.
      </p>
    </div>
  );
}

function GymEditor({ onDone }: { onDone: () => void }) {
  const { state, dispatch, notify } = useApp();
  const gym = GYMS.find((g) => g.id === state.profile.gymId);

  const toggleEquipment = (id: EquipmentId) => {
    const set = new Set(state.profile.customEquipment);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    dispatch({ type: 'patchProfile', patch: { customEquipment: [...set] } });
  };

  return (
    <div className="stack">
      <div className="stack-sm">
        {GYMS.map((g) => (
          <Option
            key={g.id}
            selected={state.profile.gymId === g.id}
            onClick={() => {
              dispatch({ type: 'patchProfile', patch: { gymId: g.id } });
              notify('Exercices incompatibles remplacés');
              if (!g.custom) onDone();
            }}
            title={g.name}
            leading={<GymMark gym={g} />}
          />
        ))}
      </div>

      {gym?.custom && (
        <div>
          <div className="card-title">Matériel disponible</div>
          <div className="row wrap">
            {ALL_EQUIPMENT.filter((e) => e !== 'poids_corps').map((e) => (
              <Chip key={e} selected={state.profile.customEquipment.includes(e)}
                onClick={() => toggleEquipment(e)}>
                {EQUIPMENT_LABELS[e]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="card-title">Niveau</div>
        <Segmented value={state.profile.level}
          onChange={(level) => dispatch({ type: 'patchProfile', patch: { level } })}
          options={[
            { value: 'debutant' as const, label: 'Débutant' },
            { value: 'intermediaire' as const, label: 'Intermédiaire' },
            { value: 'avance' as const, label: 'Avancé' },
          ]} />
      </div>
    </div>
  );
}

function ScheduleEditor() {
  const { state, dispatch } = useApp();
  const toggleDay = (d: DayIndex) => {
    const set = new Set(state.profile.availableDays);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    dispatch({ type: 'patchProfile', patch: { availableDays: [...set].sort((a, b) => a - b) as DayIndex[] } });
  };

  return (
    <div className="stack">
      <div>
        <div className="card-title">Séances par semaine</div>
        <Segmented value={state.profile.sessionsPerWeek}
          onChange={(sessionsPerWeek) => dispatch({ type: 'patchProfile', patch: { sessionsPerWeek } })}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
      </div>
      <div>
        <div className="card-title">Jours disponibles</div>
        <div className="row wrap">
          {DAY_NAMES.map((name, i) => (
            <Chip key={name} selected={state.profile.availableDays.includes(i as DayIndex)}
              onClick={() => toggleDay(i as DayIndex)}>
              {name.slice(0, 3)}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="card-title">Durée maximale</div>
        <Segmented value={state.profile.sessionDurationMin}
          onChange={(sessionDurationMin) => dispatch({ type: 'patchProfile', patch: { sessionDurationMin } })}
          options={[30, 45, 60, 75, 90].map((n) => ({ value: n, label: `${n} min` }))} />
      </div>
    </div>
  );
}

function BudgetEditor() {
  const { state, plan, dispatch } = useApp();
  const budget = state.profile.weeklyBudget;
  const over = plan.shoppingList.total - budget;

  return (
    <div className="stack">
      <Card className="card-ink center">
        <div className="display num" style={{ fontSize: 32 }}>{num(budget)} €</div>
        <div className="xs dim" style={{ marginTop: 4 }}>{eur(budget / 7)} par jour</div>
      </Card>
      <input type="range" min={20} max={200} step={5} value={budget}
        onChange={(e) => dispatch({ type: 'patchProfile', patch: { weeklyBudget: Number(e.target.value) } })} />
      <Field label="Saisie manuelle">
        <div className="suffix">
          <input type="number" value={budget}
            onChange={(e) => dispatch({ type: 'patchProfile', patch: { weeklyBudget: Number(e.target.value) } })} />
          <span>€ / semaine</span>
        </div>
      </Field>
      <Card className={over > 0 ? 'card-notice' : 'card-flat'}>
        <div className="row-between sm">
          <span className="dim">Panier recalculé</span>
          <span className="strong num">{eur(plan.shoppingList.total)}</span>
        </div>
        <div className="xs dim" style={{ marginTop: 6 }}>
          Modifier le budget régénère immédiatement les repas et la liste de courses.
        </div>
      </Card>
    </div>
  );
}

function DietEditor() {
  const { state, dispatch } = useApp();
  const toggleRestriction = (r: RestrictionId) => {
    const set = new Set(state.profile.restrictions);
    if (set.has(r)) set.delete(r);
    else set.add(r);
    dispatch({ type: 'patchProfile', patch: { restrictions: [...set] } });
  };

  return (
    <div className="stack">
      <div>
        <div className="card-title">Régime</div>
        <Segmented value={state.profile.diet}
          onChange={(diet) => dispatch({ type: 'patchProfile', patch: { diet } })}
          options={(Object.keys(DIET_LABELS) as (keyof typeof DIET_LABELS)[])
            .map((d) => ({ value: d, label: DIET_LABELS[d] }))} />
      </div>
      <div>
        <div className="card-title">Restrictions</div>
        <div className="row wrap">
          {(Object.keys(RESTRICTION_LABELS) as RestrictionId[]).map((r) => (
            <Chip key={r} selected={state.profile.restrictions.includes(r)} onClick={() => toggleRestriction(r)}>
              {RESTRICTION_LABELS[r]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="card-title">Repas par jour</div>
        <Segmented value={state.profile.mealsPerDay}
          onChange={(mealsPerDay) => dispatch({ type: 'patchProfile', patch: { mealsPerDay } })}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
      </div>
      <div>
        <div className="card-title">Petit-déjeuner</div>
        <Segmented value={state.profile.breakfast ? 'oui' : 'non'}
          onChange={(v) => dispatch({ type: 'patchProfile', patch: { breakfast: v === 'oui' } })}
          options={[{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }]} />
      </div>
      {state.profile.dislikedFoods.length + state.profile.allergies.length > 0 && (
        <Empty
          title={`${state.profile.dislikedFoods.length} refus · ${state.profile.allergies.length} allergies ou intolérances`}
          hint="Ces aliments sont exclus de toutes les recettes proposées."
        />
      )}
    </div>
  );
}


/**
 * Changer le départ après coup. Le plan suit : les jours planifiés partent du
 * nouveau jour choisi.
 */
function StartEditor({ onDone }: { onDone: () => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const [date, setDate] = useState(state.startDate ?? startOptions()[0].date);

  const jours = Array.from({ length: plan.limits.mealPlanDays }, (_, i) =>
    DAY_NAMES[(weekdayOf(date) + i) % 7].toLowerCase()).join(', ');

  return (
    <div className="stack">
      <div className="stack-sm">
        {startOptions().map((o) => (
          <button key={o.id} type="button" className="option" aria-pressed={date === o.date}
            onClick={() => setDate(o.date)}>
            <span className="option-mark">{date === o.date && <IconCheck />}</span>
            <span className="grow">
              <span className="strong" style={{ display: 'block' }}>{o.label}</span>
              <span className="sm dim">{longDate(o.date)}</span>
            </span>
          </button>
        ))}
      </div>
      <Field label="Ou une autre date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Card className="card-flat">
        <div className="card-title">Jours planifiés</div>
        <p className="sm muted">{jours}.</p>
      </Card>
      <button type="button" className="btn btn-primary btn-block"
        onClick={() => {
          dispatch({ type: 'setStartDate', date });
          notify('Départ déplacé — plan régénéré');
          onDone();
        }}>
        Enregistrer
      </button>
    </div>
  );
}
