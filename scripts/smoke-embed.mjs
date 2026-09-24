/**
 * Test de fumée « en cadre restreint ».
 *
 * L'application ne s'ouvre pas toujours dans un onglet à elle : une visionneuse
 * intégrée la place dans un `iframe` en bac à sable. Les permissions y sont
 * réduites, et une action peut y échouer sans que rien ne le dise — c'est
 * exactement ce qui est arrivé à « Revenir à la formule gratuite », neutralisé
 * par un `window.confirm()` que le cadre ignorait en renvoyant `false`.
 *
 * Ce parcours vérifie donc les trois actions sans retour dans ces conditions :
 * résilier, arrêter un essai, effacer ses données. Il est court exprès — le
 * parcours complet reste `npm run smoke`.
 *
 *   npm run build && npm run preview &
 *   npm run smoke:embed
 */
import { rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

const errors = [];
const ignored = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  const text = m.text();
  // Le symptôme d'origine : le cadre refuse la boîte native et l'annonce ici.
  if (/Ignored call to '(confirm|alert|prompt)\(\)'/.test(text)) ignored.push(text);
});
// Aucune boîte native ne doit plus apparaître : si une surgit, elle bloquerait.
page.on('dialog', (d) => { errors.push(`boîte native : ${d.message()}`); d.dismiss(); });

/*
 * La page hôte est servie par le même serveur que l'application : une page
 * construite avec `setContent` vit sur `about:blank`, et le cadre n'est alors
 * plus atteignable depuis le pilote. Elle est déposée dans `dist`, qui est un
 * produit de build, et retirée à la fin.
 *
 * Les permissions volontairement absentes : ni `allow-modals`, ni le reste.
 */
const host = 'dist/__embed-host.html';
writeFileSync(host, `<!doctype html><html lang="fr"><body style="margin:0">
  <iframe src="./index.html" sandbox="allow-scripts allow-same-origin"
          style="width:420px;height:900px;border:0"></iframe>
</body></html>`);

try {
  await page.goto(new URL('__embed-host.html', baseUrl).href, { waitUntil: 'networkidle' });
} finally {
  rmSync(host, { force: true });
}
const app = page.frameLocator('iframe');

await app.getByRole('button', { name: 'Continuer sans compte' }).click({ timeout: 20000 });
await app.getByRole('button', { name: /profil de démonstration/ }).click();
await page.waitForTimeout(2500);
await app.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(600);

console.log('→ résiliation en cadre restreint');
await app.getByRole('button', { name: 'Gérer' }).click();
await page.waitForTimeout(500);
await app.getByRole('button', { name: 'Revenir à la formule gratuite' }).click();
await page.waitForTimeout(400);
// La confirmation est rendue par l'application : elle doit être là, et visible.
const titre = await app.locator('.sheet .strong').last().innerText().catch(() => '');
console.log('   confirmation affichée :', titre.trim() || 'AUCUNE');
if (!/Revenir à la formule gratuite/.test(titre)) errors.push('résiliation : aucune confirmation affichée');
await app.getByRole('button', { name: 'Revenir au gratuit' }).click();
await page.waitForTimeout(900);
// La carte « Formule » est celle qui porte le bouton de comparaison.
const formule = (await app.locator('.card-flat')
  .filter({ has: app.locator('button', { hasText: 'Comparer' }) })
  .first().innerText()).replace(/\s+/g, ' ');
console.log('   formule après résiliation :', formule.replace('Comparer', '').trim());
if (!/Gratuit/.test(formule)) errors.push('résiliation : la formule est restée payante');

console.log('→ les jours planifiés retombent à 3');
await app.locator('.tabbar button', { hasText: 'Nutrition' }).click();
await page.waitForTimeout(700);
const jours = (await app.locator('.scroller button .num').allInnerTexts())
  .filter((t) => t.trim() !== '—').length;
console.log('   jours planifiés :', jours, '/ 7');
if (jours !== 3) errors.push(`résiliation : ${jours} jours planifiés au lieu de 3`);

console.log('→ effacement des données en cadre restreint');
await app.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(500);
await app.getByRole('button', { name: 'Effacer toutes mes données' }).click();
await page.waitForTimeout(400);
await app.getByRole('button', { name: 'Effacer définitivement' }).click();
await page.waitForTimeout(1200);
// Effacer remet l'état à zéro sans déconnecter : on repart du questionnaire.
const revenu = await app.getByRole('button', { name: 'Commencer' }).count();
console.log('   retour au questionnaire :', revenu ? 'oui' : 'NON');
if (!revenu) errors.push("effacement : l'application n'est pas revenue au questionnaire");

console.log('BOÎTES NATIVES IGNORÉES PAR LE CADRE:', ignored.length ? ignored.join(' | ') : 'aucune');
if (ignored.length) errors.push('une boîte native est encore appelée');
console.log('ERREURS JS:', errors.length ? errors.join(' | ') : 'aucune');
await browser.close();
if (errors.length) process.exit(1);
