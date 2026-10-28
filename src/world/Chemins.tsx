import { useMemo } from "react";
import { createNoise2D } from "simplex-noise";
import * as THREE from "three";
import { CHEMINS, REGIONS } from "../content/monde";
import type { Chemin } from "../content/types";
import { centreCellule, laCarte, MER, regionA, versMonde } from "./carte";
import { LEGER } from "../qualite";
import { InstancesModele, matrice } from "./modeles";
import { Halos, VERRE_LANTERNE } from "./Lueurs";
import { graine, hauteurTerrain } from "./relief";
import { largeurChemin } from "./zones";
import { VILLAGES } from "../content/monde";

/** Pas entre deux décors possibles le long d'un chemin, en m. */
const PAS = 2;
/** Longueur d'un élément de clôture (modèle « cloture »), en m. */
const CLOTURE = 2.2;

/** Couleurs de la terre battue : ornière au centre, bord clair. Cendre au volcan, neige tassée en glace. */
const TERRES: Record<string, [string, string]> = {
  "cite-volcanique": ["#3f3633", "#5a4e49"],
  "ile-volcan": ["#3f3633", "#5a4e49"],
  glace: ["#aebcc4", "#d3dde2"],
  iceberg: ["#aebcc4", "#d3dde2"],
  defaut: ["#7f6646", "#a8916a"],
  // Rigole de lave : cœur jaune, bords rouges.
  lave: ["#ffd25a", "#ff5a1a"],
};
const couleurs = Object.fromEntries(Object.entries(TERRES).map(([k, [a, b]]) => [k, [new THREE.Color(a), new THREE.Color(b)]]));
const terreIci = (x: number, z: number) => {
  const r = regionA(x, z);
  return couleurs[r === MER ? "defaut" : REGIONS[r].id] ?? couleurs.defaut;
};

const bruitLargeur = createNoise2D(graine(57));
/** Le chemin s'élargit et se resserre doucement. */
const largeurA = (c: Chemin, s: number) =>
  largeurChemin(c) * (0.85 + 0.25 * bruitLargeur(s / 25, c.largeur) + 0.12 * bruitLargeur(s / 6, c.largeur + 7));

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

const centresVillages = () => VILLAGES.map((v) => ({ c: versMonde(v.centre), r: v.rayon + 10 }));
let villages: ReturnType<typeof centresVillages> | null = null;
const dansVillage = (x: number, z: number) => (villages ??= centresVillages()).some((v) => Math.hypot(x - v.c[0], z - v.c[1]) < v.r);

type Bord = { x: number; y: number; z: number; rot: number; e: number };

/** Ce qui borde le chemin : pierres, clôtures, buissons, lanternes. */
function construire(c: Chemin, hasard: () => number) {
  const p = reechantillonner(lisser(c.points.map(versMonde)));
  const pierres: Bord[] = [];
  const lanternes: Bord[] = [];
  const clotures: Bord[] = [];
  const bordures: (Bord & { modele: string })[] = [];
  let prochaineBordure = 5;
  // Tronçons de clôture : 3 à 5 éléments, puis une trouée, d'un côté ou de l'autre.
  let troncon = { fin: 0, prochain: 6, cote: 1 };
  let prochainePierre = 4;
  let prochaineLanterne = c.lanternes ?? Infinity;
  p.forEach(([x, z], i) => {
    const [a, b] = [p[Math.max(0, i - 1)], p[Math.min(p.length - 1, i + 1)]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [nx, nz] = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    const s = i * PAS;
    const largeur = largeurA(c, s);
    // Des pierres tous les 6 à 10 m, d'un côté ou de l'autre.
    if (s >= prochainePierre) {
      prochainePierre = s + 6 + hasard() * 4;
      const cote = hasard() < 0.5 ? -1 : 1;
      const [px, pz] = [x + nx * cote * (largeur / 2 + 0.4 + hasard() * 0.8), z + nz * cote * (largeur / 2 + 0.4 + hasard() * 0.8)];
      const y = hauteurTerrain(px, pz);
      if (y > 0.9) pierres.push({ x: px, y: y - 0.1, z: pz, rot: hasard() * Math.PI * 2, e: 0.15 + hasard() * 0.15 });
    }
    // Clôtures : serrées le long des chemins qui en ont (`clotures`), par-ci par-là sur les autres (hors villages et lave).
    const clos = c.clotures ? s <= c.clotures : c.matiere !== "lave" && !dansVillage(x, z);
    if (clos) {
      if (s >= troncon.prochain) {
        const longueur = (3 + Math.floor(hasard() * (c.clotures ? 3 : 5))) * CLOTURE;
        const trouee = c.clotures ? 10 + hasard() * 20 : 40 + hasard() * 90;
        troncon = { fin: s + longueur, prochain: s + longueur + trouee, cote: hasard() < 0.5 ? -1 : 1 };
      }
      if (s < troncon.fin && s % CLOTURE < PAS) {
        const [fx, fz] = [x + nx * troncon.cote * (largeur / 2 + 1.6), z + nz * troncon.cote * (largeur / 2 + 1.6)];
        const y = hauteurTerrain(fx, fz);
        if (y > 0.9) clotures.push({ x: fx, y: y - 0.05, z: fz, rot: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), e: 1 });
      }
    }
    // Des buissons et des souches en bordure, tous les 8 à 15 m (pas sur la lave).
    if (s >= prochaineBordure && c.matiere !== "lave") {
      prochaineBordure = s + 8 + hasard() * 7;
      const cote = hasard() < 0.5 ? -1 : 1;
      const ecart = largeur / 2 + 1.2 + hasard() * 1.5;
      const [bx, bz] = [x + nx * cote * ecart, z + nz * cote * ecart];
      const y = hauteurTerrain(bx, bz);
      const modele = ["buisson-1", "buisson-2", "buisson-1", "souche"][Math.floor(hasard() * 4)];
      if (y > 0.9) bordures.push({ x: bx, y: y - 0.1, z: bz, rot: hasard() * Math.PI * 2, e: modele === "souche" ? 0.8 : 0.6 + hasard() * 0.6, modele });
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
  return { pierres, lanternes, clotures, bordures };
}


// ─── Les traces peintes dans le sol ─────────────────────────────────────────
// Chemins, lave et veines d'or ne sont plus des rubans posés sur le relief (ils se chevauchaient et
// clignotaient) : on les peint dans deux textures que le sol lit pixel par pixel (Terrain.tsx).
// Texture « traces » : couleur (rgb) et présence (a). Texture « lueurs » : ce qui brille (r).

/** Taille d'un pixel des textures, en m. */
const TEXEL = LEGER ? 1.5 : 1;
/** Rayon de la place de terre battue d'un carrefour, en m. */
const CARREFOUR = 7;

/** Les points d'où partent (ou où arrivent) au moins deux chemins. */
function carrefours() {
  const compte = new Map<string, number>();
  for (const c of CHEMINS)
    for (const p of new Set([c.points[0].join(","), c.points[c.points.length - 1].join(",")])) compte.set(p, (compte.get(p) ?? 0) + 1);
  return [...compte].filter(([, n]) => n >= 2).map(([k]) => versMonde(k.split(",").map(Number) as [number, number]));
}

type Toile = { l: number; h: number; tx: number; tz: number; couleur: Uint8Array; lueur: Uint8Array; proche: Float32Array };

/**
 * Un tampon rond : `r` rayon en m, `forme(n)` → [présence, teinte] selon la distance relative n (0 au centre, 1 au bord).
 * Le pixel garde la couleur du tampon dont il est le plus près du centre.
 */
function tamponner(t: Toile, x: number, z: number, r: number, couleur: (n: number) => [number, THREE.Color], brille: boolean) {
  const ci = (x + t.tx / 2) / TEXEL;
  const cj = (z + t.tz / 2) / TEXEL;
  const rp = r / TEXEL;
  for (let j = Math.max(0, Math.floor(cj - rp)); j <= Math.min(t.h - 1, Math.ceil(cj + rp)); j++)
    for (let i = Math.max(0, Math.floor(ci - rp)); i <= Math.min(t.l - 1, Math.ceil(ci + rp)); i++) {
      const n = Math.hypot(i + 0.5 - ci, j + 0.5 - cj) / rp;
      if (n >= 1) continue;
      const k = j * t.l + i;
      const [presence, c] = couleur(n);
      const v = Math.round(presence * 255);
      if (n < t.proche[k]) {
        t.proche[k] = n;
        t.couleur[k * 4] = c.r * 255;
        t.couleur[k * 4 + 1] = c.g * 255;
        t.couleur[k * 4 + 2] = c.b * 255;
      }
      t.couleur[k * 4 + 3] = Math.max(t.couleur[k * 4 + 3], v);
      if (brille) t.lueur[k] = Math.max(t.lueur[k], v);
    }
}

const mixe = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, t);

/** Un chemin : ornière sombre au centre, bord clair qui se fond dans l'herbe. */
function peindreChemin(t: Toile, c: Chemin) {
  const p = lisser(c.points.map(versMonde));
  const lave = c.matiere === "lave";
  let s = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b] = [p[i], p[i + 1]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < l; d += TEXEL * 0.6, s += TEXEL * 0.6) {
      const [x, z] = [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l];
      const [orniere, bord] = lave ? couleurs.lave : terreIci(x, z);
      tamponner(t, x, z, largeurA(c, s) / 2, (n) => [1 - smoothstep(0.6, 1, n), mixe(orniere, bord, smoothstep(0.2, 0.9, n))], lave);
    }
  }
}

/** Une veine d'or qui serpente et se ramifie, de plus en plus fine. */
function peindreVeine(t: Toile, x: number, z: number, angle: number, longueur: number, epaisseur: number, hasard: () => number, profondeur = 0) {
  const or = [new THREE.Color("#fff0a0"), new THREE.Color("#ffb21c")];
  for (let s = 0; s < longueur; s += TEXEL * 0.5) {
    angle += (hasard() - 0.5) * 0.35;
    x += Math.cos(angle) * TEXEL * 0.5;
    z += Math.sin(angle) * TEXEL * 0.5;
    const e = epaisseur * (1 - (s / longueur) * 0.7);
    tamponner(t, x, z, e, (n) => [1 - smoothstep(0.3, 1, n), mixe(or[0], or[1], n)], true);
    if (profondeur < 2 && hasard() < 0.012) peindreVeine(t, x, z, angle + (hasard() < 0.5 ? -1 : 1) * (0.5 + hasard() * 0.6), (longueur - s) * 0.5, e * 0.7, hasard, profondeur + 1);
  }
}

/** Les veines d'or : en étoile depuis la Fracture, en craquelures éparses sur les terres qu'elle a touchées. */
function peindreVeines(t: Toile) {
  const c = laCarte();
  const hasard = graine(83);
  const cellules = (id: string) => {
    const ri = REGIONS.findIndex((r) => r.id === id);
    const liste: number[] = [];
    for (let i = 0; i < c.region.length; i++) if (c.region[i] === ri) liste.push(i);
    return liste;
  };
  const fracture = cellules("fracture-or");
  if (fracture.length) {
    let [cx, cz] = [0, 0];
    for (const i of fracture) {
      const [x, z] = centreCellule(i);
      cx += x / fracture.length;
      cz += z / fracture.length;
    }
    for (let k = 0; k < 18; k++) peindreVeine(t, cx, cz, (k / 18) * Math.PI * 2 + hasard() * 0.3, 160 + hasard() * 260, 1.4, hasard);
  }
  for (const [id, nombre, longueur] of [["fracture-or", 40, 40], ["terres-rougies", 140, 26], ["landes-roses", 18, 12]] as const) {
    const liste = cellules(id);
    for (let k = 0; k < nombre && liste.length; k++) {
      const [x, z] = centreCellule(liste[Math.floor(hasard() * liste.length)]);
      peindreVeine(t, x, z, hasard() * Math.PI * 2, longueur * (0.5 + hasard()), 0.45, hasard, 1);
    }
  }
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

let traces: { couleur: THREE.DataTexture; lueur: THREE.DataTexture } | null = null;

/** Les deux textures des traces, sur tout le monde (calculées une fois). */
export function texturesTraces() {
  if (traces) return traces;
  const c = laCarte();
  const [tx, tz] = [c.largeur * c.pas, c.hauteur * c.pas];
  const [l, h] = [Math.ceil(tx / TEXEL), Math.ceil(tz / TEXEL)];
  const t: Toile = { l, h, tx, tz, couleur: new Uint8Array(l * h * 4), lueur: new Uint8Array(l * h), proche: new Float32Array(l * h).fill(2) };
  for (const ch of CHEMINS) peindreChemin(t, ch);
  for (const [x, z] of carrefours()) {
    const [, bord] = terreIci(x, z);
    tamponner(t, x, z, CARREFOUR, (n) => [1 - smoothstep(0.75, 1, n), bord], false);
  }
  peindreVeines(t);
  const texture = (donnees: Uint8Array, format: THREE.PixelFormat) => {
    const tex = new THREE.DataTexture(donnees, l, h, format);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  };
  traces = { couleur: texture(t.couleur, THREE.RGBAFormat), lueur: texture(t.lueur, THREE.RedFormat) };
  return traces;
}

/** Ce qui borde les chemins (CHEMINS dans monde.ts) : pierres, clôtures, buissons, lanternes. Le chemin lui-même est peint dans le sol. */
export function Chemins() {
  const { pierres, lanternes, verres, clotures, bordures } = useMemo(() => {
    const hasard = graine(61);
    const tout = CHEMINS.map((c) => construire(c, hasard));
    const pierres: THREE.Matrix4[][] = [[], [], []];
    tout.flatMap((t) => t.pierres).forEach((b, i) => pierres[i % 3].push(matrice(b.x, b.y, b.z, b.rot, b.e)));
    return {
      pierres,
      lanternes: tout.flatMap((t) => t.lanternes).map((b) => matrice(b.x, b.y, b.z, b.rot)),
      verres: tout.flatMap((t) => t.lanternes).map((b) => [b.x, b.y + VERRE_LANTERNE, b.z] as [number, number, number]),
      clotures: tout.flatMap((t) => t.clotures).map((b) => matrice(b.x, b.y, b.z, b.rot)),
      bordures: [...new Set(tout.flatMap((t) => t.bordures.map((b) => b.modele)))].map(
        (modele) => [modele, tout.flatMap((t) => t.bordures.filter((b) => b.modele === modele)).map((b) => matrice(b.x, b.y, b.z, b.rot, b.e))] as const,
      ),
    };
  }, []);
  return (
    <>
      {pierres.map((m, i) => (
        <InstancesModele key={i} modele={`rocher-${i + 1}`} matrices={m} provisoire={null} />
      ))}
      <InstancesModele modele="lanterne" matrices={lanternes} provisoire={null} />
      <Halos positions={verres} />
      <InstancesModele modele="cloture" matrices={clotures} provisoire={null} />
      {bordures.map(([modele, m]) => (
        <InstancesModele key={modele} modele={modele} matrices={m} provisoire={null} />
      ))}
    </>
  );
}
