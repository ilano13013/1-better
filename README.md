# 1·Better

> **Ton objectif, ta salle, ton supermarché et ton budget : toute ta semaine est planifiée.**

Application web mobile-first de fitness et nutrition personnalisée. L'utilisateur
renseigne son objectif, ses informations corporelles, sa salle, ses disponibilités,
son supermarché, son budget et ses contraintes alimentaires ; l'application
construit **ses calories, ses macros, son programme, son planning, ses repas, ses
recettes, ses quantités, sa liste de courses, une estimation de prix et des
substitutions quand le budget est dépassé.**

Le fonctionnement repose **exclusivement sur des algorithmes, des règles métier et
des bases de données structurées**. Aucune fonctionnalité d'intelligence
artificielle n'est utilisée : à profil identique, le plan produit est identique.

---

## Démarrer

### Essayer sans rien installer

```bash
npm install && npm run build && npm run bundle
# → dist/1-better.html : un fichier unique, à ouvrir par double-clic.
```

Le fichier est entièrement autonome : CSS et JavaScript inclus, aucune requête
réseau, aucune police externe. Il fonctionne hors ligne et se déploie tel quel
sur n'importe quel hébergeur statique.

### Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 92 tests des moteurs métier
npm run build      # build de production

npm run bundle     # assemble dist/1-better.html, fichier unique autonome

# test de fumée end-to-end (nécessite `npm run preview` en parallèle)
npm run smoke
```

`npm run smoke` parcourt l'onboarding complet puis vérifie que chaque
interaction recalcule réellement l'état : remplacement de repas, optimisation du
budget, mode « il me reste X € », remplacement d'exercice, saisie de
performance, bascule de thème et persistance après rechargement.

### Par où commencer

Au premier lancement, « Essayer avec le profil de démonstration » charge un profil
complet (homme, 26 ans, 175 cm, 63 kg, prise de masse vers 66 kg, 4 séances par
semaine, Basic-Fit, Lidl, 60 €/semaine) avec garde-manger, pesées et performances.

Pour vérifier que le moteur travaille vraiment, essaie dans cet ordre :

1. **Profil → Budget**, descends à 35 € : les repas et la liste de courses
   changent immédiatement, et l'écran Nutrition explique ce qu'il n'arrive plus
   à tenir.
2. **Profil → Salle → Domicile**, ne coche que « Haltères » : le programme
   remplace tous les exercices devenus impossibles.
3. **Nutrition → ⇄ sur un repas** : chaque alternative affiche ce qu'elle
   ajoute *réellement* au panier, conditionnements compris — souvent 0 €.
4. **Courses → Optimiser mon panier** quand le budget est dépassé.
5. **Nutrition → J'ai déjà ça chez moi** : coche du riz, la ligne disparaît des
   courses.

Les données restent dans le navigateur : « Profil → Tout effacer » remet à zéro.

---

## Ce qui est réellement fonctionnel

Rien n'est une maquette statique. Toutes les interactions recalculent l'état :

| Action | Conséquence |
| --- | --- |
| Changer le budget | Les repas de la semaine et la liste de courses sont régénérés |
| Changer de magasin | Les produits, formats d'achat et prix changent |
| Changer de salle | Les exercices devenus impossibles sont remplacés |
| Changer d'objectif | Calories, macros, repas **et** programme sont recalculés |
| Remplacer un repas | Les macros du jour et la liste de courses suivent |
| Remplacer un exercice | Le moteur ne propose que des exercices faisables |
| Cocher « j'ai déjà ça » | La quantité est déduite avant tout achat |
| Panier au-dessus du budget | Substitutions cohérentes proposées, jamais imposées |
| Changer de compte | La semaine, les performances et les images du compte chargé remplacent les précédentes |
| Créer un compte e-mail | Les données du compte sont chiffrées avec une clé dérivée du mot de passe |

---

## Où vivent les images

Une distinction qui compte :

- **`src/assets/logos/` et `src/assets/recipes/`** font partie du build. Ces
  images suivent sur tous les appareils, pour tous les visiteurs, et sont
  servies par GitHub Pages. C'est là qu'il faut les mettre.
- Le **stockage local du navigateur** ne vaut que pour un appareil et un
  domaine donnés. Des images déposées sur `claude.ai` n'apparaissent pas sur
  `github.io` : `localStorage` est cloisonné par origine. L'import depuis
  l'interface a d'ailleurs été retiré ; ce chemin ne subsiste qu'en repli.

Le fichier unique (`npm run bundle`) incorpore les images du dépôt en data URI
et vérifie, avant d'écrire, qu'aucune référence n'est restée pendante — un
build qui échoue vaut mieux qu'une image manquante en silence.

## L'écran de construction

À la sortie du questionnaire, un écran montre la semaine se construire :
profil, besoins énergétiques, programme, repas, liste de courses. Chaque étape
cochée vaut 0,2 %, pour un total de 1 % — la promesse du nom, la progression
par petits incréments répétés.

Le moteur est déterministe et s'exécute en quelques dizaines de millisecondes :
ce rythme est **délibéré, pas une attente technique**. Il sert à rendre visible
l'enchaînement qui fait la valeur de l'application, et chaque étape affiche les
**chiffres réellement calculés** — « 2 680 kcal · 139 g de protéines »,
« 18 produits · 59,96 € chez Lidl » — plutôt qu'un sablier. Un toucher passe
l'écran, et une préférence système de mouvement réduit le saute.

## Identité visuelle

### La marque

`src/assets/brand/logo.webp` est la marque officielle : elle n'est ni
redessinée, ni recolorée, ni découpée. Elle sert de logo dans l'application,
d'icône d'onglet et d'icône d'écran d'accueil — l'import Vite fournit son URL,
donc le fichier unique la porte aussi, en URL de données.

Son fond est noir. En thème sombre, un filet d'un pixel lui rend son contour,
sans rien changer à l'image. Son vert est la seule couleur de la marque, et il
ne se propage pas à l'interface : le reste reste achromatique.

### L'écran de lancement

L'application s'ouvre sur la marque : apparition en 500 ms, barre qui se
remplit, effacement. Environ 1,4 seconde en tout — un écran de lancement qui se
fait attendre est une taxe, pas une identité. Un appui le passe, et
`prefers-reduced-motion` le réduit à une apparition sans mouvement.

### Le reste

L'interface est **achromatique**. L'emphase ne vient pas d'une couleur d'accent
mais du contraste et de la typographie : un chiffre large et serré porte plus
qu'une pastille colorée, et l'action principale est un bloc inversé — encre sur
papier, papier sur encre.

Une seule couleur de signal, une terre de Sienne désaturée, est réservée aux
dépassements. Elle ne marque jamais un état positif : un budget tenu se lit en
encre normale, pas en vert.

Les trois séries de macronutriments se distinguent par le **poids d'une même
encre** puis par une trame diagonale pour la troisième. Aucune couleur n'est
nécessaire, et les barres restent lisibles en niveaux de gris comme pour un
daltonien.

La seule couleur vive de l'application provient des **marques** d'enseignes et
de salles, ce qui rend les listes de choix immédiatement lisibles.

Les neutres portent un léger biais froid plutôt qu'un gris pur : un gris neutre
absolu se lit comme un défaut, pas comme un choix.

### Photos des recettes

Aucune photo n'est livrée avec l'application, pour trois raisons cumulées : les
images externes sont bloquées dans certains conteneurs d'exécution, le fichier
autonome doit rester utilisable hors ligne, et la redistribution de photos
tierces est encadrée.

L'application **affiche** les photos présentes dans `state.recipePhotos` : sur
la fiche recette, les cartes de repas, la vue Semaine et le prochain repas de
l'accueil. Une recette sans photo affiche une vignette neutre — une initiale,
jamais une illustration.

Pour livrer des photos avec l'application, dépose les fichiers dans
`src/assets/recipes/`, **nommés avec l'identifiant de la recette**
(`poulet_curry_riz.jpg`). Ils sont détectés automatiquement au build : aucun
code à modifier. Le README de ce dossier liste les 44 identifiants.

### Logos

Aucun logo n'est embarqué : ce sont des marques déposées, et les redessiner de
mémoire produirait des visuels faux présentés comme authentiques.
`<BrandMark>` affiche donc un **monogramme** sur la couleur de la marque, et
bascule sur le fichier officiel dès qu'il est fourni. Deux voies :

- **Glisser-déposer sur une ligne d'enseigne**, dès l'onboarding, ou l'écran
  complet « Ajouter les logos » pour les appareils sans glisser-déposer. Les images
  sont réduites à 128 px et plafonnées à 60 Ko, faute de quoi le stockage local
  saturerait et le profil cesserait d'être enregistré. Les fichiers ne quittent
  pas le navigateur et ne sont pas publiés avec l'application.
- **`src/assets/logos/`** : pour livrer les fichiers avec le projet, si les
  droits de redistribution le permettent. Voir le README de ce dossier.

## Architecture

```
src/
├── types/          Modèle de données complet (User, Profile, Goal, Gym, Exercise,
│                   WorkoutPlan, Food, Product, Store, Recipe, MealPlan,
│                   ShoppingList, Budget, WeightEntry, WeeklyCheckIn…)
├── data/           Bases structurées : aliments, exercices, recettes, salles,
│                   enseignes, produits, profil de démonstration
├── engine/         Moteurs déterministes, sans dépendance à React
│   ├── nutrition   BMR (Mifflin-St Jeor), dépense, macros, répartition des repas
│   ├── training    Split, sélection d'exercices, remplacement, budget de temps
│   ├── filters     Régimes, restrictions, allergies, refus
│   ├── recipes     Macros et coût calculés depuis le catalogue, substitutions
│   ├── basket      Coût MARGINAL en conditionnements
│   ├── mealPlan    Sélection des recettes, portions, variété, budget
│   ├── shopping    Agrégation, garde-manger, formats d'achat, statuts de prix
│   ├── budget      Optimisation par substitutions cohérentes
│   ├── remaining   Mode « il me reste X € jusqu'à … »
│   ├── progression Double progression, records, stagnation
│   ├── weight      Moyenne glissante, tendance hebdomadaire
│   ├── checkin     Règles d'ajustement hebdomadaire
│   ├── drive       Contrat d'intégration Drive (architecture seule)
│   ├── gamification Compteurs et badges discrets
│   └── planner     Recalcul en cascade reliant tous les moteurs
├── store/          État global, reducer, persistance locale
├── components/     Système de design (cartes, feuilles, anneaux, barres,
│                   marques d'enseignes)
└── screens/        Onboarding, Accueil, Semaine, Training, Nutrition,
                    Courses, Profil
```

### Le moteur de planification

`buildPlan(state)` est le cœur de l'application. Il reçoit l'état et retourne
l'intégralité du plan :

```
profil + objectif + activité + budget + magasin + restrictions + garde-manger
  → calories + macros + repas + quantités + recettes + courses + coût

profil + objectif + niveau + fréquence + salle + équipements + temps disponible
  → split + séances + exercices + séries + répétitions + récupération
```

Il est purement fonctionnel : aucune source d'aléa, aucun effet de bord. Les
tests vérifient que deux appels sur le même profil produisent le même plan.

### La décision de conception la plus importante : le coût marginal

Le coût réel d'un repas n'est pas le prix de ses ingrédients au prorata : c'est le
nombre de **conditionnements supplémentaires** qu'il oblige à acheter. Ajouter du
riz à une recette quand un paquet d'un kilo est déjà au panier ne coûte rien ;
ajouter 80 g de quinoa oblige à acheter un sachet entier.

Le moteur raisonne donc en coût marginal (`engine/basket.ts`), ce qui le pousse
naturellement à réutiliser les ingrédients et à vider le garde-manger. Sur le
profil de démonstration, ce seul changement fait passer le panier de **105 € à
moins de 60 €** pour la même qualité nutritionnelle.

La parcimonie est ensuite **calibrée sur le budget** : le plan est construit
plusieurs fois avec un poids du coût croissant, puis chaque version est notée
sur une échelle commune — dépassement du budget d'un côté, déficit protéique de
l'autre. La mieux notée gagne. Un budget confortable donne un plan varié et
riche ; un budget serré donne un plan plus répétitif et plus économe — comme
dans la vraie vie.

### La réparation protéique

Choisir chaque repas isolément ne garantit pas que la somme atteigne la cible :
de petits déficits s'accumulent. Une passe de réparation vérifie donc le
**total de la journée** et remplace, tant que l'écart persiste, le repas dont
l'échange rapporte le plus de protéines par unité de dégradation (écart
calorique et coût marginal). Sur un profil en sèche à budget serré, cette passe
fait passer les protéines de 96 g à 128 g pour une cible de 136 g.

---

## Honnêteté des données

- **Les prix embarqués sont des prix de démonstration.** Ils sont générés à partir
  d'un prix de référence et d'un indice d'enseigne, ne proviennent d'aucune source
  actualisée, et sont donc exposés avec le statut **« estimé »**. Le statut
  « vérifié » existe dans le modèle mais n'est attribué à aucun prix embarqué : il
  est réservé à une source réelle branchée dans l'application.
- **Un prix peut être inconnu.** L'utilisateur saisit alors le sien ; il est
  présenté comme une estimation de sa part, jamais comme vérifié.
- **Aucune API Drive n'est inventée.** Voir la section ci-dessous.
- **Les calculs nutritionnels sont des estimations** issues de formules de
  référence. L'application le rappelle à l'écran : elles ne remplacent pas l'avis
  d'un professionnel de santé ou de nutrition.
- **Halal et casher** excluent le porc, l'alcool (et les crustacés pour le casher,
  ainsi que le mélange viande/laitage dans un même plat). Les volailles et viandes
  rouges restent proposées mais sont signalées « à certifier » : l'application ne
  peut pas garantir la certification d'un produit en rayon.
- **Toutes les données restent sur l'appareil** (`localStorage`). Rien n'est
  transmis à un service externe.
- **Aucun repas n'est supprimé en silence.** Si aucune recette ne satisfait à la
  fois le régime, les restrictions et les produits de l'enseigne, le créneau est
  signalé à l'écran avec les leviers pour le débloquer.
- **Les compromis sont affichés, pas masqués.** Quand le budget ne permet pas
  d'atteindre la cible protéique, l'application dit quel pourcentage est atteint,
  pourquoi, et quels leviers existent. Elle ne prétend jamais avoir tenu les deux
  contraintes à la fois.
- **Le coût des conditionnements longue durée est isolé.** Un pot de miel acheté
  pour 12 g par jour couvre plusieurs semaines : la liste indique la couverture
  de chaque produit et le sous-total qui ne reviendra pas la semaine suivante.

---

## Comptes

L'écran de connexion tient en deux blocs — **Inscription** (créer un compte,
Apple, Google) et **Connexion** (se connecter, mot de passe oublié) — plus
« continuer sans compte ». Aucune prose : un bouton grisé signale un
fournisseur non configuré, et cette page-ci explique pourquoi.

**Aucune voie n'est obligatoire** :

| Voie | Dépend d'un service tiers | Données chiffrées |
| --- | --- | --- |
| **E-mail et mot de passe** | non | ✅ oui |
| **Google** | oui, identifiant client requis | non |
| **Apple** | oui, compte développeur payant requis | non |
| **Sans compte** | non | non |

Le site est statique : **il n'y a pas de serveur**. Par conséquent :

| | |
| --- | --- |
| Séparer plusieurs personnes sur le même appareil | ✅ une clé de stockage par compte |
| Retrouver sa semaine après déconnexion | ✅ les données du compte restent en place |
| Chiffrer les données au repos | ✅ **compte e-mail seulement** |
| Synchroniser entre téléphone et ordinateur | ❌ rien ne quitte le navigateur |
| Réinitialiser un mot de passe oublié | ❌ personne ne détient de quoi le faire |

Une vraie synchronisation demanderait un backend (Supabase, Firebase, un
service maison) ; ce serait un autre chantier, et il n'est pas commencé.

### Compte e-mail : ce que le mot de passe protège vraiment

Un mot de passe qui ne protège rien serait un mensonge d'interface. Ici, il
sert de matière à une clé, et cette clé chiffre les données du compte :

- **PBKDF2-HMAC-SHA-256**, 310 000 itérations, sel de 16 octets propre au
  compte, puis **AES-GCM 256 bits** — via WebCrypto, sans dépendance.
- Le mot de passe n'est **jamais stocké**, pas même sous forme de condensat.
  La vérification consiste à déchiffrer un témoin : AES-GCM authentifie, donc
  une mauvaise clé échoue au lieu de produire des octets faux.
- La clé n'est pas conservée d'une visite à l'autre — ce serait contourner le
  chiffrement. Rouvrir l'application **redemande donc le mot de passe**.
- Deux comptes qui choisissent le même mot de passe n'obtiennent pas la même
  clé : le sel diffère.

Ce que cela ne protège pas : une session déjà ouverte (la clé est alors en
mémoire), et les comptes Apple, Google et local, qui n'ont pas de mot de passe
dont dériver une clé.

**Conséquence assumée, écrite sous le champ à la création :** un mot de passe
oublié ne peut pas être réinitialisé, et les données de ce compte sont alors
définitivement illisibles.

### « Mot de passe oublié ? »

Le lien existe, mais il ne mène pas à un formulaire qui n'enverrait aucun
courriel. Il mène à un écran qui dit ce qui est vrai — personne ne détient de
quoi retrouver ce mot de passe — et qui propose la seule action réelle :
supprimer le compte et repartir de zéro, après confirmation, en sachant que les
données sont perdues.

### Apple et Google

Les deux sont intégrés pour de vrai — Google Identity Services et Sign in with
Apple JS — mais ne peuvent pas fonctionner sans identifiant client déclaré chez
le fournisseur. Sans configuration, les boutons sont désactivés et l'écran
l'explique, plutôt que d'échouer au clic.

La signature du jeton d'identité **n'est pas vérifiée** : seul un serveur peut
le faire. Elle sert à identifier, pas à autoriser — ce qui suffit ici,
puisqu'il n'y a aucune ressource distante à protéger.

### Configurer Google

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   créer un **ID client OAuth 2.0**, type « Application Web ».
2. Ajouter l'origine autorisée : `https://<compte>.github.io`
   (et `http://localhost:5173` pour le développement).
3. Renseigner `VITE_GOOGLE_CLIENT_ID`.

### Configurer Apple

Sign in with Apple demande davantage : un **compte développeur Apple payant**.

1. Créer un **App ID**, puis un **Services ID** — c'est ce dernier qui sert de
   `clientId`, pas le Bundle ID.
2. Déclarer le domaine et l'URL de retour, puis vérifier le domaine en
   déposant le fichier fourni par Apple dans
   `public/.well-known/apple-developer-domain-association.txt`.
3. Renseigner `VITE_APPLE_CLIENT_ID` et `VITE_APPLE_REDIRECT_URI`.

### Où mettre les variables

Ces identifiants sont **publics** : ils apparaissent dans le code livré au
navigateur. Ce ne sont pas des secrets.

- En local : un fichier `.env.local` à la racine (déjà ignoré par git).
- Sur GitHub Pages : Settings → Secrets and variables → Actions → **Variables**
  (pas Secrets). Le workflow les passe au build.

### Limites connues

- **Dans l'artefact claude.ai, la connexion ne peut pas fonctionner** : la page
  y est servie dans une iframe d'origine non déclarée chez Apple et Google.
  Utiliser le déploiement GitHub Pages.
- Apple ne transmet le nom de la personne qu'à la **toute première**
  autorisation. Ensuite, seul l'e-mail revient.

---

## Le bouton « Préparer mon Drive »

**Aucune enseigne française ne publie d'API permettant à une application tierce
de remplir le panier d'un client.** Les seules façons de « remplir
automatiquement » seraient de détenir les identifiants de l'utilisateur et de
piloter le site de l'enseigne : cela contrevient à leurs conditions
d'utilisation, casse à la moindre évolution de leur interface, et expose le
compte de l'utilisateur. L'application ne fait rien de tel.

Ce qu'elle fait, et qui fonctionne aujourd'hui : une **préparation assistée**.

1. La liste est ordonnée par rayon, avec quantités et formats d'achat.
2. Produit par produit, l'application copie le nom dans le presse-papiers et
   ouvre le site de l'enseigne.
3. L'utilisateur ajoute le produit dans **sa propre session**, puis revient :
   l'avancement est suivi, repris là où il s'était arrêté, et le montant déjà
   au panier est affiché.
4. À la fin, l'application rappelle de vérifier le panier chez l'enseigne.
   Aucun achat n'est déclenché.

### Liens de recherche

L'application ouvre la **page d'accueil** des courses en ligne. Les gabarits de
recherche profonde ne sont pas codés en dur : les enseignes modifient leurs URL
sans préavis, et une adresse inventée enverrait l'utilisateur sur une page
d'erreur — pire que l'accueil avec le nom déjà copié.

`STORE_HANDOFFS`, dans `engine/drive.ts`, porte un champ `searchTemplate` par
enseigne. Une fois un format relevé et vérifié, le renseigner suffit : chaque
produit s'ouvre alors directement sur sa recherche. Les gabarits non https ou
sans jeton `{q}` sont ignorés au profit de la page d'accueil.

### Le jour où une enseigne ouvre un accès officiel

`DriveConnector` définit le contrat : catalogue, correspondance liste ↔
catalogue, sélection des formats, panier préparé. `registerDriveConnector()`
suffit à le brancher, et l'étape manuelle disparaît. Le contrat s'arrête
délibérément à un panier **préparé** : la validation reste à l'utilisateur.

## Contenu des bases

| Base | Volume |
| --- | --- |
| Aliments | 82, avec macros, étiquettes de régime et substituts |
| Exercices | 64, avec muscles, matériel, niveau, séries/répétitions, alternatives, exécution du mouvement et erreurs fréquentes |
| Recettes | 44 ; chaque croisement régime × restrictions dispose d'au moins deux recettes par créneau |
| Salles | 7 (Basic-Fit, Fitness Park, Keepcool, Neoness, On Air, indépendante, domicile) |
| Enseignes | 9 (Lidl, Aldi, Leclerc, Intermarché, Carrefour, Auchan, Super U, Monoprix, autre) |
| Produits | ~700 lignes enseigne × aliment, avec conditionnements réels |

---

## Priorités livrées

**Priorité 1 (MVP)** — onboarding, profil, objectif, calories et macros, salle,
disponibilités, programme sportif, supermarché, budget, recettes, menus, liste de
courses, dashboard. ✅

**Priorité 2** — suivi des performances, poids, check-in hebdomadaire,
remplacement d'exercices, remplacement de repas, optimisation du budget. ✅

**Priorité 3** — inventaire maison ✅, architecture catalogues magasins et prix ✅,
contrat d'intégration Drive ✅, préparation de panier assistée ✅. Le scan de
code-barres, les prix réellement actualisés et le remplissage automatique du
panier nécessitent respectivement une caméra, une source de prix et un accès
officiel d'enseigne : aucun des trois ne peut être simulé honnêtement.

---

## Tests

```bash
npm test
```

112 tests couvrent les règles métier : formules nutritionnelles et garde-fous,
choix du split et contrainte de matériel, respect des régimes et des restrictions,
déduction du garde-manger, conversion en formats d'achat, cohérence des
substitutions (dont la protection de la densité protéique), couverture de tous
les croisements régime × restrictions × enseigne, absence de créneau non pourvu,
mode « il me reste X € », double progression conditionnée à l'exécution, moyenne
glissante du poids, règles de check-in, exécution renseignée pour chaque
mouvement, cloisonnement des comptes, refus d'un jeton d'identité périmé ou destiné à une
autre application, chiffrement des comptes e-mail (aller-retour, refus d'une
mauvaise clé, sel distinct par compte, absence de trace du mot de passe), et la
cascade de recalcul du planificateur.

Le test de fumée `npm run smoke` va plus loin : il crée un compte e-mail, vérifie
que l'état stocké est bien chiffré, recharge la page, constate que le mot de
passe est redemandé, en essaie un mauvais puis le bon.
