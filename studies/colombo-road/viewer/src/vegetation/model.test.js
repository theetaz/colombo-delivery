import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  dimensions,
  perspectiveFitDistance,
  validateVegetationManifest,
  WIND_PRESETS,
} from "./model.js";
test("manifest contract requires five unique assets with explicit RGB wind channels", () => {
  const asset = (i) => ({
      id: `vegetation.${i}`,
      url: `/${i}.glb`,
      lod1Url: `/${i}-lod1.glb`,
      blendUrl: `/assets/${i}.blend`,
      bounds: { min: [-1, 0, -1], max: [1, i + 1, 1] },
      wind: {
        attribute: "COLOR_0",
        channels: { r: "bend", g: "flutter", b: "phase" },
        rootLocked: true,
      },
    }),
    manifest = { schemaVersion: 1, assets: [0, 1, 2, 3, 4].map(asset) };
  assert.equal(validateVegetationManifest(manifest), true);
  manifest.assets[4].id = manifest.assets[3].id;
  assert.equal(validateVegetationManifest(manifest), false);
});

test("perspective fit keeps collection corners inside normal and narrow viewports", () => {
  const width = 32,
    height = 9,
    fov = (38 * Math.PI) / 180;
  for (const aspect of [16 / 9, 4 / 3, 0.55]) {
    const distance = perspectiveFitDistance(width, height, fov, aspect);
    const verticalLimit = distance * Math.tan(fov / 2);
    const horizontalLimit = verticalLimit * aspect;
    assert.ok(width / 2 < horizontalLimit);
    assert.ok(height / 2 < verticalLimit);
  }
});
test("dimensions and wind presets preserve metre scale and exact calm", () => {
  assert.deepEqual(dimensions({ min: [-2, 0, -3], max: [4, 8, 5] }), [6, 8, 8]);
  assert.equal(WIND_PRESETS.Calm.strength, 0);
  assert.ok(WIND_PRESETS.Strong.strength > WIND_PRESETS.Breeze.strength);
});

test("published vegetation manifest satisfies the runtime contract", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../public/vegetation/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(validateVegetationManifest(manifest), true);
  assert.deepEqual(manifest.assets.map((asset) => asset.id).sort(), [
    "vegetation.coconut-palm-01",
    "vegetation.rain-tree-01",
    "vegetation.round-tree-01",
    "vegetation.short-grass-01",
    "vegetation.tall-grass-01",
  ]);
  for (const asset of manifest.assets) {
    assert.ok(asset.triangleCount > asset.lod1TriangleCount);
    assert.equal(asset.coordinateSystem.glbUp, "Y");
    assert.match(asset.blendUrl, /^\/assets\/vegetation\/.+\.blend$/);
  }
});
