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
) -> list[bpy.types.Object]:
    """Extend the approved connected shorts shell into fitted woven trousers."""
    # Start from the approved shorts shell.  Its waist, hip, seat and crotch
    # already fit the character; extending its two hem loops avoids inventing
    # a second pelvis and guarantees shared garment topology.
    trousers = _clone(source_bottom, "Bottom_trousers", parent)
    bm = bmesh.new()
    bm.from_mesh(trousers.data)
    shorts_material = next(
        (index for index, candidate in enumerate(source_bottom.data.materials) if candidate and candidate.name == "Teen_Shorts"),
        None,
    )
    if shorts_material is None:
        raise ValueError("Original bottom has no Teen_Shorts material")
    shorts_faces = [face for face in bm.faces if face.material_index == shorts_material]
    shorts_verts = {vertex for face in shorts_faces for vertex in face.verts}
    components: list[set[bmesh.types.BMVert]] = []
    unseen = set(shorts_verts)
    while unseen:
        pending = [next(iter(unseen))]
        component: set[bmesh.types.BMVert] = set()
        while pending:
            vertex = pending.pop()
            if vertex not in unseen:
                continue
            unseen.remove(vertex)
            component.add(vertex)
            for edge in vertex.link_edges:
                for neighbor in edge.verts:
                    if neighbor in unseen and any(face.material_index == shorts_material for face in edge.link_faces):
                        pending.append(neighbor)
        components.append(component)
    shell = max(components, key=len)
    remove_faces = [face for face in bm.faces if face.material_index != shorts_material or any(vertex not in shell for vertex in face.verts)]
    bmesh.ops.delete(bm, geom=remove_faces, context="FACES")
    loose = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")

    boundary = [edge for edge in bm.edges if len(edge.link_faces) == 1]
    hem_edges = [edge for edge in boundary if max(vertex.co.z for vertex in edge.verts) < .60]
    edge_groups: list[list[bmesh.types.BMEdge]] = []
    remaining = set(hem_edges)
    while remaining:
        group = []
        pending = [next(iter(remaining))]
        while pending:
            edge = pending.pop()
            if edge not in remaining:
                continue
            remaining.remove(edge)
            group.append(edge)
            vertices = set(edge.verts)
            pending.extend(other for other in list(remaining) if vertices.intersection(other.verts))
        edge_groups.append(group)
    if len(edge_groups) != 2:
        bm.free()
        raise ValueError(f"Expected two closed trouser hem loops, found {len(edge_groups)}")

    for group in edge_groups:
        adjacency = {}
        for edge in group:
            a, b = edge.verts
            adjacency.setdefault(a, []).append(b)
            adjacency.setdefault(b, []).append(a)
        if any(len(neighbors) != 2 for neighbors in adjacency.values()):
            bm.free()
            raise ValueError("Trouser hem boundary is not a closed degree-two loop")
        start = next(iter(adjacency))
        ordered = [start]
        previous = None
        current = start
        while True:
            choices = [vertex for vertex in adjacency[current] if vertex is not previous]
            following = choices[0]
            if following is start:
                break
            ordered.append(following)
            previous, current = current, following
        center_x = sum(vertex.co.x for vertex in ordered) / len(ordered)
        center_y = sum(vertex.co.y for vertex in ordered) / len(ordered)
        source = [vertex.co.copy() for vertex in ordered]
        previous_ring = ordered
        # Loose straight chinos: gentle thigh ease followed by a restrained
        # taper, with tiny opposing knee/cuff shifts for lived-in asymmetry.
        sections = [
            (.470, 1.00, 1.00, 0, 0),
            (.410, .94, .91, .002, .002),
            (.340, .88, .84, -.002, .004),
            (.270, .83, .79, .001, .002),
            (.200, .79, 1.05, -.002, -.010),
            (.105, .86, 1.20, .001, -.012),
        ]
        side = -1 if center_x < 0 else 1
        for z, scale_x, scale_y, x_shift, y_shift in sections:
            ring = []
            for point in source:
                ring.append(bm.verts.new((
                    center_x + (point.x - center_x) * scale_x + side * x_shift,
                    center_y + (point.y - center_y) * scale_y + y_shift,
                    z,
                )))
            for index in range(len(ring)):
                following = (index + 1) % len(ring)
                bm.faces.new((previous_ring[index], previous_ring[following], ring[following], ring[index]))
            previous_ring = ring
        inner = []
        for vertex in previous_ring:
            inner.append(bm.verts.new((
                center_x + (vertex.co.x - center_x) * .88,
                center_y + (vertex.co.y - center_y) * .86,
                vertex.co.z + .006,
            )))
        for index in range(len(inner)):
            following = (index + 1) % len(inner)
            bm.faces.new((previous_ring[index], previous_ring[following], inner[following], inner[index]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(trousers.data)
    bm.free()
    trousers.data.update()
    _single_material(trousers, material)
    for polygon in trousers.data.polygons:
        polygon.use_smooth = True
    contour = trousers.modifiers.new("Tailored cloth contour", "SUBSURF")
    contour.subdivision_type = "CATMULL_CLARK"
    contour.levels = 1
    contour.render_levels = 1
    bevel = trousers.modifiers.new("Woven cloth edge softness", "BEVEL")
    bevel.width = .0012
    bevel.segments = 2
    trousers["garment"] = "trousers"
    trousers["garmentRole"] = "shell"
    made = [trousers]

    projector = _SurfaceProjector(trousers, parent)

    def fitted_seam(name: str, path, depth=.00105, back=False):
        points = []
        for x, z in path:
            if back:
                hit, normal, _, _ = projector.tree.ray_cast(Vector((x, -.45, z)), Vector((0, 1, 0)), 1.0)
                if hit is None or normal is None:
                    continue
                points.append(parent.matrix_world.inverted() @ (trousers.matrix_world @ (hit + normal.normalized() * .0015)))
            else:
                point, _ = projector.point(x, z, .0015)
                points.append(point)
        if len(points) < 2:
            return
        data = bpy.data.curves.new(name, "CURVE")
        data.dimensions = "3D"
        data.bevel_depth = depth
        data.bevel_resolution = 2
        spline = data.splines.new("BEZIER")
        spline.bezier_points.add(len(points) - 1)
        for handle, point in zip(spline.bezier_points, points):
            handle.co = point
            handle.handle_left_type = "AUTO"
            handle.handle_right_type = "AUTO"
        detail = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(detail)
        detail.parent = parent
        data.materials.append(material)
        detail["garment"] = "trousers"
        detail["garmentRole"] = "detail"
        made.append(detail)

    fitted_seam("Trousers_Waist_Stitch", [(-.150,.790),(-.075,.799),(0,.800),(.075,.799),(.150,.790)], .00125)
    fitted_seam("Trousers_Fly", [(0,.766),(.001,.738),(-.003,.708),(-.008,.687)], .0010)
    fitted_seam("Trousers_Pocket_L", [(-.158,.758),(-.140,.728),(-.116,.699)], .0011)
    fitted_seam("Trousers_Pocket_R", [(.158,.758),(.140,.728),(.116,.699)], .0011)
    fitted_seam("Trousers_Back_Pocket_L", [(-.140,.714),(-.098,.707),(-.058,.710)], .0010, True)
    fitted_seam("Trousers_Back_Pocket_R", [(.140,.714),(.098,.707),(.058,.710)], .0010, True)
    for side in (-1, 1):
        s=float(side)
        # Asymmetric short folds break the perfect tube highlight without
        # changing the clean straight-leg silhouette.
        fitted_seam(f"Trousers_Knee_Crease_{side}", [(s*.142,.405),(s*.119,.393),(s*.096,.386)], .00085)
        fitted_seam(f"Trousers_Ankle_Crease_{side}", [(s*.128,.190),(s*.111,.176),(s*.097,.165)], .00075)
    return made



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
    return _continuous_trousers(source_body, source_bottom, parent, materials["cloth"])
