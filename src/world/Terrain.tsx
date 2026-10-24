import { useMemo } from "react";
import * as THREE from "three";
import { REGIONS } from "../content/monde";
import { bornes, MER, regionA } from "./carte";
import { hauteurTerrain, NIVEAU_MER } from "./relief";

/** Un sommet tous les 8 m environ. */
const PAS_MAILLAGE = 8;

const SABLE = new THREE.Color("#c9b98a");
const FOND = new THREE.Color("#3e4a44");
const NEIGE = new THREE.Color("#f4f6f8");

/** Sol du monde : maillage déformé par le relief, coloré selon la région, la pente et l'altitude. */
export function Terrain() {
  const geometrie = useMemo(() => {
    const { demiLargeur, demiHauteur } = bornes();
    const segX = Math.round((demiLargeur * 2) / PAS_MAILLAGE);
    const segZ = Math.round((demiHauteur * 2) / PAS_MAILLAGE);
    const g = new THREE.PlaneGeometry(demiLargeur * 2, demiHauteur * 2, segX, segZ);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, hauteurTerrain(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();

    const couleursRegions = REGIONS.map((r) => r.sol.map((c) => new THREE.Color(c)) as [THREE.Color, THREE.Color]);
    const couleurs = new Float32Array(pos.count * 3);
    const normales = g.attributes.normal as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const r = regionA(x, z);
      const pente = 1 - normales.getY(i);
      if (r === MER) {
        c.copy(y > NIVEAU_MER - 1.5 ? SABLE : FOND);
      } else {
        const [herbe, roche] = couleursRegions[r];
        // Variation douce pour casser l'uniformité.
        const tache = (Math.sin(x * 0.031) * Math.cos(z * 0.027) + Math.sin(x * 0.009 + z * 0.013)) * 0.035;
        c.copy(herbe).offsetHSL(0, 0, tache);
        c.lerp(roche, THREE.MathUtils.smoothstep(pente, 0.18, 0.42));
        if (y < NIVEAU_MER + 2.2) c.lerp(SABLE, 0.85);
        if (y > 160) c.lerp(NEIGE, THREE.MathUtils.smoothstep(y, 160, 210) * (1 - THREE.MathUtils.smoothstep(pente, 0.5, 0.75)));
      }
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

/** La mer : une grande surface légèrement transparente. */
export function Eau() {
  const { demiLargeur, demiHauteur } = bornes();
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={NIVEAU_MER}>
      <planeGeometry args={[demiLargeur * 2 + 4000, demiHauteur * 2 + 4000]} />
      <meshStandardMaterial color="#2f6170" transparent opacity={0.86} roughness={0.15} metalness={0.2} />
    </mesh>
  );
}
