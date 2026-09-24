/**
 * Remettre un fichier à la personne qui le demande.
 *
 * Le chemin normal est celui du web : un `Blob`, une URL objet, un lien qu'on
 * déclenche. Il fonctionne partout où l'application est réellement publiée.
 *
 * Il échoue en revanche dans certains aperçus intégrés, qui n'autorisent pas
 * une page à déclencher un téléchargement. Le cas est traité, parce qu'un
 * bouton d'export qui ne fait rien serait pire qu'un bouton absent :
 * l'appelant reçoit `false` et propose alors le contenu à copier. Aucune
 * exception n'est laissée remonter — l'échec est une réponse, pas un plantage.
 */
export function saveTextFile(filename: string, mime: string, text: string): boolean {
  try {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Libéré au tour suivant : révoquer tout de suite annule le téléchargement
    // sur plusieurs navigateurs.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/** Copie dans le presse-papiers. Le repli couvre les contextes non sécurisés. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* on tente le repli */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
