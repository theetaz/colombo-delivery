# Delivery backpack and bicycle rider

> **Visual acceptance superseded:** Final human review rejected the earlier bicycle proportions and components, inverted wrists, clothing distortion, saddle fit, and grip presentation despite passing engineering checks. See [BICYCLE_REBUILD.md](BICYCLE_REBUILD.md).


## Scope

This milestone brings the approved teenage courier onto the existing bicycle
and adds an original insulated delivery backpack. The bag is modeled in Blender
with a structured fabric body, practical closures, padded shoulder straps, and
reflective trim. It carries no delivery-service branding.

The existing bicycle already provides wheels, steering, crank, saddle, grips,
and pedal attachment points. Its geometry and the gameplay controller remain
the vehicle foundation. The previous articulated rider is preserved as a
loading fallback while the detailed skinned character is prepared and reviewed.

## Acceptance checks

- The standing customizer can equip and remove the backpack without replacing
  the character's face, clothing, or saved color choices.
- The bag sits against the back, with straps over the shoulders and clearance
  around the neck, elbows, saddle, and rear wheel.
- The riding character retains the approved face and textured clothing, with
  a seated pelvis and natural arm and leg bends.
- Pedaling follows bicycle travel while hands follow the steered grips and
  shoes follow the pedal platforms. Coasting holds the crank and leg phase.
- Asset loading failures keep a usable fallback and provide a visible notice.
- The exported model is checked in the browser from side, front, and rear,
  including a mobile viewport and the main game.

## Customization boundary

The standing catalog and repaired skinned character currently have different
geometry. Attaching a backpack does not automatically skin every hairstyle,
shirt, trousers, or shoe variant. The riding implementation must state which
appearance options it supports. Full garment transfer, additional character
identities, facial animation, and multiplayer remain later work.

The standing studio adds an independent Backpack option under Accessories,
with None and Insulated delivery bag choices. Teal, coral, ochre, and custom
colors affect the fabric while the trim stays darker and the hardware retains
its own material. The bag loads from a separate GLB, so adding equipment does
not require regenerating the approved character wardrobe.

Saved looks now use version 2. Version 1 looks migrate in memory with no bag
equipped and the existing face, garments, and colors preserved. Migration does
not rewrite browser storage; only an explicit save stores the updated look.

## Construction lessons

1. The initial bag shell and lid fit behind the torso, but smooth curve handles
   made the zipper piping protrude past the lid. A tighter perimeter corrected
   the floating edge.
2. Rear-only strap paths did not form a wearable harness. Extending them as
   rigid paths around the torso then produced square rails that hovered in
   front of the shirt. The accepted fit samples the approved shirt surface:
   two continuous 40 mm padded straps pass smoothly over the shoulders, follow
   the chest and return beneath the arms, while curved sternum webbing follows
   measured chest depth. Clearance stays approximately 5–12 mm. Front and
   profile views are required to judge this; a rear view alone hides both
   failures.
3. A valid skin and normalized weights did not guarantee a usable cycling pose.
   Reaching toward the handlebars exposed shoulder and hand artifacts in the
   earlier rig. The riding pass therefore includes focused influence review,
   contact measurements, and rendered pedal extremes.
4. Moving shoulder bones approximately with steering does not hold the palms
   on the grips. Runtime contact correction must target the actual handlebar
   arc, and foot placement must use the pedal platforms through the whole turn.
   Allowing the solver to freely rotate the wrist then produced inverted hands
   during steering. A contact point needs an orientation constraint as well as
   a position target.
5. The original skeleton's names were not a reliable description of anatomy.
   Measured hip, knee, ankle, shoulder, elbow, and wrist locations informed a
   compact riding skeleton over the preserved textured mesh. A forward seated
   torso brings the handlebars within reach without stretching the arms.
6. Solving through the foot joint made the shoes point downward. Thigh/shin
   contact correction and independent foot orientation keep the shoe rigid.
   A subsequent level-shoe candidate still floated above the pedals: markers
   placed at desired targets cannot prove that the actual sole touches them.
   Contact markers must represent the measured shoe and palm surfaces.
7. Raw glTF node names containing colons differed from the names returned by
   the browser loader. The contract now resolves sanitized names and checks
   every joint before the animation loop. A real-loader regression complements
   structural asset tests; successful export alone did not expose this issue.
8. Side views hid an incorrect knee bend plane: at the top of the stroke the
   knee flared sideways and the shin crossed toward the frame. Front and rear
   review added a knee-plane check through the entire pedal cycle. Correct
   sole contact alone does not establish a natural leg pose.

The leaned pose also needs its own harness fit. A whole-bag translation would
move an already fitted chest strap and shell, so only shoulder straps and lower
webbing are projected toward the posed shirt with 8 mm clearance. Bag anchors
stay pinned, and the shell, lid, padding, and materials retain their authored
shape. The standing studio continues to use the original standalone export;
the bicycle loads a separate fitted equipment export.

## Review record

The frozen backpack shell is 0.41 × 0.22 × 0.57 m before its harness and carry
handle. Its complete Blender-space export bounds are
`(-0.222, -0.391, 0.7455)` to `(0.222, 0.136, 1.427)` m in the approved teen's
coordinate system: +Z is up, +Y is forward, and the bag sits toward -Y. The
GLB has one identity root named `DeliveryBackpack`, 24 meshes, 4,964 triangles,
and is 307,884 bytes. Its SHA-256 is
`9f021f2fac96b6718cd9b1a2304bb7cf482c7b0f2399c6b76a11a7386387c5fa`.

The editable source is
[`delivery_backpack.blend`](../art/characters/teen-courier/delivery_backpack.blend),
generated by
[`delivery_backpack.py`](../art/characters/teen-courier/delivery_backpack.py).
The browser asset and placement metadata are
[`delivery_backpack.glb`](../public/models/delivery_backpack.glb) and its
[`manifest`](../public/models/delivery_backpack.manifest.json). Rebuild the
standalone files and fit proofs without changing the approved teen source:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/characters/teen-courier/delivery_backpack.py -- --blend art/characters/teen-courier/delivery_backpack.blend --glb public/models/delivery_backpack.glb --thumbnail public/models/delivery_backpack_thumbnail.png
/Applications/Blender.app/Contents/MacOS/Blender -b art/characters/teen-courier/teen_courier_cleanup.blend --python art/characters/teen-courier/render_delivery_backpack_fit.py -- public/models
```

Reviewed Blender frames: [product](../public/models/delivery_backpack_thumbnail.png),
[front harness fit](../public/models/delivery_backpack_fit_front.png),
[profile fit](../public/models/delivery_backpack_fit_profile.png), and
[rear fit](../public/models/delivery_backpack_fit_back.png). These establish
the standing construction and attachment contract.

## Riding source and runtime

The editable riding scene is
[`teen_courier_riding.blend`](../art/characters/teen-courier/teen_courier_riding.blend).
It preserves the approved textured character mesh and builds a 19-bone
skeleton with paired clavicle, arm, and leg controls. Its one-second, 24-frame
`PedalCycle` loops seamlessly and is sampled from the bicycle crank phase.
Coasting holds that phase while the wheels continue to rotate.

Rebuild the rider, fitted equipment, review images, and manifest from the
preserved source scene:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b art/characters/teen-courier/teen_courier_rig_review.blend --python art/characters/teen-courier/prepare_teen_courier_riding.py
```

The generator uses `riding_weights.py` for bounded influence cleanup,
`minimal_riding_rig.py` for measured joints and consolidated deformation, and
`riding_backpack_fit.py` for the posed harness. The manifest records output
hashes, knee ranges, equipment provenance, and measured harness fit.

The customizer loads `delivery_backpack.glb`. The bicycle loads
`delivery_backpack_riding.glb` under `Backpack_Attach` and
`teen_courier_riding.glb` for the character. The bicycle's existing geometry and
controller remain the foundation; its kickstand is hidden for seated riding.
The old courier remains a loading fallback until both detailed assets are
ready. Failure status remains terminal, optional equipment failure leaves a
usable character, and disposed previews release their geometry and materials.

Full-steering inspection caught a stretched triangle from a finger toward the
shorts. Cleanup now derives finger groups from the actual skeleton hierarchy,
removes influences outside their anatomical region, and smooths short connected
shoulder seams. Tests deform the real exported skin and inspect triangle edge
stretch, in addition to loader, contact, orientation, and knee-plane checks.

## Verification and remaining detail

Accepted as a playable prototype after production-browser front, side, rear,
close-up steering, equipment removal/replacement, coast, and 390 × 844 mobile
review. The detailed rider also loads in the Colombo game scene. Temporarily
withholding its production GLB showed the previous courier with an explicit
fallback message; restoring the file restored the detailed rider. This check
left the asset and saved appearance intact.

All 54 tests, TypeScript checking, and the production build pass. The existing
shared Three.js chunk warning remains. Tests load the actual glTF skin, sample
24 pedal phases, check same-side knees within 0.20 m of the centerline, preserve
foot orientation, and check arm geometry at full steering. The arm solver uses
two-bone reach with a stable elbow plane and preserves hand orientation. The
final maximum palm-center miss is 33.749 mm at full steering, with 0.0509°
maximum hand-orientation error. This remains a fine-grip limitation; individually
articulated fingers and exact grip closure are later work. The base outfit's
cloth compression and hem details are also still prototype art.

The frozen rider SHA-256 is
`8cd56b8c87ae04f80a29653d43f921c313021257dd003e10c96400ea29105329`.
The fitted riding backpack is 326,928 bytes, with SHA-256
`34c3a8a2b8e913545115efc8bf2c4c64f8c10cf1a8605d663c1391de14df8901`.
Each projected harness part has approximately 8 mm median clearance; pinned
anchor transitions retain larger clearances, recorded in the manifest.

Reviewed browser frames: [front](milestones/2026-09-13-delivery-rider-front.jpg),
[side](milestones/2026-09-13-delivery-rider-side.jpg),
[rear](milestones/2026-09-13-delivery-rider-back.jpg),
[mobile](milestones/2026-09-13-delivery-rider-mobile.jpg), and
[in the game](milestones/2026-09-13-delivery-rider-game.jpg).

## Visual acceptance correction

The recorded structural and runtime checks remain valid, but final human review
rejected the rider's inverted wrists, clothing distortion, saddle fit, and grip
presentation. The rider is retained as an engineering prototype and is not the
accepted production art target. Work now restarts with a standalone commuter
bicycle before a new stationary rider fit and animation pass.
