import * as THREE from "three";

const ROOT_FRACTION = .04;
const BEND_START_FRACTION = .12;

function hashPhase(value) {
  let hash = 0;
  for (const char of value) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return (hash % 6283) / 1000;
}

function shaderPatch(shader, uniforms, height) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = `attribute vec3 color;
uniform float environmentWindTime;
uniform float environmentWindStrength;
uniform float environmentWindPhase;
uniform vec2 environmentWindDirection;
${shader.vertexShader}`.replace("#include <begin_vertex>", `#include <begin_vertex>
float envRoot = smoothstep(${(height * ROOT_FRACTION).toFixed(6)}, ${(height * BEND_START_FRACTION).toFixed(6)}, position.y);
float envBend = clamp(color.r, 0.0, 1.0) * envRoot;
float envFlutter = clamp(color.g, 0.0, 1.0) * envRoot;
float envWave = sin(environmentWindTime + environmentWindPhase + position.x * .13 + position.z * .09);
float envDetail = sin(environmentWindTime * 3.7 + color.b * 6.2831853) * .13 * envFlutter;
float envOffset = (envWave * envBend + envDetail) * ${height.toFixed(6)} * .032 * environmentWindStrength;
transformed.x += environmentWindDirection.x * envOffset;
transformed.z += environmentWindDirection.y * envOffset;`);
}

function shadowMaterial(base, uniforms, height, distance) {
  const options = { map: base.map || null, alphaMap: base.alphaMap || null, alphaTest: base.alphaTest || 0, side: base.side };
  const material = distance ? new THREE.MeshDistanceMaterial(options) : new THREE.MeshDepthMaterial({ ...options, depthPacking: THREE.RGBADepthPacking });
  material.onBeforeCompile = (shader) => shaderPatch(shader, uniforms, height);
  material.customProgramCacheKey = () => `assembled-wind-${distance ? "distance" : "depth"}-${height}`;
  return material;
}

export function attachWind(root, asset, instanceId, resources = new Set()) {
  const uniforms = {
    environmentWindTime: { value: 0 },
    environmentWindStrength: { value: 0 },
    environmentWindPhase: { value: hashPhase(instanceId) },
    environmentWindDirection: { value: new THREE.Vector2(1, 0) },
  };
  const meshes = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    if (!mesh.geometry.getAttribute("color")) throw new Error(`${instanceId} has no COLOR_0 wind data`);
    const bases = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = bases.map((base) => {
      const material = base.clone();
      material.vertexColors = false;
      material.onBeforeCompile = (shader) => shaderPatch(shader, uniforms, asset.height);
      material.customProgramCacheKey = () => `assembled-wind-visible-${asset.height}-${base.name}`;
      material.needsUpdate = true;
      resources.add(material);
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.customDepthMaterial = shadowMaterial(bases[0], uniforms, asset.height, false);
    mesh.customDistanceMaterial = shadowMaterial(bases[0], uniforms, asset.height, true);
    resources.add(mesh.customDepthMaterial);
    resources.add(mesh.customDistanceMaterial);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.boundingSphere.radius += asset.height * .04;
    meshes.push(mesh);
  });
  return { root, uniforms, meshes };
}

export function updateWind(state, time, strength, worldRadians) {
  state.uniforms.environmentWindTime.value = time;
  state.uniforms.environmentWindStrength.value = strength;
  const world = new THREE.Vector3(Math.cos(worldRadians), 0, Math.sin(worldRadians));
  const inverse = state.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  world.applyQuaternion(inverse);
  state.uniforms.environmentWindDirection.value.set(world.x, world.z).normalize();
}
