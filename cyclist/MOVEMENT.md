# Walk and ride courtyard

Open **http://127.0.0.1:5175/movement.html** with the adjacent viewer running.
The approved pedal inspection page is still at `/cyclist.html`; its character,
bicycle and pedal files are unchanged.

For walking posture review, open **http://127.0.0.1:5175/walking.html**.
Use **Straight support**, then **Compare previous walk**, to compare the same
step from the side. Front/three-quarter views, quarter speed, pause and a
keyboard-accessible timeline are available. The courtyard uses the updated gait.

## Controls

- Click a clear point on the ground to walk there. Drag to orbit; scroll to zoom.
- **W/S**: walk forward/backward; **A/D**: turn. Touch controls also support holds.
- Approach the bicycle's **left side** and press **E** or **Get on bicycle**.
  The character aligns with the bicycle, then performs the mounting animation.
- While riding, **W** pedals and **S** brakes to a stop. Release and press
  **S** again to roll slowly backward,
  and **A/D** steer. Releasing W coasts with the feet resting on the pedals.
- Stop and press **E** to get off. The left side must have enough clear space.
  The pedals settle before the character swings a leg over and steps down.
- Walk away; the bicycle remains parked where it was left. Return to remount.
- **Escape** pauses; **R** resets the courtyard. Switching away pauses the test.
- The **1× / ¼×** button slows the simulation for inspecting movements. Pause
  a transition and orbit around the character to inspect its pose.

## What is implemented

The same textured character uses Stand, Walk, Mount, Dismount and the approved
Pedal clip. The original Idle pose remains as the transition endpoint; WalkBefore
is retained only for comparison. Walking distance drives the gait. Mount/dismount clips share exact
standing and seated endpoints; the controller changes the character's origin
at those matching endpoints. One character remains present through every state.
The rider is independent of the bicycle while walking and follows it while
mounted. Steering adjusts the fork and uses arm IK to follow the handlebars.

The courtyard has flat-ground movement, obstacles, a boundary, coasting,
acceleration/braking, limited reverse, steering and assisted visual lean.
It is an isolated movement prototype, not the Colombo road game. It does not
yet simulate a freely balancing two-wheel rigid body, tire slip, suspension,
ragdolls, uneven ground, stairs, traffic or collisions with moving vehicles.
Turning on foot currently rotates the character rather than playing dedicated
turn-in-place clips. Mounting and dismounting are authored separately for this bicycle and can
need further anatomical polish. The parked bicycle is
stabilized by the controller; it does not fall over.

## Assets and rebuilding

`courier-movement.blend` contains seven animation actions on a copy of the
approved rig and opens on the upright Stand pose. `../viewer/public/cyclist/courier-movement.glb` is its browser
export. It reuses the existing geometry, textures, skin weights and grip shape;
no new character reconstruction was requested. The source and rights notes in
`README.md` apply to this derived local testing asset too.

From the parent asset directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/build_movement.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/validate_movement.py
```

Then run `npm test` and `npm run build` in `viewer/` from that parent directory. Tests exercise the
walk/ride state sequence, parking, proximity, speed and clearance restrictions,
pause, click-to-walk and boundaries. The exported clips are loaded by Three.js
to verify their durations, loop seams and matching transition endpoints.
`movement-check.json` samples the Blender deformation and ground clearance.
These checks do not replace visual review of the movement.

## Refinement record — 15 September 2026

### Steering contacts

The earlier runtime added a world-axis steering rotation to the hand after
posing the arm. Reusing a held animation frame could accumulate that correction
because unchanged animation tracks are cached. The revised runtime restores
its authored arm pose before sampling, solves the elbow and shoulder toward
the grip, and derives the palm orientation directly from the grip transform.
Only the two arm chains are modified. The feet retain their pedal pose while
the entire rider and bicycle lean together.

Validation loads the exported rider and fitted bicycle and exercises 720 steering
samples across three headings, including bank. Hand contact stays within 5 mm;
ankle positions and orientations remain unchanged relative to the frame at a
fixed crank angle. Repeated coasting frames do not accumulate wrist rotation.

References reviewed: [PaperRoute's articulated riding and contact studies](https://www.paperroute.lol/devlog/),
[Three.js animation-track caching behavior](https://github.com/mrdoob/three.js/issues/25518),
and [Bikeability's ride guide](https://www.bikeability.org.uk/wp-content/uploads/2024/06/Ride_Guide_V10.pdf).
These inform the pose/contact decisions; this implementation does not reproduce
PaperRoute's assets or claim to use its animation source.

### Walking contact and push-off

The Walk clip now rolls the shoe through heel contact, a flat support phase,
and toe push-off. The heel rises around the toe contact before the leg swings
forward. Pelvis rise and side-to-side weight transfer follow the support leg;
chest rotation counterbalances the hips. The swing arc is lower than before.
Walking distance still drives clip phase so cadence follows travel speed.

The exported-geometry regression checks flat-stance slip below 5 mm, visible
heel-to-flat rotation, at least 0.30 radians of push-off shoe rotation, and
more than 55 mm of heel/ankle rise before swing. Four Blender side frames were
reviewed. Sampled maximum edge stretch fell from 1.83 to 1.47; minimum sampled
vertex height is about -0.8 mm. These are deformation/contact checks, not a
claim that the gait has been validated against motion capture.


### Mounting, dismounting and saddle clearance

Both transitions now establish hand and ground contacts before the leg crosses
the bicycle. The rider steps forward of the saddle, keeps the support shoe
planted, flexes the raised leg through a higher arc, and then transfers onto
the pedals and seat. Getting off uses its own timing: move off the saddle,
plant the left shoe, bring the right leg across, land, then release the hands.
The palm closes as it reaches the grip and opens after support is established.
Forearm pronation shares the palm rotation rather than leaving all rotation
at the wrist. Shape-preserving curves remove the stop at every intermediate
pose while repeated foot/hand targets retain their contact holds.

The Blender validator now tests the deformed rider against the actual fitted
saddle at 91 samples per clip, covering frames 21–66 in half-frame increments.
There are no surface intersections in those sampled swing intervals. Intended
seated contact at the endpoints is excluded. The report includes hashes of both
GLBs so these results cannot silently refer to different assets. This is a
saddle regression, not a whole-bicycle/self-collision guarantee.

The browser-asset test checks the planted left shoe and both hand targets at
five points during each swing (8 mm tolerance), as well as matching clip
endpoints and independent dismount timing. The controller still supplies balance;
there is no dynamic balance or contact-force solver in this prototype. The pose
and contact improvements do not imply motion-capture accuracy.

### Validation and review

- `npm test`: 19 tests pass, including the exported-asset and steering regressions.
- `npm run build`: production build passes for all three viewer entry pages.
- Blender: deformation/ground samples pass; 182 sampled swing poses have no
  rider/saddle surface intersections. Side renders were reviewed for walking,
  mounting and dismounting.
- Browser: the movement page was checked at 1280×800 and 390×844. The desktop
  sequence mounted, steered both ways, pedaled, braked, dismounted and walked
  away. The get-off action was disabled while moving. Pause/resume and the
  phone mounting control were checked. No warning/error console entries were
  reported in the clean review tab.

Remaining limits are assisted balance on a flat courtyard, a rigid shoe rather
than separately articulated toes, simplified hands, and no full-body collision
or biomechanical force solver. Further visual tuning should use this page and
its slow-motion/pause controls before road integration.


## Walking posture correction — 15 September 2026

The earlier contact pass did not resolve the crouched silhouette or unnatural
arm movement. The supporting knee remained around 32–44 degrees flexed. The
hand-target solver also held each wrist at a constant height and forced the
elbows through roughly 34–59 degrees of flexion.

### Research and animation decisions

- [Collins, Adamczyk and Kuo: Dynamic arm swinging in human walking](https://pmc.ncbi.nlm.nih.gov/articles/PMC2817299/)
  combines a passive walking model with human experiments. Normal arm swing
  counters leg motion with low shoulder effort. The updated animation uses
  shoulder-led pendulums, opposite arm/leg timing, soft elbows and palms that
  follow the forearms. It does not simulate the paper's dynamics.
- [Knee Kinematics of Healthy Adults Measured Using Biplane Radiography](https://pubmed.ncbi.nlm.nih.gov/32491153/)
  measured 39 knees and found substantial individual variation. Its full-cycle
  knee motion and the distinction between support and swing guide the pose
  targets: yield after contact, extend in mid-stance, and bend during swing.
  The authored angles are artistic targets for this rig, not a clinical norm
  or a retargeted motion-capture recording.

Pelvis height now comes from the character's actual leg lengths and support
foot position. The persistent four-degree pelvis lean is removed. A new Stand
clip keeps the resting character upright too. The shoe rolls from the heel to
its measured toe region, with a smooth swing trajectory that joins the planted
foot's relative velocity at contact. One full cycle covers 1.32 m, giving about
123 steps/min at the courtyard's unchanged 1.35 m/s speed; previously it was
162 steps/min. Both the preview and courtyard use that same distance scale.

The original Idle, Mount, Dismount and Pedal animation tracks are unchanged.
The courtyard blends between the upright Stand and the existing transition
endpoint; this pass does not re-author the bicycle movements. The comparison
clip was checked against the previous exported Walk and matches its animation
tracks exactly. It adds animation data rather than a second character mesh.

### Validation

- The exported Three.js asset reaches about 8 degrees of support-knee flexion
  at 30% of the cycle, compared with about 32 degrees before. The more densely
  keyed Blender source measures about 5 degrees there. Sampling/interpolation
  accounts for the difference. The swing knee peaks around 64 degrees.
- Elbow flexion is roughly 8–18 degrees, with under 5 degrees of relative wrist
  rotation variation. Tests also check opposite arm/leg timing and a wrist
  trajectory that rises and falls instead of staying on a horizontal line.
- Walking/standing deformation is sampled every half frame. The lowest walking
  vertex is about -0.4 mm, within the new 3 mm floor tolerance. Maximum sampled
  walking edge stretch is 1.72. The flat stance still passes the 5 mm travel-slip
  check. The report is tied to the exported GLB by its SHA-256.
- `npm test`: 21 passing tests, including support/swing knee behavior, upright
  standing, torso alignment, arm coordination, contacts and existing movement
  regressions. `npm run build` passes for all four entry pages.
- Browser review: side and front poses, previous/updated comparison at the same
  phase, playback, quarter speed, pause and keyboard timeline scrubbing. The
  walking page fits 1280×800 and 390×844 viewports. The courtyard loads the new
  standing pose and reaches a clicked ground destination. No browser warning
  or error entries were reported during these checks.

This remains a procedural flat-ground walk with the existing skin weights and
rigid shoes. Short turns and starts/stops still use blending rather than separate
foot-placement clips; toe articulation and cloth deformation remain simplified.
The comparison page is the place to judge the visible improvement before
continuing to the other movement work.

## Walking continuity — 15 September 2026

The upright walk still showed a braking effect as the legs changed direction.
The trailing ankle briefly reversed during push-off, the knee approached full
extension too abruptly, and the browser export reduced the authored motion to
24 linear segments per cycle.

The revised foot path joins stance and swing with continuous velocity and
acceleration. Heel roll, toe push-off and the airborne arc use smooth curves;
small clearance adjustments let the knee fold after push-off and release into
heel contact without locking. The authored timing uses 55% stance and 45% swing.
Pelvis height follows a periodic cubic curve with a shared contact velocity,
so weight transfer continues through the loop boundary. These are targets for
this character, rather than prescribed human gait measurements.

The Walk export now retains 97 keys and
[glTF cubic spline interpolation](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc#appendix-c-spline-interpolation).
`scripts/glb_animation.py` replaces only that animation in the standard export.
It aligns quaternion signs and computes periodic tangents in the exported
coordinate system, preventing discontinuities introduced by bone conversion.
The other six animation clips retain identical track values and timings. The
upright torso, relaxed arm swing, 1.32 m stride and 1.35 m/s travel speed remain.

### Validation

- `npm test`: 23 tests pass. New checks sample the actual Three.js animation
  for false planted-ankle reversals, terminal knee motion and continuous knee
  velocity at all 96 key boundaries, including the loop seam.
- The exported support knee remains above 4 degrees throughout the sampled
  cycle, avoiding lockout. Existing posture, arm, contact and transition
  regressions pass.
- Blender validation passes and updates the asset hash in `movement-check.json`.
  An additional check of every exported skinned vertex at 193 poses found a
  minimum height of about -0.37 mm, within the 3 mm ground tolerance.
- A direct comparison confirms that Idle, Stand, Mount, Dismount, Pedal and
  WalkBefore retain their previous animation tracks. The production build
  passes for all four viewer pages.

Review the updated walk in `/movement.html`, or use `/walking.html` for side,
front and slow-motion inspection. This remains a procedural flat-ground walk;
the visual feel still needs user review, particularly during short starts,
stops and turns that blend between poses.

## Step handoff timing — 15 September 2026

The phase inspection poses were accepted, but consecutive steps still felt as
though they briefly settled before continuing. The study already played one
continuous clip: the phase buttons seek within it, rather than queue separate
animations. There was no timer or restart delay to remove.

This pass changes only playback timing. A smooth periodic phase adjustment
passes through each heel-contact handoff faster and redistributes that time
within the step. For the interval spanning the final 10% and first 10% of the
source cycle, playback now takes about 162 ms instead of 196 ms at normal speed.
The full cycle still covers 1.32 m at the same average 123 steps/min. No Blender
poses, exported asset data, arm motion, or bicycle clips were edited.

Both the walking study and courtyard use the shared timing curve. Its velocity
stays positive and matches across step and cycle boundaries. Floor travel in
the study and a small courtyard body advance (at most 2.64 cm) follow the same
curve, preserving foot contact. This offset fades with the walk blend. Seeking
uses the inverse timing curve so named poses, scrubbing and previous-version
comparison remain aligned with the original animation.

Validation: all 26 tests and the production build pass. New checks cover
forward/reverse playback at 24, 60 and 144 fps, quarter speed, cycle overshoot,
exact phase selection, both planted feet (5 mm tolerance), and leg velocity
through consecutive step/loop joins. Browser checks at 1280×720 covered playback
from 100%, phase selection, comparison, slow motion, and courtyard walking.
No warning/error console entries were reported. This is a timing adjustment
for visual review, not a new gait or physics simulation.

## Removing motion within the step that looked like jitter — 15 September 2026

The timing adjustment did not remove all visible jitter. A local browser sample
of 90 animation frames had a median interval of 16.7 ms and a maximum of 17.6 ms,
with none above 25 ms. This did not reproduce a frame stall. Examining the asset
revealed an extra pelvis rebound of roughly 4 mm and a knee that bent, partly
straightened, then bent again during the same push-off/swing.

The Blender Walk now uses two smooth, low-frequency pelvis harmonics, producing
one rise and fall per step. The foot keeps rotating through toe-off and heel
contact instead of coming to angular rest at both boundaries. Its airborne
path matches position, velocity and acceleration to the contact paths, and two
broad clearance arcs replace the short corrective bumps. Together these let
the knee fold once into swing and extend into landing. The source and browser
GLB were rebuilt; the shared runtime timing and the other six clips remain
unchanged.

- All 28 tests pass, including new regressions for pelvis rebounds and repeated
  knee folding, plus the existing posture, foot-contact and loop-continuity
  checks. The production build passes.
- Blender validation passes. The support knee at 30% is about 7.3 degrees,
  swing peaks near 67.2 degrees, and the torso stays within 1.3 degrees of
  vertical. The asset report includes the new GLB hash.
- Sampling every exported skinned vertex at 193 poses found a lowest point of
  about -0.46 mm, within the 3 mm ground tolerance. A direct track comparison
  confirms that Idle, Stand, Mount, Dismount, Pedal and WalkBefore are unchanged.
- The walking study was reloaded and inspected at 1280×720 using the push-off
  pose and quarter-speed playback. No browser warning/error entries appeared.

The browser measurement describes this local run, not all devices. Visual
review of `/walking.html` remains the acceptance check for the procedural gait.
