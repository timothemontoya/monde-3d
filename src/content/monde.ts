// ═══════════════════════════════════════════════════════════════════════════
//  CONTENU DU MONDE
//
//  La forme du monde vient de ta carte : public/carte.jpg (1920 × 1080).
//    - chaque couleur = une région (voir REGIONS)
//    - le bleu (REGLAGES.couleurMer), et le blanc relié au bord de l'image = la mer
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
  Labyrinthe,
  Lieu,
  Massif,
  Objet,
  Pont,
  Port,
  Px,
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
  /** Couleur de la mer sur la carte (le blanc relié au bord de l'image est aussi de la mer). */
  couleurMer: "#9abdff",
  /** Mètres par pixel de carte : règle la taille du monde. */
  metresParPixel: 1.5,
  /** Cadre à ignorer sur la carte (Scìyolia) : [x, y, largeur, hauteur] en pixels. */
  ignorer: [1385, 0, 535, 415] as [number, number, number, number],
  /** Point de départ (village blanc) : sur la grand-rue, face à la place. */
  depart: [989, 623] as [number, number],
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
    cotes: "falaises",
    // La plage du Hameau des Pêcheurs, au sud-est.
    plages: [{ position: [1022, 690], rayon: 40 }],
    relief: { altitude: 12, amplitude: 4.5, montagne: 0.1 },
    ambiance: { brume: "#ead3a6", densite: 0.0024, lumiere: "#ffd28a", zenith: "#c9c2b0" },
    vegetation: "foret-doree",
    sol: ["#949150", "#b08a5a"],
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
    cotes: "falaises",
    // La plage d'Oclène, au sud de l'île centrale.
    plages: [{ position: [202, 926], rayon: 45 }],
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
  {
    // PROVISOIRE (nom et lore) : la terre la plus proche de la fracture, déjà rongée par elle.
    id: "terres-rougies",
    nom: "Les Terres rougies",
    couleur: "#ff2b28",
    sousTitre: "Ce que la fracture a touché",
    relief: { altitude: 14, amplitude: 14, montagne: 0.45 },
    ambiance: { brume: "#a85a3e", densite: 0.0026, lumiere: "#ffb070", ciel: "#ffc090", sol: "#4a2a20" },
    vegetation: "arbres-morts",
    sol: ["#8a4a34", "#6a3a2e"],
    neige: false,
    lore: [{ texte: "Une terre qui a perdu ses couleurs, sauf le rouge. Plus on va vers l'est, moins rien ne pousse." }],
  },
  {
    // PROVISOIRE (nom et lore) : la corruption y commence à peine.
    id: "landes-roses",
    nom: "Les Landes roses",
    couleur: "#fb7ff7",
    sousTitre: "Une beauté qui inquiète",
    relief: { altitude: 8, amplitude: 9, montagne: 0.15 },
    ambiance: { brume: "#e6b8d8", densite: 0.0018, lumiere: "#ffd6e8", ciel: "#ffe0f0", sol: "#5a3a4a" },
    vegetation: "foret-doree",
    sol: ["#b07a92", "#8a6a74"],
    lore: [{ texte: "Des landes où l'herbe et les feuilles virent au rose. Les habitants disent que c'est nouveau." }],
  },
  {
    // Le labyrinthe magique : on y entre par n'importe où, on se retrouve au même endroit (voir LABYRINTHE).
    id: "bois-labyrinthe",
    nom: "Le Bois perdu",
    couleur: "#d6ffae",
    sousTitre: "Tous les chemins y ramènent",
    relief: { altitude: 10, amplitude: 6, montagne: 0.05 },
    ambiance: { brume: "#cde8b0", densite: 0.0055, lumiere: "#f0ffd0", ciel: "#e8ffd0", sol: "#3a4a2a" },
    vegetation: "foret-verte",
    sol: ["#7aa04a", "#6a7a5a"],
    lore: [{ texte: "Une forêt noyée de brouillard. On a beau marcher, on revient toujours à la même clairière." }],
  },
  {
    // La fracture d'or : une île de cristal au large, qu'on n'atteint pas (on la voit du bout du labyrinthe).
    id: "fracture-or",
    nom: "La Fracture d'or",
    couleur: "#ffc300",
    sousTitre: "Elle prend racine",
    // Basse et creuse au centre : ce sont les cristaux qui se dressent, de plus en plus hauts vers l'extérieur.
    relief: { altitude: 5, amplitude: 6, montagne: 0.2 },
    ambiance: { brume: "#ffd870", densite: 0.002, lumiere: "#fff0b0", ciel: "#fff0c0", sol: "#6a4a10" },
    vegetation: "aucune",
    sol: ["#ffc300", "#e8a010"],
    neige: false,
    lore: [
      { texte: "Une blessure d'or au large du continent. Personne ne sait d'où elle vient." },
      { texte: "Elle prend racine dans ce monde, le dévitalise et le corrompt. Si rien n'est fait, elle le consumera.", quand: { lieux: ["vue-fracture"] } },
    ],
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
    id: "village-du-bois",
    nom: "Le Village du Bois",
    sousTitre: "Au bout des chemins",
    position: [1362, 476],
    rayon: 45,
    lore: [{ texte: "Un village caché au bout du labyrinthe. Ceux qui y vivent ont appris à suivre la lumière." }],
  },
  {
    id: "vue-fracture",
    nom: "La Pointe",
    sousTitre: "Face à la Fracture d'or",
    position: [1402, 512],
    rayon: 22,
    lore: [{ texte: "D'ici, on voit la Fracture d'or briller au large." }],
  },
  {
    // PROVISOIRE : lore à écrire.
    id: "monastere-iceberg",
    nom: "Le Monastère de l'Iceberg",
    sousTitre: "Ceux qui gardent le portail",
    position: [780, 254],
    rayon: 45,
    lore: [{ texte: "Des moines vivent dans l'iceberg creux. Ils gardent un portail enfoui dans la glace." }],
  },
  {
    // PROVISOIRE : lore à écrire.
    id: "forge-sous-cendre",
    nom: "La Forge-sous-Cendre",
    sousTitre: "Dans le flanc du volcan",
    position: [442, 100],
    rayon: 45,
    lore: [{ texte: "Des mineurs et des forgerons ont creusé leur village dans le flanc du volcan, loin de la demeure du chef." }],
  },
  {
    // PROVISOIRE : lore à écrire.
    id: "hameau-pecheurs",
    nom: "Le Hameau des Pêcheurs",
    sousTitre: "Là où l'on respire",
    position: [1008, 700],
    rayon: 45,
    lore: [{ texte: "Quelques cabanes sur la plage, des filets qui sèchent et des barques. Rien ne presse ici." }],
  },
  {
    // PROVISOIRE : lore à écrire.
    id: "bourg-egares",
    nom: "Le Bourg des Égarés",
    sousTitre: "Ceux qui n'ont plus de patrie",
    position: [762, 492],
    rayon: 60,
    lore: [{ texte: "Un bourg rafistolé au milieu des Terres libres, où s'arrêtent ceux qui ne peuvent plus rentrer chez eux." }],
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

// Flancs assez doux pour qu'on monte à pied jusqu'à la Forge-sous-Cendre.
export const VOLCANS: Volcan[] = [{ position: [440, 58], hauteur: 115, rayon: 170 }];

/** Le Bois perdu. */
export const LABYRINTHE: Labyrinthe = {
  region: "bois-labyrinthe",
  objet: "fiole-lucioles",
  salles: [
    { centre: [1205, 445], rayon: 16, chemins: [180, 20, 300, 90], bon: 1, sortie: 0 },
    { centre: [1258, 434], rayon: 16, chemins: [200, 330, 60, 110], bon: 3 },
    { centre: [1296, 462], rayon: 16, chemins: [250, 10, 140, 300], bon: 2 },
    { centre: [1252, 498], rayon: 16, chemins: [100, 220, 320], bon: 0 },
  ],
  fin: { centre: [1368, 488], rayon: 72, arrivee: [1336, 478] },
  dehors: [1150, 478],
};

/** Les chemins qui partent de chaque salle du labyrinthe (22 px de long). */
function cheminsDuLabyrinthe(): Chemin[] {
  return LABYRINTHE.salles.flatMap((s, i) =>
    s.chemins.map((angle, k) => {
      const a = (angle * Math.PI) / 180;
      return {
        id: `labyrinthe-${i}-${k}`,
        points: [s.centre, [Math.round(s.centre[0] + Math.cos(a) * 22), Math.round(s.centre[1] + Math.sin(a) * 22)]] as Px[],
        largeur: 2.5,
      };
    }),
  );
}

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
  // L'île du volcan n'a pas de port : on y va par le pont de la Forge-sous-Cendre.
  // On ne quitte la Corne qu'une fois l'avant-poste de l'Hippocampe neutralisé (PROVISOIRE : aucune énigme ne le fait encore).
  { id: "port-corne", nom: "Port de la Corne", position: [134, 311], destinations: ["port-atlantes"], quand: { enigmes: ["avant-poste-neutralise"] } },
  { id: "port-atlantes", nom: "Port des Atlantes", position: [233, 652], destinations: ["port-corne"] },
];

export const PONTS: Pont[] = [
  // Archipel des Atlantes : Oclène → Selenne → Eregone, là où tu les as dessinés.
  { entre: [[269, 842], [305, 841]], largeur: 4, exact: true },
  { entre: [[344, 849], [374, 823]], largeur: 4, exact: true },
  // Le pont de glace vers le monastère de l'iceberg, depuis la côte sud des Terres de glace.
  { entre: [[772, 298], [781, 272]], largeur: 3, exact: true },
  // Le pont de la Forge-sous-Cendre, de la cité volcanique au flanc du volcan.
  { entre: [[385, 110], [422, 108]], largeur: 4, exact: true },
];

// ─── Villages et cités ──────────────────────────────────────────────────────

export const VILLAGES: Village[] = [
  {
    id: "village-blanc",
    // Dans ses remparts (REMPARTS) : deux anneaux autour de la place du feu, la grand-rue mène à la porte.
    centre: [998, 635],
    rayon: 53,
    nombre: 26,
    modeles: ["maison-village-1", "maison-village-2", "maison-village-3"],
    substitut: { murs: "#d8cfbd", toit: "#7a4a32", taille: [10, 8, 6.4] },
    disposition: { type: "place", anneaux: 3, rues: [[977, 608]] },
    jardins: 1,
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
    // Le Village du Bois, au bout du labyrinthe.
    id: "village-du-bois",
    centre: [1362, 476],
    rayon: 30,
    nombre: 9,
    modeles: ["cabane-peche-2", "maison-atlante-1", "maison-atlante-3", "hutte-sorciere-2"],
    substitut: { murs: "#d8e4ec", toit: "#3a78b0", taille: [6, 6, 6.4] },
    disposition: { type: "place", anneaux: 1 },
    jardins: 0.5,
  },
  {
    // Le Hameau des Pêcheurs : un cercle de cabanes sur la plage.
    id: "hameau-pecheurs",
    centre: [1004, 706],
    rayon: 22,
    nombre: 7,
    modeles: ["cabane-peche-1", "cabane-peche-2", "cabane-peche-3"],
    substitut: { murs: "#e8d8c0", toit: "#c2453a", taille: [6, 6, 6.4] },
    disposition: { type: "place", anneaux: 1, rues: [[1022, 692]] },
  },
  {
    // Le Bourg des Égarés : un village-rue sur le chemin du commencement, des maisons venues de partout.
    id: "bourg-egares",
    centre: [762, 492],
    rayon: 55,
    nombre: 14,
    modeles: ["maison-village-3", "maison-vent-2", "maison-vent-3", "maison-atlante-1", "maison-atlante-3", "maison-volcan-2", "hutte-sorciere-2"],
    substitut: { murs: "#c8b892", toit: "#8a6a3a", taille: [9, 9.6, 6.4] },
    disposition: { type: "rue", chemin: "chemin-commencement" },
    jardins: 0.3,
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
  { modele: "fontaine", position: [998, 633], echelle: 1.6, plateforme: 7, solide: [9.5, 1.5, 9.5] },
  // Le marché, en arc du côté opposé à la porte.
  { modele: "etal", position: [1006, 644], angle: 225, solide: [3, 3.7, 3] },
  { modele: "etal-vert", position: [1009, 636], angle: 180, solide: [3, 3.7, 3] },
  { modele: "etal", position: [1001, 646], angle: 270, solide: [3, 3.7, 3] },
  { modele: "caisse", position: [1008, 646], angle: 20, solide: [1.2, 0.8, 1.4] },
  { modele: "caisse", position: [1010, 640], angle: 70, solide: [1.2, 0.8, 1.4] },
  { modele: "tonneau", position: [1003, 648], solide: [1.3, 1.2, 1.3] },
  { modele: "tonneau", position: [1011, 633], solide: [1.3, 1.2, 1.3] },
  { modele: "charrette", position: [990, 645], angle: 200, solide: [2.3, 1.4, 3.5] },
  { modele: "banc", position: [990, 636], angle: 0 },
  { modele: "banc", position: [1006, 634], angle: 180 },
  { modele: "botte-foin", position: [1007, 641], angle: 30 },
  { modele: "botte-foin", position: [1008, 643], angle: 80 },
  { modele: "coffre", position: [991, 630], angle: 20 },
  { modele: "seau", position: [1000, 628] },
  // La porte : lanternes et braseros de part et d'autre.
  { modele: "lanterne", position: [973, 605] },
  { modele: "lanterne", position: [981, 611] },
  { modele: "brasero", position: [972, 608] },
  { modele: "brasero", position: [983, 609] },
  // À la porte : un panneau, et un petit marché dehors, au bord du chemin.
  { modele: "panneau", position: [972, 600], angle: 30 },
  { modele: "etal-vert", position: [960, 592], angle: 45, solide: [3, 3.7, 3] },
  { modele: "charrette", position: [953, 603], angle: 120, solide: [2.3, 1.4, 3.5] },
  { modele: "botte-foin", position: [958, 601], angle: 10 },
  { modele: "tonneau", position: [963, 589], solide: [1.3, 1.2, 1.3] },
  { modele: "lanterne", position: [992, 628] },
  { modele: "lanterne", position: [1005, 637] },
  { modele: "lanterne", position: [994, 643] },
  { modele: "lanterne", position: [1003, 626] },

  // Avant-poste de l'Hippocampe : un fort (REMPARTS) avec une batterie de canons devant le bras de mer.
  { modele: "drapeau", position: [244, 414] },
  { modele: "tente", position: [236, 410], angle: 0, solide: [3.5, 3, 3.5] },
  { modele: "tente", position: [250, 407], angle: 30, solide: [3.5, 3, 3.5] },
  { modele: "tente", position: [256, 419], angle: 200, solide: [3.5, 3, 3.5] },
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

  // Le Monastère de l'Iceberg.
  { modele: "monastere-glace", position: [781, 252], angle: 260, plateforme: 14, solide: [24, 28, 12] },
  { modele: "lanterne", position: [779, 266] },
  { modele: "lanterne", position: [784, 266] },

  // La Forge-sous-Cendre : des maisons taillées en terrasses dans le flanc du volcan (le flanc est
  // trop raide pour un village sur un sol commun), des forges, des braseros et de la lave.
  { modele: "maison-volcan-1", position: [446, 96], angle: 100, solide: [9, 9.6, 6.4] },
  { modele: "maison-volcan-3", position: [454, 104], angle: 80, solide: [6, 12.6, 6.4] },
  { modele: "maison-volcan-1", position: [440, 90], angle: 90, solide: [9, 9.6, 6.4] },
  { modele: "enclume", position: [440, 101], solide: [1.4, 1.5, 1.3] },
  { modele: "brasero", position: [442, 103] },
  { modele: "enclume", position: [447, 103], angle: 60, solide: [1.4, 1.5, 1.3] },
  { modele: "brasero", position: [438, 97] },
  { modele: "brasero", position: [447, 104] },
  { modele: "tonneau", position: [437, 100], solide: [1.3, 1.2, 1.3] },
  { modele: "caisse", position: [449, 99], angle: 40, solide: [1.2, 0.8, 1.4] },

  // Le Hameau des Pêcheurs : pontons et barques dans la crique, filets (foin), tonneaux.
  { modele: "ponton", position: [1030, 684], angle: 0, flotte: true },
  { modele: "ponton", position: [1033, 684], angle: 0, flotte: true },
  { modele: "ponton", position: [1036, 684], angle: 0, flotte: true },
  { modele: "barque-rames", position: [1043, 676], angle: 20, flotte: true },
  { modele: "barque-rames", position: [1042, 690], angle: 300, flotte: true },
  { modele: "tonneau", position: [1018, 692], solide: [1.3, 1.2, 1.3] },
  { modele: "caisse", position: [1019, 696], angle: 20, solide: [1.2, 0.8, 1.4] },
  { modele: "botte-foin", position: [990, 694], angle: 50 },
  { modele: "feu-de-camp", position: [1004, 706] },
  { modele: "banc", position: [1001, 708], angle: 90 },
  { modele: "lanterne", position: [1024, 686] },

  // Le Bourg des Égarés : un marché de tentes et d'étals de chaque côté de la rue, des bannières.
  { modele: "etal", position: [750, 473], angle: 250, solide: [3, 3.7, 3] },
  { modele: "etal-vert", position: [757, 471], angle: 260, solide: [3, 3.7, 3] },
  { modele: "etal", position: [765, 474], angle: 280, solide: [3, 3.7, 3] },
  { modele: "charrette", position: [742, 475], angle: 70, solide: [2.3, 1.4, 3.5] },
  { modele: "caisse", position: [753, 470], angle: 30, solide: [1.2, 0.8, 1.4] },
  { modele: "tonneau", position: [761, 470], solide: [1.3, 1.2, 1.3] },
  { modele: "tente", position: [756, 508], angle: 80, solide: [3.5, 3, 3.5] },
  { modele: "tente", position: [766, 511], angle: 100, solide: [3.5, 3, 3.5] },
  { modele: "tente", position: [776, 513], angle: 120, solide: [3.5, 3, 3.5] },
  { modele: "feu-de-camp", position: [766, 504] },
  { modele: "marmite", position: [766, 504] },
  { modele: "botte-foin", position: [759, 503], angle: 20 },
  { modele: "charrette", position: [782, 507], angle: 160, solide: [2.3, 1.4, 3.5] },
  { modele: "banniere", position: [744, 470], angle: 200 },
  { modele: "banniere", position: [772, 486], angle: 200 },
  { modele: "lanterne", position: [758, 476] },
  { modele: "lanterne", position: [770, 500] },

  // Terres libres : le carrefour du feu (marmite, panneau, stèle, vieille charrette, clôtures).
  { modele: "marmite", position: [700, 470], angle: 20 },
  { modele: "panneau", position: [705, 465], angle: 200 },
  { modele: "lanterne", position: [706, 466.5] },
  { modele: "stele-moussue", position: [714, 480], angle: 160, solide: [1.3, 1.6, 0.7] },
  { modele: "charrette", position: [688, 482], angle: 40, solide: [2.3, 1.4, 3.5] },
  { modele: "cloture", position: [692, 462], angle: 10 },
  { modele: "cloture", position: [693.5, 461.7], angle: 10 },
  { modele: "cloture", position: [714, 462], angle: 80 },
  { modele: "rocher-2", position: [691, 476], echelle: 0.5 },

  // Cité volcanique : braseros autour de la place, forges, bannières devant la demeure du chef.
  { modele: "brasero", position: [411, 241] },
  { modele: "brasero", position: [430, 233] },
  { modele: "brasero", position: [427, 245] },
  { modele: "brasero", position: [411, 230] },
  { modele: "brasero", position: [401, 236] },
  { modele: "brasero", position: [439, 238] },
  { modele: "enclume", position: [405, 246], angle: 0, solide: [1.4, 1.5, 1.3] },
  { modele: "brasero", position: [403, 248] },
  { modele: "enclume", position: [436, 228], angle: 90, solide: [1.4, 1.5, 1.3] },
  { modele: "brasero", position: [438, 226] },
  { modele: "banniere", position: [412, 231], angle: 90 },
  { modele: "banniere", position: [428, 231], angle: 90 },

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
  { modele: "chaudron", position: [484, 590], solide: [0.8, 1.2, 0.8] },
  { modele: "chaudron", position: [496, 586], solide: [0.8, 1.2, 0.8] },
  { modele: "chaudron", position: [520, 470], solide: [0.8, 1.2, 0.8] },
  { modele: "champignon-1", position: [516, 472], echelle: 3 },
  { modele: "champignon-2", position: [533, 474], echelle: 2.6 },
  { modele: "champignon-1", position: [528, 459], echelle: 3.4 },

  // Royaume de glace : les fantômes du roi.
  { modele: "fantome", position: [870, 110], angle: 90 },
  { modele: "fantome", position: [858, 132], angle: 120 },
  { modele: "fantome", position: [886, 126], angle: 60 },
  { modele: "fantome", position: [866, 150], angle: 90 },

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
  ...cheminsDuLabyrinthe(),
  // Du pont à la Forge-sous-Cendre : la montée la plus douce.
  { id: "montee-forge", points: [[424, 110], [433, 109], [440, 106], [444, 101]], largeur: 3 },
  // Lave de la Forge-sous-Cendre, qui descend vers la mer.
  { id: "lave-forge", points: [[452, 104], [460, 110], [466, 114]], largeur: 3, matiere: "lave" },
  {
    // Du Village blanc au Hameau des Pêcheurs, par la côte.
    id: "chemin-pecheurs",
    points: [[1011, 648], [1019, 654], [1026, 664], [1022, 678], [1014, 694]],
    largeur: 3,
  },
  // Cité volcanique : des rigoles de lave qui descendent de la ville.
  { id: "lave-ouest", points: [[390, 262], [380, 270], [368, 276]], largeur: 3.5, matiere: "lave" },
  { id: "lave-sud", points: [[452, 258], [462, 268], [468, 280]], largeur: 3.5, matiere: "lave" },
  { id: "lave-est", points: [[452, 210], [464, 202], [476, 196]], largeur: 3.5, matiere: "lave" },
  { id: "lave-nord", points: [[388, 210], [378, 200], [372, 188]], largeur: 3.5, matiere: "lave" },
  {
    // Village blanc : la rue circulaire, entre le premier et le deuxième anneau de maisons.
    id: "rue-ronde",
    points: [[1016, 635], [1011, 648], [998, 653], [985, 648], [980, 635], [985, 622], [998, 617], [1011, 622], [1016, 635]],
    largeur: 4,
    lanternes: 14,
  },
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
    clotures: 160,
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
    // Village blanc : deux bosquets dorés sur les flancs…
    zone: [[944, 612], [932, 619], [933, 665], [966, 703], [985, 700], [962, 672], [957, 640]],
    vegetation: "foret-doree",
    densite: 70,
    fleurs: 600,
  },
  {
    zone: [[1003, 592], [1019, 576], [1045, 579], [1059, 591], [1072, 638], [1064, 649], [1035, 668], [1022, 656], [1041, 644], [1045, 630], [1037, 607], [1016, 599]],
    vegetation: "foret-doree",
    densite: 70,
    fleurs: 600,
  },
  {
    // … et un pré fleuri ouvert devant la porte.
    zone: [[978, 600], [960, 600], [930, 575], [915, 545], [945, 540], [985, 580], [1000, 595]],
    vegetation: "foret-doree",
    densite: 0,
    fleurs: 1500,
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
    // Là où part le chemin du commencement, et la porte des pêcheurs au sud-est.
    portes: [[977, 608], [1019, 654]],
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
  {
    // PROVISOIRE : posée au Village blanc pour l'instant.
    id: "fiole-lucioles",
    nom: "Fiole de lucioles",
    description: "Dans le Bois perdu, quand on la tient en main, le bon chemin s'illumine.",
    forme: "lanterne",
  },
  { id: "cle-rouillee", nom: "Clé rouillée", description: "Une vieille clé de fer. Elle ouvre sûrement quelque chose, quelque part.", forme: "cle" },
];

export const RAMASSABLES: Ramassable[] = [
  { objet: "fiole-lucioles", position: [1004, 641] },
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
    id: "stele-fracture",
    objet: "stele",
    position: [1404, 514],
    titre: "Stèle de la pointe",
    texte:
      "« Ce que vous voyez là-bas est la Fracture d'or. Un objet magique, apparu par hasard. Elle prend racine dans notre monde : elle le dévitalise et le corrompt. Si nous ne faisons rien, elle le consumera tout entier. »",
  },
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
