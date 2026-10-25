# Appelé par importer-modele.sh : exporte les objets visibles d'un fichier Blender en .glb.
#
#   blender -b fichier.blend --python exporter-blender.py -- sortie.glb
#   blender -b fichier.blend --python exporter-blender.py -- dossier/ --chaque-objet
#
# --chaque-objet : chaque objet « racine » (sans parent) devient un modèle à part, nommé comme lui,
# et exporté comme s'il était posé à l'origine de la scène.
import os
import re
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1 :]
sortie = args[0]
chaque = "--chaque-objet" in args


def nom_fichier(nom):
    return re.sub(r"[\s_]+", "-", nom.strip().lower())


def visible(o):
    return o.visible_get() and not o.hide_render


def descendants(o):
    return [o] + [d for c in o.children for d in descendants(c)]


def exporter(chemin, objets):
    for o in bpy.context.scene.objects:
        try:
            o.select_set(False)
        except RuntimeError:
            pass
    for o in objets:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )


if chaque:
    racines = [o for o in bpy.context.scene.objects if o.parent is None and visible(o)]
    for r in racines:
        groupe = [o for o in descendants(r) if visible(o)]
        if not any(o.type == "MESH" for o in groupe):
            continue
        position = r.location.copy()
        r.location = (0, 0, 0)
        bpy.context.view_layer.update()
        exporter(os.path.join(sortie, nom_fichier(r.name) + ".glb"), groupe)
        r.location = position
        print("EXPORTÉ", r.name)
else:
    objets = [o for o in bpy.context.scene.objects if visible(o) and o.type == "MESH"]
    exporter(sortie, objets)
    print("EXPORTÉ", sortie, len(objets), "objets")
