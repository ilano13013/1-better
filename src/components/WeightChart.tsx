import { useCallback, useEffect, useRef, useState } from 'react';
import {
  kgLabel, linePath, nearestPoint, shortDate, toPoints, weightDomain, yFor,
  type Point,
} from '../engine/chart';
import { movingAverage, sortedEntries } from '../engine/weight';
import type { WeightEntry } from '../types';

/**
 * Courbe de poids.
 *
 * Deux séries, distinguées sans couleur — comme le reste de l'application :
 * la **moyenne glissante** est un trait plein, les **pesées** sont des points.
 * Ce n'est pas qu'une question de style : relier les pesées donnerait à du
 * bruit l'allure d'un signal, alors que seule la moyenne sert aux décisions.
 *
 * Le dessin se fait en pixels réels, mesurés sur le conteneur. Un `viewBox`
 * étiré déformait les proportions : les points devenaient des ellipses et la
 * pente affichée n'était plus la pente réelle.
 */

const HEIGHT = 132;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PAD_RIGHT = 46;      // place pour l'étiquette du dernier point
const INSET = 5;           // pour que les points des bords ne soient pas rognés
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

export function WeightChart({ entries, target }: { entries: WeightEntry[]; target?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<Point | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(120, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = sortedEntries(entries);
  const avg = movingAverage(entries);

  const onMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(nearestPointFrom(e.clientX - rect.left));
  }, []);

  if (sorted.length < 2) {
    return (
      <p className="sm dim" style={{ marginTop: 14 }}>
        Enregistre au moins deux pesées pour voir la courbe.
      </p>
    );
  }

  const plotW = Math.max(40, width - PAD_RIGHT - INSET * 2);
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;

  const domain = weightDomain(
    [...sorted.map((e) => e.weightKg), ...avg.map((a) => a.value)],
    target,
  );
  const raw = toPoints(
    sorted.map((e) => ({ date: e.date, value: e.weightKg })),
    domain, plotW, PLOT_H, first, last,
  );
  const trend = toPoints(avg, domain, plotW, PLOT_H, first, last);
  const lastTrend = trend[trend.length - 1];
  const targetY = target === undefined ? null : yFor(target, domain, PLOT_H);

  function nearestPointFrom(x: number): Point | null {
    return nearestPoint(trend, x);
  }

  const shown = hover ?? lastTrend;

  return (
    <div ref={box} style={{ marginTop: 14 }}>
      <svg
        width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img" aria-label={`Poids de ${kgLabel(sorted[0].weightKg)} à ${kgLabel(sorted[sorted.length - 1].weightKg)} kilogrammes`}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <g transform={`translate(${INSET} ${PAD_TOP})`}>
          {/* Grille : deux filets pleins, un cran au-dessus du fond. */}
          {[0, PLOT_H].map((y) => (
            <line key={y} x1={0} y1={y} x2={plotW} y2={y}
              stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
          ))}

          {/* Objectif : une référence, pas une série. */}
          {targetY !== null && (
            <>
              <line x1={0} y1={targetY} x2={plotW} y2={targetY}
                stroke="var(--signal-line-strong)" strokeWidth={1} />
              <text x={plotW + 7} y={targetY + 3.5} className="chart-tag chart-tag-goal">
                {kgLabel(target!)}
              </text>
            </>
          )}

          {/* Repère de survol, sous les marques. */}
          {hover && (
            <line x1={hover.x} y1={-4} x2={hover.x} y2={PLOT_H + 4}
              stroke="var(--line-strong)" strokeWidth={1} />
          )}

          {/* Moyenne glissante : la seule courbe, parce que la seule lisible. */}
          <path d={linePath(trend)} fill="none" stroke="var(--ink)" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Pesées : des points, jamais reliés. */}
          {raw.map((p) => (
            <circle key={p.date} cx={p.x} cy={p.y} r={3}
              fill="var(--ground)" stroke="var(--ink-3)" strokeWidth={1.5} />
          ))}

          {/* Point courant : anneau de la couleur du fond, pour rester lisible. */}
          <circle cx={shown.x} cy={shown.y} r={4.5}
            fill="var(--ink)" stroke="var(--ground)" strokeWidth={2} />

          <text x={Math.min(shown.x + 9, plotW + 7)} y={shown.y + 15}
            className="chart-tag">
            {kgLabel(shown.value)}
          </text>

          {/* Axe des dates : deux bornes suffisent à situer la période. */}
          <text x={0} y={PLOT_H + 15} className="chart-axis">{shortDate(first)}</text>
          <text x={plotW} y={PLOT_H + 15} className="chart-axis" textAnchor="end">
            {shortDate(last)}
          </text>
        </g>
      </svg>

      <div className="row-between xs" style={{ marginTop: 4 }}>
        <span className="row" style={{ gap: 14 }}>
          <span className="row dim" style={{ gap: 6 }}>
            <span className="key-line" aria-hidden="true" />moyenne
          </span>
          <span className="row dim" style={{ gap: 6 }}>
            <span className="key-dot" aria-hidden="true" />pesées
          </span>
        </span>
        <span className="dim num">
          {hover ? shortDate(hover.date) : `${kgLabel(domain.min)}–${kgLabel(domain.max)} kg`}
        </span>
      </div>
    </div>
  );
}
