/**
 * Assemble le build Vite en UN SEUL fichier HTML autonome.
 *
 *   npm run build && npm run bundle
 *   → dist/1-better.html
 *
 * Le fichier n'a ni <html> ni <head> : il s'ouvre directement dans un
 * navigateur (double-clic) et se publie tel quel comme page autonome.
 * Aucune ressource externe n'est chargée — police système, CSS et JS inclus.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);

const css = files.find((f) => f.endsWith('.css'));
const js = files.find((f) => f.endsWith('.js'));
if (!css || !js) throw new Error('Build introuvable : lance `npm run build` d\'abord.');

let style = readFileSync(join(assets, css), 'utf8');
let script = readFileSync(join(assets, js), 'utf8');

/**
 * Les images livrées avec l'application sont émises comme fichiers séparés par
 * Vite dès qu'elles dépassent la limite d'incorporation. Le fichier unique
 * n'ayant rien à côté de lui, elles sont converties en data URI.
 *
 * Vite écrit ces références de deux façons :
 *   - dans le JS : `new URL("nom-hash.svg", import.meta.url).href`, résolu
 *     relativement au module — donc faux une fois tout replié dans la page ;
 *   - dans le CSS : `url(./assets/nom-hash.svg)`.
 * Les deux formes sont traitées, puis une vérification finale échoue si une
 * référence subsiste : mieux vaut un build cassé qu'une image manquante en
 * silence.
 */
const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assetFiles = files.filter((f) => MIME[extname(f).toLowerCase()]);
let inlined = 0;
let inlinedBytes = 0;

for (const file of assetFiles) {
  const path = join(assets, file);
  if (!existsSync(path)) continue;
  const buffer = readFileSync(path);
  const dataUrl = `data:${MIME[extname(file).toLowerCase()]};base64,${buffer.toString('base64')}`;
  const name = escapeRegex(file);

  // Forme JS : new URL("nom", import.meta.url).href
  const urlExpr = new RegExp(
    `new URL\\(\\s*(["'\`])${name}\\1\\s*,\\s*import\\.meta\\.url\\s*\\)\\.href`,
    'g',
  );
  script = script.replace(urlExpr, JSON.stringify(dataUrl));

  // Forme chemin, dans le JS comme dans le CSS.
  for (const ref of [`./assets/${file}`, `../assets/${file}`, `assets/${file}`]) {
    script = script.split(ref).join(dataUrl);
    style = style.split(ref).join(dataUrl);
  }

  inlined++;
  inlinedBytes += buffer.length;
}

const safeScript = script.replaceAll('</script', '<\\/script');

const html = `<title>1·Better</title>
<meta name="theme-color" content="#0a0c0f" />
<style>
${style}
</style>
<div id="root"></div>
<script type="module">
${safeScript}
</script>
`;

// Garde-fou : aucune image ne doit rester référencée par son nom de fichier.
const orphans = assetFiles.filter((file) => html.includes(file));
if (orphans.length > 0) {
  throw new Error(
    `Références d'images non incorporées dans le fichier unique : ${orphans.join(', ')}.\n` +
    "Le fichier serait publié avec des images manquantes.",
  );
}

const out = join(dist, '1-better.html');
writeFileSync(out, html, 'utf8');
const images = inlined > 0
  ? ` (dont ${inlined} image${inlined > 1 ? 's' : ''}, ${(inlinedBytes / 1024).toFixed(0)} Ko)`
  : '';
console.log(`${out} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko${images}`);
