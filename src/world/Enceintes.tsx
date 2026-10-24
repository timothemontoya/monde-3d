import { useLayoutEffect, useMemo, useRef } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { REGLAGES, ZONES } from "../content/monde";
import type { Zone } from "../content/types";
import { hauteurSol } from "./relief";

const LONGUEUR_SEGMENT = 6;
const EPAISSEUR = 2.6;

type Segment = { x: number; z: number; y: number; angle: number; hauteur: number; longueur: number };

/** Découpe le cercle des remparts en segments, en sautant l'ouverture. */
function segmentsEnceinte(zone: Zone): { murs: Segment[]; tours: [number, number, number][] } {
  const e = zone.enceinte!;
  const r = zone.rayon;
  const n = Math.ceil((2 * Math.PI * r) / LONGUEUR_SEGMENT);
  const pas = (2 * Math.PI) / n;
  const ouverture = (e.ouverture * Math.PI) / 180;
  // Demi-largeur angulaire de l'ouverture (+ marge pour l'arche ou les piliers).
  const demiOuverture = (e.largeurOuverture / 2 + 3) / r;
  const murs: Segment[] = [];
  const tours: [number, number, number][] = [];

  for (let i = 0; i < n; i++) {
    const a = i * pas + pas / 2;
    const ecart = Math.atan2(Math.sin(a - ouverture), Math.cos(a - ouverture));
    if (Math.abs(ecart) < demiOuverture) continue;
    const x = zone.centre[0] + r * Math.cos(a);
    const z = zone.centre[1] + r * Math.sin(a);
    // Le pied du mur descend jusqu'au point le plus bas sous lui.
    const ya = hauteurSol(zone.centre[0] + r * Math.cos(a - pas / 2), zone.centre[1] + r * Math.sin(a - pas / 2));
    const yb = hauteurSol(zone.centre[0] + r * Math.cos(a + pas / 2), zone.centre[1] + r * Math.sin(a + pas / 2));
    const bas = Math.min(ya, yb) - 2;
    const haut = Math.max(ya, yb) + e.hauteur;
    murs.push({ x, z, y: bas, angle: a, hauteur: haut - bas, longueur: LONGUEUR_SEGMENT + 0.6 });
    // Une tour régulièrement, et une de chaque côté de l'ouverture.
    const auBord = Math.abs(Math.abs(ecart) - demiOuverture) < pas;
    if (i % 9 === 0 || auBord) tours.push([x, haut, z]);
  }
  return { murs, tours };
}

function Remparts({ zone }: { zone: Zone }) {
  const { murs, tours } = useMemo(() => segmentsEnceinte(zone), [zone]);
  const refMurs = useRef<THREE.InstancedMesh>(null);
  const refCreneaux = useRef<THREE.InstancedMesh>(null);
  const refTours = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    murs.forEach((seg, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -seg.angle + Math.PI / 2);
      s.set(seg.longueur, seg.hauteur, EPAISSEUR);
      m.compose(new THREE.Vector3(seg.x, seg.y + seg.hauteur / 2, seg.z), q, s);
      refMurs.current!.setMatrixAt(i, m);
      // Créneaux sur le chemin de ronde.
      s.set(seg.longueur * 0.45, 1.6, EPAISSEUR + 0.3);
      m.compose(new THREE.Vector3(seg.x, seg.y + seg.hauteur + 0.8, seg.z), q, s);
      refCreneaux.current!.setMatrixAt(i, m);
    });
    tours.forEach(([x, haut, z], i) => {
      m.compose(new THREE.Vector3(x, haut / 2 + 1, z), new THREE.Quaternion(), new THREE.Vector3(1, haut + 6, 1));
      refTours.current!.setMatrixAt(i, m);
    });
    [refMurs, refCreneaux, refTours].forEach((r) => {
      r.current!.instanceMatrix.needsUpdate = true;
      r.current!.computeBoundingSphere();
    });
  }, [murs, tours]);

  return (
    <>
      <instancedMesh ref={refMurs} args={[undefined, undefined, murs.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#8d867a" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={refCreneaux} args={[undefined, undefined, murs.length]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#7f786c" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={refTours} args={[undefined, undefined, tours.length]} castShadow>
        <cylinderGeometry args={[4, 4.6, 1, 10]} />
        <meshStandardMaterial color="#857e72" roughness={0.95} />
      </instancedMesh>
      <RigidBody type="fixed" colliders={false}>
        {murs.map((seg, i) => (
          <CuboidCollider
            key={i}
            args={[seg.longueur / 2, seg.hauteur / 2, EPAISSEUR / 2]}
            position={[seg.x, seg.y + seg.hauteur / 2, seg.z]}
            rotation={[0, -seg.angle + Math.PI / 2, 0]}
          />
        ))}
      </RigidBody>
    </>
  );
}

/** Tempête permanente qui ceinture l'île : on ne sort jamais du monde. */
export function TempeteDuMonde({ materiau }: { materiau: THREE.Material }) {
  const r = REGLAGES.rayonMonde;
  const n = 96;
  return (
    <>
      <mesh position={[0, 40, 0]} material={materiau}>
        <cylinderGeometry args={[r, r, 150, 128, 1, true]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return (
            <CuboidCollider
              key={i}
              args={[(Math.PI * r) / n + 2, 200, 4]}
              position={[r * Math.cos(a), 100, r * Math.sin(a)]}
              rotation={[0, -a + Math.PI / 2, 0]}
            />
          );
        })}
      </RigidBody>
    </>
  );
}

export function Enceintes() {
  return (
    <>
      {ZONES.filter((z) => z.enceinte).map((z) => (
        <Remparts key={z.id} zone={z} />
      ))}
    </>
  );
}
