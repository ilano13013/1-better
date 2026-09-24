import { useMemo, useState } from 'react';
import { APP_VERSION } from '../config/legal';
import { copyText, saveTextFile } from '../engine/download';
import {
  ABOUT, archiveFilename, archiveJson, archiveSizeKb, buildArchive,
} from '../engine/portability';
import { providerLabel } from '../engine/auth';
import { useApp } from '../store/AppContext';
import { Sheet } from './ui';

/**
 * Export des données — droit d'accès et droit à la portabilité.
 *
 * Deux voies volontairement offertes, et ce n'est pas une ceinture-bretelles :
 * le téléchargement est le chemin normal, mais certains aperçus intégrés
 * interdisent à une page de remettre un fichier. Un droit qui dépend du
 * navigateur n'est pas un droit, alors le contenu reste affiché et copiable.
 *
 * L'archive est construite à l'ouverture, pas au clic : on annonce sa taille
 * avant de la produire, parce qu'une photo de recette importée peut peser
 * plusieurs mégaoctets et qu'on ne colle pas cela dans un message.
 */
export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, session, notify } = useApp();
  const [shown, setShown] = useState(false);

  const json = useMemo(() => {
    if (!open) return '';
    return archiveJson(buildArchive(state, {
      version: APP_VERSION,
      account: session
        ? {
            provider: session.provider,
            label: session.email || session.name || providerLabel(session.provider),
          }
        : null,
    }));
  }, [open, state, session]);

  const sizeKb = json ? archiveSizeKb(json) : 0;
  const filename = archiveFilename();

  const download = () => {
    if (saveTextFile(filename, 'application/json', json)) {
      notify('Données exportées');
      return;
    }
    // Échec silencieux impossible : on bascule sur ce qui marche partout.
    setShown(true);
    notify("Téléchargement refusé par le navigateur — contenu affiché");
  };

  const copy = async () => {
    notify(await copyText(json)
      ? 'Données copiées'
      : 'Copie refusée — sélectionne le texte à la main');
  };

  return (
    <Sheet open={open} onClose={onClose} title={<div className="strong">Exporter mes données</div>}>
      <div className="stack">
        <div className="card card-flat">
          <div className="card-title" style={{ margin: 0 }}>{filename}</div>
          <div className="sm dim" style={{ marginTop: 4 }}>
            Format JSON · environ {sizeKb} Ko
          </div>
        </div>

        <ul className="bullets sm">
          {ABOUT.map((line) => <li key={line}>{line}</li>)}
        </ul>

        <button type="button" className="btn btn-primary btn-block" onClick={download}>
          Télécharger le fichier
        </button>
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-ghost grow" onClick={copy}>
            Copier
          </button>
          <button type="button" className="btn btn-ghost grow" onClick={() => setShown((v) => !v)}>
            {shown ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {shown && (
          <textarea
            className="export-dump"
            readOnly
            value={json}
            aria-label="Contenu de l'export"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}

        <p className="xs dim">
          Ce fichier contient des informations de santé. Il n'est ni chiffré ni
          protégé par mot de passe : conserve-le comme tu conserverais un compte
          rendu médical.
        </p>
      </div>
    </Sheet>
  );
}
