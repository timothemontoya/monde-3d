// ═══════════════════════════════════════════════════════════════════════════
//  CONTENU DU MONDE
//
//  Tout ce qui fait l'histoire est ici : zones, barrières, indices, énigmes, succès.
//  Le monde actuel est PROVISOIRE : il sert à tester le moteur en attendant ton histoire.
//
//  Repère : le monde fait 1 000 m × 1 000 m, centré sur (0, 0).
//  x va d'ouest (-500) en est (+500), z de nord (-500) en sud (+500).
// ═══════════════════════════════════════════════════════════════════════════

import type { Barriere, Enigme, Indice, Pos, Succes, Zone } from "./types";

/** Point sur le cercle d'une zone : direction en degrés (0 = est, 90 = sud, 180 = ouest, 270 = nord). */
function surLeBord(centre: Pos, rayon: number, direction: number): Pos {
  const a = (direction * Math.PI) / 180;
  return [centre[0] + rayon * Math.cos(a), centre[1] + rayon * Math.sin(a)];
}

const BRUMEVAL: Pos = [-170, 40];
const SANCTUAIRE: Pos = [250, -20];

/** Réglages du déplacement. */
export const REGLAGES = {
  /** Point d'apparition [x, z]. */
  depart: [40, 330] as [number, number],
  /** Vitesse normale et vitesse rapide (Maj), en m/s. */
  vitesse: 14,
  vitesseRapide: 32,
  /** Hauteur des yeux au-dessus du sol, en m. */
  hauteurYeux: 1.7,
  /** Altitude maximale au-dessus du sol, en m. Les remparts doivent être plus hauts que ça. */
  volMax: 7,
  /** Rayon de l'île : au-delà, une tempête permanente ceinture le monde. */
  rayonMonde: 470,
};

export const ZONES: Zone[] = [
  {
    id: "promontoire",
    nom: "Le Promontoire",
    sousTitre: "Là où tout commence",
    centre: [40, 300],
    rayon: 120,
    ambiance: { brume: "#d9b98a", densite: 0.0042, lumiere: "#ffd59a" },
  },
  {
    id: "brumeval",
    nom: "Brumeval",
    sousTitre: "Un village aux portes closes",
    centre: BRUMEVAL,
    rayon: 95,
    plateau: 6,
    enceinte: { hauteur: 15, ouverture: 50, largeurOuverture: 9 },
    ambiance: { brume: "#b9a98f", densite: 0.0055, lumiere: "#ffcf8a" },
  },
  {
    id: "terres-orageuses",
    nom: "Terres orageuses",
    sousTitre: "Le vent y garde ses secrets",
    centre: [10, -300],
    rayon: 170,
    ambiance: { brume: "#5d6474", densite: 0.009, lumiere: "#9fb0d0" },
  },
  {
    id: "sanctuaire",
    nom: "Sanctuaire de l'Arbre d'Or",
    sousTitre: "Au pied de l'Arbre",
    centre: SANCTUAIRE,
    rayon: 110,
    plateau: 14,
    enceinte: { hauteur: 18, ouverture: 160, largeurOuverture: 14 },
    ambiance: { brume: "#f0c76a", densite: 0.0035, lumiere: "#ffe0a0" },
  },
];

export const BARRIERES: Barriere[] = [
  {
    id: "porte-brumeval",
    type: "porte",
    position: surLeBord(BRUMEVAL, 95, 50),
    angle: 50,
    largeur: 9,
    message: "La porte du village est scellée par un cadran.",
    condition: { enigme: "cadran-brumeval" },
  },
  {
    id: "tempete-nord",
    type: "tempete",
    position: [0, -140],
    angle: 90,
    largeur: 960,
    message: "Une tempête furieuse barre la route du nord.",
    condition: { indices: ["chant-du-vent"] },
  },
  {
    id: "brume-sanctuaire",
    type: "brume",
    position: surLeBord(SANCTUAIRE, 110, 160),
    angle: 160,
    largeur: 14,
    message: "Un voile doré refuse le passage. Il faut comprendre avant d'entrer.",
    condition: { indices: ["stele-depart", "chant-du-vent", "tablette-orage"] },
  },
];

export const INDICES: Indice[] = [
  {
    id: "stele-depart",
    zone: "promontoire",
    objet: "stele",
    position: [70, 270],
    titre: "Stèle du Promontoire",
    texte:
      "« Trois lunes ont passé depuis que les portes se sont fermées. Celui qui revient doit se souvenir : un pour l'aube, quatre pour la braise, sept pour la nuit. »",
    liens: ["chant-du-vent"],
  },
  {
    id: "chant-du-vent",
    zone: "brumeval",
    objet: "livre",
    position: [-190, 55],
    titre: "Le registre du village",
    texte:
      "« Le vent du nord ne se tait que pour qui connaît son nom. Nous l'avons gravé sur la fontaine avant de fuir : Aster. »",
    liens: ["stele-depart", "tablette-orage"],
  },
  {
    id: "tablette-orage",
    zone: "terres-orageuses",
    objet: "braise",
    position: [-20, -330],
    titre: "Braise au cœur de l'orage",
    texte: "Une braise qui ne s'éteint pas. Elle pulse au rythme de l'Arbre, loin à l'est, comme si elle voulait y retourner.",
    liens: ["chant-du-vent"],
  },
];

export const ENIGMES: Enigme[] = [
  {
    id: "cadran-brumeval",
    position: surLeBord(BRUMEVAL, 106, 58),
    titre: "Le cadran de la porte",
    question: "Trois encoches attendent une combinaison.",
    solution: "147",
  },
];

export const SUCCES: Succes[] = [
  { id: "premiers-pas", titre: "Premiers pas", description: "Découvrir le Promontoire.", quand: { zones: ["promontoire"] } },
  { id: "village", titre: "Les portes s'ouvrent", description: "Entrer dans Brumeval.", quand: { barrieres: ["porte-brumeval"] } },
  { id: "oeil-de-la-tempete", titre: "L'œil de la tempête", description: "Calmer le vent du nord.", quand: { barrieres: ["tempete-nord"] } },
  { id: "arbre", titre: "Sous l'Arbre d'Or", description: "Franchir le voile doré.", quand: { barrieres: ["brume-sanctuaire"] } },
  { id: "archiviste", titre: "Archiviste", description: "Trouver tous les indices.", secret: true, quand: { indices: "tous" } },
];
