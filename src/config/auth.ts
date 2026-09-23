import { readAuthConfig } from '../engine/auth';

/**
 * Configuration des fournisseurs d'identité, figée au build.
 *
 * Renseigner un `.env.local` en développement, ou des variables de dépôt dans
 * le workflow GitHub Pages en production :
 *
 *   VITE_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
 *   VITE_APPLE_CLIENT_ID=com.exemple.onebetter.web   (Service ID, pas le Bundle ID)
 *   VITE_APPLE_REDIRECT_URI=https://exemple.github.io/1-better/
 *
 * Ces identifiants sont publics : ils apparaissent dans le code livré au
 * navigateur, chez Apple comme chez Google. Ce ne sont pas des secrets.
 */
export const AUTH_CONFIG = readAuthConfig(
  import.meta.env as unknown as Record<string, string | undefined>,
);
