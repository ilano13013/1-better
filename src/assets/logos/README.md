# Logos des enseignes et des salles

Ce dossier est **volontairement vide**.

Les logos Basic-Fit, Fitness Park, Keepcool, Neoness, On Air, Lidl, Aldi,
Carrefour, Leclerc, Intermarché, Auchan, Super U et Monoprix sont des marques
déposées. L'application ne les embarque pas : les redessiner de mémoire
produirait des visuels approximatifs présentés comme authentiques, et les
redistribuer sans autorisation poserait un problème de droits.

En attendant, `<BrandMark>` affiche un **monogramme** sur la couleur de la
marque. Deux façons d'y mettre les vrais fichiers.

## A. Sur ton appareil, sans toucher au code

Deux entrées, l'une comme l'autre disponible dès l'onboarding :

- **Glisse un fichier directement sur une ligne** dans « Où t'entraînes-tu ? »
  ou « Où fais-tu tes courses ? ». La ligne se met en pointillés au survol.
- **Ajouter les logos** (au bas de ces écrans, ou Profil → Logos des enseignes)
  ouvre la liste complète, avec sélecteur de fichier pour les appareils sans
  glisser-déposer. Les
images sont réduites à 128 px et plafonnées à 60 Ko, pour ne pas saturer le
stockage local — ce qui ferait échouer l'enregistrement du profil entier.

Les fichiers restent dans le navigateur de l'appareil : ils ne sont ni envoyés
ailleurs, ni publiés avec l'application. C'est la voie à privilégier si tu n'es
pas certain de tes droits de redistribution.

## B. Dans le projet, livré avec l'application

1. Dépose les fichiers ici, de préférence en SVG, sinon en PNG transparent :

   ```
   src/assets/logos/
     basic-fit.svg
     fitness-park.svg
     lidl.svg
     carrefour.svg
     …
   ```

2. Importe-les et renseigne le champ `logo` :

   ```ts
   // src/data/gyms.ts
   import basicFit from '../assets/logos/basic-fit.svg';

   { id: 'basic_fit', name: 'Basic-Fit', logo: basicFit, /* … */ }
   ```

   ```ts
   // src/data/stores.ts
   import lidl from '../assets/logos/lidl.svg';

   { id: 'lidl', name: 'Lidl', logo: lidl, /* … */ }
   ```

3. Rien d'autre à faire : `<BrandMark>` bascule automatiquement sur le fichier
   dès que `logo` est renseigné, et retombe sur le monogramme s'il manque.

## Où les obtenir légalement

Chaque enseigne publie une charte de marque ou un kit presse précisant les
usages autorisés, les zones de protection et les variantes. C'est la source à
utiliser — et à relire, car l'usage d'un logo dans une application tierce est
généralement encadré, voire soumis à autorisation.

## Couleurs de repli

Les couleurs portées par `gyms.ts` et `stores.ts` servent uniquement au fond du
monogramme. Elles sont indicatives et n'ont pas été relevées sur les chartes
officielles : ajuste-les si tu disposes des références exactes.
