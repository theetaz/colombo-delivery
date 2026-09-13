import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type ModelMode = "original" | "neutral" | "lean";
type ReviewView = "front" | "side" | "back" | "face";

const REVISION = "teen-courier-clean-rig/1";
const models: Record<ModelMode, { label: string; url: string }> = {
  original: { label: "Original standing", url: "models/teen_courier.glb" },
  neutral: { label: "New neutral", url: "models/teen_courier_clean_rig_neutral.glb?v=64f17c69" },
  lean: { label: "Forward lean", url: "models/teen_courier_clean_rig_upper_body.glb?v=d9a6f860" },
};
const host = document.querySelector<HTMLElement>("#character-rig-canvas")!;
const status = document.querySelector<HTMLElement>("#rig-status")!;
const notes = document.querySelector<HTMLTextAreaElement>("#rig-notes")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e5dc);
const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.domElement.setAttribute("aria-label", "Orbitable upper-body clean rig review");
host.prepend(renderer.domElement);
const room = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(room, 0.04);
room.dispose();
pmrem.dispose();
scene.environment = environment.texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x858c87, 2.5));
const key = new THREE.DirectionalLight(0xfff2dc, 3);
key.position.set(-4, 7, -4);
key.castShadow = true;
scene.add(key);
const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: 0xd8d4ca, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.45;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.5;
const loader = new GLTFLoader();
const abort = new AbortController();
let asset: THREE.Object3D | null = null;
let mode: ModelMode = "neutral";
let view: ReviewView = "front";
let generation = 0;
let disposed = false;

async function showModel(nextMode: ModelMode): Promise<void> {
  const request = ++generation;
  status.textContent = `Loading ${models[nextMode].label.toLowerCase()}…`;
  try {
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}${models[nextMode].url}`);
    if (disposed || request !== generation) return disposeObject(gltf.scene);
    const next = gltf.scene;
    if (
      nextMode !== "original" &&
      (!next.getObjectByName("TeenCourier_CleanRig") ||
        !next.getObjectByName("TeenCourier_Body"))
    ) {
      disposeObject(next);
      throw new Error("clean-rig root or body is missing");
    }
    next.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    const bounds = new THREE.Box3().setFromObject(next, true);
    if (bounds.isEmpty()) {
      disposeObject(next);
      throw new Error("model has no visible geometry");
    }
    next.position.y -= bounds.min.y;
    if (asset) {
      scene.remove(asset);
      disposeObject(asset);
    }
    asset = next;
    mode = nextMode;
    scene.add(asset);
    document
      .querySelectorAll<HTMLButtonElement>("[data-model]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.model === nextMode),
        ),
      );
    frame(view);
    const cleanRig = nextMode !== "original";
    status.textContent = `${models[nextMode].label} loaded · ${cleanRig ? "upper-body checkpoint" : "appearance reference only"}`;
  } catch (error) {
    if (disposed || request !== generation) return;
    status.textContent = `Review model unavailable · ${error instanceof Error ? error.message : "load failed"}`;
  }
}

function frame(nextView: ReviewView): void {
  if (!asset) return;
  view = nextView;
  const face = nextView === "face";
  const center = new THREE.Vector3(0, 0.81, 0);
  const headFocus = asset.getObjectByName("HeadFocus");
  if (face && headFocus) {
    headFocus.getWorldPosition(center);
    center.y -= 0.04;
  } else if (face) center.set(0, 1.435, 0.07);
  const direction = {
    front: new THREE.Vector3(0, 0.03, -1),
    side: new THREE.Vector3(1, 0.03, 0),
    back: new THREE.Vector3(0, 0.03, 1),
    face: new THREE.Vector3(0, 0, -1),
  }[nextView];
  const fullHeightDistance =
    0.81 * 1.12 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const distance = (face ? 0.78 : fullHeightDistance) / Math.min(camera.aspect, 1);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, Math.max(distance, 0.65));
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = Math.max(distance * 10, 20);
  camera.updateProjectionMatrix();
  controls.update();
}

document.querySelectorAll<HTMLButtonElement>("[data-model]").forEach((button) => {
  button.addEventListener("click", () => {
    void showModel(button.dataset.model as ModelMode);
  }, { signal: abort.signal });
});
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    frame(button.dataset.view as ReviewView);
  }, { signal: abort.signal });
});
const noteText = () => `Colombo Delivery clean rig upper-body review\nRevision: ${REVISION}\nModel: ${models[mode].label}\n\n${notes.value.trim() || "No notes entered."}\n`;
document.querySelector("#copy-rig-notes")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(noteText());
    status.textContent = "Review notes copied";
  } catch {
    status.textContent = "Copy unavailable · select the notes manually";
  }
}, { signal: abort.signal });
document.querySelector("#download-rig-notes")?.addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([noteText()], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "teen-courier-clean-rig-review.txt";
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = "Review notes downloaded";
}, { signal: abort.signal });

function resize(): void {
  camera.aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight, false);
}
const observer = new ResizeObserver(resize);
observer.observe(host);
resize();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
void showModel("neutral");

window.addEventListener("pagehide", () => {
  disposed = true;
  generation += 1;
  abort.abort();
  observer.disconnect();
  renderer.setAnimationLoop(null);
  controls.dispose();
  if (asset) disposeObject(asset);
  ground.geometry.dispose();
  (ground.material as THREE.Material).dispose();
  environment.dispose();
  renderer.dispose();
}, { once: true });

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
}
