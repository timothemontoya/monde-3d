import { PointerLockControls, useKeyboardControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PointerLockControls as PLC } from "three-stdlib";
import { BARRIERES, FRONTIERES_MAGIQUES, LIEUX, REGIONS, REGLAGES } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { barriereOuverte, lesExplorees, remplie, useJeu, type Cible } from "../game/store";
import { distanceEnMer, indiceCellule, laCarte, MER, regionA, versMonde } from "../world/carte";
import { distanceBarriere } from "../world/geometrie";
import { lePlan, terreFerme } from "../world/plan";
import { TACTILE } from "../ui/Tactile";
import { useReglages } from "../game/reglages";
import { hauteurPont, hauteurSol, NIVEAU_MER } from "../world/relief";
import { prechaufferTerrain } from "../world/Terrain";

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

/** Déplace le joueur (voyage en bateau, feu de camp…). Position en mètres. */
let teleport: (x: number, z: number) => void = () => {};
export const teleporterVers = (x: number, z: number) => teleport(x, z);

const RAYON = 0.5;
const DEMI_HAUTEUR = 0.6;
/** Distance à laquelle on peut activer un objet. */
const PORTEE = 4;
/** Rayon d'exploration (brouillard de la carte), en m. */
const VUE = 70;
const GRAVITE = 28;
/** Vitesse de saut, en m/s (environ 1,1 m de haut). */
const SAUT = 8;
/** Deux appuis sur Espace plus rapprochés que ça (ms) : on s'envole, ou on se laisse retomber. */
const DOUBLE_APPUI = 300;
/** Pente à partir de laquelle on ralentit (le maximum franchissable est REGLAGES.penteMax). */
const PENTE_LENTE = 0.5;
/** Prise au sol (1/s) : plus c'est grand, plus on démarre et on s'arrête vite. En l'air, on garde son élan. */
const PRISE_SOL = 10;
const PRISE_AIR = 2;
const PRISE_VOL = 4;
/** Balancement de la tête à chaque pas, en m (marche, course), et cadence des pas (pas par seconde). */
const BALANCEMENT: [number, number] = [0.09, 0.14];
const CADENCE = (v: number) => 1.5 + 0.085 * v;
/** Champ de vision (degrés) à l'arrêt, et en plus quand on court. */
const FOV = 70;
const FOV_COURSE = 6;

const IDS_REGIONS = REGIONS.map((r) => r.id);
/** Zone d'un lac (pour les frontières, les lacs ne sont pas « la mer »). */
const LAC = 256;

/** Sol sous les pieds, en tenant compte de l'eau (on marche « dans » l'eau peu profonde). */
const sol = (x: number, z: number) => Math.max(hauteurSol(x, z), NIVEAU_MER - 0.6);

/**
 * Eau côtière d'une région que la brume ferme du côté de la mer (zone COTE + région) : on ne s'y
 * glisse pas en nageant le long de la côte depuis une région voisine.
 */
const COTE = 512;
/** Largeur de cette eau côtière, en cellules de carte (au-delà, la mer est trop profonde de toute façon). */
const LARGEUR_COTE = 4;
const FERMEES_COTE = new Map(
  FRONTIERES_MAGIQUES.filter((f) => f.regions.includes("mer") && !f.quand).map((f) => [IDS_REGIONS.indexOf(f.regions.find((r) => r !== "mer")!), f.message]),
);

/** Région à cet endroit, « MER » pour la mer ouverte, « LAC » pour un lac, COTE + région pour l'eau côtière fermée. */
function zone(x: number, z: number) {
  const r = regionA(x, z);
  if (r !== MER) return r;
  const i = indiceCellule(x, z);
  if (i < 0) return MER;
  const c = laCarte();
  if (FERMEES_COTE.has(c.regionProche[i]) && c.distMer[i] <= LARGEUR_COTE) return COTE + c.regionProche[i];
  return c.ocean[i] ? MER : LAC;
}

export function Joueur() {
  const corps = useRef<RapierRigidBody>(null);
  const controles = useRef<PLC>(null);
  const sensibilite = useReglages((s) => s.sensibilite);
  const { world } = useRapier();
  const camera = useThree((s) => s.camera);
  const [, lire] = useKeyboardControls();
  const panneau = useJeu((s) => s.panneau);

  const depart = useMemo(() => {
    const d = lePlan().depart;
    return new THREE.Vector3(d.x, sol(d.x, d.z) + REGLAGES.hauteurYeux, d.z);
  }, []);

  /** Vitesse verticale, vol, contact avec le sol, dernier appui sur Espace, hauteur lissée de la caméra. */
  const vy = useRef(0);
  const vol = useRef(false);
  const auSol = useRef(true);
  const espace = useRef({ avant: false, dernier: 0 });
  const camY = useRef(depart.y);
  /** Vitesse horizontale (m/s), qui suit la vitesse voulue avec un peu d'inertie. */
  const elan = useRef(new THREE.Vector2());
  /** Pas : phase (un pas tous les π), amplitude (0 à l'arrêt, 1 en marche), tassement à l'atterrissage (m). */
  const foulee = useRef(positionJoueur.foulee);

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

  const voler = (v: boolean) => {
    vol.current = v;
    useJeu.getState().setVol(v);
  };

  useEffect(() => {
    // Prépare le brouillard d'exploration (sauvegardé) à la taille de la carte.
    const c = laCarte();
    lesExplorees(c.largeur * c.hauteur);
    capture = () => !TACTILE && controles.current?.lock();
    // Au départ, on regarde vers le centre du village.
    const cap = lePlan().depart.cap;
    camera.position.copy(depart);
    camera.lookAt(depart.x + Math.cos(cap), depart.y, depart.z + Math.sin(cap));
    teleport = (x, z) => {
      prechaufferTerrain(x, z);
      const y = sol(x, z) + REGLAGES.hauteurYeux;
      corps.current?.setTranslation({ x, y, z }, true);
      corps.current?.setNextKinematicTranslation({ x, y, z });
      vy.current = 0;
      camY.current = y;
      elan.current.set(0, 0);
      voler(false);
    };
    // Outils de test, en développement seulement (console du navigateur).
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.teleporter = (px: number, py: number) => teleport(...terreFerme([px, py], 1));
      w.regarder = (directionDeg: number) => {
        const a = (directionDeg * Math.PI) / 180;
        camera.lookAt(camera.position.x + Math.cos(a), camera.position.y, camera.position.z + Math.sin(a));
      };
      w.position = () => corps.current?.translation();
    }
  }, [camera, depart]);

  useEffect(() => {
    if (panneau && !TACTILE) controles.current?.unlock();
  }, [panneau]);

  // Positions des éléments interactifs, en mètres (celles du plan, là où ils sont dessinés).
  const reperes = useMemo(() => {
    const plan = lePlan();
    const liste = (r: Record<string, { x: number; z: number }>) => Object.entries(r).map(([id, p]) => ({ id, p: [p.x, p.z] as [number, number] }));
    return {
      indices: liste(plan.indices),
      enigmes: liste(plan.enigmes),
      ramassables: liste(plan.ramassables),
      feux: liste(plan.feux),
      ports: Object.entries(plan.ports).map(([id, q]) => ({ id, p: q.appel })),
      lieux: LIEUX.map((l) => ({ id: l.id, p: versMonde(l.position), rayon: l.rayon })),
      frontieres: FRONTIERES_MAGIQUES.map((f) => ({ ...f, zones: f.regions.map((id) => (id === "mer" ? MER : IDS_REGIONS.indexOf(id))) })),
    };
  }, []);

  const avant = useMemo(() => new THREE.Vector3(), []);
  const droite = useMemo(() => new THREE.Vector3(), []);
  const mouvement = useMemo(() => new THREE.Vector3(), []);
  const derniereExploration = useRef({ x: Infinity, z: Infinity });

  /** Pente du sol devant soi, mesurée sur 1,5 m (indépendante de la vitesse et des images par seconde). */
  const penteDevant = (x: number, z: number, ux: number, uz: number) => (sol(x + ux * 1.5, z + uz * 1.5) - sol(x, z)) / 1.5;

  /** Pourquoi ce pas est impossible (message), ou null s'il est permis. */
  function obstacle(px: number, pz: number, nx: number, nz: number, y: number): string | null {
    // La mer : un peu d'eau près de la côte, pas davantage (sauf sur un pont ou un ponton).
    // Si l'on est déjà trop loin (après un saut depuis un pont), on peut toujours revenir vers la côte.
    if (hauteurPont(nx, nz) === null) {
      const loin = distanceEnMer(nx, nz);
      // (seulement dans l'eau : une plage peut être classée « mer » sur la carte tout en étant au sec)
      if (loin > REGLAGES.eauMax && loin >= distanceEnMer(px, pz) && hauteurSol(nx, nz) < NIVEAU_MER) return "La mer est trop profonde. Il te faut un bateau.";
    }
    // Frontières magiques entre deux régions (ou entre une région et la mer).
    const za = zone(px, pz);
    const zb = zone(nx, nz);
    if (za !== zb) {
      // L'eau côtière fermée : on n'y entre pas, et on n'en gagne pas la terre de sa région.
      const cote = zb >= COTE ? zb - COTE : za >= COTE && zb === za - COTE ? zb : -1;
      if (cote >= 0) return FERMEES_COTE.get(cote)!;
      for (const f of reperes.frontieres) {
        const [p, q] = f.zones;
        // Sans condition d'ouverture, la frontière reste fermée pour toujours.
        const ouverte = f.quand !== undefined && remplie(f.quand, useJeu.getState());
        if (((za === p && zb === q) || (za === q && zb === p)) && !ouverte) return f.message;
      }
    }
    // Parois : trop raides pour monter, sauf si l'on passe au-dessus (saut, vol).
    const d = Math.hypot(nx - px, nz - pz) || 1;
    const pente = penteDevant(px, pz, (nx - px) / d, (nz - pz) / d);
    const pieds = y - REGLAGES.hauteurYeux;
    const devant = sol(px + ((nx - px) / d) * 1.5, pz + ((nz - pz) / d) * 1.5);
    // En eau (pied d'une falaise immergée) : on laisse nager pour rejoindre la berge.
    const enEauIci = hauteurSol(px, pz) < NIVEAU_MER && pieds < NIVEAU_MER + 0.5;
    if (pente > REGLAGES.penteMax && devant > pieds + (vol.current ? 0.6 : 0.3) && !enEauIci) return "La paroi est trop raide.";
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
    const pos = b.translation();

    // Espace : sauter ; deux fois de suite : voler (ou cesser de voler).
    const appui = actif && t.monter && !espace.current.avant;
    espace.current.avant = actif && t.monter;
    if (appui) {
      const maintenant = performance.now();
      if (maintenant - espace.current.dernier < DOUBLE_APPUI) {
        voler(!vol.current);
        vy.current = 0;
        espace.current.dernier = 0;
      } else {
        espace.current.dernier = maintenant;
        if (!vol.current && auSol.current) {
          vy.current = SAUT;
          auSol.current = false;
        }
      }
    }

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
    }
    if (mouvement.lengthSq() > 0) {
      mouvement.normalize();
      let vitesse = t.courir ? REGLAGES.vitesseRapide : REGLAGES.vitesse;
      // On ralentit dans les côtes raides (à pied seulement).
      if (!vol.current) {
        const pente = penteDevant(pos.x, pos.z, mouvement.x, mouvement.z);
        vitesse *= 1 - 0.55 * THREE.MathUtils.smoothstep(pente, PENTE_LENTE, REGLAGES.penteMax);
      }
      mouvement.multiplyScalar(vitesse);
    }
    // Inertie : la vitesse rejoint en douceur celle qu'on veut (démarrage, arrêt, virage) ; en l'air on garde son élan.
    const e = elan.current;
    const prise = 1 - Math.exp(-dt * (vol.current ? PRISE_VOL : auSol.current ? PRISE_SOL : PRISE_AIR));
    e.x += (mouvement.x - e.x) * prise;
    e.y += (mouvement.z - e.y) * prise;
    if (e.lengthSq() < 0.0004) e.set(0, 0);
    mouvement.set(e.x * dt, 0, e.y * dt);

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
      // Bloqué dans une direction : on y perd son élan (pas de « poussée » accumulée contre un mur).
      if (!choisi[0]) e.x = 0;
      if (!choisi[1]) e.y = 0;
    }

    // Vertical : plancher (le sol) et plafond (vol limité), à l'endroit où l'on va.
    // C'est ce plafond qui empêche de survoler un rempart ou une porte fermée.
    const s = sol(pos.x + mouvement.x, pos.z + mouvement.z);
    const yMin = s + REGLAGES.hauteurYeux;
    const yMax = Math.max(yMin, s + REGLAGES.volMax);
    let y = pos.y;
    if (vol.current) {
      vy.current = 0;
      y += ((actif && t.monter ? 1 : 0) - (actif && t.descendre ? 1 : 0)) * REGLAGES.vitesse * 0.7 * dt;
      // Descendre jusqu'au sol : on se pose.
      if (actif && t.descendre && y <= yMin + 0.05) voler(false);
      y = THREE.MathUtils.clamp(y, yMin, yMax);
      auSol.current = y <= yMin + 0.01;
    } else {
      const enEau = hauteurSol(pos.x + mouvement.x, pos.z + mouvement.z) < NIVEAU_MER && y < NIVEAU_MER + 1.0;
      if (enEau) {
        // Flottabilité : amortit la chute et pousse doucement vers la surface.
        vy.current = Math.max(vy.current * 0.85, -2);
        vy.current += 6 * dt;
      } else {
        vy.current -= GRAVITE * dt;
      }
      y += vy.current * dt;
      const pas = Math.hypot(mouvement.x, mouvement.z);
      if (y <= yMin) {
        // Atterrissage : la vue se tasse un peu, d'autant plus que la chute était rapide.
        if (!auSol.current) foulee.current.tassement = Math.min(0.45, Math.max(0, -vy.current - 3) * 0.035);
        y = yMin;
        vy.current = 0;
        auSol.current = true;
      } else if (auSol.current && vy.current <= 0 && y - yMin < 0.4 + pas * 1.6) {
        // En descente, on reste collé au sol au lieu de décoller à chaque bosse.
        y = yMin;
        vy.current = 0;
      } else {
        // En eau peu profonde, on peut sauter pour remonter sur la berge.
        if (enEau && y < NIVEAU_MER + 0.3) auSol.current = true;
        else auSol.current = false;
      }
      y = Math.min(y, yMax);
    }
    mouvement.y = y - pos.y;

    ctrl.computeColliderMovement(b.collider(0), mouvement);
    const corrige = ctrl.computedMovement();
    const suivant = { x: pos.x + corrige.x, y: pos.y + corrige.y, z: pos.z + corrige.z };
    suivant.y = Math.max(suivant.y, sol(suivant.x, suivant.z) + REGLAGES.hauteurYeux);
    if (!vol.current) {
      // Un plafond nous arrête en plein saut : on retombe.
      if (vy.current > 0 && corrige.y < mouvement.y - 0.01) vy.current = 0;
      // Posé sur un obstacle (rocher, rebord…) : on y tient debout.
      if (mouvement.y < 0 && corrige.y > mouvement.y + 0.001) {
        vy.current = 0;
        auSol.current = true;
      }
    }
    b.setNextKinematicTranslation(suivant);

    // Caméra : hauteur lissée (les petites marches et les atterrissages ne secouent pas la vue).
    camY.current += (suivant.y - camY.current) * (1 - Math.exp(-dt * 18));
    camY.current = Math.max(camY.current, sol(suivant.x, suivant.z) + 1.2);
    // Léger recul de la caméra pour éviter le clipping dans les parois (avant déjà calculé ligne ~220).
    // Pas : la tête monte et descend à chaque pas, et se balance un peu d'un côté à l'autre.
    const p = foulee.current;
    const v = Math.hypot(corrige.x, corrige.z) / dt;
    const marche = auSol.current && !vol.current ? Math.min(1, v / REGLAGES.vitesse) : 0;
    p.amplitude += (marche - p.amplitude) * (1 - Math.exp(-dt * 6));
    p.phase += dt * CADENCE(v) * Math.PI * (marche > 0.05 ? 1 : 0);
    const course = THREE.MathUtils.smoothstep(v, REGLAGES.vitesse, REGLAGES.vitesseRapide);
    p.allure = course;
    const a = p.amplitude * THREE.MathUtils.lerp(BALANCEMENT[0], BALANCEMENT[1], course);
    const haut = (Math.abs(Math.sin(p.phase)) - 0.6) * a;
    const cote = Math.sin(p.phase) * a * 0.5;
    p.tassement *= Math.exp(-dt * 7);
    camera.position.set(
      suivant.x - avant.x * 0.2 + droite.x * cote,
      camY.current + haut - p.tassement,
      suivant.z - avant.z * 0.2 + droite.z * cote,
    );
    // En courant, le champ de vision s'ouvre un peu : une impression de vitesse.
    const cam = camera as THREE.PerspectiveCamera;
    const fov = FOV + FOV_COURSE * course * (auSol.current || vol.current ? 1 : 0.6);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4));
      cam.updateProjectionMatrix();
    }
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
      // Les quais sont grands : on peut appeler le bateau de n'importe où sur le ponton.
      dMin = 16;
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
      <PointerLockControls ref={controles} pointerSpeed={sensibilite} selector="#capture-manuelle" onUnlock={() => useJeu.getState().panneau === null && useJeu.getState().sortir()} />
      <RigidBody ref={corps} type="kinematicPosition" colliders={false} position={depart} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[DEMI_HAUTEUR, RAYON]} />
      </RigidBody>
    </>
  );
}
