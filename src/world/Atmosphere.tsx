import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
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

/** Ambiance en mer et hors des régions. */
const AMBIANCE_HORS_ZONE = { brume: "#c9b796", densite: 0.0016, lumiere: "#ffd49a" };

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
  const ciel = useRef<THREE.Mesh>(null);
  const zone = useJeu((s) => s.regionActuelle);
  const materiau = useMemo(() => materiauCiel(), []);
  const cale = useMemo(() => new THREE.Vector3(), []);

  const brume = useMemo(() => {
    const f = new THREE.FogExp2(AMBIANCE_HORS_ZONE.brume, AMBIANCE_HORS_ZONE.densite);
    scene.fog = sansBrume ? null : f;
    return f;
  }, [scene, sansBrume]);

  const cible = useMemo(() => {
    const a = REGIONS.find((r) => r.id === zone)?.ambiance ?? AMBIANCE_HORS_ZONE;
    return { brume: new THREE.Color(a.brume), densite: a.densite, lumiere: new THREE.Color(a.lumiere) };
  }, [zone]);

  useFrame((state, delta) => {
    const k = 1 - Math.exp(-delta * 0.8);
    brume.color.lerp(cible.brume, k);
    brume.density += (cible.densite - brume.density) * k;
    materiau.uniforms.uHorizon.value.copy(brume.color);
    const cam = state.camera.position;
    ciel.current?.position.copy(cam);
    if (soleil.current) {
      soleil.current.color.lerp(cible.lumiere, k);
      materiau.uniforms.uSoleil.value.copy(soleil.current.color);
      // L'ombre suit le joueur : seule une zone autour de lui est calculée, calée sur la grille des texels.
      const d = Math.round(cam.dot(DROITE_SOLEIL) / TEXEL) * TEXEL;
      const h = Math.round(cam.dot(HAUT_SOLEIL) / TEXEL) * TEXEL;
      cale.copy(DROITE_SOLEIL).multiplyScalar(d).addScaledVector(HAUT_SOLEIL, h).addScaledVector(SOLEIL, cam.dot(SOLEIL));
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
      <hemisphereLight args={["#ffe2b8", "#5a5038", 1.15]} />
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
