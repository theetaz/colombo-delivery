import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addresses, buildingPlacements, treePlacements, understoryPlacements } from "./layout.js";
import { distanceForLod, validateEnvironmentManifest, validateLayout, validateSpatialLayout } from "./model.js";
import { surfaceHeight } from "./runtime.js";

test("assembled street keeps bounded, unique placements and linked addresses", () => {
  assert.equal(buildingPlacements.length, 12);
  assert.ok(treePlacements.length >= 12 && treePlacements.length <= 16);
  assert.equal(understoryPlacements.length, 24);
  assert.equal(addresses.length, 4);
  assert.deepEqual(validateLayout(), []);
});

test("LOD choice responds to camera distance", () => {
  const placement = { position: [0, 0, 0] };
  assert.equal(distanceForLod({ x: 5, z: 5 }, placement), 0);
  assert.equal(distanceForLod({ x: 80, z: 0 }, placement), 1);
});

test("walking follows pavement height while bicycle wheels stay on the road", () => {
  assert.equal(surfaceHeight(5.5, false), .16);
  assert.equal(surfaceHeight(2, false), .055);
  assert.equal(surfaceHeight(5.5, true), .055);
});

test("published environment manifest contains every required family", async () => {
  const path = new URL("../../public/environment/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(path, "utf8"));
  const vegetation = JSON.parse(await readFile(new URL("../../public/vegetation/manifest.json", import.meta.url), "utf8"));
  assert.equal(validateEnvironmentManifest(manifest), true);
  assert.deepEqual(validateSpatialLayout(manifest, vegetation), []);
});
