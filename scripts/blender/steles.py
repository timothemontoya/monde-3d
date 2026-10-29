# Stèle des indices et menhirs moussus, modélisés en Python dans Blender.
#
#   blender -b --python scripts/blender/steles.py -- /chemin/steles.blend
#   scripts/importer-modele.sh /chemin/steles.blend --chaque-objet   # → modeles/stele.glb, menhir-1.glb, menhir-2.glb
#
# Formes basses en polygones, à plat (le style du jeu) ; la façade est côté -Y (devient +Z dans le jeu).
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector

sortie = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)


def materiau(nom, couleur, emission=0.0):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    c = tuple(int(couleur[i : i + 2], 16) / 255 for i in (1, 3, 5))
    lin = tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
    bsdf.inputs["Base Color"].default_value = (*lin, 1)
    bsdf.inputs["Roughness"].default_value = 0.95
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*lin, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    return m


PIERRE = materiau("pierre-stele", "#8f897c")
SOCLE = materiau("socle-stele", "#6c675e")
RUNES = materiau("runes", "#ffc25a", emission=3.0)
MOUSSE = materiau("mousse", "#6f8a3c")
ROCHE = materiau("roche-menhir", "#857f74")


def boite(bm, x0, x1, y0, y1, z0, z1, mat, haut=None):
    """Un pavé ; `haut` (x0, x1, y0, y1) : sa face du dessus rétrécie (fût qui s'affine)."""
    hx0, hx1, hy0, hy1 = haut or (x0, x1, y0, y1)
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (hx0, hy0, z1), (hx1, hy0, z1), (hx1, hy1, z1), (hx0, hy1, z1)]]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    for f in faces:
        bm.faces.new([v[i] for i in f]).material_index = mat
    return v


def objet(nom, bm, mats):
    me = bpy.data.meshes.new(nom)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(o)
    return o


# ─── La stèle ───────────────────────────────────────────────────────────────
# Socle à deux gradins, fût qui s'affine, sommet en pointe de lance, panneau creusé de runes dorées.
bm = bmesh.new()
boite(bm, -1.4, 1.4, -0.85, 0.85, 0.0, 0.35, 1)
boite(bm, -1.1, 1.1, -0.6, 0.6, 0.35, 0.7, 1, haut=(-1.05, 1.05, -0.55, 0.55))
L, E, H = 0.8, 0.3, 3.4  # demi-largeur, demi-épaisseur, hauteur du fût
boite(bm, -L, L, -E, E, 0.7, 0.7 + H, 0, haut=(-L * 0.82, L * 0.82, -E * 0.85, E * 0.85))
# Pointe : un toit à quatre pans, plus haut que large (on lit une pierre dressée, pas une tombe).
z = 0.7 + H
s = [bm.verts.new(p) for p in [(-L * 0.82, -E * 0.85, z), (L * 0.82, -E * 0.85, z), (L * 0.82, E * 0.85, z), (-L * 0.82, E * 0.85, z)]]
pointe = bm.verts.new((0, 0, z + 0.95))
for a, b in [(0, 1), (1, 2), (2, 3), (3, 0)]:
    bm.faces.new([s[a], s[b], pointe]).material_index = 0
# Bandeau sous la pointe.
boite(bm, -L * 0.9, L * 0.9, -E * 0.95, E * 0.95, z - 0.18, z, 1)
# Runes sur la façade (-Y) : un cercle brisé et des traits, en relief léger, qui luisent.
yf = -E * 0.93 - 0.02
cx, cz, r = 0.0, 2.75, 0.42
n = 14
for i in range(n):
    if i in (3, 10):
        continue  # le cercle est brisé : la Fracture
    a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 0.8) / n
    p = [(cx + math.cos(a) * rr, yf, cz + math.sin(a) * rr) for a, rr in [(a0, r), (a1, r), (a1, r - 0.07), (a0, r - 0.07)]]
    bm.faces.new([bm.verts.new(q) for q in p]).material_index = 2
# Une fêlure qui traverse le cercle, et trois lignes d'inscription dessous.
for x0, z0, x1, z1 in [(-0.12, 3.2, 0.05, 2.75), (0.05, 2.75, -0.08, 2.3), (-0.5, 1.9, 0.5, 1.9), (-0.45, 1.65, 0.3, 1.65), (-0.5, 1.4, 0.42, 1.4)]:
    dx, dz = x1 - x0, z1 - z0
    l = math.hypot(dx, dz)
    nx, nz = -dz / l * 0.03, dx / l * 0.03
    p = [(x0 + nx, yf, z0 + nz), (x1 + nx, yf, z1 + nz), (x1 - nx, yf, z1 - nz), (x0 - nx, yf, z0 - nz)]
    bm.faces.new([bm.verts.new(q) for q in p]).material_index = 2
objet("stele", bm, [PIERRE, SOCLE, RUNES])


# ─── Menhirs moussus ────────────────────────────────────────────────────────
# Une pierre dressée irrégulière, un peu penchée, coiffée de mousse.
def menhir(nom, graine, hauteur, penche):
    random.seed(graine)
    bm = bmesh.new()
    etages = 5
    cotes = 6
    anneaux = []
    for k in range(etages + 1):
        t = k / etages
        rx = (0.55 - 0.25 * t) * (1 + random.uniform(-0.12, 0.12))
        ry = (0.38 - 0.16 * t) * (1 + random.uniform(-0.12, 0.12))
        dx = penche * t * hauteur
        anneaux.append([bm.verts.new((dx + math.cos(2 * math.pi * i / cotes + 0.3) * rx * random.uniform(0.85, 1.1), math.sin(2 * math.pi * i / cotes + 0.3) * ry * random.uniform(0.85, 1.1), t * hauteur - (0.15 if k == 0 else 0))) for i in range(cotes)])
    for k in range(etages):
        for i in range(cotes):
            a, b = anneaux[k][i], anneaux[k][(i + 1) % cotes]
            c, d = anneaux[k + 1][(i + 1) % cotes], anneaux[k + 1][i]
            bm.faces.new([a, b, c, d]).material_index = 1 if k >= etages - 1 else 0
    sommet = bm.verts.new((penche * hauteur + random.uniform(-0.05, 0.05), 0, hauteur + 0.18))
    for i in range(cotes):
        bm.faces.new([anneaux[-1][i], anneaux[-1][(i + 1) % cotes], sommet]).material_index = 1
    bm.faces.new(list(reversed(anneaux[0]))).material_index = 0
    objet(nom, bm, [ROCHE, MOUSSE])


menhir("menhir-1", 3, 2.2, 0.06)
menhir("menhir-2", 8, 1.7, -0.09)

bpy.ops.wm.save_as_mainfile(filepath=sortie)
print("Enregistré :", sortie)
