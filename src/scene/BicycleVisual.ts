import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { BicycleState, PrototypeObstacle } from "../game/bicycle";
import { CHARACTER_APPEARANCE_STORAGE_KEY, loadCharacterAppearance, validateCharacterAppearance } from "../customizer/appearance";
import {
  applyCourierAppearance,
  cloneCharacterMaterials,
  loadCourierAppearance,
  type CourierAppearance,
} from "./bicycle-appearance";
import { disposeDeliveryBackpack, loadDeliveryBackpack, RIDING_DELIVERY_BACKPACK_MODEL_URL, setDeliveryBackpackColor } from "./DeliveryBackpack";
import { RidingCourier } from "./RidingCourier";

const WHEEL_RADIUS = 0.34;
const WHEELBASE = 1.08;
const FRAME_RADIUS = 0.025;
export const BICYCLE_MODEL_URL = "models/courier_bicycle.glb";

export interface VehicleVisualContract {
  contractVersion: number;
  vehicleType: string;
  forwardAxis: "-Z";
  wheelRadius: number;
  wheelbase: number;
  cargoAttachment: string;
  requiredNodes: readonly string[];
}

export const COURIER_BICYCLE_CONTRACT = {
  contractVersion: 1,
  vehicleType: "bicycle",
  forwardAxis: "-Z",
  wheelRadius: WHEEL_RADIUS,
  wheelbase: WHEELBASE,
  cargoAttachment: "Cargo_Attach",
  requiredNodes: [
    "RearWheel", "FrontAssembly", "FrontWheel", "Crank",
    "Pedal_L", "Pedal_R", "Pedal_L_Attach", "Pedal_R_Attach", "Grip_L_Attach", "Grip_R_Attach",
    "Hip_L_Attach", "Hip_R_Attach", "Shoulder_L_Attach", "Shoulder_R_Attach",
    "UpperArm_L", "UpperArm_R", "Forearm_L", "Forearm_R",
    "Rider_Thigh_L", "Rider_Thigh_R", "Rider_Shin_L", "Rider_Shin_R",
    "Hand_L", "Hand_R", "Foot_L", "Foot_R", "Cargo_Attach", "Seat_Attach",
    "Face_Profile_Classic", "Face_Profile_Soft", "Face_Profile_Angular",
  ],
} as const satisfies VehicleVisualContract;

export interface BicycleVisualMotion {
  pedal?: boolean;
  deltaSeconds?: number;
}

interface ImportedBicycleRig {
  root: THREE.Object3D;
  nodes: Map<string, THREE.Object3D>;
  appearanceMaterials: Map<string, THREE.Material[]>;
}

export function validateCourierBicycleRig(root: THREE.Object3D): { ok: true; nodes: Map<string, THREE.Object3D> } | { ok: false; missing: string[] } {
  const nodes = new Map<string, THREE.Object3D>();
  root.traverse((node) => {
    if (node.name) nodes.set(node.name, node);
  });
  const missing: string[] = COURIER_BICYCLE_CONTRACT.requiredNodes.filter((name) => !nodes.has(name));
  const hierarchy: ReadonlyArray<readonly [string, string]> = [
    ["FrontWheel", "FrontAssembly"], ["Grip_L_Attach", "FrontAssembly"], ["Grip_R_Attach", "FrontAssembly"],
    ["Pedal_L", "Crank"], ["Pedal_R", "Crank"], ["Pedal_L_Attach", "Pedal_L"], ["Pedal_R_Attach", "Pedal_R"],
  ];
  for (const [childName, parentName] of hierarchy) {
    const child = nodes.get(childName);
    if (child && child.parent?.name !== parentName) missing.push(`${childName} parent ${parentName}`);
  }
  return missing.length > 0 ? { ok: false, missing } : { ok: true, nodes };
}

export function bicycleHeadingToVisualRotation(heading: number): number {
  return -heading;
}

export function hasSavedCharacterLook(storage?: Pick<Storage, "getItem"> | null): boolean {
  if (storage === null) return false;
  try {
    const source = storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : storage;
    const raw = source?.getItem(CHARACTER_APPEARANCE_STORAGE_KEY);
    return raw != null && validateCharacterAppearance(JSON.parse(raw)) !== null;
  } catch {
    return false;
  }
}

export type AssetLoadState = "pending" | "ready" | "failed";

export function bicycleVisualLoadStatus(bicycle: AssetLoadState, rider: AssetLoadState, backpack: AssetLoadState): string {
  if (bicycle === "failed") return "Polished bicycle unavailable · procedural fallback active";
  if (bicycle === "pending") return "Procedural fallback visible · loading polished bicycle…";
  if (rider === "failed") return "Bicycle ready · detailed rider unavailable, fallback courier active";
  if (rider === "pending") return "Bicycle ready · loading detailed rider…";
  if (backpack === "failed") return "Bicycle and detailed rider ready · delivery backpack unavailable";
  if (backpack === "pending") return "Bicycle and detailed rider ready · loading delivery backpack…";
  return "Bicycle, detailed rider, and delivery backpack ready";
}

export function prepareImportedBicycleForRiding(root: THREE.Object3D): void {
  const kickstand = root.getObjectByName("Kickstand");
  if (kickstand) kickstand.visible = false;
}

export function attachmentPositionInRoot(root: THREE.Object3D, attachment: THREE.Object3D, updateMatrices = true): THREE.Vector3 {
  if (updateMatrices) root.updateMatrixWorld(true);
  return root.worldToLocal(attachment.getWorldPosition(new THREE.Vector3()));
}

export class BicycleVisual {
  readonly group = new THREE.Group();
  readonly ready: Promise<boolean>;

  private readonly fallback = new THREE.Group();
  private readonly wheels: THREE.Group[] = [];
  private readonly frontAssembly = new THREE.Group();
  private readonly crank = new THREE.Group();
  private readonly pedalPlatforms: THREE.Mesh[] = [];
  private readonly limbs: THREE.Mesh[] = [];
  private readonly shoes: THREE.Mesh[] = [];
  private importedRig: ImportedBicycleRig | null = null;
  private disposed = false;
  private crankAngle = 0;
  private lastDistance = 0;
  private latestState: BicycleState | null = null;
  private appearance: CourierAppearance;
  private readonly ridingCourier: RidingCourier;
  private deliveryBackpack: THREE.Object3D | null = null;
  private backpackEnabled: boolean;
  private backpackColor: THREE.ColorRepresentation;
  private detailedRiderReady = false;
  private detailedRiderFailed = false;
  private bicycleLoadFailed = false;
  private saddleAdjusted = false;
  private backpackLoadFailed = false;
  private backpackLoaded = false;

  constructor(private readonly onLoadNotice?: (message: string) => void, modelUrl = `${import.meta.env.BASE_URL}${BICYCLE_MODEL_URL}`, appearance = loadCourierAppearance()) {
    this.appearance = { ...appearance };
    const savedCharacterLook = hasSavedCharacterLook();
    const characterLook = loadCharacterAppearance();
    this.backpackEnabled = savedCharacterLook ? characterLook.backpack === "insulated" : true;
    this.backpackColor = characterLook.colors.backpack;
    this.group.name = "Rider bicycle";
    this.ridingCourier = new RidingCourier();
    this.ridingCourier.group.visible = false;
    void this.ridingCourier.ready.then((ready) => {
      if (this.disposed) return;
      if (!ready) {
        this.detailedRiderFailed = true;
        this.reportLoadState();
        return;
      }
      this.detailedRiderReady = true;
      this.hideImportedCourier();
      this.reportLoadState();
    });
    void loadDeliveryBackpack(`${import.meta.env.BASE_URL}${RIDING_DELIVERY_BACKPACK_MODEL_URL}`).then((backpack) => {
      if (this.disposed) { disposeDeliveryBackpack(backpack); return; }
      this.deliveryBackpack = backpack;
      this.backpackLoaded = true;
      setDeliveryBackpackColor(backpack, this.backpackColor);
      this.ridingCourier.setBackpack(this.backpackEnabled ? backpack : null);
      this.reportLoadState();
    }).catch(() => {
      if (this.disposed) return;
      this.backpackLoadFailed = true;
      this.reportLoadState();
    });

    const rubber = new THREE.MeshStandardMaterial({ color: 0x171a19, roughness: 0.82 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8ddd7, roughness: 0.38, metalness: 0.7 });
    const frame = new THREE.MeshStandardMaterial({ color: 0xd85e2f, roughness: 0.54, metalness: 0.08 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3532, roughness: 0.78 });
    const riderTop = new THREE.MeshStandardMaterial({ color: 0xf2c75f, roughness: 0.9 });
    const riderBottom = new THREE.MeshStandardMaterial({ color: 0x244d55, roughness: 0.88 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x8b5136, roughness: 0.92 });
    const helmet = new THREE.MeshStandardMaterial({ color: 0xf3eee0, roughness: 0.74 });
    const bag = new THREE.MeshStandardMaterial({ color: 0xb7472b, roughness: 0.9 });
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 20),
      new THREE.MeshBasicMaterial({ color: 0x18221f, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = 1.75;
    shadow.position.y = 0.006;
    shadow.renderOrder = 4;
    this.group.add(shadow);

    const rearZ = WHEELBASE / 2;
    const frontZ = -WHEELBASE / 2;
    const rearWheel = makeWheel(rubber, metal);
    rearWheel.position.set(0, WHEEL_RADIUS, rearZ);
    this.group.add(rearWheel);
    this.wheels.push(rearWheel);

    this.frontAssembly.position.set(0, 0, frontZ);
    const frontWheel = makeWheel(rubber, metal);
    frontWheel.position.y = WHEEL_RADIUS;
    this.frontAssembly.add(frontWheel);
    this.wheels.push(frontWheel);

    const forkCrown = new THREE.Vector3(0, 0.79, 0.08);
    this.frontAssembly.add(
      tube(new THREE.Vector3(-0.035, WHEEL_RADIUS, 0), new THREE.Vector3(-0.035, forkCrown.y, forkCrown.z), 0.018, metal),
      tube(new THREE.Vector3(0.035, WHEEL_RADIUS, 0), new THREE.Vector3(0.035, forkCrown.y, forkCrown.z), 0.018, metal),
      tube(new THREE.Vector3(0, 0.77, 0.06), new THREE.Vector3(0, 1.04, 0.13), 0.021, metal),
    );
    const handlebars = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.6, 8), dark);
    handlebars.rotation.z = Math.PI / 2;
    handlebars.position.set(0, 1.04, 0.13);
    this.frontAssembly.add(handlebars);
    this.group.add(this.frontAssembly);

    const crankPoint = new THREE.Vector3(0, 0.45, 0.06);
    const seatTubeTop = new THREE.Vector3(0, 0.84, 0.31);
    const headBottom = new THREE.Vector3(0, 0.72, frontZ + 0.08);
    this.group.add(
      tube(new THREE.Vector3(0, WHEEL_RADIUS, rearZ), crankPoint, FRAME_RADIUS, frame),
      tube(crankPoint, seatTubeTop, FRAME_RADIUS, frame),
      tube(seatTubeTop, new THREE.Vector3(0, 0.78, frontZ + 0.09), FRAME_RADIUS, frame),
      tube(crankPoint, headBottom, FRAME_RADIUS, frame),
      tube(new THREE.Vector3(0, WHEEL_RADIUS, rearZ), seatTubeTop, FRAME_RADIUS, frame),
      tube(seatTubeTop, new THREE.Vector3(0, 0.98, 0.38), 0.018, metal),
    );

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 0.38), dark);
    saddle.position.set(0, 1.01, 0.39);
    saddle.rotation.x = -0.05;
    this.group.add(saddle);

    this.crank.position.copy(crankPoint);
    const crankAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 16), metal);
    crankAxle.rotation.z = Math.PI / 2;
    this.crank.add(crankAxle);
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.36, 0.025), metal);
    this.crank.add(crankArm);
    const pedalA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.08), dark);
    pedalA.position.set(0.1, 0.18, 0);
    const pedalB = pedalA.clone();
    pedalB.position.set(-0.1, -0.18, 0);
    this.crank.add(pedalA, pedalB);
    this.pedalPlatforms.push(pedalA, pedalB);
    this.group.add(this.crank);

    const hip = new THREE.Vector3(0, 1.08, 0.34);
    const shoulder = new THREE.Vector3(0, 1.56, 0.02);
    const torso = taperedTube(hip, shoulder, 0.12, 0.18, riderTop);
    torso.scale.x = 0.72;
    this.group.add(torso);
    const shorts = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 9), riderBottom);
    shorts.scale.set(1, 0.72, 1.05);
    shorts.position.copy(hip);
    const neck = tube(new THREE.Vector3(0, 1.55, -0.01), new THREE.Vector3(0, 1.66, -0.045), 0.052, skin);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin);
    head.scale.set(0.9, 1.08, 0.92);
    head.position.set(0, 1.74, -0.075);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.123, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), dark);
    hair.position.set(0, 1.77, -0.067);
    const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.142, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), helmet);
    helmetShell.position.set(0, 1.805, -0.075);
    helmetShell.scale.z = 1.08;
    const helmetBrim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.075), helmet);
    helmetBrim.position.set(0, 1.79, -0.18);
    helmetBrim.rotation.x = -0.12;

    const parcelBag = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.18, 6, 12), bag);
    parcelBag.position.set(0, 1.39, 0.27);
    parcelBag.rotation.x = -0.48;
    parcelBag.scale.z = 0.72;
    const bagFlap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), dark);
    bagFlap.position.set(0, 1.54, 0.205);
    bagFlap.rotation.x = -0.48;
    bagFlap.scale.set(1, 0.34, 0.68);
    const bagPocket = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.1, 4, 10), dark);
    bagPocket.position.set(0, 1.34, 0.385);
    bagPocket.rotation.x = Math.PI / 2 - 0.42;
    bagPocket.scale.x = 1.35;
    const strapLeft = tube(new THREE.Vector3(-0.105, 1.58, 0.01), new THREE.Vector3(-0.105, 1.18, 0.3), 0.014, dark);
    const strapRight = tube(new THREE.Vector3(0.105, 1.58, 0.01), new THREE.Vector3(0.105, 1.18, 0.3), 0.014, dark);
    const shoulderLeftCap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), riderTop);
    shoulderLeftCap.position.set(-0.115, 1.515, 0.015);
    shoulderLeftCap.scale.set(1.1, 0.9, 1);
    const shoulderRightCap = shoulderLeftCap.clone();
    shoulderRightCap.position.x = 0.115;
    this.group.add(shorts, neck, head, hair, helmetShell, helmetBrim, parcelBag, bagFlap, bagPocket, strapLeft, strapRight, shoulderLeftCap, shoulderRightCap);

    for (const x of [-0.055, 0, 0.055]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.105), dark);
      vent.position.set(x, 1.925 - Math.abs(x) * 0.25, -0.078);
      vent.rotation.x = -0.08;
      this.group.add(vent);
    }

    const leftHand = new THREE.Vector3(-0.22, 1.04, frontZ + 0.13);
    const rightHand = new THREE.Vector3(0.22, 1.04, frontZ + 0.13);
    const shoulderLeft = new THREE.Vector3(-0.11, 1.52, 0.015);
    const shoulderRight = new THREE.Vector3(0.11, 1.52, 0.015);
    const elbowLeft = shoulderLeft.clone().lerp(leftHand, 0.52).add(new THREE.Vector3(-0.035, 0.06, 0.02));
    const elbowRight = shoulderRight.clone().lerp(rightHand, 0.52).add(new THREE.Vector3(0.035, 0.06, 0.02));
    this.group.add(
      tube(shoulderLeft, elbowLeft, 0.048, riderTop), tube(elbowLeft, leftHand, 0.036, skin),
      tube(shoulderRight, elbowRight, 0.048, riderTop), tube(elbowRight, rightHand, 0.036, skin),
    );
    for (const hand of [leftHand, rightHand]) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), skin);
      mesh.position.copy(hand);
      this.group.add(mesh);
    }

    for (let index = 0; index < 4; index += 1) {
      const limb = tube(new THREE.Vector3(), new THREE.Vector3(0, 0.4, 0), index < 2 ? 0.055 : 0.043, index < 2 ? riderBottom : skin);
      this.limbs.push(limb);
      this.group.add(limb);
    }
    for (const side of [-1, 1]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.065, 0.24), dark);
      shoe.scale.set(1.12, 1, 1.08);
      shoe.rotation.y = side * 0.04;
      this.shoes.push(shoe);
      this.group.add(shoe);
    }
    this.updateRiderPose(0);

    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.fallback.name = "Procedural bicycle fallback";
    this.fallback.add(...this.group.children);
    this.group.add(this.fallback);
    this.group.add(this.ridingCourier.group);
    this.ready = this.loadImportedModel(modelUrl);
  }

  update(state: BicycleState, motion: BicycleVisualMotion = {}): void {
    this.latestState = { ...state };
    const surfaceHeight = state.surface === "road" ? 0.14 : -0.055;
    this.group.position.set(state.x, state.y + surfaceHeight, state.z);
    this.group.rotation.y = bicycleHeadingToVisualRotation(state.heading);
    this.frontAssembly.rotation.y = -state.steering * 0.34;
    const wheelRotation = -state.distanceTravelled / WHEEL_RADIUS;
    const distanceDelta = state.distanceTravelled - this.lastDistance;
    if (distanceDelta < -0.01) this.crankAngle = 0;
    else if (motion.pedal ?? true) this.crankAngle += -distanceDelta / WHEEL_RADIUS * 0.62;
    this.lastDistance = state.distanceTravelled;
    for (const wheel of this.wheels) wheel.rotation.x = wheelRotation;
    this.crank.rotation.x = this.crankAngle;
    for (const pedal of this.pedalPlatforms) pedal.rotation.x = -this.crankAngle;
    this.updateRiderPose(this.crankAngle);
    this.updateImportedRig(state, wheelRotation);
    this.ridingCourier.update({
      crankAngle: this.crankAngle,
      steering: state.steering,
      pedaling: motion.pedal ?? true,
      deltaSeconds: motion.deltaSeconds,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ridingCourier.setBackpack(null);
    if (this.deliveryBackpack) disposeDeliveryBackpack(this.deliveryBackpack);
    this.deliveryBackpack = null;
    this.ridingCourier.dispose();
    if (this.importedRig) {
      disposeBicycleResources(this.importedRig.root);
      this.importedRig.root.removeFromParent();
      this.importedRig = null;
    }
    disposeBicycleResources(this.fallback);
  }

  setBackpackEnabled(enabled: boolean): void {
    this.backpackEnabled = enabled;
    this.ridingCourier.setBackpack(enabled ? this.deliveryBackpack : null);
  }

  getBackpackEnabled(): boolean {
    return this.backpackEnabled;
  }

  setBackpackColor(color: THREE.ColorRepresentation): void {
    this.backpackColor = color;
    if (this.deliveryBackpack) setDeliveryBackpackColor(this.deliveryBackpack, color);
  }

  setAppearance(appearance: CourierAppearance): void {
    this.appearance = { ...appearance };
    if (this.importedRig) applyCourierAppearance(this.importedRig.root, this.importedRig.appearanceMaterials, this.appearance);
  }

  getAppearance(): CourierAppearance {
    return { ...this.appearance };
  }

  private async loadImportedModel(modelUrl: string): Promise<boolean> {
    try {
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      if (this.disposed) {
        disposeBicycleResources(gltf.scene);
        return false;
      }
      const validation = validateCourierBicycleRig(gltf.scene);
      if (!validation.ok) {
        disposeBicycleResources(gltf.scene);
        throw new Error(`missing nodes: ${validation.missing.join(", ")}`);
      }
      gltf.scene.name = "Imported courier bicycle";
      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      prepareImportedBicycleForRiding(gltf.scene);
      const appearanceMaterials = cloneCharacterMaterials(gltf.scene);
      applyCourierAppearance(gltf.scene, appearanceMaterials, this.appearance);
      this.importedRig = { root: gltf.scene, nodes: validation.nodes, appearanceMaterials };
      this.group.add(gltf.scene);
      if (this.latestState) this.updateImportedRig(this.latestState, -this.latestState.distanceTravelled / WHEEL_RADIUS);
      this.fallback.visible = false;
      this.hideImportedCourier();
      this.reportLoadState();
      return true;
    } catch (error) {
      if (this.disposed) return false;
      this.bicycleLoadFailed = true;
      this.reportLoadState();
      return false;
    }
  }

  private hideImportedCourier(): void {
    if (!this.importedRig || !this.detailedRiderReady) return;
    const riderNames = /^(?:Bag|CourierBag|CargoReflector$|Face_Profile_|Foot_|Forearm_|Hand_|Helmet|Hip_|Neck$|Rider_|Shirt_|Shorts_|Shoulder_|UpperArm_)/;
    const bicycleRoot = this.importedRig.root.getObjectByName("CourierBicycle") ?? this.importedRig.root;
    for (const child of bicycleRoot.children) if (riderNames.test(child.name)) child.visible = false;
    if (!this.saddleAdjusted) {
      const saddle = bicycleRoot.getObjectByName("Saddle");
      if (saddle) saddle.position.y -= 0.04;
      this.saddleAdjusted = true;
    }
    this.ridingCourier.group.visible = true;
  }

  private reportLoadState(): void {
    const bicycle: AssetLoadState = this.importedRig ? "ready" : this.bicycleLoadFailed ? "failed" : "pending";
    const rider: AssetLoadState = this.detailedRiderReady ? "ready" : this.detailedRiderFailed ? "failed" : "pending";
    const backpack: AssetLoadState = this.backpackLoaded ? "ready" : this.backpackLoadFailed ? "failed" : "pending";
    this.onLoadNotice?.(bicycleVisualLoadStatus(bicycle, rider, backpack));
  }

  private updateImportedRig(state: BicycleState, wheelRotation: number): void {
    const rig = this.importedRig;
    if (!rig) return;
    rig.nodes.get("RearWheel")!.rotation.x = wheelRotation;
    rig.nodes.get("FrontWheel")!.rotation.x = wheelRotation;
    rig.nodes.get("FrontAssembly")!.rotation.y = -state.steering * 0.34;
    rig.nodes.get("Crank")!.rotation.x = this.crankAngle;
    rig.nodes.get("Pedal_L")!.rotation.x = -this.crankAngle;
    rig.nodes.get("Pedal_R")!.rotation.x = -this.crankAngle;
    rig.root.updateMatrixWorld(true);
    this.poseImportedSide(rig, "L");
    this.poseImportedSide(rig, "R");
  }

  private poseImportedSide(rig: ImportedBicycleRig, side: "L" | "R"): void {
    const root = rig.root;
    const point = (name: string) => attachmentPositionInRoot(root, rig.nodes.get(name)!, false);
    const hip = point(`Hip_${side}_Attach`);
    const foot = point(`Pedal_${side}_Attach`);
    const knee = hip.clone().lerp(foot, 0.48);
    knee.z -= 0.17 + Math.max(0, foot.y - 0.45) * 0.45;
    setDriverSegment(root, rig.nodes.get(`Rider_Thigh_${side}`)!, hip, knee);
    setDriverSegment(root, rig.nodes.get(`Rider_Shin_${side}`)!, knee, foot);
    setNodePositionFromRoot(root, rig.nodes.get(`Foot_${side}`)!, foot.clone().add(new THREE.Vector3(0, 0.025, -0.04)));

    const shoulder = point(`Shoulder_${side}_Attach`);
    const hand = point(`Grip_${side}_Attach`);
    const direction = side === "L" ? -1 : 1;
    const elbow = shoulder.clone().lerp(hand, 0.52).add(new THREE.Vector3(direction * 0.035, 0.06, 0.02));
    setDriverSegment(root, rig.nodes.get(`UpperArm_${side}`)!, shoulder, elbow);
    setDriverSegment(root, rig.nodes.get(`Forearm_${side}`)!, elbow, hand);
    setNodePositionFromRoot(root, rig.nodes.get(`Hand_${side}`)!, hand);
  }

  private updateRiderPose(crankAngle: number): void {
    const hips = [new THREE.Vector3(-0.075, 1.08, 0.33), new THREE.Vector3(0.075, 1.08, 0.33)];
    for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
      const phase = crankAngle + sideIndex * Math.PI;
      const foot = new THREE.Vector3(
        sideIndex === 0 ? -0.1 : 0.1,
        0.45 + Math.cos(phase) * 0.18,
        0.06 + Math.sin(phase) * 0.18,
      );
      const hip = hips[sideIndex]!;
      const knee = hip.clone().lerp(foot, 0.48);
      knee.z -= 0.17 + Math.max(0, Math.sin(phase)) * 0.08;
      setTube(this.limbs[sideIndex]!, hip, knee);
      setTube(this.limbs[sideIndex + 2]!, knee, foot);
      this.shoes[sideIndex]!.position.copy(foot).add(new THREE.Vector3(0, 0.025, -0.04));
    }
  }
}

export function makeObstacleVisual(obstacle: PrototypeObstacle): THREE.Group {
  const group = new THREE.Group();
  group.name = obstacle.label;
  group.position.set(obstacle.x, obstacle.y - 0.075, obstacle.z);

  const warning = new THREE.MeshStandardMaterial({ color: 0xf09032, roughness: 0.74 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xf8edcf, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263a35, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(obstacle.radius * 0.9, obstacle.radius, 0.12, 16), dark);
  base.position.y = 0.06;
  group.add(base);

  const postHeight = Math.max(0.7, obstacle.radius * 1.7);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(obstacle.radius * 0.58, postHeight, 16), warning);
  cone.position.y = 0.12 + postHeight / 2;
  group.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(obstacle.radius * 0.36, obstacle.radius * 0.45, 0.12, 16), pale);
  band.position.y = 0.12 + postHeight * 0.52;
  group.add(band);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}

function makeWheel(
  rubber: THREE.MeshStandardMaterial,
  metal: THREE.MeshStandardMaterial,
): THREE.Group {
  const wheel = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS, 0.025, 8, 28), rubber);
  tyre.rotation.y = Math.PI / 2;
  wheel.add(tyre);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS - 0.035, 0.009, 6, 28), metal);
  rim.rotation.y = Math.PI / 2;
  wheel.add(rim);
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    wheel.add(tube(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, Math.cos(angle) * (WHEEL_RADIUS - 0.04), Math.sin(angle) * (WHEEL_RADIUS - 0.04)),
      0.0035,
      metal,
    ));
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), metal);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  return wheel;
}

function tube(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function taperedTube(start: THREE.Vector3, end: THREE.Vector3, topRadius: number, bottomRadius: number, material: THREE.Material): THREE.Mesh {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, direction.length(), 10), material);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function setTube(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  const direction = end.clone().sub(start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.set(1, direction.length() / 0.4, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

function setDriverSegment(root: THREE.Object3D, node: THREE.Object3D, rootStart: THREE.Vector3, rootEnd: THREE.Vector3): void {
  const start = pointFromRootToParent(root, node, rootStart);
  const end = pointFromRootToParent(root, node, rootEnd);
  const direction = end.clone().sub(start);
  node.position.copy(start).add(end).multiplyScalar(0.5);
  node.scale.set(1, direction.length(), 1);
  node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

function setNodePositionFromRoot(root: THREE.Object3D, node: THREE.Object3D, point: THREE.Vector3): void {
  node.position.copy(pointFromRootToParent(root, node, point));
}

function pointFromRootToParent(root: THREE.Object3D, node: THREE.Object3D, point: THREE.Vector3): THREE.Vector3 {
  const worldPoint = root.localToWorld(point.clone());
  return node.parent ? node.parent.worldToLocal(worldPoint) : worldPoint;
}

function disposeBicycleResources(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    nodeMaterials.forEach((material) => materials.add(material));
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  textures.forEach((texture) => texture.dispose());
}
