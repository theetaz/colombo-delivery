export const WIND_PRESETS = {
  Calm: { strength: 0, speed: 0 },
  Breeze: { strength: 0.55, speed: 0.72 },
  Strong: { strength: 1, speed: 1.18 },
};
export function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}
export function dimensions(bounds) {
  if (!bounds?.min || !bounds?.max) return null;
  return bounds.max.map((value, index) =>
    Math.max(0, value - bounds.min[index]),
  );
}
export function perspectiveFitDistance(
  width,
  height,
  verticalFovRadians,
  aspect,
  padding = 1.15,
) {
  const halfVertical = Math.tan(verticalFovRadians / 2);
  const halfHorizontal = halfVertical * Math.max(aspect, 0.01);
  return (
    Math.max(height / (2 * halfVertical), width / (2 * halfHorizontal)) *
    padding
  );
}
export function validateVegetationManifest(manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length !== 5
  )
    return false;
  const ids = new Set();
  return manifest.assets.every((asset) => {
    if (
      !asset.id ||
      ids.has(asset.id) ||
      !asset.url ||
      !asset.lod1Url ||
      !asset.blendUrl ||
      !dimensions(asset.bounds)
    )
      return false;
    ids.add(asset.id);
    return (
      asset.wind?.attribute === "COLOR_0" &&
      asset.wind?.channels?.r === "bend" &&
      asset.wind?.channels?.g === "flutter" &&
      asset.wind?.channels?.b === "phase" &&
      asset.wind?.rootLocked === true
    );
  });
}
