import type { CheckInAdjustment, NutritionTargets, Profile, WeeklyCheckIn, WeightEntry } from '../types';
import { weeklyTrendPct } from './weight';

/**
 * Check-in hebdomadaire : règles prédéfinies, aucune décision automatique.
 * Le moteur propose un ajustement, l'utilisateur le valide ou le refuse.
 */

interface CheckInContext {
  profile: Profile;
  targets: NutritionTargets;
  checkIn: WeeklyCheckIn;
  weightEntries: WeightEntry[];
}

/** Rythme de variation de poids visé, en % du poids de corps par semaine. */
export const TARGET_TREND: Record<Profile['goal'], [number, number]> = {
  masse: [0.15, 0.6],
  seche: [-1.0, -0.3],
  maintien: [-0.25, 0.25],
  recomp: [-0.3, 0.15],
};

export function evaluateCheckIn(ctx: CheckInContext): CheckInAdjustment {
  const { profile, targets, checkIn } = ctx;
  const messages: string[] = [];
  let kcalDelta = 0;
  let budgetDelta = 0;

  const trend = weeklyTrendPct([...ctx.weightEntries, { date: checkIn.date, weightKg: checkIn.weightKg }]);
  const [low, high] = TARGET_TREND[profile.goal];

  if (trend === null) {
    messages.push('Pas encore assez de pesées pour dégager une tendance fiable : continue une semaine de plus.');
  } else if (trend < low) {
    kcalDelta += profile.goal === 'seche' ? 100 : 150;
    messages.push(
      `Tendance : ${fmt(trend)} %/semaine, sous la cible (${low} à ${high} %). Proposition : +${kcalDelta} kcal par jour.`,
    );
  } else if (trend > high) {
    kcalDelta -= profile.goal === 'masse' ? 100 : 150;
    messages.push(
      `Tendance : ${fmt(trend)} %/semaine, au-dessus de la cible (${low} à ${high} %). Proposition : ${kcalDelta} kcal par jour.`,
    );
  } else {
    messages.push(`Tendance : ${fmt(trend)} %/semaine — dans la cible. On ne change rien.`);
  }

  // Séances réalisées
  const expected = profile.sessionsPerWeek;
  if (checkIn.sessionsDone < expected - 1) {
    messages.push(
      `${checkIn.sessionsDone} séances sur ${expected} : réduire la fréquence programmée est souvent plus efficace que de la subir.`,
    );
  } else if (checkIn.sessionsDone >= expected) {
    messages.push('Toutes les séances réalisées — la fréquence actuelle te convient.');
  }

  // Faim et énergie
  if (checkIn.hunger >= 4 && kcalDelta <= 0) {
    messages.push('Faim élevée : privilégie les repas à fort volume (légumes, protéines maigres) avant de toucher aux calories.');
  }
  if (checkIn.energy <= 2) {
    messages.push('Énergie basse : place davantage de glucides autour des séances et vérifie ton sommeil.');
    if (profile.goal === 'seche' && kcalDelta === 0) {
      messages.push('Si cela persiste une seconde semaine, une pause à maintenance est préférable.');
    }
  }
  if (checkIn.difficulty >= 4) {
    messages.push('Plan jugé difficile : simplifie en répétant les mêmes recettes sur plusieurs jours.');
  }

  // Respect du plan
  if (checkIn.planAdherence < 60) {
    messages.push('Respect du plan sous 60 % : réduis le nombre de recettes différentes plutôt que les objectifs.');
  }

  // Budget
  const spent = checkIn.budgetSpent;
  if (spent > profile.weeklyBudget * 1.1) {
    budgetDelta = Math.round((spent - profile.weeklyBudget) * 0.5);
    messages.push(
      `Budget dépassé de ${fmtEur(spent - profile.weeklyBudget)} : soit +${fmtEur(budgetDelta)} sur l'enveloppe, soit une optimisation du panier.`,
    );
  } else if (spent > 0 && spent < profile.weeklyBudget * 0.8) {
    messages.push(
      `Seulement ${fmtEur(spent)} dépensés sur ${fmtEur(profile.weeklyBudget)} : tu peux monter en qualité sur les protéines.`,
    );
  }

  // Garde-fou : jamais sous le métabolisme de base.
  if (targets.kcal + kcalDelta < targets.bmr) {
    kcalDelta = Math.max(kcalDelta, targets.bmr - targets.kcal);
    messages.push('Ajustement limité : l\'objectif calorique ne doit pas descendre sous le métabolisme de base.');
  }

  return { kcalDelta, budgetDelta, messages };
}

/** Prochain check-in dû ? (tous les 7 jours) */
export function isCheckInDue(checkIns: WeeklyCheckIn[], today = new Date()): boolean {
  if (checkIns.length === 0) return true;
  const last = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0];
  const days = Math.round((today.getTime() - new Date(last.date).getTime()) / 86400000);
  return days >= 7;
}

function fmt(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(2).replace('.', ',');
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}
