# Architecture

The offline Stage 1 map audit, first Three.js road scene, first controllable
bicycle, bounded practice delivery loop, and north-up practice minimap are
implemented. The broader game architecture remains a proposal until vehicle,
physics, routing, interface, and streaming choices pass focused prototypes and
rider feedback.

## Initial technical direction

- TypeScript for the game and future runtime map-import code.
- Vite for the browser development and production build.
- Three.js for rendering the 3D world.
- Rapier remains a candidate for later rigid-body physics. The first bicycle
  uses custom assisted kinematics and focused collision tests so its feel can
  be reviewed before that dependency and architecture are confirmed.
- React for menus, job selection, the heads-up display, garage, and settings.
- Blender-authored assets exported as optimized GLB files.
- Browser storage for prototype progress; a backend only when accounts, shared
  leaderboards, or trusted result validation are required.

Reference documentation: [Three.js game structure](https://threejs.org/manual/en/game.html)
and [Rapier JavaScript setup](https://rapier.rs/docs/user_guides/javascript/getting_started_js/).

## Map audit pipeline

OpenStreetMap is the Stage 1 source for roads and relevant map features. The
network fetch is separate from analysis: one networked command stores an exact,
compressed source response and provenance manifest; the audit command then
runs deterministically against that local snapshot using only Python's standard
library. This keeps later results reproducible after live OSM data changes.

The audit publishes four GeoJSON layers: study areas, road ways, mapped
features, and graph-screened delivery candidates. It also publishes a JSON
summary and a machine-readable gap inventory in JSON and CSV. The road layer
preserves OSM identifiers, WGS84 geometry, selected tags, and lengths measured
with the local projection recorded in its metadata. See the
[map-data audit](MAP_DATA_AUDIT.md) for the exact snapshot, scope, findings, and
commands, and [data sources](DATA_SOURCES.md) for provenance and licence rules.

The game importer should turn the audited source into a canonical road model.
Three derived runtime layers should then be generated:

1. A topology layer for routing, permitted directions, turns, and access.
2. A visual layer for road surfaces, markings, pavements, crossings, and props.
3. A simulation layer for collision surfaces, stop lines, speed rules, and
   traffic behaviour.

Generating all three from one canonical model prevents the minimap from routing
through roads that the visible world or simulation treats differently.

The importer must account for road class, width or lane hints, one-way travel,
vehicle and bicycle access, mode-specific one-way overrides, turn restrictions,
roundabouts, signals, crossings, bridges, and layer separation. Missing values
require documented defaults or manual correction. Stage 1 graph screening does
not yet implement complete mode-aware or turn-aware routing, so it cannot be
used as the runtime route model. A mapped signal node establishes neither its
real timing nor its full control plan.

## First browser road slice

The first runtime slice uses Vite, TypeScript, and Three.js. The browser imports
the committed `data/derived/road_network.geojson` artifact; it makes no live map
request. The source snapshot hash and OSM timestamp are preserved in the
runtime data contract so a rendered scene can identify the exact audited input.
`src/main.ts` owns loading and interface wiring, `src/scene/RoadScene.ts` owns
Three.js rendering and interaction, and `src/world/road-slice.ts` plus
`src/world/types.ts` own the renderer-independent data model and geometry.

The pure TypeScript road builder is separate from Three.js. It validates the
GeoJSON collection, converts WGS84 positions with the audit's spherical
azimuthal-equidistant projection, clips centrelines to a 900 × 900 m square,
resolves documented widths and display elevations, and returns road records plus
ribbon-mesh vertices and indices. Every road record preserves its source
feature and OSM identifiers, tags, unclipped WGS84 centreline, clipped local
centreline, and the rationale for derived values. This keeps geometry generation
testable without a browser or rendering context.

The scene layer turns those records into Three.js meshes, provides optional
width-source colours, marks the Lotus Tower origin, and connects pointer
selection to an inspection panel. Orbit controls provide camera orbit, pan, and
zoom. The screen keeps OpenStreetMap attribution visible.

The audit records local `x` east and `y` north. Three.js reserves `y` for display
elevation, so the scene maps east to `x` and north to `−z`; one unit remains one
metre. Display elevation uses `y`. This axis conversion is explicit at the
projection boundary and the inverse conversion supports coordinate inspection
at clipped endpoints.

Width resolution prefers a credible mapped `width`, then a credible whole lane
count multiplied by a provisional 3.2 m visual lane width, then a documented
road-class fallback. Construction and proposed lifecycle ways are excluded;
other geometrically intersecting `highway=*` features remain eligible. A valid
OSM layer is displayed at a provisional 5 m per layer. Bridge and tunnel tags
without a valid layer use +1 and −1 respectively. Ramps, portals, terrain, and
surveyed elevations are not modelled. Road ribbons overlap at intersections;
the prototype does not yet union them into junction surfaces or derive collision
and routing geometry.

See the [prototype report](ROAD_PROTOTYPE.md) for the exact source, scope,
assumption table, controls, validation results, and present limitations.

## First controllable bicycle slice

The first bicycle runs on the existing 900 × 900 m road slice. Pure TypeScript
in `src/game/bicycle.ts` owns its deterministic fixed-step state, input,
surface classification, collision tests, spawn, reset, and tuning. The scene
layer owns the bicycle and obstacle visuals, following camera, and
the transition between Ride and Inspect map modes. The interface layer maps
keyboard and on-screen controls to the shared input state and displays speed,
surface, distance, local position, and contact feedback.

The custom simulation advances at 120 Hz. Its controller accepts at most 0.25 s
per call, while the browser scene applies a tighter 0.1 s frame-delta cap before
the call. Pedalling, rolling resistance, speed-squared aerodynamic drag,
braking, and an additional grass slowdown update forward speed. Assisted
steering approaches a normalized input, returns towards centre after release,
and feeds a wheelbase turn calculation only while the bicycle is moving. The
current speed caps are 30 km/h on road and 12 km/h on grass. These constants are
a reviewable baseline rather than a final vehicle model; the exact table is in
the [bicycle prototype report](BICYCLE_PROTOTYPE.md).

The spawn is derived from saved source way `13884292`, D. R. Wijewardene
Mawatha. It retains source longitude and latitude alongside local metre
coordinates and heading. Road membership is the union of the generated
ground-level road triangles. Steps, bridges, tunnels, and nonzero display
elevations are excluded, while every other position is treated as grass for the
handling test. This is a visual and physical prototype rule, not a claim about
real surface condition, bicycle permission, or route legality.

The collision model is deliberately planar. A swept 0.55 m bicycle circle
tests two marked 0.55 m training obstacles and the inset square world boundary.
Contact stops forward movement and records feedback; reset restores the known
road spawn and clears the ride state. Curbs, buildings, traffic, road edges,
slopes, wheel slip, and rigid-body balance are not collision inputs yet.

Ride mode uses a smoothed following camera and disables map picking and orbit
controls. Inspect map pauses the bicycle, clears ride input, and restores the
earlier orbit, pan, zoom, road selection, source inspector, and layer controls.
Returning to Ride mode resumes from the bicycle's existing position. The
bicycle, rider, wheels, and practice obstacles use Three.js primitives, so this
milestone requires no Blender or external model asset.

## World coordinates and streaming

Authoritative locations remain stored as latitude and longitude. At runtime,
nearby positions are converted to local coordinates where one game unit equals
one metre. The first audit uses a documented local spherical
azimuthal-equidistant projection; it is suitable for measurements within this
small study area, not for wider Colombo without reassessment. The Colombo Atlas
reference origin at longitude
79.85832, latitude 6.92703 is retained as an integration reference and compared
with the OSM Lotus Tower anchor in the audit rather than silently treating the
two coordinates as identical.

The world is divided into loadable sections containing generated road meshes,
collision data, scenery, and spatial indexes. Routing topology can stay
available beyond the rendered area while detailed geometry and active traffic
remain near the player.

Visual detail should use multiple levels of detail, shared materials, instanced
street props, compact textures, and optimized GLB assets. Performance budgets
must be established on representative hardware after the first scene exists.

## Bounded visual asset pipeline

The warm illustrated prototype introduces
`art/generate_colombo_scenery.py`, a reproducible Blender Python generator for
a small project-authored scenery kit. It writes an editable `.blend`, a
metre-scale Y-up GLB for Three.js, and a machine-readable manifest under
`public/models/`. Blender source defines geometry, object origins, transforms,
named materials, and exports; the GLB file is the runtime derivative. Runtime
placement remains downstream of the road builder and cannot alter canonical
road ribbons, collision geometry, delivery stop coordinates, or WGS84
provenance.

`src/world/scenery-placement.ts` owns deterministic decorative placement. It
samples source distances 48–298 m along saved way `13884292`, derives a road
normal and facing direction, and points each asset's local +Z front toward the
road. It uses hardcoded conservative footprint budgets, outward setback
attempts, an alternate-side fallback, and a 5 × 5 footprint sample against every
ground-level centreline and road width. The Lotus Tower replaces the procedural
marker at the map origin with scale 1. Scenery has no collider, and decorative
positions do not describe real buildings, entrances, pavements, or stopping
places.

The separate `art-preview.html` Vite entry provides a narrow review surface for
silhouette, palette, scale, framing, and material response before assets are
judged inside the riding scene. It loads the production GLB with orbit controls
and reports
missing roots or a retryable loading failure. The riding scene reports a
non-blocking scenery-loading notice so asset failure does not remove the road
or delivery interaction. The full scene remains the authority for camera
clearance, road and marker readability, loading, and performance. Repeated
scenery should share geometry and materials or use instancing as the kit grows.
See the
[visual prototype report](VISUAL_PROTOTYPE.md) for the working palette,
placement contract, provenance, references, and open validation.

## Delivery and navigation model

The first delivery implementation is a bounded practice controller in
`src/game/delivery.ts`. It generates three jobs deterministically by sampling
distances along the longest ground-level rendered piece of saved source way
`13884292`. Each stop retains local metre coordinates, inverse-projected WGS84
coordinates, source feature identity, and distance along the source. This is a
repeatable geometry contract for testing the interaction; it is not a routable
topology or evidence of an entrance, safe stopping position, current access, or
legal travel.

The controller owns the available, pickup, delivery, failed, and completed
phases. Pickup and drop-off require an explicit action while the bicycle is
within 7 m and moving no faster than 0.15 m/s. Its deadline consumes only the
scene's active bicycle-simulation delta, so pausing the ride also pauses the
job. Bicycle reset cancels an active job before teleporting to the training
spawn. The view layer owns the delivery card, relative straight-line guidance,
pickup and drop-off marker visuals, keyboard and pointer actions, and accessible
announcements.

Browser persistence is deliberately narrow. The versioned
`colombo-delivery.practice-progress.v1` record contains only non-negative safe
integer earnings and completed-job totals. Active phase, current parcel,
position, and remaining time are session state. Reads reject malformed or
wrong-version values and fall back to zero; unavailable or failed storage does
not prevent in-memory play. The fixed LKR rewards are practice counters and do
not implement spending, upgrades, or economy progression.

A delivery location contains its real coordinate plus a manually validated
arrival point on a reachable road, path, entrance, or stopping area. Stage 1
candidates are only machine-screened from OSM POI or entrance evidence,
proximity to an existing graph node, mapped direction, and structural
out-and-back reachability. A non-release prototype may use them as provisional
test markers when it preserves their unverified status and routing assumptions.
They must not be presented as validated destinations until a person checks
access, entrance placement, legal stopping, physical safety, and a
bicycle-appropriate route. Jobs must also be checked against parcel capacity
and route availability.

The route service provides the active path, distance, restrictions, and minimap
geometry from the canonical road topology. Delivery time is calculated from the
legal route, vehicle capability, expected junction delays, and a play buffer.
It must not require routine speeding or red-light violations.

The bounded practice minimap is an earlier interface checkpoint and does not
implement that route-service design. It receives the same `RoadSlice` used by
the 3D scene, projects its local east/south coordinates into a north-up compact
view, and reads the live bicycle and delivery-controller state. The map remains
fixed while the bicycle heading indicator rotates. Delivery phase controls
which generated pickup or drop-off is emphasized. No separate road dataset,
route graph, path search, direct off-road route line, route distance, or legal
navigation claim is introduced. See the
[minimap prototype report](MINIMAP_PROTOTYPE.md) for its interface contract and
validation gates.

## Driving and traffic simulation

The first bicycle establishes assisted forward motion, forgiving steering,
surface-dependent speed, a following camera, bounded collisions, and recovery.
Its visual layer loads `models/courier_bicycle.glb`, validates the named wheel,
steering, crank, rider-contact, limb, and cargo nodes, then swaps it in for the
procedural fallback. Wheel travel, front steering, and pedalling state drive the
visual without changing controller physics. A failed load remains visible and
leaves the fallback usable. The exact hierarchy and contact transforms are in
[Vehicles and progression](VEHICLES.md). Rigid-body lean and balance remain
later experiments. Later vehicles can share
input, camera, collision, and recovery responsibilities while defining their
own acceleration, braking, handling, capacity, and energy characteristics.

The Rider studio applies limited face and palette presets to the same validated
asset. Mutable character materials are cloned per loaded courier so one
instance cannot recolour another; geometry and immutable texture maps remain
shareable. A versioned `colombo-delivery:courier-appearance` browser record
accepts only known option keys and falls back to defaults when data is absent,
blocked, malformed, or stale. This supports local cosmetic selection only and
does not introduce multiplayer or a free-form character system. See the
[courier character study](CHARACTER_STUDY.md) for the asset provenance,
responsive review, and current animation limits.

That rigid-part rider is now a preserved prototype. The target hero pipeline
starts from an original teenage courier concept, retains the untouched
third-party reconstruction result as source evidence, and performs cleanup,
retopology, UV and normal repair, skin rigging, facial blend-shape authoring,
and bicycle fitting in Blender. The exported glTF must preserve the vehicle
attachment boundary while adding verified joints, inverse bind matrices, morph
targets, and stable skin, shirt, and shoe material regions. See the
[teenage courier character art pipeline](CHARACTER_ART_PIPELINE.md). No
multiplayer or rider-spawning architecture is implied by this asset work.

Traffic simulation should initially cover a small number of nearby vehicles.
Signals use explicit game control phases tied to stop lines and approaches.
Rules should support left-side travel, speed zones, one-way detection,
red-light crossing detection, and collision scoring.

## Existing asset source

The separate Colombo Atlas project may contain useful landmarks or environment
assets. Assets must be assessed for provenance, scale, geometry, materials,
textures, and browser performance before copying or converting them.

## Open decisions

- Mobile support at launch; desktop browser is the current planning assumption.
- Desktop performance budget and reference devices.
- Rider feedback on the custom bicycle prototype before confirming handling
  changes or Rapier integration.
- Whether the bounded warm illustrated study should become the production art
  direction; scenery fidelity, weather, and time-of-day scope remain open.
- Input support beyond keyboard and mouse, including gamepads and touch.
- Save-data schema and the point at which a backend becomes necessary.
- Runtime routing defaults for missing access tags under Sri Lankan law.
- Whether the audit projection and origin should also be the runtime world
  projection and origin.
- Authored signal phases, stop lines, and approach controls for the first route.
