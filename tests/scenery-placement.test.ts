import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRoadSlice } from "../src/world/road-slice";
import { createSceneryPlacements, DRESSED_END_METRES, DRESSED_START_METRES } from "../src/world/scenery-placement";
import type { GeoJsonFeatureCollection } from "../src/world/types";

test("dresses a dense 250 metre slice with reusable scenery rooted off mapped roads", async () => {
  const raw = await readFile(new URL("../data/derived/road_network.geojson", import.meta.url), "utf8");
  const slice = buildRoadSlice(JSON.parse(raw) as GeoJsonFeatureCollection);
  const placements = createSceneryPlacements(slice);
  const buildings = placements.filter(({ asset }) => asset.startsWith("Shop_") || asset === "BoundaryWall_Gate");

  assert.equal(DRESSED_END_METRES - DRESSED_START_METRES, 250);
  assert.ok(placements.length >= 45, `expected at least 45 cleared placements, received ${placements.length}`);
  assert.ok(buildings.length >= 18, `expected at least 18 cleared facade pieces, received ${buildings.length}`);
  assert.ok(placements.every(({ metresAlongRoad }) => metresAlongRoad >= DRESSED_START_METRES && metresAlongRoad <= DRESSED_END_METRES));
  assert.ok(placements.every(({ asset }) => asset !== "LotusTower"), "the mapped landmark is not roadside dressing");
});
