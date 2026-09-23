import photo from '../assets/brand/coach-damien-phelipon.webp';

/**
 * Le coach qui valide la méthode d'entraînement.
 *
 * Deux règles tenues ici, parce qu'une caution professionnelle mal formulée est
 * pire que pas de caution du tout :
 *
 * 1. **Rien n'est inventé.** `credential` est vide tant que l'intitulé exact du
 *    diplôme n'a pas été fourni : écrire « BPJEPS » ou « CQP » au hasard serait
 *    une fausse déclaration de qualification, pas un détail de rédaction.
 * 2. **Le périmètre est dit.** `scope` énumère ce que la validation couvre, et
 *    `outOfScope` ce qu'elle ne couvre pas. Un « validé par un professionnel »
 *    sans périmètre laisse croire que la nutrition et la santé sont couvertes
 *    elles aussi.
 *
 * L'image d'une personne identifiable et son nom ne sont publiés qu'avec son
 * accord : voir le README, section « Caution professionnelle ».
 */
export interface Coach {
  name: string;
  age: number;
  role: string;
  /** Intitulé exact du diplôme. Vide tant qu'il n'est pas confirmé. */
  credential: string;
  photo: string;
  /** Identifiant Instagram, sans l'arobase. */
  instagram: string;
  /** Ce que sa validation couvre. */
  scope: string[];
  /** Ce qu'elle ne couvre pas, dit aussi clairement. */
  outOfScope: string;
}

/** Lien public du compte, construit à partir de l'identifiant. */
export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
}

export const COACH: Coach = {
  name: 'Damien Phelipon',
  age: 27,
  role: 'Coach sportif diplômé',
  credential: '',
  photo,
  instagram: 'ddm_personal_trainer',
  scope: [
    "La base d'exercices et les consignes d'exécution.",
    'La construction des séances et leur répartition sur la semaine.',
    'Les règles de progression en charge et en répétitions.',
  ],
  outOfScope: "Elle ne porte pas sur la nutrition ni sur la santé : les calories, "
    + "les macros et les prix restent des estimations calculées, et ne remplacent "
    + "pas l'avis d'un professionnel de santé ou de nutrition.",
};
