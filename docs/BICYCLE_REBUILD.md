# Commuter bicycle rebuild

## Status

The earlier combined bicycle-and-rider prototype passed structural and runtime
checks, but final human review rejected its inaccurate bicycle proportions and components, inverted wrists, clothing
distortion, saddle fit, and grip contact. It remains historical prototype
evidence and is superseded for art work.

The replacement is a standalone, unbranded commuter bicycle. Its
Blender source defines metre-scale geometry, wheel and crank axles, an inclined
steering axis, pedal spindles, and explicit seat, grip, and pedal anchors. It
does not change the current game vehicle.

The user approved the bicycle-only form and components on 2026-09-13 and asked
to proceed with fitting the character. That approval applies specifically to
GLB SHA-256
`ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`.
The approved export is frozen while the separate stationary rider fit is
reviewed. It does not approve a rider pose, animation, or simulation binding.

## Review sequence

1. Give the bicycle-only export to a human in `bicycle-model-review.html`.
2. Correct its proportions, manufacture details, and pivots until approved.
3. Fit the existing character to the approved saddle, grips, and pedals. This
   stationary fitting stage is now in progress.
4. Review a controlled pedal cycle, followed by steering poses.
5. Bind approved animation to simulation. Simulation owns travel, steering
   input, wheel speed, and collisions; animation consumes those values.

Programmatic checks cover units, bounds, names, hierarchy, pivot axes, and file
integrity. Visual acceptance is a short human decision; automated screenshot or
pixel scoring is not an approval gate.

## Standalone contract

The asset is `models/commuter_bicycle_v2.glb`, revision
`commuter-bicycle-v2/1`: metres, +Y up, -Z forward, +X rider-right, ground Y=0,
and sole root `CommuterBicycleV2`. `RearWheel` and `FrontWheel` roll around local
X. `FrontAssembly` steers around its inclined local Y axis. `Crank` rotates
around local X; its `Pedal_L` and `Pedal_R` children counter-rotate around local
X. Contact nodes are `Seat_Attach`, `Grip_L_Attach`, `Grip_R_Attach`,
`Pedal_L_Attach`, and `Pedal_R_Attach`.

The first-review export measures 0.69237 m wide, 1.032 m high, and 1.79843 m long. It contains 13,844 triangles in 529,760 bytes. Its 700C wheels have a 0.349 m outer radius; wheelbase is 1.093 m, head angle 69.5°, bottom-bracket drop 0.060 m, chainstay 0.450 m, and perpendicular fork rake 0.045 m. These proportions reference Cannondale's official Quick medium table in its [MY20 dealer book](https://www.cannondale.com/-/media/files/manual-uploads/manuals/my20_cannondale_dealerbook.ashx).

The GLB SHA-256 is `ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`; the editable Blender SHA-256 is `e916f8d594b209772900b6a9938446d4f89d58cfa94462612a1e4d662eec5ae2`. Structural validation passed, and the user approved this exact GLB after bicycle-only visual review on 2026-09-13. The next gate is the [stationary rider fit](RIDER_FIT.md). Animation and simulation remain blocked until that fit receives separate human approval.

## Rebuild and review

The editable source is [commuter_bicycle_v2.blend](../art/bicycles/commuter-v2/commuter_bicycle_v2.blend).
Recreate the source and browser export from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/bicycles/commuter-v2/generator.py
npm run build
```

The generator intentionally writes a fresh candidate manifest with
`awaiting-human-review`. Regeneration therefore does not inherit the approval
of the frozen hash above. Compare the new GLB hash and obtain another bicycle
review before treating regenerated output as approved.

Open `/bicycle-model-review.html` on the local development or preview server.
The model starts stationary. Use Front, Drive side, Opposite side, and Rear,
then try Spin wheels, Turn crank and pedals, and the Steering slider.
Stop & reset mechanics returns the moving parts to their initial positions.
Wheel and crank demonstrations are independent; gear ratios, chain travel,
freehub behaviour, rider animation, and vehicle dynamics are later work.

Describe the view, component, and desired change in the notes field, then copy
the notes into the development discussion or download them. Notes are local
and are not submitted automatically. This route remains available for checking
future regenerated candidates; the frozen hash recorded above is approved.

## Checks and lessons

All 58 tests, TypeScript checking, and the production build pass. The new
export loads through the real GLTFLoader, its tyres touch the ground, pedals
retain their orientation through 24 crank positions, and steering retains the
authored inclined axis. Existing rider tests emit texture-loading warnings in
the Node environment; Vite retains its shared-chunk size advisory. Neither
these checks nor the earlier tests establish visual quality.

The initial fork placement differed from the declared 45 mm rake. The source
now derives the head-axis position from that perpendicular distance and checks
it against the export. Floating drivetrain rings were replaced with connected
toothed plates and spiders, and the saddle received a tapered nose. A reported
front-wheel ground error was traced to rotated bounding-box inflation; exact
exported vertex bounds confirmed ground contact and prevented an unnecessary
geometry correction. No screenshot or computer-vision acceptance pass was run.
