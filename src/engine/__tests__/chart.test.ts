import { describe, expect, it } from 'vitest';
import {
  MIN_SPAN_KG, kgLabel, linePath, nearestPoint, shortDate, toPoints, weightDomain, yFor,
} from '../chart';

describe('échelle verticale', () => {
  it('ne tasse pas une courbe presque plate', () => {
    // Trois pesées à 200 g d'écart dessinaient des montagnes russes sans
    // plancher d'amplitude.
    const d = weightDomain([70.0, 70.1, 70.2]);
    expect(d.max - d.min).toBeGreaterThanOrEqual(MIN_SPAN_KG - 0.01);
    // Et elle reste centrée sur les valeurs.
    expect((d.min + d.max) / 2).toBeCloseTo(70.1, 1);
  });

  it('laisse respirer une vraie amplitude', () => {
    const d = weightDomain([60, 70]);
    expect(d.min).toBeLessThan(60);
    expect(d.max).toBeGreaterThan(70);
  });

  it('inclut l\'objectif quand il est à portée', () => {
    const d = weightDomain([63, 64], 66);
    expect(d.max).toBeGreaterThanOrEqual(66);
  });

  it('montre un objectif à quelques kilos', () => {
    // Le cas réel : 63,4 kg pour un objectif à 66. Un seuil trop serré
    // l'écartait, et la carte annonçait un objectif que la courbe taisait.
    const d = weightDomain([62.2, 63.4], 66);
    expect(d.max).toBeGreaterThanOrEqual(66);
  });

  it('écarte un objectif de long terme', () => {
    // Au-delà de cinq kilos, l'afficher écraserait la courbe.
    const d = weightDomain([63, 64], 120);
    expect(d.max).toBeLessThan(70);
  });

  it('survit à une série vide', () => {
    expect(weightDomain([])).toEqual({ min: 0, max: MIN_SPAN_KG });
  });
});

describe('abscisse proportionnelle au temps', () => {
  const domain = { min: 60, max: 70 };

  it('espace les points selon les dates, pas leur rang', () => {
    /*
     * Le défaut corrigé : espacer par rang faisait se ressembler deux pesées à
     * un jour d'écart et deux pesées à trois semaines. La pente affichée
     * n'était pas la pente réelle.
     */
    const pts = toPoints([
      { date: '2026-09-01', value: 65 },
      { date: '2026-09-02', value: 65 },   // le lendemain
      { date: '2026-09-21', value: 65 },   // trois semaines plus tard
    ], domain, 200, 100, '2026-09-01', '2026-09-21');

    expect(pts[0].x).toBe(0);
    expect(pts[2].x).toBe(200);
    // 1 jour sur 20 : un vingtième de la largeur, pas la moitié.
    expect(pts[1].x).toBeCloseTo(10, 5);
  });

  it('centre quand tout tombe le même jour', () => {
    const pts = toPoints([
      { date: '2026-09-01', value: 65 },
      { date: '2026-09-01', value: 66 },
    ], domain, 200, 100, '2026-09-01', '2026-09-01');
    expect(pts.every((p) => p.x === 100)).toBe(true);
  });

  it('place les valeurs hautes en haut', () => {
    const pts = toPoints([
      { date: '2026-09-01', value: 60 },
      { date: '2026-09-02', value: 70 },
    ], domain, 100, 100, '2026-09-01', '2026-09-02');
    expect(pts[0].y).toBe(100);   // le minimum touche le bas
    expect(pts[1].y).toBe(0);     // le maximum touche le haut
    expect(yFor(65, domain, 100)).toBe(50);
  });
});

describe('tracé et survol', () => {
  const pts = toPoints([
    { date: '2026-09-01', value: 64 },
    { date: '2026-09-11', value: 63 },
    { date: '2026-09-21', value: 62 },
  ], { min: 60, max: 66 }, 200, 100, '2026-09-01', '2026-09-21');

  it('ne trace rien avec moins de deux points', () => {
    expect(linePath([])).toBe('');
    expect(linePath(pts.slice(0, 1))).toBe('');
    expect(linePath(pts).startsWith('M')).toBe(true);
  });

  it('désigne le point le plus proche en abscisse', () => {
    // On vise une date, pas un pixel : chercher en deux dimensions obligerait
    // à pointer le point au pixel près.
    expect(nearestPoint(pts, 0)?.date).toBe('2026-09-01');
    expect(nearestPoint(pts, 105)?.date).toBe('2026-09-11');
    expect(nearestPoint(pts, 999)?.date).toBe('2026-09-21');
    expect(nearestPoint([], 10)).toBeNull();
  });
});

describe('libellés', () => {
  it('écrit les dates et les poids à la française', () => {
    expect(shortDate('2026-09-24')).toBe('24 sept.');
    expect(shortDate('2026-01-01')).toBe('1 janv.');
    expect(kgLabel(63.4)).toBe('63,4');
    expect(kgLabel(70)).toBe('70,0');
  });
});
