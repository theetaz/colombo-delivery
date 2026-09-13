import {
  DEFAULT_CHARACTER_CATALOG,
  AUTHORED_CHARACTER_COLORS,
  type BottomId,
  type CharacterCatalogAvailability,
  type FaceId,
  type HairId,
  type NecklaceId,
  type ShoesId,
  type SunglassesId,
  type TopId,
  type WatchId,
  type BackpackId,
  catalogSupports,
} from "./catalog";

export const CHARACTER_APPEARANCE_STORAGE_KEY = "colombo-delivery:character-look";

export interface CharacterAppearance {
  version: 2;
  face: FaceId;
  hair: HairId;
  top: TopId;
  bottom: BottomId;
  shoes: ShoesId;
  sunglasses: SunglassesId;
  necklace: NecklaceId;
  watch: WatchId;
  backpack: BackpackId;
  colors: {
    skin: string;
    hair: string;
    top: string;
    bottom: string;
    shoes: string;
    backpack: string;
  };
}

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  version: 2,
  face: "classic",
  hair: "wavy",
  top: "crewtee",
  bottom: "shorts",
  shoes: "canvas",
  sunglasses: "none",
  necklace: "none",
  watch: "none",
  backpack: "none",
  colors: { ...AUTHORED_CHARACTER_COLORS },
};

export type CharacterAppearanceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const HEX_COLOR = /^#[0-9A-F]{6}$/;

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase();
  return HEX_COLOR.test(normalized) ? normalized : null;
}

export function validateCharacterAppearance(
  value: unknown,
  catalog: CharacterCatalogAvailability = DEFAULT_CHARACTER_CATALOG,
): CharacterAppearance | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 && candidate.version !== 2) return null;
  if (!catalogSupports(catalog, "face", candidate.face as FaceId)) return null;
  if (!catalogSupports(catalog, "hair", candidate.hair as HairId)) return null;
  if (!catalogSupports(catalog, "top", candidate.top as TopId)) return null;
  if (!catalogSupports(catalog, "bottom", candidate.bottom as BottomId)) return null;
  if (!catalogSupports(catalog, "shoes", candidate.shoes as ShoesId)) return null;
  if (!catalogSupports(catalog, "sunglasses", candidate.sunglasses as SunglassesId)) return null;
  if (!catalogSupports(catalog, "necklace", candidate.necklace as NecklaceId)) return null;
  if (!catalogSupports(catalog, "watch", candidate.watch as WatchId)) return null;
  const backpack = candidate.version === 1 ? "none" : candidate.backpack;
  if (!catalogSupports(catalog, "backpack", backpack as BackpackId)) return null;
  if (!candidate.colors || typeof candidate.colors !== "object") return null;
  const colors = candidate.colors as Record<string, unknown>;
  const skin = normalizeHexColor(colors.skin);
  const hair = normalizeHexColor(colors.hair);
  const top = normalizeHexColor(colors.top);
  const bottom = normalizeHexColor(colors.bottom);
  const shoes = normalizeHexColor(colors.shoes);
  const backpackColor = candidate.version === 1 ? AUTHORED_CHARACTER_COLORS.backpack : normalizeHexColor(colors.backpack);
  if (!skin || !hair || !top || !bottom || !shoes || !backpackColor) return null;
  return {
    version: 2,
    face: candidate.face as FaceId,
    hair: candidate.hair as HairId,
    top: candidate.top as TopId,
    bottom: candidate.bottom as BottomId,
    shoes: candidate.shoes as ShoesId,
    sunglasses: candidate.sunglasses as SunglassesId,
    necklace: candidate.necklace as NecklaceId,
    watch: candidate.watch as WatchId,
    backpack: backpack as BackpackId,
    colors: { skin, hair, top, bottom, shoes, backpack: backpackColor },
  };
}

export function cloneCharacterAppearance(appearance: CharacterAppearance = DEFAULT_CHARACTER_APPEARANCE): CharacterAppearance {
  return { ...appearance, colors: { ...appearance.colors } };
}

export function characterAppearancesEqual(first: CharacterAppearance, second: CharacterAppearance): boolean {
  return first.version === second.version
    && first.face === second.face
    && first.hair === second.hair
    && first.top === second.top
    && first.bottom === second.bottom
    && first.shoes === second.shoes
    && first.sunglasses === second.sunglasses
    && first.necklace === second.necklace
    && first.watch === second.watch
    && first.backpack === second.backpack
    && first.colors.skin === second.colors.skin
    && first.colors.hair === second.colors.hair
    && first.colors.top === second.colors.top
    && first.colors.bottom === second.colors.bottom
    && first.colors.shoes === second.colors.shoes
    && first.colors.backpack === second.colors.backpack;
}

export function defaultCharacterAppearance(catalog: CharacterCatalogAvailability = DEFAULT_CHARACTER_CATALOG): CharacterAppearance {
  const choose = <Slot extends keyof CharacterCatalogAvailability>(slot: Slot, preferred: CharacterAppearance[Slot]): CharacterAppearance[Slot] => {
    const available = catalog[slot] as readonly CharacterAppearance[Slot][];
    return available.includes(preferred) ? preferred : available[0]!;
  };
  return {
    ...cloneCharacterAppearance(),
    face: choose("face", DEFAULT_CHARACTER_APPEARANCE.face),
    hair: choose("hair", DEFAULT_CHARACTER_APPEARANCE.hair),
    top: choose("top", DEFAULT_CHARACTER_APPEARANCE.top),
    bottom: choose("bottom", DEFAULT_CHARACTER_APPEARANCE.bottom),
    shoes: choose("shoes", DEFAULT_CHARACTER_APPEARANCE.shoes),
    sunglasses: choose("sunglasses", DEFAULT_CHARACTER_APPEARANCE.sunglasses),
    necklace: choose("necklace", DEFAULT_CHARACTER_APPEARANCE.necklace),
    watch: choose("watch", DEFAULT_CHARACTER_APPEARANCE.watch),
    backpack: choose("backpack", DEFAULT_CHARACTER_APPEARANCE.backpack),
  };
}

export function loadCharacterAppearance(
  storage?: Pick<CharacterAppearanceStorage, "getItem"> | null,
  catalog: CharacterCatalogAvailability = DEFAULT_CHARACTER_CATALOG,
): CharacterAppearance {
  const fallback = defaultCharacterAppearance(catalog);
  if (storage === null) return fallback;
  try {
    const source = storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : storage;
    if (!source) return fallback;
    const raw = JSON.parse(source.getItem(CHARACTER_APPEARANCE_STORAGE_KEY) ?? "null");
    const direct = validateCharacterAppearance(raw, catalog);
    if (direct) return direct;
    const complete = validateCharacterAppearance(raw, DEFAULT_CHARACTER_CATALOG);
    if (complete && !catalogSupports(catalog, "backpack", complete.backpack)) {
      return validateCharacterAppearance({ ...complete, backpack: "none" }, catalog) ?? fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveCharacterAppearance(
  appearance: CharacterAppearance,
  storage?: Pick<CharacterAppearanceStorage, "setItem"> | null,
  catalog: CharacterCatalogAvailability = DEFAULT_CHARACTER_CATALOG,
): boolean {
  const validated = validateCharacterAppearance(appearance, catalog);
  if (!validated || storage === null) return false;
  try {
    const destination = storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : storage;
    if (!destination) return false;
    destination.setItem(CHARACTER_APPEARANCE_STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch {
    return false;
  }
}

export function resetCharacterAppearance(storage?: Pick<CharacterAppearanceStorage, "removeItem"> | null): boolean {
  if (storage === null) return false;
  try {
    const destination = storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : storage;
    if (!destination) return false;
    destination.removeItem(CHARACTER_APPEARANCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
