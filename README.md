# Colombo Delivery

Colombo Delivery is a planned browser-based 3D driving game built around real
Colombo roads and coordinates. Players collect parcels, navigate to reachable
delivery points, follow traffic rules, and earn money for vehicle upgrades.
Progression begins with a bicycle, continues through an electric bicycle and
motorbikes, and eventually unlocks cars.

Repository: [theetaz/colombo-delivery](https://github.com/theetaz/colombo-delivery)

## Project status

The repository now contains the reproducible Stage 1 OpenStreetMap audit, a
browser-rendered 3D road prototype, and the first controllable bicycle. The
bicycle uses approachable custom kinematics on the same 900 × 900 m Lotus Tower
slice, with pedal, coast, brake, steer, a following camera, road and grass
handling, marked training obstacles, world-boundary collisions, and reset. The
original source inspector remains available. This is a road-scale and handling
milestone; candidate entrances, bicycle access, stopping safety, route legality,
junction details, and current street conditions still need manual validation.

Development happens in public. Follow the [roadmap](docs/ROADMAP.md) for planned
stages, the [build timeline](docs/BUILD_TIMELINE.md) for a chronological record
with commit-pinned artifacts, the [development log](docs/DEVELOPMENT_LOG.md) for
verified changes, and the
[main branch commit history](https://github.com/theetaz/colombo-delivery/commits/main)
for the project's implementation record.

The first playable target is a small, recognizable area around Lotus Tower. It
will include a controllable bicycle, 10–20 verified pickup and drop-off points,
one complete timed-delivery loop, saved earnings, and an electric-bicycle
upgrade. The map can then expand through connected areas of Colombo.

## First controllable bicycle prototype

[![Production view of the first controllable bicycle prototype](docs/milestones/2026-09-11-bicycle-prototype.jpg)](docs/BICYCLE_PROTOTYPE.md)

*The 1280 × 800 production Ride view shows the first assisted procedural
bicycle at its saved road spawn with the following camera, speed and surface
feedback, grass slowdown, marked training obstacles, and reset. Open the
[bicycle prototype report](docs/BICYCLE_PROTOTYPE.md) for its exact controls,
spawn coordinates, tuning, collision model, validation, and limitations.*

## First 3D road prototype

[![Production view of the first Lotus Tower 3D road prototype](docs/milestones/2026-09-11-road-prototype.jpg)](docs/ROAD_PROTOTYPE.md)

*The first production road scene renders 109 saved OSM ways and exposes the
coordinate, width, and vertical-placement evidence behind each selectable
surface. Open the [prototype report](docs/ROAD_PROTOTYPE.md) for its exact scope,
controls, validation, and limitations.*

## Stage 1 audit preview

![Static overview of the Lotus Tower Stage 1 road-data audit](docs/maps/lotus-tower-road-audit.svg)

*Static overview of the OSM road audit. Candidate markers are graph-screened
test locations and remain unverified for real-world access, stopping, and
safety.*

## Product principles

- Preserve real road geometry, names, directions, junctions, and coordinates
  where source data can be verified.
- Include the local streets needed to connect destinations, even when the main
  focus is on popular roads.
- Make safe driving compatible with delivery deadlines.
- Keep bicycle and motorbike handling approachable with assisted balance.
- Scale to a large browser map by loading nearby city sections and simplifying
  distant scenery.

## Documentation

- [Build timeline](docs/BUILD_TIMELINE.md) records each completed milestone in
  delivery order with immutable links to its artifacts.
- [Roadmap](docs/ROADMAP.md) defines the staged delivery plan and acceptance
  criteria.
- [Architecture](docs/ARCHITECTURE.md) records the proposed technical design
  and the implemented audit, road-rendering, and bicycle-control pipeline.
- [First 3D road prototype](docs/ROAD_PROTOTYPE.md) records its exact scope,
  source contract, coordinate system, rendering assumptions, controls,
  validation, and limitations.
- [First controllable bicycle prototype](docs/BICYCLE_PROTOTYPE.md) records the
  exact spawn, controls, assisted handling constants, camera, surface and
  collision rules, validation, and limitations.
- [Lotus Tower map-data audit](docs/MAP_DATA_AUDIT.md) records the study scope,
  reproducible method, results, gaps, and manual verification gates.
- [Data sources](docs/DATA_SOURCES.md) records OSM provenance, tag
  interpretation, attribution, and data-licence handling.
- [Interactive audit map](docs/maps/lotus-tower-road-audit.html) and
  [static audit map](docs/maps/lotus-tower-road-audit.svg) provide offline
  previews of the reviewed layers. They are inspection aids, not gameplay.
- [Development log](docs/DEVELOPMENT_LOG.md) records completed, verifiable
  project changes.

## Reproduce the map audit

Python 3.12 is recommended and is the tested version. The scripts use only the
Python standard library. These commands reproduce the audit and previews from
the committed snapshot without network access:

```sh
python3 scripts/audit_road_network.py
python3 scripts/build_map_preview.py
python3 -m unittest discover -s tests -v
```

Only refresh the live OSM input when intentionally starting a new, separately
reviewed snapshot:

```sh
python3 scripts/fetch_osm_data.py
```

GitHub displays the interactive HTML file as source. Serve the preview locally
from the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs/maps
```

Then open
[http://127.0.0.1:4173/lotus-tower-road-audit.html](http://127.0.0.1:4173/lotus-tower-road-audit.html).

## Run the bicycle and road prototype

Use Node.js 24 or newer and npm 11 or newer:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Build and verify the
prototype with:

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

The browser scene uses the committed offline road artifact and does not fetch
live map data. Ride with `W` or the up arrow, steer with `A` / `D` or the arrow
keys, brake with `S`, the down arrow, or space, press `R` to reset, and press
`F` to switch to the preserved map inspector. See the
[bicycle report](docs/BICYCLE_PROTOTYPE.md) for the handling model and the
[road report](docs/ROAD_PROTOTYPE.md) for the 900 × 900 m geometry scope and
provisional width and elevation rules.

## Next step

Ride the prototype and review its road scale, acceleration, braking, steering,
camera distance, grass slowdown, and recovery. Tune that experience from direct
feedback before adding delivery jobs or expanding the map. Stage 1 access,
entrance, stopping, junction, and current-street checks remain open throughout
the prototype.
