import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  createBicycleController,
  type BicycleController,
  type BicycleInput,
  type BicycleState,
} from "../game/bicycle";
import type { Road, RoadSlice } from "../world/types";
import { createSceneryPlacements, DRESSED_END_METRES, DRESSED_START_METRES, getFeatureRoad, sampleRoad } from "../world/scenery-placement";
import { BicycleVisual, makeObstacleVisual } from "./BicycleVisual";

const PATH_CLASSES = new Set(["footway", "path", "steps", "pedestrian", "platform", "cycleway"]);

const SURFACE_COLORS: Record<Road["width"]["source"], number> = {
  width: 0x737c80,
  lanes: 0x697276,
  "class-fallback": 0x7b7979,
};

interface RoadVisual {
  road: Road;
  surface: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  centreline: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  path: boolean;
}

export interface SceneCallbacks {
  onRoadSelected: (roadId: string | null) => void;
  onFpsSample: (fps: number) => void;
  onBicycleState: (state: BicycleState) => void;
  onSimulationStep?: (deltaSeconds: number, state: BicycleState) => void;
  onSceneNotice?: (message: string) => void;
  onVehicleVisualNotice?: (message: string) => void;
}

export type SceneMode = "ride" | "inspect";

export class RoadScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.08, 4000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly visuals = new Map<string, RoadVisual>();
  private readonly roadObjectIds = new Map<number, string>();
  private readonly materials: Record<Road["width"]["source"], THREE.MeshStandardMaterial>;
  private readonly selectedMaterial = new THREE.MeshStandardMaterial({
    color: 0xdf6c32,
    roughness: 0.78,
    metalness: 0,
  });
  private readonly edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xf2eddf,
    transparent: true,
    opacity: 0.62,
  });
  private readonly centrelineMaterial = new THREE.LineBasicMaterial({
    color: 0xe7c57b,
    transparent: true,
    opacity: 0.72,
  });
  private readonly grid: THREE.GridHelper;
  private readonly resizeObserver: ResizeObserver;
  private readonly resetDistance: number;
  private readonly bicycleController: BicycleController;
  private readonly bicycleVisual: BicycleVisual;
  private readonly bicycleInput: BicycleInput = { pedal: false, brake: false, left: false, right: false };
  private readonly followPosition = new THREE.Vector3();
  private readonly followTarget = new THREE.Vector3();
  private readonly deliveryMarker = new THREE.Group();
  private readonly scenery = new THREE.Group();
  private selectedRoadId: string | null = null;
  private mode: SceneMode = "ride";
  private paused = false;
  private showWidthSources = false;
  private showPaths = true;
  private showCentrelines = false;
  private animationFrame = 0;
  private frameCount = 0;
  private frameSampleStart = performance.now();
  private lastFrameTimestamp = performance.now();
  private pointerStart: { x: number; y: number } | null = null;
  private deliveryTargetKey: string | null = null;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    roadSlice: RoadSlice,
    private readonly callbacks: SceneCallbacks,
  ) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      throw new Error("WebGL 2 is unavailable. Try a browser or device with hardware-accelerated WebGL 2 support.");
    }
    this.resetDistance = this.host.clientWidth / Math.max(this.host.clientHeight, 1) < 1 ? 1180 : 940;
    this.bicycleVisual = new BicycleVisual((message) => this.callbacks.onVehicleVisualNotice?.(message));
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute("aria-label", "Controllable bicycle on the Colombo road study");
    this.renderer.domElement.setAttribute("role", "img");
    this.host.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x8097ad);
    this.scene.fog = new THREE.Fog(0x758697, 210, 760);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.materials = {
      width: this.makeRoadMaterial(SURFACE_COLORS.width),
      lanes: this.makeRoadMaterial(SURFACE_COLORS.lanes),
      "class-fallback": this.makeRoadMaterial(SURFACE_COLORS["class-fallback"]),
    };

    this.addLights();
    this.addGround(roadSlice);
    this.grid = new THREE.GridHelper(1000, 20, 0x406e64, 0x759285);
    this.grid.position.y = 0.03;
    const gridMaterials = Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.07;
    });
    this.scene.add(this.grid);
    this.addRoads(roadSlice.roads);
    this.addAtmosphere(roadSlice);
    this.scenery.name = "Decorative Colombo streetscape";
    this.scene.add(this.scenery);
    this.callbacks.onSceneNotice?.("Loading street scenery…");
    void this.addScenery(roadSlice);
    this.addAnchorMarker();
    this.deliveryMarker.visible = false;
    this.scene.add(this.deliveryMarker);

    this.bicycleController = createBicycleController(roadSlice);
    this.scene.add(this.bicycleVisual.group);
    for (const obstacle of this.bicycleController.obstacles) this.scene.add(makeObstacleVisual(obstacle));
    const initialState = this.bicycleController.getState();
    this.bicycleVisual.update(initialState);

    this.camera.position.set(0.535, 0.624, 0.548).normalize().multiplyScalar(this.resetDistance);
    this.camera.up.set(0, 1, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 90;
    this.controls.maxDistance = 1350;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    this.controls.enabled = false;
    this.controls.update();

    this.snapFollowCamera(initialState);
    this.callbacks.onBicycleState(initialState);

    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.host);
    this.resize();
    this.render();
  }

  selectRoad(roadId: string | null, notify = false): void {
    if (this.selectedRoadId) {
      const previous = this.visuals.get(this.selectedRoadId);
      if (previous) previous.surface.material = this.getRoadMaterial(previous.road);
    }

    this.selectedRoadId = roadId && this.visuals.has(roadId) ? roadId : null;
    if (this.selectedRoadId) {
      const selected = this.visuals.get(this.selectedRoadId);
      if (selected) selected.surface.material = this.selectedMaterial;
    }
    if (notify) this.callbacks.onRoadSelected(this.selectedRoadId);
  }

  focusRoad(roadId: string): void {
    const visual = this.visuals.get(roadId);
    if (!visual) return;
    const nextTarget = new THREE.Vector3(
      visual.road.representative.x,
      visual.road.representative.y,
      visual.road.representative.z,
    );
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(nextTarget);
    this.camera.position.copy(nextTarget).add(offset);
    this.controls.update();
  }

  setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
  }

  setCentrelinesVisible(visible: boolean): void {
    this.showCentrelines = visible;
    for (const visual of this.visuals.values()) visual.centreline.visible = visible && (!visual.path || this.showPaths);
  }

  setPathsVisible(visible: boolean): void {
    this.showPaths = visible;
    for (const visual of this.visuals.values()) {
      if (!visual.path) continue;
      visual.surface.visible = visible;
      visual.edges.visible = visible && this.mode === "inspect";
      visual.centreline.visible = visible && this.showCentrelines;
    }
    const selected = this.selectedRoadId ? this.visuals.get(this.selectedRoadId) : null;
    if (!visible && selected?.path) this.selectRoad(null, true);
  }

  setWidthSourcesVisible(visible: boolean): void {
    this.showWidthSources = visible;
    for (const visual of this.visuals.values()) {
      if (visual.road.id !== this.selectedRoadId) visual.surface.material = this.getRoadMaterial(visual.road);
    }
  }

  setDeliveryTarget(target: { x: number; z: number } | null, kind: "pickup" | "dropoff" = "pickup"): void {
    const nextKey = target ? `${kind}:${target.x}:${target.z}` : null;
    if (nextKey === this.deliveryTargetKey) return;
    this.deliveryTargetKey = nextKey;
    const materials = new Set<THREE.Material>();
    for (const child of this.deliveryMarker.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      child.geometry.dispose();
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach((material) => materials.add(material));
    }
    materials.forEach((material) => material.dispose());
    this.deliveryMarker.clear();
    if (!target) {
      this.deliveryMarker.visible = false;
      return;
    }
    const color = kind === "pickup" ? 0xf0c56d : 0xdf6c32;
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 0.65 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.18, 8, 48), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.75;
    const beamMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.7, 5.5, 12, 1, true), beamMaterial);
    beam.position.y = 3.5;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 1.05), material);
    cap.position.y = 6.4;
    cap.rotation.set(0.12, 0, -0.08);
    this.deliveryMarker.add(ring, beam, cap);
    this.deliveryMarker.position.set(target.x, 0.25, target.z);
    this.deliveryMarker.visible = true;
    this.deliveryMarker.userData.kind = kind;
  }

  setMode(mode: SceneMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.clearRideInput();
    this.controls.enabled = mode === "inspect";
    for (const visual of this.visuals.values()) visual.edges.visible = mode === "inspect" && (!visual.path || this.showPaths);
    if (mode === "inspect") this.resetCamera();
    else this.snapFollowCamera(this.bicycleController.getState());
  }

  setRideInput(input: Partial<BicycleInput>): void {
    Object.assign(this.bicycleInput, input);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.clearRideInput();
  }

  clearRideInput(): void {
    this.bicycleInput.pedal = false;
    this.bicycleInput.brake = false;
    this.bicycleInput.left = false;
    this.bicycleInput.right = false;
  }

  resetBicycle(): BicycleState {
    this.clearRideInput();
    const state = this.bicycleController.reset();
    this.bicycleVisual.update(state);
    if (this.mode === "ride") this.snapFollowCamera(state);
    this.callbacks.onBicycleState(state);
    return state;
  }

  getBicycleState(): BicycleState {
    return this.bicycleController.getState();
  }

  resetCamera(): void {
    this.camera.position.set(0.535, 0.624, 0.548).normalize().multiplyScalar(this.resetDistance);
    this.camera.up.set(0, 1, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  topView(): void {
    const distance = Math.max(this.camera.position.distanceTo(this.controls.target), 720);
    this.camera.position.set(this.controls.target.x, distance, this.controls.target.z + distance * 0.025);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  dispose(): void {
    this.disposed = true;
    this.bicycleVisual.dispose();
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.controls.dispose();
    const disposableMaterials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((material) => disposableMaterials.add(material));
      }
    });
    const disposableTextures = new Set<THREE.Texture>();
    for (const material of disposableMaterials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) disposableTextures.add(value);
      }
    }
    disposableTextures.forEach((texture) => texture.dispose());
    disposableMaterials.forEach((material) => material.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  zoom(factor: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
    const distance = THREE.MathUtils.clamp(offset.length(), this.controls.minDistance, this.controls.maxDistance);
    offset.setLength(distance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  private makeRoadMaterial(color: number): THREE.MeshStandardMaterial {
    const texture = makeNoiseTexture("asphalt");
    texture.repeat.set(32, 32);
    return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 0.94, metalness: 0 });
  }

  private getRoadMaterial(road: Road): THREE.MeshStandardMaterial {
    return this.showWidthSources ? this.materials[road.width.source] : this.materials.lanes;
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbad5f2, 0x526258, 2.65));
    const key = new THREE.DirectionalLight(0xffd19a, 2.55);
    key.position.set(-240, 210, -180);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -230;
    key.shadow.camera.right = 230;
    key.shadow.camera.top = 230;
    key.shadow.camera.bottom = -230;
    key.shadow.camera.near = 20;
    key.shadow.camera.far = 700;
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.025;
    this.scene.add(key);
  }

  private addGround(roadSlice: RoadSlice): void {
    const width = Math.max(roadSlice.bounds.maxX - roadSlice.bounds.minX, 900) + 160;
    const depth = Math.max(roadSlice.bounds.maxZ - roadSlice.bounds.minZ, 900) + 160;
    const groundTexture = makeNoiseTexture("ground");
    groundTexture.repeat.set(width / 34, depth / 34);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: 0x7e9074, map: groundTexture, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private addAtmosphere(roadSlice: RoadSlice): void {
    const skyGeometry = new THREE.SphereGeometry(720, 36, 18);
    const positions = skyGeometry.getAttribute("position");
    const colors: number[] = [];
    const horizonColor = new THREE.Color(0x91a5b6);
    const zenithColor = new THREE.Color(0x334e73);
    for (let index = 0; index < positions.count; index += 1) {
      const blend = THREE.MathUtils.smoothstep(positions.getY(index) / 720, -0.08, 0.5);
      const color = horizonColor.clone().lerp(zenithColor, blend);
      colors.push(color.r, color.g, color.b);
    }
    skyGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    this.scene.add(sky);
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xd7cad1, transparent: true, opacity: 0.24, depthWrite: false, fog: false });
    for (const [x, y, z, scale] of [[-180, 105, -370, 1.3], [145, 86, -430, 0.9], [360, 125, -280, 1.1]] as const) {
      const cloud = new THREE.Group();
      for (let index = 0; index < 5; index += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 7), cloudMaterial);
        puff.position.set(index * 18 - 36, Math.sin(index * 1.7) * 5, 0);
        puff.scale.set(1.5, 0.38, 0.24);
        cloud.add(puff);
      }
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(scale);
      this.scene.add(cloud);
    }

    const featureRoad = roadSlice.roads.find((road) => road.sourceFeatureId === "way/13884292");
    if (!featureRoad) return;
    this.addDistantCity(roadSlice);
    const vergeMaterial = new THREE.MeshStandardMaterial({ color: 0x728667, roughness: 1 });
    for (const point of featureRoad.points.filter((_point, index) => index % 2 === 0)) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(15, 18), vergeMaterial);
      patch.rotation.x = -Math.PI / 2;
      patch.scale.set(1, 0.48, 1);
      patch.position.set(point.x, -0.065, point.z);
      patch.receiveShadow = true;
      this.scene.add(patch);
    }
    this.addFootways(roadSlice);
    this.addHedges(roadSlice);
  }

  private addFootways(roadSlice: RoadSlice): void {
    const road = getFeatureRoad(roadSlice);
    if (!road) return;
    const paving = makeNoiseTexture("paving");
    paving.repeat.set(2, 10);
    const material = new THREE.MeshStandardMaterial({ color: 0xc4aa8d, map: paving, roughness: 0.98 });
    for (let distance = DRESSED_START_METRES; distance < DRESSED_END_METRES; distance += 5) {
      const start = sampleRoad(road, distance);
      const end = sampleRoad(road, Math.min(distance + 5, DRESSED_END_METRES));
      const dx = end.point.x - start.point.x;
      const dz = end.point.z - start.point.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.1) continue;
      for (const side of [-1, 1]) {
        const offset = road.width.metres / 2 + 1.3;
        const normalX = -dz / length * side;
        const normalZ = dx / length * side;
        const x = (start.point.x + end.point.x) / 2 + normalX * offset;
        const z = (start.point.z + end.point.z) / 2 + normalZ * offset;
        if (this.nearOtherGroundRoad(x, z, length, road, roadSlice.roads)) continue;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.12, length + 0.12), material);
        slab.position.set(x, 0.13, z);
        slab.rotation.y = Math.atan2(dx, dz);
        slab.receiveShadow = true;
        this.scene.add(slab);
      }
    }
  }

  private addHedges(roadSlice: RoadSlice): void {
    const road = getFeatureRoad(roadSlice);
    if (!road) return;
    const hedgeGeometry = new THREE.DodecahedronGeometry(0.7, 0);
    const hedgeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const transforms: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (let distance = DRESSED_START_METRES + 3; distance < DRESSED_END_METRES; distance += 5.5) {
      const start = sampleRoad(road, distance);
      const end = sampleRoad(road, Math.min(distance + 3.8, DRESSED_END_METRES));
      const dx = end.point.x - start.point.x;
      const dz = end.point.z - start.point.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.1) continue;
      for (const side of [-1, 1] as const) {
        const offset = road.width.metres / 2 + 3.35;
        const normalX = -dz / length * side;
        const normalZ = dx / length * side;
        const x = (start.point.x + end.point.x) / 2 + normalX * offset;
        const z = (start.point.z + end.point.z) / 2 + normalZ * offset;
        if (this.nearOtherGroundRoad(x, z, 3.8, road, roadSlice.roads)) continue;
        for (let crown = 0; crown < 4; crown += 1) {
          const seed = Math.floor(distance * 3) + crown * 17 + side * 11;
          const along = (crown - 1.5) * 0.92;
          const variation = 0.88 + ((seed % 7) + 7) % 7 * 0.025;
          position.set(
            x + dx / length * along + normalX * ((seed % 3) - 1) * 0.08,
            0.48 + ((seed % 5) + 5) % 5 * 0.035,
            z + dz / length * along + normalZ * ((seed % 3) - 1) * 0.08,
          );
          quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), seed * 0.37);
          scale.set(variation, 0.68 + ((seed % 4) + 4) % 4 * 0.06, 0.72 + ((seed % 5) + 5) % 5 * 0.035);
          transforms.push(matrix.clone().compose(position, quaternion, scale));
          colors.push(new THREE.Color([0x315c3b, 0x3a6841, 0x426f47][((seed % 3) + 3) % 3]));
        }
      }
    }
    const hedges = new THREE.InstancedMesh(hedgeGeometry, hedgeMaterial, transforms.length);
    transforms.forEach((transform, index) => {
      hedges.setMatrixAt(index, transform);
      hedges.setColorAt(index, colors[index]!);
    });
    hedges.name = "Roadside hedge line";
    hedges.castShadow = true;
    hedges.receiveShadow = true;
    this.scene.add(hedges);
  }

  private addDistantCity(roadSlice: RoadSlice): void {
    const { minX, maxX, minZ, maxZ } = roadSlice.bounds;
    const centreX = (minX + maxX) / 2;
    const centreZ = (minZ + maxZ) / 2;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const silhouettes = new THREE.Group();
    silhouettes.name = "Atmospheric city edge";
    const wallMaterials = [0x394852, 0x46555c, 0x536064].map((color) => new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      metalness: 0,
    }));
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xe8ad6c, transparent: true, opacity: 0.52 });
    const seeded = (index: number) => {
      const value = Math.sin(index * 91.731 + 17.13) * 43758.5453;
      return value - Math.floor(value);
    };
    for (let index = 0; index < 64; index += 1) {
      const edge = index % 4;
      const t = seeded(index * 3) - 0.5;
      const buildingWidth = 8 + seeded(index * 3 + 1) * 15;
      const buildingDepth = 8 + seeded(index * 3 + 2) * 11;
      const height = 7 + seeded(index * 5 + 4) * 20;
      const margin = 105 + seeded(index * 7) * 75;
      const x = edge < 2 ? centreX + t * (width + 120) : edge === 2 ? minX - margin : maxX + margin;
      const z = edge >= 2 ? centreZ + t * (depth + 120) : edge === 0 ? minZ - margin : maxZ + margin;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(buildingWidth, height, buildingDepth),
        wallMaterials[index % wallMaterials.length],
      );
      building.position.set(x, height / 2 - 0.05, z);
      building.castShadow = false;
      building.receiveShadow = true;
      silhouettes.add(building);
      if (index % 3 === 0) {
        const windows = new THREE.Mesh(new THREE.PlaneGeometry(buildingWidth * 0.62, Math.max(2, height * 0.06)), windowMaterial);
        windows.position.set(x, height * 0.58, z + (edge === 0 ? buildingDepth / 2 + 0.02 : -buildingDepth / 2 - 0.02));
        windows.rotation.y = edge === 0 ? 0 : Math.PI;
        silhouettes.add(windows);
      }
    }
    this.scene.add(silhouettes);
  }

  private nearOtherGroundRoad(x: number, z: number, slabLength: number, featureRoad: Road, roads: Road[]): boolean {
    const slabHalfDiagonal = Math.hypot(2.25 / 2, (slabLength + 0.12) / 2);
    for (const road of roads) {
      if (road === featureRoad || road.vertical.elevationMetres !== 0 || road.highway === "steps") continue;
      const clearance = road.width.metres / 2 + slabHalfDiagonal + 0.35;
      for (let index = 0; index < road.points.length - 1; index += 1) {
        const start = road.points[index]!;
        const end = road.points[index + 1]!;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const denominator = dx * dx + dz * dz;
        const t = denominator > 0 ? THREE.MathUtils.clamp(((x - start.x) * dx + (z - start.z) * dz) / denominator, 0, 1) : 0;
        if (Math.hypot(x - start.x - dx * t, z - start.z - dz * t) < clearance) return true;
      }
    }
    return false;
  }

  private async addScenery(roadSlice: RoadSlice): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/colombo_scenery_kit.glb`);
      if (this.disposed) {
        disposeObjectResources(gltf.scene);
        return;
      }
      const catalog = new Map(gltf.scene.children.map((child) => [child.name, child]));
      const lotusTower = catalog.get("LotusTower");
      if (lotusTower) {
        const oldMarker = this.scene.getObjectByName("Procedural Lotus Tower marker");
        if (oldMarker) {
          this.scene.remove(oldMarker);
          disposeObjectResources(oldMarker);
        }
        const landmark = lotusTower.clone(true);
        landmark.position.set(0, 0, 0);
        landmark.scale.setScalar(1);
        landmark.name = "Lotus Tower at mapped origin";
        landmark.userData.decorative = true;
        landmark.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        this.scene.add(landmark);
      }
      const placements = createSceneryPlacements(roadSlice);
      let added = 0;
      for (const placement of placements) {
        const source = catalog.get(placement.asset);
        if (!source) continue;
        const instance = source.clone(true);
        instance.position.set(placement.x, placement.y, placement.z);
        instance.rotation.y = placement.rotationY;
        instance.scale.setScalar(placement.scale);
        instance.name = `${placement.asset} at ${placement.metresAlongRoad}m`;
        instance.userData.decorative = true;
        instance.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        this.scenery.add(instance);
        added += 1;
      }
      const lampPlacements = placements.filter(({ asset }) => asset === "UtilityPole_Lamp");
      if (lampPlacements.length > 0) {
        const poolMaterial = new THREE.MeshBasicMaterial({
          color: 0xffbd72,
          map: makeLightPoolTexture(),
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 7), poolMaterial, lampPlacements.length);
        const poolMatrix = new THREE.Matrix4();
        const poolRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        lampPlacements.forEach((placement, index) => {
          poolMatrix.compose(new THREE.Vector3(placement.x, placement.y + 0.035, placement.z), poolRotation, new THREE.Vector3(1, 1, 1));
          pools.setMatrixAt(index, poolMatrix);
        });
        pools.name = "Warm lamp pools";
        pools.renderOrder = 2;
        this.scenery.add(pools);
      }
      if (added === 0) throw new Error("The scenery kit contained none of the expected named assets.");
      this.callbacks.onSceneNotice?.(`Street scenery ready · ${added} pieces`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown asset error";
      this.callbacks.onSceneNotice?.(`Street scenery could not load (${detail}). Reload to retry.`);
    }
  }

  private addRoads(roads: Road[]): void {
    for (const road of roads) {
      if (road.mesh.vertices.length < 9 || road.mesh.indices.length < 3) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(road.mesh.vertices, 3));
      geometry.setIndex(road.mesh.indices);
      geometry.computeVertexNormals();

      const surface = new THREE.Mesh(geometry, this.materials.lanes);
      const uv: number[] = [];
      for (let index = 0; index < road.mesh.vertices.length; index += 3) {
        uv.push((road.mesh.vertices[index] ?? 0) / 18, (road.mesh.vertices[index + 2] ?? 0) / 18);
      }
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      surface.position.y = 0.12;
      surface.userData.roadId = road.id;
      surface.renderOrder = 1;
      surface.receiveShadow = true;
      this.scene.add(surface);
      this.roadObjectIds.set(surface.id, road.id);

      const edges = this.makeRoadEdges(road);
      edges.position.y = 0.23;
      edges.renderOrder = 2;
      edges.visible = false;
      this.scene.add(edges);

      const centreGeometry = new THREE.BufferGeometry().setFromPoints(
        road.points.map((point) => new THREE.Vector3(point.x, point.y + 0.3, point.z)),
      );
      const centreline = new THREE.Line(centreGeometry, this.centrelineMaterial);
      centreline.visible = false;
      centreline.renderOrder = 3;
      this.scene.add(centreline);

      this.visuals.set(road.id, {
        road,
        surface,
        edges,
        centreline,
        path: PATH_CLASSES.has(road.highway),
      });
    }
  }

  private makeRoadEdges(road: Road): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const positions = road.mesh.vertices;
    const pointCount = Math.floor(positions.length / 6);
    const edgeSegments: number[] = [];
    for (let index = 0; index < pointCount - 1; index += 1) {
      const current = index * 6;
      const next = (index + 1) * 6;
      edgeSegments.push(
        positions[current] ?? 0,
        positions[current + 1] ?? 0,
        positions[current + 2] ?? 0,
        positions[next] ?? 0,
        positions[next + 1] ?? 0,
        positions[next + 2] ?? 0,
        positions[current + 3] ?? 0,
        positions[current + 4] ?? 0,
        positions[current + 5] ?? 0,
        positions[next + 3] ?? 0,
        positions[next + 4] ?? 0,
        positions[next + 5] ?? 0,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(edgeSegments, 3));
    return new THREE.LineSegments(geometry, this.edgeMaterial);
  }

  private addAnchorMarker(): void {
    const marker = new THREE.Group();
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xf0c56d, roughness: 0.7 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x1b726c, roughness: 0.62 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 1.5, 18), accentMaterial);
    base.position.y = 0.8;
    marker.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.35, 24, 12), baseMaterial);
    stem.position.y = 13;
    marker.add(stem);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), baseMaterial);
    flower.scale.set(1.5, 0.45, 1.5);
    flower.position.y = 25.5;
    marker.add(flower);
    const pin = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8, 12), accentMaterial);
    pin.position.y = 31;
    marker.add(pin);
    marker.name = "Procedural Lotus Tower marker";
    marker.userData.label = "Lotus Tower OSM anchor";
    this.scene.add(marker);
  }

  private readonly resize = (): void => {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (this.mode !== "inspect" || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates = [...this.visuals.values()]
      .filter((visual) => visual.surface.visible)
      .map((visual) => visual.surface);
    const hit = this.raycaster.intersectObjects(candidates, false)[0];
    this.selectRoad(hit ? (this.roadObjectIds.get(hit.object.id) ?? null) : null, true);
  };

  private readonly render = (timestamp = performance.now()): void => {
    this.animationFrame = requestAnimationFrame(this.render);
    const elapsedSeconds = Math.max((timestamp - this.lastFrameTimestamp) / 1000, 0);
    const deltaSeconds = Math.min(elapsedSeconds, 0.1);
    this.lastFrameTimestamp = timestamp;
    if (this.mode === "ride" && !this.paused) {
      const state = this.bicycleController.step(deltaSeconds, this.bicycleInput);
      this.bicycleVisual.update(state, { pedal: this.bicycleInput.pedal && !this.bicycleInput.brake, deltaSeconds });
      this.updateFollowCamera(state, deltaSeconds);
      this.callbacks.onBicycleState(state);
      this.callbacks.onSimulationStep?.(deltaSeconds, state);
    } else if (this.mode === "ride") {
      this.updateFollowCamera(this.bicycleController.getState(), deltaSeconds);
    } else {
      this.controls.update();
    }
    if (this.deliveryMarker.visible) {
      const pulse = 1 + Math.sin(timestamp * 0.004) * 0.06;
      this.deliveryMarker.children[0]?.scale.setScalar(pulse);
      this.deliveryMarker.children[2]?.rotation.set(0, timestamp * 0.0012, 0);
    }
    this.renderer.render(this.scene, this.camera);
    this.frameCount += 1;
    const elapsed = timestamp - this.frameSampleStart;
    if (elapsed >= 750) {
      this.callbacks.onFpsSample(Math.round((this.frameCount * 1000) / elapsed));
      this.frameCount = 0;
      this.frameSampleStart = timestamp;
    }
  };

  private snapFollowCamera(state: BicycleState): void {
    this.getFollowVectors(state, this.followPosition, this.followTarget);
    this.camera.position.copy(this.followPosition);
    this.camera.lookAt(this.followTarget);
  }

  private updateFollowCamera(state: BicycleState, deltaSeconds: number): void {
    const desiredPosition = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();
    this.getFollowVectors(state, desiredPosition, desiredTarget);
    const positionBlend = 1 - Math.exp(-deltaSeconds * 4.2);
    const targetBlend = 1 - Math.exp(-deltaSeconds * 6.2);
    this.followPosition.lerp(desiredPosition, positionBlend);
    this.followTarget.lerp(desiredTarget, targetBlend);
    this.camera.position.copy(this.followPosition);
    this.camera.lookAt(this.followTarget);
  }

  private getFollowVectors(state: BicycleState, position: THREE.Vector3, target: THREE.Vector3): void {
    const forwardX = Math.sin(state.heading);
    const forwardZ = -Math.cos(state.heading);
    const rightX = Math.cos(state.heading);
    const rightZ = Math.sin(state.heading);
    const speedLift = THREE.MathUtils.clamp(Math.abs(state.speed) * 0.06, 0, 0.35);
    position.set(
      state.x - forwardX * 5.9 + rightX * 0.62,
      state.y + 3.15 + speedLift,
      state.z - forwardZ * 5.9 + rightZ * 0.62,
    );
    target.set(
      state.x + forwardX * 4.2 + rightX * 0.12,
      state.y + 1.05,
      state.z + forwardZ * 4.2 + rightZ * 0.12,
    );
  }
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
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) value.dispose();
    }
    material.dispose();
  }
}

function makeNoiseTexture(kind: "asphalt" | "ground" | "paving"): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  const palette: readonly [number, number] = kind === "asphalt" ? [132, 158] : kind === "ground" ? [126, 158] : [166, 198];
  const image = context.createImageData(size, size);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = pixel % size;
    const y = Math.floor(pixel / size);
    const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const noise = grain - Math.floor(grain);
    const value = Math.round(palette[0] + noise * (palette[1] - palette[0]));
    const channel = pixel * 4;
    image.data[channel] = kind === "ground" ? value * 0.82 : value * 0.96;
    image.data[channel + 1] = kind === "ground" ? value : value * 0.98;
    image.data[channel + 2] = kind === "ground" ? value * 0.72 : value;
    image.data[channel + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  if (kind === "paving") {
    context.strokeStyle = "rgba(76, 60, 46, .22)";
    context.lineWidth = 2;
    for (let y = 0; y <= size; y += 16) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(size, y); context.stroke();
    }
    for (let x = 0; x <= size; x += 32) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, size); context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeLightPoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255, 236, 185, .9)");
    gradient.addColorStop(0.35, "rgba(255, 189, 105, .42)");
    gradient.addColorStop(1, "rgba(255, 174, 80, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
