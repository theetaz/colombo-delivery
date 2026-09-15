import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { attachWind, updateWind } from "./wind.js";

function candidate() {
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 4).fill(.5), 4));
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
}

test("instance identity varies phase and rotated assets receive world-correct direction", () => {
  const a = candidate(), b = candidate();
  b.rotation.y = Math.PI / 2;
  b.updateMatrixWorld(true);
  const first = attachWind(a, { height: 8 }, "tree:first");
  const second = attachWind(b, { height: 8 }, "tree:second");
  updateWind(first, 2, .5, 0);
  updateWind(second, 2, .5, 0);
  assert.notEqual(first.uniforms.environmentWindPhase.value, second.uniforms.environmentWindPhase.value);
  assert.ok(Math.abs(second.uniforms.environmentWindDirection.value.y - 1) < 1e-6);
  assert.equal(first.meshes[0].material.vertexColors, false);
  assert.ok(first.meshes[0].customDepthMaterial && first.meshes[0].customDistanceMaterial);
});
