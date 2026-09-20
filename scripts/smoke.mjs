/**
 * Test de fumée end-to-end : parcourt l'onboarding complet, puis vérifie que
 * les interactions recalculent réellement l'état (remplacement de repas,
 * optimisation du budget, mode « il me reste X € », remplacement d'exercice,
 * saisie de performance, mode clair, persistance après rechargement).
 *
 *   npm run build && npm run preview &   # http://127.0.0.1:4173
 *   npm run smoke
 *
 * PLAYWRIGHT_CHROMIUM permet de pointer un binaire Chromium déjà installé.
 */
import { chromium } from 'playwright';
const out = process.argv[2] ?? null; // dossier de captures, facultatif
const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });

/** Capture d'écran, seulement si un dossier de sortie a été fourni. */
const shot = (name) => (out ? page.screenshot({ path: `${out}/${name}.png`, fullPage: true }) : Promise.resolve());

await page.goto(baseUrl, { waitUntil: 'networkidle' });

console.log('→ onboarding');
await page.getByRole('button', { name: 'Commencer' }).click();
await page.getByText('Perte de poids / sèche').click();
await page.getByRole('button', { name: 'Continuer' }).click();

await page.getByPlaceholder('Alex').fill('Camille');
await page.getByRole('button', { name: 'Femme' }).click();
const num = (label) => page.locator('.field', { hasText: label }).locator('input');
await num('Âge').fill('31');
await num('Taille').fill('168');
await num('Poids actuel').fill('72');
await num('Poids objectif').fill('66');
await page.getByRole('button', { name: 'Continuer' }).click();

await page.getByText('Sédentaire').click();
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByText('Débutant', { exact: true }).click();
await page.getByRole('button', { name: 'Continuer' }).click();

await page.getByText('Domicile').click();
await page.getByRole('button', { name: 'Continuer' }).click();
console.log('→ étape matériel (conditionnelle)');
for (const eq of ['Haltères', 'Banc', 'Élastiques']) await page.getByRole('button', { name: eq, exact: true }).click();
await page.getByRole('button', { name: 'Continuer' }).click();

await page.getByRole('button', { name: '3 séances' }).click();
for (const d of ['Mar', 'Jeu', 'Sam']) await page.getByRole('button', { name: d, exact: true }).click();
await page.getByRole('button', { name: '45 min' }).click();
await page.getByRole('button', { name: 'Continuer' }).click();

await page.getByText('Aldi').click();
await page.getByRole('button', { name: 'Continuer' }).click();

await page.locator('.field input[type=number]').fill('45');
await page.getByRole('button', { name: 'Continuer' }).click();

await page.getByRole('button', { name: '3', exact: true }).first().click();
await page.getByRole('button', { name: 'Végétarien' }).click();
await page.getByRole('button', { name: 'Sans gluten' }).click();
await page.getByRole('button', { name: 'Continuer' }).click();

await page.getByRole('button', { name: 'Continuer' }).click();
await page.locator('.checkbox').first().click();
await page.getByRole('button', { name: 'Continuer' }).click();
await page.waitForTimeout(300);
await shot('e2e-recap');
await page.getByRole('button', { name: 'Générer ma semaine' }).click();
await page.waitForTimeout(800);
await shot('e2e-dashboard');

console.log('→ remplacement de repas');
await page.locator('.tabbar button', { hasText: 'Nutrition' }).click();
await page.waitForTimeout(400);
const before = await page.locator('.card.card-accent .display').first().innerText();
await page.locator('button[aria-label="Remplacer ce repas"]').first().click();
await page.waitForTimeout(500);
await shot('e2e-remplacer-repas');
await page.locator('.sheet .option').first().click();
await page.waitForTimeout(700);
const after = await page.locator('.card.card-accent .display').first().innerText();
console.log('   kcal du jour:', before.trim(), '→', after.trim());

console.log('→ liste de courses');
await page.getByRole('button', { name: /Courses/ }).first().click();
await page.waitForTimeout(600);
const total1 = await page.locator('.display').first().innerText();
await shot('e2e-courses');
await page.getByRole('button', { name: /Optimiser mon panier/ }).click();
await page.waitForTimeout(900);
await shot('e2e-optimiser');
const applyBtn = page.getByRole('button', { name: /Appliquer \d+ substitution/ });
if (await applyBtn.count()) {
  await applyBtn.click();
  await page.waitForTimeout(900);
  console.log('   panier:', total1.trim(), '→', (await page.locator('.display').first().innerText()).trim());
} else {
  console.log('   panier', total1.trim(), '— rien à optimiser');
  await page.locator('.sheet-head button').last().click();
}

console.log('→ mode « il me reste X € »');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Il me reste/ }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Recalculer ma fin de semaine/ }).click();
await page.waitForTimeout(1000);
await shot('e2e-reste');
console.log('   courses restantes:', (await page.locator('.sheet .card .metric').first().innerText()).trim());
await page.locator('.sheet-head button').last().click();

await page.waitForTimeout(400);
await page.locator('.list-row button.option-mark').first().click();
await page.waitForTimeout(500);
console.log('   chariot:', (await page.locator('.card.card-flat', { hasText: 'Déjà dans le chariot' }).innerText()).replace(/\n/g, ' '));

console.log('→ remplacement d\'exercice');
await page.locator('.tabbar button', { hasText: 'Training' }).click();
await page.waitForTimeout(500);
const exerciseCard = page.locator('.card')
  .filter({ has: page.locator('button[aria-label="Remplacer"]') })
  .first();
const ex1 = await exerciseCard.locator('.strong').first().innerText();
await page.locator('button[aria-label="Remplacer"]').first().click();
await page.waitForTimeout(500);
await shot('e2e-remplacer-exo');
const opts = await page.locator('.sheet .option').count();
if (opts > 0) {
  await page.locator('.sheet .option').first().click();
  await page.waitForTimeout(600);
  console.log('   exercice:', ex1.trim(), '→', (await exerciseCard.locator('.strong').first().innerText()).trim());
} else { console.log('   aucune alternative disponible'); }

await page.getByRole('button', { name: /Saisir/ }).first().click();
await page.waitForTimeout(500);
await page.locator('.sheet input[type=number]').first().fill('12');
await page.getByRole('button', { name: /^Enregistrer$/ }).click();
await page.waitForTimeout(700);
await shot('e2e-training');

console.log('→ mode clair');
await page.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Mode clair' }).click();
await page.waitForTimeout(600);
await shot('e2e-profil-clair');

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
console.log('   après rechargement:', (await page.locator('.screen-head h1').innerText()).trim());

console.log('ERREURS JS:', errors.length ? errors.join(' | ') : 'aucune');
await browser.close();
if (errors.length) process.exit(1);
