import { BARRIERES, DECORS, ENIGMES, FEUX, INDICES, LIEUX, PONTS, PORTS, RAMASSABLES, REGLAGES, VILLAGES } from "../content/monde";
import type { DecorUnique, Pont, Port, Px, Village } from "../content/types";
import { centreCellule, indiceCellule, laCarte, MER, regionA, versMonde } from "./carte";
import { rotationFace } from "./geometrie";
import { definirPlateformes, definirPonts, distanceSegment, graine, hauteurBrute, hauteurSol, type Plateforme, type PontPlace } from "./relief";

/**
 * Le plan du monde : où se pose chaque chose, calculé une fois au chargement.
 *
 * Les positions de monde.ts (pixels de ta carte) sont ajustées pour que rien ne flotte,
 * ne s'enfonce ou ne tombe à l'eau : on ramène sur la terre ferme, on aplanit le sol sous
 * les constructions, on relie les ponts aux rives les plus proches, on pose les quais au bord de l'eau.
 */

export type Point = { x: number; y: number; z: number };
export type Maison = Point & { rot: number; l: number; h: number; p: number; modele: string; village: Village };
export type Quai = Point & {
  /** Rotation autour de la verticale : le ponton avance dans l'eau selon l'axe +Z local. */
  rot: number;
  /** Point d'appel du bateau (milieu du ponton). */
  appel: [number, number];
};
export type Decor = Point & { rot: number; def: DecorUnique };

export type Plan = {
  depart: Point & { cap: number };
  feux: Record<string, Point & { arrivee: [number, number] }>;
  indices: Record<string, Point>;
  enigmes: Record<string, Point>;
  ramassables: Record<string, Point>;
  ports: Record<string, Quai>;
  /** Ponts suspendus (sans les pontons des quais). */
  ponts: PontPlace[];
  maisons: Maison[];
  decors: Decor[];
  portail: Point;
  palais: Point;
};

/** Longueur d'un ponton de quai, en m. */
export const LONGUEUR_QUAI = 26;
/** Hauteur du plancher des pontons au-dessus de la mer. */
const NIVEAU_QUAI = 1;

let plan: Plan | null = null;

export function lePlan(): Plan {
  if (!plan) throw new Error("Le plan n'est pas encore calculé.");
  return plan;
}

// ─── Recherche sur la grille ────────────────────────────────────────────────

const celluleDe = (x: number, z: number): [number, number] => {
  const c = laCarte();
  return [Math.floor(x / c.pas + c.largeur / 2), Math.floor(z / c.pas + c.hauteur / 2)];
};

/** Cellule la plus proche de (cx0, cz0) qui vérifie `ok`, ou -1. Parcours en anneaux. */
function plusProche(cx0: number, cz0: number, ok: (i: number) => boolean, rayonMax = 60) {
  const c = laCarte();
  let meilleur = -1;
  let dMin = Infinity;
  const tester = (dx: number, dz: number) => {
    const x = cx0 + dx;
    const z = cz0 + dz;
    if (x < 0 || z < 0 || x >= c.largeur || z >= c.hauteur) return;
    const i = z * c.largeur + x;
    const d = dx * dx + dz * dz;
    if (d < dMin && ok(i)) ((dMin = d), (meilleur = i));
  };
  for (let r = 0; r <= rayonMax; r++) {
    // Un point de l'anneau r est à au moins r cellules : inutile d'aller plus loin.
    if (meilleur >= 0 && r * r > dMin) break;
    if (r === 0) tester(0, 0);
    for (let d = -r; d <= r && r > 0; d++) {
      tester(d, -r);
      tester(d, r);
      if (Math.abs(d) < r) (tester(-r, d), tester(r, d));
    }
  }
  return meilleur;
}

/**
 * Ramène un point sur la terre ferme, à au moins `marge` cellules de la mer.
 * S'il y est déjà, il ne bouge pas. Renvoie des mètres.
 */
export function terreFerme(p: Px, marge = 2): [number, number] {
  const c = laCarte();
  const [x, z] = versMonde(p);
  const ok = (i: number) => c.region[i] !== MER && c.distTerre[i] >= marge;
  const i0 = indiceCellule(x, z);
  if (i0 >= 0 && ok(i0)) return [x, z];
  const i = plusProche(...celluleDe(x, z), ok);
  return i >= 0 ? centreCellule(i) : [x, z];
}

/** Hauteur moyenne du relief naturel sur un disque. */
function hauteurMoyenne(x: number, z: number, rayon: number) {
  let s = hauteurBrute(x, z) * 2;
  for (let k = 0; k < 8; k++) s += hauteurBrute(x + Math.cos((k * Math.PI) / 4) * rayon, z + Math.sin((k * Math.PI) / 4) * rayon);
  return s / 10;
}

// ─── Ponts ──────────────────────────────────────────────────────────────────

/** Relie deux îles là où leurs côtes sont le plus proches, en partant d'un peu dans les terres. */
function placerPont(pont: Pont, plateformes: Plateforme[]): PontPlace | null {
  const c = laCarte();
  const iles = pont.entre.map((p) => c.ile[indiceCellule(...terreFerme(p, 1))]);
  if (iles[0] < 0 || iles[1] < 0 || iles[0] === iles[1]) {
    console.warn("Pont ignoré : ses deux points doivent être sur deux terres différentes.", pont.entre);
    return null;
  }
  const cotes: [number, number][][] = [[], []];
  for (let i = 0; i < c.region.length; i++) {
    if (c.distTerre[i] !== 1) continue;
    const k = iles.indexOf(c.ile[i]);
    if (k >= 0) cotes[k].push([i % c.largeur, Math.floor(i / c.largeur)]);
  }
  let paire: [number, number] = [0, 0];
  let dMin = Infinity;
  cotes[0].forEach(([ax, az], ia) =>
    cotes[1].forEach(([bx, bz], ib) => {
      const d = (ax - bx) ** 2 + (az - bz) ** 2;
      if (d < dMin) ((dMin = d), (paire = [ia, ib]));
    }),
  );
  const versM = ([cx, cz]: [number, number]) => centreCellule(cz * c.largeur + cx);
  let [ax, az] = versM(cotes[0][paire[0]]);
  let [bx, bz] = versM(cotes[1][paire[1]]);
  const l = Math.hypot(bx - ax, bz - az) || 1;
  const ux = (bx - ax) / l;
  const uz = (bz - az) / l;
  // On recule chaque bout dans les terres jusqu'à un sol assez haut (le pont reste au-dessus du vide).
  const reculer = (x: number, z: number, sens: number, ile: number): [number, number] => {
    for (let k = 0; k < 4 && hauteurBrute(x, z) < 8; k++) {
      const nx = x - ux * sens * c.pas * 0.5;
      const nz = z - uz * sens * c.pas * 0.5;
      const i = indiceCellule(nx, nz);
      if (i < 0 || c.ile[i] !== ile) break;
      ((x = nx), (z = nz));
    }
    return [x, z];
  };
  [ax, az] = reculer(ax - ux * c.pas * 0.5, az - uz * c.pas * 0.5, 1, iles[0]);
  [bx, bz] = reculer(bx + ux * c.pas * 0.5, bz + uz * c.pas * 0.5, -1, iles[1]);
  const ha = hauteurBrute(ax, az);
  const hb = hauteurBrute(bx, bz);
  const longueur = Math.hypot(bx - ax, bz - az);
  // Le pont plonge un peu au milieu, sans jamais toucher l'eau.
  const creux = Math.max(0, Math.min(4, longueur * 0.02, Math.min(ha, hb) - 3));
  for (const [x, z, h] of [[ax, az, ha], [bx, bz, hb]]) plateformes.push({ x, z, rayon: pont.largeur * 0.75 + 1.5, fondu: 8, hauteur: h });
  return { ax, az, bx, bz, largeur: pont.largeur, ha: ha + 0.05, hb: hb + 0.05, creux };
}

// ─── Quais ──────────────────────────────────────────────────────────────────

/** Pose le quai sur la rive la plus proche, son ponton tourné vers le large. */
function placerQuai(port: Port, plateformes: Plateforme[]): { quai: Quai; ponton: PontPlace } {
  const c = laCarte();
  const [x0, z0] = versMonde(port.position);
  const auLarge = (i: number) => c.ocean[i] === 1;
  const voisinDuLarge = (i: number) => {
    const x = i % c.largeur;
    const z = Math.floor(i / c.largeur);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const j = (z + dz) * c.largeur + x + dx;
        if (j >= 0 && j < c.region.length && auLarge(j)) return true;
      }
    return false;
  };
  const i = plusProche(...celluleDe(x0, z0), (i) => c.region[i] !== MER && voisinDuLarge(i));
  const [xc, zc] = i >= 0 ? centreCellule(i) : [x0, z0];
  // Direction du large : celle (parmi 32) où l'on atteint le plus vite une eau libre assez profonde.
  let meilleur = { d: Infinity, dx: 0, dz: 1 };
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    for (let d = 2; d <= 80 && d < meilleur.d; d += 2) {
      const px = xc + dx * d;
      const pz = zc + dz * d;
      const j = indiceCellule(px, pz);
      if (j >= 0 && auLarge(j) && hauteurBrute(px, pz) < -0.5) {
        meilleur = { d, dx, dz };
        break;
      }
    }
  }
  const { dx, dz } = meilleur;
  // Le ponton commence une dizaine de mètres avant l'eau profonde, et s'avance au-dessus.
  const recul = Number.isFinite(meilleur.d) ? Math.max(0, meilleur.d - 10) : 0;
  const x = xc + dx * recul;
  const z = zc + dz * recul;
  // Le sol est abaissé jusqu'au quai, en pente douce si la côte est haute (une rampe).
  const haut = hauteurBrute(x - dx * c.pas, z - dz * c.pas);
  plateformes.push({ x, z, rayon: 7, fondu: Math.min(60, Math.max(8, 1.7 * (haut - NIVEAU_QUAI))), hauteur: NIVEAU_QUAI + 0.2, abaisser: true });
  const fin: [number, number] = [x + dx * LONGUEUR_QUAI, z + dz * LONGUEUR_QUAI];
  return {
    quai: { x, z, y: NIVEAU_QUAI, rot: Math.atan2(dx, dz), appel: [x + dx * LONGUEUR_QUAI * 0.5, z + dz * LONGUEUR_QUAI * 0.5] },
    ponton: { ax: x, az: z, bx: fin[0], bz: fin[1], largeur: 4, ha: NIVEAU_QUAI, hb: NIVEAU_QUAI, creux: 0 },
  };
}

// ─── Villages ───────────────────────────────────────────────────────────────

function placerVillage(v: Village, occupe: Plateforme[], ponts: PontPlace[], hasard: () => number): Maison[] {
  const c = laCarte();
  const [cx, cz] = terreFerme(v.centre, 1);
  const regionCentre = regionA(cx, cz);
  const barrieres = BARRIERES.map((b) => versMonde(b.position));
  /** Rayon de la place centrale, laissée libre. */
  const place = 16 + v.rayon * 0.06;
  const maisons: Maison[] = [];
  for (let essai = 0; essai < v.nombre * 120 && maisons.length < v.nombre; essai++) {
    const a = hasard() * Math.PI * 2;
    const d = place + (v.rayon - place) * Math.sqrt(hasard());
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    const [l0, h0, p0] = v.substitut.taille;
    const k = 0.85 + hasard() * 0.3;
    const l = l0 * k;
    const p = p0 * k;
    const h = h0 * (0.9 + hasard() * 0.25);
    const rayon = Math.max(l, p) / 2 + 2.5;

    const i = indiceCellule(x, z);
    if (i < 0 || c.region[i] !== regionCentre || c.distTerre[i] < 2) continue;
    if (occupe.some((o) => Math.hypot(o.x - x, o.z - z) < o.rayon + rayon + 2)) continue;
    if (ponts.some((pt) => distanceSegment(x, z, pt.ax, pt.az, pt.bx, pt.bz).d < rayon + 6)) continue;
    if (barrieres.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 40)) continue;
    // Terrain assez plat, et au-dessus des plages.
    const centre = hauteurBrute(x, z);
    const bords = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]].map(([ox, oz]) => hauteurBrute(x + ox * rayon, z + oz * rayon));
    if (Math.min(centre, ...bords) < 2.5) continue;
    if (bords.some((b) => Math.abs(b - centre) / rayon > 0.45)) continue;

    const hauteur = (centre * 2 + bords.reduce((s, b) => s + b, 0)) / (bords.length + 2);
    occupe.push({ x, z, rayon, fondu: 9, hauteur });
    maisons.push({
      x,
      z,
      y: hauteur,
      // La façade (axe +Z du modèle) regarde la place.
      rot: Math.atan2(cx - x, cz - z),
      l,
      h,
      p,
      modele: v.modeles[Math.floor(hasard() * v.modeles.length)],
      village: v,
    });
  }
  if (maisons.length < v.nombre) console.info(`${v.id} : ${maisons.length}/${v.nombre} maisons (terrain trop pentu ou trop petit).`);
  return maisons;
}

// ─── Plan complet ───────────────────────────────────────────────────────────

/** Calcule le plan. À appeler une fois la carte chargée, avant de construire le monde. */
export function planifier(): Plan {
  // On repart du relief naturel.
  definirPlateformes([]);
  definirPonts([]);
  const plateformes: Plateforme[] = [];
  /** Aplanit le sol autour d'un point, à la hauteur moyenne du terrain (le moins de terre remuée possible). */
  const poser = (p: Px, rayon: number, fondu: number, marge = 1) => {
    const [x, z] = terreFerme(p, marge);
    plateformes.push({ x, z, rayon, fondu, hauteur: hauteurMoyenne(x, z, rayon) });
    return { x, z, y: 0 };
  };
  const parId = <T extends { id: string }>(liste: T[], f: (e: T) => Point) => Object.fromEntries(liste.map((e) => [e.id, f(e)]));

  // Raccords d'au moins 8 m : bien plus larges que l'écart entre deux sommets du sol (4 m).
  const depart = poser(REGLAGES.depart, 3, 8, 2);
  const feux = Object.fromEntries(
    FEUX.map((f) => {
      const p = poser(f.position, 4.5, 10, 2);
      return [f.id, { ...p, arrivee: [p.x, p.z + 3.5] as [number, number] }];
    }),
  );
  const indices = parId(INDICES, (i) => poser(i.position, 3, 8));
  const enigmes = parId(ENIGMES, (e) => poser(e.position, 3, 8));
  const ramassables = Object.fromEntries(RAMASSABLES.map((r) => [r.objet, poser(r.position, 2.5, 8)]));
  const lieu = (id: string) => LIEUX.find((l) => l.id === id)!.position;
  const portail = poser(lieu("portail-sciyolia"), 16, 10, 2);
  const palais = poser(lieu("palais-givre"), 50, 25, 2);

  const ponts = PONTS.map((p) => placerPont(p, plateformes)).filter((p): p is PontPlace => !!p);
  const quais = PORTS.map((p) => ({ id: p.id, ...placerQuai(p, plateformes) }));

  const decors: Decor[] = DECORS.map((d) => {
    // Un modèle avec plateforme (bâtiment) est ramené sur la terre ; les autres restent où tu les as mis.
    const [x, z] = d.plateforme ? terreFerme(d.position, 1) : versMonde(d.position);
    if (d.plateforme) plateformes.push({ x, z, rayon: d.plateforme, fondu: 10, hauteur: hauteurMoyenne(x, z, d.plateforme) });
    return { x, z, y: 0, rot: rotationFace(d.angle ?? 90), def: d };
  });

  const hasard = graine(21);
  const tousPonts = [...ponts, ...quais.map((q) => q.ponton)];
  const maisons = VILLAGES.flatMap((v) => placerVillage(v, plateformes, tousPonts, hasard));

  definirPlateformes(plateformes);
  definirPonts(tousPonts);

  // Hauteurs définitives, sur le sol aplani.
  const auSol = <T extends Point>(p: T): T => ({ ...p, y: hauteurSol(p.x, p.z) });
  const tousAuSol = <T extends Point>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).map(([k, p]) => [k, auSol(p)]));
  const village = VILLAGES.find((v) => v.id === "village-blanc");
  const [vx, vz] = village ? versMonde(village.centre) : [depart.x, depart.z - 1];

  plan = {
    depart: { ...auSol(depart), cap: Math.atan2(vz - depart.z, vx - depart.x) },
    feux: tousAuSol(feux),
    indices: tousAuSol(indices),
    enigmes: tousAuSol(enigmes),
    ramassables: tousAuSol(ramassables),
    ports: Object.fromEntries(quais.map((q) => [q.id, q.quai])),
    ponts,
    maisons: maisons.map(auSol),
    decors: decors.map(auSol),
    portail: auSol(portail),
    palais: auSol(palais),
  };
  return plan;
}
