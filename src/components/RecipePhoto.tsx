import { useRef, useState, useCallback } from 'react';
import type { MealSlot, Recipe } from '../types';
import { useApp } from '../store/AppContext';
import {
  ACCEPTED_LOGO_TYPES, LogoError, MAX_IMAGES_BYTES, dataUrlBytes, formatBytes, preparePhoto,
} from '../utils/image';
import { RECIPES } from '../data/recipes';
import { SLOT_LABELS } from '../engine/nutrition';
import { Bar, Card } from './ui';
import { IconInfo, IconPlus, IconTrash } from './icons';

/**
 * Photo d'une recette.
 *
 * Aucune photo n'est livrée avec l'application : les images externes sont
 * bloquées dans certains conteneurs, et le fichier autonome doit rester
 * utilisable hors ligne. Les photos sont donc fournies par l'utilisateur et
 * conservées sur son appareil.
 */

/** Octets déjà occupés par les images, logos compris. */
export function imagesBytes(
  photos: Record<string, string>,
  logos: Record<string, string>,
): number {
  const sum = (m: Record<string, string>) =>
    Object.values(m).reduce((s, v) => s + dataUrlBytes(v), 0);
  return sum(photos) + sum(logos);
}

/** Import d'une photo de recette, avec contrôle de l'enveloppe de stockage. */
export function useRecipePhotoDrop(recipeId: string) {
  const { state, dispatch, notify } = useApp();
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    try {
      const { dataUrl, bytes } = await preparePhoto(file);
      const current = state.recipePhotos[recipeId];
      const used = imagesBytes(state.recipePhotos, state.brandLogos)
        - (current ? dataUrlBytes(current) : 0);
      if (used + bytes > MAX_IMAGES_BYTES) {
        setError(
          `Plus de place : ${formatBytes(used)} déjà utilisés sur ${formatBytes(MAX_IMAGES_BYTES)}. Retire une photo avant d'en ajouter une autre.`,
        );
        return;
      }
      dispatch({ type: 'setRecipePhoto', recipeId, dataUrl });
      notify(`Photo ajoutée — ${formatBytes(bytes)}`);
    } catch (e) {
      setError(e instanceof LogoError ? e.message : 'Import impossible.');
    }
  }, [recipeId, state.recipePhotos, state.brandLogos, dispatch, notify]);

  return { accept, error };
}

/** Vignette carrée, utilisée dans les listes de repas. */
export function RecipeThumb({ recipe, size = 56 }: { recipe: Recipe; size?: number }) {
  const { state } = useApp();
  const photo = state.recipePhotos[recipe.id];
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: 10, flex: 'none',
    overflow: 'hidden', background: 'var(--inset)',
    display: 'grid', placeItems: 'center',
    border: '1px solid var(--line)',
  };
  if (!photo) {
    return (
      <span style={style} aria-hidden="true">
        <span className="dim" style={{ fontSize: Math.round(size * 0.3), fontWeight: 620 }}>
          {recipe.name.trim()[0]?.toUpperCase() ?? '?'}
        </span>
      </span>
    );
  }
  return (
    <span style={style}>
      <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </span>
  );
}

/**
 * Bandeau photo de la fiche recette : affiche la photo si elle existe, et sert
 * de zone de dépôt sinon.
 */
export function RecipePhotoBanner({ recipe }: { recipe: Recipe }) {
  const { state, dispatch, notify } = useApp();
  const { accept, error } = useRecipePhotoDrop(recipe.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const photo = state.recipePhotos[recipe.id];

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void accept(e.dataTransfer.files?.[0]); }}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          background: 'var(--inset)',
          border: `1px ${over ? 'dashed' : 'solid'} ${over ? 'var(--ink)' : 'var(--line)'}`,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        {photo ? (
          <img src={photo} alt={`Photo — ${recipe.name}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="center" style={{ padding: 18 }}>
            <div className="dim"><IconPlus size={20} /></div>
            <div className="sm muted strong" style={{ marginTop: 8 }}>Ajouter une photo</div>
            <div className="xs dim" style={{ marginTop: 3 }}>
              Glisse un fichier ici, ou touche pour choisir
            </div>
          </div>
        )}

        {photo && (
          <button type="button" className="icon-btn" aria-label="Retirer la photo"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'setRecipePhoto', recipeId: recipe.id, dataUrl: null });
              notify('Photo retirée');
            }}
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(255,255,255,0.92)', color: '#09090b', borderColor: 'transparent',
            }}>
            <IconTrash size={13} />
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={ACCEPTED_LOGO_TYPES.join(',')} hidden
        onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = ''; }} />

      {error && <div className="xs alert" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Écran de dépôt en série                                              */
/* ------------------------------------------------------------------ */

/**
 * Toutes les recettes au même endroit : seules celles du plan de la semaine
 * sont atteignables depuis l'onglet Nutrition, or il y en a bien davantage.
 */
export function RecipePhotoLibrary() {
  const { state } = useApp();
  const [query, setQuery] = useState('');

  const used = imagesBytes(state.recipePhotos, state.brandLogos);
  const count = Object.keys(state.recipePhotos).length;
  const needle = query.trim().toLowerCase();

  const groups: { slot: MealSlot; recipes: Recipe[] }[] = (
    ['petit_dejeuner', 'dejeuner', 'diner', 'collation'] as MealSlot[]
  ).map((slot) => ({
    slot,
    recipes: RECIPES.filter(
      (r) => r.slots[0] === slot && (!needle || r.name.toLowerCase().includes(needle)),
    ),
  }));

  return (
    <div className="stack">
      <Card className="card-flat">
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="dim" style={{ flex: 'none', marginTop: 1 }}><IconInfo size={14} /></span>
          <div className="xs muted">
            Aucune photo n'est livrée avec l'application : les images externes sont
            bloquées dans certains conteneurs, et le fichier autonome doit rester
            utilisable hors ligne. Tes photos sont réduites à 560 px, réencodées
            en JPEG et <strong>restent sur cet appareil</strong>.
          </div>
        </div>
      </Card>

      <div className="row-between sm">
        <span className="dim">
          {count} photo{count > 1 ? 's' : ''} sur {RECIPES.length} recettes
        </span>
        <span className="num strong">{formatBytes(used)} / {formatBytes(MAX_IMAGES_BYTES)}</span>
      </div>
      <Bar value={used} max={MAX_IMAGES_BYTES} tone={used > MAX_IMAGES_BYTES * 0.85 ? 'notice' : 'ink'} />

      <input type="text" value={query} placeholder="Chercher une recette…"
        onChange={(e) => setQuery(e.target.value)} />

      {groups.map(({ slot, recipes }) => (
        recipes.length === 0 ? null : (
          <div key={slot}>
            <div className="card-title">{SLOT_LABELS[slot]}</div>
            <div className="stack-sm">
              {recipes.map((recipe) => <PhotoRow key={recipe.id} recipe={recipe} />)}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

function PhotoRow({ recipe }: { recipe: Recipe }) {
  const { state, dispatch, notify } = useApp();
  const { accept, error } = useRecipePhotoDrop(recipe.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const photo = state.recipePhotos[recipe.id];

  return (
    <div>
      <div
        className="option"
        style={{
          borderStyle: over ? 'dashed' : 'solid',
          borderColor: over ? 'var(--ink)' : undefined,
          cursor: 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void accept(e.dataTransfer.files?.[0]); }}
      >
        <RecipeThumb recipe={recipe} size={46} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="strong sm truncate" style={{ display: 'block' }}>{recipe.name}</span>
          <span className="xs dim" style={{ display: 'block', marginTop: 2 }}>
            {photo ? `Photo · ${formatBytes(dataUrlBytes(photo))}` : 'Glisse une photo ici, ou touche pour choisir'}
          </span>
        </span>
        {photo && (
          <button type="button" className="icon-btn" aria-label={`Retirer la photo de ${recipe.name}`}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'setRecipePhoto', recipeId: recipe.id, dataUrl: null });
              notify('Photo retirée');
            }}>
            <IconTrash size={13} />
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={ACCEPTED_LOGO_TYPES.join(',')} hidden
        onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = ''; }} />

      {error && <div className="xs alert" style={{ marginTop: 6, marginLeft: 16 }}>{error}</div>}
    </div>
  );
}
