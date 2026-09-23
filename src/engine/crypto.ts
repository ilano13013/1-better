/**
 * Chiffrement des données d'un compte e-mail.
 *
 * Pourquoi chiffrer, alors que tout reste sur l'appareil ? Parce qu'un mot de
 * passe qui ne protège rien est un mensonge d'interface. Ici il protège pour
 * de vrai : la clé est dérivée du mot de passe, et l'état du compte est
 * stocké chiffré. Sans le mot de passe, le contenu de `localStorage` n'est pas
 * lisible — y compris par quelqu'un qui ouvre la console du navigateur.
 *
 * Ce que cela ne protège pas : une session déjà ouverte (la clé est alors en
 * mémoire), et le reste de l'application (compte local, Apple, Google), qui
 * n'a pas de mot de passe dont dériver une clé.
 *
 * PBKDF2-HMAC-SHA-256 et AES-GCM 256 bits, via WebCrypto : rien d'exotique,
 * aucune dépendance.
 */

/** Coût de dérivation. Le mot de passe n'est saisi qu'à la connexion. */
export const KDF_ITERATIONS = 310_000;

/** Charge chiffrée : le vecteur d'initialisation voyage avec le message. */
export interface Sealed {
  iv: string;
  data: string;
}

export function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromB64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Variante sans caractère réservé, utilisable dans une clé de stockage. */
export function toB64Url(bytes: Uint8Array): string {
  return toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** Dérive une clé AES-GCM à partir d'un mot de passe et d'un sel. */
export async function deriveKey(
  password: string, salt: Uint8Array, iterations: number = KDF_ITERATIONS,
): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource,
  );
  return { iv: toB64(iv), data: toB64(new Uint8Array(cipher)) };
}

/**
 * Déchiffre, ou renvoie `null`. AES-GCM authentifie le message : une mauvaise
 * clé — donc un mauvais mot de passe — fait échouer le déchiffrement plutôt
 * que de produire des octets faux. C'est ce qui sert à valider le mot de passe.
 */
export async function decryptJson<T>(key: CryptoKey, sealed: Sealed): Promise<T | null> {
  try {
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(sealed.iv) as BufferSource },
      key,
      fromB64(sealed.data) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}
