import { useEffect, type ReactNode } from 'react';
import { IconCheck, IconClose } from './icons';

/* ---------------------------------------------------------------- format */

export function eur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

export function num(n: number, digits = 0): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function kg(n: number): string {
  return `${n.toFixed(1).replace('.', ',')} kg`;
}

/* ------------------------------------------------------------ primitives */

export function Card({
  children, className = '', onClick, as = 'div',
}: {
  children: ReactNode; className?: string; onClick?: () => void; as?: 'div' | 'button';
}) {
  const cls = `card ${onClick ? 'clickable' : ''} ${className}`.trim();
  if (onClick || as === 'button') {
    return (
      <button type="button" className={cls} onClick={onClick} style={{ textAlign: 'left', width: '100%' }}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function Option({
  selected, onClick, title, subtitle, right, leading, multi = false,
}: {
  selected: boolean; onClick: () => void; title: ReactNode;
  subtitle?: ReactNode; right?: ReactNode; leading?: ReactNode; multi?: boolean;
}) {
  return (
    <button type="button" className="option" aria-pressed={selected} onClick={onClick}>
      {leading}
      {!leading && (
        <span className="option-mark" style={multi ? { borderRadius: 6 } : undefined}>
          {selected && <IconCheck />}
        </span>
      )}
      <span className="grow">
        <span className="strong" style={{ display: 'block' }}>{title}</span>
        {subtitle && <span className="sm dim" style={{ display: 'block', marginTop: 2 }}>{subtitle}</span>}
      </span>
      {right}
      {leading && (
        <span className="option-mark" style={multi ? { borderRadius: 6 } : undefined}>
          {selected && <IconCheck />}
        </span>
      )}
    </button>
  );
}

export function Chip({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function Checkbox({
  checked, onChange, children,
}: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <div className="checkbox" role="checkbox" aria-checked={checked} tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(); } }}
    >
      <span className="box">{checked && <IconCheck size={12} />}</span>
      <span className="grow">{children}</span>
    </div>
  );
}

/**
 * Trois séries de données se distinguent par le poids d'une même encre puis
 * par une trame : aucune couleur n'est nécessaire, et les barres restent
 * lisibles en niveaux de gris comme pour un daltonien.
 */
export type BarTone = 'ink' | 'muted' | 'hatch' | 'notice' | 'alert';

export function Bar({
  value, max, tone = 'ink',
}: { value: number; max: number; tone?: BarTone }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`bar ${tone === 'ink' ? '' : tone}`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({
  value, max, size = 92, stroke = 8, tone = 'var(--ink)', children,
}: {
  value: number; max: number; size?: number; stroke?: number;
  tone?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg className="ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--inset)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        textAlign: 'center', lineHeight: 1.15,
      }}>
        {children}
      </div>
    </div>
  );
}

export function Stat({
  label, value, sub, tone,
}: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div>
      <div className="xs dim" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 620 }}>
        {label}
      </div>
      <div className="metric num" style={{ color: tone, marginTop: 3 }}>{value}</div>
      {sub && <div className="xs muted" style={{ marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export function Sheet({
  open, onClose, title, children, actions,
}: {
  open: boolean; onClose: () => void; title: ReactNode;
  children: ReactNode; actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        <div className="sheet-head">
          <div className="grow" style={{ minWidth: 0 }}>{title}</div>
          <div className="row">
            {actions}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
              <IconClose />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label, children, hint,
}: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="xs dim">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options, value, onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {options.map((o) => (
        <Chip key={String(o.value)} selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card card-flat center" style={{ padding: '28px 20px' }}>
      <div className="strong">{title}</div>
      {hint && <div className="sm dim" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

/** Mention légale récurrente : les valeurs restent des estimations. */
export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className="xs dim" style={{ lineHeight: 1.5 }}>
      {children ?? `Ces valeurs sont des estimations issues de formules de référence. Elles ne remplacent
      pas l'avis d'un professionnel de santé ou de nutrition.`}
    </p>
  );
}
