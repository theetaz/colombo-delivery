export type LonLat = readonly [longitude: number, latitude: number];

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: LonLat[];
}

export interface GeoJsonFeature {
  type: "Feature";
  id?: string | number;
  geometry: { type: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
  metadata?: Record<string, unknown>;
}

export interface RoadOrigin {
  lon: number;
  lat: number;
}

export interface LocalPoint {
  x: number;
  z: number;
}

export interface RoadPoint extends LocalPoint {
  y: number;
  lon: number;
  lat: number;
}

export interface RoadBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type RoadWidthSource = "width" | "lanes" | "class-fallback";

export interface RoadWidth {
  metres: number;
  source: RoadWidthSource;
  rationale: string;
  rawWidth?: string;
  rawLanes?: string;
}

export interface RoadVerticalPlacement {
  layer: number;
  elevationMetres: number;
  bridge: boolean;
  tunnel: boolean;
  rationale: string;
}

export interface RoadMesh {
  /** Flat x, y, z vertex triples. */
  vertices: number[];
  /** Triangle indices into vertices. */
  indices: number[];
}

export type RoadRepresentativePoint = RoadPoint;

export interface Road {
  /** Stable render-piece identity. A clipped way can produce more than one piece. */
  id: string;
  sourceFeatureId: string;
  osmId: string | number | null;
  name: string | null;
  highway: string;
  tags: Record<string, string>;
  /** Complete, unclipped WGS84 source geometry. */
  sourceCoordinates: LonLat[];
  /** Clipped centreline in local metres and WGS84. */
  points: RoadPoint[];
  representative: RoadRepresentativePoint;
  width: RoadWidth;
  vertical: RoadVerticalPlacement;
  mesh: RoadMesh;
}

export interface RoadSliceSummary {
  sourceFeatureCount: number;
  eligibleSourceWayCount: number;
  excludedNonRoadFeatureCount: number;
  excludedLifecycleWayCount: number;
  excludedInvalidGeometryCount: number;
  intersectingSourceWayCount: number;
  roadCount: number;
  clippedCentrelineLengthMetres: number;
  /** Counts intersecting source ways; clipped render pieces are counted by roadCount. */
  widthSourceCounts: Record<RoadWidthSource, number>;
  elevatedRoadCount: number;
  sourceSnapshotSha256: string | null;
  sourceProjectionValidated: boolean;
}

export interface RoadSlice {
  origin: RoadOrigin;
  bounds: RoadBounds;
  roads: Road[];
  summary: RoadSliceSummary;
}

export interface BuildRoadSliceOptions {
  origin?: RoadOrigin;
  halfExtentMetres?: number;
}
