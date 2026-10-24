import { Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../content/monde";
import { useJeu } from "../game/store";

/** Direction du soleil : bas sur l'horizon, lumière rasante et dorée. */
export const SOLEIL = new THREE.Vector3(-0.55, 0.1, -0.8).normalize();

const AMBIANCE_HORS_ZONE = { brume: "#c9ad86", densite: 0.0048, lumiere: "#ffd49a" };

/**
 * Ciel, soleil et brume. L'ambiance (couleur et densité de la brume, teinte du soleil)
 * glisse doucement vers celle de la zone où se trouve le joueur.
 */
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const soleil = useRef<THREE.DirectionalLight>(null);
  const zone = useJeu((s) => s.zoneActuelle);

  const brume = useMemo(() => {
    const f = new THREE.FogExp2(AMBIANCE_HORS_ZONE.brume, AMBIANCE_HORS_ZONE.densite);
    scene.fog = f;
    return f;
  }, [scene]);

  const cible = useMemo(() => {
    const a = ZONES.find((z) => z.id === zone)?.ambiance ?? AMBIANCE_HORS_ZONE;
    return { brume: new THREE.Color(a.brume), densite: a.densite, lumiere: new THREE.Color(a.lumiere) };
  }, [zone]);

  useFrame((state, delta) => {
    const k = 1 - Math.exp(-delta * 0.8);
    brume.color.lerp(cible.brume, k);
    brume.density += (cible.densite - brume.density) * k;
    if (soleil.current) {
      soleil.current.color.lerp(cible.lumiere, k);
      // L'ombre suit le joueur : seule une zone autour de lui est calculée.
      const cam = state.camera.position;
      soleil.current.position.set(cam.x + SOLEIL.x * 200, cam.y + SOLEIL.y * 200, cam.z + SOLEIL.z * 200);
      soleil.current.target.position.set(cam.x, cam.y, cam.z);
      soleil.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <Sky
        distance={4000}
        sunPosition={SOLEIL.clone().multiplyScalar(100).toArray()}
        turbidity={12}
        rayleigh={3.2}
        mieCoefficient={0.02}
        mieDirectionalG={0.9}
      />
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
