import "./style.css";

import roadNetworkUrl from "../data/derived/road_network.geojson?url";
import sourceManifestRaw from "../data/osm/manifest.json?raw";
import type { BicycleInput, BicycleState } from "./game/bicycle";
import { RoadScene, type SceneMode } from "./scene/RoadScene";
import { buildRoadSlice } from "./world/road-slice";
import type { GeoJsonFeatureCollection, Road, RoadSlice } from "./world/types";

interface SourceManifest {
  dataset: string;
  fetched_at_utc: string;
  osm_base_timestamp: string;
  source: {
    attribution: string;
    copyright_url: string;
    license: string;
  };
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("The application mount point is missing.");

let activeScene: RoadScene | null = null;
let activeCleanup: (() => void) | null = null;
void boot(app);

async function boot(host: HTMLElement): Promise<void> {
  try {
    const response = await fetch(roadNetworkUrl);
    if (!response.ok) throw new Error(`Saved road data returned ${response.status}.`);
    const source = await response.json() as GeoJsonFeatureCollection;
    const manifest = JSON.parse(sourceManifestRaw) as SourceManifest;
    const roadSlice = buildRoadSlice(source, { halfExtentMetres: 450 });
    activeScene = mountPrototype(host, roadSlice, manifest);
  } catch (error) {
    showFatalError(host, error);
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    activeCleanup?.();
    activeScene?.dispose();
  });
}

function mountPrototype(host: HTMLElement, roadSlice: RoadSlice, manifest: SourceManifest): RoadScene {
  host.replaceChildren();
  host.className = "app-shell";

  const mapPanel = element("main", "map-panel");
  mapPanel.setAttribute("aria-label", "3D road scene");
  const sceneHost = element("div", "scene-host");

  const masthead = element("header", "masthead");
  const eyebrow = element("p", "eyebrow", "900 m road feel study");
  const title = element("h1", "title", "Colombo Delivery");
  const subtitle = element("p", "subtitle", "Lotus Tower · bicycle prototype");
  masthead.append(eyebrow, title, subtitle);

  const rideToolbar = element("div", "ride-toolbar");
  rideToolbar.setAttribute("aria-label", "Experience mode");
  const modeSwitch = element("div", "mode-switch");
  const rideModeButton = textButton("Ride", "mode-button is-active", "ride-mode");
  const inspectModeButton = textButton("Inspect map", "mode-button", "inspect-mode");
  rideModeButton.setAttribute("aria-pressed", "true");
  inspectModeButton.setAttribute("aria-pressed", "false");
  modeSwitch.append(rideModeButton, inspectModeButton);
  const resetBikeButton = textButton("Reset bicycle", "reset-bike-button", "reset-bike");
  rideToolbar.append(modeSwitch, resetBikeButton);

  const toolbar = element("div", "camera-toolbar");
  toolbar.setAttribute("aria-label", "Camera controls");
  toolbar.append(
    iconButton("Reset camera", "↺", "reset-view"),
    iconButton("Top view", "⌑", "top-view"),
    iconButton("Zoom in", "+", "zoom-in"),
    iconButton("Zoom out", "−", "zoom-out"),
  );

  const sceneHint = element("p", "scene-hint", "W / ↑ pedal · A D steer · S / ↓ / Space brake · F inspect · R reset");
  const attribution = element("a", "attribution", "© OpenStreetMap contributors");
  attribution.href = manifest.source.copyright_url;
  attribution.target = "_blank";
  attribution.rel = "noreferrer";

  const runtimeStatus = element("div", "runtime-status");
  const sourceWayCount = roadSlice.summary.intersectingSourceWayCount;
  const pieceSuffix = roadSlice.roads.length === sourceWayCount ? "" : ` · ${roadSlice.roads.length} pieces`;
  const countText = element("span", "status-count", `${sourceWayCount} OSM ways${pieceSuffix}`);
  const fpsText = element("span", "status-fps", "Measuring FPS…");
  runtimeStatus.append(countText, fpsText);

  const rideHud = element("section", "ride-hud");
  rideHud.setAttribute("aria-label", "Bicycle status");
  const speedValue = element("strong", "speed-value", "0.0");
  const speedUnit = element("span", "speed-unit", "km/h");
  const speedReadout = element("div", "speed-readout");
  speedReadout.append(speedValue, speedUnit);
  const surfaceValue = element("strong", "metric-value surface-road", "Road");
  const distanceValue = element("strong", "metric-value", "0 m");
  const coordinateValue = element("strong", "metric-value coordinate-value", "E +0.0 · S +0.0");
  rideHud.append(
    speedReadout,
    metric("Surface", surfaceValue),
    metric("Travelled", distanceValue),
    metric("Position", coordinateValue),
  );

  const rideFeedback = element("p", "ride-feedback", "Pedal onto the road and judge the city at bicycle scale.");
  rideFeedback.setAttribute("aria-live", "polite");
  rideFeedback.setAttribute("aria-atomic", "true");

  const rideControls = element("div", "ride-controls");
  rideControls.setAttribute("aria-label", "Bicycle controls");
  rideControls.append(
    holdButton("left", "Steer left", "←", "Steer"),
    holdButton("pedal", "Pedal", "↑", "Pedal"),
    holdButton("brake", "Brake", "■", "Brake"),
    holdButton("right", "Steer right", "→", "Steer"),
  );

  const inspector = element("aside", "inspector");
  inspector.setAttribute("aria-label", "Road inspector");
  inspector.append(buildInspectorHeader(), buildRoadPicker(roadSlice.roads), buildLayerControls(), buildDetailsEmpty(), buildSourceNote(manifest, roadSlice));

  mapPanel.append(sceneHost, masthead, rideToolbar, toolbar, rideHud, rideFeedback, rideControls, sceneHint, attribution, runtimeStatus);
  host.append(mapPanel, inspector);

  const roadSelect = required<HTMLSelectElement>("#road-select");
  const details = required<HTMLElement>("#road-details");
  const pathsInput = required<HTMLInputElement>("#layer-paths");
  let currentMode: SceneMode = "ride";
  let previousState: BicycleState | null = null;
  let feedbackTimer = 0;
  const scene = new RoadScene(sceneHost, roadSlice, {
    onRoadSelected: (roadId) => {
      roadSelect.value = roadId ?? "";
      renderRoadDetails(details, roadId ? roadSlice.roads.find((road) => road.id === roadId) ?? null : null);
    },
    onFpsSample: (fps) => {
      fpsText.textContent = `${fps} FPS`;
    },
    onBicycleState: (state) => {
      speedValue.textContent = (Math.abs(state.speed) * 3.6).toFixed(1);
      surfaceValue.textContent = state.surface === "road" ? "Road" : "Grass";
      surfaceValue.className = `metric-value surface-${state.surface}`;
      distanceValue.textContent = formatDistance(state.distanceTravelled);
      coordinateValue.textContent = `E ${formatSigned(state.x)} · S ${formatSigned(state.z)}`;
      if (previousState) {
        if (state.boundaryCollisions > previousState.boundaryCollisions) {
          showFeedback("Study boundary reached — turn back or press R / Reset bicycle.", "warning");
        } else if (state.obstacleCollisions > previousState.obstacleCollisions) {
          showFeedback("Training marker hit — approach around it or press R / Reset bicycle.", "warning");
        } else if (state.surface !== previousState.surface) {
          showFeedback(state.surface === "grass" ? "Grass slows the bicycle." : "Back on a mapped road surface.", state.surface);
        }
      }
      previousState = state;
    },
  });

  function showFeedback(message: string, tone = "neutral"): void {
    window.clearTimeout(feedbackTimer);
    rideFeedback.textContent = message;
    rideFeedback.dataset.tone = tone;
    feedbackTimer = window.setTimeout(() => {
      rideFeedback.textContent = currentMode === "ride"
        ? "Pedal onto the road and judge the city at bicycle scale."
        : "Map inspection pauses the bicycle.";
      delete rideFeedback.dataset.tone;
    }, 2600);
  }

  const inputNames: Array<keyof BicycleInput> = ["pedal", "brake", "left", "right"];
  const keyboardInput = new Set<string>();
  const buttonKeyboardInput = new Set<keyof BicycleInput>();
  const pointerInput = new Map<number, keyof BicycleInput>();
  const codeToInput = (code: string): keyof BicycleInput | null => {
    if (code === "KeyW" || code === "ArrowUp") return "pedal";
    if (code === "KeyA" || code === "ArrowLeft") return "left";
    if (code === "KeyD" || code === "ArrowRight") return "right";
    if (code === "KeyS" || code === "ArrowDown" || code === "Space") return "brake";
    return null;
  };

  const applyInput = (): void => {
    const input: BicycleInput = { pedal: false, brake: false, left: false, right: false };
    for (const name of inputNames) {
      input[name] = [...keyboardInput].some((code) => codeToInput(code) === name)
        || buttonKeyboardInput.has(name)
        || [...pointerInput.values()].includes(name);
    }
    scene.setRideInput(input);
    for (const button of rideControls.querySelectorAll<HTMLButtonElement>("[data-input]")) {
      button.classList.toggle("is-held", input[button.dataset.input as keyof BicycleInput]);
    }
  };

  const clearInput = (): void => {
    keyboardInput.clear();
    buttonKeyboardInput.clear();
    pointerInput.clear();
    scene.clearRideInput();
    for (const button of rideControls.querySelectorAll<HTMLButtonElement>("[data-input]")) button.classList.remove("is-held");
  };

  const setMode = (mode: SceneMode): void => {
    if (mode === currentMode) return;
    currentMode = mode;
    clearInput();
    scene.setMode(mode);
    scene.setPaused(mode === "inspect" || document.hidden || !document.hasFocus());
    host.dataset.mode = mode;
    inspector.hidden = mode === "ride";
    toolbar.hidden = mode === "ride";
    rideHud.hidden = mode === "inspect";
    rideControls.hidden = mode === "inspect";
    rideModeButton.classList.toggle("is-active", mode === "ride");
    inspectModeButton.classList.toggle("is-active", mode === "inspect");
    rideModeButton.setAttribute("aria-pressed", String(mode === "ride"));
    inspectModeButton.setAttribute("aria-pressed", String(mode === "inspect"));
    sceneHint.textContent = mode === "ride"
      ? "W / ↑ pedal · A D steer · S / ↓ / Space brake · F inspect · R reset"
      : "Drag to orbit · right-drag to pan · scroll to zoom · click a road to inspect · F ride";
    showFeedback(mode === "ride" ? "Ride resumed." : "Map inspection pauses the bicycle.");
  };

  host.dataset.mode = "ride";
  inspector.hidden = true;
  toolbar.hidden = true;
  rideModeButton.addEventListener("click", () => setMode("ride"));
  inspectModeButton.addEventListener("click", () => setMode("inspect"));
  resetBikeButton.addEventListener("click", () => {
    previousState = scene.resetBicycle();
    showFeedback("Returned to the training start.");
  });

  required<HTMLButtonElement>("#reset-view").addEventListener("click", () => scene.resetCamera());
  required<HTMLButtonElement>("#top-view").addEventListener("click", () => scene.topView());
  required<HTMLButtonElement>("#zoom-in").addEventListener("click", () => scene.zoom(0.78));
  required<HTMLButtonElement>("#zoom-out").addEventListener("click", () => scene.zoom(1.28));
  required<HTMLInputElement>("#layer-grid").addEventListener("change", (event) => {
    scene.setGridVisible((event.currentTarget as HTMLInputElement).checked);
  });
  required<HTMLInputElement>("#layer-centrelines").addEventListener("change", (event) => {
    scene.setCentrelinesVisible((event.currentTarget as HTMLInputElement).checked);
  });
  pathsInput.addEventListener("change", (event) => {
    scene.setPathsVisible((event.currentTarget as HTMLInputElement).checked);
  });
  required<HTMLInputElement>("#layer-widths").addEventListener("change", (event) => {
    scene.setWidthSourcesVisible((event.currentTarget as HTMLInputElement).checked);
    required<HTMLElement>("#width-legend").hidden = !(event.currentTarget as HTMLInputElement).checked;
  });
  roadSelect.addEventListener("change", () => {
    const roadId = roadSelect.value || null;
    const selectedRoad = roadId ? roadSlice.roads.find((road) => road.id === roadId) ?? null : null;
    if (selectedRoad && isPathClass(selectedRoad.highway) && !pathsInput.checked) {
      pathsInput.checked = true;
      scene.setPathsVisible(true);
    }
    scene.selectRoad(roadId);
    if (roadId) scene.focusRoad(roadId);
    renderRoadDetails(details, selectedRoad);
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) return;
    if (event.code === "KeyF") {
      event.preventDefault();
      if (!event.repeat) setMode(currentMode === "ride" ? "inspect" : "ride");
      return;
    }
    if (event.code === "KeyR") {
      event.preventDefault();
      if (!event.repeat) {
        previousState = scene.resetBicycle();
        showFeedback("Returned to the training start.");
      }
      return;
    }
    if (currentMode !== "ride") return;
    const input = codeToInput(event.code);
    if (!input) return;
    event.preventDefault();
    keyboardInput.add(event.code);
    applyInput();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const input = codeToInput(event.code);
    if (!input || !keyboardInput.has(event.code)) return;
    keyboardInput.delete(event.code);
    if (!isEditableTarget(event.target) && currentMode === "ride") event.preventDefault();
    applyInput();
  };
  const onVisibilityChange = (): void => {
    if (document.hidden) clearInput();
    scene.setPaused(currentMode === "inspect" || document.hidden || !document.hasFocus() || isEditableTarget(document.activeElement));
  };
  const onFocusIn = (event: FocusEvent): void => {
    if (isEditableTarget(event.target)) {
      clearInput();
      scene.setPaused(true);
    }
  };
  const onFocusOut = (): void => queueMicrotask(() => {
    scene.setPaused(currentMode === "inspect" || document.hidden || !document.hasFocus() || isEditableTarget(document.activeElement));
  });
  const onWindowBlur = (): void => {
    clearInput();
    scene.setPaused(true);
  };
  const onWindowFocus = (): void => {
    scene.setPaused(currentMode === "inspect" || document.hidden || isEditableTarget(document.activeElement));
  };
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);

  for (const button of rideControls.querySelectorAll<HTMLButtonElement>("[data-input]")) {
    const name = button.dataset.input as keyof BicycleInput;
    button.addEventListener("pointerdown", (event) => {
      if (currentMode !== "ride") return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointerInput.set(event.pointerId, name);
      applyInput();
    });
    const release = (event: PointerEvent): void => {
      if (!pointerInput.has(event.pointerId)) return;
      pointerInput.delete(event.pointerId);
      applyInput();
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    button.addEventListener("keydown", (event) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      if (currentMode !== "ride") return;
      buttonKeyboardInput.add(name);
      applyInput();
    });
    button.addEventListener("keyup", (event) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      buttonKeyboardInput.delete(name);
      applyInput();
    });
    button.addEventListener("blur", () => {
      if (!buttonKeyboardInput.delete(name)) return;
      applyInput();
    });
  }

  activeCleanup = () => {
    window.clearTimeout(feedbackTimer);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("focus", onWindowFocus);
  };
  return scene;
}

function metric(labelText: string, value: HTMLElement): HTMLElement {
  const item = element("div", "ride-metric");
  item.append(element("span", "metric-label", labelText), value);
  return item;
}

function textButton(label: string, className: string, id: string): HTMLButtonElement {
  const button = element("button", className, label);
  button.type = "button";
  button.id = id;
  return button;
}

function holdButton(input: keyof BicycleInput, ariaLabel: string, glyph: string, labelText: string): HTMLButtonElement {
  const button = element("button", `hold-control hold-${input}`);
  button.type = "button";
  button.dataset.input = input;
  button.setAttribute("aria-label", ariaLabel);
  button.append(element("span", "hold-glyph", glyph), element("span", "hold-label", labelText));
  return button;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, select, textarea, [contenteditable='true']"));
}

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`;
}

function buildInspectorHeader(): HTMLElement {
  const header = element("div", "inspector-heading");
  const label = element("p", "section-label", "Scene inspector");
  const title = element("h2", "inspector-title", "Saved source geometry");
  const note = element("p", "inspector-intro", "Select a surface to trace its mapped tags and prototype assumptions.");
  header.append(label, title, note);
  return header;
}

function buildRoadPicker(roads: Road[]): HTMLElement {
  const field = element("div", "field");
  const label = element("label", "field-label", "Road feature");
  label.htmlFor = "road-select";
  const select = document.createElement("select");
  select.id = "road-select";
  select.className = "road-select";
  select.append(new Option("All roads · click map to select", ""));

  const sorted = [...roads].sort((a, b) => {
    if (a.name && !b.name) return -1;
    if (!a.name && b.name) return 1;
    return (a.name ?? a.id).localeCompare(b.name ?? b.id, "en", { numeric: true });
  });
  for (const road of sorted) {
    const name = road.name?.trim() || "Unnamed road";
    select.append(new Option(`${name} · ${road.highway} · ${road.id}`, road.id));
  }
  field.append(label, select);
  return field;
}

function buildLayerControls(): HTMLElement {
  const section = element("section", "inspector-section");
  section.append(element("h3", "section-label", "Layers"));
  const controls = element("div", "layer-controls");
  controls.append(
    checkbox("layer-grid", "Reference grid · 50 m", true),
    checkbox("layer-centrelines", "Centreline hints", false),
    checkbox("layer-paths", "Footways and paths", true),
    checkbox("layer-widths", "Width source colours", false),
  );
  const legend = element("div", "width-legend");
  legend.id = "width-legend";
  legend.hidden = true;
  legend.append(
    legendItem("Mapped width", "mapped"),
    legendItem("Lane estimate", "lanes"),
    legendItem("Class fallback", "fallback"),
  );
  section.append(controls, legend);
  return section;
}

function buildDetailsEmpty(): HTMLElement {
  const section = element("section", "inspector-section road-details");
  section.id = "road-details";
  section.setAttribute("aria-live", "polite");
  section.append(
    element("h3", "section-label", "Selection"),
    element("p", "empty-selection", "No road selected. Use the map or feature list to inspect one of the clipped source ways."),
  );
  return section;
}

function renderRoadDetails(host: HTMLElement, road: Road | null): void {
  host.replaceChildren(element("h3", "section-label", "Selection"));
  if (!road) {
    host.append(element("p", "empty-selection", "No road selected. Use the map or feature list to inspect one of the clipped source ways."));
    return;
  }

  const heading = element("h4", "road-name", road.name?.trim() || "Unnamed OSM way");
  const classBadge = element("span", "class-badge", road.highway.replaceAll("_", " "));
  const identity = element("p", "road-id", road.id);
  const sample = road.representative;
  const rawWidth = road.width.rawWidth?.trim() || "not mapped";
  const rawLanes = road.width.rawLanes?.trim() || "not mapped";
  const coordinates = `Longitude ${sample.lon.toFixed(6)}°, latitude ${sample.lat.toFixed(6)}°\nX ${formatSigned(sample.x)} m east, Z ${formatSigned(sample.z)} m south`;
  const sourceLabel = road.width.source === "width"
    ? "mapped width tag"
    : road.width.source === "lanes"
      ? "lane-based estimate"
      : "road-class fallback";
  const detailList = element("dl", "detail-list");
  appendDetail(detailList, "Source feature", road.sourceFeatureId);
  appendDetail(detailList, "OSM identity", road.osmId === null ? "not supplied" : `way/${road.osmId}`);
  appendDetail(detailList, "Render piece", road.id);
  appendDetail(detailList, "Prototype width", `${formatMetres(road.width.metres)} · ${sourceLabel}`);
  appendDetail(detailList, "Raw width", rawWidth);
  appendDetail(detailList, "Raw lanes", rawLanes);
  appendDetail(detailList, "Width basis", road.width.rationale);
  appendDetail(detailList, "Elevation", `${formatMetres(road.vertical.elevationMetres)} · layer ${road.vertical.layer}`);
  appendDetail(detailList, "Vertical basis", road.vertical.rationale);
  appendDetail(detailList, "Sample coordinate", coordinates);

  const sourceNote = element(
    "p",
    "feature-source",
    `Source: ${road.sourceFeatureId} from the saved OpenStreetMap audit. Surface width and vertical placement follow the prototype rules shown above; the pale road edges are visual hints.`,
  );
  host.append(heading, classBadge, identity, detailList, sourceNote);
}

function buildSourceNote(manifest: SourceManifest, roadSlice: RoadSlice): HTMLElement {
  const section = element("section", "source-note");
  const timestamp = new Date(manifest.osm_base_timestamp);
  const readableTimestamp = Number.isNaN(timestamp.valueOf())
    ? manifest.osm_base_timestamp
    : timestamp.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  section.append(
    element("h3", "section-label", "Data trace"),
    element("p", "source-copy", `${manifest.dataset}. Saved OSM data timestamp: ${readableTimestamp} UTC.`),
    element(
      "p",
      "source-copy",
      `Local origin ${roadSlice.origin.lon.toFixed(7)}, ${roadSlice.origin.lat.toFixed(7)}. X points east; scene Z points south; one scene unit is one metre.`,
    ),
    element("p", "source-caveat", "Road surfaces are geometry previews. They do not claim routability, current street conditions, surveyed elevation, or kerb accuracy."),
  );
  return section;
}

function appendDetail(list: HTMLDListElement, key: string, value: string): void {
  list.append(element("dt", "detail-key", key), element("dd", "detail-value", value));
}

function checkbox(id: string, labelText: string, checked: boolean): HTMLLabelElement {
  const label = element("label", "check-row");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = checked;
  label.append(input, element("span", "check-mark"), element("span", "check-label", labelText));
  return label;
}

function legendItem(label: string, variant: string): HTMLElement {
  const item = element("span", "legend-item");
  const swatch = element("i", `legend-swatch ${variant}`);
  swatch.setAttribute("aria-hidden", "true");
  item.append(swatch, document.createTextNode(label));
  return item;
}

function iconButton(label: string, glyph: string, id: string): HTMLButtonElement {
  const button = element("button", "camera-button", glyph);
  button.id = id;
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  return button;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function required<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing required interface element: ${selector}`);
  return node;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
}

function formatMetres(value: number): string {
  return `${value.toFixed(1)} m`;
}

function isPathClass(highway: string): boolean {
  return ["footway", "path", "steps", "pedestrian", "platform", "cycleway"].includes(highway);
}

function showFatalError(host: HTMLElement, error: unknown): void {
  host.replaceChildren();
  host.className = "fatal-shell";
  const panel = element("section", "fatal-panel");
  panel.append(
    element("p", "eyebrow", "Scene unavailable"),
    element("h1", "fatal-title", "The saved road prototype could not start."),
    element(
      "p",
      "fatal-copy",
      error instanceof Error
        ? error.message
        : "The road data could not be read. Reload the page or check this browser's WebGL support.",
    ),
  );
  host.append(panel);
}
