import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TOUR_STEPS, haloRect, placePop,
  type PopPlacement, type Rect, type TourScreen,
} from '../engine/tour';

/**
 * Guide pas à pas, à projecteur.
 *
 * Une zone éclairée, le reste dans l'ombre, une bulle qui explique. L'ombre
 * n'est pas un calque séparé : c'est l'ombre portée du trou, `box-shadow` de
 * 9999 px. Un seul élément, donc aucune chance que les quatre pans se
 * désalignent quand la cible bouge.
 *
 * Le guide pilote la navigation : chaque étape déclare son écran, le tour l'y
 * emmène, fait défiler jusqu'à la cible, puis mesure. Mesurer avant que
 * l'écran soit monté donnerait un rectangle vide — d'où l'attente d'une image
 * avant chaque mesure.
 */

interface Props {
  /** Change d'écran pour l'étape en cours. */
  go: (screen: TourScreen) => void;
  onDone: () => void;
}

const POP_FALLBACK_HEIGHT = 190;

export default function Tour({ go, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pop, setPop] = useState<{ top: number; placement: PopPlacement }>(
    { top: 0, placement: 'center' },
  );
  const popRef = useRef<HTMLDivElement>(null);

  /*
   * Les étapes ne peuvent pas être filtrées au montage : à cet instant, aucun
   * écran n'est encore posé dans le document, et tout paraîtrait absent. Chaque
   * étape est donc évaluée sur son propre écran, au moment de l'afficher — et
   * sautée si sa cible n'y est pas.
   */
  const steps = TOUR_STEPS;
  const step = steps[index] ?? null;

  const measure = useCallback(() => {
    if (!step) return;
    const el = step.target ? find(step.target) : null;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const box = el
      ? haloRect(toRect(el.getBoundingClientRect()), viewportW, viewportH)
      : null;
    setRect(box);
    const height = popRef.current?.offsetHeight ?? POP_FALLBACK_HEIGHT;
    setPop(placePop(box, height, viewportH));
  }, [step]);

  // Changement d'étape : on va sur l'écran, on défile, puis on mesure.
  useEffect(() => {
    if (!step) return;
    go(step.screen);
    let raf = 0;
    const timer = window.setTimeout(() => {
      const el = step.target ? find(step.target) : null;
      if (step.target && !el) {
        // Fonction absente de cette configuration : on passe, sans éclairer du vide.
        setIndex((i) => i + 1);
        return;
      }
      el?.scrollIntoView({ block: 'center', inline: 'nearest' });
      raf = requestAnimationFrame(() => { measure(); });
    }, 110);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [step, go, measure]);

  // La bulle est mesurée après son rendu : sa hauteur décide du placement.
  useEffect(() => { measure(); }, [index, measure]);

  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      if (e.key === 'ArrowRight' || e.key === 'Enter') setIndex((i) => i + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  useEffect(() => { if (index >= steps.length) onDone(); }, [index, steps.length, onDone]);

  if (!step) return null;

  const last = index === steps.length - 1;
  const next = () => (last ? onDone() : setIndex((i) => i + 1));

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* Capte les clics : l'ombre elle-même ne peut pas le faire. */}
      <div className="tour-catch" onClick={next} />

      {rect && (
        <div
          className="tour-hole"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      {!rect && <div className="tour-veil" />}

      <div
        ref={popRef}
        className={`tour-pop tour-pop-${pop.placement}`}
        style={{ top: pop.top }}
      >
        <div className="tour-steps" aria-hidden="true">
          {steps.map((s, i) => (
            <i key={s.id} className={i <= index ? 'done' : undefined} />
          ))}
        </div>
        <div className="card-title" style={{ margin: '10px 0 6px' }}>
          Étape {index + 1} sur {steps.length}
        </div>
        <h2 className="tour-title">{step.title}</h2>
        <p className="sm muted" style={{ marginTop: 8 }}>{step.body}</p>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          {index > 0 && (
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setIndex((i) => i - 1)}>
              Retour
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm grow" onClick={next}>
            {last ? 'Terminer' : 'Suivant'}
          </button>
        </div>
        {!last && (
          <button type="button" className="linkish" style={{ marginTop: 6 }} onClick={onDone}>
            Passer le guide
          </button>
        )}
      </div>
    </div>
  );
}

function find(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function toRect(r: DOMRect): Rect {
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}
