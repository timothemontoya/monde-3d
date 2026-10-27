import { useMemo } from "react";
import { createNoise2D } from "simplex-noise";
import * as THREE from "three";
import { CHEMINS, REGIONS } from "../content/monde";
import type { Chemin } from "../content/types";
import { MER, regionA, versMonde } from "./carte";
import { InstancesModele, matrice } from "./modeles";
import { graine, hauteurTerrain } from "./relief";

/** Pas entre deux rangées de sommets, en m (le sol a un sommet tous les 4 m). */
const PAS = 2;
/** Position de chaque sommet dans la largeur, son opacité (bords fondus dans l'herbe) et sa teinte (0 = ornière, 1 = bord). */
const TRAVERS: [number, number, number][] = [
  [-0.5, 0, 1],
  [-0.32, 1, 0.7],
  [-0.12, 1, 0],
  [0.12, 1, 0],
  [0.32, 1, 0.7],
  [0.5, 0, 1],
];
/** Le chemin flotte à peine au-dessus du sol affiché. */
const DECOLLEMENT = 0.12;

/** Couleurs de la terre battue : ornière au centre, bord clair. Cendre au volcan, neige tassée en glace. */
const TERRES: Record<string, [string, string]> = {
  "cite-volcanique": ["#3f3633", "#5a4e49"],
  "ile-volcan": ["#3f3633", "#5a4e49"],
  glace: ["#aebcc4", "#d3dde2"],
  iceberg: ["#aebcc4", "#d3dde2"],
  defaut: ["#7f6646", "#a8916a"],
};
const couleurs = Object.fromEntries(Object.entries(TERRES).map(([k, [a, b]]) => [k, [new THREE.Color(a), new THREE.Color(b)]]));
const terreIci = (x: number, z: number) => {
  const r = regionA(x, z);
  return couleurs[r === MER ? "defaut" : REGIONS[r].id] ?? couleurs.defaut;
};

const bruitLargeur = createNoise2D(graine(57));

/** Arrondit un tracé à main levée (algorithme de Chaikin). */
function lisser(points: [number, number][], passes = 2) {
  let p = points;
  for (let k = 0; k < passes; k++) {
    const q: [number, number][] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

/** Un point tous les PAS m le long du tracé. */
function reechantillonner(p: [number, number][]) {
  const sortie: [number, number][] = [p[0]];
  let reste = PAS;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b] = [p[i], p[i + 1]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = reste;
    while (t <= l) {
      sortie.push([a[0] + ((b[0] - a[0]) * t) / l, a[1] + ((b[1] - a[1]) * t) / l]);
      t += PAS;
    }
    reste = t - l;
  }
  return sortie;
}

type Bord = { x: number; y: number; z: number; rot: number; e: number };

/** Ruban posé sur le relief (il s'efface dans l'eau), et ce qui borde le chemin : pierres, lanternes. */
function construire(c: Chemin, hasard: () => number) {
  const p = reechantillonner(lisser(c.points.map(versMonde)));
  const positions: number[] = [];
  const teintes: number[] = [];
  const indices: number[] = [];
  const pierres: Bord[] = [];
  const lanternes: Bord[] = [];
  let prochainePierre = 4;
  let prochaineLanterne = c.lanternes ?? Infinity;
  p.forEach(([x, z], i) => {
    const [a, b] = [p[Math.max(0, i - 1)], p[Math.min(p.length - 1, i + 1)]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [nx, nz] = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    const s = i * PAS;
    // Le chemin s'élargit et se resserre doucement.
    const largeur = c.largeur * (0.8 + 0.35 * bruitLargeur(s / 25, c.largeur));
    const [orniere, bord] = terreIci(x, z);
    for (const [d, alpha, t] of TRAVERS) {
      const [vx, vz] = [x + nx * d * largeur, z + nz * d * largeur];
      const y = hauteurTerrain(vx, vz);
      positions.push(vx, y + DECOLLEMENT, vz);
      const couleur = orniere.clone().lerp(bord, t);
      teintes.push(couleur.r, couleur.g, couleur.b, y > 0.9 ? alpha : 0);
    }
    if (i > 0) {
      const [r0, r1] = [(i - 1) * TRAVERS.length, i * TRAVERS.length];
      for (let k = 0; k < TRAVERS.length - 1; k++) indices.push(r0 + k, r0 + k + 1, r1 + k, r0 + k + 1, r1 + k + 1, r1 + k);
    }
    // Des pierres tous les 6 à 10 m, d'un côté ou de l'autre.
    if (s >= prochainePierre) {
      prochainePierre = s + 6 + hasard() * 4;
      const cote = hasard() < 0.5 ? -1 : 1;
      const [px, pz] = [x + nx * cote * (largeur / 2 + 0.4 + hasard() * 0.8), z + nz * cote * (largeur / 2 + 0.4 + hasard() * 0.8)];
      const y = hauteurTerrain(px, pz);
      if (y > 0.9) pierres.push({ x: px, y: y - 0.1, z: pz, rot: hasard() * Math.PI * 2, e: 0.15 + hasard() * 0.15 });
    }
    // Des lanternes à intervalle régulier, en alternant les côtés.
    if (s >= prochaineLanterne) {
      const cote = lanternes.length % 2 ? -1 : 1;
      const [lx, lz] = [x + nx * cote * (largeur / 2 + 1), z + nz * cote * (largeur / 2 + 1)];
      const y = hauteurTerrain(lx, lz);
      if (y > 0.9) lanternes.push({ x: lx, y: y - 0.1, z: lz, rot: 0, e: 1 });
      prochaineLanterne = s + (c.lanternes ?? Infinity);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(teintes, 4));
  g.setIndex(indices);
  g.computeVertexNormals();
  return { g, pierres, lanternes };
}

/** Rayon de la place de terre battue d'un carrefour, en m. */
const CARREFOUR = 7;

/** Les points d'où partent (ou où arrivent) au moins deux chemins. */
function carrefours() {
  const compte = new Map<string, number>();
  for (const c of CHEMINS) for (const p of [c.points[0], c.points[c.points.length - 1]]) compte.set(p.join(","), (compte.get(p.join(",")) ?? 0) + 1);
  return [...compte].filter(([, n]) => n >= 2).map(([k]) => versMonde(k.split(",").map(Number) as [number, number]));
}

/** Un disque de terre battue posé sur le relief, aux bords fondus. */
function geometrieCarrefour([cx, cz]: [number, number]) {
  const ANGLES = 24;
  const ANNEAUX = 5;
  const [, bord] = terreIci(cx, cz);
  const positions: number[] = [];
  const teintes: number[] = [];
  const indices: number[] = [];
  for (let a = 0; a <= ANNEAUX; a++)
    for (let k = 0; k < ANGLES; k++) {
      const r = (a / ANNEAUX) * CARREFOUR;
      const t = (k / ANGLES) * Math.PI * 2;
      const [x, z] = [cx + Math.cos(t) * r, cz + Math.sin(t) * r];
      positions.push(x, hauteurTerrain(x, z) + DECOLLEMENT, z);
      teintes.push(bord.r, bord.g, bord.b, a === ANNEAUX ? 0 : 1);
      if (a === 0) continue;
      const [i, j] = [a * ANGLES + k, a * ANGLES + ((k + 1) % ANGLES)];
      indices.push(i - ANGLES, j, i, i - ANGLES, j - ANGLES, j);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(teintes, 4));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const TERRE = new THREE.MeshStandardMaterial({
  roughness: 1,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

/** Chemins de terre (CHEMINS dans monde.ts), bordés de pierres et parfois de lanternes. */
export function Chemins() {
  const { geometries, pierres, lanternes } = useMemo(() => {
    const hasard = graine(61);
    const tout = CHEMINS.map((c) => construire(c, hasard));
    const pierres: THREE.Matrix4[][] = [[], [], []];
    tout.flatMap((t) => t.pierres).forEach((b, i) => pierres[i % 3].push(matrice(b.x, b.y, b.z, b.rot, b.e)));
    return {
      geometries: [...tout.map((t) => t.g), ...carrefours().map(geometrieCarrefour)],
      pierres,
      lanternes: tout.flatMap((t) => t.lanternes).map((b) => matrice(b.x, b.y, b.z, b.rot)),
    };
  }, []);
  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={TERRE} receiveShadow />
      ))}
      {pierres.map((m, i) => (
        <InstancesModele key={i} modele={`rocher-${i + 1}`} matrices={m} provisoire={null} />
      ))}
      <InstancesModele modele="lanterne" matrices={lanternes} provisoire={null} />
    </>
  );
}
