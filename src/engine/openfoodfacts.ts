import type { Per100g } from './intake';

/**
 * Recherche d'un produit par son code-barres, via Open Food Facts.
 *
 * C'est le **seul appel réseau de l'application**, et il est facultatif : tout
 * le reste — plan, macros, courses, journal par la base d'aliments — fonctionne
 * hors ligne. Une recherche qui échoue n'empêche donc rien ; elle propose de
 * saisir les valeurs à la main.
 *
 * Open Food Facts est une base contributive : ses valeurs viennent des
 * emballages recopiés par des bénévoles, et elles peuvent être fausses ou
 * absentes. L'application affiche donc la source et laisse corriger avant
 * d'enregistrer, plutôt que de présenter ces chiffres comme vérifiés.
 */

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_fr,brands,quantity,nutriments';

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand: string;
  per100g: Per100g;
  /** Champs que la fiche ne renseignait pas : ils valent 0 et sont à vérifier. */
  missing: (keyof Per100g)[];
}

export type LookupError =
  | 'code_invalide'
  | 'introuvable'
  | 'sans_valeurs'
  | 'reseau';

export type LookupResult =
  | { ok: true; product: ScannedProduct }
  | { ok: false; error: LookupError };

/** Ne garde que les chiffres : un scan renvoie parfois des espaces ou un tiret. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Valide un code EAN-8, EAN-13 ou UPC-A par sa clé de contrôle.
 *
 * Le dernier chiffre d'un code-barres est calculé à partir des autres. Un scan
 * mal lu échoue donc ce test, et l'application le dit tout de suite au lieu
 * d'interroger le réseau pour rien.
 */
export function isValidBarcode(raw: string): boolean {
  const code = normalizeBarcode(raw);
  if (![8, 12, 13].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // De droite à gauche, un chiffre sur deux compte triple.
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Lit un nombre d'Open Food Facts, qui livre parfois des chaînes. */
function numberOf(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

interface OffNutriments {
  'energy-kcal_100g'?: unknown;
  'energy_100g'?: unknown;
  proteins_100g?: unknown;
  carbohydrates_100g?: unknown;
  fat_100g?: unknown;
}

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    product_name_fr?: string;
    brands?: string;
    nutriments?: OffNutriments;
  };
}

/**
 * Construit le produit à partir de la réponse. Séparé de l'appel réseau pour
 * être testable sans réseau — et parce que c'est là que sont les pièges.
 */
export function parseProduct(barcode: string, body: OffResponse): LookupResult {
  const product = body.product;
  if (!product || body.status === 0) return { ok: false, error: 'introuvable' };

  const n = product.nutriments ?? {};
  let kcal = numberOf(n['energy-kcal_100g']);
  // Certaines fiches ne portent que des kilojoules.
  if (kcal === null) {
    const kj = numberOf(n.energy_100g);
    if (kj !== null) kcal = Math.round(kj / 4.184);
  }
  const protein = numberOf(n.proteins_100g);
  const carbs = numberOf(n.carbohydrates_100g);
  const fat = numberOf(n.fat_100g);

  if (kcal === null && protein === null && carbs === null && fat === null) {
    return { ok: false, error: 'sans_valeurs' };
  }

  const missing: (keyof Per100g)[] = [];
  if (kcal === null) missing.push('kcal');
  if (protein === null) missing.push('protein');
  if (carbs === null) missing.push('carbs');
  if (fat === null) missing.push('fat');

  const name = (product.product_name_fr || product.product_name || '').trim();
  return {
    ok: true,
    product: {
      barcode,
      name: name || `Produit ${barcode}`,
      brand: (product.brands ?? '').split(',')[0].trim(),
      per100g: {
        kcal: kcal ?? 0,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
      },
      missing,
    },
  };
}

/**
 * Interroge Open Food Facts. `fetchImpl` est injectable pour les tests : on ne
 * fait pas dépendre une suite de tests d'un service extérieur.
 */
export async function lookupBarcode(
  raw: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<LookupResult> {
  const barcode = normalizeBarcode(raw);
  if (!isValidBarcode(barcode)) return { ok: false, error: 'code_invalide' };
  try {
    const res = await fetchImpl(`${ENDPOINT}/${barcode}.json?fields=${FIELDS}`, { signal });
    if (!res.ok) return { ok: false, error: res.status === 404 ? 'introuvable' : 'reseau' };
    return parseProduct(barcode, (await res.json()) as OffResponse);
  } catch {
    return { ok: false, error: 'reseau' };
  }
}

export const LOOKUP_MESSAGES: Record<LookupError, string> = {
  code_invalide: "Ce code-barres n'est pas valide — la lecture a dû échouer.",
  introuvable: "Ce produit n'est pas dans Open Food Facts.",
  sans_valeurs: 'Cette fiche ne porte aucune valeur nutritionnelle.',
  reseau: 'Open Food Facts est injoignable.',
};
