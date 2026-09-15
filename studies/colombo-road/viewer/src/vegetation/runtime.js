import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { attachVegetationWind, updateWind } from "./wind.js";
import {
  dimensions,
  perspectiveFitDistance,
  validateVegetationManifest,
  WIND_PRESETS,
} from "./model.js";
const WEATHER = {
  Sunny: {
    background: 0xf0ead9,
    fog: 0xe8e2d2,
    exposure: 1.05,
    sun: 3.2,
    hemi: 1.6,
    wet: 0,
  },
  Overcast: {
    background: 0xdce2dc,
    fog: 0xcfd8d3,
    exposure: 0.9,
    sun: 1.1,
    hemi: 1.9,
    wet: 0,
  },
  Rain: {
    background: 0xaebdb8,
    fog: 0x9fafa9,
    exposure: 0.78,
    sun: 0.55,
    hemi: 1.45,
    wet: 1,
  },
};
function disposeObject(root) {
  root?.traverse((object) => {
    object.geometry?.dispose?.();
    for (const material of object.material
      ? Array.isArray(object.material)
        ? object.material
        : [object.material]
      : []) {
      for (const value of Object.values(material))
        value?.isTexture && value.dispose();
      material.dispose?.();
    }
    object.customDepthMaterial?.dispose?.();
    object.customDistanceMaterial?.dispose?.();
  });
}
function boundsCenter(asset) {
  return new THREE.Vector3()
    .fromArray(asset.bounds.min)
    .add(new THREE.Vector3().fromArray(asset.bounds.max))
    .multiplyScalar(0.5);
}
function collectionLayout(assets, gap = 1.4) {
  let cursor = 0;
  const placements = assets.map((asset) => {
    const size = dimensions(asset.bounds);
    const center = cursor + size[0] / 2;
    cursor += size[0] + gap;
    return { asset, center };
  });
  const width = cursor - gap;
  return {
    placements,
    width,
    height: Math.max(...assets.map((asset) => dimensions(asset.bounds)[1])),
    depth: Math.max(...assets.map((asset) => dimensions(asset.bounds)[2])),
  };
}
export async function createVegetationViewer(
  container,
  { onManifest, onStatus } = {},
) {
  const response = await fetch("/vegetation/manifest.json");
  if (!response.ok)
    throw new Error(`Vegetation manifest returned ${response.status}`);
  const manifest = await response.json();
  if (!validateVegetationManifest(manifest))
    throw new Error("Vegetation manifest is incomplete or incompatible");
  let alive = true,
    frame = 0,
    last = performance.now(),
    elapsed = 0,
    windPreset = "Breeze",
    windPaused = false,
    directionAngle = 35,
    weather = "Sunny",
    mode = "isolated",
    lod = "near",
    selected = manifest.assets[0].id;
  const resources = new Set(),
    loaded = new Map(),
    collection = collectionLayout(manifest.assets),
    scene = new THREE.Scene(),
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 160),
    controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  const hemi = new THREE.HemisphereLight(0xf6f1dc, 0x607060, 1.6),
    sun = new THREE.DirectionalLight(0xffe0a6, 3.2);
  sun.position.set(-12, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -13;
  scene.add(hemi, sun, sun.target);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(15, 96),
    new THREE.MeshStandardMaterial({
      color: 0xd8d4bd,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  resources.add(floor.geometry);
  resources.add(floor.material);
  const rainGeometry = new THREE.BufferGeometry(),
    rainPositions = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 24;
    rainPositions[i * 3 + 1] = Math.random() * 13;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 18;
  }
  rainGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(rainPositions, 3),
  );
  const rainMaterial = new THREE.PointsMaterial({
      color: 0xd7e5e2,
      size: 0.035,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
    rain = new THREE.Points(rainGeometry, rainMaterial);
  rain.visible = false;
  scene.add(rain);
  resources.add(rainGeometry);
  resources.add(rainMaterial);
  const loader = new GLTFLoader(),
    results = await Promise.allSettled(
      manifest.assets.map(async (asset) => {
        const [nearGltf, distanceGltf] = await Promise.all([
          loader.loadAsync(asset.url),
          loader.loadAsync(asset.lod1Url),
        ]);
        const roots = { near: nearGltf.scene, distance: distanceGltf.scene };
        const winds = {};
        for (const [level, root] of Object.entries(roots)) {
          root.name = `${asset.id}:${level}`;
          root.userData.asset = asset;
          winds[level] = attachVegetationWind(root, asset, resources);
          root.visible = false;
          scene.add(root);
        }
        loaded.set(asset.id, { asset, roots, winds });
      }),
    ),
    failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    disposeObject(scene);
    controls.dispose();
    resources.forEach((resource) => resource.dispose?.());
    renderer.dispose();
    renderer.domElement.remove();
    throw new Error(
      `${failures.length} vegetation asset${failures.length === 1 ? "" : "s"} failed to load: ${failures[0].reason?.message || failures[0].reason}`,
    );
  }
  function arrange() {
    for (const item of loaded.values()) {
      for (const [level, root] of Object.entries(item.roots)) {
        root.visible =
          level === lod &&
          (mode === "collection" || item.asset.id === selected);
        root.position.set(0, 0, 0);
      }
    }
    if (mode === "collection") {
      for (const { asset, center } of collection.placements) {
        const sourceCenter = (asset.bounds.min[0] + asset.bounds.max[0]) / 2;
        for (const root of Object.values(loaded.get(asset.id).roots))
          root.position.x = center - collection.width / 2 - sourceCenter;
      }
      const distance =
        collection.depth / 2 +
        perspectiveFitDistance(
          collection.width,
          collection.height,
          THREE.MathUtils.degToRad(camera.fov),
          camera.aspect,
        );
      controls.target.set(0, collection.height / 2, 0);
      camera.position.set(0, collection.height / 2, distance);
      controls.minDistance = Math.max(
        collection.height,
        collection.width * 0.3,
      );
      controls.maxDistance = distance * 4;
      floor.scale.setScalar(Math.max(1, collection.width / 24));
      sun.shadow.camera.left = -collection.width * 0.65;
      sun.shadow.camera.right = collection.width * 0.65;
    } else {
      const asset = loaded.get(selected).asset,
        center = boundsCenter(asset),
        size = dimensions(asset.bounds),
        span = Math.max(...size),
        distance = Math.max(span * 1.75, asset.height * 1.55, 0.9);
      controls.target.copy(center);
      camera.position.set(
        center.x + distance * 0.75,
        center.y + asset.height * 0.18,
        center.z + distance,
      );
      controls.minDistance = Math.max(asset.height * 0.25, 0.18);
      controls.maxDistance = Math.max(asset.height * 7, 3);
      floor.scale.setScalar(1);
      sun.shadow.camera.left = -13;
      sun.shadow.camera.right = 13;
    }
    sun.shadow.camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }
  function setView(name) {
    const asset = loaded.get(selected)?.asset,
      center =
        mode === "collection"
          ? new THREE.Vector3(0, collection.height / 2, 0)
          : boundsCenter(asset),
      span = Math.max(
        asset?.height || 0,
        ...(asset ? dimensions(asset.bounds) : [0]),
      ),
      fitWidth =
        mode === "collection"
          ? name === "side"
            ? collection.depth
            : collection.width
          : span,
      fitHeight = mode === "collection" ? collection.height : span,
      viewDepth =
        mode === "collection"
          ? name === "side"
            ? collection.width
            : collection.depth
          : span,
      distance =
        viewDepth / 2 +
        Math.max(
          perspectiveFitDistance(
            fitWidth,
            fitHeight,
            THREE.MathUtils.degToRad(camera.fov),
            camera.aspect,
          ),
          0.8,
        );
    if (name === "front")
      camera.position.set(
        center.x,
        center.y + span * 0.08,
        center.z + distance,
      );
    else if (name === "side")
      camera.position.set(
        center.x + distance,
        center.y + span * 0.08,
        center.z,
      );
    else {
      arrange();
      return;
    }
    controls.target.copy(center);
    controls.update();
    invalidate();
  }
  function applyWeather(name) {
    weather = WEATHER[name] ? name : "Sunny";
    const value = WEATHER[weather];
    scene.background = new THREE.Color(value.background);
    scene.fog = new THREE.FogExp2(
      value.fog,
      weather === "Rain" ? 0.035 : 0.018,
    );
    renderer.toneMappingExposure = value.exposure;
    sun.intensity = value.sun;
    hemi.intensity = value.hemi;
    rain.visible = weather === "Rain";
    floor.material.color.setHex(value.wet ? 0x777f70 : 0xd8d4bd);
    floor.material.roughness = value.wet ? 0.32 : 0.9;
    for (const { roots } of loaded.values())
      for (const root of Object.values(roots))
        root.traverse((mesh) => {
          if (mesh.isMesh)
            for (const material of Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material]) {
              if (material.userData.baseRoughness === undefined)
                material.userData.baseRoughness = material.roughness;
              material.roughness = value.wet
                ? Math.max(0.22, material.userData.baseRoughness * 0.58)
                : material.userData.baseRoughness;
            }
        });
    invalidate();
  }
  function invalidate() {
    if (alive && !frame) frame = requestAnimationFrame(render);
  }
  function render(now) {
    frame = 0;
    if (!alive) return;
    const delta = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;
    if (!windPaused) elapsed += delta * WIND_PRESETS[windPreset].speed;
    const radians = (directionAngle * Math.PI) / 180,
      direction = [Math.cos(radians), Math.sin(radians)];
    for (const item of loaded.values())
      for (const wind of Object.values(item.winds))
        updateWind(wind, {
          time: elapsed,
          strength: WIND_PRESETS[windPreset].strength,
          direction,
        });
    if (rain.visible) {
      const positions = rain.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i) - delta * 8;
        if (y < 0) y += 13;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }
    controls.update();
    renderer.render(scene, camera);
    if ((!windPaused && WIND_PRESETS[windPreset].strength > 0) || rain.visible)
      invalidate();
  }
  controls.addEventListener("change", invalidate);
  const observer = new ResizeObserver(() => {
    const width = container.clientWidth,
      height = container.clientHeight;
    if (width && height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (mode === "collection") arrange();
      invalidate();
    }
  });
  observer.observe(container);
  arrange();
  applyWeather("Sunny");
  onManifest?.(manifest);
  onStatus?.("Five vegetation assets ready for human review");
  invalidate();
  return {
    manifest,
    select(id) {
      if (loaded.has(id)) {
        selected = id;
        arrange();
        return true;
      }
      return false;
    },
    setMode(value) {
      mode = value === "collection" ? "collection" : "isolated";
      arrange();
      return mode;
    },
    setLod(value) {
      lod = value === "distance" ? "distance" : "near";
      arrange();
      return lod;
    },
    setView,
    reset: arrange,
    setWindPreset(value) {
      if (WIND_PRESETS[value]) windPreset = value;
      invalidate();
      return windPreset;
    },
    setDirection(value) {
      directionAngle = Number(value) || 0;
      invalidate();
    },
    setWindPaused(value) {
      windPaused = !!value;
      last = performance.now();
      invalidate();
      return windPaused;
    },
    setWeather: applyWeather,
    stats() {
      return {
        loaded: loaded.size,
        loadedModels: loaded.size * 2,
        selected,
        mode,
        lod,
        windPreset,
        windPaused,
        windTime: elapsed,
        weather,
      };
    },
    dispose() {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      resources.forEach((resource) => resource.dispose?.());
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
    },
  };
}
