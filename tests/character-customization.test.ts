import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CHARACTER_COLOR_PALETTES,
  CHARACTER_ITEM_LABELS,
  CHARACTER_SLOT_ITEMS,
  DEFAULT_CHARACTER_CATALOG,
  readCatalogAvailability,
} from "../src/customizer/catalog";
import {
  CHARACTER_APPEARANCE_STORAGE_KEY,
  DEFAULT_CHARACTER_APPEARANCE,
  characterAppearancesEqual,
  cloneCharacterAppearance,
  loadCharacterAppearance,
  normalizeHexColor,
  resetCharacterAppearance,
  saveCharacterAppearance,
  validateCharacterAppearance,
} from "../src/customizer/appearance";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

test("starter catalog exposes every required garment and independent optional None choices", () => {
  assert.deepEqual(CHARACTER_SLOT_ITEMS.face, ["classic", "soft", "angular"]);
  assert.deepEqual(CHARACTER_SLOT_ITEMS.hair, ["wavy", "crop", "quiff"]);
  assert.deepEqual(CHARACTER_SLOT_ITEMS.top, ["crewtee", "polo", "buttonshirt"]);
  assert.deepEqual(CHARACTER_SLOT_ITEMS.bottom, ["shorts", "trousers"]);
  assert.deepEqual(CHARACTER_SLOT_ITEMS.shoes, ["canvas", "runner", "hightop"]);
  assert.deepEqual(CHARACTER_SLOT_ITEMS.sunglasses, ["none", "round", "squareframe"]);
  assert.deepEqual(CHARACTER_SLOT_ITEMS.necklace, ["none", "chain"]);
  assert.deepEqual(CHARACTER_SLOT_ITEMS.watch, ["none", "sport"]);
  for (const palette of Object.values(CHARACTER_COLOR_PALETTES)) {
    assert.ok(palette.length >= 3);
    assert.ok(palette.every(({ color }) => /^#[0-9A-F]{6}$/.test(color)));
  }
});

test("published customization manifest matches the typed starter catalog", () => {
  const manifest = JSON.parse(readFileSync("public/models/teen_courier_customization.manifest.json", "utf8"));
  assert.deepEqual(readCatalogAvailability(manifest), DEFAULT_CHARACTER_CATALOG);
  for (const [slot, definition] of Object.entries(manifest.customization.slots)) {
    for (const item of (definition as { items: { id: string; label: string }[] }).items) {
      assert.equal(item.label, (CHARACTER_ITEM_LABELS as Record<string, Record<string, string>>)[slot]![item.id]);
    }
  }
});

test("customization GLB contains rendered catalog items and its embedded tint contract", () => {
  const bytes = readFileSync("public/models/teen_courier_customization.glb");
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as {
    nodes: { name?: string; mesh?: number; children?: number[]; extras?: { customization?: unknown } }[];
    meshes: { primitives: { indices?: number; attributes: { POSITION?: number } }[] }[];
    accessors: { count: number }[];
    textures?: { source?: number }[];
    images?: unknown[];
  };
  const descendantTriangles = (rootIndex: number): number => {
    let triangles = 0;
    const visit = (index: number) => {
      const node = gltf.nodes[index]!;
      if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh]!.primitives) {
        const accessorIndex = primitive.indices ?? primitive.attributes.POSITION;
        if (accessorIndex !== undefined) triangles += gltf.accessors[accessorIndex]!.count / 3;
      }
      node.children?.forEach(visit);
    };
    visit(rootIndex);
    return triangles;
  };
  for (const [slot, items] of Object.entries(DEFAULT_CHARACTER_CATALOG)) for (const id of items) {
    if (id === "none") continue;
    const index = gltf.nodes.findIndex(({ name }) => name === `Item_${slot}_${id}`);
    assert.notEqual(index, -1, `missing Item_${slot}_${id}`);
    assert.ok(descendantTriangles(index) > 0, `Item_${slot}_${id} must render triangles`);
  }
  const root = gltf.nodes.find(({ name }) => name === "TeenCourierCustomization");
  const tint = root?.extras?.customization as { maskTextureIndex?: number; channels?: unknown } | undefined;
  assert.ok(Number.isInteger(tint?.maskTextureIndex), "root needs an embedded tint-mask contract");
  const texture = gltf.textures?.[tint!.maskTextureIndex!];
  assert.ok(texture && Number.isInteger(texture.source) && gltf.images?.[texture.source!] !== undefined, "tint mask must resolve to an embedded image");
  assert.deepEqual(tint?.channels, { skin: "r", shirt: "g", shoes: "b" });

  const manifest = JSON.parse(readFileSync("public/models/teen_courier_customization.manifest.json", "utf8"));
  assert.deepEqual(manifest.customization.colorRegions, ["skin", "hair", "top", "bottom", "shoes"]);
  for (const definition of Object.values(manifest.customization.slots) as { items: { thumbnail?: string }[] }[]) {
    for (const { thumbnail } of definition.items) if (thumbnail) assert.ok(existsSync(`public/models/${thumbnail}`), `missing thumbnail ${thumbnail}`);
  }
});

test("trouser shell is continuous and its detached tailoring details stay associated and recolorable", () => {
  const bytes = readFileSync("public/models/teen_courier_customization.glb");
  const jsonLength = bytes.readUInt32LE(12);
  const binHeader = 20 + jsonLength;
  const bin = bytes.subarray(binHeader + 8, binHeader + 8 + bytes.readUInt32LE(binHeader));
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as {
    nodes: { name?: string; mesh?: number; children?: number[]; translation?: [number, number, number]; rotation?: number[]; scale?: number[]; matrix?: number[]; extras?: { garment?: string; garmentRole?: string } }[];
    meshes: { primitives: { indices?: number; material?: number; attributes: { POSITION?: number } }[] }[];
    materials: { name?: string }[];
    accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }[];
    bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  };
  const itemIndex = gltf.nodes.findIndex(({ name }) => name === "Item_bottom_trousers");
  assert.notEqual(itemIndex, -1, "trouser item root is required");
  const item = gltf.nodes[itemIndex]!;
  const shell = item.children?.map((index) => gltf.nodes[index]!).find(({ name }) => name === "Bottom_trousers");
  assert.notEqual(shell?.mesh, undefined, "trousers need a named primary garment shell");
  const details = item.children?.map((index) => gltf.nodes[index]!).filter(({ name }) => name !== "Bottom_trousers") ?? [];
  assert.ok(details.length > 0, "trousers need authored tailoring details");
  for (const detail of details) {
    assert.deepEqual(detail.extras, { garment: "trousers", garmentRole: "detail" }, `${detail.name} must declare its trouser-detail role`);
    assert.notEqual(detail.mesh, undefined, `${detail.name} must render geometry`);
    const materialNames = gltf.meshes[detail.mesh!]!.primitives.map(({ material }) => gltf.materials[material!]!.name);
    assert.deepEqual([...new Set(materialNames)], ["Custom_Bottom"], `${detail.name} must follow bottom recoloring`);
  }
  const meshIndices = [shell!.mesh!];
  assert.equal(shell!.rotation, undefined, "primary trouser shell must not export a local rotation");
  assert.equal(shell!.scale, undefined, "primary trouser shell must not export a local scale");
  assert.equal(shell!.matrix, undefined, "primary trouser shell must use a directly inspectable translation transform");
  const shellTranslation = shell!.translation ?? [0, 0, 0];

  let garmentMinY = Infinity;
  let garmentMaxY = -Infinity;
  const edges = new Map<string, { count: number; vertices: [string, string] }>();
  const positions = new Map<string, [number, number, number]>();
  const neighbors = new Map<string, Set<string>>();
  for (const meshIndex of meshIndices) for (const primitive of gltf.meshes[meshIndex]!.primitives) {
    assert.notEqual(primitive.indices, undefined, "trouser surface must use indexed triangles");
    const positionAccessor = gltf.accessors[primitive.attributes.POSITION!]!;
    const indexAccessor = gltf.accessors[primitive.indices!]!;
    garmentMinY = Math.min(garmentMinY, (positionAccessor.min?.[1] ?? Infinity) + shellTranslation[1]);
    garmentMaxY = Math.max(garmentMaxY, (positionAccessor.max?.[1] ?? -Infinity) + shellTranslation[1]);
    const positionView = gltf.bufferViews[positionAccessor.bufferView]!;
    const positionOffset = (positionView.byteOffset ?? 0) + (positionAccessor.byteOffset ?? 0);
    const positionStride = positionView.byteStride ?? 12;
    const indexView = gltf.bufferViews[indexAccessor.bufferView]!;
    const indexOffset = (indexView.byteOffset ?? 0) + (indexAccessor.byteOffset ?? 0);
    const indexSize = indexAccessor.componentType === 5125 ? 4 : 2;
    const readIndex = (offset: number) => indexSize === 4 ? bin.readUInt32LE(offset) : bin.readUInt16LE(offset);
    const vertexKey = (vertex: number): string => {
      const point = [0, 1, 2].map((axis) => bin.readFloatLE(positionOffset + vertex * positionStride + axis * 4) + shellTranslation[axis]!) as [number, number, number];
      const key = point.map((value) => Math.round(value * 100_000)).join(":");
      positions.set(key, point);
      return key;
    };
    for (let offset = 0; offset < indexAccessor.count; offset += 3) {
      const triangle = [0, 1, 2].map((corner) => vertexKey(readIndex(indexOffset + (offset + corner) * indexSize)));
      for (const [first, second] of [[triangle[0]!, triangle[1]!], [triangle[1]!, triangle[2]!], [triangle[2]!, triangle[0]!]] as const) {
        const vertices: [string, string] = first < second ? [first, second] : [second, first];
        const key = `${vertices[0]}|${vertices[1]}`;
        const edge = edges.get(key) ?? { count: 0, vertices };
        edge.count += 1; edges.set(key, edge);
        const firstNeighbors = neighbors.get(first) ?? new Set<string>(); firstNeighbors.add(second); neighbors.set(first, firstNeighbors);
        const secondNeighbors = neighbors.get(second) ?? new Set<string>(); secondNeighbors.add(first); neighbors.set(second, secondNeighbors);
      }
    }
  }
  let middleBoundaryVertices = 0;
  for (const edge of edges.values()) if (edge.count === 1) for (const vertex of edge.vertices) {
    const y = positions.get(vertex)![1];
    if (y > 0.24 && y < 0.72) middleBoundaryVertices += 1;
  }
  const unseen = new Set(neighbors.keys());
  let components = 0;
  while (unseen.size) {
    components += 1;
    const pending = [unseen.values().next().value!];
    while (pending.length) {
      const vertex = pending.pop()!;
      if (!unseen.delete(vertex)) continue;
      for (const neighbor of neighbors.get(vertex) ?? []) if (unseen.has(neighbor)) pending.push(neighbor);
    }
  }
  assert.ok(garmentMinY < 0.18, "trousers must reach the ankle area");
  assert.ok(garmentMaxY > 0.76, "trousers must reach the waist area");
  assert.ok([...edges.values()].every(({ count }) => count <= 2), "trouser shell must not contain non-manifold edges");
  assert.equal(components, 1, "trousers must be one geometrically connected garment");
  assert.equal(middleBoundaryVertices, 0, "trousers must not open into tube lips or slits through thighs and knees");
});

test("source skin below the shorts follows the shorts slot without inheriting bottom tint", () => {
  const bytes = readFileSync("public/models/teen_courier_customization.glb");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as {
    nodes: { name?: string; mesh?: number; children?: number[]; extras?: { preserveSourceTint?: boolean } }[];
    meshes: { primitives: { material?: number; attributes: { POSITION?: number } }[] }[];
    materials: { name?: string }[];
    accessors: { min?: number[]; max?: number[] }[];
  };
  const shorts = gltf.nodes.find(({ name }) => name === "Item_bottom_shorts");
  const trousers = gltf.nodes.find(({ name }) => name === "Item_bottom_trousers");
  const bodyBase = gltf.nodes.find(({ name }) => name === "Body_Base");
  const shortsGarmentIndex = gltf.nodes.findIndex(({ name }) => name === "Bottom_shorts");
  const lowerIndex = gltf.nodes.findIndex(({ name }) => name === "Body_Lower_Shorts");
  assert.notEqual(shortsGarmentIndex, -1, "shorts need their authored garment mesh");
  assert.ok(shorts?.children?.includes(shortsGarmentIndex), "authored shorts must remain in the shorts item");
  const shortsGarment = gltf.nodes[shortsGarmentIndex]!;
  assert.notEqual(shortsGarment.mesh, undefined);
  const shortsMaterialNames = gltf.meshes[shortsGarment.mesh!]!.primitives.map(({ material }) => gltf.materials[material!]!.name);
  assert.deepEqual([...new Set(shortsMaterialNames)], ["Teen_Shorts"]);
  assert.notEqual(lowerIndex, -1, "shorts need their original lower-body skin occluder");
  assert.ok(shorts?.children?.includes(lowerIndex), "lower-body skin must hide with the shorts item");
  assert.ok(!trousers?.children?.includes(lowerIndex), "lower-body skin must stay hidden with trousers");
  const lower = gltf.nodes[lowerIndex]!;
  assert.equal(lower.extras?.preserveSourceTint, true, "source skin must opt out of whole-bottom tint");
  assert.notEqual(lower.mesh, undefined);
  const materialNames = gltf.meshes[lower.mesh!]!.primitives.map(({ material }) => gltf.materials[material!]!.name);
  assert.deepEqual([...new Set(materialNames)], ["Teen_Skin", "Teen_Shoes"], "shorts-only lower body must retain its original ankle filler without inheriting bottom tint");
  assert.notEqual(bodyBase?.mesh, undefined);
  const bodyBaseMaterialNames = gltf.meshes[bodyBase!.mesh!]!.primitives.map(({ material }) => gltf.materials[material!]!.name);
  assert.ok(!bodyBaseMaterialNames.includes("Teen_Shoes"), "always-visible body must exclude the shorts-only ankle filler");
  const upperY = Math.max(...gltf.meshes[lower.mesh!]!.primitives.map(({ attributes }) => gltf.accessors[attributes.POSITION!]!.max?.[1] ?? Infinity));
  assert.ok(upperY < 0.7, "shorts-only skin partition must stay below the arms and torso");
});

test("manifest availability accepts known complete slots and rejects incompatible equipment", () => {
  const slots = Object.fromEntries(Object.entries(DEFAULT_CHARACTER_CATALOG).map(([slot, items]) => [slot, {
    default: items[0],
    items: items.map((id) => ({ id, label: id })),
  }]));
  const manifest = {
    customization: {
      previewReady: true,
      rigReady: false,
      gameReady: false,
      slots,
      colorRegions: ["skin", "hair", "top", "bottom", "shoes"],
    },
  };
  assert.deepEqual(readCatalogAvailability(manifest), DEFAULT_CHARACTER_CATALOG);
  assert.equal(readCatalogAvailability({ customization: { previewReady: true, slots: { ...slots, top: { default: "hoodie", items: [{ id: "hoodie", label: "Hoodie" }] } } } }), null);
  assert.equal(readCatalogAvailability({ customization: { previewReady: true, slots: { ...slots, necklace: { default: "chain", items: [{ id: "chain", label: "Chain" }] } } } }), null);
  assert.equal(readCatalogAvailability({ customization: { previewReady: true, slots: { ...slots, hair: { default: "wavy", items: [{ id: "crop", label: "Crop" }] } } } }), null);
  assert.equal(readCatalogAvailability({ customization: { previewReady: true, slots: { face: slots.face } } }), null);
  assert.equal(readCatalogAvailability({ customization: { previewReady: false, slots } }), null);
});

test("appearance validation normalizes colors and rejects unknown IDs, versions, and malformed colors", () => {
  const selected = {
    ...DEFAULT_CHARACTER_APPEARANCE,
    face: "angular" as const,
    hair: "quiff" as const,
    top: "polo" as const,
    bottom: "trousers" as const,
    shoes: "runner" as const,
    sunglasses: "round" as const,
    necklace: "chain" as const,
    watch: "sport" as const,
    colors: { skin: "#aabbcc", hair: "#010203", top: "#abcdef", bottom: "#123456", shoes: "#fedcba" },
  };
  const validated = validateCharacterAppearance(selected);
  assert.deepEqual(validated?.colors, { skin: "#AABBCC", hair: "#010203", top: "#ABCDEF", bottom: "#123456", shoes: "#FEDCBA" });
  assert.equal(validateCharacterAppearance({ ...selected, version: 2 }), null);
  assert.equal(validateCharacterAppearance({ ...selected, top: "logo-tee" }), null);
  assert.equal(validateCharacterAppearance({ ...selected, colors: { ...selected.colors, shoes: "white" } }), null);
  assert.equal(normalizeHexColor("#012abc"), "#012ABC");
  assert.equal(normalizeHexColor("#fff"), null);
});

test("saved looks round-trip, reset cleanly, and fail safely when storage is malformed or unavailable", () => {
  const storage = memoryStorage();
  const selected = cloneCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE);
  selected.hair = "crop";
  selected.sunglasses = "squareframe";
  selected.colors.top = "#A94F3D";
  assert.equal(saveCharacterAppearance(selected, storage), true);
  assert.deepEqual(loadCharacterAppearance(storage), selected);
  assert.equal(characterAppearancesEqual(loadCharacterAppearance(storage), selected), true);
  assert.equal(resetCharacterAppearance(storage), true);
  assert.deepEqual(loadCharacterAppearance(storage), DEFAULT_CHARACTER_APPEARANCE);

  storage.values.set(CHARACTER_APPEARANCE_STORAGE_KEY, "{broken");
  assert.deepEqual(loadCharacterAppearance(storage), DEFAULT_CHARACTER_APPEARANCE);
  assert.deepEqual(loadCharacterAppearance({ getItem: () => { throw new Error("blocked"); } }), DEFAULT_CHARACTER_APPEARANCE);
  assert.equal(saveCharacterAppearance(selected, { setItem: () => { throw new Error("full"); } }), false);
  assert.equal(resetCharacterAppearance({ removeItem: () => { throw new Error("blocked"); } }), false);
  assert.equal(saveCharacterAppearance(selected, null), false);
  assert.deepEqual(loadCharacterAppearance(null), DEFAULT_CHARACTER_APPEARANCE);
});

test("a look becomes invalid when its selected item is absent and fallback stays within manifest availability", () => {
  const limited = { ...DEFAULT_CHARACTER_CATALOG, hair: ["crop"] as const };
  const selected = { ...DEFAULT_CHARACTER_APPEARANCE, hair: "quiff" as const };
  assert.equal(validateCharacterAppearance(selected, limited), null);
  assert.deepEqual(loadCharacterAppearance({ getItem: () => JSON.stringify(selected) }, limited), { ...DEFAULT_CHARACTER_APPEARANCE, hair: "crop" });
});

test("appearance equality compares canonical fields rather than property insertion order", () => {
  const reordered = {
    colors: { shoes: "#E2E0D8", bottom: "#414147", top: "#267789", hair: "#241B19", skin: "#A86D52" },
    watch: "none" as const,
    necklace: "none" as const,
    sunglasses: "none" as const,
    shoes: "canvas" as const,
    bottom: "shorts" as const,
    top: "crewtee" as const,
    hair: "wavy" as const,
    face: "classic" as const,
    version: 1 as const,
  };
  assert.equal(characterAppearancesEqual(DEFAULT_CHARACTER_APPEARANCE, reordered), true);
});
