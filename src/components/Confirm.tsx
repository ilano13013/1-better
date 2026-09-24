import type { ReactNode } from 'react';
import { Sheet } from './ui';

/**
 * Confirmation d'une action sans retour.
 *
 * POURQUOI PAS `window.confirm`.
 *
 * L'application s'ouvre aussi dans un cadre restreint — un `iframe` en mode
 * bac à sable, comme en utilise n'importe quelle visionneuse intégrée. Là,
 * `confirm()` n'affiche rien et **renvoie `false`** :
 *
 *   Ignored call to 'confirm()'. The document is sandboxed,
 *   and the 'allow-modals' keyword is not set.
 *
 * Le motif `if (!window.confirm(…)) return;` avale alors l'action en silence.
 * C'est ainsi que « Revenir à la formule gratuite » ne faisait rien : le
 * bouton était juste, la garde le neutralisait. Pour une résiliation, ce n'est
 * pas un détail d'affichage — la loi veut qu'elle soit aussi simple que la
 * souscription, et un bouton muet ne l'est pas.
 *
 * La confirmation est donc rendue par l'application elle-même. Elle ne dépend
 * plus des permissions du cadre, elle porte la mise en garde dans le style du
 * reste, et elle nomme l'action dans son bouton : « Résilier », jamais « OK ».
 */
export function Confirm({
  open, title, children, confirmLabel, cancelLabel = 'Annuler',
  destructive = false, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Le bouton dit ce qu'il fait — pas « OK ». */
  confirmLabel: string;
  cancelLabel?: string;
  /** Action sans retour : le bouton prend l'allure d'alerte. */
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={<div className="strong">{title}</div>}>
      <div className="stack">
        <div className={destructive ? 'card card-alert' : 'card card-flat'}>
          <p className={destructive ? 'sm notice' : 'sm muted'}>{children}</p>
        </div>
        <button
          type="button"
          className={`btn btn-block ${destructive ? 'btn-alert' : 'btn-primary'}`}
          onClick={() => { onConfirm(); onClose(); }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Sheet>
  );
}
