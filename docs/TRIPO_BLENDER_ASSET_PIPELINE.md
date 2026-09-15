# Tripo-to-Blender asset production pipeline

This guide defines how a Tripo-generated candidate can enter Colombo Delivery as an editable, measurable game asset. Tripo supplies source geometry and textures; Blender remains the production authority for topology, scale, materials, pivots, deformation, levels of detail, and export. A visually attractive generation is therefore a starting point, not a shippable asset.

The installed command-line client was inspected in read-only mode at version 0.4.0 on 15 September 2026. Its authentication and network diagnostic passed. No private account details are recorded here. No generation, upload or paid processing command in this guide was executed as part of that inspection. Command behavior and validation were checked against the bundled help, bundled reference, and the installed 0.4.0 source. The upstream client source is [Tripo-API-CLI](https://github.com/vast-enterprise/Tripo-API-CLI). Use Tripo's current [V3 model reference](https://developers.tripo3d.ai/en/docs/models-and-versions) and endpoint-specific pages when checking server behavior; older V2 universal-task examples may describe different models or payloads. Where examples and parameter tables disagree, validate the specific operation before production use.

## Blender workstation setup

The production workstation was verified with Blender 5.1.2 and the official [Tripo 3D for Blender 0.7.7 release](https://github.com/VAST-AI-Research/tripo-3d-for-blender/releases/tag/v0.7.7). Tripo's developer-page download still supplied 0.7.3 at this checkpoint, so install the tagged 0.7.7 release rather than relying on that older package. The separate Tripo Studio Bridge 1.0.32 remains installed for browser-to-Blender transfers.

In Blender's 3D Viewport, press `N` and open **Tripo Model Generator**. Its main panel accepts text or image input and shows the active model choice. Version 3.0 is the verified default; the panel also offers versions 2.5, 2.0, and 1.4. Use **Tripo Model Manager** to inspect and download existing Tripo tasks. These panels can submit paid work, so confirm the intended source, model, and budget before using a generation control. Use the verified Tripo CLI 0.4.0 workflow for P1, H/V3.1, and newer processing operations that this Blender release does not expose.

The API credential is stored locally with owner-only `0600` permissions. A workstation-local compatibility patch keeps the live credential in runtime memory instead of Blender scene data and removes credential fields written by older add-on behavior. Verification covered a two-scene, uncompressed `.blend` save: the credential bytes were absent, the in-memory session survived the save, and authentication was restored from local protected storage after reopening the file. Retain this patch after any vendor add-on update and repeat the save-and-reload credential test before production use.

The Studio Bridge restarted successfully, listened only on its local interface, and completed its handshake with Blender 5.1.2. A full transfer from Tripo Studio into Blender has not yet been exercised. No model generation, file upload, paid task, or Studio transfer was performed during this setup verification.

## Production checkpoints

Every asset moves through the following gates:

1. **Concept approval.** Fix the subject, silhouette, scale range, style references, intended camera distance, triangle budget, material budget, interactions, and required variants before spending credits.
2. **One candidate.** Generate one candidate first. Review it before creating alternatives. Record the exact prompt, model version, parameters, task ID, and downloaded source files.
3. **Immutable raw source.** Preserve the first downloaded model, preview, texture files, and task record unchanged. Keep raw service responses, private signed URLs and account data in a restricted local production ledger. Credentials stay in the CLI or Blender add-on's protected local authentication storage and are excluded from that ledger. Work in a separate Blender file so cleanup never destroys provenance.
4. **Blender cleanup.** Inspect disconnected components, hidden surfaces, non-manifold regions, normals, texture seams, material count, transforms, and real-world dimensions. Retopologize where silhouette, deformation, shading, or performance demands it; rebuild weak pieces instead of trying to preserve every generated polygon.
5. **UV and materials.** Consolidate materials, make texture resolution intentional, pack UVs where useful, and verify base color, roughness, metalness, normal, opacity, and ambient-occlusion behavior in the game renderer. Keep reusable material families consistent across a kit.
6. **Motion contract.** Set object origins, parent relationships, mechanical pivots, attachment anchors, skeleton weights, and morph targets in Blender. Bake Blender constraints and inverse-kinematics results into deform-bone animation clips before glTF export. Normalized weight sums are a validity check, not proof of good deformation.
7. **Measured delivery.** Create named LODs, export the evaluated result, and measure the exported GLB rather than relying on Blender edit-mode counts. Give the asset a unique ID. Its public manifest records only useful, safe provenance: source and license, Tripo task ID, model and prompt, file hashes, dimensions, hierarchy, materials, textures, skins, animations, morph targets, and triangle counts.
8. **Human review.** Provide an orbitable review page plus clearly named front, back, side, three-quarter, scale, and in-context views appropriate to the asset. Numeric checks can establish validity, but they cannot grade silhouette, likeness, cultural fit, texture quality, animation appeal, or environmental coherence. Review stays with the user; screenshots and computer-vision scores are not an automatic acceptance gate.
9. **Reuse.** Promote approved pieces into a documented family: shared materials, naming rules, LOD policy, anchors, and variants. New placements should reference the reusable asset instead of embedding edited copies.

## Choosing a Tripo model

| Model | Appropriate source | Limits verified in CLI 0.4.0 | Production implication |
| --- | --- | --- | --- |
| P1 (`tripo-p1`, wire version `P1-20260311`) | Mobile props and low-poly source meshes | 50–20,000 faces; no quad generation, smart low poly, generated parts, or geometry-quality control | Good for bounded props when its silhouette survives the budget. Expect Blender cleanup and deliberate final topology. |
| H / V3.1 (`tripo-v3.1`, wire version `v3.1-20260211`) | Detailed props, architecture studies, characters, and high-resolution source | Full V3.1 generation controls, including detailed geometry, parts, and quad options | Use when detail and source fidelity matter more than immediate runtime cost. Retopology and baking remain production steps. |
| P2 Preview (`tripo-p2`, wire version `P2-20260801`) | Explicit low-poly experiments needing quad output | Explicit selection only; 48–50,000 triangles or 48–25,000 with quads; no smart low poly, generated parts, or geometry-quality control | Treat as preview behavior and pin the exact wire version in provenance. Do not make it a silent project default. |

P-series restrictions are source-generation limits, not promises of game-ready topology. A face limit constrains a request but does not establish deformation quality, watertightness, UV quality, draw-call cost, or the final exported triangle count.

## V3 operation map

Choose the narrowest operation that matches the source and intended correction:

| Need | V3 operation | Boundary |
| --- | --- | --- |
| Prepare consistent references | [Text to image](https://developers.tripo3d.ai/en/docs/generation-text-to-image), [image to multiview](https://developers.tripo3d.ai/en/docs/generation-image-to-multiview), or [edit multiview](https://developers.tripo3d.ai/en/docs/generation-edit-multiview) | These produce images, not editable meshes. Generated unseen views are interpretations and need human review. |
| Create geometry from words, one reference, or several views | [Text to model](https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard), [image to model](https://developers.tripo3d.ai/en/docs/generation-image-to-model/p), or [multiview to model](https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/standard) | Multiview needs two to four views including a front view. Reference quality and view consistency still determine reconstruction quality. |
| Bring an existing model into server processing | [Model import](https://developers.tripo3d.ai/en/docs/models-import) | Import creates a server task; it is different from merely uploading a temporary file token. |
| Repaint an existing surface | [Model texture](https://developers.tripo3d.ai/en/docs/models-texture) | Choose alignment to the source image or geometry. Retexturing does not repair topology or UV design by itself. |
| Split a model into parts | [Mesh segment](https://developers.tripo3d.ai/en/docs/mesh-segment) | Geometry segmentation v1 and semantic segmentation v2 Beta use the same endpoint. Semantic labels do not guarantee modular equipment, clean boundaries, movable parts, or production topology. |
| Fill exposed surfaces after selecting parts | [Mesh complete](https://developers.tripo3d.ai/en/docs/mesh-complete) | Accepts a successful segmentation task ID, not an arbitrary model task. Inspect every generated cap and material transition. |
| Produce a lighter mesh | [Mesh decimate](https://developers.tripo3d.ai/en/docs/mesh-decimate) | Useful for a source LOD, but silhouette, UV bake, hard edges, and deformation still need Blender review. |
| Change delivery format or final export settings | [Model convert](https://developers.tripo3d.ai/en/docs/models-convert) | Use the final conversion for server-side orientation changes. V3 documents that enabling `quad` forces FBX output. The format enum for web output is `GLTF`, not `GLB`; the returned artifact may be a `.glb` file. |
| Test, bind, and animate a character | [Rig check](https://developers.tripo3d.ai/en/docs/animations-rig-check), [rig](https://developers.tripo3d.ai/en/docs/animations-rig), then [retarget](https://developers.tripo3d.ai/en/docs/animations-retarget) | Retarget accepts a successful rig task. Automated binding remains source material until joint placement, weights, contacts, garments, and clips pass Blender and in-game review. |

## Command boundaries and recovery

The following are valid CLI 0.4.0 examples. They are documented command shapes, not records of paid work performed for this project:

```bash
# One mobile-oriented source candidate
tripo make "a mature Colombo rain tree, broad asymmetric canopy" \
  --model tripo-p1 -p face_limit=12000 --json

# Detailed source with textures disabled for later Blender surfacing
tripo generate text-to-model "a compact tropical shop exterior" \
  --model tripo-v3.1 -p texture=false -p pbr=false --json

# Image and named-view reconstruction
tripo generate image-to-model reference.png --model tripo-v3.1 --json
tripo generate multiview-to-model tree-front.png tree-back.png \
  tree-left.png tree-right.png --model tripo-v3.1 --json

# Existing successful task: inspect or recover its artifacts
tripo task get TASK_ID --step --json
tripo task watch TASK_ID --download -o ./incoming/tripo --timeout 1800 --json
tripo task get TASK_ID --download -o ./incoming/tripo --json

# Server processing examples
tripo model texture TASK_ID --texture-quality detailed \
  --texture-alignment geometry -p pbr=true --json
tripo mesh segment TASK_ID --model v2.0-20260430 --json
tripo mesh complete SEGMENT_TASK_ID --completion-mode ai_completion --json
tripo mesh decimate TASK_ID --face-limit 5000 --json
tripo model convert TASK_ID --format FBX --fbx-preset blender --json
tripo anim check model.glb --json
tripo anim rig TASK_ID --rig-type biped --spec mixamo --out-format fbx --json
tripo anim retarget RIG_TASK_ID --animation preset:idle preset:walk \
  --out-format glb --animate-in-place --json
```

CLI 0.4.0 has no dry run, price estimate, or unpaid generation preview. `tripo view` displays an existing task or local GLB; it does not preview a prospective request. `--no-wait` submits the task and may consume credits, then returns early. `--no-download` also submits and waits but omits artifact download. A riggability check is itself a server task, even when it prevents later rigging expense.

Persist every returned task ID immediately. If a command times out, loses its connection, or fails while downloading, query that same ID with `task get` or `task watch`; do not repeat the generation merely because a local file is missing. Output URLs expire, and `task get TASK_ID --download` refreshes them before downloading. Retargeting requires the successful rig task ID and supports at most five animations per request, billed per animation.

CLI 0.4.0 batch behavior deserves special care. Its source implements retries around the whole job, so a downstream or download failure can cause a retry to submit the source generation again. The state file skips successful jobs, but the source also retains attempt counts; after all configured attempts are exhausted, rerunning with the same retry count may perform no new attempt. `--fresh` intentionally reruns successful jobs as well. These are version-qualified source findings, not live paid-task proofs. For controlled art production, run the first candidate individually and resume by explicit task ID. Use batch only for approved, independent jobs after reviewing its state file and duplicate-cost risk. The 0.4.0 manifest has no job-dependency field.

Local images accepted by the CLI uploader are PNG, JPEG, WebP, BMP, and TIFF up to 20 MiB. Generation endpoint documentation is narrower, so use PNG, JPEG or WebP for references. Local model upload accepts GLB, FBX, OBJ, and STL up to 150 MiB. The CLI does not accept local `.gltf` inputs; use GLB to package the model and its external dependencies, or a supported publicly reachable glTF URL. Uploading returns a temporary file token. Importing that token or passing a local model to `make` creates an import task before further processing.

## Operating a longer production run

Start with one active candidate. Record parent and child task IDs for each processing stage and save the downloaded bytes with hashes; a prompt and seed alone are not a durable source archive. A polling timeout is not a remote cancellation. Check task status before resubmission, and review usage before starting additional candidates. Tripo documents credit reservation when work starts and settlement or release when it completes or fails. See [task lifecycle](https://developers.tripo3d.ai/en/docs/task-lifecycle) and [billing](https://developers.tripo3d.ai/en/docs/billing).

Request-rate limits and concurrent-task limits are separate. Respect returned throttling information; do not hard-code a concurrency number from a different model or account tier. For a later hosted production service, verified and deduplicated webhooks can replace repeated polling. No hosted service is configured at this checkpoint. See [error handling](https://developers.tripo3d.ai/en/docs/error-handling), [rate limits](https://developers.tripo3d.ai/en/docs/rate-limits) and [webhooks](https://developers.tripo3d.ai/en/docs/webhooks).

## Blender and runtime contracts

Generated GLB is the normal interchange choice for textured static source. Request FBX when quad topology, Blender-oriented conversion, or a rigging handoff requires it. Quads cannot be preserved in GLB. After Blender cleanup and evaluation, export the runtime deliverable as GLB using the [Blender glTF exporter](https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html) and inspect that exported file. Triangulation, modifiers, split normals, UV seams, material boundaries, and skinning can make exported vertex and triangle counts differ from Blender face counts.

Axis conversion must follow the destination asset family. The current architecture, landscape, and traffic manifests use metre-scale GLB with +Y up and local +Z forward. The older approved bicycle and character contract uses +Y up and local -Z forward. Do not apply a blanket “export Y-up” or forward-axis rule. Record the source orientation, Blender orientation, exported orientation, and runtime adapter in each manifest, then test one asymmetric marker so a 180-degree error is obvious. Tripo's [P-series image-generation documentation](https://developers.tripo3d.ai/en/docs/generation-image-to-model/p) warns that setting `export_orientation` during generation can leave a later processing result wrongly oriented despite task success; it recommends changing orientation in the final conversion. Validate the actual imported and exported axes in Blender.

| Asset family | Blender production requirements | Review focus |
| --- | --- | --- |
| Trees and plants | Do not autorig. Keep rigid trunk/major-branch meshes separate from flexible foliage meshes. The current runtime recognizes flexible surfaces through manifest-listed material names or a `Wind_` **material** prefix; mesh names are descriptive but do not enable wind. Avoid mixing rigid and flexible materials in one mesh. Preserve matching visible and depth/shadow deformation and a stable per-instance phase. Build canopy LODs and impostor candidates deliberately. | Species silhouette, tropical scale, canopy density, wind amplitude, phase variation, shadow stability, and repeated-placement variation. |
| Building exteriors | Remove unseen interior geometry; regularize façade modules; consolidate materials; create named door, loading, sign, roof, and curb-facing anchors. | Street-level scale, entrances, collision proxy, night/day materials, repetition, and fit against mapped footprints without implying surveyed detail. |
| Vehicles | Rebuild mechanical topology where needed. Name and center wheel, steering, crank, pedal, suspension, door, and cargo pivots; keep collision and visual meshes separate. | Wheelbase and clearances, steering axis, rider contacts, cargo access, animation range, and LOD silhouette. |
| Characters | Treat generated rigging as reference until Blender review. Validate skin weights, joint placement, garment separation, clipping, hand and foot contacts, facial topology, and required morph targets. Clothes and facial morphs are not automatically production-ready. | Identity, proportions, seated pose, deformation, clothing motion, expression range, equipment fit, and mobile readability. |

## First pilot

The proposed first exercise is one rain-tree candidate, not a completed generation. Approve a reference board and a single prompt; request one candidate; preserve the raw task package; separate rigid trunk geometry from flexible foliage meshes in Blender; assign only the flexible surfaces to manifest-listed `Wind_` materials; correct scale, normals, UVs, and materials; produce measured near and mid LODs; export one +Y-up, +Z-forward GLB for the current landscape contract; update its manifest; then provide the orbitable review page and named still views. The game browser loads the approved GLB and manifest without an API key or live Tripo request; asset generation stays offline from the shipped experience. Only after user review should the prompt or cleanup method be reused for the broader tree family.
