import { useMemo } from "react";
import * as THREE from "three";
import { REGLAGES } from "../content/monde";
import { hauteurSol } from "./relief";

const TAILLE = (REGLAGES.rayonMonde + 120) * 2;
const SEGMENTS = 320;

// Palette « Entre-terre » : herbe dorée et olive, roche grise, terre brune.
const HERBE_CLAIRE = new THREE.Color("#a59a4e");
const HERBE_SOMBRE = new THREE.Color("#5f6a32");
const TERRE = new THREE.Color("#7a6243");
const ROCHE = new THREE.Color("#77736c");

/** Sol de l'île : maillage déformé par le relief, coloré selon la pente et l'altitude. */
export function Terrain() {
  const geometrie = useMemo(() => {
    const g = new THREE.PlaneGeometry(TAILLE, TAILLE, SEGMENTS, SEGMENTS);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, hauteurSol(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();

    const couleurs = new Float32Array(pos.count * 3);
    const normales = g.attributes.normal as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const pente = 1 - normales.getY(i);
      // Variation douce de l'herbe pour casser l'uniformité.
      const tache = (Math.sin(x * 0.045) * Math.cos(z * 0.038) + Math.sin(x * 0.011 + z * 0.017)) * 0.25 + 0.5;
      c.copy(HERBE_SOMBRE).lerp(HERBE_CLAIRE, tache);
      c.lerp(TERRE, THREE.MathUtils.smoothstep(pente, 0.08, 0.22) * 0.8);
      c.lerp(ROCHE, THREE.MathUtils.smoothstep(pente, 0.25, 0.45));
      couleurs.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(couleurs, 3));
    return g;
  }, []);

  return (
    <mesh geometry={geometrie} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}
