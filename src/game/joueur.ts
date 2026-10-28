/**
 * Position et orientation du joueur, mises à jour à chaque image par Joueur.tsx.
 * Un simple objet partagé (pas d'état React) : la mini-carte le lit sans provoquer de rendu.
 */
export const positionJoueur = {
  x: 0,
  z: 0,
  /** Direction du regard, en radians (0 = est, π/2 = sud). */
  cap: 0,
  /** Pas : phase (un pas tous les π), amplitude (0 à l'arrêt, 1 en marche), allure (0 marche, 1 course), tassement à l'atterrissage (m). */
  foulee: { phase: 0, amplitude: 0, allure: 0, tassement: 0 },
};
