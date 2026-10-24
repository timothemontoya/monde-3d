import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ENIGMES, INDICES } from "../content/monde";
import type { Indice } from "../content/types";
import { useJeu } from "../game/store";
import { graine, hauteurSol } from "./relief";

const PIERRE = new THREE.MeshStandardMaterial({ color: "#7d776c", roughness: 0.9 });
const BOIS = new THREE.MeshStandardMaterial({ color: "#5a3e26", roughness: 0.85 });

/** Petites lueurs qui flottent autour d'un objet pas encore découvert (comme les objets au sol d'Elden Ring). */
function Lueurs({ couleur, eteintes }: { couleur: string; eteintes: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = graine(42);
    const pos = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i++) pos.set([(r() - 0.5) * 2.5, r() * 3.5, (r() - 0.5) * 2.5], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.4;
    const m = ref.current.material as THREE.PointsMaterial;
    m.opacity += ((eteintes ? 0 : 0.9) - m.opacity) * 0.05;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={couleur} size={0.22} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function ObjetIndice({ indice }: { indice: Indice }) {
  const trouve = useJeu((s) => s.indices.includes(indice.id));
  const [x, z] = indice.position;
  const y = hauteurSol(x, z);
  const braise = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (braise.current) braise.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.12);
  });

  return (
    <group position={[x, y, z]}>
      {indice.objet === "stele" && (
        <RigidBody type="fixed" colliders="cuboid">
          <mesh material={PIERRE} position={[0, 2.2, 0]} castShadow>
            <boxGeometry args={[2.2, 4.4, 0.6]} />
          </mesh>
          <mesh position={[0, 3, 0.31]}>
            <planeGeometry args={[1.2, 1.6]} />
            <meshBasicMaterial color="#ffcf7a" transparent opacity={0.55} blending={THREE.AdditiveBlending} />
          </mesh>
        </RigidBody>
      )}
      {indice.objet === "livre" && (
        <RigidBody type="fixed" colliders="cuboid">
          <mesh material={BOIS} position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[0.5, 1.2, 0.5]} />
          </mesh>
          <mesh material={BOIS} position={[0, 1.25, 0]} rotation-x={-0.4} castShadow>
            <boxGeometry args={[1.1, 0.12, 0.8]} />
          </mesh>
          <mesh position={[0, 1.35, 0.02]} rotation-x={-0.4}>
            <boxGeometry args={[0.9, 0.08, 0.62]} />
            <meshStandardMaterial color="#e8dcc0" roughness={0.9} />
          </mesh>
        </RigidBody>
      )}
      {indice.objet === "braise" && (
        <>
          <RigidBody type="fixed" colliders={false}>
            <mesh material={PIERRE} position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[1, 1.3, 1, 8]} />
            </mesh>
            <CuboidCollider args={[1.2, 0.5, 1.2]} position={[0, 0.5, 0]} />
          </RigidBody>
          <mesh ref={braise} position={[0, 1.6, 0]}>
            <icosahedronGeometry args={[0.45, 1]} />
            <meshStandardMaterial color="#ff7a2a" emissive="#ff5a10" emissiveIntensity={4} />
          </mesh>
          <pointLight position={[0, 2, 0]} color="#ff8a3a" intensity={40} distance={18} />
        </>
      )}
      <Lueurs couleur="#ffd37a" eteintes={trouve} />
    </group>
  );
}

/** Cadran à combinaison (énigme), posé sur un socle. */
function Cadran({ position, resolue }: { position: [number, number]; resolue: boolean }) {
  const [x, z] = position;
  const y = hauteurSol(x, z);
  const disque = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (disque.current) disque.current.rotation.z += delta * (resolue ? 0 : 0.15);
  });
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh material={PIERRE} position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[1.4, 1.8, 1.4]} />
        </mesh>
      </RigidBody>
      <mesh ref={disque} position={[0, 2.2, 0]} rotation-x={-Math.PI / 2.6}>
        <cylinderGeometry args={[0.8, 0.8, 0.15, 24]} />
        <meshStandardMaterial color={resolue ? "#6a6a6a" : "#b8923c"} metalness={0.8} roughness={0.35} />
      </mesh>
      <Lueurs couleur="#9fd0ff" eteintes={resolue} />
    </group>
  );
}

export function Objets() {
  const enigmes = useJeu((s) => s.enigmes);
  return (
    <>
      {INDICES.map((i) => (
        <ObjetIndice key={i.id} indice={i} />
      ))}
      {ENIGMES.map((e) => (
        <Cadran key={e.id} position={e.position} resolue={enigmes.includes(e.id)} />
      ))}
    </>
  );
}
