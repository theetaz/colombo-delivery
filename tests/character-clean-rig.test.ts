import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MODEL = new URL("../public/models/", import.meta.url);

async function readGlb(name: string) {
  const bytes = await readFile(new URL(name, MODEL));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as Glb;
  const binaryStart = 20 + jsonLength + 8;
  return { bytes, json, binary: bytes.subarray(binaryStart) };
}

function accessorBytes(glb: Awaited<ReturnType<typeof readGlb>>, index: number) {
  const accessor = glb.json.accessors[index]!;
  const view = glb.json.bufferViews[accessor.bufferView]!;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return glb.binary.subarray(offset, offset + view.byteLength);
}

function floatAccessor(glb: Awaited<ReturnType<typeof readGlb>>, index: number) {
  const bytes = accessorBytes(glb, index);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

function primitiveByMaterial(glb: Awaited<ReturnType<typeof readGlb>>, name: string) {
  return glb.json.meshes[0]!.primitives.find(
    ({ material }) => glb.json.materials[material!]?.name === name,
  )!;
}

function indexedCentroid(values: Float32Array, order: number[]) {
  const result = [0, 0, 0];
  for (const index of order) {
    result[0] += values[index * 3]!;
    result[1] += values[index * 3 + 1]!;
    result[2] += values[index * 3 + 2]!;
  }
  return result.map((value) => value / order.length);
}

function indices(glb: Awaited<ReturnType<typeof readGlb>>, index: number) {
  const accessor = glb.json.accessors[index]!;
  const bytes = accessorBytes(glb, index);
  if (accessor.componentType === 5123) return new Uint16Array(bytes.buffer, bytes.byteOffset, accessor.count);
  assert.equal(accessor.componentType, 5125);
  return new Uint32Array(bytes.buffer, bytes.byteOffset, accessor.count);
}

function jointAccessor(glb: Awaited<ReturnType<typeof readGlb>>, index: number) {
  const accessor = glb.json.accessors[index]!;
  const bytes = accessorBytes(glb, index);
  if (accessor.componentType === 5121) return new Uint8Array(bytes.buffer, bytes.byteOffset, accessor.count * 4);
  assert.equal(accessor.componentType, 5123);
  return new Uint16Array(bytes.buffer, bytes.byteOffset, accessor.count * 4);
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("clean rig preserves the approved neutral mesh, UVs, normals, and PBR regions", async () => {
  const [source, neutral, manifestBytes] = await Promise.all([
    readGlb("teen_courier.glb"),
    readGlb("teen_courier_clean_rig_neutral.glb"),
    readFile(new URL("teen_courier_clean_rig.manifest.json", MODEL)),
  ]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));

  assert.equal(manifest.revision, "teen-courier-clean-rig/1");
  assert.equal(manifest.status, "upper-body-deformation-checkpoint");
  assert.equal(sha256(source.bytes), manifest.provenance.sourceGlbSha256);
  assert.equal(sha256(neutral.bytes), manifest.hashes.neutralGlbSha256);
  assert.equal(neutral.json.skins?.length, 1);
  assert.equal(neutral.json.animations?.length ?? 0, 0);
  assert.ok(neutral.json.nodes.some(({ name }) => name === "TeenCourier_CleanRig"));
  assert.ok(neutral.json.nodes.some(({ name }) => name === "TeenCourier_Body"));

  const sourcePrimitives = source.json.meshes[0]!.primitives;
  const neutralPrimitives = neutral.json.meshes[0]!.primitives;
  assert.equal(neutralPrimitives.length, sourcePrimitives.length);
  for (let index = 0; index < sourcePrimitives.length; index += 1) {
    const approved = sourcePrimitives[index]!;
    const rigged = neutralPrimitives[index]!;
    const approvedMaterial = source.json.materials[approved.material!];
    const riggedMaterial = neutral.json.materials[rigged.material!];
    assert.equal(riggedMaterial?.name, approvedMaterial?.name);
    assert.deepEqual(
      {
        ...riggedMaterial?.pbrMetallicRoughness,
        baseColorFactor: riggedMaterial?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1],
      },
      approvedMaterial?.pbrMetallicRoughness,
    );
    assert.deepEqual(riggedMaterial?.normalTexture, approvedMaterial?.normalTexture);

    for (const semantic of ["POSITION", "TEXCOORD_0"] as const) {
      assert.deepEqual(
        accessorBytes(neutral, rigged.attributes[semantic]!),
        accessorBytes(source, approved.attributes[semantic]!),
        `${approvedMaterial?.name} ${semantic} changed from the approved standing source`,
      );
    }
    const approvedNormals = floatAccessor(source, approved.attributes.NORMAL!);
    const riggedNormals = floatAccessor(neutral, rigged.attributes.NORMAL!);
    assert.equal(riggedNormals.length, approvedNormals.length);
    for (let value = 0; value < approvedNormals.length; value += 1) {
      assert.ok(Math.abs(riggedNormals[value]! - approvedNormals[value]!) <= 2e-7,
        `${approvedMaterial?.name} normal ${value} changed beyond float export tolerance`);
    }
  }
});

test("upper-body checkpoint exports a forward baked pose with a rigid protected head", async () => {
  const [neutral, upperBody, manifestBytes] = await Promise.all([
    readGlb("teen_courier_clean_rig_neutral.glb"),
    readGlb("teen_courier_clean_rig_upper_body.glb"),
    readFile(new URL("teen_courier_clean_rig.manifest.json", MODEL)),
  ]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(sha256(upperBody.bytes), manifest.hashes.upperBodyGlbSha256);
  assert.equal(upperBody.json.skins?.length ?? 0, 0, "review pose must be baked into exported geometry");
  assert.equal(upperBody.json.animations?.length ?? 0, 0);
  assert.equal(manifest.rig.oldProviderArmatureUsed, false);
  for (const part of ["upper_arm", "forearm", "hand", "thigh", "shin", "foot"]) {
    assert.ok(manifest.rig.restBones[`${part}.L`].head[0] < 0, `${part}.L must be on rider left`);
    assert.ok(manifest.rig.restBones[`${part}.R`].head[0] > 0, `${part}.R must be on rider right`);
  }
  assert.ok(manifest.rig.restBones["foot.L"].tail[1] > manifest.rig.restBones["foot.L"].head[1]);
  assert.ok(manifest.rig.restBones["foot.R"].tail[1] > manifest.rig.restBones["foot.R"].head[1]);
  assert.match(manifest.weighting.headSelection, /authored neutral-source topology label/);
  assert.ok(manifest.weighting.rigidHeadVertexCount > 5_000);
  assert.equal(manifest.weighting.rigidHeadVertexIds.length, manifest.weighting.rigidHeadVertexCount);
  assert.ok(manifest.weighting.boundarySeamPairCount > 0);
  assert.ok(manifest.weighting.synchronizedSeamVertexCount > 0);
  assert.equal(manifest.validation.faceFairingSeedFullyProtected, true);
  assert.equal(manifest.validation.mouth17ComponentFullyProtected, true);
  assert.equal(manifest.validation.allWeightSumsNormalized, true);
  assert.ok(manifest.validation.neutralMaxVertexErrorMeters <= 2e-7);
  assert.ok(manifest.validation.rigidHeadMaxSingleTransformResidualMeters <= 2e-7);
  assert.ok(manifest.validation.pairedBoundarySeamMaxWeightError <= 1e-7);
  assert.ok(manifest.validation.posedBoundarySeamMaxGapIncreaseMeters <= 2e-7);
  assert.ok(manifest.validation.evaluatedToBakedMaxCornerNormalError <= 4e-4);
  assert.ok(manifest.validation.sourceNeutralToBakedProtectedMaxCornerNormalError <= 4e-4);
  assert.equal(manifest.validation.humanAppearanceReviewRequired, true);

  const neutralHair = primitiveByMaterial(neutral, "Teen_Hair");
  const posedHair = primitiveByMaterial(upperBody, "Teen_Hair");
  const before = floatAccessor(neutral, neutralHair.attributes.POSITION!);
  const after = floatAccessor(upperBody, posedHair.attributes.POSITION!);
  const beforeNormals = floatAccessor(neutral, neutralHair.attributes.NORMAL!);
  const afterNormals = floatAccessor(upperBody, posedHair.attributes.NORMAL!);
  const beforeUvs = floatAccessor(neutral, neutralHair.attributes.TEXCOORD_0!);
  const afterUvs = floatAccessor(upperBody, posedHair.attributes.TEXCOORD_0!);
  const beforeCorners = indices(neutral, neutralHair.indices!);
  const afterCorners = indices(upperBody, posedHair.indices!);
  const beforeOrder = Array.from(beforeCorners).sort(
    (a, b) => beforeUvs[a * 2]! - beforeUvs[b * 2]! || beforeUvs[a * 2 + 1]! - beforeUvs[b * 2 + 1]!,
  );
  const afterOrder = Array.from(afterCorners).sort(
    (a, b) => afterUvs[a * 2]! - afterUvs[b * 2]! || afterUvs[a * 2 + 1]! - afterUvs[b * 2 + 1]!,
  );
  const beforeCenter = indexedCentroid(before, beforeOrder);
  const afterCenter = indexedCentroid(after, afterOrder);
  const headTranslation = afterCenter.map((value, axis) => value - beforeCenter[axis]!);
  assert.ok(afterCenter[2]! < beforeCenter[2]! - 0.1, "head must move toward declared glTF -Z forward");
  const beforeRadii: number[] = [];
  const afterRadii: number[] = [];
  const beforeRadialNormals: number[] = [];
  const afterRadialNormals: number[] = [];
  for (let order = 0; order < beforeOrder.length; order += 1) {
    const beforeVertex = beforeOrder[order]!;
    const afterVertex = afterOrder[order]!;
    assert.equal(afterUvs[afterVertex * 2], beforeUvs[beforeVertex * 2], "hair U coordinate changed");
    assert.equal(afterUvs[afterVertex * 2 + 1], beforeUvs[beforeVertex * 2 + 1], "hair V coordinate changed");
    const i = beforeVertex * 3;
    const posedIndex = afterVertex * 3;
    const bx = before[i]! - beforeCenter[0]!;
    const by = before[i + 1]! - beforeCenter[1]!;
    const bz = before[i + 2]! - beforeCenter[2]!;
    const ax = after[posedIndex]! - afterCenter[0]!;
    const ay = after[posedIndex + 1]! - afterCenter[1]!;
    const az = after[posedIndex + 2]! - afterCenter[2]!;
    beforeRadii.push(Math.hypot(bx, by, bz));
    afterRadii.push(Math.hypot(ax, ay, az));
    const beforeDot = bx * beforeNormals[i]! + by * beforeNormals[i + 1]! + bz * beforeNormals[i + 2]!;
    const afterDot = ax * afterNormals[posedIndex]! + ay * afterNormals[posedIndex + 1]! + az * afterNormals[posedIndex + 2]!;
    beforeRadialNormals.push(beforeDot);
    afterRadialNormals.push(afterDot);
  }
  beforeRadii.sort((a, b) => a - b);
  afterRadii.sort((a, b) => a - b);
  beforeRadialNormals.sort((a, b) => a - b);
  afterRadialNormals.sort((a, b) => a - b);
  for (let i = 0; i < beforeRadii.length; i += 1) {
    assert.ok(Math.abs(beforeRadii[i]! - afterRadii[i]!) <= 3e-6,
      `hair radius ${i} changed under the claimed rigid transform`);
    assert.ok(Math.abs(beforeRadialNormals[i]! - afterRadialNormals[i]!) <= 1e-2,
      `hair normal invariant ${i} changed under the claimed rigid transform`);
  }


  const headJoint = neutral.json.skins![0]!.joints.findIndex(
    (node) => neutral.json.nodes[node]?.name === "head",
  );
  assert.ok(headJoint >= 0);
  for (const material of ["Teen_Skin", "Teen_Hair"]) {
    const neutralPrimitive = primitiveByMaterial(neutral, material);
    const posedPrimitive = primitiveByMaterial(upperBody, material);
    const neutralPositions = floatAccessor(neutral, neutralPrimitive.attributes.POSITION!);
    const posedPositions = floatAccessor(upperBody, posedPrimitive.attributes.POSITION!);
    const neutralNormals = floatAccessor(neutral, neutralPrimitive.attributes.NORMAL!);
    const posedNormals = floatAccessor(upperBody, posedPrimitive.attributes.NORMAL!);
    const neutralUvs = floatAccessor(neutral, neutralPrimitive.attributes.TEXCOORD_0!);
    const posedUvs = floatAccessor(upperBody, posedPrimitive.attributes.TEXCOORD_0!);
    const joints = jointAccessor(neutral, neutralPrimitive.attributes.JOINTS_0!);
    const weights = floatAccessor(neutral, neutralPrimitive.attributes.WEIGHTS_0!);
    const neutralIndices = Array.from(indices(neutral, neutralPrimitive.indices!));
    const posedIndices = Array.from(indices(upperBody, posedPrimitive.indices!));
    const uvKey = (uvs: Float32Array, vertex: number) =>
      `${uvs[vertex * 2]},${uvs[vertex * 2 + 1]}`;
    const cornerKey = (uvs: Float32Array, corners: number[], offset: number) => {
      const triangle = Math.floor(offset / 3) * 3;
      const vertex = corners[offset]!;
      const neighbors = [0, 1, 2]
        .map((slot) => corners[triangle + slot]!)
        .filter((candidate) => candidate !== vertex)
        .map((candidate) => uvKey(uvs, candidate))
        .sort();
      return `${uvKey(uvs, vertex)}|${neighbors.join("|")}`;
    };
    const posedCorners = new Map<string, number[]>();
    for (let corner = 0; corner < posedIndices.length; corner += 1) {
      const key = cornerKey(posedUvs, posedIndices, corner);
      posedCorners.set(key, [...(posedCorners.get(key) ?? []), posedIndices[corner]!]);
    }
    const candidates = new Map<string, number[]>();
    for (let vertex = 0; vertex < posedUvs.length / 2; vertex += 1) {
      const key = `${posedUvs[vertex * 2]},${posedUvs[vertex * 2 + 1]}`;
      candidates.set(key, [...(candidates.get(key) ?? []), vertex]);
    }
    let protectedExportVertices = 0;
    for (let vertex = 0; vertex < neutralUvs.length / 2; vertex += 1) {
      let headWeight = 0;
      for (let slot = 0; slot < 4; slot += 1) {
        if (joints[vertex * 4 + slot] === headJoint) headWeight += weights[vertex * 4 + slot]!;
      }
      if (headWeight < 0.99999) continue;
      protectedExportVertices += 1;
      const key = `${neutralUvs[vertex * 2]},${neutralUvs[vertex * 2 + 1]}`;
      const choices = candidates.get(key) ?? [];
      const expected = [0, 1, 2].map((axis) => neutralPositions[vertex * 3 + axis]! + headTranslation[axis]!);
      const matches = choices.map((candidate) => {
        const error = Math.hypot(...[0, 1, 2].map((axis) => posedPositions[candidate * 3 + axis]! - expected[axis]!));
        const normalError = Math.max(...[0, 1, 2].map((axis) =>
          Math.abs(posedNormals[candidate * 3 + axis]! - neutralNormals[vertex * 3 + axis]!)));
        return { candidate, error, normalError };
      });
      const positionalMatches = matches.filter(({ error }) => error <= 3e-6);
      const match = (positionalMatches.sort((a, b) => a.normalError - b.normalError)[0]
        ?? matches.sort((a, b) => a.error - b.error)[0])
        ?? { candidate: -1, error: Infinity, normalError: Infinity };
      assert.ok(match.error <= 3e-6, `${material} protected vertex ${vertex} is not the exported rigid head transform`);
    }
    assert.ok(protectedExportVertices > (material === "Teen_Hair" ? 10_000 : 1_000));

    let protectedCorners = 0;
    for (let corner = 0; corner < neutralIndices.length; corner += 1) {
      const vertex = neutralIndices[corner]!;
      let headWeight = 0;
      for (let slot = 0; slot < 4; slot += 1) {
        if (joints[vertex * 4 + slot] === headJoint) headWeight += weights[vertex * 4 + slot]!;
      }
      if (headWeight < 0.99999) continue;
      protectedCorners += 1;
      const expected = [0, 1, 2].map((axis) => neutralPositions[vertex * 3 + axis]! + headTranslation[axis]!);
      const matches = (posedCorners.get(cornerKey(neutralUvs, neutralIndices, corner)) ?? [])
        .map((candidate) => ({
          candidate,
          positionError: Math.hypot(...[0, 1, 2].map((axis) => posedPositions[candidate * 3 + axis]! - expected[axis]!)),
          normalError: Math.hypot(...[0, 1, 2].map((axis) => posedNormals[candidate * 3 + axis]! - neutralNormals[vertex * 3 + axis]!)),
        }))
        .filter(({ positionError }) => positionError <= 3e-6)
        .sort((a, b) => a.normalError - b.normalError);
      assert.ok(matches.length > 0, `${material} protected triangle corner ${corner} has no baked counterpart`);
      assert.ok(matches[0]!.normalError <= 4e-4,
        `${material} protected triangle corner ${corner} vertex ${vertex} at ${[
          neutralPositions[vertex * 3], neutralPositions[vertex * 3 + 1], neutralPositions[vertex * 3 + 2],
        ].join(",")} normal changed by ${matches[0]!.normalError}`);
    }
    assert.ok(protectedCorners > (material === "Teen_Hair" ? 20_000 : 2_000));
  }
});

interface Glb {
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType?: number; count: number }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number }>;
  nodes: Array<{ name?: string }>;
  skins?: Array<{ joints: number[] }>;
  animations?: unknown[];
  meshes: Array<{ primitives: Array<{ material?: number; indices?: number; attributes: Record<string, number> }> }>;
  materials: Array<{
    name?: string;
    normalTexture?: unknown;
    pbrMetallicRoughness?: { baseColorFactor?: number[]; [key: string]: unknown };
  }>;
}
