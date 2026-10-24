// Types du contenu du monde. Le contenu lui-même est dans monde.ts.

/** Position au sol [x, z] en mètres. La hauteur est calculée à partir du relief. */
export type Pos = [number, number];

export type Ambiance = {
  /** Couleur de la brume et de l'horizon. */
  brume: string;
  /** Densité de la brume (0.002 = très clair, 0.012 = épais). */
  densite: number;
  /** Couleur de la lumière du soleil. */
  lumiere: string;
};

export type Zone = {
  id: string;
  nom: string;
  /** Petite phrase affichée sous le nom quand on découvre la zone. */
  sousTitre: string;
  centre: Pos;
  rayon: number;
  ambiance: Ambiance;
  /** Aplatit le terrain dans la zone (villages, places), à cette hauteur. */
  plateau?: number;
  /**
   * Remparts autour de la zone, plus hauts que le vol maximal : on ne peut entrer
   * que par l'ouverture, où se trouve une barrière.
   */
  enceinte?: {
    hauteur: number;
    /** Direction de l'ouverture, en degrés : 0 = est, 90 = sud, 180 = ouest, 270 = nord. */
    ouverture: number;
    /** Largeur de l'ouverture, en m. */
    largeurOuverture: number;
  };
};

/** Ce qu'il faut avoir fait pour ouvrir une barrière. Tout doit être rempli. */
export type Condition = {
  indices?: string[];
  enigme?: string;
};

export type Barriere = {
  id: string;
  /** tempete : mur de nuages orageux · brume : voile doré (façon Elden Ring) · porte : grande porte en bois */
  type: "tempete" | "brume" | "porte";
  position: Pos;
  /** Orientation en degrés : direction vers laquelle la barrière fait face (0 = est, 90 = sud…). */
  angle: number;
  /** Largeur en mètres. */
  largeur: number;
  /** Message affiché quand on s'en approche et qu'elle est fermée. */
  message: string;
  condition: Condition;
};

export type Indice = {
  id: string;
  zone: string;
  /** Forme de l'objet dans le monde. */
  objet: "stele" | "livre" | "braise";
  position: Pos;
  titre: string;
  texte: string;
  /** Autres indices liés (le carnet trace un lien entre eux). */
  liens?: string[];
};

export type Enigme = {
  id: string;
  /** Où se trouve le mécanisme à activer. */
  position: Pos;
  titre: string;
  question: string;
  /** Réponse attendue (majuscules, accents et espaces ignorés). */
  solution: string;
};

export type Succes = {
  id: string;
  titre: string;
  description: string;
  /** Caché tant qu'il n'est pas débloqué. */
  secret?: boolean;
  /** Débloqué quand ces éléments sont tous découverts / résolus / ouverts. */
  quand: { zones?: string[]; indices?: string[] | "tous"; enigmes?: string[]; barrieres?: string[] };
};
