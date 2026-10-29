import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { REGIONS, VILLAGES } from "../content/monde";
import { LEGER } from "../qualite";
import { ciel } from "../game/temps";
import { SOLEIL } from "./Atmosphere";
import { laCarte, MER, regionA, versMonde } from "./carte";
import { texturesSol } from "./couleurs";
import { lePlan } from "./plan";
import { distanceSegment, graine, hauteurTerrain } from "./relief";
import { placesVillages } from "./Terrain";
import { tracesAuSol } from "./zones";

// Un champ d'herbe autour du joueur : des brins fins qui ondulent au vent, dessinés en une seule fois.
// Ils sont posés sur une grille fixe du monde (un léger décalage pseudo-aléatoire par case) : quand
// le joueur avance, le champ se complète devant lui sans que les brins déjà là ne bougent.

/** Rayon du champ autour du joueur (m), écart entre deux brins (m), et distance avant de le recalculer (m). */
const RAYON = 42;
const ECART = 0.42;
const RECALCUL = 10;
const MAX_BRINS = Math.ceil((Math.PI * RAYON * RAYON) / (ECART * ECART));

/** Régions où l'herbe pousse (pas sur la neige, la cendre ni la pierre nue). */
const HERBEUSES = new Set(REGIONS.map((r, i) => (["foret-doree", "landes-roses", "foret-sombre", "rochers"].includes(r.vegetation) && r.id !== "glace" ? i : -1)));

/** Brin : une lame effilée en trois étages, de 0 à 1 en hauteur (la courbure suit la hauteur). */
function geometrieBrin() {
  const etages = [0, 0.4, 0.75, 1];
  const largeur = [0.07, 0.055, 0.03, 0];
  const pos: number[] = [];
  const idx: number[] = [];
  etages.forEach((y, k) => pos.push(-largeur[k], y, 0, largeur[k], y, 0));
  for (let k = 0; k < etages.length - 1; k++) {
    const [a, b, c, d] = [k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 3];
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Altitude du sol, mise en cache sur une grille de 2 m et interpolée : seules les nouvelles cases coûtent. */
const PAS_SOL = 2;
const cacheSol = new Map<number, number>();
function solNoeud(i: number, j: number) {
  const cle = i * 100003 + j;
  let h = cacheSol.get(cle);
  if (h === undefined) {
    h = hauteurTerrain(i * PAS_SOL, j * PAS_SOL);
    cacheSol.set(cle, h);
  }
  return h;
}
function solApproche(x: number, z: number) {
  const [fx, fz] = [x / PAS_SOL, z / PAS_SOL];
  const [i, j] = [Math.floor(fx), Math.floor(fz)];
  const [tx, tz] = [fx - i, fz - j];
  const a = solNoeud(i, j) * (1 - tx) + solNoeud(i + 1, j) * tx;
  const b = solNoeud(i, j + 1) * (1 - tx) + solNoeud(i + 1, j + 1) * tx;
  return { h: a * (1 - tz) + b * tz, pente: Math.max(Math.abs(solNoeud(i + 1, j) - solNoeud(i, j)), Math.abs(solNoeud(i, j + 1) - solNoeud(i, j))) / PAS_SOL };
}

/** Hachage d'une case de la grille : trois nombres pseudo-aléatoires stables entre 0 et 1. */
function hasardCase(i: number, j: number): [number, number, number] {
  let h = (i * 374761393 + j * 668265263) | 0;
  const suivant = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  return [suivant(), suivant(), suivant()];
}

function materiauHerbe() {
  const c = laCarte();
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uHerbe: { value: null },
        uTaille: { value: new THREE.Vector2(c.largeur * c.pas, c.hauteur * c.pas) },
        uTemps: { value: 0 },
        uCentre: { value: new THREE.Vector2() },
        uSoleil: { value: SOLEIL },
        uJour: { value: 1 },
      },
    ]),
    vertexShader: /* glsl */ `
      attribute vec4 aBrin; // x, y, z du pied, et la hauteur du brin
      attribute vec2 aForme; // angle, teinte
      uniform float uTemps;
      uniform vec2 uCentre;
      varying float vHaut;
      varying float vTeinte;
      varying vec3 vMonde;
      #include <fog_pars_vertex>
      void main() {
        float a = aForme.x;
        vec3 p = vec3(position.x * cos(a), position.y * aBrin.w, position.x * sin(a));
        // Le vent : une houle qui traverse le champ, plus forte en haut du brin.
        float houle = sin(uTemps * 1.4 + aBrin.x * 0.18 + aBrin.z * 0.11) + 0.4 * sin(uTemps * 3.1 + aBrin.x * 0.7);
        p.x += houle * 0.22 * position.y * position.y * aBrin.w;
        p.z += houle * 0.12 * position.y * position.y * aBrin.w;
        // Plus courts en bord de champ : pas de limite nette.
        float bord = 1.0 - smoothstep(${(RAYON * 0.7).toFixed(1)}, ${RAYON.toFixed(1)}, distance(aBrin.xz, uCentre));
        p.y *= bord;
        vec4 monde = vec4(aBrin.xyz + p, 1.0);
        vMonde = monde.xyz;
        vHaut = position.y;
        vTeinte = aForme.y;
        vec4 mvPosition = viewMatrix * monde;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uHerbe;
      uniform vec2 uTaille;
      uniform vec3 uSoleil;
      uniform float uJour;
      varying float vHaut;
      varying float vTeinte;
      varying vec3 vMonde;
      #include <fog_pars_fragment>
      void main() {
        vec3 herbe = texture2D(uHerbe, vMonde.xz / uTaille + 0.5).rgb;
        // Sombre au pied, clair et doré à la pointe, un peu de variété d'un brin à l'autre.
        vec3 c = mix(herbe * 0.55, herbe * 1.25 + vec3(0.06, 0.05, 0.0), vHaut);
        c *= 0.85 + 0.3 * vTeinte;
        c *= 0.75 + 0.35 * max(uSoleil.y, 0.0);
        // La nuit, l'herbe (qui n'est pas éclairée par la scène) s'assombrit et bleuit sous la lune.
        c = mix(c * vec3(0.16, 0.2, 0.3), c, uJour);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

/** Taches de sol nu entre les touffes (environ un tiers du sol). */
const bruitTouffes = createNoise2D(graine(83));

/** Où l'herbe ne pousse pas : places des villages, pied des maisons, potagers, décors (x, z, rayon), et cœurs de village. */
function sansHerbe() {
  const plan = lePlan();
  const libres: [number, number, number][] = [
    ...placesVillages().filter((p) => p.z > 0).map((p) => [p.x, p.y, p.z + 4] as [number, number, number]),
    ...plan.maisons.map((m) => [m.x, m.z, Math.max(m.l, m.p) / 2 + 2] as [number, number, number]),
    ...plan.jardins.map((j) => [j.x, j.z, 4.5] as [number, number, number]),
    ...plan.decors.filter((d) => d.def.solide).map((d) => [d.x, d.z, Math.max(d.def.solide![0], d.def.solide![2]) / 2 + 1] as [number, number, number]),
  ];
  const villages = VILLAGES.map((v) => [...versMonde(v.centre), v.rayon] as [number, number, number]);
  return { libres, villages };
}

export function Herbe() {
  const exclusions = useMemo(sansHerbe, []);
  const geometrie = useMemo(() => {
    const g = geometrieBrin();
    g.setAttribute("aBrin", new THREE.InstancedBufferAttribute(new Float32Array(MAX_BRINS * 4), 4));
    g.setAttribute("aForme", new THREE.InstancedBufferAttribute(new Float32Array(MAX_BRINS * 2), 2));
    g.instanceCount = 0;
    return g;
  }, []);
  const materiau = useMemo(() => {
    const m = materiauHerbe();
    m.uniforms.uHerbe.value = texturesSol().herbe;
    return m;
  }, []);
  const dernier = useRef<{ x: number; z: number } | null>(null);

  /** Pose les brins autour de (cx, cz). */
  const semer = (cx: number, cz: number) => {
    const brin = geometrie.getAttribute("aBrin") as THREE.InstancedBufferAttribute;
    const forme = geometrie.getAttribute("aForme") as THREE.InstancedBufferAttribute;
    // Seuls les chemins et remparts proches comptent.
    const traces = tracesAuSol().filter((t) => distanceSegment(cx, cz, ...t.s).d < RAYON + 10);
    const proches = exclusions.libres.filter(([lx, lz, lr]) => Math.hypot(lx - cx, lz - cz) < RAYON + lr);
    const [i0, i1] = [Math.floor((cx - RAYON) / ECART), Math.ceil((cx + RAYON) / ECART)];
    const [j0, j1] = [Math.floor((cz - RAYON) / ECART), Math.ceil((cz + RAYON) / ECART)];
    let n = 0;
    for (let i = i0; i <= i1 && n < MAX_BRINS; i++)
      for (let j = j0; j <= j1 && n < MAX_BRINS; j++) {
        const [h1, h2, h3] = hasardCase(i, j);
        const x = (i + h1) * ECART;
        const z = (j + h2) * ECART;
        if ((x - cx) ** 2 + (z - cz) ** 2 > RAYON * RAYON) continue;
        const r = regionA(x, z);
        if (r === MER || !HERBEUSES.has(r)) continue;
        const { h: y, pente } = solApproche(x, z);
        if (y < 1.4 || pente > 0.7) continue;
        if (traces.some((t) => distanceSegment(x, z, ...t.s).d < t.demi + 0.2)) continue;
        if (bruitTouffes(x / 7, z / 7) < -0.15) continue;
        if (proches.some(([lx, lz, lr]) => (lx - x) ** 2 + (lz - z) ** 2 < lr * lr)) continue;
        // Plus courte dans les villages (piétinée).
        const village = exclusions.villages.some(([vx, vz, vr]) => (vx - x) ** 2 + (vz - z) ** 2 < vr * vr);
        brin.setXYZW(n, x, y - 0.05, z, (0.18 + h3 * 0.42) * (village ? 0.5 : 1));
        forme.setXY(n, h1 * Math.PI * 2, h2);
        n++;
      }
    geometrie.instanceCount = n;
    brin.needsUpdate = forme.needsUpdate = true;
    materiau.uniforms.uCentre.value.set(cx, cz);
  };

  useFrame((state) => {
    materiau.uniforms.uTemps.value = state.clock.elapsedTime;
    materiau.uniforms.uJour.value = ciel.jour;
    const { x, z } = state.camera.position;
    const d = dernier.current;
    if (!d || Math.hypot(d.x - x, d.z - z) > RECALCUL) {
      dernier.current = { x, z };
      semer(x, z);
    }
  });

  if (LEGER) return null;
  // Dessinée après le reste, sans écrire la profondeur : pas de trait d'encre autour de chaque brin.
  return <mesh geometry={geometrie} material={materiau} frustumCulled={false} renderOrder={10} />;
}
