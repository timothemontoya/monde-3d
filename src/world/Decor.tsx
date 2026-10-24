import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { INDICES, REGLAGES, ZONES } from "../content/monde";
import { graine, hauteurSol } from "./relief";

// Décor PROVISOIRE : il sera remplacé par tes modèles Blender. Tout est placé de façon
// déterministe (même graine) : le monde est identique à chaque visite.

const zone = (id: string) => ZONES.find((z) => z.id === id)!;
const PIERRE = new THREE.MeshStandardMaterial({ color: "#8f887b", roughness: 0.95 });
const ENDUIT = new THREE.MeshStandardMaterial({ color: "#b8a98d", roughness: 0.95 });
const TUILE = new THREE.MeshStandardMaterial({ color: "#6b3b2a", roughness: 0.9 });

/** Instancie une géométrie à une liste de transformations. */
function Instances({
  geometrie,
  materiau,
  matrices,
  ombre = true,
}: {
  geometrie: THREE.BufferGeometry;
  materiau: THREE.Material;
  matrices: THREE.Matrix4[];
  ombre?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current!.setMatrixAt(i, m));
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geometrie, materiau, matrices.length]} castShadow={ombre} receiveShadow />;
}

const matrice = (x: number, y: number, z: number, rotY = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(sx, sy, sz),
  );

/** Village de Brumeval : maisons autour d'une place et d'une fontaine. */
function Village() {
  const z = zone("brumeval");
  const maisons = useMemo(() => {
    const r = graine(21);
    const liste: { x: number; z: number; y: number; rot: number; l: number; p: number; h: number }[] = [];
    const indice = INDICES.find((i) => i.id === "chant-du-vent")!.position;
    for (let essai = 0; essai < 200 && liste.length < 16; essai++) {
      const a = r() * Math.PI * 2;
      const d = 28 + r() * (z.rayon - 42);
      const x = z.centre[0] + Math.cos(a) * d;
      const zz = z.centre[1] + Math.sin(a) * d;
      // Pas sur la place, ni devant l'indice, ni sur la rue qui mène à la porte.
      const versPorte = Math.abs(Math.atan2(Math.sin(a - (z.enceinte!.ouverture * Math.PI) / 180), Math.cos(a - (z.enceinte!.ouverture * Math.PI) / 180)));
      if (versPorte < 0.35) continue;
      if (Math.hypot(x - indice[0], zz - indice[1]) < 14) continue;
      if (liste.some((m) => Math.hypot(m.x - x, m.z - zz) < 17)) continue;
      liste.push({ x, z: zz, y: hauteurSol(x, zz), rot: -a, l: 9 + r() * 5, p: 7 + r() * 3, h: 6 + r() * 4 });
    }
    return liste;
  }, [z]);

  const geoToit = useMemo(() => {
    const g = new THREE.ConeGeometry(0.75, 1, 4);
    g.rotateY(Math.PI / 4);
    g.translate(0, 0.5, 0);
    return g;
  }, []);

  return (
    <>
      <Instances geometrie={new THREE.BoxGeometry()} materiau={ENDUIT} matrices={maisons.map((m) => matrice(m.x, m.y + m.h / 2, m.z, m.rot, m.l, m.h, m.p))} />
      <Instances geometrie={geoToit} materiau={TUILE} matrices={maisons.map((m) => matrice(m.x, m.y + m.h, m.z, m.rot, m.l * 1.15, m.h * 0.7, m.p * 1.25))} />
      <RigidBody type="fixed" colliders={false}>
        {maisons.map((m, i) => (
          <CuboidCollider key={i} args={[m.l / 2, m.h, m.p / 2]} position={[m.x, m.y + m.h, m.z]} rotation={[0, m.rot, 0]} />
        ))}
      </RigidBody>
      {/* Fontaine sur la place */}
      <RigidBody type="fixed" colliders="hull" position={[z.centre[0], z.plateau!, z.centre[1]]}>
        <mesh material={PIERRE} castShadow receiveShadow>
          <cylinderGeometry args={[5, 5.5, 1.2, 16]} />
        </mesh>
        <mesh material={PIERRE} position={[0, 2, 0]} castShadow>
          <cylinderGeometry args={[0.8, 1, 4, 10]} />
        </mesh>
      </RigidBody>
    </>
  );
}

/** Ruines d'une chapelle sur le promontoire. */
function Ruines() {
  const z = zone("promontoire");
  const piliers = useMemo(() => {
    const r = graine(5);
    return Array.from({ length: 10 }, (_, i) => {
      const cote = i % 2 === 0 ? -1 : 1;
      const x = z.centre[0] + 50 + cote * 7;
      const zz = z.centre[1] - 40 + Math.floor(i / 2) * 8;
      const h = 4 + r() * 8;
      return { x, z: zz, y: hauteurSol(x, zz), h };
    });
  }, [z]);

  return (
    <>
      <Instances
        geometrie={new THREE.CylinderGeometry(0.9, 1.1, 1, 10)}
        materiau={PIERRE}
        matrices={piliers.map((p) => matrice(p.x, p.y + p.h / 2, p.z, 0, 1, p.h, 1))}
      />
      <RigidBody type="fixed" colliders={false}>
        {piliers.map((p, i) => (
          <CylinderCollider key={i} args={[p.h / 2, 1.1]} position={[p.x, p.y + p.h / 2, p.z]} />
        ))}
      </RigidBody>
    </>
  );
}

/** L'Arbre d'Or : immense, lumineux, visible de toute l'île. */
function ArbreOr() {
  const z = zone("sanctuaire");
  const base = new THREE.Vector3(z.centre[0], z.plateau!, z.centre[1]);
  const feuilles = useRef<THREE.Points>(null);

  const { tronc, points } = useMemo(() => {
    // Tronc torsadé : un tube qui suit une courbe en spirale douce.
    const courbe = new THREE.CatmullRomCurve3(
      Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.sin(i * 0.9) * 4, i * 18, Math.cos(i * 0.7) * 4)),
    );
    const tronc = new THREE.TubeGeometry(courbe, 64, 7, 12, false);
    const r = graine(99);
    const n = 9000;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Couronne : une grande sphère aplatie autour du sommet.
      const u = r() * Math.PI * 2;
      const v = Math.acos(2 * r() - 1);
      const rr = Math.cbrt(r()) * 75;
      pos[i * 3] = Math.sin(v) * Math.cos(u) * rr;
      pos[i * 3 + 1] = 135 + Math.cos(v) * rr * 0.55;
      pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * rr;
    }
    const points = new THREE.BufferGeometry();
    points.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { tronc, points };
  }, []);

  useFrame((state) => {
    if (feuilles.current) feuilles.current.rotation.y = state.clock.elapsedTime * 0.01;
  });

  return (
    <group position={base}>
      <mesh geometry={tronc} castShadow>
        <meshStandardMaterial color="#c9a14a" emissive="#ffb347" emissiveIntensity={0.35} roughness={0.6} fog={false} />
      </mesh>
      <points ref={feuilles} geometry={points}>
        <pointsMaterial color="#f2b347" size={2.2} sizeAttenuation transparent opacity={0.9} depthWrite={false} fog={false} />
      </points>
      <pointLight position={[0, 40, 0]} color="#ffbf5a" intensity={4000} distance={260} decay={1.6} />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[70, 8]} position={[0, 70, 0]} />
      </RigidBody>
    </group>
  );
}

/** Arbres et rochers dispersés sur l'île (hors villages et sanctuaires). */
function Vegetation() {
  const { arbres, rochers } = useMemo(() => {
    const r = graine(3);
    const arbres: THREE.Matrix4[] = [];
    const rochers: THREE.Matrix4[] = [];
    const libre = (x: number, z: number) =>
      Math.hypot(x, z) < REGLAGES.rayonMonde - 30 &&
      ZONES.every((zn) => !zn.enceinte || Math.hypot(x - zn.centre[0], z - zn.centre[1]) > zn.rayon + 12);
    for (let i = 0; i < 2600 && arbres.length < 650; i++) {
      const x = (r() - 0.5) * REGLAGES.rayonMonde * 2;
      const z = (r() - 0.5) * REGLAGES.rayonMonde * 2;
      if (!libre(x, z)) continue;
      // Plus clairsemé dans les terres orageuses.
      if (z < -150 && r() < 0.75) continue;
      const s = 0.7 + r() * 0.9;
      arbres.push(matrice(x, hauteurSol(x, z), z, r() * 6, s, s * (0.8 + r() * 0.5), s));
    }
    for (let i = 0; i < 900 && rochers.length < 260; i++) {
      const x = (r() - 0.5) * REGLAGES.rayonMonde * 2;
      const z = (r() - 0.5) * REGLAGES.rayonMonde * 2;
      if (!libre(x, z)) continue;
      const s = 1 + r() * (z < -150 ? 6 : 2.5);
      rochers.push(matrice(x, hauteurSol(x, z) + s * 0.2, z, r() * 6, s, s * 0.7, s * 1.2));
    }
    return { arbres, rochers };
  }, []);

  const { geoTronc, geoFeuillage } = useMemo(() => {
    const geoTronc = new THREE.CylinderGeometry(0.35, 0.55, 6, 6);
    geoTronc.translate(0, 3, 0);
    const geoFeuillage = new THREE.IcosahedronGeometry(3.6, 0);
    geoFeuillage.translate(0, 7.5, 0);
    return { geoTronc, geoFeuillage };
  }, []);

  return (
    <>
      <Instances geometrie={geoTronc} materiau={new THREE.MeshStandardMaterial({ color: "#4a3b2a", roughness: 1 })} matrices={arbres} />
      <Instances
        geometrie={geoFeuillage}
        materiau={new THREE.MeshStandardMaterial({ color: "#c9952f", roughness: 0.9, flatShading: true })}
        matrices={arbres}
      />
      <Instances
        geometrie={new THREE.DodecahedronGeometry(1, 0)}
        materiau={new THREE.MeshStandardMaterial({ color: "#7d786f", roughness: 1, flatShading: true })}
        matrices={rochers}
      />
    </>
  );
}

export function Decor() {
  return (
    <>
      <Village />
      <Ruines />
      <ArbreOr />
      <Vegetation />
    </>
  );
}
