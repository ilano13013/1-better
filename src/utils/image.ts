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

/** Une photo de recette s'affiche en pleine largeur : il lui faut plus de pixels. */
export const MAX_PHOTO_PX = 560;

/** Encodée en JPEG, une photo de 560 px pèse typiquement 30 à 70 Ko. */
export const MAX_PHOTO_BYTES = 110 * 1024;

/**
 * Enveloppe totale accordée aux images dans le stockage local. Le quota des
 * navigateurs avoisine 5 Mo pour l'ensemble de l'origine : au-delà de cette
 * limite, l'enregistrement du profil échouerait sans prévenir.
 */
export const MAX_IMAGES_BYTES = 2.6 * 1024 * 1024;

export interface ImageLimits {
  maxPx: number;
  maxBytes: number;
  /** JPEG pour les photos, PNG pour les logos (transparence conservée). */
  encode: 'image/jpeg' | 'image/png';
  quality?: number;
}

export const LOGO_LIMITS: ImageLimits = {
  maxPx: MAX_LOGO_PX, maxBytes: MAX_LOGO_BYTES, encode: 'image/png',
};

export const PHOTO_LIMITS: ImageLimits = {
  maxPx: MAX_PHOTO_PX, maxBytes: MAX_PHOTO_BYTES, encode: 'image/jpeg', quality: 0.74,
};

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

/**
 * Redimensionne en conservant le rapport. Les photos sont réencodées en JPEG
 * même si elles tiennent déjà : c'est ce qui fait la différence entre 40 Ko et
 * plusieurs mégaoctets pour une prise de vue de téléphone.
 */
async function downscale(dataUrl: string, limits: ImageLimits): Promise<string> {
  const img = await loadImage(dataUrl);
  const side = Math.max(img.naturalWidth, img.naturalHeight);
  const ratio = side > limits.maxPx ? limits.maxPx / side : 1;
  if (ratio === 1 && limits.encode === 'image/png') return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new LogoError('Redimensionnement impossible dans ce navigateur.');
  if (limits.encode === 'image/jpeg') {
    // Un JPEG n'a pas de transparence : on pose un fond clair explicite.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(limits.encode, limits.quality);
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
export async function prepareImage(file: File, limits: ImageLimits): Promise<PreparedLogo> {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    throw new LogoError('Format non pris en charge. Utilise JPEG, PNG, WebP ou SVG.');
  }

  let dataUrl: string;
  if (file.type === 'image/svg+xml') {
    const text = await readAsText(file);
    if (!text.includes('<svg')) throw new LogoError('Ce fichier ne contient pas de SVG.');
    dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  } else {
    dataUrl = await downscale(await readAsDataUrl(file), limits);
  }

  const bytes = dataUrlBytes(dataUrl);
  if (bytes > limits.maxBytes) {
    throw new LogoError(
      `Image trop lourde (${Math.round(bytes / 1024)} Ko) — maximum ${Math.round(limits.maxBytes / 1024)} Ko.`,
    );
  }
  return { dataUrl, bytes };
}

export function prepareLogo(file: File): Promise<PreparedLogo> {
  return prepareImage(file, LOGO_LIMITS);
}

export function preparePhoto(file: File): Promise<PreparedLogo> {
  return prepareImage(file, PHOTO_LIMITS);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0).replace('.', ',')} Ko`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
