/**
 * Fabrique les icônes de l'application à partir du logo.
 *
 *   node scripts/make-icons.mjs
 *   → public/icons/*.png
 *
 * Trois formats, pour trois usages qui ne se remplacent pas :
 *
 *   - `icon-192` et `icon-512` : icônes du manifeste, logo sur fond
 *     transparent, telles que les navigateurs les attendent ;
 *   - `maskable-512` : la même, réduite à 62 % et centrée sur un fond plein.
 *     Android découpe l'icône selon la forme du lanceur — cercle, goutte,
 *     carré arrondi — et ampute une icône qui remplit tout son cadre. La marge
 *     est ce que la spécification appelle la « zone de sécurité » ;
 *   - `apple-touch-icon` : 180 px sur fond plein, iOS n'acceptant pas la
 *     transparence — un logo transparent y devient noir.
 *
 * Le rendu passe par Chromium, faute de bibliothèque d'images dans le projet.
 * C'est le même moteur que celui du test de fumée, déjà installé.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SOURCE = 'src/assets/brand/logo.webp';
const OUT = 'public/icons';

/** Fond des icônes opaques : le noir de la marque, `--ground` en thème sombre. */
const BACKGROUND = '#0B0D10';

const TARGETS = [
  { name: 'icon-192.png', size: 192, scale: 1, background: null },
  { name: 'icon-512.png', size: 512, scale: 1, background: null },
  { name: 'maskable-512.png', size: 512, scale: 0.62, background: BACKGROUND },
  { name: 'apple-touch-icon.png', size: 180, scale: 0.82, background: BACKGROUND },
];

const dataUri = `data:image/webp;base64,${readFileSync(SOURCE).toString('base64')}`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);

for (const target of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="
      width:${target.size}px;height:${target.size}px;
      display:flex;align-items:center;justify-content:center;
      background:${target.background ?? 'transparent'};
    ">
      <img src="${dataUri}" style="width:${Math.round(target.size * target.scale)}px;
                                   height:auto;display:block" />
    </div>
  </body></html>`);
  await page.locator('img').waitFor();
  const shot = await page.screenshot({ omitBackground: target.background === null });
  writeFileSync(`${OUT}/${target.name}`, shot);
  console.log(`${OUT}/${target.name} — ${target.size} px, ${Math.round(shot.length / 1024)} Ko`);
  await page.close();
}

await browser.close();
