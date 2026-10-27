import { KeyboardControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { ObjetEnMain } from "./player/FormeObjet";
import { Joueur, TOUCHES } from "./player/Joueur";
import { LEGER } from "./qualite";
import { preparerCarte } from "./ui/Carte";
import { Interface } from "./ui/Interface";
import { Atmosphere } from "./world/Atmosphere";
import { Barrieres } from "./world/Barrieres";
import { bornes, carteComprise, chargerCarte, MER, regionA, versMonde } from "./world/carte";
import { REGIONS } from "./content/monde";
import { useJeu } from "./game/store";
import { hauteurSol } from "./world/relief";
import { Decor } from "./world/Decor";
import { Objets } from "./world/Objets";
import { lePlan, planifier } from "./world/plan";
import { Eau, Terrain } from "./world/Terrain";

const PARAMS = new URLSearchParams(window.location.search);

/**
 * Vues aériennes (?vue=ciel : de dessus, nord en haut · ?vue=survol : en perspective),
 * pour voir toute la carte d'un coup. Pas de joueur ni d'interface.
 */
const VUE = PARAMS.get("vue");

/** Caméra des vues aériennes : cadre tout le monde. */
function CameraAerienne() {
  const { demiLargeur, demiHauteur } = bornes();
  if (VUE === "ciel")
    return (
      <OrthographicCamera
        makeDefault
        position={[0, 3000, 0]}
        up={[0, 0, -1]}
        left={-demiLargeur}
        right={demiLargeur}
        top={demiHauteur}
        bottom={-demiHauteur}
        near={1}
        far={6000}
        onUpdate={(c) => c.lookAt(0, 0, 0)}
      />
    );
  return <PerspectiveCamera makeDefault position={[0, 1900, 2700]} fov={50} far={9000} onUpdate={(c) => c.lookAt(0, 0, -250)} />;
}

export default function App() {
  // La forme du monde vient de la carte dessinée : on la lit avant de construire quoi que ce soit.
  const [carte, setCarte] = useState<"chargement" | "prete" | string>("chargement");
  useEffect(() => {
    chargerCarte()
      .then(() => {
        // Où se pose chaque chose (sol aplani, ponts, quais, maisons) : avant de construire le monde.
        planifier();
        preparerCarte();
        if (import.meta.env.DEV) {
          const w = window as unknown as Record<string, unknown>;
          w.carteComprise = carteComprise;
          // lePlan() : où le jeu a posé chaque chose (maisons, quais, ponts…), en mètres.
          w.lePlan = lePlan;
          // jeu : l'état du jeu (zustand), ex. jeu.setState({ enJeu: true }).
          w.jeu = useJeu;
          // versMonde([px, py]) : pixels de la carte → mètres (utilisé par scripts/photos.mjs).
          w.versMonde = versMonde;
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
  return <Monde />;
}

function Monde() {
  const depart = useMemo<[number, number]>(() => [lePlan().depart.x, lePlan().depart.z], []);

  return (
    <KeyboardControls map={TOUCHES}>
      <Canvas
        shadows={!LEGER}
        dpr={LEGER ? 1 : [1, 1.5]}
        camera={{ fov: 70, near: 0.15, far: 6000 }}
        gl={{ antialias: !LEGER, preserveDrawingBuffer: LEGER, toneMapping: LEGER ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping }}
        onCreated={({ scene }) => {
          if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).scene = scene;
        }}
      >
        <Suspense fallback={null}>
          {VUE && <CameraAerienne />}
          <Atmosphere sansBrume={!!VUE} />
          <Physics>
            <Terrain pasFixe={VUE ? 16 : undefined} depart={depart} />
            <Eau />
            <Barrieres />
            <Decor />
            <Objets />
            {!VUE && <Joueur />}
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
      {!VUE && <Interface />}
    </KeyboardControls>
  );
}
