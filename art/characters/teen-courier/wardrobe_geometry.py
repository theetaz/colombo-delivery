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


def _continuous_trousers(
    source_body: bpy.types.Object,
    source_bottom: bpy.types.Object,
    parent: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Author and union a fitted pelvis and two tapered full-length legs."""
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    segments = 32
    # Cross-sections follow the measured approved body. Above the crotch the
    # two volumes overlap and converge, forming a natural pelvis rather than
    # two vertical pipes. The ankle ring meets all three shoe variants.
    rings = [
        (.115, .165, -.079, .060, .073),
        (.200, .154, -.076, .060, .065),
        (.250, .148, -.071, .064, .067),
        (.300, .141, -.066, .068, .070),
        (.350, .138, -.058, .071, .075),
        (.400, .135, -.050, .075, .080),
        (.450, .128, -.027, .083, .102),
        (.500, .120, -.005, .090, .120),
        (.620, .105, .000, .105, .120),
        (.750, .080, .000, .110, .120),
        (.800, .070, .000, .095, .108),
    ]
    for side in (-1, 1):
        leg_start = len(vertices)
        for z, cx_abs, cy, rx, ry in rings:
            for index in range(segments):
                angle = 2 * math.pi * index / segments
                vertices.append((side * cx_abs + rx * math.cos(angle), cy + ry * math.sin(angle), z))
        for ring_index in range(len(rings) - 1):
            start = leg_start + ring_index * segments
            nxt = start + segments
            for index in range(segments):
                following = (index + 1) % segments
                faces.append((start + index, nxt + index, nxt + following, start + following))
        bottom = len(vertices)
        vertices.append((side * rings[0][1], rings[0][2], rings[0][0]))
        for index in range(segments):
            following = (index + 1) % segments
            faces.append((bottom, leg_start + following, leg_start + index))
        top_start = leg_start + (len(rings) - 1) * segments
        top = len(vertices)
        vertices.append((side * rings[-1][1], rings[-1][2], rings[-1][0]))
        for index in range(segments):
            following = (index + 1) % segments
            faces.append((top, top_start + index, top_start + following))

    # A closed hip/seat volume bridges the two leg forks before voxel union.
    # It fills the waist and crotch cleanly while the overlapping upper-leg
    # rings preserve two readable leg openings below it.
    latitude_segments = 16
    hip_start = len(vertices)
    for latitude in range(latitude_segments + 1):
        phi = -math.pi / 2 + math.pi * latitude / latitude_segments
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((
                .205 * math.cos(phi) * math.cos(angle),
                -.010 + .132 * math.cos(phi) * math.sin(angle),
                .700 + .160 * math.sin(phi),
            ))
    for latitude in range(latitude_segments):
        lower = hip_start + latitude * segments
        upper = lower + segments
        for index in range(segments):
            following = (index + 1) % segments
            faces.append((lower + index, upper + index, upper + following, lower + following))

    mesh = bpy.data.meshes.new("Bottom_trousers_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    normals = bmesh.new()
    normals.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normals, faces=normals.faces)
    normals.to_mesh(mesh)
    normals.free()
    mesh.update()

    trousers = bpy.data.objects.new("Bottom_trousers", mesh)
    bpy.context.collection.objects.link(trousers)
    trousers.parent = parent

    # Voxel union removes the internal overlap and yields one watertight
    # waist/seat/crotch/leg surface with no tube lips or knee boundaries.
    bpy.context.view_layer.objects.active = trousers
    trousers.select_set(True)
    contour = trousers.modifiers.new("Tailored section interpolation", "SUBSURF")
    contour.subdivision_type = "CATMULL_CLARK"
    contour.levels = 2
    contour.render_levels = 2
    bpy.ops.object.modifier_apply(modifier=contour.name)
    remesh = trousers.modifiers.new("Continuous trouser topology", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = .005
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    normals = bmesh.new()
    normals.from_mesh(trousers.data)
    bmesh.ops.recalc_face_normals(normals, faces=normals.faces)
    normals.to_mesh(trousers.data)
    normals.free()
    trousers.data.update()
    smooth = trousers.modifiers.new("Relax cloth surface", "SMOOTH")
    smooth.factor = .28
    smooth.iterations = 3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    for polygon in trousers.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True

    bevel = trousers.modifiers.new("Soft cloth edge", "BEVEL")
    bevel.width = .0015
    bevel.segments = 2
    return trousers


def create_bottom_variant(
    variant_id: str,
    source_bottom: bpy.types.Object,
    parent: bpy.types.Object,
    materials: Mapping[str, bpy.types.Material],
    source_body: bpy.types.Object | None = None,
) -> list[bpy.types.Object]:
    """Create approved shorts or a new, continuous fitted trouser garment.

    Required material key: ``cloth``. The long variant is newly authored and
    uses the reconstruction only for measured fit, never for visible topology.
    """
    if variant_id not in {"shorts", "trousers"}:
        raise ValueError(f"Unsupported bottom variant: {variant_id}")
    if variant_id == "shorts":
        return [_clone(source_bottom, f"Bottom_{variant_id}", parent)]
    if source_body is None:
        raise ValueError("Trousers require source_body for a continuous fitted shell")
    return [_continuous_trousers(source_body, source_bottom, parent, materials["cloth"])]
