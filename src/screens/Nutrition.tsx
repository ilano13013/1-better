import { useMemo, useState } from 'react';
import type { DayIndex, Meal, PantryItem } from '../types';
import { useApp } from '../store/AppContext';
import { PlanSheet, PlusLock } from '../components/Plus';
import { isoForDay, todayIndex } from '../store/state';
import { FOODS, getFood } from '../data/foods';
import { getRecipe } from '../data/recipes';
import { getStore } from '../data/stores';
import { SLOT_LABELS } from '../engine/nutrition';
import { DAY_NAMES, DAY_SHORT } from '../engine/training';
import { dayPlanFor, rankRecipes } from '../engine/mealPlan';
import { entriesForDay, intakeTotals, isMealLogged } from '../engine/intake';
import { IntakeSheet } from '../components/IntakeSheet';
import { basketFromPlan } from '../engine/basket';
import { ingredientQty, recipeCost, recipeMacros, resolveRecipe } from '../engine/recipes';
import { filterFromProfile, needsCertification } from '../engine/filters';
import { CATEGORY_LABELS, CATEGORY_ORDER, formatQty } from '../engine/shopping';
import { Bar, Card, Checkbox, Empty, Sheet, eur, num, type BarTone } from '../components/ui';
import { IconCart, IconCheck, IconChevron, IconClock, IconFlame, IconInfo, IconPlus, IconSwap, IconTrash } from '../components/icons';
import { RecipePhotoBanner, RecipeThumb } from '../components/RecipePhoto';
import type { Screen } from '../App';

/**
 * Écran Nutrition : repas de la journée, fiche recette complète,
 * remplacement de repas et gestion du garde-manger.
 */
export default function Nutrition({ go }: { go: (s: Screen) => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const [day, setDay] = useState<DayIndex>(todayIndex());
  const [openMeal, setOpenMeal] = useState<number | null>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [plans, setPlans] = useState(false);
  const [adding, setAdding] = useState(false);

  // Le journal porte sur une date réelle, pas sur un rang dans la semaine.
  const isoDay = isoForDay(day);
  const logged = entriesForDay(state.intake, isoDay);
  const consumed = intakeTotals(logged);

  const toggleMeal = (meal: Meal) => {
    const existing = logged.find(
      (e) => e.kind === 'meal' && e.slot === meal.slot && e.recipeId === meal.recipeId,
    );
    if (existing) {
      dispatch({ type: 'removeIntake', id: existing.id });
      return;
    }
    dispatch({
      type: 'logIntake',
      entry: {
        id: `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        date: isoDay,
        kind: 'meal',
        label: getRecipe(meal.recipeId).name,
        recipeId: meal.recipeId,
        slot: meal.slot,
        macros: meal.macros,
        at: new Date().toISOString(),
      },
    });
  };

  const dayPlan = dayPlanFor(plan.mealPlan, day);
  const store = getStore(state.profile.storeId);
  const targets = plan.targets;

  // Déficit protéique moyen sur la semaine, exprimé en part de la cible.
  const proteinShortfall = useMemo(() => {
    const avg = plan.mealPlan.days.reduce((s, d) => s + d.totals.protein, 0) / plan.mealPlan.days.length;
    return targets.protein > 0 ? Math.max(0, (targets.protein - avg) / targets.protein) : 0;
  }, [plan.mealPlan, targets.protein]);

  const dayCost = useMemo(() => {
    let total = 0;
    for (const meal of dayPlan?.meals ?? []) {
      total += recipeCost(resolveRecipe(getRecipe(meal.recipeId), state.foodSwaps), store.id, meal.scale);
    }
    return Math.round(total * 100) / 100;
  }, [dayPlan, store.id, state.foodSwaps]);

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <div className="eyebrow">{DAY_NAMES[day]}</div>
          <h1>Nutrition</h1>
        </div>
        <button type="button" className="btn btn-sm btn-primary" data-tour="courses"
          onClick={() => go('shopping')}>
          <IconCart size={15} /> Courses
        </button>
      </div>

      <div className="scroller" style={{ marginBottom: 16 }}>
        {DAY_SHORT.map((label, i) => (
          <button
            key={label} type="button" className="card"
            onClick={() => setDay(i as DayIndex)}
            style={{
              width: 62, padding: '11px 6px', textAlign: 'center', cursor: 'pointer',
              borderColor: day === i ? 'var(--invert-bg)' : undefined,
              background: day === i ? 'var(--invert-bg)' : undefined,
              color: day === i ? 'var(--invert-fg)' : undefined,
            }}
          >
            <div className="xs dim">{label}</div>
            <div className="sm strong num" style={{ marginTop: 3 }}>
              {dayPlanFor(plan.mealPlan, i as DayIndex)
                ? `${Math.round(dayPlanFor(plan.mealPlan, i as DayIndex)!.totals.kcal / 100) / 10}k`
                : '—'}
            </div>
          </button>
        ))}
      </div>

      {!dayPlan ? (
        <PlusLock
          title={`${DAY_NAMES[day]} n'est pas planifié`}
          hint="La formule gratuite planifie les trois premiers jours de la semaine."
          onOpen={() => setPlans(true)}
        />
      ) : (
      <div className="stack">
        {/* Totaux du jour */}
        <Card className="card-ink">
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Total de la journée</div>
              <div className="display num" style={{ fontSize: 34, marginTop: 4 }}>
                {num(dayPlan.totals.kcal)} <span style={{ fontSize: 16 }}>kcal</span>
              </div>
            </div>
            <div className="center">
              <div className="sm num strong">{eur(dayCost)}</div>
              <div className="xs dim">coût estimé</div>
            </div>
          </div>
          <div className="xs dim" style={{ marginTop: 2 }}>objectif {num(targets.kcal)} kcal</div>

          <div className="macro-grid" style={{ marginTop: 18 }}>
            <MacroCell label="Protéines" value={dayPlan.totals.protein} target={targets.protein} />
            <MacroCell label="Glucides" value={dayPlan.totals.carbs} target={targets.carbs} tone="muted" />
            <MacroCell label="Lipides" value={dayPlan.totals.fat} target={targets.fat} tone="hatch" />
          </div>
        </Card>

        {/* Déficit protéique persistant : on en explique la cause */}
        {proteinShortfall > 0.1 && (
          <Card className="card-notice">
            <div className="strong">Objectif protéines difficile à tenir</div>
            <p className="sm muted" style={{ marginTop: 8 }}>
              Le plan atteint {Math.round((1 - proteinShortfall) * 100)} % de ta cible
              protéique sur la semaine. Avec {eur(state.profile.weeklyBudget)} par semaine
              chez {store.name}, les sources de protéines nécessaires ne rentrent pas
              dans l'enveloppe.
            </p>
            <p className="sm muted" style={{ marginTop: 8 }}>
              Trois leviers : augmenter le budget, cocher ce que tu as déjà chez toi,
              ou abaisser la cible protéique depuis ton profil.
            </p>
          </Card>
        )}

        {/* Créneaux impossibles à honorer : signalés, jamais escamotés */}
        {dayPlan.unmetSlots.length > 0 && (
          <Card className="card-notice">
            <div className="strong">
              {dayPlan.unmetSlots.length === 1 ? 'Un repas n\'a pas pu être planifié' : 'Des repas n\'ont pas pu être planifiés'}
            </div>
            <p className="sm muted" style={{ marginTop: 8 }}>
              Aucune recette ne satisfait à la fois ton régime, tes restrictions et
              les produits disponibles chez {store.name} pour :{' '}
              {dayPlan.unmetSlots.map((s) => SLOT_LABELS[s].toLowerCase()).join(', ')}.
              Assouplis une restriction, retire un aliment refusé ou change d'enseigne.
            </p>
          </Card>
        )}

        {/* Journal du jour */}
        <div data-tour="journal">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>Journal du jour</div>
            <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
              <IconPlus size={14} /> Aliment
            </button>
          </div>
          <Card className="card-flat">
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <div>
                <div className="metric num">{num(consumed.kcal)}</div>
                <div className="xs dim">kcal consommées sur {num(targets.kcal)}</div>
              </div>
              {logged.length === 0 && (
                <span className="xs dim" style={{ textAlign: 'right', maxWidth: 150 }}>
                  Facultatif : le plan reste valable sans rien pointer.
                </span>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <Bar value={consumed.kcal} max={targets.kcal} />
            </div>
            <div className="macro-grid" style={{ marginTop: 16 }}>
              <MacroCell label="Protéines" value={consumed.protein} target={targets.protein} />
              <MacroCell label="Glucides" value={consumed.carbs} target={targets.carbs} tone="muted" />
              <MacroCell label="Lipides" value={consumed.fat} target={targets.fat} tone="hatch" />
            </div>

            {logged.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="divider" style={{ marginBottom: 6 }} />
                {logged.map((e) => (
                  <div key={e.id} className="list-row">
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="sm truncate" style={{ display: 'block' }}>{e.label}</span>
                      <span className="xs dim">
                        {e.grams ? `${e.grams} g · ` : ''}{num(e.macros.kcal)} kcal
                      </span>
                    </span>
                    <button type="button" className="icon-btn"
                      onClick={() => dispatch({ type: 'removeIntake', id: e.id })}
                      aria-label={`Retirer ${e.label}`}>
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Repas */}
        {dayPlan.meals.map((meal, index) => (
          <MealCard
            key={`${meal.recipeId}-${index}`}
            meal={meal}
            swaps={state.foodSwaps}
            storeId={store.id}
            eaten={isMealLogged(state.intake, isoDay, meal.slot, meal.recipeId)}
            onEat={() => toggleMeal(meal)}
            onOpen={() => setOpenMeal(index)}
            onReplace={() => setReplacing(index)}
          />
        ))}

        <button type="button" className="btn btn-ghost btn-block" onClick={() => setPantryOpen(true)}>
          J'ai déjà ça chez moi ({state.pantry.length})
        </button>
      </div>
      )}

      {/* Fiche recette */}
      <Sheet
        open={openMeal !== null && dayPlan !== null}
        onClose={() => setOpenMeal(null)}
        title={openMeal !== null && dayPlan ? (
          <>
            <div className="card-title" style={{ margin: 0 }}>{SLOT_LABELS[dayPlan!.meals[openMeal].slot]}</div>
            <div className="strong">{getRecipe(dayPlan!.meals[openMeal].recipeId).name}</div>
          </>
        ) : ''}
      >
        {openMeal !== null && dayPlan && (
          <RecipeSheet
            meal={dayPlan!.meals[openMeal]}
            onReplace={() => { setReplacing(openMeal); setOpenMeal(null); }}
          />
        )}
      </Sheet>

      {/* Remplacement de repas */}
      <Sheet
        open={replacing !== null && dayPlan !== null}
        onClose={() => setReplacing(null)}
        title={<><div className="card-title" style={{ margin: 0 }}>Remplacer ce repas</div>
          <div className="strong">
            {replacing !== null && dayPlan ? SLOT_LABELS[dayPlan.meals[replacing].slot] : ''}
          </div></>}
      >
        {replacing !== null && dayPlan && (
          <MealAlternatives
            day={day}
            index={replacing}
            onPick={(recipeId) => {
              dispatch({ type: 'replaceMeal', day, index: replacing, recipeId });
              notify('Repas remplacé — macros et courses recalculées');
              setReplacing(null);
            }}
          />
        )}
      </Sheet>

      <PlanSheet open={plans} onClose={() => setPlans(false)} />
      <IntakeSheet open={adding} onClose={() => setAdding(false)} date={isoDay} />

      {/* Garde-manger */}
      <Sheet
        open={pantryOpen}
        onClose={() => setPantryOpen(false)}
        title={<div className="strong">J'ai déjà ça chez moi</div>}
      >
        <PantryEditor />
      </Sheet>
    </div>
  );
}

function MacroCell({
  label, value, target, tone = 'ink',
}: { label: string; value: number; target: number; tone?: BarTone }) {
  const gap = value - target;
  return (
    <div>
      <div className="strong num">{Math.round(value)}<span className="xs dim"> / {target} g</span></div>
      <div className="xs dim" style={{ marginBottom: 5 }}>{label}</div>
      <Bar value={value} max={target} tone={tone} />
      {Math.abs(gap) > target * 0.12 && (
        <div className={`xs ${gap < 0 ? 'notice' : 'dim'}`} style={{ marginTop: 4 }}>
          {gap > 0 ? '+' : ''}{Math.round(gap)} g
        </div>
      )}
    </div>
  );
}

function MealCard({
  meal, swaps, storeId, eaten, onEat, onOpen, onReplace,
}: {
  meal: Meal; swaps: Record<string, string>; storeId: string;
  eaten: boolean; onEat: () => void;
  onOpen: () => void; onReplace: () => void;
}) {
  const recipe = resolveRecipe(getRecipe(meal.recipeId), swaps);
  const cost = recipeCost(recipe, storeId, meal.scale);

  return (
    <Card>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <RecipeThumb recipe={recipe} size={58} />
        <button type="button" onClick={onOpen} className="grow"
          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <span className="badge">{SLOT_LABELS[meal.slot]}</span>
            {meal.scale !== 1 && <span className="badge badge-muted">×{meal.scale.toString().replace('.', ',')}</span>}
          </div>
          <div className="strong" style={{ fontSize: 17 }}>{recipe.name}</div>
          <div className="row xs dim wrap" style={{ marginTop: 8, gap: 12 }}>
            <span className="row" style={{ gap: 5 }}><IconFlame size={13} />{num(meal.macros.kcal)} kcal</span>
            <span>{meal.macros.protein} g P</span>
            <span>{meal.macros.carbs} g G</span>
            <span>{meal.macros.fat} g L</span>
          </div>
          <div className="row xs dim" style={{ marginTop: 6, gap: 12 }}>
            <span className="row" style={{ gap: 5 }}><IconClock size={12} />{recipe.prepTimeMin} min</span>
            <span>{eur(cost)} / portion</span>
          </div>
        </button>
        <div className="stack-sm" style={{ flex: 'none' }}>
          <button type="button" className="icon-btn" onClick={onReplace} aria-label="Remplacer ce repas">
            <IconSwap />
          </button>
          <button type="button" className="icon-btn" onClick={onOpen} aria-label="Voir la recette">
            <IconChevron size={14} />
          </button>
        </div>
      </div>

      <button type="button" className={`btn btn-sm btn-block eat-btn${eaten ? ' is-eaten' : ''}`}
        style={{ marginTop: 12 }} onClick={onEat} aria-pressed={eaten}>
        {eaten ? <><IconCheck size={13} /> Mangé</> : "J'ai mangé ce repas"}
      </button>
    </Card>
  );
}

function RecipeSheet({ meal, onReplace }: { meal: Meal; onReplace: () => void }) {
  const { state } = useApp();
  const recipe = resolveRecipe(getRecipe(meal.recipeId), state.foodSwaps);
  const macros = recipeMacros(recipe, meal.scale);
  const cost = recipeCost(recipe, state.profile.storeId, meal.scale);
  const filter = filterFromProfile(state.profile);

  return (
    <div className="stack">
      <RecipePhotoBanner recipe={recipe} />

      <div className="row wrap" style={{ gap: 8 }}>
        <span className="badge"><IconClock size={12} /> {recipe.prepTimeMin} min</span>
        <span className="badge"><IconFlame size={12} /> {num(macros.kcal)} kcal</span>
        <span className="badge">{eur(cost)} / portion</span>
      </div>

      <div className="macro-grid">
        {[['Protéines', macros.protein], ['Glucides', macros.carbs], ['Lipides', macros.fat]].map(([label, v]) => (
          <div key={label as string} className="card card-flat" style={{ padding: 12 }}>
            <div className="metric num" style={{ fontSize: 20 }}>{v as number} g</div>
            <div className="xs dim">{label as string}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="card-title">Ingrédients — portion ×{meal.scale.toString().replace('.', ',')}</div>
        <Card className="card-flat">
          {recipe.ingredients.map((ing) => {
            const food = getFood(ing.foodId);
            const qty = ingredientQty(ing, meal.scale);
            return (
              <div key={ing.foodId} className="list-row">
                <span className="grow sm">{food.name}</span>
                {needsCertification(food, filter) && (
                  <span className="badge badge-notice">à certifier</span>
                )}
                <span className="sm strong num">{formatQty(qty, food.unit)}</span>
              </div>
            );
          })}
        </Card>
      </div>

      <div>
        <div className="card-title">Préparation</div>
        <div className="stack-sm">
          {recipe.steps.map((step, i) => (
            <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span className="badge badge-ink" style={{ flex: 'none' }}>{i + 1}</span>
              <span className="sm muted">{step}</span>
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-block" onClick={onReplace}>
        <IconSwap size={15} /> Remplacer ce repas
      </button>
    </div>
  );
}

function MealAlternatives({
  day, index, onPick,
}: { day: DayIndex; index: number; onPick: (id: string) => void }) {
  const { state, plan } = useApp();
  const dayPlan = dayPlanFor(plan.mealPlan, day)!;
  const meal = dayPlan.meals[index];

  const options = useMemo(() => {
    // Panier reconstruit sans ce repas : le coût affiché est le coût réel
    // de l'échange, conditionnements compris.
    const basket = basketFromPlan(
      plan.mealPlan, state.profile.storeId, state.pantry, state.foodSwaps, { day, index },
    );
    const usedToday = new Set(dayPlan.meals.filter((_, i) => i !== index).map((m) => m.recipeId));
    return rankRecipes(state.profile, meal.slot, meal.macros, {
      basket,
      budget: state.profile.weeklyBudget,
      mealBudget: (state.profile.weeklyBudget / 7) / Math.max(1, dayPlan.meals.length),
    })
      .filter((r) => r.recipe.id !== meal.recipeId && !usedToday.has(r.recipe.id))
      .slice(0, 10);
  }, [plan.mealPlan, state.profile, state.pantry, state.foodSwaps, day, index, meal, dayPlan.meals]);

  if (options.length === 0) {
    return <Empty title="Aucune alternative" hint="Assouplis tes restrictions ou change d'enseigne." />;
  }

  return (
    <div className="stack-sm">
      <p className="sm dim" style={{ marginBottom: 6 }}>
        Recettes proches en calories et en protéines, compatibles avec tes
        restrictions et disponibles dans ton enseigne. Le coût indiqué est ce que
        l'échange ajoute réellement à ton panier.
      </p>
      {options.map((o) => {
        const deltaKcal = o.macros.kcal - meal.macros.kcal;
        const deltaP = o.macros.protein - meal.macros.protein;
        return (
          <button key={o.recipe.id} type="button" className="option" aria-pressed={false}
            onClick={() => onPick(o.recipe.id)}>
            <RecipeThumb recipe={o.recipe} size={44} />
            <span className="grow">
              <span className="strong" style={{ display: 'block' }}>{o.recipe.name}</span>
              <span className="row xs dim wrap" style={{ marginTop: 4, gap: 10 }}>
                <span>{num(o.macros.kcal)} kcal ({deltaKcal >= 0 ? '+' : ''}{deltaKcal})</span>
                <span>{o.macros.protein} g P ({deltaP >= 0 ? '+' : ''}{deltaP})</span>
                <span>{o.recipe.prepTimeMin} min</span>
              </span>
            </span>
            <span className={`badge ${o.cost === 0 ? 'badge-ink' : ''}`}>
              {o.cost === 0 ? 'déjà au panier' : `+${eur(o.cost)}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PantryEditor() {
  const { state, plan, dispatch } = useApp();
  const [query, setQuery] = useState('');

  const needed = new Set(plan.shoppingList.items.map((i) => i.foodId));
  const pantryMap = new Map(state.pantry.map((p) => [p.foodId, p.qty]));

  const setQty = (foodId: string, qty: number) => {
    const next: PantryItem[] = state.pantry.filter((p) => p.foodId !== foodId);
    if (qty > 0) next.push({ foodId, qty });
    dispatch({ type: 'setPantry', pantry: next });
  };

  const toggle = (foodId: string) => {
    if (pantryMap.has(foodId)) setQty(foodId, 0);
    else {
      const food = getFood(foodId);
      setQty(foodId, food.unit === 'piece' ? 6 : 500);
    }
  };

  const foods = FOODS.filter((f) =>
    query.trim() === ''
      ? needed.has(f.id) || pantryMap.has(f.id)
      : f.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="stack">
      <div className="card card-flat" style={{ padding: 12 }}>
        <div className="row xs" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="ink" style={{ flex: 'none', marginTop: 1 }}><IconInfo size={13} /></span>
          <span className="muted">
            Ces quantités sont consommées en priorité : elles sont déduites de la
            liste de courses avant tout nouvel achat.
          </span>
        </div>
      </div>

      <input type="text" value={query} placeholder="Chercher un aliment…"
        onChange={(e) => setQuery(e.target.value)} />

      {CATEGORY_ORDER.map((cat) => {
        const inCat = foods.filter((f) => f.category === cat);
        if (!inCat.length) return null;
        return (
          <div key={cat}>
            <div className="card-title">{CATEGORY_LABELS[cat]}</div>
            <div className="stack-sm">
              {inCat.map((food) => {
                const checked = pantryMap.has(food.id);
                return (
                  <div key={food.id}>
                    <Checkbox checked={checked} onChange={() => toggle(food.id)}>
                      <span className="row-between">
                        <span className="sm">{food.name}</span>
                        {needed.has(food.id) && !checked && (
                          <span className="xs dim">
                            besoin {formatQty(
                              plan.shoppingList.items.find((i) => i.foodId === food.id)?.neededQty ?? 0,
                              food.unit,
                            )}
                          </span>
                        )}
                      </span>
                    </Checkbox>
                    {checked && (
                      <div className="row" style={{ marginTop: 8, marginLeft: 14, marginBottom: 6 }}>
                        <input type="number" inputMode="numeric" min={0} value={pantryMap.get(food.id) ?? 0}
                          onChange={(e) => setQty(food.id, Number(e.target.value))}
                          style={{ maxWidth: 130 }} />
                        <span className="sm dim">{food.unit === 'piece' ? 'pièces' : food.unit}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {foods.length === 0 && <Empty title="Aucun aliment trouvé" />}
    </div>
  );
}
