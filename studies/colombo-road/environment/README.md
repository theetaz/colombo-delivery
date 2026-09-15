# Colombo environment essentials

These assets retain genuine generated geometry and PBR textures. Blender files contain near and mid LOD meshes with packed textures. Published GLBs use metre scale, a ground plane at Y=0, Y-up, and +Z as the assumed curb-facing direction. Building front anchors are explicit interaction references at the centre of the assumed front bound; they are not detected doorways. Human review remains responsible for visual quality and orientation.

Building collision footprints currently use the full visual X/Z bounds. They are deliberately conservative and may include roof, awning, or balcony overhangs. Runtime placement uses the front anchor to land the building at the curb. Materials remain double-sided because generated topology may contain open surfaces; converting them to culled materials requires human normals and appearance review.

## Regeneration

Run from the repository root with Blender 5.1.2 and immutable sources outside the repository:

```sh
SOURCE_ROOT=/absolute/path/to/street-essentials/2026-09-15
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/environment/prepare_environment.py -- --id environment.neighborhood-market-01 --source "$SOURCE_ROOT/market/model.glb" --width 7 --kind building
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/environment/prepare_environment.py -- --id environment.corner-cafe-01 --source "$SOURCE_ROOT/cafe/model.glb" --width 6 --kind building
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/environment/prepare_environment.py -- --id environment.verandah-house-01 --source "$SOURCE_ROOT/house/model.glb" --width 8 --kind building
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/environment/prepare_environment.py -- --id environment.courtyard-apartments-01 --source "$SOURCE_ROOT/apartments/model.glb" --width 9 --kind building
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python studies/colombo-road/environment/prepare_environment.py -- --id environment.hibiscus-shrub-01 --source "$SOURCE_ROOT/shrub/model.glb" --height 1.1 --kind shrub
python3 studies/colombo-road/environment/validate_environment.py
```

## Prepared measurements

| Asset | Width | Depth | Height | Near triangles | Mid triangles |
|---|---:|---:|---:|---:|---:|
| Neighborhood market | 7.000 m | 10.133 m | 5.176 m | 14,223 | 6,399 |
| Corner cafe | 6.000 m | 5.930 m | 4.685 m | 13,333 | 5,998 |
| Verandah house | 8.000 m | 9.574 m | 5.152 m | 14,282 | 6,426 |
| Courtyard apartments | 9.000 m | 9.000 m | 8.436 m | 15,231 | 6,853 |
| Hibiscus shrub | 1.096 m | 1.087 m | 1.100 m | 4,256 | 1,915 |

These dimensions result from uniform scaling. The market and house include relatively tall roof/parapet envelopes for one-floor briefs; the cafe is compact for two floors. These proportions remain unchanged for human review.
