import { CHEMINS, REMPARTS } from "../content/monde";
import type { Px } from "../content/types";
import { versMonde } from "./carte";

/** Vrai si le point est dans le polygone (mêmes unités que la zone). */
export function dansZone([x, y]: Px, zone: Px[]) {
  let dedans = false;
  for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
    const [xi, yi] = zone[i];
    const [xj, yj] = zone[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Segment en mètres : [ax, az, bx, bz]. */
export type Segment = [number, number, number, number];
/** Segment occupé au sol, avec sa demi-largeur (m). */
export type Trace = { s: Segment; demi: number };

/** Segments d'une ligne (ou d'un contour fermé), en mètres. */
export function segments(points: Px[], ferme = false): Segment[] {
  const m = points.map(versMonde);
  if (ferme) m.push(m[0]);
  return m.slice(1).map((b, i) => [m[i][0], m[i][1], b[0], b[1]]);
}

let traces: Trace[] | null = null;

/** Demi-épaisseur d'un rempart (voir Remparts.tsx). */
export const DEMI_EPAISSEUR_REMPART = 2.4;

/** Chemins et remparts : rien ne pousse ni ne se construit dessus. */
export function tracesAuSol(): Trace[] {
  traces ??= [
    ...CHEMINS.flatMap((c) => segments(c.points).map((s) => ({ s, demi: c.largeur / 2 }))),
    ...REMPARTS.flatMap((r) => segments(r.zone, true).map((s) => ({ s, demi: DEMI_EPAISSEUR_REMPART }))),
  ];
  return traces;
}
