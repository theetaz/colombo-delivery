import * as THREE from "three";
const ROOT_FRACTION = 0.04,
  BEND_START_FRACTION = 0.12;
export function windEnvelope(localHeight, height) {
  if (height <= 0) return 0;
  return THREE.MathUtils.smoothstep(
    localHeight / height,
    ROOT_FRACTION,
    BEND_START_FRACTION,
  );
}
export function maxWindDeflection(height, strength = 1) {
  return Math.max(0, height) * 0.032 * 1.13 * Math.max(0, strength) + 1e-6;
}
export function sampleWindDisplacement({
  position,
  height,
  mask = [1, 1, 0.5],
  time = 0,
  strength = 1,
  direction = [1, 0],
  assetPhase = 0,
}) {
  const root = windEnvelope(position[1], height);
  if (strength === 0 || root === 0) return [0, 0, 0];
  const bend = THREE.MathUtils.clamp(mask[0], 0, 1) * root,
    flutter = THREE.MathUtils.clamp(mask[1], 0, 1) * root,
    coherent = Math.sin(
      time + assetPhase + position[0] * 0.13 + position[2] * 0.09,
    ),
    detail = Math.sin(time * 3.7 + mask[2] * 6.28318530718) * 0.13 * flutter,
    amount = (coherent * bend + detail) * height * 0.032 * strength;
  return [direction[0] * amount, 0, direction[1] * amount];
}
function patchShader(shader, uniforms, height) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader =
    `attribute vec3 color;uniform float vegetationTime;uniform float vegetationStrength;uniform float vegetationHeight;uniform float vegetationPhase;uniform vec2 vegetationDirection;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\nfloat vegetationRoot=smoothstep(${(ROOT_FRACTION * height).toFixed(6)},${(BEND_START_FRACTION * height).toFixed(6)},position.y);float vegetationBend=clamp(color.r,0.0,1.0)*vegetationRoot;float vegetationFlutter=clamp(color.g,0.0,1.0)*vegetationRoot;float vegetationCoherent=sin(vegetationTime+vegetationPhase+position.x*0.13+position.z*0.09);float vegetationDetail=sin(vegetationTime*3.7+color.b*6.28318530718)*0.13*vegetationFlutter;float vegetationOffset=(vegetationCoherent*vegetationBend+vegetationDetail)*vegetationHeight*0.032*vegetationStrength;transformed.x+=vegetationDirection.x*vegetationOffset;transformed.z+=vegetationDirection.y*vegetationOffset;`,
    );
}
function shadowMaterial(base, uniforms, height, distance = false) {
  const options = {
      map: base.map || null,
      alphaMap: base.alphaMap || null,
      alphaTest: base.alphaTest || 0,
      side: base.side,
    },
    material = distance
      ? new THREE.MeshDistanceMaterial(options)
      : new THREE.MeshDepthMaterial({
          ...options,
          depthPacking: THREE.RGBADepthPacking,
        });
  material.onBeforeCompile = (shader) => patchShader(shader, uniforms, height);
  material.customProgramCacheKey = () =>
    `vegetation-wind-v1-${distance ? "distance" : "depth"}-${height}`;
  return material;
}
export function attachVegetationWind(root, asset, resources = new Set()) {
  const uniforms = {
      vegetationTime: { value: 0 },
      vegetationStrength: { value: 0 },
      vegetationHeight: { value: asset.height },
      vegetationPhase: { value: phaseFor(asset.id) },
      vegetationDirection: { value: new THREE.Vector2(1, 0) },
    },
    meshes = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    if (!mesh.geometry.getAttribute("color"))
      throw new Error(`${asset.id} is missing required COLOR_0 wind data`);
    const bases = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material],
      materials = bases.map((base) => {
        const material = base.clone();
        material.vertexColors = false;
        material.onBeforeCompile = (shader) =>
          patchShader(shader, uniforms, asset.height);
        material.customProgramCacheKey = () =>
          `vegetation-wind-v1-visible-${asset.height}-${base.name}`;
        material.needsUpdate = true;
        resources.add(material);
        return material;
      });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.customDepthMaterial = shadowMaterial(bases[0], uniforms, asset.height);
    mesh.customDistanceMaterial = shadowMaterial(
      bases[0],
      uniforms,
      asset.height,
      true,
    );
    resources.add(mesh.customDepthMaterial);
    resources.add(mesh.customDistanceMaterial);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.expandByScalar(maxWindDeflection(asset.height));
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.boundingSphere.radius += maxWindDeflection(asset.height);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  });
  return { uniforms, meshes };
}
export function updateWind(state, { time, strength, direction }) {
  state.uniforms.vegetationTime.value = time;
  state.uniforms.vegetationStrength.value = strength;
  state.uniforms.vegetationDirection.value.set(direction[0], direction[1]);
}
function phaseFor(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 6283) / 1000;
}
