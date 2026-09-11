import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ASSUMED_LANE_WIDTH_METRES,
  DEFAULT_ROAD_ORIGIN,
  buildRoadSlice,
  inverseProject,
  projectLonLat,
  resolveRoadWidth,
  resolveVerticalPlacement,
  type GeoJsonFeature,
  type GeoJsonFeatureCollection,
  type LonLat,
} from "../src/world/road-slice";

function sourceWith(...features: GeoJsonFeature[]): GeoJsonFeatureCollection {
  return { type: "FeatureCollection", features };
}

function localRoad(
  id: string,
  localPoints: ReadonlyArray<readonly [x: number, z: number]>,
  tags: Record<string, string> = { highway: "residential" },
): GeoJsonFeature {
  const coordinates: LonLat[] = localPoints.map(([x, z]) => {
    const point = inverseProject(x, z);
    return [point.lon, point.lat];
  });
  return {
    type: "Feature",
    id,
    properties: { osm_id: Number(id.replace(/\D/g, "")) || null, highway: tags.highway, tags },
    geometry: { type: "LineString", coordinates },
  };
}

test("spherical AEQD uses x east, z south and round-trips WGS84", () => {
  assert.deepEqual(projectLonLat(DEFAULT_ROAD_ORIGIN.lon, DEFAULT_ROAD_ORIGIN.lat), {
    x: 0,
    z: 0,
  });

  const east = inverseProject(100, 0);
  const south = inverseProject(0, 100);
  assert.ok(east.lon > DEFAULT_ROAD_ORIGIN.lon);
  assert.ok(south.lat < DEFAULT_ROAD_ORIGIN.lat);
  assert.ok(Math.abs(projectLonLat(east.lon, east.lat).x - 100) < 1e-6);
  assert.ok(Math.abs(projectLonLat(south.lon, south.lat).z - 100) < 1e-6);

  const sample = { lon: 79.85423816576274, lat: 6.93107342426929 };
  const local = projectLonLat(sample.lon, sample.lat);
  const roundTrip = inverseProject(local.x, local.z);
  assert.ok(Math.abs(roundTrip.lon - sample.lon) < 1e-10);
  assert.ok(Math.abs(roundTrip.lat - sample.lat) < 1e-10);
});

test("clips crossing segments and splits a way that exits and re-enters", () => {
  const slice = buildRoadSlice(
    sourceWith(
      localRoad("way/1", [
        [-20, 0],
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 0],
      ]),
    ),
    { halfExtentMetres: 10 },
  );

  assert.equal(slice.summary.intersectingSourceWayCount, 1);
  assert.equal(slice.roads.length, 2);
  assert.deepEqual(
    slice.roads.map((road) => road.id),
    ["way/1#1", "way/1#2"],
  );
  const endpoints = slice.roads.flatMap((road) => [road.points[0], road.points.at(-1)]);
  for (const point of endpoints) {
    assert.ok(point);
    assert.ok(Math.abs(point.x) <= 10 + 1e-7);
    assert.ok(Math.abs(point.z) <= 10 + 1e-7);
  }
  assert.ok(Math.abs(slice.roads[0].points[0].x + 10) < 1e-7);
  assert.ok(Math.abs(slice.roads[0].points.at(-1)!.x - 10) < 1e-7);
});

test("preserves source identity, raw tags, WGS coordinates, and representative coordinates", () => {
  const source = localRoad(
    "way/42",
    [
      [-15, 0],
      [0, 5],
      [15, 0],
    ],
    { highway: "secondary", name: "Test Road", lanes: "2", surface: "asphalt" },
  );
  const slice = buildRoadSlice(sourceWith(source), { halfExtentMetres: 10 });
  const road = slice.roads[0];
  assert.equal(road.sourceFeatureId, "way/42");
  assert.equal(road.osmId, 42);
  assert.equal(road.name, "Test Road");
  assert.equal(road.highway, "secondary");
  assert.equal(road.tags.surface, "asphalt");
  assert.deepEqual(road.sourceCoordinates, source.geometry?.type === "LineString" ? source.geometry.coordinates : []);
  const representativeWgs = inverseProject(road.representative.x, road.representative.z);
  assert.ok(Math.abs(representativeWgs.lon - road.representative.lon) < 1e-10);
  assert.ok(Math.abs(representativeWgs.lat - road.representative.lat) < 1e-10);
});

test("resolves strict width evidence, lane assumptions, and class fallbacks", () => {
  assert.deepEqual(resolveRoadWidth("secondary", { width: "10 m" }), {
    metres: 10,
    source: "width",
    rationale: "Strict numeric OSM width converted to metres; accepted range is 0.8–40 m.",
    rawWidth: "10 m",
  });
  assert.equal(resolveRoadWidth("residential", { width: "20 ft" }).metres, 6.096);
  assert.equal(resolveRoadWidth("residential", { width: "12' 6\"" }).metres, 3.81);

  const laneWidth = resolveRoadWidth("secondary", { width: "6;8", lanes: "2" });
  assert.equal(laneWidth.source, "lanes");
  assert.equal(laneWidth.metres, 2 * ASSUMED_LANE_WIDTH_METRES);
  assert.equal(laneWidth.rawWidth, "6;8");
  assert.match(laneWidth.rationale, /not a surveyed width/);

  const rejectedLanes = resolveRoadWidth("secondary", { lanes: "2;1" });
  assert.equal(rejectedLanes.source, "class-fallback");
  assert.equal(rejectedLanes.rawLanes, "2;1");
  assert.equal(resolveRoadWidth("footway", { lanes: "2" }).source, "class-fallback");
  assert.equal(resolveRoadWidth("steps", {}).metres, 1.8);
});

test("keeps layer-separated structures explicit without modelling ramps", () => {
  assert.deepEqual(resolveVerticalPlacement({ bridge: "yes", layer: "1" }), {
    layer: 1,
    elevationMetres: 5,
    bridge: true,
    tunnel: false,
    rationale: "Mapped OSM layer 1 displayed at 5 m per layer.",
  });
  const assumedBridge = resolveVerticalPlacement({ bridge: "yes" });
  assert.equal(assumedBridge.elevationMetres, 5);
  assert.match(assumedBridge.rationale, /ramps are not modelled/);
  assert.equal(resolveVerticalPlacement({ tunnel: "yes" }).elevationMetres, -5);
});

test("ribbon bends have bounded joins, non-degenerate upward triangles, and bounded vertices", () => {
  const slice = buildRoadSlice(
    sourceWith(
      localRoad(
        "way/9",
        [
          [-20, 0],
          [0, 0],
          [0.1, 0.01],
          [0, 20],
        ],
        { highway: "residential", width: "8" },
      ),
    ),
    { halfExtentMetres: 10 },
  );
  const road = slice.roads[0];
  assert.ok(road.mesh.indices.length > 0);
  for (let offset = 0; offset < road.mesh.vertices.length; offset += 3) {
    assert.ok(Number.isFinite(road.mesh.vertices[offset]));
    assert.ok(Number.isFinite(road.mesh.vertices[offset + 1]));
    assert.ok(Number.isFinite(road.mesh.vertices[offset + 2]));
    assert.ok(Math.abs(road.mesh.vertices[offset]) <= 10 + 1e-8);
    assert.ok(Math.abs(road.mesh.vertices[offset + 2]) <= 10 + 1e-8);
  }
  for (let offset = 0; offset < road.mesh.indices.length; offset += 3) {
    const [a, b, c] = road.mesh.indices.slice(offset, offset + 3).map((index) => index * 3);
    const abX = road.mesh.vertices[b] - road.mesh.vertices[a];
    const abZ = road.mesh.vertices[b + 2] - road.mesh.vertices[a + 2];
    const acX = road.mesh.vertices[c] - road.mesh.vertices[a];
    const acZ = road.mesh.vertices[c + 2] - road.mesh.vertices[a + 2];
    const normalY = abZ * acX - abX * acZ;
    assert.ok(normalY > 1e-8);
  }
  for (let pointIndex = 1; pointIndex < road.points.length - 1; pointIndex += 1) {
    const vertexOffset = pointIndex * 6;
    const leftDistance = Math.hypot(
      road.mesh.vertices[vertexOffset] - road.points[pointIndex].x,
      road.mesh.vertices[vertexOffset + 2] - road.points[pointIndex].z,
    );
    assert.ok(leftDistance <= (road.width.metres / 2) * 2.5 + 1e-7);
  }
});

test("rejects lifecycle roads and invalid geometry without joining across bad coordinates", () => {
  const invalid = localRoad("way/2", [[-5, 0], [5, 0]]);
  if (invalid.geometry?.type === "LineString") invalid.geometry.coordinates.splice(1, 0, [Number.NaN, 0]);
  const slice = buildRoadSlice(
    sourceWith(
      localRoad("way/1", [[-5, 0], [5, 0]], { highway: "construction", construction: "primary" }),
      invalid,
      { type: "Feature", id: "point/3", properties: {}, geometry: null },
    ),
    { halfExtentMetres: 10 },
  );
  assert.equal(slice.roads.length, 0);
  assert.equal(slice.summary.excludedLifecycleWayCount, 1);
  assert.equal(slice.summary.excludedInvalidGeometryCount, 1);
  assert.equal(slice.summary.excludedNonRoadFeatureCount, 1);
  assert.equal(slice.summary.eligibleSourceWayCount, 0);
});

test("the saved snapshot builds the reviewed 900 m square without network access", async () => {
  const raw = await readFile(new URL("../data/derived/road_network.geojson", import.meta.url), "utf8");
  const source = JSON.parse(raw) as GeoJsonFeatureCollection;
  const slice = buildRoadSlice(source);

  assert.equal(slice.summary.sourceProjectionValidated, true);
  assert.equal(
    slice.summary.sourceSnapshotSha256,
    "35ae3d3b68c95215ad1caf928ee8f9278a6b564ac4e8d7a1c539c681256f5a96",
  );
  assert.deepEqual(slice.bounds, { minX: -450, maxX: 450, minZ: -450, maxZ: 450 });
  assert.equal(slice.summary.intersectingSourceWayCount, 109);
  assert.equal(slice.summary.roadCount, 110);
  assert.deepEqual(slice.summary.widthSourceCounts, { width: 1, lanes: 11, "class-fallback": 97 });
  assert.ok(Math.abs(slice.summary.clippedCentrelineLengthMetres - 11_740.633019171974) < 0.02);
  assert.ok(slice.roads.every((road) => road.highway !== "construction" && road.highway !== "proposed"));
  assert.ok(slice.roads.every((road) => road.points.length >= 2));
});

test("rejects source projection metadata drift", () => {
  const source = sourceWith(localRoad("way/1", [[-5, 0], [5, 0]]));
  source.metadata = {
    projection: {
      origin_wgs84: [DEFAULT_ROAD_ORIGIN.lon + 0.001, DEFAULT_ROAD_ORIGIN.lat],
      earth_radius_m: 6_371_008.8,
    },
  };
  assert.throws(() => buildRoadSlice(source), /does not match the fixed runtime projection/);
});
