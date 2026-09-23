import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';

/**
 * Animation de lancement.
 *
 * La marque apparaît, une barre se remplit, l'ensemble s'efface. Courte par
 * construction : un écran de lancement qui se fait attendre est une taxe, pas
 * une identité. Un appui la passe, et `prefers-reduced-motion` la réduit à une
 * apparition sans mouvement.
 */
const RISE_MS = 1150;
const FADE_MS = 260;

export default function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const reduced = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), reduced ? 320 : RISE_MS);
    return () => window.clearTimeout(hold);
  }, [reduced]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(onDone, reduced ? 0 : FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, onDone, reduced]);

  return (
    <div
      className={`splash${leaving ? ' is-leaving' : ''}${reduced ? ' is-still' : ''}`}
      onClick={() => setLeaving(true)}
      role="presentation"
    >
      <div className="splash-inner">
        <Logo size="xl" />
        <div className="splash-rail"><i /></div>
      </div>
    </div>
  );
}
