/**
 * Comptes créés directement dans l'application, sans Apple ni Google.
 *
 * Un compte e-mail n'existe que sur cet appareil : il n'y a pas de serveur pour
 * l'héberger. Sa raison d'être est double — séparer plusieurs personnes sur un
 * même navigateur, et chiffrer les données de chacune avec son mot de passe.
 *
 * Conséquence à assumer, et à dire dans l'interface : **un mot de passe oublié
 * ne peut pas être réinitialisé.** Aucun serveur ne détient de quoi le faire,
 * et les données sont chiffrées avec lui. Elles sont alors perdues.
 */
import {
  KDF_ITERATIONS, type Sealed, decryptJson, deriveKey, encryptJson, fromB64, randomBytes, toB64,
  toB64Url,
} from './crypto';

/** Texte chiffré à la création, redéchiffré pour valider le mot de passe. */
const CHECK_PHRASE = 'one-better';

export interface LocalAccount {
  accountId: string;
  email: string;
  name: string;
  createdAt: string;
  /** Sel de dérivation, en base64, propre à ce compte. */
  salt: string;
  iterations: number;
  /** Vérificateur du mot de passe. */
  check: Sealed;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Identifiant de compte, dérivé de l'e-mail normalisé.
 *
 * Déterministe et sans collision : deux e-mails différents donnent deux
 * identifiants différents, et le même e-mail retrouve toujours son compte.
 */
export function localAccountId(email: string): string {
  const normalized = normalizeEmail(email);
  if (normalized === '') throw new Error('e-mail vide');
  return `email.${toB64Url(new TextEncoder().encode(normalized))}`;
}

/**
 * Validation de l'e-mail : volontairement permissive. Aucun message n'est
 * envoyé à cette adresse — elle sert d'identifiant — donc la refuser sur un
 * motif trop strict ne protégerait personne.
 */
export function validateEmail(email: string): string | null {
  const value = normalizeEmail(email);
  if (value === '') return 'Indique une adresse e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "Cette adresse ne ressemble pas à un e-mail.";
  return null;
}

/** Longueur minimale seule : une règle de composition pousse aux mots de passe faibles et notés. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (password.length > 200) return 'Le mot de passe est trop long.';
  return null;
}

/** Crée le descripteur d'un compte, et la clé qui chiffrera ses données. */
export async function createLocalAccount(
  email: string, password: string, name: string, now: Date = new Date(),
): Promise<{ account: LocalAccount; key: CryptoKey }> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return {
    account: {
      accountId: localAccountId(email),
      email: normalizeEmail(email),
      name: name.trim(),
      createdAt: now.toISOString(),
      salt: toB64(salt),
      iterations: KDF_ITERATIONS,
      check: await encryptJson(key, CHECK_PHRASE),
    },
    key,
  };
}

/**
 * Vérifie un mot de passe et renvoie la clé de déchiffrement, ou `null`.
 *
 * Il n'y a rien à comparer : c'est le déchiffrement du vérificateur qui
 * réussit ou échoue. Aucun condensat de mot de passe n'est stocké.
 */
export async function unlockLocalAccount(
  account: LocalAccount, password: string,
): Promise<CryptoKey | null> {
  const key = await deriveKey(password, fromB64(account.salt), account.iterations);
  const check = await decryptJson<string>(key, account.check);
  return check === CHECK_PHRASE ? key : null;
}
