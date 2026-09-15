# Colombo road vegetation assets

These files are prepared from immutable Tripo source meshes. Each asset keeps a compressed, editable Blender file here and publishes independent LOD0 and LOD1 GLBs to `../viewer/public/vegetation`.

Status: first candidates, awaiting human appearance feedback. The existing
street composition has not been populated with these models.

## Review the kit

From the repository root, run `npm run study:dev` and open
[Vegetation review](http://127.0.0.1:5175/vegetation-review.html). Select a tree
or grass form, orbit and zoom, then compare Calm, Breeze and Strong wind.
Change direction, pause motion, and compare sunny, overcast and rainy lighting.
The review exposes both model LODs and editable Blender downloads.

| Asset ID | Form | Height | LOD0 triangles | LOD1 triangles |
| --- | --- | ---: | ---: | ---: |
| `vegetation.rain-tree-01` | Spreading rain tree | 8 m | 14,971 | 6,736 |
| `vegetation.round-tree-01` | Rounded tropical evergreen | 6 m | 9,801 | 4,410 |
| `vegetation.coconut-palm-01` | Coconut palm | 9 m | 9,764 | 4,393 |
| `vegetation.short-grass-01` | Short roadside tuft | 0.25 m | 2,882 | 1,296 |
| `vegetation.tall-grass-01` | Tall fountain grass | 0.9 m | 4,359 | 1,958 |

These are silhouette briefs, not verified botanical reconstructions. Judge
branch structure, canopy gaps, blade density, texture quality and ground
contact from front, side and close views. Compare LODs for excessive shape
loss, and look for sliding roots or rubbery movement under Strong wind.
Feedback should name the asset, view and wind/weather setting.

## Source record

Five original text prompts produced five Tripo `P1-20260311` candidates with
detailed PBR textures. No paid regeneration or cleanup task was submitted.
[Generation recipes](sources/generation-recipes.json) preserve exact prompts,
parameters, task IDs and raw output hashes. The service did not return seeds,
so the record explicitly marks them unavailable. Repeating a prompt is not
a guarantee of identical geometry; preserve the downloaded source bytes.

Original downloads are archived outside the repository. The Blender files
and runtime GLBs are the public deliverables. Generated source rights remain
subject to the applicable Tripo terms and account plan; these notes do not
assign a new asset license.

Blender authors in Z-up metre space. GLB export converts to Y-up. The script centres each asset in X/Y and places its lowest point at Z=0. It packs textures after limiting their longest edge to 1024 pixels.

## Regeneration

Use Blender 5.1.2 with factory settings and add-ons disabled. Raw sources stay outside the repository.

```sh
VEGETATION_SOURCE_ROOT=/absolute/path/to/immutable/vegetation/2026-09-15

/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/vegetation/prepare_vegetation.py -- --id vegetation.rain-tree-01 --source "$VEGETATION_SOURCE_ROOT/rain/model.glb" --height 8 --kind tree
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/vegetation/prepare_vegetation.py -- --id vegetation.round-tree-01 --source "$VEGETATION_SOURCE_ROOT/round/model.glb" --height 6 --kind tree
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/vegetation/prepare_vegetation.py -- --id vegetation.coconut-palm-01 --source "$VEGETATION_SOURCE_ROOT/palm/model.glb" --height 9 --kind palm
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/vegetation/prepare_vegetation.py -- --id vegetation.short-grass-01 --source "$VEGETATION_SOURCE_ROOT/short/model.glb" --height 0.25 --kind grass
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/vegetation/prepare_vegetation.py -- --id vegetation.tall-grass-01 --source "$VEGETATION_SOURCE_ROOT/tall/model.glb" --height 0.9 --kind grass
```

Use `tree`, `palm`, or `grass` for `--kind`. LOD1 defaults to 45% of the source triangle count; override it with `--lod1-ratio` when decimation damages the silhouette.

## Wind data contract

The exporter writes wind data to `COLOR_0`: red is broad bend influence, green is flutter influence, and blue is a stable phase value. Roots are locked with a height ramp. Trees and palms also estimate foliage from the base-colour texture at each vertex UV. This is a practical heuristic for fused generated meshes, not a hand-authored botanical rig.

The runtime shader must consume `COLOR_0` only as wind data. It must not enable vertex-colour tinting or multiply `COLOR_0` into the material base colour.

The included [wind shader](../viewer/src/vegetation/wind.js) applies coherent
canopy sway and smaller leaf flutter, with matching shadow deformation.
These GLBs contain motion weights rather than baked animation clips. Loading
them in another viewer requires the shader to animate them. Rain, lighting
and wetness are preview effects; branch breakage, cloth, seasonal growth and
physical weather simulation are outside this trial.

## Checks

After regeneration, inspect the manifest and verify all published files numerically:

```sh
python3 studies/colombo-road/vegetation/validate_vegetation.py
```

The validator checks file existence and size, triangle counts, Y-up GLB metadata, bounds, material names, texture dimensions, source hashes, and the `COLOR_0` accessor. Appearance is deliberately left to human review.
