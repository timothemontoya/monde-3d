import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { FEUX, VILLAGES } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { atterrir, carillon, cloche, crepiter, demarrerSon, grillon, oiseau, pas, regler, type Sol } from "../game/son";
import { useJeu } from "../game/store";
import { ciel } from "../game/temps";
import { MER, regionA, versMonde } from "./carte";
import { cheminEn } from "./Chemins";
import { hauteurPont, hauteurSol, NIVEAU_MER } from "./relief";

// Ce qu'on entend selon l'endroit : le vent (plus fort en altitude), la mer près des côtes,
// le grondement de la lave, les oiseaux le jour, les grillons la nuit, les cloches des villages.

const NEIGE = new Set(["glace", "iceberg", "royaume-glace", "palais-givre", "col-givre", "pic-hippocampe"]);
const VENTEUSES = new Set(["montagne-vent", "landes-roses", "glace", "royaume-glace", "col-givre", "pic-hippocampe", "elcres-muraille"]);
const BRULANTES = new Set(["cite-volcanique", "ile-volcan", "fracture-or", "terres-rougies"]);
const ARIDES = new Set([...BRULANTES, "bataille-corne", "elcres-abandonnee"]);
/** Pas d'oiseaux ni de grillons là où rien ne vit. */
const SANS_VIE = new Set([...NEIGE, ...BRULANTES, "foret-sorcieres", "foret-obscure"]);

/** Le sol sous les pieds : eau, pont de bois, neige, chemin de terre, ou herbe. */
function solIci(x: number, z: number, region: string | null): Sol {
  if (hauteurPont(x, z) !== null) return "bois";
  if (hauteurSol(x, z) < NIVEAU_MER) return "eau";
  if (region && NEIGE.has(region)) return "neige";
  if (cheminEn(x, z) > 0.35 || (region && ARIDES.has(region))) return "terre";
  return "herbe";
}

/** Part de mer sur un cercle de `rayon` m autour du point. */
function partDeMer(x: number, z: number, rayon: number) {
  let n = 0;
  for (let k = 0; k < 8; k++) if (regionA(x + Math.cos((k * Math.PI) / 4) * rayon, z + Math.sin((k * Math.PI) / 4) * rayon) === MER) n++;
  return n / 8;
}

/** Côté gauche/droite (-1 à 1) d'un point, vu par le joueur. */
function cote(x: number, z: number) {
  const a = Math.atan2(z - positionJoueur.z, x - positionJoueur.x) - positionJoueur.cap;
  return Math.sin(a);
}

export function Sons() {
  const pasAvant = useRef(0);
  const tasse = useRef(0);
  const prochain = useRef({ ambiance: 0, oiseau: 2, grillon: 0, cloche: 20, feu: 0 });
  const etat = useRef({ region: null as string | null, sol: "herbe" as Sol, village: null as { d: number; x: number; z: number } | null, feu: 0, vie: true });

  // Le son naît au premier geste (entrée en jeu) ; les découvertes sonnent un carillon.
  useEffect(() => {
    if (useJeu.getState().enJeu) demarrerSon();
    const reveil = () => demarrerSon();
    window.addEventListener("pointerdown", reveil);
    window.addEventListener("keydown", reveil);
    const fin = useJeu.subscribe((s, avant) => {
      if (s.enJeu && !avant.enJeu) demarrerSon();
      if (s.lieux.length > avant.lieux.length) carillon("lieu");
      else if (s.indices.length > avant.indices.length) carillon("indice");
      else if (s.objets.length > avant.objets.length) carillon("objet");
      else if (s.feux.length > avant.feux.length) carillon("feu");
    });
    return () => {
      fin();
      window.removeEventListener("pointerdown", reveil);
      window.removeEventListener("keydown", reveil);
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { x, z, foulee } = positionJoueur;
    const e = etat.current;
    const p = prochain.current;

    // Un pas à chaque demi-tour de la foulée (quand la tête est au plus bas).
    const k = Math.floor(foulee.phase / Math.PI);
    if (k !== pasAvant.current) {
      pasAvant.current = k;
      if (foulee.amplitude > 0.3) pas(e.sol, foulee.allure);
    }
    if (foulee.tassement > tasse.current + 0.04) atterrir(Math.min(1, foulee.tassement / 0.45), e.sol);
    tasse.current = foulee.tassement;

    if (t > p.ambiance) {
      p.ambiance = t + 0.4;
      const jeu = useJeu.getState();
      e.region = jeu.regionActuelle;
      e.sol = solIci(x, z, e.region);
      e.vie = !(e.region && SANS_VIE.has(e.region));
      const altitude = Math.max(0, hauteurSol(x, z));
      const enJeu = jeu.enJeu ? 1 : 0.4;
      const venteuse = e.region && VENTEUSES.has(e.region) ? 1 : 0;
      regler("vent", enJeu * (0.05 + Math.min(0.2, altitude / 500) + 0.08 * venteuse));
      regler("sifflement", enJeu * (Math.max(0, altitude - 60) / 900 + 0.025 * venteuse));
      const mer = Math.max(partDeMer(x, z, 35), partDeMer(x, z, 90) * 0.6);
      regler("mer", enJeu * mer * 0.35 * (altitude < 40 ? 1 : 40 / altitude));
      regler("grondement", enJeu * (e.region && BRULANTES.has(e.region) ? 0.5 : 0));
      // Le village le plus proche (pour ses cloches) et le feu de camp le plus proche.
      e.village = null;
      for (const v of VILLAGES) {
        const [vx, vz] = versMonde(v.centre);
        const d = Math.hypot(vx - x, vz - z);
        if (d < v.rayon * 3 && (!e.village || d < e.village.d)) e.village = { d, x: vx, z: vz };
      }
      e.feu = 0;
      for (const f of FEUX) {
        const [fx, fz] = versMonde(f.position);
        e.feu = Math.max(e.feu, 1 - Math.hypot(fx - x, fz - z) / 22);
      }
    }
    if (!useJeu.getState().enJeu) return;

    // Oiseaux le jour, grillons la nuit (les deux au crépuscule, un peu).
    if (e.vie && t > p.oiseau) {
      p.oiseau = t + 1.5 + Math.random() * 6 / Math.max(0.2, ciel.jour);
      if (Math.random() < ciel.jour) oiseau();
    }
    if (e.vie && e.sol !== "eau" && t > p.grillon) {
      p.grillon = t + 0.25 + Math.random() * 0.9;
      if (Math.random() < (1 - ciel.jour) * 0.9) grillon();
    }
    if (e.village && t > p.cloche) {
      p.cloche = t + 45 + Math.random() * 60;
      if (ciel.jour > 0.3) cloche(e.village.d, cote(e.village.x, e.village.z));
    }
    if (e.feu > 0 && t > p.feu) {
      p.feu = t + 0.04 + Math.random() * 0.25;
      crepiter(e.feu);
    }
  });
  return null;
}
