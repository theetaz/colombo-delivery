import { addresses, buildingPlacements, expectedAssetIds, STREET, treePlacements, understoryPlacements } from "./layout.js";

export const PHASES = {
  Sunny: { background: 0xbfd4d8, fog: 0xbfd4d8, sun: 3.2, hemi: 1.35, exposure: 1.04, lights: false },
  Dusk: { background: 0x74818f, fog: 0x74818f, sun: 1.15, hemi: .68, exposure: .92, lights: true },
  Night: { background: 0x101827, fog: 0x101827, sun: .08, hemi: .25, exposure: .76, lights: true },
};

export function validateEnvironmentManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets)) return false;
  const ids = new Set(manifest.assets.map((asset) => asset.id));
  return expectedAssetIds.every((id) => ids.has(id)) && manifest.assets.every((asset) =>
    asset.url && asset.lod1Url && asset.blendUrl && asset.bounds?.min?.length === 3 && asset.bounds?.max?.length === 3 && asset.coordinateSystem?.glbUp === "Y"
  );
}

export function placementIds() {
  return [...buildingPlacements, ...treePlacements, ...understoryPlacements].map((item) => item.id);
}

export function resolveBuildingPlacement(placement, asset, frontSetback = 1) {
  const front = asset.anchors?.front?.position?.[2] ?? asset.bounds.max[2];
  const frontLine = placement.side === "north" ? STREET.northWalk[0] - frontSetback : STREET.southWalk[1] + frontSetback;
  return { ...placement, position: [placement.position[0], placement.position[1], placement.side === "north" ? frontLine - front : frontLine + front] };
}

export function validateSpatialLayout(environmentManifest, vegetationManifest) {
  const assets = new Map([...environmentManifest.assets, ...vegetationManifest.assets].map((asset) => [asset.id, asset]));
  const errors = [], rectangles = [];
  for (const placement of buildingPlacements) {
    const asset = assets.get(placement.assetId);
    if (!asset) { errors.push(`${placement.id} has no asset record`); continue; }
    const resolved = resolveBuildingPlacement(placement, asset);
    const width = asset.width / 2, depth = asset.depth / 2;
    const rectangle = { id: placement.id, minX: resolved.position[0] - width, maxX: resolved.position[0] + width, minZ: resolved.position[2] - depth, maxZ: resolved.position[2] + depth };
    if (rectangle.minZ < STREET.roadZMax && rectangle.maxZ > STREET.roadZMin) errors.push(`${placement.id} overlaps the road`);
    if (rectangle.minZ < STREET.northWalk[1] && rectangle.maxZ > STREET.northWalk[0]) errors.push(`${placement.id} overlaps the north pavement`);
    if (rectangle.minZ < STREET.southWalk[1] && rectangle.maxZ > STREET.southWalk[0]) errors.push(`${placement.id} overlaps the south pavement`);
    rectangles.push(rectangle);
  }
  for (let a = 0; a < rectangles.length; a++) for (let b = a + 1; b < rectangles.length; b++) {
    const one = rectangles[a], two = rectangles[b];
    if (one.minX < two.maxX && one.maxX > two.minX && one.minZ < two.maxZ && one.maxZ > two.minZ) errors.push(`${one.id} overlaps ${two.id}`);
  }
  for (const placement of treePlacements) {
    const [x,,z] = placement.position;
    if (rectangles.some((box) => x > box.minX - .8 && x < box.maxX + .8 && z > box.minZ - .8 && z < box.maxZ + .8)) errors.push(`${placement.id} trunk lacks building clearance`);
    if (addresses.some((address) => Math.hypot(x - address.approach[0], z - address.approach[2]) < 2)) errors.push(`${placement.id} blocks an interaction approach`);
  }
  return errors;
}

export function validateLayout() {
  const ids = placementIds();
  const errors = [];
  if (ids.length !== new Set(ids).size) errors.push("placement IDs must be unique");
  for (const item of [...treePlacements, ...understoryPlacements]) {
    const [x,,z] = item.position;
    if (x < STREET.xMin || x > STREET.xMax) errors.push(`${item.id} lies outside the corridor`);
    if (z >= STREET.roadZMin && z <= STREET.roadZMax) errors.push(`${item.id} overlaps the road`);
    if ((z >= STREET.northWalk[0] && z <= STREET.northWalk[1]) || (z >= STREET.southWalk[0] && z <= STREET.southWalk[1])) errors.push(`${item.id} overlaps a pavement`);
  }
  const buildings = new Set(buildingPlacements.map((item) => item.id));
  for (const address of addresses) if (!buildings.has(address.buildingId)) errors.push(`${address.id} has no building`);
  return errors;
}

export function dayPhase(name) { return PHASES[name] || PHASES.Sunny; }

export function distanceForLod(cameraPosition, placement, threshold = 46) {
  const dx = cameraPosition.x - placement.position[0];
  const dz = cameraPosition.z - placement.position[2];
  return Math.hypot(dx, dz) > threshold ? 1 : 0;
}
