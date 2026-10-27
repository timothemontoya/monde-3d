// Adapte des modèles d'un pack (.glb) au jeu, avant de les importer avec importer-modele.sh :
// taille en mètres, origine au pied du modèle, couleurs de la palette du monde, matières éclairées.
//
//   node scripts/preparer-pack.mjs <dossier de sortie> nature=<dossier> pirate=<dossier> castle=<dossier>
//     town=<dossier> survival=<dossier> graveyard=<dossier> [modèle…]
//
// Chaque « pack=dossier » donne le dossier des .glb d'un pack ; sans liste de modèles, tout est préparé.
// Les recettes visent les packs Kenney (CC0) : Nature Kit, Pirate Kit et Castle Kit (https://kenney.nl).
import { Document, NodeIO } from "@gltf-transform/core";
import { getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { join } from "node:path";

// Palette (sRGB) : reprend les couleurs des formes provisoires de src/world/Decor.tsx.
const DORE = { leafsFall: "#e2b54e", woodBirch: "#6b5236" };
const VERT = { leafsGreen: "#5f9a3a", woodBark: "#5a4230" };
const VERT_SOMBRE = { leafsGreen: "#3f7a34", woodBark: "#4a3628" };
const DORE_PALE = { leafsFall: "#e9c45c", woodBirch: "#6b5236" };
const DORE_ROUX = { leafsFall: "#c98a2e", woodBirch: "#6b5236" };
const SORCIERE = { leafsDark: "#4a3358", woodBarkDark: "#2a2228" };
const GIVRE = { leafsDark: "#7f9fa6", woodBarkDark: "#3a3028" };
/** Un pin sur cinq reste chargé de neige. */
const NEIGE = { leafsDark: "#d6e3e8", woodBarkDark: "#3a3028" };
const MORT = { woodBark: "#3a302a" };
const MORT_BRANCHES = { woodBark: "#3a302a", woodBirch: "#3a302a", _defaultMat: "#3a302a" };
const PIERRE = { stone: "#8a857c", _defaultMat: "#8a857c" };
const FEUILLAGE = { grass: "#5d6b3a" };
/** Les packs Pirate et Castle sont peints par une texture : la couleur la teinte (ou la remplace, avec `uni`). */
const GLACE = { colormap: "#d6eef8" };
const PIERRE_CLAIRE = { colormap: "#d8d0c0" };
const PIERRE_RUINE = { colormap: "#7d776d" };

// ─── Maisons assemblées (Fantasy Town Kit : des tuiles de 1 × 1) ────────────

/**
 * Une maison de `largeur` tuiles sur 2 de profondeur : murs (pierre « wall » ou bois « wall-wood »),
 * une porte au milieu de la façade (+Z), des fenêtres, deux pignons, un toit à deux pans, une cheminée.
 * `couleurToit` : une couleur unie pour le toit, à la place de celle du kit (rouge ou vert).
 * `tourelles` : [{ cote: -1 | 1, etages }], des tours pointues contre les pignons (demeures des dirigeants).
 * Chaque pièce : { source, pos, rot (autour de Y), echelle, couleur }.
 */
function maison({ largeur: W, etages = 1, bas = "wall", haut = bas, toit = "roof-high", cheminee = true, fenetre = "-window-shutters", couleurToit, tourelles = [] }) {
  const pieces = [];
  const poser = (piece, pos, rot = 0, echelle = [1, 1, 1], couleur) => pieces.push({ source: `town:${piece}`, pos, rot, echelle, couleur });
  const X = (i) => i - (W - 1) / 2;
  const D = Math.PI / 2;
  for (let e = 0; e < etages; e++) {
    const mur = e === 0 ? bas : haut;
    for (let i = 0; i < W; i++) {
      const milieu = i === Math.floor(W / 2);
      // Façade : la porte au milieu, des fenêtres une tuile sur deux (toutes à l'étage).
      poser(mur + (e === 0 && milieu ? "-door" : e > 0 || i % 2 === 0 ? fenetre : ""), [X(i), e, 0.5], -D);
      poser(mur + (e > 0 && i % 2 === 1 ? fenetre : ""), [X(i), e, -0.5], D);
    }
    for (const [j, z] of [[0, -0.5], [1, 0.5]]) {
      poser(mur + (j === 1 ? fenetre : ""), [X(W - 1), e, z], 0);
      poser(mur + (j === 0 ? fenetre : ""), [X(0), e, z], 2 * D);
    }
  }
  // Pignons (le triangle sous le toit) : ils montent vers le faîtage, au milieu de la profondeur.
  // Le toit bas (« roof ») monte deux fois moins : son pignon est écrasé d'autant.
  const pignon = `${haut}-slope`;
  const h = toit === "roof" ? 0.5 : 1;
  poser(pignon, [X(W - 1), etages, -0.5], 0, [1, h, 1]);
  poser(pignon, [X(W - 1), etages, 0.5], 0, [1, h, -1]);
  poser(pignon, [X(0), etages, 0.5], 2 * D, [1, h, 1]);
  poser(pignon, [X(0), etages, -0.5], 2 * D, [1, h, -1]);
  // Toit : deux rangées de tuiles dont le faîtage se rejoint au milieu.
  for (let i = 0; i < W; i++) {
    poser(toit, [X(i), etages, 0.5], D, undefined, couleurToit);
    poser(toit, [X(i), etages, -0.5], -D, undefined, couleurToit);
  }
  if (cheminee) poser("chimney", [X(W - 1) - 0.1, etages + (toit === "roof" ? 0 : 0.2), -0.45], 0);
  // Tourelles : une tour d'une tuile contre un pignon (côté -1 ou 1), à l'avant, coiffée d'un toit pointu.
  for (const { cote, etages: n } of tourelles) {
    const x = cote > 0 ? X(W - 1) + 1 : X(0) - 1;
    for (let e = 0; e < n; e++) {
      const mur = e === 0 ? bas : haut;
      poser(mur + (e > 0 ? fenetre : ""), [x, e, 0.5], -D);
      poser(mur, [x, e, 0.5], D);
      poser(mur + (e === n - 1 ? fenetre : ""), [x, e, 0.5], cote > 0 ? 0 : 2 * D);
      poser(mur, [x, e, 0.5], cote > 0 ? 2 * D : 0);
    }
    poser("roof-high-point", [x, n, 0.5], 0, [1, 1.6, 1], couleurToit);
  }
  return pieces;
}

/** Maison en ruine de 2 × 2 tuiles : des pans de murs brisés en L, un plancher effondré, des gravats. */
function ruine(variante) {
  const D = Math.PI / 2;
  const p = (piece, pos, rot = 0, echelle = [1, 1, 1]) => ({ source: `town:${piece}`, pos, rot, echelle });
  const mur = variante === 1 ? "wall" : "wall-wood";
  return [
    p(`${mur}-broken`, [-0.5, 0, -0.5], D),
    p("wall-broken", [0.5, 0, -0.5], D),
    p("wall-half", [-0.5, 0, -0.5], 2 * D),
    p(variante === 1 ? "wall-broken" : "wall-half", [-0.5, 0, 0.5], 2 * D),
    p("wall-half", [0.5, 0, 0.5], -D),
    p("planks-half", [0.25, 0.02, 0], 0.3),
    p("rock-small", [0.6, 0, 0.7], 1, [0.35, 0.3, 0.35]),
    p("rock-small", [-0.2, 0, 0.9], 2.4, [0.25, 0.2, 0.25]),
  ];
}

/**
 * Palais du roi des glaces (Castle Kit, 1 unité = une tuile de tour) : un donjon de quatre niveaux au
 * centre, quatre tours hexagonales aux angles, reliées par des murs, ouvert sur l'avant (+Z).
 */
function palais() {
  const D = Math.PI / 2;
  const p = (piece, pos, rot = 0, echelle = [1, 1, 1]) => ({ source: `castle:${piece}`, pos, rot, echelle });
  const pieces = [];
  const empiler = (x, z, liste) => {
    let y = 0;
    for (const [piece, h] of liste) (pieces.push(p(piece, [x, y, z])), (y += h));
  };
  empiler(0, 0, [
    ["tower-square-base", 1.01],
    ["tower-square-mid-windows", 1.01],
    ["tower-square-mid", 1.01],
    ["tower-square-mid-windows", 1.01],
    ["tower-square-roof", 2.01],
  ]);
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]])
    empiler(x, z, [
      ["tower-hexagon-base", 1.31],
      ["tower-hexagon-mid", 0.46],
      ["tower-hexagon-mid", 0.46],
      ["tower-hexagon-roof", 0.83],
    ]);
  for (const t of [-0.5, 0.5]) {
    pieces.push(p("wall", [-1.5, 0, t], D), p("wall", [1.5, 0, t], D), p("wall", [t, 0, -1.5]));
  }
  pieces.push(p("flag-banner-long", [0.5, 1.4, 0.2], 0), p("flag-banner-long", [-0.54, 1.4, 0.2], 2 * D));
  return pieces;
}

/**
 * Potager (Nature Kit, tuiles de 1 m) : 3 × 2 tuiles de sillons plantés (maïs, carottes, citrouilles,
 * blé), entourés d'une clôture ouverte au milieu de l'avant (+Z).
 */
function potager() {
  const p = (piece, pos, rot = 0) => ({ source: `nature:${piece}`, pos, rot, echelle: [1, 1, 1] });
  const D = Math.PI / 2;
  const plantes = ["crops_cornStageC", "crop_carrot", "crop_pumpkin", "crops_wheatStageB"];
  const pieces = [];
  for (let x = 0; x < 3; x++)
    for (let z = 0; z < 2; z++)
      for (const dz of [-0.25, 0.25]) {
        pieces.push(p("crops_dirtRow", [x, 0, z + dz]));
        const plante = plantes[(x + z * 2 + (dz > 0 ? 1 : 0)) % plantes.length];
        for (const dx of [-0.3, 0, 0.3]) pieces.push(p(plante, [x + dx, 0, z + dz]));
      }
  for (let x = 0; x < 3; x++) {
    pieces.push(p("fence_simple", [x, 0, 0], 0));
    if (x !== 1) pieces.push(p("fence_simple", [x, 0, 1], 2 * D));
  }
  for (let z = 0; z < 2; z++) pieces.push(p("fence_simple", [0, 0, z], D), p("fence_simple", [2, 0, z], -D));
  return pieces;
}

/**
 * Village blanc : la texture du Town Kit est faite d'aplats ; on les repeint (enduit crème,
 * colombages brun sombre, pierre claire) au lieu de les teinter, ce qui ne peut pas blanchir du rouge.
 */
const PALETTE_VILLAGE = {
  "#cf534f": "#ece3d0",
  "#c3495c": "#e6dcc6",
  "#ff7e44": "#5b3f2b",
  "#f1976c": "#6a4a32",
  "#c58262": "#5b3f2b",
  "#b06041": "#4a3424",
  "#9a5942": "#4a3424",
  "#a0a8c9": "#d6cfbf",
  "#868ba1": "#b8b0a0",
  "#eeba88": "#efe6d2",
  "#f2bf99": "#efe6d2",
};

/**
 * Monastère de l'iceberg (Castle Kit) : une haute tour hexagonale au centre, deux tours carrées
 * plus basses de part et d'autre, reliées par des murs ; une porte voûtée sur l'avant (+Z).
 */
function monastere() {
  const D = Math.PI / 2;
  const p = (piece, pos, rot = 0, echelle = [1, 1, 1]) => ({ source: `castle:${piece}`, pos, rot, echelle });
  const pieces = [];
  const empiler = (x, z, liste) => {
    let y = 0;
    for (const [piece, h] of liste) (pieces.push(p(piece, [x, y, z])), (y += h));
  };
  empiler(0, 0, [["tower-hexagon-base", 1.31], ["tower-hexagon-mid", 0.46], ["tower-hexagon-mid", 0.46], ["tower-hexagon-mid", 0.46], ["tower-hexagon-mid", 0.46], ["tower-hexagon-roof", 0.83]]);
  for (const x of [-1.6, 1.6]) empiler(x, 0.3, [["tower-square-base", 1.01], ["tower-square-mid-windows", 1.01], ["tower-square-roof", 2.01]]);
  pieces.push(p("wall", [-0.8, 0, 0.3], 0), p("wall", [0.8, 0, 0.3], 0), p("wall", [0, 0, -0.8], D));
  return pieces;
}

/** Teintes des murs par région (elles multiplient la texture du kit). */
const MURS_VILLAGE = { colormap: "#f2ead8" };
const MURS_VOLCAN = { colormap: "#8a7a74" };
const MURS_ATLANTE = { colormap: "#eef4f2" };
const MURS_VENT = { colormap: "#e0cca4" };
const MURS_SORCIERE = { colormap: "#6a5a52" };

/** Côté d'une tuile du Fantasy Town Kit, en m : un étage fait cette hauteur. */
const TUILE = 3;

/**
 * Une recette : le ou les fichiers des packs (« pack:nom », fusionnés ; `empiler` les pose l'un sur
 * l'autre), la taille visée (hauteur, ou largeur = le plus grand côté au sol, en m), les couleurs
 * par matière (`uni` : à la place de la texture), et les matières à retirer (ex. les feuilles d'un arbre mort).
 */
const RECETTES = {
  "arbre-dore-1": { sources: ["nature:tree_default_fall"], hauteur: 11, couleurs: DORE },
  "arbre-dore-2": { sources: ["nature:tree_detailed_fall"], hauteur: 11, couleurs: DORE },
  "arbre-dore-3": { sources: ["nature:tree_oak_fall"], hauteur: 10, couleurs: DORE },
  "arbre-sorciere-1": { sources: ["nature:tree_thin_dark"], hauteur: 13, couleurs: SORCIERE },
  "arbre-sorciere-2": { sources: ["nature:tree_fat_darkh"], hauteur: 11, couleurs: SORCIERE },
  "arbre-sorciere-3": { sources: ["nature:tree_detailed_dark"], hauteur: 13, couleurs: SORCIERE },
  "pin-enneige-1": { sources: ["nature:tree_pineTallA"], hauteur: 12, couleurs: GIVRE },
  "pin-enneige-2": { sources: ["nature:tree_pineDefaultA"], hauteur: 11, couleurs: GIVRE },
  // Des arbres à branches, sans leurs feuilles (les troncs seuls faisaient des poteaux).
  "arbre-mort-1": { sources: ["nature:tree_detailed"], hauteur: 8, couleurs: MORT_BRANCHES, retirer: ["leafsGreen"] },
  "arbre-mort-2": { sources: ["nature:tree_oak"], hauteur: 7, couleurs: MORT_BRANCHES, retirer: ["leafsGreen"] },
  "rocher-1": { sources: ["nature:stone_largeA"], largeur: 3, couleurs: PIERRE },
  "rocher-2": { sources: ["nature:stone_largeC"], largeur: 3, couleurs: PIERRE },
  "rocher-3": { sources: ["nature:stone_largeD"], largeur: 3, couleurs: PIERRE },
  "buisson-1": { sources: ["nature:plant_bushLarge"], largeur: 2.5, couleurs: FEUILLAGE },
  "buisson-2": { sources: ["nature:plant_bushDetailed"], largeur: 2.5, couleurs: FEUILLAGE },
  "feu-de-camp": { sources: ["nature:campfire_stones", "nature:campfire_logs"], largeur: 2.5, couleurs: { stone: "#8a857c" } },
  // Le Bois perdu (labyrinthe) : des arbres verts, serrés et moussus.
  "arbre-vert-1": { sources: ["nature:tree_default"], hauteur: 11, couleurs: VERT },
  "arbre-vert-2": { sources: ["nature:tree_oak"], hauteur: 10, couleurs: VERT_SOMBRE },
  "arbre-vert-3": { sources: ["nature:tree_detailed"], hauteur: 12, couleurs: VERT },
  "arbre-vert-4": { sources: ["nature:tree_fat"], hauteur: 9, couleurs: VERT_SOMBRE },
  "arbre-dore-4": { sources: ["nature:tree_cone_fall"], hauteur: 9, couleurs: DORE_ROUX },
  "arbre-dore-5": { sources: ["nature:tree_tall_fall"], hauteur: 12, couleurs: DORE_ROUX },
  "arbre-dore-6": { sources: ["nature:tree_fat_fall"], hauteur: 8, couleurs: DORE_PALE },
  "pin-enneige-3": { sources: ["nature:tree_pineRoundA"], hauteur: 10, couleurs: GIVRE },
  "pin-enneige-4": { sources: ["nature:tree_pineSmallA"], hauteur: 6, couleurs: GIVRE },
  "pin-enneige-5": { sources: ["nature:tree_pineGroundA"], hauteur: 4, couleurs: NEIGE },

  // Sol : herbes hautes, fleurs, souches, troncs, champignons (voir SEMIS dans src/world/Decor.tsx)
  "herbe-1": { sources: ["nature:grass_large"], hauteur: 0.7, couleurs: { grass: "#8f9a46" } },
  "herbe-2": { sources: ["nature:grass_leafsLarge"], hauteur: 0.35, couleurs: { grass: "#9a9a4c" } },
  "fleur-jaune": { sources: ["nature:flower_yellowA"], hauteur: 0.5, couleurs: { grass: "#6f7a36" } },
  "fleur-rouge": { sources: ["nature:flower_redA"], hauteur: 0.5, couleurs: { grass: "#6f7a36" } },
  "fleur-violette": { sources: ["nature:flower_purpleA"], hauteur: 0.5, couleurs: { grass: "#6f7a36" } },
  "fleur-jaune-2": { sources: ["nature:flower_yellowB"], hauteur: 0.4, couleurs: { grass: "#6f7a36" } },
  "fleur-rouge-2": { sources: ["nature:flower_redB"], hauteur: 0.45, couleurs: { grass: "#6f7a36" } },
  "fleur-violette-2": { sources: ["nature:flower_purpleB"], hauteur: 0.4, couleurs: { grass: "#6f7a36", colorPurple: "#7f9be0" } },
  "fleur-blanche": { sources: ["nature:flower_yellowA"], hauteur: 0.5, couleurs: { grass: "#6f7a36", colorYellow: "#f2efe6" } },
  souche: { sources: ["nature:stump_old"], largeur: 1.2, couleurs: { woodBark: "#5a4230" } },
  tronc: { sources: ["nature:log_large"], largeur: 3.2, couleurs: { woodBark: "#5a4230", woodInner: "#b08a5a" } },
  "champignon-1": { sources: ["nature:mushroom_redGroup"], hauteur: 0.7, couleurs: { colorRed: "#8a5fa8" } },
  "champignon-2": { sources: ["nature:mushroom_tanGroup"], hauteur: 0.6, couleurs: { colorTan: "#7a6a9a" } },

  // Avant-poste, ports et champ de bataille
  // Pierre crème et toit brun-rouge : assortie aux murs du fort (Castle Kit).
  "tour-guet": { sources: ["pirate:tower-complete-large"], hauteur: 18, couleurs: { colormap: "#f2e2c4" } },
  canon: { sources: ["pirate:cannon"], largeur: 3.5 },
  drapeau: { sources: ["pirate:flag-high"], hauteur: 7 },
  "epave-corne": { sources: ["pirate:ship-wreck"], largeur: 16 },
  caisse: { sources: ["pirate:crate"], largeur: 1.4 },
  tonneau: { sources: ["pirate:barrel"], hauteur: 1.2 },
  "ruine-mur": { sources: ["castle:wall-half"], hauteur: 6, couleurs: PIERRE_RUINE, uni: true },
  "ruine-tour": { sources: ["castle:tower-square-base"], hauteur: 5, couleurs: PIERRE_RUINE, uni: true },
  "ruine-colonne": { sources: ["nature:statue_columnDamaged"], hauteur: 4, couleurs: PIERRE },
  "catapulte-detruite": { sources: ["castle:siege-catapult-demolished"], largeur: 6 },

  // Maisons (Fantasy Town Kit), aux couleurs de leur région. Les tailles des substituts dans monde.ts correspondent.
  "maison-village-1": { pieces: maison({ largeur: 3, etages: 2, bas: "wall", haut: "wall-wood", couleurToit: "#7a3f2c" }), echelle: TUILE, palette: PALETTE_VILLAGE },
  "maison-village-2": { pieces: maison({ largeur: 4, etages: 2, bas: "wall", haut: "wall-wood", couleurToit: "#6a3828" }), echelle: TUILE, palette: PALETTE_VILLAGE },
  "maison-village-3": { pieces: maison({ largeur: 3, etages: 2, bas: "wall", cheminee: false, couleurToit: "#8c4a32" }), echelle: TUILE, palette: PALETTE_VILLAGE },
  "maison-volcan-1": { pieces: maison({ largeur: 3, etages: 2, bas: "wall", fenetre: "-window-small", couleurToit: "#33302e" }), echelle: TUILE, couleurs: MURS_VOLCAN },
  "maison-volcan-2": { pieces: maison({ largeur: 4, etages: 1, bas: "wall", fenetre: "-window-small", couleurToit: "#3d3431" }), echelle: TUILE, couleurs: MURS_VOLCAN },
  "maison-volcan-3": { pieces: maison({ largeur: 2, etages: 3, bas: "wall", fenetre: "-window-stone", couleurToit: "#4a2a22" }), echelle: TUILE, couleurs: MURS_VOLCAN },
  "maison-atlante-1": { pieces: maison({ largeur: 3, etages: 1, bas: "wall", toit: "roof", fenetre: "-window-round" }), echelle: TUILE, couleurs: MURS_ATLANTE },
  "maison-atlante-2": { pieces: maison({ largeur: 2, etages: 2, bas: "wall", toit: "roof", fenetre: "-window-round" }), echelle: TUILE, couleurs: MURS_ATLANTE },
  "maison-atlante-3": { pieces: maison({ largeur: 4, etages: 1, bas: "wall", toit: "roof", fenetre: "-window-round", cheminee: false }), echelle: TUILE, couleurs: MURS_ATLANTE },
  "maison-vent-1": { pieces: maison({ largeur: 2, etages: 3, bas: "wall", haut: "wall-wood", couleurToit: "#c49a4a" }), echelle: TUILE, couleurs: MURS_VENT },
  "maison-vent-2": { pieces: maison({ largeur: 3, etages: 2, bas: "wall-wood", couleurToit: "#b08a3e" }), echelle: TUILE, couleurs: MURS_VENT },
  "maison-vent-3": { pieces: maison({ largeur: 2, etages: 2, bas: "wall-wood", fenetre: "-window-small", couleurToit: "#d2a95a" }), echelle: TUILE, couleurs: MURS_VENT },
  "hutte-sorciere-1": { pieces: maison({ largeur: 2, etages: 1, bas: "wall-wood", cheminee: false, couleurToit: "#2c2238" }), echelle: TUILE, couleurs: MURS_SORCIERE },
  "hutte-sorciere-2": { pieces: maison({ largeur: 2, etages: 1, bas: "wall-wood", fenetre: "-window-round", couleurToit: "#3a2a4a" }), echelle: TUILE, couleurs: MURS_SORCIERE },
  "hutte-sorciere-3": { pieces: maison({ largeur: 1, etages: 2, bas: "wall-wood", fenetre: "-window-round", cheminee: false, couleurToit: "#2c2238" }), echelle: TUILE, couleurs: MURS_SORCIERE },
  // Demeures des dirigeants : plus grandes, des tourelles, des toits qu'on reconnaît de loin.
  "cahute-maitre": {
    pieces: maison({ largeur: 4, etages: 2, bas: "wall", haut: "wall-wood", fenetre: "-window-round", couleurToit: "#c9a24a", tourelles: [{ cote: -1, etages: 3 }, { cote: 1, etages: 3 }] }),
    echelle: TUILE,
    couleurs: { colormap: "#f6ecd2" },
  },
  "cabane-reine": {
    pieces: maison({ largeur: 3, etages: 2, bas: "wall-wood", fenetre: "-window-round", couleurToit: "#2c2238", tourelles: [{ cote: 1, etages: 4 }] }),
    echelle: TUILE,
    couleurs: MURS_SORCIERE,
  },
  "demeure-volcan": {
    pieces: maison({ largeur: 4, etages: 2, bas: "wall", fenetre: "-window-stone", couleurToit: "#5a1e14", tourelles: [{ cote: -1, etages: 3 }, { cote: 1, etages: 3 }] }),
    echelle: TUILE,
    couleurs: MURS_VOLCAN,
  },
  "palais-givre": { pieces: palais(), echelle: 8, couleurs: { colormap: "#d8eef9" }, uni: true },

  // Monastère de l'iceberg : de la glace bleue, éclairée de l'intérieur (halo dans Lueurs.tsx).
  "monastere-glace": { pieces: monastere(), echelle: 7, couleurs: { colormap: "#bfe4f5" }, uni: true },
  // Hameau des Pêcheurs : petites cabanes de bois aux toits de couleur, et des pontons.
  "cabane-peche-1": { pieces: maison({ largeur: 2, bas: "wall-wood", toit: "roof", couleurToit: "#c2453a" }), echelle: TUILE, couleurs: { colormap: "#e8d8c0" } },
  "cabane-peche-2": { pieces: maison({ largeur: 2, bas: "wall-wood", toit: "roof", couleurToit: "#3a78b0", cheminee: false }), echelle: TUILE, couleurs: { colormap: "#d8e4ec" } },
  "cabane-peche-3": { pieces: maison({ largeur: 2, bas: "wall-wood", toit: "roof", couleurToit: "#e0b03a", fenetre: "-window-round" }), echelle: TUILE, couleurs: { colormap: "#f0e2c8" } },
  ponton: { sources: ["pirate:structure-platform-dock"], largeur: 5 },

  // Ruines de la Corne : pierre noircie, bois brûlé.
  "maison-ruine-1": { pieces: ruine(1), echelle: TUILE, couleurs: { colormap: "#9a8f80" } },
  "maison-ruine-2": { pieces: ruine(2), echelle: TUILE, couleurs: { colormap: "#8a8070" } },
  "etendard-corne": { sources: ["pirate:flag-high"], hauteur: 6, couleurs: { colormap: "#9a5a50" } },

  // Village blanc : potagers, et le mobilier des places et des chemins.
  potager: {
    pieces: potager(),
    echelle: 2.1,
    couleurs: { dirt: "#7a5a3a", dirtDark: "#5e4430", grass: "#6f8a3a", leafsFall: "#d98a2a", wood: "#8a6a44", woodDark: "#6a4e32", woodInner: "#d8c070", _defaultMat: "#c9a84a" },
  },
  cloture: { sources: ["nature:fence_simple"], largeur: 2.2, couleurs: { wood: "#8a6a44", woodDark: "#6a4e32" } },
  "botte-foin": { sources: ["graveyard:hay-bale"], largeur: 1.6, couleurs: { colormap: "#d8b45a" }, uni: true },
  banc: { sources: ["graveyard:bench"], largeur: 1.8 },
  panneau: { sources: ["survival:signpost"], hauteur: 2.6 },
  marmite: { sources: ["survival:campfire-stand"], largeur: 2.2 },
  coffre: { sources: ["survival:chest"], largeur: 1 },
  seau: { sources: ["survival:bucket"], hauteur: 0.5 },
  "stele-moussue": { sources: ["graveyard:gravestone-round"], hauteur: 1.6, couleurs: { colormap: "#a8b090" } },
  brasero: { sources: ["graveyard:fire-basket"], largeur: 1.2 },
  tente: { sources: ["survival:tent-canvas"], largeur: 3.5 },
  enclume: { sources: ["survival:workbench-anvil"], largeur: 1.4 },
  fantome: { sources: ["graveyard:character-ghost"], hauteur: 2.2, couleurs: { colormap: "#cfe8f5" } },
  citrouille: { sources: ["graveyard:pumpkin"], largeur: 0.9 },
  chaudron: { sources: ["graveyard:urn-round"], hauteur: 1.2, couleurs: { colormap: "#3a3a42" } },
  banniere: { sources: ["castle:flag-banner-long"], hauteur: 4.5, couleurs: { colormap: "#b04a3a" } },
  barque: { sources: ["pirate:ship-small"], largeur: 9 },
  "barque-rames": { sources: ["pirate:boat-row-large"], largeur: 3.2 },
  "rocher-glace-1": { sources: ["nature:stone_largeA"], largeur: 3, couleurs: { stone: "#b8d0dc", _defaultMat: "#b8d0dc" } },
  "rocher-glace-2": { sources: ["nature:stone_largeC"], largeur: 3, couleurs: { stone: "#c4dae4", _defaultMat: "#c4dae4" } },
  "rocher-glace-3": { sources: ["nature:stone_largeD"], largeur: 3, couleurs: { stone: "#aac6d4", _defaultMat: "#aac6d4" } },

  // Village (Fantasy Town Kit)
  fontaine: { sources: ["town:fountain-round-detail"], largeur: 6 },
  etal: { sources: ["town:stall-red"], largeur: 3 },
  "etal-vert": { sources: ["town:stall-green"], largeur: 3 },
  charrette: { sources: ["town:cart"], largeur: 3.5 },
  lanterne: { sources: ["town:lantern"], hauteur: 2.6, couleurs: { colormap: "#5a4c44" } },

  // Remparts : un mur de 8 m de long, et une tour (voir REMPARTS dans src/content/monde.ts)
  "rempart-mur": { sources: ["castle:wall"], largeur: 8, couleurs: PIERRE_CLAIRE, uni: true },
  "rempart-tour": { sources: ["castle:tower-square-base", "castle:tower-square-mid", "castle:tower-square-top"], empiler: true, largeur: 9, couleurs: PIERRE_CLAIRE, uni: true },
  "rempart-glace-mur": { sources: ["castle:wall"], largeur: 8, couleurs: GLACE, uni: true },
  "rempart-glace-tour": {
    sources: ["castle:tower-square-base", "castle:tower-square-mid", "castle:tower-square-top"],
    empiler: true,
    largeur: 9,
    couleurs: GLACE,
    uni: true,
  },
};

/** Le modèle s'enfonce un peu dans le sol : le terrain n'est jamais parfaitement plat. */
const ENFONCEMENT = 0.15;

const lineaire = (hex) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

const [, , sortie, ...args] = process.argv;
const packs = Object.fromEntries(args.filter((a) => a.includes("=")).map((a) => a.split(/=(.*)/s).slice(0, 2)));
const choisis = args.filter((a) => !a.includes("="));
if (!sortie || !Object.keys(packs).length) {
  console.error("Usage : node scripts/preparer-pack.mjs <dossier de sortie> nature=<dossier> pirate=<dossier> castle=<dossier> [modèle…]");
  process.exit(1);
}
mkdirSync(sortie, { recursive: true });
const io = new NodeIO();

for (const [nom, r] of Object.entries(RECETTES)) {
  if (choisis.length && !choisis.includes(nom)) continue;
  const pack = (s) => packs[s.split(":")[0]];
  r.sources ??= [...new Set(r.pieces.map((p) => p.source))];
  if (!r.sources.every(pack)) {
    console.log(`${nom} : ignoré (pack ${r.sources.map((s) => s.split(":")[0]).join(", ")} non fourni)`);
    continue;
  }
  const doc = new Document();
  const piecesColorees = new Map();
  if (r.pieces) {
    // Assemblage : chaque pièce sous un nœud qui la place, la tourne (et la retourne en miroir).
    const scene = doc.createScene();
    for (const p of r.pieces) {
      const avant = doc.getRoot().listScenes().length;
      const matieresAvant = new Set(doc.getRoot().listMaterials());
      mergeDocuments(doc, await io.read(join(pack(p.source), `${p.source.split(":")[1]}.glb`)));
      // Couleur propre à la pièce (le toit) : appliquée après les couleurs de la recette.
      if (p.couleur) for (const m of doc.getRoot().listMaterials()) if (!matieresAvant.has(m)) piecesColorees.set(m, p.couleur);
      const groupe = doc
        .createNode()
        .setTranslation(p.pos)
        .setRotation([0, Math.sin(p.rot / 2), 0, Math.cos(p.rot / 2)])
        .setScale(p.echelle);
      for (const sc of doc.getRoot().listScenes().slice(avant)) {
        for (const n of sc.listChildren()) (sc.removeChild(n), groupe.addChild(n));
        sc.dispose();
      }
      scene.addChild(groupe);
    }
  }
  let base = 0;
  for (const s of r.pieces ? [] : r.sources) {
    const morceau = await io.read(join(pack(s), `${s.split(":")[1]}.glb`));
    // Empilés : chaque morceau commence là où le précédent s'arrête.
    if (r.empiler) {
      const b = getBounds(morceau.getRoot().listScenes()[0]);
      for (const n of morceau.getRoot().listScenes()[0].listChildren()) {
        const [x, y, z] = n.getTranslation();
        n.setTranslation([x, y + base - b.min[1], z]);
      }
      base += b.max[1] - b.min[1];
    }
    mergeDocuments(doc, morceau);
  }
  const racine = doc.getRoot();
  await doc.transform(unpartition());

  // Une seule scène, avec tout le contenu sous un nœud qui porte l'échelle et le recentrage.
  const scenes = racine.listScenes();
  const scene = scenes[0];
  const pivot = doc.createNode(nom);
  for (const autre of scenes) {
    for (const n of autre.listChildren()) {
      autre.removeChild(n);
      pivot.addChild(n);
    }
    if (autre !== scene) autre.dispose();
  }
  scene.addChild(pivot);
  racine.setDefaultScene(scene);

  for (const m of racine.listMeshes())
    for (const p of m.listPrimitives()) if (r.retirer?.includes(p.getMaterial()?.getName())) p.dispose();

  // Matières éclairées (le pack les veut « unlit ») et couleurs du monde.
  for (const e of racine.listExtensionsUsed()) e.dispose();
  for (const m of racine.listMaterials()) {
    m.setRoughnessFactor(0.95).setMetallicFactor(0);
    const c = r.couleurs?.[m.getName()];
    if (c) m.setBaseColorFactor([...lineaire(c), 1]);
    // Assemblage : les pièces retournées en miroir (pignons) doivent rester visibles une fois aplaties.
    if (r.pieces) m.setDoubleSided(true);
    // Couleur unie : la texture du pack (orangée pour Castle Kit) est retirée.
    if (c && r.uni) m.setBaseColorTexture(null);
    if (piecesColorees.has(m)) m.setBaseColorFactor([...lineaire(piecesColorees.get(m)), 1]).setBaseColorTexture(null);
  }

  // Palette : chaque aplat de la texture prend sa nouvelle couleur.
  if (r.palette) {
    const remplacer = Object.entries(r.palette).map(([de, vers]) => [[1, 3, 5].map((i) => parseInt(de.slice(i, i + 2), 16)), [1, 3, 5].map((i) => parseInt(vers.slice(i, i + 2), 16))]);
    for (const t of racine.listTextures()) {
      const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4)
        for (const [de, vers] of remplacer)
          if (Math.abs(data[i] - de[0]) + Math.abs(data[i + 1] - de[1]) + Math.abs(data[i + 2] - de[2]) < 18) {
            [data[i], data[i + 1], data[i + 2]] = vers;
            break;
          }
      t.setImage(new Uint8Array(await sharp(data, { raw: info }).png().toBuffer())).setMimeType("image/png");
    }
  }

  const b = getBounds(scene);
  const taille = r.echelle ?? (r.hauteur ? r.hauteur / (b.max[1] - b.min[1]) : r.largeur / Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]));
  pivot.setScale([taille, taille, taille]);
  pivot.setTranslation([-((b.min[0] + b.max[0]) / 2) * taille, -b.min[1] * taille - ENFONCEMENT, -((b.min[2] + b.max[2]) / 2) * taille]);

  for (const n of racine.listNodes()) if (!n.getMesh() && !n.listChildren().length && n !== pivot) n.dispose();
  await io.write(join(sortie, `${nom}.glb`), doc);
  const f = getBounds(scene);
  console.log(`${nom} : ${f.max.map((v, i) => (v - f.min[i]).toFixed(1)).join(" × ")} m`);
}
