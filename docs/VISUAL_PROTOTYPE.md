# Warm illustrated visual prototype

## Purpose and status

This bounded visual slice tests whether the existing Lotus Tower road and
delivery prototype can support a warm, readable illustrated world. It covers a
small reusable scenery kit, GLB export, scene placement, an isolated art
preview, and a clearer temporary rider. It does not expand the map, validate a
delivery route, or establish the final art direction.

The asset kit, isolated preview, decorative placement, scene treatment, and
rider update are implemented in the current checkout. Initial Chrome review
confirmed that the ten preview roots and the intended production-scene elements
render. Desktop and mobile overflow checks and a production delivery pass are
complete; longer-ride performance and final art review remain open.

## Visual direction

The target is a compact, hand-built Colombo street illustration with soft
forms, restrained detail, and a warm sunlit palette. Simple silhouettes and
large colour blocks should remain legible from the following camera before
small façade or street details are added.

The working palette is:

| Role | Colour | Intended use |
| --- | --- | --- |
| Cream | `#E0C491` | Main walls and bright architectural planes |
| Ochre | `#B8591F` | Walls and warm architectural mass |
| Light ochre | `#E89E47` | Awnings and sunlit warm accents |
| Teal | `#125C5C` | Doors, shutters, trim, and cool contrast |
| Light teal | `#1F8C80` | Secondary trim and the tower stem |
| Clay and coral | `#8C301A` / `#B82E1A` | Pots, roofs, signs, and focal accents |
| Yellow | `#E89914` | Shopfront and vehicle accents |
| Leaf greens | `#1F5729` / `#477A2E` | Layered tree and plant canopies |
| Dark | `#0E1212` | Wheels, windows, and outline contrast |

Materials should be mostly matte, with low-poly bevels and softened normals
providing highlights instead of high-frequency textures. Saturated accents
should identify interactive or distinctive elements without competing with
pickup and drop-off markers.

## Scale and placement contract

The runtime world keeps its existing contract of one Three.js unit to one
metre. Authored assets should use metres in Blender, apply object transforms
before export, place their local origin at ground contact, and use positive Y
as up after GLB import. The asset kit is intended for human-scale roadside use:
doors near 2.1 m high, one-storey façades near 3–4 m, street trees near 5–8 m,
and props sized from familiar real-world references.

Scene placement is decorative and bounded to the prototype slice. It must not
move road geometry, collision surfaces, delivery markers, or the authoritative
WGS84-to-local coordinate conversion. Buildings and props should sit beyond
the road ribbon with enough clearance for the bicycle and following camera.
Repeated objects should share geometry and materials where practical. Any
placement that implies a real landmark, entrance, business, traffic control,
or safe stopping point remains fictional unless separately verified.

The isolated art preview is intended to review asset scale, palette,
silhouettes, camera framing, and material response without road or delivery
interactions. Passing that preview does not by itself establish that the full
riding scene is clear, performant, or collision-safe.

## Asset provenance

The scenery kit is original procedural project artwork with no external meshes
or textures. `art/generate_colombo_scenery.py` is the reproducible source. It
creates an editable Blender source file, the runtime
`public/models/colombo_scenery_kit.glb`, and the machine-readable
`public/models/colombo_scenery_kit.manifest.json`. The editable source is
`art/colombo_scenery_kit.blend`. Blender source is Z-up; GLB output uses metres
and Y-up for Three.js. Asset façades face local +Z. Manifest dimensions are
ordered width X, height Y, depth Z.

The kit exposes these named asset roots: `Shop_Ochre`, `Shop_CreamTeal`,
`BoundaryWall_Gate`, `ShadeTree`, `PalmTree`, `UtilityPole_Lamp`,
`PottedPlant_A`, `PottedPlant_B`, `TukTuk_Parked`, and `LotusTower`. They are
illustrative Colombo-inspired forms rather than surveyed buildings or exact
replicas. The temporary rider is also project-authored. No Paper Route models,
textures, code, or other files are copied into this project.

Blender 5.1.2 produced the reviewed kit: 10 asset roots, 51 exported nodes, 41
exported meshes, 14 exported materials, and 28,314 triangles after applying
bevels and joining geometry by asset root and material. The GLB is approximately
1.9 MB. These exported counts are the browser-facing budget baseline.

`LotusTower` is a simplified silhouette measuring approximately 46 × 357.3 ×
46 m in the GLB. Its height follows the published [Colombo Lotus Tower 356 m
reference](https://colombolotustower.lk/our-story/), with extra antenna extent
visible in the authored bounds. No reference imagery or texture was copied.

Generate the kit from the repository root with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/generate_colombo_scenery.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/render_colombo_scenery_preview.py
```

The second command produces the isolated
`public/models/colombo_scenery_preview.png` contact sheet from the generated
Blender source. Its daylight composition fits all ten roots in one frame;
runtime material response remains a separate browser check.

Vite also builds `art-preview.html` as an isolated interactive entry. Its
Three.js view loads the same production GLB, places all ten named roots under
runtime daylight, scales the tower down only for the contact-sheet composition,
and supports orbit and zoom. Missing roots are listed in its status text; a
failed GLB request exposes the error and a retry action. The production riding
scene uses the same loader and reports a non-blocking reload notice if scenery
cannot load, leaving the road and delivery prototype available.

Runtime placement is generated by `src/world/scenery-placement.ts`. The
roadside vignette spans source distances 48–298 m, exactly 250 m along saved way
`13884292`. Recipes follow the road tangent, rotate the kit's local +Z front
toward the road, and try additional outward setbacks or the alternate side when
needed. Clearance uses hardcoded conservative footprint budgets sampled on a
5 × 5 grid against the centreline and width of every ground-level road. The
budgets are kept deliberately separate from the manifest's measured display
bounds. Scenery remains
decorative and has no collider. These deterministic prop and building
placements are a composition device, not real position data.

The final placement test produces 25 cleared decorative pieces across the
span: 14 façade or wall pieces, including 11 shops, plus vegetation, utilities,
plants, and the parked tuk-tuk.

The Lotus Tower is the exception: it must use the map pipeline's real source
origin rather than a sampled roadside recipe. Its browser placement retains the
full-scale authored silhouette so its relationship with the metre-scale road
slice remains credible.

The temporary rider keeps the bicycle controller and collision body unchanged
while improving the viewed silhouette. Its procedural model adds a tapered
torso, shorts, neck, head, hair, helmet and brim, parcel bag with flap and strap,
split arms and hands at the handlebar, and split legs whose shoes follow the
actual crank pedal endpoints.

The wider scene study adds a gradient blue sky with simple cloud geometry, warm
shadows, and continuous paved footway segments where they clear nearby roads.
These surfaces are visual dressing only and do not establish mapped pavements
or walkable topology.

The visual study is informed by the public [Paper Route developer
log](https://www.paperroute.lol/devlog/) and the team's [Paper Route visual
reference post on X](https://x.com/builtbysketch/status/2098773631249854478?s=20).
Those references are used for broad qualities such as warmth, economical
geometry, playful scale, and readable street composition. Colombo geography,
road data, authored assets, names, and product identity remain this project's
own.

## Validation

Completed in the current checkout:

- Blender 5.1.2 generation produced the reviewed `.blend`, `.glb`, manifest,
  and isolated PNG preview with consistent roots, baked bounds, and exported
  geometry counts.
- All 20 TypeScript tests pass, including the scenery-placement checks. Strict
  TypeScript checking and the production build also pass.
- Chrome visual review confirmed visible shop fronts, paved footway treatment,
  gradient sky, clouds, warm shadows, the revised rider, and all ten roots in
  the interactive art preview.
- Production Chrome at 1280 × 800 completed the first delivery with keyboard
  input over 67 m, awarded LKR 240 once, and retained LKR 240 and one completion
  after reload. The reviewed production and isolated-preview frames are saved
  as [visual-prototype](milestones/2026-09-13-visual-prototype.jpg) and
  [art-preview](milestones/2026-09-13-art-preview.jpg) screenshots.
- Desktop 1280 × 800 and mobile 390 × 844 checks both reported no horizontal
  overflow on the Ride and art-preview pages. Aspect-aware preview framing kept
  all ten roots visible in portrait while preserving orbit and zoom. On mobile,
  a held pedal exceeded 4 km/h and reset returned the bicycle to 0 km/h.
- Normal Ride and art-preview reloads produced no scoped console warnings,
  console errors, or page errors. With the GLB request deliberately aborted,
  the preview displayed `Failed to fetch` and its retry restored all ten roots.
  In the Ride view, the warning remained non-blocking and the Accept and Collect
  actions stayed usable.
- The production build emits a 65.49 KB main entry (23.07 KB gzip), a 628.32 KB
  shared JavaScript chunk (158.76 KB gzip), a 3.06 KB preview entry (1.70 KB
  gzip), 14.65 KB CSS (4.00 KB gzip), and the 2,879.94 KB saved GeoJSON
  artifact. The shared chunk retains Vite's
  expected warning for output above 500 KB.

Still required:

- Measure runtime performance on representative hardware and over longer rides.
- Confirm that decorative placements neither imply verified real-world facts
  nor change bicycle or delivery behaviour.
- Continue final art polish from hands-on feedback.

## Follow-up street quality study

The [street quality study](STREET_QUALITY_STUDY.md) continues this prototype
with richer modeled asset detail, lightweight procedural asphalt, ground and
paving surfaces, a stronger early-evening street composition, and a compact
dark Ride HUD. It preserves this report as the record of the first warm
illustrated slice. The follow-up's reviewed screenshots, browser results,
production measurements, and remaining quality gap are recorded in its own
report.
