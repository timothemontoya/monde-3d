/**
 * L'heure du monde, mise à jour à chaque image par Atmosphere.tsx (un simple objet partagé,
 * comme positionJoueur) : les sons et les halos le lisent sans provoquer de rendu.
 */
export const ciel = {
  /** Heure de 0 à 24. */
  heure: 9,
  /** 1 en plein jour, 0 en pleine nuit (fondu à l'aube et au crépuscule). */
  jour: 1,
  /** 1 quand le soleil est bas sur l'horizon (aube, crépuscule), 0 sinon. */
  crepuscule: 0,
};
