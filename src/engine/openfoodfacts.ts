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

const HOST = 'https://world.openfoodfacts.org';
const FIELDS = 'product_name,product_name_fr,brands,quantity,nutriments';

/**
 * Deux adresses, essayées dans l'ordre.
 *
 * L'API v2 avec sa liste de champs est la bonne : elle renvoie quelques
 * kilo-octets au lieu de la fiche entière. Mais une erreur de serveur sur
 * celle-ci ne doit pas condamner la recherche, alors que l'API v0 — plus
 * ancienne, plus bavarde, toujours servie — répondrait. Un second essai ne
 * coûte qu'une requête, et seulement quand la première a répondu par une
 * erreur : inutile de réessayer quand c'est la page qui bloque l'appel.
 */
function endpoints(barcode: string): string[] {
  return [
    `${HOST}/api/v2/product/${barcode}.json?fields=${encodeURIComponent(FIELDS)}`,
    `${HOST}/api/v0/product/${barcode}.json`,
  ];
}

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
  | 'bloque'
  | 'hors_ligne'
  | 'lent'
  | 'serveur'
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

/** Contexte d'exécution, pour distinguer les causes d'un appel qui échoue. */
export interface LookupContext {
  /** La page tourne-t-elle dans un cadre imbriqué ? */
  framed: boolean;
  /** Le navigateur se déclare-t-il en ligne ? */
  online: boolean;
}

export function readContext(): LookupContext {
  let framed = false;
  try { framed = typeof window !== 'undefined' && window.self !== window.top; } catch { framed = true; }
  return {
    framed,
    online: typeof navigator === 'undefined' || navigator.onLine !== false,
  };
}

/**
 * Distingue les causes d'un `fetch` qui a levé.
 *
 * `fetch` lève la même `TypeError` qu'il s'agisse d'une coupure réseau ou d'un
 * blocage par la politique de sécurité de la page. Renvoyer « injoignable »
 * dans les deux cas envoyait chercher une panne côté Open Food Facts alors que
 * c'est l'hébergement de la page qui refuse l'appel. Le contexte tranche :
 * hors ligne d'abord, puis cadre imbriqué — un artefact claude.ai n'autorise
 * pas les appels vers un autre domaine.
 */
export function classifyFailure(ctx: LookupContext, aborted: boolean): LookupError {
  if (aborted) return 'lent';
  if (!ctx.online) return 'hors_ligne';
  if (ctx.framed) return 'bloque';
  return 'reseau';
}

/** Au-delà, l'attente ne sert plus à rien. */
const TIMEOUT_MS = 6000;

/**
 * Interroge Open Food Facts. `fetchImpl` et `ctx` sont injectables : une suite
 * de tests ne doit dépendre ni d'un service extérieur, ni d'un navigateur.
 */
export async function lookupBarcode(
  raw: string,
  fetchImpl: typeof fetch = fetch,
  ctx: LookupContext = readContext(),
): Promise<LookupResult> {
  const barcode = normalizeBarcode(raw);
  if (!isValidBarcode(barcode)) return { ok: false, error: 'code_invalide' };

  let last: LookupResult = { ok: false, error: 'reseau' };
  for (const url of endpoints(barcode)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      if (res.status === 404) return { ok: false, error: 'introuvable' };
      if (res.ok) return parseProduct(barcode, (await res.json()) as OffResponse);
      last = { ok: false, error: 'serveur' };
      // Erreur de serveur : l'autre adresse vaut la peine d'être tentée.
    } catch {
      // Blocage, coupure ou délai : réessayer la même chose n'y changera rien.
      return { ok: false, error: classifyFailure(ctx, controller.signal.aborted) };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

export const LOOKUP_MESSAGES: Record<LookupError, string> = {
  code_invalide: "Ce code-barres n'est pas valide — la lecture a dû échouer.",
  introuvable: "Ce produit n'est pas dans Open Food Facts.",
  sans_valeurs: 'Cette fiche ne porte aucune valeur nutritionnelle.',
  bloque: "Cet affichage bloque les appels vers d'autres sites. "
    + "Ouvre l'application à son adresse publique pour chercher un produit.",
  hors_ligne: 'Pas de connexion. La base d\'aliments fonctionne hors ligne.',
  lent: "Open Food Facts n'a pas répondu à temps.",
  serveur: 'Open Food Facts a répondu par une erreur.',
  reseau: 'Open Food Facts est injoignable.',
};
