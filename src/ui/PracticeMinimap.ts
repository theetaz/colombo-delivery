import type { BicycleState } from "../game/bicycle";
import type { DeliveryPhase, PracticeJob, PracticeStop } from "../game/delivery";
import type { LocalPoint, RoadBounds, RoadSlice } from "../world/types";

export interface MinimapProjection {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface PracticeMinimap {
  readonly element: HTMLElement;
  updateBicycle(state: Pick<BicycleState, "x" | "z" | "heading">): void;
  updateDelivery(job: PracticeJob, phase: DeliveryPhase): void;
  setHidden(hidden: boolean): void;
  dispose(): void;
}

const MAP_PADDING = 10;

export function createMinimapProjection(
  bounds: RoadBounds,
  width: number,
  height: number,
  padding = MAP_PADDING,
): MinimapProjection {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const innerWidth = Math.max(1, safeWidth - padding * 2);
  const innerHeight = Math.max(1, safeHeight - padding * 2);
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1);
  const scale = Math.min(innerWidth / spanX, innerHeight / spanZ);
  return {
    width: safeWidth,
    height: safeHeight,
    scale,
    offsetX: (safeWidth - spanX * scale) / 2 - bounds.minX * scale,
    offsetY: (safeHeight - spanZ * scale) / 2 - bounds.minZ * scale,
  };
}

/** North is always up: scene +Z points south, matching canvas +Y. */
export function projectMinimapPoint(point: LocalPoint, projection: MinimapProjection): ProjectedPoint {
  return {
    x: point.x * projection.scale + projection.offsetX,
    y: point.z * projection.scale + projection.offsetY,
  };
}

export function minimapMarkersForPhase(job: PracticeJob, phase: DeliveryPhase): {
  pickup: PracticeStop | null;
  dropoff: PracticeStop | null;
  active: "pickup" | "dropoff" | null;
} {
  if (phase === "failed" || phase === "completed") return { pickup: null, dropoff: null, active: null };
  return {
    pickup: job.pickup,
    dropoff: job.dropoff,
    active: phase === "pickup" ? "pickup" : phase === "delivery" ? "dropoff" : null,
  };
}

export function createPracticeMinimap(roadSlice: RoadSlice): PracticeMinimap {
  const root = document.createElement("section");
  root.className = "practice-minimap";
  root.setAttribute("aria-label", "Practice area minimap, north up");

  const header = document.createElement("div");
  header.className = "minimap-header";
  const label = document.createElement("span");
  label.className = "minimap-label";
  label.textContent = "Practice area";
  const north = document.createElement("span");
  north.className = "minimap-north";
  north.textContent = "N ↑";
  const toggle = document.createElement("button");
  toggle.className = "minimap-toggle";
  toggle.type = "button";
  toggle.textContent = "Map";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Show practice area minimap");
  header.append(label, north, toggle);

  const canvas = document.createElement("canvas");
  canvas.className = "minimap-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const legend = document.createElement("div");
  legend.className = "minimap-legend";
  legend.innerHTML = '<span><i class="minimap-key minimap-key-you"></i>You</span><span><i class="minimap-key minimap-key-pickup">P</i>Pickup</span><span><i class="minimap-key minimap-key-dropoff">D</i>Drop-off</span>';
  const status = document.createElement("p");
  status.className = "visually-hidden minimap-status";
  root.append(header, canvas, legend, status);

  const staticCanvas = document.createElement("canvas");
  let bicycle: Pick<BicycleState, "x" | "z" | "heading"> | null = null;
  let delivery: ReturnType<typeof minimapMarkersForPhase> | null = null;
  let projection = createMinimapProjection(roadSlice.bounds, 1, 1);
  let cssWidth = 1;
  let cssHeight = 1;
  let pixelRatio = 1;
  let frame = 0;

  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    cssWidth = bounds.width;
    cssHeight = bounds.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    projection = createMinimapProjection(roadSlice.bounds, cssWidth, cssHeight);
    renderRoads();
    render();
  };

  const renderRoads = (): void => {
    const context = staticCanvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const road of roadSlice.roads) {
      if (road.points.length < 2) continue;
      const elevated = road.vertical.elevationMetres !== 0 || road.vertical.bridge || road.vertical.tunnel;
      context.beginPath();
      road.points.forEach((point, index) => {
        const projected = projectMinimapPoint(point, projection);
        if (index === 0) context.moveTo(projected.x, projected.y);
        else context.lineTo(projected.x, projected.y);
      });
      context.strokeStyle = elevated ? "rgba(215, 101, 49, 0.76)" : "rgba(34, 76, 67, 0.58)";
      context.lineWidth = Math.max(elevated ? 1.25 : 0.8, road.width.metres * projection.scale);
      context.setLineDash(elevated ? [3, 2] : []);
      context.stroke();
    }
    context.setLineDash([]);
  };

  const drawStop = (context: CanvasRenderingContext2D, stop: PracticeStop, kind: "pickup" | "dropoff", active: boolean): void => {
    const point = projectMinimapPoint(stop, projection);
    const radius = active ? 5.5 : 4;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = kind === "pickup" ? "#fff8e8" : "#d76531";
    context.fill();
    context.lineWidth = active ? 2.5 : 1.5;
    context.strokeStyle = kind === "pickup" ? "#1f6963" : "#fff8e8";
    context.stroke();
    context.fillStyle = kind === "pickup" ? "#1f6963" : "#fff8e8";
    context.font = "700 7px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(kind === "pickup" ? "P" : "D", point.x, point.y + 0.25);
    if (active) {
      context.beginPath();
      context.arc(point.x, point.y, radius + 3, 0, Math.PI * 2);
      context.lineWidth = 1.5;
      context.strokeStyle = kind === "pickup" ? "rgba(31,105,99,.7)" : "rgba(215,101,49,.75)";
      context.stroke();
    }
  };

  const render = (): void => {
    if (root.hidden || root.classList.contains("is-collapsed")) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(staticCanvas, 0, 0);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (delivery?.pickup) drawStop(context, delivery.pickup, "pickup", delivery.active === "pickup");
    if (delivery?.dropoff) drawStop(context, delivery.dropoff, "dropoff", delivery.active === "dropoff");

    if (bicycle) {
      const point = projectMinimapPoint(bicycle, projection);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(bicycle.heading);
      context.beginPath();
      context.moveTo(0, -8);
      context.lineTo(5.25, 5.5);
      context.lineTo(0, 3.5);
      context.lineTo(-5.25, 5.5);
      context.closePath();
      context.fillStyle = "#122f29";
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = "#fff8e8";
      context.stroke();
      context.restore();
    }
  };

  const media = window.matchMedia("(max-width: 720px)");
  const setCollapsed = (collapsed: boolean): void => {
    root.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Show practice area minimap" : "Hide practice area minimap");
    if (!collapsed) frame = requestAnimationFrame(resize);
  };
  setCollapsed(media.matches);
  const onMediaChange = (event: MediaQueryListEvent): void => setCollapsed(event.matches);
  media.addEventListener("change", onMediaChange);
  toggle.addEventListener("click", () => setCollapsed(!root.classList.contains("is-collapsed")));

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  frame = requestAnimationFrame(resize);

  return {
    element: root,
    updateBicycle(state) {
      bicycle = state;
      render();
    },
    updateDelivery(job, phase) {
      delivery = minimapMarkersForPhase(job, phase);
      root.dataset.phase = phase;
      status.textContent = phase === "pickup"
        ? "Pickup is the active target."
        : phase === "delivery"
          ? "Drop-off is the active target."
          : phase === "available"
            ? "Pickup and drop-off preview."
            : "No active delivery target.";
      render();
    },
    setHidden(hidden) {
      root.hidden = hidden;
      if (!hidden && !root.classList.contains("is-collapsed")) frame = requestAnimationFrame(resize);
    },
    dispose() {
      resizeObserver.disconnect();
      media.removeEventListener("change", onMediaChange);
      cancelAnimationFrame(frame);
    },
  };
}
