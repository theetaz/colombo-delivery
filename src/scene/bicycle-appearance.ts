import * as THREE from "three";

export const COURIER_APPEARANCE_STORAGE_KEY = "colombo-delivery:courier-appearance";

export interface CourierAppearance {
  version: 1;
  face: "classic" | "soft" | "angular";
  skin: "warm" | "deep" | "golden";
  hair: "black" | "brown" | "silver";
  outfit: "sunrise" | "ocean" | "forest";
  bag: "coral" | "ochre" | "teal";
}

export const DEFAULT_COURIER_APPEARANCE: CourierAppearance = {
  version: 1,
  face: "classic",
  skin: "warm",
  hair: "black",
  outfit: "sunrise",
  bag: "coral",
};

const OPTIONS = {
  face: ["classic", "soft", "angular"],
  skin: ["warm", "deep", "golden"],
  hair: ["black", "brown", "silver"],
  outfit: ["sunrise", "ocean", "forest"],
  bag: ["coral", "ochre", "teal"],
} as const;

const COLORS = {
  skin: { warm: 0xa46950, deep: 0x704936, golden: 0xb97c57 },
  hair: { black: 0x171b20, brown: 0x4b2d22, silver: 0x7e8286 },
  shirt: { sunrise: 0xe8b93f, ocean: 0x2d8192, forest: 0x507a55 },
  shorts: { sunrise: 0x17677c, ocean: 0x2d476d, forest: 0x30483e },
  bag: { coral: 0xb94732, ochre: 0xaa6c2b, teal: 0x1d7373 },
  trim: { coral: 0x4f2c24, ochre: 0x503820, teal: 0x193f40 },
} as const;

export function validateCourierAppearance(value: unknown): CourierAppearance | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return null;
  for (const key of Object.keys(OPTIONS) as Array<keyof typeof OPTIONS>) {
    if (!(OPTIONS[key] as readonly unknown[]).includes(candidate[key])) return null;
  }
  return {
    version: 1,
    face: candidate.face as CourierAppearance["face"],
    skin: candidate.skin as CourierAppearance["skin"],
    hair: candidate.hair as CourierAppearance["hair"],
    outfit: candidate.outfit as CourierAppearance["outfit"],
    bag: candidate.bag as CourierAppearance["bag"],
  };
}

export function loadCourierAppearance(storage?: Pick<Storage, "getItem"> | null): CourierAppearance {
  if (storage === null) return { ...DEFAULT_COURIER_APPEARANCE };
  try {
    const source = storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : storage;
    if (!source) return { ...DEFAULT_COURIER_APPEARANCE };
    return validateCourierAppearance(JSON.parse(source.getItem(COURIER_APPEARANCE_STORAGE_KEY) ?? "null")) ?? { ...DEFAULT_COURIER_APPEARANCE };
  } catch {
    return { ...DEFAULT_COURIER_APPEARANCE };
  }
}

export function saveCourierAppearance(appearance: CourierAppearance, storage?: Pick<Storage, "setItem"> | null): boolean {
  const normalized = validateCourierAppearance(appearance);
  if (storage === null || !normalized) return false;
  try {
    const destination = storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : storage;
    if (!destination) return false;
    destination.setItem(COURIER_APPEARANCE_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function cloneCharacterMaterials(root: THREE.Object3D): Map<string, THREE.Material[]> {
  const clonesBySource = new Map<THREE.Material, THREE.Material>();
  const materialsByName = new Map<string, THREE.Material[]>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const isolated = sourceMaterials.map((source) => {
      let clone = clonesBySource.get(source);
      if (!clone) {
        const created = source.clone();
        clone = created;
        clonesBySource.set(source, created);
        const named = materialsByName.get(created.name) ?? [];
        named.push(created);
        materialsByName.set(created.name, named);
      }
      return clone!;
    });
    node.material = Array.isArray(node.material) ? isolated : isolated[0]!;
  });
  return materialsByName;
}

export function applyCourierAppearance(root: THREE.Object3D, materials: Map<string, THREE.Material[]>, appearance: CourierAppearance): void {
  const colorForMaterial: Record<string, number> = {
    Rider_Skin: COLORS.skin[appearance.skin],
    Rider_Hair: COLORS.hair[appearance.hair],
    Rider_Shirt: COLORS.shirt[appearance.outfit],
    Rider_Shorts: COLORS.shorts[appearance.outfit],
    Courier_Bag: COLORS.bag[appearance.bag],
    Courier_Bag_Trim: COLORS.trim[appearance.bag],
  };
  for (const [name, color] of Object.entries(colorForMaterial)) {
    for (const material of materials.get(name) ?? []) {
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) material.color.setHex(color);
    }
  }
  const selectedName = `Face_Profile_${appearance.face[0]!.toUpperCase()}${appearance.face.slice(1)}`;
  for (const name of ["Face_Profile_Classic", "Face_Profile_Soft", "Face_Profile_Angular"]) {
    const profile = root.getObjectByName(name);
    if (profile) {
      const selected = name === selectedName;
      profile.visible = selected;
      profile.scale.setScalar(selected ? 1 : 0.001);
    }
  }
}
