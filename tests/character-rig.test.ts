import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("normalized teen courier rig keeps leg weights off the hand surface", async () => {
  const bytes = await readFile(new URL("../public/models/teen_courier_rig_review.glb", import.meta.url));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as GlbDocument;
  const binaryOffset = 20 + jsonLength;
  const binaryLength = bytes.readUInt32LE(binaryOffset);
  const binary = bytes.subarray(binaryOffset + 8, binaryOffset + 8 + binaryLength);

  assert.equal(gltf.skins.length, 1);
  const skin = gltf.skins[0]!;
  assert.equal(skin.joints.length, 58, "accepted provider rig has 58 exported joints");
  const jointNames = skin.joints.map((nodeIndex) => gltf.nodes[nodeIndex]?.name ?? "");
  const legJointSlots = new Set(
    jointNames.flatMap((name, slot) => /^tripo::0_(Left|Right)_Limb_[0-3]$/.test(name) ? [slot] : []),
  );
  assert.equal(legJointSlots.size, 8, "both four-bone leg chains must remain discoverable");

  const rootIndex = gltf.scenes[gltf.scene ?? 0]!.nodes.find((index) => gltf.nodes[index]?.name === "TeenCourierRig");
  assert.notEqual(rootIndex, undefined);
  const root = gltf.nodes[rootIndex!]!;
  assert.equal(root.extras?.upAxis, "+Y");
  assert.equal(root.extras?.forwardAxis, "-Z");
  assert.equal(root.extras?.heightMeters, 1.62);

  const primitive = gltf.meshes[0]!.primitives[0]!;
  const positions = readAccessor(gltf, binary, primitive.attributes.POSITION);
  const joints = readAccessor(gltf, binary, primitive.attributes.JOINTS_0);
  const weights = readAccessor(gltf, binary, primitive.attributes.WEIGHTS_0);
  assert.equal(positions.length, joints.length);
  assert.equal(positions.length, weights.length);

  let minY = Infinity;
  let maxY = -Infinity;
  let handVertices = 0;
  for (let index = 0; index < positions.length; index += 1) {
    const weight = weights[index]!;
    assert.ok(weight.every(Number.isFinite), `vertex ${index} has finite skin weights`);
    const sum = weight.reduce((total, value) => total + value, 0);
    assert.ok(Math.abs(sum - 1) < 2e-4, `vertex ${index} weights normalize to one`);

    // Blender's glTF exporter applies the normalized object transform to the
    // skinned POSITION accessor; these values are the standing world contract.
    const world = positions[index]!;
    minY = Math.min(minY, world[1]);
    maxY = Math.max(maxY, world[1]);
    if (Math.abs(world[0]) <= 0.26 || world[1] <= 0.55 || world[1] >= 0.85) continue;
    handVertices += 1;
    for (let component = 0; component < 4; component += 1) {
      const slot = Math.round(joints[index]![component]!);
      assert.ok(
        !legJointSlots.has(slot) || weight[component]! <= 1e-6,
        `hand vertex ${index} must not follow leg joint ${jointNames[slot]}`,
      );
    }
  }
  assert.ok(handVertices > 500, "test must cover the confirmed hanging-hand surface region");
  assert.ok(Math.abs(minY) < 1e-4, "rig is grounded at Y=0");
  assert.ok(Math.abs(maxY - 1.62) < 1e-3, "rig height remains 1.62m");
});

function readAccessor(gltf: GlbDocument, binary: Buffer, index: number): number[][] {
  const accessor = gltf.accessors[index]!;
  const view = gltf.bufferViews[accessor.bufferView]!;
  const widths: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const byteWidths: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const width = widths[accessor.type]!;
  const componentBytes = byteWidths[accessor.componentType]!;
  const stride = view.byteStride ?? width * componentBytes;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const rows: number[][] = [];
  for (let row = 0; row < accessor.count; row += 1) {
    const values: number[] = [];
    for (let column = 0; column < width; column += 1) {
      const offset = base + row * stride + column * componentBytes;
      let value: number;
      switch (accessor.componentType) {
        case 5120: value = binary.readInt8(offset); break;
        case 5121: value = binary.readUInt8(offset); break;
        case 5122: value = binary.readInt16LE(offset); break;
        case 5123: value = binary.readUInt16LE(offset); break;
        case 5125: value = binary.readUInt32LE(offset); break;
        case 5126: value = binary.readFloatLE(offset); break;
        default: throw new Error(`unsupported component type ${accessor.componentType}`);
      }
      if (accessor.normalized && accessor.componentType !== 5126) {
        const maxima: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 4294967295 };
        value /= maxima[accessor.componentType]!;
      }
      values.push(value);
    }
    rows.push(values);
  }
  return rows;
}

interface Node {
  name?: string;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  extras?: { upAxis?: string; forwardAxis?: string; heightMeters?: number };
}

interface GlbDocument {
  scene?: number;
  scenes: Array<{ nodes: number[] }>;
  nodes: Node[];
  skins: Array<{ joints: number[] }>;
  meshes: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; normalized?: boolean; count: number; type: string }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number; byteStride?: number }>;
}
