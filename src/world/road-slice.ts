import type {
  BuildRoadSliceOptions,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  LocalPoint,
  LonLat,
  Road,
  RoadBounds,
  RoadMesh,
  RoadOrigin,
  RoadPoint,
  RoadSlice,
  RoadVerticalPlacement,
  RoadWidth,
} from "./types";

export type * from "./types";

export const EARTH_RADIUS_METRES = 6_371_008.8;
export const DEFAULT_ROAD_ORIGIN: Readonly<RoadOrigin> = Object.freeze({
  lon: 79.8583149,
  lat: 6.9270265,
});
export const DEFAULT_HALF_EXTENT_METRES = 450;
export const ASSUMED_LANE_WIDTH_METRES = 3.2;
export const ASSUMED_LAYER_SEPARATION_METRES = 5;

/** Visual-width defaults used only when no credible width or lane count exists. */
export const ROAD_CLASS_WIDTH_METRES: Readonly<Record<string, number>> = Object.freeze({
  motorway: 10.5,
  motorway_link: 7,
  trunk: 9,
  trunk_link: 7,
  primary: 8,
  primary_link: 6.5,
  secondary: 7,
  secondary_link: 6,
  tertiary: 6.5,
  tertiary_link: 5.5,
  residential: 5.5,
  unclassified: 5.5,
  living_street: 4.5,
  service: 4,
  pedestrian: 4,
  busway: 6,
  cycleway: 2.5,
  footway: 2,
  path: 2,
  steps: 1.8,
  track: 3,
  corridor: 1.8,
  platform: 3,
  road: 5.5,
});

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-8;
const MITER_LIMIT = 2.5;
const MOTOR_HIGHWAYS = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
  "residential",
  "unclassified",
  "living_street",
  "service",
  "busway",
  "road",
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeLongitudeRadians(value: number): number {
  const wrapped = ((value + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return wrapped - Math.PI;
}

/** Spherical azimuthal-equidistant projection. x is east and z is south. */
export function projectLonLat(
  lon: number,
  lat: number,
  origin: RoadOrigin = DEFAULT_ROAD_ORIGIN,
): LocalPoint {
  const lambda = lon * DEG_TO_RAD;
  const phi = lat * DEG_TO_RAD;
  const lambda0 = origin.lon * DEG_TO_RAD;
  const phi0 = origin.lat * DEG_TO_RAD;
  const deltaLambda = normalizeLongitudeRadians(lambda - lambda0);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinPhi0 = Math.sin(phi0);
  const cosPhi0 = Math.cos(phi0);
  const cosC = clamp(sinPhi0 * sinPhi + cosPhi0 * cosPhi * Math.cos(deltaLambda), -1, 1);
  const c = Math.acos(cosC);
  const scale = c < 1e-12 ? 1 : c / Math.sin(c);
  const x = EARTH_RADIUS_METRES * scale * cosPhi * Math.sin(deltaLambda);
  const north =
    EARTH_RADIUS_METRES *
    scale *
    (cosPhi0 * sinPhi - sinPhi0 * cosPhi * Math.cos(deltaLambda));
  return {
    x: Math.abs(x) < 1e-9 ? 0 : x,
    z: Math.abs(north) < 1e-9 ? 0 : -north,
  };
}

/** Inverse of projectLonLat for local x-east, z-south coordinates. */
export function inverseProject(
  x: number,
  z: number,
  origin: RoadOrigin = DEFAULT_ROAD_ORIGIN,
): { lon: number; lat: number } {
  const phi0 = origin.lat * DEG_TO_RAD;
  const lambda0 = origin.lon * DEG_TO_RAD;
  const north = -z;
  const rho = Math.hypot(x, north);
  if (rho < 1e-12) return { lon: origin.lon, lat: origin.lat };

  const c = rho / EARTH_RADIUS_METRES;
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const lat = Math.asin(
    cosC * Math.sin(phi0) + (north * sinC * Math.cos(phi0)) / rho,
  );
  const lon =
    lambda0 +
    Math.atan2(
      x * sinC,
      rho * Math.cos(phi0) * cosC - north * Math.sin(phi0) * sinC,
    );
  return { lon: normalizeLongitudeRadians(lon) * RAD_TO_DEG, lat: lat * RAD_TO_DEG };
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function stringTags(feature: GeoJsonFeature): Record<string, string> {
  const raw = feature.properties?.tags;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const text = stringValue(value);
    if (text !== undefined) tags[key] = text;
  }
  return tags;
}

function credibleWidthMetres(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  let metres: number | null = null;
  const metric = value.match(/^(\d+(?:\.\d+)?)\s*(?:m|metre|metres|meter|meters)?$/);
  if (metric) metres = Number(metric[1]);
  const decimalFeet = value.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|foot)$/);
  if (decimalFeet) metres = Number(decimalFeet[1]) * 0.3048;
  const feetAndInches = value.match(/^(\d+)\s*(?:ft|')\s*(\d+(?:\.\d+)?)?\s*(?:in|")?$/);
  if (feetAndInches) {
    const inches = Number(feetAndInches[2] ?? 0);
    if (inches < 12) metres = (Number(feetAndInches[1]) * 12 + inches) * 0.0254;
  }
  return metres !== null && Number.isFinite(metres) && metres >= 0.8 && metres <= 40
    ? metres
    : null;
}

function credibleLaneCount(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const lanes = Number(raw);
  return Number.isInteger(lanes) && lanes >= 1 && lanes <= 12 ? lanes : null;
}

export function resolveRoadWidth(highway: string, tags: Record<string, string>): RoadWidth {
  const rawWidth = tags.width;
  const rawLanes = tags.lanes;
  const explicitMetres = credibleWidthMetres(rawWidth);
  if (explicitMetres !== null) {
    return {
      metres: explicitMetres,
      source: "width",
      rationale: "Strict numeric OSM width converted to metres; accepted range is 0.8–40 m.",
      ...(rawWidth === undefined ? {} : { rawWidth }),
      ...(rawLanes === undefined ? {} : { rawLanes }),
    };
  }

  const lanes = MOTOR_HIGHWAYS.has(highway) ? credibleLaneCount(rawLanes) : null;
  if (lanes !== null) {
    return {
      metres: lanes * ASSUMED_LANE_WIDTH_METRES,
      source: "lanes",
      rationale: `${lanes} mapped motor-traffic lane(s) × ${ASSUMED_LANE_WIDTH_METRES} m visual assumption; not a surveyed width.`,
      ...(rawWidth === undefined ? {} : { rawWidth }),
      ...(rawLanes === undefined ? {} : { rawLanes }),
    };
  }

  const fallback = ROAD_CLASS_WIDTH_METRES[highway] ?? 4;
  return {
    metres: fallback,
    source: "class-fallback",
    rationale: `Documented ${highway || "unknown"} visual-width fallback; not a surveyed width.`,
    ...(rawWidth === undefined ? {} : { rawWidth }),
    ...(rawLanes === undefined ? {} : { rawLanes }),
  };
}

function truthyOsmTag(value: string | undefined): boolean {
  return value === "yes" || value === "true" || value === "1";
}

function strictLayer(raw: string | undefined): number | null {
  if (!raw || !/^-?\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= -5 && value <= 5 ? value : null;
}

export function resolveVerticalPlacement(tags: Record<string, string>): RoadVerticalPlacement {
  const bridge = truthyOsmTag(tags.bridge) || (!!tags.bridge && tags.bridge !== "no");
  const tunnel = truthyOsmTag(tags.tunnel) || (!!tags.tunnel && tags.tunnel !== "no");
  const mappedLayer = strictLayer(tags.layer);
  let layer = mappedLayer ?? (bridge ? 1 : tunnel ? -1 : 0);
  if (bridge && tunnel && mappedLayer === null) layer = 0;
  const elevationMetres = layer * ASSUMED_LAYER_SEPARATION_METRES;
  let rationale: string;
  if (mappedLayer !== null) {
    rationale = `Mapped OSM layer ${mappedLayer} displayed at ${ASSUMED_LAYER_SEPARATION_METRES} m per layer.`;
  } else if (bridge) {
    rationale = `Bridge without a valid layer displayed at assumed layer 1 (${ASSUMED_LAYER_SEPARATION_METRES} m); ramps are not modelled.`;
  } else if (tunnel) {
    rationale = `Tunnel without a valid layer displayed at assumed layer -1 (-${ASSUMED_LAYER_SEPARATION_METRES} m); portals are not modelled.`;
  } else {
    rationale = "No mapped vertical separation; displayed at ground level.";
  }
  return { layer, elevationMetres, bridge, tunnel, rationale };
}

interface ProjectedSourcePoint extends LocalPoint {
  lon: number;
  lat: number;
}

function clipSegment(
  start: ProjectedSourcePoint,
  end: ProjectedSourcePoint,
  bounds: RoadBounds,
  origin: RoadOrigin,
): [ProjectedSourcePoint, ProjectedSourcePoint] | null {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  let t0 = 0;
  let t1 = 1;
  const tests: Array<[number, number]> = [
    [-dx, start.x - bounds.minX],
    [dx, bounds.maxX - start.x],
    [-dz, start.z - bounds.minZ],
    [dz, bounds.maxZ - start.z],
  ];
  for (const [p, q] of tests) {
    if (Math.abs(p) < EPSILON) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) t0 = Math.max(t0, ratio);
    else t1 = Math.min(t1, ratio);
    if (t0 > t1) return null;
  }

  const at = (t: number): ProjectedSourcePoint => {
    if (t < EPSILON) return { ...start };
    if (1 - t < EPSILON) return { ...end };
    const x = clamp(start.x + dx * t, bounds.minX, bounds.maxX);
    const z = clamp(start.z + dz * t, bounds.minZ, bounds.maxZ);
    const wgs = inverseProject(x, z, origin);
    return { x, z, lon: wgs.lon, lat: wgs.lat };
  };
  return [at(t0), at(t1)];
}

function sameLocalPoint(a: LocalPoint, b: LocalPoint): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.z - b.z) < EPSILON;
}

function clipPolyline(
  points: ProjectedSourcePoint[],
  bounds: RoadBounds,
  origin: RoadOrigin,
): ProjectedSourcePoint[][] {
  const pieces: ProjectedSourcePoint[][] = [];
  let active: ProjectedSourcePoint[] | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const clipped = clipSegment(points[index - 1]!, points[index]!, bounds, origin);
    if (!clipped || sameLocalPoint(clipped[0], clipped[1])) {
      active = null;
      continue;
    }
    if (active && sameLocalPoint(active[active.length - 1]!, clipped[0])) {
      if (!sameLocalPoint(active[active.length - 1]!, clipped[1])) active.push(clipped[1]);
    } else {
      active = [clipped[0], clipped[1]];
      pieces.push(active);
    }
  }
  return pieces;
}

function unitDirection(a: LocalPoint, b: LocalPoint): LocalPoint {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  return length < EPSILON ? { x: 1, z: 0 } : { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
}

function buildRibbonMesh(points: RoadPoint[], widthMetres: number, bounds: RoadBounds): RoadMesh {
  if (points.length < 2) return { vertices: [], indices: [] };
  const halfWidth = widthMetres / 2;
  const vertices: number[] = [];
  const indices: number[] = [];
  const firstDirection = unitDirection(points[0]!, points[1]!);
  const lastDirection = unitDirection(points[points.length - 2]!, points[points.length - 1]!);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const previousDirection = index === 0 ? firstDirection : unitDirection(points[index - 1]!, point);
    const nextDirection = index === points.length - 1 ? lastDirection : unitDirection(point, points[index + 1]!);
    const previousNormal = { x: -previousDirection.z, z: previousDirection.x };
    const nextNormal = { x: -nextDirection.z, z: nextDirection.x };
    let miterX = previousNormal.x + nextNormal.x;
    let miterZ = previousNormal.z + nextNormal.z;
    const miterLength = Math.hypot(miterX, miterZ);
    let offsetX: number;
    let offsetZ: number;
    if (miterLength < EPSILON) {
      offsetX = nextNormal.x * halfWidth;
      offsetZ = nextNormal.z * halfWidth;
    } else {
      miterX /= miterLength;
      miterZ /= miterLength;
      const denominator = Math.abs(miterX * nextNormal.x + miterZ * nextNormal.z);
      const scale = Math.min(halfWidth / Math.max(denominator, EPSILON), halfWidth * MITER_LIMIT);
      offsetX = miterX * scale;
      offsetZ = miterZ * scale;
    }

    let centreX = point.x;
    let centreZ = point.z;
    const onBoundary =
      Math.abs(point.x - bounds.minX) < EPSILON ||
      Math.abs(point.x - bounds.maxX) < EPSILON ||
      Math.abs(point.z - bounds.minZ) < EPSILON ||
      Math.abs(point.z - bounds.maxZ) < EPSILON;
    if (!onBoundary && index === 0) {
      centreX -= firstDirection.x * halfWidth;
      centreZ -= firstDirection.z * halfWidth;
    } else if (!onBoundary && index === points.length - 1) {
      centreX += lastDirection.x * halfWidth;
      centreZ += lastDirection.z * halfWidth;
    }

    vertices.push(
      clamp(centreX + offsetX, bounds.minX, bounds.maxX),
      point.y,
      clamp(centreZ + offsetZ, bounds.minZ, bounds.maxZ),
      clamp(centreX - offsetX, bounds.minX, bounds.maxX),
      point.y,
      clamp(centreZ - offsetZ, bounds.minZ, bounds.maxZ),
    );
    if (index > 0) {
      const previousLeft = (index - 1) * 2;
      const previousRight = previousLeft + 1;
      const left = index * 2;
      const right = left + 1;
      addUpwardTriangle(indices, vertices, previousLeft, left, previousRight);
      addUpwardTriangle(indices, vertices, previousRight, left, right);
    }
  }
  return { vertices, indices };
}

function addUpwardTriangle(
  indices: number[],
  vertices: number[],
  first: number,
  second: number,
  third: number,
): void {
  const firstOffset = first * 3;
  const secondOffset = second * 3;
  const thirdOffset = third * 3;
  const abX = vertices[secondOffset]! - vertices[firstOffset]!;
  const abZ = vertices[secondOffset + 2]! - vertices[firstOffset + 2]!;
  const acX = vertices[thirdOffset]! - vertices[firstOffset]!;
  const acZ = vertices[thirdOffset + 2]! - vertices[firstOffset + 2]!;
  const normalY = abZ * acX - abX * acZ;
  if (Math.abs(normalY) < EPSILON) return;
  if (normalY > 0) indices.push(first, second, third);
  else indices.push(first, third, second);
}

function polylineLength(points: LocalPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.z - points[index - 1]!.z,
    );
  }
  return length;
}

function representativePoint(points: RoadPoint[], origin: RoadOrigin): RoadPoint {
  const total = polylineLength(points);
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segment = Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.z - points[index - 1]!.z,
    );
    if (walked + segment >= total / 2) {
      const ratio = segment < EPSILON ? 0 : (total / 2 - walked) / segment;
      const previous = points[index - 1]!;
      const current = points[index]!;
      const x = previous.x + (current.x - previous.x) * ratio;
      const z = previous.z + (current.z - previous.z) * ratio;
      const wgs = inverseProject(x, z, origin);
      return {
        x,
        y: previous.y + (current.y - previous.y) * ratio,
        z,
        lon: wgs.lon,
        lat: wgs.lat,
      };
    }
    walked += segment;
  }
  return { ...points[points.length - 1]! };
}

function isLifecycleExcluded(highway: string, tags: Record<string, string>): boolean {
  return highway === "construction" || highway === "proposed" || !!tags.construction || !!tags.proposed;
}

function roadPieces(
  feature: GeoJsonFeature,
  featureIndex: number,
  origin: RoadOrigin,
  bounds: RoadBounds,
): { eligible: boolean; lifecycleExcluded: boolean; invalidGeometry: boolean; roads: Road[] } {
  if (!feature.geometry || feature.geometry.type !== "LineString") {
    return { eligible: false, lifecycleExcluded: false, invalidGeometry: false, roads: [] };
  }
  const tags = stringTags(feature);
  const highway = stringValue(feature.properties?.highway) ?? tags.highway ?? "";
  if (!highway) return { eligible: false, lifecycleExcluded: false, invalidGeometry: false, roads: [] };
  if (isLifecycleExcluded(highway, tags)) {
    return { eligible: false, lifecycleExcluded: true, invalidGeometry: false, roads: [] };
  }

  const rawCoordinates = feature.geometry.coordinates;
  if (!Array.isArray(rawCoordinates)) {
    return { eligible: false, lifecycleExcluded: false, invalidGeometry: true, roads: [] };
  }
  const validCoordinates = rawCoordinates.every(
    (coordinate) =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]),
  );
  if (!validCoordinates || rawCoordinates.length < 2) {
    return { eligible: false, lifecycleExcluded: false, invalidGeometry: true, roads: [] };
  }
  const sourceCoordinates: LonLat[] = (rawCoordinates as LonLat[]).map(
    ([lon, lat]) => [lon, lat],
  );
  const projectedWithDuplicates: ProjectedSourcePoint[] = sourceCoordinates.map(([lon, lat]) => ({
    ...projectLonLat(lon, lat, origin),
    lon,
    lat,
  }));
  const projected = projectedWithDuplicates.filter(
    (point, index) => index === 0 || !sameLocalPoint(point, projectedWithDuplicates[index - 1]!),
  );
  if (projected.length < 2) {
    return { eligible: false, lifecycleExcluded: false, invalidGeometry: true, roads: [] };
  }
  const clippedPieces = clipPolyline(projected, bounds, origin);
  const sourceFeatureId = String(feature.id ?? `feature-${featureIndex}`);
  const rawOsmId = feature.properties?.osm_id;
  const osmId =
    typeof rawOsmId === "string" ||
    (typeof rawOsmId === "number" && Number.isFinite(rawOsmId))
      ? rawOsmId
      : null;
  const width = resolveRoadWidth(highway, tags);
  const vertical = resolveVerticalPlacement(tags);
  const name = stringValue(feature.properties?.name) ?? tags.name ?? null;

  const roads = clippedPieces.map((piece, pieceIndex): Road => {
    const points = piece.map((point): RoadPoint => ({
      ...point,
      y: vertical.elevationMetres,
    }));
    const id = clippedPieces.length === 1 ? sourceFeatureId : `${sourceFeatureId}#${pieceIndex + 1}`;
    return {
      id,
      sourceFeatureId,
      osmId,
      name,
      highway,
      tags,
      sourceCoordinates,
      points,
      representative: representativePoint(points, origin),
      width,
      vertical,
      mesh: buildRibbonMesh(points, width.metres, bounds),
    };
  });
  return { eligible: true, lifecycleExcluded: false, invalidGeometry: false, roads };
}

function sourceProjectionMetadata(source: GeoJsonFeatureCollection): {
  snapshotSha256: string | null;
  validated: boolean;
} {
  const metadata = source.metadata;
  if (!metadata) return { snapshotSha256: null, validated: false };
  const projection = metadata.projection;
  if (!projection || typeof projection !== "object" || Array.isArray(projection)) {
    throw new TypeError("Road source metadata is missing its projection record.");
  }
  const record = projection as Record<string, unknown>;
  const origin = record.origin_wgs84;
  const radius = record.earth_radius_m;
  if (
    !Array.isArray(origin) ||
    origin.length < 2 ||
    origin[0] !== DEFAULT_ROAD_ORIGIN.lon ||
    origin[1] !== DEFAULT_ROAD_ORIGIN.lat ||
    radius !== EARTH_RADIUS_METRES
  ) {
    throw new RangeError("Road source projection metadata does not match the fixed runtime projection.");
  }
  return {
    snapshotSha256: stringValue(metadata.source_snapshot_sha256) ?? null,
    validated: true,
  };
}

export function buildRoadSlice(
  source: GeoJsonFeatureCollection,
  options: BuildRoadSliceOptions = {},
): RoadSlice {
  if (!source || source.type !== "FeatureCollection" || !Array.isArray(source.features)) {
    throw new TypeError("Road source must be a GeoJSON FeatureCollection.");
  }
  const sourceProjection = sourceProjectionMetadata(source);
  const origin = options.origin ?? DEFAULT_ROAD_ORIGIN;
  const halfExtentMetres = options.halfExtentMetres ?? DEFAULT_HALF_EXTENT_METRES;
  if (!Number.isFinite(halfExtentMetres) || halfExtentMetres <= 0) {
    throw new RangeError("halfExtentMetres must be a positive finite number.");
  }
  const bounds: RoadBounds = {
    minX: -halfExtentMetres,
    maxX: halfExtentMetres,
    minZ: -halfExtentMetres,
    maxZ: halfExtentMetres,
  };

  const roads: Road[] = [];
  const widthSourceCounts = { width: 0, lanes: 0, "class-fallback": 0 };
  let eligibleSourceWayCount = 0;
  let excludedNonRoadFeatureCount = 0;
  let excludedLifecycleWayCount = 0;
  let excludedInvalidGeometryCount = 0;
  let intersectingSourceWayCount = 0;
  for (let index = 0; index < source.features.length; index += 1) {
    const result = roadPieces(source.features[index]!, index, origin, bounds);
    if (result.eligible) eligibleSourceWayCount += 1;
    if (!result.eligible && !result.lifecycleExcluded && !result.invalidGeometry) {
      excludedNonRoadFeatureCount += 1;
    }
    if (result.lifecycleExcluded) excludedLifecycleWayCount += 1;
    if (result.invalidGeometry) excludedInvalidGeometryCount += 1;
    if (result.roads.length > 0) {
      intersectingSourceWayCount += 1;
      widthSourceCounts[result.roads[0]!.width.source] += 1;
    }
    roads.push(...result.roads);
  }

  let clippedCentrelineLengthMetres = 0;
  let elevatedRoadCount = 0;
  for (const road of roads) {
    clippedCentrelineLengthMetres += polylineLength(road.points);
    if (road.vertical.elevationMetres !== 0) elevatedRoadCount += 1;
  }

  return {
    origin: { ...origin },
    bounds,
    roads,
    summary: {
      sourceFeatureCount: source.features.length,
      eligibleSourceWayCount,
      excludedNonRoadFeatureCount,
      excludedLifecycleWayCount,
      excludedInvalidGeometryCount,
      intersectingSourceWayCount,
      roadCount: roads.length,
      clippedCentrelineLengthMetres,
      widthSourceCounts,
      elevatedRoadCount,
      sourceSnapshotSha256: sourceProjection.snapshotSha256,
      sourceProjectionValidated: sourceProjection.validated,
    },
  };
}
