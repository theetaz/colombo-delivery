import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const RIDING_COURIER_MODEL_URL = "models/teen_courier_riding.glb";

export interface RidingCourierMotion {
  crankAngle: number;
  steering: number;
  pedaling?: boolean;
  deltaSeconds?: number;
}

export interface RidingCourierContract {
  contractVersion: 1;
  forwardAxis: "-Z";
  wheelRadius: 0.34;
  wheelbase: 1.08;
  animation: "PedalCycle";
  backpackAttachment: "Backpack_Attach";
}

export const RIDING_COURIER_CONTRACT: RidingCourierContract = {
  contractVersion: 1,
  forwardAxis: "-Z",
  wheelRadius: 0.34,
  wheelbase: 1.08,
  animation: "PedalCycle",
  backpackAttachment: "Backpack_Attach",
};

const REQUIRED_NODES = [
  "TeenCourierRig", "Backpack_Attach", "HandContact_L", "HandContact_R",
  "FootContact_L", "FootContact_R",
  "tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2",
  "tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2",
  "bone_8", "bone_29",
  "tripo::0_Left_Limb_0", "tripo::0_Left_Limb_1", "tripo::0_Left_Limb_2",
  "tripo::0_Right_Limb_0", "tripo::0_Right_Limb_1", "tripo::0_Right_Limb_2",
] as const;

export function loadedNodeName(authoredName: string): string {
  return THREE.PropertyBinding.sanitizeNodeName(authoredName);
}

export function validateRidingCourier(root: THREE.Object3D, clips: readonly THREE.AnimationClip[]):
  | { ok: true; nodes: Map<string, THREE.Object3D>; clip: THREE.AnimationClip }
  | { ok: false; missing: string[] } {
  const nodes = new Map<string, THREE.Object3D>();
  const loadedNodes = new Map<string, THREE.Object3D>();
  root.traverse((node) => { if (node.name) loadedNodes.set(node.name, node); });
  for (const authoredName of REQUIRED_NODES) {
    const node = loadedNodes.get(authoredName) ?? loadedNodes.get(loadedNodeName(authoredName));
    if (node) nodes.set(authoredName, node);
  }
  const missing: string[] = REQUIRED_NODES.filter((name) => !nodes.has(name));
  const clip = clips.find(({ name }) => name === RIDING_COURIER_CONTRACT.animation);
  if (!clip) missing.push(`animation:${RIDING_COURIER_CONTRACT.animation}`);
  return missing.length || !clip ? { ok: false, missing } : { ok: true, nodes, clip };
}

export class RidingCourier {
  readonly group = new THREE.Group();
  readonly ready: Promise<boolean>;

  private mixer: THREE.AnimationMixer | null = null;
  private clip: THREE.AnimationClip | null = null;
  private root: THREE.Object3D | null = null;
  private backpackAttach: THREE.Object3D | null = null;
  private nodes = new Map<string, THREE.Object3D>();
  private backpack: THREE.Object3D | null = null;
  private disposed = false;
  private heldPhase = 0;

  constructor(
    private readonly onLoadNotice?: (message: string) => void,
    modelUrl = `${import.meta.env.BASE_URL}${RIDING_COURIER_MODEL_URL}`,
  ) {
    this.group.name = "Detailed riding courier";
    this.ready = this.load(modelUrl);
  }

  update(motion: RidingCourierMotion): void {
    if (!this.mixer || !this.clip || !this.root) return;
    if (motion.pedaling ?? true) this.heldPhase = normalizeAngle(motion.crankAngle);
    const duration = Math.max(this.clip.duration, 1 / 24);
    this.mixer.setTime(this.heldPhase / (Math.PI * 2) * duration);

    this.root.updateMatrixWorld(true);
    for (const side of ["L", "R"] as const) {
      solveArmContactPreservingHand(
        this.group,
        this.nodes.get(`HandContact_${side}`)!,
        this.nodes.get(`tripo::1_${side === "L" ? "Left" : "Right"}_Limb_2`)!,
        [
          this.nodes.get(`tripo::1_${side === "L" ? "Left" : "Right"}_Limb_1`)!,
          this.nodes.get(`tripo::1_${side === "L" ? "Left" : "Right"}_Limb_0`)!,
          this.nodes.get(side === "L" ? "bone_8" : "bone_29")!,
        ],
        ridingGripTarget(side, motion.steering),
        motion.steering,
      );
      solveLegContactPreservingFoot(
        this.group,
        this.nodes.get(`FootContact_${side}`)!,
        this.nodes.get(`tripo::0_${side === "L" ? "Left" : "Right"}_Limb_2`)!,
        [this.nodes.get(`tripo::0_${side === "L" ? "Left" : "Right"}_Limb_1`)!, this.nodes.get(`tripo::0_${side === "L" ? "Left" : "Right"}_Limb_0`)!],
        ridingPedalTarget(side, this.heldPhase),
      );
    }
  }

  setBackpack(backpack: THREE.Object3D | null): void {
    if (this.backpack?.parent) this.backpack.removeFromParent();
    this.backpack = backpack;
    if (!backpack || !this.backpackAttach) return;
    this.backpackAttach.add(backpack);
    backpack.position.set(0, 0, 0);
    backpack.quaternion.identity();
    backpack.scale.set(1, 1, 1);
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    if (this.backpack?.parent) this.backpack.removeFromParent();
    if (this.root) disposeObject(this.root);
  }

  private async load(modelUrl: string): Promise<boolean> {
    try {
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      if (this.disposed) {
        disposeObject(gltf.scene);
        return false;
      }
      const validation = validateRidingCourier(gltf.scene, gltf.animations);
      if (!validation.ok) {
        disposeObject(gltf.scene);
        throw new Error(`missing riding contract: ${validation.missing.join(", ")}`);
      }
      gltf.scene.name = "Approved teen courier riding rig";
      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      this.root = gltf.scene;
      this.nodes = validation.nodes;
      this.clip = validation.clip;
      this.backpackAttach = validation.nodes.get(RIDING_COURIER_CONTRACT.backpackAttachment)!;
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      this.mixer.clipAction(validation.clip).play();
      this.group.add(gltf.scene);
      if (this.backpack) this.setBackpack(this.backpack);
      this.onLoadNotice?.("Detailed teen rider ready · seated pedal cycle");
      return true;
    } catch (error) {
      if (!this.disposed) this.onLoadNotice?.(`Detailed teen rider could not load (${error instanceof Error ? error.message : "unknown model error"})`);
      return false;
    }
  }
}

function normalizeAngle(angle: number): number {
  const turn = Math.PI * 2;
  return ((angle % turn) + turn) % turn;
}

export function ridingGripTarget(side: "L" | "R", steering: number): THREE.Vector3 {
  const point = new THREE.Vector3(side === "L" ? -0.22 : 0.22, 1.04, 0.13);
  point.applyAxisAngle(new THREE.Vector3(0, 1, 0), -steering * 0.34);
  point.z -= 0.54;
  return point;
}

export function ridingPedalTarget(side: "L" | "R", crankAngle: number): THREE.Vector3 {
  const phase = crankAngle + (side === "L" ? 0 : Math.PI);
  return new THREE.Vector3(
    side === "L" ? -0.1 : 0.1,
    0.45 + Math.cos(phase) * 0.18,
    0.06 + Math.sin(phase) * 0.18,
  );
}

export function solveCcdContact(root: THREE.Object3D, contact: THREE.Object3D | undefined, joints: readonly (THREE.Object3D | undefined)[], targetInRoot: THREE.Vector3, iterations = 8): number {
  if (!contact || joints.some((joint) => !joint)) return Number.POSITIVE_INFINITY;
  const targetWorld = root.localToWorld(targetInRoot.clone());
  const jointPosition = new THREE.Vector3();
  const contactPosition = new THREE.Vector3();
  const jointWorld = new THREE.Quaternion();
  const parentWorld = new THREE.Quaternion();
  const delta = new THREE.Quaternion();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const candidate of joints) {
      const joint = candidate!;
      root.updateMatrixWorld(true);
      joint.getWorldPosition(jointPosition);
      contact.getWorldPosition(contactPosition);
      const towardContact = contactPosition.sub(jointPosition).normalize();
      const towardTarget = targetWorld.clone().sub(jointPosition).normalize();
      if (!towardContact.lengthSq() || !towardTarget.lengthSq()) continue;
      delta.setFromUnitVectors(towardContact, towardTarget);
      joint.getWorldQuaternion(jointWorld);
      joint.parent?.getWorldQuaternion(parentWorld) ?? parentWorld.identity();
      joint.quaternion.copy(parentWorld.invert().multiply(delta).multiply(jointWorld)).normalize();
    }
    root.updateMatrixWorld(true);
    if (contact.getWorldPosition(contactPosition).distanceTo(targetWorld) < 0.0001) break;
  }
  root.updateMatrixWorld(true);
  return contact.getWorldPosition(contactPosition).distanceTo(targetWorld);
}

export function solveLegContactPreservingFoot(
  root: THREE.Object3D,
  contact: THREE.Object3D | undefined,
  foot: THREE.Object3D | undefined,
  joints: readonly (THREE.Object3D | undefined)[],
  targetInRoot: THREE.Vector3,
): number {
  if (!contact || !foot || !foot.parent || joints.some((joint) => !joint)) return Number.POSITIVE_INFINITY;
  root.updateMatrixWorld(true);
  const worldOrientation = foot.getWorldQuaternion(new THREE.Quaternion());
  const parentWorld = new THREE.Quaternion();
  for (let pass = 0; pass < 4; pass += 1) {
    solveCcdContact(root, contact, joints, targetInRoot, 8);
    foot.parent.getWorldQuaternion(parentWorld);
    foot.quaternion.copy(parentWorld.invert().multiply(worldOrientation)).normalize();
    root.updateMatrixWorld(true);
    const targetWorld = root.localToWorld(targetInRoot.clone());
    if (contact.getWorldPosition(new THREE.Vector3()).distanceTo(targetWorld) < 0.0001) break;
  }
  const targetWorld = root.localToWorld(targetInRoot.clone());
  return contact.getWorldPosition(new THREE.Vector3()).distanceTo(targetWorld);
}

export function solveArmContactPreservingHand(
  root: THREE.Object3D,
  contact: THREE.Object3D | undefined,
  hand: THREE.Object3D | undefined,
  joints: readonly (THREE.Object3D | undefined)[],
  targetInRoot: THREE.Vector3,
  steering: number,
): { residual: number; orientationError: number } {
  if (!contact || !hand || !hand.parent || joints.some((joint) => !joint)) {
    return { residual: Number.POSITIVE_INFINITY, orientationError: Number.POSITIVE_INFINITY };
  }
  root.updateMatrixWorld(true);
  const bakedWorld = hand.getWorldQuaternion(new THREE.Quaternion());
  const rootWorld = root.getWorldQuaternion(new THREE.Quaternion());
  const steeringWorld = rootWorld.clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -steering * 0.34))
    .multiply(rootWorld.clone().invert());
  const desiredWorld = steeringWorld.multiply(bakedWorld);
  const parentWorld = new THREE.Quaternion();
  const forearm = joints[0]!;
  const upperArm = joints[1]!;
  const shoulder = upperArm.getWorldPosition(new THREE.Vector3());
  const bakedElbow = forearm.getWorldPosition(new THREE.Vector3());
  const bakedWrist = hand.getWorldPosition(new THREE.Vector3());
  const contactOffset = hand.worldToLocal(contact.getWorldPosition(new THREE.Vector3()));
  const targetWorld = root.localToWorld(targetInRoot.clone());
  const targetWrist = targetWorld.clone().sub(contactOffset.applyQuaternion(desiredWorld));
  const upperLength = shoulder.distanceTo(bakedElbow);
  const forearmLength = bakedElbow.distanceTo(bakedWrist);
  const reach = targetWrist.clone().sub(shoulder);
  const distance = Math.min(reach.length(), (upperLength + forearmLength) * 0.999);
  const direction = reach.normalize();
  const along = (upperLength * upperLength - forearmLength * forearmLength + distance * distance) / (2 * Math.max(distance, 1e-6));
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const bakedPerpendicular = bakedElbow.clone().sub(shoulder).addScaledVector(direction, -bakedElbow.clone().sub(shoulder).dot(direction));
  if (bakedPerpendicular.lengthSq() < 1e-8) bakedPerpendicular.set(upperArm.position.x < 0 ? -1 : 1, -0.2, 0);
  const desiredElbow = shoulder.clone().addScaledVector(direction, along).addScaledVector(bakedPerpendicular.normalize(), height);
  rotateBoneWorldToward(upperArm, bakedElbow.clone().sub(shoulder), desiredElbow.clone().sub(shoulder));
  root.updateMatrixWorld(true);
  const elbow = forearm.getWorldPosition(new THREE.Vector3());
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  rotateBoneWorldToward(forearm, wrist.sub(elbow), targetWrist.clone().sub(elbow));
  root.updateMatrixWorld(true);
  hand.parent.getWorldQuaternion(parentWorld);
  hand.quaternion.copy(parentWorld.invert().multiply(desiredWorld)).normalize();
  root.updateMatrixWorld(true);
  const residual = contact.getWorldPosition(new THREE.Vector3()).distanceTo(targetWorld);
  return { residual, orientationError: desiredWorld.angleTo(hand.getWorldQuaternion(new THREE.Quaternion())) };
}

function rotateBoneWorldToward(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(delta).multiply(world)).normalize();
}

function disposeObject(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  textures.forEach((texture) => texture.dispose());
}
