import { KeyboardControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { Joueur, TOUCHES } from "./player/Joueur";
import { Interface } from "./ui/Interface";
import { Atmosphere } from "./world/Atmosphere";
import { Barrieres } from "./world/Barrieres";
import { Decor } from "./world/Decor";
import { Enceintes, TempeteDuMonde } from "./world/Enceintes";
import { Objets } from "./world/Objets";
import { materiauTempete } from "./world/shaders";
import { Terrain } from "./world/Terrain";

/** Tempête qui ceinture l'île (son matériau est animé ici). */
function Bordure() {
  const materiau = useMemo(() => materiauTempete(), []);
  useFrame((state) => {
    materiau.uniforms.uTemps.value = state.clock.elapsedTime;
  });
  return <TempeteDuMonde materiau={materiau} />;
}

/** Mode léger (?leger dans l'adresse) : sans ombres ni effets, pour les machines modestes. */
export const LEGER = new URLSearchParams(window.location.search).has("leger");

export default function App() {
  return (
    <KeyboardControls map={TOUCHES}>
      <Canvas shadows={!LEGER} dpr={LEGER ? 1 : [1, 1.5]} camera={{ fov: 70, near: 0.1, far: 3000 }} gl={{ antialias: !LEGER, preserveDrawingBuffer: LEGER, toneMapping: LEGER ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping }}>
        <Suspense fallback={null}>
          <Atmosphere />
          <Physics>
            <Terrain />
            <Enceintes />
            <Bordure />
            <Barrieres />
            <Decor />
            <Objets />
            <Joueur />
          </Physics>
          {/* Lumière dorée qui « bave » sur les zones brillantes, coins assombris : rendu cinéma. */}
          {!LEGER && (
          <EffectComposer>
            <Bloom intensity={0.7} luminanceThreshold={0.75} luminanceSmoothing={0.3} mipmapBlur />
            <Vignette offset={0.25} darkness={0.65} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
          )}
        </Suspense>
      </Canvas>
      <Interface />
    </KeyboardControls>
  );
}
