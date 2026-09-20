import type { Store } from '../types';

/**
 * Enseignes supportées. `driveSupported` indique qu'un Drive existe chez
 * l'enseigne — aucune intégration n'est active, voir src/engine/drive.ts.
 */
/**
 * ⚠️ Les couleurs servent uniquement de fond au monogramme affiché tant
 * qu'aucun logo officiel n'a été déposé dans `src/assets/logos/`. Elles sont
 * indicatives et n'ont pas été relevées sur les chartes de marque.
 */
export const STORES: Store[] = [
  { id: 'lidl', name: 'Lidl', priceIndex: 0.88, color: '#0050AA', driveSupported: false },
  { id: 'aldi', name: 'Aldi', priceIndex: 0.86, color: '#00457C', driveSupported: false },
  { id: 'leclerc', name: 'Leclerc', priceIndex: 0.94, color: '#0066B3', driveSupported: true },
  { id: 'intermarche', name: 'Intermarché', priceIndex: 1.0, color: '#E2001A', driveSupported: true },
  { id: 'carrefour', name: 'Carrefour', priceIndex: 1.04, color: '#004E9F', driveSupported: true },
  { id: 'auchan', name: 'Auchan', priceIndex: 1.02, color: '#E2001A', driveSupported: true },
  { id: 'superu', name: 'Super U', priceIndex: 1.03, color: '#E30613', driveSupported: true },
  { id: 'monoprix', name: 'Monoprix', priceIndex: 1.22, color: '#E5007E', driveSupported: true },
  { id: 'autre', name: 'Autre enseigne', priceIndex: 1.0, color: '#3F4045', driveSupported: false },
];

export const STORE_BY_ID: Record<string, Store> = Object.fromEntries(STORES.map((s) => [s.id, s]));

export function getStore(id: string): Store {
  return STORE_BY_ID[id] ?? STORE_BY_ID['autre'];
}
