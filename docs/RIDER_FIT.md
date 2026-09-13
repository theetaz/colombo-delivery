# Stationary rider fit

## Status

The standalone commuter bicycle remains human-approved and frozen at SHA-256
`ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`.
Human review rejected `teen-courier-seated-v2/2` and subsequently rejected the
smaller `teen-courier-clean-rig/1` upper-body checkpoint. The original standing
character, new neutral rig, and forward-lean pose remain available in
`/character-rig-review.html` for comparison. A later source audit found concrete
weighting defects in v1. A revision 2 repair was attempted but failed its
deformation bounds and is not a review candidate. Hands and legs remain neutral;
the character is not mounted on the bicycle, fully fitted, or animated.

Human review rejected the previous rider because its torso stretched into a
large triangle and the waist separated. Identity transforms, contact markers,
knee positions, and unchanged bone lengths had passed, but those checks did not
measure strain in the visible skin surface.

Later edge and cross-section checks caught large tears, yet human review still
rejected the overall body construction. Numeric checks can guard known failure
modes without proving that the anatomy or silhouette looks right. The new rig
preserves the original face, hair, and UVs while rebuilding weights from named
anatomical regions rather than reusing the provider weights or repeating broad
coordinate-box corrections. Human review rejected the limited upper-body
checkpoint. Hand, leg, bicycle-fit, and
animation work remains blocked.

Clean-rig v1 is preserved in commit `26b0828`. Its source assigned every vertex
below Blender Z 0.70 m to pelvis or leg bones. That height rule crossed
unrelated disconnected components and produced hand-region edge strain up to
11.87×. The rigid head boundary also met the deforming neck abruptly, producing
8.2× edge strain. Revision 2 replaces the height rule with anatomical component
membership and smooth neck-ring weights. That constrained transition moved
strain to its outer boundaries: all triangle-edge strain ranged from 0.588865×
to 2.096243×, despite rigid arm edges staying within 0.999986×–1.000009× and
the known neck edge reaching 1.0×. The result failed engineering review and is
not presented as a corrected model. Further radius or ring parameter iterations
would repeat the same boundary problem; the transition needs a deformation-
energy solve or source-authored weights.

The approved cleanup mesh has 8,951 vertices, 17,681 polygons, and 14
disconnected components. It has no exact-position duplicate vertices; visible
shoulder and sleeve boundaries include real gaps of roughly 7–8 mm. The old
coincident-vertex seam pass therefore changed zero vertices and could not fix
those boundaries. The reset records explicit seam-boundary correspondences and
uses smooth anatomical weighting while keeping persisted rest vertex IDs for a
rigid face and hair lock. It does not claim retopology, a manifold mesh, or an
automatically accepted result.

The neutral checkpoint GLB retains the clean skin so the rig hierarchy and rest
weights can be inspected. The forward-lean checkpoint is a separate static,
unskinned bake of evaluated geometry, ensuring the browser displays the authored
lean without implying an animation contract. The editable Blender source keeps
the 21-bone rig. Both browser variants expose stable `TeenCourier_CleanRig`,
`TeenCourier_Body`, and `HeadFocus` nodes for consistent switching and camera
framing.

Two export checks changed the checkpoint before handoff. The first lean export
retained a skin with no animation and therefore reopened in its rest pose; the
review variant now bakes evaluated lean geometry explicitly. The first
persisted head label also omitted parts of the chin and mouth. It was rebuilt
from the complete face, jaw, mouth, and `Face_Fairing` source membership before
the rigid head lock was regenerated. These findings reinforce that a valid rig
hierarchy or export command alone does not prove the browser is showing the
intended deformation.

The first baked lean also copied evaluated normals rather than preserving the
original rigid face shading. That allowed the neighboring neck deformation to
rotate some chin and upper-neck normals by about 10°. The final export maps the
original neutral split normals through the rigid head transform and validates
the actual GLB by triangle UV corners. Its maximum protected face-and-hair
normal error is `0.000348416`, while human appearance review remains required.

### Rejected clean-rig checkpoint 1 reproduction

Checkpoint 1 and its builder are preserved in commit `26b0828`. From that
checkout, rebuild it with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b art/characters/teen-courier/teen_courier_cleanup.blend --python art/characters/teen-courier/clean-rig/build_clean_rig.py
node --import tsx --test tests/character-clean-rig.test.ts
npm run build
```

| Artifact | SHA-256 |
| --- | --- |
| `art/characters/teen-courier/clean-rig/teen_courier_clean_rig.blend` | `d55b1b6d98ae9ffb0bc9cfcc485cee5ec8719ef549efb54c883b6c2c9138b29f` |
| `public/models/teen_courier_clean_rig_neutral.glb` | `64f17c6995455898f4c167cd9db2c0aebfa10cabfe700f9fb927476eff827b70` |
| `public/models/teen_courier_clean_rig_upper_body.glb` | `d9a6f860b472b199bcf7233f0cf1b2c3012d752d88b82ea2f4825e672919b1c0` |
| `public/models/teen_courier_clean_rig.manifest.json` | `a821019802b1f2738dbd63c5dd6b7bcc672bb21603fc59a0b0236f80f638b1cc` |

The source retains 21 named bones and the neutral export retains one skin. The
forward-lean browser artifact is static and unskinned, with 0.140679 m of chest
forward displacement and 0.144570 m at `HeadFocus` in Blender +Y. Weight sums
are normalized, 265 boundary seam pairs have zero weight mismatch, and their
posed gap increase is below `1.5e-8` m. These are engineering checks for the
rejected limited checkpoint, not an appearance approval.

Final verification passed all 60 tests and the production build. The local
review page serves the same neutral and lean GLB bytes recorded above. Human
review subsequently rejected the checkpoint; no screenshot or computer-vision
score was used as an acceptance gate.

### Failed revision 2 experiments

The rejected harmonic experiment is reproducible with
`art/characters/teen-courier/clean-rig/rejected_harmonic_v2.py`; its isolated
outputs are under `art/characters/teen-courier/clean-rig/harmonic-v2/`. The
separate cage experiment is reproducible with
`art/characters/teen-courier/cage-rig/build_cage_rig.py`, with outputs beside
that script. The cage preserved neutral geometry and the rigid head and arms,
but its cage/neck boundary produced triangle-edge ratios from 0.097824× to
10.306895×. Neither experiment is review-ready. The unresolved problem is the
continuous torso, neck, head, and disconnected-part interface; it requires
source-authored transition topology or weights rather than another broad
parameter adjustment. The approved original face and bicycle remain unchanged.

The diagnostic suite now checks every corresponding triangle edge in these
three rejected exports. All 63 tests and the production build pass, including
three tests that explicitly confirm excessive distortion in rejected fixtures.
Those passing tests record the failures; they do not certify a corrected model.

The artistic target is
[`seated-pose-guide-v2.png`](../public/references/rider-fit/seated-pose-guide-v2.png).
It describes the intended calm posture and silhouette. It is not a generated
mesh, dimensional authority, or acceptance result.

The seated-v2 measurements below are retained as a rejected engineering record.
They do not describe the active clean-rig checkpoint or confer approval.

## Historical rejected seated-v2 record

The following coordinate contract, repair notes, measurements, and reproduction
steps describe the rejected seated-v2 artifact only.

### Coordinate and contact contract

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

### Repair attempts

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

### Measured fit

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

### Reproduction

The `/rider-fit-review.html` route retains the rejected rider on the unchanged
bicycle for historical comparison. It is not the active approval route. No
screenshot comparison or computer-vision score was used as an acceptance gate.

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
engineering measurements for the rejected handoff. Human review did not accept
its appearance.
