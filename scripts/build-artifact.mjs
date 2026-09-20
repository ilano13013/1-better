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
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);

const css = files.find((f) => f.endsWith('.css'));
const js = files.find((f) => f.endsWith('.js'));
if (!css || !js) throw new Error('Build introuvable : lance `npm run build` d\'abord.');

const style = readFileSync(join(assets, css), 'utf8');
const script = readFileSync(join(assets, js), 'utf8');

// Un `</script>` dans une chaîne du bundle fermerait la balise par erreur.
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

const out = join(dist, '1-better.html');
writeFileSync(out, html, 'utf8');
console.log(`${out} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko`);
