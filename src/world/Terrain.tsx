import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { VILLAGES } from "../content/monde";
import { bornes, laCarte, versMonde } from "./carte";
import { FOND_MARIN, NEIGE, SABLE, texturesSol } from "./couleurs";
import { SOLEIL } from "./Atmosphere";
import { texturesTraces } from "./Chemins";
import { hauteurTerrain, NIVEAU_MER } from "./relief";

/**
 * Le sol est découpé en tuiles de 256 m. Chaque tuile est détaillée près du joueur
 * (un sommet tous les 4 m) et grossière au loin, où la brume la cache de toute façon.
 */
const TUILE = 256;
const NIVEAUX = [
  { jusqua: 420, pas: 4 },
  { jusqua: 1400, pas: 16 },
  { jusqua: Infinity, pas: 64 },
];
/** Marge avant de redescendre en détail (évite les allers-retours à la limite). */
const HYSTERESIS = 60;
/** Temps de calcul accordé aux tuiles à chaque image, en ms. */
const BUDGET = 5;

// ─── Géométrie d'une tuile ──────────────────────────────────────────────────

const indexParTaille = new Map<number, Uint16Array>();

/** Triangles d'une tuile de n × n cases, plus la jupe (pourtour recopié plus bas, sur ses deux faces). */
function indexTuile(n: number) {
  const deja = indexParTaille.get(n);
  if (deja) return deja;
  const m = n + 1;
  const index: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * m + i;
      const b = a + 1;
      const c = a + m;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  const nbBord = 4 * n;
  for (let k = 0; k < nbBord; k++) {
    const s0 = bord(n, k);
    const s1 = bord(n, (k + 1) % nbBord);
    const t0 = m * m + k;
    const t1 = m * m + ((k + 1) % nbBord);
    index.push(s0, t0, s1, s1, t0, t1, s0, s1, t0, s1, t1, t0);
  }
  const tableau = new Uint16Array(index);
  indexParTaille.set(n, tableau);
  return tableau;
}

/** k-ième sommet du pourtour d'une tuile de n cases, en tournant (haut, droite, bas, gauche). */
function bord(n: number, k: number) {
  const m = n + 1;
  if (k < n) return k;
  if (k < 2 * n) return (k - n) * m + n;
  if (k < 3 * n) return n * m + (3 * n - k);
  return (4 * n - k) * m;
}

/** Construit la tuile dont le coin nord-ouest est (x0, z0), avec un sommet tous les `pas` m. */
function construireTuile(x0: number, z0: number, pas: number) {
  const n = TUILE / pas;
  const m = n + 1;
  // Grille élargie de deux sommets de chaque côté : les normales se raccordent entre tuiles voisines.
  const e = n + 5;
  const h = new Float32Array(e * e);
  for (let j = 0; j < e; j++) for (let i = 0; i < e; i++) h[j * e + i] = hauteurTerrain(x0 + (i - 2) * pas, z0 + (j - 2) * pas);

  const total = m * m + 4 * n;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  for (let j = 0; j < m; j++)
    for (let i = 0; i < m; i++) {
      const k = (j * m + i) * 3;
      const ie = (j + 2) * e + i + 2;
      // Pente lissée sur deux écarts : la lumière ne dessine pas les facettes du maillage.
      const gx = ((h[ie + 1] - h[ie - 1]) * 2 + (h[ie + 2] - h[ie - 2])) / (8 * pas);
      const gz = ((h[ie + e] - h[ie - e]) * 2 + (h[ie + 2 * e] - h[ie - 2 * e])) / (8 * pas);
      const l = Math.hypot(gx, 1, gz);
      pos[k] = x0 + i * pas;
      pos[k + 1] = h[ie];
      pos[k + 2] = z0 + j * pas;
      nor[k] = -gx / l;
      nor[k + 1] = 1 / l;
      nor[k + 2] = -gz / l;
    }
  // Jupe : cache les fentes entre une tuile détaillée et sa voisine plus grossière.
  const profondeur = pas * 0.8 + 6;
  for (let k = 0; k < 4 * n; k++) {
    const s = bord(n, k) * 3;
    const t = (m * m + k) * 3;
    pos[t] = pos[s];
    pos[t + 1] = pos[s + 1] - profondeur;
    pos[t + 2] = pos[s + 2];
    nor[t] = nor[s];
    nor[t + 1] = nor[s + 1];
    nor[t + 2] = nor[s + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(indexTuile(n), 1));
  g.computeBoundingSphere();
  return g;
}

// ─── Matériau : couleur calculée pour chaque pixel, en coordonnées du monde ─

/** Places de terre battue au centre des villages en anneaux : (x, z, rayon), jusqu'à MAX_PLACES. */
const MAX_PLACES = 8;
export function placesVillages() {
  const places = VILLAGES.filter((v) => v.disposition?.type === "place" && v.plateau !== false).map((v) => {
    const [x, z] = versMonde(v.centre);
    return new THREE.Vector3(x, z, Math.max(10, v.rayon * 0.3) + 2);
  });
  while (places.length < MAX_PLACES) places.push(new THREE.Vector3(0, 0, 0));
  return places.slice(0, MAX_PLACES);
}

const GLSL_SOL = /* glsl */ `
uniform sampler2D uHerbe;
uniform sampler2D uRoche;
uniform vec2 uTaille;
uniform vec3 uSable;
uniform vec3 uFond;
uniform vec3 uNeige;
// Places des villages en terre battue : (x, z, rayon) en m.
uniform vec3 uPlaces[${MAX_PLACES}];
// Chemins, lave et veines peints dans le sol (Chemins.tsx) : couleur + présence, et ce qui brille.
uniform sampler2D uTraces;
uniform sampler2D uLueurs;
uniform float uTemps;
varying vec3 vPosMonde;
varying vec3 vNormaleMonde;

float hashSol(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// Bruit de valeur périodique (période en cases) : aucune perte de précision loin du centre du monde.
float bruitSol(vec2 p, float periode) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hashSol(mod(i, periode));
  float b = hashSol(mod(i + vec2(1.0, 0.0), periode));
  float c = hashSol(mod(i + vec2(0.0, 1.0), periode));
  float d = hashSol(mod(i + vec2(1.0, 1.0), periode));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// p : mètres ramenés dans [0, 2048[ · f : cases par mètre, avec 2048 × f entier.
float fbmSol(vec2 p, float f) {
  float v = 0.0;
  float amp = 0.5;
  for (int k = 0; k < 3; k++) {
    v += amp * bruitSol(p * f, 2048.0 * f);
    f *= 2.0;
    amp *= 0.5;
  }
  return v / 0.875;
}
// Roche projetée sur les trois plans (pas d'étirement sur les parois verticales).
float rocheTriplanaire(vec3 q, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= w.x + w.y + w.z;
  float f = 1.0 / 8.0;
  return w.x * fbmSol(q.zy, f) + w.y * fbmSol(q.xz, f) + w.z * fbmSol(q.xy, f);
}

// Petit relief dessiné pixel par pixel (motte, grain) : la lumière ne dessine plus les facettes du maillage.
vec3 bosselage(vec3 pos) {
  vec2 q = mod(pos.xz + 4096.0, 2048.0);
  float e = 0.5;
  float f0 = fbmSol(q, 1.0 / 8.0);
  float fx = fbmSol(q + vec2(e, 0.0), 1.0 / 8.0);
  float fz = fbmSol(q + vec2(0.0, e), 1.0 / 8.0);
  return vec3(fx - f0, 0.0, fz - f0) / e;
}

vec3 couleurSol(vec3 pos, vec3 n) {
  vec2 uv = pos.xz / uTaille + 0.5;
  vec4 texHerbe = texture2D(uHerbe, uv);
  vec3 herbe = texHerbe.rgb;
  vec3 roche = texture2D(uRoche, uv).rgb;
  vec3 q = mod(pos + 4096.0, 2048.0);
  float grandes = fbmSol(q.xz, 1.0 / 64.0);
  float moyennes = fbmSol(q.xz, 1.0 / 8.0);
  float grain = bruitSol(q.xz, 2048.0);
  // Grain fin, pour les vues de près (25 cm).
  float fin = bruitSol(q.xz * 4.0, 8192.0);

  // Herbe : taches de clarté, endroits plus verts ou plus secs.
  vec3 c = herbe * (0.8 + 0.32 * grandes) * (0.88 + 0.22 * moyennes) * (0.93 + 0.1 * grain + 0.06 * fin);
  // (pas sur les sols clairs : la neige resterait jaunie)
  vec3 teinte = mix(vec3(0.9, 1.05, 0.88), vec3(1.1, 0.98, 0.8), fbmSol(q.xz + 517.0, 1.0 / 32.0));
  c *= mix(vec3(1.0), teinte, 1.0 - smoothstep(0.55, 0.8, dot(herbe, vec3(0.333))));

  // Roche sur les pentes, avec des strates sur les parois.
  float pente = 1.0 - n.y;
  float r = rocheTriplanaire(q, n);
  vec3 cRoche = roche * (0.72 + 0.5 * r) * (0.92 + 0.16 * fin);
  // Strates larges, discrètes sur la roche claire (sinon la glace semble ondulée).
  float strates = 0.5 + 0.5 * sin(pos.y * 0.35 + r * 6.0);
  float clair = smoothstep(0.55, 0.75, dot(roche, vec3(0.333)));
  cRoche *= mix(1.0, mix(0.82 + 0.3 * strates, 0.94 + 0.12 * strates, clair), smoothstep(0.3, 0.7, pente));
  float tRoche = smoothstep(0.12, 0.38, pente + (moyennes - 0.5) * 0.2);
  c = mix(c, cRoche, tRoche);

  // Places des villages : de la terre battue, au bord irrégulier.
  for (int i = 0; i < ${MAX_PLACES}; i++) {
    vec3 pl = uPlaces[i];
    if (pl.z <= 0.0) continue;
    float d = distance(pos.xz, pl.xy) + (moyennes - 0.5) * 6.0;
    float t = 1.0 - smoothstep(pl.z - 3.0, pl.z, d);
    vec3 terre = mix(vec3(0.54, 0.42, 0.28), vec3(0.66, 0.55, 0.38), grain) * (0.9 + 0.2 * fin);
    c = mix(c, terre, t * (1.0 - tRoche));
  }

  // Plages, juste au-dessus de l'eau.
  float tSable = 1.0 - smoothstep(1.6, 3.4, pos.y + (moyennes - 0.5) * 1.4);
  c = mix(c, uSable * (0.9 + 0.16 * grain), tSable * (1.0 - tRoche * 0.7));
  // Fond marin, de plus en plus sombre.
  c = mix(c, uFond, 1.0 - smoothstep(-6.0, -0.5, pos.y));
  // Neige sur les hauteurs, pas sur les parois.
  float tNeige = smoothstep(95.0, 125.0, pos.y + (grandes - 0.5) * 20.0) * (1.0 - smoothstep(0.35, 0.6, pente)) * texHerbe.a;
  c = mix(c, uNeige, tNeige);

  // Chemins (au bord irrégulier, qui s'efface dans l'eau), lave et veines d'or.
  vec4 trace = texture2D(uTraces, uv);
  float lueur = texture2D(uLueurs, uv).r;
  float tTrace = smoothstep(0.2, 0.55, trace.a + (moyennes - 0.5) * 0.3) * smoothstep(0.4, 1.2, pos.y);
  c = mix(c, trace.rgb * (0.86 + 0.2 * grain + 0.08 * fin), tTrace);
  // Sous ce qui brille, une croûte sombre : la lumière vient de l'émission (lueurSol).
  return mix(c, trace.rgb * 0.25, smoothstep(0.1, 0.6, lueur));
}

// Lave et veines : une lumière qui coule (taches claires qui glissent) et pulse doucement.
vec3 lueurSol(vec3 pos) {
  vec2 uv = pos.xz / uTaille + 0.5;
  float g = smoothstep(0.1, 0.7, texture2D(uLueurs, uv).r);
  if (g <= 0.0) return vec3(0.0);
  vec3 couleur = texture2D(uTraces, uv).rgb;
  vec2 q = mod(pos.xz + 4096.0, 2048.0);
  float t = mod(uTemps, 2048.0);
  float coule = fbmSol(q + vec2(t * 1.6, t * 0.9), 1.0 / 4.0);
  float pulse = 0.8 + 0.2 * sin(uTemps * 1.4 + q.x * 0.04 + q.y * 0.03);
  return couleur * g * (0.7 + 1.6 * smoothstep(0.3, 0.75, coule)) * pulse * 1.6;
}
`;

function materiauTerrain() {
  const { herbe, roche } = texturesSol();
  const c = laCarte();
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const uniforms = {
    uHerbe: { value: herbe },
    uRoche: { value: roche },
    uTaille: { value: new THREE.Vector2(c.largeur * c.pas, c.hauteur * c.pas) },
    uSable: { value: new THREE.Color(SABLE) },
    uFond: { value: new THREE.Color(FOND_MARIN) },
    uNeige: { value: new THREE.Color(NEIGE) },
    uPlaces: { value: placesVillages() },
    uTraces: { value: texturesTraces().couleur },
    uLueurs: { value: texturesTraces().lueur },
    uTemps: { value: 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosMonde;\nvarying vec3 vNormaleMonde;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPosMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNormaleMonde = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL_SOL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = couleurSol(vPosMonde, normalize(vNormaleMonde));")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += lueurSol(vPosMonde);")
      // La normale (en repère caméra) penche selon le petit relief, d'autant moins qu'on est loin.
      .replace(
        "#include <normal_fragment_begin>",
        // (seulement sur les sols peu pentus : sur une paroi, ce relief « à plat » n'aurait pas de sens).
        "#include <normal_fragment_begin>\nnormal = normalize(normal - (viewMatrix * vec4(bosselage(vPosMonde), 0.0)).xyz * 1.2 * smoothstep(0.75, 0.95, vNormaleMonde.y) * (1.0 - smoothstep(60.0, 220.0, length(vPosMonde - cameraPosition))));",
      );
  };
  m.customProgramCacheKey = () => "terrain-v3";
  m.userData.uniforms = uniforms;
  return m;
}

// ─── Gestion des tuiles ─────────────────────────────────────────────────────

type Tuile = { x0: number; z0: number; mesh: THREE.Mesh; niveau: number };

/** Construit tout de suite les tuiles proches d'un point (avant une téléportation). */
let prechauffer: (x: number, z: number) => void = () => {};
export const prechaufferTerrain = (x: number, z: number) => prechauffer(x, z);

const distanceTuile = (t: Tuile, x: number, z: number) =>
  Math.hypot(Math.max(t.x0 - x, 0, x - t.x0 - TUILE), Math.max(t.z0 - z, 0, z - t.z0 - TUILE));

const niveauVoulu = (d: number) => NIVEAUX.findIndex((n) => d < n.jusqua);

/**
 * Sol du monde. `pasFixe` (vues aériennes) : toutes les tuiles au même détail, sans mise à jour.
 * `depart` : point autour duquel le détail est construit dès le début.
 */
export function Terrain({ pasFixe, depart }: { pasFixe?: number; depart?: [number, number] }) {
  const materiau = useMemo(() => materiauTerrain(), []);
  const camera = useThree((s) => s.camera);

  const { groupe, tuiles } = useMemo(() => {
    const { demiLargeur, demiHauteur } = bornes();
    const groupe = new THREE.Group();
    const tuiles: Tuile[] = [];
    const niveauInitial = pasFixe ? NIVEAUX.findIndex((n) => n.pas === pasFixe) : NIVEAUX.length - 1;
    const pas = pasFixe ?? NIVEAUX[niveauInitial].pas;
    for (let z0 = -demiHauteur; z0 < demiHauteur; z0 += TUILE)
      for (let x0 = -demiLargeur; x0 < demiLargeur; x0 += TUILE) {
        const mesh = new THREE.Mesh(construireTuile(x0, z0, pas), materiau);
        mesh.receiveShadow = true;
        groupe.add(mesh);
        tuiles.push({ x0, z0, mesh, niveau: niveauInitial });
      }
    return { groupe, tuiles };
  }, [materiau, pasFixe]);

  const changer = (t: Tuile, niveau: number) => {
    const ancienne = t.mesh.geometry;
    t.mesh.geometry = construireTuile(t.x0, t.z0, NIVEAUX[niveau].pas);
    ancienne.dispose();
    t.niveau = niveau;
  };

  // Avant la première image : le détail autour du point de départ.
  useLayoutEffect(() => {
    if (pasFixe) return;
    prechauffer = (x, z) => {
      for (const t of tuiles) {
        const voulu = niveauVoulu(distanceTuile(t, x, z));
        if (voulu < t.niveau) changer(t, voulu);
      }
    };
    if (depart) prechauffer(...depart);
    return () => {
      prechauffer = () => {};
    };
  }, [tuiles, pasFixe, depart]);

  useEffect(() => () => tuiles.forEach((t) => t.mesh.geometry.dispose()), [tuiles]);

  useFrame(({ clock }) => {
    materiau.userData.uniforms.uTemps.value = clock.elapsedTime;
    if (pasFixe) return;
    const { x, z } = camera.position;
    const debut = performance.now();
    // D'abord plus de détail là où il en manque (du plus proche au plus loin), puis l'allègement.
    const aAffiner: [number, Tuile, number][] = [];
    const aAlleger: [number, Tuile, number][] = [];
    for (const t of tuiles) {
      const d = distanceTuile(t, x, z);
      const voulu = niveauVoulu(d);
      if (voulu < t.niveau) aAffiner.push([d, t, voulu]);
      else if (voulu > t.niveau && d > NIVEAUX[t.niveau].jusqua + HYSTERESIS) aAlleger.push([d, t, voulu]);
    }
    aAffiner.sort((a, b) => a[0] - b[0]);
    for (const [, t, voulu] of [...aAffiner, ...aAlleger]) {
      changer(t, voulu);
      if (performance.now() - debut > BUDGET) break;
    }
  });

  return <primitive object={groupe} />;
}

/** La mer : une grande surface légèrement transparente. */
/** Profondeur de l'eau en chaque cellule de carte (0 sur terre, 1 à 24 m et plus), pour colorer la mer. */
function textureProfondeur() {
  const c = laCarte();
  const donnees = new Uint8Array(c.largeur * c.hauteur);
  for (let j = 0; j < c.hauteur; j++)
    for (let i = 0; i < c.largeur; i++) {
      const x = (i + 0.5 - c.largeur / 2) * c.pas;
      const z = (j + 0.5 - c.hauteur / 2) * c.pas;
      donnees[j * c.largeur + i] = Math.min(255, Math.max(0, (NIVEAU_MER - hauteurTerrain(x, z)) * (255 / PROFONDEUR_MAX)));
    }
  const t = new THREE.DataTexture(donnees, c.largeur, c.hauteur, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
/** Profondeur codée au plus (m) : au-delà, c'est le large. */
const PROFONDEUR_MAX = 24;

/**
 * La mer : turquoise clair sur les hauts-fonds, bleu profond au large, une ligne d'écume
 * animée le long des côtes, et des reflets du soleil qui scintillent sur les vaguelettes.
 */
function materiauEau() {
  const c = laCarte();
  return new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uProfondeur: { value: null },
        uTaille: { value: new THREE.Vector2(c.largeur * c.pas, c.hauteur * c.pas) },
        uTemps: { value: 0 },
        uSoleil: { value: SOLEIL.clone() },
        uClair: { value: new THREE.Color("#5cbdb3") },
        uMoyen: { value: new THREE.Color("#2a7e94") },
        uProfond: { value: new THREE.Color("#1b4a62") },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vMonde;
      #include <fog_pars_vertex>
      void main() {
        vec4 monde = modelMatrix * vec4(position, 1.0);
        vMonde = monde.xyz;
        vec4 mvPosition = viewMatrix * monde;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uProfondeur;
      uniform vec2 uTaille;
      uniform float uTemps;
      uniform vec3 uSoleil, uClair, uMoyen, uProfond;
      varying vec3 vMonde;
      #include <fog_pars_fragment>
      void main() {
        vec2 uv = vMonde.xz / uTaille + 0.5;
        bool dedans = all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)));
        float d = dedans ? texture2D(uProfondeur, uv).r * ${PROFONDEUR_MAX.toFixed(1)} : ${PROFONDEUR_MAX.toFixed(1)};
        vec3 c = mix(uClair, uMoyen, smoothstep(0.5, 6.0, d));
        c = mix(c, uProfond, smoothstep(6.0, 20.0, d));
        // Vaguelettes : une normale qui ondule, pour les reflets du soleil.
        vec2 p = vMonde.xz;
        vec3 n = normalize(vec3(
          sin(p.x * 0.21 + uTemps * 1.1) * 0.06 + sin(p.y * 0.37 - uTemps * 0.7 + p.x * 0.1) * 0.05,
          1.0,
          cos(p.y * 0.19 + uTemps * 0.9) * 0.06 + sin(p.x * 0.33 + p.y * 0.12 + uTemps * 1.3) * 0.05));
        vec3 vue = normalize(cameraPosition - vMonde);
        float reflet = pow(max(dot(reflect(-uSoleil, n), vue), 0.0), 90.0);
        c += vec3(1.0, 0.95, 0.85) * reflet * 0.9;
        // Écume : une bande claire au rivage, qui va et vient.
        float vague = 0.5 + 0.5 * sin(d * 5.0 - uTemps * 1.6 + sin(p.x * 0.05 + p.y * 0.04) * 3.0);
        float ecume = (1.0 - smoothstep(0.0, 0.7, d)) + (1.0 - smoothstep(0.6, 1.6, d)) * smoothstep(0.75, 0.95, vague) * 0.8;
        c = mix(c, vec3(0.97, 0.98, 0.96), clamp(ecume, 0.0, 1.0) * 0.85);
        gl_FragColor = vec4(c, mix(0.72, 0.95, smoothstep(0.3, 8.0, d)));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

export function Eau() {
  const { demiLargeur, demiHauteur } = bornes();
  const materiau = useMemo(() => {
    const m = materiauEau();
    m.uniforms.uProfondeur.value = textureProfondeur();
    return m;
  }, []);
  useFrame((state) => {
    materiau.uniforms.uTemps.value = state.clock.elapsedTime;
  });
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={NIVEAU_MER} material={materiau}>
        <planeGeometry args={[demiLargeur * 2 + 4000, demiHauteur * 2 + 4000]} />
      </mesh>
      {/* Fond marin au-delà de la carte : sous l'eau translucide, le bord du relief ne se voit plus. */}
      <mesh rotation-x={-Math.PI / 2} position-y={NIVEAU_MER - 16}>
        <planeGeometry args={[demiLargeur * 2 + 4000, demiHauteur * 2 + 4000]} />
        <meshStandardMaterial color={FOND_MARIN} roughness={1} />
      </mesh>
    </>
  );
}
