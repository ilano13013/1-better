import { LOCAL_SESSION, type Session } from '../engine/auth';

/**
 * La session vit à part de l'état de l'application : c'est elle qui décide
 * *quel* état charger. Elle survit donc au changement de compte.
 */
const KEY = 'one-better:session:v1';

export function loadSession(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.accountId !== 'string' || typeof parsed.provider !== 'string') return null;
    if (parsed.provider === 'local') return LOCAL_SESSION;
    if (parsed.provider !== 'google' && parsed.provider !== 'apple') return null;
    return {
      accountId: parsed.accountId,
      provider: parsed.provider,
      name: parsed.name ?? '',
      email: parsed.email ?? '',
      signedInAt: parsed.signedInAt ?? '',
    };
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : la session reste valable pour cette visite.
  }
}
