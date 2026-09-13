import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DELIVERY_STORAGE_KEY,
  DeliveryController,
  createPracticeJobs,
  loadDeliveryProgress,
  type DeliveryStorage,
} from "../src/game/delivery";
import { buildRoadSlice } from "../src/world/road-slice";
import type { GeoJsonFeatureCollection } from "../src/world/types";

const bicycleAt = (x: number, z: number, speed = 0, heading = 0) => ({ x, z, speed, heading });

async function jobs() {
  const raw = await readFile(new URL("../data/derived/road_network.geojson", import.meta.url), "utf8");
  return createPracticeJobs(buildRoadSlice(JSON.parse(raw) as GeoJsonFeatureCollection));
}

test("builds three deterministic source-road practice jobs with a short first leg", async () => {
  const routes = await jobs();
  assert.equal(routes.length, 3);
  assert.ok(routes.every((route) => route.pickup.sourceFeatureId === "way/13884292"));
  assert.ok(routes.every((route) => route.dropoff.sourceFeatureId === "way/13884292"));
  assert.ok(Math.hypot(routes[0]!.dropoff.x - routes[0]!.pickup.x, routes[0]!.dropoff.z - routes[0]!.pickup.z) >= 65);
  assert.ok(Math.hypot(routes[0]!.dropoff.x - routes[0]!.pickup.x, routes[0]!.dropoff.z - routes[0]!.pickup.z) <= 75);
  assert.deepEqual(createPracticeJobs(buildRoadSlice(JSON.parse(await readFile(new URL("../data/derived/road_network.geojson", import.meta.url), "utf8")) as GeoJsonFeatureCollection)), routes);
});

test("requires accepting and an explicit stopped action inside each radius, then awards once", async () => {
  const routes = await jobs();
  const writes: string[] = [];
  const storage: DeliveryStorage = { getItem: () => null, setItem: (_key, value) => writes.push(value) };
  const delivery = new DeliveryController(routes, storage);
  const job = delivery.getCurrentJob();

  assert.equal(delivery.attemptStopAction(bicycleAt(job.pickup.x, job.pickup.z)).event, "unavailable");
  assert.equal(delivery.accept().event, "accepted");
  assert.equal(delivery.attemptStopAction(bicycleAt(job.pickup.x, job.pickup.z, 1)).event, "moving");
  assert.equal(delivery.attemptStopAction(bicycleAt(job.pickup.x + 8, job.pickup.z)).event, "too-far");
  assert.equal(delivery.attemptStopAction(bicycleAt(job.pickup.x, job.pickup.z)).event, "picked-up");
  assert.equal(delivery.attemptStopAction(bicycleAt(job.dropoff.x, job.dropoff.z)).event, "delivered");
  assert.deepEqual(delivery.getState(), {
    phase: "completed", jobIndex: 0, secondsRemaining: job.timeLimitSeconds,
    earningsLkr: job.rewardLkr, completedJobs: 1,
  });
  assert.equal(delivery.attemptStopAction(bicycleAt(job.dropoff.x, job.dropoff.z)).changed, false);
  assert.equal(writes.length, 1);
});

test("times out, pauses on zero delta, retries, and cancels an active job on reset", async () => {
  const delivery = new DeliveryController(await jobs());
  delivery.accept();
  const initial = delivery.getState().secondsRemaining;
  assert.equal(delivery.step(0), false);
  assert.equal(delivery.getState().secondsRemaining, initial);
  assert.equal(delivery.step(0.2), false);
  assert.ok(Math.abs(delivery.getState().secondsRemaining - (initial - 0.2)) < 1e-9);
  assert.equal(delivery.step(initial), true);
  assert.equal(delivery.getState().phase, "failed");
  assert.equal(delivery.retry().event, "retried");
  assert.equal(delivery.getState().secondsRemaining, initial);
  assert.equal(delivery.cancel().event, "cancelled");
  assert.equal(delivery.getState().phase, "available");
});

test("validates persisted progress and survives corrupt, blocked, and full storage", async () => {
  const good: DeliveryStorage = {
    getItem: () => JSON.stringify({ version: 1, earningsLkr: 840, completedJobs: 3 }),
    setItem: () => undefined,
  };
  assert.deepEqual(loadDeliveryProgress(good), { earningsLkr: 840, completedJobs: 3 });
  for (const raw of ["{", "null", JSON.stringify({ version: 1, earningsLkr: -1, completedJobs: 2 }), JSON.stringify({ version: 2, earningsLkr: 1, completedJobs: 1 })]) {
    assert.deepEqual(loadDeliveryProgress({ getItem: () => raw, setItem: () => undefined }), { earningsLkr: 0, completedJobs: 0 });
  }
  assert.deepEqual(loadDeliveryProgress({ getItem: () => { throw new Error("blocked"); }, setItem: () => undefined }), { earningsLkr: 0, completedJobs: 0 });

  const routes = await jobs();
  const full: DeliveryStorage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  const delivery = new DeliveryController(routes, full);
  delivery.accept();
  delivery.attemptStopAction(bicycleAt(routes[0]!.pickup.x, routes[0]!.pickup.z));
  assert.doesNotThrow(() => delivery.attemptStopAction(bicycleAt(routes[0]!.dropoff.x, routes[0]!.dropoff.z)));
  assert.equal(delivery.getState().earningsLkr, routes[0]!.rewardLkr);
  assert.equal(DELIVERY_STORAGE_KEY, "colombo-delivery.practice-progress.v1");

  const saturated = new DeliveryController(routes, {
    getItem: () => JSON.stringify({ version: 1, earningsLkr: Number.MAX_SAFE_INTEGER, completedJobs: Number.MAX_SAFE_INTEGER }),
    setItem: () => undefined,
  });
  saturated.accept();
  const saturatedJob = saturated.getCurrentJob();
  saturated.attemptStopAction(bicycleAt(saturatedJob.pickup.x, saturatedJob.pickup.z));
  saturated.attemptStopAction(bicycleAt(saturatedJob.dropoff.x, saturatedJob.dropoff.z));
  assert.equal(saturated.getState().earningsLkr, Number.MAX_SAFE_INTEGER);
  assert.equal(saturated.getState().completedJobs, Number.MAX_SAFE_INTEGER);
});
