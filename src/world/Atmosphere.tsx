import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { REGIONS } from "../content/monde";
import { useJeu } from "../game/store";

/** Direction du soleil : assez bas pour une lumière dorée, assez haut pour des ombres nettes. */
export const SOLEIL = new THREE.Vector3(-0.55, 0.45, -0.8).normalize();

/** Demi-côté de la zone d'ombres autour du joueur, en m, et résolution de la carte d'ombres. */
const OMBRE = 75;
const RESOLUTION_OMBRE = 2048;
// Repère de la lumière : les ombres sont calées sur sa grille de texels (pas de scintillement en marchant).
const DROITE_SOLEIL = new THREE.Vector3(0, 1, 0).cross(SOLEIL).normalize();
const HAUT_SOLEIL = SOLEIL.clone().cross(DROITE_SOLEIL).normalize();
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
      uDirection: { value: SOLEIL.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uSoleil; uniform vec3 uDirection;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, h), 0.8));
        // Sous l'horizon : la couleur de la brume (on ne voit jamais de « trou » noir).
        c = mix(c, uHorizon, step(d.y, 0.0));
        float s = max(dot(d, normalize(uDirection)), 0.0);
        c += uSoleil * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.9 + pow(s, 900.0) * 3.0);
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

  useFrame((state, delta) => {
    const k = 1 - Math.exp(-delta * 0.8);
    brume.color.lerp(cible.brume, k);
    brume.density += (cible.densite - brume.density) * k;
    materiau.uniforms.uHorizon.value.copy(brume.color);
    materiau.uniforms.uZenith.value.lerp(cible.zenith, k);
    ambiance.current?.color.lerp(cible.ciel, k);
    ambiance.current?.groundColor.lerp(cible.sol, k);
    const cam = state.camera.position;
    ciel.current?.position.copy(cam);
    if (soleil.current) {
      soleil.current.color.lerp(cible.lumiere, k);
      materiau.uniforms.uSoleil.value.copy(soleil.current.color);
      // L'ombre suit le joueur : seule une zone autour de lui est calculée, calée sur la grille des texels.
      const d = Math.round(cam.dot(DROITE_SOLEIL) / BOND) * BOND;
      const h = Math.round(cam.dot(HAUT_SOLEIL) / BOND) * BOND;
      const p = Math.round(cam.dot(SOLEIL) / BOND) * BOND;
      const ombres = state.gl.shadowMap;
      ombres.autoUpdate = false;
      if (d !== dernierBond.current[0] || h !== dernierBond.current[1] || p !== dernierBond.current[2] || ++images.current % RAFRAICHIR === 0) {
        dernierBond.current = [d, h, p];
        ombres.needsUpdate = true;
      }
      cale.copy(DROITE_SOLEIL).multiplyScalar(d).addScaledVector(HAUT_SOLEIL, h).addScaledVector(SOLEIL, p);
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
