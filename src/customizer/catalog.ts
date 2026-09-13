export const CHARACTER_SLOT_ITEMS = {
  face: ["classic", "soft", "angular"],
  hair: ["wavy", "crop", "quiff"],
  top: ["crewtee", "polo", "buttonshirt"],
  bottom: ["shorts", "trousers"],
  shoes: ["canvas", "runner", "hightop"],
  sunglasses: ["none", "round", "squareframe"],
  necklace: ["none", "chain"],
  watch: ["none", "sport"],
  backpack: ["none", "insulated"],
} as const;

export type CharacterSlot = keyof typeof CHARACTER_SLOT_ITEMS;
export type CharacterItemId<Slot extends CharacterSlot> = (typeof CHARACTER_SLOT_ITEMS)[Slot][number];
export type FaceId = CharacterItemId<"face">;
export type HairId = CharacterItemId<"hair">;
export type TopId = CharacterItemId<"top">;
export type BottomId = CharacterItemId<"bottom">;
export type ShoesId = CharacterItemId<"shoes">;
export type SunglassesId = CharacterItemId<"sunglasses">;
export type NecklaceId = CharacterItemId<"necklace">;
export type WatchId = CharacterItemId<"watch">;
export type BackpackId = CharacterItemId<"backpack">;

export const CHARACTER_COLOR_REGIONS = ["skin", "hair", "top", "bottom", "shoes", "backpack"] as const;
export type CharacterColorRegion = (typeof CHARACTER_COLOR_REGIONS)[number];

export const AUTHORED_CHARACTER_COLORS: Record<CharacterColorRegion, `#${string}`> = {
  skin: "#A86D52", hair: "#241B19", top: "#267789", bottom: "#414147", shoes: "#E2E0D8", backpack: "#168C85",
};

export const CHARACTER_COLOR_PALETTES = {
  skin: [
    { id: "authored", label: "Warm", color: AUTHORED_CHARACTER_COLORS.skin },
    { id: "deep", label: "Deep", color: "#6F4333" },
    { id: "golden", label: "Golden", color: "#BC805B" },
  ],
  hair: [
    { id: "ink", label: "Ink", color: AUTHORED_CHARACTER_COLORS.hair },
    { id: "brown", label: "Brown", color: "#55372C" },
    { id: "auburn", label: "Auburn", color: "#713B2D" },
  ],
  top: [
    { id: "authored", label: "Teal", color: AUTHORED_CHARACTER_COLORS.top },
    { id: "coral", label: "Coral", color: "#B95342" },
    { id: "ochre", label: "Ochre", color: "#B98232" },
  ],
  bottom: [
    { id: "charcoal", label: "Charcoal", color: AUTHORED_CHARACTER_COLORS.bottom },
    { id: "navy", label: "Navy", color: "#283A55" },
    { id: "olive", label: "Olive", color: "#4C5740" },
  ],
  shoes: [
    { id: "authored", label: "Cream", color: AUTHORED_CHARACTER_COLORS.shoes },
    { id: "graphite", label: "Graphite", color: "#35383D" },
    { id: "rust", label: "Rust", color: "#9A4C35" },
  ],
  backpack: [
    { id: "teal", label: "Teal", color: AUTHORED_CHARACTER_COLORS.backpack },
    { id: "coral", label: "Coral", color: "#D85E3F" },
    { id: "ochre", label: "Ochre", color: "#C18A2F" },
  ],
} as const satisfies Record<CharacterColorRegion, readonly { id: string; label: string; color: `#${string}` }[]>;

export const CHARACTER_SLOT_DEFINITIONS = {
  face: { label: "Face", category: "face", optional: false },
  hair: { label: "Hair", category: "hair", optional: false },
  top: { label: "Top", category: "tops", optional: false },
  bottom: { label: "Bottom", category: "bottoms", optional: false },
  shoes: { label: "Shoes", category: "shoes", optional: false },
  sunglasses: { label: "Sunglasses", category: "accessories", optional: true },
  necklace: { label: "Necklace", category: "accessories", optional: true },
  watch: { label: "Watch", category: "accessories", optional: true },
  backpack: { label: "Backpack", category: "accessories", optional: true },
} as const satisfies Record<CharacterSlot, { label: string; category: "face" | "hair" | "tops" | "bottoms" | "shoes" | "accessories"; optional: boolean }>;

export const CHARACTER_ITEM_LABELS = {
  face: { classic: "Classic", soft: "Soft", angular: "Angular" },
  hair: { wavy: "Wavy", crop: "Crop", quiff: "Quiff" },
  top: { crewtee: "Crew tee", polo: "Polo", buttonshirt: "Button shirt" },
  bottom: { shorts: "Shorts", trousers: "Trousers" },
  shoes: { canvas: "Canvas", runner: "Runner", hightop: "High-top" },
  sunglasses: { none: "None", round: "Round", squareframe: "Square frame" },
  necklace: { none: "None", chain: "Chain" },
  watch: { none: "None", sport: "Sport" },
  backpack: { none: "None", insulated: "Insulated delivery bag" },
} as const satisfies { [Slot in CharacterSlot]: Record<CharacterItemId<Slot>, string> };

export type CharacterCatalogAvailability = {
  [Slot in CharacterSlot]: readonly CharacterItemId<Slot>[];
};

export const DEFAULT_CHARACTER_CATALOG: CharacterCatalogAvailability = {
  face: [...CHARACTER_SLOT_ITEMS.face],
  hair: [...CHARACTER_SLOT_ITEMS.hair],
  top: [...CHARACTER_SLOT_ITEMS.top],
  bottom: [...CHARACTER_SLOT_ITEMS.bottom],
  shoes: [...CHARACTER_SLOT_ITEMS.shoes],
  sunglasses: [...CHARACTER_SLOT_ITEMS.sunglasses],
  necklace: [...CHARACTER_SLOT_ITEMS.necklace],
  watch: [...CHARACTER_SLOT_ITEMS.watch],
  backpack: [...CHARACTER_SLOT_ITEMS.backpack],
};

export interface CharacterCustomizationManifest {
  customization: {
    previewReady: boolean;
    rigReady: boolean;
    gameReady: boolean;
    slots: Partial<Record<CharacterSlot, {
      default: string;
      items: readonly { id: string; label: string; thumbnail?: string }[];
    }>>;
    colorRegions: readonly string[];
  };
}

const SLOT_KEYS = Object.keys(CHARACTER_SLOT_ITEMS) as CharacterSlot[];

export function isCharacterItemId<Slot extends CharacterSlot>(slot: Slot, value: unknown): value is CharacterItemId<Slot> {
  return typeof value === "string" && (CHARACTER_SLOT_ITEMS[slot] as readonly string[]).includes(value);
}

export function readCatalogAvailability(value: unknown): CharacterCatalogAvailability | null {
  if (!value || typeof value !== "object") return null;
  const customization = (value as { customization?: unknown }).customization;
  if (!customization || typeof customization !== "object") return null;
  if ((customization as { previewReady?: unknown }).previewReady !== true) return null;
  const slots = (customization as { slots?: unknown }).slots;
  if (!slots || typeof slots !== "object") return null;

  const result: Partial<Record<CharacterSlot, readonly string[]>> = {};
  for (const slot of SLOT_KEYS) {
    const slotEntry = (slots as Record<string, unknown>)[slot];
    if (!slotEntry || typeof slotEntry !== "object") return null;
    const defaultItem = (slotEntry as { default?: unknown }).default;
    const items = (slotEntry as { items?: unknown }).items;
    if (!Array.isArray(items) || items.length === 0) return null;
    if (items.some((item) => !item || typeof item !== "object" || typeof (item as { label?: unknown }).label !== "string" || !(item as { label: string }).label.trim())) return null;
    const values = items.map((item) => item && typeof item === "object" ? (item as { id?: unknown }).id : null);
    if (values.some((item) => !isCharacterItemId(slot, item))) return null;
    const unique = [...new Set(values)] as CharacterItemId<typeof slot>[];
    if (unique.length !== values.length) return null;
    if (!isCharacterItemId(slot, defaultItem) || !unique.includes(defaultItem)) return null;
    if (!CHARACTER_SLOT_DEFINITIONS[slot].optional && unique.includes("none" as CharacterItemId<typeof slot>)) return null;
    if (CHARACTER_SLOT_DEFINITIONS[slot].optional && !unique.includes("none" as CharacterItemId<typeof slot>)) return null;
    result[slot] = unique;
  }
  return result as CharacterCatalogAvailability;
}

export function catalogSupports<Slot extends CharacterSlot>(catalog: CharacterCatalogAvailability, slot: Slot, item: CharacterItemId<Slot>): boolean {
  return (catalog[slot] as readonly string[]).includes(item);
}

export function catalogWithBackpackAvailability(
  catalog: CharacterCatalogAvailability,
  available: boolean,
): CharacterCatalogAvailability {
  return available ? catalog : { ...catalog, backpack: ["none"] };
}

export function characterItemLabel<Slot extends CharacterSlot>(slot: Slot, item: CharacterItemId<Slot>): string {
  return (CHARACTER_ITEM_LABELS[slot] as Record<string, string>)[item]!;
}
