import { createNoise2D } from "simplex-noise";
import { CRETES, PONTS, REGIONS, VOLCANS } from "../content/monde";
import type { Px } from "../content/types";
import { laCarte, MER, versMonde } from "./carte";

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
const bruitCretes = createNoise2D(graine(13));

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

/** Crêtes montagneuses : 1 - |bruit|, élevé au carré pour des arêtes vives. */
function cretes(x: number, z: number) {
  let v = 0;
  let amp = 0.6;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    const n = 1 - Math.abs(bruitCretes(x * freq, z * freq));
    v += amp * n * n;
    amp *= 0.5;
    freq *= 2.1;
  }
  return v;
}

// ─── Grilles de base (une valeur par cellule de carte, lissées) ─────────────

type Grilles = { altitude: Float32Array; amplitude: Float32Array; montagne: Float32Array };
let grilles: Grilles | null = null;

/** Flou de boîte séparable, répété deux fois (proche d'un flou gaussien). */
function flouter(g: Float32Array, L: number, H: number, r: number) {
  const tmp = new Float32Array(g.length);
  for (let passe = 0; passe < 2; passe++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < L; x++) {
        let s = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const xx = x + k;
          if (xx < 0 || xx >= L) continue;
          s += g[y * L + xx];
          n++;
        }
        tmp[y * L + x] = s / n;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < L; x++) {
        let s = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const yy = y + k;
          if (yy < 0 || yy >= H) continue;
          s += tmp[yy * L + x];
          n++;
        }
        g[y * L + x] = s / n;
      }
  }
}

function lesGrilles(): Grilles {
  if (grilles) return grilles;
  const c = laCarte();
  const N = c.largeur * c.hauteur;
  const altitude = new Float32Array(N);
  const amplitude = new Float32Array(N);
  const montagne = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (c.region[i] === MER) {
      // Le fond marin descend en s'éloignant de la côte.
      altitude[i] = -3 - 14 * smoothstep(0, 5, c.distMer[i]);
      continue;
    }
    const r = REGIONS[c.region[i]];
    // Près de la côte, le sol rejoint la mer (plages, ou falaises si la région est haute).
    const cote = smoothstep(0, 3, c.distTerre[i]);
    altitude[i] = 1.5 + (r.relief.altitude - 1.5) * cote;
    amplitude[i] = r.relief.amplitude * smoothstep(0, 6, c.distTerre[i]);
    montagne[i] = r.relief.montagne;
  }
  flouter(altitude, c.largeur, c.hauteur, 2);
  flouter(amplitude, c.largeur, c.hauteur, 3);
  flouter(montagne, c.largeur, c.hauteur, 3);
  grilles = { altitude, amplitude, montagne };
  return grilles;
}

/** Valeur d'une grille à la position (x, z), interpolée entre les 4 cellules voisines. */
function echantillon(g: Float32Array, x: number, z: number) {
  const c = laCarte();
  const fx = x / c.pas + c.largeur / 2 - 0.5;
  const fz = z / c.pas + c.hauteur / 2 - 0.5;
  const x0 = Math.max(0, Math.min(c.largeur - 2, Math.floor(fx)));
  const z0 = Math.max(0, Math.min(c.hauteur - 2, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - x0));
  const tz = Math.min(1, Math.max(0, fz - z0));
  const i = z0 * c.largeur + x0;
  const a = g[i] * (1 - tx) + g[i + 1] * tx;
  const b = g[i + c.largeur] * (1 - tx) + g[i + c.largeur + 1] * tx;
  return a * (1 - tz) + b * tz;
}

// ─── Éléments en mètres (convertis depuis les pixels de la carte) ───────────

let elements: {
  volcans: { x: number; z: number; hauteur: number; rayon: number }[];
  cretes: {
    segments: [number, number, number, number][];
    hauteur: number;
    largeur: number;
    /** Cols : centre, largeur, et direction de la crête à cet endroit (tx, tz). */
    cols: { x: number; z: number; largeur: number; tx: number; tz: number }[];
  }[];
  ponts: { ax: number; az: number; bx: number; bz: number; largeur: number; ha: number; hb: number }[];
} | null = null;

const monde = (p: Px) => versMonde(p);

function distanceSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return { d: Math.hypot(px - (ax + t * dx), pz - (az + t * dz)), t };
}

function lesElements() {
  if (elements) return elements;
  elements = {
    volcans: VOLCANS.map((v) => {
      const [x, z] = monde(v.position);
      return { x, z, hauteur: v.hauteur, rayon: v.rayon };
    }),
    cretes: CRETES.map((c) => {
      const pts = c.points.map(monde);
      const segments = pts.slice(1).map((b, i) => [pts[i][0], pts[i][1], b[0], b[1]] as [number, number, number, number]);
      return {
        segments,
        hauteur: c.hauteur,
        largeur: c.largeur,
        cols: (c.cols ?? []).map((col) => {
          const [x, z] = monde(col.position);
          // Direction de la crête au plus près du col : le col est un couloir qui la coupe en travers.
          let meilleur = segments[0];
          let dMin = Infinity;
          for (const sg of segments) {
            const d = distanceSegment(x, z, ...sg).d;
            if (d < dMin) ((dMin = d), (meilleur = sg));
          }
          const l = Math.hypot(meilleur[2] - meilleur[0], meilleur[3] - meilleur[1]) || 1;
          return { x, z, largeur: col.largeur, tx: (meilleur[2] - meilleur[0]) / l, tz: (meilleur[3] - meilleur[1]) / l };
        }),
      };
    }),
    ponts: [],
  };
  // Les ponts relient les deux rives à leur hauteur, un peu au-dessus du sol.
  elements.ponts = PONTS.map((p) => {
    const [ax, az] = monde(p.de);
    const [bx, bz] = monde(p.a);
    return { ax, az, bx, bz, largeur: p.largeur, ha: terrain(ax, az) + 0.4, hb: terrain(bx, bz) + 0.4 };
  });
  return elements;
}

/** Hauteur du terrain (sans les ponts). */
function terrain(x: number, z: number): number {
  const g = lesGrilles();
  const amplitude = echantillon(g.amplitude, x, z);
  const montagne = echantillon(g.montagne, x, z);
  let h = echantillon(g.altitude, x, z);
  if (amplitude > 0.01) {
    const doux = (fbm(x / 420, z / 420, 4) + 1) * 0.5;
    const dur = cretes(x / 520, z / 520);
    h += amplitude * (doux * (1 - montagne) + dur * montagne);
    h += fbm(x / 45, z / 45, 2) * Math.min(3, amplitude * 0.1);
  }

  const e = lesElements();
  for (const v of e.volcans) {
    const d = Math.hypot(x - v.x, z - v.z);
    if (d > v.rayon) continue;
    h += v.hauteur * Math.pow(1 - d / v.rayon, 1.7);
    // Cratère au sommet.
    h -= v.hauteur * 0.28 * Math.pow(Math.max(0, 1 - d / (v.rayon * 0.18)), 2);
  }
  for (const c of e.cretes) {
    let d = Infinity;
    for (const [ax, az, bx, bz] of c.segments) d = Math.min(d, distanceSegment(x, z, ax, az, bx, bz).d);
    if (d > c.largeur) continue;
    // Flancs raides : un plateau qui tombe d'un coup (infranchissable à pied).
    let crete = c.hauteur * (1 - smoothstep(c.largeur * 0.25, c.largeur * 0.5, d));
    for (const col of c.cols) {
      // Distance mesurée le long de la crête : le couloir traverse toute son épaisseur.
      const leLong = Math.abs((x - col.x) * col.tx + (z - col.z) * col.tz);
      crete *= smoothstep(col.largeur * 0.4, col.largeur * 0.7, leLong);
    }
    h += crete;
  }
  return h;
}

/** Hauteur du tablier d'un pont à cette position, ou null si l'on n'est pas sur un pont. */
export function hauteurPont(x: number, z: number): number | null {
  for (const p of lesElements().ponts) {
    const { d, t } = distanceSegment(x, z, p.ax, p.az, p.bx, p.bz);
    if (d > p.largeur / 2) continue;
    // Le pont s'affaisse un peu au milieu.
    return p.ha + (p.hb - p.ha) * t - Math.sin(t * Math.PI) * 1.2;
  }
  return null;
}

/** Hauteur du sol sous les pieds : terrain, ou tablier de pont. Utilisée pour plafonner le vol. */
export function hauteurSol(x: number, z: number): number {
  const h = terrain(x, z);
  const pont = hauteurPont(x, z);
  return pont !== null ? Math.max(h, pont) : h;
}

/** Hauteur du terrain seul (pour dessiner le sol). */
export const hauteurTerrain = terrain;

/** Hauteur de la surface de l'eau. */
export const NIVEAU_MER = 0;
