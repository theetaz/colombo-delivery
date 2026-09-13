import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CHARACTER_SLOT_ITEMS as CHARACTER_CATALOG,
  AUTHORED_CHARACTER_COLORS,
  type CharacterItemId as CharacterOption,
  type CharacterSlot,
  type CharacterColorRegion,
} from "../customizer/catalog";
import { disposeDeliveryBackpack, loadDeliveryBackpack, setDeliveryBackpackColor } from "./DeliveryBackpack";

export { CHARACTER_CATALOG };

const DEFAULTS: Record<CharacterSlot, string> = {
  face: "classic", hair: "wavy", top: "crewtee", bottom: "shorts",
  shoes: "canvas", sunglasses: "none", necklace: "none", watch: "none",
  backpack: "none",
};

const SOURCE_MATERIAL_REGIONS: Partial<Record<string, CharacterColorRegion>> = {
  Teen_Skin: "skin", Teen_Hair: "hair", Teen_Shirt: "top", Teen_Shorts: "bottom", Teen_Shoes: "shoes",
  Custom_Top_Trim: "top", Custom_Bottom: "bottom", Custom_Shoes: "shoes", Custom_Shoe_Accent: "shoes",
};

interface TintBinding {
  material: THREE.MeshStandardMaterial;
  color: { value: THREE.Color };
  mix: { value: number };
  valueScale: { value: number };
  authoredColor: THREE.Color;
  solid: boolean;
}

type TintState = Record<CharacterColorRegion, { color: { value: THREE.Color }; mix: { value: number }; valueScale: { value: number } }>;

export class CharacterAvatar {
  readonly group = new THREE.Group();
  readonly selection: Record<CharacterSlot, string> = { ...DEFAULTS };
  private model?: THREE.Object3D;
  private itemRoots = new Map<CharacterSlot, Map<string, THREE.Object3D>>();
  private materials = new Map<CharacterColorRegion, Set<THREE.Material>>();
  private tintBindings = new Map<CharacterColorRegion, TintBinding[]>();
  private wholeRegions = new WeakMap<THREE.Material, "hair" | "bottom">();
  private readonly tintState = Object.fromEntries(Object.entries(AUTHORED_CHARACTER_COLORS).map(([region, color]) => [region, {
    color: { value: new THREE.Color(color) }, mix: { value: 0 }, valueScale: { value: 1 },
  }])) as TintState;
  private maskTexture?: THREE.Texture;
  private backpack?: THREE.Object3D;
  private backpackColor: THREE.ColorRepresentation = AUTHORED_CHARACTER_COLORS.backpack;
  private generation = 0;

  async load(url = `${import.meta.env.BASE_URL}models/teen_courier_customization.glb`): Promise<void> {
    const generation = ++this.generation;
    this.clearModel();
    const gltf = await new GLTFLoader().loadAsync(url);
    if (generation !== this.generation) {
      disposeObject(gltf.scene);
      return;
    }
    this.model = gltf.scene;
    this.group.add(this.model);
    try {
      const backpack = await loadDeliveryBackpack();
      if (generation !== this.generation) { disposeDeliveryBackpack(backpack); return; }
      this.backpack = backpack;
      setDeliveryBackpackColor(backpack, this.backpackColor);
      this.group.add(backpack);
    } catch {
      // The wardrobe remains usable if the optional standalone equipment asset fails.
    }
    if (generation !== this.generation) return;
    this.indexItems();
    this.isolateMaterials();
    if (!await this.installSourcePreservingTints(gltf, generation)) return;
    for (const slot of Object.keys(CHARACTER_CATALOG) as CharacterSlot[]) {
      this.setOption(slot, this.selection[slot] as CharacterOption<typeof slot>);
    }
  }

  setOption<S extends CharacterSlot>(slot: S, id: CharacterOption<S>): boolean {
    if (!(CHARACTER_CATALOG[slot] as readonly string[]).includes(id)) return false;
    if (slot === "backpack") {
      if (id === "insulated" && !this.backpack) return false;
      if (this.backpack) this.backpack.visible = id === "insulated";
      this.selection.backpack = id;
      return true;
    }
    const roots = this.itemRoots.get(slot);
    if (!roots) return false;
    if (id !== "none" && !roots.has(id)) return false;
    roots.forEach((root, itemId) => { root.visible = id !== "none" && itemId === id; });
    this.selection[slot] = id;
    return id === "none" || roots.has(id);
  }

  setColor(region: CharacterColorRegion, color: THREE.ColorRepresentation): void {
    if (region === "backpack") {
      this.backpackColor = color;
      if (this.backpack) setDeliveryBackpackColor(this.backpack, color);
      return;
    }
    const target = new THREE.Color(color);
    const authored = new THREE.Color(AUTHORED_CHARACTER_COLORS[region]);
    const useAuthored = target.getHex() === authored.getHex();
    const state = this.tintState[region];
    state.color.value.copy(target);
    state.mix.value = useAuthored ? 0 : 1;
    state.valueScale.value = Math.max(target.r, target.g, target.b) / Math.max(authored.r, authored.g, authored.b);
    for (const binding of this.tintBindings.get(region) ?? []) {
      binding.color.value.copy(target);
      binding.mix.value = useAuthored ? 0 : 1;
      binding.valueScale.value = Math.max(target.r, target.g, target.b) / Math.max(authored.r, authored.g, authored.b);
      if (binding.solid) binding.material.color.copy(useAuthored ? binding.authoredColor : target);
    }
  }

  resetColors(): void {
    for (const region of Object.keys(AUTHORED_CHARACTER_COLORS) as CharacterColorRegion[]) this.setColor(region, AUTHORED_CHARACTER_COLORS[region]);
  }

  dispose(): void {
    this.generation += 1;
    this.clearModel();
  }

  private indexItems(): void {
    this.itemRoots.clear();
    for (const slot of Object.keys(CHARACTER_CATALOG) as CharacterSlot[]) {
      if (slot === "backpack") continue;
      const items = new Map<string, THREE.Object3D>();
      for (const id of CHARACTER_CATALOG[slot]) {
        if (id === "none") continue;
        const node = this.model?.getObjectByName(`Item_${slot}_${id}`);
        if (node) items.set(id, node);
      }
      this.itemRoots.set(slot, items);
    }
  }

  private isolateMaterials(): void {
    this.materials.clear();
    this.tintBindings.clear();
    this.wholeRegions = new WeakMap();
    const replaced = new Set<THREE.Material>();
    this.model?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const source = Array.isArray(object.material) ? object.material : [object.material];
      source.forEach((material) => replaced.add(material));
      const clones = source.map((material) => material.clone());
      object.material = Array.isArray(object.material) ? clones : clones[0]!;
      const itemSlot = findItemSlot(object);
      if ((itemSlot === "hair" || itemSlot === "bottom") && !preservesSourceTint(object)) {
        clones.forEach((material) => this.wholeRegions.set(material, itemSlot));
      }
      for (const material of clones) {
        const region = SOURCE_MATERIAL_REGIONS[material.name];
        if (!region) continue;
        const set = this.materials.get(region) ?? new Set<THREE.Material>();
        set.add(material); this.materials.set(region, set);
      }
    });
    replaced.forEach((material) => material.dispose());
  }

  private async installSourcePreservingTints(gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>, generation: number): Promise<boolean> {
    const contract = readTintContract(this.model?.getObjectByName("TeenCourierCustomization")?.userData.customization);
    if (!contract) throw new Error("Character asset is missing its source-preserving tint mask contract");
    const mask = await gltf.parser.getDependency("texture", contract.maskTextureIndex) as THREE.Texture;
    if (generation !== this.generation) { mask.dispose(); return false; }
    this.maskTexture = mask;
    for (const materials of this.materials.values()) {
      for (const candidate of materials) {
        if (!(candidate instanceof THREE.MeshStandardMaterial)) continue;
        const region = SOURCE_MATERIAL_REGIONS[candidate.name];
        if (!region) continue;
        const solid = candidate.name.startsWith("Custom_");
        const binding: TintBinding = {
          material: candidate,
          color: { value: new THREE.Color(AUTHORED_CHARACTER_COLORS[region]) },
          mix: { value: 0 },
          valueScale: { value: 1 },
          authoredColor: candidate.color.clone(),
          solid,
        };
        const list = this.tintBindings.get(region) ?? [];
        list.push(binding); this.tintBindings.set(region, list);
        if (!solid && candidate.map) {
          const wholeRegion = this.wholeRegions.get(candidate);
          installAtlasTintShader(candidate, this.tintState, this.maskTexture, contract.channels, wholeRegion);
        }
      }
    }
    return generation === this.generation;
  }

  private clearModel(): void {
    if (this.backpack) {
      this.group.remove(this.backpack);
      disposeDeliveryBackpack(this.backpack);
      this.backpack = undefined;
    }
    if (!this.model) return;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
      });
    });
    this.group.remove(this.model);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    this.maskTexture?.dispose();
    this.maskTexture = undefined;
    this.model = undefined;
    this.itemRoots.clear(); this.materials.clear(); this.tintBindings.clear(); this.wholeRegions = new WeakMap();
  }
}

interface TintContract {
  ready: true;
  maskTextureIndex: number;
  texCoord: 0;
  channels: { skin: "r" | "g" | "b"; shirt: "r" | "g" | "b"; shoes: "r" | "g" | "b" };
  mode: "masked_hsv_hue_saturation";
  preserveValue: true;
}

function readTintContract(value: unknown): TintContract | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TintContract>;
  const channel = (value: unknown): value is "r" | "g" | "b" => value === "r" || value === "g" || value === "b";
  return candidate.ready === true && Number.isInteger(candidate.maskTextureIndex) && candidate.texCoord === 0
    && candidate.mode === "masked_hsv_hue_saturation" && candidate.preserveValue === true
    && channel(candidate.channels?.skin) && channel(candidate.channels?.shirt) && channel(candidate.channels?.shoes)
    ? candidate as TintContract : null;
}

function installAtlasTintShader(
  material: THREE.MeshStandardMaterial,
  state: TintState,
  mask: THREE.Texture,
  channels: TintContract["channels"],
  wholeRegion?: "hair" | "bottom",
): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      avatarTintMask: { value: mask },
      avatarSkinTint: state.skin.color, avatarSkinMix: state.skin.mix, avatarSkinValue: state.skin.valueScale,
      avatarTopTint: state.top.color, avatarTopMix: state.top.mix, avatarTopValue: state.top.valueScale,
      avatarShoesTint: state.shoes.color, avatarShoesMix: state.shoes.mix, avatarShoesValue: state.shoes.valueScale,
      avatarWholeTint: wholeRegion ? state[wholeRegion].color : { value: new THREE.Color() },
      avatarWholeMix: wholeRegion ? state[wholeRegion].mix : { value: 0 },
      avatarWholeValue: wholeRegion ? state[wholeRegion].valueScale : { value: 1 },
    });
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", `
      uniform sampler2D avatarTintMask;
      uniform vec3 avatarSkinTint; uniform float avatarSkinMix; uniform float avatarSkinValue;
      uniform vec3 avatarTopTint; uniform float avatarTopMix; uniform float avatarTopValue;
      uniform vec3 avatarShoesTint; uniform float avatarShoesMix; uniform float avatarShoesValue;
      uniform vec3 avatarWholeTint; uniform float avatarWholeMix; uniform float avatarWholeValue;
      vec3 avatarRgb2Hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
      vec3 avatarHsv2Rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y); }
      vec3 avatarRecolor(vec3 source, vec3 target, float valueScale){ vec3 s=avatarRgb2Hsv(source); vec3 t=avatarRgb2Hsv(target); return avatarHsv2Rgb(vec3(t.x,t.y,clamp(s.z*valueScale,0.,1.))); }
      void main() {`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      vec3 avatarMask = texture2D(avatarTintMask, vMapUv).rgb;
      vec3 avatarSource = diffuseColor.rgb;
      diffuseColor.rgb = mix(diffuseColor.rgb, avatarRecolor(avatarSource, avatarWholeTint, avatarWholeValue), avatarWholeMix);
      diffuseColor.rgb = mix(diffuseColor.rgb, avatarRecolor(avatarSource, avatarSkinTint, avatarSkinValue), avatarMask.${channels.skin} * avatarSkinMix);
      diffuseColor.rgb = mix(diffuseColor.rgb, avatarRecolor(avatarSource, avatarTopTint, avatarTopValue), avatarMask.${channels.shirt} * avatarTopMix);
      diffuseColor.rgb = mix(diffuseColor.rgb, avatarRecolor(avatarSource, avatarShoesTint, avatarShoesValue), avatarMask.${channels.shoes} * avatarShoesMix);`);
  };
  material.customProgramCacheKey = () => `avatar-atlas-hsv-v2-${channels.skin}${channels.shirt}${channels.shoes}-${wholeRegion ?? "masked"}`;
  material.needsUpdate = true;
}

function findItemSlot(object: THREE.Object3D): CharacterSlot | undefined {
  let current: THREE.Object3D | null = object;
  while (current) {
    const match = /^Item_([^_]+)_/.exec(current.name);
    const slot = match?.[1];
    if (slot && slot in CHARACTER_CATALOG) return slot as CharacterSlot;
    current = current.parent;
  }
  return undefined;
}

function preservesSourceTint(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.preserveSourceTint === true) return true;
    if (/^Item_[^_]+_/.test(current.name)) return false;
    current = current.parent;
  }
  return false;
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
