import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { useMemo } from "react";
import * as THREE from "three";

// Contours à l'encre, façon dessin animé : un trait sombre sur les silhouettes et les arêtes des
// objets. On les trouve dans la profondeur : 1 / distance varie linéairement sur une surface
// plane à l'écran, donc son laplacien est nul sur un plan et fort sur une arête ou un bord.

const FRAGMENT = /* glsl */ `
uniform vec3 uEncre;
uniform float uForce;
uniform float uSeuil;

float inverseDistance(const in vec2 uv) {
  return 1.0 / max(-getViewZ(readDepth(uv)), 0.05);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float z = -getViewZ(depth);
  float w = 1.0 / max(z, 0.05);
  vec2 t = texelSize;
  float somme = inverseDistance(uv - vec2(t.x, 0.0)) + inverseDistance(uv + vec2(t.x, 0.0))
    + inverseDistance(uv - vec2(0.0, t.y)) + inverseDistance(uv + vec2(0.0, t.y));
  float lap = abs(somme - 4.0 * w) / w;
  float trait = smoothstep(uSeuil, uSeuil * 3.0, lap);
  // Le trait s'efface au loin, dans la brume (et le ciel n'en a pas).
  trait *= 1.0 - smoothstep(90.0, 380.0, z);
  outputColor = vec4(mix(inputColor.rgb, inputColor.rgb * uEncre, trait * uForce), inputColor.a);
}
`;

class EffetContours extends Effect {
  constructor() {
    super("Contours", FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        // Encre brun sombre (on multiplie la couleur : le trait garde la teinte de ce qu'il borde).
        ["uEncre", new THREE.Uniform(new THREE.Color(0.22, 0.17, 0.14))],
        ["uForce", new THREE.Uniform(0.85)],
        ["uSeuil", new THREE.Uniform(0.02)],
      ]),
    });
  }
}

export function Contours() {
  const effet = useMemo(() => new EffetContours(), []);
  return <primitive object={effet} dispose={null} />;
}
