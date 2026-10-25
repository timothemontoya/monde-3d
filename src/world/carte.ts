import { REGIONS, REGLAGES } from "../content/monde";
import type { Px } from "../content/types";

/**
 * Lecture de la carte dessinée (public/carte.jpg) en une grille de cellules de 4 × 4 pixels.
 * Chaque cellule reçoit une région (ou la mer), puis on calcule la distance à la côte.
 */

/** Taille d'une cellule, en pixels de carte. */
const CELLULE = 4;
export const MER = 255;

const MARQUE_BLANC = 254;
const MARQUE_CONTOUR = 253;
const MARQUE_MER = 252;

export type Carte = {
  largeur: number;
  hauteur: number;
  /** Taille d'une cellule en mètres. */
  pas: number;
  /** Indice dans REGIONS, ou MER. */
  region: Uint8Array;
  /** Distance à la mer (cellules), pour les terres. */
  distTerre: Uint16Array;
  /** Distance à la terre (cellules), pour la mer. */
  distMer: Uint16Array;
  /** Numéro de l'île (morceau de terre d'un seul tenant) de chaque cellule, -1 en mer. */
  ile: Int32Array;
  /** 1 pour la mer ouverte (reliée au bord), 0 ailleurs (terres et lacs). */
  ocean: Uint8Array;
  /** Taille de l'image source, en pixels. */
  image: { largeur: number; hauteur: number };
};

let carte: Carte | null = null;

/** La carte chargée. Disponible une fois chargerCarte() terminé (avant le rendu du monde). */
export function laCarte(): Carte {
  if (!carte) throw new Error("La carte n'est pas encore chargée.");
  return carte;
}

// ─── Conversions ────────────────────────────────────────────────────────────

/** Pixels de la carte → mètres dans le monde (centré sur le milieu de l'image). */
export function versMonde([px, py]: Px): [number, number] {
  const c = laCarte();
  return [(px - c.image.largeur / 2) * REGLAGES.metresParPixel, (py - c.image.hauteur / 2) * REGLAGES.metresParPixel];
}

/** Mètres dans le monde → pixels de la carte. */
export function versCarte(x: number, z: number): Px {
  const c = laCarte();
  return [x / REGLAGES.metresParPixel + c.image.largeur / 2, z / REGLAGES.metresParPixel + c.image.hauteur / 2];
}

function cellule(x: number, z: number): [number, number] {
  const [px, py] = versCarte(x, z);
  return [Math.floor(px / CELLULE), Math.floor(py / CELLULE)];
}

/** Indice de région (dans REGIONS) à la position (x, z), ou MER. */
export function regionA(x: number, z: number): number {
  const c = laCarte();
  const [cx, cy] = cellule(x, z);
  if (cx < 0 || cy < 0 || cx >= c.largeur || cy >= c.hauteur) return MER;
  return c.region[cy * c.largeur + cx];
}

/** Distance à la côte en mètres, si l'on est en mer (0 sur terre). */
export function distanceEnMer(x: number, z: number): number {
  const c = laCarte();
  const [cx, cy] = cellule(x, z);
  if (cx < 0 || cy < 0 || cx >= c.largeur || cy >= c.hauteur) return Infinity;
  const i = cy * c.largeur + cx;
  return c.region[i] === MER ? c.distMer[i] * c.pas : 0;
}

// ─── Chargement ─────────────────────────────────────────────────────────────

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function chargerImage(url: string) {
  return new Promise<HTMLImageElement>((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(`Impossible de charger la carte ${url}`));
    img.src = url;
  });
}

/** Parcours en largeur multi-sources : distance (en cellules) aux cellules de départ. */
function distances(largeur: number, hauteur: number, depart: (i: number) => boolean, dans: (i: number) => boolean) {
  const dist = new Uint16Array(largeur * hauteur).fill(65535);
  const file = new Int32Array(largeur * hauteur);
  let debut = 0;
  let fin = 0;
  for (let i = 0; i < dist.length; i++) if (depart(i)) ((dist[i] = 0), (file[fin++] = i));
  while (debut < fin) {
    const i = file[debut++];
    const x = i % largeur;
    const y = (i / largeur) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= largeur || ny >= hauteur) continue;
      const j = ny * largeur + nx;
      if (dist[j] !== 65535 || !dans(j)) continue;
      dist[j] = dist[i] + 1;
      file[fin++] = j;
    }
  }
  return dist;
}

/** Composantes connexes des cellules qui vérifient `garder`. Renvoie l'étiquette de chaque cellule (-1 sinon). */
function composantes(largeur: number, hauteur: number, garder: (i: number) => boolean) {
  const etiquette = new Int32Array(largeur * hauteur).fill(-1);
  const file = new Int32Array(largeur * hauteur);
  let n = 0;
  for (let s = 0; s < etiquette.length; s++) {
    if (etiquette[s] !== -1 || !garder(s)) continue;
    let debut = 0;
    let fin = 0;
    file[fin++] = s;
    etiquette[s] = n;
    while (debut < fin) {
      const i = file[debut++];
      const x = i % largeur;
      const y = (i / largeur) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= largeur || ny >= hauteur) continue;
        const j = ny * largeur + nx;
        if (etiquette[j] !== -1 || !garder(j)) continue;
        etiquette[j] = n;
        file[fin++] = j;
      }
    }
    n++;
  }
  return etiquette;
}

export async function chargerCarte(): Promise<Carte> {
  if (carte) return carte;
  const img = await chargerImage(`${import.meta.env.BASE_URL}${REGLAGES.carte}`);
  const toile = document.createElement("canvas");
  toile.width = img.naturalWidth;
  toile.height = img.naturalHeight;
  const ctx = toile.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, toile.width, toile.height).data;

  const L = Math.floor(toile.width / CELLULE);
  const H = Math.floor(toile.height / CELLULE);
  const N = L * H;
  const [ix, iy, il, ih] = REGLAGES.ignorer;

  // Couleurs distinctes des régions (hors blanc, qui est traité à part).
  const palette = [...new Set(REGIONS.map((r) => r.couleur.toLowerCase()))].filter((c) => c !== "#ffffff");
  const rgb = palette.map(hex);
  const indexBlanc = palette.length;

  // 1. Classement de chaque cellule : couleur de région, blanc, ou contour noir.
  const classe = new Uint8Array(N);
  for (let cy = 0; cy < H; cy++) {
    for (let cx = 0; cx < L; cx++) {
      const i = cy * L + cx;
      const px0 = cx * CELLULE;
      const py0 = cy * CELLULE;
      if (px0 >= ix && px0 < ix + il && py0 >= iy && py0 < iy + ih) {
        classe[i] = MARQUE_BLANC;
        continue;
      }
      // Un seul pixel sombre dans la cellule suffit : les contours restent bien fermés.
      let sombre = false;
      for (let y = 0; y < CELLULE && !sombre; y++) {
        for (let x = 0; x < CELLULE; x++) {
          const k = ((py0 + y) * toile.width + (px0 + x)) * 4;
          if (pixels[k] + pixels[k + 1] + pixels[k + 2] < 260) {
            sombre = true;
            break;
          }
        }
      }
      if (sombre) {
        classe[i] = MARQUE_CONTOUR;
        continue;
      }
      const k = ((py0 + 2) * toile.width + (px0 + 2)) * 4;
      const r = pixels[k];
      const g = pixels[k + 1];
      const b = pixels[k + 2];
      if (Math.min(r, g, b) > 226 && Math.max(r, g, b) - Math.min(r, g, b) < 22) {
        classe[i] = MARQUE_BLANC;
        continue;
      }
      let meilleur = MARQUE_CONTOUR;
      let dMin = 70 * 70;
      rgb.forEach(([pr, pg, pb], idx) => {
        const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (d < dMin) {
          dMin = d;
          meilleur = idx;
        }
      });
      classe[i] = meilleur;
    }
  }

  // 2. La mer : le blanc relié au bord de l'image (les contours noirs font barrage).
  const mer = distances(
    L,
    H,
    (i) => {
      const x = i % L;
      const y = (i / L) | 0;
      return classe[i] === MARQUE_BLANC && (x === 0 || y === 0 || x === L - 1 || y === H - 1);
    },
    (i) => classe[i] === MARQUE_BLANC,
  );
  for (let i = 0; i < N; i++) if (mer[i] !== 65535) classe[i] = MARQUE_MER;

  // 3. Le blanc enfermé : terre s'il contient le point d'une région blanche, lac sinon.
  const regionsBlanches = REGIONS.filter((r) => r.couleur.toLowerCase() === "#ffffff" && r.point);
  const etiquettesBlanc = composantes(L, H, (i) => classe[i] === MARQUE_BLANC);
  const blancTerre = new Set<number>();
  for (const r of regionsBlanches) {
    const [px, py] = r.point!;
    const e = etiquettesBlanc[Math.floor(py / CELLULE) * L + Math.floor(px / CELLULE)];
    if (e >= 0) blancTerre.add(e);
  }
  for (let i = 0; i < N; i++) {
    if (classe[i] !== MARQUE_BLANC) continue;
    classe[i] = blancTerre.has(etiquettesBlanc[i]) ? indexBlanc : MARQUE_MER;
  }

  // 4. Les contours prennent la classe majoritaire de leurs voisins.
  for (let passe = 0; passe < 8; passe++) {
    const suivant = classe.slice();
    let reste = 0;
    for (let i = 0; i < N; i++) {
      if (classe[i] !== MARQUE_CONTOUR) continue;
      const x = i % L;
      const y = (i / L) | 0;
      const votes = new Map<number, number>();
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= L || ny >= H) continue;
          const c = classe[ny * L + nx];
          if (c !== MARQUE_CONTOUR) votes.set(c, (votes.get(c) ?? 0) + 1);
        }
      if (votes.size) suivant[i] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
      else reste++;
    }
    classe.set(suivant);
    if (!reste) break;
  }

  // 5. Régions : une même couleur peut donner plusieurs régions selon le morceau (point).
  const region = new Uint8Array(N).fill(MER);
  const toutesCouleurs = [...palette, "#ffffff"];
  toutesCouleurs.forEach((couleur, idx) => {
    const candidates = REGIONS.map((r, ri) => ({ r, ri })).filter(({ r }) => r.couleur.toLowerCase() === couleur);
    if (!candidates.length) return;
    const etiquettes = composantes(L, H, (i) => classe[i] === idx);
    const parMorceau = new Map<number, number>();
    for (const { r, ri } of candidates) {
      if (!r.point) continue;
      // Le morceau qui contient le point (ou la cellule de cette couleur la plus proche).
      const [px, py] = r.point;
      const cx0 = Math.floor(px / CELLULE);
      const cy0 = Math.floor(py / CELLULE);
      let trouve = -1;
      for (let rayon = 0; rayon < 12 && trouve < 0; rayon++)
        for (let dy = -rayon; dy <= rayon && trouve < 0; dy++)
          for (let dx = -rayon; dx <= rayon && trouve < 0; dx++) {
            const nx = cx0 + dx;
            const ny = cy0 + dy;
            if (nx < 0 || ny < 0 || nx >= L || ny >= H) continue;
            const e = etiquettes[ny * L + nx];
            if (e >= 0) trouve = e;
          }
      if (trouve >= 0) parMorceau.set(trouve, ri);
    }
    const parDefaut = candidates.find(({ r }) => !r.point)?.ri ?? candidates[0].ri;
    for (let i = 0; i < N; i++) {
      if (etiquettes[i] < 0) continue;
      region[i] = parMorceau.get(etiquettes[i]) ?? parDefaut;
    }
  });

  // 6. Distances à la côte, de part et d'autre.
  const distTerre = distances(L, H, (i) => region[i] === MER, (i) => region[i] !== MER);
  const distMer = distances(L, H, (i) => region[i] !== MER, (i) => region[i] === MER);

  // 7. Îles : morceaux de terre d'un seul tenant (pour relier les ponts).
  const ile = composantes(L, H, (i) => region[i] !== MER);

  // 8. Mer ouverte : l'eau reliée au bord de l'image (le reste, ce sont des lacs).
  const reliee = distances(
    L,
    H,
    (i) => region[i] === MER && (i % L === 0 || i < L || i % L === L - 1 || i >= N - L),
    (i) => region[i] === MER,
  );
  const ocean = new Uint8Array(N);
  for (let i = 0; i < N; i++) ocean[i] = reliee[i] !== 65535 ? 1 : 0;

  carte = {
    largeur: L,
    hauteur: H,
    pas: CELLULE * REGLAGES.metresParPixel,
    region,
    distTerre,
    distMer,
    ile,
    ocean,
    image: { largeur: toile.width, hauteur: toile.height },
  };
  return carte;
}

/** Bornes du monde, en mètres. */
export function bornes() {
  const c = laCarte();
  return { demiLargeur: (c.largeur * c.pas) / 2, demiHauteur: (c.hauteur * c.pas) / 2 };
}

/** Développement : image de la carte telle que le moteur l'a comprise (une couleur par région, mer en bleu). */
export function carteComprise(): string {
  const c = laCarte();
  const toile = document.createElement("canvas");
  toile.width = c.largeur;
  toile.height = c.hauteur;
  const ctx = toile.getContext("2d")!;
  const img = ctx.createImageData(c.largeur, c.hauteur);
  const couleurs = REGIONS.map((_, i) => {
    // Teinte distincte par région, pour bien voir les morceaux séparés.
    const h = (i * 137.5) % 360;
    const col = document.createElement("canvas").getContext("2d")!;
    col.fillStyle = `hsl(${h} 60% 55%)`;
    col.fillRect(0, 0, 1, 1);
    return col.getImageData(0, 0, 1, 1).data;
  });
  for (let i = 0; i < c.region.length; i++) {
    const r = c.region[i];
    const rgb = r === MER ? [30, 60, 110] : couleurs[r];
    img.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return toile.toDataURL();
}

/** Indice de la cellule à la position (x, z), ou -1 hors carte. */
export function indiceCellule(x: number, z: number): number {
  const c = laCarte();
  const [cx, cy] = cellule(x, z);
  if (cx < 0 || cy < 0 || cx >= c.largeur || cy >= c.hauteur) return -1;
  return cy * c.largeur + cx;
}

/** Centre d'une cellule, en mètres. */
export function centreCellule(i: number): [number, number] {
  const c = laCarte();
  return [((i % c.largeur) + 0.5 - c.largeur / 2) * c.pas, (Math.floor(i / c.largeur) + 0.5 - c.hauteur / 2) * c.pas];
}
