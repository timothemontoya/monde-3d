import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { REGIONS, VILLAGES } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { beler } from "../game/son";
import { useJeu } from "../game/store";
import { ciel } from "../game/temps";
import { LEGER } from "../qualite";
import { laCarte, MER, regionA, versMonde } from "./carte";
import { cheminEn } from "./Chemins";
import { graine, hauteurSol, NIVEAU_MER, pente } from "./relief";

// La vie du monde : des moutons qui broutent dans les prés, des lucioles la nuit, des feuilles
// qui tombent dans les forêts. Tout est dessiné en une fois, et seulement près du joueur.

// ─── Moutons ────────────────────────────────────────────────────────────────

/** Régions de prés, nombre de troupeaux, moutons par troupeau (au plus) et distance de vue (m). */
const PRES = new Set(["terres-libres", "landes-roses", "village-blanc", "montagne-vent", "elcres"]);
const TROUPEAUX = 26;
const PAR_TROUPEAU = 9;
const VUE_MOUTONS = LEGER ? 220 : 380;

type Mouton = { x: number; z: number; cap: number; cible: [number, number]; pause: number; vitesse: number; broute: number };
type Troupeau = { x: number; z: number; rayon: number; moutons: Mouton[] };

/** Un pré : sur la terre ferme, peu pentu, loin des villages et des chemins. */
function pre(x: number, z: number) {
  const r = regionA(x, z);
  if (r === MER || !PRES.has(REGIONS[r]?.id)) return false;
  if (hauteurSol(x, z) < NIVEAU_MER + 1.5 || pente(x, z) > 0.35 || cheminEn(x, z) > 0.1) return false;
  return VILLAGES.every((v) => {
    const [vx, vz] = versMonde(v.centre);
    return Math.hypot(vx - x, vz - z) > v.rayon * 1.5 + 25;
  });
}

function lesTroupeaux(): Troupeau[] {
  const c = laCarte();
  const hasard = graine(777);
  const troupeaux: Troupeau[] = [];
  for (let essai = 0; troupeaux.length < TROUPEAUX && essai < 6000; essai++) {
    const x = (hasard() - 0.5) * c.largeur * c.pas;
    const z = (hasard() - 0.5) * c.hauteur * c.pas;
    if (!pre(x, z) || troupeaux.some((t) => Math.hypot(t.x - x, t.z - z) < 140)) continue;
    const n = 4 + Math.floor(hasard() * (PAR_TROUPEAU - 3));
    const moutons: Mouton[] = [];
    for (let i = 0; i < n; i++) {
      const [mx, mz] = [x + (hasard() - 0.5) * 16, z + (hasard() - 0.5) * 16];
      moutons.push({ x: mx, z: mz, cap: hasard() * 6.28, cible: [mx, mz], pause: hasard() * 6, vitesse: 0.7 + hasard() * 0.5, broute: hasard() * 6 });
    }
    troupeaux.push({ x, z, rayon: 14 + hasard() * 10, moutons });
  }
  return troupeaux;
}

/** Un mouton : un corps de laine, une tête et quatre pattes sombres (couleurs par sommet), vers +X. */
function geometrieMouton() {
  const piece = (l: number, h: number, p: number, x: number, y: number, z: number, couleur: string) => {
    const g = new THREE.BoxGeometry(l, h, p).toNonIndexed();
    g.translate(x, y, z);
    const c = new THREE.Color(couleur);
    g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: g.getAttribute("position").count }, () => [c.r, c.g, c.b]).flat(), 3));
    return g;
  };
  const sombre = "#2e2724";
  return mergeGeometries([
    piece(1.3, 0.8, 0.85, 0, 0.85, 0, "#ece5d6"),
    piece(0.5, 0.5, 0.45, 0.8, 1.05, 0, sombre),
    piece(0.18, 0.12, 0.12, 0.75, 1.25, 0.28, sombre),
    piece(0.18, 0.12, 0.12, 0.75, 1.25, -0.28, sombre),
    ...[[-0.4, -0.25], [-0.4, 0.25], [0.4, -0.25], [0.4, 0.25]].map(([x, z]) => piece(0.16, 0.5, 0.16, x, 0.25, z, sombre)),
  ])!;
}

function Moutons() {
  const troupeaux = useMemo(lesTroupeaux, []);
  const maillage = useMemo(() => {
    const m = new THREE.InstancedMesh(geometrieMouton(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), TROUPEAUX * PAR_TROUPEAU);
    m.castShadow = true;
    m.frustumCulled = false;
    m.count = 0;
    return m;
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const hasard = useMemo(() => graine(99), []);
  const prochainBelement = useRef(5);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    let i = 0;
    let proche = Infinity;
    for (const tr of troupeaux) {
      const d = Math.hypot(tr.x - positionJoueur.x, tr.z - positionJoueur.z);
      if (d > VUE_MOUTONS) continue;
      proche = Math.min(proche, d);
      for (const m of tr.moutons) {
        // Broute sur place, puis fait quelques pas vers un autre coin du pré ; fuit le joueur trop proche.
        const fuite = Math.hypot(m.x - positionJoueur.x, m.z - positionJoueur.z);
        if (fuite < 6) {
          const f = Math.max(fuite, 0.01);
          m.cible = [m.x + ((m.x - positionJoueur.x) / f) * 8, m.z + ((m.z - positionJoueur.z) / f) * 8];
          // Sans s'éloigner du troupeau au-delà de son pré.
          const [ex, ez] = [m.cible[0] - tr.x, m.cible[1] - tr.z];
          const loin = Math.hypot(ex, ez);
          if (loin > tr.rayon + 10) m.cible = [tr.x + (ex / loin) * (tr.rayon + 10), tr.z + (ez / loin) * (tr.rayon + 10)];
          m.pause = 0;
        }
        const [dx, dz] = [m.cible[0] - m.x, m.cible[1] - m.z];
        const reste = Math.hypot(dx, dz);
        let marche = false;
        if (m.pause > 0) m.pause -= dt;
        else if (reste > 0.3) {
          const v = (fuite < 6 ? 3.5 : m.vitesse) * dt;
          const voulu = Math.atan2(dz, dx);
          m.cap += Math.atan2(Math.sin(voulu - m.cap), Math.cos(voulu - m.cap)) * Math.min(1, dt * 4);
          const [nx, nz] = [m.x + Math.cos(m.cap) * v, m.z + Math.sin(m.cap) * v];
          // Ils restent dans les prés : ni l'eau, ni les chemins, ni les villages, ni les pentes raides.
          if (pre(nx, nz)) [m.x, m.z] = [nx, nz];
          else m.cible = [m.x, m.z];
          marche = true;
        } else {
          m.pause = 3 + hasard() * 9;
          const a = hasard() * 6.28;
          const r = hasard() * tr.rayon;
          m.cible = [tr.x + Math.cos(a) * r, tr.z + Math.sin(a) * r];
        }
        const sautille = marche ? Math.abs(Math.sin(t * 9 + m.broute)) * 0.08 : 0;
        // Tête baissée pour brouter (le mouton bascule un peu vers l'avant).
        const baisse = marche ? 0 : 0.12 + 0.05 * Math.sin(t * 1.3 + m.broute);
        o.position.set(m.x, hauteurSol(m.x, m.z) - 0.05 + sautille, m.z);
        o.rotation.set(0, -m.cap, -baisse);
        o.scale.setScalar(1);
        o.updateMatrix();
        maillage.setMatrixAt(i++, o.matrix);
      }
    }
    maillage.count = i;
    maillage.instanceMatrix.needsUpdate = true;
    // De temps en temps, un bêlement, d'autant plus fort que le troupeau est proche.
    if (proche < 60 && t > prochainBelement.current && useJeu.getState().enJeu) {
      prochainBelement.current = t + 4 + hasard() * 10;
      beler(proche);
    }
  });
  return <primitive object={maillage} />;
}

// ─── Lucioles et feuilles ───────────────────────────────────────────────────

/** Des points lumineux ou colorés autour du joueur, dans une boîte qui le suit (les points s'y enroulent). */
function materiauPoints(additif: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexColors: true,
    blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTaille: { value: 1 }, uAlpha: { value: 1 }, uEchelle: { value: 400 } }]),
    vertexShader: /* glsl */ `
      uniform float uTaille, uEchelle;
      attribute float aAlpha;
      varying vec3 vCouleur;
      varying float vAlpha;
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uTaille * uEchelle / -mvPosition.z;
        vCouleur = color;
        vAlpha = aAlpha;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying vec3 vCouleur;
      varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vCouleur, smoothstep(0.5, 0.15, d) * uAlpha * vAlpha);
        #include <fog_fragment>
      }`,
  });
}

/** Où il y a des lucioles la nuit (pas dans le Bois perdu : la fiole y guide déjà par des lueurs). */
const LUCIOLES = new Set(["terres-libres", "village-blanc", "foret-sorcieres", "landes-roses", "elcres", "atlantes", "plage-oclene", "ile-oclene"]);
/** Où des feuilles tombent le jour, et leurs couleurs. */
const FEUILLES: Record<string, string[]> = {
  "village-blanc": ["#e2b54e", "#c98a2e", "#e9c45c"],
  "terres-libres": ["#e2b54e", "#c98a2e", "#d9a040"],
  "landes-roses": ["#f2b8cf", "#e89ab8", "#fbd3e0"],
  atlantes: ["#5f9a3a", "#7fae4a"],
};

function Particules({ nombre, boite, taille, additif, mouvement, regions, quand }: {
  nombre: number;
  /** Demi-côté (m) et hauteur (min, max au-dessus du sol) de la boîte autour du joueur. */
  boite: [number, number, number];
  taille: number;
  additif: boolean;
  /** Position (décalage dans la boîte) et opacité de la particule i à l'instant t. */
  mouvement: (i: number, t: number, base: [number, number, number]) => [number, number, number, number];
  /** Couleurs par région (une liste vide : pas de particules ici). */
  regions: Record<string, string[]>;
  quand: () => number;
}) {
  const { points, bases } = useMemo(() => {
    const h = graine(nombre * 31);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nombre * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(nombre * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(nombre), 1));
    const p = new THREE.Points(g, materiauPoints(additif));
    p.frustumCulled = false;
    const bases = Array.from({ length: nombre }, () => [(h() - 0.5) * 2 * boite[0], boite[1] + h() * (boite[2] - boite[1]), (h() - 0.5) * 2 * boite[0]] as [number, number, number]);
    return { points: p, bases };
  }, [nombre, boite, additif]);
  const region = useRef<string | null>(null);
  const couleur = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const m = points.material as THREE.ShaderMaterial;
    m.uniforms.uEchelle.value = (state.size.height / 2) * state.camera.projectionMatrix.elements[5];
    m.uniforms.uTaille.value = taille;
    const r = useJeu.getState().regionActuelle;
    const teintes = (r && regions[r]) || [];
    const force = teintes.length ? quand() : 0;
    m.uniforms.uAlpha.value += (force - m.uniforms.uAlpha.value) * 0.03;
    points.visible = m.uniforms.uAlpha.value > 0.01;
    if (!points.visible) return;
    const g = points.geometry;
    const [pos, col, alpha] = ["position", "color", "aAlpha"].map((a) => g.getAttribute(a) as THREE.BufferAttribute);
    const recolorer = r !== region.current && teintes.length > 0;
    if (recolorer) region.current = r;
    const cote = boite[0] * 2;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < bases.length; i++) {
      const [dx, y, dz, a] = mouvement(i, t, bases[i]);
      // La boîte suit le joueur : chaque particule reste dans la boîte en s'y enroulant.
      const x = positionJoueur.x + THREE.MathUtils.euclideanModulo(dx - positionJoueur.x + boite[0], cote) - boite[0];
      const z = positionJoueur.z + THREE.MathUtils.euclideanModulo(dz - positionJoueur.z + boite[0], cote) - boite[0];
      pos.setXYZ(i, x, Math.max(hauteurSol(x, z), NIVEAU_MER) + y, z);
      alpha.setX(i, a);
      if (recolorer) {
        couleur.set(teintes[i % teintes.length]);
        col.setXYZ(i, couleur.r, couleur.g, couleur.b);
      }
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
    if (recolorer) col.needsUpdate = true;
  });
  return <primitive object={points} />;
}

const BOITE_LUCIOLES: [number, number, number] = [45, 0.4, 3.5];
const BOITE_FEUILLES: [number, number, number] = [35, 0, 14];
const COULEURS_LUCIOLES = Object.fromEntries([...LUCIOLES].map((r) => [r, ["#d8ff7a", "#f6ffb0", "#b8f060"]]));

function Lucioles() {
  return (
    <Particules
      nombre={LEGER ? 90 : 180}
      boite={BOITE_LUCIOLES}
      taille={0.35}
      additif
      regions={COULEURS_LUCIOLES}
      quand={() => THREE.MathUtils.smoothstep(1 - ciel.jour, 0.5, 0.9)}
      mouvement={(i, t, [x, y, z]) => [
        x + Math.sin(t * 0.3 + i) * 3,
        y + Math.sin(t * 0.8 + i * 1.3) * 0.6,
        z + Math.cos(t * 0.25 + i * 0.7) * 3,
        // Chacune s'allume et s'éteint à son rythme.
        Math.max(0, Math.sin(t * (0.8 + (i % 7) * 0.15) + i * 2.1)) ** 2,
      ]}
    />
  );
}

function Feuilles() {
  return (
    <Particules
      nombre={LEGER ? 70 : 140}
      boite={BOITE_FEUILLES}
      taille={0.28}
      additif={false}
      regions={FEUILLES}
      quand={() => ciel.jour}
      mouvement={(i, t, [x, y, z]) => {
        // Chute lente en tourbillonnant, puis on recommence en haut (et un peu plus loin).
        const k = (t * (0.05 + (i % 5) * 0.01) + i * 0.137) % 1;
        const cycle = Math.floor(t * (0.05 + (i % 5) * 0.01) + i * 0.137);
        return [x + cycle * 7.3 + Math.sin(t * 1.5 + i) * 1.2 + k * 6, y * (1 - k), z + cycle * 3.1 + Math.cos(t * 1.2 + i) * 1.2, Math.min(1, (1 - k) * 4) * Math.min(1, k * 8)];
      }}
    />
  );
}

export function Faune() {
  return (
    <>
      <Moutons />
      <Lucioles />
      <Feuilles />
    </>
  );
}
