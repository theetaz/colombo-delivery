import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  applyCourierAppearance,
  cloneCharacterMaterials,
  COURIER_APPEARANCE_STORAGE_KEY,
  DEFAULT_COURIER_APPEARANCE,
  loadCourierAppearance,
  saveCourierAppearance,
  validateCourierAppearance,
} from "../src/scene/bicycle-appearance";

test("appearance records round-trip and reject unknown versions and options", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
  const appearance = { ...DEFAULT_COURIER_APPEARANCE, face: "angular" as const, skin: "deep" as const, bag: "teal" as const };
  assert.equal(saveCourierAppearance(appearance, storage), true);
  assert.deepEqual(loadCourierAppearance(storage), appearance);
  values.set(COURIER_APPEARANCE_STORAGE_KEY, JSON.stringify({ ...appearance, ignoredPayload: "discard me" }));
  assert.deepEqual(loadCourierAppearance(storage), appearance);
  assert.equal("ignoredPayload" in loadCourierAppearance(storage), false);
  assert.equal(saveCourierAppearance({ ...appearance, ignoredPayload: "discard me" } as typeof appearance, storage), true);
  assert.equal("ignoredPayload" in JSON.parse(values.get(COURIER_APPEARANCE_STORAGE_KEY)!), false);
  values.set(COURIER_APPEARANCE_STORAGE_KEY, JSON.stringify({ ...appearance, version: 2 }));
  assert.deepEqual(loadCourierAppearance(storage), DEFAULT_COURIER_APPEARANCE);
  assert.equal(validateCourierAppearance({ ...appearance, outfit: "neon" }), null);
  assert.deepEqual(loadCourierAppearance({ getItem: () => { throw new Error("blocked"); } }), DEFAULT_COURIER_APPEARANCE);
  assert.equal(saveCourierAppearance(appearance, { setItem: () => { throw new Error("full"); } }), false);
  assert.deepEqual(loadCourierAppearance(null), DEFAULT_COURIER_APPEARANCE);
  assert.equal(saveCourierAppearance(appearance, null), false);
});

test("each courier gets isolated recolorable materials while retaining authored texture maps", () => {
  const texture = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture });
  source.name = "Rider_Skin";
  const makeCourier = () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), source));
    for (const name of ["Face_Profile_Classic", "Face_Profile_Soft", "Face_Profile_Angular"]) {
      root.add(Object.assign(new THREE.Group(), { name }));
    }
    return root;
  };
  const first = makeCourier();
  const second = makeCourier();
  const firstMaterials = cloneCharacterMaterials(first);
  const secondMaterials = cloneCharacterMaterials(second);
  applyCourierAppearance(first, firstMaterials, { ...DEFAULT_COURIER_APPEARANCE, skin: "deep", face: "angular" });
  applyCourierAppearance(second, secondMaterials, { ...DEFAULT_COURIER_APPEARANCE, skin: "golden" });
  const firstSkin = firstMaterials.get("Rider_Skin")![0] as THREE.MeshStandardMaterial;
  const secondSkin = secondMaterials.get("Rider_Skin")![0] as THREE.MeshStandardMaterial;
  assert.notEqual(firstSkin, secondSkin);
  assert.notEqual(firstSkin, source);
  assert.notEqual(firstSkin.color.getHex(), secondSkin.color.getHex());
  assert.equal(firstSkin.map, texture);
  assert.equal(secondSkin.map, texture);
  assert.equal(source.color.getHex(), 0xffffff);
  assert.equal(first.getObjectByName("Face_Profile_Classic")!.visible, false);
  assert.equal(first.getObjectByName("Face_Profile_Angular")!.visible, true);
});
