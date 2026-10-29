import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ENIGMES, INDICES, RAMASSABLES, VILLAGES } from "../content/monde";
import type { Indice } from "../content/types";
import { useJeu } from "../game/store";
import { FormeObjet } from "../player/FormeObjet";
import { versMonde } from "./carte";
import { Modele } from "./modeles";
import { lePlan, type Point } from "./plan";
import { graine } from "./relief";
import { textureDouce } from "./textures";

const PIERRE = new THREE.MeshStandardMaterial({ color: "#7d776c", roughness: 0.9 });
const BOIS = new THREE.MeshStandardMaterial({ color: "#5a3e26", roughness: 0.85 });

const xyz = (p: Point) => [p.x, p.y, p.z] as [number, number, number];

/** Petites lueurs autour d'un objet pas encore découvert (comme les objets au sol d'Elden Ring). */
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
      <pointsMaterial map={textureDouce()} color={couleur} size={0.35} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function ObjetIndice({ indice }: { indice: Indice }) {
  const trouve = useJeu((s) => s.indices.includes(indice.id));
  const position = useMemo(() => xyz(lePlan().indices[indice.id]), [indice]);
  // Une stèle tourne sa face gravée vers le village le plus proche : on la lit en arrivant de là.
  const face = useMemo(() => {
    const [x, , z] = position;
    let [dx, dz, d] = [0, 1, Infinity];
    for (const v of VILLAGES) {
      const [vx, vz] = versMonde(v.centre);
      const l = Math.hypot(vx - x, vz - z);
      if (l < d) [dx, dz, d] = [vx - x, vz - z, l];
    }
    return Math.atan2(dx, dz);
  }, [position]);
  const braise = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (braise.current) braise.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.12);
  });
  return (
    <group position={position}>
      {indice.objet === "stele" && (
        <group rotation-y={face}>
          <Modele
            modele="stele"
            provisoire={
              <>
                <mesh material={PIERRE} position={[0, 2.2, 0]} castShadow>
                  <boxGeometry args={[2.2, 4.4, 0.6]} />
                </mesh>
                <mesh position={[0, 3, 0.31]}>
                  <planeGeometry args={[1.2, 1.6]} />
                  <meshBasicMaterial color="#ffcf7a" transparent opacity={0.55} blending={THREE.AdditiveBlending} />
                </mesh>
              </>
            }
          />
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[1.4, 0.35, 0.85]} position={[0, 0.35, 0]} />
            <CuboidCollider args={[0.8, 2.1, 0.3]} position={[0, 2.8, 0]} />
          </RigidBody>
        </group>
      )}
      {indice.objet === "livre" && (
        <>
          <Modele
            modele="lutrin"
            provisoire={
              <>
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
              </>
            }
          />
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.55, 0.7, 0.45]} position={[0, 0.7, 0]} />
          </RigidBody>
        </>
      )}
      {indice.objet === "braise" && (
        <>
          <Modele
            modele="autel-braise"
            provisoire={
              <mesh material={PIERRE} position={[0, 0.5, 0]} castShadow>
                <cylinderGeometry args={[1, 1.3, 1, 8]} />
              </mesh>
            }
          />
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[1.2, 0.5, 1.2]} position={[0, 0.5, 0]} />
          </RigidBody>
          {!trouve && (
            <>
              <mesh ref={braise} position={[0, 1.6, 0]}>
                <icosahedronGeometry args={[0.45, 1]} />
                <meshStandardMaterial color="#ff7a2a" emissive="#ff5a10" emissiveIntensity={4} />
              </mesh>
              <pointLight position={[0, 2, 0]} color="#ff8a3a" intensity={40} distance={18} />
            </>
          )}
        </>
      )}
      <Lueurs couleur="#ffd37a" eteintes={trouve} />
    </group>
  );
}

/** Objet posé au sol : flotte et tourne sur lui-même jusqu'à ce qu'on le ramasse. */
function Ramassable({ objet }: { objet: string }) {
  const possede = useJeu((s) => s.objets.includes(objet));
  const p = useMemo(() => xyz(lePlan().ramassables[objet]), [objet]);
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime;
    ref.current.position.y = 1.2 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
  });
  if (possede) return null;
  return (
    <group position={p}>
      <group ref={ref}>
        <FormeObjet id={objet} />
      </group>
      <Lueurs couleur="#bfe3ff" eteintes={false} />
    </group>
  );
}

/** Cadran à combinaison (énigme), posé sur un socle. */
function Cadran({ id, resolue }: { id: string; resolue: boolean }) {
  const p = useMemo(() => xyz(lePlan().enigmes[id]), [id]);
  const disque = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (disque.current) disque.current.rotation.z += delta * (resolue ? 0 : 0.15);
  });
  return (
    <group position={p}>
      <Modele
        modele="cadran"
        provisoire={
          <>
            <mesh material={PIERRE} position={[0, 0.9, 0]} castShadow>
              <boxGeometry args={[1.4, 1.8, 1.4]} />
            </mesh>
            <mesh ref={disque} position={[0, 2.2, 0]} rotation-x={-Math.PI / 2.6}>
              <cylinderGeometry args={[0.8, 0.8, 0.15, 24]} />
              <meshStandardMaterial color={resolue ? "#6a6a6a" : "#b8923c"} metalness={0.8} roughness={0.35} />
            </mesh>
          </>
        }
      />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.7, 0.9, 0.7]} position={[0, 0.9, 0]} />
      </RigidBody>
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
      {RAMASSABLES.map((r) => (
        <Ramassable key={r.objet} objet={r.objet} />
      ))}
      {ENIGMES.map((e) => (
        <Cadran key={e.id} id={e.id} resolue={enigmes.includes(e.id)} />
      ))}
    </>
  );
}
