import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { GUIRLANDES } from "../content/monde";
import { versMonde } from "./carte";
import { hauteurTerrain } from "./relief";

// Guirlandes de fanions (GUIRLANDES dans monde.ts) : une corde qui pend entre deux poteaux, et des
// fanions triangulaires de couleurs alternées. Tout est fusionné en deux maillages.

const HAUTEUR = 5;
const COULEURS = ["#c9a050", "#a8452f", "#6f7a3a", "#e2d3a8"];
/** Écart entre deux fanions, et leur taille (largeur, hauteur), en m. */
const ECART = 1.1;
const FANION: [number, number] = [0.55, 0.75];
/** La corde pend de cette fraction de sa longueur au milieu. */
const FLECHE = 0.06;

export function Guirlandes() {
  const { cordes, fanions, poteaux } = useMemo(() => {
    const cordes: number[] = [];
    const fanions: number[] = [];
    const teintes: number[] = [];
    const pointes: number[] = [];
    const poteaux: THREE.Matrix4[] = [];
    for (const g of GUIRLANDES) {
      const [ax, az] = versMonde(g.de);
      const [bx, bz] = versMonde(g.a);
      const h = g.hauteur ?? HAUTEUR;
      const [ay, by] = [hauteurTerrain(ax, az) + h, hauteurTerrain(bx, bz) + h];
      for (const [x, y, z] of [[ax, ay, az], [bx, by, bz]]) poteaux.push(new THREE.Matrix4().makeTranslation(x, (y - h + y) / 2, z));
      const longueur = Math.hypot(bx - ax, bz - az);
      const point = (t: number) => new THREE.Vector3(ax + (bx - ax) * t, ay + (by - ay) * t - longueur * FLECHE * 4 * t * (1 - t), az + (bz - az) * t);
      const n = Math.max(2, Math.round(longueur / ECART));
      for (let i = 0; i < n; i++) {
        const [p, q] = [point(i / n), point((i + 1) / n)];
        cordes.push(p.x, p.y, p.z, q.x, q.y, q.z);
        if (i === 0) continue;
        // Un fanion : deux coins sur la corde, la pointe en bas.
        const d = q.clone().sub(p).normalize().multiplyScalar(FANION[0] / 2);
        const [g1, g2] = [p.clone().sub(d), p.clone().add(d)];
        const pointe = p.clone().add(new THREE.Vector3(0, -FANION[1], 0));
        fanions.push(g1.x, g1.y, g1.z, g2.x, g2.y, g2.z, pointe.x, pointe.y, pointe.z);
        const c = new THREE.Color((g.couleurs ?? COULEURS)[i % (g.couleurs ?? COULEURS).length]);
        for (let k = 0; k < 3; k++) teintes.push(c.r, c.g, c.b);
        pointes.push(0, 0, 1);
      }
    }
    const gc = new THREE.BufferGeometry();
    gc.setAttribute("position", new THREE.Float32BufferAttribute(cordes, 3));
    const gf = new THREE.BufferGeometry();
    gf.setAttribute("position", new THREE.Float32BufferAttribute(fanions, 3));
    gf.setAttribute("color", new THREE.Float32BufferAttribute(teintes, 3));
    gf.setAttribute("aPointe", new THREE.Float32BufferAttribute(pointes, 1));
    gf.computeVertexNormals();
    return { cordes: gc, fanions: gf, poteaux };
  }, []);

  // Les fanions flottent au vent : leur pointe ondule, chacun un peu décalé.
  const temps = useMemo(() => ({ value: 0 }), []);
  const tissu = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    m.onBeforeCompile = (s) => {
      s.uniforms.uTemps = temps;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTemps;\nattribute float aPointe;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nfloat onde = uTemps * 3.2 + position.x * 0.7 + position.z * 0.5;\ntransformed += vec3(0.28 * sin(onde), 0.12 * sin(onde * 1.7), 0.28 * cos(onde * 0.8)) * aPointe;",
        );
    };
    return m;
  }, [temps]);
  useFrame((state) => {
    temps.value = state.clock.elapsedTime;
  });

  const poteau = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, HAUTEUR + 0.4, 6), new THREE.MeshStandardMaterial({ color: "#5a4230", roughness: 1 }), Math.max(1, poteaux.length));
    poteaux.forEach((x, i) => m.setMatrixAt(i, x));
    m.count = poteaux.length;
    m.castShadow = true;
    m.computeBoundingSphere();
    return m;
  }, [poteaux]);

  return (
    <>
      <lineSegments geometry={cordes}>
        <lineBasicMaterial color="#3a2e24" />
      </lineSegments>
      <mesh geometry={fanions} material={tissu} castShadow />
      <primitive object={poteau} />
    </>
  );
}
