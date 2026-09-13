import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BicycleMechanics,
  COMMUTER_BICYCLE_V2_REVISION,
  COMMUTER_BICYCLE_V2_URL,
  validateCommuterBicycle,
} from "./CommuterBicycleModel";

const host = document.querySelector<HTMLElement>("#bicycle-model-canvas")!,
  status = document.querySelector<HTMLElement>("#review-status")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e5dc);
const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 50),
  renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.domElement.setAttribute(
  "aria-label",
  "Orbitable commuter bicycle model",
);
host.prepend(renderer.domElement);
const room = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(room, 0.04);
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
controls.minDistance = 1;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 0.49;
const abort = new AbortController();
let model: THREE.Object3D | null = null;
let mechanics: BicycleMechanics | null = null;
let wheel = 0,
  crank = 0,
  last = performance.now();
let spin = false,
  drive = false,
  disposed = false,
  cameraMoved = false;
let currentView = "three-quarter";
const steering = document.querySelector<HTMLInputElement>("#steering")!;

void new GLTFLoader()
  .loadAsync(`${import.meta.env.BASE_URL}${COMMUTER_BICYCLE_V2_URL}`)
  .then(({ scene: loaded }) => {
    if (disposed) {
      disposeObject(loaded);
      return;
    }
    const result = validateCommuterBicycle(loaded);
    if (!result.ok) {
      disposeObject(loaded);
      throw new Error(`missing ${result.missing.join(", ")}`);
    }
    loaded.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    model = loaded;
    mechanics = new BicycleMechanics(result.nodes);
    scene.add(loaded);
    frame("three-quarter");
    status.textContent = "Awaiting your review · model ready";
  })
  .catch((error) => {
    if (!disposed)
      status.textContent = `Model unavailable · ${error instanceof Error ? error.message : "load failed"}`;
  });

const directions: Record<string, THREE.Vector3> = {
  "three-quarter": new THREE.Vector3(1, 0.42, 1),
  front: new THREE.Vector3(0, 0.16, -1),
  drive: new THREE.Vector3(1, 0.16, 0),
  opposite: new THREE.Vector3(-1, 0.16, 0),
  rear: new THREE.Vector3(0, 0.16, 1),
};
function frame(view: string) {
  if (!model) return;
  currentView = view;
  const sphere = new THREE.Box3()
    .setFromObject(model, true)
    .getBoundingSphere(new THREE.Sphere());
  const vertical = THREE.MathUtils.degToRad(camera.fov);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const distance =
    (sphere.radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.14;
  controls.target.copy(sphere.center);
  camera.position
    .copy(sphere.center)
    .addScaledVector(
      (directions[view] ?? directions["three-quarter"]!).clone().normalize(),
      distance,
    );
  camera.near = 0.02;
  camera.far = 50;
  camera.updateProjectionMatrix();
  controls.update();
}
controls.addEventListener("start", () => {
  cameraMoved = true;
});
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
document.querySelector("#reset-view")?.addEventListener(
  "click",
  () => {
    cameraMoved = false;
    document
      .querySelectorAll("[data-view]")
      .forEach((candidate, index) =>
        candidate.setAttribute("aria-pressed", String(index === 0)),
      );
    frame("three-quarter");
  },
  { signal: abort.signal },
);
document
  .querySelector<HTMLInputElement>("#spin-wheels")!
  .addEventListener(
    "change",
    (event) => (spin = (event.currentTarget as HTMLInputElement).checked),
    { signal: abort.signal },
  );
document
  .querySelector<HTMLInputElement>("#run-drivetrain")!
  .addEventListener(
    "change",
    (event) => (drive = (event.currentTarget as HTMLInputElement).checked),
    { signal: abort.signal },
  );
document.querySelector("#stop-reset")?.addEventListener(
  "click",
  () => {
    spin = drive = false;
    wheel = crank = 0;
    steering.value = "0";
    document.querySelector<HTMLInputElement>("#spin-wheels")!.checked = false;
    document.querySelector<HTMLInputElement>("#run-drivetrain")!.checked =
      false;
    mechanics?.apply(0, 0, 0);
  },
  { signal: abort.signal },
);
const notes = document.querySelector<HTMLTextAreaElement>("#review-notes")!,
  noteText = () =>
    `Colombo Delivery bicycle review\nRevision: ${COMMUTER_BICYCLE_V2_REVISION}\n\n${notes.value.trim() || "No notes entered."}\n`;
document.querySelector("#copy-notes")?.addEventListener(
  "click",
  async () => {
    try {
      await navigator.clipboard.writeText(noteText());
      status.textContent = "Review notes copied";
    } catch {
      status.textContent = "Copy unavailable · select the notes manually";
    }
  },
  { signal: abort.signal },
);
document.querySelector("#download-notes")?.addEventListener(
  "click",
  () => {
    const url = URL.createObjectURL(
        new Blob([noteText()], { type: "text/plain" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "commuter-bicycle-v2-review.txt";
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "Review notes downloaded";
  },
  { signal: abort.signal },
);
function resize() {
  camera.aspect =
    Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  if (model && !cameraMoved) frame(currentView);
}
const observer = new ResizeObserver(resize);
observer.observe(host);
resize();
renderer.setAnimationLoop((time) => {
  const delta = Math.min(Math.max((time - last) / 1000, 0), 0.05);
  last = time;
  if (spin) wheel -= delta * 4;
  if (drive) crank -= delta * 2;
  mechanics?.apply(wheel, crank, Number(steering.value));
  controls.update();
  renderer.render(scene, camera);
});
window.addEventListener(
  "pagehide",
  () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    observer.disconnect();
    renderer.setAnimationLoop(null);
    controls.dispose();
    if (model) disposeObject(model);
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    environment.dispose();
    renderer.dispose();
  },
  { once: true },
);
function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material])
      material.dispose();
  });
}
