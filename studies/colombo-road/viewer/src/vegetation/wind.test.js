import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  attachVegetationWind,
  maxWindDeflection,
  sampleWindDisplacement,
  windEnvelope,
} from "./wind.js";
test("wind locks the bottom four percent and calm is mathematically exact", () => {
  assert.equal(windEnvelope(0.32, 8), 0);
  assert.ok(windEnvelope(0.97, 8) > 0);
  assert.deepEqual(
    sampleWindDisplacement({ position: [1, 8, 1], height: 8, strength: 0 }),
    [0, 0, 0],
  );
  assert.deepEqual(
    sampleWindDisplacement({ position: [1, 0.1, 1], height: 8, strength: 1 }),
    [0, 0, 0],
  );
  assert.deepEqual(
    sampleWindDisplacement({
      position: [1, 8, 1],
      height: 8,
      mask: [0, 0, 0.5],
      strength: 1,
    }),
    [0, 0, 0],
  );
});
test("wind deflection scales with height and bounds every sample", () => {
  assert.ok(maxWindDeflection(0.25, 1) > 0.009);
  assert.ok(maxWindDeflection(8, 0.5) > 0.144);
  for (const height of [0.25, 0.9, 6, 8, 9])
    for (const fraction of [0, 0.04, 0.12, 0.5, 1])
      for (const time of [0, 0.3, 1, 4.7, 19])
        for (const phase of [0, 0.25, 0.5, 1])
          for (const direction of [
            [1, 0],
            [0, 1],
            [Math.SQRT1_2, Math.SQRT1_2],
          ]) {
            const displacement = sampleWindDisplacement({
              position: [phase * 3, height * fraction, -phase],
              height,
              mask: [1, 1, phase],
              time,
              strength: 1,
              direction,
              assetPhase: phase * Math.PI * 2,
            });
            assert.ok(
              Math.hypot(displacement[0], displacement[2]) <=
                maxWindDeflection(height, 1),
            );
          }
});
test("COLOR_0 drives every render pass without tinting the base material", () => {
  const geometry = new THREE.BoxGeometry(1, 2, 1),
    count = geometry.attributes.position.count;
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(count * 4).fill(0.5), 4),
  );
  const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0x448844, vertexColors: true }),
    ),
    state = attachVegetationWind(mesh, { id: "vegetation.test", height: 2 });
  assert.equal(mesh.material.vertexColors, false);
  const shaders = [
    mesh.material,
    mesh.customDepthMaterial,
    mesh.customDistanceMaterial,
  ].map((material) => {
    const shader = { uniforms: {}, vertexShader: "#include <begin_vertex>" };
    material.onBeforeCompile(shader);
    return shader;
  });
  for (const shader of shaders) {
    assert.match(shader.vertexShader, /attribute vec3 color/);
    assert.match(shader.vertexShader, /vegetationCoherent/);
    assert.equal(shader.uniforms.vegetationTime, state.uniforms.vegetationTime);
  }
  assert.ok(mesh.geometry.boundingBox.min.x < -0.57);
});
