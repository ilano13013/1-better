import logoUrl from '../assets/brand/logo.webp';

/**
 * Marque « 1% Better ».
 *
 * Le fichier est la marque officielle : il n'est ni redessiné ni recoloré. Son
 * fond est noir, donc en thème sombre un filet très discret redonne au carré
 * son contour — sans rien changer à l'image.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <img
      className={`logo logo-${size}`}
      src={logoUrl}
      width={512}
      height={512}
      alt="1% Better"
      draggable={false}
    />
  );
}

export { logoUrl };
