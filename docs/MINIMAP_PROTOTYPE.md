# North-up Practice Minimap

## Purpose and status

This bounded interface checkpoint adds a compact minimap to Ride mode so the
existing bicycle and three-job practice loop can be read together while moving.
It draws from the same saved 900 × 900 m Lotus Tower road slice as the 3D world,
keeps north at the top, shows the bicycle's live position and heading, and
changes its pickup and drop-off markers with the delivery phase.

The minimap is a practice orientation aid. It does not calculate or recommend a
route. Its markers remain generated test stops rather than verified entrances
or safe stopping places, and a direct visual relationship between markers does
not establish a road connection, bicycle access, legal travel, or current
street conditions.

## Shared map contract

The minimap reuses the renderer-independent `RoadSlice` already built from the
committed `data/derived/road_network.geojson` artifact. It does not fetch a
second map, reinterpret source tags, or maintain a separate road network. The
saved slice uses local metres with `x` increasing east and `z` increasing
south, so the north-up minimap maps east to screen-right and south to
screen-down.

Road lines are context only. Inclusion on the minimap inherits the road
prototype's geometric selection and provisional width and elevation rules; it
does not assert that a road is currently open, suitable, safe, or lawful for a
bicycle. This checkpoint does not add turn restrictions, mode-aware access,
junction controls, path finding, route distance, missed-turn detection, or
recalculation.

## Live bicycle and delivery state

The bicycle marker follows the controller's current local position. Its heading
indicator rotates while the map itself remains north-up, so a rider can compare
travel direction with the surrounding saved geometry without the map rotating.

Delivery markers follow the existing controller phases:

- Before a job is accepted, the next practice pickup and drop-off provide
  sequence context.
- During pickup, the pickup is the active target and the drop-off remains the
  later stop.
- During delivery, the drop-off becomes the active target.
- Completed and failed phases hide both markers until the existing next-job or
  retry action returns the controller to an available or active phase.

The delivery card's distance and direction remain straight-line, relative
guidance. The minimap does not turn that value into route distance or draw an
off-road segment as a route. Pickup and drop-off still require the existing
explicit stopped action inside the 7 m interaction radius; seeing or crossing a
marker on the minimap does not complete an interaction.

## Responsive interface

The minimap is part of the Ride interface and sits above the lower ride
controls. On wider screens its panel is 216 px wide around a 196 × 158 px
canvas. At widths up to 720 px it uses a 196 px panel and 176 × 142 px canvas,
starts collapsed as a labelled Map button, and can be expanded or hidden again
without leaving Ride mode. A `ResizeObserver` rebuilds its projection when the
canvas size changes, and its backing canvas caps device-pixel-ratio scaling at
2. The minimap is hidden in Inspect map mode, where the full source inspector
remains available.

The road layer is drawn to an off-screen canvas after resize and reused while
the live bicycle and delivery markers redraw. Ground-level roads use the normal
map treatment; bridges, tunnels, and nonzero-elevation ways use a dashed warm
treatment. A visible legend distinguishes the bicycle, pickup, and drop-off,
and a screen-reader status reports which practice target is active.

## Reproduce and review

Use Node.js 24 or newer and npm 11 or newer:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

Review the production Ride view at desktop and mobile widths. Check north-up
orientation against the source inspector, live bicycle position and heading,
each delivery phase, marker distinction, resize behaviour, page overflow,
keyboard and pointer delivery actions, and browser console and page errors.

## Validation and limits

All 23 TypeScript tests pass, including three focused minimap cases for the
north-up bounded projection, finite output with degenerate bounds and tiny
viewports, and marker behaviour across every delivery phase. Strict TypeScript
checking, the production build, and the documentation diff check also pass.

The production build was reviewed in Chromium through Playwright at 1280 × 800
and 390 × 844. The desktop run accepted the first job, collected its parcel,
rode 67 m, stopped at the drop-off, completed the handoff, and showed LKR 240
with one completion. The minimap changed from pickup to drop-off emphasis with
the controller, its canvas changed as the bicycle moved, and both stops cleared
after completion. Inspect map hid the minimap and returning to Ride restored it.

At 390 × 844 the minimap started collapsed with `aria-expanded="false"`,
expanded with the Map button, hid again, and returned to the wider visible state
after the viewport changed back to desktop. With the map expanded, a
pointer-held Pedal exceeded 4 km/h and Reset returned the bicycle to 0.0 km/h,
confirming that the overlay did not block the controls. Neither reviewed
viewport had horizontal overflow. Scoped console warnings, console errors, and
page errors were empty. The reviewed frames are the
[desktop active-delivery screenshot](milestones/2026-09-13-minimap-prototype.jpg)
and [mobile completed-job screenshot](milestones/2026-09-13-minimap-mobile.jpg).

The build emits a 70.10 KB main entry (24.58 KB gzip), a 628.32 KB shared
JavaScript chunk (158.76 KB gzip), a 3.06 KB preview entry (1.70 KB gzip),
16.84 KB CSS (4.42 KB gzip), and the 2,879.94 KB saved GeoJSON artifact. The
shared chunk retains Vite's expected advisory for output above 500 KB.

Physical-device input, browsers beyond the reviewed Chromium environment,
representative-hardware performance, and longer rides remain unverified.

This checkpoint intentionally leaves legal bicycle routing open. Before the
game can describe real navigation, a person must validate pickup and drop-off
entrances, stopping safety, current access, junction controls, and the complete
route. The canonical road model must then derive mode-aware topology and use it
for the visible world, routing, route distance, deadlines, and minimap route
geometry.
