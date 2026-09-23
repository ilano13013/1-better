/**
 * Images livrées avec l'application.
 *
 * Les fichiers déposés dans `src/assets/logos/` et `src/assets/recipes/` sont
 * détectés automatiquement : aucun code à modifier pour en ajouter un. Le nom
 * du fichier doit simplement correspondre à l'identifiant de l'enseigne, de la
 * salle ou de la recette.
 *
 *   src/assets/logos/lidl.svg              → enseigne « lidl »
 *   src/assets/logos/basic-fit.png         → salle « basic_fit »
 *   src/assets/recipes/porridge_banane.jpg → recette « porridge_banane »
 *
 * Les tirets sont acceptés à la place des tirets bas, et la casse est ignorée.
 *
 * Contrairement au stockage local du navigateur, ces images font partie du
 * build : elles suivent sur tous les appareils et pour tous les visiteurs.
 */

type Files = Record<string, string>;

const logoFiles = import.meta.glob('../assets/logos/*.{svg,png,webp,jpg,jpeg,avif}', {
  eager: true, query: '?url', import: 'default',
}) as Files;

const recipeFiles = import.meta.glob('../assets/recipes/*.{svg,png,webp,jpg,jpeg,avif}', {
  eager: true, query: '?url', import: 'default',
}) as Files;

/** `../assets/logos/Basic-Fit.svg` → `basic_fit` */
function keyOf(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function index(files: Files): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) out[keyOf(path)] = url;
  return out;
}

/** Logos d'enseignes et de salles, indexés par identifiant. */
export const BUNDLED_LOGOS = index(logoFiles);

/** Photos de recettes, indexées par identifiant de recette. */
export const BUNDLED_PHOTOS = index(recipeFiles);
