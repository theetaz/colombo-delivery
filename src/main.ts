import "./style.css";

import roadNetworkUrl from "../data/derived/road_network.geojson?url";
import sourceManifestRaw from "../data/osm/manifest.json?raw";
import { RoadScene } from "./scene/RoadScene";
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
  import.meta.hot.dispose(() => activeScene?.dispose());
}

function mountPrototype(host: HTMLElement, roadSlice: RoadSlice, manifest: SourceManifest): RoadScene {
  host.replaceChildren();
  host.className = "app-shell";

  const mapPanel = element("main", "map-panel");
  mapPanel.setAttribute("aria-label", "3D road scene");
  const sceneHost = element("div", "scene-host");

  const masthead = element("header", "masthead");
  const eyebrow = element("p", "eyebrow", "Road geometry study · ±450 m");
  const title = element("h1", "title", "Colombo Delivery");
  const subtitle = element("p", "subtitle", "Lotus Tower · road prototype");
  masthead.append(eyebrow, title, subtitle);

  const toolbar = element("div", "camera-toolbar");
  toolbar.setAttribute("aria-label", "Camera controls");
  toolbar.append(
    iconButton("Reset camera", "↺", "reset-view"),
    iconButton("Top view", "⌑", "top-view"),
    iconButton("Zoom in", "+", "zoom-in"),
    iconButton("Zoom out", "−", "zoom-out"),
  );

  const sceneHint = element("p", "scene-hint", "Drag to orbit · right-drag to pan · scroll to zoom · click a road to inspect");
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

  const inspector = element("aside", "inspector");
  inspector.setAttribute("aria-label", "Road inspector");
  inspector.append(buildInspectorHeader(), buildRoadPicker(roadSlice.roads), buildLayerControls(), buildDetailsEmpty(), buildSourceNote(manifest, roadSlice));

  mapPanel.append(sceneHost, masthead, toolbar, sceneHint, attribution, runtimeStatus);
  host.append(mapPanel, inspector);

  const roadSelect = required<HTMLSelectElement>("#road-select");
  const details = required<HTMLElement>("#road-details");
  const pathsInput = required<HTMLInputElement>("#layer-paths");
  const scene = new RoadScene(sceneHost, roadSlice, {
    onRoadSelected: (roadId) => {
      roadSelect.value = roadId ?? "";
      renderRoadDetails(details, roadId ? roadSlice.roads.find((road) => road.id === roadId) ?? null : null);
    },
    onFpsSample: (fps) => {
      fpsText.textContent = `${fps} FPS`;
    },
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
  return scene;
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
