# First assembled street environment

This checkpoint turns the selected garden, neighborhood shop and lakeside
direction into one environment that can be explored at courier scale.
It uses the approved vegetation candidates and a small set of new exterior
assets. The 190 m corridor is an authored Colombo-inspired pilot, not a
surveyed reconstruction of a named street or the complete Colombo network.

## Asset choices

Every new generation has a role in this first environment. One candidate is
generated for each of these five assets. Five P1 detailed-texture jobs used
250 credits in total. Uniform resizing, cleanup and distance-detail work
happen locally in Blender; there were no paid retries or regeneration steps.

| Asset | Why it is needed | Reuse in the environment |
| --- | --- | --- |
| `environment.neighborhood-market-01` | A recognizable parcel pickup shop | Neighborhood markets and produce frontages |
| `environment.corner-cafe-01` | A second pickup frontage with a distinct silhouette | Narrow shop houses and cafés |
| `environment.verandah-house-01` | A residential delivery destination | Garden homes with varied setbacks |
| `environment.courtyard-apartments-01` | A larger residential destination and taller streetscape | Compact apartment frontages |
| `environment.hibiscus-shrub-01` | Flowering planting between grass and tree height | Garden edges and small landscape groups |

The existing rain tree, rounded tropical tree, coconut palm, short grass and
tall grass supply the rest of the planting. Existing asphalt and paving,
benches, lamps, the distant Lotus Tower, courier and bicycle are
reused. These already cover their roles in this scene. Further vehicle and
building families can be chosen from actual gaps found during playtesting.

The generation recipes, immutable source hashes, editable Blender files and
measured runtime exports are recorded in the
[environment asset package](../studies/colombo-road/environment/README.md).
The earlier [vegetation package](../studies/colombo-road/vegetation/README.md)
remains available as its own comparison study.

The scene places 12 buildings, 14 trees and 24 grass or flowering shrub groups.
Every generated model has two geometry levels; the viewer selects the reduced
version beyond 46 m. Geometry and textures are reused across placements.
The four marked addresses represent two pickup shops and two residential
drop-offs. They are references for a later job loop, not real business entries
or a parcel economy in this page.

## Assembly rules

- Keep the two left-hand lanes, pavements, ramps and lakefront recognizable.
  Root placement and collision footprints must agree with the visible scene.
- Use actual exported dimensions for setbacks and spacing. Alternate building
  families and vary planting groups without rotating frontages away from the
  road or putting trees into entrances and clear walking paths.
- Give each reusable model an asset ID and each placement its own instance
  ID. Delivery references identify a specific building and an exterior approach.
- Generated geometry does not prove where an entrance is. The initial
  collection points are explicitly authored exterior interaction references,
  not automatically detected doors or verified real business addresses.
- Preserve the approved courier, bicycle and animation source files. Adapt
  exploration to this corridor's bounds and surfaces rather than importing
  the earlier courtyard's collision limits.
- Animate prepared foliage weights with matching shadow motion. Keep lights
  and weather effects separate from the unchanged material and source assets.

## Review

Open [Lake Garden Street](http://127.0.0.1:5175/environment.html) after starting
the study server. Use **W/A/S/D** or the arrow keys to move. **E** approaches
and mounts the nearby bicycle; brake with **S**, stop, then press **E** again
to settle the pedals and dismount. The onscreen hint explains proximity and
clearance requirements. **Space** or **Pause** freezes motion.

Garden, Shops, Lakeside and Overview select orbitable inspection views.
The four named stop buttons focus their exterior approaches. Choose
**Follow courier** to resume movement. Light, weather and wind selections
allow Sunny/Dusk/Night, Clear/Rain and Calm/Breeze/Strong comparisons.

Human playtesting determines whether the street looks natural and feels good
to move through. Check building fronts and proportions, pavement clearance,
planting variety, bicycle and foot contact, exterior delivery approaches,
night lighting and motion. Note the location and conditions when reporting a
problem. Geometry and runtime checks support this review; they do not certify
the appearance or real-world road accuracy.

Exploration uses a bounded movement corridor: walking can reach both pavements,
while cycling stays on the carriageway. It is an assisted game controller,
not a general rigid-body collision or traffic-rule system. Delivery markers
do not award money or start jobs yet. The ten new GLBs total about 31.2 MiB;
the two LODs share texture objects after load but both files are downloaded.
Further streaming and texture compression remain useful before city expansion.

The isolated studies in the [Paper Route development archive](https://www.paperroute.lol/devlog/)
remain a reference for testing a small reusable asset family before expanding
the world. Original project models and generation recipes supply this scene.
