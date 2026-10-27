import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type PointerEvent as PE, type ReactNode } from "react";
import * as THREE from "three";
import { useJeu } from "../game/store";

// Commandes tactiles (téléphone, tablette) : un joystick à gauche pour marcher, glisser à droite pour
// regarder, et des boutons. Elles envoient au jeu les mêmes touches que le clavier (ZQSD, Espace,
// C, Maj, E, F, Tab) : tout le reste du jeu fonctionne sans changement.

/** Écran tactile (ou ?tactile dans l'adresse, pour essayer sur ordinateur). */
export const TACTILE =
  new URLSearchParams(window.location.search).has("tactile") || (window.matchMedia("(pointer: coarse)").matches && "ontouchstart" in window);

/** Ce que le doigt a fait glisser pour regarder, en pixels, consommé à chaque image. */
const regard = { dx: 0, dy: 0 };
/** Sensibilité du regard (radians par pixel). */
const SENSIBILITE = 0.0045;

const TOUCHES: Record<string, string> = { KeyW: "z", KeyS: "s", KeyA: "q", KeyD: "d", Space: " ", KeyC: "c", ShiftLeft: "Shift", KeyE: "e", KeyF: "f", Tab: "Tab" };
const envoyer = (type: "keydown" | "keyup", code: string) => window.dispatchEvent(new KeyboardEvent(type, { code, key: TOUCHES[code], bubbles: true }));
/** Une pression brève sur une touche. */
const appuyer = (code: string) => {
  envoyer("keydown", code);
  setTimeout(() => envoyer("keyup", code), 60);
};

/** Dans le Canvas : tourne la caméra selon le glissé du doigt (comme la souris, en ordre YXZ). */
export function RegardTactile() {
  const camera = useThree((s) => s.camera);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  useFrame(() => {
    if (!regard.dx && !regard.dy) return;
    const e = euler.current.setFromQuaternion(camera.quaternion);
    e.y -= regard.dx * SENSIBILITE;
    e.x = Math.max(-1.45, Math.min(1.45, e.x - regard.dy * SENSIBILITE));
    camera.quaternion.setFromEuler(e);
    regard.dx = regard.dy = 0;
  });
  return null;
}

/** Rayon du joystick (px), et seuil au-delà duquel on court. */
const RAYON = 55;
const COURSE = 0.92;

function Joystick() {
  const [centre, setCentre] = useState<{ x: number; y: number } | null>(null);
  const [bouton, setBouton] = useState({ x: 0, y: 0 });
  const doigt = useRef<number | null>(null);
  const tenues = useRef(new Set<string>());

  /** Garde enfoncées exactement les touches voulues. */
  const tenir = (voulues: Set<string>) => {
    for (const t of tenues.current) if (!voulues.has(t)) envoyer("keyup", t);
    for (const t of voulues) if (!tenues.current.has(t)) envoyer("keydown", t);
    tenues.current = voulues;
  };
  useEffect(() => () => tenir(new Set()), []);

  const bouger = (x: number, y: number, c: { x: number; y: number }) => {
    let [dx, dy] = [x - c.x, y - c.y];
    const l = Math.hypot(dx, dy);
    if (l > RAYON) [dx, dy] = [(dx / l) * RAYON, (dy / l) * RAYON];
    setBouton({ x: dx, y: dy });
    const [nx, ny] = [dx / RAYON, dy / RAYON];
    const voulues = new Set<string>();
    if (ny < -0.35) voulues.add("KeyW");
    if (ny > 0.35) voulues.add("KeyS");
    if (nx < -0.35) voulues.add("KeyA");
    if (nx > 0.35) voulues.add("KeyD");
    if (Math.hypot(nx, ny) > COURSE) voulues.add("ShiftLeft");
    tenir(voulues);
  };

  return (
    <div
      className="tactile-joystick"
      onPointerDown={(e: PE) => {
        if (doigt.current !== null) return;
        doigt.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const c = { x: e.clientX, y: e.clientY };
        setCentre(c);
        bouger(e.clientX, e.clientY, c);
      }}
      onPointerMove={(e: PE) => e.pointerId === doigt.current && centre && bouger(e.clientX, e.clientY, centre)}
      onPointerUp={(e: PE) => {
        if (e.pointerId !== doigt.current) return;
        doigt.current = null;
        setCentre(null);
        setBouton({ x: 0, y: 0 });
        tenir(new Set());
      }}
      onPointerCancel={() => {
        doigt.current = null;
        setCentre(null);
        tenir(new Set());
      }}
    >
      {centre && (
        <div className="tactile-socle" style={{ left: centre.x - RAYON, top: centre.y - RAYON, width: RAYON * 2, height: RAYON * 2 }}>
          <div className="tactile-bouton-joystick" style={{ transform: `translate(${bouton.x}px, ${bouton.y}px)` }} />
        </div>
      )}
    </div>
  );
}

/** Zone de droite : glisser pour regarder. */
function Regard() {
  const dernier = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      className="tactile-regard"
      onPointerDown={(e: PE) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dernier.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e: PE) => {
        const d = dernier.current;
        if (!d || d.id !== e.pointerId) return;
        regard.dx += e.clientX - d.x;
        regard.dy += e.clientY - d.y;
        dernier.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (dernier.current = null)}
      onPointerCancel={() => (dernier.current = null)}
    />
  );
}

/** Un bouton qui appuie sur une touche (brièvement, ou tant qu'on le tient). */
function Touche({ code, tenue = false, children, className = "" }: { code: string; tenue?: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      className={`tactile-touche ${className}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (tenue) envoyer("keydown", code);
        else appuyer(code);
      }}
      onPointerUp={() => tenue && envoyer("keyup", code)}
      onPointerCancel={() => tenue && envoyer("keyup", code)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** Les commandes tactiles, par-dessus le jeu, quand on joue. */
export function CommandesTactiles() {
  const { enJeu, panneau, fondu, vol, cible } = useJeu();
  if (!TACTILE || !enJeu || panneau || fondu) return null;
  return (
    <div className="tactile">
      <Joystick />
      <Regard />
      <div className="tactile-boutons">
        {vol ? (
          <>
            <Touche code="Space" tenue>
              Monter
            </Touche>
            <Touche code="KeyC" tenue>
              Descendre
            </Touche>
          </>
        ) : (
          <Touche code="Space" className="tactile-principal">
            Sauter
          </Touche>
        )}
        <button
          className="tactile-touche"
          onPointerDown={(e) => {
            e.stopPropagation();
            // Deux appuis rapprochés sur Espace : voler, ou cesser de voler.
            appuyer("Space");
            setTimeout(() => appuyer("Space"), 120);
          }}
        >
          {vol ? "Atterrir" : "Voler"}
        </button>
        {cible && (
          <Touche code="KeyE" className="tactile-principal">
            Examiner
          </Touche>
        )}
        <Touche code="KeyF">Utiliser</Touche>
      </div>
      <div className="tactile-haut">
        <Touche code="Tab">Journal</Touche>
        <button className="tactile-touche" onPointerDown={() => useJeu.getState().sortir()}>
          Pause
        </button>
      </div>
    </div>
  );
}
