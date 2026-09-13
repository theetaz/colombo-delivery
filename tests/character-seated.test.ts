import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { validateCommuterBicycle } from "../src/scene/CommuterBicycleModel";
import { validateSeatedCourier } from "../src/scene/SeatedCourierModel";

const MAX_PLAUSIBLE_TRIANGLE_EDGE_M = 0.22;

function triangleEdgeMetrics(root: THREE.Object3D) {
  const lengths: number[] = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const positions = node.geometry.getAttribute("position");
    const indices = node.geometry.index;
    assert.ok(indices, `${node.name} must use indexed triangle geometry`);
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();
    for (let offset = 0; offset < indices.count; offset += 3) {
      const triangle = [
        indices.getX(offset),
        indices.getX(offset + 1),
        indices.getX(offset + 2),
      ];
      for (let edge = 0; edge < 3; edge += 1) {
        first
          .fromBufferAttribute(positions, triangle[edge]!)
          .applyMatrix4(node.matrixWorld);
        second
          .fromBufferAttribute(positions, triangle[(edge + 1) % 3]!)
          .applyMatrix4(node.matrixWorld);
        lengths.push(first.distanceTo(second));
      }
    }
  });
  lengths.sort((first, second) => first - second);
  assert.ok(lengths.length > 0, "seated courier must contain triangle edges");
  return {
    maxTriangleEdgeM: lengths.at(-1)!,
    p999TriangleEdgeM: lengths[Math.floor(lengths.length * 0.999)]!,
    edgesOver020M: lengths.filter((length) => length > 0.2).length,
  };
}

test("static seated courier loads at identity with measured surface contacts", async () => {
  (globalThis as typeof globalThis & { self: typeof globalThis }).self =
    globalThis;
  const load = async (name: string) => {
    const bytes = await readFile(
      new URL(`../public/models/${name}`, import.meta.url),
    );
    return new GLTFLoader().parseAsync(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
      "",
    );
  };
  const [courier, bicycle] = await Promise.all([
    load("teen_courier_seated_v2.glb"),
    load("commuter_bicycle_v2.glb"),
  ]);
  const riderResult = validateSeatedCourier(courier.scene);
  const bikeResult = validateCommuterBicycle(bicycle.scene);
  assert.equal(riderResult.ok, true);
  assert.equal(bikeResult.ok, true);
  if (!riderResult.ok || !bikeResult.ok) return;
  assert.equal(courier.animations.length, 0);
  let skinnedMeshes = 0;
  courier.scene.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) skinnedMeshes += 1;
  });
  assert.equal(
    skinnedMeshes,
    0,
    "fit-review rider must remain a static baked mesh",
  );
  const bounds = new THREE.Box3().setFromObject(
    riderResult.nodes.get("TeenCourierSeatedV2")!,
    true,
  );
  assert.ok(
    [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite),
  );
  // The rejected 6255dc3 fit reached 0.371312 m because torso/shirt vertices
  // separated into long spikes. The approved upright source peaks at 0.195273 m;
  // its intended 1.08 fit scale remains below this 0.22 m limit.
  const geometryQuality = triangleEdgeMetrics(
    riderResult.nodes.get("TeenCourierSeatedV2")!,
  );
  assert.ok(
    geometryQuality.maxTriangleEdgeM <= MAX_PLAUSIBLE_TRIANGLE_EDGE_M,
    `seated courier has a ${geometryQuality.maxTriangleEdgeM.toFixed(6)} m triangle edge; likely baked deformation`,
  );
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../public/models/teen_courier_seated_v2.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(manifest.revision, "teen-courier-seated-v2/2");
  for (const key of [
    "maxTriangleEdgeM",
    "p999TriangleEdgeM",
    "edgesOver020M",
  ] as const) {
    assert.ok(
      Math.abs(geometryQuality[key] - manifest.geometryQuality[key]) < 1e-6,
      `${key} differs from independently measured baked geometry`,
    );
  }
  assert.equal(
    manifest.approvedBicycle.sha256,
    "ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125",
  );
  const contacts = {
    PelvisContact: "Seat_Attach",
    Palm_L_Contact: "Grip_L_Attach",
    Palm_R_Contact: "Grip_R_Attach",
    Sole_L_Contact: "Pedal_L_Attach",
    Sole_R_Contact: "Pedal_R_Attach",
  } as const;
  courier.scene.updateMatrixWorld(true);
  bicycle.scene.updateMatrixWorld(true);
  for (const [contact, anchor] of Object.entries(contacts)) {
    const measured = riderResult.nodes
      .get(contact)!
      .getWorldPosition(new THREE.Vector3());
    const sourceTarget = manifest.fit.targetPositionsBlenderZUp[contact] as [
      number,
      number,
      number,
    ];
    const target = new THREE.Vector3(
      sourceTarget[0],
      sourceTarget[2],
      -sourceTarget[1],
    );
    const residual = measured.distanceTo(target);
    assert.ok(
      Math.abs(residual - manifest.fit.residualsM[contact]) < 2e-5,
      `${contact} residual ${residual} differs from manifest`,
    );
    const bikeAnchor = bikeResult.nodes
      .get(anchor)!
      .getWorldPosition(new THREE.Vector3());
    assert.ok(
      target.distanceTo(bikeAnchor) <
        (contact.startsWith("Palm") ? 0.018 : 1e-5),
      `${contact} target does not derive from ${anchor}`,
    );
  }
});
