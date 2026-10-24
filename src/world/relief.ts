import { createNoise2D } from "simplex-noise";
import { REGLAGES, ZONES } from "../content/monde";

/** Générateur pseudo-aléatoire à graine fixe : le monde est identique à chaque visite. */
export function graine(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bruit = createNoise2D(graine(7));
const bruitRoches = createNoise2D(graine(13));

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function fbm(x: number, z: number, octaves: number) {
  let v = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * bruit(x * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / norm;
}

/** Hauteur du sol (en m) à la position (x, z). Utilisée pour le terrain ET pour plafonner le vol. */
export function hauteurSol(x: number, z: number): number {
  // Grandes ondulations + détail.
  let h = fbm(x / 320, z / 320, 4) * 26 + fbm(x / 60, z / 60, 3) * 3;

  // Le nord (terres orageuses) est plus accidenté : crêtes rocheuses.
  const nord = smoothstep(-120, -260, z);
  h += nord * (Math.abs(bruitRoches(x / 90, z / 90)) * 28 + 8);

  // Le promontoire de départ est un peu surélevé.
  const depart = ZONES[0];
  const dDepart = Math.hypot(x - depart.centre[0], z - depart.centre[1]);
  h += (1 - smoothstep(0, depart.rayon * 1.3, dDepart)) * 10;

  // Les zones avec un plateau (villages, sanctuaires) sont aplaties.
  for (const zone of ZONES) {
    if (zone.plateau === undefined) continue;
    const d = Math.hypot(x - zone.centre[0], z - zone.centre[1]);
    const t = 1 - smoothstep(zone.rayon * 0.95, zone.rayon * 1.35, d);
    h = h * (1 - t) + zone.plateau * t;
  }

  // Au bord de l'île, le sol remonte doucement vers la tempête qui ceinture le monde.
  const r = Math.hypot(x, z);
  h += smoothstep(REGLAGES.rayonMonde - 80, REGLAGES.rayonMonde + 40, r) * 30;

  return h;
}
