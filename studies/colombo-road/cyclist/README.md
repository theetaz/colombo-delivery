# Colombo cyclist — first animation study

Open **http://127.0.0.1:5175/cyclist.html** while the adjacent viewer is running.
This is a local inspection asset, before integration with the delivery game.

## Review

- Play or pause pedaling; adjust cadence from 10 to 90 rpm.
- Scrub the pedal position while paused. Check 0°, 90°, 180° and 270°.
- Use the side, rear, face, hands and pedals cameras. Drag to orbit or zoom.
- Switch to neutral clay to inspect deformation independently of textures.
- `colombo-cyclist.blend` contains the rider, fitted bicycle and synchronized
  two-second pedal animation. Open it in Blender and play frames 1–49 at 24 fps.
- `bicycle-fitted.blend` is the bicycle alone. The two browser models are
  `../viewer/public/cyclist/rider.glb` and `bicycle-fitted.glb`.

The current milestone includes a textured courier, an anatomical skin rig,
seated cycling animation, steady shoe contacts and synchronized bicycle parts.
It is **not a completed riding controller**. Detailed finger closure, steering
with moving hand targets, balance and lean, mounting/stopping, collision,
road contact, acceleration and braking are subsequent work. Wheel motion here
uses an illustrative fixed 2.8:1 ratio; no drivetrain or road forces are simulated.
The result has not been approved as matching the reference's final quality.

## Reference and source

Visual direction: [PaperRoute development blog](https://www.paperroute.lol/devlog/).
Its staged work on posed riders, clothing, texture, rigging and motion informs
the process. No PaperRoute mesh, texture or game source is included.

The visible courier reuses the existing Colombo teen courier reconstruction:
the original character concept, Tripo P1 reconstruction and local teal-shirt
cleanup. The original textured surface and UVs are retained; stature is uniformly
scaled to approximately 1.81 m. This pass replaces the earlier deformation rig.
The source files are preserved in `source/`. Source-account commercial export
rights were not established in the existing asset records; this package remains
for local testing pending that confirmation.

The bicycle is the existing original project artwork, with no external mesh,
texture or brand mark. The approved original GLB remains unchanged as
`../viewer/public/cyclist/bicycle.glb`, SHA-256
`ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125`.
The fitted copy lowers the adjustable saddle by 80 mm and moves it forward
29.73 mm along the seat-post line. The frame, wheels and steering geometry
retain their original dimensions.

## Rebuild and checks

Requires Blender 5.1. Run these from the parent asset directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/fit_bicycle.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/build_cyclist.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python-exit-code 1 --python cyclist/scripts/validate_cyclist.py
```

The body has 8,951 source vertices, 17,681 triangles and 19 deformation bones.
Skin weights are solved on a closed anatomical volume and transferred to the
original surface; isolated unbound hand tips are repaired within their own hand.
Export uses at most four normalized influences per vertex.
An editable `HandlebarGrip` shape adds a first finger-curl correction; individual
finger articulation and brake-lever operation are not included yet.

`../viewer/public/cyclist/geometry-check.json` records the actual source mesh
and 49 sampled frames: complete skin coverage, loop seam, shoe clearance and
ankle target error. The viewer's `npm test` also samples the exported GLB with
Three.js to check pedal alignment after coordinate conversion. These are
structural checks; visual judgment of the hands, clothing and motion is still
required. Texture compression and lower-detail variants have not been added.
