# Development Log

This log records completed and verifiable changes. Planned work belongs in the
roadmap.

## 2026-09-11

- Initialized the local Git repository with `main` as its initial branch.
- Created the private
  [theetaz/colombo-delivery](https://github.com/theetaz/colombo-delivery)
  GitHub repository and configured it as the local `origin` remote.
- Defined the browser-based Colombo parcel-delivery game concept and progression
  from bicycle to electric bicycle, motorbikes, and cars.
- Defined the first playable target around Lotus Tower: a bicycle, 10–20
  validated delivery points, a complete timed job, local earnings, and an
  electric-bicycle upgrade.
- Recorded the proposed rendering, physics, interface, asset, map-processing,
  routing, streaming, and save-data architecture.
- Added staged milestones with acceptance criteria.
- Identified the OpenStreetMap coverage audit as the next implementation step.
- Changed the GitHub repository visibility from private to public so development
  can be followed openly.
- Updated the README with links to the roadmap, development log, and `main`
  branch commit history for following public progress.
- Selected OSM way 728831229 as the Lotus Tower audit anchor at longitude
  79.8583149, latitude 6.9270265. Defined a 1,000 m circular core and a 500 m
  routing buffer within a 1,500 m context area.
- Recorded the Colombo Atlas reference origin separately and measured its
  approximately 0.68 m offset from the OSM anchor for later asset alignment.
- Stored the exact Overpass query, compressed response, endpoint, OSM base time,
  download time, projection parameters, element counts, and SHA-256 digests in
  a provenance manifest. The snapshot contains OSM data as of 2026-09-10
  23:11:10 UTC.
- Added a standard-library Python fetch command and a deterministic offline audit
  command. The fetch is an explicit snapshot refresh; normal reproduction uses
  the committed snapshot without network access.
- Generated separate GeoJSON layers for study areas, roads, mapped audit
  features, and graph-screened candidate endpoints, plus JSON and CSV audit
  reports.
- Measured 700 OSM highway ways and 60,253.5 m of clipped highway centreline in
  the core. Of those ways, 571 are in the motor-road subset used for lane,
  width, speed, and motor-road name coverage.
- Recorded the main evidence limits: only 5 of 700 core highway ways have an
  explicit bicycle tag, 39 have an explicit general access tag, 107 of 571
  motor-road ways have a lane count, and 10 of 571 have a width.
- Checked network structure separately from legal routing. The context graph has
  6,380 nodes in 15 undirected components, with 6,304 nodes in the largest
  component; turn restrictions and unresolved access defaults are not yet
  applied.
- Parsed 26 structurally complete turn-restriction relations, including nine in
  the core, without presenting structural completeness as real-world
  verification.
- Screened 15 candidate delivery endpoints from 67 possibilities using actual
  highway nodes, mapped direction, structural out-and-back reachability, access
  exclusions, endpoint distance, and spatial spread. Every candidate still
  requires manual access, entrance, stopping, and safety validation.
- Added offline interactive HTML and static SVG previews with road and audit
  layers, source-feature inspection, map controls, caveats, and visible OSM
  attribution.
- Added 12 regression tests for source integrity, deterministic offline audit
  outputs, geometry clipping and projection, access and direction handling,
  restriction completeness, feature classification, strict explicit-access
  lower bounds, and candidate-output invariants.
- Documented OSM data provenance, ODbL handling, attribution placement, tag
  semantics, audit definitions, findings, and remaining manual acceptance
  gates.
- Added a chronological build timeline with commit-pinned links to the project
  foundation, public progress documentation, and reproducible road-audit
  artifacts.
- Defined the next bounded engineering milestone as one inspectable browser 3D
  road slice with camera controls, real-to-local coordinate evidence, and
  explicit road-width provenance. Bicycle implementation follows its geometry
  and alignment review.
- Added the first Vite, TypeScript, and Three.js browser runtime with Node.js 24
  and npm 11 as the supported minimum toolchain. Runtime dependencies are
  locked, and the production build emits local assets without a CDN or live map
  request.
- Added a renderer-independent TypeScript road builder that reads the saved
  Stage 1 GeoJSON, validates its projection origin and Earth radius, and carries
  its source snapshot hash into the generated slice summary.
- Fixed the prototype scope to a 900 × 900 m square centred on the OSM Lotus
  Tower anchor. The scene uses `x` east, `z` south, and `y` for display elevation,
  with one scene unit equal to one metre.
- Clipped 109 intersecting OSM source ways into 110 render pieces totalling
  11,740.633 m of centreline. The source contains 2,045 features; four proposed
  or construction lifecycle ways are excluded before geometric selection.
- Preserved each rendered piece's source feature and OSM identifiers, full
  source WGS84 centreline, clipped local centreline, tags, representative
  coordinates, width rationale, and vertical-placement rationale.
- Applied mapped widths where strict numeric metre or feet values are credible,
  then a provisional 3.2 m-per-lane rule for motor-road classes, then documented
  road-class visual fallbacks. Of the 109 intersecting source ways, one uses a
  mapped width, 11 use a lane assumption, and 97 use class fallbacks.
- Kept mapped vertical separation visible with a provisional 5 m per layer.
  One rendered layer-1 bridge, Kovil Street OSM way 228885183, is displayed at
  5 m; ramps, terrain transitions, portals, and surveyed elevations are not
  modelled.
- Added the browser road scene with orbit, pan, zoom, reset, and top-view camera
  controls; selectable road surfaces; a source inspector; grid, centreline,
  path, and width-source toggles; an FPS readout; a Lotus Tower origin marker;
  responsive layouts; and visible OpenStreetMap attribution.
- Added nine road-builder tests covering coordinate round trips, clipping,
  exclusions, source traceability, width and elevation rules, bounded ribbon
  geometry, source metadata drift, and deterministic saved-snapshot totals.
  All nine tests, all 12 existing Python audit tests, strict TypeScript checking,
  and the production build pass. The independent centreline total differs by
  approximately 0.00000003 m.
- Reviewed the production build in Chromium at 1280 × 800 and 390 × 844. Camera
  controls, direct and list-based road selection, camera focus,
  automatic path reveal, layer toggles, mobile scrolling, and width and bridge
  inspection passed with no browser-console warnings or errors and no mobile
  horizontal overflow.
- Confirmed Trace Lane's mapped 10 m width, D. R. Wijewardene Mawatha's
  lane-derived 6.4 m width, and the Kovil Street bridge's provisional 5 m
  layer-1 display in the production inspector. The scene showed 60 FPS in this
  test environment; this is not a general hardware performance result.
- Recorded the first production screenshot at
  `docs/milestones/2026-09-11-road-prototype.jpg`, with D. R. Wijewardene Mawatha
  selected at 1280 × 800.
- Recorded the current build-size limit: the 575.45 KB minified JavaScript chunk
  is 147.33 KB gzip and triggers Vite's default chunk advisory; the 2.88 MB saved
  GeoJSON remains a separate local asset.
- Kept overlapping road ribbons explicit as a prototype limitation. Junctions
  are not yet unioned into authored surfaces, drivable collision geometry, or
  routable topology.
- Recorded the prototype's reproducible commands, exact bounds, source contract,
  assumptions, controls, validation, and current limitations in the
  [first 3D road prototype report](ROAD_PROTOTYPE.md).
- Added the first controllable bicycle to the existing 900 × 900 m road slice.
  Ride mode supports pedal, coast, brake, steer, a smoothed following camera,
  reset, keyboard input, and on-screen hold controls.
- Implemented the bicycle as renderer-independent custom kinematics with a
  fixed 1/120 s simulation step. The tuning baseline caps road speed at 30 km/h
  and grass speed at 12 km/h and records explicit acceleration, deceleration,
  steering, wheelbase, and turn-rate constants for rider review.
- Derived the repeatable training spawn from D. R. Wijewardene Mawatha, source
  way 13884292, 70 m along the source direction and 1.5 m to its left. Its
  local position is `x = 275.37068363728685`, `y = 0`,
  `z = −13.41014759519771`; its saved WGS84 position is longitude
  79.86080957499048, latitude 6.927147093685909.
- Classified road handling from the union of actual ground-level road mesh
  triangles while excluding steps, bridges, tunnels, and nonzero elevations.
  Entering grass immediately applies its lower speed cap and additional
  deceleration without presenting the visual classification as surveyed
  surface or access evidence.
- Added swept collisions between the bicycle's 0.55 m planar circle, two
  marked 0.55 m grass-side training obstacles, and the inset 900 m world
  boundary. Contact stops forward travel and reset restores the saved spawn and
  clears ride state.
- Added a procedural bicycle, simple rider, rotating wheels and crank, steering
  front assembly, contact shadow, and procedural training markers from Three.js
  primitives. No external model or Blender step is required.
- Preserved the road-inspection workflow as a separate Inspect map mode. It
  pauses movement, clears ride input, and restores orbit, pan, zoom, road
  selection, source details, camera actions, and layer controls before Ride mode
  returns to the bicycle's current position.
- Added ride feedback for speed, road or grass surface, distance travelled,
  local east/south position, and obstacle or world-boundary contact. Browser
  blur, hidden-tab state, and editable controls clear held input.
- Added six bicycle-controller tests covering acceleration, coasting, braking,
  grass behaviour, steering, fixed-step agreement at 60 and 144 frames per
  second, swept collisions, reset, road-mesh membership, source exclusions,
  exact spawn coordinates, finite frame-delta handling, and obstacle clearance.
  All six focused tests pass alongside the nine road-builder tests and 12
  Python audit tests. Strict TypeScript checking and the production build also
  pass.
- Recorded the current build-size limit: the 595.41 KB minified JavaScript
  chunk is 153.82 KB gzip and triggers Vite's default chunk advisory. The CSS
  is 11.42 KB minified and 3.38 KB gzip; the saved 2.88 MB GeoJSON remains a
  separate asset.
- Reviewed the production build in Chromium at 1280 × 800 and 390 × 844. The
  desktop scene opened cleanly in the stopped Ride state, the mobile canvas
  matched its viewport, all four hold controls stayed in bounds, and neither
  layout had horizontal overflow. The browser console contained no warnings or
  errors.
- Verified pointer-held Pedal to 10.8 km/h and 3 m travelled, pointer-held Brake
  back to 0.0 km/h, `R` reset, visible steering and road-to-grass transition,
  `F` mode switching, frozen ride telemetry during inspection, restored follow
  camera, and correct shortcut exclusion while the road selector had focus.
- Rechecked the preserved source inspector with Trace Lane's mapped 10 m width
  and the Kovil Street bridge's provisional 5 m elevation. The observed 56 FPS
  is one result from this test environment rather than a general performance
  claim.
- Recorded the 1280 × 800 production Ride view at
  `docs/milestones/2026-09-11-bicycle-prototype.jpg` and verified it as a native
  JPEG. Sustained hardware-keyboard riding, physical multi-touch, and browser
  contact with a marked obstacle remain hands-on checks beyond the automated
  controller coverage.
- Recorded the exact controls, spawn and obstacle coordinates, tuning constants,
  camera, surface rules, collision model, procedural visual scope, validation,
  and current limitations in the
  [first controllable bicycle prototype report](BICYCLE_PROTOTYPE.md).
