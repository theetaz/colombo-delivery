import { addresses } from "../environment/layout.js";
import { createStreetMovement, interactStreet, stepStreet, streetClearAt } from "../environment/street-movement.js";
import { movementStatus } from "../cyclist/movement-model.js";
import { createTraffic, stepTraffic, trafficClearAt, trafficView } from "./traffic.js";

export const SESSION_SCHEMA_VERSION = 2;
export const PROGRESS_SCHEMA_VERSION = 2;
export const FIXED_STEP = 1 / 60;
const MAX_FRAME = .25;
const INTERACTION_RADIUS = 1.25;
const DEFAULT_JOBS = [
  { id: "job:market-verandah", pickupId: "address:lake-garden-market", dropoffId: "address:verandah-12", reward: 80, deadlineSeconds: 105 },
  { id: "job:cafe-courtyard", pickupId: "address:corner-cafe", dropoffId: "address:courtyard-8", reward: 110, deadlineSeconds: 90 },
  { id: "job:market-courtyard", pickupId: "address:lake-garden-market", dropoffId: "address:courtyard-8", reward: 130, deadlineSeconds: 140 },
];
const PHASES = new Set(["menu", "offer", "pickup", "delivery", "job_complete", "job_failed", "results"]);
const addressById = new Map(addresses.map((address) => [address.id, address]));

const clone = (value) => JSON.parse(JSON.stringify(value));
const validId = (value) => typeof value === "string" && value.length > 0 && value.length <= 128;
const makeId = (prefix) => `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

function validateJobs(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) throw new TypeError("jobs must be a non-empty array");
  const ids = new Set();
  return jobs.map((job) => {
    if (!validId(job?.id) || ids.has(job.id) || !addressById.has(job.pickupId) || !addressById.has(job.dropoffId) ||
      !Number.isFinite(job.reward) || job.reward < 0 || !Number.isFinite(job.deadlineSeconds) || job.deadlineSeconds <= 0) throw new TypeError("invalid job definition");
    ids.add(job.id);
    return { id: job.id, pickupId: job.pickupId, dropoffId: job.dropoffId, reward: Math.round(job.reward), deadlineSeconds: job.deadlineSeconds };
  });
}

function attachCollision(session) {
  session.movement.context = { clearAt: (point, radius) => streetClearAt(point, radius) && trafficClearAt(session.traffic, point, radius) };
}

function resetMovement(session) {
  session.movement = createStreetMovement();
  attachCollision(session);
}

function currentJob(session) { return session.jobs[session.jobIndex] || null; }

function playerPosition(session) { return session.movement.mode === "foot" || session.movement.mode === "approach" ? session.movement.player : session.movement.bike; }

function atAddress(session, addressId) {
  if (session.paused || session.movement.mode !== "foot" || Math.abs(session.movement.walkSpeed) > .15) return false;
  const address = addressById.get(addressId);
  const point = playerPosition(session);
  return !!address && Math.hypot(point.x - address.approach[0], point.z - address.approach[2]) <= INTERACTION_RADIUS;
}

function beginJob(session) {
  const job = currentJob(session);
  session.phase = "pickup";
  session.packageHeld = false;
  session.deadlineRemaining = job.deadlineSeconds;
  session.message = `Collect from ${addressById.get(job.pickupId).label}.`;
}

function reject(session, reason) { session.lastCommand = { accepted: false, reason }; return session.lastCommand; }
function accept(session, event) { session.lastCommand = { accepted: true, event }; return session.lastCommand; }

function resetShift(session) {
  session.sessionId = makeId("session");
  session.phase = "menu"; session.paused = false; session.elapsed = 0; session.accumulator = 0; session.jobIndex = 0;
  session.deadlineRemaining = null; session.packageHeld = false; session.shiftEarnings = 0; session.completedJobIds = [];
  session.awardedJobIds = []; session.receipts = []; session.failedAttempts = 0; session.message = "Start a delivery shift.";
  session.traffic = createTraffic({ seed: session.traffic.seed, count: session.traffic.items.length });
  resetMovement(session);
}

export function createSession(options = {}) {
  const playerId = options.playerId || makeId("player");
  if (!validId(playerId)) throw new TypeError("invalid playerId");
  const jobs = validateJobs(options.jobs || DEFAULT_JOBS);
  const session = { schemaVersion: SESSION_SCHEMA_VERSION, playerId, sessionId: options.sessionId || makeId("session"), vehicleId: options.vehicleId || "vehicle:bicycle",
    phase: "menu", paused: false, elapsed: 0, accumulator: 0, jobIndex: 0, jobs, deadlineRemaining: null, packageHeld: false,
    shiftEarnings: 0, completedJobIds: [], awardedJobIds: [], receipts: [], failedAttempts: 0, message: "Start a delivery shift.", movement: createStreetMovement(),
    traffic: createTraffic({ seed: options.seed, count: options.trafficCount }), lastCommand: null };
  if (![session.sessionId, session.vehicleId].every(validId)) throw new TypeError("invalid session identifiers");
  attachCollision(session);
  return session;
}

export function commandSession(session, command) {
  if (!command || command.playerId !== session.playerId) return reject(session, "wrong-player");
  const type = command.type;
  if (type === "TOGGLE_PAUSE") {
    if (session.phase === "menu" || session.phase === "results") return reject(session, "wrong-phase");
    session.paused = !session.paused; session.movement.paused = session.paused;
    return accept(session, session.paused ? "paused" : "resumed");
  }
  if (type === "RECOVER") {
    if (!["pickup", "delivery"].includes(session.phase)) return reject(session, "wrong-phase");
    session.failedAttempts++; resetMovement(session); session.movement.paused = session.paused; beginJob(session); session.message = "Delivery restarted safely from pickup.";
    return accept(session, "job-restarted");
  }
  if (type === "RETURN_TO_MENU") {
    if (session.phase === "menu") return reject(session, "wrong-phase");
    resetShift(session); return accept(session, "menu");
  }
  if (session.paused) return reject(session, "paused");
  if (type === "START_SHIFT") {
    if (session.phase !== "menu") return reject(session, "wrong-phase");
    session.phase = "offer"; session.message = "A delivery is available."; return accept(session, "shift-started");
  }
  if (type === "ACCEPT_JOB") {
    if (session.phase !== "offer") return reject(session, "wrong-phase");
    beginJob(session); return accept(session, "job-accepted");
  }
  if (type === "VEHICLE_INTERACTION" || type === "MOUNT_ACTION") {
    if (!["pickup", "delivery"].includes(session.phase)) return reject(session, "wrong-phase");
    return interactStreet(session.movement) ? accept(session, "vehicle-interaction") : reject(session, "invalid-interaction");
  }
  if (type === "PACKAGE_ACTION") {
    const job = currentJob(session);
    if (session.phase === "pickup") {
      if (!atAddress(session, job.pickupId)) return reject(session, "invalid-interaction");
      session.packageHeld = true; session.phase = "delivery"; session.message = `Deliver to ${addressById.get(job.dropoffId).label}.`;
      return accept(session, "package-collected");
    }
    if (session.phase === "delivery") {
      if (!session.packageHeld || !atAddress(session, job.dropoffId)) return reject(session, "invalid-interaction");
      session.packageHeld = false; session.phase = "job_complete"; session.deadlineRemaining = null;
      if (!session.awardedJobIds.includes(job.id)) {
        const receipt = { id: `receipt:${session.sessionId}:${job.id}`, sessionId: session.sessionId, jobId: job.id, reward: job.reward };
        session.awardedJobIds.push(job.id); session.completedJobIds.push(job.id); session.receipts.push(receipt); session.shiftEarnings += job.reward;
      }
      session.message = `${job.reward} credits earned.`; return accept(session, "package-delivered");
    }
    return reject(session, "wrong-phase");
  }
  if (type === "NEXT_JOB") {
    if (session.phase !== "job_complete") return reject(session, "wrong-phase");
    session.jobIndex++;
    if (session.jobIndex >= session.jobs.length) { session.phase = "results"; session.message = "Shift complete."; }
    else { session.phase = "offer"; session.message = "A delivery is available."; }
    return accept(session, session.phase);
  }
  if (type === "RETRY_JOB") {
    if (session.phase !== "job_failed") return reject(session, "wrong-phase");
    resetMovement(session); beginJob(session); return accept(session, "job-retried");
  }
  return reject(session, "unknown-command");
}

function fixedStep(session, input) {
  session.elapsed += FIXED_STEP;
  stepTraffic(session.traffic, FIXED_STEP, { movement: session.movement });
  if (session.phase === "pickup" || session.phase === "delivery") {
    stepStreet(session.movement, { forward: input?.forward || 0, turn: input?.turn || 0 }, FIXED_STEP);
    session.deadlineRemaining = Math.max(0, session.deadlineRemaining - FIXED_STEP);
    if (session.deadlineRemaining === 0) { session.phase = "job_failed"; session.packageHeld = false; session.failedAttempts++; session.message = "Delivery missed. Retry the job."; }
  }
}

export function stepSession(session, input = {}, dt = 0) {
  if (!Number.isFinite(dt) || dt <= 0 || session.paused || session.phase === "menu" || session.phase === "results") return session;
  session.accumulator += Math.min(dt, MAX_FRAME);
  while (session.accumulator + 1e-12 >= FIXED_STEP) { fixedStep(session, input); session.accumulator -= FIXED_STEP; }
  return session;
}

function movementView(movement) {
  const { context, ...plain } = movement;
  const status = movementStatus(movement);
  return { ...clone(plain), label: status.label, canInteract: status.canInteract, hint: status.hint, speedKph: status.speed, bikeDistance: status.distance };
}

export function sessionView(session) {
  const job = currentJob(session);
  const targetId = session.phase === "pickup" ? job?.pickupId : session.phase === "delivery" ? job?.dropoffId : null;
  const target = targetId ? addressById.get(targetId) : null;
  const point = playerPosition(session);
  const targetDistance = target ? Math.hypot(point.x - target.approach[0], point.z - target.approach[2]) : null;
  return { schemaVersion: session.schemaVersion, playerId: session.playerId, sessionId: session.sessionId, vehicleId: session.vehicleId,
    phase: session.phase, paused: session.paused, elapsed: session.elapsed, jobIndex: session.jobIndex, jobs: clone(session.jobs),
    currentJob: job ? clone(job) : null, job: job ? clone(job) : null,
    target: target ? clone(target) : null, targetDistance, canPackageAction: !!target && !session.paused && session.movement.mode === "foot" && Math.abs(session.movement.walkSpeed) <= .15 && targetDistance <= INTERACTION_RADIUS,
    deadlineRemaining: session.deadlineRemaining, packageHeld: session.packageHeld,
    shiftEarnings: session.shiftEarnings, completedJobIds: [...session.completedJobIds], receipts: clone(session.receipts), failedAttempts: session.failedAttempts, message: session.message,
    movement: movementView(session.movement), traffic: trafficView(session.traffic), lastCommand: session.lastCommand ? { ...session.lastCommand } : null };
}

export function serializeSession(session) {
  const data = { ...session, movement: movementView(session.movement), traffic: clone(session.traffic), jobs: clone(session.jobs), lastCommand: null };
  return JSON.stringify(data);
}

export function restoreSession(value, options = {}) {
  let data;
  try { data = typeof value === "string" ? JSON.parse(value) : clone(value); } catch { throw new TypeError("invalid session data"); }
  if (data?.schemaVersion !== SESSION_SCHEMA_VERSION || !validId(data.playerId) || !validId(data.sessionId) || !validId(data.vehicleId) || !PHASES.has(data.phase) ||
    !Array.isArray(data.completedJobIds) || !Array.isArray(data.awardedJobIds) || !Array.isArray(data.receipts) || !Number.isFinite(data.shiftEarnings) || data.shiftEarnings < 0 ||
    !Number.isFinite(data.elapsed) || data.elapsed < 0 || !Number.isInteger(data.jobIndex) || typeof data.paused !== "boolean" || typeof data.packageHeld !== "boolean") throw new TypeError("invalid session data");
  if (options.playerId && data.playerId !== options.playerId) throw new TypeError("session belongs to another player");
  data.jobs = validateJobs(data.jobs);
  const jobIds = new Set(data.jobs.map((job) => job.id));
  const awarded = new Set(data.awardedJobIds);
  const modes = new Set(["foot", "approach", "mount", "ride", "settle", "dismount"]);
  const positions = [data.movement?.player?.x, data.movement?.player?.z, data.movement?.player?.yaw,
    data.movement?.bike?.x, data.movement?.bike?.z, data.movement?.bike?.yaw];
  const motionNumbers = [data.movement?.speed, data.movement?.walkSpeed, data.movement?.walkDistance, data.movement?.phase, data.movement?.clock,
    data.movement?.elapsed, data.movement?.wheelAngle, data.movement?.steer, data.movement?.lean];
  const validPoint = (point, yaw = false) => point && Number.isFinite(point.x) && Number.isFinite(point.z) && (!yaw || Number.isFinite(point.yaw));
  const validTarget = data.movement?.target === null || validPoint(data.movement.target);
  const validTransition = data.movement?.mode === "approach" ? validPoint(data.movement.transition?.from, true) && validPoint(data.movement.transition?.target) &&
    Number.isFinite(data.movement.transition?.duration) && data.movement.transition.duration > 0 : data.movement?.mode === "settle" ?
    Number.isFinite(data.movement.transition?.phase) && Number.isFinite(data.movement.transition?.target) : true;
  const trafficIds = new Set();
  const validTraffic = data.traffic?.schemaVersion === 1 && Number.isFinite(data.traffic.seed) && Array.isArray(data.traffic?.items) && data.traffic.items.length >= 2 && data.traffic.items.length <= 4 &&
    data.traffic.items.every((item) => validId(item.id) && !trafficIds.has(item.id) && trafficIds.add(item.id) &&
      ["traffic-compact-car", "traffic-delivery-van", "traffic-scooter-rider"].includes(item.assetId) && ["east", "west"].includes(item.lane) &&
      item.direction === (item.lane === "east" ? 1 : -1) && [item.x, item.z, item.speed, item.cruiseSpeed, item.length, item.width, item.wheelAngle].every(Number.isFinite) &&
      item.x >= -92 && item.x <= 92 && item.z === (item.lane === "east" ? -2 : 2) && item.speed >= 0 && item.cruiseSpeed >= 0 && item.length > 0 && item.width > 0);
  const trafficOverlap = validTraffic && data.traffic.items.some((item, index) => data.traffic.items.slice(index + 1).some((other) =>
    Math.abs(item.x - other.x) < (item.length + other.length) / 2 && Math.abs(item.z - other.z) < (item.width + other.width) / 2));
  const actorOverlap = validTraffic && (!trafficClearAt(data.traffic, data.movement?.bike || {}, 1.05) ||
    ((data.movement?.mode === "foot" || data.movement?.mode === "approach") && !trafficClearAt(data.traffic, data.movement?.player || {}, .42)));
  const receiptsValid = data.receipts.every((receipt) => validId(receipt?.id) && receipt.sessionId === data.sessionId && jobIds.has(receipt.jobId) &&
    receipt.id === `receipt:${data.sessionId}:${receipt.jobId}` && receipt.reward === data.jobs.find((job) => job.id === receipt.jobId).reward);
  const expectedEarnings = data.receipts.reduce((sum, receipt) => sum + receipt.reward, 0);
  const active = data.phase === "pickup" || data.phase === "delivery";
  if (!data.movement?.player || !data.movement?.bike || !positions.every(Number.isFinite) || !motionNumbers.every(Number.isFinite) || !validTarget || !validTransition ||
    !validTraffic || trafficOverlap || actorOverlap ||
    data.jobIndex < 0 || data.jobIndex > data.jobs.length || (data.phase === "results") !== (data.jobIndex === data.jobs.length) ||
    awarded.size !== data.awardedJobIds.length || data.completedJobIds.length !== new Set(data.completedJobIds).size ||
    data.receipts.length !== new Set(data.receipts.map((receipt) => receipt.id)).size || !receiptsValid || data.receipts.length !== awarded.size || !modes.has(data.movement.mode) ||
    data.awardedJobIds.some((id) => !jobIds.has(id)) || data.completedJobIds.some((id) => !awarded.has(id)) || data.shiftEarnings !== expectedEarnings ||
    (active && (!Number.isFinite(data.deadlineRemaining) || data.deadlineRemaining < 0)) || data.packageHeld !== (data.phase === "delivery") ||
    data.movement.paused !== data.paused) throw new TypeError("invalid session data");
  data.accumulator = Number.isFinite(data.accumulator) ? Math.max(0, Math.min(data.accumulator, FIXED_STEP)) : 0;
  data.movement.paused = !!data.paused;
  attachCollision(data);
  return data;
}

export function createProgress(playerId) {
  if (!validId(playerId)) throw new TypeError("invalid playerId");
  return { schemaVersion: PROGRESS_SCHEMA_VERSION, playerId, wallet: 0, completedJobIds: [], paidReceiptIds: [], savedSession: null };
}

export function loadProgress(storage, playerId) {
  const empty = createProgress(playerId);
  if (!storage?.getItem) return empty;
  try {
    const data = JSON.parse(storage.getItem(`colombo-delivery:progress:v${PROGRESS_SCHEMA_VERSION}:${playerId}`));
    if (data?.schemaVersion !== PROGRESS_SCHEMA_VERSION || data.playerId !== playerId || !Number.isFinite(data.wallet) || data.wallet < 0 ||
      !Array.isArray(data.completedJobIds) || !Array.isArray(data.paidReceiptIds) || data.completedJobIds.some((id) => !validId(id)) || data.paidReceiptIds.some((id) => !validId(id))) return empty;
    let savedSession = null;
    if (typeof data.savedSession === "string") { try { restoreSession(data.savedSession, { playerId }); savedSession = data.savedSession; } catch {} }
    return { ...empty, wallet: data.wallet, completedJobIds: [...new Set(data.completedJobIds)], paidReceiptIds: [...new Set(data.paidReceiptIds)], savedSession };
  } catch { return empty; }
}

export function saveProgress(storage, progress, session = null) {
  if (!storage?.setItem || progress?.schemaVersion !== PROGRESS_SCHEMA_VERSION || !validId(progress.playerId) || (session && session.playerId !== progress.playerId)) return false;
  if (!Array.isArray(progress.completedJobIds) || !Array.isArray(progress.paidReceiptIds) || !Number.isFinite(progress.wallet) || progress.wallet < 0) return false;
  const receipts = session ? session.receipts.filter((receipt) => !progress.paidReceiptIds.includes(receipt.id)) : [];
  const next = { schemaVersion: PROGRESS_SCHEMA_VERSION, playerId: progress.playerId,
    wallet: progress.wallet + receipts.reduce((sum, receipt) => sum + receipt.reward, 0),
    completedJobIds: [...new Set([...progress.completedJobIds, ...(session?.completedJobIds || [])])],
    paidReceiptIds: [...new Set([...progress.paidReceiptIds, ...receipts.map((receipt) => receipt.id)])], savedSession: session ? serializeSession(session) : progress.savedSession };
  try { storage.setItem(`colombo-delivery:progress:v${PROGRESS_SCHEMA_VERSION}:${progress.playerId}`, JSON.stringify(next)); }
  catch { return false; }
  Object.assign(progress, next); return true;
}
