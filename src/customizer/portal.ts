import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CharacterAvatar } from "../scene/CharacterAvatar";
import {
  CHARACTER_SLOT_DEFINITIONS,
  CHARACTER_COLOR_PALETTES,
  characterItemLabel,
  DEFAULT_CHARACTER_CATALOG,
  readCatalogAvailability,
  type CharacterCatalogAvailability,
  type CharacterColorRegion,
  type CharacterCustomizationManifest,
  type CharacterSlot,
} from "./catalog";
import {
  characterAppearancesEqual,
  CHARACTER_APPEARANCE_STORAGE_KEY,
  cloneCharacterAppearance,
  loadCharacterAppearance,
  defaultCharacterAppearance,
  saveCharacterAppearance,
  validateCharacterAppearance,
} from "./appearance";

type Category = "face" | "hair" | "tops" | "bottoms" | "shoes" | "accessories";

const CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: "face", label: "Face" }, { id: "hair", label: "Hair" }, { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" }, { id: "shoes", label: "Shoes" }, { id: "accessories", label: "Accessories" },
];
const CATEGORY_REGION: Partial<Record<Category, CharacterColorRegion>> = { hair: "hair", tops: "top", bottoms: "bottom", shoes: "shoes", face: "skin" };

const host = document.querySelector<HTMLElement>("#avatar-canvas")!;
const tabs = document.querySelector<HTMLElement>("#category-tabs")!;
const catalogScroll = document.querySelector<HTMLElement>("#catalog-scroll")!;
const grid = document.querySelector<HTMLElement>("#option-grid")!;
const colorSection = document.querySelector<HTMLElement>("#color-section")!;
const swatches = document.querySelector<HTMLElement>("#swatches")!;
const colorLabel = document.querySelector<HTMLElement>("#color-label")!;
const customColor = document.querySelector<HTMLInputElement>("#custom-color")!;
const saveButton = document.querySelector<HTMLButtonElement>("#save-look")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-look")!;
const saveState = document.querySelector<HTMLElement>("#save-state")!;
const loadCard = document.querySelector<HTMLElement>("#load-card")!;
const errorCard = document.querySelector<HTMLElement>("#error-card")!;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(29, 1, .05, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .07; controls.minDistance = .7; controls.maxDistance = 6;
scene.add(new THREE.HemisphereLight(0xfffbef, 0x7a736a, 2.15));
const key = new THREE.DirectionalLight(0xffe7cc, 2.4); key.position.set(-3, 5, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0x9ccbc8, 1.25); fill.position.set(3, 2, -4); scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 80), new THREE.MeshStandardMaterial({ color: 0xded5c8, roughness: .95 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.006; scene.add(floor);

let avatar: CharacterAvatar | undefined;
let activeCategory: Category = "face";
let catalog: CharacterCatalogAvailability = DEFAULT_CHARACTER_CATALOG;
let manifest: CharacterCustomizationManifest | undefined;
let manifestBaseUrl = new URL(`${import.meta.env.BASE_URL}models/teen_courier_customization.manifest.json`, location.href);
let saved = loadCharacterAppearance();
let draft = cloneCharacterAppearance(saved);
let storedLook = false;
let storageAvailable = true;
try { storedLook = typeof localStorage !== "undefined" && localStorage.getItem(CHARACTER_APPEARANCE_STORAGE_KEY) !== null; }
catch { storageAvailable = false; }
let loadGeneration = 0;
let disposed = false;
let currentView = "front";

function slotsFor(category: Category): CharacterSlot[] {
  return (Object.keys(CHARACTER_SLOT_DEFINITIONS) as CharacterSlot[]).filter((slot) => CHARACTER_SLOT_DEFINITIONS[slot].category === category);
}

function applyDraft(): void {
  if (!avatar) return;
  for (const slot of Object.keys(DEFAULT_CHARACTER_CATALOG) as CharacterSlot[]) avatar.setOption(slot, draft[slot] as never);
  for (const region of Object.keys(draft.colors) as CharacterColorRegion[]) avatar.setColor(region, draft.colors[region]);
}

function markDirty(): void {
  const dirty = !characterAppearancesEqual(draft, saved);
  saveButton.disabled = !dirty;
  saveState.textContent = !storageAvailable ? "Saving unavailable" : dirty ? "Unsaved changes" : storedLook ? "Saved on this device" : "Default look";
}

function renderTabs(): void {
  tabs.replaceChildren(...CATEGORIES.map(({ id, label }) => {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label;
    button.dataset.category = id;
    button.setAttribute("aria-pressed", String(id === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = id; renderTabs(); renderCatalog();
      tabs.querySelector<HTMLButtonElement>(`[data-category="${id}"]`)?.focus();
    });
    return button;
  }));
}

function thumbnailFor(slot: CharacterSlot, id: string): string | undefined {
  const value = manifest?.customization.slots[slot]?.items.find((item) => item.id === id)?.thumbnail;
  if (!value) return undefined;
  try { return new URL(value, manifestBaseUrl).href; } catch { return undefined; }
}

function makeCard(slot: CharacterSlot, id: string): HTMLButtonElement {
  const card = document.createElement("button"); card.type = "button"; card.className = "option-card";
  card.dataset.slot = slot; card.dataset.item = id;
  const label = characterItemLabel(slot, id as never);
  const selected = draft[slot] === id; card.setAttribute("aria-pressed", String(selected)); card.setAttribute("aria-label", `${CHARACTER_SLOT_DEFINITIONS[slot].label}: ${label}${selected ? ", selected" : ""}`);
  const thumb = document.createElement("span"); thumb.className = "thumb";
  const source = thumbnailFor(slot, id);
  if (source) { const image = new Image(); image.src = source; image.alt = ""; image.loading = "lazy"; thumb.append(image); }
  else { const fallback = document.createElement("span"); fallback.className = "monogram"; fallback.textContent = id === "none" ? "—" : label.slice(0, 1); thumb.append(fallback); }
  const caption = document.createElement("span"); caption.className = "label"; caption.append(document.createTextNode(label));
  const check = document.createElement("span"); check.className = "check"; check.textContent = "✓"; caption.append(check); card.append(thumb, caption);
  card.addEventListener("click", () => {
    if (!avatar?.setOption(slot, id as never)) return;
    (draft as unknown as Record<string, unknown>)[slot] = id;
    renderCatalog(); markDirty();
    grid.querySelector<HTMLButtonElement>(`[data-slot="${slot}"][data-item="${id}"]`)?.focus();
  });
  return card;
}

function renderCatalog(): void {
  const slots = slotsFor(activeCategory);
  const nodes: HTMLElement[] = [];
  for (const slot of slots) {
    if (slots.length > 1) { const heading = document.createElement("h2"); heading.className = "slot-heading"; heading.textContent = CHARACTER_SLOT_DEFINITIONS[slot].label; nodes.push(heading); }
    nodes.push(...catalog[slot].map((id) => makeCard(slot, id)));
  }
  grid.replaceChildren(...nodes);
  const region = CATEGORY_REGION[activeCategory];
  colorSection.hidden = !region;
  if (region) renderColors(region);
}

function renderColors(region: CharacterColorRegion): void {
  customColor.value = draft.colors[region];
  colorLabel.textContent = CHARACTER_COLOR_PALETTES[region].find(({ color }) => color === draft.colors[region].toUpperCase())?.label ?? "Custom color";
  swatches.replaceChildren(...CHARACTER_COLOR_PALETTES[region].map(({ label, color }) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "swatch"; button.title = label;
    button.dataset.color = color;
    button.style.setProperty("--swatch", color); button.setAttribute("aria-label", label); button.setAttribute("aria-pressed", String(draft.colors[region].toUpperCase() === color));
    button.addEventListener("click", () => {
      draft.colors[region] = color; avatar?.setColor(region, color); renderColors(region); markDirty();
      swatches.querySelector<HTMLButtonElement>(`[data-color="${color}"]`)?.focus();
    }); return button;
  }));
}

customColor.addEventListener("input", () => {
  const region = CATEGORY_REGION[activeCategory]; if (!region) return;
  draft.colors[region] = customColor.value.toUpperCase(); avatar?.setColor(region, draft.colors[region]); renderColors(region); markDirty();
});
saveButton.addEventListener("click", () => {
  if (saveCharacterAppearance(draft, undefined, catalog)) { saved = cloneCharacterAppearance(draft); storedLook = true; storageAvailable = true; markDirty(); }
  else { storageAvailable = false; saveState.textContent = "Couldn’t save on this device"; saveButton.disabled = false; }
});
resetButton.addEventListener("click", () => {
  draft = defaultCharacterAppearance(catalog); applyDraft(); renderCatalog(); markDirty();
});

function visibleBounds(): THREE.Box3 {
  const bounds = new THREE.Box3();
  avatar?.group.updateMatrixWorld(true);
  avatar?.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    let current: THREE.Object3D | null = object;
    while (current && current !== avatar?.group) { if (!current.visible) return; current = current.parent; }
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

function setView(view: string): void {
  currentView = view;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
  const bounds = visibleBounds(); if (bounds.isEmpty()) return;
  const face = view === "face";
  if (face) bounds.min.y = Math.max(bounds.min.y, bounds.max.y - .52);
  const size = bounds.getSize(new THREE.Vector3()); const target = bounds.getCenter(new THREE.Vector3());
  const vertical = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const horizontal = size.x / Math.max(camera.aspect, .25) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const framingMargin = camera.aspect < .9 ? (face ? 1.38 : 1.34) : (face ? 1.28 : 1.17);
  const distance = Math.max(vertical, horizontal, .45) * framingMargin;
  controls.minDistance = Math.max(.25, distance * .45); controls.maxDistance = Math.max(5, distance * 2.5);
  const direction: Record<string, THREE.Vector3> = { front: new THREE.Vector3(0, 0, -1), side: new THREE.Vector3(1, 0, 0), back: new THREE.Vector3(0, 0, 1), face: new THREE.Vector3(0, 0, -1) };
  controls.target.copy(target); camera.position.copy(target).addScaledVector(direction[view] ?? direction.front!, distance); controls.update();
}
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view!)));

async function loadAvatar(): Promise<void> {
  const generation = ++loadGeneration; errorCard.hidden = true; loadCard.hidden = false; tabs.hidden = true; catalogScroll.hidden = true;
  const next = new CharacterAvatar();
  try {
    manifestBaseUrl = new URL(`${import.meta.env.BASE_URL}models/teen_courier_customization.manifest.json`, location.href);
    const [manifestResponse] = await Promise.all([fetch(manifestBaseUrl), next.load()]);
    if (disposed || generation !== loadGeneration) { next.dispose(); return; }
    if (manifestResponse.ok) {
      manifest = await manifestResponse.json() as CharacterCustomizationManifest;
      if (disposed || generation !== loadGeneration) { next.dispose(); return; }
      const available = readCatalogAvailability(manifest);
      if (!available) throw new Error("Customization manifest does not describe a review-ready catalog");
      catalog = available;
      for (const slot of Object.keys(catalog) as CharacterSlot[]) {
        for (const item of catalog[slot]) {
          if (!thumbnailFor(slot, item)) throw new Error(`Manifest is missing the ${slot}/${item} thumbnail`);
        }
      }
    }
    else throw new Error(`Customization manifest request failed (${manifestResponse.status})`);
    for (const slot of Object.keys(catalog) as CharacterSlot[]) {
      for (const item of catalog[slot]) if (!next.setOption(slot, item as never)) throw new Error(`Model is missing ${slot}/${item}`);
    }
    let raw: string | null = null;
    try {
      if (typeof localStorage === "undefined") storageAvailable = false;
      else { raw = localStorage.getItem(CHARACTER_APPEARANCE_STORAGE_KEY); storageAvailable = true; }
    } catch { storageAvailable = false; }
    storedLook = false;
    if (storageAvailable && raw !== null) {
      try { storedLook = validateCharacterAppearance(JSON.parse(raw), catalog) !== null; }
      catch { storedLook = false; }
    }
    saved = storageAvailable ? loadCharacterAppearance(undefined, catalog) : defaultCharacterAppearance(catalog);
    draft = cloneCharacterAppearance(saved);
    if (avatar) { scene.remove(avatar.group); avatar.dispose(); }
    avatar = next; scene.add(next.group); applyDraft(); renderCatalog(); tabs.hidden = false; catalogScroll.hidden = false; loadCard.hidden = true; markDirty(); setView(currentView);
  } catch (error) {
    next.dispose(); if (disposed || generation !== loadGeneration) return;
    loadCard.hidden = true; errorCard.hidden = false; saveState.textContent = "Wardrobe unavailable"; console.error("Character wardrobe failed to load", error);
  }
}
document.querySelector("#retry-load")?.addEventListener("click", loadAvatar);

function resize(): void { const { clientWidth: w, clientHeight: h } = host; renderer.setSize(w, h, false); camera.aspect = Math.max(w, 1) / Math.max(h, 1); camera.updateProjectionMatrix(); setView(currentView); }
const observer = new ResizeObserver(resize); observer.observe(host);
function frame(): void { if (disposed) return; controls.update(); renderer.render(scene, camera); requestAnimationFrame(frame); }
renderTabs(); renderCatalog(); loadAvatar(); resize(); requestAnimationFrame(frame);

if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; loadGeneration += 1; observer.disconnect(); controls.dispose(); avatar?.dispose(); renderer.dispose(); floor.geometry.dispose(); (floor.material as THREE.Material).dispose(); });
