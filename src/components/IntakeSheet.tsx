import { useCallback, useEffect, useRef, useState } from 'react';
import { FOODS } from '../data/foods';
import { useApp } from '../store/AppContext';
import {
  macrosForGrams, lookupsLeft, per100gOf, type IntakeEntry, type Per100g,
} from '../engine/intake';
import { LOOKUP_MESSAGES, isValidBarcode, lookupBarcode, normalizeBarcode } from '../engine/openfoodfacts';
import { IconCheck, IconClose, IconSearch } from './icons';
import { Field, Sheet, num } from './ui';

/**
 * Ajout d'un aliment mangé hors plan.
 *
 * Trois chemins qui aboutissent au même endroit — un aliment, une quantité en
 * grammes, un aperçu des macros :
 *
 * 1. **Scanner** — caméra et `BarcodeDetector`, quand le navigateur le
 *    propose. Ni Safari ni un cadre isolé ne le permettent, d'où les deux
 *    autres.
 * 2. **Code-barres saisi** — même recherche, sans caméra.
 * 3. **Base d'aliments** — 82 aliments, hors ligne, toujours disponible.
 *
 * Le troisième chemin existe pour que la fonction ne dépende jamais du réseau
 * ni d'une autorisation matérielle : le scan est un raccourci, pas un péage.
 */

/* `BarcodeDetector` n'est pas dans les types du DOM : surface minimale. */
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike;
      getSupportedFormats?(): Promise<string[]>;
    };
  }
}

type Mode = 'choose' | 'scan' | 'barcode' | 'base';

interface Draft {
  label: string;
  per100g: Per100g;
  grams: number;
  foodId?: string;
  barcode?: string;
  brand?: string;
  /** Champs absents de la fiche Open Food Facts, à vérifier. */
  missing?: (keyof Per100g)[];
}

export function IntakeSheet({
  open, onClose, date,
}: { open: boolean; onClose: () => void; date: string }) {
  const { state, plan, dispatch, notify } = useApp();
  const [mode, setMode] = useState<Mode>('choose');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Code dont la recherche a échoué : il reste saisissable à la main.
  const [failed, setFailed] = useState<string | null>(null);

  const left = lookupsLeft(state.intake, date, plan.limits.barcodeLookupsPerDay);
  const quotaReached = left !== null && left <= 0;

  const reset = useCallback(() => {
    setMode('choose'); setDraft(null); setError(null); setFailed(null);
  }, []);

  const close = () => { reset(); onClose(); };

  const search = useCallback(async (raw: string) => {
    setError(null);
    setFailed(null);
    if (quotaReached) {
      setError('Quota de recherches atteint pour aujourd\'hui. La base d\'aliments reste ouverte.');
      setMode('choose');
      return;
    }
    const result = await lookupBarcode(raw);
    if (!result.ok) {
      setError(LOOKUP_MESSAGES[result.error]);
      // Une recherche qui échoue ne doit pas être un cul-de-sac : le produit
      // existe, seule sa fiche manque. On garde le code pour une saisie
      // manuelle, sauf si c'est le code lui-même qui est mauvais.
      if (result.error !== 'code_invalide') setFailed(normalizeBarcode(raw));
      setMode('choose');
      return;
    }
    const p = result.product;
    setDraft({
      label: p.name, per100g: p.per100g, grams: 100,
      barcode: p.barcode, brand: p.brand, missing: p.missing,
    });
    setMode('choose');
  }, [quotaReached]);

  const save = () => {
    if (!draft) return;
    const entry: IntakeEntry = {
      id: `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      date,
      kind: 'food',
      label: draft.brand ? `${draft.label} — ${draft.brand}` : draft.label,
      foodId: draft.foodId,
      barcode: draft.barcode,
      grams: draft.grams,
      macros: macrosForGrams(draft.per100g, draft.grams),
      at: new Date().toISOString(),
    };
    dispatch({ type: 'logIntake', entry });
    notify(`${entry.label} ajouté au journal`);
    close();
  };

  return (
    <Sheet open={open} onClose={close} title={<div className="strong">Ajouter un aliment</div>}>
      {draft ? (
        <DraftForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => { setDraft(null); setError(null); }}
          onSave={save}
        />
      ) : mode === 'scan' ? (
        <Scanner onFound={search} onCancel={reset} onError={setError} error={error} />
      ) : mode === 'barcode' ? (
        <BarcodeForm onSubmit={search} onCancel={reset} error={error} />
      ) : mode === 'base' ? (
        <FoodPicker onPick={(d) => { setDraft(d); setMode('choose'); }} onCancel={reset} />
      ) : (
        <div className="stack">
          {error && (
            <div className="card card-alert">
              <p className="sm notice">{error}</p>
              {failed && (
                <button type="button" className="btn btn-sm btn-block" style={{ marginTop: 12 }}
                  onClick={() => {
                    setDraft({
                      label: `Produit ${failed}`,
                      per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
                      grams: 100,
                      barcode: failed,
                      missing: ['kcal', 'protein', 'carbs', 'fat'],
                    });
                    setError(null);
                    setFailed(null);
                  }}>
                  Saisir les valeurs à la main
                </button>
              )}
            </div>
          )}

          <button type="button" className="btn btn-primary btn-block"
            disabled={!window.BarcodeDetector || quotaReached}
            onClick={() => { setError(null); setMode('scan'); }}>
            Scanner un code-barres
          </button>
          {!window.BarcodeDetector && (
            <p className="xs dim center">
              Ce navigateur ne sait pas lire un code-barres. Les deux autres
              chemins fonctionnent.
            </p>
          )}

          <button type="button" className="btn btn-block" disabled={quotaReached}
            onClick={() => { setError(null); setMode('barcode'); }}>
            Saisir un code-barres
          </button>

          {left !== null && (
            <p className="xs dim center">
              {left > 0
                ? `${left} recherche${left > 1 ? 's' : ''} en ligne restante${left > 1 ? 's' : ''} aujourd'hui.`
                : "Plus de recherche en ligne aujourd'hui — la base d'aliments reste ouverte."}
            </p>
          )}

          <div className="signin-sep" />

          <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode('base')}>
            Choisir dans la base d'aliments
          </button>
          <p className="xs dim center">82 aliments, hors ligne, sans limite.</p>
        </div>
      )}
    </Sheet>
  );
}

/* --------------------------------- Scanner -------------------------------- */

function Scanner({
  onFound, onCancel, onError, error,
}: {
  onFound: (code: string) => void; onCancel: () => void;
  onError: (m: string) => void; error: string | null;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    (async () => {
      const Detector = window.BarcodeDetector;
      if (!Detector) { onError('Lecture de code-barres indisponible ici.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        // Autorisation refusée, pas de caméra, ou cadre isolé : on le dit.
        onError("La caméra n'est pas accessible. Saisis le code à la main.");
        return;
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      const el = video.current;
      if (!el) return;
      el.srcObject = stream;
      await el.play().catch(() => undefined);
      setReady(true);

      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
      });
      const tick = async () => {
        if (stopped || !video.current) return;
        try {
          const codes = await detector.detect(video.current);
          if (codes.length > 0) { onFound(codes[0].rawValue); return; }
        } catch {
          /* image non exploitable : on retente au tour suivant */
        }
        timer = window.setTimeout(tick, 350);
      };
      timer = window.setTimeout(tick, 400);
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onFound, onError]);

  return (
    <div className="stack">
      {error && <div className="card card-alert"><p className="sm notice">{error}</p></div>}
      <div className="scanner">
        <video ref={video} playsInline muted />
        <div className="scanner-frame" aria-hidden="true" />
      </div>
      <p className="xs dim center">
        {ready ? 'Présente le code-barres dans le cadre.' : 'Ouverture de la caméra…'}
      </p>
      <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>Annuler</button>
    </div>
  );
}

/* ------------------------------- Code saisi ------------------------------- */

function BarcodeForm({
  onSubmit, onCancel, error,
}: { onSubmit: (code: string) => void; onCancel: () => void; error: string | null }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = normalizeBarcode(code);
  const valid = isValidBarcode(clean);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit(clean);
        setBusy(false);
      }}
    >
      {error && <div className="card card-alert"><p className="sm notice">{error}</p></div>}
      <Field label="Code-barres">
        <input type="text" inputMode="numeric" autoFocus placeholder="3017620425035"
          value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {clean.length >= 8 && !valid && (
        // La clé de contrôle se vérifie sans réseau : autant le dire tout de suite.
        <p className="xs notice">Ce code ne passe pas sa clé de contrôle.</p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
        {busy ? 'Recherche…' : 'Chercher'}
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>Retour</button>
    </form>
  );
}

/* ----------------------------- Base d'aliments ---------------------------- */

function FoodPicker({
  onPick, onCancel,
}: { onPick: (d: Draft) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = FOODS
    .filter((f) => per100gOf(f) !== null && (q === '' || f.name.toLowerCase().includes(q)))
    .slice(0, 40);

  return (
    <div className="stack">
      <Field label="Chercher">
        <input type="text" autoFocus placeholder="Riz, skyr, banane…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      <div className="stack-sm">
        {results.map((food) => {
          const per100g = per100gOf(food)!;
          return (
            <button key={food.id} type="button" className="option"
              onClick={() => onPick({ label: food.name, per100g, grams: 100, foodId: food.id })}>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="strong truncate" style={{ display: 'block' }}>{food.name}</span>
                <span className="xs dim">
                  {Math.round(per100g.kcal)} kcal · {Math.round(per100g.protein)} g de protéines / 100 g
                </span>
              </span>
              <IconSearch size={15} />
            </button>
          );
        })}
        {results.length === 0 && <p className="sm dim center">Aucun aliment pour cette recherche.</p>}
      </div>
      <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>Retour</button>
    </div>
  );
}

/* -------------------------------- Quantité -------------------------------- */

function DraftForm({
  draft, onChange, onCancel, onSave,
}: {
  draft: Draft; onChange: (d: Draft) => void;
  onCancel: () => void; onSave: () => void;
}) {
  const macros = macrosForGrams(draft.per100g, draft.grams);
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const setPer100g = (patch: Partial<Per100g>) =>
    onChange({ ...draft, per100g: { ...draft.per100g, ...patch } });

  return (
    <div className="stack">
      <div>
        <div className="strong" style={{ fontSize: 17 }}>{draft.label}</div>
        {draft.brand && <div className="sm dim">{draft.brand}</div>}
        {draft.barcode && (
          <div className="xs dim" style={{ marginTop: 4 }}>
            Code {draft.barcode} · valeurs Open Food Facts, contributives
          </div>
        )}
      </div>

      {draft.missing && draft.missing.length > 0 && (
        <div className="card card-notice">
          <div className="card-title">Valeurs manquantes</div>
          <p className="sm muted">
            Cette fiche ne renseigne pas tout. Les champs à zéro sont à corriger
            avant d'enregistrer, sinon le journal comptera faux.
          </p>
        </div>
      )}

      <Field label="Quantité">
        <div className="suffix">
          <input type="number" min={1} max={5000} step={5} value={draft.grams}
            onChange={(e) => set({ grams: Math.max(0, Number(e.target.value) || 0) })} />
          <span>g</span>
        </div>
      </Field>

      <div className="grid-2">
        <Field label="kcal / 100 g">
          <input type="number" min={0} value={Math.round(draft.per100g.kcal)}
            onChange={(e) => setPer100g({ kcal: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Protéines / 100 g">
          <input type="number" min={0} value={Math.round(draft.per100g.protein)}
            onChange={(e) => setPer100g({ protein: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Glucides / 100 g">
          <input type="number" min={0} value={Math.round(draft.per100g.carbs)}
            onChange={(e) => setPer100g({ carbs: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Lipides / 100 g">
          <input type="number" min={0} value={Math.round(draft.per100g.fat)}
            onChange={(e) => setPer100g({ fat: Number(e.target.value) || 0 })} />
        </Field>
      </div>

      <div className="card card-ink">
        <div className="card-title" style={{ margin: 0 }}>Ce que ça ajoute</div>
        <div className="metric num" style={{ marginTop: 4 }}>{num(macros.kcal)} kcal</div>
        <div className="sm" style={{ marginTop: 6 }}>
          {macros.protein} g de protéines · {macros.carbs} g de glucides · {macros.fat} g de lipides
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-block"
        onClick={onSave}
        disabled={draft.grams <= 0 || Object.values(draft.per100g).every((v) => v <= 0)}>
        <IconCheck size={15} /> Ajouter au journal
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
        <IconClose size={15} /> Choisir autre chose
      </button>
    </div>
  );
}
