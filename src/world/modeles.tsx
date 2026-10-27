import { useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

/**
 * Modèles Blender : chaque fichier modeles/<nom>.glb est disponible sous son nom
 * (voir ASSETS-BLENDER.md). Tant qu'un fichier n'existe pas, on affiche une forme provisoire.
 */
const FICHIERS = import.meta.glob<string>("/modeles/*.glb", { query: "?url", import: "default", eager: true });
const URLS: Record<string, string> = Object.fromEntries(
  Object.entries(FICHIERS).map(([chemin, url]) => [chemin.slice("/modeles/".length, -".glb".length), url]),
);

export const modeleExiste = (id: string) => id in URLS;
export const modelesDisponibles = () => Object.keys(URLS).sort();

/** Plusieurs exemplaires d'une même forme, dessinés en une seule fois. */
export function Instances({
  geometrie,
  materiau,
  matrices,
  ombre = true,
}: {
  geometrie: THREE.BufferGeometry;
  materiau: THREE.Material | THREE.Material[];
  matrices: THREE.Matrix4[];
  ombre?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [matrices]);
  if (!matrices.length) return null;
  return <instancedMesh ref={ref} args={[geometrie, materiau, matrices.length]} castShadow={ombre} receiveShadow />;
}

/** Copie de la scène du modèle, avec ombres. */
function ModeleCharge({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const copie = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    return c;
  }, [scene]);
  return <primitive object={copie} />;
}

/** Un modèle posé dans le monde, ou `provisoire` tant que son fichier n'existe pas. */
export function Modele({ modele, provisoire = null, ...props }: { modele: string; provisoire?: ReactNode } & ThreeElements["group"]) {
  const url = URLS[modele];
  return (
    <group {...props}>
      {url ? (
        <Suspense fallback={provisoire}>
          <ModeleCharge url={url} />
        </Suspense>
      ) : (
        provisoire
      )}
    </group>
  );
}

type Morceau = { geometrie: THREE.BufferGeometry; materiau: THREE.Material | THREE.Material[]; local: THREE.Matrix4 };

/** Un morceau (mesh) du modèle, répété à chaque position. */
function InstancesMorceau({ morceau, matrices, ombre }: { morceau: Morceau; matrices: THREE.Matrix4[]; ombre: boolean }) {
  const finales = useMemo(() => matrices.map((m) => m.clone().multiply(morceau.local)), [matrices, morceau]);
  return <Instances geometrie={morceau.geometrie} materiau={morceau.materiau} matrices={finales} ombre={ombre} />;
}

function InstancesChargees({ url, matrices, ombre }: { url: string; matrices: THREE.Matrix4[]; ombre: boolean }) {
  const { scene } = useGLTF(url);
  const morceaux = useMemo(() => {
    scene.updateMatrixWorld(true);
    const liste: Morceau[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) liste.push({ geometrie: m.geometry, materiau: m.material, local: m.matrixWorld.clone() });
    });
    return liste;
  }, [scene]);
  return (
    <>
      {morceaux.map((m, i) => (
        <InstancesMorceau key={i} morceau={m} matrices={matrices} ombre={ombre} />
      ))}
    </>
  );
}

/** Le même modèle à plusieurs endroits (maisons, arbres, rochers…), ou `provisoire` sans fichier. */
/** `ombre` : faux pour les petites plantes, trop nombreuses pour être dessinées une seconde fois dans les ombres. */
export function InstancesModele({
  modele,
  matrices,
  provisoire,
  ombre = true,
}: {
  modele: string;
  matrices: THREE.Matrix4[];
  provisoire: ReactNode;
  ombre?: boolean;
}) {
  const url = URLS[modele];
  if (!matrices.length) return null;
  if (!url) return <>{provisoire}</>;
  return (
    <Suspense fallback={provisoire}>
      <InstancesChargees url={url} matrices={matrices} ombre={ombre} />
    </Suspense>
  );
}

/** Matrice de placement : position, rotation autour de la verticale, échelle. */
export const matrice = (x: number, y: number, z: number, rotY = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(sx, sy, sz));
