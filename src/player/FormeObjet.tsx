import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { OBJETS } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { useJeu } from "../game/store";
import { Modele } from "../world/modeles";

const METAL = new THREE.MeshStandardMaterial({ color: "#b8923c", metalness: 0.8, roughness: 0.35 });
const SOMBRE = new THREE.MeshStandardMaterial({ color: "#3a3430", metalness: 0.5, roughness: 0.5 });
const ROUILLE = new THREE.MeshStandardMaterial({ color: "#a8754c", metalness: 0.45, roughness: 0.6, emissive: "#3a2010", emissiveIntensity: 0.4 });

/** L'objet : son modèle Blender (modeles/objet-<id>.glb), ou une forme provisoire. */
export function FormeObjet({ id }: { id: string }) {
  return <Modele modele={`objet-${id}`} provisoire={<FormeProvisoire id={id} />} />;
}

function FormeProvisoire({ id }: { id: string }) {
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
      // Clé de fer rouillé : anneau ouvragé, tige, panneton à deux dents.
      return (
        <group rotation={[0.3, 0.5, 0.5]}>
          <mesh material={ROUILLE}>
            <torusGeometry args={[0.065, 0.018, 8, 16]} />
          </mesh>
          <mesh material={ROUILLE} position={[0, -0.075, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.03, 10]} />
          </mesh>
          <mesh material={ROUILLE} position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.24, 8]} />
          </mesh>
          <mesh material={ROUILLE} position={[0.03, -0.29, 0]}>
            <boxGeometry args={[0.05, 0.022, 0.016]} />
          </mesh>
          <mesh material={ROUILLE} position={[0.025, -0.25, 0]}>
            <boxGeometry args={[0.04, 0.018, 0.016]} />
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

  // L'objet suit le regard avec un peu de retard (il « traîne » quand on tourne la tête).
  const regard = useRef(new THREE.Quaternion());
  const inclinaison = useMemo(() => new THREE.Euler(), []);
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const f = positionJoueur.foulee;
    // En marchant, la main décrit un huit à chaque pas (plus ample en courant) ; à l'arrêt, elle respire.
    const a = f.amplitude * (1 + f.allure * 0.8);
    const d = decalage.clone();
    d.x += Math.sin(f.phase) * 0.045 * a;
    d.y += (-Math.abs(Math.cos(f.phase)) * 0.05 + 0.025) * a + Math.sin(t * 1.6) * 0.008 * (1 - f.amplitude) - f.tassement * 0.5;
    // En courant, la main descend un peu et se rapproche.
    d.y -= 0.05 * f.allure * f.amplitude;
    d.z += 0.06 * f.allure * f.amplitude;
    regard.current.slerp(camera.quaternion, 1 - Math.exp(-dt * 18));
    g.position.copy(camera.position).add(d.applyQuaternion(regard.current));
    // L'objet se balance aussi : il penche d'un côté puis de l'autre à chaque pas.
    inclinaison.set(Math.cos(f.phase * 2) * 0.05 * a, Math.sin(f.phase) * 0.06 * a, Math.sin(f.phase) * 0.09 * a);
    g.quaternion.copy(regard.current).multiply(new THREE.Quaternion().setFromEuler(inclinaison));
  });

  if (!enMain) return null;
  return (
    <group ref={ref}>
      <FormeObjet id={enMain} />
      {enMain === "lanterne" && <pointLight color="#ffc27a" intensity={30} distance={26} decay={1.4} />}
    </group>
  );
}
