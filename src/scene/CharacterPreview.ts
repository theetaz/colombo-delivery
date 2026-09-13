import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type ReviewView = "full" | "head" | "side" | "back";

const DEFAULT_MODEL_PATH = "models/teen_courier.glb";
const host = document.querySelector<HTMLElement>("#character-preview-canvas")!;
const status = document.querySelector<HTMLElement>("#asset-status")!;
const details = document.querySelector<HTMLElement>("#asset-details")!;
const animationSection = document.querySelector<HTMLElement>("#animation-section")!;
const animationControls = document.querySelector<HTMLElement>("#animation-controls")!;
const morphSection = document.querySelector<HTMLElement>("#morph-section")!;
const morphControls = document.querySelector<HTMLElement>("#morph-controls")!;
const materialSection = document.querySelector<HTMLElement>("#material-section")!;
const inspectionSection = document.querySelector<HTMLElement>("#inspection-section")!;
const clayToggle = document.querySelector<HTMLButtonElement>("#clay-toggle")!;
if (!host || !status || !details) throw new Error("Character preview mount points are missing.");

const requestedPath = new URLSearchParams(location.search).get("model")?.trim();
const modelUrl = requestedPath || `${import.meta.env.BASE_URL}${DEFAULT_MODEL_PATH}`;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd4d7d4);
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.domElement.setAttribute("aria-label", "Orbitable character asset review");
host.append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xf6f7f3, 0x78817c, 2.25));
const key = new THREE.DirectionalLight(0xfff1db, 2.35);
key.position.set(-3, 5, -4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xcbdcf1, 1.15);
fill.position.set(4, 2, 3);
scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: 0xb9bfba, roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.006;
scene.add(floor);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.5;
let asset: THREE.Object3D | null = null;
let bounds = new THREE.Box3();
let activeView: ReviewView = "full";
let mixer: THREE.AnimationMixer | null = null;
let disposed = false;
let lastFrameTime = performance.now();
let clayEnabled = false;
const clayMaterial = new THREE.MeshStandardMaterial({ color: 0xb9afa2, roughness: 0.82, metalness: 0 });
const authoredMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
const editableMaterials = new Map<string, THREE.MeshStandardMaterial[]>();
const tintUniforms = {
  skin: { value: new THREE.Color(0xa86d52) }, shirt: { value: new THREE.Color(0x267789) }, shoes: { value: new THREE.Color(0xe2e0d8) },
  mix: { value: new THREE.Vector3() }, valueScale: { value: new THREE.Vector3(1, 1, 1) }, mask: { value: null as THREE.Texture | null },
};
const PALETTE_BASE = { skin: new THREE.Color(0xa86d52), shirt: new THREE.Color(0x267789), shoes: new THREE.Color(0xe2e0d8) };

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-view]")) {
  button.addEventListener("click", () => {
    activeView = button.dataset.view as ReviewView;
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    frameAsset(activeView);
  });
}

void new GLTFLoader().loadAsync(modelUrl).then(async (gltf) => {
  if (disposed) return disposeObjectResources(gltf.scene);
  asset = gltf.scene;
  asset.name = "Character review asset";
  isolateEditableMaterials(asset);
  scene.add(asset);
  bounds = new THREE.Box3().setFromObject(asset);
  if (bounds.isEmpty()) throw new Error("The model contains no visible geometry.");
  const size = bounds.getSize(new THREE.Vector3());
  asset.position.y -= bounds.min.y;
  bounds = new THREE.Box3().setFromObject(asset);
  setupAnimations(asset, gltf.animations);
  const morphCount = setupMorphControls(asset);
  const manifest = await loadReviewManifest();
  const customization = validateCustomization(asset.getObjectByName("TeenCourier")?.userData.customization);
  if (manifest?.customization?.ready && customization) {
    tintUniforms.mask.value = await gltf.parser.getDependency("texture", customization.maskTextureIndex) as THREE.Texture;
    installMaskedTintShaders(asset, customization.channels);
  }
  if (disposed) {
    scene.remove(asset);
    disposeObjectResources(asset);
    asset = null;
    return;
  }
  setupMaterialControls(Boolean(manifest?.customization?.ready && customization && tintUniforms.mask.value));
  setupClayInspection();
  const skinnedMeshCount = countSkinnedMeshes(asset);
  status.textContent = skinnedMeshCount > 0 ? "Skinned character review loaded" : "Static character review loaded · rig pending";
  details.textContent = `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m · ${skinnedMeshCount} skinned mesh${skinnedMeshCount === 1 ? "" : "es"} · ${gltf.animations.length} animation clip${gltf.animations.length === 1 ? "" : "s"} · ${morphCount} facial shape${morphCount === 1 ? "" : "s"}${manifest?.customization?.ready ? " · color-ready regions: skin, shirt, shoes" : ""}`;
  frameAsset(activeView);
}).catch((error: unknown) => {
  if (asset) {
    scene.remove(asset);
    disposeObjectResources(asset);
    asset = null;
  }
  const message = error instanceof Error ? error.message : "unknown asset error";
  const missingDraft = /Unexpected token|fetch for .* responded with 404/i.test(message);
  status.textContent = missingDraft ? "The current character reconstruction is not available yet." : "Character asset could not load.";
  details.textContent = missingDraft ? `Waiting for ${modelUrl}` : message;
});

function setupAnimations(root: THREE.Object3D, clips: THREE.AnimationClip[]): void {
  if (clips.length === 0) return;
  animationSection.hidden = false;
  mixer = new THREE.AnimationMixer(root);
  for (const [index, clip] of clips.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = clip.name || `Clip ${index + 1}`;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      mixer!.stopAllAction();
      mixer!.clipAction(clip).reset().play();
      animationControls.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    });
    animationControls.append(button);
  }
}

function setupMorphControls(root: THREE.Object3D): number {
  const bindings: Array<{ mesh: THREE.Mesh; name: string; index: number }> = [];
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    for (const [name, index] of Object.entries(node.morphTargetDictionary)) bindings.push({ mesh: node, name, index });
  });
  if (bindings.length === 0) return 0;
  morphSection.hidden = false;
  for (const binding of bindings) {
    const label = document.createElement("label");
    label.textContent = binding.name;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = "0.01";
    input.value = String(binding.mesh.morphTargetInfluences![binding.index] ?? 0);
    input.setAttribute("aria-label", binding.name);
    input.addEventListener("input", () => { binding.mesh.morphTargetInfluences![binding.index] = Number(input.value); });
    label.append(input);
    morphControls.append(label);
  }
  return bindings.length;
}

function isolateEditableMaterials(root: THREE.Object3D): void {
  const replaced = new Set<THREE.Material>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const original = Array.isArray(node.material) ? node.material : [node.material];
    const isolated = original.map((material) => material.clone());
    original.forEach((material) => replaced.add(material));
    node.material = Array.isArray(node.material) ? isolated : isolated[0]!;
    authoredMaterials.set(node, node.material);
    for (const material of isolated) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      const list = editableMaterials.get(material.name) ?? [];
      list.push(material);
      editableMaterials.set(material.name, list);
    }
  });
  replaced.forEach((material) => material.dispose());
}

function countSkinnedMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((node) => { if (node instanceof THREE.SkinnedMesh) count += 1; });
  return count;
}

function setupMaterialControls(customizationReady: boolean): void {
  if (!customizationReady) return;
  const available = ["skin", "shirt", "shoes"] as const;
  materialSection.hidden = false;
  for (const controlName of available) {
    const palette = document.querySelector<HTMLSelectElement>(`[data-palette="${controlName}"]`)!;
    const picker = document.querySelector<HTMLInputElement>(`[data-color="${controlName}"]`)!;
    const channelIndex = { skin: 0, shirt: 1, shoes: 2 }[controlName];
    const apply = (color: string) => {
      tintUniforms[controlName].value.set(color);
      tintUniforms.mix.value.setComponent(channelIndex, 1);
      const target = tintUniforms[controlName].value;
      const baseline = PALETTE_BASE[controlName];
      tintUniforms.valueScale.value.setComponent(channelIndex, Math.max(target.r, target.g, target.b) / Math.max(baseline.r, baseline.g, baseline.b));
    };
    palette.addEventListener("change", () => {
      if (!palette.value) {
        tintUniforms.mix.value.setComponent(channelIndex, 0);
        picker.value = `#${PALETTE_BASE[controlName].getHexString()}`;
        return;
      }
      picker.value = palette.value;
      apply(palette.value);
    });
    picker.addEventListener("input", () => {
      palette.value = "custom";
      apply(picker.value);
    });
  }
}

function installMaskedTintShaders(root: THREE.Object3D, channels: CustomizationContract["channels"]): void {
  const component = { r: "r", g: "g", b: "b" } as const;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || !material.map) continue;
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, { customizationMask: tintUniforms.mask, skinTint: tintUniforms.skin, shirtTint: tintUniforms.shirt, shoesTint: tintUniforms.shoes, tintMix: tintUniforms.mix, tintValueScale: tintUniforms.valueScale });
        shader.fragmentShader = shader.fragmentShader.replace("void main() {", `
          uniform sampler2D customizationMask;
          uniform vec3 skinTint; uniform vec3 shirtTint; uniform vec3 shoesTint; uniform vec3 tintMix; uniform vec3 tintValueScale;
          vec3 reviewRgb2Hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
          vec3 reviewHsv2Rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y); }
          vec3 reviewTint(vec3 source, vec3 target, float valueScale){ vec3 s=reviewRgb2Hsv(source); vec3 t=reviewRgb2Hsv(target); return reviewHsv2Rgb(vec3(t.x,t.y,clamp(s.z*valueScale,0.,1.))); }
          void main() {`);
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          vec3 reviewMask = texture2D(customizationMask, vMapUv).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, reviewTint(diffuseColor.rgb, skinTint, tintValueScale.x), reviewMask.${component[channels.skin]} * tintMix.x);
          diffuseColor.rgb = mix(diffuseColor.rgb, reviewTint(diffuseColor.rgb, shirtTint, tintValueScale.y), reviewMask.${component[channels.shirt]} * tintMix.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, reviewTint(diffuseColor.rgb, shoesTint, tintValueScale.z), reviewMask.${component[channels.shoes]} * tintMix.z);`);
      };
      material.customProgramCacheKey = () => "teen-courier-masked-hsv-v1";
      material.needsUpdate = true;
    }
  });
}

function validateCustomization(value: unknown): CustomizationContract | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CustomizationContract>;
  const validChannel = (channel: unknown): channel is "r" | "g" | "b" => channel === "r" || channel === "g" || channel === "b";
  if (candidate.ready !== true || !Number.isInteger(candidate.maskTextureIndex) || candidate.texCoord !== 0 || candidate.mode !== "masked_hsv_hue_saturation" || candidate.preserveValue !== true) return null;
  if (!candidate.channels || !validChannel(candidate.channels.skin) || !validChannel(candidate.channels.shirt) || !validChannel(candidate.channels.shoes)) return null;
  return candidate as CustomizationContract;
}

interface CustomizationContract { ready: true; maskTextureIndex: number; texCoord: 0; channels: { skin: "r" | "g" | "b"; shirt: "r" | "g" | "b"; shoes: "r" | "g" | "b" }; mode: "masked_hsv_hue_saturation"; preserveValue: true }

function setupClayInspection(): void {
  inspectionSection.hidden = false;
  clayToggle.addEventListener("click", () => {
    clayEnabled = !clayEnabled;
    clayToggle.setAttribute("aria-pressed", String(clayEnabled));
    clayToggle.textContent = clayEnabled ? "Show materials" : "Clay inspection";
    for (const [mesh, materials] of authoredMaterials) {
      mesh.material = clayEnabled ? (Array.isArray(materials) ? materials.map(() => clayMaterial) : clayMaterial) : materials;
    }
  });
}

async function loadReviewManifest(): Promise<ReviewManifest | null> {
  if (requestedPath) return null;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}models/teen_courier.manifest.json`);
    if (!response.ok) return null;
    return await response.json() as ReviewManifest;
  } catch {
    return null;
  }
}

interface ReviewManifest {
  customization?: { ready?: boolean };
}

function frameAsset(view: ReviewView): void {
  if (!asset || bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const isHead = view === "head";
  const target = isHead ? new THREE.Vector3(center.x, bounds.max.y - size.y * 0.16, center.z) : center;
  const radius = isHead ? Math.max(size.x, size.z, size.y * 0.24) * 0.58 : bounds.getBoundingSphere(new THREE.Sphere()).radius;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = radius / Math.sin(Math.max(0.15, Math.min(vFov, hFov)) / 2) * (isHead ? 1.35 : 1.12);
  const direction = view === "side" ? new THREE.Vector3(1, 0.04, 0) : view === "back" ? new THREE.Vector3(0, 0.04, 1) : new THREE.Vector3(0, 0.04, -1);
  controls.target.copy(target);
  controls.minDistance = Math.max(0.15, radius * 0.45);
  controls.maxDistance = Math.max(6, distance * 2.5);
  camera.position.copy(target).addScaledVector(direction.normalize(), distance);
  camera.near = Math.max(0.01, distance - radius * 2.2);
  camera.far = Math.max(20, distance + radius * 5);
  camera.updateProjectionMatrix();
  controls.update();
}

function resize(): void {
  const width = Math.max(host.clientWidth, 1);
  const height = Math.max(host.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  frameAsset(activeView);
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(host);
resize();
renderer.setAnimationLoop((time) => {
  mixer?.update(Math.min(Math.max((time - lastFrameTime) / 1000, 0), 0.05));
  lastFrameTime = time;
  controls.update();
  renderer.render(scene, camera);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    resizeObserver.disconnect();
    renderer.setAnimationLoop(null);
    mixer?.stopAllAction();
    controls.dispose();
    if (clayEnabled) disposeDetachedAuthoredMaterials();
    disposeObjectResources(scene);
    clayMaterial.dispose();
    renderer.dispose();
  });
}

function disposeDetachedAuthoredMaterials(): void {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  for (const value of authoredMaterials.values()) {
    for (const material of Array.isArray(value) ? value : [value]) materials.add(material);
  }
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  textures.forEach((texture) => texture.dispose());
}

function disposeObjectResources(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  textures.forEach((texture) => texture.dispose());
}
