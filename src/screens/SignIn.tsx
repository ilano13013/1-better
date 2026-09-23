import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '../components/Logo';
import { AUTH_CONFIG } from '../config/auth';
import { LOCAL_SESSION, sessionFromIdToken, type Session } from '../engine/auth';
import { hasSavedState } from '../store/persistence';

/**
 * Écran de connexion.
 *
 * Les deux fournisseurs sont intégrés pour de vrai : Google Identity Services
 * et Sign in with Apple JS. Aucun des deux ne peut fonctionner sans un
 * identifiant client déclaré chez le fournisseur et une origine autorisée — un
 * bouton non configuré est donc désactivé et le dit, plutôt que d'échouer au
 * clic.
 *
 * « Continuer sans compte » reste toujours disponible : l'application est un
 * site statique qui fonctionne entièrement hors ligne, rien n'oblige à
 * s'identifier.
 */

const GOOGLE_SDK = 'https://accounts.google.com/gsi/client';
const APPLE_SDK = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/fr_FR/appleid.auth.js';

/* --- Surfaces minimales des deux SDK, telles que l'écran les utilise. --- */

interface GoogleCredentialResponse { credential?: string }
interface GoogleIdApi {
  initialize(o: {
    client_id: string;
    callback: (r: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(el: HTMLElement, o: Record<string, string | number>): void;
}
interface AppleAuthResponse {
  authorization?: { id_token?: string; state?: string };
  user?: { name?: { firstName?: string; lastName?: string }; email?: string };
}
interface AppleApi {
  auth: {
    init(o: { clientId: string; scope: string; redirectURI: string; state: string; usePopup: boolean }): void;
    signIn(): Promise<AppleAuthResponse>;
  };
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
    AppleID?: AppleApi;
  }
}

/** Charge un script externe une seule fois, et retient la promesse. */
const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const cached = scripts.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`script injoignable : ${src}`));
    document.head.appendChild(el);
  });
  scripts.set(src, p);
  return p;
}

type Busy = null | 'google' | 'apple';

export default function SignIn({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const googleSlot = useRef<HTMLDivElement>(null);
  const localData = hasSavedState('local');

  const { google, apple } = AUTH_CONFIG;

  /* ---------------------------------- Google --------------------------------- */

  const onGoogleCredential = useCallback((res: GoogleCredentialResponse) => {
    if (!google || !res.credential) {
      setError("Google n'a pas renvoyé de jeton d'identité.");
      return;
    }
    const session = sessionFromIdToken('google', res.credential, google.clientId);
    if (!session) {
      setError("Le jeton renvoyé par Google n'est pas exploitable.");
      return;
    }
    onSignIn(session);
  }, [google, onSignIn]);

  useEffect(() => {
    if (!google || !googleSlot.current) return;
    let alive = true;
    setBusy('google');
    loadScript(GOOGLE_SDK)
      .then(() => {
        const api = window.google?.accounts?.id;
        const slot = googleSlot.current;
        if (!alive || !api || !slot) return;
        api.initialize({
          client_id: google.clientId,
          callback: onGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        // Le bouton officiel porte la marque Google, comme leurs règles
        // l'exigent. On lui donne la largeur de la carte, bornée à 400 px.
        api.renderButton(slot, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          text: 'continue_with', logo_alignment: 'center',
          width: Math.min(400, Math.max(200, slot.clientWidth || 320)),
        });
      })
      .catch(() => { if (alive) setError("Le service d'identification Google est injoignable."); })
      .finally(() => { if (alive) setBusy(null); });
    return () => { alive = false; };
  }, [google, onGoogleCredential]);

  /* ---------------------------------- Apple ---------------------------------- */

  const signInWithApple = useCallback(async () => {
    if (!apple) return;
    setError(null);
    setBusy('apple');
    // `state` revient tel quel dans la réponse : une réponse qui ne le porte
    // pas ne vient pas de cette tentative.
    const state = randomState();
    try {
      await loadScript(APPLE_SDK);
      const api = window.AppleID;
      if (!api) throw new Error('SDK Apple indisponible');
      api.auth.init({
        clientId: apple.clientId,
        scope: 'name email',
        redirectURI: apple.redirectUri,
        state,
        usePopup: true,
      });
      const res = await api.auth.signIn();
      const token = res.authorization?.id_token;
      if (!token) throw new Error('aucun jeton');
      if (res.authorization?.state !== undefined && res.authorization.state !== state) {
        throw new Error('réponse inattendue');
      }
      // Apple ne transmet le nom qu'à la toute première autorisation.
      const first = res.user?.name?.firstName ?? '';
      const lastName = res.user?.name?.lastName ?? '';
      const session = sessionFromIdToken(
        'apple', token, apple.clientId, new Date(), `${first} ${lastName}`.trim(),
      );
      if (!session) throw new Error('jeton inexploitable');
      onSignIn(session);
    } catch {
      // Une fermeture de la fenêtre Apple passe aussi par là : on reste sobre.
      setError("La connexion avec Apple n'a pas abouti.");
    } finally {
      setBusy(null);
    }
  }, [apple, onSignIn]);

  /* ----------------------------------- Vue ----------------------------------- */

  const nothingConfigured = !google && !apple;

  return (
    <div className="signin">
      <div className="signin-inner">
        <header className="signin-head">
          <Logo size="lg" />
          <p className="signin-promise">
            Ton objectif, ta salle, ton supermarché et ton budget :
            toute ta semaine est planifiée.
          </p>
        </header>

        <div className="stack-sm">
          {/* Bouton officiel Google, injecté par leur SDK. */}
          {google ? (
            <div className="signin-google" ref={googleSlot} />
          ) : (
            <button type="button" className="btn btn-block" disabled>
              Continuer avec Google
            </button>
          )}

          <button
            type="button"
            className="btn btn-block btn-apple"
            onClick={signInWithApple}
            disabled={!apple || busy !== null}
          >
            <AppleGlyph />
            {busy === 'apple' ? 'Connexion…' : 'Continuer avec Apple'}
          </button>
        </div>

        {nothingConfigured && (
          <div className="card card-notice">
            <div className="card-title">Identification non configurée</div>
            <p className="sm muted">
              Ce déploiement n'a pas encore d'identifiant client Apple ni Google.
              Les deux boutons restent inactifs tant qu'il n'en a pas — voir
              <span className="strong"> README, « Comptes Apple et Google »</span>.
              L'application fonctionne entièrement sans compte.
            </p>
          </div>
        )}

        {error && (
          <div className="card card-alert">
            <p className="sm notice">{error}</p>
          </div>
        )}

        <div className="signin-sep"><span>ou</span></div>

        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => onSignIn(LOCAL_SESSION)}
        >
          Continuer sans compte
        </button>
        {localData && (
          <p className="xs dim center">
            Une semaine est déjà enregistrée sur cet appareil : tu la retrouveras
            telle quelle.
          </p>
        )}

        <p className="xs dim signin-note">
          Un compte sert à séparer tes données de celles d'une autre personne sur
          le même appareil, et rien d'autre. Il n'y a pas de serveur : tout reste
          dans ce navigateur, donc rien ne se synchronise d'un appareil à
          l'autre, avec ou sans compte.
        </p>
      </div>
    </div>
  );
}

function randomState(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Glyphe Apple du bouton « Se connecter avec Apple ». */
function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.54c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.33-3.5zM14.86 5.9c.61-.74 1.02-1.77.91-2.79-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.23z" />
    </svg>
  );
}
