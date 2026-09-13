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
