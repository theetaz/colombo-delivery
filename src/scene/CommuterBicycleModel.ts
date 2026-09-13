import * as THREE from "three";

export const COMMUTER_BICYCLE_V2_URL = "models/commuter_bicycle_v2.glb";
export const COMMUTER_BICYCLE_V2_REVISION = "commuter-bicycle-v2/1";
export const COMMUTER_BICYCLE_V2_NODES = [
  "CommuterBicycleV2",
  "RearWheel",
  "FrontAssembly",
  "FrontWheel",
  "Crank",
  "Pedal_L",
  "Pedal_R",
  "Grip_L_Attach",
  "Grip_R_Attach",
  "Seat_Attach",
  "Pedal_L_Attach",
  "Pedal_R_Attach",
] as const;

export function validateCommuterBicycle(
  root: THREE.Object3D,
):
  | { ok: true; nodes: Map<string, THREE.Object3D> }
  | { ok: false; missing: string[] } {
  const nodes = new Map<string, THREE.Object3D>();
  for (const name of COMMUTER_BICYCLE_V2_NODES) {
    const node = root.getObjectByName(name);
    if (node) nodes.set(name, node);
  }
  const missing: string[] = COMMUTER_BICYCLE_V2_NODES.filter(
    (name) => !nodes.has(name),
  );
  const parents = [
    ["FrontWheel", "FrontAssembly"],
    ["Pedal_L", "Crank"],
    ["Pedal_R", "Crank"],
    ["Grip_L_Attach", "FrontAssembly"],
    ["Grip_R_Attach", "FrontAssembly"],
    ["Pedal_L_Attach", "Pedal_L"],
    ["Pedal_R_Attach", "Pedal_R"],
  ] as const;
  for (const [child, parent] of parents) {
    if (nodes.get(child)?.parent?.name !== parent)
      missing.push(`${child}<${parent}`);
  }
  return missing.length ? { ok: false, missing } : { ok: true, nodes };
}

export class BicycleMechanics {
  private readonly rest = new Map<string, THREE.Quaternion>();

  constructor(private readonly nodes: Map<string, THREE.Object3D>) {
    for (const name of [
      "RearWheel",
      "FrontAssembly",
      "FrontWheel",
      "Crank",
      "Pedal_L",
      "Pedal_R",
    ]) {
      this.rest.set(name, nodes.get(name)!.quaternion.clone());
    }
  }

  apply(wheelAngle: number, crankAngle: number, steering: number): void {
    this.rotate("RearWheel", wheelAngle);
    this.rotate("FrontWheel", wheelAngle);
    this.rotate("FrontAssembly", steering * 0.5, new THREE.Vector3(0, 1, 0));
    this.rotate("Crank", crankAngle);
    this.rotate("Pedal_L", -crankAngle);
    this.rotate("Pedal_R", -crankAngle);
  }

  private rotate(
    name: string,
    angle: number,
    axis = new THREE.Vector3(1, 0, 0),
  ): void {
    this.nodes
      .get(name)!
      .quaternion.copy(this.rest.get(name)!)
      .multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
  }
}
