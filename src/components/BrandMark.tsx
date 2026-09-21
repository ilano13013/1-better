/**
 * Marque d'une enseigne ou d'une salle.
 *
 * L'interface est achromatique : ces pastilles sont la seule couleur de
 * l'application, ce qui rend les listes de choix immédiatement lisibles.
 *
 * Deux modes :
 *  - `logo` renseigné → le fichier fourni est affiché tel quel ;
 *  - sinon → un monogramme sur la couleur de la marque.
 *
 * Aucun logo n'est livré avec le projet : reproduire une marque déposée de
 * mémoire produirait un visuel faux présenté comme authentique. Voir
 * `src/assets/logos/README.md` pour ajouter les fichiers officiels.
 */
import type { Gym, Store } from '../types';
import { useApp } from '../store/AppContext';

export interface BrandMarkProps {
  name: string;
  color: string;
  /** URL ou import d'un fichier logo. Prioritaire sur le monogramme. */
  logo?: string;
  size?: number;
  /** Rendu discret : filet et encre du thème, sans couleur de marque. */
  quiet?: boolean;
}

/** Monogramme : initiales des deux premiers mots, sinon deux premières lettres. */
export function monogram(name: string): string {
  const words = name.split(/[\s'’-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  const w = words[0] ?? name;
  return (w[0]?.toUpperCase() ?? '?') + (w[1]?.toLowerCase() ?? '');
}

/** Luminance relative (WCAG) pour choisir une encre lisible sur la marque. */
export function readableInk(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return lum > 0.45 ? '#09090b' : '#ffffff';
}

export function BrandMark({ name, color, logo, size = 36, quiet = false }: BrandMarkProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.36),
    background: quiet ? 'transparent' : color,
    color: quiet ? 'var(--ink-2)' : readableInk(color),
    borderColor: quiet ? 'var(--line-strong)' : 'transparent',
  };
  return (
    <span className="brand" style={style} aria-hidden="true" title={name}>
      {logo ? <img src={logo} alt="" /> : monogram(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Variantes branchées sur l'état                                       */
/* ------------------------------------------------------------------ */

/**
 * Un logo déposé par l'utilisateur prime sur celui livré avec l'application.
 * Passer par ces variantes évite d'oublier cette règle sur un écran.
 */
export function StoreMark({
  store, size, quiet,
}: { store: Store; size?: number; quiet?: boolean }) {
  const { state } = useApp();
  return (
    <BrandMark
      name={store.name}
      color={store.color}
      logo={state.brandLogos[store.id] ?? store.logo}
      size={size}
      quiet={quiet ?? (store.id === 'autre' && !state.brandLogos[store.id])}
    />
  );
}

export function GymMark({
  gym, size, quiet,
}: { gym: Gym; size?: number; quiet?: boolean }) {
  const { state } = useApp();
  return (
    <BrandMark
      name={gym.name}
      color={gym.color}
      logo={state.brandLogos[gym.id] ?? gym.logo}
      size={size}
      quiet={quiet ?? (gym.custom && !state.brandLogos[gym.id])}
    />
  );
}
