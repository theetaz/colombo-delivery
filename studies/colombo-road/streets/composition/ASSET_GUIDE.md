# Living street assets and delivery addresses

The existing environment experiment builds on the selected A + B + C composition:
varied tropical planting, recognizable exterior building types, night-time
path lighting and background road users. The street remains an authored test
section. Human review rejected this expansion's visual result. The
[Tripo-to-Blender production guide](../../../../docs/TRIPO_BLENDER_ASSET_PIPELINE.md)
defines the next single-asset pilot before further kit expansion. The identity
and runtime contracts below remain the handoff requirements for replacement
models.

## Keep models separate from places

An **asset ID** identifies a reusable model, such as a supermarket or a tree
variety. An **instance ID** identifies one placement of that model. Reusing a
model must never reuse its placement ID. Names, paint colors and array order
are presentation details and must not determine an existing place's identity.

Buildings reference their block; the block links to its district and adjacent road.
A block can later reference multiple boundary roads when it is fitted to the
Colombo network. Authored study IDs do not represent real OSM features or
verified geographic addresses. Preserve an explicit source reference when a
study object is later associated with surveyed or mapped data.

Delivery locations are separate records linked to building IDs. Only selected
buildings become pickup or drop-off locations. Each location needs an exterior
entrance and a roadside approach on the same side of the road. This lets the
game identify a useful destination without modeling interiors. A model can be
replaced without changing the address, provided its entrance is checked again.

## Asset families

- Trees vary in branching, crown shape, height and leaf form. Flowering trees,
  spreading shade trees and palms serve different parts of the street.
- Planting uses flowers, shrubs, ferns, low groundcover and irregular grass
  patches. Entrances, ramps and pedestrian clear paths stay open.
- Exterior buildings distinguish homes, apartments and destination shops.
  Window shape, shutters, grilles, balconies, roofs and awnings provide variety
  beyond color changes. No navigable interiors are required.
- Traffic models use independent wheel pivots and correctly seated background
  riders. They are separate from the approved playable courier and bicycle.
- Civic lights illuminate the pavement and promenade after sunset. Vehicle
  lights and selected windows provide additional night-time cues.

## Modeling and motion

Keep source scenes editable in Blender and export self-contained GLBs. Use
metres, a Y-up runtime and a documented forward axis. A prefab's root stays at
its ground origin; wheel and pedal origins stay at their mechanical pivots.

Pack original texture images into the Blender source. Include textures inside
the GLB, preserve UVs and record alpha behavior. Merge compatible static parts
by material, and use instancing for repeated placements. Export manifests must
describe the actual exported bounds and triangle counts.

Wind is a controlled vegetation deformation. Trunks and ground-contact vertices
stay anchored; foliage and grass receive bounded motion with differing phases.
The shadow pass must use the same deformation as the visible mesh. A generated
tree is not automatically wind-ready: its flexible parts and root weighting
still need preparation.

Background traffic uses the street's two left-hand lanes. Its local motion is
an environment demonstration, separate from a city traffic system with
intersections, right-of-way, pedestrian crossings and player collision.

## Adding generated or community assets

Generated and community models can enter the same catalogue. Preserve the
original source and record the creator, source URL, applicable licence,
required credit, modifications and the intended usage. A model being publicly
viewable does not itself establish permission to redistribute it in the game.

For each candidate:

1. Check that its silhouette, scale and material style fit the current street.
2. Clean the mesh in Blender, set pivots and prepare any required motion.
3. Export a bounded browser asset and add its asset ID and provenance record.
4. Replace a review instance, check placement and delivery-entrance alignment,
   then submit it for human visual feedback before wider reuse.

[Tripo](https://www.tripo3d.ai/) supports generating and exporting 3D models;
this checkpoint uses original Blender-authored additions. Future imported
models should follow the same preparation and provenance process. The
[PaperRoute development archive](https://www.paperroute.lol/devlog/) remains a
reference for testing asset families in a focused environment before wider use.
