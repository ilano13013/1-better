import { PRICES, TRIAL_DAYS } from './entitlements';

/**
 * CADRE LÉGAL — ce qu'il faut avoir écrit pour publier.
 *
 * Une application qui annonce un prix en euros et traite des données de santé
 * n'est pas publiable sans quatre textes : mentions légales, politique de
 * confidentialité, conditions d'utilisation, conditions de vente. S'y ajoutent
 * ici un avertissement santé et une déclaration d'accessibilité.
 *
 * LE PARTI PRIS DE CE MODULE, ET IL EST LE MÊME QUE POUR LES PRIX.
 *
 * Les mentions obligatoires désignent une personne réelle : une raison
 * sociale, une adresse, un numéro d'immatriculation, un hébergeur. Rien de
 * tout cela ne peut être deviné, et une mention légale inventée est pire que
 * pas de mention du tout — elle trompe le lecteur et engage quelqu'un qui
 * n'existe pas.
 *
 * Alors le module ne remplit rien. Il lit la configuration, dresse la liste de
 * ce qui manque avec le texte de loi correspondant, et les documents affichent
 * un trou nommé à la place de la valeur absente. `publishReady()` répond
 * franchement : non, tant qu'une mention obligatoire manque.
 *
 * Les textes eux-mêmes décrivent exactement ce que fait l'application — rien
 * n'y est générique. Ils restent un modèle à relire par un professionnel du
 * droit avant mise en ligne, et le disent.
 */

/* ------------------------------ Configuration ------------------------------ */

export interface Publisher {
  /** Raison sociale ou nom et prénom de l'éditeur. */
  name: string;
  /** Forme juridique : SAS, EI, auto-entrepreneur, association… */
  legalForm: string;
  /** Siège social ou domicile professionnel, en une ligne. */
  address: string;
  /** Numéro SIREN ou SIRET. */
  registration: string;
  /** Numéro de TVA intracommunautaire, si assujetti. */
  vat: string;
  /** Capital social, pour les sociétés. */
  capital: string;
  /** Directeur de la publication. */
  director: string;
  /** Adresse de contact, obligatoire et réellement relevée. */
  email: string;
  /** Téléphone, facultatif mais attendu pour un service payant. */
  phone: string;
  /** Hébergeur : dénomination. */
  hostName: string;
  /** Hébergeur : adresse. */
  hostAddress: string;
  /** Hébergeur : téléphone. */
  hostPhone: string;
  /** Contact « protection des données », DPO ou référent. */
  privacyEmail: string;
  /** Médiateur de la consommation, obligatoire pour vendre à des particuliers. */
  mediator: string;
  /** Adresse du médiateur — site ou courrier. */
  mediatorUrl: string;
  /** Adresse publique de l'application, pour les mentions et le RGPD. */
  siteUrl: string;
}

export const EMPTY_PUBLISHER: Publisher = {
  name: '', legalForm: '', address: '', registration: '', vat: '', capital: '',
  director: '', email: '', phone: '',
  hostName: '', hostAddress: '', hostPhone: '',
  privacyEmail: '', mediator: '', mediatorUrl: '', siteUrl: '',
};

const ENV_KEYS: Record<keyof Publisher, string> = {
  name: 'VITE_LEGAL_NAME',
  legalForm: 'VITE_LEGAL_FORM',
  address: 'VITE_LEGAL_ADDRESS',
  registration: 'VITE_LEGAL_REGISTRATION',
  vat: 'VITE_LEGAL_VAT',
  capital: 'VITE_LEGAL_CAPITAL',
  director: 'VITE_LEGAL_DIRECTOR',
  email: 'VITE_LEGAL_EMAIL',
  phone: 'VITE_LEGAL_PHONE',
  hostName: 'VITE_LEGAL_HOST_NAME',
  hostAddress: 'VITE_LEGAL_HOST_ADDRESS',
  hostPhone: 'VITE_LEGAL_HOST_PHONE',
  privacyEmail: 'VITE_LEGAL_PRIVACY_EMAIL',
  mediator: 'VITE_LEGAL_MEDIATOR',
  mediatorUrl: 'VITE_LEGAL_MEDIATOR_URL',
  siteUrl: 'VITE_LEGAL_SITE_URL',
};

/** Lit la configuration d'éditeur. Une valeur vide reste vide, jamais devinée. */
export function readPublisher(env: Record<string, string | undefined>): Publisher {
  const out = { ...EMPTY_PUBLISHER };
  for (const key of Object.keys(ENV_KEYS) as (keyof Publisher)[]) {
    out[key] = (env[ENV_KEYS[key]] ?? '').trim();
  }
  return out;
}

/** Le nom de la variable d'environnement qui renseigne un champ. */
export function envKeyFor(field: keyof Publisher): string {
  return ENV_KEYS[field];
}

/* -------------------------- Mentions obligatoires -------------------------- */

export interface Mention {
  field: keyof Publisher;
  label: string;
  /** Le texte qui l'impose. */
  law: string;
  /** Obligatoire pour publier, ou seulement recommandé. */
  required: boolean;
  /** Ce que la mention sert à faire, en une phrase. */
  why: string;
}

/**
 * Les mentions et leur fondement.
 *
 * Les références sont citées pour être vérifiables, pas pour faire savant :
 * chacune permet d'aller lire le texte et de contester ce module s'il se
 * trompe.
 */
export const MENTIONS: Mention[] = [
  {
    field: 'name', label: "Nom ou raison sociale de l'éditeur", required: true,
    law: 'LCEN, art. 6-III-1',
    why: "Identifier qui publie le service et qui répond de son contenu.",
  },
  {
    field: 'legalForm', label: 'Forme juridique', required: true,
    law: 'C. com., art. R123-237',
    why: "Distinguer une société d'un particulier : les obligations diffèrent.",
  },
  {
    field: 'address', label: 'Adresse du siège ou du domicile professionnel', required: true,
    law: 'LCEN, art. 6-III-1',
    why: "Permettre de saisir l'éditeur par écrit.",
  },
  {
    field: 'registration', label: 'Numéro SIREN ou SIRET', required: true,
    law: 'C. com., art. R123-237',
    why: "Rattacher l'éditeur à une immatriculation vérifiable.",
  },
  {
    field: 'director', label: 'Directeur de la publication', required: true,
    law: 'LCEN, art. 6-III-1 ; loi du 29 juillet 1982, art. 93-2',
    why: "Désigner la personne physique responsable de ce qui est publié.",
  },
  {
    field: 'email', label: 'Adresse de contact', required: true,
    law: 'C. conso., art. L221-5 ; LCEN, art. 19',
    why: "Donner un moyen de contact direct et effectif, avant et après l'achat.",
  },
  {
    field: 'hostName', label: "Nom de l'hébergeur", required: true,
    law: 'LCEN, art. 6-III-1',
    why: "Permettre un signalement lorsque l'éditeur ne répond pas.",
  },
  {
    field: 'hostAddress', label: "Adresse de l'hébergeur", required: true,
    law: 'LCEN, art. 6-III-1',
    why: "Compléter l'identification de l'hébergeur.",
  },
  {
    field: 'siteUrl', label: "Adresse publique de l'application", required: true,
    law: 'RGPD, art. 13 ; C. conso., art. L221-5',
    why: "Désigner sans ambiguïté le service auquel les documents s'appliquent.",
  },
  {
    field: 'privacyEmail', label: 'Contact « protection des données »', required: true,
    law: 'RGPD, art. 13-1-b et art. 15 à 22',
    why: "Recevoir les demandes d'accès, de rectification et d'effacement.",
  },
  {
    field: 'mediator', label: 'Médiateur de la consommation', required: true,
    law: 'C. conso., art. L612-1 et R616-1',
    why: "Obligatoire dès lors qu'un service est vendu à des particuliers.",
  },
  {
    field: 'mediatorUrl', label: 'Coordonnées du médiateur', required: true,
    law: 'C. conso., art. R616-1',
    why: "La seule mention du nom ne suffit pas : il faut pouvoir le saisir.",
  },
  {
    field: 'vat', label: 'Numéro de TVA intracommunautaire', required: false,
    law: 'CGI, art. 286 ter ; C. com., art. R123-237',
    why: "Obligatoire seulement si l'éditeur est assujetti à la TVA.",
  },
  {
    field: 'capital', label: 'Capital social', required: false,
    law: 'C. com., art. R123-237',
    why: "Obligatoire pour les sociétés, sans objet pour un entrepreneur individuel.",
  },
  {
    field: 'phone', label: 'Téléphone', required: false,
    law: 'C. conso., art. L221-5',
    why: "Un autre moyen de contact que l'adresse électronique, attendu pour un service payant.",
  },
  {
    field: 'hostPhone', label: "Téléphone de l'hébergeur", required: false,
    law: 'LCEN, art. 6-III-1',
    why: "Complète les coordonnées de l'hébergeur.",
  },
];

/**
 * Vrai pour un entrepreneur individuel — entreprise individuelle, micro ou
 * auto-entrepreneur, désignés `EI` depuis 2022.
 *
 * La forme juridique change ce qui est exigible : un entrepreneur individuel
 * n'a pas de capital social, et signaler cette mention comme « recommandée »
 * reviendrait à réclamer une valeur qui n'existe pas.
 */
export function isSoleTrader(pub: Publisher): boolean {
  const form = pub.legalForm.trim().toLowerCase();
  // « EI » seul est la forme abrégée ; les autres se reconnaissent à leur
  // racine, sans limite de mot finale — « micro-entrepreneur » continue après.
  if (form === 'ei') return true;
  return /entreprise individuelle|entrepreneur individuel|micro[- ]?entrepr|auto[- ]?entrepr/
    .test(form);
}

/** Mentions sans objet pour cette forme juridique : ni exigées, ni signalées. */
function notApplicable(pub: Publisher): (keyof Publisher)[] {
  return isSoleTrader(pub) ? ['capital'] : [];
}

/** Les mentions non renseignées, obligatoires d'abord. */
export function missingMentions(pub: Publisher): Mention[] {
  const skip = notApplicable(pub);
  return MENTIONS.filter((m) => pub[m.field] === '' && !skip.includes(m.field))
    .sort((a, b) => Number(b.required) - Number(a.required));
}

/* ------------------------- Contrôles de cohérence ------------------------- */

export interface Warning {
  label: string;
  law: string;
  detail: string;
  /** La variable à corriger. */
  field: keyof Publisher;
}

/**
 * Ce qui est renseigné, mais mal.
 *
 * Distinct des mentions manquantes : ici la valeur existe, elle ne satisfait
 * simplement pas la règle. Une absence se voit ; une mention fausse, non — et
 * c'est précisément pour cela qu'elle mérite d'être signalée.
 */
export function complianceWarnings(pub: Publisher): Warning[] {
  const out: Warning[] = [];

  /*
   * Depuis le 15 mai 2022, un entrepreneur individuel exerce sous une
   * dénomination composée de son nom, précédé ou suivi de « EI » ou
   * « entrepreneur individuel ». Un nom seul ne suffit plus, et l'omission est
   * d'autant plus facile qu'elle ne saute pas aux yeux.
   */
  if (isSoleTrader(pub) && pub.name !== ''
      && !/\b(ei|entrepreneur individuel)\b/i.test(pub.name)) {
    out.push({
      field: 'name',
      label: "La dénomination doit porter « EI »",
      law: 'C. com., art. L526-22 et R123-237-1',
      detail: `Un entrepreneur individuel exerce sous son nom suivi ou précédé
               de « EI » ou « entrepreneur individuel » : « ${pub.name} EI »
               plutôt que « ${pub.name} ».`,
    });
  }

  return out.map((w) => ({ ...w, detail: tidy(w.detail) }));
}

/** Les seules qui empêchent de publier. */
export function blockingMentions(pub: Publisher): Mention[] {
  return missingMentions(pub).filter((m) => m.required);
}

/**
 * L'application est-elle publiable en l'état ?
 *
 * La réponse ne dépend que des mentions obligatoires. Elle est volontairement
 * binaire : « presque prêt » n'existe pas quand il s'agit d'identifier un
 * vendeur.
 */
export function publishReady(pub: Publisher): boolean {
  return blockingMentions(pub).length === 0;
}

/* -------------------------------- Documents -------------------------------- */

export type LegalDocId =
  | 'mentions' | 'confidentialite' | 'cgu' | 'cgv' | 'sante' | 'accessibilite';

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  /** Une mention obligatoire absente : un trou nommé, jamais une invention. */
  | { kind: 'missing'; mention: Mention };

export interface LegalSection { heading: string; blocks: Block[] }

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  /** Ce que le document règle, en une phrase. */
  summary: string;
  sections: LegalSection[];
}

/** Date de dernière révision des textes. À remonter à chaque modification. */
export const LEGAL_UPDATED = '2026-09-24';

const euro = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

function mention(field: keyof Publisher): Mention {
  const found = MENTIONS.find((m) => m.field === field);
  if (!found) throw new Error(`mention inconnue : ${field}`);
  return found;
}

/**
 * Une ligne « Libellé : valeur », ou le trou nommé si la valeur manque.
 *
 * `null` quand la mention est sans objet pour cette forme juridique : un
 * entrepreneur individuel n'a pas de capital social, et afficher le trou
 * reviendrait à réclamer une valeur qui ne peut pas exister.
 */
function line(pub: Publisher, field: keyof Publisher, label: string): Block | null {
  if (notApplicable(pub).includes(field)) return null;
  const value = pub[field];
  if (value === '') return { kind: 'missing', mention: mention(field) };
  return { kind: 'p', text: `${label} : ${value}` };
}

/** Assemble une section en écartant les lignes sans objet. */
function rows(...items: (Block | null)[]): Block[] {
  return items.filter((b): b is Block => b !== null);
}

/** Le nom de l'éditeur dans le corps d'un texte, ou une désignation neutre. */
function editor(pub: Publisher): string {
  return pub.name || "l'éditeur";
}

/**
 * « de » élidé devant une voyelle : « d'Ilan GUEDJ EI », pas « de Ilan ».
 *
 * Détail d'apparence, mais ces phrases sont un document public que des gens
 * liront ; une faute d'élision y est aussi voyante qu'ailleurs. Le `h` est
 * inclus faute de pouvoir distinguer l'aspiré du muet sur un nom propre —
 * « d'Hubert » est correct, et le cas d'un nom à h aspiré reste rare.
 */
function ofEditor(pub: Publisher): string {
  const name = editor(pub);
  return /^[aàâeéèêëiîïoôuùûüyh]/i.test(name) ? `d'${name}` : `de ${name}`;
}

function mentionsDoc(pub: Publisher): LegalDoc {
  return {
    id: 'mentions',
    title: 'Mentions légales',
    summary: "Qui édite l'application, qui l'héberge, et comment les joindre.",
    sections: [
      {
        heading: 'Éditeur',
        blocks: rows(
          line(pub, 'name', 'Dénomination'),
          line(pub, 'legalForm', 'Forme juridique'),
          line(pub, 'capital', 'Capital social'),
          line(pub, 'address', 'Adresse'),
          line(pub, 'registration', 'Immatriculation'),
          line(pub, 'vat', 'TVA intracommunautaire'),
          line(pub, 'email', 'Contact'),
          line(pub, 'phone', 'Téléphone'),
        ),
      },
      {
        heading: 'Directeur de la publication',
        blocks: rows(line(pub, 'director', 'Directeur de la publication')),
      },
      {
        heading: 'Hébergeur',
        blocks: rows(
          line(pub, 'hostName', 'Hébergeur'),
          line(pub, 'hostAddress', 'Adresse'),
          line(pub, 'hostPhone', 'Téléphone'),
        ),
      },
      {
        heading: 'Service concerné',
        blocks: rows(
          line(pub, 'siteUrl', 'Adresse'),
          {
            kind: 'p',
            text: `Application 1% Better, service de planification sportive et
                   alimentaire. Les présentes mentions s'appliquent à cette
                   adresse et à elle seule.`,
          },
        ),
      },
      {
        heading: 'Propriété intellectuelle',
        blocks: [
          {
            kind: 'p',
            text: `Les textes, la charte graphique, les recettes rédigées pour
                   l'application et le code qui la fait fonctionner sont
                   protégés. Toute reprise en dehors de l'usage personnel prévu
                   par les conditions d'utilisation suppose l'accord écrit
                   ${ofEditor(pub)}.`,
          },
          {
            kind: 'p',
            text: `Les valeurs nutritionnelles issues d'Open Food Facts sont
                   diffusées par leurs auteurs sous licence ouverte
                   Open Database License, et restent la propriété de leurs
                   contributeurs.`,
          },
          {
            kind: 'p',
            text: `Les noms d'enseignes de salles de sport et de supermarchés
                   sont cités à titre de repère pour situer un tarif ou un
                   équipement. Ils appartiennent à leurs titulaires, qui ne sont
                   ni partenaires ni commanditaires de l'application.`,
          },
        ],
      },
    ],
  };
}

function privacyDoc(pub: Publisher): LegalDoc {
  return {
    id: 'confidentialite',
    title: 'Politique de confidentialité',
    summary: "Ce qui est enregistré, où, combien de temps, et ce que tu peux exiger.",
    sections: [
      {
        heading: 'Le principe : rien ne quitte ton appareil',
        blocks: [
          {
            kind: 'p',
            text: `L'application n'a pas de serveur. Le profil, les séances, les
                   pesées, le journal des repas et la liste de courses sont
                   enregistrés dans la mémoire locale du navigateur, sur
                   l'appareil qui les a saisis. Ils ne sont ni transmis, ni
                   sauvegardés ailleurs, ni consultables par l'éditeur.`,
          },
          {
            kind: 'p',
            text: `Conséquence à connaître avant de commencer : effacer les
                   données du navigateur, ou désinstaller l'application, efface
                   aussi ces informations. Il n'existe aucune copie de secours.`,
          },
        ],
      },
      {
        heading: 'Responsable du traitement',
        blocks: rows(
          line(pub, 'name', 'Responsable'),
          line(pub, 'address', 'Adresse'),
          line(pub, 'privacyEmail', 'Contact protection des données'),
        ),
      },
      {
        heading: 'Données enregistrées, et pourquoi',
        blocks: [
          {
            kind: 'list',
            items: [
              `Profil : prénom, sexe, âge, taille, poids, objectif de poids,
               niveau, disponibilités. Sert à calculer les besoins caloriques et
               à construire le programme. Sans ces données, l'application ne
               peut rien calculer.`,
              `Suivi : pesées, charges soulevées, séances validées, journal des
               repas. Sert à mesurer la progression et à ajuster les charges.`,
              `Préférences alimentaires, restrictions et allergies. Servent à
               écarter des recettes. Une allergie déclarée est une donnée
               sensible : elle reste sur l'appareil comme le reste.`,
              `Réglages : salle, magasin, budget, thème, formule choisie.`,
              `Compte, si tu en crées un : adresse électronique et vérificateur
               de mot de passe. Le mot de passe lui-même n'est jamais
               enregistré.`,
            ],
          },
          {
            kind: 'p',
            text: `Le poids, la taille, l'âge et les allergies relèvent de la
                   santé. C'est précisément pourquoi l'application a été
                   construite sans serveur : la meilleure protection d'une
                   donnée de santé reste de ne jamais la collecter.`,
          },
        ],
      },
      {
        heading: 'Base légale',
        blocks: [
          {
            kind: 'p',
            text: `Le traitement repose sur l'exécution du service que tu
                   demandes (RGPD, art. 6-1-b) : sans profil, pas de plan. Les
                   données de santé que tu saisis le sont sur la base de ton
                   consentement explicite (art. 9-2-a), donné en remplissant le
                   questionnaire, et retirable en effaçant tes données.`,
          },
        ],
      },
      {
        heading: 'Le seul échange avec l’extérieur',
        blocks: [
          {
            kind: 'p',
            text: `Scanner un code-barres envoie ce code — et rien d'autre — aux
                   serveurs d'Open Food Facts, association française, pour
                   retrouver la fiche du produit. Aucune donnée personnelle
                   n'accompagne la requête. Cette recherche est facultative :
                   la base d'aliments intégrée fonctionne hors ligne.`,
          },
          {
            kind: 'p',
            text: `Si l'éditeur active la connexion par Apple ou par Google, le
                   script du fournisseur choisi est chargé depuis ses serveurs
                   au moment où l'écran de connexion s'affiche. Ce chargement
                   dépose des traceurs relevant du fournisseur et suppose ton
                   consentement préalable. Tant que ces fournisseurs ne sont pas
                   configurés, aucun script tiers n'est chargé et aucun traceur
                   n'est déposé.`,
          },
        ],
      },
      {
        heading: 'Stockage local et traceurs',
        blocks: [
          {
            kind: 'p',
            text: `L'application n'utilise ni cookie publicitaire, ni mesure
                   d'audience, ni traceur tiers. Le stockage local sert
                   exclusivement à conserver ce que tu as saisi : il est
                   strictement nécessaire au service demandé et, à ce titre,
                   dispensé de consentement (loi Informatique et Libertés,
                   art. 82 ; lignes directrices de la CNIL).`,
          },
        ],
      },
      {
        heading: 'Durée de conservation',
        blocks: [
          {
            kind: 'p',
            text: `Les données restent sur l'appareil tant que tu les gardes.
                   L'éditeur ne les conserve pas, puisqu'il ne les reçoit pas.
                   « Tout effacer », dans l'onglet Profil, les supprime
                   immédiatement et définitivement.`,
          },
        ],
      },
      {
        heading: 'Destinataires et transferts',
        blocks: [
          {
            kind: 'p',
            text: `Aucun destinataire. Aucune cession, aucune revente, aucun
                   transfert hors de l'Union européenne — à l'exception du code
                   -barres envoyé à Open Food Facts lorsque tu lances une
                   recherche, et des fournisseurs d'identité si tu choisis de
                   te connecter par eux.`,
          },
        ],
      },
      {
        heading: 'Tes droits',
        blocks: [
          {
            kind: 'list',
            items: [
              `Accès et portabilité (art. 15 et 20) : « Exporter mes données »,
               dans l'onglet Profil, produit un fichier lisible contenant tout
               ce qui est enregistré.`,
              `Rectification (art. 16) : toutes les valeurs sont modifiables
               depuis l'application.`,
              `Effacement (art. 17) : « Tout effacer », dans l'onglet Profil,
               est immédiat et définitif.`,
              `Opposition et limitation (art. 18 et 21) : cesser d'utiliser
               l'application suffit, puisque rien n'est traité ailleurs.`,
            ],
          },
          {
            kind: 'p',
            text: `Ces droits s'exercent directement dans l'application, sans
                   demande préalable, parce que tu es seul détenteur des
                   données. Pour toute question, écris à l'adresse indiquée
                   ci-dessus.`,
          },
          {
            kind: 'p',
            text: `Tu peux introduire une réclamation auprès de la CNIL,
                   3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 —
                   www.cnil.fr.`,
          },
        ],
      },
      {
        heading: 'Mineurs',
        blocks: [
          {
            kind: 'p',
            text: `L'application n'est pas destinée aux moins de 15 ans. Un
                   programme sportif et un déficit calorique ne conviennent pas
                   à un organisme en croissance sans suivi médical.`,
          },
        ],
      },
    ],
  };
}

function termsDoc(pub: Publisher): LegalDoc {
  return {
    id: 'cgu',
    title: "Conditions générales d'utilisation",
    summary: "Ce que l'application fait, ce qu'elle ne fait pas, et ce qu'on attend de toi.",
    sections: [
      {
        heading: 'Objet',
        blocks: [
          {
            kind: 'p',
            text: `1% Better construit un programme sportif et un plan
                   alimentaire hebdomadaires à partir d'un profil, d'une salle,
                   d'un magasin et d'un budget. Les calculs reposent sur des
                   règles publiques et des bases de données structurées. Aucune
                   intelligence artificielle n'intervient : les mêmes réponses
                   produisent le même plan.`,
          },
        ],
      },
      {
        heading: 'Accès',
        blocks: [
          {
            kind: 'p',
            text: `L'application s'utilise sans compte. Créer un compte est
                   facultatif et ne sert qu'à cloisonner plusieurs profils sur
                   un même appareil. Elle est réservée aux personnes de 15 ans
                   et plus.`,
          },
        ],
      },
      {
        heading: 'Ce dont l’application ne répond pas',
        blocks: [
          {
            kind: 'p',
            text: `Les besoins caloriques, les macronutriments et les charges
                   proposées sont des estimations calculées par des formules
                   reconnues. Ce sont des repères, pas une prescription. Ils ne
                   remplacent ni un médecin, ni un diététicien, ni un
                   entraîneur.`,
          },
          {
            kind: 'p',
            text: `Les prix affichés sont des ordres de grandeur destinés à
                   dimensionner un budget. Ils ne proviennent pas des caisses
                   des enseignes et ne peuvent servir de référence commerciale.`,
          },
          {
            kind: 'p',
            text: `Les valeurs issues d'Open Food Facts sont renseignées par des
                   contributeurs bénévoles. Elles peuvent être incomplètes ou
                   erronées ; l'emballage du produit fait foi.`,
          },
        ],
      },
      {
        heading: 'Tes obligations',
        blocks: [
          {
            kind: 'list',
            items: [
              `Renseigner des informations exactes : un plan calculé sur un poids
               faux est un plan faux.`,
              `Ne pas utiliser l'application contre un avis médical.`,
              `Ne pas tenter de contourner les limites de la formule gratuite,
               ni de redistribuer le contenu.`,
            ],
          },
        ],
      },
      {
        heading: 'Disponibilité',
        blocks: [
          {
            kind: 'p',
            text: `L'application fonctionne hors ligne une fois chargée. Seule
                   la recherche par code-barres dépend d'un service extérieur,
                   qui peut être indisponible sans que cela empêche d'utiliser
                   le reste.`,
          },
        ],
      },
      {
        heading: 'Résiliation',
        blocks: [
          {
            kind: 'p',
            text: `Tu peux cesser d'utiliser l'application à tout moment et
                   effacer tes données en une action, depuis l'onglet Profil.
                   ${editor(pub)} peut interrompre le service, en informant les
                   personnes abonnées et en remboursant la fraction d'abonnement
                   non utilisée.`,
          },
        ],
      },
      {
        heading: 'Droit applicable',
        blocks: [
          {
            kind: 'p',
            text: `Droit français. En cas de litige, une solution amiable est
                   recherchée avant toute action ; la médiation de la
                   consommation est ouverte pour les personnes abonnées.`,
          },
        ],
      },
    ],
  };
}

function salesDoc(pub: Publisher): LegalDoc {
  return {
    id: 'cgv',
    title: 'Conditions générales de vente',
    summary: `L'abonnement 1% Better+ : prix, essai de ${TRIAL_DAYS} jours, reconduction, résiliation.`,
    sections: [
      {
        heading: 'Vendeur',
        blocks: rows(
          line(pub, 'name', 'Vendeur'),
          line(pub, 'address', 'Adresse'),
          line(pub, 'registration', 'Immatriculation'),
          line(pub, 'email', 'Contact'),
        ),
      },
      {
        heading: 'Ce qui est vendu',
        blocks: [
          {
            kind: 'p',
            text: `L'abonnement 1% Better+ lève les limites de la formule
                   gratuite : programme sans plafond de séances, plan
                   alimentaire sur sept jours, liste de courses détaillée,
                   alternatives d'aliments, adaptation aux machines de la salle,
                   ajustement automatique des charges, historique sans limite,
                   scanner sans quota, export et préparation de panier.`,
          },
          {
            kind: 'p',
            text: `La formule gratuite reste utilisable sans limite de durée et
                   ne demande aucun moyen de paiement.`,
          },
        ],
      },
      {
        heading: 'Prix',
        blocks: [
          {
            kind: 'list',
            items: [
              `Mensuel : ${euro(PRICES.monthly)} TTC par mois.`,
              `Annuel : ${euro(PRICES.yearly)} TTC par an.`,
            ],
          },
          {
            kind: 'p',
            text: `Prix toutes taxes comprises, en euros. Toute évolution
                   tarifaire est annoncée au moins un mois avant son
                   application et n'a pas d'effet sur la période en cours ; elle
                   ouvre un droit de résiliation sans frais.`,
          },
        ],
      },
      {
        heading: `Essai gratuit de ${TRIAL_DAYS} jours`,
        blocks: [
          {
            kind: 'list',
            items: [
              `L'essai est réservé à la formule mensuelle et à une seule
               souscription par personne et par appareil.`,
              `Il dure ${TRIAL_DAYS} jours à compter de la souscription et donne
               accès à l'intégralité des fonctions de l'abonnement.`,
              `Aucune somme n'est prélevée pendant l'essai.`,
              `À son terme, et sauf résiliation, l'abonnement mensuel se poursuit
               au tarif de ${euro(PRICES.monthly)} par mois. La date du premier
               prélèvement est annoncée avant la souscription et rappelée dans
               l'écran des formules.`,
              `Résilier pendant l'essai l'interrompt immédiatement et n'entraîne
               aucun paiement.`,
            ],
          },
        ],
      },
      {
        heading: 'Reconduction et résiliation',
        blocks: [
          {
            kind: 'p',
            text: `L'abonnement se reconduit tacitement à chaque échéance, pour
                   une durée identique, jusqu'à résiliation. Conformément à
                   l'article L215-1 du code de la consommation, un rappel de
                   cette faculté de résiliation est adressé avant chaque
                   échéance annuelle.`,
          },
          {
            kind: 'p',
            text: `La résiliation s'effectue dans l'application, à l'endroit
                   même où l'abonnement a été souscrit, sans justification et
                   sans frais — comme l'impose l'article L224-45-1 du code de la
                   consommation, qui veut que résilier soit aussi simple que
                   souscrire. Elle prend effet à la fin de la période déjà
                   payée, qui reste utilisable jusqu'à son terme.`,
          },
        ],
      },
      {
        heading: 'Droit de rétractation',
        blocks: [
          {
            kind: 'p',
            text: `Tu disposes de quatorze jours à compter de la souscription
                   pour te rétracter sans motif (C. conso., art. L221-18), par
                   simple message à l'adresse de contact. Le remboursement
                   intervient dans les quatorze jours suivant la demande, par le
                   même moyen de paiement.`,
          },
          {
            kind: 'p',
            text: `Ce droit est indépendant de l'essai gratuit : il court à
                   partir de la souscription et couvre donc déjà la période
                   d'essai.`,
          },
        ],
      },
      {
        heading: 'Paiement et facturation',
        blocks: [
          {
            kind: 'p',
            text: `Le paiement s'effectue par carte bancaire auprès du
                   prestataire de paiement retenu, qui seul traite les données
                   bancaires : l'application n'en reçoit ni n'en conserve
                   aucune. Une facture est délivrée à chaque échéance.`,
          },
        ],
      },
      {
        heading: 'Médiation de la consommation',
        blocks: rows(
          {
            kind: 'p',
            text: `Après une réclamation écrite restée sans solution, tu peux
                   saisir gratuitement le médiateur de la consommation dont
                   relève le vendeur (C. conso., art. L612-1).`,
          },
          line(pub, 'mediator', 'Médiateur'),
          line(pub, 'mediatorUrl', 'Coordonnées'),
        ),
      },
    ],
  };
}

function healthDoc(): LegalDoc {
  return {
    id: 'sante',
    title: 'Avertissement santé',
    summary: "Ce que des calculs ne peuvent pas savoir de toi.",
    sections: [
      {
        heading: 'Des estimations, pas un avis médical',
        blocks: [
          {
            kind: 'p',
            text: `Le métabolisme de base est estimé par la formule de
                   Mifflin-St Jeor, la dépense totale par un coefficient
                   d'activité, les charges par des pourcentages usuels de
                   répétitions maximales. Ces méthodes sont éprouvées sur des
                   populations ; elles ne connaissent ni ton histoire médicale,
                   ni tes traitements, ni ta morphologie.`,
          },
          {
            kind: 'p',
            text: `Les valeurs affichées ne remplacent pas les conseils d'un
                   professionnel de santé ou de nutrition, et ne constituent ni
                   un diagnostic, ni un traitement, ni une prescription.`,
          },
        ],
      },
      {
        heading: 'Demande un avis médical avant de commencer si',
        blocks: [
          {
            kind: 'list',
            items: [
              `tu suis un traitement, en particulier pour le diabète, la
               thyroïde, le cœur ou la tension ;`,
              `tu es enceinte ou tu allaites ;`,
              `tu as des antécédents de trouble du comportement alimentaire ;`,
              `tu as une pathologie rénale, hépatique ou cardiaque ;`,
              `tu reprends le sport après une blessure ou une longue
               interruption ;`,
              `tu as moins de 18 ans ou plus de 65 ans.`,
            ],
          },
        ],
      },
      {
        heading: 'Arrête et consulte si',
        blocks: [
          {
            kind: 'list',
            items: [
              `une douleur thoracique, un essoufflement anormal ou un malaise
               survient à l'effort ;`,
              `une douleur articulaire persiste au-delà de quelques jours ;`,
              `la perte de poids dépasse durablement un kilogramme par semaine ;`,
              `la fatigue, le sommeil ou l'humeur se dégradent nettement.`,
            ],
          },
        ],
      },
      {
        heading: 'Allergies',
        blocks: [
          {
            kind: 'p',
            text: `Les allergènes déclarés écartent les recettes concernées à
                   partir de la composition renseignée dans la base. Cette
                   base peut être incomplète : en cas d'allergie sévère,
                   l'étiquette du produit reste la seule référence.`,
          },
        ],
      },
    ],
  };
}

function accessibilityDoc(): LegalDoc {
  return {
    id: 'accessibilite',
    title: 'Accessibilité',
    summary: "Ce qui a été fait, et ce qui n'a pas été vérifié.",
    sections: [
      {
        heading: 'Engagement',
        blocks: [
          {
            kind: 'p',
            text: `L'application vise le niveau AA des règles WCAG 2.1. Aucun
                   audit externe n'a été conduit : la déclaration ci-dessous
                   décrit ce qui a été construit et testé, pas une conformité
                   certifiée.`,
          },
        ],
      },
      {
        heading: 'Ce qui a été fait',
        blocks: [
          {
            kind: 'list',
            items: [
              `Langue déclarée, structure par titres, repères de navigation et
               lien d'évitement vers le contenu.`,
              `Interface entièrement utilisable au clavier, avec un indicateur
               de focus visible sur tous les éléments actifs.`,
              `Interface achromatique : aucune information n'est portée par la
               seule couleur — la courbe distingue ses séries par la forme,
               les états par le texte.`,
              `Cibles tactiles d'au moins 24 pixels partout (critère 2.5.8,
               niveau AA), portées à 45 pixels pour les boutons ronds isolés.`,
              `Champs associés à leur libellé, boutons nommés pour les lecteurs
               d'écran, confirmations annoncées dans une région dédiée.`,
              `Animations réduites lorsque le système le demande
               (« réduire les animations »), y compris l'animation de
               lancement.`,
              `Thèmes sombre et clair, suivant le réglage du système par défaut.`,
            ],
          },
        ],
      },
      {
        heading: 'Limites connues',
        blocks: [
          {
            kind: 'list',
            items: [
              `La courbe de poids est décrite par un texte de remplacement
               résumant la période et les valeurs extrêmes, mais son survol
               détaillé n'est pas accessible au clavier.`,
              `Aucun test n'a été réalisé avec un lecteur d'écran réel sur
               l'ensemble des parcours.`,
              `Les cibles tactiles n'atteignent pas partout les 44 pixels
               recommandés au niveau AAA : les boutons secondaires en ligne
               s'arrêtent à une trentaine de pixels de haut.`,
            ],
          },
        ],
      },
      {
        heading: 'Signaler un obstacle',
        blocks: [
          {
            kind: 'p',
            text: `Une difficulté d'accès peut être signalée à l'adresse de
                   contact figurant dans les mentions légales. Un défaut
                   d'accessibilité est traité comme un défaut de fonctionnement.`,
          },
        ],
      },
    ],
  };
}

/**
 * Les textes sont écrits en littéraux multilignes, pour rester lisibles dans
 * le code. Les retours à la ligne et l'indentation qui en découlent n'ont rien
 * à faire à l'écran : ils sont repliés ici, une fois, plutôt que dans chaque
 * composant qui afficherait un document.
 */
export function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function tidyBlock(block: Block): Block {
  if (block.kind === 'p') return { kind: 'p', text: tidy(block.text) };
  if (block.kind === 'list') return { kind: 'list', items: block.items.map(tidy) };
  return block;
}

/** Les six documents, dans l'ordre où ils sont présentés. */
export function legalDocuments(pub: Publisher): LegalDoc[] {
  return [
    mentionsDoc(pub), privacyDoc(pub), termsDoc(pub),
    salesDoc(pub), healthDoc(), accessibilityDoc(),
  ].map((doc) => ({
    ...doc,
    summary: tidy(doc.summary),
    sections: doc.sections.map((sec) => ({
      heading: sec.heading,
      blocks: sec.blocks.map(tidyBlock),
    })),
  }));
}

export function legalDocument(pub: Publisher, id: LegalDocId): LegalDoc | null {
  return legalDocuments(pub).find((d) => d.id === id) ?? null;
}
