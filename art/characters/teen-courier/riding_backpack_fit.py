"""Fit the frozen delivery-backpack harness to the approved riding torso.

This module changes only harness vertices in the caller's riding scene.  The
insulated shell, lid, back pad, materials, and standing backpack GLB remain
unchanged.  Call after the backpack review reference has been parented to
``Backpack_Attach`` and after the riding pose has been evaluated.
"""

from __future__ import annotations

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


HARNESS_PARTS = (
    "DeliveryBackpack_ShoulderStrap_L",
    "DeliveryBackpack_ShoulderStrap_R",
    "DeliveryBackpack_LowerWebbing_L",
    "DeliveryBackpack_LowerWebbing_R",
)

PIN_ANCHORS = {
    "DeliveryBackpack_ShoulderStrap_L": ("DeliveryBackpack_AnchorShoulderL", "DeliveryBackpack_AnchorLowerL"),
    "DeliveryBackpack_ShoulderStrap_R": ("DeliveryBackpack_AnchorShoulderR", "DeliveryBackpack_AnchorLowerR"),
    "DeliveryBackpack_LowerWebbing_L": ("DeliveryBackpack_AnchorLowerL",),
    "DeliveryBackpack_LowerWebbing_R": ("DeliveryBackpack_AnchorLowerR",),
}


def _surface_bvh(torso: bpy.types.Object, depsgraph):
    evaluated = torso.evaluated_get(depsgraph)
    vertices = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
    polygons = [tuple(polygon.vertices) for polygon in evaluated.data.polygons]
    return BVHTree.FromPolygons(vertices, polygons, all_triangles=False)


def fit_riding_harness(
    backpack: bpy.types.Object,
    torso: bpy.types.Object,
    *,
    clearance: float = 0.008,
    pin_radius: float = 0.028,
    max_move: float = 0.120,
) -> dict[str, dict[str, float]]:
    """Project riding-only harness vertices to 8 mm from the posed torso.

    Vertices at the bag's authored upper/lower anchors remain pinned, so the
    shell relationship does not change.  Projection is capped at 120 mm to
    reject unrelated body surfaces.  Returns before/after distance statistics.
    """
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    bvh = _surface_bvh(torso, depsgraph)
    result: dict[str, dict[str, float]] = {}

    for part_name in HARNESS_PARTS:
        part = bpy.data.objects.get(part_name)
        if part is None or part.type != "MESH" or part.parent != backpack:
            continue
        inverse = part.matrix_world.inverted()
        anchors = [bpy.data.objects[name].matrix_world.translation.copy() for name in PIN_ANCHORS[part_name]]
        part_pin_radius = pin_radius * (0.45 if "LowerWebbing" in part_name else 1.0)
        before, after = [], []
        moved = 0
        for vertex in part.data.vertices:
            point = part.matrix_world @ vertex.co
            nearest = bvh.find_nearest(point)
            if nearest is None:
                continue
            surface, normal, _, distance = nearest
            before.append(distance)
            anchor_distance = min((point - anchor).length for anchor in anchors)
            if distance > clearance and distance <= max_move and anchor_distance > part_pin_radius:
                direction = point - surface
                if direction.length_squared < 1e-10:
                    direction = normal
                direction.normalize()
                target = surface + direction * clearance
                # Ease out of the pinned region instead of making a hard kink.
                weight = min(1.0, (anchor_distance - part_pin_radius) / part_pin_radius)
                point = point.lerp(target, weight)
                vertex.co = inverse @ point
                moved += 1
            nearest_after = bvh.find_nearest(point)
            if nearest_after is not None:
                after.append(nearest_after[3])
        part.data.update()
        before.sort(); after.sort()
        result[part_name] = {
            "vertices": float(len(before)),
            "moved": float(moved),
            "before_median_m": before[len(before) // 2] if before else 0.0,
            "after_median_m": after[len(after) // 2] if after else 0.0,
            "after_p75_m": after[(len(after) * 3) // 4] if after else 0.0,
        }
    backpack["ridingHarnessFit"] = {
        "clearanceM": clearance,
        "pinRadiusM": pin_radius,
        "maxMoveM": max_move,
        "posedTorso": torso.name,
    }
    return result
