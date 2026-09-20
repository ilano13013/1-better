import { useMemo, useState } from 'react';
import type { DayIndex, ShoppingListItem, Substitution } from '../types';
import { useApp } from '../store/AppContext';
import { todayIndex } from '../store/state';
import { getStore } from '../data/stores';
import { getRecipe } from '../data/recipes';
import {
  CATEGORY_LABELS, coveredItems, formatQty, groupByCategory,
  purchasableItems, shoppingListToCsv, shoppingListToText,
} from '../engine/shopping';
import { bestSavings, optimizeBudget } from '../engine/budget';
import { planRemaining } from '../engine/remaining';
import { driveStatus } from '../engine/drive';
import { DAY_NAMES } from '../engine/training';
import { Bar, Card, Empty, Sheet, eur, num } from '../components/ui';
import {
  IconBack, IconCheck, IconCopy, IconDownload, IconInfo, IconMinus, IconPlus,
  IconShare, IconSpark, IconSwap, IconWallet,
} from '../components/icons';
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

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify('Fichier exporté');
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="icon-btn" onClick={() => go('nutrition')} aria-label="Retour">
            <IconBack />
          </button>
          <div>
            <div className="eyebrow">{store.name}</div>
            <h1>Liste de courses</h1>
          </div>
        </div>
      </div>

      <div className="stack">
        {/* Budget */}
        <Card className={over > 0 ? 'card-warn' : 'card-accent'}>
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
            <Bar value={list.total} max={budget} tone={over > 0 ? 'warn' : 'accent'} />
          </div>

          <div className="row-between sm" style={{ marginTop: 10 }}>
            <span className="dim">{items.length} produits</span>
            <span className={over > 0 ? 'warn strong' : 'accent strong'}>
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
              <Bar value={checkedTotal} max={list.total} tone="violet" />
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
                  <span className="accent" style={{ flex: 'none' }}><IconCheck size={13} /></span>
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
          background: checked ? 'var(--accent)' : 'transparent',
          borderColor: checked ? 'var(--accent)' : undefined,
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
          {item.pantryQty > 0 && <span className="accent">−{formatQty(item.pantryQty, item.unit)} en stock</span>}
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
    verifie: { cls: 'badge-accent', label: 'Prix vérifié' },
    estime: { cls: '', label: 'Prix estimé' },
    inconnu: { cls: 'badge-warn', label: 'Prix inconnu — saisir' },
  } as const;
  const conf = map[item.priceStatus];
  return (
    <button type="button" onClick={onClick}
      className={`badge ${conf.cls}`}
      style={{ border: 'none', cursor: 'pointer', fontSize: 10.5 }}
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
      <Card className={over > 0 ? 'card-warn' : 'card-flat'}>
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
          <p className="sm warn" style={{ marginTop: 10 }}>
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
                  <span className="badge badge-accent num">−{eur(s.saving)}</span>
                </div>
              </Card>
            ))}
          </div>

          <Card className="card-accent">
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
        <button type="button" className="btn btn-danger btn-block"
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
          <Card className={preview.withinBudget ? 'card-accent' : 'card-warn'}>
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
  const { state, plan } = useApp();
  const store = getStore(state.profile.storeId);
  const status = driveStatus(store.id);
  const items = purchasableItems(plan.shoppingList);

  return (
    <div className="stack">
      <Card className="card-flat">
        <div className="card-title">Étapes prévues</div>
        <ol className="sm muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Récupération des produits compatibles</li>
          <li>Correspondance entre ta liste et le catalogue</li>
          <li>Sélection des formats appropriés</li>
          <li>Préparation du panier</li>
          <li>Vérification par toi, avant toute commande</li>
        </ol>
      </Card>

      {status.state === 'connecteur_absent' ? (
        <Card className="card-warn">
          <div className="strong">Aucun connecteur disponible</div>
          <p className="sm muted" style={{ marginTop: 8 }}>{status.message}</p>
        </Card>
      ) : (
        <Card className="card-accent">
          <div className="strong">Connecteur {status.connector.label} disponible</div>
        </Card>
      )}

      <Card className="card-flat">
        <div className="row-between sm"><span className="dim">Produits à transmettre</span>
          <span className="strong num">{items.length}</span></div>
        <div className="row-between sm" style={{ marginTop: 6 }}><span className="dim">Montant estimé</span>
          <span className="strong num">{eur(plan.shoppingList.total)}</span></div>
      </Card>

      <p className="xs dim">
        Aucun achat n'est jamais déclenché automatiquement. L'architecture est en
        place pour brancher une enseigne disposant d'un accès officiel ; aucune API
        n'est simulée ni supposée.
      </p>

      <button type="button" className="btn btn-block" disabled>
        Préparer mon panier
      </button>
    </div>
  );
}
