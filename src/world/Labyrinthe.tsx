import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { INDICES, LABYRINTHE, REGIONS } from "../content/monde";
import { useJeu } from "../game/store";
import { ciel } from "../game/temps";
import { teleporterVers } from "../player/Joueur";
import { laCarte, regionA, versMonde } from "./carte";
import { geometrieRideau, materiauRideau } from "./BrumeSorcieres";
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
  return (
    <>
      <Halos positions={lueurs} couleur="#d8ff7a" taille={1.3} />
      <BrumeLabyrinthe />
    </>
  );
}

/** Le rideau de brume se tient au-delà des lueurs du bon chemin (m), et autour du village du bout. */
const AU_DELA_SALLE = 13;
const AU_DELA_FIN = 2;
/** Assez haute pour qu'aucun arbre ni toit ne dépasse (m). */
const HAUTEUR_BRUME = 70;
/** Depuis la stèle du bout, une trouée dans la brume laisse voir la Fracture d'or (demi-angle, en radians). */
const STELE = "stele-fracture";
const TROUEE = 0.4;

/** Centre de la Fracture d'or (m) : la moyenne des cases de sa région. */
function centreFracture(): [number, number] | null {
  const c = laCarte();
  const r = REGIONS.findIndex((x) => x.id === "fracture-or");
  let [sx, sz, n] = [0, 0, 0];
  for (let j = 0; j < c.hauteur; j++)
    for (let i = 0; i < c.largeur; i++)
      if (c.region[j * c.largeur + i] === r) [sx, sz, n] = [sx + i, sz + j, n + 1];
  return n ? [(sx / n + 0.5 - c.largeur / 2) * c.pas, (sz / n + 0.5 - c.hauteur / 2) * c.pas] : null;
}

const COULEURS_BRUME = { sombre: "#93ad86", clair: "#e2efd2", lueur: "#f4ffd8" };

/**
 * Un anneau de brume opaque autour de chaque salle et du village du bout : de l'intérieur, on ne
 * voit pas le reste de la forêt (ni le dehors) ; du dehors, on ne voit pas le village.
 */
function BrumeLabyrinthe() {
  const geometrie = useMemo(() => {
    const { salles, fin } = positions();
    // Les anneaux ne doivent jamais se croiser : on verrait l'arête de l'un depuis l'autre.
    const cercles = [...salles.map((s) => ({ m: s.m, r: s.rayon + AU_DELA_SALLE, i: 0.1 })), { m: fin.m, r: fin.rayon + AU_DELA_FIN, i: 0.06 }];
    const stele = INDICES.find((x) => x.id === STELE);
    const [px, pz] = stele ? versMonde(stele.position) : [0, 0];
    const fracture = stele && centreFracture();
    const versFracture = fracture ? Math.atan2(fracture[1] - pz, fracture[0] - px) : 0;
    /** Ce bout d'anneau est-il dans l'axe de la stèle vers la Fracture ? */
    const dansTrouee = (x: number, z: number) => !!fracture && Math.abs(Math.atan2(Math.sin(Math.atan2(z - pz, x - px) - versFracture), Math.cos(Math.atan2(z - pz, x - px) - versFracture))) < TROUEE;
    const segments = cercles.flatMap(({ m: [cx, cz], r, i: irregulier }, k) => {
      const n = Math.max(24, Math.round((2 * Math.PI * r) / 6));
      // Un contour irrégulier : un banc de brume, pas un cylindre.
      const point = (i: number) => {
        const a = ((i % n) / n) * Math.PI * 2;
        const rr = r * (1 + irregulier * Math.sin(3 * a + k) + irregulier * 0.5 * Math.sin(7 * a + 2 * k));
        return { cle: `${k}:${i % n}`, x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr };
      };
      return Array.from({ length: n }, (_, i) => {
        const a = ((i + 0.5) / n) * Math.PI * 2;
        return { a: point(i), b: point(i + 1), nx: Math.cos(a), nz: Math.sin(a) };
      }).filter((sg) => k < salles.length || !dansTrouee((sg.a.x + sg.b.x) / 2, (sg.a.z + sg.b.z) / 2));
    });
    return geometrieRideau(segments, HAUTEUR_BRUME, 18);
  }, []);
  const materiau = useMemo(() => {
    const m = materiauRideau(COULEURS_BRUME);
    m.uniforms.uPlein.value = 1;
    return m;
  }, []);
  // La même brume, invisible, écrit sa profondeur là où elle est épaisse : les contours à l'encre
  // (qui lisent la profondeur) ne dessinent plus les arbres cachés derrière.
  const profondeur = useMemo(() => {
    const m = materiau.clone();
    m.uniforms = materiau.uniforms;
    m.transparent = false;
    m.depthWrite = true;
    m.colorWrite = false;
    return m;
  }, [materiau]);
  const teintes = useMemo(() => Object.values(COULEURS_BRUME).map((c) => new THREE.Color(c)), []);
  useFrame((state) => {
    const u = materiau.uniforms;
    u.uTemps.value = state.clock.elapsedTime;
    // La nuit, la brume n'est plus éclairée : elle s'assombrit avec le reste.
    const k = 0.22 + 0.78 * ciel.jour;
    [u.uSombre, u.uClair, u.uLueur].forEach((x, i) => x.value.copy(teintes[i]).multiplyScalar(k));
  });
  return (
    <>
      <mesh geometry={geometrie} material={profondeur} onBeforeRender={() => (materiau.uniforms.uSeuil.value = 0.02)} onAfterRender={() => (materiau.uniforms.uSeuil.value = 0)} frustumCulled={false} />
      <mesh geometry={geometrie} material={materiau} renderOrder={2} frustumCulled={false} />
    </>
  );
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
