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

## 2026-09-13

- Added a bounded practice delivery controller with three deterministic jobs
  sampled along the ground-level centreline of saved source way 13884292.
- Added explicit available, pickup, delivery, completed, and failed phases.
  Pickup and drop-off require an action within 7 m while moving no faster than
  0.15 m/s; crossing a marker alone does not advance or award the job.
- Added 75, 80, and 85 second deadlines and fixed LKR 240, 280, and 320 practice
  rewards. Timeout supports retry, and each completion awards once.
- Connected the deadline to active bicycle-simulation time. Inspect mode,
  hidden documents, window blur or loss of focus, and editable inspector focus
  pause both bicycle movement and the job timer.
- Made bicycle reset cancel an active pickup or delivery before returning to the
  saved spawn. Available, completed, and failed delivery state is unaffected by
  reset, and saved aggregate progress is not erased.
- Added pickup and drop-off beacons, straight-line distance and relative
  direction, task and timer feedback, pointer and `E` actions, and
  transition-only accessible announcements.
- Added versioned browser persistence under
  `colombo-delivery.practice-progress.v1` for aggregate earnings and completed
  jobs only. Invalid, unavailable, blocked, or full storage falls back to
  session play, and aggregate values saturate at the maximum safe integer.
- Kept generated stops explicitly separate from verified destinations. The
  markers do not establish entrances, legal or safe stopping, current access,
  traffic conditions, or a lawful bicycle route; straight-line guidance is not
  navigation.
- Added four delivery-controller tests covering deterministic source geometry,
  the state and interaction gates, one-time rewards, timeout, pause, retry,
  reset cancellation, strict storage validation and failure handling, and
  aggregate saturation. All 19 TypeScript tests, all 12 Python audit tests,
  strict TypeScript checking, and the production build pass.
- Reviewed the production build in Chromium at 1280 × 800 through accept,
  pickup, keyboard riding and steering, braking, stopped handoff, completion,
  reload persistence, a second-job Inspect pause, and reset cancellation.
  Completion recorded LKR 240 and one job once; reload retained both totals.
- Reviewed the 390 × 844 layout without horizontal overflow and verified
  pointer-held pedal and brake plus reset. The scoped browser console and page
  error capture remained empty. Timeout, retry, and storage-failure paths remain
  model-tested rather than browser-tested end to end.
- Saved the 1280 × 800 completed-job production view as a native JPEG at
  `docs/milestones/2026-09-13-delivery-prototype.jpg`.
- Recorded the exact jobs, marker coordinates, timer, pause, reset, storage,
  validation, and limits in the
  [bounded practice delivery report](DELIVERY_PROTOTYPE.md).
- Recorded the next bounded visual study in the
  [warm illustrated visual prototype report](VISUAL_PROTOTYPE.md), including
  its working palette, metre-scale asset and placement contract, Paper Route
  inspiration links, project-authored asset provenance, and explicit browser
  review gates. The completed checks are recorded below; longer-ride
  performance and final art review remain open.
- Added reproducible asset generation and isolated-preview scripts, the editable
  `art/colombo_scenery_kit.blend`, and the runtime GLB, manifest, and PNG under
  `public/models/`. Blender 5.1.2 produced 10 roots, 51 exported nodes, 41
  meshes, 14 materials, and 28,314 post-modifier triangles in an approximately
  1.9 MB GLB. All artwork is original procedural project work without external
  meshes or textures.
- Added 25 deterministic decorative placements across source distances 48–298
  m, including 14 façade or wall pieces and 11 shops. Placements derive
  orientation and setbacks from saved road geometry, use hardcoded conservative
  footprint budgets, and are filtered against every ground-level road. The full-scale
  Lotus Tower sits separately at its real source origin.
- Added an explicit `art-preview.html` Vite entry that loads all ten runtime
  roots with orbit controls, runtime lighting, missing-root status, a safe retry
  action, and a return link. The riding scene reports scenery loading and a
  reload action on failure without blocking its road and delivery systems.
- Reworked the procedural rider silhouette with a tapered body, helmet, parcel
  bag, split limbs, hands at the handlebar, and shoes driven from the crank
  pedal endpoints. Added warm sky, cloud, shadow, and decorative paved-footway
  treatment without changing bicycle collision or map topology.
- Passed all 20 TypeScript tests, strict TypeScript checking, and the production
  build. Chrome visual review confirmed shop fronts, paved footway, gradient
  sky, clouds, warm shadows, the revised rider, and all ten roots in the art
  preview. Longer-ride performance and final art review remain open.
- Completed the first delivery in production Chrome with keyboard input over 67
  m, awarded LKR 240 once, and confirmed reload retained LKR 240 and one
  completion. Desktop 1280 × 800 and mobile 390 × 844 checks had no horizontal
  overflow on the Ride and preview pages. Aspect-aware framing kept all ten
  preview roots visible in portrait while preserving orbit and zoom. Mobile
  pointer-held pedal exceeded 4 km/h and reset returned the bicycle to 0 km/h.
- Confirmed normal Ride and preview reloads had no scoped console warnings,
  console errors, or page errors. Aborting the GLB request exposed `Failed to
  fetch`; preview Retry restored all ten roots, while the Ride warning left
  Accept and Collect usable.
- Saved reviewed 1280 × 800 production Ride and isolated art-preview screenshots
  at `docs/milestones/2026-09-13-visual-prototype.jpg` and
  `docs/milestones/2026-09-13-art-preview.jpg`.
- Recorded production outputs of 65.49 KB for the main entry (23.07 KB gzip),
  628.32 KB for the shared JavaScript chunk (158.76 KB gzip), 3.06 KB for the
  preview entry (1.70 KB gzip), 14.65 KB CSS (4.00 KB gzip), and 2,879.94 KB for
  the saved GeoJSON artifact. Vite's expected
  warning for the shared output above 500 KB remains visible.
- Added the bounded north-up practice-minimap checkpoint using the existing
  900 × 900 m road slice as its sole map input.
- Defined the minimap contract around live bicycle position and heading,
  phase-aware generated pickup and drop-off markers, compact responsive layout,
  and preserved access to the full source inspector.
- Added a cached Canvas road layer, live marker layer, visible legend, active
  target status, resize-aware projection, and device-pixel-ratio scaling capped
  at 2. Screens up to 720 px start with the minimap collapsed behind an
  accessible Map toggle; Inspect mode hides it completely.
- Added three focused minimap tests for full-slice north-up projection, finite
  handling of degenerate bounds and tiny viewports, and marker states across
  available, pickup, delivery, failed, and completed phases. All 23 TypeScript
  tests, strict TypeScript checking, the production build, and the documentation
  diff check pass.
- Reviewed the production build in Chromium at 1280 × 800 through accept,
  pickup, 67 m of bicycle movement, delivery, stopped handoff, and completion.
  The minimap matched pickup, delivery, and completed phases, changed with live
  movement, cleared terminal targets, hid in Inspect, and returned in Ride.
- Reviewed the 390 × 844 layout with the minimap initially collapsed, then
  expanded and hidden through its accessible toggle. The expanded map did not
  block pointer-held Pedal or Reset. Resizing back to desktop restored the
  visible non-collapsed map. Both viewport reviews had no horizontal overflow
  and no scoped console warnings, console errors, or page errors.
- Saved the reviewed desktop active-delivery and mobile completed-job frames at
  `docs/milestones/2026-09-13-minimap-prototype.jpg` and
  `docs/milestones/2026-09-13-minimap-mobile.jpg`.
- Recorded production outputs of 70.10 KB for the main entry (24.58 KB gzip),
  628.32 KB for the shared JavaScript chunk (158.76 KB gzip), 3.06 KB for the
  preview entry (1.70 KB gzip), 16.84 KB CSS (4.42 KB gzip), and 2,879.94 KB for
  the saved GeoJSON. Vite's expected shared-chunk advisory remains.
- Kept its semantics explicit: this view supplies practice orientation only. It
  does not implement legal bicycle routing, route distance, missed-turn
  recalculation, or an off-road straight line presented as a route, and its
  markers do not establish entrances, safe stopping, access, or current street
  conditions.
- Added the [north-up practice minimap report](MINIMAP_PROTOTYPE.md) with the
  shared-coordinate contract, phase behaviour, reproduction steps, browser
  results, build measurements, milestone images, and unresolved routing work.
  Physical devices, other browsers, representative-hardware performance, and
  longer rides remain open.
- Added the bounded [street quality study](STREET_QUALITY_STUDY.md) as a
  follow-up to the first warm illustrated visual prototype.
- Extended the original project-authored Blender kit with richer modeled
  façade, roof, shutter, awning, trim, and foliage detail without downloaded
  meshes or texture inputs. Browser-generated asphalt, ground, and paving
  textures add restrained surface variation without changing geometry or
  collision.
- Shifted the bounded street toward an early-evening warm and cool composition
  with stronger depth, shadows, and a simple distant city layer.
- Reworked Ride mode into a compact dark game HUD. It preserves the native
  delivery action, keyboard and pointer controls, reset, practice minimap and
  accessible names; it moves technical detail to Inspect and keeps scenery-load
  failures persistently visible.
- Tightened the mobile HUD with an icon-only accessible Reset control, a truly
  compact collapsed minimap, a visible expanded-map legend, and an explicit
  `Practice run` label when the longer caveat is hidden.
- Finalized the quality asset export at approximately 3.4 MB with 65 nodes, 55
  meshes, 20 materials, 28,028 vertices, and 47,822 triangles. Direct glTF base
  colours and modeled details preserve the palette without image textures;
  browser canvas textures remain responsible for asphalt, paving, and ground
  variation.
- Finalized 72 decorative scene placements: 29 mature trees, 26 frontage
  pieces, one instanced shrub batch, and one instanced five-pool lamplight
  batch.
- Passed strict TypeScript checking, all 23 current tests, the production build,
  and the documentation diff check. Production desktop and 390 × 844 mobile
  review completed the first 67 m keyboard delivery, Inspect, minimap expand
  and collapse, pointer pedal, Reset, and the persistent scenery-failure path
  without horizontal overflow or scoped console/page errors.
- Recorded a narrow 120-frame stationary local sample of 16.7 ms median and
  17.1 ms at the 95th percentile. It is a smoke measurement rather than a
  sustained-play or representative-hardware guarantee.
- Saved the reviewed desktop, mobile, and neutral browser asset frames at
  `docs/milestones/2026-09-13-street-quality.jpg`,
  `docs/milestones/2026-09-13-street-quality-mobile.jpg`, and
  `docs/milestones/2026-09-13-street-quality-assets.jpg`.
- Recorded production outputs of 78.51 KB for the main entry (26.92 KB gzip),
  630.17 KB for the shared JavaScript chunk (159.38 KB gzip), 3.06 KB for the
  preview entry (1.70 KB gzip), 22.99 KB CSS (5.38 KB gzip), and 2,879.94 KB for
  the saved GeoJSON. Vite's expected shared-output advisory remains.
- Added the original Blender-authored `CourierBicycle` and rider, its editable
  generator and `.blend`, metre-scale GLB, machine-readable manifest, and
  four-view contact sheet without external meshes or image textures.
- Validated final asset bounds of 0.69 × 1.94 × 1.76 m, a 1.08 m wheelbase and
  0.34 m wheel radius. The 1.3 MB GLB contains 152 nodes, 127 meshes, 16
  materials, 38,800 exported vertices, and 25,152 triangles.
- Replaced the procedural visual after asynchronous hierarchy validation while
  preserving the existing controller, delivery behavior, and a usable fallback
  for missing or invalid assets. Added a separate persistent vehicle-load status
  that does not overwrite scenery readiness.
- Bound wheel travel, front steering, active crank motion, counter-rotating
  pedal platforms, and rider limbs to the named export pivots and attachments.
  Hands follow the steered grip transforms, feet follow the rotating pedal
  transforms, and coasting, braking, Inspect and lost input hold the crank pose.
- Added `bicycle-preview.html` with Idle, Pedal, Coast, Steer, Pause and Resume,
  Front, Side and Rear presets, orbit, zoom, failure reporting, and responsive
  bounds-based framing.
- Added the [vehicle and progression document](VEHICLES.md) with the exact
  bicycle contract and distinct planned roles for the electric bicycle, 50 cc
  scooter, commuter motorbike, sport or superbike, car, and van. Those future
  vehicles, capacities, prices, costs, upgrades, and unlocks remain unimplemented.
- Passed all 27 tests, strict TypeScript checking, the production build, and the
  documentation diff check. The generated-GLB test covers the root transform,
  hierarchy, pivots, sole parentage, and wheel diameter.
- Completed the first 67 m production keyboard delivery for LKR 240, reload,
  Inspect and Ride switching, the 390 × 844 minimap/touch/reset flow, and the
  isolated preview controls without horizontal overflow or scoped application
  console/page errors.
- Confirmed that an aborted bicycle-model request leaves a persistent warning,
  preserves scenery readiness, and keeps the procedural fallback playable
  through delivery actions; reload restores the polished model.
- Independently sampled three steering angles and five travelled-distance poses
  with zero hand-to-grip and foot-to-pedal anchor offset, and confirmed that
  wheels continue rolling while the crank holds during coasting.
- Saved the reviewed production, preview, and mobile frames at
  `docs/milestones/2026-09-13-courier-bicycle.jpg`,
  `docs/milestones/2026-09-13-courier-bicycle-preview.jpg`, and
  `docs/milestones/2026-09-13-courier-bicycle-mobile.jpg`.
- Recorded final production outputs of 73.06 KB for the main entry (25.19 KB
  gzip), 10.25 KB for the bicycle visual (3.79 KB gzip), 3.16 KB for the bicycle
  preview (1.69 KB gzip), 630.17 KB for shared JavaScript (159.38 KB gzip), and
  23.35 KB CSS (5.43 KB gzip). Vite's expected shared-output advisory remains.
- Refined the original courier with clearer face, hair, clothing, bag, and shoe
  forms and added Classic, Soft, and Angular identity-scale face profiles.
- Embedded ten deterministic 64 px neutral luminance maps and kept the asset
  pipeline free of external mesh and texture inputs. The updated 2.1 MB GLB
  measures 0.69 × 1.96 × 1.76 m and contains 241 nodes, 213 meshes, 16
  materials, 59,036 exported vertices, and 46,616 triangles.
- Added three skin, hair, outfit, and bag palettes to the Rider studio with live
  preview, explicit save, versioned defensive persistence, and automatic game
  loading. Mutable materials are isolated per courier instance while authored
  texture maps remain intact.
- Added a compact accessible **Customize rider** link to the Ride toolbar; its
  visual label shortens to **Rider** on mobile.
- Passed production Chromium review at 1280 × 800, 390 × 844, and 390 × 600 for
  all five cosmetic selections, save/reload, game-to-studio return, completed
  delivery progress, and responsive layout without horizontal overflow.
- Confirmed corrupt and unavailable storage fall back safely and a forced GLB
  failure remains visible, preserves independently loaded scenery and the
  pedalable procedural fallback, and recovers on reload.
- Passed all 29 tests, strict TypeScript checking, and the production build.
  Artifact tests cover the final hierarchy, transforms, pivots, sole parentage,
  wheel diameter, UVs, embedded images, profile scale, and outward winding.
- Saved reviewed Rider studio, face, production, and mobile images at
  `docs/milestones/2026-09-13-character-detail-studio.jpg`,
  `docs/milestones/2026-09-13-character-detail-face.jpg`,
  `docs/milestones/2026-09-13-character-detail-game.jpg`, and
  `docs/milestones/2026-09-13-character-detail-mobile.jpg`.
- Recorded production outputs of 73.17 KB for the main entry (25.24 KB gzip),
  12.75 KB for the bicycle visual (4.81 KB gzip), 4.67 KB for the Rider studio
  (2.24 KB gzip), 23.98 KB CSS (5.52 KB gzip), and 630.17 KB shared JavaScript
  (159.38 KB gzip). Vite's expected shared-output advisory remains.
- Published the delivery gameplay and prototype art in commit `c4f013d`.
- Reclassified the rigid-part courier and preset appearance system as a
  preserved technical prototype rather than the target hero-character quality.
- Added an original teenage courier 2D concept package with a three-quarter
  standing direction, front/side/back turnaround, six-expression reference,
  and a provenance manifest containing dimensions and SHA-256 hashes. These
  are working visual references, not a reconstructed or rigged 3D asset or
  implemented expression set.
- Published the concept-only package in commit `b0944e8`, separately
  from reconstruction assets whose publication terms remain under review.
- Defined the replacement character pipeline through documented image-to-3D
  reconstruction, preserved raw source, Blender cleanup and retopology, skin
  rigging, facial blend shapes, skin/shirt/shoe options, and actual glTF browser
  review. Reconstruction and implementation remain in progress.
- Produced the first genuine Tripo API `P1-20260311` image-to-3D reconstruction
  from only the original project concept. Preserved its fused static source,
  three embedded 4096 px PBR maps, provider preview, dimensions, counts, and
  hashes in a local provenance record.
- Created a first 1.62 m grounded Blender cleanup and static review export with
  separate skin, hair, shirt, shorts, and shoes material regions.
- Embedded a 4096 px RGB customization mask for skin, shirt, and shoes. Browser
  controls change hue and saturation while preserving authored texture value;
  direct base-colour multiplication remains unsupported.
- Added `character-preview.html` for Full body, Head, Side, Back, orbit, and
  reversible clay inspection of the static cleanup. Per-instance Skin, Shirt,
  and Shoes tints retain the embedded maps; unsupported rig, animation, and
  morph controls remain hidden.
- Passed clean desktop browser framing for all character views, reversible clay,
  all 30 current tests, and the production build. The existing game courier is
  unchanged.
- Rejected the first cleanup at browser art review because smoothed unwelded UV
  seams opened cheek cracks, coarse garment regions formed jagged boundaries,
  and the shoe region extended up the shins. Structural and camera checks pass,
  while visual cleanup remains in progress.
- Repaired the static face surface and preserved the authored default clothing;
  the current checkpoint contains 8,951 Blender vertices, 25,010 exported
  vertices, and 17,681 triangles.
- Found wireframe-like UV-island seams in strong colour variants and returned
  the customization mask for edge-padding repair rather than accepting the
  earlier variant review.
- Padded the customization mask and removed the major UV seam network. Faint
  transitions in Deep skin and edge artifacts on dark shoes remain documented
  paint-refinement work rather than a shipping finish.
- Retrieved a separate 60-node biped-rig result with one skin and no animation
  clips. Weight quality, orientation, bicycle fit, and runtime integration
  remain under review.
- Normalized that result into separate Blender and GLB rig-review artifacts with
  one skin, 58 bones, 17,681 triangles, a grounded 1.62 m -Z-forward contract,
  and no clips. Deformation quality and bicycle fit remain unverified.
- Confirmed normalized rig weight sums and finite motion, then found a hanging
  hand triangle under a combined elbow, knee, and head pose. Rest-pose validity
  does not establish deformation quality; localized influence repair remains in
  progress.
- Removed stray right-foot influences from 572 hand vertices, renormalized the
  affected weights, and accepted the repeated 70° elbow, 90° knee, and 25° head
  browser pose with finite motion and no flap. This is bounded rig QA, not a
  complete weight-paint or riding-animation claim.
- Recorded that the API credit balance does not identify the applicable Tripo
  account tier. Public distribution remains pending confirmation of the account
  plan and corresponding output terms.
- Passed all 31 tests, strict TypeScript checking, the production build, and the
  documentation diff check. The character viewer emits 9.08 KB (3.86 KB gzip)
  and shared JavaScript emits 644.17 KB (163.17 KB gzip).
- Saved reviewed reconstruction, face, colour, mobile, and bounded rig-pose
  frames under `docs/milestones/2026-09-13-teen-courier-*.jpg`.
- Began a manifest-driven character customization portal with one canonical
  registry for item IDs, labels, categories, and color palettes.
- Added strict saved-look validation for mandatory clothing, independent
  optional accessories, exact hexadecimal colors, catalog changes, record
  versions, malformed JSON, and unavailable browser storage.
- Corrected the reconstruction pipeline record to the final 4096 px RGB mask.
  The portal catalog remains a static preview-stage candidate; its rig and game
  readiness are not implied by browser availability.
- Preserved the authored atlas during recoloring by applying its RGB mask across
  every mapped source material and restricting whole hair/bottom tint to the
  selected item hierarchy. Corrected a semantic split that initially recolored
  iris geometry with hair; the repeated hair-only pixel check left both irises,
  mouth, cheeks, and shirt unchanged while changing the fringe.
- Added real-asset checks for 18 non-None item roots with rendered triangles,
  all manifest thumbnails, the embedded tint-mask reference, five color
  regions, catalog labels, unknown IDs, versioning, and storage failure.
- Froze the accepted starter catalog at 6,453,452 bytes, 84 nodes, 54 meshes,
  71 primitives, 12 materials, 16 textures, four embedded images, 83,658
  exported vertex instances, 60,303 triangles, and 21 RGBA thumbnails.
- Replaced guessed hair and leg splits with measured eye/leg regions, crown
  adjacency, and source-surface shirt fitting. This corrected iris recoloring,
  incomplete fringe tint, and exposed calves; transparent thumbnails helped
  expose the errors. Local trouser joins, the older shirt hem, and dark-shoe
  UV-mask seams remain explicit art work.
- Enabled modifier application in the final GLB export after browser review
  revealed that the earlier export omitted the smoother Blender subdivision and
  bevel result.
- Refit glasses and the necklace to measured eye depth and the source shirt
  surface after side review exposed guessed-depth floating.
- Rejected the first long-trouser construction after browser review exposed
  overlapping cut-short pieces, open upper-thigh tube lips, knee bands and
  slits, and a jagged waist. Added an exported-mesh regression that requires
  waist-to-ankle coverage and no open boundary edges through thighs or knees.
- Reusing and merging source shorts and skin remained fragmented and cropped.
  Rebuilt trousers from fitted volumes, smoothed them before voxel union, and
  exported the result as one continuous welded garment.
- Moved only the original lower-leg skin under the Shorts item. The first
  partition reached high enough to capture inner-forearm triangles and opened
  visible arm holes, so it was narrowed below 0.7 m. A source-tint marker
  preserves skin color when bottoms change.
- Accepted final artifact `7a251597…` at 7,967,904 bytes, 83 nodes, 53 meshes,
  70 primitives, 12 materials, 16 textures/four images, 125,286 exported vertex
  instances, and 144,207 triangles. Browser comparisons found no upper-body
  change or calf response to Navy bottoms, while Golden skin changed the calf
  region as intended. Browser Save/reload and all three shoe cuffs passed.
- Exercised all 21 runtime selections, exact mandatory/optional visibility,
  invalid-option preservation, two-avatar material isolation, and independent
  disposal. These checks validate the static portal contract, not skinning or
  bicycle deformation.
- Passed 1440 × 1000 and 390 × 844 production review, saved-look reload,
  independent accessory removal, draft-only Reset, corrupt and blocked storage,
  missing-manifest retry, existing-game loading, all 39 tests, and the build.
- Installed and enabled Tripo Bridge 1.0.32 in Blender 5.1.2 for a future
  Studio-to-Blender artist handoff. The Blender-side handshake and heartbeat
  response were verified; the complete Studio DCC Bridge connection remains
  pending. No asset transfer, service generation, or credit use occurred, and
  the current courier and trousers were unchanged. Future transfers will follow
  the [official guide](https://www.tripo3d.ai/blog/tripo-dcc-bridge-for-blender),
  preserve a source copy, and check the mesh and materials before garment
  cleanup and browser-export review.
- Began a separate natural woven-trouser refinement after the continuous-shell
  repair passed its structural checks but visual review found a ballooned
  pelvis, dropped crotch, featureless pipe-like legs, and rounded closed cuffs.
  The completed replacement reshapes the waist, seat, crotch, thighs, calves,
  and hems.
- Saved the customizer's starting fit as
  `docs/milestones/2026-09-13-trousers-natural-before.jpg`. Rejected the first
  reshaped GLB after browser export exposed missing hip faces and leg slits;
  the final construction based on approved geometry corrected its topology and
  normals.
- Approved a low-resolution foundation built from the actual connected
  authored-shorts component: 245 vertices and 440 faces preserving the natural
  waist, hips, seat, and crotch. Extended its two real hem loops into tapered
  legs with shared faces and connected inset ankle-hem rims. This reuse of
  approved geometry replaces a rejected ellipsoid-and-cylinder union that
  produced hard hips and an inflated crotch.
- Extended each source hem through six connected tapered rings with subtle knee
  and cuff asymmetry, inset ankle rims, recalculated normals, one subdivision
  level, and a 1.2 mm bevel. Added projected pocket and fly details, waistband
  stitching, and restrained knee and ankle creases.
- Moved necessary low original geometry out of the always-visible body and into
  the Shorts-only lower-body group beside its source-tint-preserving skin. This
  removed ankle wedges under Trousers while preserving Shorts; all Canvas,
  Runner, and High-top shoe meshes remain unchanged.
- Froze the 6,609,268-byte browser GLB at SHA-256
  `3298dc6476dfee603dc9b90e081a5789d00fc7bddcfba370349abcdfd55ee31f`.
  Production browser review at 1440 × 1000 and 390 × 844 passed front, side,
  back, mobile Olive recoloring, all three shoes with Trousers and Shorts, and
  upper-body color isolation without console warnings, console errors, or an
  error overlay. All 41 tests and the production build pass.
- Saved the final front, side, back, and mobile review frames as
  `docs/milestones/2026-09-13-trousers-natural-*`. The garment remains
  unskinned and not bicycle-deformation validated; its solid-color details have
  no baked fabric texture.
- Added an original Blender-modeled insulated delivery backpack as independent
  equipment, with a removable torso harness, insulated lid, closures, padding,
  and reflective details. Reviewed front, side, rear, color changes, removal,
  and mobile controls in the standing character studio.
- Rejected protruding zipper piping and floating strap paths, then fitted the
  harness against measured shirt depth. The frozen standalone export contains
  24 meshes and 4,964 triangles in 307,884 bytes.
- Migrated saved looks to version 2 without automatic storage writes. Legacy
  looks preserve their existing appearance and start without a backpack; an
  unavailable optional bag leaves the rest of the saved wardrobe usable.
- Prepared the approved teenage mesh for the existing bicycle. Iterative
  review caught unreachable grips, contaminated shoulder/hand deformation,
  pointed shoes, and floating sole contacts. Rebuilt the riding skeleton from
  measured joints and kept those failures in the equipment report.
- Added a real glTF-loader regression after browser name sanitization exposed
  missing runtime joints that structural export tests did not detect.
- Corrected knee bend planes, rigid shoe orientation, actual sole/palm contact
  markers, and steering elbow planes. Removed cross-body finger influences and
  blended wrist weights into the forearm after close-up browser review exposed
  stretching and a hard wrist boundary. Generated a separate riding harness
  while preserving the standing equipment export.
- Accepted the 19-bone rider as a playable prototype after desktop, mobile,
  front, side, rear, close-up steering, coast, equipment removal, main-game
  loading, and missing-rider fallback/recovery checks. All 54 tests and the
  production build pass; the existing shared chunk warning remains. The final
  rider hash is `8cd56b8c87ae04f80a29653d43f921c313021257dd003e10c96400ea29105329`.
- Recorded remaining fine-grip work: the palm-center miss reaches 33.749 mm at
  full steering, fingers remain consolidated, and modular garment transfer is
  not implemented. Saved final review frames under
  `docs/milestones/2026-09-13-delivery-rider-*` and construction details in
  `docs/RIDER_EQUIPMENT.md`.
- Superseded the detailed riding prototype's engineering acceptance after human
  visual review rejected its inverted wrists, clothing distortion, saddle fit,
  and grip presentation. Started a separate commuter bicycle v2 with no rider
  and no changes to the current game. Approval proceeds through bicycle-only,
  stationary rider fit, controlled pedalling, steering, then simulation.
- Exported the first standalone commuter bicycle review model at 529,760 bytes
  and 13,844 triangles. Its 1.093 m wheelbase, 69.5° head angle, 0.045 m
  perpendicular rake, +X drivetrain, inclined steering pivot, and exact contact
  nodes passed structural validation.
- Recorded the user's 2026-09-13 bicycle-only approval against frozen GLB
  SHA-256
  `ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`.
  Regenerated candidates intentionally return to `awaiting-human-review`; the
  approval does not transfer across hashes.
- Started the separate stationary fit of the unchanged detailed teenage courier
  against the approved saddle, grip, and pedal anchors. This stage measures
  representative pelvis, palm, and sole mesh patches against their targets. A
  uniform 1.08 character scale preserves the source proportions and gives the
  1.7496 m rider natural reach; per-bone and nonuniform scaling are
  excluded. Grip targets lie on the rubber-cylinder centrelines, so residuals
  are fitting signals rather than surface-clearance measurements. Those numbers
  do not establish natural appearance. Pedalling, steering poses, bag
  fitting, and simulation binding remain blocked until the user approves the
  stationary pose in `rider-fit-review.html`.
- Added the static `/rider-fit-review.html` route with front, three-quarter,
  drive-side, opposite-side, and rear views, rider visibility comparison, and
  local copy/download notes. It loads the rider and frozen bicycle separately
  at identity and does not run animation, inverse kinematics, or simulation.
- Held the first stationary export before human handoff after independent
  numeric review found competing terminal-hand IK and wrist orientation plus an
  imprecise pelvis contact patch. Updated the focused loader check to recompute
  residuals against the manifest's radius-adjusted grip-top targets and verify
  those targets against the approved centreline anchors and 0.017 m grip radius.
  The corrected frozen export separates the arm solve from explicit wrist
  orientation and measures the posterior sitting patch.
- Exported the frozen stationary review candidate as a 3,260,140-byte static,
  unskinned GLB with one mesh, seven nodes, no animations, and identity root.
  The approved bicycle and its seatpost remain unchanged. The GLB SHA-256 is
  `01a52f9343bf605f7510f1d4be4d7ac9368942d11bcca52679f92d45201107d3`.
- Recorded final patch-to-target residuals of 13.546 mm at the posterior
  pelvis/saddle-centre reference, 21.074 and 30.304 mm at the radius-adjusted
  left and right grip-top targets, and 1.192 and 4.687 mm at the pedal tops.
  Individual limb-length ratios differ from their uniformly scaled rest values
  by at most `8.81e-7`. The palm misses remain above 20 mm and therefore need
  direct visual judgment; these numbers do not approve the fit.
- Passed the final focused GLTFLoader test and strict TypeScript check. The test
  verifies the identity static contract, absent skin and animation, required
  surface markers, approved bicycle hash, finite bounds, recorded residuals,
  and derivation of grip-top targets from the approved centreline anchors.
- Passed all 58 tests and the production build against the frozen candidate.
  Node textured-asset tests emit expected blob texture-decode warnings outside
  a browser, and Vite retains its expected large shared-chunk advisory. The
  stationary pose still awaits human review, especially at the 21–30 mm palm
  residuals.
- Rejected the stationary rider after human review exposed a large triangular
  torso deformation and waist gap. Earlier identity, contact, knee, and
  limb-length checks did not measure visible surface strain. Added a world-space
  triangle-edge regression: the rejected pose reached 0.371312 m versus
  0.195273 m upright and 0.210895 m at 1.08 scale; the repair cap is 0.220 m.
  The approved bicycle remains frozen and animation remains blocked.
- Confirmed that the rejected torso tear came from converting a world bone
  rotation through the armature's translated matrix, which displaced the pivot.
  Replaced it with a fixed-head world-pivot transform and added a pivot
  assertion plus topology and exported-edge checks.
- Exported a distributed-spine candidate with 30.9243° hip-to-shoulder lean,
  measured lumbar/mid/upper pitches of 21.82°/36.76°/54.35°, and face gaze 13°
  downward. Held it after finding that a hard upper-chest weight mask stretched
  a 3.424 mm central-neck edge to 71.085 mm, or 20.76×.
- Smoothed the central neck boundary while preserving legitimate `bone_5`
  influence. The same edge now measures 7.061 mm, or 2.062×. Final torso strain
  is p99 1.4828/max 1.8039, neck strain is p99 2.0182/max 2.0711, and the 9.354
  whole-mesh maximum lies at a small ankle seam. Zero palm point residual remains
  alignment evidence rather than certified physical clearance.
- Froze the replacement GLB at SHA-256
  `9c8a9645aa63c9c3a009c690b73806aa8ebf6a1b0a2655d60e4b5434089dcf71`.
  Maximum exported edge is 0.203747 m; sole residuals are 2.240 and 5.033 mm.
  The approved bicycle is unchanged, animation remains blocked, and the static
  pose awaits human review.
- Rejected the second stationary full-body rider after human review. Its
  geometry checks guarded known tears but did not establish acceptable anatomy
  or silhouette. Started a new rig preserving the original face, hair, and UVs.
  The source audit found 8,951 vertices, 17,681 polygons, 14 disconnected
  components, no exact-position duplicates, and real shoulder/sleeve gaps near
  7–8 mm, explaining why the earlier seam-sync changed zero vertices. The new
  method records seam-boundary correspondences, applies smooth weights, and
  locks persisted face/hair rest IDs without claiming retopology or manifold
  output. Added `/character-rig-review.html` for a limited comparison of
  original standing, new neutral, and upper-body forward-lean states. Hands and
  legs are deliberately neutral; there is no bicycle fit or animation in this
  provisional checkpoint.
- Corrected three export-specific clean-rig defects before review: the first
  skinned/no-animation lean reopened at rest, the persisted head label omitted
  chin and mouth membership, and evaluated baked normals changed rigid facial
  shading. The final lean is an evaluated static bake; the rebuilt head label
  includes the complete face, jaw, mouth, and `Face_Fairing` membership; and
  original neutral split normals are transformed with the rigid head. Actual
  exported protected face-and-hair corner normals differ by at most
  `0.000348416`. This remains numerical evidence rather than visual approval.
- Passed all 60 tests and the production build for the clean-rig checkpoint.
  Confirmed that the local review page serves the frozen neutral and lean GLB
  bytes, and handed the upper-body comparison over for human visual feedback.
- Recorded human rejection of clean-rig checkpoint 1. Its model and review
  variants remain preserved in commit `26b0828`; passing automatic geometry and
  export checks did not constitute visual approval.
- On 2026-09-14, audited clean-rig checkpoint 1 and found two concrete weighting
  defects. A broad Z-below-0.70 m rule assigned lower hand vertices to leg bones
  and produced hand-region edge strain up to 11.87×; the rigid head/deforming-neck boundary
  reached 8.2×. Revision 2 used anatomical component membership and smooth
  neck-ring weights, but its constrained transition moved strain to the outer
  boundaries: all triangle edges ranged from 0.588865× to 2.096243×. It failed
  engineering review and is not being shown as a corrected model. Further
  parameter iteration stopped pending a deformation-energy solve or
  source-authored weights; bicycle fitting and animation remain blocked.
- Ran one isolated cage prototype after the failed harmonic transition. It kept
  neutral geometry and rigid head/arm regions stable but produced 0.097824× to
  10.306895× triangle-edge ratios at the cage/neck boundary. The diagnostic
  artifacts remain under `art/characters/teen-courier/cage-rig/` and are not
  review-ready. Model trials stopped with the torso/neck/head and disconnected-
  part interface unresolved; the approved original face and bicycle are
  unchanged.
- Added regression fixtures that explicitly detect excessive distortion in the
  three rejected models by comparing corresponding exported triangle edges.
  All 63 tests and the production build pass; these checks confirm known
  failures and do not establish an acceptable replacement character.
