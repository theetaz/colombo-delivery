import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { RIDING_COURIER_CONTRACT, loadedNodeName, ridingGripTarget, ridingPedalTarget, solveArmContactPreservingHand, solveCcdContact, solveLegContactPreservingFoot, validateRidingCourier } from "../src/scene/RidingCourier";

test("riding courier validator requires the contact and animation contract", () => {
  const root = new THREE.Group();
  root.name = "TeenCourierRig";
  const result = validateRidingCourier(root, []);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.missing.includes("Backpack_Attach"));
    assert.ok(result.missing.includes("FootContact_L"));
    assert.ok(result.missing.includes("animation:PedalCycle"));
  }
});

test("GLTFLoader-sanitized provider bones resolve through the runtime contract", async () => {
  (globalThis as typeof globalThis & { self: typeof globalThis }).self = globalThis;
  const bytes = await readFile(new URL("../public/models/teen_courier_riding.glb", import.meta.url));
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const gltf = await new GLTFLoader().parseAsync(data, "");
  assert.equal(gltf.scene.getObjectByName("tripo::1_Left_Limb_2"), undefined, "loader sanitizes authored colons");
  assert.ok(gltf.scene.getObjectByName(loadedNodeName("tripo::1_Left_Limb_2")));
  const validation = validateRidingCourier(gltf.scene, gltf.animations);
  assert.equal(validation.ok, true);
  if (validation.ok) {
    for (const name of ["tripo::1_Left_Limb_2", "tripo::0_Right_Limb_0"] as const) assert.ok(validation.nodes.get(name));
    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(validation.clip).play();
    for (let frame = 0; frame < 24; frame += 1) {
      const crankAngle = frame / 24 * Math.PI * 2;
      mixer.setTime(frame / 24 * validation.clip.duration);
      gltf.scene.updateMatrixWorld(true);
      for (const side of ["L", "R"] as const) {
        const word = side === "L" ? "Left" : "Right";
        const foot = validation.nodes.get(`tripo::0_${word}_Limb_2`)!;
        const before = foot.getWorldQuaternion(new THREE.Quaternion());
        const residual = solveLegContactPreservingFoot(
          gltf.scene,
          validation.nodes.get(`FootContact_${side}`),
          foot,
          [validation.nodes.get(`tripo::0_${word}_Limb_1`), validation.nodes.get(`tripo::0_${word}_Limb_0`)],
          ridingPedalTarget(side, crankAngle),
        );
        assert.ok(residual < 0.001, `${side} sole misses pedal by ${residual}m at frame ${frame}`);
        assert.ok(before.angleTo(foot.getWorldQuaternion(new THREE.Quaternion())) < 0.009, `${side} foot world orientation drifted at frame ${frame}`);
        const knee = gltf.scene.worldToLocal(validation.nodes.get(`tripo::0_${word}_Limb_1`)!.getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(knee.x) < 0.2, `${side} knee flares ${knee.x}m sideways at frame ${frame}`);
        assert.ok(side === "L" ? knee.x < -0.04 : knee.x > 0.04, `${side} knee crosses the bicycle center at frame ${frame}`);
      }
    }
    for (const steering of [-1, 0, 1]) {
      mixer.setTime(0);
      for (const side of ["L", "R"] as const) {
        const word = side === "L" ? "Left" : "Right";
        const result = solveArmContactPreservingHand(
          gltf.scene,
          validation.nodes.get(`HandContact_${side}`),
          validation.nodes.get(`tripo::1_${word}_Limb_2`),
          [validation.nodes.get(`tripo::1_${word}_Limb_1`), validation.nodes.get(`tripo::1_${word}_Limb_0`), validation.nodes.get(side === "L" ? "bone_8" : "bone_29")],
          ridingGripTarget(side, steering),
          steering,
        );
        assert.ok(result.residual < 0.04, `${side} palm misses steered grip by ${result.residual}m at steering ${steering}`);
        assert.ok(result.orientationError < 0.009, `${side} hand twists ${result.orientationError}rad away from the steered grip orientation`);
      }
      if (Math.abs(steering) === 1) {
        const stretch = maximumSkinnedTriangleStretch(gltf.scene);
        assert.ok(stretch.spikeEdge < 0.12, `steering ${steering} creates a ${stretch.spikeEdge}m arm-influenced spike from a short mesh edge on ${stretch.mesh}`);
      }
    }
    mixer.stopAllAction();
  }
});

test("CCD guard treats missing loaded nodes as an unavailable contact instead of throwing", () => {
  assert.equal(solveCcdContact(new THREE.Group(), undefined, [undefined], new THREE.Vector3()), Number.POSITIVE_INFINITY);
});

test("steering grip arc and CCD keep a reachable palm on both turned bars", () => {
  for (const steering of [-0.3, 0, 0.3]) {
    const left = ridingGripTarget("L", steering);
    const right = ridingGripTarget("R", steering);
    assert.ok(Math.abs(left.distanceTo(new THREE.Vector3(0, 1.04, -0.54)) - Math.hypot(0.22, 0.13)) < 1e-9);
    assert.ok(Math.abs(right.distanceTo(new THREE.Vector3(0, 1.04, -0.54)) - Math.hypot(0.22, 0.13)) < 1e-9);
  }

  const root = new THREE.Group();
  const shoulder = new THREE.Bone();
  const elbow = new THREE.Bone();
  const wrist = new THREE.Bone();
  const palm = new THREE.Object3D();
  elbow.position.x = 0.3;
  wrist.position.x = 0.3;
  palm.position.x = 0.2;
  root.add(shoulder);
  shoulder.add(elbow);
  elbow.add(wrist);
  wrist.add(palm);
  root.updateMatrixWorld(true);
  const residual = solveCcdContact(root, palm, [wrist, elbow, shoulder], new THREE.Vector3(0.55, 0.42, 0), 24);
  assert.ok(residual < 1e-4, `CCD palm residual ${residual} must be sub-millimetre`);
});

test("exported detailed rider retains its skin, closed pedal cycle, and contact markers", async () => {
  const bytes = await readFile(new URL("../public/models/teen_courier_riding.glb", import.meta.url));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as GlbDocument;
  assert.equal(gltf.skins.length, 1);
  assert.equal(gltf.skins[0]!.joints.length, 19, "approved mesh uses the clean riding rig with paired clavicle controls");
  for (const name of ["Backpack_Attach", "HandContact_L", "HandContact_R", "FootContact_L", "FootContact_R"]) {
    assert.ok(gltf.nodes.some((node) => node.name === name), `missing ${name}`);
  }
  const animation = gltf.animations.find(({ name }) => name === RIDING_COURIER_CONTRACT.animation);
  assert.ok(animation, "one-revolution PedalCycle is exported");
  assert.ok(animation!.channels.length >= 12, "cycle drives complete paired limb chains");
  const timeAccessors = new Set(animation!.samplers.map(({ input }) => input));
  const maxTime = Math.max(...[...timeAccessors].map((index) => gltf.accessors[index]!.max?.[0] ?? 0));
  assert.ok(Math.abs(maxTime - 1) < 1e-4, `cycle duration ${maxTime} must be one second`);

  const animatedNodes = new Set(animation!.channels.map(({ target }) => gltf.nodes[target.node]?.name));
  for (const bone of [
    "tripo::0_Left_Limb_0", "tripo::0_Left_Limb_1", "tripo::0_Right_Limb_0", "tripo::0_Right_Limb_1",
    "tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1",
  ]) assert.ok(animatedNodes.has(bone), `${bone} must be baked into the riding cycle`);
});

interface GlbDocument {
  nodes: Array<{ name?: string }>;
  skins: Array<{ joints: number[] }>;
  accessors: Array<{ max?: number[] }>;
  animations: Array<{
    name?: string;
    channels: Array<{ sampler: number; target: { node: number; path: string } }>;
    samplers: Array<{ input: number; output: number }>;
  }>;
}

function maximumSkinnedTriangleStretch(root: THREE.Object3D): { spikeEdge: number; ratio: number; mesh: string; vertices: [number, number]; restEdge: number; posed: [number[], number[]] } {
  let maximum = { spikeEdge: 0, ratio: 0, mesh: "", vertices: [0, 0] as [number, number], restEdge: 0, posed: [[], []] as [number[], number[]] };
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const positions = object.geometry.getAttribute("position");
    const skinIndex = object.geometry.getAttribute("skinIndex");
    const index = object.geometry.index;
    const triangleVertex = (offset: number) => index ? index.getX(offset) : offset;
    const local = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const posed = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let offset = 0; offset + 2 < (index?.count ?? positions.count); offset += 3) {
      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = triangleVertex(offset + corner);
        local[corner]!.fromBufferAttribute(positions, vertex);
        object.applyBoneTransform(vertex, posed[corner]!.copy(local[corner]!));
        object.localToWorld(posed[corner]!);
      }
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as const) {
        const vertices = [triangleVertex(offset + a), triangleVertex(offset + b)] as const;
        const armInfluenced = vertices.some((vertex) => [0, 1, 2, 3].some((slot) => {
          const boneIndex = skinIndex.getComponent(vertex, slot);
          return /tripo1_|bone_(?:8|29)$/.test(object.skeleton.bones[boneIndex]?.name ?? "");
        }));
        if (!armInfluenced) continue;
        const restLength = local[a]!.distanceTo(local[b]!);
        if (restLength < 1e-5) continue;
        const edge = posed[a]!.distanceTo(posed[b]!);
        const ratio = edge / restLength;
        if (ratio > maximum.ratio) maximum = {
          spikeEdge: maximum.spikeEdge, ratio, mesh: object.name,
          vertices: [...vertices], restEdge: restLength,
          posed: [posed[a]!.toArray(), posed[b]!.toArray()],
        };
        if (restLength < 0.03 && edge > maximum.spikeEdge) maximum.spikeEdge = edge;
      }
    }
  });
  return maximum;
}
