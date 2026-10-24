import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { OBJETS } from "../content/monde";
import { useJeu } from "../game/store";

const METAL = new THREE.MeshStandardMaterial({ color: "#b8923c", metalness: 0.8, roughness: 0.35 });
const SOMBRE = new THREE.MeshStandardMaterial({ color: "#3a3430", metalness: 0.5, roughness: 0.5 });

/** Forme simple de chaque type d'objet (provisoire, à remplacer par des modèles Blender). */
export function FormeObjet({ id }: { id: string }) {
  const forme = OBJETS.find((o) => o.id === id)?.forme;
  switch (forme) {
    case "lanterne":
      return (
        <group>
          <mesh material={SOMBRE} position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.04, 8]} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.28, 8]} />
            <meshStandardMaterial color="#ffd27a" emissive="#ffae3a" emissiveIntensity={2.5} transparent opacity={0.85} />
          </mesh>
          <mesh material={SOMBRE} position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.05, 8]} />
          </mesh>
          <mesh material={SOMBRE} position={[0, 0.32, 0]}>
            <torusGeometry args={[0.07, 0.012, 6, 12]} />
          </mesh>
        </group>
      );
    case "cle":
      return (
        <group rotation-z={0.6}>
          <mesh material={METAL}>
            <torusGeometry args={[0.08, 0.02, 6, 12]} />
          </mesh>
          <mesh material={METAL} position={[0, -0.22, 0]}>
            <boxGeometry args={[0.03, 0.3, 0.03]} />
          </mesh>
        </group>
      );
    case "cristal":
      return (
        <mesh>
          <octahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial color="#ff8a3a" emissive="#ff5a10" emissiveIntensity={3} />
        </mesh>
      );
    case "boussole":
      return (
        <group rotation-x={Math.PI / 2.4}>
          <mesh material={METAL}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 20]} />
          </mesh>
          <mesh position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.01, 20]} />
            <meshStandardMaterial color="#efe6cf" />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation-y={0.8}>
            <boxGeometry args={[0.015, 0.008, 0.18]} />
            <meshStandardMaterial color="#a8322a" />
          </mesh>
        </group>
      );
    case "amulette":
      return (
        <mesh material={METAL}>
          <torusGeometry args={[0.1, 0.03, 8, 16]} />
        </mesh>
      );
    case "parchemin":
    default:
      return (
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 10]} />
          <meshStandardMaterial color="#e8dcc0" />
        </mesh>
      );
  }
}

/** Objet tenu en main : suit la caméra, en bas à droite de la vue. */
export function ObjetEnMain() {
  const enMain = useJeu((s) => s.enMain);
  const camera = useThree((s) => s.camera);
  const ref = useRef<THREE.Group>(null);
  const decalage = new THREE.Vector3(0.42, -0.36, -0.75);

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    // Léger balancement, comme une main qui marche.
    const t = state.clock.elapsedTime;
    const d = decalage.clone();
    d.y += Math.sin(t * 2) * 0.008;
    g.position.copy(camera.position).add(d.applyQuaternion(camera.quaternion));
    g.quaternion.copy(camera.quaternion);
  });

  if (!enMain) return null;
  return (
    <group ref={ref}>
      <FormeObjet id={enMain} />
      {enMain === "lanterne" && <pointLight color="#ffc27a" intensity={30} distance={26} decay={1.4} />}
    </group>
  );
}
