// ═══════════════════════════════════════════════════════════════════════════
//  CONTENU DU MONDE
//
//  La forme du monde vient de ta carte : public/carte.jpg (1920 × 1080).
//    - chaque couleur = une région (voir REGIONS)
//    - le blanc relié au bord de l'image = la mer
//    - le cadre en haut à droite (Scìyolia) est ignoré : c'est un autre monde
//  Pour changer la forme du monde, il suffit de remplacer l'image.
//
//  Toutes les positions sont en PIXELS DE LA CARTE. 1 pixel = 2,5 m dans le jeu.
//  Les éléments marqués « PROVISOIRE » servent à tester : remplace-les par ton histoire.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  Barriere,
  Crete,
  Enigme,
  Espece,
  Feu,
  FrontiereMagique,
  Indice,
  Lieu,
  Objet,
  Pont,
  Port,
  Ramassable,
  Region,
  Succes,
  Usage,
  Volcan,
} from "./types";

export const REGLAGES = {
  /** Image de la carte (dans public/). */
  carte: "carte.jpg",
  /** Mètres par pixel de carte : règle la taille du monde. */
  metresParPixel: 2.5,
  /** Cadre à ignorer sur la carte (Scìyolia) : [x, y, largeur, hauteur] en pixels. */
  ignorer: [1385, 0, 535, 415] as [number, number, number, number],
  /** Point de départ (village blanc). */
  depart: [1000, 640] as [number, number],
  /** Vitesse normale et rapide (Maj), en m/s. */
  vitesse: 16,
  vitesseRapide: 45,
  hauteurYeux: 1.7,
  /** Altitude maximale au-dessus du sol, en m. Les remparts et falaises doivent être plus hauts. */
  volMax: 7,
  /** Pente maximale qu'on peut gravir (mètres de montée par mètre parcouru). Au-delà : falaise. */
  penteMax: 1.6,
  /** Distance qu'on peut faire dans l'eau depuis la côte, en m. Au-delà, il faut un bateau. */
  eauMax: 12,
};

// ─── Régions (une par couleur de la carte) ──────────────────────────────────

export const REGIONS: Region[] = [
  {
    id: "village-blanc",
    nom: "Le Village blanc",
    couleur: "#ffffff",
    point: [1000, 620],
    sousTitre: "Là où tout commence",
    relief: { altitude: 10, amplitude: 9, montagne: 0.1 },
    ambiance: { brume: "#e6dcc6", densite: 0.0014, lumiere: "#ffe6b8" },
    vegetation: "foret-doree",
    sol: ["#a8a15a", "#8c857a"],
    lore: [{ texte: "Un village paisible à l'est du continent. On y arrive sans savoir pourquoi." }],
  },
  {
    id: "terres-libres",
    nom: "Les Terres libres",
    couleur: "#b7c7a3",
    sousTitre: "Terres de personne",
    relief: { altitude: 12, amplitude: 16, montagne: 0.15 },
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
    relief: { altitude: 25, amplitude: 45, montagne: 0.7 },
    ambiance: { brume: "#8a5a48", densite: 0.0028, lumiere: "#ffb27a" },
    vegetation: "arbres-morts",
    sol: ["#4a3b36", "#2c2626"],
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
    relief: { altitude: 20, amplitude: 15, montagne: 0.4 },
    ambiance: { brume: "#7a4a3a", densite: 0.0035, lumiere: "#ff9a5a" },
    vegetation: "aucune",
    sol: ["#3a2e2a", "#221c1c"],
    lore: [{ texte: "Le volcan qui fait vivre la cité, et qui pourrait la détruire." }],
  },
  {
    id: "glace",
    nom: "Les Terres de glace",
    couleur: "#c6f5ff",
    sousTitre: "Le froid qui garde",
    relief: { altitude: 30, amplitude: 35, montagne: 0.5 },
    ambiance: { brume: "#cfe3ee", densite: 0.0024, lumiere: "#e8f2ff" },
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
    relief: { altitude: 22, amplitude: 4, montagne: 0 },
    ambiance: { brume: "#d6ecf4", densite: 0.0024, lumiere: "#eef8ff" },
    vegetation: "aucune",
    sol: ["#f2f8fb", "#bcd0da"],
    lore: [{ texte: "Un iceberg échoué. On dit qu'il est creux." }],
  },
  {
    id: "foret-sorcieres",
    nom: "La Forêt des sorcières",
    couleur: "#834d7f",
    sousTitre: "La cité des sorcières obscures",
    relief: { altitude: 8, amplitude: 7, montagne: 0.05 },
    ambiance: { brume: "#4b3a5c", densite: 0.0045, lumiere: "#c9a8ff" },
    vegetation: "foret-sombre",
    sol: ["#3d3a2a", "#4a4250"],
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
    relief: { altitude: 45, amplitude: 95, montagne: 0.85 },
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
    relief: { altitude: 45, amplitude: 25, montagne: 0.3 },
    ambiance: { brume: "#9fc0c2", densite: 0.0018, lumiere: "#e8fff6" },
    vegetation: "foret-doree",
    sol: ["#6f8f6a", "#7d8a88"],
    lore: [
      { texte: "Trois îles reliées par des ponts suspendus au-dessus du vide." },
      { texte: "Les Atlantes affrontèrent la cité volcanique lors de la bataille de la Corne.", quand: { lieux: ["bataille-corne"] } },
    ],
  },
  {
    id: "elcres-abandonnee",
    nom: "Elcres abandonnée",
    couleur: "#c7c7c7",
    point: [1150, 180],
    sousTitre: "Ce que la maladie a laissé",
    relief: { altitude: 15, amplitude: 18, montagne: 0.3 },
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
    relief: { altitude: 22, amplitude: 5, montagne: 0 },
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
    relief: { altitude: 170, amplitude: 50, montagne: 1 },
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
    rayon: 160,
    lore: [{ texte: "Ici s'affrontèrent la cité volcanique et les Atlantes." }],
  },
  {
    id: "pic-hippocampe",
    nom: "Le Pic de l'Hippocampe",
    sousTitre: "Sous surveillance",
    position: [215, 415],
    rayon: 140,
    lore: [{ texte: "Désormais surveillé, pour que le volcan et les Atlantes ne s'affrontent plus jamais." }],
  },
  {
    id: "detroit",
    nom: "Le Détroit",
    sousTitre: "Là où le feu touche la glace",
    position: [608, 92],
    rayon: 90,
    lore: [{ texte: "La cité volcanique et les terres de glace s'y touchent presque. L'air y change sans cesse de température." }],
  },
  {
    id: "palais-givre",
    nom: "Le Palais givré",
    sousTitre: "Au bout du froid",
    position: [880, 85],
    rayon: 120,
    lore: [{ texte: "Un palais de glace, tout au nord." }],
  },
  {
    id: "col-givre",
    nom: "Le Col du givre",
    sousTitre: "Fermé par la glace",
    position: [852, 248],
    rayon: 70,
    lore: [{ texte: "Un mur de givre barre le seul passage vers le nord." }],
  },
  {
    id: "portail-sciyolia",
    nom: "Le Portail éteint",
    sousTitre: "Vers Scìyolia ?",
    position: [528, 458],
    rayon: 60,
    lore: [{ texte: "Un portail de pierre au cœur de la forêt. Il ne mène nulle part… pour l'instant." }],
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

export const VOLCANS: Volcan[] = [{ position: [440, 58], hauteur: 240, rayon: 230 }];

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
    hauteur: 110,
    largeur: 70,
    cols: [{ position: [852, 244], largeur: 34 }],
  },
];

export const FRONTIERES_MAGIQUES: FrontiereMagique[] = [
  {
    // On n'entre dans la forêt des sorcières que par les terres libres.
    regions: ["foret-sorcieres", "montagne-vent"],
    message: "Une brume magique repousse chacun de tes pas.",
  },
];

export const BARRIERES: Barriere[] = [
  {
    id: "mur-de-givre",
    type: "givre",
    position: [852, 244],
    // Face au nord-ouest : perpendiculaire à la crête.
    angle: 244,
    largeur: 36,
    message: "Un mur de givre épais. Peut-être qu'une chaleur suffisante le ferait fondre…",
    // PROVISOIRE : il faut tenir la braise du volcan en main.
    condition: { objetEnMain: "braise" },
  },
];

// ─── Voyages ────────────────────────────────────────────────────────────────

export const PORTS: Port[] = [
  { id: "port-corne", nom: "Port de la Corne", position: [150, 172], destinations: ["port-atlantes", "port-volcan"] },
  { id: "port-atlantes", nom: "Port des Atlantes", position: [233, 652], destinations: ["port-corne"] },
  { id: "port-volcan", nom: "Débarcadère du volcan", position: [432, 108], destinations: ["port-corne"] },
];

export const PONTS: Pont[] = [
  // Archipel des Atlantes : grande île → île en bas à droite → île du dessus.
  { de: [268, 868], a: [300, 880], largeur: 4 },
  { de: [318, 838], a: [334, 806], largeur: 4 },
];

export const FEUX: Feu[] = [
  { id: "feu-village", nom: "Village blanc", position: [1000, 655] },
  { id: "feu-terres", nom: "Terres libres", position: [700, 470] },
  { id: "feu-volcan", nom: "Cité volcanique", position: [430, 250] },
  { id: "feu-glace", nom: "Terres de glace", position: [830, 400] },
  { id: "feu-montagne", nom: "Montagnes du vent", position: [860, 820] },
  { id: "feu-atlantes", nom: "Archipel des Atlantes", position: [205, 720] },
  { id: "feu-foret", nom: "Cœur de la forêt", position: [600, 680] },
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
    position: [528, 458],
    rayon: 25,
    message: "L'aiguille de la boussole s'affole devant le portail, puis se fige.",
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
