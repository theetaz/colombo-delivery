# Bicycle mounting and dismounting study

Open **http://127.0.0.1:5175/transitions.html** with the viewer running.
The courtyard at `/movement.html` uses these same clips. Walking and pedaling
retain the exact animation tracks approved before this study.

## Review the movement

The page starts on **Get off**. Press **Play**, select **Slow motion** for
quarter speed, or drag the timeline. The six named stages jump to exact poses.
**Show joints** exposes the skeleton; the side, front and three-quarter cameras
help inspect the supporting leg, elbow reach and the rearward leg sweep.
Playback stops at the final pose. Replay deliberately restarts at the beginning;
this is a one-shot transition rather than a seamless loop.

Two six-panel image sequences provide the visual pose guides:

- [Mounting reference](../viewer/public/cyclist/references/mount-sequence.png)
- [Dismounting reference](../viewer/public/cyclist/references/dismount-sequence.png)

These are generated illustrations, not photographs or motion capture. They
establish the order of contacts and the silhouette of each stage. Depth,
timing, joint rotations and clearances are authored for the existing rider
and fitted bicycle; the result is not an exact reconstruction of measured
human motion.

## Pose sequence

| Mounting | Clip progress | Dismounting | Clip progress |
| --- | ---: | --- | ---: |
| Stand beside the bicycle | 0% | Stop in the seated pose | 0% |
| Hold the bars, establish left support | 23% | Plant the left foot | 23% |
| Fold and sweep the right leg over the rear saddle | 46% | Lift the right leg behind the bike | 34% |
| Lower the right foot into the straddling stance | 70% | Clear the saddle | 49% |
| Put the right foot on its pedal, then lift onto the seat | 88% | Land the right foot beside the left | 76% |
| Settle into the approved riding pose | 100% | Stand upright and release the bars | 100% |

The pelvis transfers weight toward the planted shoe while the shoulders reach
toward the bicycle. The right hip and bent knee guide a rearward sweep. The
left shoe remains fixed through the swing, and both palms hold the grips until
the right foot lands. Getting on uses separate timing from getting off.
The rider finishes in the upright Stand pose, without blending through the
older crouched Idle pose.

## Editable Blender asset

[**bicycle-transitions.blend**](bicycle-transitions.blend) includes the textured
rider, fitted bicycle, studio camera and lights, both packed pose sheets and the
Mount/Dismount actions. It opens on the exit crossover pose. The six timeline
markers identify the dismount stages; play frames **0–84 at 24 fps**.
Select the rider's Mount action in the Action Editor to inspect getting on.
Both actions are marked as animation assets. The reference-sheet objects are
hidden initially and can be revealed in their named collection.

The browser uses `../viewer/public/cyclist/courier-movement.glb`. Each transition
has 337 samples over 3.5 seconds, exported as cubic curves with consistent
quaternion signs and zero endpoint tangents. Interior keys retain continuous
velocity. Seated pose blending happens once in local joint space, followed by
contact correction, so changing the pelvis does not repeatedly pull each child
joint toward the seated pose.

Rebuild from the asset repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/build_movement.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/validate_movement.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/build_transition_study.py
```

Then run `npm test` and `npm run build` in `viewer/`.

## Scope and visual history

This remains an authored animation for a stationary, stabilized bicycle on
flat ground. The controller supplies balance. Fingers use the existing grip
shape; individual brake-lever actions, self-collision and a full-body force
solver are not included. Source and rights notes in [README.md](README.md)
continue to apply to the reused character.

[Approved walking screenshots](../docs/visual-history/2026-09-15-walk-approved/README.md)
were saved first in commit `88e5bca`. The
[new transition timeline](../docs/visual-history/2026-09-15-bicycle-transitions/README.md)
contains numbered browser captures from both actions, plus joint and responsive
views. Earlier milestone screenshots are retained.

## Validation for this milestone

- **31 tests pass.** These include fingerprints of the approved Walk, Stand and
  Pedal tracks, matching animation endpoints, continuous foot/grip contacts,
  subframe joint-velocity continuity and the existing courtyard/controller tests.
- **Blender geometry checks pass.** There are no rider/saddle surface intersections
  in 91 samples per transition over frames 21–66. Sampled lowest vertices are
  about -1.00 mm for Mount and -0.76 mm for Dismount. Maximum sampled mesh-edge
  stretch is 3.16× and 3.08× respectively; clothing deformation remains a visual
  review item. This checks the saddle, not all bicycle or body self-collisions.
- **Blender handover checks pass.** Both pose sheets are packed into the assembly,
  the six exit markers are present, and grip closure follows either selected action.
- **Browser review:** normal replay, quarter speed, pause, both sequences, phase
  selection, keyboard scrubbing and the joint overlay were exercised. The study
  was checked at 1280 × 720 and 390 × 844, with no horizontal overflow on the phone.
  Mounting and dismounting also completed in the courtyard. The review tab
  reported no warning/error console entries.
- **Production build passes** for all five entry pages, with the Blender assembly
  and reference images included in the downloadable/static assets.

These checks establish continuity and the stated contacts. Visual acceptance
of the posture and clothing remains part of testing this study.
