import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { REGIONS } from "../content/monde";
import { useJeu } from "../game/store";
import { ciel as temps } from "../game/temps";

/**
 * Direction de la lumière (le soleil le jour, la lune la nuit), qui tourne avec les heures :
 * un seul vecteur partagé, que le sol et l'herbe lisent directement.
 */
export const SOLEIL = new THREE.Vector3(-0.55, 0.45, -0.8).normalize();
/** Direction et couleur de l'astre visible (le disque dans le ciel). */
export const ASTRE = SOLEIL.clone();
export const COULEUR_ASTRE = new THREE.Color("#ffe2b0");

const PARAMS = new URLSearchParams(window.location.search);
/** Durée d'une journée (s) ; la nuit passe deux fois plus vite. `?heure=21` : l'heure de départ ; `?figee` : elle ne bouge pas. */
const DUREE_JOUR = 24 * 60;
const HEURE_DEPART = Number(PARAMS.get("heure") ?? 9.5);
const FIGEE = PARAMS.has("figee");
/** Le soleil ne bouge que par petits pas (la carte d'ombres est alors recalculée), toutes les … s. */
const PAS_SOLEIL = 2;
/** Hauteur du soleil à midi, et de la lune à minuit (radians). */
const HAUT_MIDI = 0.7;
const HAUT_MINUIT = 0.75;

/** Direction d'un astre à l'heure h : lever à l'est (6 h), coucher à l'ouest (18 h), au nord à midi. */
function direction(h: number, haut: number, v: THREE.Vector3) {
  const phi = (Math.PI * (h - 6)) / 12;
  const el = haut * Math.sin(phi);
  return v.set(Math.cos(phi) * Math.cos(el), Math.sin(el), -Math.sin(phi) * Math.cos(el) - 0.25).normalize();
}

const NUIT = { brume: new THREE.Color("#1a2440"), ciel: new THREE.Color("#5568a0"), sol: new THREE.Color("#1f2433"), zenith: new THREE.Color("#060a17"), lune: new THREE.Color("#a8c0f0"), disque: new THREE.Color("#c8d4f0") };
const CREPUSCULE = { lumiere: new THREE.Color("#ff8442"), brume: new THREE.Color("#d97a52"), zenith: new THREE.Color("#3d3a6b") };

/** Demi-côté de la zone d'ombres autour du joueur, en m, et résolution de la carte d'ombres. */
const OMBRE = 75;
const RESOLUTION_OMBRE = 2048;
// Repère de la lumière : les ombres sont calées sur sa grille de texels (pas de scintillement en marchant).
const DROITE_SOLEIL = new THREE.Vector3(0, 1, 0).cross(SOLEIL).normalize();
const HAUT_SOLEIL = SOLEIL.clone().cross(DROITE_SOLEIL).normalize();
function reorienter() {
  DROITE_SOLEIL.set(0, 1, 0).cross(SOLEIL).normalize();
  HAUT_SOLEIL.copy(SOLEIL).cross(DROITE_SOLEIL).normalize();
}
const TEXEL = (OMBRE * 2) / RESOLUTION_OMBRE;
/**
 * La zone d'ombre avance par bonds de ~10 m (un nombre entier de texels) : la carte d'ombres n'est
 * recalculée qu'à chaque bond (le décor ne bouge pas), et de temps en temps pour ce qui bouge.
 */
const BOND = Math.round(10 / TEXEL) * TEXEL;
const RAFRAICHIR = 30;

/** Ambiance en mer et hors des régions. */
const AMBIANCE_HORS_ZONE = { brume: "#c9b796", densite: 0.0016, lumiere: "#ffd49a", ciel: "#ffe2b8", sol: "#5a5038" };

/** Couleur du haut du ciel. */
const ZENITH = new THREE.Color("#5b7393");

/**
 * Ciel en dégradé : l'horizon prend la couleur de la brume (le paysage s'y fond sans couture),
 * le zénith est plus sombre, et un halo chaud entoure le soleil.
 * La sphère suit la caméra et reste en deçà de sa limite de vision.
 */
function materiauCiel() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(AMBIANCE_HORS_ZONE.brume) },
      uZenith: { value: ZENITH.clone() },
      uSoleil: { value: new THREE.Color(AMBIANCE_HORS_ZONE.lumiere) },
      uDirection: { value: ASTRE },
      uNuit: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uSoleil; uniform vec3 uDirection; uniform float uNuit;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, h), 0.8));
        // Sous l'horizon : la couleur de la brume (on ne voit jamais de « trou » noir).
        c = mix(c, uHorizon, step(d.y, 0.0));
        float s = max(dot(d, normalize(uDirection)), 0.0);
        c += uSoleil * (pow(s, 6.0) * 0.5 + pow(s, 64.0) * 0.9 + pow(s, 900.0) * 3.0) * (1.0 - 0.75 * uNuit);
        // La nuit, des étoiles : quelques cases de la voûte, qui scintillent à peine.
        vec3 g = floor(d * 320.0);
        float e = fract(sin(dot(g, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 teinte = mix(vec3(0.81, 0.88, 1.0), vec3(1.0, 0.9, 0.75), fract(e * 53.1));
        c += teinte * smoothstep(0.997, 1.0, e) * smoothstep(0.02, 0.25, d.y) * uNuit * (0.7 + 0.8 * fract(e * 91.7));
        // Une lueur bleutée au ras de l'horizon : les collines s'y découpent.
        c += vec3(0.13, 0.19, 0.33) * uNuit * (1.0 - smoothstep(0.0, 0.26, d.y)) * step(0.0, d.y);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Ciel, soleil et brume. L'ambiance (couleur et densité de la brume, teinte du soleil)
 * glisse doucement vers celle de la région où se trouve le joueur.
 */
export function Atmosphere({ sansBrume = false }: { sansBrume?: boolean }) {
  const scene = useThree((s) => s.scene);
  const soleil = useRef<THREE.DirectionalLight>(null);
  const ambiance = useRef<THREE.HemisphereLight>(null);
  const ciel = useRef<THREE.Mesh>(null);
  const zone = useJeu((s) => s.regionActuelle);
  const materiau = useMemo(() => materiauCiel(), []);
  const cale = useMemo(() => new THREE.Vector3(), []);
  const dernierBond = useRef([NaN, NaN, NaN]);
  const images = useRef(0);
  const heure = useRef(HEURE_DEPART);
  const pasSoleil = useRef(-1);
  const astres = useMemo(() => ({ soleil: new THREE.Vector3(), lune: new THREE.Vector3(), c: new THREE.Color() }), []);

  const brume = useMemo(() => new THREE.FogExp2(AMBIANCE_HORS_ZONE.brume, AMBIANCE_HORS_ZONE.densite), []);
  // La scène doit garder CE brouillard-là (celui que l'on fait varier) : pas d'effet de bord dans useMemo,
  // que React peut appeler deux fois.
  useEffect(() => {
    scene.fog = sansBrume ? null : brume;
    return () => {
      scene.fog = null;
    };
  }, [scene, brume, sansBrume]);

  const cible = useMemo(() => {
    const a = REGIONS.find((r) => r.id === zone)?.ambiance ?? AMBIANCE_HORS_ZONE;
    return {
      brume: new THREE.Color(a.brume),
      densite: a.densite,
      lumiere: new THREE.Color(a.lumiere),
      ciel: new THREE.Color(a.ciel ?? AMBIANCE_HORS_ZONE.ciel),
      sol: new THREE.Color(a.sol ?? AMBIANCE_HORS_ZONE.sol),
      zenith: new THREE.Color(("zenith" in a && a.zenith) || ZENITH),
    };
  }, [zone]);

  // Couleurs de la région, avant l'heure (qui les assombrit ou les rougit).
  const region = useMemo(() => ({ brume: cible.brume.clone(), ciel: cible.ciel.clone(), sol: cible.sol.clone(), zenith: cible.zenith.clone(), lumiere: cible.lumiere.clone() }), []);

  useFrame((state, delta) => {
    const k = 1 - Math.exp(-delta * 0.8);
    // L'heure : la nuit passe deux fois plus vite que le jour.
    if (!FIGEE) heure.current = (heure.current + (delta * 24 * (temps.jour > 0.5 ? 1 : 2)) / DUREE_JOUR) % 24;
    const h = heure.current;
    direction(h, HAUT_MIDI, astres.soleil);
    direction(h + 12, HAUT_MINUIT, astres.lune);
    const jour = THREE.MathUtils.smoothstep(astres.soleil.y, -0.1, 0.12);
    const crepuscule = (1 - THREE.MathUtils.smoothstep(Math.abs(astres.soleil.y - 0.02), 0, 0.28)) * 0.85;
    Object.assign(temps, { heure: h, jour, crepuscule });
    // La lumière vient du soleil, ou de la lune quand il est couché ; elle avance par petits pas.
    const n = Math.floor(state.clock.elapsedTime / PAS_SOLEIL);
    let tourne = false;
    if (n !== pasSoleil.current) {
      pasSoleil.current = n;
      SOLEIL.copy(astres.soleil.y > -0.02 ? astres.soleil : astres.lune);
      if (SOLEIL.y < 0.08) SOLEIL.y = 0.08;
      SOLEIL.normalize();
      reorienter();
      tourne = true;
    }
    ASTRE.copy(jour > 0.5 ? astres.soleil : astres.lune);

    region.brume.lerp(cible.brume, k);
    region.ciel.lerp(cible.ciel, k);
    region.sol.lerp(cible.sol, k);
    region.zenith.lerp(cible.zenith, k);
    region.lumiere.lerp(cible.lumiere, k);
    // Au crépuscule, la brume s'éclaircit un peu : on garde la profondeur du paysage.
    brume.density += (cible.densite * (1 - 0.25 * crepuscule) - brume.density) * k;
    const nuit = 1 - jour;
    brume.color.copy(region.brume).lerp(CREPUSCULE.brume, crepuscule * 0.2).lerp(NUIT.brume, nuit * 0.9);
    materiau.uniforms.uHorizon.value.copy(brume.color);
    materiau.uniforms.uZenith.value.copy(region.zenith).lerp(CREPUSCULE.zenith, crepuscule * 0.7).lerp(NUIT.zenith, nuit);
    materiau.uniforms.uNuit.value = nuit;
    if (ambiance.current) {
      ambiance.current.color.copy(region.ciel).lerp(NUIT.ciel, nuit);
      ambiance.current.groundColor.copy(region.sol).lerp(NUIT.sol, nuit);
      ambiance.current.intensity = 1.15 * (0.5 + 0.5 * jour);
    }
    const cam = state.camera.position;
    ciel.current?.position.copy(cam);
    if (soleil.current) {
      const lumiereSoleil = astres.c.copy(region.lumiere).lerp(CREPUSCULE.lumiere, crepuscule);
      const fort = THREE.MathUtils.smoothstep(astres.soleil.y, -0.02, 0.15);
      const lune = THREE.MathUtils.smoothstep(astres.lune.y, -0.02, 0.15) * nuit;
      soleil.current.color.copy(fort > 0.01 ? lumiereSoleil : NUIT.lune);
      soleil.current.intensity = fort > 0.01 ? 3.2 * fort : 1.6 * lune;
      COULEUR_ASTRE.copy(jour > 0.5 ? lumiereSoleil : NUIT.disque);
      materiau.uniforms.uSoleil.value.copy(COULEUR_ASTRE);
      // L'ombre suit le joueur : seule une zone autour de lui est calculée, calée sur la grille des texels.
      const d = Math.round(cam.dot(DROITE_SOLEIL) / BOND) * BOND;
      const hb = Math.round(cam.dot(HAUT_SOLEIL) / BOND) * BOND;
      const p = Math.round(cam.dot(SOLEIL) / BOND) * BOND;
      const ombres = state.gl.shadowMap;
      ombres.autoUpdate = false;
      if (tourne || d !== dernierBond.current[0] || hb !== dernierBond.current[1] || p !== dernierBond.current[2] || ++images.current % RAFRAICHIR === 0) {
        dernierBond.current = [d, hb, p];
        ombres.needsUpdate = true;
      }
      cale.copy(DROITE_SOLEIL).multiplyScalar(d).addScaledVector(HAUT_SOLEIL, hb).addScaledVector(SOLEIL, p);
      soleil.current.position.copy(cale).addScaledVector(SOLEIL, 300);
      soleil.current.target.position.copy(cale);
      soleil.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <mesh ref={ciel} material={materiau} renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[4000, 32, 16]} />
      </mesh>
      <hemisphereLight ref={ambiance} args={[AMBIANCE_HORS_ZONE.ciel, AMBIANCE_HORS_ZONE.sol, 1.15]} />
      <directionalLight
        ref={soleil}
        intensity={3.2}
        color={AMBIANCE_HORS_ZONE.lumiere}
        castShadow
        shadow-mapSize={[RESOLUTION_OMBRE, RESOLUTION_OMBRE]}
        shadow-camera-left={-OMBRE}
        shadow-camera-right={OMBRE}
        shadow-camera-top={OMBRE}
        shadow-camera-bottom={-OMBRE}
        shadow-camera-near={1}
        shadow-camera-far={700}
        shadow-bias={-0.0002}
        shadow-normalBias={0.05}
      />
    </>
  );
}
