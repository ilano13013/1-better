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

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 80 tests des moteurs métier
npm run build      # build de production
```

Au premier lancement, « Essayer avec le profil de démonstration » charge un profil
complet (homme, 26 ans, 175 cm, 63 kg, prise de masse vers 66 kg, 4 séances par
semaine, Basic-Fit, Lidl, 60 €/semaine) avec garde-manger, pesées et performances.

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

---

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
├── components/     Système de design (cartes, feuilles, anneaux, barres…)
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
plusieurs fois avec un poids du coût croissant, et le premier qui tient dans
l'enveloppe est retenu. Un budget confortable donne un plan varié et riche ; un
budget serré donne un plan plus répétitif et plus économe — comme dans la vraie
vie.

---

## Honnêteté des données

- **Les prix embarqués sont des prix de démonstration.** Ils sont générés à partir
  d'un prix de référence et d'un indice d'enseigne, ne proviennent d'aucune source
  actualisée, et sont donc exposés avec le statut **« estimé »**. Le statut
  « vérifié » existe dans le modèle mais n'est attribué à aucun prix embarqué : il
  est réservé à une source réelle branchée dans l'application.
- **Un prix peut être inconnu.** L'utilisateur saisit alors le sien ; il est
  présenté comme une estimation de sa part, jamais comme vérifié.
- **Aucune API Drive n'est inventée.** `engine/drive.ts` définit uniquement le
  contrat qu'un connecteur devra respecter et le pipeline de préparation de panier.
  Aucun achat ne peut être déclenché automatiquement.
- **Les calculs nutritionnels sont des estimations** issues de formules de
  référence. L'application le rappelle à l'écran : elles ne remplacent pas l'avis
  d'un professionnel de santé ou de nutrition.
- **Halal et casher** excluent le porc, l'alcool (et les crustacés pour le casher,
  ainsi que le mélange viande/laitage dans un même plat). Les volailles et viandes
  rouges restent proposées mais sont signalées « à certifier » : l'application ne
  peut pas garantir la certification d'un produit en rayon.
- **Toutes les données restent sur l'appareil** (`localStorage`). Rien n'est
  transmis à un service externe.

---

## Contenu des bases

| Base | Volume |
| --- | --- |
| Aliments | 82, avec macros, étiquettes de régime et substituts |
| Exercices | 64, avec muscles, matériel, niveau, séries/répétitions, alternatives |
| Recettes | 37, couvrant classique, végétarien, vegan, sans gluten, sans lactose, halal, casher |
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
contrat d'intégration Drive ✅. Le scan de code-barres et les prix réellement
actualisés nécessitent une source de données externe et restent à brancher.

---

## Tests

```bash
npm test
```

80 tests couvrent les règles métier : formules nutritionnelles et garde-fous,
choix du split et contrainte de matériel, respect des régimes et des restrictions,
déduction du garde-manger, conversion en formats d'achat, cohérence des
substitutions, mode « il me reste X € », double progression, moyenne glissante du
poids, règles de check-in, et la cascade de recalcul du planificateur.
