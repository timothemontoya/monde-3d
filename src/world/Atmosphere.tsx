import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { REGIONS } from "../content/monde";
import { useJeu } from "../game/store";

/** Direction du soleil : bas sur l'horizon, lumière rasante et dorée. */
export const SOLEIL = new THREE.Vector3(-0.55, 0.1, -0.8).normalize();

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
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const soleil = useRef<THREE.DirectionalLight>(null);
  const ciel = useRef<THREE.Mesh>(null);
  const zone = useJeu((s) => s.regionActuelle);
  const materiau = useMemo(() => materiauCiel(), []);

  const brume = useMemo(() => {
    const f = new THREE.FogExp2(AMBIANCE_HORS_ZONE.brume, AMBIANCE_HORS_ZONE.densite);
    scene.fog = f;
    return f;
  }, [scene]);

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
      // L'ombre suit le joueur : seule une zone autour de lui est calculée.
      soleil.current.position.set(cam.x + SOLEIL.x * 200, cam.y + SOLEIL.y * 200, cam.z + SOLEIL.z * 200);
      soleil.current.target.position.set(cam.x, cam.y, cam.z);
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
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-far={500}
        shadow-bias={-0.0004}
      />
    </>
  );
}
