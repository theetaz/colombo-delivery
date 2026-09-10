# Proposed Architecture

This document describes the intended design. None of these systems are
implemented yet, and package choices remain subject to a focused prototype.

## Initial technical direction

- TypeScript for game and data-pipeline code.
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

## Map source and processing

OpenStreetMap is the proposed starting source for roads and relevant map
features. Data will be imported as a versioned offline snapshot rather than
requested as live gameplay data. Its coverage for the selected Colombo area has
not yet been verified.

The pipeline should preserve source latitude and longitude, project positions
into a local metre-based coordinate system, normalize relevant tags, and create
a canonical road model. Three derived layers should then be generated:

1. A topology layer for routing, permitted directions, turns, and access.
2. A visual layer for road surfaces, markings, pavements, crossings, and props.
3. A simulation layer for collision surfaces, stop lines, speed rules, and
   traffic behaviour.

Generating all three from one canonical model prevents the minimap from routing
through roads that the visible world or simulation treats differently.

The importer must account for road class, width or lane hints, one-way travel,
vehicle access, turn restrictions, roundabouts, signals, crossings, bridges,
and layer separation. Missing values require documented defaults or manual
correction. A mapped signal node does not establish the real timing or full
control plan of an intersection.

Useful source references include OpenStreetMap documentation for
[roads](https://wiki.openstreetmap.org/wiki/Key:highway),
[turn restrictions](https://wiki.openstreetmap.org/wiki/Relation:restriction),
[traffic signals](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dtraffic_signals),
and [copyright and attribution](https://www.openstreetmap.org/copyright).

## World coordinates and streaming

Authoritative locations remain stored as latitude and longitude. At runtime,
nearby positions are converted to local coordinates where one game unit equals
one metre. The world is divided into loadable sections containing generated road
meshes, collision data, scenery, and spatial indexes. Routing topology can stay
available beyond the rendered area while detailed geometry and active traffic
remain near the player.

Visual detail should use multiple levels of detail, shared materials, instanced
street props, compact textures, and optimized GLB assets. Performance budgets
must be established on representative hardware after the first scene exists.

## Delivery and navigation model

A delivery location contains its real coordinate plus a manually validated
arrival point on a reachable road, path, entrance, or stopping area. Jobs must
be checked against vehicle access, parcel capacity, and route availability.

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

- Exact boundary and data snapshot for the Lotus Tower prototype.
- Projection and coordinate origin for the first world section.
- Mobile support at launch; desktop browser is the current planning assumption.
- Desktop performance budget and reference devices.
- Physics and vehicle-control prototype results before confirming Rapier.
- Art direction, scenery fidelity, weather, and time-of-day scope.
- Input support beyond keyboard and mouse, including gamepads and touch.
- Save-data schema and the point at which a backend becomes necessary.
