# Bicycle mounting and dismounting study

Human review approved the revised Mount and Dismount clips on 15 September
2026. The approval is tied to the leg-corrected `939c56b` animation checkpoint;
it does not apply to the earlier rejected transition pass or to the separate
rejected main-project stationary rider studies.

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
| Extend the lifted right leg and sweep behind the saddle | 46% | Lift the right leg behind the bike | 34% |
| Lower the right foot into the straddling stance | 70% | Clear the saddle | 49% |
| Put the right foot on its pedal, then lift onto the seat | 88% | Land the right foot beside the left | 76% |
| Settle into the approved riding pose | 100% | Stand upright and release the bars | 100% |

The pelvis transfers weight toward the planted shoe while the shoulders reach
toward the bicycle. The right hip guides the rearward sweep. The knee first bends to lift the heel,
then extends for the crossover and bends again before landing. The
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
[initial transition timeline](../docs/visual-history/2026-09-15-bicycle-transitions/README.md)
contains numbered browser captures from both actions, plus joint and responsive
views. Earlier milestone screenshots are retained.

## Leg correction — 15 September 2026

The first transition pass (`7ec7367`) passed contact checks but failed visual
review. Around the middle of the exit, its right knee rose roughly 36 cm above
the hip. A moving knee target switched the bending plane, while independently
oriented thigh, shin and shoe bones made the leg look twisted. The approach
and exit also crossed the feet before the supporting step had finished.

The revised Blender actions address those problems together:

- An explicit hip swivel selects a continuous knee bending plane. The thigh
  and shin share an anatomical hinge axis, so the visible kneecap follows the bend.
- The knee extends from about 32° to 18° of flexion at the rear crossover. The heel
  travels farther behind the bike, reducing the high-knee kick. The leg bends
  again for landing rather than descending as a rigid limb.
- During the swing, the shoe follows the shin with a relaxed pointed ankle.
  It returns to its contact orientation before taking weight.
- The right foot steps toward the bicycle first; the left follows and becomes
  the ground support. On exit the right lands on its own side of the left shoe,
  then two separate steps return the rider to the standing position.
- Pelvis movement and the forward torso hinge are coordinated with the bar
  position. Elbow bending uses a stable reference direction so it cannot flip
  as the shoulders move past a fixed elbow target.

The original reference images, character mesh, bicycle and approved Walk,
Stand and Pedal animation tracks are retained. New captures are in the
[leg-correction timeline](../docs/visual-history/2026-09-15-bicycle-leg-correction/README.md).

## Validation for this correction

- **33 tests pass**, including the preserved animation fingerprints, matching
  endpoints, support/grip contacts and subframe velocity continuity. New checks
  reject the high-knee pose, independent shin/ankle rotation, crossed feet and
  approach/exit steps with both shoes airborne. Sampled peak knee height above
  the hip decreased from 36.5 cm to 12.8 cm for Mount and from 36.3 cm to
  12.6 cm for Dismount (samples every 0.1% over 25–76% of each clip).
- **Blender surface checks pass:** 91 samples per action over frames 21–66
  contain no rider/saddle intersections. Current measured values and the exact
  exported asset fingerprint are in
  [movement-check.json](../viewer/public/cyclist/movement-check.json).
- **Browser review:** both actions were played and inspected from the side and
  three-quarter views. Numbered UI screenshots record both six-stage sequences,
  with additional side/front joint views. The courtyard uses the same GLB.
- **Production build passes** for all five entry pages and includes the updated
  downloadable Blender assembly.

The checks cover the stated joint/contact behavior and saddle clearance.
They do not replace visual assessment of the complete movement, clothing,
other bicycle contacts or body self-collision.
