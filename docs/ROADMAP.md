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

Status: not started. The next engineering slice renders one small road section
from the audited snapshot with inspectable coordinates and width rules; the
first bicycle follows after the road geometry and alignment review. No game
runtime exists. Open Stage 1 field checks do not block this bounded prototype.

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

Status: not started.

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

Acceptance criteria:

- Imported assets have documented provenance and are optimized for browser use.
- Nearby sections stream in without breaking navigation or active jobs.
- Repeated street furniture uses efficient shared assets or instancing.
- Each new section passes the road, delivery-point, and performance checks from
  earlier stages.
