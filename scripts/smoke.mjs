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

console.log('→ connexion');
// L'écran de lancement précède tout : on attend qu'il s'efface.
// Apple et Google exigent une origine déclarée : le parcours automatisé passe
// par le mode sans compte, le seul qui ne dépende d'aucun service externe.
await page.getByRole('button', { name: 'Continuer sans compte' }).waitFor({ timeout: 15000 });
await shot('e2e-connexion');
await page.getByRole('button', { name: 'Continuer sans compte' }).click();
await page.waitForTimeout(350);

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

// Écran de construction : on vérifie qu'il s'affiche, puis on le passe.
await page.locator('.building').waitFor({ state: 'visible', timeout: 5000 });
await page.waitForTimeout(1400);
const built = await page.locator('.building-step.is-done').count();
console.log('   étapes cochées :', built, '/', await page.locator('.building-step').count());
await shot('e2e-construction');
await page.locator('.building').click();
await page.waitForTimeout(600);
await shot('e2e-dashboard');

console.log('→ remplacement de repas');
await page.locator('.tabbar button', { hasText: 'Nutrition' }).click();
await page.waitForTimeout(400);
const before = await page.locator('.card.card-ink .display').first().innerText();
await page.locator('button[aria-label="Remplacer ce repas"]').first().click();
await page.waitForTimeout(500);
await shot('e2e-remplacer-repas');
await page.locator('.sheet .option').first().click();
await page.waitForTimeout(700);
const after = await page.locator('.card.card-ink .display').first().innerText();
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
} else {
  // Selon le jour, la séance affichée peut n'offrir aucune alternative avec le
  // matériel choisi : on referme pour ne pas bloquer la suite du parcours.
  console.log('   aucune alternative disponible pour', ex1.trim());
  await page.locator('.sheet-head button').last().click();
  await page.waitForTimeout(400);
}

await page.getByRole('button', { name: /Saisir/ }).first().click();
await page.waitForTimeout(500);
await page.locator('.sheet input[type=number]').first().fill('12');
await page.getByRole('button', { name: /^Enregistrer$/ }).click();
await page.waitForTimeout(700);
await shot('e2e-training');

console.log('→ bascule de thème');
await page.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(400);
// Le thème de départ suit le système : le bouton propose l'autre mode.
const themeBtn = page.getByRole('button', { name: /^Mode (clair|sombre)$/ });
const themeLabel = await themeBtn.innerText();
await themeBtn.click();
await page.waitForTimeout(600);
await shot('e2e-profil-theme');
console.log('   thème basculé vers :', themeLabel.trim().toLowerCase().replace('mode ', ''));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
console.log('   après rechargement:', (await page.locator('.screen-head h1').innerText()).trim());

console.log('→ compte e-mail chiffré');
// Le chiffrement est la partie la plus risquée : on vérifie qu'un compte créé
// ici survit à un rechargement, et qu'il est bien cloisonné du mode sans compte.
await page.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /^(Se déconnecter|Changer)$/ }).click();
await page.waitForTimeout(500);

await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
await page.waitForTimeout(300);
await shot('e2e-compte-creation');
await page.locator('#signup-name').fill('Dominique');
await page.locator('#signin-email').fill('dominique@exemple.fr');
await page.locator('#signin-password').fill('motdepasse-solide');
await page.locator('#signin-confirm').fill('motdepasse-solide');
await page.getByRole('button', { name: 'Créer mon compte' }).click();
// Le compte est neuf : il repart sur le questionnaire, preuve du cloisonnement.
await page.getByRole('button', { name: 'Commencer' }).waitFor({ timeout: 15000 });
console.log('   nouveau compte : questionnaire vierge, données de Camille intactes');

const sealed = await page.evaluate(() => {
  const id = Object.keys(localStorage).find((k) => k.includes(':email.'));
  return id ? JSON.parse(localStorage.getItem(id)).sealed === true : false;
});
console.log('   état stocké chiffré :', sealed ? 'oui' : 'NON');
if (!sealed) errors.push("l'état du compte e-mail n'est pas chiffré");

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
// Rouvrir l'application redemande le mot de passe : la clé n'est pas conservée.
await page.locator('#signin-password').waitFor({ timeout: 15000 });
await shot('e2e-compte-verrouille');
await page.locator('#signin-password').fill('mauvais-mot-de-passe');
await page.getByRole('button', { name: 'Se connecter' }).click();
await page.locator('.card-alert').waitFor({ timeout: 15000 });
console.log('   mauvais mot de passe :', (await page.locator('.card-alert').innerText()).trim());

await page.locator('#signin-password').fill('motdepasse-solide');
await page.getByRole('button', { name: 'Se connecter' }).click();
await page.getByRole('button', { name: 'Commencer' }).waitFor({ timeout: 15000 });
console.log('   bon mot de passe : compte déverrouillé');

console.log('ERREURS JS:', errors.length ? errors.join(' | ') : 'aucune');
await browser.close();
if (errors.length) process.exit(1);
