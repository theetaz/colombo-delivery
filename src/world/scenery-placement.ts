import type { LocalPoint, Road, RoadPoint, RoadSlice } from "./types";

export const FEATURE_ROAD_ID = "way/13884292";
export const DRESSED_START_METRES = 48;
export const DRESSED_END_METRES = 298;

export type SceneryAssetName =
  | "Shop_Ochre"
  | "Shop_CreamTeal"
  | "BoundaryWall_Gate"
  | "ShadeTree"
  | "PalmTree"
  | "UtilityPole_Lamp"
  | "PottedPlant_A"
  | "PottedPlant_B"
  | "TukTuk_Parked"
  | "LotusTower";

export interface SceneryPlacement {
  asset: SceneryAssetName;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  metresAlongRoad: number;
  side: -1 | 1;
}

interface PlacementRecipe {
  asset: SceneryAssetName;
  distance: number;
  side: -1 | 1;
  depth: number;
  width: number;
  gap: number;
  scale?: number;
}

const RECIPES: readonly PlacementRecipe[] = [
  { asset: "PalmTree", distance: 50, side: -1, width: 6, depth: 6, gap: 3 },
  { asset: "Shop_CreamTeal", distance: 61, side: -1, width: 7.5, depth: 5.9, gap: 3.4, scale: 0.9 },
  { asset: "Shop_Ochre", distance: 72, side: 1, width: 7.5, depth: 5.9, gap: 3.2 },
  { asset: "PottedPlant_A", distance: 80, side: 1, width: 1.4, depth: 1.4, gap: 2.8 },
  { asset: "Shop_CreamTeal", distance: 89, side: 1, width: 7.5, depth: 5.9, gap: 3.2, scale: 0.92 },
  { asset: "UtilityPole_Lamp", distance: 96, side: -1, width: 2.2, depth: 1.8, gap: 3.1 },
  { asset: "Shop_Ochre", distance: 102, side: -1, width: 7.5, depth: 5.9, gap: 3.4, scale: 0.92 },
  { asset: "ShadeTree", distance: 115, side: -1, width: 7, depth: 6, gap: 4 },
  { asset: "Shop_Ochre", distance: 116, side: 1, width: 7.5, depth: 5.9, gap: 3.2, scale: 0.96 },
  { asset: "BoundaryWall_Gate", distance: 128, side: 1, width: 8.6, depth: 0.7, gap: 5.5 },
  { asset: "Shop_CreamTeal", distance: 139, side: -1, width: 7.5, depth: 5.9, gap: 3.4, scale: 0.94 },
  { asset: "Shop_CreamTeal", distance: 151, side: 1, width: 7.5, depth: 5.9, gap: 3.2 },
  { asset: "PottedPlant_B", distance: 158, side: 1, width: 1.4, depth: 1.4, gap: 2.8 },
  { asset: "Shop_Ochre", distance: 169, side: 1, width: 7.5, depth: 5.9, gap: 3.3 },
  { asset: "PalmTree", distance: 175, side: -1, width: 6, depth: 6, gap: 3.5, scale: 0.9 },
  { asset: "UtilityPole_Lamp", distance: 198, side: 1, width: 2.2, depth: 1.8, gap: 3.1 },
  { asset: "Shop_CreamTeal", distance: 198, side: -1, width: 7.5, depth: 5.9, gap: 3.4, scale: 0.9 },
  { asset: "ShadeTree", distance: 216, side: -1, width: 7, depth: 6, gap: 4.3, scale: 0.92 },
  { asset: "BoundaryWall_Gate", distance: 228, side: -1, width: 8.6, depth: 0.7, gap: 5.5 },
  { asset: "Shop_Ochre", distance: 241, side: 1, width: 7.5, depth: 5.9, gap: 3.2, scale: 0.94 },
  { asset: "PottedPlant_A", distance: 248, side: 1, width: 1.4, depth: 1.4, gap: 2.8 },
  { asset: "Shop_CreamTeal", distance: 258, side: 1, width: 7.5, depth: 5.9, gap: 3.3 },
  { asset: "PalmTree", distance: 266, side: -1, width: 6, depth: 6, gap: 3.5 },
  { asset: "BoundaryWall_Gate", distance: 287, side: 1, width: 8.6, depth: 0.7, gap: 5.5 },
  { asset: "TukTuk_Parked", distance: 296, side: -1, width: 1.6, depth: 2.9, gap: 3.5 },
  // A second, staggered frontage line makes the playable street feel inhabited
  // from either direction. Every piece still passes the all-roads clearance test.
  { asset: "Shop_Ochre", distance: 52, side: 1, width: 7.5, depth: 5.9, gap: 3.3, scale: 0.9 },
  { asset: "PottedPlant_B", distance: 57, side: 1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "BoundaryWall_Gate", distance: 67, side: -1, width: 8.6, depth: 0.7, gap: 5.2 },
  { asset: "ShadeTree", distance: 76, side: -1, width: 7, depth: 6, gap: 4.1, scale: 0.86 },
  { asset: "PottedPlant_A", distance: 85, side: -1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "Shop_CreamTeal", distance: 96, side: 1, width: 7.5, depth: 5.9, gap: 3.2, scale: 0.88 },
  { asset: "PottedPlant_B", distance: 108, side: 1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "PalmTree", distance: 109, side: -1, width: 6, depth: 6, gap: 3.8, scale: 0.84 },
  { asset: "Shop_CreamTeal", distance: 122, side: -1, width: 7.5, depth: 5.9, gap: 3.3, scale: 0.9 },
  { asset: "UtilityPole_Lamp", distance: 128, side: 1, width: 2.2, depth: 1.8, gap: 3 },
  { asset: "PottedPlant_A", distance: 133, side: 1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "Shop_Ochre", distance: 145, side: 1, width: 7.5, depth: 5.9, gap: 3.3, scale: 0.9 },
  { asset: "ShadeTree", distance: 151, side: -1, width: 7, depth: 6, gap: 4.1, scale: 0.82 },
  { asset: "BoundaryWall_Gate", distance: 162, side: -1, width: 8.6, depth: 0.7, gap: 5.2 },
  { asset: "PottedPlant_B", distance: 174, side: 1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "Shop_Ochre", distance: 181, side: -1, width: 7.5, depth: 5.9, gap: 3.3, scale: 0.88 },
  { asset: "UtilityPole_Lamp", distance: 185, side: -1, width: 2.2, depth: 1.8, gap: 3 },
  { asset: "Shop_CreamTeal", distance: 191, side: 1, width: 7.5, depth: 5.9, gap: 3.2, scale: 0.92 },
  { asset: "PottedPlant_A", distance: 205, side: 1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "Shop_Ochre", distance: 211, side: 1, width: 7.5, depth: 5.9, gap: 3.3, scale: 0.9 },
  { asset: "PalmTree", distance: 222, side: 1, width: 6, depth: 6, gap: 3.8, scale: 0.84 },
  { asset: "Shop_CreamTeal", distance: 231, side: 1, width: 7.5, depth: 5.9, gap: 3.2, scale: 0.9 },
  { asset: "PottedPlant_B", distance: 236, side: -1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "ShadeTree", distance: 245, side: -1, width: 7, depth: 6, gap: 4.2, scale: 0.84 },
  { asset: "UtilityPole_Lamp", distance: 254, side: 1, width: 2.2, depth: 1.8, gap: 3 },
  { asset: "Shop_Ochre", distance: 270, side: 1, width: 7.5, depth: 5.9, gap: 3.3, scale: 0.9 },
  { asset: "PottedPlant_A", distance: 277, side: -1, width: 1.4, depth: 1.4, gap: 2.7 },
  { asset: "Shop_CreamTeal", distance: 282, side: -1, width: 7.5, depth: 5.9, gap: 3.3, scale: 0.88 },
  { asset: "PalmTree", distance: 292, side: 1, width: 6, depth: 6, gap: 3.8, scale: 0.8 },
  { asset: "ShadeTree", distance: 56, side: -1, width: 7, depth: 6, gap: 5.4, scale: 0.9 },
  { asset: "ShadeTree", distance: 69, side: 1, width: 7, depth: 6, gap: 5.4, scale: 0.82 },
  { asset: "PalmTree", distance: 83, side: -1, width: 6, depth: 6, gap: 5, scale: 0.88 },
  { asset: "ShadeTree", distance: 98, side: 1, width: 7, depth: 6, gap: 5.6, scale: 0.86 },
  { asset: "ShadeTree", distance: 112, side: -1, width: 7, depth: 6, gap: 5.4, scale: 0.9 },
  { asset: "PalmTree", distance: 126, side: 1, width: 6, depth: 6, gap: 5.2, scale: 0.84 },
  { asset: "ShadeTree", distance: 141, side: -1, width: 7, depth: 6, gap: 5.6, scale: 0.88 },
  { asset: "ShadeTree", distance: 155, side: 1, width: 7, depth: 6, gap: 5.4, scale: 0.82 },
  { asset: "PalmTree", distance: 168, side: -1, width: 6, depth: 6, gap: 5.2, scale: 0.9 },
  { asset: "ShadeTree", distance: 183, side: 1, width: 7, depth: 6, gap: 5.5, scale: 0.88 },
  { asset: "ShadeTree", distance: 197, side: -1, width: 7, depth: 6, gap: 5.4, scale: 0.84 },
  { asset: "PalmTree", distance: 210, side: 1, width: 6, depth: 6, gap: 5.2, scale: 0.86 },
  { asset: "ShadeTree", distance: 224, side: -1, width: 7, depth: 6, gap: 5.6, scale: 0.9 },
  { asset: "ShadeTree", distance: 238, side: 1, width: 7, depth: 6, gap: 5.4, scale: 0.82 },
  { asset: "PalmTree", distance: 251, side: -1, width: 6, depth: 6, gap: 5.2, scale: 0.88 },
  { asset: "ShadeTree", distance: 264, side: 1, width: 7, depth: 6, gap: 5.5, scale: 0.86 },
  { asset: "ShadeTree", distance: 277, side: -1, width: 7, depth: 6, gap: 5.4, scale: 0.9 },
  { asset: "PalmTree", distance: 289, side: 1, width: 6, depth: 6, gap: 5.2, scale: 0.84 },
];

const ACTUAL_FOOTPRINTS: Readonly<Record<SceneryAssetName, { width: number; depth: number }>> = {
  Shop_Ochre: { width: 7.75, depth: 6.0187 },
  Shop_CreamTeal: { width: 7.8049, depth: 5.9836 },
  BoundaryWall_Gate: { width: 8.8276, depth: 1.3552 },
  ShadeTree: { width: 7.6911, depth: 5.0499 },
  PalmTree: { width: 5.8827, depth: 5.8458 },
  UtilityPole_Lamp: { width: 2.2, depth: 1.5837 },
  PottedPlant_A: { width: 1.4401, depth: 1.2669 },
  PottedPlant_B: { width: 1.4401, depth: 1.2669 },
  TukTuk_Parked: { width: 1.86, depth: 2.7975 },
  LotusTower: { width: 45.9494, depth: 45.9494 },
};

export function getFeatureRoad(roadSlice: RoadSlice): Road | null {
  return roadSlice.roads.find((road) => road.sourceFeatureId === FEATURE_ROAD_ID) ?? null;
}

export function sampleRoad(road: Road, metresAlongRoad: number): { point: LocalPoint & { y: number }; tangentX: number; tangentZ: number } {
  let remaining = Math.max(0, metresAlongRoad);
  for (let index = 0; index < road.points.length - 1; index += 1) {
    const start = road.points[index]!;
    const end = road.points[index + 1]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (remaining <= length || index === road.points.length - 2) {
      const t = length > 0 ? Math.min(remaining / length, 1) : 0;
      return {
        point: { x: start.x + dx * t, y: start.y + (end.y - start.y) * t, z: start.z + dz * t },
        tangentX: length > 0 ? dx / length : 0,
        tangentZ: length > 0 ? dz / length : 1,
      };
    }
    remaining -= length;
  }
  const point = road.points.at(-1)!;
  return { point, tangentX: 0, tangentZ: 1 };
}

/** Decorative-only placements derived from the saved road centreline; no real buildings are implied. */
export function createSceneryPlacements(roadSlice: RoadSlice): SceneryPlacement[] {
  const road = getFeatureRoad(roadSlice);
  if (!road) return [];
  const placements: SceneryPlacement[] = [];
  for (const recipe of RECIPES) {
    const sample = sampleRoad(road, recipe.distance);
    const sides: readonly (-1 | 1)[] = [recipe.side, recipe.side === 1 ? -1 : 1];
    const footprint = ACTUAL_FOOTPRINTS[recipe.asset];
    let accepted: SceneryPlacement | null = null;
    for (const side of sides) {
      const normalX = -sample.tangentZ * side;
      const normalZ = sample.tangentX * side;
      for (let extraSetback = 0; extraSetback <= 30; extraSetback += 3) {
        const setback = road.width.metres / 2 + footprint.depth * (recipe.scale ?? 1) / 2 + recipe.gap + extraSetback;
        const placement: SceneryPlacement = {
          asset: recipe.asset,
          x: sample.point.x + normalX * setback,
          y: sample.point.y,
          z: sample.point.z + normalZ * setback,
          rotationY: Math.atan2(-normalX, -normalZ),
          scale: recipe.scale ?? 1,
          metresAlongRoad: recipe.distance,
          side,
        };
        if (clearsEveryGroundRoad(placement, recipe, roadSlice.roads) && clearsPlacedScenery(placement, placements)) {
          accepted = placement;
          break;
        }
      }
      if (accepted) break;
    }
    if (accepted) placements.push(accepted);
  }
  return placements;
}

function clearsPlacedScenery(candidate: SceneryPlacement, placements: SceneryPlacement[]): boolean {
  const candidateFootprint = ACTUAL_FOOTPRINTS[candidate.asset];
  const candidateRadius = sceneryBaseRadius(candidate.asset, candidateFootprint, candidate.scale);
  return placements.every((placed) => {
    const footprint = ACTUAL_FOOTPRINTS[placed.asset];
    const radius = sceneryBaseRadius(placed.asset, footprint, placed.scale);
    return Math.hypot(candidate.x - placed.x, candidate.z - placed.z) >= candidateRadius + radius + 0.45;
  });
}

function sceneryBaseRadius(asset: SceneryAssetName, footprint: { width: number; depth: number }, scale: number): number {
  if (asset === "ShadeTree" || asset === "PalmTree") return 0.8 * scale;
  if (asset === "PottedPlant_A" || asset === "PottedPlant_B") return 0.3 * scale;
  return Math.hypot(footprint.width, footprint.depth) * scale * 0.45;
}

function clearsEveryGroundRoad(placement: SceneryPlacement, recipe: PlacementRecipe, roads: Road[]): boolean {
  const scale = recipe.scale ?? 1;
  const footprint = ACTUAL_FOOTPRINTS[recipe.asset];
  const halfWidth = footprint.width * scale * 0.5;
  const halfDepth = footprint.depth * scale * 0.5;
  const cos = Math.cos(placement.rotationY);
  const sin = Math.sin(placement.rotationY);
  const samples: Array<{ x: number; z: number }> = [];
  for (let xStep = -2; xStep <= 2; xStep += 1) {
    for (let zStep = -2; zStep <= 2; zStep += 1) {
      const localX = halfWidth * xStep / 2;
      const localZ = halfDepth * zStep / 2;
      samples.push({
        x: placement.x + localX * cos + localZ * sin,
        z: placement.z - localX * sin + localZ * cos,
      });
    }
  }
  for (const road of roads) {
    if (road.vertical.elevationMetres !== 0 || road.highway === "steps") continue;
    const clearance = road.width.metres / 2 + 0.65;
    for (let index = 0; index < road.points.length - 1; index += 1) {
      if (samples.some((sample) => pointToSegmentDistance(sample.x, sample.z, road.points[index]!, road.points[index + 1]!) < clearance)) return false;
    }
  }
  return true;
}

function pointToSegmentDistance(x: number, z: number, start: RoadPoint, end: RoadPoint): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared)) : 0;
  return Math.hypot(x - (start.x + dx * t), z - (start.z + dz * t));
}
