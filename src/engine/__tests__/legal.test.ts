import { describe, expect, it } from 'vitest';
import {
  EMPTY_PUBLISHER, LEGAL_UPDATED, MENTIONS, blockingMentions, complianceWarnings,
  envKeyFor, isSoleTrader, legalDocument, legalDocuments, missingMentions,
  publishReady, readPublisher, tidy, type Block, type Publisher,
} from '../legal';
import { PRICES, TRIAL_DAYS } from '../entitlements';

/** Un éditeur entièrement renseigné, pour vérifier le cas nominal. */
const FULL: Publisher = {
  name: 'Exemple SAS',
  legalForm: 'Société par actions simplifiée',
  address: '12 rue Exemple, 69000 Lyon',
  registration: 'SIREN 000 000 000',
  vat: 'FR00000000000',
  capital: '1 000 €',
  director: 'Prénom Nom',
  email: 'contact@exemple.fr',
  phone: '+33 4 00 00 00 00',
  hostName: 'GitHub, Inc.',
  hostAddress: '88 Colin P. Kelly Jr. Street, San Francisco',
  hostPhone: '+1 877 448 4820',
  privacyEmail: 'donnees@exemple.fr',
  mediator: 'Médiateur du commerce',
  mediatorUrl: 'https://exemple-mediation.fr',
  siteUrl: 'https://exemple.fr/1-better/',
};

function blocks(pub: Publisher): Block[] {
  return legalDocuments(pub).flatMap((d) => d.sections.flatMap((s) => s.blocks));
}

function texts(pub: Publisher): string {
  return blocks(pub)
    .map((b) => (b.kind === 'p' ? b.text : b.kind === 'list' ? b.items.join(' ') : ''))
    .join('\n');
}

describe('mentions obligatoires', () => {
  it('sans configuration, rien n’est publiable', () => {
    expect(publishReady(EMPTY_PUBLISHER)).toBe(false);
    expect(blockingMentions(EMPTY_PUBLISHER).length).toBeGreaterThan(0);
  });

  it('une fois tout renseigné, plus rien ne manque', () => {
    expect(publishReady(FULL)).toBe(true);
    expect(missingMentions(FULL)).toEqual([]);
  });

  it('les mentions recommandées ne bloquent pas la publication', () => {
    const pub: Publisher = { ...FULL, vat: '', capital: '', phone: '', hostPhone: '' };
    expect(missingMentions(pub).length).toBe(4);
    expect(blockingMentions(pub)).toEqual([]);
    expect(publishReady(pub)).toBe(true);
  });

  it('les obligatoires sont listées avant les recommandées', () => {
    const missing = missingMentions(EMPTY_PUBLISHER);
    const lastRequired = missing.map((m) => m.required).lastIndexOf(true);
    const firstOptional = missing.map((m) => m.required).indexOf(false);
    expect(firstOptional === -1 || firstOptional > lastRequired).toBe(true);
  });

  it('chaque mention cite le texte qui l’impose et sa variable', () => {
    for (const m of MENTIONS) {
      expect(m.law.length).toBeGreaterThan(5);
      expect(envKeyFor(m.field)).toMatch(/^VITE_LEGAL_/);
    }
  });

  it('la lecture d’environnement ne devine aucune valeur', () => {
    expect(readPublisher({})).toEqual(EMPTY_PUBLISHER);
    expect(readPublisher({ VITE_LEGAL_NAME: '  Exemple  ' }).name).toBe('Exemple');
  });
});

describe('documents', () => {
  it('les six documents existent et sont nommés', () => {
    const docs = legalDocuments(EMPTY_PUBLISHER);
    expect(docs.map((d) => d.id)).toEqual([
      'mentions', 'confidentialite', 'cgu', 'cgv', 'sante', 'accessibilite',
    ]);
    for (const doc of docs) {
      expect(doc.title.length).toBeGreaterThan(3);
      expect(doc.sections.length).toBeGreaterThan(0);
    }
  });

  /*
   * Le cœur du module : là où une mention manque, le document doit afficher un
   * trou nommé. Un texte qui se contenterait de sauter la ligne laisserait
   * croire à un document complet.
   */
  it('une mention absente laisse un trou nommé, jamais un blanc', () => {
    const missingBlocks = blocks(EMPTY_PUBLISHER).filter((b) => b.kind === 'missing');
    const fields = new Set(missingBlocks.map((b) => b.kind === 'missing' && b.mention.field));
    for (const m of MENTIONS.filter((x) => x.required)) {
      expect(fields.has(m.field)).toBe(true);
    }
  });

  it('une fois renseigné, plus aucun trou ne subsiste', () => {
    expect(blocks(FULL).filter((b) => b.kind === 'missing')).toEqual([]);
  });

  it('aucune valeur n’est inventée en l’absence de configuration', () => {
    const body = texts(EMPTY_PUBLISHER);
    expect(body).not.toMatch(/SIREN\s*\d/);
    expect(body).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(body).not.toMatch(/\d{1,3}\s+rue\b/i);
  });

  it('les conditions de vente citent les tarifs du moteur, pas une copie', () => {
    const cgv = legalDocument(FULL, 'cgv')!;
    const body = cgv.sections.flatMap((s) => s.blocks)
      .map((b) => (b.kind === 'p' ? b.text : b.kind === 'list' ? b.items.join(' ') : ''))
      .join(' ');
    expect(body).toContain((PRICES.monthly / 100).toFixed(2).replace('.', ','));
    expect(body).toContain((PRICES.yearly / 100).toFixed(2).replace('.', ','));
    expect(body).toContain(`${TRIAL_DAYS} jours`);
  });

  it('les conditions de vente énoncent rétractation, reconduction et résiliation', () => {
    const cgv = legalDocument(FULL, 'cgv')!;
    const headings = cgv.sections.map((s) => s.heading).join(' ');
    expect(headings).toMatch(/rétractation/i);
    expect(headings).toMatch(/reconduction/i);
    expect(headings).toMatch(/médiation/i);
    const body = texts(FULL);
    expect(body).toContain('L221-18');   // droit de rétractation
    expect(body).toContain('L215-1');    // reconduction tacite
    expect(body).toContain('L224-45-1'); // résiliation aussi simple que la souscription
  });

  it('la politique de confidentialité nomme les droits et l’autorité', () => {
    const body = texts(FULL);
    expect(body).toMatch(/portabilité/i);
    expect(body).toMatch(/effacement/i);
    expect(body).toContain('CNIL');
    expect(body).toMatch(/Open Food Facts/);
  });

  it('les textes sont repliés : ni retour à la ligne, ni double espace', () => {
    for (const block of blocks(FULL)) {
      const values = block.kind === 'p' ? [block.text]
        : block.kind === 'list' ? block.items : [];
      for (const value of values) {
        expect(value).not.toMatch(/\s{2,}/);
        expect(value).not.toMatch(/\n/);
        expect(value).toBe(value.trim());
      }
    }
  });

  it('tidy replie sans amputer', () => {
    expect(tidy('  deux\n   lignes  ')).toBe('deux lignes');
  });

  it('la date de révision est une date ISO', () => {
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('forme juridique', () => {
  const EI: Publisher = {
    ...FULL,
    name: 'Ilan GUEDJ EI',
    legalForm: 'Entreprise individuelle',
    capital: '',
  };

  it('reconnaît un entrepreneur individuel sous ses différents noms', () => {
    for (const forme of [
      'Entreprise individuelle', 'entrepreneur individuel',
      'Micro-entrepreneur', 'auto-entrepreneur', 'EI',
    ]) {
      expect(isSoleTrader({ ...FULL, legalForm: forme })).toBe(true);
    }
    expect(isSoleTrader({ ...FULL, legalForm: 'Société par actions simplifiée' })).toBe(false);
  });

  /*
   * Un entrepreneur individuel n'a pas de capital social. Le réclamer, même
   * comme « recommandé », serait demander une valeur qui n'existe pas.
   */
  it('ne réclame pas de capital social à un entrepreneur individuel', () => {
    expect(missingMentions(EI)).toEqual([]);
    expect(missingMentions({ ...FULL, legalForm: 'SAS', capital: '' })
      .map((m) => m.field)).toEqual(['capital']);
  });

  it('exige la mention « EI » dans la dénomination', () => {
    const sans = complianceWarnings({ ...EI, name: 'Guedj' });
    expect(sans).toHaveLength(1);
    expect(sans[0].field).toBe('name');
    expect(sans[0].law).toContain('L526-22');
    expect(sans[0].detail).toContain('Guedj EI');

    expect(complianceWarnings(EI)).toEqual([]);
    expect(complianceWarnings({ ...EI, name: 'Ilan Guedj entrepreneur individuel' })).toEqual([]);
  });

  it("ne reproche rien à une société, ni à une dénomination vide", () => {
    expect(complianceWarnings({ ...FULL, name: 'Exemple SAS' })).toEqual([]);
    expect(complianceWarnings({ ...EI, name: '' })).toEqual([]);
  });
});

describe('mentions sans objet', () => {
  const EI: Publisher = {
    ...EMPTY_PUBLISHER,
    legalForm: 'Entreprise individuelle',
    name: 'Ilan GUEDJ EI',
  };

  /*
   * Un trou signalé pour une valeur qui ne peut pas exister est un faux
   * manque : il ferait chercher indéfiniment un capital social qu'un
   * entrepreneur individuel n'a pas.
   */
  it('le capital social ne laisse aucun trou chez un entrepreneur individuel', () => {
    const fields = legalDocuments(EI)
      .flatMap((d) => d.sections.flatMap((s) => s.blocks))
      .filter((b) => b.kind === 'missing')
      .map((b) => (b.kind === 'missing' ? b.mention.field : ''));
    expect(fields).not.toContain('capital');
    expect(fields).toContain('registration'); // les vrais manques restent
  });

  it('une société, elle, voit le trou', () => {
    const sas: Publisher = { ...EMPTY_PUBLISHER, legalForm: 'SAS', name: 'Exemple SAS' };
    const fields = legalDocuments(sas)
      .flatMap((d) => d.sections.flatMap((s) => s.blocks))
      .filter((b) => b.kind === 'missing')
      .map((b) => (b.kind === 'missing' ? b.mention.field : ''));
    expect(fields).toContain('capital');
  });
});
