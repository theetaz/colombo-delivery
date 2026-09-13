# Teenage courier character art brief and production pipeline

> **Riding-art status:** The previous bicycle/rider result is an engineering prototype only. Final human review rejected bicycle proportions and components, inverted wrists, clothing distortion, saddle fit, and grip presentation. See [BICYCLE_REBUILD.md](BICYCLE_REBUILD.md).


## Product correction

The current rigid-part courier remains a useful technical prototype for bicycle
scale, attachments, fallback loading, appearance persistence, and responsive
preview controls. It is not the intended hero character and should not set the
finished visual target. Adding more primitives, small surface details, palette
choices, or stronger shadows did not create a distinctive face, natural
expression, believable garment forms, or the cohesive silhouette expected from
an original cartoon character.

The next character milestone therefore starts from a reviewed 2D concept for an
original teenage Colombo bicycle courier and reconstructs that design as a
purpose-built 3D character. The existing bicycle controller and delivery loop
remain the gameplay foundation. Multiplayer, spawning other riders, crowds,
procedural population generation, and a general avatar creator are deferred.

## Character brief

The hero should read immediately as a teenage bicycle courier in the game
camera and in a close portrait. The design needs a youthful head-to-body ratio,
a friendly and alert expression, a clear hair silhouette, practical riding
clothes, secure shoes, and a parcel bag that feels worn rather than attached as
an afterthought. Shape language should be rounded, lively, and graphic, with
enough asymmetry and proportion variation to avoid a mannequin appearance.

The concept package should establish:

- front, three-quarter, side, and rear views with consistent proportions;
- a neutral face plus a small expression sheet covering relaxed focus, effort,
  delight, concern, and a delivery greeting;
- clear hairline, ear, brow, eyelid, nose, mouth, jaw, and cheek construction;
- shirt, shorts or trousers, socks, shoes, helmet, and bag layers, seams,
  closures, and material breaks;
- the seated riding posture and the relationship among hips, shoulders, grips,
  pedals, saddle, bicycle frame, and parcel load; and
- colour keys that remain readable in Colombo's warm and cool street lighting.

The character must be original project artwork. The concept, reconstruction
service or software, licenses, source files, and every manual cleanup step need
recorded provenance before the mesh becomes a shipping asset.

## Production stages

### 1. Review the 2D identity

Review the concept at face close-up, full-character turnaround, and approximate
gameplay size. Resolve age read, facial identity, silhouette, clothing, and bag
before reconstruction. A visually ambiguous concept will produce an ambiguous
mesh and should not be repaired through repeated detail additions downstream.

### 2. Reconstruct a genuine 3D starting mesh

Use the selected working concept views in the image-to-3D reconstruction path.
Keep the untouched result as source evidence. Record the service or tool,
settings that affect geometry or textures, output format, license, dimensions,
and hashes. The reconstructed mesh is a starting point rather than an accepted
runtime asset.

The first reconstruction uses the Tripo API `P1-20260311` image-to-model path
with only the original project concept as input. The untouched draft is stored
at `art/characters/teen-courier/reconstruction/teen-courier-tripo-p1-draft.glb`
with its provider preview and provenance manifest. It is 3,253,668 bytes and
contains 24,191 vertices, 17,681 triangles, one fused static mesh and material,
and three embedded 4096 × 4096 PBR maps: base colour, ORM, and OpenGL normal.
It contains no rig, animation clips, or morph targets. Generation consumed 60
API credits; this usage figure does not establish an account licence tier.

The first Blender cleanup is stored at
`art/characters/teen-courier/teen_courier_cleanup.blend`, with a review export
at `public/models/teen_courier.glb`. Its `TeenCourier` root is grounded, uses +Y
up and -Z forward, and measures 0.71 × 1.62 × 0.32 m in the browser. Its single
mesh has five named primitives: `Teen_Skin`, `Teen_Hair`, `Teen_Shirt`,
`Teen_Shorts`, and `Teen_Shoes`. The original base-colour, normal, and ORM maps
remain embedded. A 4096 × 4096 RGB customization mask assigns skin to red,
shirt to green, and shoes to blue on UV set 0. The browser changes hue and
saturation within the selected channel and applies value relative to the
authored map;
direct material multiplication remains unsupported because it darkened the
original map. Three.js loads the glTF mask with `flipY=false`. This is a static
cleanup checkpoint with no skin, animation clips, or morph targets, not the
finished rider.

The first browser art review rejected that cleanup as a visual result. Smoothed
but unwelded UV-seam vertices opened triangular cheek cracks. Coarse material
segmentation produced jagged shirt and shorts boundaries, and the white shoe
region extended visibly up the shins. The recognizable raw reconstruction is a
stronger identity reference while those cleanup errors are repaired. This
separates three different checks: valid glTF structure, usable camera framing,
and acceptable character art. Passing the first two does not satisfy the third.
The repaired static export preserves 8,951 Blender vertices as 25,010 exported
vertices and 17,681 triangles. Its face and authored default clothing pass the
first-draft review. Padding the customization mask removed the major
wireframe-like UV seam network exposed by strong colour variants. Deep skin
still shows faint transitions, and dark shoe variants retain edge artifacts;
these remain paint-refinement work rather than a shipping finish. The static
GLB is 4,360,980 bytes and the editable cleanup `.blend` is 3,970,101 bytes.

An authorized Tripo biped-rig task produced
`art/characters/teen-courier/reconstruction/teen-courier-tripo-v2_5-biped-rig.glb`.
The 3,759,148-byte result contains one skin and 60 nodes but no animation clips.
The request consumed 25 API credits. Its weights, deformation, orientation,
bicycle fit, and suitability for the final rig remain under review.

A normalized Blender rig-review source and GLB now isolate that next question:
`art/characters/teen-courier/teen_courier_rig_review.blend` and
`public/models/teen_courier_rig_review.glb`. The review asset is 1.62 m tall,
grounded, -Z forward, uses one skin and 58 bones, retains 17,681 triangles, and
contains no animation clips. The GLB is 3,762,224 bytes and its editable
`.blend` is 3,374,125 bytes. It is evidence of a genuine skinned hierarchy,
not evidence that weights deform naturally or that the rider fits the bicycle.
The normalized rest pose and weight sums pass structural checks, with a maximum
weight-sum error of 4.53 × 10⁻⁸ and finite sampled displacements. A combined
left-elbow, right-knee, and head-yaw pose nevertheless exposed a hanging hand
triangle caused by stray right-foot influences on 572 hand vertices. Removing
those influences and renormalizing the affected weights removed the flap when
the same pose was repeated, with finite joint motion. This bounded repair shows why rest-pose and
normalization checks must be followed by deliberately extreme deformation
poses and vertex-level influence inspection.

Tripo's [API documentation](https://platform.tripo3d.ai/docs/generation)
documents that operation, while its
[API FAQ](https://platform.tripo3d.ai/docs/faq) states that API and Studio use
independent billing and credit systems. Tripo's published
[general terms](https://www.tripo3d.ai/terms) distinguish free and paid users,
but the public API documentation reviewed for this milestone does not state an
API-specific output licence or attribution rule. An API credit balance alone
does not establish which general tier applies. Commercial-use and attribution
terms for this reconstruction therefore remain unresolved and must be confirmed
before public distribution as a shipping asset; confirmation of the applicable
account plan may resolve that question. The provenance record can still
identify the Tripo API P1 reconstruction and its cleared original project
concept input without publishing private service identifiers or credentials.

The first working concept package contains the
[three-quarter standing direction](../art/characters/teen-courier/concept/teen-courier-v1.png),
[front, side, and back turnaround](../art/characters/teen-courier/concept/teen-courier-turnaround-v1.png),
and [expression reference](../art/characters/teen-courier/concept/teen-courier-expressions-v1.png).
It establishes a youthful face and hair direction, teal shirt, charcoal shorts,
white shoes, consistent proportions, and neutral, smile, focus, surprise,
concern, and blink references and is suitable for the first reconstruction
attempt. It remains open to visual refinement. The
[concept manifest](../art/characters/teen-courier/concept/manifest.json) records
dimensions, SHA-256 hashes, and provenance. No reconstructed mesh, retopology,
rig, or implemented facial expressions are implied by these images.

### 3. Clean and retopologize in Blender

Inspect the complete surface for non-manifold regions, inward faces, duplicate
shells, disconnected details, texture seams, and inconsistent scale. Establish
a clean metre-scale Y-up export with local -Z forward and a documented root.
Retopology should preserve the selected face and hair silhouette while creating
deformation-friendly loops around shoulders, elbows, wrists, hips, knees,
ankles, eyelids, brows, cheeks, and mouth.

Separate garments and accessories where independent motion or customization
requires it. Resolve skin passing through sleeves and hems in representative
poses. Fit the bag straps to the torso and shoulders, keep the bag clear of the
rear wheel, and place shoe soles and pedal contact surfaces deliberately. Set
normals, tangents, UVs, colour space, alpha behavior, and material sidedness
explicitly before export.

#### Optional Studio-to-Blender handoff

The artist workstation has Tripo Bridge 1.0.32 enabled in Blender 5.1.2. The
Blender-side handshake and heartbeat response were verified. A complete Tripo
Studio DCC Bridge connection has not yet been verified. Follow the
[official Tripo DCC Bridge for Blender guide](https://www.tripo3d.ai/blog/tripo-dcc-bridge-for-blender)
when completing that connection. No model transfer, import, generation request,
or credit use was performed during this setup, so it does not change the
current courier or garment assets.

For a future reconstruction, transfer into a controlled copy of the Blender
scene, preserve the received source, and inspect the mesh and materials before
cleanup. The product pipeline remains: reconstruct from the selected concept in
Tripo Studio, bring the result into Blender through the artist bridge, clean and
fit the mesh and materials, export glTF, then verify the exported GLB in the
browser. The bridge
shortens the handoff; it does not replace garment construction, retopology,
weight review, or browser validation.

The continuous-shell trouser repair removed open thigh and knee gaps but its
first accepted shape remained too ballooned through the pelvis, dropped the
crotch too low, reduced the legs to nearly featureless pipes, and closed them
with rounded cuffs. The completed woven-garment pass corrects the waist, seat,
crotch, thigh, knee, calf, and hem as one readable silhouette.

The accepted low-resolution construction starts with the actual connected
authored-shorts component: 245 vertices and 440 faces preserving the waist,
hips, seat, and crotch. Its two existing hem loops extend through six connected
tapered rings with slight knee and cuff asymmetry, shared faces, and connected
inset ankle-hem rims. Recalculated normals, one subdivision level, a 1.2 mm
bevel, projected pockets and fly, a waistband stitch, and restrained knee and
ankle creases complete the static preview shape. This reuse of approved
geometry replaces the rejected ellipsoid-and-cylinder union, whose invented
pelvis shape created hard hips and an inflated crotch.

Browser review covers front, side, back, mobile, all three shoe choices, Shorts
restoration, and trouser recoloring. The garment remains a static catalog item
until later rig and bicycle-pose checks establish deformation quality, and its
solid-color details do not provide a baked fabric texture.

### 4. Build a deformation rig

Create a real armature with skinned deformation for the body and garments.
The rig needs stable pelvis, spine, neck, head, shoulder, arm, hand, leg, and
foot chains and documented bicycle contact controls. Preserve the existing
wheel, steering, crank, grip, pedal, seat, and cargo attachment contract at the
vehicle boundary while allowing the new character rig to solve naturally to
those targets.

Weight painting must be reviewed through pedalling extremes, steering both
ways, braking, coasting, looking toward a delivery, and a stopped handoff.
Shoulders, elbows, hips, knees, wrists, ankles, shirt hems, shorts, and straps
need deformation checks from front, side, rear, and game camera views.

### 5. Add controlled facial expression

Use a small reviewed set of facial blend shapes for brows, eyelids, cheeks, and
mouth rather than scaling whole face profiles. Start with neutral, blink,
focused effort, smile, concern, and a speaking or greeting shape. Each target
must preserve the selected identity, avoid eye or teeth intersections, and
combine safely with head motion. Lip sync and dialogue animation remain later
work unless separately scoped.

### 6. Author materials and customization

Skin, shirt, and shoes are the first required customizable regions. Keep their
material slots stable and clone only mutable materials per rider instance.
Preserve shared geometry and immutable texture resources. Options should use
reviewed palettes or texture variants that maintain skin shading, garment
detail, and shoe construction instead of multiplying a base colour over an
already dark map.

Hair, bag, helmet, and additional rider profiles can extend the same contract
later. A future profile means another reviewed character identity and fitted
rig, not an automatic population or multiplayer promise.

### 7. Verify the glTF in the browser

The Blender viewport is not export proof. Validate the actual GLB hierarchy,
skin joints, inverse bind matrices, morph targets, UVs, textures, colour space,
alpha settings, bounds, axes, contact anchors, and material isolation. Review
neutral, pedal, coast, brake, steer, expression, and handoff poses in the Rider
studio and the production game at desktop and portrait sizes.

The preview should expose clay and final-material turnarounds, a face camera,
expression controls, and the implemented customization regions. Production
review must cover normal loading, malformed appearance data, unavailable
storage, failed character loading with a usable fallback, disposal during a
late load, and repeated instances without shared material mutation.

## Lessons retained from the prototype

The prototype established several contracts worth keeping:

- controller state and visual state remain separate;
- bicycle grips, pedals, saddle, wheels, steering, crank, and cargo anchors are
  measured and validated rather than guessed from screenshots;
- a standalone browser preview catches framing, hierarchy, and material errors
  before production playtesting;
- appearance storage accepts only known versioned values and fails safely;
- mutable materials belong to each rider instance; and
- a failed detailed asset leaves a visible warning and a usable gameplay
  fallback.

It also exposed distinct failure classes. Material tinting can unintentionally
multiply dark texture values. Incorrect winding or normals can hollow out a
head or torso even when Blender looks plausible. Exported axes, parent
transforms, UVs, colour space, and material sidedness must be tested from the
GLB itself. These are technical fixes; none substitutes for a strong reviewed
concept, reconstructed organic surface, deformation topology, or expressive
rig.

## Completion evidence

The bounded concept, reconstruction, initial cleanup, and inspection checkpoint is
implemented locally. `character-preview.html` loads the cleaned review GLB by
default and keeps the raw Tripo draft available only through an explicit query.
It provides Full body, Head, Side, Back, and orbit views; reversible clay
inspection; and per-instance Skin, Shirt, and Shoes tint controls. Its responsive
split layout and clean front, head, side, and rear framing passed browser review.
The default authored maps remain intact. Strong variants use the padded mask,
with the faint skin transitions and dark shoe edges noted above. Controls for absent skin, animation, and
morph features stay hidden rather than implying support. The playable bicycle
now loads a separate skinned `teen_courier_riding.glb` and
binds it to the reviewed grip, pedal, saddle, and backpack attachment contract.
That riding prototype is limited to the approved base appearance. Alternate
static wardrobe meshes are not riding-ready. The pedal cycle and browser fit
passed the [equipment milestone review](RIDER_EQUIPMENT.md). If the detailed rider
cannot load, the checkpointed rigid-part courier remains the gameplay fallback.

Failure review keeps the new viewer isolated from the playable game. If the
static character GLB returns an error, the viewer shows a clear load message,
hides colour controls, and leaves **Return to ride** usable. If only the manifest
fails, the static asset still renders and customization controls remain hidden.
The existing game continues to report both street and bicycle assets ready.

The full replacement remains incomplete. It still requires reconstruction
rights confirmation, the intended facial controls, full wardrobe skinning,
and fine finger-grip refinement. The riding report records production-browser
review, final screenshots, and remaining contact limitations. Static wardrobe options demonstrate
separated meshes and saved appearance data; only the approved base appearance
currently has a dedicated riding rig.
The current mesh has no face morphs and its eye and mouth topology has not been
rebuilt for expression deformation. The expression sheet remains direction for
that future work.

## Reproduce the local review assets

The checked-in raw reconstruction is the immutable input for these local
rebuilds. Running them does not call the reconstruction service or consume API
credits. The mask builder requires Python with Pillow and NumPy. The cleanup and
rig-review passes require Blender 5.1 or newer with its bundled Python modules:

```sh
python3 art/characters/teen-courier/build_customization_mask.py
blender --background --python art/characters/teen-courier/cleanup_teen_courier.py
blender --background --python art/characters/teen-courier/prepare_teen_courier_rig.py
npm test
npm run build
npm run dev
```

Then open
[http://localhost:5173/character-preview.html](http://localhost:5173/character-preview.html).
Regenerating the rig-review files resets their manual-review status. Re-run the
artifact tests and repeat the documented extreme browser pose before recording
that candidate as reviewed; the generator cannot certify its own deformation.
The named polygon regions in the static cleanup are provisional inspection
regions. The embedded RGB mask is the browser customization basis. Its packed
mask node is labelled but intentionally unconnected in the Blender file;
Blender does not expose the browser tint controls. The asset contains no
interchangeable garment geometry. Facial retopology, facial controls, final
skin-rig integration, and fitting that rig to the bicycle remain future work.

Reviewed static artifacts are the
[reconstruction view](milestones/2026-09-13-teen-courier-reconstruction.jpg),
[face close-up](milestones/2026-09-13-teen-courier-face.jpg),
[colour variants](milestones/2026-09-13-teen-courier-colors.jpg), and
[mobile viewer](milestones/2026-09-13-teen-courier-mobile.jpg). The
[reviewed rig pose](milestones/2026-09-13-teen-courier-rig-pose.jpg) is an
actual browser rendering with a 70° left elbow, 90° right knee, and 25° head
yaw. It is a manual QA pose; the GLB still contains no stored animation clip,
and this one pose does not prove complete weight painting or a fitted ride.

All 31 tests, strict TypeScript checking, the production build, and the
documentation diff check pass. The character viewer entry is 9.08 KB (3.86 KB
gzip), and the shared JavaScript chunk is 644.17 KB (163.17 KB gzip). Vite's
expected shared-output advisory remains.

## Riding prototype status correction

Passing rig and runtime tests does not constitute visual acceptance. Final human
review rejected the current riding prototype's wrists, clothing deformation,
saddle fit, and grip presentation. Future vehicle art will approve the bicycle
alone, then a stationary rider fit, controlled pedalling, steering, and finally
simulation binding.
