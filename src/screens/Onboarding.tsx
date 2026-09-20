import { useMemo, useState } from 'react';
import type { DayIndex, EquipmentId, PantryItem, Profile, RestrictionId } from '../types';
import { useApp } from '../store/AppContext';
import { EMPTY_PROFILE } from '../store/state';
import { GOAL_LIST, ACTIVITY_LABELS } from '../data/goals';
import { GYMS, EQUIPMENT_LABELS, ALL_EQUIPMENT } from '../data/gyms';
import { STORES } from '../data/stores';
import { FOODS } from '../data/foods';
import { computeTargets } from '../engine/nutrition';
import { CATEGORY_LABELS, CATEGORY_ORDER, formatQty } from '../engine/shopping';
import { DIET_LABELS, RESTRICTION_LABELS } from '../engine/filters';
import { DAY_NAMES } from '../engine/training';
import { Card, Checkbox, Chip, Field, Option, Segmented, eur, num } from '../components/ui';
import { BrandMark } from '../components/BrandMark';
import { IconBack, IconSpark } from '../components/icons';

/**
 * Onboarding : une question principale par écran, barre de progression,
 * validation à chaque étape. Le moteur ne démarre qu'une fois complet.
 */

const COMMON_PANTRY = [
  'riz_blanc', 'pates', 'huile_olive', 'epices', 'whey', 'oeuf', 'flocons_avoine',
  'lait_demi', 'poulet_filet', 'curry', 'miel', 'moutarde', 'sauce_soja', 'cafe',
];

export default function Onboarding() {
  const { dispatch } = useApp();
  const [step, setStep] = useState(-1);
  const [p, setP] = useState<Profile>({ ...EMPTY_PROFILE });
  const [pantry, setPantry] = useState<PantryItem[]>([]);

  const patch = (x: Partial<Profile>) => setP((prev) => ({ ...prev, ...x }));

  const gym = GYMS.find((g) => g.id === p.gymId);
  const needsEquipment = Boolean(gym?.custom);

  const steps = useMemo(() => {
    const list: StepDef[] = [
      { id: 'goal', render: () => <GoalStep p={p} patch={patch} />, valid: () => true },
      { id: 'body', render: () => <BodyStep p={p} patch={patch} />, valid: () => p.age > 0 && p.heightCm > 0 && p.weightKg > 0 },
      { id: 'activity', render: () => <ActivityStep p={p} patch={patch} />, valid: () => true },
      { id: 'level', render: () => <LevelStep p={p} patch={patch} />, valid: () => true },
      { id: 'gym', render: () => <GymStep p={p} patch={patch} />, valid: () => true },
    ];
    if (needsEquipment) {
      list.push({
        id: 'equipment',
        render: () => <EquipmentStep p={p} patch={patch} />,
        valid: () => p.customEquipment.length > 0,
      });
    }
    list.push(
      { id: 'availability', render: () => <AvailabilityStep p={p} patch={patch} />, valid: () => p.availableDays.length > 0 },
      { id: 'store', render: () => <StoreStep p={p} patch={patch} />, valid: () => true },
      { id: 'budget', render: () => <BudgetStep p={p} patch={patch} />, valid: () => p.weeklyBudget > 0 },
      { id: 'diet', render: () => <DietStep p={p} patch={patch} />, valid: () => true },
      { id: 'foods', render: () => <FoodPrefsStep p={p} patch={patch} />, valid: () => true },
      { id: 'pantry', render: () => <PantryStep pantry={pantry} setPantry={setPantry} />, valid: () => true },
      { id: 'recap', render: () => <RecapStep p={p} pantry={pantry} />, valid: () => true },
    );
    return list;
  }, [p, pantry, needsEquipment]);

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  if (step < 0) {
    return <Welcome onStart={() => setStep(0)} onDemo={() => dispatch({ type: 'loadDemo' })} />;
  }

  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ paddingTop: 22 }}>
        <div className="row" style={{ marginBottom: 16 }}>
          <button
            type="button" className="icon-btn" aria-label="Retour"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={step === 0 ? { opacity: 0.35 } : undefined}
          >
            <IconBack />
          </button>
          <div className="grow steps">
            {steps.map((s, i) => <i key={s.id} className={i <= step ? 'done' : ''} />)}
          </div>
          <span className="xs dim num">{step + 1}/{steps.length}</span>
        </div>
      </div>

      <div key={current.id} style={{ animation: 'screen-in 0.28s var(--ease)' }}>
        {current.render()}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560, padding: '14px 20px calc(18px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(transparent, var(--ground) 26%)',
      }}>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!current.valid()}
          onClick={() => {
            if (isLast) dispatch({ type: 'completeOnboarding', profile: p, pantry });
            else setStep((s) => s + 1);
          }}
        >
          {isLast ? 'Générer ma semaine' : 'Continuer'}
        </button>
      </div>
    </div>
  );
}

interface StepDef {
  id: string;
  render: () => JSX.Element;
  valid: () => boolean;
}

interface StepProps {
  p: Profile;
  patch: (x: Partial<Profile>) => void;
}

function Head({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 26, lineHeight: 1.15 }}>{title}</h1>
      {hint && <p className="sm muted" style={{ marginTop: 8 }}>{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- écrans */

function Welcome({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', gap: 28 }}>
      <div>
        <div className="badge badge-ink" style={{ marginBottom: 18 }}>
          <IconSpark size={13} /> Planification déterministe
        </div>
        <h1 className="display">Ton objectif,<br />ta salle,<br />ton supermarché,<br />ton budget.</h1>
        <p className="muted" style={{ marginTop: 18, fontSize: 17, lineHeight: 1.5 }}>
          Toute ta semaine est planifiée : calories, macros, séances, repas,
          recettes, quantités, liste de courses et prix.
        </p>
      </div>
      <div className="stack">
        <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
          Commencer
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onDemo}>
          Essayer avec le profil de démonstration
        </button>
      </div>
    </div>
  );
}

function GoalStep({ p, patch }: StepProps) {
  return (
    <>
      <Head title="Quel est ton objectif ?" />
      <div className="stack-sm">
        {GOAL_LIST.map((g) => (
          <Option
            key={g.id}
            selected={p.goal === g.id}
            onClick={() => patch({ goal: g.id })}
            title={g.label}
            subtitle={g.description}
          />
        ))}
      </div>
    </>
  );
}

function BodyStep({ p, patch }: StepProps) {
  return (
    <>
      <Head title="Parle-nous de toi" hint="Ces informations servent à estimer tes besoins énergétiques." />
      <div className="stack">
        <Field label="Prénom (facultatif)">
          <input type="text" value={p.firstName} placeholder="Alex"
            onChange={(e) => patch({ firstName: e.target.value })} />
        </Field>
        <Field label="Sexe">
          <Segmented
            value={p.sex}
            onChange={(sex) => patch({ sex })}
            options={[{ value: 'homme' as const, label: 'Homme' }, { value: 'femme' as const, label: 'Femme' }]}
          />
        </Field>
        <div className="field-row">
          <Field label="Âge">
            <div className="suffix">
              <input type="number" inputMode="numeric" value={p.age || ''} min={14} max={99}
                onChange={(e) => patch({ age: Number(e.target.value) })} />
              <span>ans</span>
            </div>
          </Field>
          <Field label="Taille">
            <div className="suffix">
              <input type="number" inputMode="numeric" value={p.heightCm || ''} min={120} max={230}
                onChange={(e) => patch({ heightCm: Number(e.target.value) })} />
              <span>cm</span>
            </div>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Poids actuel">
            <div className="suffix">
              <input type="number" inputMode="decimal" step="0.1" value={p.weightKg || ''}
                onChange={(e) => patch({ weightKg: Number(e.target.value) })} />
              <span>kg</span>
            </div>
          </Field>
          <Field label="Poids objectif">
            <div className="suffix">
              <input type="number" inputMode="decimal" step="0.1" value={p.targetWeightKg || ''}
                onChange={(e) => patch({ targetWeightKg: Number(e.target.value) })} />
              <span>kg</span>
            </div>
          </Field>
        </div>
      </div>
    </>
  );
}

function ActivityStep({ p, patch }: StepProps) {
  return (
    <>
      <Head title="Ton quotidien hors entraînement ?" hint="Les séances sont comptées séparément." />
      <div className="stack-sm">
        {(Object.keys(ACTIVITY_LABELS) as (keyof typeof ACTIVITY_LABELS)[]).map((a) => {
          const [title, sub] = ACTIVITY_LABELS[a].split(' — ');
          return (
            <Option key={a} selected={p.activity === a} onClick={() => patch({ activity: a })}
              title={title} subtitle={sub} />
          );
        })}
      </div>
    </>
  );
}

function LevelStep({ p, patch }: StepProps) {
  return (
    <>
      <Head title="Ton niveau en musculation ?" />
      <div className="stack-sm">
        <Option selected={p.level === 'debutant'} onClick={() => patch({ level: 'debutant' })}
          title="Débutant" subtitle="Moins d'un an de pratique régulière." />
        <Option selected={p.level === 'intermediaire'} onClick={() => patch({ level: 'intermediaire' })}
          title="Intermédiaire" subtitle="Technique acquise sur les mouvements de base." />
        <Option selected={p.level === 'avance'} onClick={() => patch({ level: 'avance' })}
          title="Avancé" subtitle="Plusieurs années, progression maîtrisée." />
      </div>
      <div style={{ marginTop: 20 }}>
        <Field label="Ancienneté en musculation" hint={`${p.experienceMonths} mois`}>
          <input type="range" min={0} max={120} step={1} value={p.experienceMonths}
            onChange={(e) => patch({ experienceMonths: Number(e.target.value) })} />
        </Field>
      </div>
    </>
  );
}

function GymStep({ p, patch }: StepProps) {
  return (
    <>
      <Head title="Où t'entraînes-tu ?" hint="Le programme n'utilisera que le matériel réellement disponible." />
      <div className="stack-sm">
        {GYMS.map((g) => (
          <Option
            key={g.id}
            selected={p.gymId === g.id}
            onClick={() => patch({ gymId: g.id, customEquipment: g.custom ? p.customEquipment : [] })}
            title={g.name}
            subtitle={g.custom ? 'Tu choisis ton matériel à l\'étape suivante' : `${g.equipment.length} équipements référencés`}
            leading={<BrandMark name={g.name} color={g.color} logo={g.logo} quiet={g.custom} />}
          />
        ))}
      </div>
    </>
  );
}

function EquipmentStep({ p, patch }: StepProps) {
  const toggle = (id: EquipmentId) => {
    const set = new Set(p.customEquipment);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch({ customEquipment: [...set] });
  };
  return (
    <>
      <Head title="De quoi disposes-tu ?" hint="Sélectionne tout ce à quoi tu as accès." />
      <div className="row wrap">
        {ALL_EQUIPMENT.filter((e) => e !== 'poids_corps').map((e) => (
          <Chip key={e} selected={p.customEquipment.includes(e)} onClick={() => toggle(e)}>
            {EQUIPMENT_LABELS[e]}
          </Chip>
        ))}
      </div>
      <p className="xs dim" style={{ marginTop: 16 }}>
        Les exercices au poids du corps sont toujours disponibles.
      </p>
    </>
  );
}

function AvailabilityStep({ p, patch }: StepProps) {
  const toggleDay = (d: DayIndex) => {
    const set = new Set(p.availableDays);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    patch({ availableDays: [...set].sort((a, b) => a - b) as DayIndex[] });
  };
  return (
    <>
      <Head title="Combien de fois par semaine ?" />
      <Segmented
        value={p.sessionsPerWeek}
        onChange={(sessionsPerWeek) => patch({ sessionsPerWeek })}
        options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} séances` }))}
      />

      <div style={{ marginTop: 26 }}>
        <div className="card-title">Jours disponibles</div>
        <div className="row wrap">
          {DAY_NAMES.map((name, i) => (
            <Chip key={name} selected={p.availableDays.includes(i as DayIndex)}
              onClick={() => toggleDay(i as DayIndex)}>
              {name.slice(0, 3)}
            </Chip>
          ))}
        </div>
        {p.availableDays.length < p.sessionsPerWeek && (
          <p className="xs notice" style={{ marginTop: 10 }}>
            Tu as choisi {p.sessionsPerWeek} séances pour {p.availableDays.length} jour
            {p.availableDays.length > 1 ? 's' : ''} : certaines séances seront regroupées.
          </p>
        )}
      </div>

      <div style={{ marginTop: 26 }}>
        <div className="card-title">Durée maximale d'une séance</div>
        <Segmented
          value={p.sessionDurationMin}
          onChange={(sessionDurationMin) => patch({ sessionDurationMin })}
          options={[
            { value: 30, label: '30 min' }, { value: 45, label: '45 min' },
            { value: 60, label: '60 min' }, { value: 75, label: '75 min' },
            { value: 90, label: '90 min+' },
          ]}
        />
      </div>
    </>
  );
}

function StoreStep({ p, patch }: StepProps) {
  return (
    <>
      <Head title="Où fais-tu tes courses ?" hint="Les prix et les formats d'achat suivent l'enseigne choisie." />
      <div className="stack-sm">
        {STORES.map((s) => (
          <Option key={s.id} selected={p.storeId === s.id} onClick={() => patch({ storeId: s.id })}
            title={s.name}
            subtitle={s.id === 'autre' ? 'Prix de référence, sans indice d\'enseigne' : undefined}
            leading={<BrandMark name={s.name} color={s.color} logo={s.logo} quiet={s.id === 'autre'} />}
          />
        ))}
      </div>
      <p className="xs dim" style={{ marginTop: 16 }}>
        La gestion de plusieurs enseignes simultanées arrivera dans une version ultérieure.
      </p>
    </>
  );
}

function BudgetStep({ p, patch }: StepProps) {
  return (
    <>
      <Head title="Ton budget alimentaire par semaine ?" hint="C'est une contrainte réelle du plan : les repas s'y adaptent." />
      <div className="card card-ink center" style={{ padding: '26px 18px' }}>
        <div className="display num">{num(p.weeklyBudget)} €</div>
        <div className="sm muted" style={{ marginTop: 6 }}>
          soit environ {eur(p.weeklyBudget / 7)} par jour
        </div>
      </div>
      <div style={{ marginTop: 22 }}>
        <input type="range" min={20} max={200} step={5} value={p.weeklyBudget}
          onChange={(e) => patch({ weeklyBudget: Number(e.target.value) })} />
        <div className="row-between xs dim" style={{ marginTop: 6 }}>
          <span>20 €</span><span>200 €</span>
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <Field label="Saisie manuelle">
          <div className="suffix">
            <input type="number" inputMode="numeric" min={10} max={500} value={p.weeklyBudget}
              onChange={(e) => patch({ weeklyBudget: Number(e.target.value) })} />
            <span>€ / semaine</span>
          </div>
        </Field>
      </div>
    </>
  );
}

function DietStep({ p, patch }: StepProps) {
  const toggleRestriction = (r: RestrictionId) => {
    const set = new Set(p.restrictions);
    if (set.has(r)) set.delete(r);
    else set.add(r);
    patch({ restrictions: [...set] });
  };
  return (
    <>
      <Head title="Comment manges-tu ?" />
      <div className="stack">
        <div>
          <div className="card-title">Nombre de repas par jour</div>
          <Segmented
            value={p.mealsPerDay}
            onChange={(mealsPerDay) => patch({ mealsPerDay })}
            options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
          />
        </div>
        <div>
          <div className="card-title">Petit-déjeuner</div>
          <Segmented
            value={p.breakfast ? 'oui' : 'non'}
            onChange={(v) => patch({ breakfast: v === 'oui' })}
            options={[{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }]}
          />
        </div>
        <div>
          <div className="card-title">Régime alimentaire</div>
          <div className="stack-sm">
            {(Object.keys(DIET_LABELS) as (keyof typeof DIET_LABELS)[]).map((d) => (
              <Option key={d} selected={p.diet === d} onClick={() => patch({ diet: d })} title={DIET_LABELS[d]} />
            ))}
          </div>
        </div>
        <div>
          <div className="card-title">Restrictions (cumulables)</div>
          <div className="row wrap">
            {(Object.keys(RESTRICTION_LABELS) as RestrictionId[]).map((r) => (
              <Chip key={r} selected={p.restrictions.includes(r)} onClick={() => toggleRestriction(r)}>
                {RESTRICTION_LABELS[r]}
              </Chip>
            ))}
          </div>
          {(p.restrictions.includes('halal') || p.restrictions.includes('casher')) && (
            <p className="xs dim" style={{ marginTop: 10 }}>
              Les viandes proposées doivent être achetées certifiées : l'application
              signale les produits concernés mais ne peut pas garantir la certification.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function FoodPrefsStep({ p, patch }: StepProps) {
  const [tab, setTab] = useState<'likes' | 'dislikes' | 'allergies'>('likes');
  const key = tab === 'likes' ? 'likedFoods' : tab === 'dislikes' ? 'dislikedFoods' : 'allergies';
  const selected = p[key];

  const toggle = (id: string) => {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch({ [key]: [...set] } as Partial<Profile>);
  };

  return (
    <>
      <Head
        title="Tes préférences alimentaires"
        hint="Facultatif. Les aliments marqués comme refusés, allergènes ou mal tolérés sont exclus de toutes les recettes."
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'likes' as const, label: `J'aime (${p.likedFoods.length})` },
          { value: 'dislikes' as const, label: `Je refuse (${p.dislikedFoods.length})` },
          { value: 'allergies' as const, label: `Allergies / intolérances (${p.allergies.length})` },
        ]}
      />
      <div className="stack" style={{ marginTop: 18 }}>
        {CATEGORY_ORDER.map((cat) => {
          const foods = FOODS.filter((f) => f.category === cat);
          if (!foods.length) return null;
          return (
            <div key={cat}>
              <div className="card-title">{CATEGORY_LABELS[cat]}</div>
              <div className="row wrap">
                {foods.map((f) => (
                  <Chip key={f.id} selected={selected.includes(f.id)} onClick={() => toggle(f.id)}>
                    {f.name}
                  </Chip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PantryStep({
  pantry, setPantry,
}: { pantry: PantryItem[]; setPantry: (p: PantryItem[]) => void }) {
  const has = (id: string) => pantry.some((x) => x.foodId === id);
  const qtyOf = (id: string) => pantry.find((x) => x.foodId === id)?.qty ?? 0;

  const toggle = (id: string) => {
    if (has(id)) setPantry(pantry.filter((x) => x.foodId !== id));
    else {
      const food = FOODS.find((f) => f.id === id)!;
      const preset = food.unit === 'piece' ? 6 : food.unit === 'ml' ? 500 : 500;
      setPantry([...pantry, { foodId: id, qty: preset }]);
    }
  };

  const setQty = (id: string, qty: number) =>
    setPantry(pantry.map((x) => (x.foodId === id ? { ...x, qty: Math.max(0, qty) } : x)));

  return (
    <>
      <Head
        title="J'ai déjà ça chez moi"
        hint="Ces quantités seront consommées avant d'ajouter quoi que ce soit à ta liste de courses."
      />
      <div className="stack-sm">
        {COMMON_PANTRY.map((id) => {
          const food = FOODS.find((f) => f.id === id);
          if (!food) return null;
          return (
            <div key={id}>
              <Checkbox checked={has(id)} onChange={() => toggle(id)}>
                <span className="row-between">
                  <span>{food.name}</span>
                  {has(id) && <span className="xs dim">{formatQty(qtyOf(id), food.unit)}</span>}
                </span>
              </Checkbox>
              {has(id) && (
                <div className="row" style={{ marginTop: 8, marginLeft: 14 }}>
                  <input
                    type="number" inputMode="numeric" value={qtyOf(id)} min={0}
                    onChange={(e) => setQty(id, Number(e.target.value))}
                    style={{ maxWidth: 130 }}
                  />
                  <span className="sm dim">{food.unit === 'piece' ? 'pièces' : food.unit}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="xs dim" style={{ marginTop: 16 }}>
        Tu pourras compléter ton garde-manger depuis l'onglet Nutrition.
      </p>
    </>
  );
}

function RecapStep({ p, pantry }: { p: Profile; pantry: PantryItem[] }) {
  const t = computeTargets(p);
  const gym = GYMS.find((g) => g.id === p.gymId);
  const store = STORES.find((s) => s.id === p.storeId);

  return (
    <>
      <Head title="Ton objectif quotidien" hint="Tu pourras ajuster ces valeurs à tout moment." />
      <Card className="card-ink">
        <div className="display num">{num(t.kcal)} <span style={{ fontSize: 20 }}>kcal</span></div>
        <div className="macro-grid" style={{ marginTop: 20 }}>
          <div><div className="metric num">{t.protein}<span className="sm dim"> g</span></div><div className="xs dim">Protéines</div></div>
          <div><div className="metric num">{t.carbs}<span className="sm dim"> g</span></div><div className="xs dim">Glucides</div></div>
          <div><div className="metric num">{t.fat}<span className="sm dim"> g</span></div><div className="xs dim">Lipides</div></div>
        </div>
        <div className="divider" style={{ margin: '18px 0 14px' }} />
        <div className="row-between sm muted">
          <span>Métabolisme de base</span><span className="num">{num(t.bmr)} kcal</span>
        </div>
        <div className="row-between sm muted" style={{ marginTop: 4 }}>
          <span>Dépense estimée</span><span className="num">{num(t.tdee)} kcal</span>
        </div>
      </Card>

      <div style={{ height: 14 }} />
      <Card className="card-flat">
        <div className="card-title">Ce que le moteur va construire</div>
        <div className="stack-sm sm">
          <div className="row-between">
            <span className="dim">Salle</span>
            <span className="row" style={{ gap: 8 }}>
              {gym && <BrandMark name={gym.name} color={gym.color} logo={gym.logo} size={22} quiet={gym.custom} />}
              <span className="strong">{gym?.name}</span>
            </span>
          </div>
          <div className="row-between"><span className="dim">Séances</span><span className="strong">{p.sessionsPerWeek} × {p.sessionDurationMin} min</span></div>
          <div className="row-between">
            <span className="dim">Magasin</span>
            <span className="row" style={{ gap: 8 }}>
              {store && <BrandMark name={store.name} color={store.color} logo={store.logo} size={22} quiet={store.id === 'autre'} />}
              <span className="strong">{store?.name}</span>
            </span>
          </div>
          <div className="row-between"><span className="dim">Budget</span><span className="strong num">{eur(p.weeklyBudget)} / semaine</span></div>
          <div className="row-between"><span className="dim">Repas</span><span className="strong">{p.mealsPerDay} par jour</span></div>
          <div className="row-between"><span className="dim">Déjà en stock</span><span className="strong">{pantry.length} aliment{pantry.length > 1 ? 's' : ''}</span></div>
        </div>
      </Card>

      <p className="xs dim" style={{ marginTop: 16, lineHeight: 1.5 }}>
        Ces valeurs sont des estimations calculées à partir de formules de référence
        (Mifflin-St Jeor). Elles ne remplacent pas l'avis d'un professionnel de santé
        ou de nutrition.
      </p>
    </>
  );
}
