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

## Modifier le contenu

**Tout est dans [`src/content/monde.ts`](src/content/monde.ts)**, avec les positions en pixels de
la carte (1 pixel = 2,5 m) :

- `REGLAGES` : départ, vitesses, vol maximal, pente franchissable, taille du monde
- `REGIONS` : nom, relief, ambiance, végétation, couleurs du sol, **lore** (paragraphes révélés
  au fil des découvertes)
- `LIEUX` : lieux-dits (bannière et lore quand on y entre)
- `ESPECES` : créatures, affichées dans le journal une fois rencontrées
- `VOLCANS`, `CRETES` (montagnes infranchissables, avec leurs cols)
- `FRONTIERES_MAGIQUES` : frontières infranchissables entre deux régions
- `BARRIERES` : tempêtes, voiles, portes, murs de givre, sorts (+ condition d'ouverture)
- `PORTS`, `PONTS`, `FEUX` (voyage rapide)
- `OBJETS`, `RAMASSABLES`, `USAGES` (ce que fait un objet tenu en main à un endroit)
- `INDICES`, `ENIGMES`, `SUCCES`

## Commandes

| Touche | Action |
|---|---|
| Souris | regarder |
| Z Q S D | se déplacer |
| Espace / C | monter / descendre (vol limité au-dessus du sol) |
| Maj | aller vite |
| E | examiner, ramasser, prendre le bateau |
| 1 à 8 | prendre un objet en main |
| F ou clic | utiliser l'objet tenu |
| Tab | journal de bord (carte, lieux, indices, espèces, sac, succès) |
| Échap | pause |

## Outils de test (console du navigateur, en développement)

```js
teleporter(px, py)     // se placer à ces pixels de la carte
regarder(90)           // tourner la vue : 0 = est, 90 = sud, 180 = ouest, 270 = nord
position()             // position actuelle (mètres)
regionEn(px, py)       // région à cet endroit de la carte
hauteurEn(px, py)      // altitude du sol
carteComprise()        // image de la carte telle que le moteur l'a lue
```
