import { useEffect, useState } from 'react';
import { APP_VERSION, PUBLISHER } from '../config/legal';
import {
  LEGAL_UPDATED, blockingMentions, envKeyFor, legalDocuments, missingMentions,
  publishReady, type Block, type LegalDoc, type LegalDocId,
} from '../engine/legal';
import { Sheet, day } from './ui';

/**
 * Informations légales.
 *
 * Six documents dans une seule feuille, parce qu'ils se lisent rarement seuls :
 * on arrive sur les conditions de vente et on veut vérifier qui vend.
 *
 * Le choix qui compte est celui de l'honnêteté par défaut. Là où une mention
 * obligatoire n'est pas renseignée, l'écran n'écrit ni un nom plausible, ni un
 * discret « à compléter » : il affiche un bloc qui nomme la mention manquante,
 * le texte de loi qui l'impose et la variable à renseigner. Un document
 * juridique incomplet doit se voir.
 */

function MissingBlock({ block }: { block: Extract<Block, { kind: 'missing' }> }) {
  const { mention } = block;
  return (
    <div className={`legal-missing${mention.required ? '' : ' is-optional'}`}>
      <div className="strong sm">
        {mention.label}
        <span className="legal-missing-tag">
          {mention.required ? 'obligatoire' : 'recommandé'}
        </span>
      </div>
      <p className="xs dim">{mention.why}</p>
      <p className="xs dim">
        {mention.law} — à renseigner via <code>{envKeyFor(mention.field)}</code>.
      </p>
    </div>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'p') return <p key={i} className="sm legal-p">{block.text}</p>;
        if (block.kind === 'list') {
          return (
            <ul key={i} className="bullets sm">
              {block.items.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          );
        }
        return <MissingBlock key={i} block={block} />;
      })}
    </>
  );
}

function Document({ doc }: { doc: LegalDoc }) {
  return (
    <article className="stack">
      <div>
        <h2 className="legal-title">{doc.title}</h2>
        <p className="sm dim">{doc.summary}</p>
      </div>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h3 className="card-title" style={{ margin: '0 0 6px' }}>{section.heading}</h3>
          <Blocks blocks={section.blocks} />
        </section>
      ))}
    </article>
  );
}

/**
 * État de publication.
 *
 * Affiché en tête tant qu'une mention obligatoire manque. Ce bandeau ne
 * s'adresse pas à l'utilisateur mais à qui publie l'application : il énumère
 * ce qui reste à fournir avant une mise en ligne payante.
 */
export function PublishState() {
  const blocking = blockingMentions(PUBLISHER);
  const optional = missingMentions(PUBLISHER).filter((m) => !m.required);
  if (publishReady(PUBLISHER)) {
    return (
      <div className="card card-flat">
        <div className="card-title" style={{ margin: 0 }}>Mentions obligatoires complètes</div>
        <p className="sm muted" style={{ marginTop: 6 }}>
          L'identité de l'éditeur, celle de l'hébergeur et le médiateur de la
          consommation sont renseignés.
          {optional.length > 0
            && ` Reste ${optional.length} mention${optional.length > 1 ? 's' : ''} recommandée${optional.length > 1 ? 's' : ''}.`}
        </p>
      </div>
    );
  }
  return (
    <div className="card card-alert">
      <div className="card-title" style={{ margin: 0 }}>
        Pas encore publiable — {blocking.length} mention{blocking.length > 1 ? 's' : ''} obligatoire{blocking.length > 1 ? 's' : ''} manquante{blocking.length > 1 ? 's' : ''}
      </div>
      <p className="sm notice" style={{ marginTop: 6 }}>
        Ces mentions désignent une personne réelle. L'application ne les invente
        pas : elle laisse le trou visible, à sa place, dans chaque document
        concerné.
      </p>
      <ul className="bullets sm" style={{ marginTop: 8 }}>
        {blocking.map((m) => (
          <li key={m.field}>
            {m.label} — <code>{envKeyFor(m.field)}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Feuille des informations légales, ouverte sur le document demandé. */
export function LegalSheet({
  open, docId, onClose,
}: { open: boolean; docId: LegalDocId | null; onClose: () => void }) {
  const docs = legalDocuments(PUBLISHER);
  const [current, setCurrent] = useState<LegalDocId>(docId ?? 'mentions');

  // Ouvrir la feuille sur un document précis — depuis l'écran des formules, par
  // exemple — doit y amener, y compris si elle a déjà servi.
  useEffect(() => { if (open && docId) setCurrent(docId); }, [open, docId]);

  const doc = docs.find((d) => d.id === current) ?? docs[0];

  return (
    <Sheet open={open} onClose={onClose} title={<div className="strong">Informations légales</div>}>
      <div className="stack">
        <div className="legal-tabs" role="tablist" aria-label="Documents">
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              className="chip"
              aria-selected={d.id === current}
              onClick={() => setCurrent(d.id)}
            >
              {d.title}
            </button>
          ))}
        </div>

        <PublishState />

        <Document doc={doc} />

        <div className="divider" />
        <p className="xs dim">
          Version {APP_VERSION} · documents révisés le {day(LEGAL_UPDATED)}.
        </p>
        <p className="xs dim">
          Ces textes décrivent exactement le fonctionnement de l'application.
          Ils restent un modèle : une relecture par un professionnel du droit
          est nécessaire avant une mise en ligne payante.
        </p>
      </div>
    </Sheet>
  );
}
