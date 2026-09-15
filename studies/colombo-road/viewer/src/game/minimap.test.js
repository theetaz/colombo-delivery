import test from "node:test";
import assert from "node:assert/strict";
import { mapPoint, minimapEntities } from "./minimap.js";

test("north-up minimap maps street bounds and clamps off-map points", () => {
  assert.deepEqual(mapPoint([-95, 0, -25]), { left: 0, top: 0 });
  assert.deepEqual(mapPoint([95, 0, 25]), { left: 100, top: 100 });
  assert.deepEqual(mapPoint([200, 0, 80]), { left: 100, top: 100 });
});

test("minimap emits only positioned player, bicycle, traffic and target", () => {
  const entities = minimapEntities({ movement: { mode: "foot", player: { x: 0, z: 0 }, bike: { x: -1, z: 0 } }, target: { approach: [10, 0, 3] }, traffic: [{ x: 20, z: 2, direction: 1 }, null] });
  assert.deepEqual(entities.map((item) => item.kind), ["player", "bike", "target", "traffic"]);
  assert.equal(entities.at(-1).yaw, -Math.PI / 2);
});

test("rider marker follows the bicycle after mounting and lane direction becomes heading", () => {
  const entities = minimapEntities({ movement: { mode: "ride", player: { x: -80, z: -6 }, bike: { x: 25, z: -2, yaw: -Math.PI / 2 } }, traffic: [{ x: 3, z: 2, direction: -1 }] });
  assert.deepEqual(entities[0].point, mapPoint({ x: 25, z: -2 }));
  assert.equal(entities.at(-1).yaw, Math.PI / 2);
});
