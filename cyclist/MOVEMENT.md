# Walk and ride courtyard

Open **http://127.0.0.1:5175/movement.html** with the adjacent viewer running.
The approved pedal inspection page is still at `/cyclist.html`; its character,
bicycle and pedal files are unchanged.

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

The same textured character uses Idle, Walk, Mount, Dismount and the approved
Pedal clips. Walking speed drives the gait. Mount/dismount clips share exact
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
turn-in-place clips. Mounting is authored for this bicycle and can need further
anatomical polish. Dismounting reverses that movement. The parked bicycle is
stabilized by the controller; it does not fall over.

## Assets and rebuilding

`courier-movement.blend` contains the five animation actions on a copy of the
approved rig. `../viewer/public/cyclist/courier-movement.glb` is its browser
export. It reuses the existing geometry, textures, skin weights and grip shape;
no new character reconstruction was requested. The source and rights notes in
`README.md` apply to this derived local testing asset too.

From the parent asset directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/build_movement.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/validate_movement.py
```

Then run `npm test` and `npm run build` in `../viewer`. Tests exercise the
walk/ride state sequence, parking, proximity, speed and clearance restrictions,
pause, click-to-walk and boundaries. The exported clips are loaded by Three.js
to verify their durations, loop seams and matching transition endpoints.
`movement-check.json` samples the Blender deformation and ground clearance.
These checks do not replace visual review of the movement.
