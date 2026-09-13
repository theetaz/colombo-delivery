# Courier character detail and appearance study

This document preserves a completed technical prototype. Its rigid-part rider
is not the target hero-character quality. The replacement direction is defined
in the [teenage courier character art pipeline](CHARACTER_ART_PIPELINE.md).

## Scope

This milestone improves the implemented bicycle courier at the scale seen from
the Ride camera. It focuses on a more legible face, hair, clothing, shoes, and
parcel bag; small appearance choices; reliable hand, foot, and seat contact;
and a repeatable asset-review path. It adds limited preset cosmetic
customization; it does not add another playable character, multiplayer,
free-form body or face editing, or new vehicle physics.

The Rider studio offers Classic, Soft, and Angular face profiles plus three
skin, hair, outfit, and bag palettes. These are presentation variants of the
same courier asset. They do not change delivery rewards, speed, handling,
collision, cargo capacity, or access to jobs.

## Reference workflow

The [Paper Route development archive](https://www.paperroute.lol/devlog/) was
reviewed as a process reference. Its most useful lesson for this project is the
sequence of review artifacts: isolate the rider, compare neutral and coloured
turnarounds from consistent cameras, inspect the head and garment fit closely,
then review the same asset in actual runtime poses and at portrait size. The
archive shows separate iterations for silhouette, head shape, cap and hair,
clothing intersections and hems, bag materials, shoes, bicycle contact, and
runtime action poses.

Colombo Delivery adapts that review loop to its own original asset pipeline.
The courier remains reproducible from the project Blender generator and uses
project-authored geometry and small deterministic, export-compatible texture
maps. Isolated renders expose problems that the game camera can hide; the browser preview then
checks the exported GLB, material response, controls, and responsive framing;
the production Ride view remains the final authority for visibility and motion.

The final project-authored asset is 0.69 m wide, 1.96 m high, and 1.76 m long.
Its 2.1 MB GLB contains 241 nodes, 213 meshes, 16 materials, 59,036 exported
vertices, and 46,616 triangles. Ten deterministic 64 px neutral luminance maps
are embedded in the GLB; there are no external meshes or texture inputs. The
editable Blender source is 423 KB. The Classic face is the authored default;
Soft and Angular are separate identity-scale profile roots hidden in the source
scene until selected. The generated [courier close-up](../public/models/courier_bicycle_closeup.png)
supports head and clothing review alongside the full contact sheet.

## Character quality targets

The face should read as a designed character at preview distance through a
clear brow, eyes, nose, mouth, ears, hairline, and profile rather than through
high polygon density alone. Small profile variants must preserve the same
attachment and animation hierarchy so a visual choice cannot disturb riding
contact.

Hair should form a deliberate silhouette from the front, side, and rear. It
must meet the head cleanly and remain clear of the helmet. Clothing should read
as layered garments with visible openings, cuffs, hems, and folds where those
forms survive the game camera. Skin must not visibly pass through sleeves or
shorts across the reviewed steering and pedalling poses.

The parcel bag needs a distinct body, flap, seams or trim, straps, and stable
contact with the rider. Shoes need a separate upper and sole and must remain
attached to the animated feet. Materials and textures should reinforce these
forms without adding illegible noise or relying on lighting from only one
preview angle.

## Asset and runtime contract

The detailed courier must preserve the existing `CourierBicycle` metre-scale,
Y-up, local -Z-forward, ground-origin contract and every required wheel,
steering, crank, pedal, grip, seat, hip, shoulder, hand, foot, limb, and cargo
node documented in [Vehicles and progression](VEHICLES.md). Appearance changes
may replace or isolate materials and surface details, but they must not rename
or move gameplay attachment points.

Each runtime courier instance must own the materials that an appearance choice
can change. Geometry and immutable textures may remain shared. This prevents a
choice on one instance from recolouring another instance if the game later
renders multiple couriers; it is an asset-lifetime requirement, not a claim
that multiplayer exists.

The saved appearance record is versioned, bounded to known option keys, and
resilient to absent, blocked, malformed, or older browser storage. The preview
applies choices live, marks the changed state as unsaved, and writes it only
through **Apply & save** under `colombo-delivery:courier-appearance`. The game
loads that record automatically. An invalid record falls back to the default
without blocking play.
The procedural bicycle remains the loading fallback, and asset failure must
remain visible independently of scenery status.

The Ride toolbar links to the studio as **Customize rider**, shortened visually
to **Rider** on mobile while retaining the full accessible name. The preview
adds a close Face camera to its full-rider views and stacks its canvas and
controls below 720 px.

## Production review

Production Chromium review passed at 1280 × 800, 390 × 844, and 390 × 600.
Classic, Soft, and Angular faces and all three skin, hair, outfit, and bag
palettes updated live. The selected Angular, Deep, Brown, Ocean, and Ochre
combination survived **Apply & save**, reload, the **Customize rider** trip from
the game to the studio, and return to the game. Delivery progress remained in
its separate record: the first 67 m keyboard job awarded LKR 240 once, and
reload retained LKR 240 and one completion.

The desktop and both portrait reviews kept the preview canvas, option panel,
game HUD, and controls separate without horizontal overflow. Corrupt or older
appearance data returned to the default. With browser storage unavailable, the
preview and game still loaded and reported the session-only result. Two loaded
courier instances retained different skin materials and colours while keeping
their texture maps, confirming mutable materials are isolated per instance.

Aborting the courier GLB request showed the preview failure through a save
attempt, allowed street scenery to load independently in the game, and kept the
procedural fallback usable above 4 km/h before Reset returned it to 0. Reload
restored the detailed asset. Scoped application console warnings, errors, and
page errors were empty in the clean flow; the forced abort produced only its
expected network failure.

All 29 tests, strict TypeScript checking, and the production build pass. The
artifact checks cover the required hierarchy and identity transform, composed
pivots, sole parentage, 0.68 m wheel diameter, UVs, embedded images, face-root
scale, and outward winding. Live checks across three steering settings and five
travel distances measured a maximum hand-to-grip error of 1.78 × 10⁻¹⁵ m and a
maximum foot-to-pedal offset of 2.63 × 10⁻¹⁵ m. They also confirmed that wheels
turn while the crank holds during coasting. These measurements verify named
contact anchors; they do not establish cloth deformation or full-body skinning.

The Rider studio uses simplified contact grounding and an unshadowed key light
to keep close asset inspection legible. The game retains its real directional
shadows. Reviewed artifacts are the [Rider studio](milestones/2026-09-13-character-detail-studio.jpg),
[face close-up](milestones/2026-09-13-character-detail-face.jpg),
[completed-delivery game view](milestones/2026-09-13-character-detail-game.jpg),
and [mobile Rider studio](milestones/2026-09-13-character-detail-mobile.jpg).

The production build emits a 73.17 KB main entry (25.24 KB gzip), a 12.75 KB
bicycle-visual entry (4.81 KB gzip), a 4.67 KB Rider-studio entry (2.24 KB
gzip), 23.98 KB CSS (5.52 KB gzip), and a 630.17 KB shared JavaScript chunk
(159.38 KB gzip). Vite's expected advisory above 500 KB remains.

The courier is still an articulated rigid-part character. It has no skeleton
skin deformation, facial animation, cloth simulation, loose-hair simulation,
free-form editor, or multiplayer system. The preset palettes deliberately
change colour families rather than garment geometry or body proportions.
