import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BARRIERES, BOIS as BOIS_DESSINES, LABYRINTHE, REGIONS, VILLAGES, VOLCANS } from "../content/monde";
import type { DecorUnique, Vegetation as TypeVegetation } from "../content/types";
import { barriereOuverte, useJeu } from "../game/store";
import { LEGER } from "../qualite";
import { BrumeSorcieres } from "./BrumeSorcieres";
import { rotationFace } from "./geometrie";
import { Guirlandes } from "./Guirlandes";
import { Herbe } from "./Herbe";
import { Labyrinthe } from "./Labyrinthe";
import { Fumees, Halos, LUEURS } from "./Lueurs";
import { centreCellule, indiceCellule, laCarte, MER, regionA, versCarte, versMonde } from "./carte";
import { Chemins } from "./Chemins";
import { Instances, InstancesModele, matrice, Modele, modeleExiste } from "./modeles";
import { lePlan, LONGUEUR_QUAI, type Maison } from "./plan";
import { createNoise2D } from "simplex-noise";
import { distanceSegment, graine, hauteurPont, hauteurTerrain, pente, smoothstep, surPlateforme } from "./relief";
import { Remparts } from "./Remparts";
import { dansZone, tracesAuSol } from "./zones";

// Décor : les modèles Blender du dossier modeles/ (voir ASSETS-BLENDER.md),
// ou des formes PROVISOIRES tant qu'ils n'existent pas.

const mat = (color: string, plat = false) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: plat });
const PIERRE = mat("#8f887b");
const BOIS = mat("#6a4a2e");
const BOIS_SOMBRE = mat("#4a3420");
const VOILE = new THREE.MeshStandardMaterial({ color: "#e9e0cc", roughness: 0.9, side: THREE.DoubleSide });

// ─── Végétation ─────────────────────────────────────────────────────────────

type Forme = { geometrie: THREE.BufferGeometry; materiau: THREE.Material };

let formes: Record<string, Forme[]> | null = null;

/** Formes provisoires des arbres, rochers et buissons. */
function lesFormes() {
  if (formes) return formes;
  const tronc = new THREE.CylinderGeometry(0.35, 0.55, 6, 6).translate(0, 3, 0);
  const troncNu = new THREE.CylinderGeometry(0.15, 0.5, 9, 5).translate(0, 4.5, 0);
  const boule = new THREE.IcosahedronGeometry(3.6, 0).translate(0, 7.5, 0);
  const cone = new THREE.ConeGeometry(2.8, 9, 7).translate(0, 8, 0);
  const roche = new THREE.DodecahedronGeometry(1.6, 0).translate(0, 0.6, 0);
  const buisson = new THREE.IcosahedronGeometry(1.3, 0).translate(0, 0.8, 0);
  formes = {
    "arbre-dore": [
      { geometrie: tronc, materiau: mat("#4a3b2a") },
      { geometrie: boule, materiau: mat("#c9952f", true) },
    ],
    "arbre-rose": [
      { geometrie: tronc, materiau: mat("#4a3b2a") },
      { geometrie: boule, materiau: mat("#e99ab8", true) },
    ],
    "arbre-vert": [
      { geometrie: tronc, materiau: mat("#4a3b2a") },
      { geometrie: boule, materiau: mat("#5f9a3a", true) },
    ],
    "arbre-sorciere": [
      { geometrie: tronc, materiau: mat("#2a2228") },
      { geometrie: cone, materiau: mat("#3b2f45", true) },
    ],
    "pin-enneige": [
      { geometrie: tronc, materiau: mat("#3a3028") },
      { geometrie: cone, materiau: mat("#dfe9ee", true) },
    ],
    "arbre-mort": [{ geometrie: troncNu, materiau: mat("#2e2622") }],
    rocher: [{ geometrie: roche, materiau: mat("#8a857c", true) }],
    buisson: [{ geometrie: buisson, materiau: mat("#5d6b3a", true) }],
    // Petites plantes : rien tant que leur modèle manque.
    herbe: [],
    fleur: [],
    souche: [],
  };
  return formes;
}

/**
 * Une plantation : densité moyenne (par hectare), modèles (variantes tirées au hasard), forme provisoire,
 * où elle pousse, et l'obstacle qu'elle fait (rayon et hauteur à l'échelle 1 ; sans : on la traverse).
 * `bosquets` : « dans » groupe la plantation en bosquets séparés de clairières, « hors » la met dans
 * les clairières (fleurs). `marge` : distance gardée au bord des chemins et des ponts (m).
 * `villages` : pousse aussi entre les maisons.
 */
type Semis = {
  densite: number;
  variantes: string[];
  forme: string;
  penteMax: number;
  hauteurMin: number;
  echelle: [number, number];
  obstacle?: { rayon: number; hauteur: number };
  bosquets?: "dans" | "hors";
  marge: number;
  villages?: boolean;
  /** Rochers de falaise : ils laissent libres décors, feux, objets et abords des ponts. */
  falaise?: boolean;
};

const variantes = (nom: string, n: number) => Array.from({ length: n }, (_, i) => `${nom}-${i + 1}`);
const arbres = (nom: string, n: number, densite: number, bosquets?: "dans"): Semis => ({
  densite,
  variantes: variantes(nom, n),
  forme: nom,
  penteMax: 0.6,
  hauteurMin: 2.8,
  echelle: [0.55, 1.6],
  obstacle: { rayon: 0.45, hauteur: 6 },
  bosquets,
  marge: 5,
});
const BUISSONS: Semis = { densite: 9, variantes: variantes("buisson", 2), forme: "buisson", penteMax: 0.8, hauteurMin: 2.5, echelle: [0.9, 1.8], bosquets: "dans", marge: 1.5 };
const ROCHERS_EPARS: Semis = {
  densite: 1.5,
  variantes: variantes("rocher", 3),
  forme: "rocher",
  penteMax: 1.3,
  hauteurMin: 0.4,
  echelle: [0.5, 1.8],
  obstacle: { rayon: 1.2, hauteur: 2 },
  marge: 2,
};
// Le sol à hauteur de joueur : herbes hautes partout, fleurs dans les clairières, bois mort sous les arbres.
const HERBES: Semis = { densite: 250, variantes: variantes("herbe", 2), forme: "herbe", penteMax: 1, hauteurMin: 1, echelle: [1.2, 2.2], marge: 0.5, villages: true };
const FLEURS: Semis = {
  densite: 40,
  // Une fleur sur quatre est blanche, comme dans les prés des rendus.
  variantes: ["fleur-blanche", "fleur-blanche", "fleur-jaune", "fleur-jaune-2", "fleur-rouge", "fleur-rouge-2", "fleur-violette", "fleur-violette-2"],
  forme: "fleur",
  penteMax: 0.8,
  hauteurMin: 1.5,
  echelle: [0.9, 1.4],
  bosquets: "hors",
  marge: 0.5,
  villages: true,
};
const BOIS_MORT: Semis = { densite: 1, variantes: ["souche", "tronc"], forme: "souche", penteMax: 0.7, hauteurMin: 2, echelle: [0.8, 1.3], bosquets: "dans", marge: 2 };
/** Traces de vie dans la campagne : une vieille clôture, une stèle, un tronc, un tonneau oublié. */
const TRACES: Semis = {
  densite: 0.25,
  variantes: ["stele-moussue", "cloture", "cloture", "tronc", "tonneau", "souche", "botte-foin", "caisse", "panneau", "seau"],
  forme: "souche",
  penteMax: 0.4,
  hauteurMin: 2,
  echelle: [0.9, 1.1],
  bosquets: "hors",
  marge: 2,
};
const CHAMPIGNONS: Semis = { densite: 10, variantes: variantes("champignon", 2), forme: "fleur", penteMax: 0.9, hauteurMin: 1.5, echelle: [1, 2.2], marge: 0.5 };

/**
 * Falaises : de gros rochers à facettes posés serrés le long des côtes hautes (au moins `hauteurMin` m),
 * à moitié enfoncés, pour des côtes taillées plutôt qu'une pente lisse. Densité : environ 7 rochers sur 10
 * cellules de côte (6 × 6 m).
 */
const FALAISES: Semis = {
  densite: 190,
  variantes: variantes("rocher", 3),
  forme: "rocher",
  penteMax: 9,
  hauteurMin: 3,
  echelle: [2.5, 4.5],
  obstacle: { rayon: 1.2, hauteur: 2 },
  marge: 3,
  falaise: true,
};

/** Formes des petites plantes : sans ombre portée, et absentes du mode léger. */
const PETITES = new Set(["herbe", "fleur"]);

/** Arbres isolés dans les clairières et les prés, entre les bosquets. */
const isoles = (nom: string, n: number, densite: number): Semis => ({ ...arbres(nom, n, densite), bosquets: "hors", echelle: [0.7, 1.3] });
/** Buissons hors des bosquets : lisières, bords de champs. */
const BUISSONS_EPARS: Semis = { ...BUISSONS, densite: 5, bosquets: "hors" };
/** Petits rochers au ras du sol, partout. */
const CAILLOUX: Semis = { ...ROCHERS_EPARS, densite: 6, echelle: [0.25, 0.6], marge: 0.8 };

const SEMIS: Record<Exclude<TypeVegetation, "aucune">, Semis[]> = {
  "foret-doree": [
    arbres("arbre-dore", 6, 13, "dans"),
    isoles("arbre-dore", 6, 1.8),
    { ...BUISSONS, densite: 20 },
    BUISSONS_EPARS,
    HERBES,
    { ...FLEURS, densite: 90 },
    { ...BOIS_MORT, densite: 2.5 },
    { ...TRACES, densite: 1.2 },
    CAILLOUX,
  ],
  // Landes roses : arbres en fleurs, beaucoup de fleurs, des rochers.
  "landes-roses": [
    arbres("arbre-rose", 3, 11, "dans"),
    isoles("arbre-rose", 3, 2.5),
    { ...BUISSONS, densite: 14 },
    BUISSONS_EPARS,
    { ...HERBES, densite: 220 },
    { ...FLEURS, densite: 130 },
    { ...TRACES, densite: 0.8 },
    { ...BOIS_MORT, densite: 0.8 },
    CAILLOUX,
  ],
  // Le Bois perdu : une forêt serrée, qu'on ne traverse qu'en suivant les chemins.
  "foret-verte": [
    { ...arbres("arbre-vert", 4, 140), penteMax: 0.9, echelle: [0.8, 1.5] },
    { ...BUISSONS, densite: 22, bosquets: undefined },
    { ...HERBES, densite: 180 },
    { ...CHAMPIGNONS, densite: 22 },
    { ...FLEURS, densite: 25, bosquets: undefined },
    { ...BOIS_MORT, densite: 4 },
    // De vieilles pierres moussues, comme des bornes oubliées.
    { ...TRACES, densite: 1.5, variantes: ["stele-moussue", "stele-moussue", "tronc", "souche"], bosquets: undefined },
    CAILLOUX,
  ],
  "foret-sombre": [
    arbres("arbre-sorciere", 3, 36),
    { ...BUISSONS, densite: 14, bosquets: undefined },
    { ...CHAMPIGNONS, densite: 20 },
    { ...HERBES, densite: 60 },
    { ...BOIS_MORT, densite: 3 },
    CAILLOUX,
  ],
  "pins-enneiges": [
    arbres("pin-enneige", 5, 30, "dans"),
    isoles("pin-enneige", 5, 5),
    { ...BUISSONS_EPARS, densite: 3 },
    { ...BOIS_MORT, densite: 1 },
    { ...ROCHERS_EPARS, densite: 4, variantes: variantes("rocher-glace", 3) },
    { ...CAILLOUX, variantes: variantes("rocher-glace", 3) },
  ],
  "arbres-morts": [
    { ...arbres("arbre-mort", 2, 9, "dans"), echelle: [0.7, 1.2] },
    { ...isoles("arbre-mort", 2, 2), echelle: [0.6, 1.1] },
    { ...BOIS_MORT, densite: 4 },
    { ...ROCHERS_EPARS, densite: 3 },
    { ...BUISSONS_EPARS, densite: 3 },
    { ...HERBES, densite: 70 },
    { ...TRACES, densite: 0.8, variantes: ["cloture", "cloture", "tronc", "souche", "tonneau", "caisse"] },
    CAILLOUX,
  ],
  rochers: [
    { ...ROCHERS_EPARS, densite: 9, echelle: [0.8, 2.8] },
    { ...HERBES, densite: 200 },
    { ...BUISSONS, densite: 16 },
    { ...BUISSONS_EPARS, densite: 8 },
    { ...FLEURS, densite: 30 },
    { ...arbres("arbre-dore", 6, 5, "dans"), penteMax: 0.8 },
    { ...isoles("arbre-dore", 6, 2.5), penteMax: 0.8 },
    { ...TRACES, densite: 0.5 },
    CAILLOUX,
  ],
};

/** Bruit des bosquets (0 à 1) : au-dessus de 0,5 un bosquet, en dessous une clairière. Taches d'environ 140 m. */
const bruitBosquets = createNoise2D(graine(41));
const bosquet = (x: number, z: number) => smoothstep(0.35, 0.65, (bruitBosquets(x / 140, z / 140) + 1) / 2);

function Vegetation() {
  const parVariante = useMemo(() => {
    const c = laCarte();
    const plan = lePlan();
    const barrieres = BARRIERES.map((b) => versMonde(b.position));
    // Ponts, pontons, chemins et remparts : rien ne pousse dessus (la marge dépend de la plante).
    const passages = [
      ...plan.ponts.map((p) => ({ ...p, demi: p.largeur / 2 + 2 })),
      ...Object.values(plan.ports).map((q) => ({ ax: q.x, az: q.z, bx: q.x + Math.sin(q.rot) * LONGUEUR_QUAI, bz: q.z + Math.cos(q.rot) * LONGUEUR_QUAI, demi: 3 })),
      ...tracesAuSol().map(({ s: [ax, az, bx, bz], demi }) => ({ ax, az, bx, bz, demi })),
    ];
    // Clairière au cœur de chaque village.
    const clairieres = [
      ...VILLAGES.map((v) => ({ c: versMonde(v.centre), r: v.rayon * 1.1 })),
      // Les salles du labyrinthe.
      ...LABYRINTHE.salles.map((s) => ({ c: versMonde(s.centre), r: s.rayon + 2 })),
    ];

    const cellules = new Map<number, number[]>();
    for (let i = 0; i < c.region.length; i++) {
      if (c.region[i] === MER) continue;
      const l = cellules.get(c.region[i]) ?? [];
      l.push(i);
      cellules.set(c.region[i], l);
    }
    // Ce qui pousse où : chaque région, puis les bois dessinés (en plus de la végétation de leur région).
    const plantations: { liste: number[]; semis: Semis[]; ici: (x: number, z: number) => boolean }[] = [];
    for (const [ri, liste] of cellules) {
      const type = REGIONS[ri].vegetation;
      if (type !== "aucune") plantations.push({ liste, semis: [...SEMIS[type], ROCHERS_EPARS], ici: (x, z) => regionA(x, z) === ri });
    }
    // Les cellules de terre au bord de la mer.
    const cote: number[] = [];
    for (let i = 0; i < c.region.length; i++) if (c.region[i] !== MER && c.distTerre[i] <= 2) cote.push(i);
    const surCote = (x: number, z: number) => {
      const i = indiceCellule(x, z);
      return i >= 0 && c.region[i] !== MER && c.distTerre[i] <= 2;
    };
    // Sur les côtes glacées, des rochers givrés.
    const glacee = (i: number) => ["glace", "iceberg"].includes(REGIONS[c.region[i]].id);
    const glacees = new Set(REGIONS.flatMap((r, i) => (["glace", "iceberg"].includes(r.id) ? [i] : [])));
    plantations.push({ liste: cote.filter((i) => !glacee(i)), semis: [FALAISES], ici: (x, z) => surCote(x, z) && !glacees.has(regionA(x, z)) });
    plantations.push({
      liste: cote.filter(glacee),
      semis: [{ ...FALAISES, variantes: variantes("rocher-glace", 3) }],
      ici: (x, z) => surCote(x, z) && glacees.has(regionA(x, z)),
    });

    for (const b of BOIS_DESSINES) {
      const dans = (x: number, z: number) => {
        const p = versCarte(x, z);
        return regionA(x, z) !== MER && dansZone(p, b.zone) && !(b.trou && dansZone(p, b.trou));
      };
      const liste = [];
      for (let i = 0; i < c.region.length; i++) if (dans(...centreCellule(i))) liste.push(i);
      // Un bois : des arbres serrés (densité absolue), des pentes plus fortes acceptées, du sous-bois.
      const [arbresBois, buissons] = SEMIS[b.vegetation];
      plantations.push({
        liste,
        semis: [
          { ...arbresBois, densite: b.densite, bosquets: undefined, penteMax: 0.9 },
          { ...buissons, densite: buissons.densite * 2, bosquets: undefined },
          ...(b.fleurs ? [{ ...FLEURS, densite: b.fleurs, bosquets: undefined }] : []),
        ],
        ici: dans,
      });
    }

    const hectares = (c.pas * c.pas) / 10000;
    const sortie = new Map<string, { forme: string; matrices: THREE.Matrix4[] }>();
    const obstacles: { x: number; y: number; z: number; r: number; h: number }[] = [];
    // Les rochers de falaise laissent libres les décors, feux, objets, potagers et abords des ponts.
    const reserves: [number, number][] = [
      ...plan.decors.map((d) => [d.x, d.z] as [number, number]),
      ...[plan.feux, plan.indices, plan.ramassables].flatMap((r) => Object.values(r).map((p) => [p.x, p.z] as [number, number])),
      ...plan.jardins.map((j) => [j.x, j.z] as [number, number]),
      ...plan.ponts.flatMap((p) => {
        const l = Math.hypot(p.bx - p.ax, p.bz - p.az) || 1;
        const [ux, uz] = [(p.bx - p.ax) / l, (p.bz - p.az) / l];
        return [0, 6, 12].flatMap((d) => [[p.ax - ux * d, p.az - uz * d], [p.bx + ux * d, p.bz + uz * d]] as [number, number][]);
      }),
    ];
    // Un générateur par semis : sauter un semis (mode léger) ne déplace pas tous les suivants.
    let numero = 0;
    for (const { liste, semis, ici } of plantations) {
      for (const s of semis) {
        const hasard = graine(1000 + numero++);
        if (LEGER && PETITES.has(s.forme)) continue;
        // En bosquets, on tire 2,5 fois plus de candidats : environ 40 % tombent dans un bosquet.
        // Des instances : même par dizaines de milliers, elles coûtent peu.
        // Sur téléphone (mode léger), un peu moins de tout.
        const n = Math.min(80000, Math.round(liste.length * hectares * s.densite * (s.bosquets ? 2.5 : 1) * (LEGER ? 0.6 : 1)));
        for (let k = 0; k < n; k++) {
          const [cx, cz] = centreCellule(liste[Math.floor(hasard() * liste.length)]);
          const x = cx + (hasard() - 0.5) * c.pas;
          const z = cz + (hasard() - 0.5) * c.pas;
          const variante = s.variantes[Math.floor(hasard() * s.variantes.length)];
          const e = s.echelle[0] + hasard() * (s.echelle[1] - s.echelle[0]);
          const etire = 0.85 + hasard() * 0.3;
          const rot = hasard() * Math.PI * 2;
          const garde = hasard();

          if (s.bosquets === "dans" && garde > bosquet(x, z)) continue;
          if (s.bosquets === "hors" && garde > 1 - bosquet(x, z)) continue;
          if (!ici(x, z)) continue;
          const y = hauteurTerrain(x, z);
          if (y < s.hauteurMin) continue;
          const p = pente(x, z, 2);
          if (p > s.penteMax) continue;
          if ((!s.villages && surPlateforme(x, z, 3)) || hauteurPont(x, z) !== null) continue;
          if (passages.some((pt) => distanceSegment(x, z, pt.ax, pt.az, pt.bx, pt.bz).d < pt.demi + s.marge)) continue;
          if (barrieres.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 30)) continue;
          if (!s.villages && s.forme !== "rocher" && clairieres.some((cl) => Math.hypot(cl.c[0] - x, cl.c[1] - z) < cl.r)) continue;
          if (s.falaise && reserves.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < e * 1.2 + 2)) continue;

          const entree = sortie.get(variante) ?? { forme: s.forme, matrices: [] };
          // Enfoncé un peu, davantage sur une pente : jamais un pied dans le vide.
          entree.matrices.push(matrice(x, y - 0.25 - p * 0.9, z, rot, e, e * etire, e));
          sortie.set(variante, entree);
          if (s.obstacle) obstacles.push({ x, y: y - 0.5, z, r: s.obstacle.rayon * e, h: s.obstacle.hauteur * e * etire });
        }
      }
    }
    return { variantes: [...sortie], obstacles };
  }, []);

  const f = lesFormes();
  return (
    <>
      {/* Troncs et rochers arrêtent le joueur (les buissons se traversent). */}
      <RigidBody type="fixed" colliders={false}>
        {parVariante.obstacles.map((o, i) => (
          <CylinderCollider key={i} args={[o.h / 2, o.r]} position={[o.x, o.y + o.h / 2, o.z]} />
        ))}
      </RigidBody>
      {parVariante.variantes.map(([id, { forme, matrices }]) => (
        <InstancesModele
          key={id}
          modele={id}
          matrices={matrices}
          ombre={!PETITES.has(forme)}
          provisoire={f[forme].map((m, i) => (
            <Instances key={i} geometrie={m.geometrie} materiau={m.materiau} matrices={matrices} />
          ))}
        />
      ))}
    </>
  );
}

// ─── Villages ───────────────────────────────────────────────────────────────

/** Toit à deux pans (prisme de 1 × 1 × 1, faîtage selon X), posé à y = 0. */
function geometrieToit() {
  const v = [
    [-0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0],
    [0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0],
    [-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0],
    [0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0],
  ].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const BOITE = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const TOIT = geometrieToit();
const PORTE = mat("#2b2119");

/** Proportion de la hauteur occupée par les murs (le reste : le toit). */
const MURS = 0.62;

/** Maisons provisoires : murs, toit à deux pans, porte sur la façade (côté +Z). */
function MaisonsProvisoires({ maisons }: { maisons: Maison[] }) {
  const { murs, toits, portes, materiaux } = useMemo(() => {
    const v = maisons[0].village.substitut;
    const local = new THREE.Matrix4();
    return {
      // Les murs descendent 1,5 m sous le sol : jamais de vide sous une maison.
      murs: maisons.map((m) => matrice(m.x, m.y - 1.5, m.z, m.rot, m.l, m.h * MURS + 1.5, m.p)),
      toits: maisons.map((m) => matrice(m.x, m.y + m.h * MURS, m.z, m.rot, m.l * 1.08, m.h * (1 - MURS), m.p * 1.15)),
      portes: maisons.map((m) => matrice(m.x, m.y, m.z, m.rot).multiply(local.makeTranslation(0, 0, m.p / 2).scale(new THREE.Vector3(1.4, 2.3, 0.15)))),
      materiaux: { murs: mat(v.murs), toit: mat(v.toit, true) },
    };
  }, [maisons]);
  return (
    <>
      <Instances geometrie={BOITE} materiau={materiaux.murs} matrices={murs} />
      <Instances geometrie={TOIT} materiau={materiaux.toit} matrices={toits} />
      <Instances geometrie={BOITE} materiau={PORTE} matrices={portes} ombre={false} />
    </>
  );
}

function Villages() {
  const { maisons, jardins, garnitures } = lePlan();
  const potagers = useMemo(() => jardins.map((j) => matrice(j.x, j.y - 0.05, j.z, j.rot)), [jardins]);
  const objets = useMemo(() => {
    const parModele = new Map<string, THREE.Matrix4[]>();
    for (const g of garnitures) parModele.set(g.modele, [...(parModele.get(g.modele) ?? []), matrice(g.x, g.y - 0.05, g.z, g.rot, g.e)]);
    return [...parModele];
  }, [garnitures]);
  const parModele = useMemo(() => {
    const m = new Map<string, Maison[]>();
    for (const maison of maisons) m.set(maison.modele, [...(m.get(maison.modele) ?? []), maison]);
    return [...m];
  }, [maisons]);
  return (
    <>
      {parModele.map(([id, liste]) => (
        <InstancesModele key={id} modele={id} matrices={liste.map((m) => matrice(m.x, m.y, m.z, m.rot))} provisoire={<MaisonsProvisoires maisons={liste} />} />
      ))}
      <InstancesModele modele="potager" matrices={potagers} provisoire={null} ombre={false} />
      {objets.map(([modele, m]) => (
        <InstancesModele key={modele} modele={modele} matrices={m} provisoire={null} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {maisons.map((m, i) => (
          <CuboidCollider key={i} args={[m.l / 2, (m.h + 1.5) / 2, m.p / 2]} position={[m.x, m.y - 1.5 + (m.h + 1.5) / 2, m.z]} rotation={[0, m.rot, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

// ─── Voyages : quais, ponts, feux ───────────────────────────────────────────

function PontonProvisoire() {
  const pieux = useMemo(() => Array.from({ length: Math.floor(LONGUEUR_QUAI / 4) + 1 }, (_, i) => i * 4 + 1), []);
  return (
    <>
      <mesh material={BOIS} position={[0, -0.2, LONGUEUR_QUAI / 2]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.4, LONGUEUR_QUAI]} />
      </mesh>
      {pieux.flatMap((z) =>
        [-1.8, 1.8].map((x) => (
          <mesh key={`${x}-${z}`} material={BOIS_SOMBRE} position={[x, -2.6, z]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 5, 6]} />
          </mesh>
        )),
      )}
    </>
  );
}

function BarqueProvisoire() {
  return (
    <>
      <mesh material={BOIS} position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[3.2, 1.5, 9]} />
      </mesh>
      <mesh material={BOIS_SOMBRE} position={[0, 4.4, 0.5]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 7.5]} />
      </mesh>
      <mesh material={VOILE} position={[0, 4.8, 1.2]} rotation-y={Math.PI / 2} castShadow>
        <planeGeometry args={[3, 4.5]} />
      </mesh>
    </>
  );
}

/** Quais : un ponton qui avance dans l'eau (axe +Z) et un bateau amarré au bout. */
function Ports() {
  const { ports } = lePlan();
  return (
    <>
      {Object.entries(ports).map(([id, q]) => (
        <group key={id} position={[q.x, q.y, q.z]} rotation-y={q.rot}>
          <Modele modele="ponton" provisoire={<PontonProvisoire />} />
          {/* Le bateau flotte à la surface de l'eau (y = 0), le long du ponton. */}
          <Modele modele="barque" position={[4.4, -q.y, LONGUEUR_QUAI - 6]} provisoire={<BarqueProvisoire />} />
        </group>
      ))}
    </>
  );
}

/** Ponts suspendus : planches, cordes à hauteur de main, poteaux à chaque bout. */
function Ponts() {
  const { ponts } = lePlan();
  const { planches, cordes, poteaux } = useMemo(() => {
    const planches: THREE.Matrix4[] = [];
    const cordes: THREE.TubeGeometry[] = [];
    const poteaux: THREE.Matrix4[] = [];
    const hasard = graine(5);
    for (const p of ponts) {
      const l = Math.hypot(p.bx - p.ax, p.bz - p.az);
      const ux = (p.bx - p.ax) / l;
      const uz = (p.bz - p.az) / l;
      const rot = Math.atan2(ux, uz);
      const tablier = (t: number) => p.ha + (p.hb - p.ha) * t - Math.sin(t * Math.PI) * p.creux;
      const n = Math.ceil(l / 1.25);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        // Planches un peu de travers : le pont a vécu.
        planches.push(matrice(p.ax + (p.bx - p.ax) * t, tablier(t) - 0.08, p.az + (p.bz - p.az) * t, rot + (hasard() - 0.5) * 0.06, p.largeur / 4, 1, 1));
      }
      for (const cote of [-1, 1]) {
        const ox = -uz * cote * (p.largeur / 2);
        const oz = ux * cote * (p.largeur / 2);
        const points = Array.from({ length: 25 }, (_, i) => {
          const t = i / 24;
          return new THREE.Vector3(p.ax + (p.bx - p.ax) * t + ox, tablier(t) + 1.1, p.az + (p.bz - p.az) * t + oz);
        });
        cordes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.05, 5));
        for (const [x, z, h] of [[p.ax, p.az, p.ha], [p.bx, p.bz, p.hb]]) poteaux.push(matrice(x + ox, h - 0.5, z + oz));
      }
    }
    return { planches, cordes, poteaux };
  }, [ponts]);
  const planche = useMemo(() => new THREE.BoxGeometry(4, 0.16, 1.05), []);
  const poteau = useMemo(() => new THREE.CylinderGeometry(0.16, 0.2, 2.4, 6).translate(0, 1.2, 0), []);
  return (
    <>
      <InstancesModele modele="pont-planche" matrices={planches} provisoire={<Instances geometrie={planche} materiau={BOIS} matrices={planches} />} />
      <Instances geometrie={poteau} materiau={BOIS_SOMBRE} matrices={poteaux} />
      {cordes.map((g, i) => (
        <mesh key={i} geometry={g} material={BOIS_SOMBRE} />
      ))}
    </>
  );
}

function FoyerProvisoire() {
  return (
    <>
      <mesh material={PIERRE} position={[0, 0.2, 0]} castShadow>
        <torusGeometry args={[1.1, 0.35, 6, 10]} />
      </mesh>
      {[0, 1.2, 2.4].map((a) => (
        <mesh key={a} material={BOIS_SOMBRE} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, a]}>
          <cylinderGeometry args={[0.12, 0.12, 1.6, 5]} />
        </mesh>
      ))}
    </>
  );
}

/** Feux de camp (voyage rapide) : un foyer et une flamme vivante. */
function Feux() {
  const flammes = useRef<THREE.Group>(null);
  const feux = useMemo(() => Object.entries(lePlan().feux), []);
  useFrame((state) => {
    flammes.current?.children.forEach((m, i) => {
      const t = state.clock.elapsedTime * 6 + i;
      m.scale.set(1 + Math.sin(t) * 0.12, 1 + Math.sin(t * 1.3) * 0.2, 1 + Math.cos(t) * 0.12);
    });
  });
  return (
    <>
      {feux.map(([id, f]) => (
        <group key={id} position={[f.x, f.y, f.z]}>
          <Modele modele="feu-de-camp" provisoire={<FoyerProvisoire />} />
          <pointLight position={[0, 1.6, 0]} color="#ff9a4a" intensity={60} distance={22} />
        </group>
      ))}
      <group ref={flammes}>
        {feux.map(([id, f]) => (
          <mesh key={id} position={[f.x, f.y + 0.9, f.z]}>
            <coneGeometry args={[0.6, 1.8, 7]} />
            <meshStandardMaterial color="#ffb347" emissive="#ff7a1a" emissiveIntensity={3} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ─── Lieux uniques ──────────────────────────────────────────────────────────

const GLACE = new THREE.MeshStandardMaterial({ color: "#d6f1fb", roughness: 0.1, metalness: 0.1, emissive: "#7fc9ea", emissiveIntensity: 0.15 });

/** Palais givré : le modèle, entouré de pics de glace (ils restent même quand le modèle existe). */
function PalaisGivre() {
  const p = lePlan().palais;
  const fleches = useMemo(() => {
    const r = graine(77);
    return Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2 + r() * 0.3;
      const d = 21 + r() * 12;
      const [x, z] = [Math.cos(a) * d, Math.sin(a) * d];
      return { x, z, y: hauteurTerrain(p.x + x, p.z + z) - p.y, h: 7 + r() * 14, inclinaison: (r() - 0.5) * 0.3 };
    });
  }, [p]);
  return (
    <group position={[p.x, p.y, p.z]}>
      <Modele modele="palais-givre" />
      {fleches.map((f, i) => (
        <mesh key={i} material={GLACE} position={[f.x, f.y + f.h / 2 - 1, f.z]} rotation-z={f.inclinaison} castShadow>
          <coneGeometry args={[1.8, f.h, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/** La Fracture d'or : des cristaux d'or lumineux qui jaillissent de son île, qu'on voit de loin. */
/** Un cristal : prisme à six pans terminé en pointe, base au sol (hauteur 1, rayon 1). */
const CRISTAL = (() => {
  const g = new THREE.LatheGeometry([new THREE.Vector2(0, -0.15), new THREE.Vector2(1, -0.15), new THREE.Vector2(1, 0.72), new THREE.Vector2(0, 1)], 6);
  return g.toNonIndexed();
})();

/**
 * La Fracture d'or : une couronne de cristaux. Bas et petits au centre (un creux), de plus en plus
 * grands vers l'extérieur de l'étoile, penchés vers le dehors comme s'ils sortaient de terre.
 */
function Fracture() {
  const { matrices, halos } = useMemo(() => {
    const c = laCarte();
    const ri = REGIONS.findIndex((r) => r.id === "fracture-or");
    const cellules: number[] = [];
    if (ri >= 0) for (let i = 0; i < c.region.length; i++) if (c.region[i] === ri) cellules.push(i);
    if (!cellules.length) return { matrices: [], halos: [] };
    const points = cellules.map(centreCellule);
    const [cx, cz] = points.reduce(([a, b], [x, z]) => [a + x / points.length, b + z / points.length], [0, 0]);
    // Jusqu'où va l'étoile dans chaque direction : on mesure la place de chaque cristal entre le centre (0) et la pointe (1).
    const SECTEURS = 72;
    const portee = new Array(SECTEURS).fill(1);
    const secteur = (x: number, z: number) => Math.floor(((Math.atan2(z - cz, x - cx) / (Math.PI * 2) + 1) % 1) * SECTEURS);
    for (const [x, z] of points) {
      const k = secteur(x, z);
      portee[k] = Math.max(portee[k], Math.hypot(x - cx, z - cz));
    }
    const r = graine(97);
    const matrices: THREE.Matrix4[] = [];
    const halos: [number, number, number][] = [];
    const haut = new THREE.Vector3(0, 1, 0);
    const amas = (x: number, z: number, taille: number, penche: number, dx: number, dz: number) => {
      const n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const h = taille * (k === 0 ? 1 : 0.35 + r() * 0.5);
        const [ox, oz] = k === 0 ? [0, 0] : [(r() - 0.5) * taille * 0.35, (r() - 0.5) * taille * 0.35];
        const [px, pz] = [x + ox, z + oz];
        // Penché vers l'extérieur (axe perpendiculaire à la direction du centre), avec un peu de désordre.
        const axe = new THREE.Vector3(dz, 0, -dx).normalize();
        const q = new THREE.Quaternion().setFromAxisAngle(axe, penche + (r() - 0.5) * 0.5);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(haut, r() * Math.PI));
        const rayon = h * (0.07 + r() * 0.04);
        matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(px, hauteurTerrain(px, pz) - 0.5, pz), q, new THREE.Vector3(rayon, h, rayon)));
        if (k === 0 && h > 18) halos.push([px + dx * h * 0.3, hauteurTerrain(px, pz) + h * 0.7, pz + dz * h * 0.3]);
      }
    };
    for (let k = 0; k < 110; k++) {
      const [x, z] = points[Math.floor(r() * points.length)];
      const d = Math.hypot(x - cx, z - cz);
      const t = Math.min(1, d / portee[secteur(x, z)]);
      // Le centre reste presque vide.
      if (t < 0.25 && r() < 0.8) continue;
      const [dx, dz] = d > 0 ? [(x - cx) / d, (z - cz) / d] : [1, 0];
      amas(x, z, 5 + 58 * Math.pow(t, 1.4) * (0.7 + r() * 0.5), 0.05 + 0.45 * t, dx, dz);
    }
    // Plus loin, la fracture a semé de petits cristaux : nombreux sur les Terres rougies, rares sur les Landes roses.
    for (const [id, nombre, taille] of [["terres-rougies", 220, 3.2], ["landes-roses", 60, 1.4]] as const) {
      const ri2 = REGIONS.findIndex((x) => x.id === id);
      const liste: number[] = [];
      for (let i = 0; i < c.region.length; i++) if (c.region[i] === ri2) liste.push(i);
      for (let k = 0; k < nombre && liste.length; k++) {
        const [x, z] = centreCellule(liste[Math.floor(r() * liste.length)]);
        if (hauteurTerrain(x, z) < 1.5) continue;
        const a = r() * Math.PI * 2;
        amas(x, z, taille * (0.4 + r() * 0.8), 0.15 + r() * 0.35, Math.cos(a), Math.sin(a));
      }
    }
    return { matrices, halos };
  }, []);
  const or = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f2b632", emissive: "#ff9a00", emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.2, flatShading: true }),
    [],
  );
  const maillage = useMemo(() => {
    const m = new THREE.InstancedMesh(CRISTAL, or, Math.max(1, matrices.length));
    matrices.forEach((x, i) => m.setMatrixAt(i, x));
    m.count = matrices.length;
    m.computeBoundingSphere();
    return m;
  }, [matrices, or]);
  return (
    <>
      <primitive object={maillage} />
      <Halos positions={halos} couleur="#ffc84a" taille={12} />
    </>
  );
}

/** Le portail runique : un anneau de magie violette, une rune au centre, tant que la barrière est fermée. */
function PortailRunique() {
  const b = BARRIERES.find((x) => x.id === "portail-runique");
  const ouvert = useJeu((s) => !!b && barriereOuverte(b, s));
  const anneau = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => {
    if (!b) return null;
    const [x, z] = versMonde(b.position);
    return { x, z, y: hauteurTerrain(x, z) };
  }, [b]);
  const rune = useMemo(() => {
    const t = document.createElement("canvas");
    t.width = t.height = 128;
    const g = t.getContext("2d")!;
    g.strokeStyle = "#f2dcff";
    g.lineWidth = 9;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(64, 22);
    g.lineTo(64, 106);
    g.moveTo(64, 50);
    g.lineTo(92, 34);
    g.moveTo(64, 72);
    g.lineTo(38, 56);
    g.moveTo(64, 88);
    g.lineTo(88, 100);
    g.stroke();
    return new THREE.CanvasTexture(t);
  }, []);
  useFrame((state) => {
    if (anneau.current) anneau.current.rotation.z = state.clock.elapsedTime * 0.4;
  });
  if (!b || !pos || ouvert) return null;
  return (
    <group position={[pos.x, pos.y + 4.5, pos.z]} rotation-y={rotationFace(b.angle)}>
      <mesh ref={anneau}>
        <torusGeometry args={[3.6, 0.35, 10, 48]} />
        <meshBasicMaterial color={new THREE.Color(2.2, 1.2, 3.2)} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[3.3, 40]} />
        <meshBasicMaterial color="#6a3aa8" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position-z={0.05}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial map={rune} transparent color={new THREE.Color(2, 1.6, 2.4)} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Lueur de lave au fond des cratères, et une colonne de fumée qui en monte lentement. */
/** Une bouffée de fumée : un disque flou, plus opaque au centre. */
function textureFumee() {
  const t = document.createElement("canvas");
  t.width = t.height = 64;
  const g = t.getContext("2d")!;
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, "rgba(255,255,255,0.9)");
  d.addColorStop(0.6, "rgba(255,255,255,0.35)");
  d.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(t);
}

/** Bouffées de fumée par volcan, et hauteur (m) à laquelle elles se dissipent. */
const BOUFFEES = 14;
const HAUT_FUMEE = 70;

function Lave() {
  const volcans = useMemo(
    () =>
      VOLCANS.map((v) => {
        const [x, z] = versMonde(v.position);
        return { x, z, y: hauteurTerrain(x, z) };
      }),
    [],
  );
  const fumee = useMemo(() => new THREE.SpriteMaterial({ map: textureFumee(), color: "#5a4c48", transparent: true, depthWrite: false, fog: true }), []);
  const bouffees = useRef<(THREE.Sprite | null)[]>([]);
  // Les bouffées montent du cratère en grossissant, s'éclaircissent, puis repartent d'en bas.
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    bouffees.current.forEach((b, i) => {
      if (!b) return;
      const k = (t / 40 + i / BOUFFEES) % 1;
      b.position.set(Math.sin(i * 2.4 + t * 0.05) * 6 * k + k * 18, 8 + k * HAUT_FUMEE, Math.cos(i * 1.7) * 5 * k);
      b.scale.setScalar(14 + k * 40);
      b.material.opacity = Math.sin(Math.PI * k) * 0.55;
    });
  });
  return (
    <>
      {volcans.map((v, i) => (
        <group key={i} position={[v.x, v.y + 2, v.z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <circleGeometry args={[12, 24]} />
            <meshStandardMaterial color="#ff5a10" emissive="#ff3a00" emissiveIntensity={3} />
          </mesh>
          <pointLight position={[0, 20, 0]} color="#ff6a2a" intensity={4000} distance={400} decay={1.6} />
          {Array.from({ length: BOUFFEES }, (_, j) => (
            <sprite key={j} ref={(s) => void (bouffees.current[i * BOUFFEES + j] = s)} material={fumee.clone()} />
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * Modèles uniques de monde.ts (DECORS). Tant que leur fichier n'existe pas, ils sont invisibles
 * (et traversables), sauf ceux qui ont un substitut : une maison provisoire.
 */
function DecorsUniques() {
  const decors = lePlan().decors.filter((d) => modeleExiste(d.def.modele) || d.def.substitut);
  // Les décors qui éclairent : un halo par sorte (couleur, taille).
  const lueurs = useMemo(
    () =>
      Object.entries(LUEURS).map(([modele, l]) => ({
        ...l,
        modele,
        positions: decors.filter((d) => d.def.modele === modele).map((d) => [d.x, d.y + l.hauteur * (d.def.echelle ?? 1), d.z] as [number, number, number]),
      })),
    [decors],
  );
  return (
    <>
      {decors.map((d, i) => (
        <Modele
          key={i}
          modele={d.def.modele}
          position={[d.x, d.y, d.z]}
          rotation-y={d.rot}
          scale={d.def.echelle ?? 1}
          provisoire={d.def.substitut && <MaisonProvisoire substitut={d.def.substitut} />}
        />
      ))}
      {lueurs.map((l) => (
        <Halos key={l.modele} positions={l.positions} couleur={l.couleur} taille={l.taille} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {decors
          .filter((d) => d.def.solide)
          .map((d, i) => {
            const [l, h, p] = d.def.solide!;
            return <CuboidCollider key={i} args={[l / 2, h / 2, p / 2]} position={[d.x, d.y + h / 2, d.z]} rotation={[0, d.rot, 0]} />;
          })}
      </RigidBody>
    </>
  );
}

/** Une maison provisoire seule (murs, toit, porte côté +Z), centrée sur l'origine. */
function MaisonProvisoire({ substitut }: { substitut: NonNullable<DecorUnique["substitut"]> }) {
  const [l, h, p] = substitut.taille;
  const materiaux = useMemo(() => ({ murs: mat(substitut.murs), toit: mat(substitut.toit, true) }), [substitut]);
  return (
    <>
      <mesh geometry={BOITE} material={materiaux.murs} position-y={-1.5} scale={[l, h * MURS + 1.5, p]} castShadow receiveShadow />
      <mesh geometry={TOIT} material={materiaux.toit} position-y={h * MURS} scale={[l * 1.08, h * (1 - MURS), p * 1.15]} castShadow />
      <mesh geometry={BOITE} material={PORTE} position-z={p / 2} scale={[1.4, 2.3, 0.15]} />
    </>
  );
}

export function Decor() {
  return (
    <>
      <Vegetation />
      <Villages />
      <Ports />
      <Ponts />
      <Feux />
      <PalaisGivre />
      <PortailRunique />
      <Fracture />
      <Guirlandes />
      <Lave />
      <DecorsUniques />
      <Fumees />
      <Labyrinthe />
      <Herbe />
      <Remparts />
      <Chemins />
      <BrumeSorcieres />
    </>
  );
}
