import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { LABYRINTHE, REGIONS } from "../content/monde";
import { useJeu } from "../game/store";
import { teleporterVers } from "../player/Joueur";
import { regionA, versMonde } from "./carte";
import { Halos } from "./Lueurs";
import { hauteurTerrain } from "./relief";

// Le Bois perdu (LABYRINTHE dans monde.ts) : où qu'on y entre, on arrive dans la première salle ;
// chaque salle a plusieurs chemins, le bon mène plus loin, les autres ramènent au début.

const L = LABYRINTHE;
const REGION = REGIONS.findIndex((r) => r.id === L.region);
/** Durée du fondu au noir d'un passage (ms). */
const FONDU = 700;

/** Positions en mètres (la carte doit être chargée : on les calcule au premier usage). */
let enMetres: ReturnType<typeof convertir> | null = null;
function convertir() {
  return {
    salles: L.salles.map((s) => ({ ...s, m: versMonde(s.centre) })),
    fin: { ...L.fin, m: versMonde(L.fin.centre), arrivee: versMonde(L.fin.arrivee) },
    dehors: versMonde(L.dehors),
  };
}
const positions = () => (enMetres ??= convertir());

/** Où l'on se trouve : hors de la forêt, dans la salle en cours, à la fin, ou ailleurs dans la forêt. */
type Lieu = "dehors" | "salle" | "fin" | "foret";

/** Direction (degrés, 0 = est, 90 = sud, comme sur la carte) d'un point vu du centre d'une salle. */
const direction = (dx: number, dz: number) => ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
const ecartAngle = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Les clairières des salles (rien n'y pousse) : centre en m et rayon. */

export function Labyrinthe() {
  const etape = useRef(0);
  const avant = useRef<Lieu>("dehors");
  const enPassage = useRef(false);
  const enMain = useJeu((s) => s.enMain);

  /** Fondu au noir, déplacement, puis retour de l'image. */
  const passer = (x: number, z: number) => {
    enPassage.current = true;
    const s = useJeu.getState();
    s.setFondu(true);
    setTimeout(() => teleporterVers(x, z), FONDU / 2);
    setTimeout(() => {
      useJeu.getState().setFondu(false);
      enPassage.current = false;
    }, FONDU);
  };

  useFrame(({ camera }) => {
    if (enPassage.current || !useJeu.getState().enJeu) return;
    const { salles, fin, dehors } = positions();
    const { x, z } = camera.position;
    const salle = salles[etape.current];
    let ici: Lieu;
    if (regionA(x, z) !== REGION) ici = "dehors";
    else if (Math.hypot(x - fin.m[0], z - fin.m[1]) < fin.rayon) ici = "fin";
    else if (Math.hypot(x - salle.m[0], z - salle.m[1]) < salle.rayon) ici = "salle";
    else ici = "foret";

    if (ici === "foret") {
      if (avant.current === "salle") {
        // On quitte la salle par un chemin : lequel ?
        const d = direction(x - salle.m[0], z - salle.m[1]);
        let k = 0;
        salle.chemins.forEach((a, j) => ecartAngle(a, d) < ecartAngle(salle.chemins[k], d) && (k = j));
        if (k === salle.bon) {
          etape.current++;
          if (etape.current >= salles.length) {
            etape.current = 0;
            passer(...fin.arrivee);
          } else passer(...salles[etape.current].m);
        } else if (etape.current === 0 && k === salle.sortie) passer(...dehors);
        else {
          etape.current = 0;
          passer(...salles[0].m);
        }
      } else if (avant.current === "fin") {
        // Revenir sur ses pas depuis le bout : on ressort de la forêt.
        passer(...dehors);
      } else {
        // On entre dans la forêt (par n'importe où) : la première salle.
        etape.current = 0;
        passer(...salles[0].m);
      }
      avant.current = "salle";
      return;
    }
    avant.current = ici;
  });

  // Le bon chemin de la salle en cours brille quand on tient l'objet.
  const lueurs = useLueurs(enMain === L.objet);
  return <Halos positions={lueurs} couleur="#d8ff7a" taille={1.3} />;
}

/** Des lueurs le long du bon chemin de chaque salle (toutes : on ne voit que celle où l'on est, dans la brume). */
function useLueurs(actif: boolean) {
  return useMemo(() => {
    if (!actif) return [];
    return positions().salles.flatMap((s) => {
      const a = (s.chemins[s.bon] * Math.PI) / 180;
      return Array.from({ length: 9 }, (_, i) => {
        const d = s.rayon * 0.4 + i * 3;
        const [x, z] = [s.m[0] + Math.cos(a) * d, s.m[1] + Math.sin(a) * d];
        return [x, hauteurTerrain(x, z) + 0.6 + (i % 2) * 0.4, z] as [number, number, number];
      });
    });
  }, [actif]);
}
