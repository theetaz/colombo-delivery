# Roadmap

Each stage should produce evidence that its acceptance criteria are met before
the project expands to the next stage. The Stage 1 desk audit can inform a
limited road prototype while its manual verification gates remain visible.

## Stage 0 — Repository and product definition

Status: complete.

Define the product, proposed architecture, development stages, and decision
log.

Acceptance criteria:

- The project scope and first playable target are documented.
- Proposed technology and map-processing responsibilities are documented.
- Unverified assumptions and open decisions are visible.
- The local Git repository uses `main` as its initial branch and has the GitHub
  repository configured as `origin`.

## Stage 1 — Colombo road-data audit

Status: map-data audit and previews complete; manual road and candidate-stop
validation remains open.

Select a connected area around Lotus Tower and evaluate its OpenStreetMap data.
The boundary must include the main roads, local access streets, and delivery
approaches needed for complete routes.

Acceptance criteria:

- [x] The selected boundary and data snapshot are recorded and reproducible.
- [x] Road names, classifications, structural connectivity, mapped one-way and
  access tags, turn-restriction relations, bridges, signals, crossings, and
  roundabouts are measured from the snapshot.
- [x] Missing or ambiguous mapped evidence is listed for source or field
  verification.
- [ ] Candidate delivery coordinates are manually confirmed as safe, legal,
  reachable stopping points or entrances rather than building centres. The
  published candidates are graph-screened only.
- [x] OpenStreetMap attribution and data-licence handling are documented for
  the repository, previews, and future game.
- [ ] A bicycle-aware, turn-aware review confirms the complete first route and
  its current junction controls.

## Stage 2 — Drivable small area

Status: in progress. The first browser road scene and first controllable bicycle
now run in a 900 × 900 m slice from the audited snapshot. The bicycle adds
assisted pedal, coast, brake, and steer behaviour, a following camera, surface
feedback, marked training obstacles, world-boundary collisions, reset, and a
preserved map inspector. The initial bicycle checkpoint has been accepted for
continued prototyping. Longer physical-device riding, physical multi-touch,
marked-obstacle contact, tuning, and an agreed performance budget remain open.
Open Stage 1 field checks do not block this technical prototype, but they remain
required before destinations or routes are presented as validated.

Generate a browser scene from the audited data and add the first bicycle. Use a
metre-based local coordinate system derived from stored latitude and longitude.

Engineering checkpoints:

- [x] Render a bounded road slice in a desktop browser from the saved audit
  artifact.
- [x] Preserve source identifiers and coordinates and expose the local metre
  conversion, width provenance, and vertical-placement rationale.
- [x] Document and test clipping, coordinate, width, and elevation assumptions.
- [x] Add a controllable bicycle with steering, acceleration, braking,
  camera-follow behaviour, collisions, and recovery.
- [ ] Review road scale, acceleration, braking, steering, camera distance,
  grass slowdown, collision recovery, and mobile controls with hands-on rider
  feedback; tune the bounded prototype where needed.
- [ ] Extend the reviewed slice into the complete Stage 2 area and meet all
  acceptance criteria below.
- [ ] Review a bounded warm illustrated scenery and rider slice for scale,
  palette, silhouette, camera readability, loading, and browser cost. Keep it
  decorative so the canonical road, collision, and delivery geometry remains
  unchanged.

The bounded bicycle checkpoint uses custom assisted kinematics and a procedural
model. It intentionally omits Rapier, route legality, traffic, delivery jobs,
progression, and ramps between elevated road segments. Those systems should not
hide unresolved scale or handling feedback from this first rideable slice.

Acceptance criteria:

- Roads, junctions, collision surfaces, and route topology come from the same
  source snapshot.
- A player can cycle through the selected area with steering, acceleration,
  braking, camera controls, collisions, and recovery when stuck.
- The prototype follows left-side traffic conventions.
- Bridges and crossing roads remain separate where their levels differ.
- The scene meets an agreed desktop-browser performance budget on a documented
  reference device.

## Stage 3 — Complete delivery loop

Status: in progress through a bounded practice loop. Three deterministic jobs
exercise accept, pickup, timed delivery, reward accounting, retry, reset
cancellation, and aggregate browser persistence. A north-up minimap now shows
the shared road slice, live bicycle heading, and delivery phase. Its generated
road markers are not verified entrances or stopping places, its overview and
direction display are not routing, and this checkpoint does not satisfy the
complete-stage acceptance criteria below.

Build job selection, pickup, navigation, delivery, payment, and local progress
saving.

Engineering checkpoints:

- [x] Add a deterministic practice sequence with explicit stopped pickup and
  drop-off actions, a simulation-time deadline, one-time rewards, and retry.
- [x] Define pause, bicycle-reset cancellation, reload, corrupt-storage, and
  unavailable-storage behaviour.
- [x] Add a north-up practice minimap from the same bounded road slice, with
  live bicycle heading and delivery-phase marker states.
- [ ] Manually validate 10–20 real pickup and drop-off entrances and safe,
  lawful stopping points.
- [ ] Build legal bicycle routing, minimap guidance, and missed-turn
  recalculation from the canonical road topology.
- [x] Review the compact north-up practice minimap in production Chromium at
  desktop and mobile viewport sizes.
  Its shared road context, live heading, and phase-aware generated markers are
  an orientation checkpoint and do not complete legal routing.
- [ ] Replace practice deadlines with allowances based on verified legal routes,
  vehicle performance, junction delay, and a play buffer.

Acceptance criteria:

- 10–20 pickup and drop-off points are manually validated as reachable.
- A player can accept and complete a timed bicycle delivery from start to
  finish.
- The route and minimap use the same network and restrictions as the world.
- A missed turn triggers a valid route recalculation.
- Deadlines account for a legal route, vehicle performance, expected signal
  delay, and a reasonable play buffer.
- Earnings and completed jobs persist locally between browser sessions.

## Stage 4 — Traffic and road rules

Status: not started.

Add working junction controls, nearby traffic, and understandable driving
feedback.

Acceptance criteria:

- Signals control defined approaches and stop lines; their game cycles are not
  presented as Colombo's real-world timings unless verified.
- Nearby traffic follows permitted directions and basic junction rules.
- Red-light crossings, wrong-way travel, speeding, and collisions produce
  consistent feedback and scoring effects.
- Safe driving remains compatible with normal delivery deadlines.

## Stage 5 — Vehicle progression

Status: not started.

Add the garage, electric bicycle, and the first meaningful upgrade purchase.
Extend progression to motorbikes and cars only after the core economy is tested.

The scoped fleet and shared asset contract are recorded in
[Vehicles and progression](VEHICLES.md). Bicycle gameplay is implemented, and
its polished Blender visual has completed its bounded production review. The
electric bicycle, 50 cc scooter, commuter motorbike, sport or superbike, car,
and van remain planned; none is available through the current interface.
The implemented courier also has limited saved face and palette presets in the
[character study](CHARACTER_STUDY.md). This does not implement a garage,
vehicle ownership, or free-form character creation.

Before adding the planned fleet, replace the rigid-part courier prototype with
the original teenage hero defined in the
[character art pipeline](CHARACTER_ART_PIPELINE.md). Review the 2D identity,
document the selected image-to-3D reconstruction, retopologize and skin it in
Blender, add a bounded facial-shape set, preserve bicycle contacts, and verify
skin, shirt, and shoe options in the exported GLB and production browser.

Acceptance criteria:

- Completing jobs earns money that can be spent in the garage.
- The electric bicycle changes acceleration, range, or delivery suitability in
  a noticeable and balanced way.
- Upgrade ownership and equipped vehicle persist locally.
- Vehicle classes unlock suitable parcel sizes or job types so earlier vehicles
  remain useful.

## Stage 6 — Scenery and Colombo expansion

Status: not started.

Improve recognizable surroundings, assess reusable Colombo Atlas assets, and
expand through connected map sections.

Before city-scale scenery work, the bounded Stage 2 visual study establishes a
reproducible Blender-to-GLB path, a small shared-material asset kit, an isolated
art preview, and placement rules. Its warm illustrated direction and validation
gates are recorded in the [visual prototype report](VISUAL_PROTOTYPE.md). The
study does not count as recognizable Colombo scenery or approve wider asset
production.

A follow-up [street quality study](STREET_QUALITY_STUDY.md) has completed its
bounded desktop and mobile review. It adds richer original asset detail,
lightweight procedural surface textures, an early-evening lighting pass, and a
compact game HUD while keeping scenery decorative. Rain, traffic, a finished
character and animation set, broader environment production, and
representative-hardware performance remain future work.

Acceptance criteria:

- Imported assets have documented provenance and are optimized for browser use.
- Nearby sections stream in without breaking navigation or active jobs.
- Repeated street furniture uses efficient shared assets or instancing.
- Each new section passes the road, delivery-point, and performance checks from
  earlier stages.
