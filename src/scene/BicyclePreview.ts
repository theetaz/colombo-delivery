import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { BicycleState } from "../game/bicycle";
import { BicycleVisual } from "./BicycleVisual";
import { cloneCharacterAppearance, loadCharacterAppearance, saveCharacterAppearance } from "../customizer/appearance";

type PreviewPose = "idle" | "pedal" | "coast" | "steer";

const host = document.querySelector<HTMLElement>("#bicycle-preview-canvas");
const status = document.querySelector<HTMLElement>("#bicycle-preview-status");
const appearanceStatus = document.querySelector<HTMLElement>("#appearance-status");
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-pose]")];
const cameraButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-camera]")];
const pauseButton = document.querySelector<HTMLButtonElement>("#preview-pause");
const saveAppearanceButton = document.querySelector<HTMLButtonElement>("#save-appearance");
if (!host || !status || !appearanceStatus) throw new Error("Bicycle preview mount points are missing.");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x617991);
scene.fog = new THREE.Fog(0x617991, 18, 45);
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 80);
camera.position.set(3.6, 2.45, 4.2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute("aria-label", "Orbitable animated courier bicycle and rider");
host.append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc9ddf2, 0x47584d, 2.6));
const key = new THREE.DirectionalLight(0xffd18f, 3);
key.position.set(-4, 7, -5);
scene.add(key);
const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x526755, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0.14;
ground.receiveShadow = true;
scene.add(ground);
const contactShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.78, 32),
  new THREE.MeshBasicMaterial({
    color: 0x203d3a,
    alphaMap: createContactShadowTexture(),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  }),
);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.scale.set(0.4, 1.15, 1);
contactShadow.position.set(0, 0.146, 0.04);
scene.add(contactShadow);

let loadMessage = "Procedural fallback visible · loading polished model…";
let appearance = cloneCharacterAppearance(loadCharacterAppearance());
const bicycle = new BicycleVisual((message) => {
  loadMessage = message;
  status.textContent = `${message} · drag to orbit · scroll to zoom`;
});
bicycle.group.rotation.y = 0.2;
scene.add(bicycle.group);
bicycle.setBackpackColor(appearance.colors.backpack);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.minDistance = 2.2;
controls.maxDistance = 11;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();
let cameraView: "front" | "side" | "rear" | "face" = "side";
let visualReady = false;
void bicycle.ready.then(() => {
  visualReady = true;
  frameBicycle(cameraView);
});

const backpackSelect = document.querySelector<HTMLSelectElement>("#appearance-backpack")!;
const backpackColor = document.querySelector<HTMLInputElement>("#appearance-backpack-color")!;
appearance.backpack = bicycle.getBackpackEnabled() ? "insulated" : "none";
backpackSelect.value = appearance.backpack;
backpackColor.value = appearance.colors.backpack;
backpackSelect.addEventListener("change", () => {
  appearance.backpack = backpackSelect.value === "insulated" ? "insulated" : "none";
  bicycle.setBackpackEnabled(appearance.backpack === "insulated");
  appearanceStatus.textContent = "Unsaved appearance changes";
});
backpackColor.addEventListener("input", () => {
  appearance.colors.backpack = backpackColor.value.toUpperCase();
  bicycle.setBackpackColor(appearance.colors.backpack);
  appearanceStatus.textContent = "Unsaved appearance changes";
});
saveAppearanceButton?.addEventListener("click", () => {
  const saved = saveCharacterAppearance(appearance);
  appearanceStatus.textContent = saved ? "Appearance applied and saved for the ride" : "Appearance applied · browser storage unavailable";
});

let pose: PreviewPose = "pedal";
let distance = 0;
let coastSpeed = 2.6;
let paused = false;
let lastTime = performance.now();
const state: BicycleState = {
  x: 0, y: 0, z: 0, heading: 0, speed: 2.6, steering: 0, distanceTravelled: 0,
  surface: "road", boundaryCollisions: 0, obstacleCollisions: 0, droppedSeconds: 0,
  lastCollision: null, lastObstacleId: null,
};

for (const button of buttons) {
  button.addEventListener("click", () => {
    pose = button.dataset.pose as PreviewPose;
    if (pose === "coast") coastSpeed = 2.6;
    buttons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    status.textContent = `${loadMessage} · ${pose} pose`;
  });
}
pauseButton?.addEventListener("click", () => {
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-pressed", String(paused));
});
for (const button of cameraButtons) {
  button.addEventListener("click", () => {
    const view = button.dataset.camera;
    cameraView = view === "front" || view === "rear" || view === "face" ? view : "side";
    frameBicycle(cameraView);
  });
}

function frameBicycle(view: "front" | "side" | "rear" | "face"): void {
  if (view === "face") {
    controls.minDistance = 0.65;
    controls.target.set(0, 1.7, -0.06);
    camera.position.set(0, 1.7, -1.7);
    camera.near = 0.03;
    camera.far = 30;
    camera.updateProjectionMatrix();
    controls.update();
    camera.lookAt(controls.target);
    camera.updateMatrixWorld(true);
    return;
  }
  const bounds = new THREE.Box3().setFromObject(bicycle.group);
  if (bounds.isEmpty()) return;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  controls.minDistance = 2.2;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.max(0.15, Math.min(verticalFov, horizontalFov));
  const distance = sphere.radius / Math.sin(limitingFov / 2) * 1.12;
  const direction = view === "front" ? new THREE.Vector3(0, 0.08, -1) : view === "rear" ? new THREE.Vector3(0, 0.08, 1) : new THREE.Vector3(1, 0.1, 0.04);
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(direction.normalize(), distance);
  camera.near = Math.max(0.02, distance - sphere.radius * 2.5);
  camera.far = Math.max(40, distance + sphere.radius * 5);
  camera.updateProjectionMatrix();
  controls.update();
  camera.lookAt(sphere.center);
  camera.updateMatrixWorld(true);
}

function resize(): void {
  const width = Math.max(host!.clientWidth, 1);
  const height = Math.max(host!.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (visualReady) frameBicycle(cameraView);
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(host);
resize();

renderer.setAnimationLoop((time) => {
  const deltaSeconds = Math.min(Math.max((time - lastTime) / 1000, 0), 0.05);
  lastTime = time;
  const pedalling = !paused && (pose === "pedal" || pose === "steer");
  if (paused) {
    state.speed = 0;
  } else if (pedalling) {
    state.speed = 2.6;
    distance += state.speed * deltaSeconds;
  } else if (pose === "coast") {
    coastSpeed = Math.max(0, coastSpeed - deltaSeconds * 0.5);
    state.speed = coastSpeed;
    distance += coastSpeed * deltaSeconds;
  } else state.speed = 0;
  if (!paused) state.steering = pose === "steer" ? Math.sin(time * 0.0014) : 0;
  state.distanceTravelled = distance;
  bicycle.update(state, { pedal: pedalling, deltaSeconds });
  controls.update();
  renderer.render(scene, camera);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    bicycle.dispose();
    resizeObserver.disconnect();
    renderer.setAnimationLoop(null);
    controls.dispose();
    disposeScene(scene);
    renderer.dispose();
  });
}

function disposeScene(root: THREE.Object3D): void {
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

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.58, "rgba(255,255,255,0.48)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}
