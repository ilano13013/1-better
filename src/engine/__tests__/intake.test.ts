import { describe, expect, it } from 'vitest';
import {
  entriesForDay, intakeTotals, isMealLogged, lookupsLeft, lookupsUsed,
  macrosForGrams, per100gOf, type IntakeEntry,
} from '../intake';
import {
  LOOKUP_MESSAGES, classifyFailure, isValidBarcode, lookupBarcode, normalizeBarcode,
  parseProduct, type LookupError,
} from '../openfoodfacts';
import { LIMITS } from '../entitlements';
import { getFood } from '../../data/foods';

const entry = (over: Partial<IntakeEntry>): IntakeEntry => ({
  id: 'i1', date: '2026-09-23', kind: 'food', label: 'Test',
  macros: { kcal: 100, protein: 10, carbs: 5, fat: 2 },
  at: '2026-09-23T08:00:00.000Z',
  ...over,
});

describe('journal de consommation', () => {
  it('ne totalise que le jour demandé', () => {
    const entries = [
      entry({ id: 'a', date: '2026-09-23' }),
      entry({ id: 'b', date: '2026-09-24' }),
      entry({ id: 'c', date: '2026-09-23' }),
    ];
    expect(entriesForDay(entries, '2026-09-23').map((e) => e.id)).toEqual(['a', 'c']);
    expect(intakeTotals(entriesForDay(entries, '2026-09-23')).kcal).toBe(200);
  });

  it('rend zéro sur une journée non pointée', () => {
    // Le journal est facultatif : ne rien saisir ne doit rien inventer.
    expect(intakeTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('classe les saisies par ordre d\'ajout', () => {
    const entries = [
      entry({ id: 'soir', at: '2026-09-23T20:00:00.000Z' }),
      entry({ id: 'matin', at: '2026-09-23T07:00:00.000Z' }),
    ];
    expect(entriesForDay(entries, '2026-09-23').map((e) => e.id)).toEqual(['matin', 'soir']);
  });

  it('calcule les macros d\'une quantité', () => {
    const per100g = { kcal: 350, protein: 12, carbs: 70, fat: 2 };
    expect(macrosForGrams(per100g, 100)).toEqual({ kcal: 350, protein: 12, carbs: 70, fat: 2 });
    expect(macrosForGrams(per100g, 75)).toEqual({ kcal: 263, protein: 9, carbs: 53, fat: 2 });
    expect(macrosForGrams(per100g, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    // Une quantité négative saisie par erreur ne crédite jamais de calories.
    expect(macrosForGrams(per100g, -50)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('convertit un aliment à la pièce, ou renonce', () => {
    const oeuf = getFood('oeuf');
    const per100g = per100gOf(oeuf);
    if (oeuf.unit === 'piece' && oeuf.gramsPerPiece) {
      // Les valeurs de la base sont par pièce : sans poids unitaire, pas de
      // conversion possible, et inventer un poids moyen fausserait la saisie.
      expect(per100g).not.toBeNull();
      expect(per100g!.kcal).toBeCloseTo((oeuf.kcal * 100) / oeuf.gramsPerPiece, 5);
    }
    expect(per100gOf({ ...oeuf, unit: 'piece', gramsPerPiece: undefined })).toBeNull();
  });

  it('reconnaît un repas déjà pointé', () => {
    const entries = [entry({
      kind: 'meal', slot: 'dejeuner', recipeId: 'pates_thon',
    })];
    expect(isMealLogged(entries, '2026-09-23', 'dejeuner', 'pates_thon')).toBe(true);
    expect(isMealLogged(entries, '2026-09-23', 'diner', 'pates_thon')).toBe(false);
    expect(isMealLogged(entries, '2026-09-24', 'dejeuner', 'pates_thon')).toBe(false);
  });

  it('ne compte dans le quota que les recherches en ligne', () => {
    const entries = [
      entry({ id: 'a', barcode: '3017620425035' }),
      entry({ id: 'b', foodId: 'riz' }),          // base locale : gratuit
      entry({ id: 'c', kind: 'meal', recipeId: 'pates_thon' }),
    ];
    expect(lookupsUsed(entries, '2026-09-23')).toBe(1);
    expect(lookupsLeft(entries, '2026-09-23', LIMITS.free.barcodeLookupsPerDay)).toBe(2);
    expect(lookupsLeft(entries, '2026-09-23', LIMITS.plus.barcodeLookupsPerDay)).toBeNull();
  });

  it('ne descend jamais sous zéro recherche restante', () => {
    const entries = Array.from({ length: 9 }, (_, i) =>
      entry({ id: `x${i}`, barcode: '3017620425035' }));
    expect(lookupsLeft(entries, '2026-09-23', 3)).toBe(0);
  });
});

describe('code-barres', () => {
  it('valide la clé de contrôle', () => {
    // Codes réels : Nutella 400 g, et un EAN-8.
    expect(isValidBarcode('3017620425035')).toBe(true);
    expect(isValidBarcode('96385074')).toBe(true);
    // Un chiffre modifié casse la clé : la lecture était mauvaise.
    expect(isValidBarcode('3017620425036')).toBe(false);
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
  });

  it('nettoie ce que renvoie un lecteur', () => {
    expect(normalizeBarcode(' 3017 620-425035 ')).toBe('3017620425035');
    expect(isValidBarcode(' 3017 620-425035 ')).toBe(true);
  });

  it('lit une fiche Open Food Facts complète', () => {
    const res = parseProduct('3017620425035', {
      status: 1,
      product: {
        product_name: 'Nutella', product_name_fr: 'Nutella', brands: 'Ferrero, Nutella',
        nutriments: {
          'energy-kcal_100g': 539, proteins_100g: 6.3,
          carbohydrates_100g: 57.5, fat_100g: 30.9,
        },
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.product.name).toBe('Nutella');
    expect(res.product.brand).toBe('Ferrero');   // première marque seulement
    expect(res.product.per100g.kcal).toBe(539);
    expect(res.product.missing).toEqual([]);
  });

  it('convertit les kilojoules quand les kcal manquent', () => {
    const res = parseProduct('3017620425035', {
      status: 1,
      product: { product_name: 'X', nutriments: { energy_100g: 2255, proteins_100g: '6,3' } },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.product.per100g.kcal).toBe(539);      // 2255 kJ ÷ 4,184
    expect(res.product.per100g.protein).toBe(6.3);   // virgule décimale acceptée
    // Les champs absents sont signalés, pas présentés comme des zéros vrais.
    expect(res.product.missing).toEqual(['carbs', 'fat']);
  });

  it('refuse une fiche sans aucune valeur, et un produit absent', () => {
    expect(parseProduct('3017620425035', { status: 1, product: { product_name: 'X' } }))
      .toEqual({ ok: false, error: 'sans_valeurs' });
    expect(parseProduct('3017620425035', { status: 0 }))
      .toEqual({ ok: false, error: 'introuvable' });
  });

  it('nomme un produit sans nom plutôt que d\'afficher du vide', () => {
    const res = parseProduct('96385074', {
      status: 1, product: { nutriments: { 'energy-kcal_100g': 42 } },
    });
    expect(res.ok && res.product.name).toBe('Produit 96385074');
  });
});

describe('diagnostic d\'une recherche qui échoue', () => {
  /*
   * `fetch` lève la même TypeError pour une coupure réseau et pour un blocage
   * par la politique de sécurité de la page. Dire « Open Food Facts est
   * injoignable » dans les deux cas envoie chercher une panne au mauvais
   * endroit : dans un artefact claude.ai, c'est la page qui refuse l'appel.
   */
  it('nomme la vraie cause selon le contexte', () => {
    expect(classifyFailure({ framed: true, online: true }, false)).toBe('bloque');
    expect(classifyFailure({ framed: false, online: false }, false)).toBe('hors_ligne');
    expect(classifyFailure({ framed: false, online: true }, false)).toBe('reseau');
    // Hors ligne prime sur le cadre : c'est la cause la plus proche.
    expect(classifyFailure({ framed: true, online: false }, false)).toBe('hors_ligne');
    // Un abandon sur délai n'est pas une panne.
    expect(classifyFailure({ framed: false, online: true }, true)).toBe('lent');
  });

  it('a un message pour chaque cause, sans trou', () => {
    const causes: LookupError[] = [
      'code_invalide', 'introuvable', 'sans_valeurs', 'bloque',
      'hors_ligne', 'lent', 'serveur', 'reseau',
    ];
    for (const cause of causes) {
      expect(LOOKUP_MESSAGES[cause], cause).toBeTruthy();
      expect(LOOKUP_MESSAGES[cause].trim().endsWith('.'), cause).toBe(true);
    }
  });

  it('ne part pas sur le réseau pour un code invalide', async () => {
    let appels = 0;
    const faux = (async () => { appels++; throw new Error('ne devrait pas'); }) as unknown as typeof fetch;
    expect(await lookupBarcode('12345', faux)).toEqual({ ok: false, error: 'code_invalide' });
    expect(appels).toBe(0);
  });

  it('distingue un produit absent d\'une erreur de serveur', async () => {
    const reponse = (status: number) => (async () => ({
      ok: status < 400, status, json: async () => ({}),
    })) as unknown as typeof fetch;
    expect(await lookupBarcode('3017620425035', reponse(404)))
      .toEqual({ ok: false, error: 'introuvable' });
    expect(await lookupBarcode('3017620425035', reponse(500)))
      .toEqual({ ok: false, error: 'serveur' });
  });

  it('rend le produit quand la réponse est exploitable', async () => {
    const fetchOk = (async () => ({
      ok: true, status: 200,
      json: async () => ({
        status: 1,
        product: { product_name: 'Skyr', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11 } },
      }),
    })) as unknown as typeof fetch;
    const res = await lookupBarcode('3017620425035', fetchOk);
    expect(res.ok && res.product.name).toBe('Skyr');
  });
});

describe('second essai', () => {
  it('retente sur l\'autre adresse après une erreur de serveur', async () => {
    const vues: string[] = [];
    const fetchImpl = (async (url: string) => {
      vues.push(url);
      if (url.includes('/v2/')) return { ok: false, status: 503, json: async () => ({}) };
      return {
        ok: true, status: 200,
        json: async () => ({
          status: 1,
          product: { product_name: 'Skyr', nutriments: { 'energy-kcal_100g': 63 } },
        }),
      };
    }) as unknown as typeof fetch;

    const res = await lookupBarcode('3017620425035', fetchImpl);
    expect(res.ok && res.product.name).toBe('Skyr');
    expect(vues).toHaveLength(2);
    expect(vues[0]).toContain('/api/v2/');
    expect(vues[1]).toContain('/api/v0/');
  });

  it('ne retente pas quand l\'appel est bloqué', async () => {
    // Réessayer la même chose quand c'est la page qui refuse l'appel ne fait
    // que doubler l'attente.
    let appels = 0;
    const bloque = (async () => { appels++; throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const res = await lookupBarcode('3017620425035', bloque, { framed: true, online: true });
    expect(res).toEqual({ ok: false, error: 'bloque' });
    expect(appels).toBe(1);
  });

  it('ne retente pas un produit absent', async () => {
    let appels = 0;
    const absent = (async () => { appels++; return { ok: false, status: 404, json: async () => ({}) }; }) as unknown as typeof fetch;
    expect(await lookupBarcode('3017620425035', absent)).toEqual({ ok: false, error: 'introuvable' });
    expect(appels).toBe(1);
  });
});
