import type { Recipe } from '../types';
import { useApp } from '../store/AppContext';
import { BUNDLED_PHOTOS } from '../data/assets';

/**
 * Affichage des photos de recettes.
 *
 * Priorité au fichier livré avec l'application (`src/assets/recipes/`), qui
 * suit sur tous les appareils et pour tous les visiteurs. Le stockage local
 * n'est plus qu'un repli, hérité de l'import retiré de l'interface.
 */

function photoFor(recipeId: string, stored: Record<string, string>): string | undefined {
  return BUNDLED_PHOTOS[recipeId] ?? stored[recipeId];
}

/** Vignette carrée, utilisée dans les listes de repas. */
export function RecipeThumb({ recipe, size = 56 }: { recipe: Recipe; size?: number }) {
  const { state } = useApp();
  const photo = photoFor(recipe.id, state.recipePhotos);

  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: 10, flex: 'none',
    overflow: 'hidden', background: 'var(--inset)',
    display: 'grid', placeItems: 'center',
    border: '1px solid var(--line)',
  };

  if (!photo) {
    // Repli neutre : une initiale, jamais une illustration.
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

/** Bandeau en tête de la fiche recette. Rien ne s'affiche sans photo. */
export function RecipePhotoBanner({ recipe }: { recipe: Recipe }) {
  const { state } = useApp();
  const photo = photoFor(recipe.id, state.recipePhotos);
  if (!photo) return null;

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16 / 10',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      background: 'var(--inset)',
      border: '1px solid var(--line)',
    }}>
      <img src={photo} alt={`Photo — ${recipe.name}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  );
}
