import { useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { GymMark, StoreMark } from './BrandMark';
import { GYMS } from '../data/gyms';
import { STORES } from '../data/stores';
import {
  ACCEPTED_LOGO_TYPES, LogoError, MAX_LOGO_BYTES, MAX_LOGO_PX,
  dataUrlBytes, formatBytes, prepareLogo,
} from '../utils/image';
import { Card } from './ui';
import { IconInfo, IconTrash } from './icons';

/**
 * Dépôt des logos officiels par l'utilisateur.
 *
 * L'application n'embarque aucun logo : ce sont des marques déposées, et leur
 * redistribution est encadrée. En revanche, rien n'empêche l'utilisateur
 * d'utiliser les fichiers auxquels il a droit sur SON appareil. Les images
 * restent en stockage local et ne quittent jamais le navigateur.
 */
export function LogoUploader() {
  const { state } = useApp();

  const used = Object.values(state.brandLogos).reduce((s, v) => s + dataUrlBytes(v), 0);
  const count = Object.keys(state.brandLogos).length;

  return (
    <div className="stack">
      <Card className="card-flat">
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="dim" style={{ flex: 'none', marginTop: 1 }}><IconInfo size={14} /></span>
          <div className="xs muted">
            Dépose tes fichiers : SVG de préférence, sinon PNG ou WebP transparent.
            Les images sont réduites à {MAX_LOGO_PX} px et plafonnées à{' '}
            {Math.round(MAX_LOGO_BYTES / 1024)} Ko — au-delà, le stockage local
            saturerait et ton profil cesserait d'être enregistré.
            <strong> Les logos restent sur cet appareil</strong> et ne sont pas
            publiés avec l'application.
          </div>
        </div>
      </Card>

      {count > 0 && (
        <div className="row-between sm">
          <span className="dim">{count} logo{count > 1 ? 's' : ''} déposé{count > 1 ? 's' : ''}</span>
          <span className="num strong">{formatBytes(used)}</span>
        </div>
      )}

      <div>
        <div className="card-title">Supermarchés</div>
        <div className="stack-sm">
          {STORES.filter((s) => s.id !== 'autre').map((store) => (
            <LogoRow
              key={store.id}
              brandId={store.id}
              name={store.name}
              mark={<StoreMark store={store} size={44} />}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="card-title">Salles de sport</div>
        <div className="stack-sm">
          {GYMS.filter((g) => !g.custom).map((gym) => (
            <LogoRow
              key={gym.id}
              brandId={gym.id}
              name={gym.name}
              mark={<GymMark gym={gym} size={44} />}
            />
          ))}
        </div>
      </div>

      <p className="xs dim" style={{ lineHeight: 1.5 }}>
        Vérifie tes droits d'usage : chaque enseigne encadre l'emploi de son logo
        dans une charte de marque. Pour intégrer les fichiers au projet plutôt
        qu'à cet appareil, voir <code>src/assets/logos/README.md</code>.
      </p>
    </div>
  );
}

function LogoRow({
  brandId, name, mark,
}: { brandId: string; name: string; mark: React.ReactNode }) {
  const { state, dispatch, notify } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = state.brandLogos[brandId];

  const accept = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    try {
      const { dataUrl, bytes } = await prepareLogo(file);
      dispatch({ type: 'setBrandLogo', brandId, dataUrl });
      notify(`Logo ${name} ajouté — ${formatBytes(bytes)}`);
    } catch (e) {
      setError(e instanceof LogoError ? e.message : 'Import impossible.');
    }
  };

  return (
    <div>
      <div
        className="option"
        style={{
          borderStyle: over ? 'dashed' : 'solid',
          borderColor: over ? 'var(--ink)' : undefined,
          cursor: 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void accept(e.dataTransfer.files?.[0]);
        }}
      >
        {mark}
        <span className="grow">
          <span className="strong" style={{ display: 'block' }}>{name}</span>
          <span className="xs dim" style={{ display: 'block', marginTop: 2 }}>
            {current
              ? `Logo déposé · ${formatBytes(dataUrlBytes(current))}`
              : 'Glisse un fichier ici, ou touche pour choisir'}
          </span>
        </span>
        {current && (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Retirer le logo ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'setBrandLogo', brandId, dataUrl: null });
              notify(`Logo ${name} retiré`);
            }}
          >
            <IconTrash size={13} />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_LOGO_TYPES.join(',')}
        hidden
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {error && <div className="xs alert" style={{ marginTop: 6, marginLeft: 16 }}>{error}</div>}
    </div>
  );
}
