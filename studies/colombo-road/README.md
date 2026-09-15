# Colombo road asset — first district

A standalone geographic asset for testing a future browser delivery game.
It covers **1.8 × 1.8 km (3.24 km²)** around Lotus Tower and Colombo Fort.
This is the first district, not the complete Colombo map or a playable game.

## Open the asset

- **`Colombo_Roads_v1.blend`** — open in Blender. The Outliner separates roads,
  terrain/water, building blockouts, traffic-control reference markers and Lotus
  Tower. The overview camera is ready; no preview render has been generated.
- **`colombo-roads.glb`** — the full district, including the existing Lotus Tower,
  in standard glTF 2.0 binary format. Import into your Three.js test scene.
- **`road-surfaces.glb`** — the road surface meshes only. Useful for inspecting
  roads separately; these same surfaces are already inside the full scene.
- **`road-network.json`** — road names/tags, directed graph edges, mapped controls
  and source turn restrictions. This is a routing input, not a completed router.
- **`roads.geojson`** — the same road centre lines in geographic longitude/latitude.
- **`manifest.json`** — extent, source dates, asset statistics and accuracy notes.

The full scene contains 565 mapped motor-road ways, about 56.9 km of road centre
lines, 108 distinct road names and 7,829 building footprint extrusions. A “way” is
a source segment, not necessarily an entire street. Five ways carry roundabout
tags; this is not a count of five separate roundabouts. The district contains ten
traffic-signal nodes and 25 control reference nodes in total. The source request
includes a small surrounding margin, so its raw counts are larger.

## Use with Vite and Three.js

Copy `colombo-roads.glb` into your existing test website's
`public/colombo-road-asset-v1/` directory. The GLB is self-contained and does not
require a Draco or Meshopt decoder. Add it to an existing Three.js scene:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const asset = await new GLTFLoader().loadAsync(
  '/colombo-road-asset-v1/colombo-roads.glb'
);
scene.add(asset.scene);
camera.near = 0.5;
camera.far = 15000;
camera.position.set(700, 1350, 1100);
camera.lookAt(-400, 0, -450);
camera.updateProjectionMatrix();
// If your test scene uses OrbitControls:
controls.target.set(-400, 0, -450);
controls.update();
```

Your test scene needs lighting or an environment map, a renderer and a render
loop. Lights are provided in the Blender scene but are not embedded in the GLB.
Keep one unit equal to one metre. GLB and graph positions use X east, Y up and
Z south. Blender uses X east, Y north and Z up. All exports share the same origin
at Lotus Tower and can be loaded without scaling or horizontal repositioning.

## What is approximate or unfinished

Road shapes, source names and tags come from an OpenStreetMap snapshot dated
**2026-09-14**. The lake, regional terrain and building context reuse the existing
city dataset dated **2026-09-05**. No street-level accuracy review was performed.
Most widths are estimated, using lane counts where available; most building
heights are inferred from floor counts or defaults. Building appearance is a
simple blockout. The included tower reuses the earlier model with reduced geometry.

Bridge surfaces have the earlier provisional terrain + 1.2 m elevation offset.
They need proper decks, approach grading and clearance before vehicle physics.
Graph heights use regional ground elevation and do not represent bridge decks.
Underground roads stay in the data but are not drawn on the ground surface.
No surveyed lanes, stop lines, kerbs, road signs or signal timing are supplied.

The amber cubes on posts are **reference markers**, not functional traffic lights.
Their positions follow mapped control nodes, which may represent a junction
centre or an approach rather than a physical pole. Do not use them directly as
stop-line or fine triggers.

The graph connects shared OpenStreetMap node IDs. It does not create connections
where separate roads merely cross in plan view. Base one-way directions are
preserved; a missing direction tag defaults to two-way. Conditional directions
are left unresolved. Four turn-restriction records and raw access/barrier tags are
included, but restrictions are **not enforced** by the edge list. Vehicle-specific
exceptions still require interpretation. `base_graph_eligible` only filters base
access/direction; it does not certify a legal or safe route. Restricted roads
remain visible. Boundary endpoints are clipping points, not real dead ends.

No driving controls, collisions, traffic simulation, route solver, safe spawn
points, delivery stops, scoring, website integration or deployment are included.
Browser, visual, performance and gameplay testing are left to you for this handover.

## Source data and rebuilding

The `source/` folder contains the Overpass response and query, clipped city
context, existing tower input and prepared geometry. Raw source tags are retained
as data. Reference notes in those tags have not been independently verified.

- Roads and controls: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
  available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/).
- Buildings: the existing [CMC / NSDI dataset](https://gisapps.nsdi.gov.lk/server/rest/services/SLNSDI/CMC/MapServer)
  and [Overture Maps](https://docs.overturemaps.org/guides/buildings/). Per-building
  sources and height methods are retained in `source/context.json`; these inputs
  retain their original terms and are not relicensed by this package.
- Elevation: [Mapzen Terrain Tiles and underlying elevation contributors](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- Lotus Tower: the previously created local architectural model, reused here.

OpenStreetMap tagging references:
[one-way direction](https://wiki.openstreetmap.org/wiki/Key:oneway),
[traffic signals](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dtraffic_signals),
[turn restrictions](https://wiki.openstreetmap.org/wiki/Relation:restriction).

To regenerate from the bundled inputs, use Python with Shapely 2.1+ and pyproj,
then Blender 5.1:

```sh
python3 scripts/prepare_asset.py
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 4 --python scripts/build_asset.py
```

These commands create assets only. They do not run tests, open a browser or start
a server. The GLBs use standard geometry for easy import; device performance and
further compression have not been assessed.
