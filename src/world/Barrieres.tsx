import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BARRIERES } from "../content/monde";
import type { Barriere } from "../content/types";
import { estOuverte, useJeu } from "../game/store";
import { rotationFace } from "./geometrie";
import { hauteurSol } from "./relief";
import { materiauTempete, materiauVoile } from "./shaders";

const DUREE_DISPARITION = 2.5;

/** Hauteur du sol au plus bas et au plus haut le long d'une barrière (pour couvrir tout le relief). */
function reliefLe_long(b: Barriere) {
  const a = (b.angle * Math.PI) / 180;
  const tx = Math.sin(a);
  const tz = -Math.cos(a);
  let min = Infinity;
  let max = -Infinity;
  for (let s = -0.5; s <= 0.5; s += 0.02) {
    const h = hauteurSol(b.position[0] + tx * s * b.largeur, b.position[1] + tz * s * b.largeur);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  return { min, max };
}

/** Suit l'ouverture d'une barrière : `ouverte` passe à vrai, puis `visible` à faux une fois l'effet terminé. */
function useOuverture(b: Barriere) {
  const ouverte = useJeu((s) => estOuverte(b, s));
  const notifier = useJeu((s) => s.notifier);
  const dejaOuverte = useRef(ouverte);
  const [visible, setVisible] = useState(!ouverte);
  const progres = useRef(ouverte ? 1 : 0);

  useEffect(() => {
    if (ouverte && !dejaOuverte.current) {
      dejaOuverte.current = true;
      const textes = {
        tempete: ["La tempête se dissipe…", "Le vent s'est tu. Le chemin est libre."],
        brume: ["Le voile se lève", "La brume dorée s'efface lentement."],
        porte: ["La porte s'ouvre", "Le mécanisme cède dans un grondement sourd."],
      }[b.type];
      notifier(textes[0], textes[1]);
    }
  }, [ouverte, b.type, notifier]);

  useFrame((_, delta) => {
    if (!ouverte || progres.current >= 1) return;
    progres.current = Math.min(1, progres.current + delta / DUREE_DISPARITION);
    if (progres.current >= 1 && b.type !== "porte") setVisible(false);
  });

  return { ouverte, visible, progres };
}

function Tempete({ b }: { b: Barriere }) {
  const { ouverte, visible, progres } = useOuverture(b);
  const { min, max } = useMemo(() => reliefLe_long(b), [b]);
  const hauteur = max - min + 160;
  const materiaux = useMemo(() => [materiauTempete(), materiauTempete(), materiauTempete()], []);

  useFrame((state) => {
    materiaux.forEach((m, i) => {
      m.uniforms.uTemps.value = state.clock.elapsedTime + i * 13;
      m.uniforms.uDisparition.value = progres.current;
    });
  });

  return (
    <group position={[b.position[0], min - 20, b.position[1]]} rotation-y={rotationFace(b.angle)}>
      {visible &&
        materiaux.map((m, i) => (
          // Trois couches décalées pour donner de l'épaisseur au mur de nuages.
          <mesh key={i} position={[0, hauteur / 2, (i - 1) * 9]} material={m}>
            <planeGeometry args={[b.largeur, hauteur]} />
          </mesh>
        ))}
      {!ouverte && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[b.largeur / 2, hauteur / 2, 6]} position={[0, hauteur / 2, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

function Voile({ b }: { b: Barriere }) {
  const { ouverte, visible, progres } = useOuverture(b);
  const materiau = useMemo(() => materiauVoile(), []);
  const y = hauteurSol(b.position[0], b.position[1]);
  const hauteur = 13;

  useFrame((state) => {
    materiau.uniforms.uTemps.value = state.clock.elapsedTime;
    materiau.uniforms.uDisparition.value = progres.current;
  });

  return (
    <group position={[b.position[0], y, b.position[1]]} rotation-y={rotationFace(b.angle)}>
      {visible && (
        <>
          <mesh position={[0, hauteur / 2, 0]} material={materiau}>
            <planeGeometry args={[b.largeur, hauteur]} />
          </mesh>
          <pointLight position={[0, 4, 2]} color="#ffbf5a" intensity={(1 - progres.current) * 60} distance={30} />
        </>
      )}
      {!ouverte && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[b.largeur / 2, 40, 0.8]} position={[0, 40, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

const PIERRE = new THREE.MeshStandardMaterial({ color: "#8a8478", roughness: 0.9 });
const BOIS = new THREE.MeshStandardMaterial({ color: "#5a3e26", roughness: 0.85 });
const FER = new THREE.MeshStandardMaterial({ color: "#3c3a36", roughness: 0.5, metalness: 0.7 });

function Porte({ b }: { b: Barriere }) {
  const { ouverte, progres } = useOuverture(b);
  const gauche = useRef<THREE.Group>(null);
  const droite = useRef<THREE.Group>(null);
  const y = hauteurSol(b.position[0], b.position[1]);
  const demi = b.largeur / 2;
  const hauteur = 10;

  useFrame(() => {
    const t = THREE.MathUtils.smootherstep(progres.current, 0, 1);
    if (gauche.current) gauche.current.rotation.y = -t * 1.75;
    if (droite.current) droite.current.rotation.y = t * 1.75;
  });

  const battant = (
    <>
      <mesh material={BOIS} position={[demi / 2, hauteur / 2, 0]} castShadow>
        <boxGeometry args={[demi - 0.1, hauteur, 0.5]} />
      </mesh>
      {[2, 5, 8].map((h) => (
        <mesh key={h} material={FER} position={[demi / 2, h, 0.3]}>
          <boxGeometry args={[demi - 0.2, 0.35, 0.1]} />
        </mesh>
      ))}
    </>
  );

  return (
    <group position={[b.position[0], y, b.position[1]]} rotation-y={rotationFace(b.angle)}>
      {/* Arche de pierre (toujours solide) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh material={PIERRE} position={[-demi - 1.5, 8, 0]} castShadow>
          <boxGeometry args={[3, 16, 3]} />
        </mesh>
        <mesh material={PIERRE} position={[demi + 1.5, 8, 0]} castShadow>
          <boxGeometry args={[3, 16, 3]} />
        </mesh>
        <mesh material={PIERRE} position={[0, 14.5, 0]} castShadow>
          <boxGeometry args={[b.largeur + 6, 3, 3.2]} />
        </mesh>
      </RigidBody>
      {/* Battants : pivotent sur leurs gonds */}
      <group ref={gauche} position={[-demi, 0, 0]}>
        {battant}
      </group>
      <group ref={droite} position={[demi, 0, 0]} scale-x={-1}>
        {battant}
      </group>
      {!ouverte && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[demi, 7, 0.6]} position={[0, 7, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

export function Barrieres() {
  return (
    <>
      {BARRIERES.map((b) =>
        b.type === "tempete" ? <Tempete key={b.id} b={b} /> : b.type === "brume" ? <Voile key={b.id} b={b} /> : <Porte key={b.id} b={b} />,
      )}
    </>
  );
}
