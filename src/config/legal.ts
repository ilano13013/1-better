import { readPublisher } from '../engine/legal';

/**
 * Identité de l'éditeur, figée au build.
 *
 * Ces valeurs sont les mentions obligatoires d'un service en ligne payant.
 * Elles ne peuvent pas être devinées, et l'application ne les invente pas :
 * tant qu'une variable manque, l'écran « Informations légales » affiche un
 * trou nommé avec le texte de loi qui l'impose, et le bandeau de publication
 * indique que le service n'est pas publiable en l'état.
 *
 * À renseigner dans un `.env.local` en développement, ou dans les variables du
 * dépôt pour le workflow de publication :
 *
 *   VITE_LEGAL_NAME="1 Better SAS"
 *   VITE_LEGAL_FORM="Société par actions simplifiée"
 *   VITE_LEGAL_CAPITAL="1 000 €"
 *   VITE_LEGAL_ADDRESS="12 rue Exemple, 69000 Lyon"
 *   VITE_LEGAL_REGISTRATION="SIREN 000 000 000"
 *   VITE_LEGAL_VAT="FR00000000000"
 *   VITE_LEGAL_DIRECTOR="Prénom Nom"
 *   VITE_LEGAL_EMAIL="contact@exemple.fr"
 *   VITE_LEGAL_PHONE="+33 0 00 00 00 00"
 *   VITE_LEGAL_HOST_NAME="GitHub, Inc."
 *   VITE_LEGAL_HOST_ADDRESS="88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis"
 *   VITE_LEGAL_HOST_PHONE="+1 877 448 4820"
 *   VITE_LEGAL_PRIVACY_EMAIL="donnees@exemple.fr"
 *   VITE_LEGAL_MEDIATOR="Nom du médiateur de la consommation"
 *   VITE_LEGAL_MEDIATOR_URL="https://exemple-mediation.fr"
 *   VITE_LEGAL_SITE_URL="https://exemple.github.io/1-better/"
 *
 * Rien ici n'est secret : ce sont des mentions destinées à être publiques.
 */
export const PUBLISHER = readPublisher(
  import.meta.env as unknown as Record<string, string | undefined>,
);

/** Version affichée dans l'application, injectée par Vite depuis `package.json`. */
export const APP_VERSION: string = __APP_VERSION__;
