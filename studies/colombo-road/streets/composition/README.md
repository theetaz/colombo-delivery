# Colombo living street study

The selected visual direction combines the three
[street concepts](../concepts/2026-09-15-directions/README.md):

- **A — Green neighborhood:** mature tree shade, residential verandas, garden
  walls and setbacks, and small gaps between buildings.
- **B — Neighborhood shops:** varied shop-houses, balconies, produce displays,
  awnings and worn street materials.
- **C — Lakeside street:** a civic promenade, benches and railings beside water,
  with the Lotus Tower as a distant landmark.

This is an authored street composition for visual development. The source
Colombo road network remains the geographic reference for later integration;
this scene does not claim to reconstruct one surveyed street.

## Review

Run `npm run study:dev` from the repository root, then open
[the combined street study](http://127.0.0.1:5175/street-composition.html).

Choose **Garden**, **Shops** or **Lakeside** to jump between review views.
Drag to orbit, scroll to zoom, and right-drag to pan. **Street tour** starts a
camera journey along the section; **Pause tour** stops it for inspection.

The scene is ready for human visual feedback. Check:

1. Whether homes, shopfronts, verandas and balconies have believable proportions.
2. Whether the tree canopy provides shade without overpowering the street.
3. Whether pavement widths, driveway access and roadside details feel natural.
4. Whether the transition from gardens and shops to the lakefront is convincing.
5. Whether the asphalt, paving, foliage and building surfaces need more detail.

The living-street expansion adds more tree forms, flowering plants, grass,
supermarket and residential facades, exterior delivery addresses, night-time
lighting and background traffic. The
[asset and address guide](ASSET_GUIDE.md) explains how reusable models,
individual placements and delivery entrances are kept separate.

This is a camera-based art review with ambient road users. Player driving,
city traffic rules, pedestrian simulation and delivery jobs are future
integration work. The road is a straight 190 m section
with two 4 m lanes, 2.4 m pavements and a 3.4 m promenade extension. These are
composition dimensions; markings are visual defaults. The approved rider and
bicycle previews remain available through the district review.

## Asset approach

Architecture and landscape are authored as separate editable Blender kits.
Their exported objects use metres and a consistent ground origin, so scene
placement can preserve proportions. Buildings vary in footprint, roofline and
frontage; trees and street furniture repeat with deliberate spacing rather than
forming identical rows.

| Kit | Contents | Export triangles | GLB bytes |
| --- | --- | ---: | ---: |
| Architecture | Eleven families: the original houses, shops and wall/gate plus a supermarket, pharmacy/parcel shop, modern courtyard apartments and louvered lane house | 81,600 | 4,578,068 |
| Landscape | Twenty-four prefabs: the original trees and civic props plus five distinct tree/palm forms, two flowerbeds, two grass forms, shrub, fern and groundcover | 15,316 | 1,208,988 |
| Traffic | Compact car, delivery van, helmeted scooter rider and articulated bicycle rider | 12,584 | 944,436 |
| Landmark | Distant-view derivative of the existing Lotus Tower | 17,502 | 1,075,460 |

The four runtime GLBs total approximately 7.81 MB. The landscape kit embeds
its original 512 × 512 leaf atlas, also packed into the Blender source. Tree
branches and leaf cards are merged by material; repeated objects are instanced
in the viewer. The table reports each exported kit once, not scene totals or a
frame-rate guarantee. Some kit pieces are retained for future arrangements.

## Sources and rebuilding

- [architecture.blend](architecture.blend) and
  [build_architecture.py](build_architecture.py) contain the architecture kit.
  The same generator creates the separate Lotus Tower LOD from the retained
  [original landmark](../../source/lotus-tower-original.glb).
- [landscape.blend](landscape.blend) and
  [build_landscape.py](build_landscape.py) contain the landscape kit and original
  branch-spray artwork. Prefabs share a ground-centred origin; isolate a named
  root in Blender to inspect it.
- [traffic.blend](traffic.blend) and [build_traffic.py](build_traffic.py) contain
  the background vehicles and riders. Their manifest records wheel radii,
  motion pivots and rider contact points.
- [Runtime exports and manifests](../../viewer/public/streets/composition/)
  record names, bounds, units and geometry counts.
- [Scene layout](../../viewer/src/streets/composition/layout.js) holds authored
  placements and camera views. The browser assembles the scene from the kits.

From the repository root, using Blender on macOS:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python studies/colombo-road/streets/composition/build_architecture.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python studies/colombo-road/streets/composition/build_landscape.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python studies/colombo-road/streets/composition/build_traffic.py
npm run study:test
npm run study:build
```

On other platforms, substitute the installed Blender executable. The generators
rebuild their own source scenes and exports; keep manual modeling refinements
in the generators or save an independent version before regenerating.

## Living street checkpoint

The first combined composition received positive human feedback and became the
basis for this expansion. The added assets are ready for a new visual review;
that feedback has not yet been collected.

- **Time** selects Day, Dusk or Night. **Automatic day cycle** changes the
  lighting over a 90-second cycle. Civic lamps and promenade bollards illuminate
  the nearest pavements, with warm windows and vehicle light lenses after dark.
- **Motion** pauses the environment and camera tour. **Traffic** and **Wind**
  control their individual layers. Background tabs and reduced-motion settings
  pause environment motion too.
- **Delivery locations** focuses one of five exterior pickup/drop-off addresses.
  The inspector shows its stop and building IDs; its marker sits on the adjacent
  pavement. No building interior is needed.
- **Export registry JSON** saves the asset catalogue, placed-object IDs,
  district/road/block references, entrances and pavement approaches. Stable
  placement IDs remain independent of the reusable model selected for them.
- Eight background road users use the two left-hand lanes: compact cars,
  delivery vans, scooters and bicycles. This bounded loop has spacing controls,
  rolling wheels and articulated cyclist legs; it is not a complete traffic
  or vehicle-physics simulation.

The architecture catalogue now includes 11 families, with 14 building placements
and a separate garden boundary gate. Planting adds rain-tree, mango,
frangipani, flowering-tree and coconut-palm forms, warm/cool flowers, grass,
ferns, shrubs and groundcover. Wind moves flexible planting while trunks and
roots remain anchored. These are stylized Colombo-inspired forms rather than
botanical or surveyed-building replicas.

Review refinements corrected foot-to-pedal reach, opposite crank placement and
limb-chain transforms in the background cyclist. Separate checks retained the
existing asphalt/paving textures, driveway ramps, curbs and shoreline while
adding the new scene layers. Delivery entrances now use the actual exported
model anchors rather than hand-estimated facade positions.

Validation: all 77 viewer tests and the production build pass. The exported
background bicycle is sampled at 144 crank positions in each direction; both
feet stay within the 2 mm contact tolerance without stretching either leg.
Registry tests cover duplicate and missing IDs, model references, door anchors,
block relationships and planting clearance. Ground/wind tests cover textures,
ramps, UV continuity and matching shadow deformation.

Browser checks confirm ready status, one canvas, Day/Night light activation,
Motion/Traffic/Wind controls and supermarket destination focus. Motion clocks
and traffic positions stay unchanged while paused. At 390 × 844, the controls
fit without horizontal overflow or panel overlap. No console warnings or errors
were recorded after the final clean reload. These are functional checks; no
automated screenshots or visual scoring replace human feedback.

The runtime registry contains 178 placed instances, 199 world/entity/address
IDs and 43 catalogue entries, including procedural ground and lights. The
approved movement, rider, fitted bicycle and map asset hashes remain unchanged.

## First composition checkpoint

- Reduced repeated landscape meshes from 130 to 26 in the export, with material
  merging and runtime instancing.
- Replaced oversized individual leaf cards with multi-leaf branch sprays;
  retained opaque palm fronds and alpha-cutout broadleaf foliage.
- Corrected driveway surface continuity, prop base heights and pavement UV
  scale during implementation review.
- Preserved the landmark's original proportions in a smaller distant-view
  export, with water and shoreline context.
- Kept concept selection separate from final 3D approval. No automated visual
  inspection substitutes for the human review above.

Validation at `c182fe1`: all 52 viewer tests and the production build pass. Browser checks
cover asset loading, preset selection and tour start/pause with no console
warnings or errors. Exported geometry, materials, prefab bounds and source
portability were checked independently. The approved movement and map files
retain their previous hashes.

The [PaperRoute development archive](https://www.paperroute.lol/devlog/)
informs the use of separate asset studies, authored building families and
layered gardens before wider scene integration. This study uses original
Colombo-inspired assets and the project's existing landmark model.
