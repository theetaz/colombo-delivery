import "../style.css";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const EXPECTED = ["Shop_Ochre", "Shop_CreamTeal", "BoundaryWall_Gate", "ShadeTree", "PalmTree", "UtilityPole_Lamp", "PottedPlant_A", "PottedPlant_B", "TukTuk_Parked", "LotusTower"];
const host = document.querySelector<HTMLElement>("#art-preview-canvas")!;
const previewStatus = document.querySelector<HTMLElement>("#art-preview-status")!;
if (!host || !previewStatus) throw new Error("Art preview mount points are missing.");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3cfa1);
const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 300);
camera.position.set(25, 16, 31);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.setAttribute("aria-label", "Orbitable preview of the Colombo scenery kit");
host.append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xfff4d8, 0x526f61, 2.35));
const key = new THREE.DirectionalLight(0xffdfaa, 3.15);
key.position.set(-18, 32, -14);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -35;
key.shadow.camera.right = 35;
key.shadow.camera.top = 35;
key.shadow.camera.bottom = -35;
scene.add(key);
const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 64), new THREE.MeshStandardMaterial({ color: 0x789b72, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3.5, 0);
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 75;
controls.maxPolarAngle = Math.PI * 0.49;
let disposed = false;
let userHasFramedScene = false;
const kitGroup = new THREE.Group();
kitGroup.name = "Scenery kit contact sheet";
scene.add(kitGroup);
controls.addEventListener("start", () => {
  userHasFramedScene = true;
});

async function loadKit(): Promise<void> {
  previewStatus.innerHTML = "Loading the scenery kit…";
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/colombo_scenery_kit.glb`);
    if (disposed) {
      disposeObjectResources(gltf.scene);
      return;
    }
    const catalog = new Map(gltf.scene.children.map((child) => [child.name, child]));
    const missing = EXPECTED.filter((name) => !catalog.has(name));
    const available = EXPECTED.filter((name) => catalog.has(name));
    available.forEach((name, index) => {
      const object = catalog.get(name)!.clone(true);
      const column = index % 5;
      const row = Math.floor(index / 5);
      object.position.set((column - 2) * 9, 0, (row - 0.5) * 13);
      if (name === "LotusTower") object.scale.setScalar(0.035);
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      kitGroup.add(object);
    });
    if (available.length === 0) throw new Error("No expected named roots were found in the GLB.");
    frameKit();
    previewStatus.textContent = missing.length === 0
      ? `${available.length} reusable pieces · neutral asset light`
      : `${available.length} pieces loaded · missing: ${missing.join(", ")}`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown asset error";
    previewStatus.textContent = `Could not load the scenery kit: ${detail}. `;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => void loadKit(), { once: true });
    previewStatus.append(retry);
  }
}

function resize(): void {
  const width = Math.max(host.clientWidth, 1);
  const height = Math.max(host.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (!userHasFramedScene && kitGroup.children.length > 0) frameKit();
}

function frameKit(): void {
  const bounds = new THREE.Box3().setFromObject(kitGroup);
  if (bounds.isEmpty()) return;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.max(0.15, Math.min(verticalFov, horizontalFov));
  const distance = sphere.radius / Math.sin(limitingFov / 2) * 1.08;
  const direction = new THREE.Vector3(0.48, 0.31, 0.82).normalize();
  controls.target.copy(sphere.center);
  controls.maxDistance = Math.max(75, distance * 1.4);
  camera.position.copy(sphere.center).addScaledVector(direction, distance);
  camera.near = 0.08;
  camera.far = Math.max(300, distance + sphere.radius * 4);
  camera.updateProjectionMatrix();
  controls.update();
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(host);
resize();
void loadKit();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    resizeObserver.disconnect();
    renderer.setAnimationLoop(null);
    controls.dispose();
    disposeObjectResources(scene);
    renderer.dispose();
  });
}

function disposeObjectResources(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
    material.dispose();
  }
}
