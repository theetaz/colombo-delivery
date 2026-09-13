import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Primitive = { material: number; indices: number; attributes: Record<string, number> };
type Document = {
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; count: number }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number }>;
  materials: Array<{ name: string }>;
  meshes: Array<{ primitives: Primitive[] }>;
};

async function parse(url: URL) {
  const bytes = await readFile(url);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as Document;
  return { json, binary: bytes.subarray(20 + jsonLength + 8) };
}

function bytes(glb: Awaited<ReturnType<typeof parse>>, index: number) {
  const accessor = glb.json.accessors[index]!;
  const view = glb.json.bufferViews[accessor.bufferView]!;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return glb.binary.subarray(offset, offset + view.byteLength);
}

function floats(glb: Awaited<ReturnType<typeof parse>>, index: number) {
  const value = bytes(glb, index);
  return new Float32Array(value.buffer, value.byteOffset, value.byteLength / 4);
}

function indexes(glb: Awaited<ReturnType<typeof parse>>, index: number) {
  const accessor = glb.json.accessors[index]!;
  const value = bytes(glb, index);
  if (accessor.componentType === 5123) return Array.from(new Uint16Array(value.buffer, value.byteOffset, accessor.count));
  assert.equal(accessor.componentType, 5125);
  return Array.from(new Uint32Array(value.buffer, value.byteOffset, accessor.count));
}

export async function measureUvPairedTriangleStrain(sourceUrl: URL, posedUrl: URL) {
  const [source, posed] = await Promise.all([parse(sourceUrl), parse(posedUrl)]);
  let minRatio = Infinity;
  let maxRatio = -Infinity;
  let edgeCount = 0;
  for (const sourcePrimitive of source.json.meshes[0]!.primitives) {
    const material = source.json.materials[sourcePrimitive.material]!.name;
    const posedPrimitive = posed.json.meshes[0]!.primitives.find(
      (primitive) => posed.json.materials[primitive.material]!.name === material,
    )!;
    const sourcePositions = floats(source, sourcePrimitive.attributes.POSITION!);
    const posedPositions = floats(posed, posedPrimitive.attributes.POSITION!);
    const sourceUvs = floats(source, sourcePrimitive.attributes.TEXCOORD_0!);
    const posedUvs = floats(posed, posedPrimitive.attributes.TEXCOORD_0!);
    const sourceIndices = indexes(source, sourcePrimitive.indices);
    const posedIndices = indexes(posed, posedPrimitive.indices);
    assert.equal(posedIndices.length, sourceIndices.length);
    for (let corner = 0; corner < sourceIndices.length; corner += 1) {
      const sourceVertex = sourceIndices[corner]!;
      const posedVertex = posedIndices[corner]!;
      assert.equal(sourceUvs[sourceVertex * 2], posedUvs[posedVertex * 2], `${material} corner ${corner} U changed`);
      assert.equal(sourceUvs[sourceVertex * 2 + 1], posedUvs[posedVertex * 2 + 1], `${material} corner ${corner} V changed`);
    }
    for (let triangle = 0; triangle < sourceIndices.length; triangle += 3) {
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const before = Math.hypot(...[0, 1, 2].map((axis) =>
          sourcePositions[sourceIndices[triangle + a]! * 3 + axis]! - sourcePositions[sourceIndices[triangle + b]! * 3 + axis]!));
        const after = Math.hypot(...[0, 1, 2].map((axis) =>
          posedPositions[posedIndices[triangle + a]! * 3 + axis]! - posedPositions[posedIndices[triangle + b]! * 3 + axis]!));
        const ratio = after / before;
        minRatio = Math.min(minRatio, ratio);
        maxRatio = Math.max(maxRatio, ratio);
        edgeCount += 1;
      }
    }
  }
  return { minRatio, maxRatio, edgeCount };
}

export async function measureNeutralCpuSkinError(sourceUrl: URL, neutralUrl: URL) {
  (globalThis as typeof globalThis & { self: typeof globalThis }).self = globalThis;
  const load = async (url: URL) => {
    const file = await readFile(url);
    return new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, "");
  };
  const [source, neutral] = await Promise.all([load(sourceUrl), load(neutralUrl)]);
  source.scene.updateMatrixWorld(true);
  neutral.scene.updateMatrixWorld(true);
  const sourceMeshes = new Map<string, THREE.Mesh>();
  const neutralMeshes = new Map<string, THREE.SkinnedMesh>();
  source.scene.traverse((node) => { if (node instanceof THREE.Mesh) sourceMeshes.set((node.material as THREE.Material).name, node); });
  neutral.scene.traverse((node) => { if (node instanceof THREE.SkinnedMesh) neutralMeshes.set((node.material as THREE.Material).name, node); });
  let maxError = 0;
  for (const [material, approved] of sourceMeshes) {
    const rigged = neutralMeshes.get(material)!;
    const a = approved.geometry.getAttribute("position");
    const b = rigged.geometry.getAttribute("position");
    for (let vertex = 0; vertex < a.count; vertex += 1) {
      const expected = new THREE.Vector3().fromBufferAttribute(a, vertex).applyMatrix4(approved.matrixWorld);
      const actual = new THREE.Vector3().fromBufferAttribute(b, vertex);
      rigged.applyBoneTransform(vertex, actual).applyMatrix4(rigged.matrixWorld);
      maxError = Math.max(maxError, expected.distanceTo(actual));
    }
  }
  return maxError;
}
