/**
 * MINUTEUR DE RÉCUPÉRATION, DURÉE DE SÉANCE ET SÉANCE TERMINÉE.
 *
 * Le chronomètre ne compte pas : il retient **quand il a démarré**. Un
 * compteur incrémenté par un `setInterval` dérive dès que l'onglet passe en
 * arrière-plan — le navigateur en ralentit les minuteries — et repart de zéro
 * au moindre rechargement. Ici, le temps écoulé se déduit de l'horloge : le
 * rendu peut s'arrêter, le temps continue.
 *
 * « Séance terminée » est un fait distinct des charges enregistrées. Quelqu'un
 * qui s'entraîne sans rien noter a fait sa séance, et sa série doit en tenir
 * compte ; fabriquer des performances vides pour le lui accorder aurait pollué
 * son historique et faussé ses records.
 */

export interface ActiveSession {
  /** Séance en cours, pour rattacher le temps au bon entraînement. */
  workoutId: string;
  /** Jour concerné, au format `AAAA-MM-JJ`. */
  date: string;
  /** Horodatage du dernier démarrage, `null` en pause. */
  startedAt: string | null;
  /** Secondes déjà écoulées avant la pause en cours. */
  accumulatedSec: number;
}

export interface CompletedWorkout {
  id: string;
  date: string;
  workoutId: string;
  /** Durée réelle, en secondes. `0` si le chronomètre n'a pas servi. */
  durationSec: number;
}

export function startSession(workoutId: string, date: string, now: Date = new Date()): ActiveSession {
  return { workoutId, date, startedAt: now.toISOString(), accumulatedSec: 0 };
}

/** Temps écoulé, en secondes. Vaut aussi bien en marche qu'en pause. */
export function elapsedSec(session: ActiveSession | null, now: Date = new Date()): number {
  if (!session) return 0;
  if (!session.startedAt) return Math.max(0, Math.round(session.accumulatedSec));
  const since = (now.getTime() - new Date(session.startedAt).getTime()) / 1000;
  // Une horloge reculée — changement d'heure, correction réseau — ne doit pas
  // faire reculer le chronomètre.
  return Math.max(0, Math.round(session.accumulatedSec + Math.max(0, since)));
}

export function pauseSession(session: ActiveSession, now: Date = new Date()): ActiveSession {
  if (!session.startedAt) return session;
  return { ...session, startedAt: null, accumulatedSec: elapsedSec(session, now) };
}

export function resumeSession(session: ActiveSession, now: Date = new Date()): ActiveSession {
  if (session.startedAt) return session;
  return { ...session, startedAt: now.toISOString() };
}

export function isRunning(session: ActiveSession | null): boolean {
  return Boolean(session?.startedAt);
}

/** `754` → `12:34`. Au-delà de l'heure, `1:02:03`. */
export function formatChrono(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Durée en minutes, arrondie, pour la comparer à l'estimation du programme. */
export function durationMin(sec: number): number {
  return Math.max(1, Math.round(sec / 60));
}

/**
 * Date à porter au crédit d'une séance validée.
 *
 * L'écran Training ouvre sur la **prochaine** séance, souvent à venir. Valider
 * enregistrait alors une date future, que la série — qui remonte le temps
 * depuis aujourd'hui — n'atteignait jamais : le pourcentage ne bougeait pas.
 *
 * Une séance d'un jour à venir faite en avance est donc portée à aujourd'hui.
 * Une séance d'un jour passé garde sa date : c'est une saisie rétroactive, et
 * elle est légitime.
 */
export function sessionDateFor(selectedIso: string, todayIso: string): string {
  return selectedIso <= todayIso ? selectedIso : todayIso;
}

export function findCompleted(
  logs: CompletedWorkout[], date: string, workoutId: string,
): CompletedWorkout | null {
  return logs.find((l) => l.date === date && l.workoutId === workoutId) ?? null;
}

/**
 * Dates qui valident un jour pour la série.
 *
 * Une charge enregistrée compte, une séance déclarée terminée aussi. Les
 * doublons sont écartés : deux preuves du même jour ne font pas deux points.
 */
export function validatedDates(
  performances: { date: string }[], completed: CompletedWorkout[],
): string[] {
  return [...new Set([...performances.map((p) => p.date), ...completed.map((c) => c.date)])];
}

/** Commentaire sur l'écart entre la durée réelle et l'estimation. */
export function durationNote(realSec: number, estimatedMin: number): string {
  const real = durationMin(realSec);
  const gap = real - estimatedMin;
  if (realSec === 0) return `Estimée à ${estimatedMin} min.`;
  if (Math.abs(gap) <= 5) return `${real} min — conforme à l'estimation.`;
  return gap > 0
    ? `${real} min, soit ${gap} de plus que l'estimation.`
    : `${real} min, soit ${-gap} de moins que l'estimation.`;
}

/* --------------------- Récupération entre les séries --------------------- */

/**
 * Minuteur de repos.
 *
 * Même principe que le chronomètre, à l'envers : on retient **l'instant de
 * fin**, pas un décompte. Un décompte incrémenté se serait figé dès l'écran
 * éteint — précisément le moment où l'on pose son téléphone entre deux séries.
 * Ici, revenir sur l'application affiche le temps réellement restant, ou zéro.
 */
export interface RestTimer {
  exerciseId: string;
  /** Durée prévue au départ, secondes. */
  totalSec: number;
  /** Instant de fin prévu. `null` en pause. */
  endsAt: string | null;
  /** Secondes restantes au moment de la mise en pause. */
  remainingSec: number;
}

export function startRest(exerciseId: string, totalSec: number, now: Date = new Date()): RestTimer {
  const total = Math.max(1, Math.round(totalSec));
  return {
    exerciseId,
    totalSec: total,
    endsAt: new Date(now.getTime() + total * 1000).toISOString(),
    remainingSec: total,
  };
}

/** Secondes restantes, jamais négatives. */
export function restLeft(timer: RestTimer | null, now: Date = new Date()): number {
  if (!timer) return 0;
  if (!timer.endsAt) return Math.max(0, Math.round(timer.remainingSec));
  const left = (new Date(timer.endsAt).getTime() - now.getTime()) / 1000;
  return Math.max(0, Math.round(left));
}

export function pauseRest(timer: RestTimer, now: Date = new Date()): RestTimer {
  if (!timer.endsAt) return timer;
  return { ...timer, endsAt: null, remainingSec: restLeft(timer, now) };
}

export function resumeRest(timer: RestTimer, now: Date = new Date()): RestTimer {
  if (timer.endsAt) return timer;
  return { ...timer, endsAt: new Date(now.getTime() + timer.remainingSec * 1000).toISOString() };
}

/**
 * Allonge le repos.
 *
 * `totalSec` suit, sinon la jauge afficherait un anneau plus que plein après
 * un ajout — un repos rallongé reste un repos, pas un dépassement.
 */
export function addRest(timer: RestTimer, extraSec: number, now: Date = new Date()): RestTimer {
  const left = restLeft(timer, now) + extraSec;
  const total = timer.totalSec + extraSec;
  if (left <= 0) return { ...timer, totalSec: Math.max(1, total), endsAt: null, remainingSec: 0 };
  return timer.endsAt
    ? { ...timer, totalSec: total, endsAt: new Date(now.getTime() + left * 1000).toISOString() }
    : { ...timer, totalSec: total, remainingSec: left };
}

export function isRestOver(timer: RestTimer | null, now: Date = new Date()): boolean {
  return timer !== null && restLeft(timer, now) === 0;
}

/** Part du repos déjà écoulée, de 0 à 1 — pour l'anneau. */
export function restProgress(timer: RestTimer | null, now: Date = new Date()): number {
  if (!timer || timer.totalSec <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - restLeft(timer, now) / timer.totalSec));
}
