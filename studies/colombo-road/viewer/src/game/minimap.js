const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const MAP_BOUNDS = { minX: -95, maxX: 95, minZ: -25, maxZ: 25 };

export function mapPoint(position, bounds = MAP_BOUNDS) {
  const x = Array.isArray(position) ? position[0] : position?.x;
  const z = Array.isArray(position) ? position[2] : position?.z;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return {
    left: clamp((x - bounds.minX) / (bounds.maxX - bounds.minX) * 100, 0, 100),
    top: clamp((z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * 100, 0, 100),
  };
}

export function minimapEntities(view) {
  const movement = view?.movement;
  const ridingPosition = movement && !["foot", "approach"].includes(movement.mode) ? movement.bike : movement?.player;
  const entries = [
    ["player", view?.player || ridingPosition],
    ["bike", view?.bike || movement?.bike],
    ["target", view?.target?.approach || view?.target],
    ...((view?.traffic || []).map((position, index) => [`traffic-${index + 1}`, position])),
  ];
  return entries.map(([id, value]) => ({ id, kind: id.split("-")[0], point: mapPoint(value?.position || value), yaw: value?.yaw ?? (Number.isFinite(value?.direction) ? -value.direction * Math.PI / 2 : 0) })).filter((item) => item.point);
}
