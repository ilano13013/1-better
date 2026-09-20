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
