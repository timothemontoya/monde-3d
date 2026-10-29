import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FRONTIERES_MAGIQUES, REGIONS } from "../content/monde";
import type { Condition } from "../content/types";
import { remplie, useJeu } from "../game/store";
import { laCarte, MER } from "./carte";
import { flouter, hauteurTerrain } from "./relief";

/**
 * Rideau de brume magique, opaque, dressé le long de chaque frontière magique fermée
 * (ex. la forêt des sorcières : ses côtes et sa limite avec la montagne). Il se dissipe
 * quand la frontière s'ouvre. La première région de la frontière est celle que la brume entoure.
 */

const LAC = 256;
/** Les trois épaisseurs du rideau, de part et d'autre de la frontière (m). */
const COUCHES = [-7, 0, 7];
const DUREE_DISPARITION = 3;
/** Longueur sur laquelle le rideau s'estompe à ses extrémités (m). */
const FONDU_BOUTS = 80;

/**
 * Contour de la région A là où elle touche l'une des zones B (lignes de niveau 0,5 d'un masque
 * flouté, par « marching squares »). Renvoie des segments en mètres, avec la normale vers l'extérieur.
 */
function contour(a: number, b: number[]) {
  const c = laCarte();
  const L = c.largeur;
  const H = c.hauteur;
  const zoneDe = (i: number) => (c.region[i] === MER ? (c.ocean[i] ? MER : LAC) : c.region[i]);
  const masque = new Float32Array(L * H);
  for (let i = 0; i < masque.length; i++) masque[i] = c.region[i] === a ? 1 : 0;
  flouter(masque, L, H, 1);

  const monde = (i: number, j: number): [number, number] => [(i + 0.5 - L / 2) * c.pas, (j + 0.5 - H / 2) * c.pas];
  /** Point d'une arête (identifiée par une clé, partagée entre cases voisines) au niveau 0,5. */
  const arete = (i0: number, j0: number, i1: number, j1: number) => {
    const v0 = masque[j0 * L + i0];
    const v1 = masque[j1 * L + i1];
    const t = Math.min(1, Math.max(0, (0.5 - v0) / (v1 - v0 || 1)));
    const [x0, z0] = monde(i0, j0);
    const [x1, z1] = monde(i1, j1);
    return { cle: `${i0},${j0},${i1},${j1}`, x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t };
  };

  const segments: { a: ReturnType<typeof arete>; b: ReturnType<typeof arete>; nx: number; nz: number }[] = [];
  for (let j = 0; j < H - 1; j++)
    for (let i = 0; i < L - 1; i++) {
      const coins = [j * L + i, j * L + i + 1, (j + 1) * L + i + 1, (j + 1) * L + i];
      const v = coins.map((k) => masque[k]);
      const cas = (v[0] > 0.5 ? 1 : 0) | (v[1] > 0.5 ? 2 : 0) | (v[2] > 0.5 ? 4 : 0) | (v[3] > 0.5 ? 8 : 0);
      if (cas === 0 || cas === 15) continue;
      // Seulement là où A touche B (pas le long de l'entrée de la forêt, par exemple).
      if (!coins.some((k) => b.includes(zoneDe(k)))) continue;
      const e = [arete(i, j, i + 1, j), arete(i + 1, j, i + 1, j + 1), arete(i, j + 1, i + 1, j + 1), arete(i, j, i, j + 1)];
      const centre = (v[0] + v[1] + v[2] + v[3]) / 4 > 0.5;
      const paires: Record<number, [number, number][]> = {
        1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: centre ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]],
        6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: centre ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]],
        11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
      };
      // Normale vers l'extérieur : à l'opposé du gradient du masque dans la case.
      const gx = v[1] - v[0] + v[2] - v[3];
      const gz = v[3] - v[0] + v[2] - v[1];
      const n = Math.hypot(gx, gz) || 1;
      for (const [p, q] of paires[cas]) segments.push({ a: e[p], b: e[q], nx: -gx / n, nz: -gz / n });
    }
  return segments;
}

/** `hauteur` : hauteur du rideau au-dessus du sol (m) ; `fondu` : longueur où ses extrémités s'estompent (m). */
export function geometrieRideau(segments: ReturnType<typeof contour>, hauteur = 30, fondu = FONDU_BOUTS) {
  // Normales moyennées aux sommets partagés : les couches décalées restent jointives.
  const normales = new Map<string, [number, number]>();
  const voisins = new Map<string, { cle: string; l: number }[]>();
  for (const s of segments) {
    const l = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
    for (const [p, q] of [[s.a, s.b], [s.b, s.a]]) {
      const n = normales.get(p.cle) ?? [0, 0];
      normales.set(p.cle, [n[0] + s.nx, n[1] + s.nz]);
      voisins.set(p.cle, [...(voisins.get(p.cle) ?? []), { cle: q.cle, l }]);
    }
  }
  // Distance (le long du rideau) au bout le plus proche : le rideau s'y estompe au lieu d'être coupé net.
  const auBout = new Map<string, number>();
  const file: string[] = [];
  for (const [cle, v] of voisins) if (v.length === 1) (auBout.set(cle, 0), file.push(cle));
  while (file.length) {
    const cle = file.shift()!;
    const d = auBout.get(cle)!;
    for (const v of voisins.get(cle)!) {
      if (d + v.l >= (auBout.get(v.cle) ?? Infinity) || d + v.l > fondu) continue;
      auBout.set(v.cle, d + v.l);
      file.push(v.cle);
    }
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const couche: number[] = [];
  const bout: number[] = [];
  for (const [k, decalage] of COUCHES.entries())
    for (const s of segments) {
      const coins = [s.a, s.b].map((p) => {
        const [nx, nz] = normales.get(p.cle)!;
        const l = Math.hypot(nx, nz) || 1;
        const x = p.x + (nx / l) * decalage;
        const z = p.z + (nz / l) * decalage;
        const sol = hauteurTerrain(x, z);
        const f = Math.min(1, (auBout.get(p.cle) ?? fondu) / fondu);
        // On ne vole qu'à 7 m du sol : 30 m de brume suffisent, sans dresser un mur visible de toute l'île.
        return { x, z, bas: Math.min(sol, 0) - 6, haut: Math.max(sol + hauteur, hauteur + 5), f };
      });
      const [a, b] = coins;
      pos.push(a.x, a.bas, a.z, b.x, b.bas, b.z, b.x, b.haut, b.z, a.x, a.bas, a.z, b.x, b.haut, b.z, a.x, a.haut, a.z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      bout.push(a.f, b.f, b.f, a.f, b.f, a.f);
      for (let n = 0; n < 6; n++) couche.push(k);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aCouche", new THREE.Float32BufferAttribute(couche, 1));
  g.setAttribute("aBout", new THREE.Float32BufferAttribute(bout, 1));
  g.computeBoundingSphere();
  return g;
}

/** Couleurs d'un rideau : creux des volutes, volutes, et reflets. */
export type TeintesRideau = { sombre: string; clair: string; lueur: string };
const VIOLET: TeintesRideau = { sombre: "#2c2238", clair: "#6d5b8c", lueur: "#a77ae8" };

export function materiauRideau(t: TeintesRideau = VIOLET) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTemps: { value: 0 },
        uDisparition: { value: 0 },
        uPlein: { value: 0 },
        uSeuil: { value: 0 },
        uSombre: { value: new THREE.Color(t.sombre) },
        uClair: { value: new THREE.Color(t.clair) },
        uLueur: { value: new THREE.Color(t.lueur) },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aCouche;
      attribute float aBout;
      varying vec3 vMonde;
      varying float vHaut;
      varying float vCouche;
      varying float vBout;
      void main() {
        vec4 monde = modelMatrix * vec4(position, 1.0);
        vMonde = monde.xyz;
        vHaut = uv.y;
        vCouche = aCouche;
        vBout = aBout;
        vec4 mvPosition = viewMatrix * monde;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTemps;
      uniform float uDisparition;
      uniform float uPlein;
      uniform float uSeuil;
      uniform vec3 uSombre;
      uniform vec3 uClair;
      uniform vec3 uLueur;
      varying vec3 vMonde;
      varying float vHaut;
      varying float vCouche;
      varying float vBout;

      float h3(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.zyx + 31.32);
        return fract((p.x + p.y) * p.z);
      }
      float bruit3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(h3(i), h3(i + vec3(1.0, 0.0, 0.0)), u.x), mix(h3(i + vec3(0.0, 1.0, 0.0)), h3(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
          mix(mix(h3(i + vec3(0.0, 0.0, 1.0)), h3(i + vec3(1.0, 0.0, 1.0)), u.x), mix(h3(i + vec3(0.0, 1.0, 1.0)), h3(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
          u.z);
      }
      float fbm3(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int k = 0; k < 4; k++) {
          v += a * bruit3(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v / 0.9375;
      }

      void main() {
        // Volutes qui montent lentement ; chaque couche a les siennes.
        vec3 p = (vMonde + 4096.0) * 0.018 + vec3(vCouche * 7.3, -uTemps * 0.06, uTemps * 0.025);
        float n = fbm3(p);
        float volutes = fbm3(p * 2.6 + n * 1.6);
        // Totalement opaque dans le bas, à peine moins vers le haut.
        float densite = mix(1.0, 0.82 + 0.18 * smoothstep(0.3, 0.7, n), smoothstep(0.2, 0.45, vHaut));
        // Un rideau plein : opaque jusqu'à son sommet effiloché (rien ne transparaît derrière).
        densite = mix(densite, 1.0, uPlein);
        // Le haut du rideau s'effiloche, ses extrémités aussi.
        float haut = 1.0 - smoothstep(mix(0.25, 0.32, uPlein) + 0.25 * n, mix(0.9, 1.0, uPlein), vHaut);
        float bouts = smoothstep(0.0, 1.0, vBout * (0.7 + 0.6 * volutes));
        // De loin, il s'efface là où la brume du monde cache déjà tout (sinon : un bloc pâle sur le ciel).
        float loin = 1.0;
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float voile = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            float voile = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          loin = 1.0 - smoothstep(0.55, 0.9, voile);
        #endif
        vec3 c = mix(uSombre, uClair, smoothstep(0.35, 0.85, volutes));
        c += uLueur * pow(max(volutes - 0.55, 0.0) * 2.2, 2.0) * 0.7;
        float alpha = densite * haut * bouts * loin * (1.0 - uDisparition);
        // Passe de profondeur : là où la brume est épaisse, elle cache aussi l'encre des contours de derrière.
        if (alpha < uSeuil) discard;
        // Dans la passe de profondeur, la profondeur fuit vers le lointain à mesure que la brume
        // s'efface : pas de marche nette, donc pas de trait d'encre sur son bord effiloché.
        gl_FragDepth = uSeuil > 0.0 ? mix(gl_FragCoord.z, 1.0, 1.0 - alpha) : gl_FragCoord.z;
        gl_FragColor = vec4(c, alpha);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

const zoneDe = (id: string) => (id === "mer" ? MER : REGIONS.findIndex((r) => r.id === id));

/** Un rideau : autour d'une région, face à une ou plusieurs zones, avec la même condition d'ouverture. */
type Groupe = { interieur: number; exterieurs: number[]; quand?: Condition };

function Rideau({ groupe }: { groupe: Groupe }) {
  const geometrie = useMemo(() => {
    const segments = contour(groupe.interieur, groupe.exterieurs);
    return segments.length ? geometrieRideau(segments) : null;
  }, [groupe]);
  const materiau = useMemo(() => materiauRideau(), []);
  const ouverte = useJeu((s) => groupe.quand !== undefined && remplie(groupe.quand, s));
  const disparition = useRef(ouverte ? 1 : 0);
  useFrame((state, delta) => {
    if (ouverte) disparition.current = Math.min(1, disparition.current + delta / DUREE_DISPARITION);
    materiau.uniforms.uTemps.value = state.clock.elapsedTime;
    materiau.uniforms.uDisparition.value = disparition.current;
  });
  if (!geometrie || disparition.current >= 1) return null;
  return <mesh geometry={geometrie} material={materiau} renderOrder={2} frustumCulled={false} />;
}

export function BrumeSorcieres() {
  // Les frontières d'une même région qui s'ouvrent ensemble forment un seul rideau continu
  // (pas de trou là où la forêt, la montagne et la mer se rejoignent).
  const groupes = useMemo(() => {
    const parCle = new Map<string, Groupe>();
    for (const f of FRONTIERES_MAGIQUES) {
      const [a, b] = f.regions.map(zoneDe);
      const [interieur, exterieur] = a === MER ? [b, a] : [a, b];
      const cle = `${interieur}|${JSON.stringify(f.quand ?? null)}`;
      const g = parCle.get(cle) ?? { interieur, exterieurs: [], quand: f.quand };
      g.exterieurs.push(exterieur);
      parCle.set(cle, g);
    }
    return [...parCle.values()];
  }, []);
  return (
    <>
      {groupes.map((g, i) => (
        <Rideau key={i} groupe={g} />
      ))}
    </>
  );
}
