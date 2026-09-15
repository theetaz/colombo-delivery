const MIN_X = -92;
const MAX_X = 92;
const SPAN = MAX_X - MIN_X;
const LANES = { east: { z: -2, direction: 1 }, west: { z: 2, direction: -1 } };
const VEHICLES = [
  { assetId: "traffic-compact-car", kind: "car", length: 3.95, width: 1.785, speed: 5.4 },
  { assetId: "traffic-delivery-van", kind: "van", length: 4.885, width: 1.975, speed: 4.6 },
  { assetId: "traffic-scooter-rider", kind: "scooter", length: 1.98, width: .83, speed: 6.1 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function seededRandom(seed = 2407) {
  let value = (Number.isFinite(seed) ? seed : 2407) >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function aheadDistance(from, to, direction) {
  return direction > 0 ? (to - from + SPAN) % SPAN : (from - to + SPAN) % SPAN;
}

function wrapX(x) {
  while (x > MAX_X) x -= SPAN;
  while (x < MIN_X) x += SPAN;
  return x;
}

export function createTraffic({ seed = 2407, count } = {}) {
  const random = seededRandom(seed);
  const total = clamp(Number.isInteger(count) ? count : 2 + Math.floor(random() * 3), 2, 4);
  const lanes = total === 2 ? ["east", "west"] : total === 3 ? ["east", "west", random() < .5 ? "east" : "west"] : ["east", "west", "east", "west"];
  const laneCounts = { east: 0, west: 0 };
  const items = lanes.map((lane, index) => {
    const template = VEHICLES[Math.floor(random() * VEHICLES.length)];
    const slot = laneCounts[lane]++;
    const slots = lanes.filter((value) => value === lane).length;
    const direction = LANES[lane].direction;
    const base = MIN_X + SPAN * ((slot + .2 + random() * .25) / slots);
    return { id: `traffic:${index + 1}`, ...template, lane, x: wrapX(direction > 0 ? base : -base), z: LANES[lane].z,
      direction, cruiseSpeed: template.speed * (.9 + random() * .2), speed: template.speed * .55, wheelAngle: 0 };
  });
  return { schemaVersion: 1, seed, items };
}

function playerObstacles(context, item) {
  const movement = context?.movement;
  if (!movement) return [];
  const candidates = [{ position: movement.bike, radius: 1.05, yieldMargin: .3 }];
  if (movement.mode === "foot" || movement.mode === "approach") candidates.push({ position: movement.player, radius: .42, yieldMargin: 2.2 });
  return candidates.filter(({ position, radius, yieldMargin }) => position && Math.abs(position.z - item.z) <= item.width / 2 + radius + yieldMargin)
    .map(({ position, radius }) => ({ x: position.x, length: radius * 2, isPlayer: true }));
}

export function stepTraffic(state, dt, context = {}) {
  if (!state?.items || context.paused || !Number.isFinite(dt) || dt <= 0) return state;
  const seconds = Math.min(dt, .1);
  const source = state.items.map((item) => ({ ...item }));
  for (const item of state.items) {
    const original = source.find((other) => other.id === item.id);
    const obstacles = source.filter((other) => other.id !== item.id && other.lane === item.lane);
    obstacles.push(...playerObstacles(context, original));
    let clearance = Infinity;
    for (const obstacle of obstacles) {
      const distance = aheadDistance(original.x, obstacle.x, original.direction);
      const gap = 2.4 + (original.length + obstacle.length) / 2;
      clearance = Math.min(clearance, distance <= .001 ? -gap : distance - gap);
    }
    const safeSpeed = clearance === Infinity ? original.cruiseSpeed : clamp(clearance * 1.25, 0, original.cruiseSpeed);
    const acceleration = safeSpeed < original.speed ? -7 : 2.2;
    item.speed = clamp(original.speed + acceleration * seconds, 0, original.cruiseSpeed);
    const travel = Math.min(item.speed * seconds, Math.max(0, clearance));
    item.x = wrapX(original.x + original.direction * travel);
    item.wheelAngle = original.wheelAngle + travel / .34;
  }
  return state;
}

export function trafficClearAt(state, point, radius = .34) {
  if (!state?.items) return true;
  return state.items.every((item) => Math.abs(point.x - item.x) > radius + item.length / 2 || Math.abs(point.z - item.z) > radius + item.width / 2);
}

export function trafficView(state) {
  return (state?.items || []).map(({ id, assetId, kind, lane, x, z, direction, speed, wheelAngle, length, width }) =>
    ({ id, assetId, prefabAssetId: assetId, kind, lane, x, z, direction, speed, wheelAngle, length, width }));
}
