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

## Current state

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

## Next bounded milestone — Visual and practice review

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

Future completed milestones will be appended here in delivery order with their
date, outcome, preview or artifacts, validation, remaining limitations, and
implementation commit. Artifact links will use that commit hash rather than a
moving branch link.
