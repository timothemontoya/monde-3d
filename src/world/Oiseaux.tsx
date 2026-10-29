import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { REGIONS } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { ciel } from "../game/temps";
import { LEGER } from "../qualite";
import { laCarte, MER, regionA } from "./carte";
import { graine, hauteurSol } from "./relief";

// Des vols d'oiseaux qui tournent haut au-dessus des terres, le jour : des silhouettes sombres
// (comme l'encre des contours) dont les ailes battent dans le shader. Seuls les vols proches sont dessinés.

/** Nombre de vols sur toute la carte, oiseaux par vol au plus, et distance à laquelle on les voit (m). */
const VOLS = LEGER ? 50 : 90;
const PAR_VOL = 8;
const PORTEE = 650;
/** Là où rien ne vole. */
const SANS_OISEAUX = new Set(["glace", "iceberg", "royaume-glace", "palais-givre", "ile-volcan", "fracture-or"]);

type Vol = { x: number; z: number; y: number; rayon: number; vitesse: number; n: number; decalages: [number, number, number][] };

function lesVols(): Vol[] {
  const c = laCarte();
  const hasard = graine(4242);
  const [lx, lz] = [c.largeur * c.pas, c.hauteur * c.pas];
  const vols: Vol[] = [];
  for (let essai = 0; vols.length < VOLS && essai < VOLS * 40; essai++) {
    const x = (hasard() - 0.5) * lx;
    const z = (hasard() - 0.5) * lz;
    const r = regionA(x, z);
    if (r === MER || SANS_OISEAUX.has(REGIONS[r]?.id)) continue;
    const n = 3 + Math.floor(hasard() * (PAR_VOL - 2));
    vols.push({
      x,
      z,
      y: Math.max(hauteurSol(x, z), 0) + 35 + hasard() * 35,
      rayon: 18 + hasard() * 40,
      vitesse: (0.18 + hasard() * 0.15) * (hasard() < 0.5 ? -1 : 1),
      n,
      decalages: Array.from({ length: n }, () => [(hasard() - 0.5) * 14, (hasard() - 0.5) * 5, (hasard() - 0.5) * 14] as [number, number, number]),
    });
  }
  return vols;
}

/** Un oiseau : un petit corps et deux ailes triangulaires (envergure ~2 m), tourné vers +X. */
function geometrieOiseau() {
  const p = [
    // Ailes
    0.3, 0, 0, -0.25, 0, 0, 0, 0, 1,
    0.3, 0, 0, 0, 0, -1, -0.25, 0, 0,
    // Corps et queue
    0.55, 0, 0, -0.5, 0, 0.12, -0.5, 0, -0.12,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  return g;
}

export function Oiseaux() {
  const vols = useMemo(lesVols, []);
  const temps = useMemo(() => ({ value: 0 }), []);
  const maillage = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: "#2a221d", side: THREE.DoubleSide, transparent: true });
    m.onBeforeCompile = (s) => {
      s.uniforms.uTemps = temps;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTemps;")
        .replace(
          "#include <begin_vertex>",
          // Battement : le bout des ailes monte et descend, chaque oiseau à son rythme.
          "#include <begin_vertex>\nfloat battement = sin(uTemps * 9.0 + float(gl_InstanceID) * 1.7);\ntransformed.y += battement * abs(position.z) * 0.55;",
        );
    };
    const im = new THREE.InstancedMesh(geometrieOiseau(), m, VOLS * PAR_VOL);
    im.frustumCulled = false;
    im.count = 0;
    return im;
  }, [temps]);
  const aide = useMemo(() => ({ o: new THREE.Object3D() }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    temps.value = t;
    const visibles = ciel.jour > 0.15;
    maillage.visible = visibles;
    (maillage.material as THREE.MeshBasicMaterial).opacity = Math.min(1, (ciel.jour - 0.15) * 4);
    if (!visibles) return;
    const { o } = aide;
    let i = 0;
    for (const [k, v] of vols.entries()) {
      if (Math.hypot(v.x - positionJoueur.x, v.z - positionJoueur.z) > PORTEE) continue;
      const a = t * v.vitesse + k;
      const cx = v.x + Math.cos(a) * v.rayon;
      const cz = v.z + Math.sin(a) * v.rayon;
      // Cap : tangent au cercle, dans le sens du vol.
      const cap = Math.atan2(Math.cos(a) * Math.sign(v.vitesse), -Math.sin(a) * Math.sign(v.vitesse));
      for (let b = 0; b < v.n; b++) {
        const [dx, dy, dz] = v.decalages[b];
        o.position.set(cx + dx, v.y + dy + Math.sin(t * 0.7 + b) * 1.5, cz + dz);
        o.rotation.set(0, -cap, Math.sin(t + b) * 0.15);
        o.scale.setScalar(1.1);
        o.updateMatrix();
        maillage.setMatrixAt(i++, o.matrix);
      }
    }
    maillage.count = i;
    maillage.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={maillage} />;
}
