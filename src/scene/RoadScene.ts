import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { Road, RoadSlice } from "../world/types";

const PATH_CLASSES = new Set(["footway", "path", "steps", "pedestrian", "platform", "cycleway"]);

const SURFACE_COLORS: Record<Road["width"]["source"], number> = {
  width: 0x365f62,
  lanes: 0x38413f,
  "class-fallback": 0x4d4640,
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
}

export class RoadScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
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
  private selectedRoadId: string | null = null;
  private showWidthSources = false;
  private showPaths = true;
  private showCentrelines = false;
  private animationFrame = 0;
  private frameCount = 0;
  private frameSampleStart = performance.now();
  private pointerStart: { x: number; y: number } | null = null;

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D road map around Colombo Lotus Tower");
    this.renderer.domElement.setAttribute("role", "img");
    this.host.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xd8dfd1);
    this.scene.fog = new THREE.Fog(0xd8dfd1, 1000, 2000);

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
      material.opacity = 0.26;
    });
    this.scene.add(this.grid);
    this.addRoads(roadSlice.roads);
    this.addAnchorMarker();

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
    this.controls.update();

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
      visual.edges.visible = visible;
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
    return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  }

  private getRoadMaterial(road: Road): THREE.MeshStandardMaterial {
    return this.showWidthSources ? this.materials[road.width.source] : this.materials.lanes;
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xfffbec, 0x50675c, 2.6));
    const key = new THREE.DirectionalLight(0xfff3d5, 2.2);
    key.position.set(-320, 650, -260);
    this.scene.add(key);
  }

  private addGround(roadSlice: RoadSlice): void {
    const width = Math.max(roadSlice.bounds.maxX - roadSlice.bounds.minX, 900) + 160;
    const depth = Math.max(roadSlice.bounds.maxZ - roadSlice.bounds.minZ, 900) + 160;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: 0x829987, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    this.scene.add(ground);
  }

  private addRoads(roads: Road[]): void {
    for (const road of roads) {
      if (road.mesh.vertices.length < 9 || road.mesh.indices.length < 3) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(road.mesh.vertices, 3));
      geometry.setIndex(road.mesh.indices);
      geometry.computeVertexNormals();

      const surface = new THREE.Mesh(geometry, this.materials.lanes);
      surface.position.y = 0.12;
      surface.userData.roadId = road.id;
      surface.renderOrder = 1;
      this.scene.add(surface);
      this.roadObjectIds.set(surface.id, road.id);

      const edges = this.makeRoadEdges(road);
      edges.position.y = 0.23;
      edges.renderOrder = 2;
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
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frameCount += 1;
    const elapsed = timestamp - this.frameSampleStart;
    if (elapsed >= 750) {
      this.callbacks.onFpsSample(Math.round((this.frameCount * 1000) / elapsed));
      this.frameCount = 0;
      this.frameSampleStart = timestamp;
    }
  };
}
