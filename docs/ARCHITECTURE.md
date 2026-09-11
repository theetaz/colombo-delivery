# Architecture

The offline Stage 1 map audit, first Three.js road scene, and first controllable
bicycle are implemented. The broader game architecture remains a proposal
until vehicle, physics, routing, interface, and streaming choices pass focused
prototypes and rider feedback.

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
layer owns the procedural bicycle and obstacle visuals, following camera, and
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

## Delivery and navigation model

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

## Driving and traffic simulation

The first bicycle establishes assisted forward motion, forgiving steering,
surface-dependent speed, a following camera, bounded collisions, and recovery.
Its procedural front wheel steers and its wheels and crank rotate with travel;
rigid-body lean and balance remain later experiments. Later vehicles can share
input, camera, collision, and recovery responsibilities while defining their
own acceleration, braking, handling, capacity, and energy characteristics.

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
- Art direction, scenery fidelity, weather, and time-of-day scope.
- Input support beyond keyboard and mouse, including gamepads and touch.
- Save-data schema and the point at which a backend becomes necessary.
- Runtime routing defaults for missing access tags under Sri Lankan law.
- Whether the audit projection and origin should also be the runtime world
  projection and origin.
- Authored signal phases, stop lines, and approach controls for the first route.
