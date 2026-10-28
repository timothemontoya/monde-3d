import { useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
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

/**
 * Si un modèle ne se charge pas (réseau coupé, fichier absent), on montre sa forme provisoire au lieu
 * de laisser l'erreur arrêter tout le jeu.
 */
class SiEchec extends Component<{ provisoire: ReactNode; children: ReactNode }, { echec: boolean }> {
  state = { echec: false };
  static getDerivedStateFromError() {
    return { echec: true };
  }
  componentDidCatch(erreur: unknown) {
    console.warn("Modèle non chargé, forme provisoire à la place :", erreur);
  }
  render() {
    return this.state.echec ? this.props.provisoire : this.props.children;
  }
}

/** Plusieurs exemplaires d'une même forme, dessinés en une seule fois. */
export function Instances({
  geometrie,
  materiau,
  matrices,
  ombre = true,
  contour = true,
}: {
  geometrie: THREE.BufferGeometry;
  materiau: THREE.Material | THREE.Material[];
  matrices: THREE.Matrix4[];
  ombre?: boolean;
  /** Faux pour les petites plantes : elles n'écrivent pas la profondeur (dessinées après le reste), donc pas de trait d'encre autour de chaque brin. */
  contour?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => {
    if (contour) return materiau;
    const sans = (m: THREE.Material) => Object.assign(m.clone(), { depthWrite: false });
    return Array.isArray(materiau) ? materiau.map(sans) : sans(materiau);
  }, [materiau, contour]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [matrices]);
  if (!matrices.length) return null;
  return <instancedMesh ref={ref} args={[geometrie, mat, matrices.length]} castShadow={ombre} receiveShadow renderOrder={contour ? 0 : 10} />;
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
        <SiEchec provisoire={provisoire}>
          <Suspense fallback={provisoire}>
            <ModeleCharge url={url} />
          </Suspense>
        </SiEchec>
      ) : (
        provisoire
      )}
    </group>
  );
}

type Morceau = { geometrie: THREE.BufferGeometry; materiau: THREE.Material | THREE.Material[]; local: THREE.Matrix4 };

/** Un morceau (mesh) du modèle, répété à chaque position. */
function InstancesMorceau({ morceau, matrices, ombre, contour }: { morceau: Morceau; matrices: THREE.Matrix4[]; ombre: boolean; contour: boolean }) {
  const finales = useMemo(() => matrices.map((m) => m.clone().multiply(morceau.local)), [matrices, morceau]);
  return <Instances geometrie={morceau.geometrie} materiau={morceau.materiau} matrices={finales} ombre={ombre} contour={contour} />;
}

function InstancesChargees({ url, matrices, ombre, contour }: { url: string; matrices: THREE.Matrix4[]; ombre: boolean; contour: boolean }) {
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
        <InstancesMorceau key={i} morceau={m} matrices={matrices} ombre={ombre} contour={contour} />
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
  contour = true,
}: {
  modele: string;
  matrices: THREE.Matrix4[];
  provisoire: ReactNode;
  ombre?: boolean;
  contour?: boolean;
}) {
  const url = URLS[modele];
  if (!matrices.length) return null;
  if (!url) return <>{provisoire}</>;
  return (
    <SiEchec provisoire={provisoire}>
      <Suspense fallback={provisoire}>
        <InstancesChargees url={url} matrices={matrices} ombre={ombre} contour={contour} />
      </Suspense>
    </SiEchec>
  );
}

/** Matrice de placement : position, rotation autour de la verticale, échelle. */
export const matrice = (x: number, y: number, z: number, rotY = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(sx, sy, sz));
