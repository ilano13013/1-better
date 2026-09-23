import type { LocalAccount } from '../engine/localAccount';

/**
 * Registre des comptes e-mail créés sur cet appareil.
 *
 * Il ne contient aucun mot de passe ni condensat de mot de passe : seulement un
 * sel et un vérificateur chiffré. Le registre reste en clair — c'est lui qui
 * permet de proposer la liste des comptes connus sur l'écran de connexion.
 */
const KEY = 'one-better:accounts:v1';

export function listLocalAccounts(): LocalAccount[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAccount);
  } catch {
    return [];
  }
}

export function findLocalAccount(accountId: string): LocalAccount | null {
  return listLocalAccounts().find((a) => a.accountId === accountId) ?? null;
}

/** Ajoute ou remplace un compte. L'identifiant vient de l'e-mail : pas de doublon. */
export function saveLocalAccount(account: LocalAccount): void {
  if (typeof localStorage === 'undefined') return;
  const next = listLocalAccounts().filter((a) => a.accountId !== account.accountId);
  next.push(account);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : le compte vaut pour cette visite seulement.
  }
}

export function removeLocalAccount(accountId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      KEY, JSON.stringify(listLocalAccounts().filter((a) => a.accountId !== accountId)),
    );
  } catch {
    /* ignoré */
  }
}

function isAccount(value: unknown): value is LocalAccount {
  const a = value as Partial<LocalAccount>;
  return typeof a?.accountId === 'string' && typeof a.email === 'string'
    && typeof a.salt === 'string' && typeof a.iterations === 'number'
    && typeof a.check?.iv === 'string' && typeof a.check?.data === 'string';
}
