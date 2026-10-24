import * as THREE from "three";

// Bruit 3D simple (value noise) partagé par les effets.
const BRUIT = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

/**
 * Mur de tempête : nuages sombres qui tourbillonnent, éclairs occasionnels.
 * `uDisparition` passe de 0 à 1 quand la tempête se dissipe.
 */
export function materiauTempete() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTemps: { value: 0 }, uDisparition: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vMonde; varying vec2 vUv;
      void main() { vUv = uv; vec4 m = modelMatrix * vec4(position, 1.0); vMonde = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`,
    fragmentShader: /* glsl */ `
      uniform float uTemps; uniform float uDisparition; varying vec3 vMonde; varying vec2 vUv;
      ${BRUIT}
      void main() {
        vec3 p = vMonde * 0.018 + vec3(uTemps * 0.12, -uTemps * 0.05, uTemps * 0.09);
        float n = fbm(p + fbm(p * 1.7 + uTemps * 0.04));
        // Éclairs : brefs flashs qui balaient le mur.
        float eclair = step(0.985, noise(vec3(floor(uTemps * 3.0), vMonde.x * 0.004, 0.0))) * smoothstep(0.55, 0.75, n);
        vec3 couleur = mix(vec3(0.10, 0.11, 0.15), vec3(0.42, 0.45, 0.55), n) + eclair * vec3(0.8, 0.85, 1.0);
        float bords = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float alpha = smoothstep(0.25, 0.6, n) * bords * 0.92 * (1.0 - uDisparition);
        gl_FragColor = vec4(couleur, alpha);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Voile de brume dorée, façon Elden Ring : volutes lumineuses qui montent.
 */
export function materiauVoile(teinte: [string, string] = ["#ffb847", "#ffeb99"]) {
  const [c1, c2] = teinte.map((c) => new THREE.Color(c));
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uTemps: { value: 0 }, uDisparition: { value: 0 }, uCouleur1: { value: c1 }, uCouleur2: { value: c2 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vMonde;
      void main() { vUv = uv; vec4 m = modelMatrix * vec4(position, 1.0); vMonde = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`,
    fragmentShader: /* glsl */ `
      uniform float uTemps; uniform float uDisparition; uniform vec3 uCouleur1; uniform vec3 uCouleur2;
      varying vec2 vUv; varying vec3 vMonde;
      ${BRUIT}
      void main() {
        vec3 p = vec3(vUv.x * 3.0, vUv.y * 2.0 - uTemps * 0.35, uTemps * 0.1);
        float n = fbm(p * 2.2);
        float volutes = smoothstep(0.35, 0.8, n);
        float bords = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(1.0, 0.7, vUv.y);
        vec3 or_ = mix(uCouleur1, uCouleur2, n);
        float alpha = (0.18 + volutes * 0.75) * bords * (1.0 - uDisparition);
        gl_FragColor = vec4(or_ * alpha * 1.6, alpha);
        #include <colorspace_fragment>
      }`,
  });
}
