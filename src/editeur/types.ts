import type { Px } from "../content/types";

/**
 * Annotations de la carte de travail (editeur.html), enregistrées dans plans/annotations.json.
 * Les positions sont en pixels de la carte (public/carte.jpg), comme dans src/content/monde.ts.
 */

export type Forme = "ping" | "trait" | "zone";

export const CATEGORIES = {
  village: { nom: "Village", couleur: "#e0b050" },
  lieu: { nom: "Lieu nommé", couleur: "#f1dcaa" },
  objet: { nom: "Objet", couleur: "#5fb3d9" },
  decor: { nom: "Bâtiment / décor", couleur: "#c98a5a" },
  creature: { nom: "Créature / PNJ", couleur: "#9bd36a" },
  foret: { nom: "Forêt / végétation", couleur: "#4f8a3a" },
  eau: { nom: "Eau", couleur: "#3f86c9" },
  montagne: { nom: "Relief", couleur: "#9a8f80" },
  chemin: { nom: "Chemin / route", couleur: "#d9c08a" },
  note: { nom: "Note", couleur: "#e05a5a" },
} as const;

export type Categorie = keyof typeof CATEGORIES;

export type Annotation = {
  id: string;
  forme: Forme;
  categorie: Categorie;
  /** Un point pour un ping, le tracé pour un trait ou une zone. */
  points: Px[];
  couleur: string;
  nom: string;
  /** Ce que tu veux à cet endroit. */
  note: string;
  /** « fait » une fois que Claude l'a mis dans le jeu. */
  statut: "a-faire" | "fait";
  /** Réponse de Claude : ce qui a été fait, ou une question. */
  reponse?: string;
  cree: string;
};

export type Fichier = { annotations: Annotation[] };
