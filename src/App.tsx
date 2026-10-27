import { KeyboardControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Bloom, BrightnessContrast, EffectComposer, GodRays, HueSaturation, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { ObjetEnMain } from "./player/FormeObjet";
import { Joueur, TOUCHES } from "./player/Joueur";
import { LEGER } from "./qualite";
import { preparerCarte } from "./ui/Carte";
import { Interface } from "./ui/Interface";
import { Atmosphere, SOLEIL } from "./world/Atmosphere";
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

/** Disque du soleil, loin dans sa direction (il suit la caméra) : la source des rayons dans la brume. */
function DisqueSoleil({ disque, pret }: { disque: RefObject<THREE.Mesh | null>; pret: () => void }) {
  useEffect(pret, [pret]);
  useFrame(({ camera }) => {
    disque.current?.position.copy(camera.position).addScaledVector(SOLEIL, 2500);
  });
  return (
    <mesh ref={disque}>
      <sphereGeometry args={[90, 16, 8]} />
      <meshBasicMaterial color="#ffe2b0" fog={false} />
    </mesh>
  );
}

/**
 * L'image finale : ombres de contact (N8AO), rayons de soleil dans la brume, lueurs, couleurs
 * réchauffées et un peu plus saturées, coins assombris : un rendu plus « peint ».
 */
function Image({ soleil }: { soleil: THREE.Mesh | null }) {
  return (
    <EffectComposer>
      <N8AO aoRadius={2.5} intensity={2.2} distanceFalloff={1} halfRes color="#3a2a1a" />
      {soleil ? <GodRays sun={soleil} samples={40} density={0.92} decay={0.93} weight={0.35} exposure={0.45} clampMax={1} blur /> : <></>}
      <Bloom intensity={0.85} luminanceThreshold={0.72} luminanceSmoothing={0.3} mipmapBlur />
      <HueSaturation saturation={0.04} />
      <BrightnessContrast brightness={0.02} contrast={0.08} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}

function Monde() {
  const disque = useRef<THREE.Mesh>(null);
  const [soleil, setSoleil] = useState<THREE.Mesh | null>(null);
  const soleilPret = useCallback(() => setSoleil(disque.current), []);
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
            <>
              <DisqueSoleil disque={disque} pret={soleilPret} />
              <Image soleil={soleil} />
            </>
          )}
        </Suspense>
      </Canvas>
      {!VUE && <Interface />}
    </KeyboardControls>
  );
}
