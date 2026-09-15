import test from "node:test";
import assert from "node:assert/strict";
import { createTraffic, stepTraffic, trafficClearAt, trafficView } from "./traffic.js";

test("seeded traffic has two bounded lanes and approved vehicle assets", () => {
  const one = createTraffic({ seed: 91, count: 4 });
  const two = createTraffic({ seed: 91, count: 4 });
  assert.deepEqual(trafficView(one), trafficView(two));
  assert.equal(one.items.length, 4);
  assert.deepEqual(new Set(one.items.map((item) => item.z)), new Set([-2, 2]));
  assert.ok(one.items.every((item) => item.x >= -92 && item.x <= 92));
  assert.ok(one.items.every((item) => ["traffic-compact-car", "traffic-delivery-van", "traffic-scooter-rider"].includes(item.assetId)));
});

test("traffic maintains a safe following gap without overlap", () => {
  const state = createTraffic({ seed: 2, count: 2 });
  state.items = [
    { ...state.items[0], id: "rear", lane: "east", z: -2, direction: 1, x: 0, length: 4, speed: 6, cruiseSpeed: 6 },
    { ...state.items[0], id: "front", lane: "east", z: -2, direction: 1, x: 7, length: 4, speed: 0, cruiseSpeed: 0 },
  ];
  for (let index = 0; index < 600; index++) stepTraffic(state, 1 / 60);
  const gap = state.items[1].x - state.items[0].x;
  assert.ok(gap >= 6.39);
  assert.equal(trafficClearAt(state, { x: state.items[0].x, z: -2 }, .5), false);
});

test("traffic brakes and yields before the player", () => {
  const state = createTraffic({ seed: 3, count: 2 });
  state.items = [{ ...state.items[0], lane: "east", z: -2, direction: 1, x: 0, length: 4, speed: 6, cruiseSpeed: 6 }];
  const movement = { mode: "ride", bike: { x: 8, z: -2 }, player: { x: 8, z: -2 } };
  for (let index = 0; index < 240; index++) stepTraffic(state, 1 / 60, { movement });
  assert.ok(state.items[0].x <= 4);
  assert.equal(state.items[0].speed, 0);
});

test("traffic also yields to the parked bicycle while the courier is on foot", () => {
  const state = createTraffic({ seed: 8, count: 2 });
  state.items = [{ ...state.items[0], lane: "east", z: -2, direction: 1, x: 0, length: 4, speed: 6, cruiseSpeed: 6 }];
  const movement = { mode: "foot", bike: { x: 8, z: -2 }, player: { x: 30, z: -5.5 } };
  for (let index = 0; index < 240; index++) stepTraffic(state, 1 / 60, { movement });
  assert.ok(state.items[0].x <= 4); assert.equal(state.items[0].speed, 0);
});

test("riding ignores the stale foot position and exact overlap stops movement", () => {
  const state = createTraffic({ seed: 12, count: 2 });
  state.items = [{ ...state.items[0], lane: "east", z: -2, direction: 1, x: 0, length: 4, speed: 4, cruiseSpeed: 4 }];
  stepTraffic(state, 1 / 60, { movement: { mode: "ride", bike: { x: 40, z: -2 }, player: { x: 2, z: -2 } } });
  assert.ok(state.items[0].speed > 0); assert.ok(state.items[0].x > 0);
  Object.assign(state.items[0], { x: 0, speed: 4 });
  stepTraffic(state, 1 / 60, { movement: { mode: "ride", bike: { x: 0, z: -2 }, player: { x: 20, z: -2 } } });
  assert.equal(state.items[0].x, 0); assert.ok(state.items[0].speed < 4);
});

test("pause and invalid deltas freeze traffic", () => {
  const state = createTraffic({ seed: 4, count: 3 });
  const before = structuredClone(state);
  for (const dt of [NaN, Infinity, 0, -1]) stepTraffic(state, dt);
  stepTraffic(state, 1, { paused: true });
  assert.deepEqual(state, before);
});
