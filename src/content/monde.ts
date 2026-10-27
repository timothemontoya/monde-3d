// ═══════════════════════════════════════════════════════════════════════════
//  CONTENU DU MONDE
//
//  La forme du monde vient de ta carte : public/carte.jpg (1920 × 1080).
//    - chaque couleur = une région (voir REGIONS)
//    - le blanc relié au bord de l'image = la mer
//    - le cadre en haut à droite (Scìyolia) est ignoré : c'est un autre monde
//  Pour changer la forme du monde, il suffit de remplacer l'image.
//
//  Toutes les positions sont en PIXELS DE LA CARTE. 1 pixel = 1,5 m dans le jeu.
//  Les éléments marqués « PROVISOIRE » servent à tester : remplace-les par ton histoire.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  Barriere,
  Bois,
  Chemin,
  Crete,
  DecorUnique,
  Enigme,
  Espece,
  Feu,
  FrontiereMagique,
  Indice,
  Lieu,
  Massif,
  Objet,
  Pont,
  Port,
  Ramassable,
  Region,
  Rempart,
  Succes,
  Usage,
  Village,
  Volcan,
} from "./types";

export const REGLAGES = {
  /** Image de la carte (dans public/). */
  carte: "carte.jpg",
  /** Mètres par pixel de carte : règle la taille du monde. */
  metresParPixel: 1.5,
  /** Cadre à ignorer sur la carte (Scìyolia) : [x, y, largeur, hauteur] en pixels. */
  ignorer: [1385, 0, 535, 415] as [number, number, number, number],
  /** Point de départ (village blanc), un peu au sud du feu de camp. */
  depart: [1000, 645] as [number, number],
  /** Vitesse normale et rapide (Maj), en m/s. */
  vitesse: 10,
  vitesseRapide: 28,
  hauteurYeux: 1.7,
  /** Altitude maximale au-dessus du sol, en m. Les remparts et falaises doivent être plus hauts. */
  volMax: 7,
  /** Pente maximale qu'on peut gravir (mètres de montée par mètre parcouru). Au-delà : falaise. */
  penteMax: 1.6,
  /** Distance qu'on peut faire dans l'eau depuis la côte, en m. Au-delà, il faut un bateau. */
  eauMax: 10,
};

// ─── Régions (une par couleur de la carte) ──────────────────────────────────

export const REGIONS: Region[] = [
  {
    id: "village-blanc",
    nom: "Le Village blanc",
    couleur: "#ffffff",
    point: [1000, 620],
    sousTitre: "Là où tout commence",
    relief: { altitude: 5, amplitude: 4.5, montagne: 0.1 },
    ambiance: { brume: "#e6dcc6", densite: 0.0014, lumiere: "#ffe6b8" },
    vegetation: "foret-doree",
    sol: ["#a8a15a", "#8c857a"],
    lore: [
      { texte: "Un village paisible à l'est du continent, à l'abri de ses remparts. On y arrive sans savoir pourquoi." },
      { texte: "Une seule porte s'ouvre dans les remparts : celle du chemin du commencement.", quand: { lieux: ["chemin-commencement"] } },
    ],
  },
  {
    id: "terres-libres",
    nom: "Les Terres libres",
    couleur: "#b7c7a3",
    sousTitre: "Terres de personne",
    relief: { altitude: 6, amplitude: 8, montagne: 0.15 },
    ambiance: { brume: "#d8c08f", densite: 0.0016, lumiere: "#ffd59a" },
    vegetation: "foret-doree",
    sol: ["#9c9a4c", "#7d776c"],
    lore: [
      { texte: "Personne ne tient ces terres. Elles touchent toutes les autres régions du continent." },
      { texte: "On y trouve pourtant des traces : des choses que personne n'a réclamées.", quand: { lieux: ["pic-hippocampe"] } },
    ],
  },
  {
    id: "cite-volcanique",
    nom: "La Cité volcanique",
    couleur: "#926a6b",
    sousTitre: "Sous la cendre",
    relief: { altitude: 12.5, amplitude: 22.5, montagne: 0.7 },
    ambiance: { brume: "#8a5a48", densite: 0.0028, lumiere: "#ffb27a", ciel: "#ffcfa8", sol: "#3a2a24" },
    vegetation: "arbres-morts",
    sol: ["#4a3b36", "#2c2626"],
    neige: false,
    lore: [
      { texte: "Une cité bâtie dans l'ombre du volcan, sur l'île au nord." },
      { texte: "Elle affronta l'archipel des Atlantes lors de la bataille de la Corne.", quand: { lieux: ["bataille-corne"] } },
    ],
  },
  {
    id: "ile-volcan",
    nom: "L'Île du volcan",
    couleur: "#926a6b",
    point: [440, 60],
    sousTitre: "Le cœur brûlant",
    relief: { altitude: 10, amplitude: 7.5, montagne: 0.4 },
    ambiance: { brume: "#7a4a3a", densite: 0.0035, lumiere: "#ff9a5a", ciel: "#ffcfa8", sol: "#3a2a24" },
    vegetation: "aucune",
    sol: ["#3a2e2a", "#221c1c"],
    neige: false,
    lore: [{ texte: "Le volcan qui fait vivre la cité, et qui pourrait la détruire." }],
  },
  {
    id: "glace",
    nom: "Les Terres de glace",
    couleur: "#c6f5ff",
    sousTitre: "Le froid qui garde",
    relief: { altitude: 15, amplitude: 17.5, montagne: 0.5 },
    ambiance: { brume: "#cfe3ee", densite: 0.0024, lumiere: "#e8f2ff", ciel: "#dfeaff", sol: "#7d8f9c" },
    vegetation: "pins-enneiges",
    sol: ["#e9f1f5", "#9fb2bd"],
    lore: [
      { texte: "Une terre blanche et silencieuse. Au nord, dit-on, se dresse un palais de givre." },
      { texte: "Un mur de givre ferme le col qui mène au palais.", quand: { lieux: ["col-givre"] } },
    ],
  },
  {
    id: "iceberg",
    nom: "L'Iceberg creux",
    couleur: "#c6f5ff",
    point: [776, 252],
    sousTitre: "Vide à l'intérieur",
    relief: { altitude: 11, amplitude: 2, montagne: 0 },
    ambiance: { brume: "#d6ecf4", densite: 0.0024, lumiere: "#eef8ff", ciel: "#dfeaff", sol: "#7d8f9c" },
    vegetation: "aucune",
    sol: ["#f2f8fb", "#bcd0da"],
    lore: [
      { texte: "Un iceberg échoué. On dit qu'il est creux." },
      { texte: "À l'intérieur dort un portail de téléportation. Personne ne sait comment y entrer." },
    ],
  },
  {
    id: "foret-sorcieres",
    nom: "La Forêt des sorcières",
    couleur: "#834d7f",
    sousTitre: "La cité des sorcières obscures",
    relief: { altitude: 4, amplitude: 3.5, montagne: 0.05 },
    ambiance: { brume: "#4b3d60", densite: 0.0062, lumiere: "#c4a8f4", ciel: "#c9b4f0", sol: "#3a2e44" },
    vegetation: "foret-sombre",
    sol: ["#4d4a34", "#57505f"],
    lore: [
      { texte: "Une forêt où la lumière peine à entrer. Ses côtes sont noyées sous une brume magique." },
      {
        texte: "Les sorcières y ont appris des Scìyoliens les bases de la magie spatiale, en échange d'un sort de protection.",
        quand: { indices: ["pacte"] },
      },
    ],
  },
  {
    id: "montagne-vent",
    nom: "La Cité des montagnes et du vent",
    couleur: "#f7f294",
    sousTitre: "Là où le vent décide",
    relief: { altitude: 25, amplitude: 35, montagne: 0.65 },
    ambiance: { brume: "#e2d6b0", densite: 0.0015, lumiere: "#fff0c8" },
    vegetation: "rochers",
    sol: ["#b3a56a", "#9a9284"],
    lore: [{ texte: "Des sommets battus par les vents, et une cité accrochée à leurs flancs." }],
  },
  {
    id: "atlantes",
    nom: "L'Archipel des Atlantes",
    couleur: "#78918d",
    sousTitre: "Trois îles et des ponts dans le vide",
    relief: { altitude: 22.5, amplitude: 12.5, montagne: 0.3 },
    ambiance: { brume: "#9fc0c2", densite: 0.0018, lumiere: "#e8fff6" },
    vegetation: "foret-doree",
    sol: ["#6f8f6a", "#7d8a88"],
    lore: [
      { texte: "Trois îles reliées par des ponts suspendus au-dessus du vide." },
      {
        texte: "Chacune porte le nom d'un visage de la divinité aux trois faces : Oclène l'abondance, Selenne l'espoir, Eregone la chance.",
        quand: { lieux: ["ile-oclene", "ile-selenne", "ile-eregone"] },
      },
      { texte: "Les Atlantes affrontèrent la cité volcanique lors de la bataille de la Corne.", quand: { lieux: ["bataille-corne"] } },
    ],
  },
  {
    id: "elcres-abandonnee",
    nom: "Elcres abandonnée",
    couleur: "#c7c7c7",
    point: [1150, 180],
    sousTitre: "Ce que la maladie a laissé",
    relief: { altitude: 7.5, amplitude: 9, montagne: 0.3 },
    ambiance: { brume: "#8f9488", densite: 0.004, lumiere: "#d8d6c0" },
    vegetation: "arbres-morts",
    sol: ["#77735e", "#6b6a66"],
    lore: [{ texte: "Une terre frappée par une maladie, puis abandonnée. Autrefois, elle comptait deux bouts." }],
  },
  {
    id: "elcres",
    nom: "Elcres",
    couleur: "#c7c7c7",
    point: [1282, 875],
    sousTitre: "La cité close",
    relief: { altitude: 11, amplitude: 2.5, montagne: 0 },
    ambiance: { brume: "#bfbfb8", densite: 0.002, lumiere: "#f2eee2" },
    vegetation: "aucune",
    sol: ["#9a9890", "#7d7b75"],
    lore: [
      { texte: "Les Elcrais s'y sont réfugiés pour fuir la maladie." },
      { texte: "Ils maîtrisent l'art de la transmogrification.", quand: { lieux: ["elcres"] } },
    ],
  },
  {
    // Sans point : tous les autres morceaux gris (l'anneau de montagnes autour d'Elcres).
    id: "elcres-muraille",
    nom: "La Muraille d'Elcres",
    couleur: "#c7c7c7",
    sousTitre: "Personne n'entre",
    relief: { altitude: 100, amplitude: 27.5, montagne: 1 },
    ambiance: { brume: "#a7a8a2", densite: 0.0026, lumiere: "#e6e2d4" },
    vegetation: "rochers",
    sol: ["#8a8780", "#6f6c66"],
    lore: [{ texte: "Une muraille naturelle de montagnes, qui entoure une cité dont personne ne revient." }],
  },
];

// ─── Lieux-dits ─────────────────────────────────────────────────────────────

export const LIEUX: Lieu[] = [
  {
    id: "bataille-corne",
    nom: "La Corne",
    sousTitre: "Champ de bataille",
    position: [140, 240],
    rayon: 100,
    lore: [{ texte: "Ici s'affrontèrent la cité volcanique et les Atlantes." }],
  },
  {
    id: "ancien-village-corne",
    nom: "L'Ancien village de la Corne",
    sousTitre: "En ruine depuis la bataille",
    position: [145, 169],
    rayon: 65,
    lore: [{ texte: "Un village pris entre les deux armées lors de la bataille de la Corne. Il n'en reste que des pierres." }],
  },
  {
    id: "hautes-montagnes",
    nom: "Les Hautes montagnes",
    sousTitre: "Entre la Corne et le volcan",
    position: [300, 85],
    rayon: 70,
    lore: [{ texte: "Des sommets déchiquetés. La route de la Corne en fait le tour." }],
  },
  {
    // Ancien « Pic de l'Hippocampe » : l'id reste le même (sauvegardes, succès).
    id: "pic-hippocampe",
    nom: "L'Avant-poste de l'Hippocampe",
    sousTitre: "Personne ne traverse",
    position: [243, 414],
    rayon: 80,
    lore: [
      { texte: "Des tours de guet surveillent le bras de mer, pour que le volcan et les Atlantes ne s'affrontent plus jamais." },
      { texte: "Leurs canons coulent quiconque tente la traversée en cachette. Tant qu'ils tirent, aucun bateau ne quitte la Corne." },
    ],
  },
  {
    id: "ile-oclene",
    nom: "L'Île d'Oclène",
    sousTitre: "Le visage de l'abondance",
    position: [215, 760],
    rayon: 125,
    lore: [{ texte: "L'île centrale des Atlantes, avec son port et son village." }],
  },
  {
    id: "plage-oclene",
    nom: "La Plage d'Oclène",
    sousTitre: "Sur l'île de l'abondance",
    position: [202, 926],
    rayon: 35,
    lore: [{ texte: "La plage au sud de l'île d'Oclène." }],
  },
  {
    id: "ile-selenne",
    nom: "L'Île de Selenne",
    sousTitre: "Le visage de l'espoir",
    position: [322, 877],
    rayon: 70,
    lore: [{ texte: "L'île de passage, entre Oclène et l'île du maître." }],
  },
  {
    id: "ile-eregone",
    nom: "L'Île d'Eregone",
    sousTitre: "Le visage de la chance",
    position: [347, 786],
    rayon: 70,
    lore: [{ texte: "Ici vit le maître du village, dans une cahute qui ne ressemble à aucune autre." }],
  },
  {
    id: "detroit",
    nom: "Le Détroit",
    sousTitre: "Là où le feu touche la glace",
    position: [608, 92],
    rayon: 55,
    lore: [{ texte: "La cité volcanique et les terres de glace s'y touchent presque. L'air y change sans cesse de température." }],
  },
  {
    id: "royaume-glace",
    nom: "Le Royaume de glace",
    sousTitre: "Où seul siège le roi",
    position: [865, 123],
    rayon: 75,
    lore: [{ texte: "Derrière ses remparts de glace ne siègent que le roi des glaces et ses fantômes." }],
  },
  {
    id: "palais-givre",
    nom: "Le Palais givré",
    sousTitre: "Au bout du froid",
    position: [880, 85],
    rayon: 35,
    lore: [{ texte: "Le palais du roi des glaces, tout au nord." }],
  },
  {
    id: "col-givre",
    nom: "Le Col du givre",
    sousTitre: "Fermé par la glace",
    position: [852, 248],
    rayon: 40,
    lore: [{ texte: "Un mur de givre barre le seul passage vers le nord." }],
  },
  {
    id: "village-sorcieres",
    nom: "Le Village des sorcières",
    sousTitre: "Derrière le portail runique",
    position: [490, 588],
    rayon: 75,
    lore: [{ texte: "Le village des sorcières obscures, au cœur de la forêt." }],
  },
  {
    id: "foret-obscure",
    nom: "La Forêt obscure",
    sousTitre: "Là où la lumière renonce",
    position: [608, 672],
    rayon: 100,
    lore: [{ texte: "La partie la plus dense de la forêt des sorcières." }],
  },
  {
    // Le portail vers Scìyolia est caché dans le sous-sol de la cabane (rien ne le montre).
    id: "cabane-reine",
    nom: "La Cabane de la reine",
    sousTitre: "Le plancher sonne creux",
    position: [524, 466],
    rayon: 35,
    lore: [
      { texte: "La cabane de la reine des sorcières." },
      { texte: "Sous la cabane, une porte vers Scìyolia : c'est elle que les sorcières ont juré de garder.", quand: { indices: ["pacte"] } },
    ],
  },
  {
    id: "chemin-commencement",
    nom: "Le Chemin du commencement",
    sousTitre: "Le premier pas hors des remparts",
    position: [926, 573],
    rayon: 40,
    lore: [{ texte: "Le chemin qui part de la porte du Village blanc." }],
  },
];

// ─── Espèces (PROVISOIRE : exemples) ────────────────────────────────────────

export const ESPECES: Espece[] = [
  {
    id: "cerf-dore",
    nom: "Cerf doré",
    habitat: ["terres-libres", "village-blanc"],
    description: "EXEMPLE. Un cerf au pelage couleur de blé, qui fuit à l'approche des voyageurs.",
    quand: { lieux: ["terres-libres"] },
  },
  {
    id: "salamandre-cendre",
    nom: "Salamandre de cendre",
    habitat: ["cite-volcanique", "ile-volcan"],
    description: "EXEMPLE. Elle vit dans les fissures encore chaudes de la roche.",
    quand: { indices: ["braise-volcan"] },
  },
];

// ─── Reliefs et passages ────────────────────────────────────────────────────

export const VOLCANS: Volcan[] = [{ position: [440, 58], hauteur: 150, rayon: 140 }];

/** Montagnes dessinées : le relief monte de `hauteur` m à l'intérieur de la zone. */
export const MASSIFS: Massif[] = [
  {
    // Les Hautes montagnes, entre la Corne et la cité volcanique.
    zone: [[209, 88], [227, 70], [237, 64], [268, 63], [296, 78], [311, 80], [331, 90], [366, 122], [376, 127], [392, 143], [398, 153], [398, 164], [392, 175], [387, 213], [384, 217], [359, 217], [358, 206], [354, 197], [354, 186], [358, 170], [358, 149], [326, 105], [311, 93], [274, 74], [253, 73], [247, 73], [246, 78], [232, 89], [220, 93], [210, 93]],
    hauteur: 120,
  },
];

export const CRETES: Crete[] = [
  {
    // Sépare le palais givré (nord) du reste des terres de glace ; on passe par le col.
    id: "crete-du-givre",
    points: [
      [815, 262],
      [860, 240],
      [905, 215],
      [960, 190],
    ],
    hauteur: 75,
    largeur: 42,
    cols: [{ position: [852, 244], largeur: 22 }],
  },
];

export const FRONTIERES_MAGIQUES: FrontiereMagique[] = [
  // On n'entre dans la forêt des sorcières que par les terres libres : partout ailleurs,
  // un rideau de brume opaque (côté montagne comme côté mer).
  {
    regions: ["foret-sorcieres", "montagne-vent"],
    message: "Une brume magique repousse chacun de tes pas.",
  },
  {
    regions: ["foret-sorcieres", "mer"],
    message: "La brume magique t'empêche d'accoster.",
  },
];

export const BARRIERES: Barriere[] = [
  {
    id: "mur-de-givre",
    type: "givre",
    position: [852, 244],
    // Face au nord-ouest : perpendiculaire à la crête.
    angle: 244,
    largeur: 24,
    message: "Un mur de givre épais. Peut-être qu'une chaleur suffisante le ferait fondre…",
    // PROVISOIRE : il faut tenir la braise du volcan en main.
    condition: { objetEnMain: "braise" },
  },
  {
    // Ferme le couloir d'eau peu profonde qui contournait la crête par la côte ouest.
    id: "mur-de-givre-cote",
    type: "givre",
    position: [822, 247],
    angle: 270,
    largeur: 26,
    message: "Un mur de givre épais. Peut-être qu'une chaleur suffisante le ferait fondre…",
    condition: { objetEnMain: "braise" },
  },
  {
    id: "muraille-de-glace",
    type: "givre",
    position: [858.5, 313.3],
    angle: 117,
    largeur: 71,
    message: "Une muraille de glace, si épaisse que rien ne semble pouvoir la faire fondre.",
    // Infranchissable : aucune énigme ne porte ce nom.
    condition: { enigmes: ["muraille-de-glace"] },
  },
  {
    // Nom à changer.
    id: "portail-runique",
    type: "sort",
    position: [658, 637],
    angle: 113,
    // Assez large pour que ses deux pointes plongent dans l'eau profonde et dans la frontière des montagnes.
    largeur: 130,
    message: "Un puissant sort barre l'entrée. Au centre, une rune brille faiblement.",
    // PROVISOIRE : fermé tant qu'on ne sait pas comment l'ouvrir (aucun indice ne porte ce nom).
    condition: { indices: ["rune-du-portail"] },
  },
];

// ─── Voyages ────────────────────────────────────────────────────────────────

export const PORTS: Port[] = [
  // L'île du volcan n'a pas de port : on ne l'atteint pas.
  // On ne quitte la Corne qu'une fois l'avant-poste de l'Hippocampe neutralisé (PROVISOIRE : aucune énigme ne le fait encore).
  { id: "port-corne", nom: "Port de la Corne", position: [134, 311], destinations: ["port-atlantes"], quand: { enigmes: ["avant-poste-neutralise"] } },
  { id: "port-atlantes", nom: "Port des Atlantes", position: [233, 652], destinations: ["port-corne"] },
];

export const PONTS: Pont[] = [
  // Archipel des Atlantes : Oclène → Selenne → Eregone, là où tu les as dessinés.
  { entre: [[269, 842], [305, 841]], largeur: 4, exact: true },
  { entre: [[344, 849], [374, 823]], largeur: 4, exact: true },
];

// ─── Villages et cités ──────────────────────────────────────────────────────

export const VILLAGES: Village[] = [
  {
    id: "village-blanc",
    // Dans ses remparts (REMPARTS) : deux anneaux autour de la place du feu, la grand-rue mène à la porte.
    centre: [998, 635],
    rayon: 50,
    nombre: 20,
    modeles: ["maison-village-1", "maison-village-2", "maison-village-3"],
    substitut: { murs: "#d8cfbd", toit: "#7a4a32", taille: [10, 8, 6.4] },
    disposition: { type: "place", anneaux: 3, rues: [[977, 608]] },
  },
  {
    id: "cite-volcanique",
    centre: [420, 235],
    // Pas plus large : au nord-ouest, la montagne monte vite (le sol commun l'entaillerait).
    rayon: 62,
    nombre: 22,
    modeles: ["maison-volcan-1", "maison-volcan-2", "maison-volcan-3"],
    substitut: { murs: "#3d3330", toit: "#5c2c1e", taille: [10.5, 8, 6.4] },
    // Trois anneaux autour de la place ; la route de la Corne arrive par l'ouest.
    disposition: { type: "place", anneaux: 3, rues: [[399, 238]] },
  },
  {
    id: "hameau-atlante",
    centre: [211, 741],
    rayon: 60,
    nombre: 12,
    modeles: ["maison-atlante-1", "maison-atlante-2", "maison-atlante-3"],
    substitut: { murs: "#e8e6dc", toit: "#4f7f86", taille: [8, 8, 6.4] },
    // Une rue : les maisons bordent le chemin qui descend au port.
    disposition: { type: "rue", chemin: "chemin-oclene-port" },
  },
  {
    id: "cite-du-vent",
    centre: [860, 805],
    rayon: 70,
    nombre: 22,
    modeles: ["maison-vent-1", "maison-vent-2", "maison-vent-3"],
    substitut: { murs: "#c8b892", toit: "#8a6a3a", taille: [8, 11, 6.4] },
    // Deux anneaux coupés par deux rues : celle de la piste (nord) et celle de l'est.
    disposition: { type: "place", anneaux: 2, rues: [[856, 778], [900, 790]] },
  },
  {
    id: "campement-sorcieres",
    centre: [490, 588],
    rayon: 36,
    nombre: 10,
    modeles: ["hutte-sorciere-1", "hutte-sorciere-2", "hutte-sorciere-3"],
    substitut: { murs: "#3a2e3c", toit: "#2a2230", taille: [6.2, 6.5, 6.4] },
    // Un cercle de huttes autour du feu.
    disposition: { type: "place", anneaux: 1 },
  },
  {
    // L'ancien village de la Corne : des pans de murs encore debout, autour de l'ancienne place.
    id: "ruines-corne",
    centre: [148, 172],
    rayon: 42,
    nombre: 14,
    modeles: ["maison-ruine-1", "maison-ruine-2"],
    substitut: { murs: "#8a857c", toit: "#6b625a", taille: [6.3, 3, 6.3] },
    disposition: { type: "place", anneaux: 2, rues: [[140, 150], [139, 196]] },
    plateau: false,
  },
];

/**
 * Modèles uniques à poser : invisibles tant que leur fichier n'existe pas (voir ASSETS-BLENDER.md).
 * angle : direction de la façade (0 = est, 90 = sud, 180 = ouest, 270 = nord) · plateforme : rayon
 * de sol aplani (m) · solide : boîte de collision [largeur, hauteur, profondeur] (m) · echelle.
 */
export const DECORS: DecorUnique[] = [
  // Village blanc : la place (fontaine, marché) et les lanternes de la grand-rue.
  { modele: "fontaine", position: [998, 633], plateforme: 5, solide: [6, 1, 6] },
  { modele: "etal", position: [990, 640], angle: 300, solide: [3, 3.7, 3] },
  { modele: "etal-vert", position: [1006, 627], angle: 120, solide: [3, 3.7, 3] },
  { modele: "charrette", position: [1004, 641], angle: 200, solide: [2.3, 1.4, 3.5] },
  { modele: "arbre-dore-1", position: [992, 638] },
  { modele: "arbre-dore-4", position: [1004, 630] },
  { modele: "arbre-dore-6", position: [999, 627] },
  { modele: "lanterne", position: [992, 628] },
  { modele: "lanterne", position: [1005, 637] },
  { modele: "lanterne", position: [994, 643] },
  { modele: "lanterne", position: [1003, 626] },

  // Avant-poste de l'Hippocampe : un fort (REMPARTS) avec une batterie de canons devant le bras de mer.
  { modele: "drapeau", position: [244, 414] },
  { modele: "etal", position: [232, 404], angle: 90, solide: [3, 3.7, 3] },
  { modele: "etal-vert", position: [256, 418], angle: 200, solide: [3, 3.7, 3] },
  { modele: "charrette", position: [248, 424], angle: 30, solide: [2.3, 1.4, 3.5] },
  { modele: "caisse", position: [236, 408], angle: 10, solide: [1.2, 0.8, 1.4] },
  { modele: "caisse", position: [237, 409], angle: 60, solide: [1.2, 0.8, 1.4] },
  { modele: "tonneau", position: [250, 410], solide: [1.3, 1.2, 1.3] },
  { modele: "tonneau", position: [251, 411], solide: [1.3, 1.2, 1.3] },
  { modele: "canon", position: [238, 438], angle: 90, solide: [2.5, 2, 3.5] },
  { modele: "canon", position: [246, 439], angle: 90, solide: [2.5, 2, 3.5] },
  { modele: "canon", position: [254, 439], angle: 90, solide: [2.5, 2, 3.5] },
  { modele: "canon", position: [262, 438], angle: 90, solide: [2.5, 2, 3.5] },
  // Pas de solide tant que le modèle manque (sinon : un mur invisible).
  { modele: "statue-hippocampe", position: [205, 418], angle: 180, plateforme: 6 },

  // Cité volcanique : la demeure du chef, au nord de la place, face au feu.
  {
    modele: "demeure-volcan",
    position: [420, 226],
    angle: 90,
    plateforme: 12,
    solide: [18, 13.8, 6.4],
    substitut: { murs: "#3d3330", toit: "#5a1e14", taille: [18, 13.8, 6.4] },
  },

  // Braseros autour de la place de la cité volcanique.
  { modele: "feu-de-camp", position: [411, 241] },
  { modele: "feu-de-camp", position: [430, 233] },
  { modele: "feu-de-camp", position: [427, 245] },
  { modele: "feu-de-camp", position: [411, 230] },

  // La Corne : l'épave, et les ruines de l'ancien village.
  { modele: "epave-corne", position: [118, 262], angle: 40, solide: [6, 6, 16] },
  { modele: "etendard-corne", position: [139, 225] },
  { modele: "catapulte-detruite", position: [138, 217], angle: 30 },
  // Les colonnes de l'ancienne place (les maisons en ruine sont dans VILLAGES).
  { modele: "ruine-colonne", position: [151, 166], solide: [1.7, 4, 1.7] },
  { modele: "ruine-colonne", position: [155, 172], solide: [1.7, 4, 1.7] },
  { modele: "ruine-colonne", position: [151, 178], solide: [1.7, 4, 1.7] },

  // Atlantes : la cahute du maître (Eregone) et le port d'Oclène.
  {
    modele: "cahute-maitre",
    position: [347, 786],
    angle: 200,
    plateforme: 12,
    solide: [18, 13.8, 6.4],
    substitut: { murs: "#b9d6cf", toit: "#c9a24a", taille: [18, 13.8, 6.4] },
  },
  { modele: "caisse", position: [228, 671], angle: 15, solide: [1.2, 0.8, 1.4] },
  { modele: "caisse", position: [229, 672], angle: 70, solide: [1.2, 0.8, 1.4] },
  { modele: "tonneau", position: [238, 668], solide: [1.3, 1.2, 1.3] },
  { modele: "tonneau", position: [240, 671], solide: [1.3, 1.2, 1.3] },

  // Campement des sorcières : de grands champignons sur la place, deux chaudrons.
  { modele: "champignon-1", position: [482, 586], echelle: 3.2 },
  { modele: "champignon-2", position: [497, 583], echelle: 2.8 },
  { modele: "champignon-1", position: [494, 596], echelle: 2.5 },
  { modele: "champignon-2", position: [484, 595], echelle: 3.4 },
  { modele: "tonneau", position: [492, 591], solide: [1.3, 1.2, 1.3] },
  { modele: "tonneau", position: [487, 582], solide: [1.3, 1.2, 1.3] },
  { modele: "champignon-1", position: [516, 472], echelle: 3 },
  { modele: "champignon-2", position: [533, 474], echelle: 2.6 },
  { modele: "champignon-1", position: [528, 459], echelle: 3.4 },

  // Forêt des sorcières : la cabane de la reine (le portail vers Scìyolia est dans son sous-sol).
  {
    modele: "cabane-reine",
    position: [524, 466],
    angle: 90,
    plateforme: 10,
    solide: [12.3, 16.8, 6.4],
    substitut: { murs: "#3a2e3c", toit: "#5a3a6a", taille: [12.3, 16.8, 6.4] },
  },
];

/** Chemins de terre (largeur en m). */
export const CHEMINS: Chemin[] = [
  {
    // Village blanc : de la porte des remparts à la place du feu.
    id: "grand-rue",
    points: [[977, 608], [985, 618], [992, 627], [996, 632]],
    largeur: 5,
    lanternes: 12,
  },
  {
    id: "chemin-commencement",
    nom: "Le Chemin du commencement",
    // Jusqu'au feu des Terres libres, d'où partent les pistes.
    points: [[977, 608], [964, 601], [938, 592], [930, 584], [926, 573], [919, 563], [906, 555], [900, 545], [887, 533], [865, 525], [845, 519], [820, 511], [800, 505], [775, 497], [750, 486], [725, 476], [700, 470]],
    largeur: 5,
    lanternes: 30,
  },
  {
    // Terres libres → la côte face à la cabane de la reine (la mer sépare : on y entre par la forêt).
    id: "piste-cabane",
    points: [[700, 470], [672, 468], [645, 471], [610, 470], [588, 467]],
    largeur: 3,
  },
  {
    // Terres libres → Terres de glace.
    id: "piste-glace",
    points: [[700, 470], [720, 458], [745, 445], [770, 430], [800, 414], [828, 402]],
    largeur: 3,
  },
  {
    // Terres libres → forêt obscure.
    id: "piste-foret",
    // Elle passe par le centre du portail runique (la forêt est séparée des terres par la mer ailleurs).
    points: [[700, 470], [700, 510], [698, 545], [690, 575], [678, 605], [662, 630], [650, 648], [630, 660], [612, 672], [600, 680]],
    largeur: 3,
  },
  {
    // Terres libres → Cité du vent, par le sud.
    id: "piste-vent",
    points: [[800, 505], [808, 540], [815, 575], [822, 610], [830, 650], [840, 700], [850, 745], [856, 778], [858, 790]],
    largeur: 3,
  },
  {
    // Du port de la Corne à la cité volcanique, en contournant les Hautes montagnes.
    id: "route-corne",
    points: [[138, 309], [135, 283], [119, 235], [125, 209], [139, 196], [140, 158], [145, 133], [149, 129], [155, 128], [171, 129], [199, 107], [214, 105], [230, 97], [247, 96], [253, 82], [268, 80], [284, 89], [295, 91], [304, 99], [310, 111], [312, 132], [321, 142], [326, 144], [326, 154], [338, 170], [338, 187], [328, 213], [328, 223], [338, 233], [353, 235], [360, 244], [370, 250], [380, 250], [399, 238], [424, 239]],
    largeur: 5,
  },
  {
    // Oclène : du pont de Selenne au port.
    id: "chemin-oclene-port",
    points: [[256, 840], [240, 834], [229, 824], [224, 814], [224, 803], [215, 792], [214, 782], [211, 777], [213, 760], [219, 758], [226, 749], [232, 734], [229, 718], [220, 706], [221, 694], [227, 691], [234, 679], [230, 664], [237, 665], [242, 660], [242, 656], [238, 652]],
    largeur: 4,
  },
  {
    // Oclène : vers la plage.
    id: "chemin-oclene-plage",
    points: [[219, 799], [216, 803], [214, 831], [211, 836], [208, 852], [209, 868], [207, 878], [203, 880], [203, 898]],
    largeur: 4,
  },
];

/** Bois dessinés : plus d'arbres que dans le reste de la région. */
export const BOIS: Bois[] = [
  {
    // Oclène, au sud du village.
    zone: [[208, 802], [193, 819], [181, 850], [181, 861], [193, 878], [199, 893], [220, 895], [225, 892], [229, 883], [231, 853], [236, 835], [251, 833], [257, 819], [251, 809], [241, 801], [215, 799], [203, 803]],
    vegetation: "foret-doree",
    densite: 40,
  },
  {
    // Selenne.
    zone: [[320, 855], [336, 882], [326, 877], [315, 878], [310, 882], [310, 899], [279, 922], [284, 925], [300, 925], [315, 901], [317, 889], [326, 883], [332, 883], [340, 874], [340, 851], [327, 844], [322, 847], [321, 852]],
    vegetation: "foret-doree",
    densite: 40,
  },
  {
    // Terres de glace : un bois de pins givrés au-dessus du feu (le feu reste en clairière).
    zone: [[874,382], [873,394], [856,401], [844,401], [827,394], [826,382], [827,370], [844,363], [856,363], [873,370]],
    vegetation: "pins-enneiges",
    densite: 45,
  },
  {
    // La Forêt obscure.
    zone: [[557, 641], [546, 652], [545, 663], [540, 673], [531, 681], [526, 684], [494, 684], [490, 699], [499, 710], [504, 711], [509, 695], [520, 681], [558, 679], [594, 697], [616, 723], [633, 723], [670, 688], [676, 679], [677, 664], [674, 652], [669, 642], [660, 636], [644, 632], [638, 633], [628, 641], [611, 647], [600, 647], [588, 637], [563, 627], [552, 636]],
    vegetation: "foret-sombre",
    densite: 70,
  },
];

/** Remparts : un mur fermé le long de la zone, des portes là où on peut entrer. */
export const REMPARTS: Rempart[] = [
  {
    id: "remparts-village-blanc",
    zone: [[1010, 601], [1003, 600], [982, 604], [967, 616], [960, 626], [961, 652], [980, 674], [998, 675], [1019, 654], [1036, 643], [1040, 637], [1039, 625], [1033, 610], [1025, 603], [1014, 603]],
    style: "pierre",
    // Là où part le chemin du commencement.
    portes: [[977, 608]],
  },
  {
    // Le fort de l'avant-poste : ses tours d'angle sont des tours de guet ; la porte donne vers les terres.
    id: "fort-hippocampe",
    zone: [[221, 401], [211, 406], [211, 411], [227, 413], [235, 420], [243, 432], [268, 433], [269, 423], [266, 417], [257, 407], [248, 400], [243, 399], [240, 395], [230, 394], [224, 396]],
    style: "pierre",
    tour: "tour-guet",
    portes: [[233, 395]],
  },
  {
    id: "remparts-royaume-glace",
    zone: [[868, 66], [863, 78], [852, 94], [836, 104], [821, 107], [805, 125], [811, 136], [821, 145], [848, 156], [873, 172], [900, 171], [905, 161], [905, 144], [902, 133], [901, 112], [892, 95], [892, 64], [887, 61], [869, 59], [864, 61]],
    style: "glace",
    // Face au col du givre.
    portes: [[862, 166]],
  },
];

export const FEUX: Feu[] = [
  { id: "feu-village", nom: "Village blanc", position: [1000, 640] },
  { id: "feu-terres", nom: "Terres libres", position: [700, 470] },
  { id: "feu-volcan", nom: "Cité volcanique", position: [430, 250] },
  { id: "feu-glace", nom: "Terres de glace", position: [830, 400] },
  { id: "feu-montagne", nom: "Montagnes du vent", position: [860, 820] },
  { id: "feu-atlantes", nom: "Archipel des Atlantes", position: [205, 720] },
  { id: "feu-foret", nom: "Cœur de la forêt", position: [600, 680] },
  { id: "feu-sorcieres", nom: "Village des sorcières", position: [490, 588] },
];

// ─── Objets (PROVISOIRE) ────────────────────────────────────────────────────

export const OBJETS: Objet[] = [
  { id: "lanterne", nom: "Lanterne", description: "Éclaire autour de toi quand tu la tiens en main.", forme: "lanterne" },
  { id: "boussole", nom: "Boussole", description: "Son aiguille ne pointe pas le nord, mais quelque chose d'autre.", forme: "boussole" },
  { id: "braise", nom: "Braise du volcan", description: "Une braise qui ne s'éteint jamais. Brûlante.", forme: "cristal" },
  { id: "cle-rouillee", nom: "Clé rouillée", description: "Une vieille clé de fer. Elle ouvre sûrement quelque chose, quelque part.", forme: "cle" },
];

export const RAMASSABLES: Ramassable[] = [
  { objet: "lanterne", position: [1012, 628] },
  { objet: "cle-rouillee", position: [985, 650] },
];

export const USAGES: Usage[] = [
  {
    objet: "boussole",
    position: [524, 466],
    rayon: 25,
    message: "L'aiguille de la boussole s'affole, puis se fige, pointée vers le plancher de la cabane.",
  },
];

// ─── Indices et énigmes (PROVISOIRE) ────────────────────────────────────────

export const INDICES: Indice[] = [
  {
    id: "carnet-depart",
    objet: "livre",
    position: [992, 632],
    titre: "Carnet du voyageur",
    texte:
      "« Si tu lis ceci, c'est que tu es arrivé au Village blanc, comme moi. Je te laisse ma boussole : elle ne montre pas le nord. Suis-la quand tu ne sais plus où aller. »",
    donne: "boussole",
  },
  {
    id: "braise-volcan",
    objet: "braise",
    position: [470, 230],
    titre: "Braise éternelle",
    texte: "Une braise posée sur un autel, qui brûle sans bois. Elle se laisse prendre.",
    donne: "braise",
    liens: ["pacte"],
  },
  {
    id: "pacte",
    objet: "stele",
    position: [600, 520],
    titre: "Stèle du pacte",
    texte:
      "« Ils vinrent de la cité de l'espace, et nous apprirent à plier les distances. En échange, nous jurâmes de garder leur porte. »",
    liens: ["braise-volcan"],
  },
];

export const ENIGMES: Enigme[] = [];

export const SUCCES: Succes[] = [
  { id: "premiers-pas", titre: "Premiers pas", description: "Se réveiller au Village blanc.", quand: { lieux: ["village-blanc"] } },
  { id: "matelot", titre: "Matelot", description: "Rejoindre l'archipel des Atlantes.", quand: { lieux: ["atlantes"] } },
  { id: "feu-et-glace", titre: "Le feu et la glace", description: "Atteindre le palais givré.", quand: { lieux: ["palais-givre"] } },
  {
    id: "cartographe",
    titre: "Cartographe",
    description: "Découvrir toutes les régions du continent.",
    quand: { lieux: ["village-blanc", "terres-libres", "cite-volcanique", "glace", "foret-sorcieres", "montagne-vent"] },
  },
  { id: "archiviste", titre: "Archiviste", description: "Trouver tous les indices.", secret: true, quand: { indicesTous: true } },
];
