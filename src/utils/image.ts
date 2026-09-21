/**
 * Préparation des logos déposés par l'utilisateur.
 *
 * Contrainte principale : tout l'état de l'application tient dans
 * `localStorage`, dont le quota tourne autour de 5 Mo. Quelques PNG bruts
 * suffiraient à le saturer — et l'écriture échouerait alors en silence, avec
 * pour conséquence la perte du profil entier. Les images matricielles sont
 * donc redimensionnées, et toute image trop lourde est refusée explicitement.
 */

/** Côté maximal d'un logo matriciel. La pastille la plus grande fait 36 px. */
export const MAX_LOGO_PX = 128;

/** Poids maximal du data URI conservé, en octets. */
export const MAX_LOGO_BYTES = 60 * 1024;

export const ACCEPTED_LOGO_TYPES = [
  'image/svg+xml', 'image/png', 'image/webp', 'image/jpeg', 'image/gif',
];

export interface PreparedLogo {
  dataUrl: string;
  bytes: number;
}

export class LogoError extends Error {}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new LogoError('Fichier illisible.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new LogoError('Fichier illisible.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new LogoError('Image illisible ou format non reconnu.'));
    img.src = src;
  });
}

/** Redimensionne en conservant le rapport, sur fond transparent. */
async function downscale(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const side = Math.max(img.naturalWidth, img.naturalHeight);
  if (side <= MAX_LOGO_PX) return dataUrl;

  const ratio = MAX_LOGO_PX / side;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new LogoError('Redimensionnement impossible dans ce navigateur.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Taille utile d'un data URI, en octets. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return dataUrl.includes(';base64,')
    ? Math.round((payload.length * 3) / 4)
    : new TextEncoder().encode(payload).length;
}

/**
 * Transforme un fichier déposé en data URI prêt à stocker.
 *
 * Les SVG sont conservés tels quels : ils sont rendus dans une balise `img`,
 * où les navigateurs n'exécutent ni script ni ressource externe. Ne jamais les
 * injecter en SVG inline sans assainissement préalable.
 */
export async function prepareLogo(file: File): Promise<PreparedLogo> {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    throw new LogoError('Format non pris en charge. Utilise SVG, PNG, WebP ou JPEG.');
  }

  let dataUrl: string;
  if (file.type === 'image/svg+xml') {
    const text = await readAsText(file);
    if (!text.includes('<svg')) throw new LogoError('Ce fichier ne contient pas de SVG.');
    dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  } else {
    dataUrl = await downscale(await readAsDataUrl(file));
  }

  const bytes = dataUrlBytes(dataUrl);
  if (bytes > MAX_LOGO_BYTES) {
    throw new LogoError(
      `Logo trop lourd (${Math.round(bytes / 1024)} Ko) — maximum ${Math.round(MAX_LOGO_BYTES / 1024)} Ko. Essaie un SVG ou une image plus simple.`,
    );
  }
  return { dataUrl, bytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0).replace('.', ',')} Ko`;
}
