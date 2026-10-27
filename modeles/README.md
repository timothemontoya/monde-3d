# Modèles du jeu

Chaque fichier `<nom>.glb` de ce dossier est chargé automatiquement par le jeu sous son nom
(`arbre-dore-1.glb` → le modèle `arbre-dore-1`). Tant qu'un modèle manque, le jeu affiche une
forme provisoire à sa place.

Ne dépose pas les fichiers à la main : passe par le script, qui exporte et compresse.

```bash
scripts/importer-modele.sh ~/chemin/vers/arbre-dore-1.blend
```

La liste des modèles attendus, leurs tailles et les règles à suivre dans Blender sont dans
[`ASSETS-BLENDER.md`](../ASSETS-BLENDER.md).

## Modèles venant d'un pack

La végétation, les rochers, le feu de camp, les tours de guet, canons, épave, ruines et remparts
viennent des packs **Kenney** Nature Kit, Pirate Kit et Castle Kit (licence CC0, https://kenney.nl),
adaptés au jeu (taille, origine, couleurs) par
`scripts/preparer-pack.mjs`, puis importés avec `scripts/importer-modele.sh`. Un modèle Blender
du même nom les remplace simplement.
