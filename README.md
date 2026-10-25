# L'Île sans nom

Un monde à explorer dans le navigateur, façon Elden Ring : régions fermées par des tempêtes,
des brumes magiques, des murs de givre et des portes, indices à rassembler, énigmes, objets à
tenir en main, journal de bord façon Outer Wilds et succès.

L'histoire et la carte sont en cours d'écriture : voir `CONCEPTION.md`.

## Lancer

```bash
npm install
npm run dev          # http://localhost:5173
```

Ajouter `?leger` à l'adresse désactive ombres et effets (machines modestes).

## La carte fait le monde

La forme du monde vient de **ton dessin, `public/carte.jpg`** (1920 × 1080) :

- chaque **couleur** est une région (voir `REGIONS` dans `src/content/monde.ts`) ;
- le **blanc relié au bord** de l'image est la mer ;
- une **zone blanche fermée** par des contours noirs est une terre si une région blanche y a son
  `point` (le Village blanc), un lac sinon ;
- le **cadre en haut à droite** (Scìyolia) est ignoré : c'est un autre monde.

Pour modifier le monde : redessine la carte (couleurs bien franches et uniformes, contours noirs
fermés) et remplace l'image. Si tu ajoutes une couleur, ajoute la région correspondante.

Ton dessin n'apparaît pas dans le jeu : la mini-carte et la carte du journal sont **dessinées par
le jeu** à partir du monde (relief ombré, courbes de niveau, côtes, régions).

Au chargement, le jeu calcule aussi **où poser chaque chose** (`src/world/plan.ts`) : il ramène
sur la terre ferme ce qui est tombé à l'eau, aplanit le sol sous les maisons, les feux et les
indices, relie les ponts aux rives les plus proches et pose les quais au bord de l'eau profonde.

## Modifier le contenu

**Tout est dans [`src/content/monde.ts`](src/content/monde.ts)**, avec les positions en pixels de
la carte (1 pixel = 4 m) :

- `REGLAGES` : départ, vitesses, vol maximal, pente franchissable, taille du monde
- `REGIONS` : nom, relief, ambiance, végétation, couleurs du sol, **lore** (paragraphes révélés
  au fil des découvertes)
- `LIEUX` : lieux-dits (bannière et lore quand on y entre)
- `ESPECES` : créatures, affichées dans le journal une fois rencontrées
- `VOLCANS`, `CRETES` (montagnes infranchissables, avec leurs cols)
- `FRONTIERES_MAGIQUES` : frontières infranchissables entre deux régions (ou une région et la
  `"mer"`), fermées par un rideau de brume opaque
- `BARRIERES` : tempêtes, voiles, portes, murs de givre, sorts (+ condition d'ouverture)
- `PORTS`, `PONTS` (un point sur chaque île suffit), `FEUX` (voyage rapide)
- `VILLAGES` : maisons placées autour d'une place, et `DECORS` : tes modèles uniques
- `OBJETS`, `RAMASSABLES`, `USAGES` (ce que fait un objet tenu en main à un endroit)
- `INDICES`, `ENIGMES`, `SUCCES`

## Commandes

| Touche | Action |
|---|---|
| Souris | regarder |
| Z Q S D | se déplacer |
| Espace | sauter |
| Espace deux fois | voler (ou cesser de voler) |
| Espace / C en vol | monter / descendre (vol limité à quelques mètres du sol) ; C au sol : se poser |
| Maj | aller vite |
| E | examiner, ramasser, prendre le bateau |
| 1 à 8 | prendre un objet en main |
| F ou clic | utiliser l'objet tenu |
| Tab | journal de bord (carte, lieux, indices, espèces, sac, succès) |
| Échap | pause |

## Modèles 3D (Blender)

Tous les modèles attendus (arbres, maisons, quais, stèles, objets tenus en main…) sont listés dans
**[`ASSETS-BLENDER.md`](ASSETS-BLENDER.md)**, avec leurs tailles et les règles à suivre. Pour en
ajouter un :

```bash
scripts/importer-modele.sh ~/chemin/vers/arbre-dore-1.blend   # → modeles/arbre-dore-1.glb
```

Tant qu'un modèle manque, le jeu affiche une forme provisoire à sa place.

## Outils de test (console du navigateur, en développement)

```js
teleporter(px, py)     // se placer à ces pixels de la carte
regarder(90)           // tourner la vue : 0 = est, 90 = sud, 180 = ouest, 270 = nord
position()             // position actuelle (mètres)
regionEn(px, py)       // région à cet endroit de la carte
hauteurEn(px, py)      // altitude du sol
carteComprise()        // image de la carte telle que le moteur l'a lue
lePlan()               // où le jeu a posé chaque chose (maisons, quais, ponts…), en mètres
jeu.getState()         // l'état du jeu (progression, objet en main…)
```
