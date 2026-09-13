# Stationary rider fit

## Status

Stage 2 is limited to fitting the existing detailed teenage courier to the
approved commuter bicycle at rest. The bicycle-only form and components were
approved by the user on 2026-09-13 at GLB SHA-256
`ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`.
That bicycle export stays frozen during this stage.

The stationary rider remains `awaiting-human-review`. Numeric checks can show
how measured body patches relate to the seat, grip, and pedal anchors without
per-bone or nonuniform scaling, but they cannot establish that the pose looks
natural. The current fit uses a uniform 1.08 character scale, preserving the
original proportions while giving the approximately 1.75 m rider natural reach.
Pedalling, steering poses, bag fitting, animation blending, and vehicle
simulation are outside this stage and wait for explicit fit approval.

## Shared coordinate contract

The bicycle and rider share one identity coordinate frame: metres, +Y up, -Z
forward, and +X on the rider's right. The bicycle is at steering angle zero and
crank angle zero. The stationary rider export has sole root
`TeenCourierSeatedV2` and loads at the bicycle root without an additional
position, rotation, or scale offset.

The frozen bicycle defines these contact anchors at rest:

| Contact | World position, metres | Meaning |
| --- | --- | --- |
| `Seat_Attach` | `[0.000, 1.023, 0.282]` | saddle contact reference |
| `Grip_L_Attach` | `[-0.286, 0.989, -0.334]` | left grip centreline at the rubber cylinder's inner end |
| `Grip_R_Attach` | `[0.286, 0.989, -0.334]` | right grip centreline at the rubber cylinder's inner end |
| `Pedal_L_Attach` | `[-0.112, 0.299, 0.267]` | left platform top |
| `Pedal_R_Attach` | `[0.112, 0.299, -0.073]` | right platform top |

The grip values are the steering assembly's local anchors transformed by its
approved rest quaternion. Each rubber grip has a 0.017 m radius, so a
palm-to-anchor distance is not the physical gap to its visible surface. Pedal
values include each platform's exact 0.010 m top-face offset. These are pose
targets, not claims about final visible contact or clearance.

## Fit requirements

The fit uses the existing approved detailed teen mesh, face, hair, and textures.
The editable Blender source retains the provider skeleton and finger hierarchy
where they deform cleanly. The browser artifact is a baked, static, unskinned
mesh so this review does not imply an animation or runtime rig contract.

The pelvis must rest on the saddle; the torso should lean naturally toward the
bar; elbows remain bent; palms face down and inward on the grips; fingers close
believably around the grips; shoe soles meet the pedal tops; and both knees bend
forward. Limb proportions and the original appearance stay unchanged under the
uniform 1.08 character scale. No nonuniform body scale, per-bone scaling, or
stretched limbs may be used. A normal seatpost adjustment is allowed only if
its measured amount is recorded without changing the frozen bicycle artifact.

## Measurement and review

Contact markers must come from evaluated mesh patches rather than bone heads or
nominal IK targets. The fit manifest records representative seat, left and right
palm, and left and right sole positions, their target anchor positions, and
point-to-point residual distances. These residuals are reproducible fitting
signals; in particular, the palm residuals are point distances to the defined
grip-top surface targets rather than minimum mesh-to-rubber clearance. The
manifest also records the uniform scale and any seatpost adjustment. Structural checks cover units, identity
transforms, finite geometry, the unskinned static export, and artifact hashes.

Independent review of the first candidate found competing terminal-hand IK and
wrist orientation plus an imprecise pelvis sample. The frozen candidate uses an
arm solve that leaves the wrist orientation explicit and measures the posterior
sitting patch. Its final patch-to-target residuals are:

| Body patch | Target definition | Residual |
| --- | --- | ---: |
| posterior pelvis | saddle-centre reference | 13.546 mm |
| left palm | top of the 17 mm-radius left grip at its inner-end anchor | 21.074 mm |
| right palm | top of the 17 mm-radius right grip at its inner-end anchor | 30.304 mm |
| left sole | left pedal platform top | 1.192 mm |
| right sole | right pedal platform top | 4.687 mm |

The pelvis point is a posterior support patch, so its distance from the saddle
centre is not a vertical hover distance. Each palm target applies the known
grip radius to its centreline anchor before measuring the residual. The palm
misses remain above 20 mm and require direct human inspection; numeric validity
does not make them visually acceptable. The sole residuals are below 5 mm.

No seatpost adjustment was made. The largest deviation among the eight arm and
leg pose-to-rest length ratios is `8.81e-7`, confirming that the fit did not
stretch individual segments. The knee X positions are -0.120675 m on the left
and +0.121712 m on the right, keeping the knees on their respective sides.

Human review uses `/rider-fit-review.html` for a brief inspection of the
stationary rider on the frozen bicycle. It loads the approved bicycle and
candidate rider independently at identity and reports only when the complete pair is
ready. Front, three-quarter, +X drive-side, -X opposite-side, and rear views
cover the contact areas; Reset view restores the initial camera. The rider can
be hidden to inspect the unchanged bicycle, and the local notes can be copied or
downloaded. Notes are not submitted automatically.

No render farm, screenshot comparison, computer-vision score, or animation test
is part of the decision. Approval means only that this neutral seated pose is a
sound base for the next controlled pedalling pass.

## Reproduction

Rebuild the candidate from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b art/characters/teen-courier/teen_courier_rig_review.blend --python art/characters/teen-courier/seated-v2/generator.py
node --import tsx --test tests/character-seated.test.ts
npm run build
```

The static GLB contains one mesh under seven nodes, no skin, and no animation.
It is 3,260,140 bytes. Its precise runtime +Y-up bounds are
`[-0.343608, 0.288358, -0.496540]` to
`[0.376463, 1.901333, 0.535100]` metres.

| Artifact | SHA-256 |
| --- | --- |
| `public/models/teen_courier_seated_v2.glb` | `01a52f9343bf605f7510f1d4be4d7ac9368942d11bcca52679f92d45201107d3` |
| `art/characters/teen-courier/seated-v2/teen_courier_seated_v2.blend` | `6657c7028387f8080d68d71a47986d50cc86c3a21cc1eae3daa2cc1328f6efe2` |
| `art/characters/teen-courier/seated-v2/generator.py` | `a7fb3cddab23a02b7590974516245ff075f54415559390feeff2e8988c010010` |

The generator asserts the required root name, static export settings, 5 MB GLB
budget, preserved limb-length ratios, and left/right knee placement. The
independent runtime loader check verifies the actual identity root, unskinned
and animation-free export, finite bounds, required surface markers, and approved
bicycle byte hash. It also recomputes marker residuals and verifies grip-top
targets against the approved centreline anchors and 0.017 m rubber radius. That
focused GLTFLoader test passes 1/1; all 58 tests, strict TypeScript checking, the
production build, and documentation diff check also pass. Node textured-asset
tests emit expected blob texture-decode warnings outside a browser, and Vite
retains its expected large shared-chunk advisory. Review status remains
`awaiting-human-review`.
