import { describe, expect, it } from 'vitest';
import { decryptJson, deriveKey, encryptJson, randomBytes } from '../crypto';
import {
  createLocalAccount, localAccountId, normalizeEmail, unlockLocalAccount,
  validateEmail, validatePassword,
} from '../localAccount';

// La dérivation est volontairement coûteuse : on l'allège ici pour ne pas
// transformer la suite de tests en épreuve d'endurance.
const FAST = 1_000;

describe('chiffrement', () => {
  it('rend ce qu\'on lui a confié', async () => {
    const key = await deriveKey('correct horse battery staple', randomBytes(16), FAST);
    const sealed = await encryptJson(key, { semaine: 7, note: 'accentué €' });
    expect(await decryptJson(key, sealed)).toEqual({ semaine: 7, note: 'accentué €' });
  });

  it('ne livre rien à une autre clé', async () => {
    const salt = randomBytes(16);
    const bonne = await deriveKey('mot-de-passe-1', salt, FAST);
    const mauvaise = await deriveKey('mot-de-passe-2', salt, FAST);
    const sealed = await encryptJson(bonne, { secret: true });
    // AES-GCM authentifie : une mauvaise clé échoue au lieu de produire du faux.
    expect(await decryptJson(mauvaise, sealed)).toBeNull();
  });

  it('ne produit jamais deux fois le même chiffré', async () => {
    const key = await deriveKey('mot-de-passe', randomBytes(16), FAST);
    const a = await encryptJson(key, { x: 1 });
    const b = await encryptJson(key, { x: 1 });
    expect(a.data).not.toBe(b.data);
    expect(a.iv).not.toBe(b.iv);
  });
});

describe('compte e-mail', () => {
  it('normalise l\'adresse pour retrouver le même compte', () => {
    expect(normalizeEmail('  Alex@Exemple.FR ')).toBe('alex@exemple.fr');
    expect(localAccountId('Alex@Exemple.FR')).toBe(localAccountId('alex@exemple.fr'));
  });

  it('donne un identifiant distinct par adresse, utilisable comme clé', () => {
    const a = localAccountId('alex@exemple.fr');
    const b = localAccountId('camille@exemple.fr');
    expect(a).not.toBe(b);
    for (const id of [a, b]) expect(id).toMatch(/^email\.[A-Za-z0-9._-]+$/);
  });

  it('refuse une adresse ou un mot de passe inutilisables', () => {
    expect(validateEmail('')).not.toBeNull();
    expect(validateEmail('alex@exemple')).not.toBeNull();
    expect(validateEmail('alex@exemple.fr')).toBeNull();
    expect(validatePassword('court')).not.toBeNull();
    expect(validatePassword('assez long')).toBeNull();
  });

  it('ne conserve aucune trace du mot de passe', async () => {
    const { account } = await createLocalAccount('alex@exemple.fr', 'mot-de-passe', 'Alex');
    const serialise = JSON.stringify(account);
    expect(serialise).not.toContain('mot-de-passe');
    // Seuls un sel et un vérificateur chiffré sont stockés.
    expect(account.salt).toBeTruthy();
    expect(account.check.data).toBeTruthy();
  });

  it('déverrouille avec le bon mot de passe, et seulement lui', async () => {
    const { account } = await createLocalAccount('alex@exemple.fr', 'mot-de-passe', 'Alex');
    expect(await unlockLocalAccount(account, 'mot-de-passe')).not.toBeNull();
    expect(await unlockLocalAccount(account, 'Mot-de-passe')).toBeNull();
    expect(await unlockLocalAccount(account, '')).toBeNull();
  }, 20_000);

  it('donne deux clés différentes à deux comptes de même mot de passe', async () => {
    // Le sel est propre à chaque compte : deux personnes qui choisissent le
    // même mot de passe n'ouvrent pas les données l'une de l'autre.
    const a = await createLocalAccount('alex@exemple.fr', 'identique', 'Alex');
    const b = await createLocalAccount('camille@exemple.fr', 'identique', 'Camille');
    expect(a.account.salt).not.toBe(b.account.salt);
    expect(await unlockLocalAccount(b.account, 'identique')).not.toBeNull();
    expect(await decryptJson(a.key, b.account.check)).toBeNull();
  }, 30_000);
});
