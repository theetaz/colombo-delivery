import * as THREE from "three";

export const SEATED_COURIER_V2_URL = "models/teen_courier_seated_v2.glb";
export const SEATED_COURIER_V2_REVISION = "teen-courier-seated-v2/1";
export const SEATED_COURIER_V2_NODES = [
  "TeenCourierSeatedV2",
  "PelvisContact",
  "Palm_L_Contact",
  "Palm_R_Contact",
  "Sole_L_Contact",
  "Sole_R_Contact",
] as const;

export function validateSeatedCourier(
  root: THREE.Object3D,
):
  | { ok: true; nodes: Map<string, THREE.Object3D> }
  | { ok: false; missing: string[] } {
  const nodes = new Map<string, THREE.Object3D>();
  for (const name of SEATED_COURIER_V2_NODES) {
    const node = root.getObjectByName(name);
    if (node) nodes.set(name, node);
  }
  const missing: string[] = SEATED_COURIER_V2_NODES.filter(
    (name) => !nodes.has(name),
  );
  const modelRoot = nodes.get("TeenCourierSeatedV2");
  if (
    modelRoot &&
    (modelRoot.position.lengthSq() > 1e-12 ||
      modelRoot.quaternion.angleTo(new THREE.Quaternion()) > 1e-6 ||
      modelRoot.scale.distanceTo(new THREE.Vector3(1, 1, 1)) > 1e-6)
  ) {
    missing.push("TeenCourierSeatedV2:identity-transform");
  }
  return missing.length
    ? { ok: false, missing: [...missing] }
    : { ok: true, nodes };
}
