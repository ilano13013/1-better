import { describe, expect, it } from 'vitest';
import { HALO, TOUR_STEPS, haloRect, placePop } from '../tour';

const rect = (top: number, height: number, left = 20, width = 200) =>
  ({ top, left, width, height });

describe('guide pas à pas', () => {
  it('vise des éléments, pas des captures', () => {
    // Chaque étape doit nommer un écran et porter un texte utilisable.
    for (const s of TOUR_STEPS) {
      expect(s.screen, s.id).toBeTruthy();
      expect(s.title.trim(), s.id).not.toBe('');
      expect(s.body.trim().endsWith('.'), s.id).toBe(true);
    }
    // Les identifiants sont uniques : un guide ne repasse pas au même endroit.
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });

  it('finit par une étape sans cible', () => {
    // La dernière ne vise rien : elle s'affiche même si tout le reste manque.
    const derniere = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(derniere.target).toBeNull();
    // Toutes les autres visent quelque chose.
    expect(TOUR_STEPS.slice(0, -1).every((s) => s.target !== null)).toBe(true);
  });

  it('place la bulle en dessous quand il y a la place', () => {
    const p = placePop(rect(100, 60), 200, 800);
    expect(p.placement).toBe('below');
    expect(p.top).toBe(100 + 60 + 14);
  });

  it('la place au-dessus quand le bas est trop court', () => {
    // Cible en bas d'écran : une bulle en dessous déborderait.
    const p = placePop(rect(700, 60), 200, 800);
    expect(p.placement).toBe('above');
    expect(p.top).toBe(700 - 14 - 200);
  });

  it('centre quand ni le haut ni le bas ne suffisent', () => {
    // Une cible qui occupe presque tout l'écran : mieux vaut centrer que
    // laisser la bulle sortir de la fenêtre.
    const p = placePop(rect(30, 700), 300, 800);
    expect(p.placement).toBe('center');
    expect(p.top).toBeGreaterThanOrEqual(16);
    expect(p.top + 300).toBeLessThanOrEqual(800);
  });

  it('centre aussi une étape sans cible', () => {
    expect(placePop(null, 200, 800)).toEqual({ placement: 'center', top: 300 });
  });

  it('agrandit la zone éclairée sans sortir de la fenêtre', () => {
    expect(haloRect(rect(100, 60, 50, 200), 400, 800)).toEqual({
      top: 100 - HALO, left: 50 - HALO, width: 200 + HALO * 2, height: 60 + HALO * 2,
    });
    // Cible collée au bord : le halo est rogné, jamais négatif.
    const bord = haloRect(rect(0, 60, 0, 400), 400, 800);
    expect(bord.top).toBe(0);
    expect(bord.left).toBe(0);
    expect(bord.width).toBeLessThanOrEqual(400);
  });
});
