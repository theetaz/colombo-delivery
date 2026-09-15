# Colombo street art study

Status: implementation and automated validation complete on 15 September 2026;
human visual review remains pending.

## Delivered study

The existing map and Drive views can now switch between **Source** and
**Dressed** streets. Dressed mode adds metre-scaled procedural asphalt with a
6 m texture repeat, a matte finish and fine bump, warm bounded PCF shadows,
inferred white lane treatment, and the six-family building kit. **Inferred
traffic flow** separately toggles teal direction arrows; they explain the
routing interpretation and are not road paint. The dedicated street camera
opens on the Vauxhall area.

The source toggle restores the original source materials and building triangles
so the art pass can be compared without changing the saved geographic asset.

## Run and review

From the repository root:

```sh
npm run study:install
npm run study:dev
```

Open [the dressed street preset](http://127.0.0.1:5175/#street). Validate it
with:

```sh
npm run study:test
npm run study:build
```

Human visual review remains pending. Review should check readable asphalt at
road level, marking direction in left-hand traffic, false markings at
junctions, repeated or intersecting buildings, scale beside the cyclist, and
preservation of named landmarks. Automated checks can establish deterministic
generation and source-tag handling; they cannot establish current real-world
paint, building appearance, legal stopping, or street safety.

The viewer test suite passes 46 of 46 tests and the production build succeeds.
Browser checks confirmed the Street preset, Source/Dressed switching, independent
road and building controls, the flow overlay, and the existing Drive pilot load
without console warnings or errors. Visual acceptance is left to human review.

## Road truth and marking rules

Sri Lanka drives on the left. Section 148 of the official
[Motor Traffic (Amendment) Act, No. 21 of 1981](https://documents.gov.lk/view/acts/1981/3/21-1981_E.pdf)
requires a moving motor vehicle to keep to the left or near side, except while
overtaking or turning right.

The official [Motor Traffic (Signs, Signals, Symbols and Road Markings)
Regulations, No. 02 of 2015](https://documents.gov.lk/view/extra-gazettes/2015/11/1940-21_E.pdf),
Gazette Extraordinary 1940/21, publishes the sign and road-marking diagrams
verified for this study. Its rules make placement meaningful: for example,
RM-01 is a stop line, RM-02 is a give-way line, and RM-13 divides marked
traffic lanes. These
marks cannot be inferred merely from the presence of a road.

The study therefore follows these constraints:

- Use the direction and lane count normalized from the bundled OSM snapshot
  before adding a centre or lane divider.
- Keep travel and roadside placement consistent with left-hand traffic.
- Do not assume that an untagged road is a two-lane, two-way road.
- Do not invent stop or give-way lines, zebra crossings, junction boxes, turn
  arrows, bus lanes, cycle lanes, or parking restrictions where the saved data
  does not establish them.
- Treat asphalt colour, surface wear, and any unverified line width as visual
  study choices. The Gazette is the authority for marking diagrams and allowed
  dimensional variation; this pass does not claim surveyed placement or exact
  engineering dimensions.

The current visual defaults use 0.26 m centre lines, 0.20 m lane lines, a 3 m
dash with a 5 m gap, and 9 m masking around graph junctions. Treatments require
mapped lanes and skip tunnels, roundabouts, conditional tagging, and assumed
lower-class directions. These dimensions and placement rules are procedural
art choices rather than claims about current paint. The teal flow overlay uses
the same derived direction separately; tests cover left-side placement and
ensure the two-lane one-way D. R. Wijewardene Mawatha example has no opposing
arrow.

The bundled preprocessing has a narrower data contract than a road survey.
Explicit OSM `oneway=yes`, `1`, or `true` values become source-forward travel;
`-1` reverses travel; and `no`, `0`, or `false` permits both graph directions.
Roundabouts and motorways imply source-forward travel under OSM conventions.
Conditional or unknown direction values are withheld from the base graph. A
missing direction tag currently permits both graph directions as a documented
routing assumption, but it is not evidence of a painted centre line. Plain
integer `lanes` values from 1 through 12 are retained; `lanes × 3.2 m` is only
an estimated road width where no mapped width is usable. Directional lane
counts, lane changes, and the existence or condition of paint remain
unverified unless separately sourced.

## Original environment assets

The asset pass contains six original Blender building families with varied
footprints, heights, roof forms, frontage rhythms, and muted material palettes:
`heritage-shop` has a colonnaded verandah, `town-house` uses stacked balconies,
`corner-shop` has a deep awning, `courtyard-house` combines a boundary court and
tiled roof, `mixed-use` places shops below balcony flats, and `apartment` is a
balcony-and-parapet tower.

Runtime placement uses a stable seed and source building IDs so repeated builds
reproduce family and palette choices. The current schema-v2 artifact contains
12 high-confidence replacements: four `corner-shop`, four `heritage-shop`,
three `courtyard-house`, and one `mixed-use`. All six families remain available
in the kit; `town-house` and `apartment` did not safely match the selected
source footprints and heights. Uniform scale ranges from 0.8301 to 1.0458.

Each rotated family bounding rectangle must fit inside the exact mapped source
polygon, including its holes. The facade's positive-Z axis faces the nearest
target road. Placements preserve the source base height, clear water, clear
every non-tunnel road by its half-width plus 0.5 m, clear other mapped buildings
by 0.25 m, and clear other dressed buildings by 1 m. A 35 m local repeat guard
avoids adjacent copies of the same family. Named and institutional source
buildings are excluded, preserving the distinct Colombo landmarks. Independent
validation reported zero failures in every containment and clearance category.

`generate_building_kit.py` builds the editable
`colombo-building-kit.blend` here, plus `colombo-building-kit.glb` and
`building-kit.manifest.json` under `viewer/public/streets`. Validation confirms
six named root nodes and the shared
ground-centred, Y-up, positive-Z facade contract. The kit has 48
material-merged mesh nodes, 45,140 triangles, and a 3,180,688-byte GLB. These
checks establish the asset contract, not visual acceptance in the street.

Rebuild deterministic placement data from the repository root with:

```sh
node studies/colombo-road/viewer/scripts/prepare-street-placements.mjs
```

The visual workflow is informed by PaperRoute's public
[development archive](https://www.paperroute.lol/devlog/), without copying its
assets. Checkpoint 14 separates character, house, tree, and prop studies before
integration; checkpoint 16 introduces authored Blender house families;
checkpoint 17 expands family variety and layers planting around street
boundaries; and checkpoint 19 tests a painterly surface language in a small
street slice. Colombo Delivery applies that sequence to its own geometry,
materials, road data, and landmark assets.
