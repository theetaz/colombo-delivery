import { inverseProject } from "../world/road-slice";
import type { Road, RoadBounds, RoadOrigin, RoadSlice } from "../world/types";

export type BicycleSurface = "road" | "grass";
export type BicycleCollisionKind = "boundary" | "obstacle";

export interface BicycleInput {
  pedal: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
}

export interface BicycleSpawn {
  x: number;
  y: number;
  z: number;
  heading: number;
  longitude: number;
  latitude: number;
  roadId: string;
  sourceFeatureId: string;
}

export interface BicycleObstacle {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  label: string;
}

export type PrototypeObstacle = BicycleObstacle;

export interface BicycleState {
  x: number;
  y: number;
  z: number;
  /** Radians clockwise from north: 0 travels toward -Z and positive turns toward +X. */
  heading: number;
  speed: number;
  /** Normalized handlebar input: -1 left, +1 right. */
  steering: number;
  distanceTravelled: number;
  surface: BicycleSurface;
  boundaryCollisions: number;
  obstacleCollisions: number;
  droppedSeconds: number;
  lastCollision: BicycleCollisionKind | null;
  lastObstacleId: string | null;
}

export interface BicycleTuning {
  fixedStepSeconds: number;
  maximumFrameDeltaSeconds: number;
  maximumRoadSpeed: number;
  maximumGrassSpeed: number;
  pedalAcceleration: number;
  brakeDeceleration: number;
  rollingDeceleration: number;
  aerodynamicDrag: number;
  grassDeceleration: number;
  steeringResponse: number;
  steeringReturn: number;
  maximumSteerAngleRadians: number;
  wheelbaseMetres: number;
  maximumTurnRateRadiansPerSecond: number;
  minimumTurningSpeed: number;
}

export interface BicycleControllerOptions {
  spawn?: BicycleSpawn;
  obstacles?: readonly BicycleObstacle[];
  tuning?: Partial<BicycleTuning>;
}

export interface BicycleController {
  readonly spawn: Readonly<BicycleSpawn>;
  readonly obstacles: readonly Readonly<BicycleObstacle>[];
  readonly tuning: Readonly<BicycleTuning>;
  reset(): BicycleState;
  step(deltaSeconds: number, input?: Partial<BicycleInput>): BicycleState;
  getState(): BicycleState;
  classifySurface(x: number, z: number): BicycleSurface;
}

export const BICYCLE_RADIUS_METRES = 0.55;
export const SPAWN_ROAD_SOURCE_FEATURE_ID = "way/13884292";
export const SPAWN_DISTANCE_ALONG_ROAD_METRES = 70;
export const SPAWN_LEFT_OFFSET_METRES = 1.5;

export const BICYCLE_TUNING: Readonly<BicycleTuning> = Object.freeze({
  fixedStepSeconds: 1 / 120,
  maximumFrameDeltaSeconds: 0.25,
  maximumRoadSpeed: 30 / 3.6,
  maximumGrassSpeed: 12 / 3.6,
  pedalAcceleration: 2.4,
  brakeDeceleration: 7,
  rollingDeceleration: 0.32,
  aerodynamicDrag: 0.018,
  grassDeceleration: 1.1,
  steeringResponse: 4.8,
  steeringReturn: 6.5,
  maximumSteerAngleRadians: 0.5,
  wheelbaseMetres: 1.1,
  maximumTurnRateRadiansPerSecond: 1.75,
  minimumTurningSpeed: 0.2,
});

interface SurfaceTriangle {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  cx: number;
  cz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Collision {
  kind: BicycleCollisionKind;
  time: number;
  obstacleId: string | null;
}

const EPSILON = 1e-9;
const COLLISION_CLEARANCE_METRES = 1e-4;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function wrapHeading(heading: number): number {
  const wrapped = ((heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return wrapped - Math.PI;
}

function moveTowards(current: number, target: number, maximumChange: number): number {
  if (current < target) return Math.min(current + maximumChange, target);
  if (current > target) return Math.max(current - maximumChange, target);
  return target;
}

function roadCanSupportBicycle(road: Road): boolean {
  return (
    road.vertical.elevationMetres === 0 &&
    !road.vertical.bridge &&
    !road.vertical.tunnel &&
    road.highway !== "steps"
  );
}

function roadLength(road: Road): number {
  let total = 0;
  for (let index = 1; index < road.points.length; index += 1) {
    const previous = road.points[index - 1]!;
    const current = road.points[index]!;
    total += Math.hypot(current.x - previous.x, current.z - previous.z);
  }
  return total;
}

export function findBicycleSpawn(slice: RoadSlice): BicycleSpawn {
  const preferred = slice.roads.find(
    (road) => road.sourceFeatureId === SPAWN_ROAD_SOURCE_FEATURE_ID && roadCanSupportBicycle(road),
  );
  const road =
    preferred ??
    slice.roads
      .filter(roadCanSupportBicycle)
      .sort((left, right) => roadLength(right) - roadLength(left))[0];
  if (!road || road.points.length < 2) {
    throw new Error("The road slice has no ground-level riding surface for a bicycle spawn.");
  }

  const targetDistance = Math.min(SPAWN_DISTANCE_ALONG_ROAD_METRES, roadLength(road) * 0.5);
  let walked = 0;
  for (let index = 1; index < road.points.length; index += 1) {
    const start = road.points[index - 1]!;
    const end = road.points[index]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const segmentLength = Math.hypot(dx, dz);
    if (segmentLength < EPSILON) continue;
    if (walked + segmentLength < targetDistance && index < road.points.length - 1) {
      walked += segmentLength;
      continue;
    }

    const ratio = clamp((targetDistance - walked) / segmentLength, 0, 1);
    const directionX = dx / segmentLength;
    const directionZ = dz / segmentLength;
    const heading = Math.atan2(directionX, -directionZ);
    const leftX = -Math.cos(heading);
    const leftZ = -Math.sin(heading);
    const leftOffset = Math.min(SPAWN_LEFT_OFFSET_METRES, road.width.metres * 0.25);
    const x = start.x + dx * ratio + leftX * leftOffset;
    const z = start.z + dz * ratio + leftZ * leftOffset;
    const wgs84 = inverseProject(x, z, slice.origin);
    return {
      x,
      y: 0,
      z,
      heading,
      longitude: wgs84.lon,
      latitude: wgs84.lat,
      roadId: road.id,
      sourceFeatureId: road.sourceFeatureId,
    };
  }

  throw new Error(`Road ${road.id} has no usable spawn segment.`);
}

/** Two grass-side bollards near spawn. They leave the road itself fully open. */
export function createPrototypeObstacles(
  spawn: BicycleSpawn,
): readonly Readonly<BicycleObstacle>[] {
  const forwardX = Math.sin(spawn.heading);
  const forwardZ = -Math.cos(spawn.heading);
  const leftX = -Math.cos(spawn.heading);
  const leftZ = -Math.sin(spawn.heading);
  const lateralOffset = 5;
  const alongOffsets = [-2.25, 2.25] as const;
  return Object.freeze(
    alongOffsets.map((along, index) =>
      Object.freeze({
        id: `practice-bollard-${index + 1}`,
        x: spawn.x + leftX * lateralOffset + forwardX * along,
        y: 0,
        z: spawn.z + leftZ * lateralOffset + forwardZ * along,
        radius: 0.55,
        label: `Practice bollard ${index + 1}`,
      }),
    ),
  );
}

function compileSurfaceTriangles(slice: RoadSlice): SurfaceTriangle[] {
  const triangles: SurfaceTriangle[] = [];
  for (const road of slice.roads) {
    if (!roadCanSupportBicycle(road)) continue;
    const { indices, vertices } = road.mesh;
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
      const a = indices[offset]! * 3;
      const b = indices[offset + 1]! * 3;
      const c = indices[offset + 2]! * 3;
      const ax = vertices[a];
      const az = vertices[a + 2];
      const bx = vertices[b];
      const bz = vertices[b + 2];
      const cx = vertices[c];
      const cz = vertices[c + 2];
      if (
        ax === undefined || az === undefined || bx === undefined || bz === undefined ||
        cx === undefined || cz === undefined
      ) continue;
      triangles.push({
        ax,
        az,
        bx,
        bz,
        cx,
        cz,
        minX: Math.min(ax, bx, cx),
        maxX: Math.max(ax, bx, cx),
        minZ: Math.min(az, bz, cz),
        maxZ: Math.max(az, bz, cz),
      });
    }
  }
  return triangles;
}

function pointInTriangle(x: number, z: number, triangle: SurfaceTriangle): boolean {
  if (
    x < triangle.minX - EPSILON || x > triangle.maxX + EPSILON ||
    z < triangle.minZ - EPSILON || z > triangle.maxZ + EPSILON
  ) return false;
  const edge = (ax: number, az: number, bx: number, bz: number): number =>
    (x - bx) * (az - bz) - (ax - bx) * (z - bz);
  const first = edge(triangle.ax, triangle.az, triangle.bx, triangle.bz);
  const second = edge(triangle.bx, triangle.bz, triangle.cx, triangle.cz);
  const third = edge(triangle.cx, triangle.cz, triangle.ax, triangle.az);
  const hasNegative = first < -EPSILON || second < -EPSILON || third < -EPSILON;
  const hasPositive = first > EPSILON || second > EPSILON || third > EPSILON;
  return !(hasNegative && hasPositive);
}

function validTuning(overrides: Partial<BicycleTuning> | undefined): Readonly<BicycleTuning> {
  const merged = { ...BICYCLE_TUNING, ...overrides };
  for (const [name, value] of Object.entries(merged)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`Bicycle tuning ${name} must be a positive finite number.`);
    }
  }
  return Object.freeze(merged);
}

function normalizeSpawn(spawn: BicycleSpawn, bounds: RoadBounds, origin: RoadOrigin): BicycleSpawn {
  const minimumX = bounds.minX + BICYCLE_RADIUS_METRES;
  const maximumX = bounds.maxX - BICYCLE_RADIUS_METRES;
  const minimumZ = bounds.minZ + BICYCLE_RADIUS_METRES;
  const maximumZ = bounds.maxZ - BICYCLE_RADIUS_METRES;
  if (minimumX > maximumX || minimumZ > maximumZ) {
    throw new RangeError("The road slice bounds are too small for the bicycle collision radius.");
  }
  const x = clamp(finiteOr(spawn.x, 0), minimumX, maximumX);
  const z = clamp(finiteOr(spawn.z, 0), minimumZ, maximumZ);
  const wgs84 = inverseProject(x, z, origin);
  return {
    ...spawn,
    x,
    y: 0,
    z,
    heading: wrapHeading(finiteOr(spawn.heading, 0)),
    longitude: wgs84.lon,
    latitude: wgs84.lat,
    roadId: String(spawn.roadId),
    sourceFeatureId: String(spawn.sourceFeatureId),
  };
}

function normalizeObstacles(
  obstacles: readonly BicycleObstacle[],
  bounds: RoadBounds,
): readonly Readonly<BicycleObstacle>[] {
  return Object.freeze(
    obstacles.flatMap((obstacle) => {
      if (
        !Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.z) ||
        !Number.isFinite(obstacle.radius) || obstacle.radius <= 0
      ) return [];
      if (
        obstacle.x + obstacle.radius < bounds.minX || obstacle.x - obstacle.radius > bounds.maxX ||
        obstacle.z + obstacle.radius < bounds.minZ || obstacle.z - obstacle.radius > bounds.maxZ
      ) return [];
      return [Object.freeze({ ...obstacle, y: finiteOr(obstacle.y, 0) })];
    }),
  );
}

function initialState(spawn: BicycleSpawn, surface: BicycleSurface): BicycleState {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    heading: spawn.heading,
    speed: 0,
    steering: 0,
    distanceTravelled: 0,
    surface,
    boundaryCollisions: 0,
    obstacleCollisions: 0,
    droppedSeconds: 0,
    lastCollision: null,
    lastObstacleId: null,
  };
}

function boundaryCollision(
  startX: number,
  startZ: number,
  dx: number,
  dz: number,
  bounds: RoadBounds,
): Collision | null {
  const minimumX = bounds.minX + BICYCLE_RADIUS_METRES;
  const maximumX = bounds.maxX - BICYCLE_RADIUS_METRES;
  const minimumZ = bounds.minZ + BICYCLE_RADIUS_METRES;
  const maximumZ = bounds.maxZ - BICYCLE_RADIUS_METRES;
  let time = 1;
  let collided = false;
  if (dx > 0 && startX + dx > maximumX) {
    time = Math.min(time, (maximumX - startX) / dx);
    collided = true;
  } else if (dx < 0 && startX + dx < minimumX) {
    time = Math.min(time, (minimumX - startX) / dx);
    collided = true;
  }
  if (dz > 0 && startZ + dz > maximumZ) {
    time = Math.min(time, (maximumZ - startZ) / dz);
    collided = true;
  } else if (dz < 0 && startZ + dz < minimumZ) {
    time = Math.min(time, (minimumZ - startZ) / dz);
    collided = true;
  }
  return collided ? { kind: "boundary", time: clamp(time, 0, 1), obstacleId: null } : null;
}

function obstacleCollision(
  startX: number,
  startZ: number,
  dx: number,
  dz: number,
  obstacles: readonly Readonly<BicycleObstacle>[],
): Collision | null {
  const movementLengthSquared = dx * dx + dz * dz;
  if (movementLengthSquared < EPSILON) return null;
  let collision: Collision | null = null;
  for (const obstacle of obstacles) {
    const combinedRadius = BICYCLE_RADIUS_METRES + obstacle.radius;
    const offsetX = startX - obstacle.x;
    const offsetZ = startZ - obstacle.z;
    const c = offsetX * offsetX + offsetZ * offsetZ - combinedRadius * combinedRadius;
    if (c <= 0) {
      collision = { kind: "obstacle", time: 0, obstacleId: obstacle.id };
      break;
    }
    const b = 2 * (offsetX * dx + offsetZ * dz);
    const discriminant = b * b - 4 * movementLengthSquared * c;
    if (discriminant < 0) continue;
    const time = (-b - Math.sqrt(discriminant)) / (2 * movementLengthSquared);
    if (time >= 0 && time <= 1 && (!collision || time < collision.time)) {
      collision = { kind: "obstacle", time, obstacleId: obstacle.id };
    }
  }
  return collision;
}

export function createBicycleController(
  slice: RoadSlice,
  options: BicycleControllerOptions = {},
): BicycleController {
  const triangles = compileSurfaceTriangles(slice);
  const classifySurface = (x: number, z: number): BicycleSurface => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return "grass";
    return triangles.some((triangle) => pointInTriangle(x, z, triangle)) ? "road" : "grass";
  };
  const tuning = validTuning(options.tuning);
  const spawn = Object.freeze(
    normalizeSpawn(options.spawn ?? findBicycleSpawn(slice), slice.bounds, slice.origin),
  );
  const obstacles = normalizeObstacles(
    options.obstacles ?? createPrototypeObstacles(spawn),
    slice.bounds,
  );
  let state = initialState(spawn, classifySurface(spawn.x, spawn.z));
  let accumulatorSeconds = 0;
  let activeCollisionKey: string | null = null;

  const reset = (): BicycleState => {
    accumulatorSeconds = 0;
    activeCollisionKey = null;
    state = initialState(spawn, classifySurface(spawn.x, spawn.z));
    return { ...state };
  };

  const simulate = (input: BicycleInput): void => {
    const dt = tuning.fixedStepSeconds;
    const steeringTarget = Number(input.right) - Number(input.left);
    const steeringRate = steeringTarget === 0 ? tuning.steeringReturn : tuning.steeringResponse;
    state.steering = moveTowards(state.steering, steeringTarget, steeringRate * dt);

    const surfaceBeforeMovement = classifySurface(state.x, state.z);
    const maximumSpeed = surfaceBeforeMovement === "road"
      ? tuning.maximumRoadSpeed
      : tuning.maximumGrassSpeed;
    let acceleration = input.pedal && !input.brake ? tuning.pedalAcceleration : 0;
    if (input.brake) acceleration -= tuning.brakeDeceleration;
    if (state.speed > 0) {
      acceleration -= tuning.rollingDeceleration + tuning.aerodynamicDrag * state.speed * state.speed;
      if (surfaceBeforeMovement === "grass") acceleration -= tuning.grassDeceleration;
    }
    state.speed = clamp(state.speed + acceleration * dt, 0, maximumSpeed);

    if (state.speed >= tuning.minimumTurningSpeed) {
      const steerAngle = state.steering * tuning.maximumSteerAngleRadians;
      const turnRate = clamp(
        (state.speed / tuning.wheelbaseMetres) * Math.tan(steerAngle),
        -tuning.maximumTurnRateRadiansPerSecond,
        tuning.maximumTurnRateRadiansPerSecond,
      );
      state.heading = wrapHeading(state.heading + turnRate * dt);
    }

    const dx = Math.sin(state.heading) * state.speed * dt;
    const dz = -Math.cos(state.heading) * state.speed * dt;
    const boundary = boundaryCollision(state.x, state.z, dx, dz, slice.bounds);
    const obstacle = obstacleCollision(state.x, state.z, dx, dz, obstacles);
    let collision: Collision | null = boundary;
    if (obstacle && (!collision || obstacle.time < collision.time)) collision = obstacle;

    let movementRatio = 1;
    if (collision) {
      const movementLength = Math.hypot(dx, dz);
      movementRatio = Math.max(0, collision.time - COLLISION_CLEARANCE_METRES / movementLength);
      state.speed = 0;
      state.lastCollision = collision.kind;
      state.lastObstacleId = collision.obstacleId;
      const collisionKey = `${collision.kind}:${collision.obstacleId ?? "world"}`;
      if (collisionKey !== activeCollisionKey) {
        if (collision.kind === "boundary") state.boundaryCollisions += 1;
        else state.obstacleCollisions += 1;
      }
      activeCollisionKey = collisionKey;
    } else {
      activeCollisionKey = null;
    }
    const travelled = Math.hypot(dx, dz) * movementRatio;
    state.x += dx * movementRatio;
    state.z += dz * movementRatio;
    state.distanceTravelled += travelled;
    state.y = 0;
    state.surface = classifySurface(state.x, state.z);
    if (state.surface === "grass") {
      state.speed = Math.min(state.speed, tuning.maximumGrassSpeed);
    }
  };

  const step = (deltaSeconds: number, partialInput: Partial<BicycleInput> = {}): BicycleState => {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { ...state };
    const acceptedDelta = Math.min(deltaSeconds, tuning.maximumFrameDeltaSeconds);
    state.droppedSeconds = Math.min(
      Number.MAX_SAFE_INTEGER,
      state.droppedSeconds + Math.max(0, deltaSeconds - acceptedDelta),
    );
    accumulatorSeconds += acceptedDelta;
    const input: BicycleInput = {
      pedal: partialInput.pedal === true,
      brake: partialInput.brake === true,
      left: partialInput.left === true,
      right: partialInput.right === true,
    };
    while (accumulatorSeconds + EPSILON >= tuning.fixedStepSeconds) {
      simulate(input);
      accumulatorSeconds -= tuning.fixedStepSeconds;
    }
    accumulatorSeconds = Math.max(0, accumulatorSeconds);
    return { ...state };
  };

  return Object.freeze({
    spawn,
    obstacles,
    tuning,
    reset,
    step,
    getState: (): BicycleState => ({ ...state }),
    classifySurface,
  });
}
