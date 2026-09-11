import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BICYCLE_RADIUS_METRES,
  BICYCLE_TUNING,
  createBicycleController,
  type BicycleSpawn,
} from "../src/game/bicycle";
import { buildRoadSlice, inverseProject, projectLonLat } from "../src/world/road-slice";
import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  LonLat,
  RoadSlice,
} from "../src/world/types";

function localRoad(
  id: string,
  points: ReadonlyArray<readonly [x: number, z: number]>,
  tags: Record<string, string> = { highway: "residential", width: "8" },
): GeoJsonFeature {
  const coordinates: LonLat[] = points.map(([x, z]) => {
    const point = inverseProject(x, z);
    return [point.lon, point.lat];
  });
  return {
    type: "Feature",
    id,
    properties: { highway: tags.highway, tags },
    geometry: { type: "LineString", coordinates },
  };
}

function sliceWith(
  features: GeoJsonFeature[] = [localRoad("way/1", [[0, 90], [0, -90]])],
  halfExtentMetres = 100,
): RoadSlice {
  return buildRoadSlice({ type: "FeatureCollection", features }, { halfExtentMetres });
}

function spawnAt(x = 0, z = 0, heading = 0): BicycleSpawn {
  return {
    x,
    y: 0,
    z,
    heading,
    longitude: 0,
    latitude: 0,
    roadId: "test-road",
    sourceFeatureId: "test-road",
  };
}

function run(controller: ReturnType<typeof createBicycleController>, seconds: number, input = {}): void {
  const frames = Math.round(seconds * 60);
  for (let frame = 0; frame < frames; frame += 1) controller.step(1 / 60, input);
}

test("pedalling accelerates, coasting sheds speed, braking stops, and grass caps speed", () => {
  const slice = sliceWith();
  const road = createBicycleController(slice, { spawn: spawnAt(), obstacles: [] });
  run(road, 3, { pedal: true });
  const pedalledSpeed = road.getState().speed;
  assert.ok(pedalledSpeed > 5 && pedalledSpeed <= BICYCLE_TUNING.maximumRoadSpeed);

  run(road, 1.5);
  const coastedSpeed = road.getState().speed;
  assert.ok(coastedSpeed > 0 && coastedSpeed < pedalledSpeed);

  run(road, 1, { brake: true });
  assert.equal(road.getState().speed, 0);

  const grass = createBicycleController(slice, { spawn: spawnAt(20, 0), obstacles: [] });
  assert.equal(grass.getState().surface, "grass");
  run(grass, 8, { pedal: true });
  assert.ok(grass.getState().speed <= BICYCLE_TUNING.maximumGrassSpeed);
  assert.ok(grass.getState().speed > 0);

  const crossing = createBicycleController(slice, {
    spawn: spawnAt(0, 0, Math.PI / 2),
    obstacles: [],
    tuning: {
      fixedStepSeconds: 0.25,
      maximumFrameDeltaSeconds: 0.25,
      maximumRoadSpeed: 100,
      pedalAcceleration: 100,
    },
  });
  crossing.step(0.25, { pedal: true });
  assert.equal(crossing.getState().surface, "grass");
  assert.equal(crossing.getState().speed, BICYCLE_TUNING.maximumGrassSpeed);
});

test("right input turns positive toward +X, left turns negative, and stationary steering does not spin", () => {
  const controller = createBicycleController(sliceWith(), { spawn: spawnAt(), obstacles: [] });
  run(controller, 1, { right: true });
  assert.equal(controller.getState().heading, 0);
  assert.equal(controller.getState().x, 0);
  assert.ok(controller.getState().steering > 0);

  controller.reset();
  run(controller, 1, { pedal: true });
  run(controller, 1, { pedal: true, right: true });
  assert.ok(controller.getState().heading > 0);
  assert.ok(controller.getState().x > 0);

  controller.reset();
  run(controller, 1, { pedal: true });
  run(controller, 1, { pedal: true, left: true });
  assert.ok(controller.getState().heading < 0);
  assert.ok(controller.getState().x < 0);
});

test("fixed simulation substeps produce equivalent results across render frame rates", () => {
  const at60 = createBicycleController(sliceWith(), { spawn: spawnAt(), obstacles: [] });
  const at144 = createBicycleController(sliceWith(), { spawn: spawnAt(), obstacles: [] });
  for (let frame = 0; frame < 300; frame += 1) at60.step(1 / 60, { pedal: true, right: true });
  for (let frame = 0; frame < 720; frame += 1) at144.step(1 / 144, { pedal: true, right: true });
  const slow = at60.getState();
  const fast = at144.getState();
  assert.ok(Math.abs(slow.x - fast.x) < 1e-9);
  assert.ok(Math.abs(slow.z - fast.z) < 1e-9);
  assert.ok(Math.abs(slow.heading - fast.heading) < 1e-9);
  assert.ok(Math.abs(slow.speed - fast.speed) < 1e-9);
  assert.ok(Math.abs(slow.distanceTravelled - fast.distanceTravelled) < 1e-9);
});

test("world boundary and swept-circle obstacle collisions stop travel and count feedback", () => {
  const compactSlice = sliceWith([localRoad("way/1", [[-20, 0], [20, 0]])], 10);
  const boundary = createBicycleController(compactSlice, {
    spawn: spawnAt(0, 0, Math.PI / 2),
    obstacles: [],
  });
  run(boundary, 6, { pedal: true });
  const boundaryState = boundary.getState();
  assert.ok(boundaryState.x <= compactSlice.bounds.maxX - BICYCLE_RADIUS_METRES + 1e-9);
  assert.equal(boundaryState.speed, 0);
  assert.ok(boundaryState.boundaryCollisions >= 1);
  assert.equal(boundaryState.lastCollision, "boundary");

  const obstacle = createBicycleController(compactSlice, {
    spawn: spawnAt(0, 0, Math.PI / 2),
    obstacles: [{ id: "test", x: 3, y: 0, z: 0, radius: 0.55, label: "Test bollard" }],
    tuning: {
      fixedStepSeconds: 0.25,
      maximumFrameDeltaSeconds: 0.25,
      maximumRoadSpeed: 100,
      pedalAcceleration: 100,
    },
  });
  obstacle.step(0.25, { pedal: true });
  const obstacleState = obstacle.getState();
  assert.ok(obstacleState.x < 3 - BICYCLE_RADIUS_METRES - 0.55);
  assert.ok(obstacleState.x > 1.89);
  assert.equal(obstacleState.speed, 0);
  assert.equal(obstacleState.obstacleCollisions, 1);
  assert.equal(obstacleState.lastObstacleId, "test");

  obstacle.reset();
  assert.deepEqual(obstacle.getState(), {
    ...obstacle.getState(),
    x: 0,
    z: 0,
    speed: 0,
    distanceTravelled: 0,
    boundaryCollisions: 0,
    obstacleCollisions: 0,
    lastCollision: null,
    lastObstacleId: null,
  });
});

test("road membership is the union of actual ground mesh triangles and excludes steps and structures", () => {
  const slice = sliceWith([
    localRoad("way/ground-east-west", [[-20, 0], [20, 0]]),
    localRoad("way/ground-north-south", [[0, -20], [0, 20]]),
    localRoad("way/steps", [[-20, 20], [20, 20]], { highway: "steps", width: "8" }),
    localRoad("way/bridge", [[-20, 35], [20, 35]], {
      highway: "residential",
      width: "8",
      bridge: "yes",
      layer: "1",
    }),
  ], 50);
  const controller = createBicycleController(slice, { spawn: spawnAt(), obstacles: [] });
  assert.equal(controller.classifySurface(0, 0), "road");
  assert.equal(controller.classifySurface(10, 3.9), "road");
  assert.equal(controller.classifySurface(10, 4.1), "grass");
  assert.equal(controller.classifySurface(0, 10), "road");
  assert.equal(controller.classifySurface(10, 20), "grass");
  assert.equal(controller.classifySurface(10, 35), "grass");
  assert.equal(controller.classifySurface(Number.NaN, 0), "grass");
});

test("saved Colombo spawn is on way/13884292, left-offset on road, clear of obstacles, and reset-safe", async () => {
  const raw = await readFile(new URL("../data/derived/road_network.geojson", import.meta.url), "utf8");
  const source = JSON.parse(raw) as GeoJsonFeatureCollection;
  const controller = createBicycleController(buildRoadSlice(source));
  assert.equal(controller.spawn.roadId, "way/13884292");
  assert.equal(controller.spawn.sourceFeatureId, "way/13884292");
  assert.ok(Math.abs(controller.spawn.x - 275.37068363728685) < 1e-8);
  assert.ok(Math.abs(controller.spawn.z + 13.41014759519771) < 1e-8);
  assert.ok(Math.abs(controller.spawn.heading + 1.3479130479067791) < 1e-10);
  const spawnLocal = projectLonLat(controller.spawn.longitude, controller.spawn.latitude);
  assert.ok(Math.abs(spawnLocal.x - controller.spawn.x) < 1e-6);
  assert.ok(Math.abs(spawnLocal.z - controller.spawn.z) < 1e-6);
  assert.equal(controller.classifySurface(controller.spawn.x, controller.spawn.z), "road");
  for (const obstacle of controller.obstacles) {
    assert.equal(controller.classifySurface(obstacle.x, obstacle.z), "grass");
    assert.ok(
      Math.hypot(controller.spawn.x - obstacle.x, controller.spawn.z - obstacle.z) >
      BICYCLE_RADIUS_METRES + obstacle.radius,
    );
  }

  run(controller, 2, { pedal: true, left: true });
  controller.step(5, { pedal: true });
  assert.ok(Math.abs(controller.getState().droppedSeconds - 4.75) < 1e-12);
  controller.step(Number.NaN, { pedal: true });
  controller.step(Number.POSITIVE_INFINITY, { pedal: true });
  controller.step(-1, { pedal: true });
  controller.step(Number.MAX_VALUE, { pedal: true });
  for (const value of Object.values(controller.getState())) {
    if (typeof value === "number") assert.ok(Number.isFinite(value));
  }
  const reset = controller.reset();
  assert.equal(reset.x, controller.spawn.x);
  assert.equal(reset.z, controller.spawn.z);
  assert.equal(reset.heading, controller.spawn.heading);
  assert.equal(reset.speed, 0);
  assert.equal(reset.distanceTravelled, 0);
  assert.equal(reset.droppedSeconds, 0);
  assert.equal(reset.boundaryCollisions, 0);
  assert.equal(reset.obstacleCollisions, 0);
});
