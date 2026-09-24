import type { AppState } from '../types';

/**
 * PORTABILITÉ ET EFFACEMENT — les articles 15, 17 et 20 du RGPD, en pratique.
 *
 * Le droit d'accès et le droit à la portabilité veulent un fichier
 * « structuré, couramment utilisé et lisible par machine ». Rien de plus, mais
 * rien de moins : un export partiel ne les satisfait pas.
 *
 * Deux exigences ont guidé la forme retenue.
 *
 * 1. **Tout, sans exception.** L'archive est l'état complet, pas une sélection
 *    jugée intéressante. Une clé oubliée ici serait une donnée détenue et non
 *    restituée — exactement ce que l'article 15 interdit.
 * 2. **Compréhensible sans le code.** Un fichier de clés techniques n'est pas
 *    lisible par la personne à qui il est remis. L'archive porte donc un
 *    en-tête qui dit ce qu'elle contient, d'où elle vient et ce qu'elle ne
 *    contient pas.
 *
 * Ce qui est délibérément absent : le mot de passe d'un compte, qui n'est
 * jamais enregistré, et son vérificateur, qui appartient au trousseau du
 * navigateur et non à l'état de l'application.
 */

export interface Archive {
  /** Marqueur de format, pour qu'une relecture sache ce qu'elle ouvre. */
  format: 'one-better/export';
  formatVersion: 1;
  application: string;
  version: string;
  /** Horodatage ISO complet de l'export. */
  exportedAt: string;
  /** En clair, pour la personne qui ouvre le fichier. */
  about: string[];
  account: { provider: string; label: string } | null;
  data: AppState;
}

export const ABOUT: string[] = [
  "Ce fichier contient toutes les données que l'application 1% Better a enregistrées sur cet appareil.",
  "Il est fourni au titre du droit d'accès et du droit à la portabilité (RGPD, articles 15 et 20).",
  "Aucune de ces données n'a été transmise à l'éditeur : l'application n'a pas de serveur.",
  "Le mot de passe d'un compte n'y figure pas, parce qu'il n'est jamais enregistré.",
  "Ce fichier peut contenir des informations de santé (poids, âge, allergies) : conserve-le comme tel.",
];

export function buildArchive(
  state: AppState,
  meta: { version: string; account?: { provider: string; label: string } | null },
  now: Date = new Date(),
): Archive {
  return {
    format: 'one-better/export',
    formatVersion: 1,
    application: '1% Better',
    version: meta.version,
    exportedAt: now.toISOString(),
    about: ABOUT,
    account: meta.account ?? null,
    data: state,
  };
}

/** JSON indenté : l'archive doit rester lisible à l'œil, pas seulement au parseur. */
export function archiveJson(archive: Archive): string {
  return JSON.stringify(archive, null, 2);
}

/** `1-better-mes-donnees-2026-09-24.json` */
export function archiveFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  return `1-better-mes-donnees-${day}.json`;
}

/**
 * Taille approximative de l'archive, en kilo-octets.
 *
 * Affichée avant l'export : les photos de recettes importées sont stockées en
 * data URI et pèsent parfois plusieurs mégaoctets. Mieux vaut le savoir avant
 * de tenter de copier le contenu dans un message.
 */
export function archiveSizeKb(json: string): number {
  return Math.max(1, Math.round(new Blob([json]).size / 1024));
}
