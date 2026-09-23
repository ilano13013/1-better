import type { AppState } from '../types';
import { STATE_VERSION, createInitialState } from './state';
import { type Sealed, decryptJson, encryptJson } from '../engine/crypto';

/**
 * Persistance locale, cloisonnée par compte. Aucune donnée ne quitte l'appareil.
 *
 * Le compte local garde la clé historique : les personnes qui utilisaient
 * l'application avant l'écran de connexion retrouvent leur semaine intacte en
 * choisissant « continuer sans compte ».
 */
const BASE_KEY = 'one-better:state:v1';

export const LOCAL_ACCOUNT_ID = 'local';

function keyFor(accountId: string): string {
  return accountId === LOCAL_ACCOUNT_ID ? BASE_KEY : `${BASE_KEY}:${accountId}`;
}

/**
 * Lecture tolérante : un état corrompu ou d'une version antérieure repart d'un
 * état vierge plutôt que de casser l'application.
 */
export function loadState(accountId: string = LOCAL_ACCOUNT_ID): AppState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== STATE_VERSION || !parsed.profile) return null;
    return { ...createInitialState(), ...parsed } as AppState;
  } catch {
    return null;
  }
}

export function saveState(state: AppState, accountId: string = LOCAL_ACCOUNT_ID): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(keyFor(accountId), JSON.stringify(state));
  } catch {
    // Quota dépassé ou stockage indisponible : l'application continue en mémoire.
  }
}

export function clearState(accountId: string = LOCAL_ACCOUNT_ID): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(keyFor(accountId));
  } catch {
    /* ignoré */
  }
}

/** Vrai si une semaine est déjà enregistrée pour ce compte sur cet appareil. */
export function hasSavedState(accountId: string = LOCAL_ACCOUNT_ID): boolean {
  return loadState(accountId) !== null;
}

/* --------------------------- Comptes e-mail chiffrés -------------------------- */

/**
 * Les comptes créés dans l'application ont un mot de passe, donc une clé : leur
 * état est stocké chiffré, sous la même clé de stockage. Un état chiffré est
 * illisible pour `loadState`, qui renvoie alors `null` — c'est voulu.
 */
interface SealedState extends Sealed { sealed: true }

export async function loadSealedState(accountId: string, key: CryptoKey): Promise<AppState | null> {
  if (typeof localStorage === 'undefined') return null;
  let sealed: SealedState;
  try {
    const raw = localStorage.getItem(keyFor(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SealedState>;
    if (parsed.sealed !== true || !parsed.iv || !parsed.data) return null;
    sealed = parsed as SealedState;
  } catch {
    return null;
  }
  const parsed = await decryptJson<Partial<AppState>>(key, sealed);
  if (!parsed || parsed.version !== STATE_VERSION || !parsed.profile) return null;
  return { ...createInitialState(), ...parsed } as AppState;
}

export async function saveSealedState(
  state: AppState, accountId: string, key: CryptoKey,
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    const sealed = await encryptJson(key, state);
    localStorage.setItem(keyFor(accountId), JSON.stringify({ sealed: true, ...sealed }));
  } catch {
    // Quota dépassé ou stockage indisponible : l'application continue en mémoire.
  }
}
