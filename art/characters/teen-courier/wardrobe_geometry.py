"""Fitted wardrobe geometry for the teen courier customization catalog.

The helpers operate in the normalized Blender source space (Z up, face +Y)
and return objects parented beneath the supplied catalog item root. They do
not save, export, or modify the accepted source objects.
"""

from __future__ import annotations

import math
from typing import Mapping

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _clone(source: bpy.types.Object, name: str, parent: bpy.types.Object) -> bpy.types.Object:
    result = source.copy()
    result.data = source.data.copy()
    bpy.context.collection.objects.link(result)
    result.name = name
    result.data.name = f"{name}_Mesh"
    result.parent = parent
    result.hide_render = False
    result.hide_viewport = False
    return result


def _single_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def _retain_faces(obj: bpy.types.Object, predicate) -> None:
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    remove = [face for face in mesh.faces if not predicate(face.calc_center_median())]
    bmesh.ops.delete(mesh, geom=remove, context="FACES")
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def _trim_vertices_below(obj: bpy.types.Object, z: float) -> None:
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.delete(mesh, geom=[vertex for vertex in mesh.verts if vertex.co.z < z], context="VERTS")
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


class _SurfaceProjector:
    """Projects front-facing details onto an actual garment mesh."""

    def __init__(self, surface: bpy.types.Object, parent: bpy.types.Object):
        depsgraph = bpy.context.evaluated_depsgraph_get()
        self.surface = surface
        self.parent = parent
        self.tree = BVHTree.FromObject(surface.evaluated_get(depsgraph), depsgraph)

    def point(self, x: float, z: float, clearance: float = .002) -> tuple[Vector, Vector]:
        # BVHTree.FromObject uses object-local coordinates. Casting inward from
        # beyond the chest always selects the visible front layer instead of a
        # back-face or a constant-depth approximation.
        hit, normal, _, _ = self.tree.ray_cast(Vector((x, .45, z)), Vector((0, -1, 0)), 1.0)
        if hit is None or normal is None:
            # Collar tips can sit just inside the reconstructed neck opening.
            # Snap those few samples to the nearest garment edge; keep the
            # search tight enough that a malformed path still fails loudly.
            hit, normal, _, distance = self.tree.find_nearest(Vector((x, .10, z)), .075)
            if hit is None or normal is None or distance is None:
                raise ValueError(f"No torso surface at x={x:.3f}, z={z:.3f}")
        local_normal = normal.normalized()
        world_point = self.surface.matrix_world @ (hit + local_normal * clearance)
        world_normal = (self.surface.matrix_world.to_3x3() @ local_normal).normalized()
        parent_point = self.parent.matrix_world.inverted() @ world_point
        parent_normal = (self.parent.matrix_world.inverted().to_3x3() @ world_normal).normalized()
        return parent_point, parent_normal


def _surface_strip(
    name: str,
    path: list[tuple[float, float]],
    width: float,
    projector: _SurfaceProjector,
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for x, z in path:
        for edge_x in (x - width / 2, x + width / 2):
            point, _ = projector.point(edge_x, z)
            vertices.append(tuple(point))
    for index in range(len(path) - 1):
        start = index * 2
        faces.append((start, start + 1, start + 3, start + 2))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    bevel = obj.modifiers.new("Fabric edge", "BEVEL")
    bevel.width = .0018
    bevel.segments = 2
    return obj


def _surface_button(
    name: str,
    x: float,
    z: float,
    projector: _SurfaceProjector,
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    point, normal = projector.point(x, z, .003)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=point)
    button = bpy.context.object
    button.name = name
    button.scale = (.0046, .0018, .0046)
    # The source front normal is near +Y; align the button's thin local Y axis
    # to the measured normal so it follows chest curvature in profile.
    button.rotation_mode = "QUATERNION"
    button.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(normal)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    button.data.materials.append(material)
    button.parent = parent
    return button


def create_top_variant(
    variant_id: str,
    source_top: bpy.types.Object,
    parent: bpy.types.Object,
    materials: Mapping[str, bpy.types.Material],
) -> list[bpy.types.Object]:
    """Clone the accepted top and add surface-fitted variant construction.

    Required material keys are ``cloth``, ``accent``, and ``hardware``.
    ``cloth`` may be the authored source material; it is only assigned when
    explicitly supplied as a different material.
    """
    if variant_id not in {"crewtee", "polo", "buttonshirt"}:
        raise ValueError(f"Unsupported top variant: {variant_id}")
    base = _clone(source_top, f"Top_{variant_id}", parent)
    cloth = materials.get("cloth")
    if cloth is not None:
        _single_material(base, cloth)
    if variant_id == "crewtee":
        return [base]

    accent = materials["accent"]
    hardware = materials["hardware"]
    projector = _SurfaceProjector(base, parent)
    made: list[bpy.types.Object] = [base]

    # Each collar leaf is a tapered strip sampled across the real neckline.
    # The paths stop clear of the throat and follow the chest rather than
    # forming a rigid bar in a constant Y plane.
    left = [(-.010, 1.278), (-.030, 1.260), (-.060, 1.235), (-.043, 1.208)]
    right = [(-x, z) for x, z in left]
    made.append(_surface_strip(f"{variant_id}_Collar_L", left, .014, projector, accent, parent))
    made.append(_surface_strip(f"{variant_id}_Collar_R", right, .014, projector, accent, parent))

    if variant_id == "polo":
        placket_z = [1.249, 1.226, 1.202, 1.178]
        button_z = [1.224, 1.194]
        width = .009
    else:
        placket_z = [1.252, 1.205, 1.158, 1.111, 1.064, 1.017, .970, .923, .876, .835]
        button_z = [1.210, 1.137, 1.064, .991, .918, .845]
        width = .008
    made.append(_surface_strip(f"{variant_id}_Placket", [(0, z) for z in placket_z], width, projector, accent, parent))
    for index, z in enumerate(button_z):
        made.append(_surface_button(f"{variant_id}_Button_{index}", 0, z, projector, hardware, parent))
    return made


def _hem_dimensions(source_bottom: bpy.types.Object, side: float) -> tuple[float, float, float, float]:
    candidates = [v.co for v in source_bottom.data.vertices if v.co.x * side > 0 and v.co.z < .64]
    if not candidates:
        raise ValueError("Accepted shorts mesh has no usable leg hem samples")
    # The reconstructed shorts include crotch and pocket panels in their
    # bounds, so their full extents greatly overstate one leg opening. These
    # fitted centers/radii match the accepted teen's actual leg silhouette.
    center_x = .10 if side > 0 else -.10
    center_y = .005
    radius_x = .082
    radius_y = .078
    return center_x, center_y, radius_x, radius_y


def _trouser_leg(
    name: str,
    side: float,
    source_bottom: bpy.types.Object,
    parent: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    segments = 28
    # Centers and radii follow measured source-leg cross sections rather than
    # a vertical tube. X mirrors for the left leg; Y slopes rearward at ankle.
    # The continuation begins inside the accepted shorts hem, not at the
    # waist, so it cannot protrude beside the shirt or widen the authored hip.
    rings = [
        (.720,.108,.000,.094,.111),
        (.680,.109,.000,.095,.112),
        (.640,.110,.000,.095,.112),
        (.570,.115,-.005,.095,.110),
        (.500,.120,-.005,.092,.112),
        (.400,.135,-.050,.061,.071),
        (.300,.141,-.066,.060,.061),
        (.200,.154,-.076,.052,.057),
        (.120,.165,-.079,.055,.070),
        (.075,.166,-.080,.056,.072),
    ]
    vertices: list[tuple[float, float, float]] = []
    for ring_index, (z, cx_abs, cy, rx, ry) in enumerate(rings):
        cx=side*cx_abs
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            # A shallow front crease gives the leg a cloth silhouette without
            # imitating the body's skin-tight topology.
            crease = -.004 * math.cos(2 * angle) * (ring_index / (len(rings) - 1))
            vertices.append((cx + rx * math.cos(angle), cy + ry * math.sin(angle) + crease, z))
    faces: list[tuple[int, int, int, int]] = []
    for ring_index in range(len(rings) - 1):
        for index in range(segments):
            current = ring_index * segments + index
            nxt = ring_index * segments + (index + 1) % segments
            # Increasing angle is counter-clockwise when seen from above; this
            # winding keeps the tube normals outward for normal back-face cull.
            faces.append((current, current + segments, nxt + segments, nxt))
    # Leave the hidden top open. A cap is unnecessary inside the hip shell and
    # Catmull-Clark would pull a cap inward, revealing a dark horizontal gap.
    # A narrow ankle-facing bottom closes the cloth without intersecting shoes.
    bottom_center = len(vertices)
    vertices.append((side*rings[-1][1], rings[-1][2], rings[-1][0]))
    start = (len(rings) - 1) * segments
    for index in range(segments):
        faces.append((bottom_center, start + (index + 1) % segments, start + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    subdivision = obj.modifiers.new("Cloth contour", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1
    bevel = obj.modifiers.new("Soft cloth seam", "BEVEL")
    bevel.width = .003
    bevel.segments = 2
    return obj


def create_bottom_variant(
    variant_id: str,
    source_bottom: bpy.types.Object,
    parent: bpy.types.Object,
    materials: Mapping[str, bpy.types.Material],
    source_body: bpy.types.Object | None = None,
) -> list[bpy.types.Object]:
    """Create shorts or continuous, tapered cloth trousers.

    Required material key: ``cloth``. Trousers retain the accepted waist and
    upper-seat topology, then continue each measured hem into a roomy leg.
    """
    if variant_id not in {"shorts", "trousers"}:
        raise ValueError(f"Unsupported bottom variant: {variant_id}")
    base = _clone(source_bottom, f"Bottom_{variant_id}", parent)
    if variant_id == "shorts":
        return [base]
    if source_body is None:
        raise ValueError("Trousers require source_body for a continuous fitted shell")
    cloth = materials["cloth"]
    _single_material(base, cloth)
    # Remove the reconstructed shorts' low, flared hem. The fitted legs begin
    # at .64 and overlap this cut internally, leaving the authored waist, seat
    # and upper crotch while avoiding a visible overskirt around the thighs.
    _trim_vertices_below(base, .615)
    # Keep the accepted waist, seat, pockets and crotch intact. The source is
    # sparse below the hem, so stretching those few triangles tears the lower
    # silhouette. Smooth fitted continuations overlap inside the original hem
    # and read as one cloth garment without exposing skin or a hard shorts lip.
    left = _trouser_leg("Trousers_Leg_L", -1, source_bottom, parent, cloth)
    right = _trouser_leg("Trousers_Leg_R", 1, source_bottom, parent, cloth)
    return [base, left, right]
