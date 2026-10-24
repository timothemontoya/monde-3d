import type { Barriere } from "../content/types";

/** Rotation (autour de l'axe vertical) qui fait face à la direction donnée en degrés (0 = est, 90 = sud). */
export const rotationFace = (directionDeg: number) => Math.PI / 2 - (directionDeg * Math.PI) / 180;

/** Distance horizontale d'un point au segment occupé par une barrière. */
export function distanceBarriere(b: Barriere, x: number, z: number) {
  const a = (b.angle * Math.PI) / 180;
  // Le segment est perpendiculaire à la direction de la barrière.
  const tx = -Math.sin(a);
  const tz = Math.cos(a);
  const dx = x - b.position[0];
  const dz = z - b.position[1];
  const le_long = Math.max(-b.largeur / 2, Math.min(b.largeur / 2, dx * tx + dz * tz));
  return Math.hypot(dx - tx * le_long, dz - tz * le_long);
}
