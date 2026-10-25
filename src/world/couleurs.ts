import * as THREE from "three";
import { REGIONS } from "../content/monde";
import { laCarte, MER } from "./carte";
import { flouter } from "./relief";

/** Sable des plages, fond marin et neige des sommets. */
export const SABLE = "#c9b98a";
export const FOND_MARIN = "#3e4a44";
export const NEIGE = "#f4f6f8";

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Texture d'une case par cellule de carte : la couleur `choix` de chaque région, floutée pour des
 * transitions douces. Les cellules de mer prennent la couleur de la terre voisine (le shader
 * s'occupe du sable et du fond marin selon l'altitude).
 */
function textureRegions(choix: 0 | 1) {
  const c = laCarte();
  const N = c.largeur * c.hauteur;
  const couleurs = REGIONS.map((r) => hex(r.sol[choix]));
  const canaux = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const connue = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (c.region[i] === MER) continue;
    const rgb = couleurs[c.region[i]];
    for (let k = 0; k < 3; k++) canaux[k][i] = rgb[k];
    connue[i] = 1;
  }
  // La mer côtière prend la couleur de la côte (quelques passes de dilatation).
  for (let passe = 0; passe < 4; passe++) {
    const nouvelles: number[] = [];
    for (let i = 0; i < N; i++) {
      if (connue[i]) continue;
      const x = i % c.largeur;
      let n = 0;
      const somme = [0, 0, 0];
      for (const j of [i - 1, i + 1, i - c.largeur, i + c.largeur]) {
        if (j < 0 || j >= N || !connue[j] || Math.abs((j % c.largeur) - x) > 1) continue;
        for (let k = 0; k < 3; k++) somme[k] += canaux[k][j];
        n++;
      }
      if (!n) continue;
      for (let k = 0; k < 3; k++) canaux[k][i] = somme[k] / n;
      nouvelles.push(i);
    }
    for (const i of nouvelles) connue[i] = 1;
  }
  const sable = hex(SABLE);
  for (let i = 0; i < N; i++) if (!connue[i]) for (let k = 0; k < 3; k++) canaux[k][i] = sable[k];
  for (const canal of canaux) flouter(canal, c.largeur, c.hauteur, 1);

  // Canal alpha : la neige est-elle permise ici (pas sur les volcans) ?
  const neige = new Float32Array(N);
  for (let i = 0; i < N; i++) neige[i] = c.region[i] === MER || REGIONS[c.region[i]].neige !== false ? 255 : 0;
  flouter(neige, c.largeur, c.hauteur, 2);
  const donnees = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 3; k++) donnees[i * 4 + k] = Math.round(canaux[k][i]);
    donnees[i * 4 + 3] = Math.round(neige[i]);
  }
  const t = new THREE.DataTexture(donnees, c.largeur, c.hauteur, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

let textures: { herbe: THREE.DataTexture; roche: THREE.DataTexture } | null = null;

/** Couleurs d'herbe et de roche de chaque région, en textures (partagées). */
export function texturesSol() {
  textures ??= { herbe: textureRegions(0), roche: textureRegions(1) };
  return textures;
}
