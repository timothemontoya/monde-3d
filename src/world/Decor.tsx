import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FEUX, FRONTIERES_MAGIQUES, INDICES, LIEUX, PONTS, PORTS, RAMASSABLES, REGIONS, REGLAGES, VOLCANS } from "../content/monde";
import type { Px, Vegetation as TypeVegetation } from "../content/types";
import { bornes, laCarte, MER, regionA, surTerre, versMonde } from "./carte";
import { graine, hauteurPont, hauteurSol, hauteurTerrain, NIVEAU_MER } from "./relief";

// Décor PROVISOIRE : il sera remplacé petit à petit par tes modèles Blender.

const matrice = (x: number, y: number, z: number, rotY = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(sx, sy, sz),
  );

function Instances({ geometrie, materiau, matrices, ombre = true }: { geometrie: THREE.BufferGeometry; materiau: THREE.Material; matrices: THREE.Matrix4[]; ombre?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current!.setMatrixAt(i, m));
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [matrices]);
  if (!matrices.length) return null;
  return <instancedMesh ref={ref} args={[geometrie, materiau, matrices.length]} castShadow={ombre} receiveShadow />;
}

const auSol = (p: Px) => {
  const [x, z] = surTerre(p);
  return { x, z, y: hauteurSol(x, z) };
};

// ─── Végétation ─────────────────────────────────────────────────────────────

/** Densité (arbres par hectare) et formes de chaque type de végétation. */
const ESSENCES: Record<Exclude<TypeVegetation, "aucune">, { densite: number; tronc: string; feuillage: string | null; forme: "boule" | "cone" | "nu" | "roche" }> = {
  "foret-doree": { densite: 1.6, tronc: "#4a3b2a", feuillage: "#c9952f", forme: "boule" },
  "foret-sombre": { densite: 7, tronc: "#2a2228", feuillage: "#3b2f45", forme: "cone" },
  "pins-enneiges": { densite: 2.2, tronc: "#3a3028", feuillage: "#dfe9ee", forme: "cone" },
  "arbres-morts": { densite: 1.2, tronc: "#2e2622", feuillage: null, forme: "nu" },
  rochers: { densite: 1.4, tronc: "#8a857c", feuillage: null, forme: "roche" },
};

function Vegetation() {
  const parType = useMemo(() => {
    const c = laCarte();
    const r = graine(3);
    const { demiLargeur, demiHauteur } = bornes();
    const sortie: Record<string, { troncs: THREE.Matrix4[]; feuillages: THREE.Matrix4[] }> = {};
    for (const type of Object.keys(ESSENCES)) sortie[type] = { troncs: [], feuillages: [] };
    // Comptage des cellules par région pour répartir le bon nombre d'arbres.
    const cellulesParRegion = new Map<number, number[]>();
    for (let i = 0; i < c.region.length; i++) {
      if (c.region[i] === MER || c.distTerre[i] < 1) continue;
      const liste = cellulesParRegion.get(c.region[i]) ?? [];
      liste.push(i);
      cellulesParRegion.set(c.region[i], liste);
    }
    const hectaresParCellule = (c.pas * c.pas) / 10000;
    for (const [ri, cellules] of cellulesParRegion) {
      const type = REGIONS[ri].vegetation;
      if (type === "aucune") continue;
      const essence = ESSENCES[type];
      const n = Math.min(2200, Math.round(cellules.length * hectaresParCellule * essence.densite));
      for (let k = 0; k < n; k++) {
        const i = cellules[Math.floor(r() * cellules.length)];
        const x = ((i % c.largeur) + r() - c.largeur / 2) * c.pas;
        const z = (Math.floor(i / c.largeur) + r() - c.hauteur / 2) * c.pas;
        if (Math.abs(x) > demiLargeur || Math.abs(z) > demiHauteur) continue;
        const y = hauteurTerrain(x, z);
        if (y < NIVEAU_MER + 1.5) continue;
        const s = 0.7 + r() * 0.8;
        const rot = r() * 6.28;
        sortie[type].troncs.push(matrice(x, y, z, rot, s, s * (0.8 + r() * 0.6), s));
        if (essence.feuillage) sortie[type].feuillages.push(matrice(x, y, z, rot, s, s * (0.8 + r() * 0.5), s));
      }
    }
    return sortie;
  }, []);

  const geos = useMemo(() => {
    const tronc = new THREE.CylinderGeometry(0.35, 0.55, 6, 6);
    tronc.translate(0, 3, 0);
    const troncNu = new THREE.CylinderGeometry(0.15, 0.5, 9, 5);
    troncNu.translate(0, 4.5, 0);
    const boule = new THREE.IcosahedronGeometry(3.6, 0);
    boule.translate(0, 7.5, 0);
    const cone = new THREE.ConeGeometry(2.8, 9, 7);
    cone.translate(0, 8, 0);
    const roche = new THREE.DodecahedronGeometry(2.2, 0);
    roche.translate(0, 0.6, 0);
    return { tronc, troncNu, boule, cone, roche };
  }, []);

  return (
    <>
      {Object.entries(ESSENCES).map(([type, e]) => {
        const { troncs, feuillages } = parType[type];
        const geoTronc = e.forme === "nu" ? geos.troncNu : e.forme === "roche" ? geos.roche : geos.tronc;
        return (
          <group key={type}>
            <Instances geometrie={geoTronc} materiau={new THREE.MeshStandardMaterial({ color: e.tronc, roughness: 1, flatShading: e.forme === "roche" })} matrices={troncs} />
            {e.feuillage && (
              <Instances
                geometrie={e.forme === "cone" ? geos.cone : geos.boule}
                materiau={new THREE.MeshStandardMaterial({ color: e.feuillage, roughness: 0.9, flatShading: true })}
                matrices={feuillages}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

// ─── Lieux construits ───────────────────────────────────────────────────────

const ENDUIT = new THREE.MeshStandardMaterial({ color: "#d8cfbd", roughness: 0.95 });
const TUILE = new THREE.MeshStandardMaterial({ color: "#7a4a32", roughness: 0.9 });
const PIERRE = new THREE.MeshStandardMaterial({ color: "#8f887b", roughness: 0.95 });
const BOIS = new THREE.MeshStandardMaterial({ color: "#6a4a2e", roughness: 0.9 });

/** Village blanc (départ) : maisons autour d'une place. */
function VillageBlanc() {
  const maisons = useMemo(() => {
    const region = REGIONS.find((r) => r.id === "village-blanc")!;
    const [cx, cz] = versMonde(region.point!);
    const r = graine(21);
    // Aucune maison sur le point de départ, un indice, un objet ou un feu de camp.
    const aLaisserLibre = [REGLAGES.depart, ...INDICES.map((i) => i.position), ...RAMASSABLES.map((o) => o.position), ...FEUX.map((f) => f.position)].map(surTerre);
    const liste: { x: number; z: number; y: number; rot: number; l: number; p: number; h: number }[] = [];
    for (let essai = 0; essai < 300 && liste.length < 14; essai++) {
      const a = r() * Math.PI * 2;
      const d = 30 + r() * 70;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (regionA(x, z) === MER || liste.some((m) => Math.hypot(m.x - x, m.z - z) < 18)) continue;
      if (aLaisserLibre.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 16)) continue;
      liste.push({ x, z, y: hauteurSol(x, z), rot: -a, l: 9 + r() * 4, p: 7 + r() * 3, h: 5 + r() * 3 });
    }
    return liste;
  }, []);
  const geoToit = useMemo(() => {
    const g = new THREE.ConeGeometry(0.75, 1, 4);
    g.rotateY(Math.PI / 4);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const boite = useMemo(() => new THREE.BoxGeometry(), []);
  return (
    <>
      <Instances geometrie={boite} materiau={ENDUIT} matrices={maisons.map((m) => matrice(m.x, m.y - 1 + m.h / 2, m.z, m.rot, m.l, m.h + 2, m.p))} />
      <Instances geometrie={geoToit} materiau={TUILE} matrices={maisons.map((m) => matrice(m.x, m.y + m.h, m.z, m.rot, m.l * 1.15, m.h * 0.7, m.p * 1.25))} />
      <RigidBody type="fixed" colliders={false}>
        {maisons.map((m, i) => (
          <CuboidCollider key={i} args={[m.l / 2, m.h, m.p / 2]} position={[m.x, m.y + m.h, m.z]} rotation={[0, m.rot, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Un port : un ponton qui avance dans l'eau et un bateau amarré. */
function Ports() {
  const ports = useMemo(
    () =>
      PORTS.map((p) => {
        const s = auSol(p.position);
        // Le ponton pointe vers la mer la plus proche.
        let meilleur = 0;
        let profondeur = -Infinity;
        for (let a = 0; a < 16; a++) {
          const ang = (a / 16) * Math.PI * 2;
          const h = -hauteurTerrain(s.x + Math.cos(ang) * 30, s.z + Math.sin(ang) * 30);
          if (h > profondeur) ((profondeur = h), (meilleur = ang));
        }
        return { ...s, angle: meilleur, id: p.id };
      }),
    [],
  );
  return (
    <>
      {ports.map((p) => (
        <group key={p.id} position={[p.x, Math.max(p.y, NIVEAU_MER) + 0.6, p.z]} rotation-y={-p.angle}>
          <mesh material={BOIS} position={[12, 0, 0]} receiveShadow>
            <boxGeometry args={[26, 0.5, 4]} />
          </mesh>
          {/* Bateau */}
          <group position={[22, -0.3, 5]}>
            <mesh material={BOIS} castShadow>
              <boxGeometry args={[10, 1.6, 3.4]} />
            </mesh>
            <mesh material={BOIS} position={[0, 4, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 7]} />
            </mesh>
            <mesh position={[0.6, 4.5, 0]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[3, 4.5]} />
              <meshStandardMaterial color="#e9e0cc" side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

/** Feux de camp (voyage rapide) : un foyer et une flamme vivante. */
function Feux() {
  const flammes = useRef<THREE.Group>(null);
  const feux = useMemo(() => FEUX.map((f) => ({ id: f.id, ...auSol(f.position) })), []);
  useFrame((state) => {
    flammes.current?.children.forEach((m, i) => {
      const t = state.clock.elapsedTime * 6 + i;
      m.scale.set(1 + Math.sin(t) * 0.12, 1 + Math.sin(t * 1.3) * 0.2, 1 + Math.cos(t) * 0.12);
    });
  });
  return (
    <>
      {feux.map((f) => (
        <group key={f.id} position={[f.x, f.y, f.z]}>
          <mesh material={PIERRE} position={[0, 0.2, 0]}>
            <torusGeometry args={[1.1, 0.35, 6, 10]} />
          </mesh>
          <pointLight position={[0, 1.6, 0]} color="#ff9a4a" intensity={60} distance={22} />
        </group>
      ))}
      <group ref={flammes}>
        {feux.map((f) => (
          <mesh key={f.id} position={[f.x, f.y + 0.9, f.z]}>
            <coneGeometry args={[0.6, 1.8, 7]} />
            <meshStandardMaterial color="#ffb347" emissive="#ff7a1a" emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Ponts suspendus des Atlantes : un tablier de planches et des cordes. */
function Ponts() {
  const ponts = useMemo(
    () =>
      PONTS.map((p) => {
        const [ax, az] = versMonde(p.de);
        const [bx, bz] = versMonde(p.a);
        const longueur = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(longueur / 1.2);
        const planches = Array.from({ length: n }, (_, i) => {
          const t = (i + 0.5) / n;
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          return { x, z, y: hauteurPont(x, z) ?? 0 };
        });
        return { planches, angle: Math.atan2(bz - az, bx - ax), largeur: p.largeur };
      }),
    [],
  );
  return (
    <>
      {ponts.map((p, i) => (
        <Instances
          key={i}
          geometrie={new THREE.BoxGeometry(1, 0.2, p.largeur)}
          materiau={BOIS}
          matrices={p.planches.map((pl) => matrice(pl.x, pl.y - 0.1, pl.z, -p.angle))}
        />
      ))}
    </>
  );
}

/** Portail éteint vers Scìyolia : un anneau de pierre dressé. */
function Portail() {
  const lieu = LIEUX.find((l) => l.id === "portail-sciyolia")!;
  const p = useMemo(() => auSol(lieu.position), [lieu]);
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh material={PIERRE} position={[0, 7, 0]} castShadow>
        <torusGeometry args={[6, 0.9, 10, 32]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.5, 1]} position={[-6, 1.5, 0]} />
        <CylinderCollider args={[1.5, 1]} position={[6, 1.5, 0]} />
      </RigidBody>
    </group>
  );
}

/** Flèches de glace du Palais givré. */
function PalaisGivre() {
  const lieu = LIEUX.find((l) => l.id === "palais-givre")!;
  const fleches = useMemo(() => {
    const [cx, cz] = versMonde(lieu.position);
    const r = graine(77);
    return Array.from({ length: 9 }, () => {
      const x = cx + (r() - 0.5) * 70;
      const z = cz + (r() - 0.5) * 70;
      return { x, z, y: hauteurSol(x, z), h: 25 + r() * 45 };
    });
  }, [lieu]);
  return (
    <>
      {fleches.map((f, i) => (
        <mesh key={i} position={[f.x, f.y + f.h / 2, f.z]} castShadow>
          <coneGeometry args={[4, f.h, 6]} />
          <meshStandardMaterial color="#d6f1fb" roughness={0.1} metalness={0.1} emissive="#7fc9ea" emissiveIntensity={0.15} />
        </mesh>
      ))}
    </>
  );
}

/** Lueur de lave au fond des cratères. */
function Lave() {
  const volcans = useMemo(
    () =>
      VOLCANS.map((v) => {
        const [x, z] = versMonde(v.position);
        return { x, z, y: hauteurTerrain(x, z) };
      }),
    [],
  );
  return (
    <>
      {volcans.map((v, i) => (
        <group key={i} position={[v.x, v.y + 2, v.z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <circleGeometry args={[30, 24]} />
            <meshStandardMaterial color="#ff5a10" emissive="#ff3a00" emissiveIntensity={3} />
          </mesh>
          <pointLight position={[0, 20, 0]} color="#ff6a2a" intensity={4000} distance={400} decay={1.6} />
        </group>
      ))}
    </>
  );
}

/** Tache ronde et floue (dégradé radial) : sans elle, les particules sont des carrés. */
function textureDouce() {
  const toile = document.createElement("canvas");
  toile.width = toile.height = 64;
  const ctx = toile.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(toile);
}

/** Brume magique le long des frontières infranchissables et des côtes de la forêt des sorcières. */
function BrumesMagiques() {
  const texture = useMemo(() => textureDouce(), []);
  const geo = useMemo(() => {
    const c = laCarte();
    const ids = REGIONS.map((r) => r.id);
    const paires = FRONTIERES_MAGIQUES.map((f) => f.regions.map((id) => ids.indexOf(id)));
    const foret = ids.indexOf("foret-sorcieres");
    const r = graine(9);
    const pts: number[] = [];
    for (let i = 0; i < c.region.length; i++) {
      const a = c.region[i];
      const x = i % c.largeur;
      const y = Math.floor(i / c.largeur);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= c.largeur || ny >= c.hauteur) continue;
        const b = c.region[ny * c.largeur + nx];
        const frontiere = paires.some(([p, q]) => (a === p && b === q) || (a === q && b === p));
        const cote = a === foret && b === MER;
        if (!frontiere && !cote) continue;
        const wx = (x + 0.5 - c.largeur / 2) * c.pas;
        const wz = (y + 0.5 - c.hauteur / 2) * c.pas;
        const sol = Math.max(NIVEAU_MER, hauteurTerrain(wx, wz));
        for (let k = 0; k < 4; k++) pts.push(wx + (r() - 0.5) * c.pas, sol + 2 + r() * 22, wz + (r() - 0.5) * c.pas);
        break;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) (ref.current.material as THREE.PointsMaterial).opacity = 0.3 + Math.sin(state.clock.elapsedTime * 0.7) * 0.06;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={texture} color="#8a5ad0" size={26} sizeAttenuation transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export function Decor() {
  return (
    <>
      <Vegetation />
      <VillageBlanc />
      <Ports />
      <Feux />
      <Ponts />
      <Portail />
      <PalaisGivre />
      <Lave />
      <BrumesMagiques />
    </>
  );
}
