import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '../components/Logo';
import { AUTH_CONFIG } from '../config/auth';
import { LOCAL_SESSION, sessionFromIdToken, type Session } from '../engine/auth';
import {
  createLocalAccount, localAccountId, normalizeEmail, unlockLocalAccount,
  validateEmail, validatePassword,
} from '../engine/localAccount';
import { findLocalAccount, listLocalAccounts, saveLocalAccount } from '../store/accounts';
import { hasSavedState } from '../store/persistence';

/**
 * Écran de connexion.
 *
 * Trois voies, aucune obligatoire :
 *
 * - **Apple / Google** — intégration réelle (Google Identity Services, Sign in
 *   with Apple JS), mais impossible sans identifiant client déclaré chez le
 *   fournisseur. Un bouton non configuré est désactivé et le dit, plutôt que
 *   d'échouer au clic.
 * - **E-mail et mot de passe** — compte créé ici même, sans service tiers. Les
 *   données du compte sont chiffrées avec une clé dérivée du mot de passe.
 * - **Sans compte** — l'application est un site statique, rien n'oblige à
 *   s'identifier.
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

type Busy = null | 'google' | 'apple' | 'email';
type Mode = 'choose' | 'email';

interface Props {
  onSignIn: (session: Session, key?: CryptoKey | null) => void | Promise<void>;
  /** Compte e-mail de la dernière session, qui attend son mot de passe. */
  locked?: Session | null;
}

export default function SignIn({ onSignIn, locked = null }: Props) {
  const [mode, setMode] = useState<Mode>(locked ? 'email' : 'choose');
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
    void onSignIn(session);
  }, [google, onSignIn]);

  useEffect(() => {
    if (!google || mode !== 'choose' || !googleSlot.current) return;
    let alive = true;
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
      .catch(() => { if (alive) setError("Le service d'identification Google est injoignable."); });
    return () => { alive = false; };
  }, [google, mode, onGoogleCredential]);

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
      await onSignIn(session);
    } catch {
      // Une fermeture de la fenêtre Apple passe aussi par là : on reste sobre.
      setError("La connexion avec Apple n'a pas abouti.");
    } finally {
      setBusy(null);
    }
  }, [apple, onSignIn]);

  /* ----------------------------------- Vue ----------------------------------- */

  if (mode === 'email') {
    return (
      <EmailForm
        locked={locked}
        busy={busy === 'email'}
        setBusy={(b) => setBusy(b ? 'email' : null)}
        onSignIn={onSignIn}
        onBack={locked ? null : () => { setMode('choose'); setError(null); }}
      />
    );
  }

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
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => { setMode('email'); setError(null); }}
          >
            Créer un compte avec un e-mail
          </button>

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
          <p className="xs dim center">
            Apple et Google demandent un identifiant client déclaré chez eux, que
            ce déploiement n'a pas encore. Le compte e-mail, lui, ne dépend
            d'aucun service extérieur.
          </p>
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
          onClick={() => void onSignIn(LOCAL_SESSION)}
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
          Il n'y a pas de serveur : tout reste dans ce navigateur. Un compte sert
          à séparer tes données de celles d'une autre personne sur le même
          appareil — rien ne se synchronise d'un appareil à l'autre.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ Compte e-mail ------------------------------ */

function EmailForm({
  locked, busy, setBusy, onSignIn, onBack,
}: {
  locked: Session | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onSignIn: Props['onSignIn'];
  onBack: (() => void) | null;
}) {
  const known = listLocalAccounts();
  // On ouvre sur « se connecter » dès qu'un compte existe déjà ici.
  const [tab, setTab] = useState<'login' | 'signup'>(
    locked || known.length > 0 ? 'login' : 'signup',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState(locked?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) { setError(emailError); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (tab === 'signup' && password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setBusy(true);
    try {
      if (tab === 'signup') {
        if (findLocalAccount(localAccountId(email))) {
          setError('Un compte existe déjà avec cette adresse sur cet appareil.');
          return;
        }
        const { account, key } = await createLocalAccount(email, password, name);
        saveLocalAccount(account);
        await onSignIn(sessionOf(account.accountId, account.name, account.email), key);
      } else {
        const account = findLocalAccount(localAccountId(email));
        if (!account) {
          setError("Aucun compte avec cette adresse sur cet appareil. Crée-le d'abord.");
          return;
        }
        const key = await unlockLocalAccount(account, password);
        if (!key) { setError('Mot de passe incorrect.'); return; }
        await onSignIn(sessionOf(account.accountId, account.name, account.email), key);
      }
    } catch {
      setError("La création de la clé de chiffrement a échoué sur ce navigateur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <form className="signin-inner" onSubmit={submit}>
        <header className="signin-head">
          <Logo size="md" />
          <p className="signin-promise" style={{ marginTop: 14 }}>
            {locked
              ? `Bon retour${locked.name ? `, ${locked.name}` : ''}. Ton mot de passe déverrouille tes données.`
              : tab === 'signup'
                ? 'Un compte créé ici même, sans passer par Apple ni Google.'
                : 'Retrouve le compte enregistré sur cet appareil.'}
          </p>
        </header>

        {!locked && (
          <div className="signin-tabs">
            <button type="button" className="chip" aria-pressed={tab === 'signup'}
              onClick={() => { setTab('signup'); setError(null); }}>
              Créer un compte
            </button>
            <button type="button" className="chip" aria-pressed={tab === 'login'}
              onClick={() => { setTab('login'); setError(null); }}>
              J'ai déjà un compte
            </button>
          </div>
        )}

        <div className="stack-sm">
          {tab === 'signup' && (
            <div className="field">
              <label htmlFor="signup-name">Prénom</label>
              <input id="signup-name" type="text" autoComplete="given-name" placeholder="Alex"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <div className="field">
            <label htmlFor="signin-email">E-mail</label>
            <input
              id="signin-email" type="email" inputMode="email" autoComplete="email"
              placeholder="alex@exemple.fr" value={email} readOnly={Boolean(locked)}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="signin-password">Mot de passe</label>
            <input
              id="signin-password" type="password"
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {tab === 'signup' && (
            <div className="field">
              <label htmlFor="signin-confirm">Confirmer le mot de passe</label>
              <input
                id="signin-confirm" type="password" autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="card card-alert">
            <p className="sm notice">{error}</p>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy
            ? 'Chiffrement…'
            : tab === 'signup' ? 'Créer mon compte' : 'Se connecter'}
        </button>

        {tab === 'signup' && (
          <div className="card card-notice">
            <div className="card-title">À lire avant de choisir ton mot de passe</div>
            <p className="sm muted">
              Il chiffre les données de ce compte sur cet appareil. Comme il n'y a
              pas de serveur, <span className="strong">il ne peut pas être
              réinitialisé</span> : oublié, la semaine, les performances et les
              images de ce compte sont définitivement illisibles.
            </p>
          </div>
        )}

        {onBack && (
          <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>
            Retour
          </button>
        )}
        {locked && (
          <button
            type="button" className="btn btn-ghost btn-block"
            onClick={() => void onSignIn(LOCAL_SESSION)}
          >
            Continuer sans compte
          </button>
        )}
      </form>
    </div>
  );
}

function sessionOf(accountId: string, name: string, email: string): Session {
  return {
    accountId,
    provider: 'email',
    name,
    email: normalizeEmail(email),
    signedInAt: new Date().toISOString(),
  };
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
