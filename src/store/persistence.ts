import type { AppState } from '../types';
import { STATE_VERSION, createInitialState } from './state';

const KEY = 'one-better:state:v1';

/**
 * Persistance locale. Aucune donnée ne quitte l'appareil.
 * La lecture est tolérante : un état corrompu ou d'une version antérieure
 * repart d'un état vierge plutôt que de casser l'application.
 */
export function loadState(): AppState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== STATE_VERSION || !parsed.profile) return null;
    return { ...createInitialState(), ...parsed } as AppState;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota dépassé ou stockage indisponible : l'application continue en mémoire.
  }
}

export function clearState(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignoré */
  }
}
