# Roadmap

Each stage should produce evidence that its acceptance criteria are met before
the project expands to the next stage. Dates and estimates will be added only
after the initial map-data audit.

## Stage 0 — Repository and product definition

Define the product, proposed architecture, development stages, and decision
log.

Acceptance criteria:

- The project scope and first playable target are documented.
- Proposed technology and map-processing responsibilities are documented.
- Unverified assumptions and open decisions are visible.
- The local Git repository uses `main` as its initial branch and has the GitHub
  repository configured as `origin`.

## Stage 1 — Colombo road-data audit

Select a connected area around Lotus Tower and evaluate its OpenStreetMap data.
The boundary must include the main roads, local access streets, and delivery
approaches needed for complete routes.

Acceptance criteria:

- The selected boundary and data snapshot are recorded and reproducible.
- Road names, classifications, connectivity, one-way directions, access rules,
  turn restrictions, bridges, signals, crossings, and roundabouts are audited.
- Missing or ambiguous details are listed for source or field verification.
- Candidate delivery coordinates resolve to safe, reachable stopping points or
  entrances rather than building centres.
- OpenStreetMap attribution and data-license obligations are documented for the
  game.

## Stage 2 — Drivable small area

Generate a browser scene from the audited data and add the first bicycle. Use a
metre-based local coordinate system derived from stored latitude and longitude.

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

Build job selection, pickup, navigation, delivery, payment, and local progress
saving.

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

Add the garage, electric bicycle, and the first meaningful upgrade purchase.
Extend progression to motorbikes and cars only after the core economy is tested.

Acceptance criteria:

- Completing jobs earns money that can be spent in the garage.
- The electric bicycle changes acceleration, range, or delivery suitability in
  a noticeable and balanced way.
- Upgrade ownership and equipped vehicle persist locally.
- Vehicle classes unlock suitable parcel sizes or job types so earlier vehicles
  remain useful.

## Stage 6 — Scenery and Colombo expansion

Improve recognizable surroundings, assess reusable Colombo Atlas assets, and
expand through connected map sections.

Acceptance criteria:

- Imported assets have documented provenance and are optimized for browser use.
- Nearby sections stream in without breaking navigation or active jobs.
- Repeated street furniture uses efficient shared assets or instancing.
- Each new section passes the road, delivery-point, and performance checks from
  earlier stages.
