import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BARRIERES } from "../content/monde";
import type { Barriere } from "../content/types";
import { barriereOuverte, useJeu } from "../game/store";
import { versMonde } from "./carte";
import { rotationFace } from "./geometrie";
import { hauteurSol } from "./relief";
import { materiauTempete, materiauVoile } from "./shaders";

const DUREE_DISPARITION = 2.5;

const TEXTES: Record<Barriere["type"], [string, string]> = {
  tempete: ["La tempête se dissipe…", "Le vent s'est tu. Le chemin est libre."],
  brume: ["Le voile se lève", "La brume dorée s'efface lentement."],
  porte: ["La porte s'ouvre", "Le mécanisme cède dans un grondement sourd."],
  givre: ["Le givre fond", "La glace craque, puis s'effondre en eau."],
  sort: ["Le sort se dissipe", "La brume violette se retire."],
};

/** Suit l'ouverture : `ouverte` passe à vrai, `progres` va de 0 à 1, puis `visible` passe à faux. */
function useOuverture(b: Barriere) {
  const ouverte = useJeu((s) => barriereOuverte(b, s));
  const notifier = useJeu((s) => s.notifier);
  const ouvrirBarriere = useJeu((s) => s.ouvrirBarriere);
  const dejaOuverte = useRef(ouverte);
  const [visible, setVisible] = useState(!ouverte);
  const progres = useRef(ouverte ? 1 : 0);

  useEffect(() => {
    if (!ouverte) return;
    ouvrirBarriere(b.id);
    if (!dejaOuverte.current) {
      dejaOuverte.current = true;
      notifier(...TEXTES[b.type]);
    }
  }, [ouverte, b.id, b.type, notifier, ouvrirBarriere]);

  useFrame((_, delta) => {
    if (!ouverte || progres.current >= 1) return;
    progres.current = Math.min(1, progres.current + delta / DUREE_DISPARITION);
    if (progres.current >= 1 && b.type !== "porte") setVisible(false);
  });

  return { ouverte, visible, progres };
}

/** Repère commun : position au sol et orientation de la barrière. */
function useRepere(b: Barriere) {
  return useMemo(() => {
    const [x, z] = versMonde(b.position);
    return { x, z, y: hauteurSol(x, z), rotation: rotationFace(b.angle) };
  }, [b]);
}

function Bloqueur({ b, hauteur }: { b: Barriere; hauteur: number }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[b.largeur / 2, hauteur / 2, 1]} position={[0, hauteur / 2 - 5, 0]} />
    </RigidBody>
  );
}

function Tempete({ b }: { b: Barriere }) {
  const { ouverte, visible, progres } = useOuverture(b);
  const r = useRepere(b);
  const hauteur = 220;
  const materiaux = useMemo(() => [materiauTempete(), materiauTempete(), materiauTempete()], []);
  useFrame((state) => {
    materiaux.forEach((m, i) => {
      m.uniforms.uTemps.value = state.clock.elapsedTime + i * 13;
      m.uniforms.uDisparition.value = progres.current;
    });
  });
  return (
    <group position={[r.x, r.y - 40, r.z]} rotation-y={r.rotation}>
      {visible &&
        materiaux.map((m, i) => (
          <mesh key={i} position={[0, hauteur / 2, (i - 1) * 9]} material={m}>
            <planeGeometry args={[b.largeur, hauteur]} />
          </mesh>
        ))}
      {!ouverte && <Bloqueur b={b} hauteur={hauteur} />}
    </group>
  );
}

/** Voile lumineux : doré (brume) ou violet (sort des sorcières). */
function Voile({ b, teinte }: { b: Barriere; teinte: [string, string] }) {
  const { ouverte, visible, progres } = useOuverture(b);
  const r = useRepere(b);
  const materiau = useMemo(() => materiauVoile(teinte), [teinte]);
  const hauteur = 16;
  useFrame((state) => {
    materiau.uniforms.uTemps.value = state.clock.elapsedTime;
    materiau.uniforms.uDisparition.value = progres.current;
  });
  return (
    <group position={[r.x, r.y, r.z]} rotation-y={r.rotation}>
      {visible && (
        <>
          <mesh position={[0, hauteur / 2, 0]} material={materiau}>
            <planeGeometry args={[b.largeur, hauteur]} />
          </mesh>
          <pointLight position={[0, 4, 2]} color={teinte[0]} intensity={(1 - progres.current) * 60} distance={30} />
        </>
      )}
      {!ouverte && <Bloqueur b={b} hauteur={80} />}
    </group>
  );
}

const GLACE = new THREE.MeshStandardMaterial({ color: "#bfe6f5", roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.88 });

/** Mur de givre : des blocs de glace qui fondent (s'affaissent) quand la condition est remplie. */
function Givre({ b }: { b: Barriere }) {
  const { ouverte, visible, progres } = useOuverture(b);
  const r = useRepere(b);
  const groupe = useRef<THREE.Group>(null);
  const blocs = useMemo(() => {
    const n = Math.ceil(b.largeur / 3);
    return Array.from({ length: n }, (_, i) => ({
      x: -b.largeur / 2 + (i + 0.5) * (b.largeur / n),
      h: 14 + ((i * 7919) % 9),
      r: ((i * 104729) % 100) / 400,
    }));
  }, [b.largeur]);
  useFrame(() => {
    if (groupe.current) groupe.current.scale.y = Math.max(0.001, 1 - THREE.MathUtils.smootherstep(progres.current, 0, 1));
  });
  return (
    <group position={[r.x, r.y - 2, r.z]} rotation-y={r.rotation}>
      {visible && (
        <group ref={groupe}>
          {blocs.map((bl, i) => (
            <mesh key={i} material={GLACE} position={[bl.x, bl.h / 2, 0]} rotation-z={bl.r - 0.12} castShadow>
              <boxGeometry args={[b.largeur / blocs.length + 0.6, bl.h, 3]} />
            </mesh>
          ))}
        </group>
      )}
      {!ouverte && <Bloqueur b={b} hauteur={60} />}
    </group>
  );
}

const PIERRE = new THREE.MeshStandardMaterial({ color: "#8a8478", roughness: 0.9 });
const BOIS = new THREE.MeshStandardMaterial({ color: "#5a3e26", roughness: 0.85 });

function Porte({ b }: { b: Barriere }) {
  const { ouverte, progres } = useOuverture(b);
  const r = useRepere(b);
  const gauche = useRef<THREE.Group>(null);
  const droite = useRef<THREE.Group>(null);
  const demi = b.largeur / 2;
  useFrame(() => {
    const t = THREE.MathUtils.smootherstep(progres.current, 0, 1);
    if (gauche.current) gauche.current.rotation.y = -t * 1.75;
    if (droite.current) droite.current.rotation.y = t * 1.75;
  });
  const battant = (
    <mesh material={BOIS} position={[demi / 2, 5, 0]} castShadow>
      <boxGeometry args={[demi - 0.1, 10, 0.5]} />
    </mesh>
  );
  return (
    <group position={[r.x, r.y, r.z]} rotation-y={r.rotation}>
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
      <group ref={gauche} position={[-demi, 0, 0]}>
        {battant}
      </group>
      <group ref={droite} position={[demi, 0, 0]} scale-x={-1}>
        {battant}
      </group>
      {!ouverte && <Bloqueur b={b} hauteur={30} />}
    </group>
  );
}

const DORE: [string, string] = ["#ffb847", "#ffeb99"];
const VIOLET: [string, string] = ["#8a4dff", "#e2b8ff"];

export function Barrieres() {
  return (
    <>
      {BARRIERES.map((b) => {
        switch (b.type) {
          case "tempete":
            return <Tempete key={b.id} b={b} />;
          case "brume":
            return <Voile key={b.id} b={b} teinte={DORE} />;
          case "sort":
            return <Voile key={b.id} b={b} teinte={VIOLET} />;
          case "givre":
            return <Givre key={b.id} b={b} />;
          case "porte":
            return <Porte key={b.id} b={b} />;
        }
      })}
    </>
  );
}
