import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createGround } from "../streets/composition/ground.js";
import { createRiderContacts } from "../cyclist/rider-contacts.js";
import { movementStatus } from "../cyclist/movement-model.js";
import { walkTiming, WALK_STRIDE_METRES } from "../cyclist/walking.js";
import { addresses, buildingPlacements, cameraPresets, propPlacements, treePlacements, understoryPlacements } from "./layout.js";
import { dayPhase, distanceForLod, resolveBuildingPlacement, validateEnvironmentManifest, validateLayout, validateSpatialLayout } from "./model.js";
import { attachWind, updateWind } from "./wind.js";
import { createStreetMovement, interactStreet, stepStreet, STREET_BOUNDS } from "./street-movement.js";

const WEATHER = { Clear: { fog: .0025, wet: 0 }, Rain: { fog: .008, wet: 1 } };
const WIND = { Calm: 0, Breeze: .55, Strong: 1 };
const UP = new THREE.Vector3(0, 1, 0);
const AXLE = new THREE.Vector3(1, 0, 0);

function mark(root, placement, kind) {
  root.name = placement.id;
  root.userData = { ...root.userData, stableId: placement.id, instanceId: placement.id, assetId: placement.assetId, kind };
  root.position.set(...placement.position);
  root.rotation.y = placement.yaw || 0;
  root.scale.setScalar(placement.scale || 1);
  return root;
}

function release(root, resources) {
  root.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    for (const material of materials) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
}

export function surfaceHeight(z, riding) {
  if (riding) return .055;
  return Math.abs(z) >= 4.3 ? .16 : .055;
}

async function loadPair(loader, asset) {
  const [near, distance] = await Promise.all([loader.loadAsync(asset.url), loader.loadAsync(asset.lod1Url)]);
  const nearMaterials = [], distanceMaterials = [];
  near.scene.traverse((object) => { for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) if (!nearMaterials.includes(material)) nearMaterials.push(material); });
  distance.scene.traverse((object) => { for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) if (!distanceMaterials.includes(material)) distanceMaterials.push(material); });
  const textureSlots = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"];
  let sharedTextures = 0;
  for (let index = 0; index < Math.min(nearMaterials.length, distanceMaterials.length); index++) for (const slot of textureSlots) {
    const source = nearMaterials[index][slot], duplicate = distanceMaterials[index][slot];
    if (nearMaterials[index].name === distanceMaterials[index].name && source?.isTexture && duplicate?.isTexture && source.name === duplicate.name && source.image?.width === duplicate.image?.width && source.image?.height === duplicate.image?.height) {
      distanceMaterials[index][slot] = source; duplicate.dispose(); sharedTextures++;
    }
  }
  return { near: near.scene, distance: distance.scene, sharedTextures };
}

export async function createEnvironment(host, callbacks = {}) {
  const layoutErrors = validateLayout();
  if (layoutErrors.length) throw new Error(layoutErrors.join(" · "));
  let disposed = false, frame = 0, last = performance.now(), elapsed = 0, paused = false, lastReport = 0;
  let phase = "Sunny", weather = "Clear", windPreset = "Breeze", windRadians = Math.PI * .2;
  let inspection = false, actorReady = false;
  const keyboard = new Set(), resources = new Set(), lodInstances = [], winds = [], civicLights = [];
  const scene = new THREE.Scene(), renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-label", "Playable assembled Colombo street environment");
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(45, 1, .12, 1500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * .49;
  controls.target.set(...cameraPresets.Shops.target);
  camera.position.set(...cameraPresets.Shops.position);
  const hemi = new THREE.HemisphereLight(0xe3eff3, 0x52604c, 1.35);
  const sun = new THREE.DirectionalLight(0xffdfb9, 3.2);
  sun.position.set(-36, 62, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -105, right: 105, top: 48, bottom: -48, near: .5, far: 190 });
  scene.add(hemi, sun, sun.target);
  const ground = createGround(resources);
  scene.add(ground);

  try {
  const loader = new GLTFLoader();
  const [environmentResponse, vegetationResponse] = await Promise.all([fetch("/environment/manifest.json"), fetch("/vegetation/manifest.json")]);
  if (!environmentResponse.ok || !vegetationResponse.ok) throw new Error("Required environment manifests could not be loaded");
  const environmentManifest = await environmentResponse.json(), vegetationManifest = await vegetationResponse.json();
  if (!validateEnvironmentManifest(environmentManifest)) throw new Error("Environment asset manifest is incomplete");
  const spatialErrors = validateSpatialLayout(environmentManifest, vegetationManifest);
  if (spatialErrors.length) throw new Error(spatialErrors.join(" · "));
  const environmentAssets = new Map(environmentManifest.assets.map((asset) => [asset.id, asset]));
  const vegetationAssets = new Map(vegetationManifest.assets.map((asset) => [asset.id, asset]));

  const requiredIds = new Set([...buildingPlacements, ...treePlacements, ...understoryPlacements].map((item) => item.assetId));
  const sources = new Map();
  await Promise.all([...requiredIds].map(async (id) => {
    const asset = environmentAssets.get(id) || vegetationAssets.get(id);
    if (!asset) throw new Error(`Required asset ${id} is absent from its manifest`);
    sources.set(id, { asset, roots: await loadPair(loader, asset) });
  }));

  function addPlacement(placement, kind) {
    const source = sources.get(placement.assetId), levels = [];
    const resolved = { ...placement, position: [...placement.position] };
    if (kind === "building") {
      Object.assign(resolved, resolveBuildingPlacement(placement, source.asset));
    }
    for (const [index, level] of ["near", "distance"].entries()) {
      const root = mark(source.roots[level].clone(true), resolved, kind);
      root.traverse((object) => { if (object.isMesh) object.castShadow = object.receiveShadow = true; });
      scene.add(root);
      const state = { root, level: index, placement: resolved };
      levels.push(state);
      if (kind === "vegetation") winds.push(attachWind(root, source.asset, placement.id, resources));
    }
    lodInstances.push(levels);
  }
  buildingPlacements.forEach((item) => addPlacement(item, "building"));
  treePlacements.forEach((item) => addPlacement(item, "vegetation"));
  understoryPlacements.forEach((item) => addPlacement(item, "vegetation"));

  const landscape = await loader.loadAsync("/streets/composition/landscape.glb");
  const addProp = (nodeName, placement) => {
    const source = landscape.scene.getObjectByName(nodeName);
    if (!source) throw new Error(`Required preserved prop ${nodeName} is missing`);
    const root = mark(source.clone(true), { ...placement, assetId: `preserved:${nodeName}` }, "prop");
    scene.add(root);
  };
  propPlacements.lamps.forEach((item) => addProp("StreetLamp_Civic", item));
  propPlacements.benches.forEach((item) => addProp("Bench_TimberConcrete", item));

  for (const item of propPlacements.lamps) {
    const light = new THREE.PointLight(0xffbd72, 0, 12, 2);
    light.position.set(item.position[0], 5.6, item.position[2]);
    scene.add(light); civicLights.push(light);
  }
  const landmark = await loader.loadAsync("/streets/composition/landmark-lod.glb");
  landmark.scene.position.set(128, 0, -185);
  landmark.scene.scale.setScalar(.82);
  landmark.scene.userData = { stableId: "landmark:lotus-tower", assetId: "preserved:lotus-tower-lod", kind: "landmark" };
  scene.add(landmark.scene);

  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffc35a, side: THREE.DoubleSide, transparent: true, opacity: .9 });
  addresses.forEach((address) => {
    const marker = new THREE.Mesh(new THREE.RingGeometry(.34, .52, 28), markerMaterial);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(...address.approach);
    marker.name = address.id;
    marker.userData = { stableId: address.id, buildingId: address.buildingId, role: address.role, fictionalPilot: true };
    scene.add(marker);
  });
  resources.add(markerMaterial);

  const rainGeometry = new THREE.BufferGeometry();
  const rainPoints = new Float32Array(480 * 3);
  for (let index = 0; index < 480; index++) rainPoints.set([-95 + (index * 37 % 190), 1 + (index * 17 % 19), -10 + (index * 23 % 32) / 2], index * 3);
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPoints, 3));
  const rainMaterial = new THREE.PointsMaterial({ color: 0xcbdde2, size: .045, transparent: true, opacity: .62, depthWrite: false });
  const rain = new THREE.Points(rainGeometry, rainMaterial); rain.visible = false; scene.add(rain); resources.add(rainGeometry); resources.add(rainMaterial);

  const actorRoot = new THREE.Group(), actorLean = new THREE.Group(), bikeRoot = new THREE.Group(), bikeLean = new THREE.Group();
  actorRoot.add(actorLean); bikeRoot.add(bikeLean); scene.add(actorRoot, bikeRoot);
  const actor = createStreetMovement();
  let rider, bike, mixer, contacts, actions = {}, walkWeight = 0;
  const rest = new Map(), frontRest = new THREE.Quaternion();
  const [riderGltf, bikeGltf] = await Promise.all([loader.loadAsync("/cyclist/courier-movement.glb"), loader.loadAsync("/cyclist/bicycle-fitted.glb")]);
  rider = riderGltf.scene; bike = bikeGltf.scene; actorLean.add(rider); bikeLean.add(bike);
  for (const root of [rider, bike]) root.traverse((object) => { if (object.isMesh) object.castShadow = object.receiveShadow = true; });
  mixer = new THREE.AnimationMixer(rider);
  for (const name of ["Stand", "Walk", "Mount", "Dismount", "Pedal"]) {
    const clip = riderGltf.animations.find((candidate) => candidate.name === name || candidate.name.endsWith(`|${name}`));
    if (!clip) throw new Error(`Approved movement asset is missing ${name}`);
    actions[name] = mixer.clipAction(clip).play(); actions[name].setLoop(THREE.LoopOnce, 1); actions[name].clampWhenFinished = true; actions[name].paused = true; actions[name].setEffectiveWeight(0);
  }
  for (const name of ["FrontWheel", "RearWheel"]) rest.set(name, bike.getObjectByName(name).quaternion.clone());
  frontRest.copy(bike.getObjectByName("FrontAssembly").quaternion);
  const playAt = (name, time, weight = 1) => { const action = actions[name]; action.enabled = true; action.setEffectiveWeight(weight); action.time = Math.min(action.getClip().duration, Math.max(0, time)); };
  for (const action of Object.values(actions)) action.setEffectiveWeight(0);
  playAt("Pedal", 0); mixer.update(0); scene.updateMatrixWorld(true);
  contacts = createRiderContacts(rider, bike); actorReady = true;
  function moveActor(dt) {
    if (!actorReady || paused || inspection) return;
    const forward = (keyboard.has("KeyW") || keyboard.has("ArrowUp") ? 1 : 0) - (keyboard.has("KeyS") || keyboard.has("ArrowDown") ? 1 : 0);
    const turn = (keyboard.has("KeyA") || keyboard.has("ArrowLeft") ? 1 : 0) - (keyboard.has("KeyD") || keyboard.has("ArrowRight") ? 1 : 0);
    for (const action of Object.values(actions)) action.setEffectiveWeight(0);
    stepStreet(actor, { forward, turn }, dt);
    const onFoot = actor.mode === "foot" || actor.mode === "approach";
    if (onFoot) {
      walkWeight += (Math.min(1, Math.abs(actor.walkSpeed) / .8) - walkWeight) * Math.min(1, dt * 12);
      const timing = walkTiming(actor.walkDistance / WALK_STRIDE_METRES);
      playAt("Stand", elapsed % 2, 1 - walkWeight); playAt("Walk", timing.phase * actions.Walk.getClip().duration, walkWeight);
    } else if (actor.mode === "mount") playAt("Mount", actor.elapsed);
    else if (actor.mode === "dismount") playAt("Dismount", actor.elapsed);
    else playAt("Pedal", (((actor.phase / (Math.PI * 2)) % 1) + 1) % 1 * actions.Pedal.getClip().duration);
    contacts.restore(); mixer.update(0); contacts.capture();
    const riding = actor.mode === "ride" || actor.mode === "settle";
    const actorPosition = onFoot ? actor.player : actor.bike;
    actorRoot.position.set(actorPosition.x, surfaceHeight(actorPosition.z, riding), actorPosition.z); actorRoot.rotation.y = actorPosition.yaw;
    if (onFoot) {
      const timing = walkTiming(actor.walkDistance / WALK_STRIDE_METRES);
      actorRoot.position.x -= Math.sin(actor.player.yaw) * timing.offset * walkWeight;
      actorRoot.position.z -= Math.cos(actor.player.yaw) * timing.offset * walkWeight;
    }
    bikeRoot.position.set(actor.bike.x, .055, actor.bike.z); bikeRoot.rotation.y = actor.bike.yaw;
    actorLean.rotation.z = onFoot ? 0 : actor.lean; actorLean.position.y = onFoot ? 0 : .349 * (1 - Math.cos(actor.lean));
    bikeLean.rotation.z = actor.lean; bikeLean.position.y = .349 * (1 - Math.cos(actor.lean));
    for (const name of ["FrontWheel", "RearWheel"]) bike.getObjectByName(name).quaternion.copy(rest.get(name)).multiply(new THREE.Quaternion().setFromAxisAngle(AXLE, actor.wheelAngle));
    bike.getObjectByName("Crank").rotation.x = -actor.phase;
    for (const name of ["Pedal_L", "Pedal_R"]) bike.getObjectByName(name).rotation.x = actor.phase;
    bike.getObjectByName("FrontAssembly").quaternion.copy(frontRest).multiply(new THREE.Quaternion().setFromAxisAngle(UP, actor.steer));
    const smooth = (value) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    const grip = onFoot ? 0 : actor.mode === "mount" ? smooth((actor.elapsed / actions.Mount.getClip().duration - .02) / .21) : actor.mode === "dismount" ? 1 - smooth((actor.elapsed / actions.Dismount.getClip().duration - .78) / .22) : 1;
    rider.traverse((object) => { if (object.morphTargetDictionary?.HandlebarGrip !== undefined) object.morphTargetInfluences[object.morphTargetDictionary.HandlebarGrip] = grip; });
    scene.updateMatrixWorld(true);
    if (riding) contacts.solve();
    if (!inspection) {
      const focus = new THREE.Vector3(actorPosition.x, 1.1, actorPosition.z), offset = new THREE.Vector3(Math.sin(actorPosition.yaw) * 5.5, 2.8, Math.cos(actorPosition.yaw) * 5.5);
      controls.target.lerp(focus, 1 - Math.exp(-dt * 4)); camera.position.lerp(focus.add(offset), 1 - Math.exp(-dt * 3));
    }
  }

  function interact() {
    if (!actorReady) return;
    actor.paused = paused;
    interactStreet(actor, paused || inspection);
  }
  function keydown(event) { if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return; if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyE", "Space"].includes(event.code)) event.preventDefault(); if (event.code === "KeyE" && !event.repeat) interact(); else if (event.code === "Space" && !event.repeat) { paused = !paused; actor.paused = paused; keyboard.clear(); } else keyboard.add(event.code); }
  function keyup(event) { keyboard.delete(event.code); }
  function blur() { keyboard.clear(); }
  window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); window.addEventListener("blur", blur);

  function applyPhase() {
    const value = dayPhase(phase); scene.background = new THREE.Color(value.background); scene.fog = new THREE.FogExp2(value.fog, WEATHER[weather].fog); hemi.intensity = value.hemi; sun.intensity = value.sun; renderer.toneMappingExposure = value.exposure;
    civicLights.forEach((light) => { light.intensity = value.lights ? 5.2 : 0; }); rain.visible = weather === "Rain";
  }
  applyPhase();
  function preset(name) { const value = cameraPresets[name] || cameraPresets.Overview; inspection = true; controls.enabled = true; camera.position.set(...value.position); controls.target.set(...value.target); controls.update(); }
  function resize() { const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function render(now) {
    frame = 0; if (disposed) return; const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!paused) elapsed += dt;
    moveActor(dt);
    for (const levels of lodInstances) { const selected = distanceForLod(camera.position, levels[0].placement); levels.forEach((entry) => { entry.root.visible = entry.level === selected; }); }
    for (const state of winds) updateWind(state, elapsed, WIND[windPreset], windRadians);
    if (rain.visible && !paused) { rain.position.y = -((elapsed * 8) % 10); if (rain.position.y < -8) rain.position.y = 10; }
    controls.update(); renderer.render(scene, camera);
    if (now - lastReport > 180) {
      lastReport = now;
      callbacks.onState?.({ ready: actorReady, paused, inspection, ...movementStatus(actor), speed: Math.abs(actor.mode === "ride" ? actor.speed : actor.walkSpeed) * 3.6, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
    }
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);
  callbacks.onReady?.({ buildings: buildingPlacements.length, trees: treePlacements.length, understory: understoryPlacements.length, addresses: addresses.length });
  return {
    preset,
    focusStop(id) { const address = addresses.find((item) => item.id === id); if (!address) return; inspection = true; controls.enabled = true; controls.target.set(address.approach[0], 1, address.approach[2]); camera.position.set(address.approach[0] - 7, 4.2, address.approach[2] + (address.approach[2] > 0 ? -6 : 6)); controls.update(); },
    follow() { inspection = false; controls.enabled = false; },
    inspect() { inspection = true; controls.enabled = true; },
    interact,
    setPhase(value) { phase = value; applyPhase(); },
    setWeather(value) { weather = WEATHER[value] ? value : "Clear"; applyPhase(); },
    setWind(value) { windPreset = WIND[value] !== undefined ? value : "Breeze"; },
    setDirection(degrees) { windRadians = THREE.MathUtils.degToRad(degrees); },
    pause(value) { paused = Boolean(value); actor.paused = paused; keyboard.clear(); },
    stats() { return { actor: { ...actor, transition: actor.transition ? { ...actor.transition } : null }, phase, weather, wind: windPreset, elapsed, paused, inspection, lights: civicLights.filter((light) => light.intensity > 0).length, loaded: { buildings: buildingPlacements.length, trees: treePlacements.length, understory: understoryPlacements.length, addresses: addresses.length, assetFamilies: sources.size, sharedLodTextures: [...sources.values()].reduce((sum, source) => sum + source.roots.sharedTextures, 0) }, bounds: { ...STREET_BOUNDS }, drawCalls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; },
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", blur); controls.dispose(); mixer?.stopAllAction(); release(scene, resources); resources.forEach((resource) => resource.dispose?.()); renderer.dispose(); renderer.domElement.remove(); }
  };
  } catch (error) {
    release(scene, resources); resources.forEach((resource) => resource.dispose?.()); controls.dispose(); renderer.dispose(); renderer.domElement.remove();
    throw error;
  }
}
