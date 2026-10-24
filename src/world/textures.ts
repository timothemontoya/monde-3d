import * as THREE from "three";

let douce: THREE.Texture | null = null;

/** Tache ronde et floue (dégradé radial), partagée : sans elle, les particules sont des carrés. */
export function textureDouce() {
  if (douce) return douce;
  const toile = document.createElement("canvas");
  toile.width = toile.height = 64;
  const ctx = toile.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  douce = new THREE.CanvasTexture(toile);
  return douce;
}
