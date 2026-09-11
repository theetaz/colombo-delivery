# Build Timeline

This is the chronological public record of how Colombo Delivery is being built.
Each completed milestone links to the exact Git commit that delivered it, so its
documents, data, and previews remain inspectable even as the current project
changes.

## 2026-09-11 — Project foundation

Status: complete.

The project began with a browser-based 3D parcel-delivery game concept set on
real Colombo roads. The first playable scope was defined around Lotus Tower,
starting with a bicycle and one complete delivery loop before expanding to more
vehicles and areas. The proposed architecture established TypeScript, Vite,
Three.js, and metre-based local world coordinates as the initial technical
direction.

Delivered in commit
[`d18705e664cee4aaec2a9fda5d79135f917494d9`](https://github.com/theetaz/colombo-delivery/commit/d18705e664cee4aaec2a9fda5d79135f917494d9):

- [Original project definition](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/README.md)
- [Proposed architecture](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/docs/ARCHITECTURE.md)
- [Initial staged roadmap](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/docs/ROADMAP.md)

## 2026-09-11 — Public progress record

Status: complete.

The repository was made public and its documentation was connected to the
public commit history. This established the roadmap and development log as the
places to follow planned work and verified outcomes.

Delivered in commit
[`4f67ed18e069091a062d607cec795d10bfb8f84e`](https://github.com/theetaz/colombo-delivery/commit/4f67ed18e069091a062d607cec795d10bfb8f84e):

- [Public-facing README](https://github.com/theetaz/colombo-delivery/blob/4f67ed18e069091a062d607cec795d10bfb8f84e/README.md)
- [Development log at this milestone](https://github.com/theetaz/colombo-delivery/blob/4f67ed18e069091a062d607cec795d10bfb8f84e/docs/DEVELOPMENT_LOG.md)

## 2026-09-11 — Reproducible Lotus Tower road audit

Status: desk audit delivered; Stage 1 field checks remain open.

The first real map-data slice captured a fixed OpenStreetMap snapshot around
Lotus Tower and added a deterministic offline audit. It measures road geometry,
mapped directions and access evidence, structural connectivity, relevant map
features, and data gaps. It also screens 15 provisional delivery endpoints.
Those candidates and the illustrative route remain unverified for current
bicycle access, entrances, legal stopping, junction movements, and street
conditions.

Delivered in commit
[`01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac`](https://github.com/theetaz/colombo-delivery/commit/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac):

- [Audit report](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/MAP_DATA_AUDIT.md)
- [Snapshot provenance](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/osm/manifest.json)
- [Generated road geometry](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/derived/road_network.geojson)
- [Machine-readable audit results](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/audit/audit_summary.json)
- [All saved data artifacts](https://github.com/theetaz/colombo-delivery/tree/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data)
- [Interactive audit preview source](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.html)
- [Static audit preview](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.svg)

![Stage 1 Lotus Tower road audit at the delivery commit](https://raw.githubusercontent.com/theetaz/colombo-delivery/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.svg)

Validation measured 700 core `highway=*` ways, 23 mapped traffic-signal
nodes, and 15 graph-screened candidate endpoints. All 12 tests passed, and
offline regeneration produced outputs identical to the committed artifacts.

## 2026-09-11 — First 3D road prototype

Status: road-geometry prototype complete; Stage 2 bicycle work remains open.

The first browser scene turns the saved audit geometry into a 900 × 900 m
Three.js road slice centred on the Lotus Tower OSM anchor. It renders 109 source
ways as 110 clipped pieces and lets a reviewer orbit, pan, zoom, select roads,
inspect source and local metre coordinates, and see the width and provisional
vertical-placement rule used by each surface.

Delivered in commit
[`e88fc37315fbb3d8726c2b7416e720afaf1704d0`](https://github.com/theetaz/colombo-delivery/commit/e88fc37315fbb3d8726c2b7416e720afaf1704d0):

- [Frozen prototype report](https://github.com/theetaz/colombo-delivery/blob/e88fc37315fbb3d8726c2b7416e720afaf1704d0/docs/ROAD_PROTOTYPE.md)
- [Browser and road-model source](https://github.com/theetaz/colombo-delivery/tree/e88fc37315fbb3d8726c2b7416e720afaf1704d0/src)
- [Locked package and build commands](https://github.com/theetaz/colombo-delivery/blob/e88fc37315fbb3d8726c2b7416e720afaf1704d0/package.json)
- [Production screenshot](https://github.com/theetaz/colombo-delivery/blob/e88fc37315fbb3d8726c2b7416e720afaf1704d0/docs/milestones/2026-09-11-road-prototype.jpg)

![First 3D road prototype at the delivery commit](https://raw.githubusercontent.com/theetaz/colombo-delivery/e88fc37315fbb3d8726c2b7416e720afaf1704d0/docs/milestones/2026-09-11-road-prototype.jpg)

All nine TypeScript road-model tests and all 12 existing Python audit tests
passed, along with strict TypeScript checking and the production build. Chromium
QA at 1280 × 800 and 390 × 844 covered camera controls, direct and list-based
selection, source inspection, layer controls, mobile scrolling, and overflow;
the browser console remained free of warnings and errors.

Widths derived from lane counts or road class and elevations derived from OSM
layers remain explicit visual assumptions. Intersecting ribbons are not yet
joined into drivable junction geometry, and the prototype has no bicycle,
physics, collision surfaces, routing, traffic, or delivery loop.

## 2026-09-11 — First controllable bicycle prototype

Status: bounded bicycle prototype complete; hands-on ride feedback remains
open.

The first rideable build adds a controllable bicycle to the existing 900 ×
900 m Lotus Tower road slice. Its custom assisted kinematics support pedal,
coast, brake, steer, road and grass handling, a smoothed following camera,
marked training obstacles, world-boundary collisions, and reset. The procedural
bicycle requires no external model, and Inspect map preserves the earlier road
selection, source evidence, camera actions, and layer controls while pausing the
ride.

Delivered in commit
[`a47f7b05777b3e1c85f5693deb6721683141e4a0`](https://github.com/theetaz/colombo-delivery/commit/a47f7b05777b3e1c85f5693deb6721683141e4a0):

- [Frozen bicycle prototype report](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/docs/BICYCLE_PROTOTYPE.md)
- [Bicycle controller](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/src/game/bicycle.ts)
- [Browser scene and interface source](https://github.com/theetaz/colombo-delivery/tree/a47f7b05777b3e1c85f5693deb6721683141e4a0/src)
- [Bicycle-controller tests](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/tests/bicycle-controller.test.ts)
- [Locked package and build commands](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/package.json)
- [Production screenshot](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/docs/milestones/2026-09-11-bicycle-prototype.jpg)

![First controllable bicycle prototype at the delivery commit](https://raw.githubusercontent.com/theetaz/colombo-delivery/a47f7b05777b3e1c85f5693deb6721683141e4a0/docs/milestones/2026-09-11-bicycle-prototype.jpg)

All 15 TypeScript tests and all 12 Python audit tests passed, along with strict
TypeScript checking and the production build. Chromium QA at 1280 × 800 and
390 × 844 covered pointer-held pedalling and braking, reset, steering into
grass, Ride and Inspect mode switching, paused telemetry during inspection,
restored follow camera, source inspection, responsive layout, and
editable-control shortcut exclusion. The browser console remained free of
warnings and errors.

The model uses planar circles and a square study boundary rather than rigid-body
physics. Sustained hardware-keyboard riding, physical multi-touch, and browser
contact with the marked obstacles remain hands-on checks. Traffic, routing,
route legality, delivery jobs, progression, curbs, buildings, and ramps between
elevated road segments remain outside this milestone.

## Current state

The repository contains the product definition, Stage 1 audit pipeline, first
browser-rendered 3D road prototype, and first controllable bicycle. The bicycle
uses custom assisted kinematics in the same 900 × 900 m Lotus Tower slice, with
pedal, coast, brake, steer, road and grass handling, a following camera, marked
training obstacles, world-boundary collisions, reset, and the preserved source
inspector. See the [bicycle prototype report](BICYCLE_PROTOTYPE.md) for its exact
spawn, controls, tuning, validation, and limitations, and the
[road prototype report](ROAD_PROTOTYPE.md) for the underlying geometry and
source contract.

The current-checkout production image remains available as the
[first controllable bicycle screenshot](milestones/2026-09-11-bicycle-prototype.jpg).

The normal current static audit preview remains
[the repository SVG](maps/lotus-tower-road-audit.svg); unlike the commit-pinned
image above, that relative link follows the current checkout.

The interactive preview is an offline HTML artifact, not a hosted game. GitHub
shows its source. To inspect the current checkout, run this from the repository
root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs/maps
```

Then open
[http://127.0.0.1:4173/lotus-tower-road-audit.html](http://127.0.0.1:4173/lotus-tower-road-audit.html).
That address works only while the local server is running.

## Next bounded milestone — Ride-feel review and tuning

Ride the bicycle on the current road slice and judge the relationship between
city scale, speed, steering, braking, camera distance, grass slowdown, obstacle
clearance, and recovery. The review should cover sustained keyboard control and
physical multi-touch input as well as browser contact with both marked training
obstacles and the world boundary.

Use that feedback to tune the small assisted model before expanding the map or
adding jobs. The review does not require Rapier, traffic, routing, route
legality, progression, or ramps between elevated road segments.

Future completed milestones will be appended here in delivery order with their
date, outcome, preview or artifacts, validation, remaining limitations, and
implementation commit. Artifact links will use that commit hash rather than a
moving branch link.
