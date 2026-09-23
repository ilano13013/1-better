/**
 * Marque « 1% Better ».
 *
 * Le pourcentage est repris de l'écran de construction de la semaine : c'est
 * la même idée, un point de mieux à chaque fois. Achromatique par construction,
 * elle s'inverse avec le thème sans règle supplémentaire.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`logo logo-${size}`} aria-label="1% Better" role="img">
      <span className="logo-mark" aria-hidden="true">
        1<span className="logo-pct">%</span>
      </span>
      <span className="logo-word" aria-hidden="true">Better</span>
    </span>
  );
}
