# Modèles à créer dans Blender

Tous les modèles ci-dessous sont **déjà prévus dans le jeu** : tant qu'un fichier manque, une forme
provisoire le remplace. Dès que tu importes le fichier, il apparaît partout où il doit être, sans
toucher au code.

## 1. Règles communes (à respecter pour chaque modèle)

| Règle | Pourquoi |
|---|---|
| **1 unité Blender = 1 mètre.** Respecte les tailles indiquées. | Le jeu ne redimensionne pas les bâtiments : le sol aplani et les collisions sont calculés pour ces tailles. |
| **Origine (point orange) au centre de la base, posée sur le sol (Z = 0).** | C'est ce point que le jeu pose sur le terrain. |
| **L'avant regarde vers −Y** : en vue de face (pavé numérique 1), tu vois la façade. | Les maisons tournent leur façade vers la place du village, les stèles leur face gravée vers le joueur, etc. |
| **Appliquer les transformations** avant l'export : `Ctrl+A` → *Toutes les transformations*. | Sinon une rotation ou une échelle oubliée se retrouve dans le jeu. |
| **Matériaux : Principled BSDF uniquement.** Textures en images (couleur, rugosité, normale) ; les nœuds procéduraux doivent être *bakés* en textures. Une à trois matières par modèle. | Le jeu ne lit que les matières simples. |
| **Textures : 2048 px au plus** (le script réduit de toute façon). | Mémoire et temps de chargement. |
| **Pas de lumières ni de caméras** dans le fichier (elles sont ignorées). | Le jeu ajoute lui-même les flammes, les lueurs de lanterne, etc. |
| **Le nom du fichier (ou de l'objet) est l'identifiant du modèle** : `maison-village-1.blend`. | C'est ce nom que le jeu cherche. |
| **Prévois un peu de « fondation » sous le sol** pour les bâtiments (murs qui descendent de 0,5 à 1 m sous Z = 0). | Le terrain n'est jamais parfaitement plat : rien ne flottera. |

**Reste léger (low poly).** Les arbres et les rochers sont dessinés à des milliers d'exemplaires
à la fois : leurs budgets de triangles sont bas exprès. Un style stylisé, aux formes franches,
ira très bien avec le reste du monde.

## 2. Importer un modèle

```bash
cd ~/Bureau/Projet/monde-3d

# Un fichier = un modèle (nommé comme le fichier)
scripts/importer-modele.sh ~/Bureau/Projet/monde-3d-sources/maison-village-1.blend

# Un nom différent de celui du fichier
scripts/importer-modele.sh ~/Bureau/Projet/monde-3d-sources/ma-maison.blend maison-village-2

# Plusieurs modèles dans un même fichier : un objet par modèle, nommé comme le modèle
# (ex. un fichier « arbres.blend » avec les objets arbre-dore-1, arbre-dore-2, pin-enneige-1…)
scripts/importer-modele.sh ~/Bureau/Projet/monde-3d-sources/arbres.blend --chaque-objet

# Un .glb déjà exporté ailleurs
scripts/importer-modele.sh ~/Téléchargements/rocher.glb rocher-1
```

Le script exporte depuis Blender, compresse le modèle et le range dans `modeles/<nom>.glb`. Recharge
la page du jeu : il est là.

Avec `--chaque-objet`, chaque objet sans parent devient un modèle (avec ses enfants), exporté comme
s'il était à l'origine : tu peux donc les ranger côte à côte dans la scène.

**Garde tes `.blend` hors du dossier du jeu** (par exemple dans `~/Bureau/Projet/monde-3d-sources/`) :
seuls les `.glb` produits par le script vont dans `modeles/`.

## 3. La liste

Les tailles sont données en largeur × hauteur × profondeur (X × Z × Y dans Blender).

### Priorité 1 — la végétation et les rochers (on les voit partout)

Le jeu tire une variante au hasard pour chaque arbre, le tourne au hasard et fait varier sa taille
(de 0,75 à 1,35 fois, un peu plus ou moins étiré en hauteur). Modélise-les à la taille « moyenne ».

| Fichier | Quoi | Taille moyenne | Triangles |
|---|---|---|---|
| `arbre-dore-1` · `-2` · `-3` | Arbres au feuillage doré : Terres libres, Village blanc, Atlantes | 7 m de large, 11 m de haut | ≤ 600 |
| `arbre-sorciere-1` · `-2` · `-3` | Arbres de la forêt des sorcières : sombres, tordus, violacés | 6 × 13 m | ≤ 600 |
| `pin-enneige-1` · `-2` | Pins couverts de neige (terres de glace) | 6 × 12 m | ≤ 500 |
| `arbre-mort-1` · `-2` | Arbres morts, sans feuilles (cité volcanique, Elcres abandonnée) | 4 × 9 m | ≤ 400 |
| `rocher-1` · `-2` · `-3` | Rochers, partout (surtout dans la montagne du vent). Le jeu les agrandit de 0,5 à 2,6 fois : fais-les d'environ 3 m. | 3 × 2 m | ≤ 200 |
| `buisson-1` · `-2` | Buissons du sous-bois (forêts dorée et des sorcières) | 2,5 × 1,6 m | ≤ 150 |

Les troncs et les rochers bloquent le joueur (un cylindre de 0,45 m de rayon pour les troncs, de
1,2 m pour les rochers) ; les buissons se traversent.

### Priorité 2 — les maisons des villages (68 maisons en tout)

La **porte** est sur la façade (−Y) : le jeu tourne chaque maison vers la place de son village.
Le sol est aplani sur un disque d'environ la moitié de la largeur + 2,5 m : garde l'emprise au sol
dans la taille indiquée.

| Fichier | Village | Taille (L × H × P) | Triangles |
|---|---|---|---|
| `maison-village-1` · `-2` · `-3` | Village blanc : murs clairs, toits de tuiles brunes | 10 × 7 × 8 m | ≤ 2 000 |
| `maison-volcan-1` · `-2` | Cité volcanique : pierre sombre, toits rouille | 11 × 8 × 9 m | ≤ 2 000 |
| `maison-atlante-1` · `-2` | Archipel des Atlantes : murs blancs, toits bleu-vert | 9 × 7 × 9 m | ≤ 2 000 |
| `maison-vent-1` · `-2` | Cité des montagnes et du vent : hautes, bois et pierre | 8 × 9 × 8 m | ≤ 2 000 |
| `hutte-sorciere-1` · `-2` | Campement des sorcières : huttes sombres | 7 × 6 × 7 m | ≤ 1 500 |

### Priorité 3 — les lieux uniques

| Fichier | Quoi | Taille | Triangles |
|---|---|---|---|
| `palais-givre` | Le Palais givré, tout au nord des terres de glace. Le sol est aplani sur 50 m de rayon autour de lui. | jusqu'à 100 m de large, 60 m de haut | ≤ 15 000 |
| `portail-sciyolia` | **Pas affiché pour l'instant** : le portail est caché dans le sous-sol de la cabane de la reine. | 14 m de large, 14 m de haut | ≤ 5 000 |
| `feu-de-camp` | Foyer : pierres en cercle et bûches. La flamme et la lumière sont ajoutées par le jeu. | 2,5 m de diamètre | ≤ 800 |

### Priorité 4 — les voyages

| Fichier | Quoi | Taille | Triangles |
|---|---|---|---|
| `ponton` | Quai de bois. **Origine sur la rive**, le ponton s'avance de **26 m vers −Y** (vers le large). Dessus du plancher à Z = 0 ; les pieux descendent jusqu'à −5 m. | 4 × 26 m | ≤ 2 000 |
| `barque` | Bateau amarré au bout du ponton. **Origine sur la ligne de flottaison**, proue vers −Y. | 3 × 9 m, mât compris : 8 m de haut | ≤ 3 000 |
| `pont-planche` | Une planche des ponts suspendus des Atlantes, répétée sur toute la longueur. **Centrée sur l'origine.** | 4 m (X) × 0,16 m × 1,05 m (Y) | ≤ 100 |

### Priorité 5 — les indices et les énigmes

| Fichier | Quoi | Taille | Triangles |
|---|---|---|---|
| `stele` | Stèle gravée (indices). Face gravée vers −Y. | 2,2 × 4,4 × 0,6 m | ≤ 1 500 |
| `lutrin` | Lutrin avec un livre ouvert (carnets, journaux). | 1,1 × 1,4 × 0,9 m | ≤ 1 000 |
| `autel-braise` | Autel de pierre de la braise éternelle. La braise lumineuse est ajoutée par le jeu, à 1,6 m au-dessus du sol. | 2,4 × 1 × 2,4 m | ≤ 1 000 |
| `cadran` | Socle d'énigme avec un cadran (le cadran provisoire tourne ; un modèle reste fixe). | 1,4 × 2,6 × 1,4 m | ≤ 1 500 |

### Priorité 6 — les objets qu'on tient en main

Ils s'affichent en bas à droite de l'écran quand on les tient, et flottent en tournant sur eux-mêmes
quand ils sont posés par terre. **Origine à l'endroit où la main les tient.** Ce que tu vois en vue de
face (−Y), c'est ce que voit le joueur.

| Fichier | Quoi | Taille | Triangles |
|---|---|---|---|
| `objet-lanterne` | Lanterne (sa lumière est ajoutée par le jeu) | 0,45 m de haut | ≤ 1 500 |
| `objet-boussole` | Boussole qui ne montre pas le nord | 0,26 m de diamètre | ≤ 800 |
| `objet-cle-rouillee` | Clé de fer rouillée | 0,4 m de long | ≤ 600 |
| `objet-braise` | Braise du volcan : un cristal incandescent (couleur *émission* dans le matériau) | 0,26 m | ≤ 400 |

Pour un nouvel objet ajouté dans `OBJETS` (dans `src/content/monde.ts`), le modèle s'appelle
`objet-<identifiant>`.

### Priorité 7 — les décors déjà placés sur la carte

Ils sont listés dans `DECORS` (`src/content/monde.ts`) et restent **invisibles tant que leur fichier
n'existe pas**.

| Fichier | Quoi | Taille | Triangles |
|---|---|---|---|
| `tour-guet` | Tour de guet du Pic de l'Hippocampe (surveillance) | 6 × 18 × 6 m | ≤ 4 000 |
| `statue-hippocampe` | Statue de l'hippocampe, au pied de la tour | 3 × 6 × 3 m | ≤ 4 000 |
| `epave-corne` | Épave d'un navire de la bataille de la Corne, échouée | 5 × 4 × 16 m | ≤ 4 000 |
| `etendard-corne` | Étendard planté sur le champ de bataille | 1 × 5 m | ≤ 500 |

### Priorité 8 — les décors de la carte de travail

Ils ont une forme provisoire (une maison) tant que leur fichier n'existe pas.

| Fichier | Quoi | Taille | Triangles |
|---|---|---|---|
| `cahute-maitre` | Cahute du maître du village, sur l'île d'Eregone : différente des autres maisons atlantes | 11 × 9 × 10 m | ≤ 3 000 |
| `cabane-reine` | Cabane de la reine des sorcières (le portail est dans son sous-sol, invisible) | 9 × 8 × 9 m | ≤ 3 000 |

Les tours de guet, canons, épave, ruines et remparts viennent pour l'instant des packs Kenney
(voir `modeles/README.md`) : un modèle Blender du même nom les remplace.

### Plus tard (pas encore utilisés par le jeu)

`bloc-givre` (le mur de givre du col), `iceberg-creux`, `portail-elcres`, et les espèces
(`cerf-dore`, `salamandre-cendre`…). Dis-moi quand tu les commences : je les brancherai.

## 4. Tes propres modèles, sur mesure

Pour poser n'importe quel modèle à un endroit précis, ajoute une ligne dans `DECORS`
(`src/content/monde.ts`), puis importe le fichier :

```ts
export const DECORS: DecorUnique[] = [
  // …
  {
    modele: "puits-village",   // le nom du fichier, sans .glb
    position: [1004, 622],     // en pixels de ta carte, comme tout le reste
    angle: 90,                 // direction de la façade : 0 = est, 90 = sud, 180 = ouest, 270 = nord
    plateforme: 4,             // facultatif : aplanit le sol sur 4 m de rayon (pour un bâtiment)
    solide: [3, 2, 3],         // facultatif : le joueur s'y cogne (boîte largeur × hauteur × profondeur, en m)
    echelle: 1,                // facultatif
  },
];
```

- Une **nouvelle variante de maison** : ajoute son nom dans la liste `modeles` du village (`VILLAGES`).
- Une **nouvelle variante d'arbre ou de rocher** (un 4e arbre doré, par exemple) : demande-moi, ou
  change le nombre de variantes dans `src/world/Decor.tsx` (`arbres("arbre-dore", 3, …)`).
- Pour savoir quels modèles le jeu a trouvés, tape `ls modeles` dans le terminal.
