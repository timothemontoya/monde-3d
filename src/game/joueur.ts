/**
 * Position et orientation du joueur, mises à jour à chaque image par Joueur.tsx.
 * Un simple objet partagé (pas d'état React) : la mini-carte le lit sans provoquer de rendu.
 */
export const positionJoueur = { x: 0, z: 0, /** Direction du regard, en radians (0 = est, π/2 = sud). */ cap: 0 };
