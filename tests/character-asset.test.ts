import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("clean teen courier GLB preserves its static review contract and PBR regions", async () => {
  const bytes = await readFile(new URL("../public/models/teen_courier.glb", import.meta.url));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as GlbDocument;
  const root = gltf.nodes.find((node) => node.name === "TeenCourier");
  assert.ok(root, "TeenCourier root is required");
  assert.deepEqual(root.translation ?? [0, 0, 0], [0, 0, 0]);
  assert.deepEqual(root.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1]);
  assert.deepEqual(root.scale ?? [1, 1, 1], [1, 1, 1]);
  assert.deepEqual(root.extras?.customization, {
    ready: true, maskTextureIndex: 15, texCoord: 0,
    channels: { skin: "r", shirt: "g", shoes: "b" },
    mode: "masked_hsv_hue_saturation", preserveValue: true, default: "authored",
  });
  assert.equal(gltf.skins?.length ?? 0, 0, "review asset remains explicitly unrigged");
  assert.equal(gltf.animations?.length ?? 0, 0, "review asset must not claim animation clips");
  const expectedMaterials = ["Teen_Skin", "Teen_Hair", "Teen_Shirt", "Teen_Shorts", "Teen_Shoes"];
  assert.deepEqual(gltf.materials.map(({ name }) => name).sort(), expectedMaterials.sort());
  assert.equal(gltf.meshes.length, 1);
  assert.equal(gltf.meshes[0]!.primitives.length, expectedMaterials.length);
  for (const primitive of gltf.meshes[0]!.primitives) {
    assert.notEqual(primitive.attributes.POSITION, undefined);
    assert.notEqual(primitive.attributes.NORMAL, undefined);
    assert.notEqual(primitive.attributes.TEXCOORD_0, undefined);
    assert.notEqual(primitive.material, undefined);
    const material = gltf.materials[primitive.material!];
    assert.notEqual(material?.pbrMetallicRoughness?.baseColorTexture, undefined, `${material?.name} needs base detail`);
    assert.notEqual(material?.normalTexture, undefined, `${material?.name} needs a normal map`);
    assert.notEqual(material?.pbrMetallicRoughness?.metallicRoughnessTexture, undefined, `${material?.name} needs an ORM map`);
  }
  const positionAccessors = gltf.meshes[0]!.primitives.map((primitive) => gltf.accessors[primitive.attributes.POSITION]!);
  const min = positionAccessors.reduce((value, accessor) => Math.min(value, accessor.min?.[1] ?? Infinity), Infinity);
  const max = positionAccessors.reduce((value, accessor) => Math.max(value, accessor.max?.[1] ?? -Infinity), -Infinity);
  assert.ok(min >= -1e-4, "asset is grounded at Y=0");
  assert.ok(Math.abs(max - 1.62) < 0.03, "asset is approximately 1.62m tall");
  assert.ok((gltf.images?.length ?? 0) >= 3, "embedded surface map families are required");
  assert.ok((gltf.textures?.length ?? 0) > 15, "customization mask texture index must resolve");
});

interface GlbDocument {
  nodes: Array<{ name?: string; translation?: number[]; rotation?: number[]; scale?: number[]; extras?: { customization?: unknown } }>;
  skins?: unknown[];
  animations?: unknown[];
  images?: unknown[];
  textures?: unknown[];
  meshes: Array<{ primitives: Array<{ material?: number; attributes: Record<string, number> }> }>;
  materials: Array<{
    name?: string;
    normalTexture?: unknown;
    pbrMetallicRoughness?: { baseColorTexture?: unknown; metallicRoughnessTexture?: unknown };
  }>;
  accessors: Array<{ min?: number[]; max?: number[] }>;
}
