import { inverseProject } from "../world/road-slice";
import type { BicycleState } from "./bicycle";
import type { Road, RoadSlice } from "../world/types";

export type DeliveryPhase = "available" | "pickup" | "delivery" | "failed" | "completed";

export interface PracticeStop {
  id: string;
  label: string;
  x: number;
  z: number;
  longitude: number;
  latitude: number;
  sourceFeatureId: string;
  metresAlongSource: number;
}

export interface PracticeJob {
  id: string;
  label: string;
  pickup: PracticeStop;
  dropoff: PracticeStop;
  timeLimitSeconds: number;
  rewardLkr: number;
}

export interface DeliveryProgress {
  earningsLkr: number;
  completedJobs: number;
}

export interface DeliveryState extends DeliveryProgress {
  phase: DeliveryPhase;
  jobIndex: number;
  secondsRemaining: number;
}

export interface DeliveryGuidance {
  target: PracticeStop;
  distanceMetres: number;
  relativeBearingRadians: number;
  stopped: boolean;
  canAct: boolean;
}

export interface DeliveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DeliveryActionResult {
  changed: boolean;
  event: "accepted" | "picked-up" | "delivered" | "retried" | "cancelled" | "too-far" | "moving" | "unavailable";
}

export const DELIVERY_STORAGE_KEY = "colombo-delivery.practice-progress.v1";
export const DELIVERY_INTERACTION_RADIUS_METRES = 7;
export const DELIVERY_STOPPED_SPEED_METRES_PER_SECOND = 0.15;

const ROUTE_SOURCE_ID = "way/13884292";
const ROUTE_DEFINITIONS = [
  { id: "practice-01", label: "Canal-side warm-up", pickup: 70, dropoff: 140, seconds: 75, reward: 240 },
  { id: "practice-02", label: "Westbound parcel run", pickup: 165, dropoff: 245, seconds: 80, reward: 280 },
  { id: "practice-03", label: "Lake-road practice", pickup: 270, dropoff: 355, seconds: 85, reward: 320 },
] as const;

const EMPTY_PROGRESS: DeliveryProgress = Object.freeze({ earningsLkr: 0, completedJobs: 0 });

export function createPracticeJobs(slice: RoadSlice): readonly PracticeJob[] {
  const pieces = slice.roads.filter((road) => road.sourceFeatureId === ROUTE_SOURCE_ID && isGroundRoad(road));
  const road = pieces.sort((left, right) => roadLength(right) - roadLength(left))[0];
  if (!road) throw new Error(`Practice delivery source ${ROUTE_SOURCE_ID} is missing from the road slice.`);

  return Object.freeze(ROUTE_DEFINITIONS.map((definition) => Object.freeze({
    id: definition.id,
    label: definition.label,
    pickup: makeStop(slice, road, definition.pickup, `${definition.id}-pickup`, "Practice pickup"),
    dropoff: makeStop(slice, road, definition.dropoff, `${definition.id}-dropoff`, "Practice drop-off"),
    timeLimitSeconds: definition.seconds,
    rewardLkr: definition.reward,
  })));
}

export function loadDeliveryProgress(storage?: DeliveryStorage | null): DeliveryProgress {
  if (!storage) return { ...EMPTY_PROGRESS };
  try {
    const raw = storage.getItem(DELIVERY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROGRESS };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...EMPTY_PROGRESS };
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1 || !isSafeNonNegativeInteger(record.earningsLkr) || !isSafeNonNegativeInteger(record.completedJobs)) {
      return { ...EMPTY_PROGRESS };
    }
    return { earningsLkr: record.earningsLkr, completedJobs: record.completedJobs };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export class DeliveryController {
  private state: DeliveryState;
  private storageAvailable: boolean;

  constructor(
    readonly jobs: readonly PracticeJob[],
    private readonly storage?: DeliveryStorage | null,
  ) {
    if (jobs.length === 0) throw new Error("At least one practice delivery job is required.");
    const progress = loadDeliveryProgress(storage);
    this.storageAvailable = Boolean(storage);
    if (storage) {
      try {
        storage.getItem(DELIVERY_STORAGE_KEY);
      } catch {
        this.storageAvailable = false;
      }
    }
    this.state = {
      phase: "available",
      jobIndex: progress.completedJobs % jobs.length,
      secondsRemaining: jobs[progress.completedJobs % jobs.length]!.timeLimitSeconds,
      ...progress,
    };
  }

  getState(): DeliveryState {
    return { ...this.state };
  }

  getCurrentJob(): PracticeJob {
    return this.jobs[this.state.jobIndex]!;
  }

  isProgressSaved(): boolean {
    return this.storageAvailable;
  }

  getGuidance(bicycle: Pick<BicycleState, "x" | "z" | "heading" | "speed">): DeliveryGuidance | null {
    if (this.state.phase !== "pickup" && this.state.phase !== "delivery") return null;
    const job = this.getCurrentJob();
    const target = this.state.phase === "pickup" ? job.pickup : job.dropoff;
    const dx = target.x - bicycle.x;
    const dz = target.z - bicycle.z;
    const bearing = Math.atan2(dx, -dz);
    const distanceMetres = Math.hypot(dx, dz);
    const stopped = Math.abs(bicycle.speed) <= DELIVERY_STOPPED_SPEED_METRES_PER_SECOND;
    return {
      target,
      distanceMetres,
      relativeBearingRadians: wrapRadians(bearing - bicycle.heading),
      stopped,
      canAct: stopped && distanceMetres <= DELIVERY_INTERACTION_RADIUS_METRES,
    };
  }

  accept(): DeliveryActionResult {
    if (this.state.phase !== "available" && this.state.phase !== "completed") return unchanged("unavailable");
    if (this.state.phase === "completed") this.advanceJob();
    this.state.phase = "pickup";
    this.state.secondsRemaining = this.getCurrentJob().timeLimitSeconds;
    return changed("accepted");
  }

  retry(): DeliveryActionResult {
    if (this.state.phase !== "failed") return unchanged("unavailable");
    this.state.phase = "pickup";
    this.state.secondsRemaining = this.getCurrentJob().timeLimitSeconds;
    return changed("retried");
  }

  cancel(): DeliveryActionResult {
    if (this.state.phase !== "pickup" && this.state.phase !== "delivery") return unchanged("unavailable");
    this.state.phase = "available";
    this.state.secondsRemaining = this.getCurrentJob().timeLimitSeconds;
    return changed("cancelled");
  }

  attemptStopAction(bicycle: Pick<BicycleState, "x" | "z" | "heading" | "speed">): DeliveryActionResult {
    const guidance = this.getGuidance(bicycle);
    if (!guidance) return unchanged("unavailable");
    if (guidance.distanceMetres > DELIVERY_INTERACTION_RADIUS_METRES) return unchanged("too-far");
    if (!guidance.stopped) return unchanged("moving");
    if (this.state.phase === "pickup") {
      this.state.phase = "delivery";
      return changed("picked-up");
    }

    const reward = this.getCurrentJob().rewardLkr;
    this.state.phase = "completed";
    this.state.earningsLkr = Math.min(Number.MAX_SAFE_INTEGER, this.state.earningsLkr + reward);
    this.state.completedJobs = Math.min(Number.MAX_SAFE_INTEGER, this.state.completedJobs + 1);
    this.persist();
    return changed("delivered");
  }

  step(deltaSeconds: number): boolean {
    if (this.state.phase !== "pickup" && this.state.phase !== "delivery") return false;
    const delta = Number.isFinite(deltaSeconds) ? Math.max(deltaSeconds, 0) : 0;
    if (delta === 0) return false;
    this.state.secondsRemaining = Math.max(0, this.state.secondsRemaining - delta);
    if (this.state.secondsRemaining > 0) return false;
    this.state.phase = "failed";
    return true;
  }

  private advanceJob(): void {
    this.state.jobIndex = (this.state.jobIndex + 1) % this.jobs.length;
    this.state.phase = "available";
    this.state.secondsRemaining = this.getCurrentJob().timeLimitSeconds;
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify({
        version: 1,
        earningsLkr: this.state.earningsLkr,
        completedJobs: this.state.completedJobs,
      }));
    } catch {
      // Progress remains usable for this session when storage is blocked or full.
      this.storageAvailable = false;
    }
  }
}

function makeStop(
  slice: RoadSlice,
  road: Road,
  metresAlongSource: number,
  id: string,
  label: string,
): PracticeStop {
  const point = pointAlongRoad(road, metresAlongSource);
  const wgs84 = inverseProject(point.x, point.z, slice.origin);
  return Object.freeze({ id, label, ...point, ...{ longitude: wgs84.lon, latitude: wgs84.lat }, sourceFeatureId: road.sourceFeatureId, metresAlongSource });
}

function pointAlongRoad(road: Road, requestedDistance: number): { x: number; z: number } {
  const total = roadLength(road);
  if (requestedDistance > total) throw new Error(`Practice stop at ${requestedDistance} m exceeds ${road.sourceFeatureId} length ${total.toFixed(1)} m.`);
  let walked = 0;
  for (let index = 1; index < road.points.length; index += 1) {
    const start = road.points[index - 1]!;
    const end = road.points[index]!;
    const segment = Math.hypot(end.x - start.x, end.z - start.z);
    if (walked + segment < requestedDistance && index < road.points.length - 1) {
      walked += segment;
      continue;
    }
    const ratio = segment === 0 ? 0 : Math.max(0, Math.min(1, (requestedDistance - walked) / segment));
    return { x: start.x + (end.x - start.x) * ratio, z: start.z + (end.z - start.z) * ratio };
  }
  const last = road.points.at(-1)!;
  return { x: last.x, z: last.z };
}

function roadLength(road: Road): number {
  let total = 0;
  for (let index = 1; index < road.points.length; index += 1) {
    total += Math.hypot(road.points[index]!.x - road.points[index - 1]!.x, road.points[index]!.z - road.points[index - 1]!.z);
  }
  return total;
}

function isGroundRoad(road: Road): boolean {
  return road.vertical.elevationMetres === 0 && !road.vertical.bridge && !road.vertical.tunnel && road.highway !== "steps";
}

function wrapRadians(value: number): number {
  return ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function changed(event: DeliveryActionResult["event"]): DeliveryActionResult {
  return { changed: true, event };
}

function unchanged(event: DeliveryActionResult["event"]): DeliveryActionResult {
  return { changed: false, event };
}
