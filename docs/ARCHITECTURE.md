# Architecture

The offline Stage 1 map audit is implemented. The browser game architecture is
still a proposal and package choices remain subject to a focused prototype.

## Initial technical direction

- TypeScript for the game and future runtime map-import code.
- Vite for the browser development and production build.
- Three.js for rendering the 3D world.
- Rapier for collisions and rigid-body physics, with custom approachable vehicle
  controls.
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

The first bicycle should use assisted balance and forgiving steering while its
visual model leans into turns. Later vehicles can share input, camera, collision,
and recovery systems while defining their own acceleration, braking, handling,
capacity, and energy characteristics.

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
- Physics and vehicle-control prototype results before confirming Rapier.
- Art direction, scenery fidelity, weather, and time-of-day scope.
- Input support beyond keyboard and mouse, including gamepads and touch.
- Save-data schema and the point at which a backend becomes necessary.
- Runtime routing defaults for missing access tags under Sri Lankan law.
- Whether the audit projection and origin should also be the runtime world
  projection and origin.
- Authored signal phases, stop lines, and approach controls for the first route.
