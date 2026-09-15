export const STREET = {
  xMin: -95,
  xMax: 95,
  roadZMin: -4,
  roadZMax: 4,
  northWalk: [-6.7, -4.3],
  southWalk: [4.3, 6.7],
};

export const buildingPlacements = [
  { id: "building:market:west", assetId: "environment.neighborhood-market-01", position: [-78, 0, 0], side: "north", yaw: 0, zone: "Shops" },
  { id: "building:cafe:west", assetId: "environment.corner-cafe-01", position: [-62, 0, 0], side: "north", yaw: 0, zone: "Shops" },
  { id: "building:market:central", assetId: "environment.neighborhood-market-01", position: [-46, 0, 0], side: "north", yaw: 0, zone: "Shops" },
  { id: "building:cafe:central", assetId: "environment.corner-cafe-01", position: [-30, 0, 0], side: "north", yaw: 0, zone: "Shops" },
  { id: "building:apartments:north", assetId: "environment.courtyard-apartments-01", position: [-11, 0, 0], side: "north", yaw: 0, zone: "Shops" },
  { id: "building:market:east", assetId: "environment.neighborhood-market-01", position: [10, 0, 0], side: "north", yaw: 0, zone: "Shops" },
  { id: "building:verandah:west", assetId: "environment.verandah-house-01", position: [-78, 0, 0], side: "south", yaw: Math.PI, zone: "Garden" },
  { id: "building:apartments:west", assetId: "environment.courtyard-apartments-01", position: [-55, 0, 0], side: "south", yaw: Math.PI, zone: "Garden" },
  { id: "building:verandah:central", assetId: "environment.verandah-house-01", position: [-32, 0, 0], side: "south", yaw: Math.PI, zone: "Garden" },
  { id: "building:cafe:garden", assetId: "environment.corner-cafe-01", position: [-14, 0, 0], side: "south", yaw: Math.PI, zone: "Garden" },
  { id: "building:apartments:east", assetId: "environment.courtyard-apartments-01", position: [8, 0, 0], side: "south", yaw: Math.PI, zone: "Garden" },
  { id: "building:verandah:east", assetId: "environment.verandah-house-01", position: [30, 0, 0], side: "south", yaw: Math.PI, zone: "Garden" },
];

export const treePlacements = [
  ["rain-tree-01", "vegetation.rain-tree-01", -91, 17, .72],
  ["round-tree-01", "vegetation.round-tree-01", -68, 20, .82],
  ["palm-01", "vegetation.coconut-palm-01", -43, 21, .72],
  ["rain-tree-02", "vegetation.rain-tree-01", -21, 20, .66],
  ["round-tree-02", "vegetation.round-tree-01", 2, 22, .78],
  ["palm-02", "vegetation.coconut-palm-01", 22, 21, .68],
  ["rain-tree-03", "vegetation.rain-tree-01", 43, 17, .7],
  ["round-tree-03", "vegetation.round-tree-01", 64, 16, .82],
  ["palm-03", "vegetation.coconut-palm-01", 86, 17, .72],
  ["round-tree-lake-01", "vegetation.round-tree-01", 29, -8.6, .62],
  ["palm-lake-01", "vegetation.coconut-palm-01", 45, -9, .58],
  ["rain-tree-lake-01", "vegetation.rain-tree-01", 62, -8.8, .55],
  ["palm-lake-02", "vegetation.coconut-palm-01", 78, -9, .62],
  ["round-tree-lake-02", "vegetation.round-tree-01", 92, -8.7, .58],
].map(([id, assetId, x, z, scale], index) => ({ id: `tree:${id}`, assetId, position: [x, z < 0 ? .155 : 0, z], scale, yaw: index * .71 }));

const grassPositions = [-89, -81, -70, -59, -48, -37, -26, -15, -4, 8, 20, 34, 48, 61, 74, 88];
export const understoryPlacements = [
  ...grassPositions.map((x, index) => ({
    id: `understory:grass:${index + 1}`,
    assetId: index % 3 ? "vegetation.short-grass-01" : "vegetation.tall-grass-01",
    position: [x, 0, 7.25 + (index % 2) * .45],
    scale: .72 + (index % 4) * .08,
    yaw: index * 1.17,
  })),
  ...[-88, -68, -42, -22, 18, 39, 58, 81].map((x, index) => ({
    id: `understory:hibiscus:${index + 1}`,
    assetId: "environment.hibiscus-shrub-01",
    position: [x, x > 24 ? .155 : 0, x > 24 ? -8.35 : 8.1],
    scale: .72 + (index % 3) * .1,
    yaw: index * .83,
  })),
];

export const propPlacements = {
  lamps: [-86, -62, -38, -14, 10, 34, 58, 82].map((x, index) => ({ id: `prop:lamp:${index + 1}`, position: [x, .155, index < 5 ? 6.25 : -8.6], yaw: index < 5 ? Math.PI : 0 })),
  benches: [43, 69, 88].map((x, index) => ({ id: `prop:bench:${index + 1}`, position: [x, .155, -8.15], yaw: Math.PI })),
};

export const addresses = [
  { id: "address:lake-garden-market", label: "Lake Garden Market", role: "pickup", buildingId: "building:market:west", approach: [-78, .17, -5.55] },
  { id: "address:corner-cafe", label: "Corner Café", role: "pickup", buildingId: "building:cafe:central", approach: [-30, .17, -5.55] },
  { id: "address:verandah-12", label: "12 Verandah Lane", role: "dropoff", buildingId: "building:verandah:west", approach: [-78, .17, 5.55] },
  { id: "address:courtyard-8", label: "Courtyard 8", role: "dropoff", buildingId: "building:apartments:east", approach: [8, .17, 5.55] },
];

export const cameraPresets = {
  Garden: { position: [-88, 4.2, 2], target: [-58, 2.8, 10] },
  Shops: { position: [-76, 3.6, 2], target: [-43, 2.6, -10] },
  Lakeside: { position: [31, 4.8, 4], target: [65, 2.5, -9] },
  Overview: { position: [0, 72, 92], target: [0, 0, 0] },
};

export const expectedAssetIds = [
  "environment.neighborhood-market-01",
  "environment.corner-cafe-01",
  "environment.verandah-house-01",
  "environment.courtyard-apartments-01",
  "environment.hibiscus-shrub-01",
];
