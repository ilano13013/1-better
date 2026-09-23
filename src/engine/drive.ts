import type { ShoppingList, ShoppingListItem } from '../types';
import { getStore } from '../data/stores';

/**
 * Intégrations Drive — ARCHITECTURE UNIQUEMENT.
 *
 * Aucune API d'enseigne n'est appelée et aucun partenariat n'est supposé.
 * Ce module définit le contrat qu'un connecteur devra respecter le jour où
 * une enseigne exposera un accès officiel, ainsi que le pipeline de
 * préparation du panier :
 *
 *   1. récupération des produits compatibles (catalogue de l'enseigne)
 *   2. correspondance entre la liste et le catalogue
 *   3. sélection des formats appropriés
 *   4. préparation du panier
 *   5. vérification par l'utilisateur
 *
 * Aucun achat n'est déclenché automatiquement : le connecteur s'arrête à un
 * panier PRÉPARÉ, que l'utilisateur valide lui-même chez l'enseigne.
 */

export interface DriveCatalogProduct {
  externalId: string;
  name: string;
  packSize: number;
  packUnit: 'g' | 'ml' | 'piece';
  price: number;
  /** Horodatage de la donnée de prix : sans lui, le prix reste « estimé ». */
  priceUpdatedAt: string | null;
  available: boolean;
}

export interface DriveCartLine {
  item: ShoppingListItem;
  match: DriveCatalogProduct | null;
  quantity: number;
  /** Renseigné lorsqu'aucune correspondance fiable n'a été trouvée. */
  issue?: string;
}

export interface DriveCartDraft {
  storeId: string;
  lines: DriveCartLine[];
  /** Total calculé à partir du catalogue de l'enseigne, jamais estimé. */
  total: number;
  requiresUserReview: true;
}

/** Contrat à implémenter par enseigne. */
export interface DriveConnector {
  storeId: string;
  label: string;
  /** Catalogue des produits compatibles avec la liste fournie. */
  fetchCatalog(items: ShoppingListItem[]): Promise<DriveCatalogProduct[]>;
  /** Correspondance liste ↔ catalogue, format le plus adapté. */
  match(item: ShoppingListItem, catalog: DriveCatalogProduct[]): DriveCatalogProduct | null;
}

/** Aucun connecteur n'est enregistré à ce stade. */
const CONNECTORS = new Map<string, DriveConnector>();

export function registerDriveConnector(connector: DriveConnector): void {
  CONNECTORS.set(connector.storeId, connector);
}

export function getDriveConnector(storeId: string): DriveConnector | null {
  return CONNECTORS.get(storeId) ?? null;
}

export type DriveStatus =
  | { state: 'connecteur_absent'; message: string }
  | { state: 'pret'; connector: DriveConnector };

export function driveStatus(storeId: string): DriveStatus {
  const connector = getDriveConnector(storeId);
  if (connector) return { state: 'pret', connector };
  const store = getStore(storeId);
  return {
    state: 'connecteur_absent',
    message: store.driveSupported
      ? `${store.name} dispose d'un Drive, mais aucun accès officiel n'est connecté à l'application. La liste reste exportable pour être saisie manuellement.`
      : `Aucun Drive connecté pour ${store.name}. La liste reste exportable.`,
  };
}

/**
 * Prépare un panier à partir de la liste de courses.
 * Le panier retourné doit impérativement être revu par l'utilisateur.
 */
export async function prepareCart(
  list: ShoppingList,
  items: ShoppingListItem[],
): Promise<DriveCartDraft | null> {
  const connector = getDriveConnector(list.storeId);
  if (!connector) return null;

  const catalog = await connector.fetchCatalog(items);
  const lines: DriveCartLine[] = items.map((item) => {
    const match = connector.match(item, catalog);
    if (!match) return { item, match: null, quantity: 0, issue: 'Aucune correspondance dans le catalogue.' };
    if (!match.available) return { item, match, quantity: 0, issue: 'Produit indisponible.' };
    const quantity = Math.max(1, Math.ceil(item.toBuyQty / match.packSize));
    return { item, match, quantity };
  });

  const total = lines.reduce((s, l) => s + (l.match ? l.match.price * l.quantity : 0), 0);
  return {
    storeId: list.storeId,
    lines,
    total: Math.round(total * 100) / 100,
    requiresUserReview: true,
  };
}

/* ------------------------------------------------------------------ */
/* Préparation assistée (voie disponible aujourd'hui)                   */
/* ------------------------------------------------------------------ */

/**
 * Aucune enseigne française ne publie d'API permettant à une application
 * tierce de remplir le panier d'un client. Les seules façons de « remplir
 * automatiquement » seraient de détenir les identifiants de l'utilisateur et
 * de piloter le site de l'enseigne — ce qui contrevient à leurs conditions
 * d'utilisation, casse à la moindre évolution de leur interface et expose le
 * compte de l'utilisateur. L'application ne fait donc rien de tel.
 *
 * La voie praticable est une PRÉPARATION ASSISTÉE : l'application ordonne la
 * liste, ouvre la recherche de l'enseigne produit par produit et suit
 * l'avancement. Le panier reste construit et validé par l'utilisateur, sur le
 * site de l'enseigne, avec sa propre session.
 */

export interface StoreHandoff {
  storeId: string;
  /** Point d'entrée des courses en ligne. Toujours valable. */
  homeUrl: string;
  /**
   * Gabarit de recherche produit, `{q}` recevant le terme encodé.
   *
   * ⚠️ Ces gabarits ne sont PAS vérifiés : les enseignes modifient leurs URL
   * sans préavis et rien ici ne peut le détecter. Tant qu'un format n'a pas
   * été relevé et validé, le champ reste vide et l'application ouvre
   * simplement `homeUrl`.
   */
  searchTemplate?: string;
}

/**
 * Gabarits par défaut. Volontairement limités à la page d'accueil des courses
 * en ligne : un lien de recherche inventé enverrait l'utilisateur sur une page
 * d'erreur, ce qui est pire que de le déposer à l'accueil avec le nom du
 * produit déjà dans le presse-papiers. Renseigne `searchTemplate` une fois le
 * format relevé sur le site de l'enseigne — l'écran de préparation permet de
 * le saisir et de le tester.
 */
export const STORE_HANDOFFS: Record<string, StoreHandoff> = {
  lidl: { storeId: 'lidl', homeUrl: 'https://www.lidl.fr' },
  aldi: { storeId: 'aldi', homeUrl: 'https://www.aldi.fr' },
  leclerc: { storeId: 'leclerc', homeUrl: 'https://www.leclercdrive.fr' },
  intermarche: { storeId: 'intermarche', homeUrl: 'https://www.intermarche.com' },
  carrefour: { storeId: 'carrefour', homeUrl: 'https://www.carrefour.fr' },
  auchan: { storeId: 'auchan', homeUrl: 'https://www.auchan.fr' },
  superu: { storeId: 'superu', homeUrl: 'https://www.coursesu.com' },
  monoprix: { storeId: 'monoprix', homeUrl: 'https://courses.monoprix.fr' },
};

export function getHandoff(storeId: string): StoreHandoff | null {
  return STORE_HANDOFFS[storeId] ?? null;
}

/**
 * Terme de recherche déduit du libellé produit : on retire le
 * conditionnement, qui varie d'une enseigne à l'autre et fait échouer la
 * recherche (« Filets de poulet 1 kg » → « Filets de poulet »).
 */
export function searchTerm(item: ShoppingListItem): string {
  const cleaned = item.productLabel
    .replace(/\b\d+\s*[x×]\s*\d+\s*(g|kg|ml|cl|l)\b/gi, ' ')
    .replace(/\b\d+[.,]?\d*\s*(g|kg|ml|cl|l)\b/gi, ' ')
    .replace(/\b[x×]\s*\d+\b/gi, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\d+\s*%/g, ' ')
    .replace(/[,;]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned.length >= 3 ? cleaned : item.foodName;
}

/** URL à ouvrir pour un produit : recherche si un gabarit existe, sinon accueil. */
export function buildSearchUrl(handoff: StoreHandoff, term: string): string {
  const pattern = handoff.searchTemplate;
  if (!pattern || !pattern.includes('{q}')) return handoff.homeUrl;
  try {
    const url = pattern.replace('{q}', encodeURIComponent(term));
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return handoff.homeUrl;
    return parsed.toString();
  } catch {
    return handoff.homeUrl;
  }
}

export interface HandoffStep {
  item: ShoppingListItem;
  term: string;
  done: boolean;
}

/** Étapes de préparation, dans l'ordre de la liste (donc par rayon). */
export function handoffPlan(items: ShoppingListItem[], done: string[]): HandoffStep[] {
  const doneSet = new Set(done);
  return items.map((item) => ({ item, term: searchTerm(item), done: doneSet.has(item.id) }));
}

export interface HandoffProgress {
  total: number;
  done: number;
  /** Montant des lignes déjà mises au panier chez l'enseigne. */
  doneTotal: number;
  /** Index de la première étape restante, -1 si tout est fait. */
  nextIndex: number;
}

export function handoffProgress(steps: HandoffStep[]): HandoffProgress {
  const done = steps.filter((s) => s.done);
  return {
    total: steps.length,
    done: done.length,
    doneTotal: Math.round(done.reduce((s, x) => s + x.item.totalPrice, 0) * 100) / 100,
    nextIndex: steps.findIndex((s) => !s.done),
  };
}
