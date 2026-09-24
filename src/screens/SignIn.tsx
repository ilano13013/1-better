import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '../components/Logo';
import { AUTH_CONFIG } from '../config/auth';
import { LOCAL_SESSION, sessionFromIdToken, type Session } from '../engine/auth';
import {
  createLocalAccount, localAccountId, normalizeEmail, unlockLocalAccount,
  validateEmail, validatePassword,
} from '../engine/localAccount';
import { findLocalAccount, listLocalAccounts, removeLocalAccount } from '../store/accounts';
import { saveLocalAccount } from '../store/accounts';
import { clearState } from '../store/persistence';
import { Confirm } from '../components/Confirm';
import { LegalSheet } from '../components/Legal';
import type { LegalDocId } from '../engine/legal';

/**
 * Écran de connexion.
 *
 * Deux blocs — inscription, connexion — et trois voies, aucune obligatoire :
 * compte e-mail créé ici même (données chiffrées avec le mot de passe), Apple,
 * Google, ou rien du tout.
 *
 * Apple et Google sont intégrés pour de vrai (Google Identity Services, Sign in
 * with Apple JS) mais ne peuvent pas fonctionner sans identifiant client
 * déclaré chez le fournisseur : un bouton non configuré est désactivé.
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

type Mode = 'choose' | 'signup' | 'login' | 'forgot';

interface Props {
  onSignIn: (session: Session, key?: CryptoKey | null) => void | Promise<void>;
  /** Compte e-mail de la dernière session, qui attend son mot de passe. */
  locked?: Session | null;
}

export default function SignIn({ onSignIn, locked = null }: Props) {
  const [mode, setMode] = useState<Mode>(locked ? 'login' : 'choose');
  const [legal, setLegal] = useState<LegalDocId | null>(null);
  const [appleBusy, setAppleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleSlot = useRef<HTMLDivElement>(null);

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
        // Le bouton officiel porte la marque Google, comme leurs règles l'exigent.
        api.renderButton(slot, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          text: 'continue_with', logo_alignment: 'center',
          width: Math.min(400, Math.max(200, slot.clientWidth || 320)),
        });
      })
      .catch(() => { if (alive) setError("Le service d'identification Google est injoignable."); })
    return () => { alive = false; };
  }, [google, mode, onGoogleCredential]);

  /* ---------------------------------- Apple ---------------------------------- */

  const signInWithApple = useCallback(async () => {
    if (!apple) return;
    setError(null);
    setAppleBusy(true);
    // `state` revient tel quel : une réponse qui ne le porte pas ne vient pas
    // de cette tentative.
    const state = randomState();
    try {
      await loadScript(APPLE_SDK);
      const api = window.AppleID;
      if (!api) throw new Error('SDK Apple indisponible');
      api.auth.init({
        clientId: apple.clientId, scope: 'name email',
        redirectURI: apple.redirectUri, state, usePopup: true,
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
      setAppleBusy(false);
    }
  }, [apple, onSignIn]);

  /* ----------------------------------- Vues ---------------------------------- */

  if (mode === 'signup' || mode === 'login') {
    return (
      <EmailForm
        tab={mode}
        locked={locked}
        onSignIn={onSignIn}
        onForgot={() => setMode('forgot')}
        onBack={locked ? null : () => setMode('choose')}
      />
    );
  }

  if (mode === 'forgot') {
    return <Forgot email={locked?.email ?? ''} onBack={() => setMode(locked ? 'login' : 'choose')} />;
  }

  return (
    <div className="signin">
      <div className="signin-inner">
        <Logo size="lg" />

        <section className="signin-block">
          <h2 className="signin-title">Inscription</h2>
          <div className="stack-sm">
            <button type="button" className="btn btn-primary btn-block"
              onClick={() => setMode('signup')}>
              Créer un compte
            </button>

            <button type="button" className="btn btn-block btn-apple"
              onClick={signInWithApple} disabled={!apple || appleBusy}>
              <AppleGlyph />
              {appleBusy ? 'Connexion…' : 'Se connecter avec Apple'}
            </button>

            {/* Bouton officiel Google, injecté par leur SDK. */}
            {google ? (
              <div className="signin-google" ref={googleSlot} />
            ) : (
              <button type="button" className="btn btn-block" disabled>
                Se connecter avec Google
              </button>
            )}
          </div>
        </section>

        <div className="signin-sep" />

        <section className="signin-block">
          <h2 className="signin-title">Connexion</h2>
          <button type="button" className="btn btn-block" onClick={() => setMode('login')}>
            Se connecter
          </button>
          <button type="button" className="linkish" onClick={() => setMode('forgot')}>
            Mot de passe oublié ?
          </button>
        </section>

        {error && (
          <div className="card card-alert">
            <p className="sm notice">{error}</p>
          </div>
        )}

        <button type="button" className="btn btn-ghost btn-block"
          onClick={() => void onSignIn(LOCAL_SESSION)}>
          Continuer sans compte
        </button>

        {/* Les conditions se lisent avant de s'inscrire, pas après. Elles sont
            consultables ici sans quitter l'écran ni créer de compte. */}
        <p className="xs dim center" style={{ lineHeight: 1.6 }}>
          En continuant, tu acceptes les{' '}
          <button type="button" className="link" onClick={() => setLegal('cgu')}>
            conditions d'utilisation
          </button>{' '}
          et la{' '}
          <button type="button" className="link" onClick={() => setLegal('confidentialite')}>
            politique de confidentialité
          </button>. Tes données restent sur cet appareil.
        </p>
        <p className="xs dim center">
          <button type="button" className="link" onClick={() => setLegal('sante')}>
            Avertissement santé
          </button>
          {' · '}
          <button type="button" className="link" onClick={() => setLegal('mentions')}>
            Mentions légales
          </button>
        </p>
      </div>

      <LegalSheet open={legal !== null} docId={legal} onClose={() => setLegal(null)} />
    </div>
  );
}

/* ------------------------------ Compte e-mail ------------------------------ */

function EmailForm({
  tab, locked, onSignIn, onForgot, onBack,
}: {
  tab: 'signup' | 'login';
  locked: Session | null;
  onSignIn: Props['onSignIn'];
  onForgot: () => void;
  onBack: (() => void) | null;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(locked?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
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
          setError("Aucun compte avec cette adresse sur cet appareil.");
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
        <Logo size="md" />
        <h2 className="signin-title signin-title-lead">
          {tab === 'signup' ? 'Inscription' : 'Connexion'}
        </h2>

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
            {tab === 'signup' && (
              // Information matérielle, pas un conseil d'usage : il n'existe
              // aucun moyen de revenir en arrière.
              <p className="xs notice">
                Il chiffre tes données et ne peut pas être réinitialisé.
              </p>
            )}
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
          {busy ? 'Chiffrement…' : tab === 'signup' ? 'Créer mon compte' : 'Se connecter'}
        </button>

        {tab === 'login' && (
          <button type="button" className="linkish" onClick={onForgot}>
            Mot de passe oublié ?
          </button>
        )}

        {onBack && (
          <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>
            Retour
          </button>
        )}
        {locked && (
          <button type="button" className="btn btn-ghost btn-block"
            onClick={() => void onSignIn(LOCAL_SESSION)}>
            Continuer sans compte
          </button>
        )}
      </form>
    </div>
  );
}

/* --------------------------- Mot de passe oublié --------------------------- */

/**
 * Il n'y a rien à réinitialiser : aucun serveur ne détient de quoi le faire, et
 * les données sont chiffrées avec le mot de passe. Plutôt qu'un formulaire qui
 * n'enverrait aucun courriel, cet écran dit ce qui est vrai et propose la seule
 * action réelle — repartir de zéro, en sachant ce que cela coûte.
 */
function Forgot({ email, onBack }: { email: string; onBack: () => void }) {
  const [target, setTarget] = useState(email);
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const accounts = listLocalAccounts();

  const found = findLocalAccount(localAccountId(target || 'x@x.xx'));

  const erase = () => {
    if (!found) return;
    clearState(found.accountId);
    removeLocalAccount(found.accountId);
    setDone(true);
  };

  return (
    <div className="signin">
      <div className="signin-inner">
        <Logo size="md" />
        <h2 className="signin-title signin-title-lead">Mot de passe oublié</h2>

        <div className="card card-alert">
          <p className="sm">
            <span className="strong">Il ne peut pas être réinitialisé.</span> Il
            n'y a pas de serveur : personne, ici ou ailleurs, ne détient de quoi
            le retrouver. Tes données sont chiffrées avec lui.
          </p>
        </div>

        {done ? (
          <>
            <div className="card card-flat">
              <p className="sm muted">Compte supprimé. Tu peux en créer un nouveau.</p>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={onBack}>
              Retour
            </button>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="forgot-email">Compte à supprimer</label>
              {accounts.length > 0 ? (
                <select id="forgot-email" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Choisir…</option>
                  {accounts.map((a) => (
                    <option key={a.accountId} value={a.email}>{a.email}</option>
                  ))}
                </select>
              ) : (
                <p className="sm dim">Aucun compte e-mail sur cet appareil.</p>
              )}
            </div>

            <button type="button" className="btn btn-alert btn-block"
              onClick={() => setConfirming(true)} disabled={!found}>
              Supprimer ce compte et repartir de zéro
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>
              Retour
            </button>

            <Confirm
              open={confirming}
              title="Supprimer ce compte"
              confirmLabel="Supprimer définitivement"
              cancelLabel="Annuler"
              destructive
              onConfirm={erase}
              onClose={() => setConfirming(false)}
            >
              Le compte {found?.email} et toutes ses données sont supprimés de
              cet appareil. Elles sont chiffrées avec le mot de passe oublié :
              personne, pas même nous, ne peut les récupérer.
            </Confirm>
          </>
        )}
      </div>
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
