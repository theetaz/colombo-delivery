# Vehicles and progression

> **Current visual status:** The earlier bicycle and rider passed engineering checks but failed final human review for bicycle proportions and components, inverted wrists, clothing distortion, saddle fit, and grip presentation. [Commuter bicycle v2](BICYCLE_REBUILD.md) is the replacement art track.


## Purpose and current status

Colombo Delivery begins with a bicycle and should grow into a small fleet whose
vehicles suit different jobs rather than form a simple ladder of replacements.
The current checkout implements bicycle gameplay and its polished
Blender-authored courier bicycle and rider. Its runtime hierarchy, animation
contract, export measurements, and production evidence are recorded below.

The electric bicycle, 50 cc scooter, commuter motorbike, sport or superbike,
car, and van are product plans only. They do not exist in the current garage,
cannot be purchased or equipped, and do not change the current delivery loop.
Prices, running-cost values, capacity thresholds, unlock conditions, and
performance tuning remain to be balanced.

## Fleet roles

| Vehicle | Intended delivery role | Cargo direction | Running-cost direction | Reason to keep it useful |
| --- | --- | --- | --- | --- |
| Bicycle | First-mile practice and light local deliveries | Small parcels and a rider-carried bag | Lowest routine cost; exact maintenance model TBD | Simple handling, low operating burden, and suitability for short jobs |
| Electric bicycle | Frequent light deliveries with assisted acceleration | Small parcels, with a possible rack or larger bag | Electricity, battery wear, and maintenance values TBD | Easier repeated trips while retaining bicycle-scale handling |
| 50 cc scooter | Compact powered option for regular urban delivery work | Small to medium parcels | Fuel, service, and wear values TBD | Practical cargo support and approachable powered handling |
| Commuter motorbike | General-purpose powered delivery vehicle | Medium parcels and secure mounted cargo | Higher fuel, service, and wear than the compact options; exact values TBD | Balanced everyday capacity and handling |
| Sport or superbike | Specialist high-performance vehicle | Light or compact cargo; capacity should remain constrained | High purchase and running-cost direction; exact values TBD | Distinct handling and enthusiast progression without becoming the best cargo vehicle |
| Car | Weather-protected multi-parcel work | Larger parcels or several smaller parcels | Fuel or energy, service, parking, and wear values TBD | Capacity and weather protection for jobs unsuited to two-wheelers |
| Van | Bulk and large-parcel work | Largest planned parcel and batch capacity | Highest routine operating burden; exact values TBD | Required for bulky or multi-stop loads that smaller vehicles cannot carry |

These roles do not assert legal vehicle classifications, licence requirements,
road access, or speed limits in Sri Lanka. Those rules must be researched and
implemented from authoritative current sources before they affect routing,
jobs, or player guidance.

## Progression principles

Unlocking a new vehicle should expand available work without making every
earlier vehicle obsolete. Job selection can preserve useful trade-offs through
parcel dimensions and weight, number of parcels, mounting needs, operating
cost, weather exposure, handling, and the verified route environment.

The economy should compare job reward with purchase, energy or fuel, service,
wear, and upgrade costs. No production prices or reward multipliers are set by
this document. They require playtesting against verified route lengths and the
implemented handling model. A fast or expensive vehicle should not receive a
universal reward advantage, and a larger vehicle should not be required for a
parcel that safely fits a smaller one.

Useful upgrade families may include tyres, brakes, lights, cargo racks or
boxes, battery components, reliability, and cosmetic finishes. Each upgrade
needs a clear gameplay effect, compatibility rules, persistence behavior, and
an explicit price before implementation. Upgrades must not imply unverified
safety, legal access, or real-world vehicle specifications.

## Shared vehicle asset contract

Every production vehicle asset should use the same world and animation
conventions so the controller, camera, cargo, preview, and later garage can bind
to data rather than one-off mesh assumptions:

- one Three.js world unit represents one metre;
- the imported asset is Y-up and declares its forward axis;
- the vehicle root origin sits on the ground plane at a documented longitudinal
  reference point;
- wheel radii, wheelbase, track width, and total bounds are measured from the
  exported asset rather than inferred from visual scale;
- each wheel has a named pivot at its axle centre and a documented spin axis;
- steerable assemblies have named pivots and a documented steering axis;
- the seat, left and right grips, left and right pedals or footrests, rider
  pelvis, and cargo mount expose named contact anchors;
- pedal anchors rotate with the crank where a vehicle uses pedalling;
- the cargo mount defines the stable attachment transform for a parcel bag,
  rack, box, or larger vehicle cargo representation; and
- visual bounds and decorative meshes do not silently change the controller's
  collision shape, handling, or road classification.

Future assets should follow the reviewed contract unless a vehicle type needs
a documented extension.

## Courier bicycle asset contract

The current Blender export is loaded from `models/courier_bicycle.glb`. Its
root is `CourierBicycle`, authored in metres with Y up, forward along local -Z,
and its origin at ground contact. The reviewed wheelbase is 1.08 m and both
wheels use a 0.34 m radius.

The required runtime hierarchy is:

- `RearWheel` has its axle pivot at `(0, 0.34, 0.54)` and spins around local X;
- `FrontAssembly` begins at `(0, 0, -0.54)`, steers around local Y, and contains
  `FrontWheel` at `(0, 0.34, 0)`, which spins around local X;
- `Crank` begins at `(0, 0.45, 0.06)`, rotates around local X, and contains the
  required `Pedal_L` and `Pedal_R` platform drivers; those nodes contain `Pedal_L_Attach` at
  `(-0.10, 0.18, 0)` and `Pedal_R_Attach` at `(0.10, -0.18, 0)` respectively;
- `FrontAssembly` contains `Grip_L_Attach` at `(-0.22, 1.04, 0.13)` and
  `Grip_R_Attach` at `(0.22, 1.04, 0.13)` so the contact points follow steering;
- the root exposes `Seat_Attach`, `Cargo_Attach`, `Shoulder_L_Attach`,
  `Shoulder_R_Attach`, `Hip_L_Attach`, and `Hip_R_Attach`; and
- the animated rider nodes are `UpperArm_L`, `UpperArm_R`, `Forearm_L`,
  `Forearm_R`, `Rider_Thigh_L`, `Rider_Thigh_R`, `Rider_Shin_L`,
  `Rider_Shin_R`, `Hand_L`, `Hand_R`, `Foot_L`, and `Foot_R`. The arm and leg
  driver segments are centred unit-Y meshes.

The controller remains unchanged. The visual maps controller heading to the
asset root with the -Z-forward convention, wheel travel to both wheel pivots,
and steering to `FrontAssembly`. Crank and leg motion advances only while pedal
input is held; coasting and braking hold the current crank pose. Hands and arms
resolve the steered grip transforms, while feet and legs resolve the rotating
pedal transforms. Cargo attaches through `Cargo_Attach`.

The procedural visual remains available until the asynchronous GLB load and
required-node validation succeed. A missing or invalid asset keeps that
fallback active and reports a visible load failure. Disposal guards late loads
and releases unused resources. The isolated `bicycle-preview.html` route uses
the same runtime visual with Idle, Pedal, Coast, and Steer controls plus orbit
and zoom. Final export size, mesh counts, screenshots, and production-browser
results will be added only after review.

The runtime also loads `models/teen_courier_riding.glb` as the detailed rider
and binds its hands and feet to the bicycle contact anchors. This
rider uses the approved base face, hair, crew tee, shorts, and canvas shoes.
The static wardrobe's alternate faces, garments, shoes, and accessories are not
skinned riding variants and are not transferred onto this rig. The standalone
insulated backpack follows the rider's `Backpack_Attach` node. The pedal cycle
and browser fit passed prototype review; the procedural courier remains the
usable fallback if the detailed rider cannot load. The
[equipment report](RIDER_EQUIPMENT.md) records the 54 passing tests, fitting
lessons, screenshots, and remaining full-lock palm drift and finger detail.

## Implemented bicycle behavior

The existing bicycle controller remains the gameplay authority for spawn,
pedal acceleration, coasting, braking, steering, road and grass response,
world-boundary collision, training-obstacle collision, reset, and delivery
state. Replacing the procedural visual with a Blender-authored bicycle and
rider must not change those rules by accident.

The visual layer may bind wheel spin, front steering, crank and pedal rotation,
and rider contact animation to controller state. It must retain believable
hands at the grips and feet at the pedals, keep cargo attached to the reviewed
mount, and dispose loaded resources safely. A failed visual load must remain
visible and must not silently corrupt the delivery session.

The validated export measures 0.69 m wide, 1.96 m high, and 1.76 m long. It
contains 241 nodes, 213 meshes, 16 glTF materials, 59,036 exported vertices,
and 46,616 triangles in a 2.1 MB GLB; the editable Blender file is 423 KB. The
palette combines glTF-safe Principled base colours with ten embedded,
deterministic 64 px neutral luminance maps. The geometry, materials, and maps
are original procedural project artwork with no external meshes or textures.
The generated four-view contact sheet keeps every copy at scale 1 and changes
only camera composition.

The current courier also supports limited saved face and palette presets while
preserving this hierarchy. Their provenance, material-isolation rules,
responsive review, and articulated-model limits are recorded in the
[courier character study](CHARACTER_STUDY.md).

The reviewed production build completed the first 67 m keyboard delivery,
awarded LKR 240 once, retained LKR 240 and one completion after reload, and
passed Inspect and Ride switching. At 390 × 844 the expanded minimap, held
Pedal, Reset, and collapse interactions remained usable without horizontal
overflow. The isolated preview passed Side, Idle, Steer, Pause and Resume, and
Coast controls; its model remained fully framed at desktop and mobile sizes.

An aborted bicycle GLB request left the persistent vehicle warning visible
after delivery actions, preserved the separately loaded street state, and kept
the procedural fallback pedalable. Reload then restored the polished visual and
cleared the vehicle-error state. Scoped application console warnings, errors,
and page errors were empty. All 27 tests, including the generated GLB hierarchy
and pivot check, strict TypeScript checking, and the production build pass.
Independent live-model checks found zero hand-to-grip and foot-to-pedal anchor
offset across three steering angles and five travel poses, while wheel travel
continued and the crank held during coasting.

Reviewed artifacts are the [completed first-job Ride frame](milestones/2026-09-13-courier-bicycle.jpg),
[idle Side preview](milestones/2026-09-13-courier-bicycle-preview.jpg), and
[mobile Ride frame after Reset](milestones/2026-09-13-courier-bicycle-mobile.jpg).
The production build emits a 73.06 KB main entry (25.19 KB gzip), a 10.25 KB
bicycle-visual entry (3.79 KB gzip), a 3.16 KB bicycle-preview entry (1.69 KB
gzip), a 630.17 KB shared JavaScript chunk (159.38 KB gzip), and 23.35 KB CSS
(5.43 KB gzip). Vite's shared-chunk advisory above 500 KB remains expected.

## Validation gates for later vehicles

Each later vehicle needs a bounded implementation and review before it becomes
available to players:

- measured asset scale, origins, pivots, anchors, and browser cost;
- controller tuning and collision behavior tested independently of the mesh;
- camera, steering, braking, recovery, and cargo visibility at desktop and
  mobile viewports;
- an explicit cargo-capacity contract connected to eligible jobs;
- persistence for ownership, upgrades, equipped vehicle, and running costs;
- accessible selection and control UI;
- verified behavior when an asset fails to load; and
- legal and route assumptions sourced separately from visual references.

The planned fleet should remain documentation until those gates are satisfied.

## Commuter bicycle v2 review

The current Blender bicycle and detailed rider remain an engineering prototype;
their earlier polished label is superseded by final human visual rejection. A
new standalone commuter bicycle is being reviewed before rider fitting or
runtime replacement. See [BICYCLE_REBUILD.md](BICYCLE_REBUILD.md).
