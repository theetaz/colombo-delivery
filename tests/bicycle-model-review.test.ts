import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BicycleMechanics,
  COMMUTER_BICYCLE_V2_NODES,
  validateCommuterBicycle,
} from "../src/scene/CommuterBicycleModel";

test("commuter bicycle contract requires the complete mechanical hierarchy", () => {
  const root = new THREE.Group();
  root.name = "CommuterBicycleV2";
  const result = validateCommuterBicycle(root);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.missing.includes("FrontWheel"));
});
test("mechanical demonstration composes motion onto authored rest pivots", () => {
  const nodes = new Map<string, THREE.Object3D>();
  for (const name of COMMUTER_BICYCLE_V2_NODES)
    nodes.set(name, new THREE.Group());
  const rest = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    0.2,
  );
  nodes.get("FrontAssembly")!.quaternion.copy(rest);
  const mechanics = new BicycleMechanics(nodes);
  mechanics.apply(0.7, 0.4, 0.5);
  const expected = rest
    .clone()
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.25),
    );
  assert.ok(nodes.get("FrontAssembly")!.quaternion.angleTo(expected) < 1e-7);
  assert.ok(Math.abs(nodes.get("Crank")!.rotation.x - 0.4) < 1e-9);
  assert.ok(Math.abs(nodes.get("Pedal_L")!.rotation.x + 0.4) < 1e-9);
});

test("published commuter bicycle loads with its mechanical hierarchy and ground contact", async () => {
  (globalThis as typeof globalThis & { self: typeof globalThis }).self =
    globalThis;
  const bytes = await readFile(
    new URL("../public/models/commuter_bicycle_v2.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
    "",
  );
  const result = validateCommuterBicycle(gltf.scene);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.nodes.get("FrontWheel")!.parent,
    result.nodes.get("FrontAssembly"),
  );
  const bounds = new THREE.Box3().setFromObject(
    result.nodes.get("CommuterBicycleV2")!,
    true,
  );
  assert.ok(
    Math.abs(bounds.min.y) < 0.005,
    `tire ground is ${bounds.min.y}m rather than y=0`,
  );
  const mechanics = new BicycleMechanics(result.nodes);
  const pedalRest = new Map(
    ["Pedal_L", "Pedal_R"].map((name) => [
      name,
      result.nodes.get(name)!.getWorldQuaternion(new THREE.Quaternion()),
    ]),
  );
  for (let phase = 0; phase < 24; phase++) {
    mechanics.apply(0, (phase / 24) * Math.PI * 2, 0);
    gltf.scene.updateMatrixWorld(true);
    for (const name of ["Pedal_L", "Pedal_R"])
      assert.ok(
        result.nodes
          .get(name)!
          .getWorldQuaternion(new THREE.Quaternion())
          .angleTo(pedalRest.get(name)!) < 1e-6,
        `${name} tilts at crank phase ${phase}`,
      );
  }
  mechanics.apply(0, 0, 0);
  gltf.scene.updateMatrixWorld(true);
  const steeringAxis = new THREE.Vector3(0, 1, 0).transformDirection(
    result.nodes.get("FrontAssembly")!.matrixWorld,
  );
  for (const steer of [-1, 1]) {
    mechanics.apply(0, 0, steer);
    gltf.scene.updateMatrixWorld(true);
    const movedAxis = new THREE.Vector3(0, 1, 0).transformDirection(
      result.nodes.get("FrontAssembly")!.matrixWorld,
    );
    assert.ok(
      steeringAxis.angleTo(movedAxis) < 1e-6,
      "authored steering axis changes while steering",
    );
  }
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../public/models/commuter_bicycle_v2.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(manifest.revision, "commuter-bicycle-v2/1");
});
