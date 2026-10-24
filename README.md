# L'Île sans nom

Un monde à explorer dans le navigateur, façon Elden Ring : zones fermées par des tempêtes,
des voiles de brume dorée et des portes, indices à rassembler, énigmes, carnet et succès.

Le monde actuel est **provisoire** : il sert à tester le moteur en attendant l'histoire
(voir `CONCEPTION.md`).

## Lancer

```bash
npm install
npm run dev          # http://localhost:5173
```

Ajouter `?leger` à l'adresse désactive ombres et effets (machines modestes).

## Modifier le monde

**Tout le contenu est dans [`src/content/monde.ts`](src/content/monde.ts)** :

- `REGLAGES` : point de départ, vitesses, **altitude de vol maximale** (`volMax`)
- `ZONES` : nom, position, ambiance (brume, lumière), plateau, **remparts** (`enceinte`)
- `BARRIERES` : tempêtes, voiles de brume et portes, avec leur **condition d'ouverture**
- `INDICES` : objets à examiner, leur texte, leurs liens dans le carnet
- `ENIGMES` : question et solution
- `SUCCES` : ce qu'il faut accomplir pour chacun

## Les règles du monde

- **Pas de murs invisibles.** Les zones sont fermées par des remparts, une tempête ou un
  voile de brume. Une tempête ceinture l'île entière.
- **Vol bridé.** On peut voler, mais jamais à plus de `volMax` mètres au-dessus du sol.
  Les remparts sont plus hauts : impossible de les survoler.
- **Une barrière s'ouvre** quand sa condition est remplie : indices trouvés et/ou énigme
  résolue. La progression est sauvegardée dans le navigateur.

## Outils de test (console du navigateur, en développement)

```js
teleporter(x, z)   // se placer n'importe où (monde de 1 000 × 1 000 m centré sur 0, 0)
regarder(90)       // tourner la vue : 0 = est, 90 = sud, 180 = ouest, 270 = nord
position()         // position actuelle
```

## Structure

- `src/content/` : le contenu (à modifier)
- `src/world/` : relief, ciel, remparts, barrières, décor, objets
- `src/player/` : déplacement, collisions, détection des zones et des objets
- `src/game/` : progression, conditions, succès, sauvegarde
- `src/ui/` : écran titre, bannières, carnet, énigmes, notifications
