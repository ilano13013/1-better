import type { EquipmentId, Gym } from '../types';

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  halteres: 'Haltères',
  barre: 'Barres',
  rack: 'Rack à squat',
  smith: 'Smith machine',
  poulie: 'Poulies',
  machine: 'Machines guidées',
  presse: 'Presse à cuisses',
  hack_squat: 'Hack squat',
  tapis: 'Tapis de course',
  velo: 'Vélo',
  rameur: 'Rameur',
  banc: 'Banc',
  barre_traction: 'Barre de traction',
  elastique: 'Élastiques',
  poids_corps: 'Poids du corps',
  kettlebell: 'Kettlebell',
};

export const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as EquipmentId[];

const FULL_GYM: EquipmentId[] = [
  'halteres', 'barre', 'rack', 'smith', 'poulie', 'machine', 'presse',
  'hack_squat', 'tapis', 'velo', 'rameur', 'banc', 'barre_traction', 'poids_corps',
];

/**
 * ⚠️ Les couleurs servent uniquement de fond au monogramme affiché tant
 * qu'aucun logo officiel n'a été déposé dans `src/assets/logos/`. Elles sont
 * indicatives et n'ont pas été relevées sur les chartes de marque.
 */
export const GYMS: Gym[] = [
  { id: 'basic_fit', name: 'Basic-Fit', custom: false, color: '#F36F21',
    equipment: FULL_GYM.filter((e) => e !== 'hack_squat') },
  { id: 'fitness_park', name: 'Fitness Park', custom: false, color: '#141416',
    equipment: [...FULL_GYM, 'kettlebell'] },
  { id: 'keepcool', name: 'Keepcool', custom: false, color: '#00A2A0',
    equipment: ['halteres', 'barre', 'rack', 'smith', 'poulie', 'machine', 'presse', 'tapis', 'velo', 'banc', 'poids_corps'] },
  { id: 'neoness', name: 'Neoness', custom: false, color: '#D6006E',
    equipment: ['halteres', 'barre', 'smith', 'poulie', 'machine', 'presse', 'tapis', 'velo', 'rameur', 'banc', 'poids_corps'] },
  { id: 'on_air', name: 'On Air', custom: false, color: '#B01018',
    equipment: [...FULL_GYM, 'kettlebell', 'elastique'] },
  { id: 'independante', name: 'Salle indépendante', custom: true, color: '#3F4045',
    equipment: [] },
  { id: 'domicile', name: 'Domicile', custom: true, color: '#3F4045',
    equipment: [] },
];

export const GYM_BY_ID: Record<string, Gym> = Object.fromEntries(GYMS.map((g) => [g.id, g]));

/** Équipements réellement disponibles : ceux de l'enseigne, ou la sélection manuelle. */
export function resolveEquipment(gymId: string, custom: EquipmentId[]): EquipmentId[] {
  const gym = GYM_BY_ID[gymId];
  if (!gym) return ['poids_corps'];
  const base = gym.custom ? custom : gym.equipment;
  // Le poids du corps est toujours disponible.
  return Array.from(new Set<EquipmentId>([...base, 'poids_corps']));
}
