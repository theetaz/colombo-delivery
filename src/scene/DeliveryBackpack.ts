import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const DELIVERY_BACKPACK_MODEL_URL = "models/delivery_backpack.glb";
export const RIDING_DELIVERY_BACKPACK_MODEL_URL = "models/delivery_backpack_riding.glb";
export async function loadDeliveryBackpack(
  url = `${import.meta.env.BASE_URL}${DELIVERY_BACKPACK_MODEL_URL}`,
): Promise<THREE.Object3D> {
  const { scene } = await new GLTFLoader().loadAsync(url);
  scene.name = "Insulated delivery backpack";
  const replacedMaterials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    source.forEach((material) => replacedMaterials.add(material));
    const clones = source.map((material) => material.clone());
    object.material = Array.isArray(object.material) ? clones : clones[0]!;
  });
  replacedMaterials.forEach((material) => material.dispose());
  return scene;
}

export function setDeliveryBackpackColor(root: THREE.Object3D, color: THREE.ColorRepresentation): void {
  const next = new THREE.Color(color);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (material.name === "DeliveryBackpack_Teal") material.color.copy(next);
      if (material.name === "DeliveryBackpack_TealDark") material.color.copy(next).multiplyScalar(0.58);
    }
  });
}

export function disposeDeliveryBackpack(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}
