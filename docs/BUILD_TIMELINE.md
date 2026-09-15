# Build Timeline

This is the chronological public record of how Colombo Delivery is being built.
Each completed milestone links to the exact Git commit that delivered it, so its
documents, data, and previews remain inspectable even as the current project
changes.

## 2026-09-11 — Project foundation

Status: complete.

The project began with a browser-based 3D parcel-delivery game concept set on
real Colombo roads. The first playable scope was defined around Lotus Tower,
starting with a bicycle and one complete delivery loop before expanding to more
vehicles and areas. The proposed architecture established TypeScript, Vite,
Three.js, and metre-based local world coordinates as the initial technical
direction.

Delivered in commit
[`d18705e664cee4aaec2a9fda5d79135f917494d9`](https://github.com/theetaz/colombo-delivery/commit/d18705e664cee4aaec2a9fda5d79135f917494d9):

- [Original project definition](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/README.md)
- [Proposed architecture](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/docs/ARCHITECTURE.md)
- [Initial staged roadmap](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/docs/ROADMAP.md)

## 2026-09-11 — Public progress record

Status: complete.

The repository was made public and its documentation was connected to the
public commit history. This established the roadmap and development log as the
places to follow planned work and verified outcomes.

Delivered in commit
[`4f67ed18e069091a062d607cec795d10bfb8f84e`](https://github.com/theetaz/colombo-delivery/commit/4f67ed18e069091a062d607cec795d10bfb8f84e):

- [Public-facing README](https://github.com/theetaz/colombo-delivery/blob/4f67ed18e069091a062d607cec795d10bfb8f84e/README.md)
- [Development log at this milestone](https://github.com/theetaz/colombo-delivery/blob/4f67ed18e069091a062d607cec795d10bfb8f84e/docs/DEVELOPMENT_LOG.md)

## 2026-09-11 — Reproducible Lotus Tower road audit

Status: desk audit delivered; Stage 1 field checks remain open.

The first real map-data slice captured a fixed OpenStreetMap snapshot around
Lotus Tower and added a deterministic offline audit. It measures road geometry,
mapped directions and access evidence, structural connectivity, relevant map
features, and data gaps. It also screens 15 provisional delivery endpoints.
Those candidates and the illustrative route remain unverified for current
bicycle access, entrances, legal stopping, junction movements, and street
conditions.

Delivered in commit
[`01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac`](https://github.com/theetaz/colombo-delivery/commit/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac):

- [Audit report](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/MAP_DATA_AUDIT.md)
- [Snapshot provenance](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/osm/manifest.json)
- [Generated road geometry](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/derived/road_network.geojson)
- [Machine-readable audit results](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/audit/audit_summary.json)
- [All saved data artifacts](https://github.com/theetaz/colombo-delivery/tree/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data)
- [Interactive audit preview source](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.html)
- [Static audit preview](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.svg)

![Stage 1 Lotus Tower road audit at the delivery commit](https://raw.githubusercontent.com/theetaz/colombo-delivery/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.svg)

Validation measured 700 core `highway=*` ways, 23 mapped traffic-signal
nodes, and 15 graph-screened candidate endpoints. All 12 tests passed, and
offline regeneration produced outputs identical to the committed artifacts.

## 2026-09-11 — First 3D road prototype

Status: road-geometry prototype complete; Stage 2 bicycle work remains open.

The first browser scene turns the saved audit geometry into a 900 × 900 m
Three.js road slice centred on the Lotus Tower OSM anchor. It renders 109 source
ways as 110 clipped pieces and lets a reviewer orbit, pan, zoom, select roads,
inspect source and local metre coordinates, and see the width and provisional
vertical-placement rule used by each surface.

Delivered in commit
[`e88fc37315fbb3d8726c2b7416e720afaf1704d0`](https://github.com/theetaz/colombo-delivery/commit/e88fc37315fbb3d8726c2b7416e720afaf1704d0):

- [Frozen prototype report](https://github.com/theetaz/colombo-delivery/blob/e88fc37315fbb3d8726c2b7416e720afaf1704d0/docs/ROAD_PROTOTYPE.md)
- [Browser and road-model source](https://github.com/theetaz/colombo-delivery/tree/e88fc37315fbb3d8726c2b7416e720afaf1704d0/src)
- [Locked package and build commands](https://github.com/theetaz/colombo-delivery/blob/e88fc37315fbb3d8726c2b7416e720afaf1704d0/package.json)
- [Production screenshot](https://github.com/theetaz/colombo-delivery/blob/e88fc37315fbb3d8726c2b7416e720afaf1704d0/docs/milestones/2026-09-11-road-prototype.jpg)

![First 3D road prototype at the delivery commit](https://raw.githubusercontent.com/theetaz/colombo-delivery/e88fc37315fbb3d8726c2b7416e720afaf1704d0/docs/milestones/2026-09-11-road-prototype.jpg)

All nine TypeScript road-model tests and all 12 existing Python audit tests
passed, along with strict TypeScript checking and the production build. Chromium
QA at 1280 × 800 and 390 × 844 covered camera controls, direct and list-based
selection, source inspection, layer controls, mobile scrolling, and overflow;
the browser console remained free of warnings and errors.

Widths derived from lane counts or road class and elevations derived from OSM
layers remain explicit visual assumptions. Intersecting ribbons are not yet
joined into drivable junction geometry, and the prototype has no bicycle,
physics, collision surfaces, routing, traffic, or delivery loop.

## 2026-09-11 — First controllable bicycle prototype

Status: bounded bicycle prototype complete; hands-on ride feedback remains
open.

The first rideable build adds a controllable bicycle to the existing 900 ×
900 m Lotus Tower road slice. Its custom assisted kinematics support pedal,
coast, brake, steer, road and grass handling, a smoothed following camera,
marked training obstacles, world-boundary collisions, and reset. The procedural
bicycle requires no external model, and Inspect map preserves the earlier road
selection, source evidence, camera actions, and layer controls while pausing the
ride.

Delivered in commit
[`a47f7b05777b3e1c85f5693deb6721683141e4a0`](https://github.com/theetaz/colombo-delivery/commit/a47f7b05777b3e1c85f5693deb6721683141e4a0):

- [Frozen bicycle prototype report](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/docs/BICYCLE_PROTOTYPE.md)
- [Bicycle controller](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/src/game/bicycle.ts)
- [Browser scene and interface source](https://github.com/theetaz/colombo-delivery/tree/a47f7b05777b3e1c85f5693deb6721683141e4a0/src)
- [Bicycle-controller tests](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/tests/bicycle-controller.test.ts)
- [Locked package and build commands](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/package.json)
- [Production screenshot](https://github.com/theetaz/colombo-delivery/blob/a47f7b05777b3e1c85f5693deb6721683141e4a0/docs/milestones/2026-09-11-bicycle-prototype.jpg)

![First controllable bicycle prototype at the delivery commit](https://raw.githubusercontent.com/theetaz/colombo-delivery/a47f7b05777b3e1c85f5693deb6721683141e4a0/docs/milestones/2026-09-11-bicycle-prototype.jpg)

All 15 TypeScript tests and all 12 Python audit tests passed, along with strict
TypeScript checking and the production build. Chromium QA at 1280 × 800 and
390 × 844 covered pointer-held pedalling and braking, reset, steering into
grass, Ride and Inspect mode switching, paused telemetry during inspection,
restored follow camera, source inspection, responsive layout, and
editable-control shortcut exclusion. The browser console remained free of
warnings and errors.

The model uses planar circles and a square study boundary rather than rigid-body
physics. Sustained hardware-keyboard riding, physical multi-touch, and browser
contact with the marked obstacles remain hands-on checks. Traffic, routing,
route legality, delivery jobs, progression, curbs, buildings, and ramps between
elevated road segments remain outside this milestone.

## 2026-09-13 — Bounded practice delivery loop

Status: implemented and verified in the current checkout; publication record is
pending.

This bounded slice adds three deterministic timed jobs to the bicycle scene.
Each job requires explicit stopped actions inside its pickup and drop-off
markers, awards a fixed practice reward once, and advances through a repeating
sequence. Timeout and retry are explicit. Reset cancels an active job before
returning the bicycle to its spawn, and pausing the ride also pauses the
deadline.

Only aggregate earnings and completed-job count are stored in a versioned
browser record. Invalid or unavailable storage falls back safely, while active
job phase, parcel state, position, and remaining time remain session state. See
the [bounded practice delivery report](DELIVERY_PROTOTYPE.md) for the exact job
definitions, generated coordinates, controls, timer rules, storage contract,
verification, and limits.

The current-checkout production preview is the
[bounded practice delivery screenshot](milestones/2026-09-13-delivery-prototype.jpg).

All 19 TypeScript tests and all 12 Python audit tests pass, along with strict
TypeScript checking and the production build. The current build emits a
607.99 KB minified JavaScript chunk that is 158.22 KB gzip and retains Vite's
default chunk-size advisory.

Production Chromium QA at 1280 × 800 completed the first job with real keyboard
input, including pickup, steering, braking, stopped handoff, one-time reward,
reload persistence, native keyboard button activation, Inspect pause, and reset
cancellation. QA at 390 × 844 covered responsive layout, pointer-held pedal and
brake, and reset without horizontal overflow. The scoped console and page-error
capture remained empty. Timeout and storage-failure paths retain automated
controller coverage rather than browser end-to-end coverage.

The six pickup and drop-off markers are generated along saved source way
13884292 for repeatable prototype testing. They are not verified real
entrances, safe or legal stopping points, or evidence of a lawful bicycle
route. Straight-line distance and direction do not implement routing. Traffic,
route recalculation, an economy with spending, upgrades, and progression remain
outside this milestone.

The immutable implementation commit and artifact links will be added after the
milestone is published. Earlier milestone sections and their pinned links remain
the historical record for those builds.

## 2026-09-13 — Warm illustrated visual slice

Status: implemented and initially verified in the current checkout; longer-ride
performance, final art review, and the publication record are pending.

This bounded study targets a project-authored Blender Python asset kit,
reproducible GLB exports, decorative Three.js placement around the existing
Lotus Tower road slice, an isolated art preview, and a clearer temporary rider.
It uses a warm matte palette, metre scale, simple softened geometry, and large
readable silhouettes. The authoritative road, collision, delivery, and
coordinate data remain unchanged.

Blender 5.1.2 produced the reviewed 1.9 MB GLB with 10 roots, 51 exported nodes,
41 meshes, 14 materials, and 28,314 post-modifier triangles. A separate
reproducible Blender script renders the isolated asset preview. The placement
module derives road-relative transforms and filters them against ground-level
road clearance. The finished placement set forms a dense 250 m vignette and
keeps the full-scale Lotus Tower at its source map origin. The
[visual prototype report](VISUAL_PROTOTYPE.md) records the design target, exact
asset paths, scale and placement contract, provenance, public inspiration
references, completed checks, and validation still required. A production
milestone screenshot and build measurements are recorded below. The pending
delivery milestone above remains the record of the gameplay slice on which this
visual work builds.

The final placement test produces 25 cleared decorative pieces across source
distances 48–298 m, including 14 façade or wall pieces and 11 shops. All 20
TypeScript tests, strict TypeScript checking, and the production build pass.
Chrome visual review confirmed the revised rider, shop fronts, paved footway,
gradient sky, clouds, warm shadows, and all ten roots in the interactive art
preview. Production Chrome at 1280 × 800 completed the first delivery with
keyboard input over 67 m, awarded LKR 240 once, and retained LKR 240 and one
completion after reload. Desktop 1280 × 800 and mobile 390 × 844 checks reported
no horizontal overflow.
Aspect-aware preview framing kept all ten roots visible at both sizes while
preserving orbit and zoom.

On the mobile Ride view, a held pedal exceeded 4 km/h and reset returned the
bicycle to 0 km/h. Normal Ride and art-preview reloads produced no scoped
console warnings, console errors, or page errors. An intentionally aborted GLB
request showed `Failed to fetch` and a working Retry action in the preview; the
Ride warning remained non-blocking while Accept and Collect stayed usable.

The reviewed production frames are the
[warm illustrated Ride screenshot](milestones/2026-09-13-visual-prototype.jpg)
and [isolated art-preview screenshot](milestones/2026-09-13-art-preview.jpg).
The build emits a 65.49 KB main entry (23.07 KB gzip), a 628.32 KB shared
JavaScript chunk (158.76 KB gzip), a 3.06 KB preview entry (1.70 KB gzip), 14.65
KB CSS (4.00 KB gzip), and the 2,879.94 KB saved GeoJSON artifact. The shared
chunk retains Vite's expected warning for
output above 500 KB. Performance across representative hardware, longer rides,
and final art polish remain open.

## 2026-09-13 — North-up practice minimap

Status: implemented and verified in the current checkout; publication record
is pending.

This interface checkpoint adds a compact responsive north-up minimap to Ride
mode. It reuses the same renderer-independent 900 × 900 m `RoadSlice` as the 3D
world, follows the bicycle's live local position, rotates its bicycle indicator
to show heading while keeping north fixed, and changes generated pickup and
drop-off emphasis with the delivery phase. The
[minimap prototype report](MINIMAP_PROTOTYPE.md) records the data contract,
interaction semantics, review procedure, and limits.

The minimap is practice guidance only. It does not add a route graph, legal
bicycle routing, route distance, missed-turn recalculation, or an off-road
straight line presented as a route. Its stops remain generated practice
markers, not verified entrances or safe and lawful stopping points.

All 23 TypeScript tests pass, including three focused minimap cases for bounded
north-up projection, finite degenerate input, and delivery-phase marker states.
Strict TypeScript checking, the production build, and the documentation diff
check also pass.

Production Chromium review at 1280 × 800 completed the first job through a 67 m
ride and stopped handoff, with the minimap matching pickup, delivery, and
completed phases. The canvas changed with bicycle movement, completed targets
cleared, Inspect hid the map, and returning to Ride restored it. At 390 × 844
the map started collapsed, expanded and hid through its accessible toggle, and
returned to the visible non-collapsed desktop state after resizing. With the
mobile map expanded, pointer-held Pedal exceeded 4 km/h and Reset returned the
bicycle to 0.0 km/h. Both viewports had no horizontal overflow and the scoped
console-warning, console-error, and page-error captures were empty.

The reviewed frames are the
[desktop active-delivery screenshot](milestones/2026-09-13-minimap-prototype.jpg)
and [mobile completed-job screenshot](milestones/2026-09-13-minimap-mobile.jpg).
The build emits a 70.10 KB main entry (24.58 KB gzip), a 628.32 KB shared
JavaScript chunk (158.76 KB gzip), a 3.06 KB preview entry (1.70 KB gzip),
16.84 KB CSS (4.42 KB gzip), and the 2,879.94 KB saved GeoJSON artifact. Vite's
expected shared-chunk advisory remains. Physical devices, other browsers,
representative-hardware performance, and longer rides remain open. Earlier
delivery and visual entries remain the historical record for those checkpoints.

## 2026-09-13 — Street quality study

Status: implemented and verified in the current checkout; publication record
is pending.

This follow-up pass improves the bounded visual slice from the bicycle camera.
It adds richer project-authored modeled detail, lightweight browser-generated
asphalt, ground and paving surfaces, a warmer and cooler early-evening scene,
and a compact dark Ride HUD. Speed, objective, time, reward, action and minimap
remain available as small game overlays. Technical road and performance details
remain in Inspect, while scenery-load failures stay visible in Ride.

The [street quality study](STREET_QUALITY_STUDY.md) records the implementation,
asset and surface provenance, accessibility behavior, and the remaining gap to
the supplied reference. This is not a parity claim: a hand-painted texture set,
rain, traffic, a finished character rig and animation set, dense hand-placed
environment art, and longer performance review remain open.

The final GLB is approximately 3.4 MB and contains 65 nodes, 55 meshes, 20
materials, 28,028 vertices, and 47,822 triangles. The scene contains 72
decorative placements: 29 mature trees, 26 frontage pieces, an instanced shrub
batch, and an instanced batch of five lamplight pools. The kit uses direct glTF
base colours and modeled surface detail without image textures; browser canvas
textures provide asphalt, paving, and ground variation.

Strict TypeScript checking, all 23 current tests, the production build, and the
documentation diff check pass. Production review completed the first 67 m
keyboard delivery for LKR 240 and one completion, switched through Inspect,
and exercised the 390 × 844 minimap, pointer pedal, Reset, and persistent
scenery-failure path without horizontal overflow or scoped console/page errors.

A 120-frame stationary local sample measured 16.7 ms median and 17.1 ms at the
95th percentile. This is a short smoke sample, not a sustained or
representative-hardware performance guarantee. The reviewed artifacts are the
[desktop Ride frame](milestones/2026-09-13-street-quality.jpg),
[mobile Ride frame](milestones/2026-09-13-street-quality-mobile.jpg), and
[neutral browser asset preview](milestones/2026-09-13-street-quality-assets.jpg).

The production build emits a 78.51 KB main entry (26.92 KB gzip), a 630.17 KB
shared JavaScript chunk (159.38 KB gzip), a 3.06 KB preview entry (1.70 KB
gzip), 22.99 KB CSS (5.38 KB gzip), and the 2,879.94 KB saved GeoJSON artifact.
Vite's expected shared-output advisory above 500 KB remains.

## 2026-09-13 — Polished courier bicycle and rider

Status: implemented and verified in the current checkout; publication record
is pending.

The procedural gameplay bicycle now swaps to an original Blender-authored
courier bicycle and rider after its named hierarchy validates. The 1.3 MB GLB
is 0.69 m wide, 1.94 m high and 1.76 m long, with a 1.08 m wheelbase and 0.34 m
wheel radius. It contains 152 nodes, 127 meshes, 16 materials, 38,800 exported
vertices and 25,152 triangles. Its direct Principled base colours use no image
textures or external meshes.

The visual binds travelled distance to the wheels, steering to the front
assembly, and active pedalling to the crank, counter-rotating pedal platforms,
and contact-driven limbs. Hands resolve the steered grip anchors and feet
resolve the crank-mounted pedal anchors. Coasting, braking, Inspect and lost
input hold the crank pose. Controller physics and delivery behavior remain
unchanged. Invalid or failed loads keep the procedural bicycle usable, and a
persistent vehicle status reports the failure independently from scenery.

The isolated `bicycle-preview.html` entry supports Idle, Pedal, Coast, Steer,
Pause and Resume, Front, Side and Rear presets, orbit, zoom, and responsive
bounds-based framing. Production review completed the first 67 m keyboard job
for LKR 240, retained the completion after reload, switched through Inspect,
and passed the 390 × 844 minimap, touch Pedal, Reset and collapse flow without
horizontal overflow. An aborted model request kept the warning visible through
delivery actions and the fallback playable; reload restored the asset.

All 27 tests, strict TypeScript checking, the production build, and the
documentation diff check pass. Independent live-model checks measured zero
hand-to-grip and foot-to-pedal anchor offset across three steering angles and
five travel poses and confirmed that wheel travel continues while the crank
holds during coasting. Scoped application console warnings, errors, and page
errors were empty. The reviewed artifacts are the
[completed first-job Ride frame](milestones/2026-09-13-courier-bicycle.jpg),
[idle Side preview](milestones/2026-09-13-courier-bicycle-preview.jpg), and
[mobile frame after Reset](milestones/2026-09-13-courier-bicycle-mobile.jpg).

The build emits a 73.06 KB main entry (25.19 KB gzip), a 10.25 KB bicycle
visual entry (3.79 KB gzip), a 3.16 KB bicycle-preview entry (1.69 KB gzip), a
630.17 KB shared JavaScript chunk (159.38 KB gzip), and 23.35 KB CSS (5.43 KB
gzip). Vite's expected shared-output advisory above 500 KB remains. The
electric bicycle, 50 cc scooter, commuter motorbike, sport or superbike, car,
and van remain planned and are not present in an unlock or garage interface.

## 2026-09-13 — Courier character detail and appearance

Status: complete.

The courier now has a more legible original face, three selectable profile
roots, revised hair and clothing, detailed shoes and parcel bag, and ten small
deterministic neutral luminance maps embedded in the GLB. The current 2.1 MB
asset measures 0.69 × 1.96 × 1.76 m and contains 241 nodes, 213 meshes, 16
materials, 59,036 exported vertices, and 46,616 triangles. Its editable Blender
source is 423 KB, with no external mesh or texture inputs.

The responsive Rider studio offers Classic, Soft, and Angular faces and three
skin, hair, outfit, and bag palettes. Changes preview live and save explicitly
to a versioned browser record. The game loads that appearance automatically,
and its compact **Customize rider** link opens the studio. Mutable materials are
cloned per courier instance while immutable geometry and textures remain
shareable.

Production Chromium review at 1280 × 800, 390 × 844, and 390 × 600 passed all
five cosmetic selections, save and reload, the game/studio return path, the
first 67 m delivery, and retained LKR 240 progress without horizontal overflow.
Corrupt and unavailable storage fell back safely. A forced model failure kept
the procedural bicycle playable, did not block scenery, remained visible
through a save attempt, and recovered on reload.

All 29 tests, strict TypeScript checking, and the production build pass.
Artifact tests cover hierarchy, transforms, pivots, sole parentage, wheel size,
UVs, embedded images, face-root scale, and winding. Live checks across three
steering settings and five travel poses kept hand and foot attachment error
below 2.63 × 10⁻¹⁵ m and preserved wheel motion with a held coasting crank.
This verifies contact anchors rather than skin or cloth deformation.

The reviewed artifacts are the [Rider studio](milestones/2026-09-13-character-detail-studio.jpg),
[face close-up](milestones/2026-09-13-character-detail-face.jpg),
[completed-delivery game view](milestones/2026-09-13-character-detail-game.jpg),
and [mobile Rider studio](milestones/2026-09-13-character-detail-mobile.jpg). The
production build emits a 73.17 KB main entry (25.24 KB gzip), a 12.75 KB bicycle
visual entry (4.81 KB gzip), a 4.67 KB Rider-studio entry (2.24 KB gzip), 23.98
KB CSS (5.52 KB gzip), and a 630.17 KB shared JavaScript chunk (159.38 KB gzip).
The expected shared-output advisory remains.

The character remains a rigid-part articulated model with limited preset
customization. It has no skeletal skinning, facial animation, cloth or loose
hair simulation, free-form editor, or multiplayer behavior.

Delivered in commit
[`c4f013dabdf1cd815e9f22492cb4b05efa9c8c18`](https://github.com/theetaz/colombo-delivery/commit/c4f013dabdf1cd815e9f22492cb4b05efa9c8c18).

## 2026-09-13 — Teenage courier art direction

Status: concept and first reconstruction checkpoints exist locally; rig review,
runtime integration, and public-distribution rights confirmation are pending.

The rigid-part courier above remains a technical prototype rather than the
target hero character. The replacement direction begins with an original 2D
teenage courier concept package under `art/characters/teen-courier/concept/`:
a clear three-quarter standing direction, front/side/back turnaround, and six
expression references. The teal shirt, charcoal shorts, white shoes, youthful
proportions, face, and hair establish the first working direction. A manifest
records each image's dimensions, SHA-256 hash, and provenance. These images are
concept evidence, not a 3D model, rig, implemented expression set, or proof of
deformation quality.

The concept package is delivered in commit
[`b0944e8fd77643eddc5804d6f54821887998650a`](https://github.com/theetaz/colombo-delivery/commit/b0944e8fd77643eddc5804d6f54821887998650a).

The [character art pipeline](CHARACTER_ART_PIPELINE.md) defines the next bounded
path: documented third-party image-to-3D reconstruction, preserved raw source,
Blender cleanup and retopology, a skinned body and garment rig, a small facial
blend-shape set, skin/shirt/shoe customization, and validation of the actual
glTF in the Rider studio and production game. Multiplayer, other rider spawning,
and procedural population systems remain deferred.

The first Tripo API `P1-20260311` reconstruction used only the original project
concept. Its untouched 3,253,668-byte draft contains one static fused mesh and
material, 24,191 vertices, 17,681 triangles, and embedded 4096 px base-colour,
ORM, and normal maps, with no rig, animation, or morph targets. A first Blender
cleanup produces a grounded 1.62 m, +Y-up, -Z-forward review GLB with separate
skin, hair, shirt, shorts, and shoes material regions. It preserves the authored
4K PBR maps and adds an embedded 4096 px RGB mask for value-preserving skin,
shirt, and shoe hue/saturation controls.

A subsequent biped-rig result contains one skin and 60 nodes but no animation
clips. Its deformation, orientation, bicycle fit, and final use remain under
review. The separate `character-preview.html` inspection route loads the static
cleanup by default. It exposes Full body, Head, Side, Back, orbit, reversible
clay, and map-preserving Skin/Shirt/Shoes tints while hiding unsupported rig,
animation, and morph controls. Browser framing and clay review pass; the game
asset remains unchanged.
The first cleanup did not pass art review: unwelded smoothed UV seams opened
cheek cracks, material masks left jagged garment boundaries, and the shoe region
extended up the shins. Those repairs remain in progress, so structural and
framing checks must not be read as visual acceptance.

A normalized rig-review Blender source and GLB contain one skin, 58 bones, the
same 17,681 triangles, a 1.62 m grounded -Z-forward root, and no animation
clips. Deformation and bicycle fit still require review; the presence of a skin
does not establish their quality.

The static repair now passes first-draft face and authored-clothing review with
8,951 Blender vertices, 25,010 exported vertices, and 17,681 triangles. The rig
review found normalized weights and finite displacement, then an extreme elbow,
knee, and head pose exposed a hanging hand triangle from stray influences.
Removing stray right-foot weights from 572 hand vertices and renormalizing them
removed the flap when the same pose was repeated with finite joint motion. The
[browser rig-pose review](milestones/2026-09-13-teen-courier-rig-pose.jpg) is a
manual QA pose, not a stored animation or proof of complete weight painting or
bicycle fit. No facial morphs or expression-ready eye and mouth topology exist
yet.

Strong colour variants exposed wireframe-like seams along UV-island boundaries
that the default material and earlier checks hid. Mask padding removed the
major seam network; faint Deep-skin transitions and dark-shoe edge artifacts
remain known paint work rather than a shipping finish. Responsive desktop and
390 px layout checks pass.

Tripo's public API documentation does not identify an API-specific
output licence or attribution rule, and an API credit balance does not identify
the applicable account tier. Public distribution of the reconstruction remains
pending confirmation of the account plan and its terms.

All 31 tests, strict TypeScript checking, the production build, and the
documentation diff check pass. The character viewer entry is 9.08 KB (3.86 KB
gzip), with 644.17 KB shared JavaScript (163.17 KB gzip). Reviewed artifacts are
the [static reconstruction](milestones/2026-09-13-teen-courier-reconstruction.jpg),
[face](milestones/2026-09-13-teen-courier-face.jpg),
[colour variants](milestones/2026-09-13-teen-courier-colors.jpg),
[mobile viewer](milestones/2026-09-13-teen-courier-mobile.jpg), and
[bounded rig pose](milestones/2026-09-13-teen-courier-rig-pose.jpg).

## Archived 2026-09-13 project snapshot

This section records the main delivery app at the earlier September 13 character-study checkpoint.
It is retained as historical context; the later standalone road and movement
study is recorded in the September 15 milestones below.

The repository contains the product definition, Stage 1 audit pipeline, first
browser-rendered 3D road prototype, first controllable bicycle, and bounded
practice delivery loop. The bicycle
uses custom assisted kinematics in the same 900 × 900 m Lotus Tower slice, with
pedal, coast, brake, steer, road and grass handling, a following camera, marked
training obstacles, world-boundary collisions, reset, and the preserved source
inspector. The delivery exercise adds timed pickup and drop-off actions, fixed
practice rewards, and local aggregate persistence. Ride mode also shows the
shared road slice, live bicycle heading, and practice-stop phase in its compact
north-up minimap. See the
[minimap prototype report](MINIMAP_PROTOTYPE.md) for its behaviour and limits,
the
[delivery prototype report](DELIVERY_PROTOTYPE.md) for its exact behavior and
limits, the [bicycle prototype report](BICYCLE_PROTOTYPE.md) for its spawn,
controls, tuning, and validation, and the
[road prototype report](ROAD_PROTOTYPE.md) for the underlying geometry and
source contract.

The current-checkout production image is the
[character-detail Ride screenshot](milestones/2026-09-13-character-detail-game.jpg).
The earlier [bounded practice delivery screenshot](milestones/2026-09-13-delivery-prototype.jpg)
remains available with its milestone record.

The normal current static audit preview remains
[the repository SVG](maps/lotus-tower-road-audit.svg); unlike the commit-pinned
image above, that relative link follows the current checkout.

The interactive preview is an offline HTML artifact, not a hosted game. GitHub
shows its source. To inspect the current checkout, run this from the repository
root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs/maps
```

Then open
[http://127.0.0.1:4173/lotus-tower-road-audit.html](http://127.0.0.1:4173/lotus-tower-road-audit.html).
That address works only while the local server is running.

## Archived 2026-09-13 next milestone — Visual and practice review

The following was the bounded next-step list at that checkpoint. Later study
work did not by itself complete these main-game validation tasks.

Keep the minimap's practice status visible until mode-aware legal routing and
field validation exist. Review its input and readability on physical devices
and other browsers alongside longer-ride performance work.

Continue art polish from hands-on feedback and measure runtime performance on
representative hardware over longer rides. Keep checking the relationship among
asset scale, road and marker readability, the following camera, and input feel.

Review the complete three-job sequence in the production build, including
pickup and drop-off actions, timeout and retry, reset cancellation, pause
semantics, reward persistence, reload, and storage fallback. The remaining
bicycle checks still include longer physical-device riding, physical
multi-touch, both marked training obstacles, and the world boundary.

Separately, manually verify candidate entrances, safe and legal stopping
positions, bicycle access, and the first complete route before turning practice
markers into destinations or straight-line guidance into navigation. Routing,
traffic, and economy progression remain later systems.

## 2026-09-13 — Static Courier Studio customization portal

- Defined a typed starter catalog covering faces, hair, tops, bottoms, shoes,
  sunglasses, necklace, and watch, with independent `none` accessory choices.
- Added a richer manifest contract so the portal only exposes known equipment
  that the loaded asset declares preview-ready. Rig-ready and game-ready remain
  separate manifest states.
- Added five named color palettes plus validated custom `#RRGGBB` colors and a
  versioned local saved-look record with safe malformed and unavailable-storage
  fallbacks.
- Delivered 21 choices: 18 visible face, hair, clothing, shoe, and accessory
  items plus independent `none` choices for sunglasses, necklace, and watch.
- Accepted the starter static GLB at 6,453,452 bytes, 84 nodes, 54 meshes, 71
  primitives, 12 materials, 16 textures, four embedded images, 83,658 exported
  vertex instances, and 60,303 triangles, with 21 transparent thumbnails.
- Reused the approved RGB atlas mask on all source materials and limited whole
  hair/bottom recoloring to the corresponding item ancestry. A hair-only browser
  comparison recorded no change in either iris, the mouth, cheeks, or shirt
  while confirming a visible fringe change.
- Exercised all 21 runtime choices, exact slot visibility, invalid-option
  preservation, per-avatar material isolation, and independent disposal.
- Kept the catalog as a review candidate. Multiplayer, inventory progression,
  game-rider replacement, and final wardrobe approval remain outside this
  milestone.
- Recorded remaining localized trouser joins, the older shirt-hem surface, and
  dark-shoe UV-mask seams as art refinement rather than presenting the starter
  portal as a production rig or finished wardrobe.
- Passed the production portal at 1440 × 1000 and 390 × 844 without overflow,
  JavaScript exceptions, or scoped console errors. Save/reload, independent
  accessory removal, draft-only Reset, corrupt JSON, blocked storage, missing
  manifest retry, the existing game load, all 39 tests, and the build passed.
- Saved reviewed [desktop](milestones/2026-09-13-courier-studio-desktop.jpg),
  [Face](milestones/2026-09-13-courier-studio-face.jpg),
  [outfit](milestones/2026-09-13-courier-studio-outfit.jpg), and
  [mobile](milestones/2026-09-13-courier-studio-mobile.jpg) frames.

## 2026-09-13 — Continuous full-length courier trousers

- Rejected the overlapping cut-short construction after production views
  exposed upper-thigh tube lips, knee bands and slits, and a jagged waist.
- Reusing and merging the source shorts and skin remained fragmented and
  cropped. Rebuilt the option from fitted volumes smoothed before voxel union,
  producing one connected waist-to-ankle garment with no open boundary edges
  through the thigh and knee range. The final static catalog is
  7,967,904 bytes with 83 nodes, 53 meshes, 70 primitives, 12 materials, 16
  textures/four images, 125,286 exported vertex instances, and 144,207
  triangles; SHA-256 is `7a2515972060d8e1011a69629196b8d6b339f14c353c4c83a65712002fe7701b`.
- Moved the preserved lower-leg skin under the Shorts item with a source-tint
  opt-out. The first partition captured inner-forearm triangles; narrowing it
  below 0.7 m removed the arm holes. Geometry tests require one welded garment,
  waist/ankle coverage, no mid-leg boundary, and the bounded skin partition.
- Browser pixel comparisons retained the upper body exactly in the trouser
  back view, changed no calf pixels for Navy bottoms, and changed 3,459 calf
  pixels for Golden skin. Trousers plus Navy, Golden skin, and High-tops
  persisted across browser reload; all three shoe cuffs passed side review.
- Passed all 41 tests, the production build, and 1440 × 1000 and 390 × 844
  browser checks without JavaScript/scoped console errors or horizontal
  overflow. The static catalog remains unrigged; old shirt-hem and dark-shoe
  paint refinement remain.
- Saved reviewed [front](milestones/2026-09-13-trousers-fit-front.jpg),
  [side](milestones/2026-09-13-trousers-fit-side.jpg),
  [back](milestones/2026-09-13-trousers-fit-back.jpg), and
  [mobile](milestones/2026-09-13-trousers-fit-mobile.jpg) frames.

## 2026-09-13 — Studio-to-Blender artist bridge setup

- Installed and enabled Tripo Bridge 1.0.32 in Blender 5.1.2 and verified
  the Blender-side handshake and heartbeat response. The complete Tripo Studio
  DCC Bridge connection remains to be verified using the
  [official guide](https://www.tripo3d.ai/blog/tripo-dcc-bridge-for-blender).
- This prepares a future artist flow from Tripo Studio reconstruction into a
  controlled Blender cleanup scene and then to a browser-verified glTF export.
  The transferred source will be preserved and its mesh and materials checked
  before cleanup continues.
- No model transfer, import, generation request, or credit use
  occurred. This tooling milestone does not change the current courier,
  trousers, rig status, or remaining garment refinement.
- The next garment pass should refine cuff thickness and restrained fold/seam
  detail, fit all three shoe options, and review the exported GLB in browser
  front, side, back, and mobile views.

## 2026-09-13 — Natural woven-trouser refinement

Status: implemented and verified.

The continuous full-length trouser milestone above solved the open thigh and
knee gaps, fragmented joins, and lower-leg visibility errors. Review of that
closed shell then exposed a different set of fit problems: the pelvis was
ballooned, the crotch hung too low, the legs read as featureless pipes, and the
rounded closed cuffs did not meet the shoes like a believable woven garment.
Those shortcomings remain part of the public record rather than being folded
into the earlier structural repair.

The [customizer before view](milestones/2026-09-13-trousers-natural-before.jpg)
captures that starting point. Browser export also
caught and rejected a candidate with missing hip faces and leg slits before the
final topology was accepted.

The approved low-resolution foundation isolates the connected component of the
authored shorts, containing 245 vertices and 440 faces. This preserves its
natural waist, hips, seat, and crotch, then extends the two real hem loops
through six connected tapered rings to the ankle. Slight asymmetric knee and
cuff shifts, connected inset hem rims, a waistband stitch, flat fly, pockets,
and restrained knee and ankle creases give the woven garment a readable shape.
The finished surface uses recalculated normals, one subdivision level, and a
1.2 mm bevel.

The final ankle correction moves the necessary low original geometry from the
always-visible body into the Shorts-only lower-body group alongside its skin,
with source tint preserved. Trousers therefore hide it while Shorts restore it;
all three shoe-item meshes remain untouched. The frozen browser GLB is
6,609,268 bytes with SHA-256
`3298dc6476dfee603dc9b90e081a5789d00fc7bddcfba370349abcdfd55ee31f`.

Production browser review at 1440 × 1000 and 390 × 844 passed front, side, back,
and mobile views without hip holes, leg slits, exposed ankle wedges, console
warnings, console errors, or an error overlay. Canvas, Runner, and High-top
shoes remained intact with both Trousers and Shorts. Charcoal-to-Olive trouser
recoloring preserved the upper body. All 41 tests and the production build pass.
The static garment remains unskinned and has not been deformation-tested on the
bicycle; its solid-color detail geometry has no baked fabric texture.

Reviewed frames: [front](milestones/2026-09-13-trousers-natural-front.jpg),
[side](milestones/2026-09-13-trousers-natural-side.jpg),
[back](milestones/2026-09-13-trousers-natural-back.jpg), and
[mobile Olive recolor](milestones/2026-09-13-trousers-natural-mobile.png).

## 2026-09-13 — Insulated delivery backpack and teenage bicycle rider

Status: playable prototype implemented and browser verified.

Modeled an original insulated delivery backpack in Blender and added it as an
independent piece of equipment in the character studio. The teal fabric body,
ochre lid, closures, reflectors, padding, and fitted shoulder harness retain
separate materials. The bag can be equipped, removed, and recolored without
replacing the approved character or wardrobe. Existing saved looks migrate in
memory to version 2, keeping their previous choices and no bag equipped.

The standing fit passed browser front, side, rear, removal, and recolor checks,
including a 390 × 844 mobile viewport. Review rejected a protruding zipper,
rear-only straps, and a floating rectangular harness before measuring the
shirt surface for the final wrap. The standalone browser asset has 4,964
triangles and occupies 307,884 bytes.

The bicycle pass reuses the existing Blender vehicle and preserves the approved
teen's textured mesh. Review exposed shoulder tears, unreachable grips, and
twisting shoes in the previous skeleton. A compact skeleton, forward seated
posture, and separate foot orientation address those defects. Level shoes
still hovered above the pedals in an intermediate export, showing why contact
markers must come from visible mesh surfaces rather than desired targets.
Browser loading also exposed colon sanitization in joint names; a real-loader
regression now checks the names used by the animation solver.

Front review then caught sideways knees that the side view concealed. Knee
plane calibration keeps each knee on its own side throughout the cycle. Full
steering exposed inverted wrists and long finger triangles; an anatomical
two-bone arm solve, surface-based palm markers, bounded influence cleanup, and
a continuous wrist weight transition corrected those failures. The resulting
19-bone rider and fitted harness are inspectable in the main game and preview.

All 54 tests and the production build pass. Final production review covered
front, side, rear, close-up steering, coast, equipment removal/replacement,
mobile layout, and actual missing-rider fallback/recovery. The full-lock
palm-center miss remains at most 33.749 mm; finger articulation and fine grip
closure remain explicit later refinements. The existing large shared chunk
warning remains.

The [equipment report](RIDER_EQUIPMENT.md) records construction, reproducible
Blender commands, the animation contract, and the customization boundary. The
standing modular wardrobe remains unskinned; this riding pass uses the approved
base outfit with independent backpack selection and color.

Reviewed backpack frames: [front](milestones/2026-09-13-delivery-backpack-front.jpg),
[side](milestones/2026-09-13-delivery-backpack-side.jpg),
[rear](milestones/2026-09-13-delivery-backpack-back.jpg), and
[mobile](milestones/2026-09-13-delivery-backpack-mobile.png).

Reviewed riding frames: [front](milestones/2026-09-13-delivery-rider-front.jpg),
[side](milestones/2026-09-13-delivery-rider-side.jpg),
[rear](milestones/2026-09-13-delivery-rider-back.jpg),
[mobile](milestones/2026-09-13-delivery-rider-mobile.jpg), and
[Colombo game](milestones/2026-09-13-delivery-rider-game.jpg).

Future completed milestones will be appended here in delivery order with their
date, outcome, preview or artifacts, validation, remaining limitations, and
implementation commit. Artifact links will use that commit hash rather than a
moving branch link.

## 2026-09-13 — Standalone commuter bicycle approved; stationary rider fit started

Status: bicycle-only model human-approved at its frozen hash; stationary rider
fit awaiting separate human review.

Final human review rejected the earlier detailed rider's inverted wrists,
clothing distortion, saddle fit, and grip presentation despite its passing
engineering checks. That result remains historical prototype evidence.

The replacement starts from a mechanically defined commuter bicycle without a
rider and leaves the existing game untouched. Human bicycle approval comes
first, followed by stationary rider fit, controlled pedalling, steering poses,
and simulation binding. Structural checks validate the export contract;
automated screenshots and pixel scoring are not acceptance gates. See
[Commuter bicycle rebuild](BICYCLE_REBUILD.md).

The first review export is 529,760 bytes and 13,844 triangles. It uses a 1.093 m wheelbase, 69.5° head angle, 0.045 m perpendicular fork rake, and named mechanical pivots. Structural validation passed; no render-based acceptance was performed.

The standalone `bicycle-model-review.html` viewer provides camera presets,
independent wheel/crank controls, steering, and local feedback notes. All 58
tests and the production build pass. On 2026-09-13, the user approved the
bicycle and asked to move the character onto it. That approval is bound to GLB
SHA-256
`ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`;
future generator output returns to `awaiting-human-review` until its hash is
approved separately.

Stage 2 now fits the unchanged detailed teenage courier to the frozen saddle,
grip centreline references, and pedal surfaces in a single stationary pose. A
uniform 1.08 scale produces a 1.7496 m rider while preserving the source
proportions; per-bone and
nonuniform scaling remain excluded. Measured patch-to-anchor residuals and
structural checks support the review but do not establish visual quality or
grip-surface clearance. No pedalling, steering-pose animation, bag, or physics binding proceeds
until the user approves this separate [stationary rider fit](RIDER_FIT.md).

Independent numeric review held the first stationary export before human
handoff. The terminal-hand IK and wrist-orientation controls competed, and the
pelvis marker did not yet isolate the posterior sitting patch. The frozen
candidate separates the arm solve from explicit wrist orientation and measures
the posterior support patch.

The frozen review GLB is 3,260,140 bytes with one mesh, seven nodes, no skin or
animation, and identity root. The approved bicycle and seatpost remain
unchanged. Its patch-to-target residuals are 13.546 mm at the posterior
pelvis/saddle-centre reference, 21.074 and 30.304 mm at the radius-adjusted grip
tops, and 1.192 and 4.687 mm at the pedal tops. The palm misses remain above
20 mm and need visual judgment. Individual limb lengths remain within `8.81e-7`
of their uniformly scaled rest values. The candidate GLB SHA-256 is
`01a52f9343bf605f7510f1d4be4d7ac9368942d11bcca52679f92d45201107d3`.

The `/rider-fit-review.html` route loads the candidate and frozen bicycle at
identity for short human inspection. Its camera presets, rider visibility
toggle, and local notes support that decision without animation, screenshots,
or computer-vision scoring. All 58 tests, strict TypeScript checking, the
production build, and documentation diff check pass. Node textured-asset tests
emit expected blob texture-decode warnings outside a browser, and Vite retains
its expected large shared-chunk advisory. Status remains
`awaiting-human-review`; the 21–30 mm palm residuals remain a visible refinement
question for the user's quick review.

## 2026-09-13 — Stationary rider deformation rejected

Status: revision 2 was prepared for human review and then rejected.

Human review rejected the stationary rider because its torso collapsed into a
large triangle and the waist separated. Earlier identity, contact-marker,
knee-plane, and limb-length checks passed but did not measure deformation of the
visible skin surface. The rejected export's longest world-space triangle edge
reached 0.371312 m. The upright source maximum is 0.195273 m, or 0.210895 m at
the approved 1.08 uniform scale. The repair uses a 0.220 m exported-edge cap
while preserving the approved bicycle.

The new [seated pose guide](../public/references/rider-fit/seated-pose-guide-v2.png)
is an artistic reference only. No animation work begins until the repaired
static mesh passes human review.

An interim `be9bcd7c…` repair corrected the displaced torso pivot, but its
35.0655° hip-to-shoulder lean concealed 91° of cumulative local trunk rotation
and left the head looking down. It was held from handoff while separate back,
neck, and gaze measurements were added.

### Stationary rider revision 2 repair

The corrected world-pivot transform keeps the torso bone head fixed instead of
injecting armature translation into the rotation. Stable torso and hand weights
also account for the provider rig's misleading bone names: `tripo::Head_0` is
lower trunk, `bone_3` carries the shirt, and `bone_4` is the neck transition.

The final distributed pose measures 30.9243° hip-to-shoulder lean, segment
pitches of 21.82°, 36.76°, and 54.35°, and a face gaze 13° downward. Its static
GLB is 3,260,968 bytes at SHA-256
`9c8a9645aa63c9c3a009c690b73806aa8ebf6a1b0a2655d60e4b5434089dcf71`.

Its maximum exported world-space triangle edge is 0.203747 m, below the 0.220 m
cap and the 0.210895 m scaled-upright reference. Palm point residuals are zero;
pedal residuals are 2.240 and 5.033 mm. The earlier 20.76 maximum strain was
localized to the central neck: a 3.424 mm source edge stretched to 71.085 mm
where a hard torso mask replaced legitimate neck and head weights. A continuous
weight fade reduces it to 7.061 mm, or 2.062×. Final neck strain is p99 2.0182
and maximum 2.0711; whole-mesh maximum strain is 9.354 at a small ankle seam.
Zero palm residual does not certify full hand-to-grip clearance. The approved
bicycle remains unchanged, no animation is present, and human approval is
pending.

### Clean-rig upper-body reset

Human review rejected the full-body stationary result even after its known
surface checks passed. Character work returned to a newly constructed rig that
preserves the original face, hair, and UVs without reusing the provider's old
weights. The 8,951-vertex cleanup mesh contains 14 disconnected components, no
exact-position duplicates, and real shoulder/sleeve gaps around 7–8 mm; the old
seam-sync pass changed zero vertices. The replacement records explicit seam
boundary correspondences, uses smooth weights, and locks face/hair rest IDs.
The new `/character-rig-review.html` checkpoint compares the original standing
model, a new neutral rig, and one forward lean. Review is limited to the head,
torso, and shoulders; hands and legs remain neutral, and bicycle mounting,
full-body fitting, and animation were blocked pending human acceptance. No
retopology, manifold, or automatic quality claim is made.

The export audit found that a skinned lean with no animation reopened at rest,
so the browser lean became an explicit evaluated static bake. It also replaced
a stale head label that omitted chin and mouth membership. A later shading
check found that copying evaluated normals changed some rigid chin and upper
neck normals by about 10°; the final bake transforms original neutral split
normals with the rigid head and checks actual exported triangle corners. Human
appearance approval remained pending at that handoff.

Human review rejected clean-rig checkpoint 1 after those engineering checks
passed. Its model files remain preserved in commit `26b0828`; numeric validation
did not constitute visual approval.

## 2026-09-14 — Clean-rig revision 2 repair and source audit

A source audit after checkpoint 1 found that a broad Blender Z-below-0.70 m
assignment crossed anatomical components, attached lower hand vertices to leg
bones, and produced hand-region edge strain up to 11.87×. The rigid head also
met the deforming neck at an abrupt boundary with 8.2× edge strain. Revision 2
replaces the height rule with anatomical component membership and smooth
neck-ring weights. The attempt kept arm edges near 1.0× and the known neck edge
at 1.0×, but moved strain to the constraint boundaries; full triangle-edge
strain ranged from 0.588865× to 2.096243×. Revision 2 failed engineering review
and is not a human-review candidate. Further parameter tuning stopped because
the transition requires a deformation-energy solve or source-authored weights.
Full bicycle fit and animation remain blocked.

One isolated deformation-cage prototype then preserved neutral geometry and
the rigid head and arms but failed at the cage/neck interface, with triangle-
edge ratios from 0.097824× to 10.306895×. It remains under
`art/characters/teen-courier/cage-rig/` for diagnosis and is not review-ready.
Trials stopped with the continuous torso/neck/head and disconnected-part
interface unresolved. The public viewer continues to show rejected checkpoint
1; the approved original face and bicycle remain unchanged.

The same day, the character workflow was checked against the
[Paper Route development archive](https://www.paperroute.lol/devlog/). The audit
corrected the documented evidence boundary and next step: it did not establish
that the rejected clean-rig character was usable, and it did not approve a new
hero character. The correction is preserved in
[`901c60f`](https://github.com/theetaz/colombo-delivery/commit/901c60f05be34254e51446e24f1d8fbdead9b093).

## 2026-09-15 — Standalone study baseline preserved

Status: standalone baseline preserved; no main-game integration claimed.

The first study checkpoint preserved a separate 1.8 × 1.8 km Colombo road
asset, map review, and small car delivery pilot alongside a separate cyclist
studio and walk/ride courtyard. This was a larger geographic study than the
main delivery app's 900 × 900 m bicycle slice. Its car pilot, cyclist pages,
and assets were inspection previews inside the study, not replacements integrated
into the main game.

At this pre-consolidation commit the artifacts lived at repository-root paths:
[study handover](https://github.com/theetaz/colombo-delivery/blob/8365b9e/README.md),
[movement notes](https://github.com/theetaz/colombo-delivery/blob/8365b9e/cyclist/MOVEMENT.md),
and [viewer guide](https://github.com/theetaz/colombo-delivery/blob/8365b9e/viewer/README.md).
Delivered in
[`8365b9e`](https://github.com/theetaz/colombo-delivery/commit/8365b9e).

## 2026-09-15 — Walking checkpoint approved and preserved

Status: walking approved at the frozen asset checkpoint; approval does not
extend to later bicycle transitions or the rejected main-project clean rig.

The study's upright procedural walk progressed through contact, posture,
continuity, and rebound corrections. Human approval is bound to the walking
asset produced by
[`705a404`](https://github.com/theetaz/colombo-delivery/commit/705a404),
with the approved browser evidence preserved by
[`88e5bca`](https://github.com/theetaz/colombo-delivery/commit/88e5bca).
The current consolidated copy of that evidence is the
[approved walking gallery](../studies/colombo-road/docs/visual-history/2026-09-15-walk-approved/README.md).

## 2026-09-15 — Bicycle transition study and leg correction

Status: transition study implemented; the corrected `939c56b` revision was
human-approved on 15 September 2026.

[`7ec7367`](https://github.com/theetaz/colombo-delivery/commit/7ec7367)
added the reference-guided mounting and dismounting study while preserving the
approved walking and pedaling tracks. The first transition gallery remains
[available in the consolidated study](../studies/colombo-road/docs/visual-history/2026-09-15-bicycle-transitions/README.md).

[`939c56b`](https://github.com/theetaz/colombo-delivery/commit/939c56b)
then corrected the knee hinge, rear leg sweep, support steps, and shoe alignment.
Its [leg-correction gallery](../studies/colombo-road/docs/visual-history/2026-09-15-bicycle-leg-correction/README.md)
and automated checks document the revision. Human approval applies to this
leg-corrected checkpoint, not to the rejected first pass.

## 2026-09-15 — Colombo road and movement study consolidated

Moved the complete standalone road and animation study into
[`studies/colombo-road`](../studies/colombo-road/README.md), preserving its 11
development commits through `939c56b`, source map data, Blender projects, GLBs,
reference images, and 37 browser screenshots. The
[visual history](../studies/colombo-road/docs/visual-history/README.md) retains
the approved walking milestone and both bicycle transition milestones in order.

The study runs independently on port 5175 through `npm run study:dev` from the
repository root. Its dependency lockfile and asset-relative paths are preserved.
The main delivery app and its character experiments remain available through
the existing commands. The imported study's rider and animation review do not
change the rejected status of the separate clean-rig experiments above.

The latest animation revision corrects the knee hinge, rear leg sweep, support
steps, and shoe alignment during mounting and dismounting. The previously
approved walking and pedaling clips are preserved; human review approved the
revised Mount and Dismount clips at `939c56b` on 15 September 2026.

Delivered in
[`80270cb`](https://github.com/theetaz/colombo-delivery/commit/80270cb).

## 2026-09-15 — Textured streets and original building families

Status: implementation and automated validation complete; human visual review
pending.

The first-district viewer gained a deterministic street-art layer with a
metre-scaled procedural asphalt texture, 6 m repeat, matte finish, fine bump,
warm bounded shadows, and inferred white centre/lane treatments. The
inference reads the bundled OSM lane count, road class, direction, tunnels,
roundabouts, conditional tags, and graph junctions. It leaves junction gaps
and does not create stop lines, give-way lines, pedestrian crossings, boxes,
turn arrows, bus lanes, or cycle lanes. A separate teal overlay communicates
inferred left-hand traffic flow and is not presented as real road paint.
Source and Dressed controls compare the pass with the exact original materials
and building triangles. A dedicated camera frames the Vauxhall study area, and
`#street` opens that preset directly.

Six original Blender families are available to dress retained source building
sites: heritage shop, town house, corner shop, courtyard house, mixed use, and
apartment. Twelve high-confidence replacements use four families at uniform
scales from 0.8301 to 1.0458; the town-house and apartment forms did not safely
fit the selected source sites. Stable source-ID choices vary family and palette.
Exact source-polygon containment, road/water/building clearance, source base
height, road-facing orientation, and a local family-repeat guard all pass their
independent placement audit with zero failures.
Named and institutional buildings are excluded so the existing Colombo
landmarks remain separate. The editable source, generator, GLB, manifest, and
placement data are documented in the
[street art study](../studies/colombo-road/streets/README.md).

The treatment is an authored geographic study rather than a survey of current
paint or facades. Line dimensions and asphalt appearance are visual defaults;
missing OSM direction data is still a routing assumption rather than proof of
a two-way marked road. Human review remains the acceptance check for scale,
repetition, overlaps, road readability, and landmark context.
All 46 viewer tests and the production build pass. Browser controls and the
existing Drive pilot load without console warnings or errors; the approved
movement, rider, bicycle, geographic model, and road-network files retain their
original hashes.
