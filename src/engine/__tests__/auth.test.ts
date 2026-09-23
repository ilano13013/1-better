import { describe, expect, it } from 'vitest';
import {
  accountIdFor, decodeIdToken, readAuthConfig, sessionFromIdToken, sessionLabel,
  type IdTokenClaims,
} from '../auth';

/** Fabrique un jeton d'identité : seule la charge utile est lue. */
function idToken(claims: Partial<IdTokenClaims>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = '';
    for (const byte of bytes) bin += String.fromCharCode(byte);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'RS256' })}.${b64(claims)}.c2lnbmF0dXJl`;
}

const AUD = '1234.apps.googleusercontent.com';
const NOW = new Date('2026-09-23T12:00:00Z');
const LATER = Math.floor(NOW.getTime() / 1000) + 3600;

describe('identification', () => {
  it('ne propose un fournisseur que s\'il est configuré', () => {
    expect(readAuthConfig({})).toEqual({ google: null, apple: null });

    const partiel = readAuthConfig({ VITE_APPLE_CLIENT_ID: 'com.exemple.web' });
    // Apple échoue au clic sans URL de redirection : autant le désactiver.
    expect(partiel.apple).toBeNull();

    const complet = readAuthConfig({
      VITE_GOOGLE_CLIENT_ID: ` ${AUD} `,
      VITE_APPLE_CLIENT_ID: 'com.exemple.web',
      VITE_APPLE_REDIRECT_URI: 'https://exemple.test/1-better/',
    });
    expect(complet.google).toEqual({ clientId: AUD });
    expect(complet.apple).toEqual({
      clientId: 'com.exemple.web', redirectUri: 'https://exemple.test/1-better/',
    });
  });

  it('décode la charge utile d\'un jeton, accents compris', () => {
    const claims = decodeIdToken(idToken({ sub: '42', name: 'Amélie Désiré' }));
    expect(claims?.name).toBe('Amélie Désiré');
  });

  it('refuse un jeton mal formé ou sans identifiant', () => {
    expect(decodeIdToken('pas-un-jeton')).toBeNull();
    expect(decodeIdToken('a.b.c')).toBeNull();
    expect(decodeIdToken(idToken({ name: 'Sans sub' }))).toBeNull();
    expect(decodeIdToken(idToken({ sub: '' }))).toBeNull();
  });

  it('refuse un jeton destiné à une autre application', () => {
    const autre = idToken({ sub: '42', aud: 'une-autre-app', exp: LATER });
    expect(sessionFromIdToken('google', autre, AUD, NOW)).toBeNull();
  });

  it('refuse un jeton expiré', () => {
    const perime = idToken({ sub: '42', aud: AUD, exp: Math.floor(NOW.getTime() / 1000) - 1 });
    expect(sessionFromIdToken('google', perime, AUD, NOW)).toBeNull();
  });

  it('construit une session Google exploitable', () => {
    const session = sessionFromIdToken(
      'google',
      idToken({ sub: '11822', aud: AUD, exp: LATER, name: 'Camille', email: 'c@exemple.test' }),
      AUD, NOW,
    );
    expect(session).toEqual({
      accountId: 'google.11822',
      provider: 'google',
      name: 'Camille',
      email: 'c@exemple.test',
      signedInAt: NOW.toISOString(),
    });
  });

  it('accepte le nom transmis à part par Apple', () => {
    // Apple ne met pas le nom dans le jeton, et ne le transmet qu'une fois.
    const token = idToken({ sub: '000123.abc.0001', aud: 'com.exemple.web', exp: LATER });
    const session = sessionFromIdToken('apple', token, 'com.exemple.web', NOW, 'Camille Roux');
    expect(session?.name).toBe('Camille Roux');
    expect(session?.accountId).toBe('apple.000123.abc.0001');
  });

  it('cloisonne les comptes, y compris entre fournisseurs', () => {
    const a = accountIdFor('google', '42');
    const b = accountIdFor('apple', '42');
    const c = accountIdFor('google', '43');
    expect(new Set([a, b, c, 'local']).size).toBe(4);
  });

  it('écarte les caractères qui ne peuvent pas servir de clé', () => {
    expect(accountIdFor('google', 'a/b c:d')).toBe('google.abcd');
    expect(() => accountIdFor('google', '///')).toThrow();
  });

  it('nomme la session sans jamais afficher « undefined »', () => {
    const anonyme = sessionFromIdToken(
      'google', idToken({ sub: '7', aud: AUD, exp: LATER }), AUD, NOW,
    );
    expect(sessionLabel(anonyme!)).toBe('Compte · Google');
  });
});
