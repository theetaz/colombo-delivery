import assert from "node:assert/strict";
import test from "node:test";

import { createMinimapProjection, minimapMarkersForPhase, projectMinimapPoint } from "../src/ui/PracticeMinimap";
import type { PracticeJob } from "../src/game/delivery";

const bounds = { minX: -450, maxX: 450, minZ: -450, maxZ: 450 };

test("minimap projection keeps the complete road slice bounded and north up", () => {
  const projection = createMinimapProjection(bounds, 216, 176, 10);
  const northWest = projectMinimapPoint({ x: -450, z: -450 }, projection);
  const southEast = projectMinimapPoint({ x: 450, z: 450 }, projection);
  const centre = projectMinimapPoint({ x: 0, z: 0 }, projection);

  assert.deepEqual(northWest, { x: 30, y: 10 });
  assert.deepEqual(southEast, { x: 186, y: 166 });
  assert.deepEqual(centre, { x: 108, y: 88 });
  assert.ok(northWest.y < southEast.y, "negative scene Z (north) should render above positive Z (south)");
});

test("projection remains finite for degenerate bounds and tiny viewports", () => {
  const projection = createMinimapProjection({ minX: 4, maxX: 4, minZ: -2, maxZ: -2 }, 0, 0);
  const point = projectMinimapPoint({ x: 4, z: -2 }, projection);
  assert.ok(Number.isFinite(projection.scale));
  assert.ok(Number.isFinite(point.x));
  assert.ok(Number.isFinite(point.y));
});

const pickup = { id: "p", label: "Pickup", x: 1, z: 2, longitude: 0, latitude: 0, sourceFeatureId: "way/1", metresAlongSource: 1 };
const dropoff = { ...pickup, id: "d", label: "Drop-off", x: 3, z: 4 };
const job: PracticeJob = { id: "j", label: "Job", pickup, dropoff, rewardLkr: 1, timeLimitSeconds: 10 };

test("marker state previews stops, highlights only the current target, and clears terminal phases", () => {
  assert.deepEqual(minimapMarkersForPhase(job, "available"), { pickup, dropoff, active: null });
  assert.equal(minimapMarkersForPhase(job, "pickup").active, "pickup");
  assert.equal(minimapMarkersForPhase(job, "delivery").active, "dropoff");
  assert.deepEqual(minimapMarkersForPhase(job, "failed"), { pickup: null, dropoff: null, active: null });
  assert.deepEqual(minimapMarkersForPhase(job, "completed"), { pickup: null, dropoff: null, active: null });
});
