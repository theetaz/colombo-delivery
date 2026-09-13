# Stationary rider fit

## Status

The standalone commuter bicycle remains human-approved and frozen at SHA-256
`ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`.
Revision `teen-courier-seated-v2/2` is ready for human review. An interim
revision fixed the torso tear but was held because cumulative trunk rotations
left the head looking down. The final candidate distributes the spine pose and
measures back, neck, and gaze directions independently. No pedalling, steering
animation, backpack fitting, or simulation binding is included.

Human review rejected the previous rider because its torso stretched into a
large triangle and the waist separated. Identity transforms, contact markers,
knee positions, and unchanged bone lengths had passed, but those checks did not
measure strain in the visible skin surface.

The artistic target is
[`seated-pose-guide-v2.png`](../public/references/rider-fit/seated-pose-guide-v2.png).
It describes the intended calm posture and silhouette. It is not a generated
mesh, dimensional authority, or acceptance result.

## Shared coordinate and contact contract

The bicycle and rider share one identity coordinate frame: metres, +Y up, -Z
forward, and +X on the rider's right. The bicycle is at steering angle zero and
crank angle zero. The rider's sole root is `TeenCourierSeatedV2`; it loads at
the bicycle root without an additional position, rotation, or scale offset.

| Contact | World position, metres | Meaning |
| --- | --- | --- |
| `Seat_Attach` | `[0.000, 1.023, 0.282]` | saddle reference |
| `Grip_L_Attach` | `[-0.286, 0.989, -0.334]` | left grip centreline, inner end |
| `Grip_R_Attach` | `[0.286, 0.989, -0.334]` | right grip centreline, inner end |
| `Pedal_L_Attach` | `[-0.112, 0.299, 0.267]` | left platform top |
| `Pedal_R_Attach` | `[0.112, 0.299, -0.073]` | right platform top |

The grip anchors are centreline references transformed through the approved
steering rest quaternion. Each rubber grip has a 0.017 m radius, so the palm
targets sit 0.017 m above the centreline anchors. Pedal anchors include the
platform's 0.010 m top-face offset. These targets define reproducible fitting
measurements; they do not prove visible contact or clearance by themselves.

## Repair

The failure came from a bone-rotation helper that included the translated
armature matrix when converting a world rotation. That introduced an unwanted
translation and moved the bone head while rotating the torso, tearing connected
geometry. The repair uses a correct world-pivot transform and asserts that the
bone head remains fixed. An interim pose showed that one global lean measurement does
not validate local back, neck, and gaze angles; the final candidate measures each
segment and a forward head-gaze direction independently.

Provider bone labels do not describe their anatomical roles reliably:
`tripo::Head_0` belongs to the lower trunk, `bone_3` carries the shirt torso,
and `bone_4` behaves as the neck transition. The repair maps those roles from
measured joints instead of their names. It also rewrites unstable torso and
cross-body hand influences before posing, preventing disconnected vertices
from following unrelated bones.

The repair preserves the original detailed face, hair, textured body, base
outfit, and articulated finger bones used for the static grip pose. A uniform
1.08 scale gives a fitted height of 1.7496 m without nonuniform body scaling,
per-bone stretching, or a seatpost change. The hip-to-shoulder lean is 30.9243°.
Segment pitches measure 21.82° at the lumbar chain, 36.76° at mid-spine, and
54.35° at upper spine. The face gaze is 13° downward, retaining a forward view
rather than the interim 91° hunch. The approved bicycle remains at steering zero
and crank phase zero.

The browser artifact is baked as a static, unskinned GLB under identity root
`TeenCourierSeatedV2`. The editable Blender source retains the rig, approved
bicycle, and packed pose guide.

## Measured fit

Contact points come from the evaluated posed mesh rather than desired IK points.
The repaired residuals are:

| Surface | Residual |
| --- | ---: |
| posterior pelvis to saddle reference | 20.356 mm |
| left palm point to grip target | 0.000 mm |
| right palm point to grip target | 0.000 mm |
| left sole to pedal top | 2.240 mm |
| right sole to pedal top | 5.033 mm |

Measured torso cross-sections are: waist 0.301 m wide × 0.234 m deep,
mid-torso 0.303 × 0.228 m, and chest sample envelope 0.418 × 0.456 m. Generator-side topology
comparison reports torso strain p99 of 1.48279 and maximum 1.80387.

The independent post-export regression measures actual world-space triangle
edges. The rejected rider reached 0.371312 m. The upright source reaches
0.195273 m, or 0.210895 m at scale 1.08. Revision 2 reaches 0.203747 m with a
99.9th percentile of 0.152095 m; 4 of 53,043 directed edges exceed 0.20 m. It
passes the 0.220 m hard cap. This catches severe tears and long triangles, while
human review remains responsible for judging pose and clothing appearance.
The earlier 20.76 maximum strain was traced to the central neck, where a
3.424 mm source edge stretched to 71.085 mm across a hard torso-weight mask. A
continuous `bone_3`/`bone_4` to `bone_5` fade reduces that edge to 7.061 mm, or
2.062×. Final neck strain is p99 2.01820 and maximum 2.07113. Whole-mesh maximum
strain is 9.3538 at a small ankle seam, retained as a numerical limitation for
human review. Zero palm point residual records alignment of the measured point
and target; it does not certify full physical clearance between the hand and
grip meshes.

## Review and reproduction

Open `/rider-fit-review.html` for a brief human inspection of the repaired rider
on the unchanged bicycle. Animation stays blocked until that review passes. No
screenshot comparison or computer-vision score is an acceptance gate.

Rebuild from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b art/characters/teen-courier/teen_courier_rig_review.blend --python art/characters/teen-courier/seated-v2/generator.py
node --import tsx --test tests/character-seated.test.ts
npm test
npm run build
```

| Artifact | SHA-256 |
| --- | --- |
| `public/models/teen_courier_seated_v2.glb` | `9c8a9645aa63c9c3a009c690b73806aa8ebf6a1b0a2655d60e4b5434089dcf71` |
| `art/characters/teen-courier/seated-v2/teen_courier_seated_v2.blend` | `207da35c3eb038438abc318c97c2c267dfcc9706de04351b5e1ca39956529946` |
| `art/characters/teen-courier/seated-v2/generator.py` | `3f6324de24a83e86843916473fb61e3a21dd44c89bf61ca6b033c43069f25a9a` |

The GLB is 3,260,968 bytes. Its Blender +Z-up bounds run from
`[-0.372615, -0.489609, 0.288090]` to
`[0.358099, 0.488315, 1.785441]` metres. The focused structural/contact test and
all 58 tests pass, as does the production build. These are the frozen
engineering measurements for the new handoff. Final appearance remains pending
human approval.
