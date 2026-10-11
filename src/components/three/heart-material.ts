/**
 * Wet living tissue for the heart: three.js's physical material, extended in
 * its shaders with
 *   - shading baked into every crease (per-vertex ambient occlusion),
 *   - a fine muscle grain and lobulated fat, drawn as surface bumps,
 *   - a wet clear coat that follows those bumps,
 *   - the beat itself: the ventricles squeeze towards their long axis and the
 *     base descends, the atria contract just before; vessels stay put.
 *
 * Per-vertex `aAttr` (normalised bytes): shade, fat, ventricle, atrium.
 */
import type * as THREE_NS from "three";

type Three = typeof THREE_NS;

export interface HeartUniforms {
  uSystole: { value: number };
  uAtrial: { value: number };
  uBump: { value: number };
}

const VERTEX_PARS = /* glsl */ `
#include <common>
attribute vec4 aAttr;
uniform float uSystole;
uniform float uAtrial;
varying vec4 vAttr;
varying vec3 vObj;
`;

const VERTEX_BEAT = /* glsl */ `
#include <begin_vertex>
vObj = position;
vAttr = aAttr;
{
  const vec3 base = vec3(0.05, 0.12, -0.1);
  const vec3 apex = vec3(0.37, -0.68, 0.05);
  const vec3 atria = vec3(-0.18, 0.36, -0.12);
  vec3 axis = normalize(apex - base);
  vec3 rel = position - base;
  float along = dot(rel, axis);
  vec3 radial = rel - axis * along;
  // Ventricles: the walls thicken inwards and the base pulls down towards the apex.
  transformed -= radial * (aAttr.z * uSystole * 0.075);
  transformed += axis * (aAttr.z * uSystole * 0.04 * (1.0 - clamp(along / 0.95, 0.0, 1.0)));
  // Atria: a smaller squeeze, just before.
  transformed -= (position - atria) * (aAttr.w * uAtrial * 0.05);
}
`;

const FRAGMENT_PARS = /* glsl */ `
#include <common>
varying vec4 vAttr;
varying vec3 vObj;
uniform float uBump;
float tHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float tNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(tHash(i), tHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(tHash(i + vec3(0.0, 1.0, 0.0)), tHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(tHash(i + vec3(0.0, 0.0, 1.0)), tHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(tHash(i + vec3(0.0, 1.0, 1.0)), tHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
// Muscle: a fine, slightly stretched grain (vessel walls are almost smooth). Fat: rounded lobules.
float tissueHeight(vec3 p, float fat, float muscle) {
  float grain = tNoise(p * vec3(60.0, 110.0, 60.0)) * 0.75 + tNoise(p * 180.0) * 0.25;
  float lobules = smoothstep(0.2, 0.9, tNoise(p * 24.0)) * 0.85 + tNoise(p * 64.0) * 0.2;
  return mix(grain * mix(0.04, 0.12, muscle), lobules * 0.35, fat);
}
vec3 tissueBump(vec3 surfPos, vec3 n, float h, float scale, float faceDir) {
  vec2 dH = vec2(dFdx(h), dFdy(h)) * scale;
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
`;

const FRAGMENT_COLOR = /* glsl */ `
#include <color_fragment>
{
  // Living tissue isn't one flat colour: a soft mottle over the muscle, a paler sheen on the fat.
  float m = tNoise(vObj * 30.0);
  diffuseColor.rgb *= mix(0.88 + 0.22 * m, 0.95 + 0.1 * tNoise(vObj * 55.0), vAttr.y);
}
`;

const FRAGMENT_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + vAttr.y * 0.14 - 0.02, 0.05, 1.0);
`;

const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
normal = tissueBump(-vViewPosition, normal, tissueHeight(vObj, vAttr.y, clamp(vAttr.z + vAttr.w, 0.0, 1.0)), uBump, faceDirection);
`;

const FRAGMENT_CLEARCOAT = /* glsl */ `
#include <clearcoat_normal_fragment_maps>
#ifdef USE_CLEARCOAT
  // A thin wet film follows the surface, softening but keeping its texture.
  clearcoatNormal = normalize(mix(clearcoatNormal, normal, 0.4));
#endif
`;

const FRAGMENT_AO = /* glsl */ `
#include <aomap_fragment>
{
  float tissueAO = mix(1.0, vAttr.x, 0.92);
  reflectedLight.indirectDiffuse *= tissueAO;
  reflectedLight.directDiffuse *= mix(1.0, tissueAO, 0.6);
  reflectedLight.indirectSpecular *= mix(1.0, tissueAO, 0.8);
  reflectedLight.directSpecular *= mix(1.0, tissueAO, 0.4);
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= mix(1.0, tissueAO, 0.8);
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= tissueAO;
  #endif
}
`;

/** The tissue material; returns it with the uniforms that drive the beat. */
export function wetTissue(THREE: Three, opts: { bump: number }): { material: THREE_NS.MeshPhysicalMaterial; uniforms: HeartUniforms } {
  const uniforms: HeartUniforms = { uSystole: { value: 0 }, uAtrial: { value: 0 }, uBump: { value: opts.bump } };
  // Lacquered: a deep glossy coat, a rose sheen at the edges and the faintest pearl shimmer.
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.55,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color("#ff8ea2"),
    specularIntensity: 0.7,
    iridescence: 0.28,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [180, 420],
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", VERTEX_PARS).replace("#include <begin_vertex>", VERTEX_BEAT);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", FRAGMENT_PARS)
      .replace("#include <color_fragment>", FRAGMENT_COLOR)
      .replace("#include <roughnessmap_fragment>", FRAGMENT_ROUGHNESS)
      .replace("#include <normal_fragment_maps>", FRAGMENT_NORMAL)
      .replace("#include <clearcoat_normal_fragment_maps>", FRAGMENT_CLEARCOAT)
      .replace("#include <aomap_fragment>", FRAGMENT_AO);
  };
  material.customProgramCacheKey = () => "ramai-wet-tissue-2";
  return { material, uniforms };
}

/** A soft studio for reflections: a dark room with three large softboxes, so the wet surface catches long, gentle highlights. */
export function studioScene(THREE: Three): THREE_NS.Scene {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x101218), side: THREE.BackSide }));
  scene.add(room);
  const panel = (w: number, h: number, pos: [number, number, number], color: number, intensity: number) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(7, 5, [-6, 6, 6], 0xfff2ea, 5.5); // key softbox, high front-left
  panel(2.2, 9, [7, 1.5, -5], 0xb79cff, 3.6); // violet strip behind, right
  panel(2.2, 9, [-7, 0.5, -4], 0x7fdcff, 3.0); // cyan strip behind, left
  panel(6, 2.5, [5, -5, 5], 0xffd6dc, 0.9); // low rose fill
  panel(10, 10, [0, 10, 0], 0xffffff, 0.7); // gentle top bounce
  return scene;
}
