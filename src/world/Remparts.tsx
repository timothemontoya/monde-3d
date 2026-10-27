import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import { REMPARTS } from "../content/monde";
import type { Rempart } from "../content/types";
import { versMonde } from "./carte";
import { Instances, InstancesModele, matrice } from "./modeles";
import { hauteurSol } from "./relief";
import { DEMI_EPAISSEUR_REMPART } from "./zones";

// Remparts : des murs de MODULE m (modèles rempart-mur / rempart-tour, voir scripts/preparer-pack.mjs)
// posés bout à bout le long de la zone, des tours aux angles et de part et d'autre des portes.

/** Longueur et hauteur d'un mur (le modèle fait 8 m d'épaisseur : on l'amincit). */
const MODULE = 8;
const HAUTEUR = 10.5;
const EPAISSEUR = DEMI_EPAISSEUR_REMPART * 2;
/** Côté et hauteur de chaque modèle de tour (en m). */
const TOURS = { "rempart-tour": [9, 20.9], "rempart-glace-tour": [9, 20.9], "tour-guet": [6.4, 18] } as const;
/** Largeur du passage d'une porte. */
const PORTE = 14;
/** Un angle plus marqué que celui-ci reçoit une tour. */
const ANGLE_TOUR = (30 * Math.PI) / 180;
/** Distance minimale entre deux tours, en m. */
const ESPACEMENT_TOURS = 28;
/** Les murs descendent sous le sol : jamais de vide sous eux, même en pente. */
const FONDATION = 1.5;

type Piece = { x: number; z: number; y: number; rot: number; longueur: number };

/** Arrondit un contour fermé dessiné à main levée (Chaikin), pour des murs sans à-coups. */
function lisser(p: [number, number][], passes = 3) {
  for (let k = 0; k < passes; k++)
    p = p.flatMap((a, i) => {
      const b = p[(i + 1) % p.length];
      return [
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      ] as [number, number][];
    });
  return p;
}

/** Où poser les murs et les tours d'un rempart. */
function placer(r: Rempart, TOUR: number) {
  const pts = lisser(r.zone.map(versMonde));
  const n = pts.length;
  const longueurs = pts.map((a, i) => Math.hypot(pts[(i + 1) % n][0] - a[0], pts[(i + 1) % n][1] - a[1]));
  const debut: number[] = [];
  let total = 0;
  for (const l of longueurs) (debut.push(total), (total += l));
  const point = (s: number): [number, number] => {
    s = ((s % total) + total) % total;
    let i = 0;
    while (i < n - 1 && debut[i + 1] <= s) i++;
    const [a, b] = [pts[i], pts[(i + 1) % n]];
    const t = (s - debut[i]) / (longueurs[i] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  /** Direction du mur autour de l'abscisse s, mesurée sur `l` m. */
  const direction = (s: number, l: number): [number, number] => {
    const [a, b] = [point(s - l / 2), point(s + l / 2)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  };
  const solBas = (x: number, z: number, ux: number, uz: number, demi: number) =>
    Math.min(hauteurSol(x, z), hauteurSol(x - ux * demi, z - uz * demi), hauteurSol(x + ux * demi, z + uz * demi)) - FONDATION;

  // Chaque porte : l'abscisse (le long du mur) la plus proche du point donné.
  const portes = r.portes.map((p) => {
    const [px, pz] = versMonde(p);
    let meilleur = 0;
    let dMin = Infinity;
    for (let s = 0; s < total; s += 0.5) {
      const [x, z] = point(s);
      const d = Math.hypot(x - px, z - pz);
      if (d < dMin) ((dMin = d), (meilleur = s));
    }
    return meilleur;
  });
  const ecart = (s: number, p: number) => {
    const d = Math.abs(s - p) % total;
    return Math.min(d, total - d);
  };

  // Des murs tous de la même longueur, bout à bout le long du contour lissé.
  const nombre = Math.max(3, Math.round(total / MODULE));
  const longueur = total / nombre;
  const murs: Piece[] = [];
  for (let k = 0; k < nombre; k++) {
    const s = (k + 0.5) * longueur;
    if (portes.some((p) => ecart(s, p) < PORTE / 2 + longueur / 2)) continue;
    const [x, z] = point(s);
    const [ux, uz] = direction(s, longueur);
    // Un peu plus longs que l'espacement : pas de jour entre deux murs dans les courbes.
    murs.push({ x, z, y: solBas(x, z, ux, uz, longueur / 2), rot: Math.atan2(-uz, ux), longueur: longueur * 1.04 });
  }

  // Tours : de part et d'autre des portes, puis là où le mur tourne le plus, assez espacées.
  const tours: Piece[] = [];
  const tour = (s: number) => {
    const [x, z] = point(s);
    const [ux, uz] = direction(s, TOUR);
    tours.push({ x, z, y: solBas(x, z, ux, uz, TOUR / 2), rot: Math.atan2(-uz, ux), longueur: TOUR });
  };
  for (const p of portes) for (const sens of [-1, 1]) tour(p + sens * (PORTE / 2 + TOUR / 2));
  const virages: { s: number; v: number }[] = [];
  for (let s = 0; s < total; s += 2) {
    const [a, b] = [direction(s - 12, 12), direction(s + 12, 12)];
    virages.push({ s, v: Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) });
  }
  virages.sort((a, b) => b.v - a.v);
  for (const { s, v } of virages) {
    if (v < ANGLE_TOUR) break;
    if (portes.some((p) => ecart(s, p) < PORTE / 2 + TOUR)) continue;
    const [x, z] = point(s);
    if (tours.every((t) => Math.hypot(t.x - x, t.z - z) > ESPACEMENT_TOURS)) tour(s);
  }
  return { murs, tours };
}

const PROVISOIRE = {
  pierre: new THREE.MeshStandardMaterial({ color: "#cfc8b8", roughness: 0.95 }),
  glace: new THREE.MeshStandardMaterial({ color: "#d6f1fb", roughness: 0.2, emissive: "#7fc9ea", emissiveIntensity: 0.15 }),
};
const BOITE = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

function UnRempart({ r }: { r: Rempart }) {
  const nom = r.style === "glace" ? "rempart-glace" : "rempart";
  const modeleTour = r.tour ?? (`${nom}-tour` as const);
  const [TOUR, HAUTEUR_TOUR] = TOURS[modeleTour];
  const { murs, tours } = useMemo(() => placer(r, TOUR), [r, TOUR]);
  const m = {
    murs: murs.map((p) => matrice(p.x, p.y, p.z, p.rot, p.longueur / MODULE, 1, EPAISSEUR / MODULE)),
    tours: tours.map((p) => matrice(p.x, p.y, p.z, p.rot)),
    mursProvisoires: murs.map((p) => matrice(p.x, p.y, p.z, p.rot, p.longueur, HAUTEUR, EPAISSEUR)),
    toursProvisoires: tours.map((p) => matrice(p.x, p.y, p.z, p.rot, TOUR, HAUTEUR_TOUR, TOUR)),
  };
  return (
    <>
      <InstancesModele modele={`${nom}-mur`} matrices={m.murs} provisoire={<Instances geometrie={BOITE} materiau={PROVISOIRE[r.style]} matrices={m.mursProvisoires} />} />
      <InstancesModele modele={modeleTour} matrices={m.tours} provisoire={<Instances geometrie={BOITE} materiau={PROVISOIRE[r.style]} matrices={m.toursProvisoires} />} />
      <RigidBody type="fixed" colliders={false}>
        {murs.map((p, i) => (
          <CuboidCollider key={i} args={[p.longueur / 2, HAUTEUR / 2, EPAISSEUR / 2]} position={[p.x, p.y + HAUTEUR / 2, p.z]} rotation={[0, p.rot, 0]} />
        ))}
        {tours.map((p, i) => (
          <CuboidCollider key={`t${i}`} args={[TOUR / 2, HAUTEUR_TOUR / 2, TOUR / 2]} position={[p.x, p.y + HAUTEUR_TOUR / 2, p.z]} rotation={[0, p.rot, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

export function Remparts() {
  return (
    <>
      {REMPARTS.map((r) => (
        <UnRempart key={r.id} r={r} />
      ))}
    </>
  );
}
