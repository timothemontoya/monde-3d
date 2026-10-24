import { PointerLockControls, useKeyboardControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PointerLockControls as PLC } from "three-stdlib";
import { BARRIERES, ENIGMES, FEUX, FRONTIERES_MAGIQUES, INDICES, LIEUX, PORTS, RAMASSABLES, REGIONS, REGLAGES } from "../content/monde";
import type { Px } from "../content/types";
import { positionJoueur } from "../game/joueur";
import { barriereOuverte, lesExplorees, remplie, useJeu, type Cible } from "../game/store";
import { distanceEnMer, laCarte, MER, regionA, surTerre, versMonde } from "../world/carte";
import { distanceBarriere } from "../world/geometrie";
import { hauteurPont, hauteurSol, NIVEAU_MER } from "../world/relief";

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

/** Capture la souris. À appeler depuis un clic (le navigateur l'exige). */
let capture: () => void = () => {};
export const capturerSouris = () => capture();

/** Déplace le joueur (voyage en bateau, feu de camp…). Position en pixels de carte. */
let teleport: (p: Px) => void = () => {};
export const teleporterVers = (p: Px) => teleport(p);

const RAYON = 0.5;
const DEMI_HAUTEUR = 0.6;
/** Distance à laquelle on peut activer un objet. */
const PORTEE = 4;
/** Rayon d'exploration (brouillard de la carte), en m. */
const VUE = 140;

const IDS_REGIONS = REGIONS.map((r) => r.id);

/** Sol sous les pieds, en tenant compte de l'eau (on marche « dans » l'eau peu profonde). */
const sol = (x: number, z: number) => Math.max(hauteurSol(x, z), NIVEAU_MER - 0.6);

export function Joueur() {
  const corps = useRef<RapierRigidBody>(null);
  const controles = useRef<PLC>(null);
  const { world } = useRapier();
  const camera = useThree((s) => s.camera);
  const [, lire] = useKeyboardControls();
  const panneau = useJeu((s) => s.panneau);

  const depart = useMemo(() => {
    const [x, z] = surTerre(REGLAGES.depart);
    return new THREE.Vector3(x, sol(x, z) + REGLAGES.hauteurYeux + 1, z);
  }, []);

  // Contrôleur de personnage : glisse le long des murs. Créé dans un effet pour survivre
  // au double montage de React en développement.
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
    // Prépare le brouillard d'exploration (sauvegardé) à la taille de la carte.
    const c = laCarte();
    lesExplorees(c.largeur * c.hauteur);
    capture = () => controles.current?.lock();
    teleport = (p) => {
      const [x, z] = surTerre(p);
      const y = sol(x, z) + REGLAGES.hauteurYeux;
      corps.current?.setTranslation({ x, y, z }, true);
      corps.current?.setNextKinematicTranslation({ x, y, z });
    };
    // Outils de test, en développement seulement (console du navigateur).
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.teleporter = (px: number, py: number) => teleport([px, py]);
      w.regarder = (directionDeg: number) => {
        const a = (directionDeg * Math.PI) / 180;
        camera.lookAt(camera.position.x + Math.cos(a), camera.position.y, camera.position.z + Math.sin(a));
      };
      w.position = () => corps.current?.translation();
    }
  }, [camera]);

  useEffect(() => {
    if (panneau) controles.current?.unlock();
  }, [panneau]);

  // Positions des éléments interactifs, en mètres (calculées une fois).
  const reperes = useMemo(() => {
    const m = (p: Px) => surTerre(p);
    return {
      indices: INDICES.map((i) => ({ id: i.id, p: m(i.position) })),
      enigmes: ENIGMES.map((e) => ({ id: e.id, p: m(e.position) })),
      ports: PORTS.map((p) => ({ id: p.id, p: m(p.position) })),
      ramassables: RAMASSABLES.map((r) => ({ id: r.objet, p: m(r.position) })),
      feux: FEUX.map((f) => ({ id: f.id, p: m(f.position) })),
      lieux: LIEUX.map((l) => ({ id: l.id, p: versMonde(l.position), rayon: l.rayon })),
      frontieres: FRONTIERES_MAGIQUES.map((f) => ({ ...f, idx: f.regions.map((id) => IDS_REGIONS.indexOf(id)) })),
    };
  }, []);

  const avant = useMemo(() => new THREE.Vector3(), []);
  const droite = useMemo(() => new THREE.Vector3(), []);
  const mouvement = useMemo(() => new THREE.Vector3(), []);
  const derniereExploration = useRef({ x: Infinity, z: Infinity });

  /** Pourquoi ce pas est impossible (message), ou null s'il est permis. */
  function obstacle(px: number, pz: number, nx: number, nz: number, y: number): string | null {
    // La mer : un peu d'eau près de la côte, pas davantage (sauf sur un pont).
    if (hauteurPont(nx, nz) === null && distanceEnMer(nx, nz) > REGLAGES.eauMax) return "La mer est trop profonde. Il te faut un bateau.";
    // Frontières magiques entre deux régions.
    const ra = regionA(px, pz);
    const rb = regionA(nx, nz);
    if (ra !== rb && ra !== MER && rb !== MER) {
      for (const f of reperes.frontieres) {
        const [p, q] = f.idx;
        // Sans condition d'ouverture, la frontière reste fermée pour toujours.
        const ouverte = f.quand !== undefined && remplie(f.quand, useJeu.getState());
        if (((ra === p && rb === q) || (ra === q && rb === p)) && !ouverte) return f.message;
      }
    }
    // Falaises : on ne monte pas un mur, sauf si l'on vole déjà au-dessus.
    const s0 = sol(px, pz);
    const s1 = sol(nx, nz);
    const d = Math.hypot(nx - px, nz - pz) || 1;
    if (s1 + REGLAGES.hauteurYeux > y + 0.6 && (s1 - s0) / d > REGLAGES.penteMax) return "La paroi est trop raide.";
    return null;
  }

  useFrame((_, dt) => {
    const b = corps.current;
    const ctrl = controleur.current;
    if (!b || !ctrl) return;
    dt = Math.min(dt, 0.05);
    const etat = useJeu.getState();
    const actif = etat.enJeu && !etat.panneau && !etat.fondu;
    const t = lire();

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

    const pos = b.translation();
    // Règles du monde : on essaie le pas complet, puis chaque axe seul (pour glisser le long).
    let bloque: string | null = null;
    if (mouvement.x || mouvement.z) {
      const essais: [number, number][] = [
        [mouvement.x, mouvement.z],
        [mouvement.x, 0],
        [0, mouvement.z],
      ];
      let choisi: [number, number] = [0, 0];
      for (const [dx, dz] of essais) {
        if (!dx && !dz) continue;
        const raison = obstacle(pos.x, pos.z, pos.x + dx, pos.z + dz, pos.y);
        if (!raison) {
          choisi = [dx, dz];
          break;
        }
        bloque ??= raison;
      }
      mouvement.x = choisi[0];
      mouvement.z = choisi[1];
    }

    // Plafond et plancher, à l'endroit où l'on va : c'est ce qui empêche de survoler un rempart.
    const s = sol(pos.x + mouvement.x, pos.z + mouvement.z);
    const yMin = s + REGLAGES.hauteurYeux;
    const yMax = s + REGLAGES.volMax;
    mouvement.y = THREE.MathUtils.clamp(pos.y + mouvement.y, yMin, Math.max(yMin, yMax)) - pos.y;

    ctrl.computeColliderMovement(b.collider(0), mouvement);
    const corrige = ctrl.computedMovement();
    const suivant = { x: pos.x + corrige.x, y: pos.y + corrige.y, z: pos.z + corrige.z };
    suivant.y = Math.max(suivant.y, sol(suivant.x, suivant.z) + REGLAGES.hauteurYeux);
    b.setNextKinematicTranslation(suivant);
    camera.position.set(suivant.x, suivant.y, suivant.z);
    positionJoueur.x = suivant.x;
    positionJoueur.z = suivant.z;
    positionJoueur.cap = Math.atan2(avant.z, avant.x);

    // ── Autour du joueur ──────────────────────────────────────────────
    const ri = regionA(suivant.x, suivant.z);
    const region = ri === MER ? null : IDS_REGIONS[ri];
    let lieu: string | null = null;
    let meilleur = Infinity;
    for (const l of reperes.lieux) {
      const d = Math.hypot(suivant.x - l.p[0], suivant.z - l.p[1]);
      if (d < l.rayon && d / l.rayon < meilleur) ((meilleur = d / l.rayon), (lieu = l.id));
    }
    etat.entrerDans(region, lieu);

    // Objet activable le plus proche.
    let cible: Cible = null;
    let dMin = PORTEE;
    const proche = (type: "indice" | "enigme" | "port" | "ramassable", liste: { id: string; p: [number, number] }[], filtre = (_: string) => true) => {
      for (const it of liste) {
        if (!filtre(it.id)) continue;
        const d = Math.hypot(suivant.x - it.p[0], suivant.z - it.p[1]);
        if (d < dMin) ((dMin = d), (cible = { type, id: it.id }));
      }
    };
    proche("indice", reperes.indices);
    proche("enigme", reperes.enigmes, (id) => !etat.enigmes.includes(id));
    proche("ramassable", reperes.ramassables, (id) => !etat.objets.includes(id));
    if (!cible) {
      // Les quais sont grands : on peut appeler le bateau d'un peu plus loin.
      dMin = 14;
      proche("port", reperes.ports);
    }
    etat.viser(cible);

    // Feux de camp : découverts en s'en approchant.
    for (const f of reperes.feux) if (!etat.feux.includes(f.id) && Math.hypot(suivant.x - f.p[0], suivant.z - f.p[1]) < 12) etat.decouvrirFeu(f.id);

    // Message : barrière fermée proche, sinon obstacle rencontré.
    const barriere = BARRIERES.find((br) => !barriereOuverte(br, etat) && distanceBarriere(br, suivant.x, suivant.z) < 16);
    etat.signaler(barriere?.message ?? bloque);

    // Exploration : on dévoile la carte autour du joueur (tous les 20 m parcourus).
    const ex = derniereExploration.current;
    if (Math.hypot(suivant.x - ex.x, suivant.z - ex.z) > 20) {
      ex.x = suivant.x;
      ex.z = suivant.z;
      const c = laCarte();
      const cx = Math.floor(suivant.x / c.pas + c.largeur / 2);
      const cz = Math.floor(suivant.z / c.pas + c.hauteur / 2);
      const r = Math.ceil(VUE / c.pas);
      const cellules: number[] = [];
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz > r * r) continue;
          const x = cx + dx;
          const z = cz + dz;
          if (x >= 0 && z >= 0 && x < c.largeur && z < c.hauteur) cellules.push(z * c.largeur + x);
        }
      etat.marquerExplore(cellules);
    }
  });

  return (
    <>
      {/* Pas de capture au clic n'importe où : seulement via capturerSouris(). */}
      <PointerLockControls ref={controles} selector="#capture-manuelle" onUnlock={() => useJeu.getState().panneau === null && useJeu.getState().sortir()} />
      <RigidBody ref={corps} type="kinematicPosition" colliders={false} position={depart} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[DEMI_HAUTEUR, RAYON]} />
      </RigidBody>
    </>
  );
}
