import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { ObjetEnMain } from "./player/FormeObjet";
import { Joueur, TOUCHES } from "./player/Joueur";
import { Interface } from "./ui/Interface";
import { Atmosphere } from "./world/Atmosphere";
import { Barrieres } from "./world/Barrieres";
import { carteComprise, chargerCarte, MER, regionA, versMonde } from "./world/carte";
import { REGIONS } from "./content/monde";
import { hauteurSol } from "./world/relief";
import { Decor } from "./world/Decor";
import { Objets } from "./world/Objets";
import { Eau, Terrain } from "./world/Terrain";

/** Mode léger (?leger dans l'adresse) : sans ombres ni effets, pour les machines modestes. */
export const LEGER = new URLSearchParams(window.location.search).has("leger");

export default function App() {
  // La forme du monde vient de la carte dessinée : on la lit avant de construire quoi que ce soit.
  const [carte, setCarte] = useState<"chargement" | "prete" | string>("chargement");
  useEffect(() => {
    chargerCarte()
      .then(() => {
        if (import.meta.env.DEV) {
          const w = window as unknown as Record<string, unknown>;
          w.carteComprise = carteComprise;
          // hauteurEn(px, py) : altitude du sol à cet endroit de la carte.
          w.hauteurEn = (px: number, py: number) => hauteurSol(...versMonde([px, py]));
          // regionEn(px, py) : nom de la région à cet endroit de la carte.
          w.regionEn = (px: number, py: number) => {
            const r = regionA(...versMonde([px, py]));
            return r === MER ? "mer" : REGIONS[r].id;
          };
        }
        setCarte("prete");
      })
      .catch((e: Error) => setCarte(e.message));
  }, []);

  if (carte !== "prete") return <div className="chargement">{carte === "chargement" ? "Le monde se dessine…" : carte}</div>;

  return (
    <KeyboardControls map={TOUCHES}>
      <Canvas
        shadows={!LEGER}
        dpr={LEGER ? 1 : [1, 1.5]}
        camera={{ fov: 70, near: 0.1, far: 6000 }}
        gl={{ antialias: !LEGER, preserveDrawingBuffer: LEGER, toneMapping: LEGER ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping }}
        onCreated={({ scene }) => {
          if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).scene = scene;
        }}
      >
        <Suspense fallback={null}>
          <Atmosphere />
          <Physics>
            <Terrain />
            <Eau />
            <Barrieres />
            <Decor />
            <Objets />
            <Joueur />
          </Physics>
          <ObjetEnMain />
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
