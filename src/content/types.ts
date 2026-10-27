// Types du contenu du monde. Le contenu lui-même est dans monde.ts.
//
// Les positions s'écrivent en PIXELS DE TA CARTE (public/carte.jpg, 1920 × 1080) :
// ouvre la carte dans un logiciel de dessin, lis les coordonnées du curseur, et reporte-les.

/** Position [x, y] en pixels sur la carte. */
export type Px = [number, number];

export type Ambiance = {
  /** Couleur de la brume et de l'horizon. */
  brume: string;
  /** Densité de la brume (0.0008 = très clair, 0.006 = épais). */
  densite: number;
  /** Couleur de la lumière du soleil. */
  lumiere: string;
  /** Lumière d'ambiance venue du ciel et renvoyée par le sol (par défaut : dorée et terreuse). */
  ciel?: string;
  sol?: string;
  /** Couleur du haut du ciel (par défaut : un bleu doux). */
  zenith?: string;
};

/** Ce qu'il faut avoir fait pour qu'une chose s'ouvre ou se révèle. Tout doit être rempli. */
export type Condition = {
  indices?: string[];
  enigmes?: string[];
  lieux?: string[];
  /** Objet à posséder dans le sac. */
  objet?: string;
  /** Objet à tenir en main au moment de passer. */
  objetEnMain?: string;
};

/** Un paragraphe de lore : caché (« … ») tant que sa condition n'est pas remplie. */
export type Lore = { texte: string; quand?: Condition };

export type Relief = {
  /** Altitude moyenne du sol, en m (la mer est à 0). */
  altitude: number;
  /** Amplitude des bosses et des pics, en m. */
  amplitude: number;
  /** 0 = collines douces, 1 = crêtes montagneuses. */
  montagne: number;
};

export type Vegetation = "foret-doree" | "foret-verte" | "foret-sombre" | "pins-enneiges" | "arbres-morts" | "rochers" | "aucune";

/** Une région = une couleur de ta carte. */
export type Region = {
  id: string;
  nom: string;
  /** Couleur de la région sur la carte (le moteur trouve les pixels les plus proches). */
  couleur: string;
  /**
   * Si plusieurs morceaux ont la même couleur (île du volcan et continent, par ex.), ce point
   * désigne le morceau qui appartient à CETTE région. Sans point : tous les autres morceaux.
   */
  point?: Px;
  sousTitre: string;
  relief: Relief;
  ambiance: Ambiance;
  vegetation: Vegetation;
  /** Couleurs du sol : herbe/terre principale et roche. */
  sol: [string, string];
  /** « falaises » : le plateau reste haut jusqu'au bord de l'eau et tombe d'un coup (sinon : une plage). */
  cotes?: "falaises";
  /** Avec des falaises : là où la côte reste une plage (point et rayon en m). */
  plages?: { position: Px; rayon: number }[];
  /** Neige sur les sommets (au-dessus de 110 m environ). Oui par défaut. */
  neige?: boolean;
  lore: Lore[];
};

/** Lieu-dit : un endroit nommé à l'intérieur d'une région. */
export type Lieu = {
  id: string;
  nom: string;
  sousTitre: string;
  position: Px;
  /** Rayon en mètres. */
  rayon: number;
  lore: Lore[];
};

export type Espece = {
  id: string;
  nom: string;
  /** Régions ou lieux où elle vit. */
  habitat: string[];
  description: string;
  /** Quand l'espèce apparaît dans le journal. */
  quand: Condition;
};

export type Barriere = {
  id: string;
  /**
   * tempete : mur de nuages orageux · brume : voile doré · porte : grande porte en bois
   * givre : mur de glace · sort : voile de magie violette
   */
  type: "tempete" | "brume" | "porte" | "givre" | "sort";
  position: Px;
  /** Direction vers laquelle elle fait face, en degrés (0 = est, 90 = sud, 180 = ouest, 270 = nord). */
  angle: number;
  /** Largeur en mètres. */
  largeur: number;
  message: string;
  condition: Condition;
};

/** Crête montagneuse infranchissable (trop raide), avec d'éventuels cols. */
export type Crete = {
  id: string;
  points: Px[];
  /** Hauteur au-dessus du sol, en m. */
  hauteur: number;
  /** Largeur à la base, en m. */
  largeur: number;
  /** Passages (le sol redescend) : point et largeur en m. */
  cols?: { position: Px; largeur: number }[];
};

/**
 * Frontière infranchissable entre deux régions (ou une région et la « mer »),
 * matérialisée par un rideau de brume magique opaque.
 */
export type FrontiereMagique = {
  regions: [string, string];
  message: string;
  /** Condition pour qu'elle s'ouvre. Sans condition : fermée pour toujours. */
  quand?: Condition;
};

export type Port = {
  id: string;
  nom: string;
  position: Px;
  /** Ports joignables d'ici en bateau. */
  destinations: string[];
  /** Le port n'est utilisable qu'une fois cette condition remplie. */
  quand?: Condition;
};

/**
 * Pont suspendu entre deux terres. On donne un point sur chaque rive (n'importe où sur l'île) :
 * le moteur relie les deux terres à l'endroit où elles sont le plus proches.
 */
export type Pont = {
  entre: [Px, Px];
  largeur: number;
  /** Le pont part exactement de la côte la plus proche de chaque point (au lieu du plus court passage). */
  exact?: boolean;
};

/** Chemin de terre tracé sur le sol (les arbres s'en écartent). */
export type Chemin = {
  id: string;
  nom?: string;
  points: Px[];
  /** Largeur en m (elle varie un peu le long du chemin). */
  largeur: number;
  /** Une lanterne tous les tant de mètres, en alternant les côtés. */
  lanternes?: number;
  /** Des tronçons de clôture en bois le long du chemin, sur les tant premiers mètres. */
  clotures?: number;
  /** « lave » : une rigole de lave incandescente au lieu d'un chemin de terre. */
  matiere?: "lave";
};

/** Zone plus boisée que le reste de sa région. */
export type Bois = {
  zone: Px[];
  vegetation: Exclude<Vegetation, "aucune">;
  /** Arbres par hectare (une forêt dense : 40 à 70). */
  densite: number;
  /** Zone laissée sans arbres à l'intérieur (un village, une clairière). */
  trou?: Px[];
  /** Fleurs par hectare, en plus (un pré fleuri). */
  fleurs?: number;
};

/** Montagnes dessinées : le relief monte à l'intérieur de la zone. */
export type Massif = { zone: Px[]; /** Altitude ajoutée, en m. */ hauteur: number };

/**
 * Remparts : un mur fermé le long de la zone, avec des tours aux angles.
 * Chaque porte ouvre un passage dans le mur, là où il passe au plus près du point donné.
 */
export type Rempart = {
  id: string;
  zone: Px[];
  style: "pierre" | "glace";
  portes: Px[];
  /** Modèle des tours (par défaut : la tour du style). */
  tour?: "tour-guet";
};

/** Village ou cité : des maisons placées autour d'un centre, sur un sol aplani. */
export type Village = {
  id: string;
  centre: Px;
  /** Rayon en mètres. */
  rayon: number;
  nombre: number;
  /** Modèles Blender utilisés (voir ASSETS-BLENDER.md), tirés au hasard. */
  modeles: string[];
  /** Forme provisoire tant que les modèles n'existent pas : couleurs et taille [largeur, hauteur, profondeur] en m. */
  substitut: { murs: string; toit: string; taille: [number, number, number] };
  /**
   * Comment les maisons s'organisent (sans : au hasard autour du centre).
   * place : en anneaux autour d'une place, façades vers le centre ; `rues` laisse un passage vers chaque point.
   * rue : de part et d'autre d'un chemin (id dans CHEMINS), façades vers lui, jusqu'à `rayon` du centre.
   */
  disposition?: { type: "place"; anneaux: number; rues?: Px[] } | { type: "rue"; chemin: string };
  /** Un village en anneaux est bâti sur un sol commun aplani ; `false` : les maisons suivent le relief (ruines). */
  plateau?: boolean;
  /** Part des maisons (0 à 1) qui ont un potager clôturé derrière elles. */
  jardins?: number;
};

/**
 * Modèle unique posé dans le monde (tour, statue, épave…).
 * Invisible tant que son fichier n'existe pas dans modeles/.
 */
export type DecorUnique = {
  modele: string;
  position: Px;
  /** Direction vers laquelle il fait face, en degrés (0 = est, 90 = sud…). */
  angle?: number;
  /** Aplanit le sol sur ce rayon (m) sous le modèle. */
  plateforme?: number;
  echelle?: number;
  /** Le joueur s'y cogne : taille de la boîte de collision [largeur, hauteur, profondeur] en m. */
  solide?: [number, number, number];
  /** Posé sur l'eau plutôt qu'au fond (barques, bouées). */
  flotte?: boolean;
  /** Maison provisoire (murs, toit, taille [largeur, hauteur, profondeur] en m) tant que le modèle manque. */
  substitut?: { murs: string; toit: string; taille: [number, number, number] };
};

/** Feu de camp : point de repos et de voyage rapide, une fois découvert. */
export type Feu = { id: string; nom: string; position: Px };

export type Objet = {
  id: string;
  nom: string;
  description: string;
  /** Forme affichée en main. */
  forme: "lanterne" | "cle" | "cristal" | "parchemin" | "amulette" | "boussole";
};

/** Objet posé dans le monde, qu'on ramasse avec E. */
export type Ramassable = { objet: string; position: Px };

/** Ce qui se passe quand on UTILISE un objet tenu en main à un endroit précis. */
export type Usage = {
  objet: string;
  position: Px;
  /** Rayon en mètres. */
  rayon: number;
  /** Message affiché. */
  message: string;
  /** Énigme considérée comme résolue. */
  resout?: string;
};

export type Indice = {
  id: string;
  objet: "stele" | "livre" | "braise";
  position: Px;
  titre: string;
  texte: string;
  /** Autres indices liés (le journal trace un lien entre eux). */
  liens?: string[];
  /** Objet obtenu en lisant l'indice. */
  donne?: string;
};

export type Enigme = {
  id: string;
  position: Px;
  titre: string;
  question: string;
  /** Réponse attendue (majuscules, accents et espaces ignorés). */
  solution: string;
};

export type Succes = {
  id: string;
  titre: string;
  description: string;
  secret?: boolean;
  quand: Condition & { indicesTous?: boolean; especesToutes?: boolean };
};

/** Volcan : un cône avec un cratère de lave. */
/**
 * Labyrinthe magique (comme la forêt perdue de Zelda) : où qu'on entre dans sa région, on arrive dans
 * la première salle. Chaque salle est une clairière d'où partent des chemins ; le bon mène à la salle
 * suivante, les autres ramènent à la première. Après la dernière, on arrive à la fin (un lieu libre).
 * Tenir `objet` en main fait briller le bon chemin.
 */
export type Labyrinthe = {
  region: string;
  objet: string;
  salles: {
    centre: Px;
    /** Rayon de la clairière, en m. */
    rayon: number;
    /** Direction de chaque chemin, en degrés (0 = est, 90 = sud…). */
    chemins: number[];
    /** Indice du bon chemin dans `chemins`. */
    bon: number;
    /** Dans la première salle : le chemin qui fait sortir de la forêt. */
    sortie?: number;
  }[];
  /** La fin : un cercle libre (village, point de vue), et où l'on y arrive. */
  fin: { centre: Px; rayon: number; arrivee: Px };
  /** Où l'on se retrouve en sortant de la forêt. */
  dehors: Px;
};

export type Volcan = { position: Px; hauteur: number; /** Rayon de la base, en m. */ rayon: number };
