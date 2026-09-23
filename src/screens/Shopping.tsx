import { useMemo, useState } from 'react';
import type { DayIndex, ShoppingListItem, Substitution } from '../types';
import { useApp } from '../store/AppContext';
import { todayIndex } from '../store/state';
import { getStore } from '../data/stores';
import { getRecipe } from '../data/recipes';
import {
  CATEGORY_LABELS, LONG_LIFE_WEEKS, coveredItems, formatQty, groupByCategory,
  purchasableItems, shoppingListToCsv, shoppingListToText,
} from '../engine/shopping';
import { bestSavings, optimizeBudget } from '../engine/budget';
import { planRemaining } from '../engine/remaining';
import {
  buildSearchUrl, driveStatus, getHandoff, handoffPlan, handoffProgress,
} from '../engine/drive';
import { DAY_NAMES } from '../engine/training';
import { Bar, Card, Empty, Sheet, eur, num } from '../components/ui';
import {
  IconBack, IconCheck, IconCopy, IconDownload, IconInfo, IconMinus, IconPlus,
  IconShare, IconSpark, IconSwap, IconWallet,
} from '../components/icons';
import { StoreMark } from '../components/BrandMark';
import type { Screen } from '../App';

/**
 * Écran Liste de courses : agrégation, budget, optimisation, mode
 * « il me reste X € », actions d'export et préparation de Drive.
 */
export default function Shopping({ go }: { go: (s: Screen) => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const store = getStore(state.profile.storeId);
  const list = plan.shoppingList;
  const budget = state.profile.weeklyBudget;
  const over = list.total - budget;

  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [priceFor, setPriceFor] = useState<ShoppingListItem | null>(null);

  const items = purchasableItems(list);
  const covered = coveredItems(list);
  const checked = new Set(state.checkedItems);
  const checkedTotal = items.filter((i) => checked.has(i.id)).reduce((s, i) => s + i.totalPrice, 0);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      notify('Copie impossible — utilise l\'export.');
    }
  };

  const share = async () => {
    const text = shoppingListToText(list, store.name);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ma liste de courses', text });
        return;
      } catch { /* partage annulé */ }
    }
    copy(text, 'Liste copiée — prête à être partagée');
  };

  /**
   * Certains contextes d'exécution (aperçu intégré, navigateur restreint)
   * bloquent silencieusement les téléchargements lancés par la page. On tente
   * donc l'export ET on dépose le contenu dans le presse-papiers, pour que
   * l'action aboutisse dans tous les cas.
   */
  const download = async (content: string, filename: string, type: string) => {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* téléchargement indisponible : le presse-papiers prend le relais */
    }
    // Le presse-papiers est la voie fiable : le téléchargement peut avoir été
    // ignoré sans erreur, on ne prétend donc pas qu'il a abouti.
    try {
      await navigator.clipboard.writeText(content);
      notify('Copié dans le presse-papiers — et téléchargé si ton navigateur l\'autorise');
    } catch {
      notify('Export lancé — si rien ne se passe, ton navigateur bloque les téléchargements');
    }
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="icon-btn" onClick={() => go('nutrition')} aria-label="Retour">
            <IconBack />
          </button>
          <div className="row" style={{ gap: 10 }}>
            <StoreMark store={store} size={34} />
            <div>
              <div className="eyebrow">{store.name}</div>
              <h1>Liste de courses</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="stack">
        {/* Budget */}
        <Card className={over > 0 ? 'card-notice' : 'card-ink'}>
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Panier calculé</div>
              <div className="display num" style={{ fontSize: 34, marginTop: 4 }}>{eur(list.total)}</div>
            </div>
            <div className="center">
              <div className="sm num strong">{eur(budget)}</div>
              <div className="xs dim">budget</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Bar value={list.total} max={budget} tone={over > 0 ? 'notice' : 'ink'} />
          </div>

          {list.longLifeTotal > 0 && (
            <div className="xs dim" style={{ marginTop: 10, lineHeight: 1.5 }}>
              Dont <strong>{eur(list.longLifeTotal)}</strong> de produits dont le
              conditionnement couvre plusieurs semaines : ce coût ne reviendra pas
              la semaine prochaine.
            </div>
          )}

          <div className="row-between sm" style={{ marginTop: 10 }}>
            <span className="dim">{items.length} produits</span>
            <span className={over > 0 ? 'notice strong' : 'ink strong'}>
              {over > 0
                ? `Ton panier dépasse ton budget de ${eur(over)}.`
                : `Reste ${eur(-over)}`}
            </span>
          </div>

          <div className="stack-sm" style={{ marginTop: 14 }}>
            <button type="button" className={`btn btn-block ${over > 0 ? 'btn-primary' : ''}`}
              onClick={() => setOptimizeOpen(true)}>
              <IconSpark size={15} /> Optimiser mon panier
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setRemainingOpen(true)}>
              <IconWallet size={15} /> Il me reste … €
            </button>
          </div>
        </Card>

        {/* Suivi des courses */}
        {checkedTotal > 0 && (
          <Card className="card-flat">
            <div className="row-between sm">
              <span className="dim">Déjà dans le chariot</span>
              <span className="strong num">{eur(checkedTotal)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <Bar value={checkedTotal} max={list.total} tone="muted" />
            </div>
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 12 }}
              onClick={() => dispatch({ type: 'clearChecked' })}>
              Tout décocher
            </button>
          </Card>
        )}

        {/* Statut des prix */}
        <Card className="card-flat">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span className="dim" style={{ flex: 'none', marginTop: 1 }}><IconInfo size={14} /></span>
            <div className="xs muted">
              Les prix affichés sont des <strong>estimations de démonstration</strong>, non
              actualisées. Touche un produit au prix inconnu pour saisir le tien.
              Total à prix non vérifié : {eur(list.uncertainTotal)}.
            </div>
          </div>
        </Card>

        {/* Liste par catégorie */}
        {items.length === 0 ? (
          <Empty title="Rien à acheter" hint="Ton garde-manger couvre toute la semaine." />
        ) : (
          groupByCategory(items).map(([category, rows]) => (
            <div key={category}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <span className="card-title" style={{ margin: 0 }}>{CATEGORY_LABELS[category]}</span>
                <span className="xs dim num">
                  {eur(rows.reduce((s, r) => s + r.totalPrice, 0))}
                </span>
              </div>
              <Card>
                {rows.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    checked={checked.has(item.id)}
                    onToggle={() => dispatch({ type: 'toggleChecked', id: item.id })}
                    onPacks={(packs) => dispatch({ type: 'setPacks', foodId: item.foodId, packs })}
                    onPrice={() => setPriceFor(item)}
                  />
                ))}
              </Card>
            </div>
          ))
        )}

        {/* Couvert par le garde-manger */}
        {covered.length > 0 && (
          <div>
            <div className="card-title">Déjà chez toi — non racheté</div>
            <Card className="card-flat">
              {covered.map((item) => (
                <div key={item.id} className="list-row">
                  <span className="ink" style={{ flex: 'none' }}><IconCheck size={13} /></span>
                  <span className="grow sm">{item.foodName}</span>
                  <span className="xs dim num">{formatQty(item.neededQty, item.unit)} utilisés</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="grid-2">
          <button type="button" className="btn btn-ghost"
            onClick={() => copy(shoppingListToText(list, store.name), 'Liste copiée')}>
            <IconCopy size={15} /> Copier
          </button>
          <button type="button" className="btn btn-ghost" onClick={share}>
            <IconShare size={15} /> Partager
          </button>
          <button type="button" className="btn btn-ghost"
            onClick={() => download(shoppingListToCsv(list), 'liste-de-courses.csv', 'text/csv;charset=utf-8')}>
            <IconDownload size={15} /> Exporter CSV
          </button>
          <button type="button" className="btn btn-ghost"
            onClick={() => download(shoppingListToText(list, store.name), 'liste-de-courses.txt', 'text/plain;charset=utf-8')}>
            <IconDownload size={15} /> Notes (.txt)
          </button>
        </div>

        <button type="button" className="btn btn-block" onClick={() => setDriveOpen(true)}>
          Préparer mon Drive
        </button>
      </div>

      <Sheet open={optimizeOpen} onClose={() => setOptimizeOpen(false)}
        title={<div className="strong">Optimiser mon panier</div>}>
        <Optimizer onClose={() => setOptimizeOpen(false)} />
      </Sheet>

      <Sheet open={remainingOpen} onClose={() => setRemainingOpen(false)}
        title={<div className="strong">Il me reste … €</div>}>
        <RemainingMode onClose={() => setRemainingOpen(false)} />
      </Sheet>

      <Sheet open={driveOpen} onClose={() => setDriveOpen(false)}
        title={<div className="strong">Préparer mon panier Drive</div>}>
        <DrivePanel />
      </Sheet>

      <Sheet open={Boolean(priceFor)} onClose={() => setPriceFor(null)}
        title={<div className="strong">{priceFor?.productLabel}</div>}>
        {priceFor && (
          <PriceEditor
            item={priceFor}
            onSave={(price) => {
              if (priceFor.productId) {
                dispatch({ type: 'setManualPrice', productId: priceFor.productId, price });
                notify('Prix enregistré');
              }
              setPriceFor(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ItemRow({
  item, checked, onToggle, onPacks, onPrice,
}: {
  item: ShoppingListItem; checked: boolean; onToggle: () => void;
  onPacks: (packs: number | null) => void; onPrice: () => void;
}) {
  return (
    <div className="list-row" style={{ opacity: checked ? 0.45 : 1, transition: 'opacity 0.2s var(--ease)' }}>
      <button type="button" className="option-mark" onClick={onToggle}
        aria-label={checked ? 'Décocher' : 'Cocher'}
        style={{
          borderRadius: 7, cursor: 'pointer',
          background: checked ? 'var(--ink)' : 'transparent',
          borderColor: checked ? 'var(--ink)' : undefined,
          color: checked ? '#04120c' : undefined,
        }}>
        {checked && <IconCheck size={12} />}
      </button>

      <div className="grow" style={{ minWidth: 0 }}>
        <div className="sm strong truncate"
          style={{ textDecoration: checked ? 'line-through' : undefined }}>
          {item.packs} × {item.productLabel}
        </div>
        <div className="row xs dim wrap" style={{ gap: 8, marginTop: 2 }}>
          <span>besoin {formatQty(item.toBuyQty, item.unit)}</span>
          {item.pantryQty > 0 && <span className="ink">−{formatQty(item.pantryQty, item.unit)} en stock</span>}
          {item.weeksOfSupply >= LONG_LIFE_WEEKS && (
            <span title="Le conditionnement couvre plusieurs semaines">
              ≈ {Math.round(item.weeksOfSupply)} semaines
            </span>
          )}
          <PriceBadge item={item} onClick={onPrice} />
        </div>
      </div>

      <div className="row" style={{ gap: 4, flex: 'none' }}>
        <button type="button" className="icon-btn" aria-label="Retirer un conditionnement"
          onClick={() => onPacks(Math.max(0, item.packs - 1))} style={{ width: 28, height: 28 }}>
          <IconMinus size={12} />
        </button>
        <button type="button" className="icon-btn" aria-label="Ajouter un conditionnement"
          onClick={() => onPacks(item.packs + 1)} style={{ width: 28, height: 28 }}>
          <IconPlus size={12} />
        </button>
      </div>

      <div className="sm strong num" style={{ minWidth: 58, textAlign: 'right' }}>
        {item.priceStatus === 'inconnu' ? '—' : eur(item.totalPrice)}
      </div>
    </div>
  );
}

function PriceBadge({ item, onClick }: { item: ShoppingListItem; onClick: () => void }) {
  const map = {
    verifie: { cls: 'badge-ink', label: 'Prix vérifié' },
    estime: { cls: '', label: 'Prix estimé' },
    inconnu: { cls: 'badge-notice', label: 'Prix inconnu — saisir' },
  } as const;
  const conf = map[item.priceStatus];
  return (
    <button type="button" onClick={onClick}
      className={`badge ${conf.cls}`}
      style={{ cursor: 'pointer' }}
      title={item.priceSource}>
      {conf.label}
    </button>
  );
}

function PriceEditor({
  item, onSave,
}: { item: ShoppingListItem; onSave: (price: number) => void }) {
  const [price, setPrice] = useState(item.unitPrice || 0);
  return (
    <div className="stack">
      <div className="card card-flat" style={{ padding: 14 }}>
        <div className="row-between sm"><span className="dim">Conditionnement</span>
          <span className="strong">{formatQty(item.packSize, item.unit)}</span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Quantité à acheter</span>
          <span className="strong">{item.packs} × </span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Source actuelle</span>
          <span className="strong">{item.priceSource}</span></div>
      </div>
      <div className="field">
        <label>Prix relevé en magasin</label>
        <div className="suffix">
          <input type="number" inputMode="decimal" step="0.01" min={0} value={price}
            onChange={(e) => setPrice(Number(e.target.value))} />
          <span>€ / unité</span>
        </div>
      </div>
      <p className="xs dim">
        Un prix saisi manuellement est considéré comme une estimation à jour de
        ta part ; il n'est jamais présenté comme vérifié par une source externe.
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={() => onSave(price)}>
        Enregistrer
      </button>
    </div>
  );
}

function Optimizer({ onClose }: { onClose: () => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const budget = state.profile.weeklyBudget;
  const options = {
    pantry: state.pantry,
    swaps: state.foodSwaps,
    manualPrices: state.manualPrices,
    packOverrides: state.packOverrides,
    budget,
  };

  const result = useMemo(
    () => optimizeBudget(plan.mealPlan, state.profile, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.mealPlan, state.profile, state.pantry, state.foodSwaps, budget],
  );

  const extra = useMemo(
    () => (result.substitutions.length === 0
      ? bestSavings(plan.mealPlan, state.profile, options)
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.mealPlan, state.profile, result.substitutions.length],
  );

  const shown = result.substitutions.length > 0 ? result.substitutions : extra;
  const over = result.before - budget;

  const apply = (subs: Substitution[]) => {
    const swaps = { ...state.foodSwaps };
    for (const s of subs) swaps[s.fromFoodId] = s.toFoodId;
    dispatch({ type: 'setSwaps', swaps });
    notify(`Panier optimisé — ${eur(subs.reduce((t, s) => t + s.saving, 0))} économisés`);
    onClose();
  };

  return (
    <div className="stack">
      <Card className={over > 0 ? 'card-notice' : 'card-flat'}>
        <div className="row-between">
          <div>
            <div className="card-title" style={{ margin: 0 }}>Panier actuel</div>
            <div className="metric num">{eur(result.before)}</div>
          </div>
          <div className="center">
            <div className="card-title" style={{ margin: 0 }}>Budget</div>
            <div className="metric num">{eur(budget)}</div>
          </div>
        </div>
        {over > 0 && (
          <p className="sm notice" style={{ marginTop: 10 }}>
            Ton panier dépasse ton budget de {eur(over)}.
          </p>
        )}
      </Card>

      {shown.length === 0 ? (
        <Empty
          title="Rien à optimiser"
          hint="Ton panier tient dans ton budget et aucune substitution cohérente ne le réduirait."
        />
      ) : (
        <>
          <div className="card-title">Substitutions proposées</div>
          <div className="stack-sm">
            {shown.map((s) => (
              <Card key={`${s.fromFoodId}-${s.toFoodId}`} className="card-flat">
                <div className="row-between">
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className="dim"><IconSwap size={15} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="sm strong truncate">{s.fromName} → {s.toName}</div>
                      <div className="xs dim" style={{ marginTop: 2 }}>{s.reason}</div>
                    </div>
                  </div>
                  <span className="badge badge-ink num">−{eur(s.saving)}</span>
                </div>
              </Card>
            ))}
          </div>

          <Card className="card-ink">
            <div className="row-between">
              <span className="sm muted">Nouveau total</span>
              <span className="metric num">
                {eur(result.substitutions.length > 0
                  ? result.after
                  : result.before - shown.reduce((t, s) => t + s.saving, 0))}
              </span>
            </div>
          </Card>

          <p className="xs dim">
            Les substitutions restent cohérentes avec tes objectifs : même catégorie,
            apports protéiques ou caloriques comparables. Les macros de tes repas et
            ta liste de courses sont recalculées.
          </p>

          <button type="button" className="btn btn-primary btn-block" onClick={() => apply(shown)}>
            Appliquer {shown.length} substitution{shown.length > 1 ? 's' : ''}
          </button>
        </>
      )}

      {Object.keys(state.foodSwaps).length > 0 && (
        <button type="button" className="btn btn-alert btn-block"
          onClick={() => { dispatch({ type: 'setSwaps', swaps: {} }); notify('Substitutions annulées'); onClose(); }}>
          Annuler les substitutions en cours
        </button>
      )}
    </div>
  );
}

function RemainingMode({ onClose }: { onClose: () => void }) {
  const { state, plan, dispatch, notify } = useApp();
  const today = todayIndex();
  const [amount, setAmount] = useState(Math.round(state.profile.weeklyBudget / 2));
  const [until, setUntil] = useState<DayIndex>(6);
  const [preview, setPreview] = useState<ReturnType<typeof planRemaining> | null>(null);

  const from = Math.min(today, until) as DayIndex;

  const compute = () => {
    const result = planRemaining({
      profile: state.profile,
      targets: plan.targets,
      plan: plan.mealPlan,
      pantry: state.pantry,
      fromDay: from,
      untilDay: until,
      amount,
      swaps: state.foodSwaps,
    });
    setPreview(result);
  };

  const applyPlan = () => {
    if (!preview) return;
    // On fige les repas recalculés sous forme de remplacements manuels,
    // afin qu'ils survivent aux recalculs ultérieurs.
    const overrides = { ...state.mealOverrides };
    for (const day of preview.plan.days) {
      if (!preview.days.includes(day.day)) continue;
      day.meals.forEach((meal, index) => { overrides[`${day.day}:${index}`] = meal.recipeId; });
    }
    dispatch({ type: 'setState', state: { ...state, mealOverrides: overrides } });
    notify('Fin de semaine replanifiée');
    onClose();
  };

  return (
    <div className="stack">
      <p className="sm dim">
        Le moteur repart de ce que tu as déjà chez toi, des repas restants et de
        ton budget disponible, puis reconstruit uniquement la fin de la semaine.
      </p>

      <div className="field-row">
        <div className="field grow">
          <label>Il me reste</label>
          <div className="suffix">
            <input type="number" inputMode="decimal" min={0} value={amount}
              onChange={(e) => { setAmount(Number(e.target.value)); setPreview(null); }} />
            <span>€</span>
          </div>
        </div>
        <div className="field grow">
          <label>jusqu'à</label>
          <select value={until} onChange={(e) => { setUntil(Number(e.target.value) as DayIndex); setPreview(null); }}>
            {DAY_NAMES.map((d, i) => (
              i >= today ? <option key={d} value={i}>{d}</option> : null
            ))}
          </select>
        </div>
      </div>

      <button type="button" className="btn btn-block" onClick={compute}>
        Recalculer ma fin de semaine
      </button>

      {preview && (
        <>
          <Card className={preview.withinBudget ? 'card-ink' : 'card-notice'}>
            <div className="row-between">
              <div>
                <div className="card-title" style={{ margin: 0 }}>Courses restantes</div>
                <div className="metric num">{eur(preview.spend)}</div>
              </div>
              <div className="center">
                <div className="card-title" style={{ margin: 0 }}>Disponible</div>
                <div className="metric num">{eur(amount)}</div>
              </div>
            </div>
            <div className="divider" style={{ margin: '14px 0 12px' }} />
            <div className="row-between sm">
              <span className="dim">{preview.mealsRemaining} repas · {preview.days.length} jours</span>
              <span className="strong num">{num(preview.macrosRemaining.kcal)} kcal</span>
            </div>
            <div className="row-between sm" style={{ marginTop: 4 }}>
              <span className="dim">Protéines restantes</span>
              <span className="strong num">{preview.macrosRemaining.protein} g</span>
            </div>
          </Card>

          <div className="card-title">Repas replanifiés</div>
          <Card className="card-flat">
            {preview.plan.days
              .filter((d) => preview.days.includes(d.day))
              .map((d) => (
                <div key={d.day} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <span className="xs dim" style={{ width: 62, flex: 'none' }}>{DAY_NAMES[d.day]}</span>
                  <span className="grow sm">
                    {d.meals.map((m) => getRecipe(m.recipeId).name).join(' · ')}
                  </span>
                </div>
              ))}
          </Card>

          <button type="button" className="btn btn-primary btn-block" onClick={applyPlan}>
            Appliquer ce plan
          </button>
        </>
      )}
    </div>
  );
}

function DrivePanel() {
  const { state, plan, dispatch, notify } = useApp();
  const store = getStore(state.profile.storeId);
  const status = driveStatus(store.id);
  const handoff = getHandoff(store.id);
  const items = purchasableItems(plan.shoppingList);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  const steps = useMemo(
    () => handoffPlan(items, state.driveAdded),
    [items, state.driveAdded],
  );
  const progress = handoffProgress(steps);
  const current = progress.nextIndex >= 0 ? steps[progress.nextIndex] : null;

  const urlFor = (term: string) => (handoff ? buildSearchUrl(handoff, term) : null);

  /**
   * Ouvre l'enseigne dans un onglet et dépose le terme dans le presse-papiers.
   * Certains conteneurs (aperçu intégré) bloquent l'ouverture : on le dit au
   * lieu de laisser croire que rien ne s'est passé.
   */
  const openStore = async (term: string) => {
    const url = urlFor(term);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(term);
    } catch {
      /* presse-papiers indisponible */
    }
    let win: Window | null = null;
    try {
      win = window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      win = null;
    }
    if (win) {
      setBlockedUrl(null);
      notify(`« ${term} » copié — cherche-le chez ${store.name}`);
    } else {
      setBlockedUrl(url);
    }
  };

  if (!handoff) {
    return (
      <div className="stack">
        <Card className="card-notice">
          <div className="strong">Pas de courses en ligne pour cette enseigne</div>
          <p className="sm muted" style={{ marginTop: 8 }}>
            Choisis une enseigne disposant d'un Drive depuis ton profil, ou utilise
            l'export de la liste.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="stack">
      {/* Ce que fait — et ne fait pas — cette préparation */}
      <Card className="card-flat">
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="dim" style={{ flex: 'none', marginTop: 1 }}><IconInfo size={14} /></span>
          <div className="xs muted">
            Aucune enseigne ne permet à une application tierce de remplir ton panier.
            L'application ouvre donc {store.name} produit par produit, avec le nom
            déjà copié, et suit ton avancement. <strong>Le panier se construit dans
            ta propre session</strong> : rien n'est commandé ici.
          </div>
        </div>
      </Card>

      {/* Avancement */}
      <Card className={progress.done === progress.total ? 'card-ink' : ''}>
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Avancement</div>
            <div className="display num" style={{ fontSize: 30, marginTop: 4 }}>
              {progress.done} <span style={{ fontSize: 16 }}>/ {progress.total}</span>
            </div>
          </div>
          <div className="center">
            <div className="sm num strong">{eur(progress.doneTotal)}</div>
            <div className="xs dim">au panier</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Bar value={progress.done} max={progress.total} />
        </div>
      </Card>

      {blockedUrl && (
        <Card className="card-notice">
          <div className="strong">Ouverture d'onglet bloquée</div>
          <p className="sm muted" style={{ marginTop: 8 }}>
            Ce conteneur empêche la page d'ouvrir un onglet. Copie l'adresse et
            ouvre-la toi-même — ou lance l'application depuis ton navigateur.
          </p>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <code className="xs grow truncate" style={{ opacity: 0.8 }}>{blockedUrl}</code>
            <button type="button" className="btn btn-sm"
              onClick={() => { navigator.clipboard?.writeText(blockedUrl); notify('Adresse copiée'); }}>
              <IconCopy size={13} /> Copier
            </button>
          </div>
        </Card>
      )}

      {/* Produit en cours */}
      {current ? (
        <Card>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <span className="card-title" style={{ margin: 0 }}>
              Produit {progress.nextIndex + 1} sur {progress.total}
            </span>
            <span className="badge">{CATEGORY_LABELS[current.item.category]}</span>
          </div>
          <div className="strong" style={{ fontSize: 18 }}>{current.term}</div>
          <div className="row xs dim wrap" style={{ marginTop: 6, gap: 10 }}>
            <span className="num">{current.item.packs} × {formatQty(current.item.packSize, current.item.unit)}</span>
            <span className="num">{eur(current.item.totalPrice)}</span>
            <span>besoin {formatQty(current.item.toBuyQty, current.item.unit)}</span>
          </div>

          <div className="stack-sm" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary btn-block"
              onClick={() => openStore(current.term)}>
              <IconShare size={15} /> Ouvrir chez {store.name}
            </button>
            <div className="grid-2">
              <button type="button" className="btn"
                onClick={() => dispatch({ type: 'toggleDriveAdded', id: current.item.id })}>
                <IconCheck size={14} /> Mis au panier
              </button>
              <button type="button" className="btn btn-ghost"
                onClick={() => dispatch({ type: 'toggleDriveAdded', id: current.item.id })}>
                Passer
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="card-flat">
          <div className="strong">Tous les produits sont traités</div>
          <p className="sm muted" style={{ marginTop: 8 }}>
            Vérifie ton panier chez {store.name} — quantités, formats et
            substitutions proposées par l'enseigne — avant de valider. Aucun achat
            n'a été déclenché depuis cette application.
          </p>
          <button type="button" className="btn btn-block" style={{ marginTop: 12 }}
            onClick={() => { dispatch({ type: 'resetDrive' }); notify('Préparation réinitialisée'); }}>
            Recommencer
          </button>
        </Card>
      )}

      {/* Toute la liste, pour revenir en arrière */}
      <div>
        <div className="card-title">Tous les produits</div>
        <Card className="card-flat">
          {steps.map((step, index) => (
            <div key={step.item.id} className="list-row" style={{ opacity: step.done ? 0.5 : 1 }}>
              <button type="button" className="option-mark"
                aria-label={step.done ? 'Retirer du panier' : 'Marquer comme mis au panier'}
                onClick={() => dispatch({ type: 'toggleDriveAdded', id: step.item.id })}
                style={{
                  borderRadius: 6, cursor: 'pointer',
                  background: step.done ? 'var(--ink)' : 'transparent',
                  borderColor: step.done ? 'var(--ink)' : undefined,
                  color: step.done ? 'var(--ground)' : 'transparent',
                }}>
                {step.done && <IconCheck size={11} />}
              </button>
              <button type="button" onClick={() => openStore(step.term)} className="grow"
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
                <div className="sm truncate" style={{ textDecoration: step.done ? 'line-through' : undefined }}>
                  {step.item.packs} × {step.term}
                </div>
                <div className="xs dim num">{eur(step.item.totalPrice)}</div>
              </button>
              {index === progress.nextIndex && <span className="badge badge-ink">en cours</span>}
            </div>
          ))}
        </Card>
      </div>

      <p className="xs dim">
        {status.state === 'connecteur_absent'
          ? `Aucun accès officiel n'est connecté pour ${store.name}. Le jour où l'enseigne en ouvre un, il se branche sur le contrat défini dans engine/drive.ts et cette étape devient automatique.`
          : `Connecteur ${status.connector.label} disponible.`}
      </p>

    </div>
  );
}

