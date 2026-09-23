/**
 * Identification par Apple ou Google.
 *
 * Ce module ne contient que de la logique pure : lecture de la configuration,
 * décodage du jeton d'identité, dérivation de l'identifiant de compte. Les
 * appels aux SDK d'Apple et de Google vivent dans `src/screens/SignIn.tsx`.
 *
 * Ce que cette identification fait, et ce qu'elle ne fait pas
 * -----------------------------------------------------------
 * L'application est un site statique : il n'y a pas de serveur. Le jeton
 * renvoyé par Apple ou Google est donc décodé côté navigateur, **sans
 * vérification de signature** — seul un serveur peut la vérifier. Il sert à
 * reconnaître la personne et à séparer ses données de celles d'un autre compte
 * sur le même appareil. Il ne protège rien : les données restent locales, et
 * un compte ne les synchronise pas d'un appareil à l'autre.
 */

export type AuthProvider = 'google' | 'apple' | 'local';

/** Champs d'un jeton d'identité OpenID que l'application utilise. */
export interface IdTokenClaims {
  /** Identifiant stable de la personne chez le fournisseur. */
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  /** Destinataire du jeton : doit correspondre à l'identifiant client. */
  aud?: string;
  iss?: string;
  /** Expiration, en secondes depuis l'époque Unix. */
  exp?: number;
}

export interface GoogleConfig { clientId: string }
export interface AppleConfig { clientId: string; redirectUri: string }

export interface AuthConfig {
  google: GoogleConfig | null;
  apple: AppleConfig | null;
}

/**
 * Lit la configuration des fournisseurs depuis les variables de build.
 *
 * Un identifiant client n'est pas un secret : il est public par construction et
 * peut vivre dans le dépôt ou dans une variable de dépôt. Un fournisseur non
 * configuré est renvoyé à `null` — l'écran de connexion le signale au lieu de
 * proposer un bouton qui ne fonctionnerait pas.
 */
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const google = trim(env.VITE_GOOGLE_CLIENT_ID);
  const appleId = trim(env.VITE_APPLE_CLIENT_ID);
  const appleRedirect = trim(env.VITE_APPLE_REDIRECT_URI);
  return {
    google: google ? { clientId: google } : null,
    // Apple exige une URL de redirection déclarée : sans elle, le SDK échoue
    // au moment du clic. Mieux vaut désactiver le bouton tout de suite.
    apple: appleId && appleRedirect ? { clientId: appleId, redirectUri: appleRedirect } : null,
  };
}

function trim(v: string | undefined): string {
  return (v ?? '').trim();
}

/**
 * Décode la charge utile d'un jeton d'identité.
 *
 * La signature n'est **pas** vérifiée : c'est impossible sans serveur. Voir
 * l'avertissement en tête de module.
 */
export function decodeIdToken(token: string): IdTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(parts[1]));
    const claims = JSON.parse(json) as Partial<IdTokenClaims>;
    if (typeof claims.sub !== 'string' || claims.sub === '') return null;
    return claims as IdTokenClaims;
  } catch {
    return null;
  }
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Identifiant de compte, utilisé comme suffixe de clé de stockage.
 *
 * Deux personnes différentes chez le même fournisseur ne peuvent pas se
 * retrouver sur la même clé : le `sub` est stable et unique par fournisseur.
 */
export function accountIdFor(provider: AuthProvider, sub: string): string {
  const safe = sub.replace(/[^A-Za-z0-9._-]/g, '');
  if (safe === '') throw new Error('identifiant de compte vide');
  return `${provider}.${safe}`;
}

export interface Session {
  accountId: string;
  provider: AuthProvider;
  /** Nom affiché. Apple ne le transmet qu'à la toute première autorisation. */
  name: string;
  email: string;
  signedInAt: string;
}

/** Session locale : aucune identification, données sur cet appareil seulement. */
export const LOCAL_SESSION: Session = {
  accountId: 'local',
  provider: 'local',
  name: '',
  email: '',
  signedInAt: '',
};

/**
 * Construit une session à partir d'un jeton d'identité.
 *
 * `aud` est comparé à l'identifiant client attendu : un jeton destiné à une
 * autre application est refusé. `fallbackName` sert à Apple, qui ne transmet le
 * nom qu'une seule fois, en dehors du jeton.
 */
export function sessionFromIdToken(
  provider: 'google' | 'apple',
  token: string,
  expectedAudience: string,
  now: Date = new Date(),
  fallbackName = '',
): Session | null {
  const claims = decodeIdToken(token);
  if (!claims) return null;
  if (claims.aud !== undefined && claims.aud !== expectedAudience) return null;
  if (claims.exp !== undefined && claims.exp * 1000 <= now.getTime()) return null;
  return {
    accountId: accountIdFor(provider, claims.sub),
    provider,
    name: (claims.name ?? fallbackName).trim(),
    email: (claims.email ?? '').trim(),
    signedInAt: now.toISOString(),
  };
}

/** Libellé court d'une session, pour l'écran Profil. */
export function sessionLabel(session: Session): string {
  if (session.provider === 'local') return 'Sans compte — données sur cet appareil';
  const who = session.name || session.email || 'Compte';
  return `${who} · ${session.provider === 'google' ? 'Google' : 'Apple'}`;
}
