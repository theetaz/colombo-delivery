import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import {
  attachmentPositionInRoot,
  bicycleHeadingToVisualRotation,
  COURIER_BICYCLE_CONTRACT,
  validateCourierBicycleRig,
} from "../src/scene/BicycleVisual";

test("courier bicycle contract reports missing animation and attachment nodes", () => {
  const incomplete = new THREE.Group();
  incomplete.add(Object.assign(new THREE.Group(), { name: "RearWheel" }));
  const result = validateCourierBicycleRig(incomplete);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.missing.includes("FrontAssembly"));
    assert.ok(result.missing.includes("Cargo_Attach"));
  }
});

test("nested pedal attachments resolve into bicycle-root space after crank rotation", () => {
  const root = new THREE.Group();
  const crank = Object.assign(new THREE.Group(), { name: "Crank" });
  const platform = Object.assign(new THREE.Group(), { name: "Pedal_L" });
  const pedal = Object.assign(new THREE.Group(), { name: "Pedal_L_Attach" });
  root.add(crank);
  crank.add(platform);
  platform.add(pedal);
  crank.position.set(0, 0.45, 0.06);
  platform.position.set(-0.1, 0.18, 0);
  pedal.position.set(0, 0, 0);
  crank.rotation.x = Math.PI / 2;
  platform.rotation.x = -crank.rotation.x;
  const position = attachmentPositionInRoot(root, pedal);
  assert.ok(position.distanceTo(new THREE.Vector3(-0.1, 0.45, 0.24)) < 1e-9);
});

test("clockwise controller heading maps to the visual root convention", () => {
  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), bicycleHeadingToVisualRotation(Math.PI / 2));
  assert.ok(forward.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9, "clockwise 90° points toward world east (+X)");
});

test("generated courier GLB preserves the runtime hierarchy and identity-space pivots", async () => {
  const bytes = await readFile(new URL("../public/models/courier_bicycle.glb", import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as GlbDocument;
  const index = (name: string) => gltf.nodes.findIndex((node) => node.name === name);
  const node = (name: string) => gltf.nodes[index(name)];
  const parentName = (name: string) => gltf.nodes.find((candidate) => candidate.children?.includes(index(name)))?.name;
  const close = (actual: number[] | undefined, expected: number[]) => assert.ok(actual && new THREE.Vector3().fromArray(actual).distanceTo(new THREE.Vector3().fromArray(expected)) < 1e-5, `${actual} != ${expected}`);
  for (const requiredName of COURIER_BICYCLE_CONTRACT.requiredNodes) {
    assert.notEqual(index(requiredName), -1, `missing runtime contract node ${requiredName}`);
  }
  assert.deepEqual(node("CourierBicycle")?.translation ?? [0, 0, 0], [0, 0, 0]);
  assert.deepEqual(node("CourierBicycle")?.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1]);
  assert.deepEqual(node("CourierBicycle")?.scale ?? [1, 1, 1], [1, 1, 1]);
  close(node("RearWheel")?.translation, [0, 0.34, 0.54]);
  close(node("FrontAssembly")?.translation, [0, 0, -0.54]);
  close(node("FrontWheel")?.translation, [0, 0.34, 0]);
  close(node("Crank")?.translation, [0, 0.45, 0.06]);
  assert.equal(parentName("FrontWheel"), "FrontAssembly");
  assert.equal(parentName("Pedal_L"), "Crank");
  assert.equal(parentName("Pedal_R"), "Crank");
  assert.equal(parentName("Pedal_L_Attach"), "Pedal_L");
  assert.equal(parentName("Pedal_R_Attach"), "Pedal_R");
  assert.equal(parentName("Grip_L_Attach"), "FrontAssembly");
  assert.equal(parentName("Grip_R_Attach"), "FrontAssembly");
  assert.equal(parentName("Sole_L"), "Foot_L");
  assert.equal(parentName("Sole_R"), "Foot_R");
  assert.equal(index("Knee_L"), -1);
  assert.equal(index("Elbow_L"), -1);
  close(node("Pedal_L")?.translation, [-0.1, 0.18, 0]);
  close(node("Pedal_R")?.translation, [0.1, -0.18, 0]);
  close(worldPosition(gltf, "FrontWheel"), [0, 0.34, -0.54]);
  close(worldPosition(gltf, "RearWheel"), [0, 0.34, 0.54]);
  close(worldPosition(gltf, "Pedal_L_Attach"), [-0.1, 0.63, 0.06]);
  close(worldPosition(gltf, "Pedal_R_Attach"), [0.1, 0.27, 0.06]);
  for (const tyreName of ["Front_Tyre", "Rear_Tyre"]) {
    const tyreNode = node(tyreName);
    assert.notEqual(tyreNode?.mesh, undefined, `${tyreName} must reference geometry`);
    const positionAccessor = gltf.accessors[gltf.meshes[tyreNode!.mesh!]?.primitives[0]?.attributes.POSITION ?? -1];
    assert.ok(positionAccessor?.min && positionAccessor.max, `${tyreName} must export geometry bounds`);
    const diameter = (positionAccessor!.max![0] ?? 0) - (positionAccessor!.min![0] ?? 0);
    assert.ok(Math.abs(diameter - COURIER_BICYCLE_CONTRACT.wheelRadius * 2) < 1e-5, `${tyreName} diameter ${diameter} must be 0.68 m`);
  }
  for (const name of ["Rider_Skin", "Rider_Hair", "Rider_Shirt", "Rider_Shorts", "Rider_Shoes", "Courier_Bag", "Courier_Bag_Trim"]) {
    assert.ok(gltf.materials.some((material) => material.name === name), `missing appearance material ${name}`);
  }
  for (const name of ["Face_Profile_Classic", "Face_Profile_Soft", "Face_Profile_Angular"]) {
    assert.deepEqual(node(name)?.scale ?? [1, 1, 1], [1, 1, 1], `${name} must export at identity scale`);
  }
  assert.ok((gltf.images?.length ?? 0) > 0, "textured courier must contain embedded images");
  for (const mesh of gltf.meshes.filter(({ name }) => /HeadMesh|Rider_TorsoMesh/.test(name ?? ""))) {
    assert.ok(mesh.primitives.every((primitive) => primitive.attributes.TEXCOORD_0 !== undefined), `${mesh.name} must retain UV coordinates`);
    assert.ok(signedMeshVolume(bytes, gltf, jsonLength, mesh) > 0, `${mesh.name} faces must wind outward`);
  }
});

interface GlbDocument {
  nodes: Array<{ name?: string; translation?: number[]; rotation?: number[]; scale?: number[]; children?: number[]; mesh?: number }>;
  materials: Array<{ name?: string }>;
  images?: unknown[];
  meshes: Array<{ name?: string; primitives: Array<{ attributes: Record<string, number>; indices?: number }> }>;
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; count: number; type: "SCALAR" | "VEC2" | "VEC3" | "VEC4"; min?: number[]; max?: number[] }>;
  bufferViews: Array<{ byteOffset?: number; byteStride?: number }>;
}

function worldPosition(gltf: GlbDocument, name: string): number[] {
  const nodeIndex = gltf.nodes.findIndex((node) => node.name === name);
  assert.notEqual(nodeIndex, -1, `missing node ${name}`);
  const chain: number[] = [];
  let current = nodeIndex;
  while (current !== -1) {
    chain.unshift(current);
    current = gltf.nodes.findIndex((candidate) => candidate.children?.includes(current));
  }
  const matrix = new THREE.Matrix4();
  for (const index of chain) {
    const source = gltf.nodes[index]!;
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(source.translation ?? [0, 0, 0]),
      new THREE.Quaternion().fromArray(source.rotation ?? [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(source.scale ?? [1, 1, 1]),
    );
    matrix.multiply(local);
  }
  return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
}

function signedMeshVolume(bytes: Buffer, gltf: GlbDocument, jsonLength: number, mesh: GlbDocument["meshes"][number]): number {
  const binaryStart = 28 + jsonLength;
  const readAccessor = (accessorIndex: number): number[] => {
    const accessor = gltf.accessors[accessorIndex]!;
    const view = gltf.bufferViews[accessor.bufferView]!;
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const componentSize = accessor.componentType === 5123 ? 2 : 4;
    const stride = view.byteStride ?? components * componentSize;
    const values: number[] = [];
    for (let item = 0; item < accessor.count; item += 1) {
      for (let component = 0; component < components; component += 1) {
        const offset = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + item * stride + component * componentSize;
        values.push(accessor.componentType === 5126 ? bytes.readFloatLE(offset) : accessor.componentType === 5125 ? bytes.readUInt32LE(offset) : bytes.readUInt16LE(offset));
      }
    }
    return values;
  };
  let volume = 0;
  for (const primitive of mesh.primitives) {
    const positions = readAccessor(primitive.attributes.POSITION!);
    const indices = primitive.indices === undefined ? [...Array(positions.length / 3).keys()] : readAccessor(primitive.indices);
    for (let index = 0; index < indices.length; index += 3) {
      const a = indices[index]! * 3;
      const b = indices[index + 1]! * 3;
      const c = indices[index + 2]! * 3;
      const ax = positions[a] ?? 0;
      const ay = positions[a + 1] ?? 0;
      const az = positions[a + 2] ?? 0;
      const bx = positions[b] ?? 0;
      const by = positions[b + 1] ?? 0;
      const bz = positions[b + 2] ?? 0;
      const cx = positions[c] ?? 0;
      const cy = positions[c + 1] ?? 0;
      const cz = positions[c + 2] ?? 0;
      volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
    }
  }
  return volume;
}
