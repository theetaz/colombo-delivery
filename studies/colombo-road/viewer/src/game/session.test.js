import test from "node:test";
import assert from "node:assert/strict";
import { commandSession, createProgress, createSession, loadProgress, restoreSession, saveProgress, serializeSession, sessionView, stepSession } from "./session.js";
import { addresses } from "../environment/layout.js";

const command = (session, type) => commandSession(session, { type, playerId: session.playerId });
const moveOnFootTo = (session, addressId) => {
  const address = addresses.find((item) => item.id === addressId);
  session.movement.mode = "foot";
  Object.assign(session.movement.player, { x: address.approach[0], z: address.approach[2] });
};
const memoryStorage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
const angleError = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const tick = (session, input = {}) => stepSession(session, input, 1 / 60);

function walkTo(session, target, limitSeconds = 45) {
  for (let frame = 0; frame < limitSeconds * 60; frame++) {
    const actor = session.movement.player, dx = target.x - actor.x, dz = target.z - actor.z;
    if (Math.hypot(dx, dz) < .45 && Math.abs(session.movement.walkSpeed) < .1) return frame / 60;
    const desired = Math.atan2(-dx, -dz), error = angleError(actor.yaw, desired);
    tick(session, { turn: clamp(error * 2.5, -1, 1), forward: Math.abs(error) < .5 && Math.hypot(dx, dz) > .25 ? 1 : 0 });
  }
  throw new Error(`walk controller timed out at ${session.movement.player.x.toFixed(1)},${session.movement.player.z.toFixed(1)} traffic ${session.traffic.items.map((item) => `${item.x.toFixed(1)},${item.z},${item.speed.toFixed(1)}`).join(";")}`);
}

function waitForMode(session, mode, limitSeconds = 12) {
  for (let frame = 0; frame < limitSeconds * 60; frame++) { if (session.movement.mode === mode) return frame / 60; tick(session); }
  throw new Error(`movement never reached ${mode} from ${session.movement.mode}`);
}

function rideToX(session, targetX, limitSeconds = 45) {
  const initialDesired = targetX >= session.movement.bike.x ? -Math.PI / 2 : Math.PI / 2;
  let turnaround = Math.abs(angleError(session.movement.bike.yaw, initialDesired)) > 2.5 ? (session.movement.bike.z < 0 ? -1 : 1) : 0;
  let reverseTurn = false;
  for (let frame = 0; frame < limitSeconds * 60; frame++) {
    const bike = session.movement.bike, dx = targetX - bike.x, distance = Math.abs(dx), desired = Math.atan2(-dx, bike.z);
    const error = angleError(bike.yaw, desired);
    if (distance < 1.1 && Math.abs(session.movement.speed) < .2) return frame / 60;
    const stoppingDistance = session.movement.speed * session.movement.speed / 5.5 + .65;
    if (turnaround && session.movement.blocked) reverseTurn = true;
    if (turnaround && Math.abs(error) < .25) { turnaround = 0; reverseTurn = false; }
    const turn = turnaround ? (reverseTurn ? -turnaround : turnaround) : clamp(error * 2.2, -1, 1);
    const forward = turnaround ? (reverseTurn ? -1 : session.movement.speed > .8 ? -1 : session.movement.brakeHeld ? 0 : 1) : distance <= stoppingDistance ? -1 : 1;
    tick(session, { turn, forward });
  }
  throw new Error(`ride controller timed out target ${targetX} at ${session.movement.bike.x.toFixed(1)},${session.movement.bike.z.toFixed(1)} yaw ${session.movement.bike.yaw.toFixed(1)} speed ${session.movement.speed.toFixed(1)} blocked ${session.movement.blocked} traffic ${session.traffic.items.map((item) => `${item.x.toFixed(1)},${item.z},${item.speed.toFixed(1)}`).join(";")}`);
}

function reachAddress(session, addressId) {
  const address = addresses.find((item) => item.id === addressId);
  const bike = session.movement.bike;
  if (Math.abs(address.approach[0] - bike.x) > 4) {
    if (session.movement.mode === "foot") {
      const mount = { x: bike.x - .6 * Math.cos(bike.yaw) + .2 * Math.sin(bike.yaw), z: bike.z + .6 * Math.sin(bike.yaw) + .2 * Math.cos(bike.yaw) };
      if ((session.movement.player.z - bike.z) * (mount.z - bike.z) < 0) {
        walkTo(session, { x: bike.x + 2.2, z: session.movement.player.z });
        walkTo(session, { x: bike.x + 2.2, z: mount.z });
      }
      walkTo(session, mount);
      assert.equal(command(session, "MOUNT_ACTION").accepted, true);
      waitForMode(session, "ride");
    }
    rideToX(session, address.approach[0]);
    for (let frame = 0; frame < 10 * 60; frame++) { if (command(session, "MOUNT_ACTION").accepted) break; tick(session); if (frame === 599) throw new Error("could not dismount"); }
    waitForMode(session, "foot");
  }
  if (session.movement.mode === "foot" && session.movement.player.z * address.approach[2] < 0 && Math.abs(session.movement.bike.x - address.approach[0]) < 2) {
    const bypassX = address.approach[0] + 3;
    walkTo(session, { x: bypassX, z: session.movement.player.z });
    walkTo(session, { x: bypassX, z: address.approach[2] });
  }
  walkTo(session, { x: address.approach[0], z: address.approach[2] });
}

test("a complete three-job shift pays each reward once and reaches results", () => {
  const session = createSession({ playerId: "p1", seed: 7 });
  assert.equal(command(session, "START_SHIFT").accepted, true);
  for (const job of session.jobs) {
    assert.equal(session.phase, "offer");
    assert.equal(command(session, "ACCEPT_JOB").accepted, true);
    moveOnFootTo(session, job.pickupId);
    assert.equal(command(session, "PACKAGE_ACTION").event, "package-collected");
    moveOnFootTo(session, job.dropoffId);
    assert.equal(command(session, "PACKAGE_ACTION").event, "package-delivered");
    assert.equal(command(session, "PACKAGE_ACTION").accepted, false);
    assert.equal(command(session, "NEXT_JOB").accepted, true);
  }
  assert.equal(session.phase, "results");
  assert.equal(session.shiftEarnings, session.jobs.reduce((sum, job) => sum + job.reward, 0));
  assert.equal(new Set(session.completedJobIds).size, 3);
});

test("all jobs are physically reachable through real movement, traffic, mounting and both curbs", () => {
  const session = createSession({ playerId: "physical-route", seed: 7, trafficCount: 2 });
  const timings = [];
  command(session, "START_SHIFT");
  for (const job of session.jobs) {
    command(session, "ACCEPT_JOB");
    reachAddress(session, job.pickupId); assert.equal(command(session, "PACKAGE_ACTION").accepted, true, JSON.stringify(sessionView(session)));
    reachAddress(session, job.dropoffId); timings.push({ job: job.id, elapsed: job.deadlineSeconds - session.deadlineRemaining }); assert.equal(command(session, "PACKAGE_ACTION").accepted, true, JSON.stringify(sessionView(session)));
    assert.ok(session.phase === "job_complete" && session.deadlineRemaining === null);
    command(session, "NEXT_JOB");
  }
  assert.equal(session.phase, "results"); assert.equal(session.completedJobIds.length, 3);
  assert.ok(session.movement.walkDistance > 10);
  assert.ok(timings.every(({ job, elapsed }) => session.jobs.find((item) => item.id === job).deadlineSeconds - elapsed > 15), JSON.stringify(timings));
});

test("commands reject the wrong player, wrong phase, bike pickup and wrong curb", () => {
  const session = createSession({ playerId: "owner" });
  assert.equal(commandSession(session, { type: "START_SHIFT", playerId: "other" }).reason, "wrong-player");
  assert.equal(command(session, "PACKAGE_ACTION").reason, "wrong-phase");
  command(session, "START_SHIFT"); command(session, "ACCEPT_JOB");
  moveOnFootTo(session, session.jobs[0].dropoffId);
  assert.equal(command(session, "PACKAGE_ACTION").reason, "invalid-interaction");
  moveOnFootTo(session, session.jobs[0].pickupId); session.movement.mode = "ride";
  assert.equal(command(session, "PACKAGE_ACTION").reason, "invalid-interaction");
});

test("pause, reload and recovery preserve authority and restart parcels safely", () => {
  const session = createSession({ playerId: "p2", seed: 22 });
  command(session, "START_SHIFT"); command(session, "ACCEPT_JOB");
  moveOnFootTo(session, session.jobs[0].pickupId); command(session, "PACKAGE_ACTION");
  command(session, "TOGGLE_PAUSE");
  const before = sessionView(session);
  stepSession(session, { forward: 1 }, 2);
  assert.deepEqual(sessionView(session), before);
  const restored = restoreSession(serializeSession(session), { playerId: "p2" });
  assert.equal(restored.paused, true); assert.equal(restored.packageHeld, true);
  command(restored, "TOGGLE_PAUSE"); command(restored, "RECOVER");
  assert.equal(restored.phase, "pickup"); assert.equal(restored.packageHeld, false); assert.equal(restored.movement.bike.x, -86.8);
  assert.throws(() => restoreSession(serializeSession(session), { playerId: "intruder" }));
  assert.equal("context" in sessionView(restored).movement, false);
});

test("deadline fails, freezes the parcel and retry restores the full clock", () => {
  const session = createSession({ playerId: "timer", jobs: [{ id: "quick", pickupId: addresses[0].id, dropoffId: addresses[2].id, reward: 1, deadlineSeconds: .1 }] });
  command(session, "START_SHIFT"); command(session, "ACCEPT_JOB");
  stepSession(session, {}, .2);
  assert.equal(session.phase, "job_failed"); assert.equal(session.deadlineRemaining, 0);
  assert.equal(command(session, "RETRY_JOB").accepted, true); assert.equal(session.deadlineRemaining, .1);
});

test("fixed step is deterministic across frame partitions and ignores invalid dt", () => {
  const a = createSession({ playerId: "a", seed: 41, sessionId: "same" });
  const b = createSession({ playerId: "a", seed: 41, sessionId: "same" });
  command(a, "START_SHIFT"); command(a, "ACCEPT_JOB"); command(b, "START_SHIFT"); command(b, "ACCEPT_JOB");
  for (let index = 0; index < 120; index++) stepSession(a, { forward: 1 }, 1 / 120);
  for (let index = 0; index < 30; index++) stepSession(b, { forward: 1 }, 1 / 30);
  assert.deepEqual(sessionView(a), sessionView(b));
  const before = sessionView(a);
  for (const dt of [NaN, Infinity, 0, -1]) stepSession(a, { forward: 1 }, dt);
  assert.deepEqual(sessionView(a), before);
});

test("versioned progress isolates players and prevents reward replay after reload", () => {
  const storage = memoryStorage();
  const session = createSession({ playerId: "alice", jobs: [{ id: "paid", pickupId: addresses[0].id, dropoffId: addresses[2].id, reward: 75, deadlineSeconds: 30 }] });
  command(session, "START_SHIFT"); command(session, "ACCEPT_JOB"); moveOnFootTo(session, addresses[0].id); command(session, "PACKAGE_ACTION"); moveOnFootTo(session, addresses[2].id); command(session, "PACKAGE_ACTION");
  const alice = createProgress("alice");
  assert.equal(saveProgress(storage, alice, session), true); assert.equal(alice.wallet, 75);
  assert.equal(saveProgress(storage, alice, session), true); assert.equal(alice.wallet, 75);
  assert.equal(loadProgress(storage, "alice").wallet, 75);
  assert.equal(loadProgress(storage, "bob").wallet, 0);
  assert.equal(saveProgress(storage, createProgress("bob"), session), false);
  assert.ok(loadProgress(storage, "alice").savedSession.includes('"playerId":"alice"'));
});

test("restore rejects malformed phases and forged reward ledgers", () => {
  const session = createSession({ playerId: "validator" });
  const badPhase = JSON.parse(serializeSession(session)); badPhase.phase = "admin";
  assert.throws(() => restoreSession(badPhase));
  const forged = JSON.parse(serializeSession(session)); forged.shiftEarnings = 999;
  assert.throws(() => restoreSession(forged));
  const overlap = JSON.parse(serializeSession(session)); Object.assign(overlap.traffic.items[0], { x: overlap.movement.bike.x, z: overlap.movement.bike.z });
  assert.throws(() => restoreSession(overlap));
  const badYaw = JSON.parse(serializeSession(session)); badYaw.movement.player.yaw = null;
  assert.throws(() => restoreSession(badYaw));
  const badTraffic = JSON.parse(serializeSession(session)); badTraffic.traffic.items[0].assetId = "missing-prefab";
  assert.throws(() => restoreSession(badTraffic));
});

test("approach snapshots use and validate the transitioning courier position", () => {
  const session = createSession({ playerId: "approach-save" });
  command(session, "START_SHIFT"); command(session, "ACCEPT_JOB");
  session.movement.mode = "approach";
  session.movement.transition = { from: { ...session.movement.player }, target: { x: -86, z: -1.8 }, duration: 1 };
  const pickup = addresses.find((address) => address.id === session.jobs[0].pickupId);
  const view = sessionView(session);
  assert.equal(view.targetDistance, Math.hypot(session.movement.player.x - pickup.approach[0], session.movement.player.z - pickup.approach[2]));
  assert.doesNotThrow(() => restoreSession(serializeSession(session)));
  const malformed = JSON.parse(serializeSession(session)); malformed.movement.transition.duration = 0;
  assert.throws(() => restoreSession(malformed));
});

test("returning to menu creates a clean repeat shift with a new payable receipt", () => {
  const storage = memoryStorage();
  const jobs = [{ id: "repeat", pickupId: addresses[0].id, dropoffId: addresses[2].id, reward: 50, deadlineSeconds: 30 }];
  const session = createSession({ playerId: "repeat-player", sessionId: "shift-one", jobs });
  const progress = createProgress(session.playerId);
  const finish = () => { command(session, "START_SHIFT"); command(session, "ACCEPT_JOB"); moveOnFootTo(session, jobs[0].pickupId); command(session, "PACKAGE_ACTION"); moveOnFootTo(session, jobs[0].dropoffId); command(session, "PACKAGE_ACTION"); command(session, "NEXT_JOB"); };
  finish(); assert.equal(saveProgress(storage, progress, session), true); assert.equal(progress.wallet, 50);
  const oldSessionId = session.sessionId;
  assert.equal(command(session, "RETURN_TO_MENU").accepted, true);
  assert.notEqual(session.sessionId, oldSessionId); assert.equal(session.jobIndex, 0); assert.equal(session.shiftEarnings, 0);
  finish(); assert.equal(saveProgress(storage, progress, session), true); assert.equal(progress.wallet, 100);
  assert.equal(new Set(progress.paidReceiptIds).size, 2);
});

test("paused recovery and menu exit remain available while other commands stay blocked", () => {
  const session = createSession({ playerId: "paused-actions" });
  command(session, "START_SHIFT"); command(session, "ACCEPT_JOB"); command(session, "TOGGLE_PAUSE");
  assert.equal(command(session, "PACKAGE_ACTION").reason, "paused");
  assert.equal(command(session, "RECOVER").accepted, true); assert.equal(session.paused, true); assert.equal(session.phase, "pickup");
  assert.equal(command(session, "RETURN_TO_MENU").accepted, true); assert.equal(session.phase, "menu"); assert.equal(session.paused, false);
});

test("nonactive phases freeze player input and package actions require a full stop", () => {
  const session = createSession({ playerId: "freeze" });
  command(session, "START_SHIFT");
  const before = structuredClone(sessionView(session).movement);
  stepSession(session, { forward: 1, turn: 1 }, 1);
  assert.deepEqual(sessionView(session).movement, before);
  command(session, "ACCEPT_JOB"); moveOnFootTo(session, session.jobs[0].pickupId); session.movement.walkSpeed = .5;
  assert.equal(sessionView(session).canPackageAction, false); assert.equal(command(session, "PACKAGE_ACTION").reason, "invalid-interaction");
  session.movement.walkSpeed = 0; command(session, "TOGGLE_PAUSE"); assert.equal(sessionView(session).canPackageAction, false);
});

test("storage failures and corrupt resumable sessions fail closed", () => {
  const progress = createProgress("storage-player");
  assert.equal(saveProgress({ setItem() { throw new Error("quota"); } }, progress), false);
  const storage = memoryStorage();
  storage.setItem(`colombo-delivery:progress:v2:storage-player`, JSON.stringify({ ...progress, savedSession: "bad-json" }));
  assert.equal(loadProgress(storage, "storage-player").savedSession, null);
});
