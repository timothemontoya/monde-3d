import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BARRIERES, REGIONS, VILLAGES, VOLCANS } from "../content/monde";
import type { Vegetation as TypeVegetation } from "../content/types";
import { BrumeSorcieres } from "./BrumeSorcieres";
import { centreCellule, laCarte, MER, regionA, versMonde } from "./carte";
import { Instances, InstancesModele, matrice, Modele, modeleExiste } from "./modeles";
import { lePlan, LONGUEUR_QUAI, type Maison } from "./plan";
import { distanceSegment, graine, hauteurPont, hauteurTerrain, pente, surPlateforme } from "./relief";

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
  };
  return formes;
}

/**
 * Une plantation : densité (par hectare), modèles (variantes tirées au hasard), forme provisoire,
 * où elle pousse, et l'obstacle qu'elle fait (rayon et hauteur à l'échelle 1 ; sans : on la traverse).
 */
type Semis = {
  densite: number;
  variantes: string[];
  forme: string;
  penteMax: number;
  hauteurMin: number;
  echelle: [number, number];
  obstacle?: { rayon: number; hauteur: number };
};

const variantes = (nom: string, n: number) => Array.from({ length: n }, (_, i) => `${nom}-${i + 1}`);
const arbres = (nom: string, n: number, densite: number): Semis => ({
  densite,
  variantes: variantes(nom, n),
  forme: nom,
  penteMax: 0.6,
  hauteurMin: 2.8,
  echelle: [0.75, 1.35],
  obstacle: { rayon: 0.45, hauteur: 6 },
});
const BUISSONS: Semis = { densite: 2.5, variantes: variantes("buisson", 2), forme: "buisson", penteMax: 0.8, hauteurMin: 2.5, echelle: [0.6, 1.3] };
const ROCHERS_EPARS: Semis = {
  densite: 0.3,
  variantes: variantes("rocher", 3),
  forme: "rocher",
  penteMax: 1.3,
  hauteurMin: 0.4,
  echelle: [0.5, 1.8],
  obstacle: { rayon: 1.2, hauteur: 2 },
};

const SEMIS: Record<Exclude<TypeVegetation, "aucune">, Semis[]> = {
  "foret-doree": [arbres("arbre-dore", 3, 1.6), BUISSONS],
  "foret-sombre": [arbres("arbre-sorciere", 3, 7), { ...BUISSONS, densite: 5 }],
  "pins-enneiges": [arbres("pin-enneige", 2, 2.2)],
  "arbres-morts": [arbres("arbre-mort", 2, 1.2)],
  rochers: [{ ...ROCHERS_EPARS, densite: 1.4, echelle: [0.8, 2.6] }],
};

function Vegetation() {
  const parVariante = useMemo(() => {
    const c = laCarte();
    const plan = lePlan();
    const hasard = graine(3);
    const barrieres = BARRIERES.map((b) => versMonde(b.position));
    // Ponts et pontons : rien ne pousse dessous.
    const passages = [
      ...plan.ponts,
      ...Object.values(plan.ports).map((q) => ({ ax: q.x, az: q.z, bx: q.x + Math.sin(q.rot) * LONGUEUR_QUAI, bz: q.z + Math.cos(q.rot) * LONGUEUR_QUAI })),
    ];
    // Clairière au cœur de chaque village.
    const clairieres = VILLAGES.map((v) => ({ c: versMonde(v.centre), r: v.rayon * 0.45 }));

    const cellules = new Map<number, number[]>();
    for (let i = 0; i < c.region.length; i++) {
      if (c.region[i] === MER) continue;
      const l = cellules.get(c.region[i]) ?? [];
      l.push(i);
      cellules.set(c.region[i], l);
    }
    const hectares = (c.pas * c.pas) / 10000;
    const sortie = new Map<string, { forme: string; matrices: THREE.Matrix4[] }>();
    const obstacles: { x: number; y: number; z: number; r: number; h: number }[] = [];
    for (const [ri, liste] of cellules) {
      const type = REGIONS[ri].vegetation;
      if (type === "aucune") continue;
      for (const s of [...SEMIS[type], ROCHERS_EPARS]) {
        const n = Math.min(4000, Math.round(liste.length * hectares * s.densite));
        for (let k = 0; k < n; k++) {
          const [cx, cz] = centreCellule(liste[Math.floor(hasard() * liste.length)]);
          const x = cx + (hasard() - 0.5) * c.pas;
          const z = cz + (hasard() - 0.5) * c.pas;
          const variante = s.variantes[Math.floor(hasard() * s.variantes.length)];
          const e = s.echelle[0] + hasard() * (s.echelle[1] - s.echelle[0]);
          const etire = 0.85 + hasard() * 0.3;
          const rot = hasard() * Math.PI * 2;

          if (regionA(x, z) !== ri) continue;
          const y = hauteurTerrain(x, z);
          if (y < s.hauteurMin) continue;
          const p = pente(x, z, 2);
          if (p > s.penteMax) continue;
          if (surPlateforme(x, z, 3) || hauteurPont(x, z) !== null) continue;
          if (passages.some((pt) => distanceSegment(x, z, pt.ax, pt.az, pt.bx, pt.bz).d < 8)) continue;
          if (barrieres.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 30)) continue;
          if (s.forme !== "rocher" && clairieres.some((cl) => Math.hypot(cl.c[0] - x, cl.c[1] - z) < cl.r)) continue;

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
  const { maisons } = lePlan();
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
            <meshStandardMaterial color="#ffb347" emissive="#ff7a1a" emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ─── Lieux uniques ──────────────────────────────────────────────────────────

/** Portail éteint vers Scìyolia : un anneau de pierre dressé. */
function Portail() {
  const p = lePlan().portail;
  return (
    <group position={[p.x, p.y, p.z]}>
      <Modele
        modele="portail-sciyolia"
        provisoire={
          <mesh material={PIERRE} position={[0, 7, 0]} castShadow>
            <torusGeometry args={[6, 0.9, 10, 32]} />
          </mesh>
        }
      />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.5, 1]} position={[-6, 1.5, 0]} />
        <CylinderCollider args={[1.5, 1]} position={[6, 1.5, 0]} />
      </RigidBody>
    </group>
  );
}

const GLACE = new THREE.MeshStandardMaterial({ color: "#d6f1fb", roughness: 0.1, metalness: 0.1, emissive: "#7fc9ea", emissiveIntensity: 0.15 });

/** Palais givré : le modèle, ou des flèches de glace provisoires. */
function PalaisGivre() {
  const p = lePlan().palais;
  const fleches = useMemo(() => {
    const r = graine(77);
    return Array.from({ length: 9 }, () => {
      const x = (r() - 0.5) * 70;
      const z = (r() - 0.5) * 70;
      return { x, z, y: hauteurTerrain(p.x + x, p.z + z) - p.y, h: 25 + r() * 45 };
    });
  }, [p]);
  return (
    <group position={[p.x, p.y, p.z]}>
      <Modele
        modele="palais-givre"
        provisoire={fleches.map((f, i) => (
          <mesh key={i} material={GLACE} position={[f.x, f.y + f.h / 2 - 1, f.z]} castShadow>
            <coneGeometry args={[4, f.h, 6]} />
          </mesh>
        ))}
      />
    </group>
  );
}

/** Lueur de lave au fond des cratères. */
function Lave() {
  const volcans = useMemo(
    () =>
      VOLCANS.map((v) => {
        const [x, z] = versMonde(v.position);
        return { x, z, y: hauteurTerrain(x, z) };
      }),
    [],
  );
  return (
    <>
      {volcans.map((v, i) => (
        <group key={i} position={[v.x, v.y + 2, v.z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <circleGeometry args={[30, 24]} />
            <meshStandardMaterial color="#ff5a10" emissive="#ff3a00" emissiveIntensity={3} />
          </mesh>
          <pointLight position={[0, 20, 0]} color="#ff6a2a" intensity={4000} distance={400} decay={1.6} />
        </group>
      ))}
    </>
  );
}

/** Modèles uniques de monde.ts (DECORS) : invisibles (et traversables) tant que leur fichier n'existe pas. */
function DecorsUniques() {
  const decors = lePlan().decors.filter((d) => modeleExiste(d.def.modele));
  return (
    <>
      {decors.map((d, i) => (
        <Modele key={i} modele={d.def.modele} position={[d.x, d.y, d.z]} rotation-y={d.rot} scale={d.def.echelle ?? 1} />
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

export function Decor() {
  return (
    <>
      <Vegetation />
      <Villages />
      <Ports />
      <Ponts />
      <Feux />
      <Portail />
      <PalaisGivre />
      <Lave />
      <DecorsUniques />
      <BrumeSorcieres />
    </>
  );
}
