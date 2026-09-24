/**
 * GUIDE PAS À PAS — les étapes, et le placement de la bulle.
 *
 * Le guide éclaire une zone à la fois et laisse le reste dans l'ombre : à
 * chaque étape, une seule chose est désignée. C'est la raison d'être du
 * procédé — une explication qui montre tout n'explique rien.
 *
 * Deux règles tenues ici :
 *
 * 1. **Chaque étape vise un élément qui existe vraiment.** Les cibles sont des
 *    attributs `data-tour` posés sur les vrais composants, pas des captures ni
 *    des copies. Un guide qui décrit une interface d'hier ment.
 * 2. **Une étape dont la cible est absente est sautée**, jamais affichée sur du
 *    vide. Le tri ne peut pas se faire au montage — à cet instant aucun écran
 *    n'est encore posé dans le document et tout paraîtrait absent : chaque
 *    étape est donc évaluée sur son propre écran, au moment de l'afficher.
 */

/** Écrans de l'application, repris de `App.tsx`. */
export type TourScreen =
  | 'home' | 'week' | 'training' | 'nutrition' | 'shopping' | 'coach' | 'profile';

export interface TourStep {
  id: string;
  /** Écran à afficher avant de viser. */
  screen: TourScreen;
  /** Valeur de `data-tour` à éclairer. `null` : bulle centrée, sans cible. */
  target: string | null;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'cycle',
    screen: 'home',
    target: 'cycle',
    title: 'Ton niveau',
    body: "L'anneau est ta série. Chaque séance validée le remplit d'un pour cent ; "
      + 'cent séances bouclent un cycle. Un jour de repos ne casse rien.',
  },
  {
    id: 'today',
    screen: 'home',
    target: 'today',
    title: "Ce qu'il y a à faire aujourd'hui",
    body: 'Séance du jour ou repos, prochain repas, budget restant. '
      + "L'accueil ne montre que ça : le reste attend dans les onglets.",
  },
  {
    id: 'training',
    screen: 'training',
    target: 'tab-training',
    title: 'Tes séances',
    body: 'Le programme de la semaine, exercice par exercice. Le bouton ⓘ ouvre '
      + "le déroulé du mouvement, et « Saisir » enregistre tes charges.",
  },
  {
    id: 'nutrition',
    screen: 'nutrition',
    target: 'tab-nutrition',
    title: 'Tes repas',
    body: 'Un jour, ses repas, ses macros. Chaque repas se remplace si tu ne le '
      + 'veux pas : les macros et la liste de courses suivent aussitôt.',
  },
  {
    id: 'journal',
    screen: 'nutrition',
    target: 'journal',
    title: 'Ce que tu as vraiment mangé',
    body: "« J'ai mangé ce repas » sous chaque plat, « + Aliment » pour le reste. "
      + "C'est facultatif : sans rien pointer, ton plan reste valable.",
  },
  {
    id: 'courses',
    screen: 'nutrition',
    target: 'courses',
    title: 'Ta liste de courses',
    body: 'Déduite des repas de la semaine, en formats d’achat réels et '
      + 'chiffrée à ton enseigne. Coche ce que tu as déjà chez toi.',
  },
  {
    id: 'coach',
    screen: 'coach',
    target: 'tab-coach',
    title: 'Qui valide la méthode',
    body: 'La fiche du coach qui a validé les exercices, la construction des '
      + 'séances et les règles de progression — et ce qu’il ne couvre pas.',
  },
  {
    id: 'profile',
    screen: 'profile',
    target: 'tab-profile',
    title: 'Tout se change ici',
    body: 'Objectif, salle, enseigne, budget, jour de départ, formule. '
      + 'Chaque modification recalcule le plan entier.',
  },
  {
    id: 'fin',
    screen: 'home',
    target: null,
    title: "C'est à toi",
    body: 'Tu peux revoir ce guide à tout moment depuis ton profil.',
  },
];

export interface Rect { top: number; left: number; width: number; height: number }

export type PopPlacement = 'above' | 'below' | 'center';

export interface PopPosition {
  placement: PopPlacement;
  /** Position verticale de la bulle, en pixels depuis le haut de la fenêtre. */
  top: number;
}

/**
 * Place la bulle par rapport à la zone éclairée.
 *
 * En dessous par défaut, au-dessus si ça ne tient pas — et si rien ne tient
 * (une cible qui occupe presque tout l'écran), on centre plutôt que de laisser
 * la bulle déborder hors de la fenêtre.
 */
export function placePop(
  target: Rect | null,
  popHeight: number,
  viewportHeight: number,
  gap = 14,
  margin = 16,
): PopPosition {
  if (!target) {
    return { placement: 'center', top: Math.max(margin, (viewportHeight - popHeight) / 2) };
  }
  const below = target.top + target.height + gap;
  if (below + popHeight + margin <= viewportHeight) return { placement: 'below', top: below };

  const above = target.top - gap - popHeight;
  if (above >= margin) return { placement: 'above', top: above };

  return { placement: 'center', top: Math.max(margin, (viewportHeight - popHeight) / 2) };
}

/** Marge de lumière autour de la cible, pour que le contour respire. */
export const HALO = 6;

/** La zone éclairée, agrandie du halo et bornée à la fenêtre. */
export function haloRect(target: Rect, viewportWidth: number, viewportHeight: number): Rect {
  const left = Math.max(0, target.left - HALO);
  const top = Math.max(0, target.top - HALO);
  return {
    left,
    top,
    width: Math.min(viewportWidth - left, target.width + HALO * 2),
    height: Math.min(viewportHeight - top, target.height + HALO * 2),
  };
}
