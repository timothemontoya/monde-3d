import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { lePlan } from "./plan";

// Fumée des cheminées et halos des lanternes : des disques flous dessinés en une seule fois
// (un nuage de points), quel que soit leur nombre.

/** Des disques flous de taille et d'opacité propres, dans la brume. */
function materiauDisques(couleur: string, additif: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCouleur: { value: new THREE.Color(couleur) }, uEchelle: { value: 400 } }]),
    vertexShader: /* glsl */ `
      attribute float aTaille;
      attribute float aAlpha;
      uniform float uEchelle;
      varying float vAlpha;
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aTaille * uEchelle / -mvPosition.z;
        vAlpha = aAlpha;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCouleur;
      varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(uCouleur, smoothstep(0.5, 0.0, d) * vAlpha);
        #include <fog_fragment>
      }`,
  });
}

/** Nuage de points : `n` disques, mis à jour par `animer` (positions, tailles, opacités). */
function useNuage(n: number, couleur: string, additif: boolean) {
  return useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aTaille", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1));
    const points = new THREE.Points(g, materiauDisques(couleur, additif));
    points.frustumCulled = false;
    return points;
  }, [n, couleur, additif]);
}

/** Taille des disques à l'écran : suit la hauteur de l'image et le champ de vision. */
function useEchelle(points: THREE.Points) {
  const { size, camera } = useThree();
  useFrame(() => {
    const projection = (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5];
    (points.material as THREE.ShaderMaterial).uniforms.uEchelle.value = (size.height / 2) * projection;
  });
}

/**
 * Sommet de la cheminée de chaque modèle de maison, dans son repère (m) : il découle de
 * l'assemblage des maisons dans scripts/preparer-pack.mjs (largeur, étages, toit).
 */
const CHEMINEES: Record<string, [number, number, number]> = {
  "maison-village-1": [3.66, 9.45, -1.35],
  "maison-village-2": [5.16, 9.45, -1.35],
  "maison-volcan-1": [3.66, 9.45, -1.35],
  "maison-volcan-2": [5.16, 6.45, -1.35],
  "maison-volcan-3": [2.16, 12.45, -1.35],
  "maison-vent-1": [2.16, 12.45, -1.35],
  "maison-vent-2": [3.66, 9.45, -1.35],
  "maison-vent-3": [2.16, 9.45, -1.35],
  "maison-atlante-1": [3.66, 5.85, -1.35],
  "maison-atlante-2": [2.16, 8.85, -1.35],
  "hutte-sorciere-2": [2.16, 5.85, -1.35],
  "cahute-maitre": [5.16, 8.85, -1.35],
  "demeure-volcan": [5.16, 9.45, -1.35],
};
/** Bouffées par cheminée, hauteur de montée (m) et durée d'une bouffée (s). */
const BOUFFEES = 5;
const MONTEE = 12;
const DUREE = 9;

/** Fumée qui monte lentement de chaque cheminée et dérive avec le vent. */
export function Fumees() {
  const cheminees = useMemo(() => {
    const plan = lePlan();
    const liste = [
      ...plan.maisons.map((m) => ({ modele: m.modele, x: m.x, y: m.y, z: m.z, rot: m.rot, e: 1 })),
      ...plan.decors.map((d) => ({ modele: d.def.modele, x: d.x, y: d.y, z: d.z, rot: d.rot, e: d.def.echelle ?? 1 })),
    ];
    return liste.flatMap((o) => {
      const c = CHEMINEES[o.modele];
      if (!c) return [];
      const [lx, ly, lz] = c.map((v) => v * o.e);
      const [s, co] = [Math.sin(o.rot), Math.cos(o.rot)];
      return [[o.x + lx * co + lz * s, o.y + ly, o.z - lx * s + lz * co]];
    });
  }, []);
  const points = useNuage(cheminees.length * BOUFFEES, "#cfc7ba", false);
  useEchelle(points);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = points.geometry;
    const [pos, taille, alpha] = ["position", "aTaille", "aAlpha"].map((a) => g.getAttribute(a) as THREE.BufferAttribute);
    cheminees.forEach(([x, y, z], i) => {
      for (let b = 0; b < BOUFFEES; b++) {
        const k = (t / DUREE + b / BOUFFEES + i * 0.137) % 1;
        const j = i * BOUFFEES + b;
        pos.setXYZ(j, x + k * k * 4 + Math.sin(t * 0.6 + i) * 0.4 * k, y + k * MONTEE, z + k * 1.5);
        taille.setX(j, 2 + k * 7);
        alpha.setX(j, Math.sin(Math.PI * Math.min(1, k * 1.4)) * 0.6);
      }
    });
    pos.needsUpdate = taille.needsUpdate = alpha.needsUpdate = true;
  });
  return <primitive object={points} />;
}


/** Hauteur du verre d'une lanterne au-dessus de son pied, en m. */
export const VERRE_LANTERNE = 2.25;

/**
 * Lueurs des décors qui éclairent : où se trouve la source au-dessus du pied (m, à l'échelle 1),
 * sa couleur et la taille du halo (m).
 */
export const LUEURS: Record<string, { hauteur: number; couleur: string; taille: number }> = {
  lanterne: { hauteur: VERRE_LANTERNE, couleur: "#ffb85a", taille: 1.6 },
  brasero: { hauteur: 0.9, couleur: "#ff7a2a", taille: 2.6 },
  "champignon-1": { hauteur: 0.55, couleur: "#b07aff", taille: 1.4 },
  "champignon-2": { hauteur: 0.5, couleur: "#b07aff", taille: 1.2 },
  chaudron: { hauteur: 1.1, couleur: "#7dff7a", taille: 2 },
  "monastere-glace": { hauteur: 9, couleur: "#7fd4ff", taille: 14 },
};

/** Halo autour des sources de lumière : une lueur douce, que le bloom fait briller. */
export function Halos({ positions, couleur = "#ffb85a", taille = 1.6 }: { positions: [number, number, number][]; couleur?: string; taille?: number }) {
  const points = useNuage(positions.length, couleur, true);
  useEchelle(points);
  useEffect(() => {
    const g = points.geometry;
    positions.forEach(([x, y, z], i) => {
      g.getAttribute("position").setXYZ(i, x, y, z);
      g.getAttribute("aTaille").setX(i, taille);
      g.getAttribute("aAlpha").setX(i, 0.9);
    });
    for (const a of ["position", "aTaille", "aAlpha"]) g.getAttribute(a).needsUpdate = true;
  }, [points, positions, taille]);
  return <primitive object={points} />;
}
