import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  COMMUTER_BICYCLE_V2_URL,
  validateCommuterBicycle,
} from "./CommuterBicycleModel";
import {
  SEATED_COURIER_V2_REVISION,
  SEATED_COURIER_V2_URL,
  validateSeatedCourier,
} from "./SeatedCourierModel";

const host = document.querySelector<HTMLElement>("#rider-fit-canvas")!,
  status = document.querySelector<HTMLElement>("#fit-status")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e5dc);
const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.domElement.setAttribute(
  "aria-label",
  "Orbitable static seated courier and approved bicycle",
);
host.prepend(renderer.domElement);
const room = new RoomEnvironment(),
  pmrem = new THREE.PMREMGenerator(renderer),
  environment = pmrem.fromScene(room, 0.04);
room.dispose();
pmrem.dispose();
scene.environment = environment.texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8d938b, 2.4));
const key = new THREE.DirectionalLight(0xfff4dd, 3.2);
key.position.set(-4, 7, -4);
key.castShadow = true;
scene.add(key);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(5, 64),
  new THREE.MeshStandardMaterial({ color: 0xd8d4ca, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.2;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.49;
const abort = new AbortController();
let pair: THREE.Group | null = null,
  rider: THREE.Object3D | null = null,
  disposed = false,
  moved = false,
  currentView = "three-quarter";
const riderToggle = document.querySelector<HTMLInputElement>("#show-rider")!;
Promise.allSettled([
  new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}${COMMUTER_BICYCLE_V2_URL}`,
  ),
  new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}${SEATED_COURIER_V2_URL}`,
  ),
])
  .then(([bikeResultLoad, riderResultLoad]) => {
    if (
      bikeResultLoad.status === "rejected" ||
      riderResultLoad.status === "rejected"
    ) {
      if (bikeResultLoad.status === "fulfilled")
        disposeObject(bikeResultLoad.value.scene);
      if (riderResultLoad.status === "fulfilled")
        disposeObject(riderResultLoad.value.scene);
      const failure =
        bikeResultLoad.status === "rejected" ? bikeResultLoad : riderResultLoad;
      throw failure.status === "rejected"
        ? failure.reason
        : new Error("asset load failed");
    }
    const bikeLoad = bikeResultLoad.value;
    const riderLoad = riderResultLoad.value;
    if (disposed) {
      disposeObject(bikeLoad.scene);
      disposeObject(riderLoad.scene);
      return;
    }
    const bikeResult = validateCommuterBicycle(bikeLoad.scene),
      riderResult = validateSeatedCourier(riderLoad.scene);
    if (!bikeResult.ok || !riderResult.ok) {
      disposeObject(bikeLoad.scene);
      disposeObject(riderLoad.scene);
      throw new Error(
        `missing ${[...(!bikeResult.ok ? bikeResult.missing : []), ...(!riderResult.ok ? riderResult.missing : [])].join(", ")}`,
      );
    }
    pair = new THREE.Group();
    pair.name = "Static rider fit review";
    rider = riderLoad.scene;
    rider.visible = riderToggle.checked;
    pair.add(bikeLoad.scene, rider);
    pair.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    scene.add(pair);
    frame("three-quarter");
    status.textContent = "Rejected fit loaded for comparison · use the clean-rig checkpoint";
  })
  .catch((error) => {
    if (!disposed)
      status.textContent = `Fit review unavailable · ${error instanceof Error ? error.message : "load failed"}`;
  });
const directions: Record<string, THREE.Vector3> = {
  "three-quarter": new THREE.Vector3(1, 0.35, 1),
  front: new THREE.Vector3(0, 0.12, -1),
  drive: new THREE.Vector3(1, 0.12, 0),
  opposite: new THREE.Vector3(-1, 0.12, 0),
  rear: new THREE.Vector3(0, 0.12, 1),
};
function frame(view: string) {
  if (!pair) return;
  currentView = view;
  const sphere = new THREE.Box3()
      .setFromObject(pair, true)
      .getBoundingSphere(new THREE.Sphere()),
    vertical = THREE.MathUtils.degToRad(camera.fov),
    horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect),
    distance =
      (sphere.radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.14;
  controls.target.copy(sphere.center);
  camera.position
    .copy(sphere.center)
    .addScaledVector(
      (directions[view] ?? directions["three-quarter"]!).clone().normalize(),
      distance,
    );
  controls.update();
}
controls.addEventListener("start", () => (moved = true));
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) =>
  button.addEventListener(
    "click",
    () => {
      document
        .querySelectorAll("[data-view]")
        .forEach((candidate) =>
          candidate.setAttribute("aria-pressed", String(candidate === button)),
        );
      frame(button.dataset.view!);
    },
    { signal: abort.signal },
  ),
);
document.querySelector("#fit-reset")?.addEventListener(
  "click",
  () => {
    moved = false;
    document
      .querySelectorAll("[data-view]")
      .forEach((candidate, index) =>
        candidate.setAttribute("aria-pressed", String(index === 0)),
      );
    frame("three-quarter");
  },
  { signal: abort.signal },
);
riderToggle.addEventListener(
  "change",
  (event) => {
    if (rider)
      rider.visible = (event.currentTarget as HTMLInputElement).checked;
  },
  { signal: abort.signal },
);
const notes = document.querySelector<HTMLTextAreaElement>("#fit-notes")!,
  noteText = () =>
    `Colombo Delivery rider fit review\nRevision: ${SEATED_COURIER_V2_REVISION}\n\n${notes.value.trim() || "No notes entered."}\n`;
document.querySelector("#copy-fit-notes")?.addEventListener(
  "click",
  async () => {
    try {
      await navigator.clipboard.writeText(noteText());
      status.textContent = "Fit notes copied";
    } catch {
      status.textContent = "Copy unavailable · select the notes manually";
    }
  },
  { signal: abort.signal },
);
document.querySelector("#download-fit-notes")?.addEventListener(
  "click",
  () => {
    const url = URL.createObjectURL(
        new Blob([noteText()], { type: "text/plain" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "teen-courier-seated-v2-review.txt";
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "Fit notes downloaded";
  },
  { signal: abort.signal },
);
function resize() {
  camera.aspect =
    Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  if (pair && !moved) frame(currentView);
}
const observer = new ResizeObserver(resize);
observer.observe(host);
resize();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    abort.abort();
    observer.disconnect();
    renderer.setAnimationLoop(null);
    controls.dispose();
    if (pair) disposeObject(pair);
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    environment.dispose();
    renderer.dispose();
  },
  { once: true },
);
function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material])
      materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
}
