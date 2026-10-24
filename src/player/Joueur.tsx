import { PointerLockControls, useKeyboardControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PointerLockControls as PLC } from "three-stdlib";
import { BARRIERES, ENIGMES, INDICES, REGLAGES, ZONES } from "../content/monde";
import { estOuverte, useJeu } from "../game/store";
import { distanceBarriere } from "../world/geometrie";
import { hauteurSol } from "../world/relief";

/**
 * Touches : codes physiques, donc ZQSD en AZERTY et WASD en QWERTY fonctionnent tous les deux.
 * Pas de Ctrl ni d'Alt : le navigateur réserve leurs combinaisons (Ctrl+Q quitte, Ctrl+D ajoute
 * un marque-page, Ctrl+W ferme l'onglet…) et une page ne peut pas les bloquer.
 */
export const TOUCHES = [
  { name: "avant", keys: ["KeyW", "ArrowUp"] },
  { name: "arriere", keys: ["KeyS", "ArrowDown"] },
  { name: "gauche", keys: ["KeyA", "ArrowLeft"] },
  { name: "droite", keys: ["KeyD", "ArrowRight"] },
  { name: "monter", keys: ["Space"] },
  { name: "descendre", keys: ["KeyC"] },
  { name: "courir", keys: ["ShiftLeft", "ShiftRight"] },
];

/**
 * Capture la souris. À appeler depuis un clic (le navigateur l'exige) : bouton Entrer,
 * Reprendre, fermeture d'un panneau…
 */
let capture: () => void = () => {};
export const capturerSouris = () => capture();

const RAYON = 0.5;
const DEMI_HAUTEUR = 0.6;
/** Distance à laquelle on peut activer un objet. */
const PORTEE = 4;

export function Joueur() {
  const corps = useRef<RapierRigidBody>(null);
  const controles = useRef<PLC>(null);
  const { world } = useRapier();
  const camera = useThree((s) => s.camera);
  const [, lire] = useKeyboardControls();
  const panneau = useJeu((s) => s.panneau);

  const depart = useMemo(() => {
    const [x, z] = REGLAGES.depart;
    return new THREE.Vector3(x, hauteurSol(x, z) + REGLAGES.hauteurYeux + 1, z);
  }, []);

  // Contrôleur de personnage : glisse le long des murs au lieu de s'y bloquer net.
  // Créé dans un effet (et non un useMemo) pour survivre au double montage de React.
  const controleur = useRef<ReturnType<typeof world.createCharacterController> | null>(null);
  useEffect(() => {
    const c = world.createCharacterController(0.05);
    c.setSlideEnabled(true);
    c.enableAutostep(0.6, 0.2, false);
    controleur.current = c;
    return () => {
      controleur.current = null;
      world.removeCharacterController(c);
    };
  }, [world]);

  useEffect(() => {
    capture = () => controles.current?.lock();
  }, []);

  // Outils de test, en développement seulement (console du navigateur) :
  //   teleporter(x, z)      → se placer n'importe où
  //   regarder(directionDeg) → tourner la vue (0 = est, 90 = sud, 180 = ouest, 270 = nord)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.teleporter = (x: number, z: number) => {
      const y = hauteurSol(x, z) + REGLAGES.hauteurYeux;
      corps.current?.setTranslation({ x, y, z }, true);
      corps.current?.setNextKinematicTranslation({ x, y, z });
    };
    w.regarder = (directionDeg: number) => {
      const a = (directionDeg * Math.PI) / 180;
      camera.lookAt(camera.position.x + Math.cos(a), camera.position.y, camera.position.z + Math.sin(a));
    };
    w.position = () => corps.current?.translation();
  }, [camera]);

  // La souris est libérée quand un panneau s'ouvre (carnet, lecture, énigme).
  useEffect(() => {
    if (panneau) controles.current?.unlock();
  }, [panneau]);

  const avant = useMemo(() => new THREE.Vector3(), []);
  const droite = useMemo(() => new THREE.Vector3(), []);
  const mouvement = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const b = corps.current;
    const ctrl = controleur.current;
    if (!b || !ctrl) return;
    dt = Math.min(dt, 0.05);
    const etat = useJeu.getState();
    const actif = etat.enJeu && !etat.panneau;
    const t = lire();

    // Direction voulue, dans le plan horizontal de la caméra.
    camera.getWorldDirection(avant);
    avant.y = 0;
    avant.normalize();
    droite.crossVectors(avant, camera.up).normalize();
    mouvement.set(0, 0, 0);
    if (actif) {
      if (t.avant) mouvement.add(avant);
      if (t.arriere) mouvement.sub(avant);
      if (t.droite) mouvement.add(droite);
      if (t.gauche) mouvement.sub(droite);
      if (mouvement.lengthSq() > 0) mouvement.normalize();
      mouvement.multiplyScalar((t.courir ? REGLAGES.vitesseRapide : REGLAGES.vitesse) * dt);
      mouvement.y = ((t.monter ? 1 : 0) - (t.descendre ? 1 : 0)) * REGLAGES.vitesse * 0.7 * dt;
    }

    // Plafond et plancher : on reste entre « yeux au ras du sol » et « vol max », calculés
    // à l'endroit où l'on va. C'est ce qui empêche de survoler une enceinte.
    const pos = b.translation();
    const sol = hauteurSol(pos.x + mouvement.x, pos.z + mouvement.z);
    const yMin = sol + REGLAGES.hauteurYeux;
    const yMax = sol + REGLAGES.volMax;
    const yVoulu = THREE.MathUtils.clamp(pos.y + mouvement.y, yMin, Math.max(yMin, yMax));
    mouvement.y = yVoulu - pos.y;

    const collider = b.collider(0);
    ctrl.computeColliderMovement(collider, mouvement);
    const corrige = ctrl.computedMovement();
    const suivant = { x: pos.x + corrige.x, y: pos.y + corrige.y, z: pos.z + corrige.z };
    // Si une collision a empêché de suivre le relief, on recolle quand même au plancher.
    suivant.y = Math.max(suivant.y, hauteurSol(suivant.x, suivant.z) + REGLAGES.hauteurYeux);
    b.setNextKinematicTranslation(suivant);
    camera.position.set(suivant.x, suivant.y, suivant.z);

    // ── Ce qui se passe autour du joueur ──────────────────────────────
    // Zone actuelle : la plus proche dont on est à l'intérieur.
    let zone: string | null = null;
    let meilleure = Infinity;
    for (const z of ZONES) {
      const d = Math.hypot(suivant.x - z.centre[0], suivant.z - z.centre[1]);
      if (d < z.rayon && d / z.rayon < meilleure) {
        meilleure = d / z.rayon;
        zone = z.id;
      }
    }
    etat.entrerDansZone(zone);

    // Objet activable le plus proche.
    let cible: ReturnType<typeof useJeu.getState>["cible"] = null;
    let dMin = PORTEE;
    for (const i of INDICES) {
      const d = Math.hypot(suivant.x - i.position[0], suivant.z - i.position[1]);
      if (d < dMin) {
        dMin = d;
        cible = { type: "indice", id: i.id };
      }
    }
    for (const e of ENIGMES) {
      if (etat.enigmes.includes(e.id)) continue;
      const d = Math.hypot(suivant.x - e.position[0], suivant.z - e.position[1]);
      if (d < dMin) {
        dMin = d;
        cible = { type: "enigme", id: e.id };
      }
    }
    etat.viser(cible);

    // Barrière fermée proche : on affiche son message.
    const proche = BARRIERES.find((br) => !estOuverte(br, etat) && distanceBarriere(br, suivant.x, suivant.z) < 14);
    etat.signalerBarriere(proche?.message ?? null);
  });

  return (
    <>
      {/* Pas de capture au clic n'importe où : seulement via capturerSouris(). */}
      <PointerLockControls
        ref={controles}
        selector="#capture-manuelle"
        onUnlock={() => useJeu.getState().panneau === null && useJeu.getState().sortir()}
      />
      <RigidBody ref={corps} type="kinematicPosition" colliders={false} position={depart} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[DEMI_HAUTEUR, RAYON]} />
      </RigidBody>
    </>
  );
}
