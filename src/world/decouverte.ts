import { laCarte } from "./carte";
import { graine } from "./relief";

// La carte se découvre par grandes zones : des cellules de Voronoï irrégulières, coupées aux limites
// des régions (et de la côte). Entrer dans une zone la dévoile tout entière.

/** Taille moyenne d'une zone (m). */
const TAILLE = 230;

let zones: { de: Int32Array; cellules: number[][] } | null = null;

/** Pour chaque cellule de la carte, sa zone ; et pour chaque zone, ses cellules. */
export function lesZones() {
  if (zones) return zones;
  const c = laCarte();
  const hasard = graine(7071);
  const pas = TAILLE / c.pas;
  const [nx, nz] = [Math.ceil(c.largeur / pas), Math.ceil(c.hauteur / pas)];
  const germes: [number, number][] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) germes.push([(i + 0.15 + hasard() * 0.7) * pas, (j + 0.15 + hasard() * 0.7) * pas]);

  const de = new Int32Array(c.largeur * c.hauteur);
  const numero = new Map<number, number>();
  const cellules: number[][] = [];
  for (let z = 0; z < c.hauteur; z++)
    for (let x = 0; x < c.largeur; x++) {
      const [gi, gj] = [Math.floor(x / pas), Math.floor(z / pas)];
      let germe = 0;
      let meilleure = Infinity;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const [i, j] = [gi + di, gj + dj];
          if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
          const [gx, gz] = germes[j * nx + i];
          const d = (gx - x) ** 2 + (gz - z) ** 2;
          if (d < meilleure) [meilleure, germe] = [d, j * nx + i];
        }
      const k = z * c.largeur + x;
      const cle = germe * 256 + c.region[k];
      let n = numero.get(cle);
      if (n === undefined) {
        n = cellules.length;
        numero.set(cle, n);
        cellules.push([]);
      }
      de[k] = n;
      cellules[n].push(k);
    }
  zones = { de, cellules };
  return zones;
}

/** Toutes les cellules des zones qui touchent ces cellules-là. */
export function zonesDe(cellules: Iterable<number>) {
  const { de, cellules: parZone } = lesZones();
  const vues = new Set<number>();
  for (const k of cellules) vues.add(de[k]);
  return [...vues].flatMap((z) => parZone[z]);
}
