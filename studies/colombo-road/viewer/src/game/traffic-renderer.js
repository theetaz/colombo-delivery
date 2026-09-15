import * as THREE from "three";

const ASSET_ROOT = "/streets/composition";
const WHEEL_AXIS = new THREE.Vector3(1, 0, 0);
const PREFAB_BY_ASSET = {
  "traffic-compact-car": "TRAFFIC_CompactCar",
  "traffic-delivery-van": "TRAFFIC_DeliveryVan",
  "traffic-scooter-rider": "TRAFFIC_ScooterRider",
};

export async function createTrafficRenderer(scene, loader) {
  const [response, gltf] = await Promise.all([
    fetch(`${ASSET_ROOT}/traffic.manifest.json`),
    loader.loadAsync(`${ASSET_ROOT}/traffic.glb`),
  ]);
  if (!response.ok) {
    gltf.scene.traverse((object) => { object.geometry?.dispose?.(); for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) material.dispose?.(); });
    throw new Error(`Traffic manifest returned ${response.status}`);
  }
  const manifest = await response.json();
  const entries = new Map(manifest.assets.map((entry) => [entry.assetId, entry]));
  const group = new THREE.Group();
  group.name = "traffic:game";
  group.userData = { stableId: group.name, kind: "traffic-group" };
  scene.add(group);
  const actors = new Map();

  function add(item) {
    const entry = entries.get(item.assetId);
    const nodeName = entry?.nodeName || PREFAB_BY_ASSET[item.assetId];
    const source = nodeName && gltf.scene.getObjectByName(nodeName);
    if (!source || !entry) throw new Error(`Required traffic prefab ${item.assetId || item.id} is missing`);
    const root = source.clone(true);
    root.name = item.id;
    root.userData = { ...root.userData, stableId: item.id, instanceId: item.id, kind: "traffic", prefabAssetId: item.assetId };
    const wheelNames = new Set(entry.motion?.wheelNodes || []), wheels = [];
    root.traverse((object) => {
      if (wheelNames.has(object.name)) wheels.push({ object, rest: object.quaternion.clone() });
      if (object.isMesh) object.castShadow = object.receiveShadow = true;
    });
    group.add(root);
    const actor = { root, wheels };
    actors.set(item.id, actor);
    return actor;
  }

  function apply(items = []) {
    const live = new Set();
    for (const item of items) {
      live.add(item.id);
      const actor = actors.get(item.id) || add(item);
      // Grounded prefabs sit on the same asphalt surface as the courier bicycle.
      actor.root.position.set(item.x, .055, item.z);
      // Traffic assets are authored facing +Z; eastbound is +X.
      actor.root.rotation.y = (item.direction ?? (item.lane === "east" ? 1 : -1)) > 0 ? Math.PI / 2 : -Math.PI / 2;
      const wheelAngle = Number(item.wheelAngle) || 0;
      for (const wheel of actor.wheels) wheel.object.quaternion.copy(wheel.rest).multiply(new THREE.Quaternion().setFromAxisAngle(WHEEL_AXIS, wheelAngle));
    }
    for (const [id, actor] of actors) if (!live.has(id)) actor.root.visible = false; else actor.root.visible = true;
  }

  return {
    apply,
    count: () => actors.size,
    dispose() {
      const disposable = new Set();
      gltf.scene.traverse((object) => {
        if (object.geometry) disposable.add(object.geometry);
        for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) disposable.add(material);
      });
      for (const resource of disposable) {
        for (const value of Object.values(resource)) if (value?.isTexture) value.dispose();
        resource.dispose?.();
      }
      group.removeFromParent(); actors.clear();
    },
  };
}
