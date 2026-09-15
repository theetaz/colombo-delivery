import { createMovement, interact, localPoint, stepMovement } from "../cyclist/movement-model.js";
export const STREET_BOUNDS = { minX: -93, maxX: 93, rideMinZ: -3.25, rideMaxZ: 3.25, walkMinZ: -6.35, walkMaxZ: 6.35 };
export function streetClearAt(point, radius = .34) { const zLimit = radius >= 1 ? STREET_BOUNDS.rideMaxZ : STREET_BOUNDS.walkMaxZ; return point.x > STREET_BOUNDS.minX + radius && point.x < STREET_BOUNDS.maxX - radius && point.z > -zLimit + radius && point.z < zLimit - radius; }
export function createStreetMovement() { const state = createMovement({ clearAt: streetClearAt }); Object.assign(state.bike, { x: -86.8, z: -2, yaw: -Math.PI / 2 }); Object.assign(state.player, localPoint(state.bike, -1.5, .75), { yaw: state.bike.yaw }); return state; }
export function interactStreet(state, blocked = false) { return blocked ? false : interact(state); }
export function stepStreet(state, input, dt) { stepMovement(state, input, dt); return state; }
