import { chromium } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

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
await page.screenshot({ path: `${out}/e2e-recap.png`, fullPage: true });
await page.getByRole('button', { name: 'Générer ma semaine' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/e2e-dashboard.png`, fullPage: true });

console.log('→ remplacement de repas');
await page.locator('.tabbar button', { hasText: 'Nutrition' }).click();
await page.waitForTimeout(400);
const before = await page.locator('.card.card-accent .display').first().innerText();
await page.locator('button[aria-label="Remplacer ce repas"]').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/e2e-remplacer-repas.png`, fullPage: true });
await page.locator('.sheet .option').first().click();
await page.waitForTimeout(700);
const after = await page.locator('.card.card-accent .display').first().innerText();
console.log('   kcal du jour:', before.trim(), '→', after.trim());

console.log('→ liste de courses');
await page.getByRole('button', { name: /Courses/ }).first().click();
await page.waitForTimeout(600);
const total1 = await page.locator('.display').first().innerText();
await page.screenshot({ path: `${out}/e2e-courses.png`, fullPage: true });
await page.getByRole('button', { name: /Optimiser mon panier/ }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/e2e-optimiser.png`, fullPage: true });
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
await page.screenshot({ path: `${out}/e2e-reste.png`, fullPage: true });
console.log('   courses restantes:', (await page.locator('.sheet .card .metric').first().innerText()).trim());
await page.locator('.sheet-head button').last().click();

await page.waitForTimeout(400);
await page.locator('.list-row button.option-mark').first().click();
await page.waitForTimeout(500);
console.log('   chariot:', (await page.locator('.card.card-flat', { hasText: 'Déjà dans le chariot' }).innerText()).replace(/\n/g, ' '));

console.log('→ remplacement d\'exercice');
await page.locator('.tabbar button', { hasText: 'Training' }).click();
await page.waitForTimeout(500);
const ex1 = await page.locator('.card .strong').nth(2).innerText();
await page.locator('button[aria-label="Remplacer"]').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/e2e-remplacer-exo.png`, fullPage: true });
const opts = await page.locator('.sheet .option').count();
if (opts > 0) {
  await page.locator('.sheet .option').first().click();
  await page.waitForTimeout(600);
  console.log('   exercice:', ex1.trim(), '→', (await page.locator('.card .strong').nth(2).innerText()).trim());
} else { console.log('   aucune alternative disponible'); }

await page.getByRole('button', { name: /Saisir/ }).first().click();
await page.waitForTimeout(500);
await page.locator('.sheet input[type=number]').first().fill('12');
await page.getByRole('button', { name: /^Enregistrer$/ }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/e2e-training.png`, fullPage: true });

console.log('→ mode clair');
await page.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Mode clair' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/e2e-profil-clair.png`, fullPage: true });

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
console.log('   après rechargement:', (await page.locator('.screen-head h1').innerText()).trim());

console.log('ERREURS JS:', errors.length ? errors.join(' | ') : 'aucune');
await browser.close();
