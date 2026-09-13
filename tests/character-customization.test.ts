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
