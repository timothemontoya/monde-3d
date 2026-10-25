#!/usr/bin/env bash
# Importe un modèle Blender dans le jeu : modeles/<nom>.glb, compressé pour le web.
# Le jeu le prend tout seul au prochain chargement (voir ASSETS-BLENDER.md).
#
#   scripts/importer-modele.sh ~/Blender/arbre-dore-1.blend              # → modeles/arbre-dore-1.glb
#   scripts/importer-modele.sh ~/Blender/ma-maison.blend maison-village-2 # → nom choisi
#   scripts/importer-modele.sh ~/Blender/arbres.blend --chaque-objet      # → un fichier par objet,
#                                                                          #   nommé comme l'objet
#   scripts/importer-modele.sh ~/Téléchargements/rocher.glb rocher-1      # un .glb déjà exporté
#
# Blender doit être installé (commande « blender », ou variable BLENDER=/chemin/vers/blender).
set -euo pipefail

src="${1:?Usage : scripts/importer-modele.sh fichier.blend|.glb [nom | --chaque-objet]}"
racine="$(cd "$(dirname "$0")/.." && pwd)"
blender="${BLENDER:-blender}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$racine/modeles"

# Nom de fichier = identifiant du modèle : minuscules, tirets.
normaliser() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[[:space:]_]+/-/g'; }

case "$src" in
  *.blend)
    if [[ "${2:-}" == "--chaque-objet" ]]; then
      "$blender" -b "$src" --python "$racine/scripts/exporter-blender.py" -- "$tmp" --chaque-objet
    else
      nom="$(normaliser "${2:-$(basename "${src%.*}")}")"
      "$blender" -b "$src" --python "$racine/scripts/exporter-blender.py" -- "$tmp/$nom.glb"
    fi
    ;;
  *.glb | *.gltf)
    nom="$(normaliser "${2:-$(basename "${src%.*}")}")"
    cp "$src" "$tmp/$nom.${src##*.}"
    ;;
  *)
    echo "Format non pris en charge : $src (.blend, .glb ou .gltf)" >&2
    exit 1
    ;;
esac

# Compression : géométrie meshopt, textures WebP (2048 px au plus). La géométrie n'est pas
# simplifiée (c'est toi qui décides du détail) et le jeu gère lui-même la répétition des modèles.
n=0
for f in "$tmp"/*.glb "$tmp"/*.gltf; do
  [[ -e "$f" ]] || continue
  nom="$(basename "${f%.*}")"
  "$racine/node_modules/.bin/gltf-transform" optimize "$f" "$racine/modeles/$nom.glb" \
    --compress meshopt --texture-compress webp --texture-size 2048 --simplify false --instance false >/dev/null
  echo "OK : modeles/$nom.glb ($(du -h "$racine/modeles/$nom.glb" | cut -f1))"
  n=$((n + 1))
done
[[ $n -gt 0 ]] || { echo "Rien n'a été exporté (aucun objet visible ?)." >&2; exit 1; }
