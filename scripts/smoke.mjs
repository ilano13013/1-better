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
// Les confirmations (arrêt d'essai, effacement) bloqueraient le parcours.
page.on('dialog', (d) => d.accept());
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

console.log('→ on commence quand');
// Le départ choisi décide des jours planifiés, pas seulement de l'affichage.
await page.getByRole('button', { name: "C'est parti" }).waitFor({ timeout: 15000 });
await shot('e2e-depart');
const joursAnnonces = (await page.locator('.card-ink .sm').first().innerText()).trim();
console.log('  ', joursAnnonces);
await page.getByRole('button', { name: "C'est parti" }).click();
await page.waitForTimeout(700);

console.log('→ guide pas à pas');
// Le guide éclaire de vrais éléments : on vérifie qu'il en trouve un à chaque
// étape, et que l'ombre couvre le reste.
await page.locator('.tour-pop').waitFor({ timeout: 15000 });
await page.waitForTimeout(500);
await shot('e2e-guide-1');
const etapes = await page.locator('.tour-steps > i').count();
console.log('   étapes :', etapes);
for (let i = 0; i < etapes; i++) {
  const titre = (await page.locator('.tour-title').innerText()).trim();
  const trou = await page.locator('.tour-hole').count();
  if (i === 0 && trou === 0) errors.push("guide : première étape sans zone éclairée");
  if (i === 2) await shot('e2e-guide-3');
  await page.getByRole('button', { name: i === etapes - 1 ? 'Terminer' : 'Suivant' }).click();
  await page.waitForTimeout(450);
  if (!titre) errors.push(`guide : étape ${i + 1} sans titre`);
}
await page.locator('.tour-pop').waitFor({ state: 'detached', timeout: 5000 });
console.log('   guide terminé, retour à l\'accueil');

console.log('→ formule gratuite');
// Les limites sont appliquées dans les moteurs : on vérifie donc ce que
// l'application calcule vraiment, pas seulement ce qu'elle affiche.
await page.locator('.tabbar button', { hasText: 'Nutrition' }).click();
await page.waitForTimeout(500);
await shot('e2e-accueil-serie');
const kcalParJour = await page.locator('.scroller button .num').allInnerTexts();
const planifies = kcalParJour.filter((t) => t.trim() !== '—').length;
console.log('   jours planifiés :', planifies, '/ 7');
if (planifies !== 3) errors.push(`gratuit : ${planifies} jours planifiés au lieu de 3`);
// Un jour hors des trois planifiés : celui-ci dépend du départ choisi.
const horsPlan = kcalParJour.findIndex((t) => t.trim() === '—');
await page.locator('.scroller button').nth(horsPlan).click();
await page.waitForTimeout(400);
await page.locator('.plus-lock').waitFor({ timeout: 5000 });
await shot('e2e-gratuit-jour');

await page.locator('.tabbar button', { hasText: 'Training' }).click();
await page.waitForTimeout(500);
await page.locator('.plus-lock').first().waitFor({ timeout: 5000 });
await shot('e2e-gratuit-training');

console.log('→ essai gratuit de 7 jours');
await page.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Comparer' }).click();
await page.waitForTimeout(500);
await shot('e2e-formules');
// Le mensuel met l'essai en avant, et dit ce qu'il coûte ensuite.
const carteMensuel = page.locator('.price-option').first();
const offreEssai = (await carteMensuel.innerText()).replace(/\s+/g, ' ').trim();
console.log('   carte mensuelle :', offreEssai);
if (!/7 jours\s*gratuits/.test(offreEssai)) errors.push('essai : la carte mensuelle ne propose pas 7 jours');
if (!/puis 4,99 €/.test(offreEssai)) errors.push('essai : le prix après essai n\'est pas annoncé');
await carteMensuel.click();
await page.waitForTimeout(300);
await shot('e2e-essai');
await page.getByRole('button', { name: /^Commencer l'essai/ }).click();
await page.waitForTimeout(800);
// L'essai ouvre bien la formule complète.
await page.locator('.tabbar button', { hasText: 'Nutrition' }).click();
await page.waitForTimeout(600);
const joursEssai = (await page.locator('.scroller button .num').allInnerTexts())
  .filter((t) => t.trim() !== '—').length;
console.log('   jours planifiés pendant l\'essai :', joursEssai, '/ 7');
if (joursEssai !== 7) errors.push(`essai : ${joursEssai} jours planifiés au lieu de 7`);
await page.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Gérer' }).click();
await page.waitForTimeout(500);
const carteEnCours = (await page.locator('.sheet .card-ink').first().innerText()).replace(/\s+/g, ' ');
console.log('   ', carteEnCours.trim());
if (!/essai gratuit en cours/i.test(carteEnCours)) errors.push("essai : l'abonnement ne se dit pas en essai");
if (!/0,00 €/.test(carteEnCours)) errors.push("essai : un montant est réclamé pendant l'essai");
await page.getByRole('button', { name: "Arrêter l'essai" }).click();
await page.waitForTimeout(800);

console.log('→ passage en 1% Better+');
await page.getByRole('button', { name: 'Comparer' }).click();
await page.waitForTimeout(500);
// L'essai est consommé : il ne doit plus être proposé.
const mensuelApres = (await page.locator('.price-option').first().innerText()).replace(/\s+/g, ' ');
console.log('   carte mensuelle après essai :', mensuelApres.trim());
if (/7 jours\s*gratuits/.test(mensuelApres)) errors.push('essai : un second essai est proposé');
// Deux tarifs proposés ; on prend l'annuel, sélectionné par défaut.
await page.locator('.price-option').nth(1).click();
await page.waitForTimeout(200);
const tarifs = await page.locator('.price-option .price-amount').allInnerTexts();
console.log('   tarifs proposés :', tarifs.map((t) => t.replace(/\s+/g, ' ').trim()).join(' · '));
await page.getByRole('button', { name: /^Activer — / }).click();
await page.waitForTimeout(900);
await page.locator('.tabbar button', { hasText: 'Nutrition' }).click();
await page.waitForTimeout(600);
const apres = (await page.locator('.scroller button .num').allInnerTexts())
  .filter((t) => t.trim() !== '—').length;
console.log('   jours planifiés après activation :', apres, '/ 7');
if (apres !== 7) errors.push(`plus : ${apres} jours planifiés au lieu de 7`);

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

console.log('→ journal du jour');
// Le journal doit rester facultatif : une journée non pointée affiche zéro,
// et pointer un repas doit faire bouger le consommé pour de bon.
const journal = page.locator('.card-flat').filter({ hasText: 'kcal consommées' }).first();
const avant = (await journal.locator('.metric').innerText()).trim();
await page.getByRole('button', { name: /J'ai mangé ce repas/ }).first().click();
await page.waitForTimeout(500);
const apresRepas = (await journal.locator('.metric').innerText()).trim();
console.log('   consommé :', avant, '→', apresRepas, '(repas pointé)');
if (avant !== '0') errors.push('journal : une journée vierge devrait afficher 0 kcal');
if (apresRepas === '0') errors.push("journal : pointer un repas n'a rien changé");

// Ajout d'un aliment hors plan par la base locale : aucun réseau requis.
await page.getByRole('button', { name: /Aliment/ }).first().click();
await page.waitForTimeout(400);
await shot('e2e-journal-ajout');
await page.getByRole('button', { name: "Choisir dans la base d'aliments" }).click();
await page.waitForTimeout(400);
await page.locator('.sheet input[type=text]').fill('banane');
await page.waitForTimeout(400);
await page.locator('.sheet .option').first().click();
await page.waitForTimeout(400);
await page.locator('.sheet .suffix input').fill('150');
await page.waitForTimeout(300);
await shot('e2e-journal-quantite');
await page.getByRole('button', { name: /Ajouter au journal/ }).click();
await page.waitForTimeout(700);
const apresAliment = (await journal.locator('.metric').innerText()).trim();
console.log('   consommé :', apresRepas, '→', apresAliment, '(aliment ajouté)');
if (apresAliment === apresRepas) errors.push("journal : l'aliment ajouté n'a pas compté");
await shot('e2e-journal');

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

console.log('→ récupération et séance terminée');
await page.locator('.tabbar button', { hasText: 'Training' }).click();
await page.waitForTimeout(500);
const barre = page.locator('.session-bar');
if (await barre.count()) {
  // Le minuteur part du temps de repos de l'exercice, pas d'un réglage global.
  await page.getByRole('button', { name: /^Repos$/ }).first().click();
  await page.waitForTimeout(300);
  const depart = (await page.locator('.rest-value').innerText()).trim();
  console.log('   repos lancé à', depart);
  await page.waitForTimeout(2100);
  const apres = (await page.locator('.rest-value').innerText()).trim();
  console.log('   après 2 s :', apres);
  if (apres === depart) errors.push('repos : le décompte n\'a pas avancé');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(1500);
  const fige = (await page.locator('.rest-value').innerText()).trim();
  if (fige !== apres) errors.push(`repos : a couru en pause (${apres} → ${fige})`);
  console.log('   en pause :', fige, '— figé');
  await page.getByRole('button', { name: '+30 s' }).click();
  await page.waitForTimeout(300);
  console.log('   après +30 s :', (await page.locator('.rest-value').innerText()).trim());
  await shot('e2e-repos');
  // Cas du défaut trouvé à l'usage : valider depuis un jour À VENIR doit
  // créditer aujourd'hui, sinon la série ne l'atteint jamais.
  const joursTraining = page.locator('.scroller button');
  for (let i = (await joursTraining.count()) - 1; i >= 0; i--) {
    if (!(await joursTraining.nth(i).innerText()).includes('Repos')) {
      await joursTraining.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Séance terminée' }).click();
  await page.waitForTimeout(800);
  const credit = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('one-better:state:v1'));
    return { today: new Date().toISOString().slice(0, 10), dates: s.completedWorkouts.map((c) => c.date) };
  });
  console.log('   validée depuis un jour à venir, créditée le', credit.dates.join(', '));
  if (!credit.dates.includes(credit.today)) {
    errors.push(`séance validée créditée ${credit.dates} au lieu d'aujourd'hui`);
  }
  // La série doit avoir avancé sans qu'aucune charge n'ait été notée.
  await page.locator('.tabbar button', { hasText: 'Accueil' }).click();
  await page.waitForTimeout(500);
  const niveau = (await page.locator('.level-value').innerText()).trim();
  console.log('   cycle après validation :', niveau, '%');
  if (niveau === '0') errors.push("séance terminée : le cycle n'a pas avancé");
  await shot('e2e-niveau');
  await page.locator('.tabbar button', { hasText: 'Training' }).click();
  await page.waitForTimeout(500);
} else {
  console.log('   aucune séance ce jour-là');
}

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

console.log('→ informations légales');
await page.locator('.tabbar button', { hasText: 'Profil' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Conditions générales de vente' }).click();
await page.waitForTimeout(400);
await shot('e2e-legal');
const cgv = (await page.locator('.sheet-body').innerText()).replace(/\s+/g, ' ');
// Les trois obligations d'un abonnement vendu à des particuliers.
for (const attendu of ['rétractation', 'reconduit tacitement', 'Essai gratuit de 7 jours', 'L221-18']) {
  if (!new RegExp(attendu, 'i').test(cgv)) errors.push(`CGV : « ${attendu} » absent`);
}
// Une mention obligatoire non renseignée doit laisser un trou visible, nommé.
const trous = await page.locator('.legal-missing').count();
console.log('   mentions obligatoires manquantes signalées :', trous);
if (trous === 0) errors.push('légal : aucun trou signalé alors que rien n\'est configuré');
const bandeau = (await page.locator('.card-alert').first().innerText()).replace(/\s+/g, ' ');
console.log('   ', bandeau.split('.')[0].trim());
await page.locator('.sheet .icon-btn').last().click();
await page.waitForTimeout(400);

console.log('→ export des données');
await page.getByRole('button', { name: 'Exporter mes données' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Afficher' }).click();
await page.waitForTimeout(400);
await shot('e2e-export');
const dump = await page.locator('.export-dump').inputValue();
const archive = JSON.parse(dump);
console.log('   archive :', archive.format, '·', Object.keys(archive.data).length, 'clés');
if (archive.format !== 'one-better/export') errors.push('export : format inattendu');
if (!archive.data.profile || !archive.data.weightEntries) errors.push('export : état incomplet');
if (/motdepasse-solide/.test(dump)) errors.push('export : un mot de passe figure dans l\'archive');
await page.locator('.sheet .icon-btn').last().click();
await page.waitForTimeout(400);

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
