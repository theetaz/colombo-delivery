# Combined Colombo street study

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

This is a camera-based art review. Driving, traffic, pedestrian simulation and
delivery jobs are future integration work. The road is a straight 190 m section
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
| Architecture | Seven families: veranda house, narrow balcony home, produce shop, cafe shop-house, heritage frontage, mixed-use apartments and wall/gate | 37,444 | 2,793,236 |
| Landscape | Twelve prefabs: three broadleaf trees, palm, lamp, railing, bench, planter, drain, bollard, utility pole and wall/gate | 8,444 | 749,036 |
| Landmark | Distant-view derivative of the existing Lotus Tower | 17,502 | 1,075,460 |

The three runtime GLBs total approximately 4.62 MB. The landscape kit embeds
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
- [Runtime exports and manifests](../../viewer/public/streets/composition/)
  record names, bounds, units and geometry counts.
- [Scene layout](../../viewer/src/streets/composition/layout.js) holds authored
  placements and camera views. The browser assembles the scene from the kits.

From the repository root, using Blender on macOS:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python studies/colombo-road/streets/composition/build_architecture.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python studies/colombo-road/streets/composition/build_landscape.py
npm run study:test
npm run study:build
```

On other platforms, substitute the installed Blender executable. The generators
rebuild their own source scenes and exports; keep manual modeling refinements
in the generators or save an independent version before regenerating.

## Refinements in this checkpoint

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

Validation: all 52 viewer tests and the production build pass. Browser checks
cover asset loading, preset selection and tour start/pause with no console
warnings or errors. Exported geometry, materials, prefab bounds and source
portability were checked independently. The approved movement and map files
retain their previous hashes.

The [PaperRoute development archive](https://www.paperroute.lol/devlog/)
informs the use of separate asset studies, authored building families and
layered gardens before wider scene integration. This study uses original
Colombo-inspired assets and the project's existing landmark model.
