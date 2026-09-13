"""Build the original, articulated commuter bicycle v2 asset.

Run with Blender 5.1+:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python \
    art/bicycles/commuter-v2/generator.py

The scene is authored directly in the runtime coordinate contract: metres, +Y up,
-Z forward, and +X on the bicycle's drivetrain/right side.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


SCRIPT = Path(__file__).resolve()
ROOT_DIR = SCRIPT.parents[3]
ART_DIR = SCRIPT.parent
OUT_DIR = ROOT_DIR / "public" / "models"
BLEND_PATH = ART_DIR / "commuter_bicycle_v2.blend"
GLB_PATH = OUT_DIR / "commuter_bicycle_v2.glb"
MANIFEST_PATH = OUT_DIR / "commuter_bicycle_v2.manifest.json"

WHEEL_RADIUS = 0.349
REAR_AXLE = Vector((0.0, WHEEL_RADIUS, 0.543))
FRONT_AXLE = Vector((0.0, WHEEL_RADIUS, -0.550))
BB = Vector((0.0, WHEEL_RADIUS - 0.060, 0.097))
HEAD_ANGLE_DEG = 69.5
STEER_TILT_DEG = 90.0 - HEAD_ANGLE_DEG
STEER_TILT_RAD = math.radians(STEER_TILT_DEG)
STEER_AXIS = Vector((0.0, math.cos(STEER_TILT_RAD), math.sin(STEER_TILT_RAD)))
FORK_RAKE = 0.045
# Solve the head-axis position so the front axle is exactly 45 mm ahead of the
# inclined axis, while retaining the referenced 1.093 m wheelbase.
HEAD_LOWER_Y = 0.774
HEAD_LOWER_Z = FRONT_AXLE.z - (
    (-FORK_RAKE + STEER_AXIS.z * (FRONT_AXLE.y - HEAD_LOWER_Y)) / STEER_AXIS.y
)
HEAD_LOWER = Vector((0.0, HEAD_LOWER_Y, HEAD_LOWER_Z))
HEAD_UPPER = HEAD_LOWER + STEER_AXIS * 0.12278
SEAT_CLUSTER = Vector((0.0, 0.805, 0.258))

COLORS = {
    "FramePaint": (0.055, 0.255, 0.220, 1.0),
    "Aluminum": (0.44, 0.49, 0.50, 1.0),
    "DarkMetal": (0.050, 0.060, 0.060, 1.0),
    "Rubber": (0.016, 0.019, 0.019, 1.0),
    "Saddle": (0.050, 0.045, 0.038, 1.0),
    "Cable": (0.012, 0.014, 0.014, 1.0),
    "Reflector": (0.95, 0.27, 0.035, 1.0),
    "BrakePad": (0.12, 0.13, 0.13, 1.0),
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        if block is not bpy.data.materials:
            for item in list(block):
                if item.users == 0:
                    block.remove(item)


def make_materials() -> dict[str, bpy.types.Material]:
    materials = {}
    for name, color in COLORS.items():
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = color
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = {
            "FramePaint": 0.28,
            "Aluminum": 0.26,
            "DarkMetal": 0.31,
            "Rubber": 0.82,
            "Saddle": 0.72,
            "Cable": 0.60,
            "Reflector": 0.25,
        }.get(name, 0.5)
        bsdf.inputs["Metallic"].default_value = 0.76 if name in {"Aluminum", "DarkMetal"} else 0.0
        materials[name] = mat
    return materials


def empty(name: str, location=(0, 0, 0), parent=None, rotation=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    obj.parent = parent
    return obj


def finish(obj, material: str, parent, smooth=True):
    obj.data.materials.append(MATERIALS[material])
    obj.parent = parent
    if smooth and hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    obj["mergeMaterial"] = material
    return obj


def cylinder(name, location, radius, depth, material, parent, vertices=12, rotation=(0, 0, 0), radius2=None):
    if radius2 is None:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
        )
    else:
        bpy.ops.mesh.primitive_cone_add(
            vertices=vertices,
            radius1=radius,
            radius2=radius2,
            depth=depth,
            location=location,
            rotation=rotation,
        )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material, parent)


def tube(name, a, b, radius, material, parent, vertices=12, radius2=None):
    a = Vector(a)
    b = Vector(b)
    direction = b - a
    obj = cylinder(name, (a + b) * 0.5, radius, direction.length, material, parent, vertices, radius2=radius2)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    return obj


def cube(name, location, size, material, parent, bevel=0.0, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value * 0.5 for value in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, material, parent, smooth=False)
    if bevel:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def sphere(name, location, scale, material, parent, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material, parent)


def torus(name, location, major, minor, material, parent, rotation=(0, 0, 0), major_segments=48, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material, parent)


def gear_plate(name, location, outer_radius, inner_radius, thickness, teeth, material, parent):
    """Create a toothed annular sprocket plate in the YZ plane, with axle along X."""
    segments = teeth * 2
    verts = []
    faces = []
    for x_side in (-thickness * 0.5, thickness * 0.5):
        for ring in ("outer", "inner"):
            for index in range(segments):
                angle = math.tau * index / segments
                if ring == "outer":
                    radius = outer_radius if index % 2 else outer_radius - min(0.004, outer_radius * 0.055)
                else:
                    radius = inner_radius
                verts.append(
                    (
                        location[0] + x_side,
                        location[1] + math.sin(angle) * radius,
                        location[2] + math.cos(angle) * radius,
                    )
                )
    outer_back = 0
    inner_back = segments
    outer_front = segments * 2
    inner_front = segments * 3
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.extend(
            [
                (outer_back + index, outer_back + nxt, outer_front + nxt, outer_front + index),
                (inner_back + nxt, inner_back + index, inner_front + index, inner_front + nxt),
                (outer_front + index, outer_front + nxt, inner_front + nxt, inner_front + index),
                (outer_back + nxt, outer_back + index, inner_back + index, inner_back + nxt),
            ]
        )
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, material, parent, smooth=False)


def saddle_mesh(name, parent):
    """Create a narrow-nose saddle that widens toward the supported rear shell."""
    sections = (
        # z, center-y, half-width-x, half-thickness-y
        (0.115, 0.995, 0.022, 0.014),
        (0.175, 0.998, 0.033, 0.020),
        (0.265, 1.000, 0.055, 0.026),
        (0.365, 1.000, 0.091, 0.032),
        (0.425, 0.993, 0.067, 0.026),
    )
    segments = 16
    verts = []
    faces = []
    for z, center_y, radius_x, radius_y in sections:
        for index in range(segments):
            angle = math.tau * index / segments
            verts.append((math.cos(angle) * radius_x, center_y + math.sin(angle) * radius_y, z))
    for section in range(len(sections) - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            a = section * segments + index
            b = section * segments + nxt
            c = (section + 1) * segments + nxt
            d = (section + 1) * segments + index
            faces.append((a, b, c, d))
    faces.append(tuple(range(segments - 1, -1, -1)))
    last = (len(sections) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, "Saddle", parent)


def curve_tube(name, points, radius, material, parent, resolution=1):
    curve = bpy.data.curves.new(name + "Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[material])
    obj.parent = parent
    obj["mergeMaterial"] = material
    return obj


def arc_strip(name, axle, radius, start_deg, end_deg, width, thickness, material, parent, samples=28):
    """Create a fender as a thin rectangular ribbon around a wheel in the YZ plane."""
    verts = []
    faces = []
    for index in range(samples):
        angle = math.radians(start_deg + (end_deg - start_deg) * index / (samples - 1))
        center = Vector((axle[0], axle[1] + radius * math.sin(angle), axle[2] + radius * math.cos(angle)))
        radial = Vector((0, math.sin(angle), math.cos(angle)))
        for x in (-width * 0.5, width * 0.5):
            for depth in (-thickness * 0.5, thickness * 0.5):
                point = center + Vector((x, 0, 0)) + radial * depth
                verts.append(tuple(point))
    for index in range(samples - 1):
        base = index * 4
        nxt = base + 4
        faces.extend(
            [
                (base, nxt, nxt + 1, base + 1),
                (base + 2, base + 3, nxt + 3, nxt + 2),
                (base, base + 2, nxt + 2, nxt),
                (base + 1, nxt + 1, nxt + 3, base + 3),
            ]
        )
    faces.extend([(0, 1, 3, 2), (len(verts) - 4, len(verts) - 2, len(verts) - 1, len(verts) - 3)])
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, material, parent, smooth=False)


def to_local(obj, world_point):
    bpy.context.view_layer.update()
    return obj.matrix_world.inverted() @ Vector(world_point)


def build_wheel(node, prefix, include_cassette=False):
    torus(prefix + "_Tire", (0, 0, 0), 0.330, 0.019, "Rubber", node, (0, math.pi / 2, 0), 64, 10)
    torus(prefix + "_Rim", (0, 0, 0), 0.311, 0.008, "Aluminum", node, (0, math.pi / 2, 0), 64, 6)
    cylinder(prefix + "_Hub", (0, 0, 0), 0.021, 0.108, "Aluminum", node, 16, (0, math.pi / 2, 0))
    for index in range(28):
        angle = math.tau * index / 28
        hub_x = -0.040 if index % 2 else 0.040
        rim = (0.0, math.sin(angle) * 0.303, math.cos(angle) * 0.303)
        tube(f"{prefix}_Spoke_{index + 1:02d}", (hub_x, 0, 0), rim, 0.00115, "Aluminum", node, 5)
    # Six-arm disc rotor, mounted on the non-drive/left side.
    rotor_x = -0.060
    torus(prefix + "_RotorTrack", (rotor_x, 0, 0), 0.075, 0.006, "Aluminum", node, (0, math.pi / 2, 0), 32, 5)
    for index in range(6):
        angle = math.tau * index / 6
        tube(
            f"{prefix}_RotorArm_{index + 1}",
            (rotor_x, math.sin(angle) * 0.023, math.cos(angle) * 0.023),
            (rotor_x, math.sin(angle) * 0.070, math.cos(angle) * 0.070),
            0.003,
            "Aluminum",
            node,
            6,
        )
    if include_cassette:
        cassette = ((0.036, 14), (0.043, 16), (0.051, 18), (0.060, 20), (0.070, 24), (0.080, 28), (0.090, 32))
        for index, (radius, teeth) in enumerate(cassette):
            x = 0.060 + index * 0.0042
            gear_plate(f"Cassette_Sprocket_{index + 1}", (x, 0, 0), radius, 0.014, 0.0022, teeth, "DarkMetal", node)


def merge_objects(parent, material, final_name, preserve=()):
    candidates = [
        obj
        for obj in list(parent.children)
        if obj.type in {"MESH", "CURVE"}
        and obj.get("mergeMaterial") == material
        and obj.name not in preserve
    ]
    if not candidates:
        return None
    for obj in candidates:
        if obj.type == "CURVE":
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.convert(target="MESH")
            obj.select_set(False)
    candidates = [obj for obj in list(parent.children) if obj.type == "MESH" and obj.get("mergeMaterial") == material and obj.name not in preserve]
    if len(candidates) == 1:
        candidates[0].name = final_name
        return candidates[0]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in candidates:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = candidates[0]
    bpy.ops.object.join()
    merged = bpy.context.object
    merged.name = final_name
    merged.parent = parent
    return merged


def apply_modifiers():
    for obj in list(bpy.data.objects):
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)


reset_scene()
MATERIALS = make_materials()

root = empty("CommuterBicycleV2")
root["assetType"] = "commuter-hybrid-bicycle"
root["contractVersion"] = 2
root["units"] = "metres"
root["upAxis"] = "+Y"
root["forwardAxis"] = "-Z"
root["rightSide"] = "+X"
root["wheelRadius"] = WHEEL_RADIUS
root["wheelbase"] = 1.093
root["revision"] = "commuter-bicycle-v2/1"
root["reviewStatus"] = "awaiting-human-review"

rear = empty("RearWheel", REAR_AXLE, root)
rear["rotationAxis"] = "local X"
build_wheel(rear, "RearWheel", include_cassette=True)

# Local +Y is the inclined steering axis, tilted rearward 20.5 degrees from vertical.
front_assembly = empty("FrontAssembly", HEAD_LOWER, root, (math.radians(STEER_TILT_DEG), 0, 0))
front_assembly["steeringAxis"] = "local Y"
front_assembly["headAngleDegrees"] = HEAD_ANGLE_DEG
front_assembly["forkRake"] = FORK_RAKE
front = empty("FrontWheel", to_local(front_assembly, FRONT_AXLE), front_assembly)
front["rotationAxis"] = "local X"
build_wheel(front, "FrontWheel")

# Frame: round tubes meet at mechanically coherent head, seat, crank, and dropout junctions.
tube("DownTube", BB, HEAD_LOWER, 0.024, "FramePaint", root, 16, 0.021)
tube("TopTube", SEAT_CLUSTER, HEAD_UPPER, 0.019, "FramePaint", root, 16, 0.017)
tube("SeatTube", BB, SEAT_CLUSTER, 0.022, "FramePaint", root, 16, 0.019)
for x in (-0.038, 0.038):
    side = "L" if x < 0 else "R"
    tube(f"ChainStay_{side}", (x, REAR_AXLE.y, REAR_AXLE.z), (x, BB.y, BB.z), 0.012, "FramePaint", root, 12, 0.016)
    tube(f"SeatStay_{side}", (x, REAR_AXLE.y, REAR_AXLE.z), (x, SEAT_CLUSTER.y, SEAT_CLUSTER.z), 0.010, "FramePaint", root, 12, 0.014)
tube("HeadTube", HEAD_LOWER, HEAD_UPPER, 0.028, "FramePaint", root, 18, 0.025)
cylinder("BottomBracketShell", BB, 0.033, 0.112, "FramePaint", root, 18, (0, math.pi / 2, 0))
cylinder("SeatClamp", SEAT_CLUSTER + Vector((0, 0.012, 0.007)), 0.025, 0.023, "DarkMetal", root, 16)

# Seatpost and compact, slightly nose-down commuter saddle.
seatpost_top = Vector((0.0, 0.988, 0.326))
tube("SeatPost", SEAT_CLUSTER, seatpost_top, 0.014, "Aluminum", root, 14)
saddle_mesh("Saddle", root)
cube("SaddleRail_L", (-0.028, 0.965, 0.308), (0.007, 0.030, 0.190), "Aluminum", root, 0.002)
cube("SaddleRail_R", (0.028, 0.965, 0.308), (0.007, 0.030, 0.190), "Aluminum", root, 0.002)
seat_attach = empty("Seat_Attach", (0, 1.023, 0.282), root)
seat_attach["contactSurface"] = "saddle top"

# Fork, crown, stem, swept flat bar, grips, levers, front caliper, and steering cable.
def fl(world):
    return to_local(front_assembly, world)


fork_crown = Vector((0, 0.755, -0.345))
fork_mid = Vector((0, 0.515, -0.415))
for x in (-0.044, 0.044):
    side = "L" if x < 0 else "R"
    tube(f"ForkBladeUpper_{side}", fl((x, fork_crown.y, fork_crown.z)), fl((x, fork_mid.y, fork_mid.z)), 0.016, "DarkMetal", front_assembly, 12, 0.013)
    tube(f"ForkBladeLower_{side}", fl((x, fork_mid.y, fork_mid.z)), fl((x, FRONT_AXLE.y, FRONT_AXLE.z)), 0.013, "DarkMetal", front_assembly, 12, 0.010)
tube("ForkCrown", fl((-0.050, fork_crown.y, fork_crown.z)), fl((0.050, fork_crown.y, fork_crown.z)), 0.018, "DarkMetal", front_assembly, 14)
tube("Steerer", fl(HEAD_LOWER), fl(Vector((0, 0.945, -0.272))), 0.018, "DarkMetal", front_assembly, 14)
tube("Stem", fl((0, 0.925, -0.277)), fl((0, 0.984, -0.365)), 0.017, "DarkMetal", front_assembly, 14)
bar_center = Vector((0, 0.992, -0.367))
left_points_world = [bar_center, Vector((-0.155, 0.995, -0.365)), Vector((-0.330, 0.987, -0.325))]
right_points_world = [bar_center, Vector((0.155, 0.995, -0.365)), Vector((0.330, 0.987, -0.325))]
curve_tube("Handlebar_L", [fl(point) for point in left_points_world], 0.011, "DarkMetal", front_assembly)
curve_tube("Handlebar_R", [fl(point) for point in right_points_world], 0.011, "DarkMetal", front_assembly)
for side, sign in (("L", -1), ("R", 1)):
    grip_center = Vector((sign * 0.286, 0.989, -0.334))
    grip_outer = Vector((sign * 0.342, 0.986, -0.320))
    tube(f"Grip_{side}", fl(grip_center), fl(grip_outer), 0.017, "Rubber", front_assembly, 14)
    lever_a = Vector((sign * 0.245, 0.970, -0.345))
    lever_b = Vector((sign * 0.212, 0.916, -0.390))
    tube(f"BrakeLever_{side}", fl(lever_a), fl(lever_b), 0.006, "Aluminum", front_assembly, 8, 0.004)
    attach = empty(f"Grip_{side}_Attach", fl(grip_center), front_assembly)
    attach["contactAxis"] = "handlebar tangent"
cube("FrontBrakeCaliper", fl((-0.075, 0.425, -0.525)), (0.034, 0.070, 0.030), "DarkMetal", front_assembly, 0.007)
curve_tube(
    "FrontBrakeHose",
    [fl((0.225, 0.965, -0.352)), fl((0.105, 0.880, -0.320)), fl((-0.050, 0.600, -0.410)), fl((-0.075, 0.445, -0.515))],
    0.0024,
    "Cable",
    front_assembly,
)

# Rear brake hardware and routed hose.
cube("RearBrakeCaliper", (-0.073, 0.425, 0.517), (0.034, 0.070, 0.030), "DarkMetal", root, 0.007)
curve_tube(
    "RearBrakeHose",
    [(-0.018, 0.875, -0.270), (-0.022, 0.770, -0.185), (-0.025, 0.625, 0.080), (-0.060, 0.445, 0.490)],
    0.0024,
    "Cable",
    root,
)

# Right-side drivetrain. Crank and pedals retain independent runtime pivots.
crank = empty("Crank", BB, root)
crank["rotationAxis"] = "local X"
cylinder("CrankAxle", (0, 0, 0), 0.023, 0.188, "DarkMetal", crank, 16, (0, math.pi / 2, 0))
for ring_index, radius in enumerate((0.104, 0.082)):
    ring_x = 0.075 + ring_index * 0.004
    teeth = 42 if ring_index == 0 else 30
    inner_radius = 0.062 if ring_index == 0 else 0.048
    gear_plate(f"Chainring_{ring_index + 1}", (ring_x, 0, 0), radius, inner_radius, 0.004, teeth, "DarkMetal", crank)
    for arm_index in range(5):
        angle = math.tau * arm_index / 5
        tube(
            f"Chainring_{ring_index + 1}_Spider_{arm_index + 1}",
            (ring_x, math.sin(angle) * 0.021, math.cos(angle) * 0.021),
            (ring_x, math.sin(angle) * (inner_radius + 0.004), math.cos(angle) * (inner_radius + 0.004)),
            0.0055,
            "DarkMetal",
            crank,
            8,
        )
for side, x, z in (("R", 0.112, -0.170), ("L", -0.112, 0.170)):
    tube(f"CrankArm_{side}", (x, 0, 0), (x, 0, z), 0.010, "DarkMetal", crank, 10)
    pedal = empty(f"Pedal_{side}", (x, 0, z), crank)
    pedal["rotationAxis"] = "local X"
    cylinder(f"PedalSpindle_{side}", (0, 0, 0), 0.006, 0.085, "Aluminum", pedal, 10, (0, math.pi / 2, 0))
    cube(f"PedalPlatform_{side}", (0, 0, 0), (0.105, 0.020, 0.082), "Rubber", pedal, 0.006)
    attach = empty(f"Pedal_{side}_Attach", (0, 0.010, 0), pedal)
    attach["contactSurface"] = "pedal top"

# Chain follows the large front ring and a middle cassette sprocket on +X/right.
chain_x = 0.083
rear_sprocket_center = Vector((chain_x, REAR_AXLE.y, REAR_AXLE.z))
front_ring_center = Vector((chain_x, BB.y, BB.z))


def chain_path(front_center, front_radius, rear_center, rear_radius, x, arc_steps=22):
    """Return a closed external-tangent belt path with open runs and true wrap arcs."""
    # Work in (z, y), then restore runtime (x, y, z) order.
    c_front = Vector((front_center.z, front_center.y))
    c_rear = Vector((rear_center.z, rear_center.y))
    delta = c_rear - c_front
    distance = delta.length
    along = delta / distance
    perpendicular = Vector((-along.y, along.x))
    along_component = (front_radius - rear_radius) / distance
    perpendicular_component = math.sqrt(1.0 - along_component * along_component)
    normals = [along * along_component + perpendicular * perpendicular_component, along * along_component - perpendicular * perpendicular_component]
    normals.sort(key=lambda normal: normal.y, reverse=True)
    upper_normal, lower_normal = normals
    front_upper = c_front + upper_normal * front_radius
    rear_upper = c_rear + upper_normal * rear_radius
    front_lower = c_front + lower_normal * front_radius
    rear_lower = c_rear + lower_normal * rear_radius

    def angle_of(point, center):
        offset = point - center
        return math.atan2(offset.y, offset.x)

    def arc(center, radius, start_point, end_point, through_angle):
        start = angle_of(start_point, center)
        end = angle_of(end_point, center)
        ccw_delta = (end - start) % math.tau
        target_delta = (through_angle - start) % math.tau
        delta_angle = ccw_delta if target_delta <= ccw_delta else -(math.tau - ccw_delta)
        return [
            center + Vector((math.cos(start + delta_angle * i / arc_steps), math.sin(start + delta_angle * i / arc_steps))) * radius
            for i in range(1, arc_steps + 1)
        ]

    points_2d = [front_upper, rear_upper]
    points_2d.extend(arc(c_rear, rear_radius, rear_upper, rear_lower, 0.0))  # rearward outside of cassette
    points_2d.append(front_lower)
    points_2d.extend(arc(c_front, front_radius, front_lower, front_upper, math.pi))  # forward outside of chainring
    return [(x, point.y, point.x) for point in points_2d]


curve_tube("Chain", chain_path(front_ring_center, 0.108, rear_sprocket_center, 0.064, chain_x), 0.0032, "DarkMetal", root)
tube("RearDerailleurBody", (0.100, 0.355, 0.525), (0.110, 0.270, 0.595), 0.013, "DarkMetal", root, 10, 0.009)
torus("DerailleurJockeyUpper", (0.108, 0.312, 0.563), 0.026, 0.004, "DarkMetal", root, (0, math.pi / 2, 0), 20, 4)
torus("DerailleurJockeyLower", (0.110, 0.258, 0.610), 0.026, 0.004, "DarkMetal", root, (0, math.pi / 2, 0), 20, 4)

# Full practical fenders and a light rear rack, consistent with an equipped commuter.
arc_strip("RearFender", REAR_AXLE, 0.373, 18, 166, 0.052, 0.004, "DarkMetal", root)
front_axle_local = to_local(front_assembly, FRONT_AXLE)
arc_strip("FrontFender", front_axle_local, 0.373, 18, 162, 0.052, 0.004, "DarkMetal", front_assembly)
for x in (-0.145, 0.145):
    side = "L" if x < 0 else "R"
    tube(f"RackTopRail_{side}", (x, 0.735, 0.370), (x, 0.735, 0.755), 0.007, "DarkMetal", root, 8)
    tube(f"RackStayRear_{side}", (x, 0.735, 0.735), (x * 0.36, 0.375, 0.560), 0.006, "DarkMetal", root, 8)
    tube(f"RackStayFront_{side}", (x, 0.735, 0.405), (x * 0.36, 0.755, 0.280), 0.006, "DarkMetal", root, 8)
for index, z in enumerate((0.395, 0.485, 0.575, 0.665, 0.750)):
    tube(f"RackCrossbar_{index + 1}", (-0.145, 0.735, z), (0.145, 0.735, z), 0.006, "DarkMetal", root, 8)
cube("RearReflector", (0, 0.715, 0.775), (0.080, 0.035, 0.018), "Reflector", root, 0.006)

# Apply bevels, then merge fixed same-material geometry within each articulated assembly.
apply_modifiers()
for parent, prefix in (
    (root, "Fixed"),
    (rear, "RearWheel"),
    (front_assembly, "FrontAssembly"),
    (front, "FrontWheel"),
    (crank, "Crank"),
):
    for material in COLORS:
        merge_objects(parent, material, f"{prefix}_{material}")
for pedal_name in ("Pedal_L", "Pedal_R"):
    pedal = bpy.data.objects[pedal_name]
    for material in COLORS:
        merge_objects(pedal, material, f"{pedal_name}_{material}")

# Scene metadata and stable source file.
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.length_unit = "METERS"
bpy.context.scene["assetProvenance"] = "Original procedural project artwork; no external meshes, textures, or brand marks."
bpy.context.scene["geometryReference"] = "Cannondale Quick official medium geometry, used for dimensional proportion only."
bpy.context.preferences.filepaths.save_version = 0
ART_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)

# Bounds are measured from evaluated source geometry in authored Y-up space.
bpy.context.view_layer.update()
points = []
for obj in root.children_recursive:
    if obj.type == "MESH":
        points.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
mins = [min(point[index] for point in points) for index in range(3)]
maxs = [max(point[index] for point in points) for index in range(3)]
bounds = [round(maxs[index] - mins[index], 5) for index in range(3)]

# export_yup=False is intentional: the source is already +Y up and this preserves pivots.
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    export_apply=True,
    export_yup=False,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)


def read_glb(path: Path):
    blob = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<4sII", blob, 0)
    if magic != b"glTF" or version != 2 or total_length != len(blob):
        raise RuntimeError("Invalid GLB header")
    json_length, json_type = struct.unpack_from("<II", blob, 12)
    if json_type != 0x4E4F534A:
        raise RuntimeError("Missing GLB JSON chunk")
    return blob, json.loads(blob[20 : 20 + json_length])


def exported_vertex_bounds(blob, gltf):
    """Measure actual exported POSITION vertices after every glTF node transform."""
    json_length = struct.unpack_from("<I", blob, 12)[0]
    binary_header = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", blob, binary_header)
    if binary_type != 0x004E4942:
        raise RuntimeError("Missing GLB binary chunk")
    binary_start = binary_header + 8
    binary_end = binary_start + binary_length
    if binary_end > len(blob):
        raise RuntimeError("Truncated GLB binary chunk")

    def local_matrix(node):
        if "matrix" in node:
            values = node["matrix"]
            return Matrix([values[0:4], values[4:8], values[8:12], values[12:16]]).transposed()
        translation = Vector(node.get("translation", (0.0, 0.0, 0.0)))
        x, y, z, w = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
        scale = node.get("scale", (1.0, 1.0, 1.0))
        return Matrix.Translation(translation) @ Quaternion((w, x, y, z)).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))

    exported_points = []

    def visit(node_index, parent_matrix):
        node = gltf["nodes"][node_index]
        world_matrix = parent_matrix @ local_matrix(node)
        if "mesh" in node:
            for primitive in gltf["meshes"][node["mesh"]].get("primitives", []):
                accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
                if accessor["componentType"] != 5126 or accessor["type"] != "VEC3":
                    raise RuntimeError("Expected float32 VEC3 POSITION accessor")
                view = gltf["bufferViews"][accessor["bufferView"]]
                stride = view.get("byteStride", 12)
                offset = binary_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
                for index in range(accessor["count"]):
                    point = Vector(struct.unpack_from("<fff", blob, offset + index * stride))
                    exported_points.append(world_matrix @ point)
        for child_index in node.get("children", []):
            visit(child_index, world_matrix)

    for root_index in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        visit(root_index, Matrix.Identity(4))
    export_mins = [min(point[index] for point in exported_points) for index in range(3)]
    export_maxs = [max(point[index] for point in exported_points) for index in range(3)]
    return export_mins, export_maxs


blob, gltf = read_glb(GLB_PATH)
export_mins, export_maxs = exported_vertex_bounds(blob, gltf)
if max(abs(export_mins[index] - mins[index]) for index in range(3)) > 2e-5 or max(
    abs(export_maxs[index] - maxs[index]) for index in range(3)
) > 2e-5:
    raise RuntimeError(f"Exported vertex bounds differ from source: {export_mins}..{export_maxs}")
# The contract publishes bounds measured from the final exported vertices.
mins = export_mins
maxs = export_maxs
bounds = [round(maxs[index] - mins[index], 5) for index in range(3)]
nodes = gltf.get("nodes", [])
node_by_name = {node.get("name"): index for index, node in enumerate(nodes)}
required_nodes = {
    "CommuterBicycleV2",
    "RearWheel",
    "FrontAssembly",
    "FrontWheel",
    "Crank",
    "Pedal_L",
    "Pedal_R",
    "Grip_L_Attach",
    "Grip_R_Attach",
    "Seat_Attach",
    "Pedal_L_Attach",
    "Pedal_R_Attach",
}
missing = sorted(required_nodes - node_by_name.keys())
if missing:
    raise RuntimeError(f"Missing required exported nodes: {missing}")

parents = {}
for parent_index, node in enumerate(nodes):
    for child_index in node.get("children", []):
        parents[child_index] = parent_index


def assert_parent(child, expected_parent):
    actual_index = parents.get(node_by_name[child])
    actual_name = nodes[actual_index].get("name") if actual_index is not None else None
    if actual_name != expected_parent:
        raise RuntimeError(f"{child} parent is {actual_name}, expected {expected_parent}")


assert_parent("RearWheel", "CommuterBicycleV2")
assert_parent("FrontAssembly", "CommuterBicycleV2")
assert_parent("FrontWheel", "FrontAssembly")
assert_parent("Crank", "CommuterBicycleV2")
assert_parent("Pedal_L", "Crank")
assert_parent("Pedal_R", "Crank")
assert_parent("Grip_L_Attach", "FrontAssembly")
assert_parent("Grip_R_Attach", "FrontAssembly")
assert_parent("Pedal_L_Attach", "Pedal_L")
assert_parent("Pedal_R_Attach", "Pedal_R")
for pedal_attach in ("Pedal_L_Attach", "Pedal_R_Attach"):
    exported_contact = nodes[node_by_name[pedal_attach]].get("translation", [0.0, 0.0, 0.0])
    if max(abs(actual - expected) for actual, expected in zip(exported_contact, (0.0, 0.010, 0.0))) > 1e-6:
        raise RuntimeError(f"{pedal_attach} does not match the platform top: {exported_contact}")

scene_roots = gltf["scenes"][gltf.get("scene", 0)]["nodes"]
if scene_roots != [node_by_name["CommuterBicycleV2"]]:
    raise RuntimeError(f"Expected sole scene root CommuterBicycleV2, got {[nodes[i].get('name') for i in scene_roots]}")
if mins[1] < -0.0015 or abs(mins[1]) > 0.003:
    raise RuntimeError(f"Ground-contact bound invalid: minY={mins[1]:.6f}")
if abs((REAR_AXLE.z - FRONT_AXLE.z) - 1.093) > 1e-6:
    raise RuntimeError("Wheelbase constant mismatch")
axle_offset = FRONT_AXLE - HEAD_LOWER
measured_fork_rake = abs(STEER_AXIS.y * axle_offset.z - STEER_AXIS.z * axle_offset.y)
if abs(measured_fork_rake - FORK_RAKE) > 1e-6:
    raise RuntimeError(f"Fork rake mismatch: {measured_fork_rake:.8f} m")

expected_steer_rest = [
    math.sin(STEER_TILT_RAD * 0.5),
    0.0,
    0.0,
    math.cos(STEER_TILT_RAD * 0.5),
]
exported_steer_rest = nodes[node_by_name["FrontAssembly"]].get("rotation", [0.0, 0.0, 0.0, 1.0])
if max(abs(actual - expected) for actual, expected in zip(exported_steer_rest, expected_steer_rest)) > 1e-5:
    raise RuntimeError(f"FrontAssembly rest rotation mismatch: {exported_steer_rest}")
for identity_node in ("RearWheel", "FrontWheel", "Crank", "Pedal_L", "Pedal_R"):
    exported_rest = nodes[node_by_name[identity_node]].get("rotation", [0.0, 0.0, 0.0, 1.0])
    if max(abs(actual - expected) for actual, expected in zip(exported_rest, (0.0, 0.0, 0.0, 1.0))) > 1e-6:
        raise RuntimeError(f"{identity_node} rest rotation is not identity: {exported_rest}")

triangles = 0
vertices = 0
for mesh in gltf.get("meshes", []):
    for primitive in mesh.get("primitives", []):
        vertices += gltf["accessors"][primitive["attributes"]["POSITION"]]["count"]
        if "indices" in primitive:
            triangles += gltf["accessors"][primitive["indices"]]["count"] // 3
if triangles >= 100_000:
    raise RuntimeError(f"Triangle budget exceeded: {triangles}")
if len(blob) >= 5_000_000:
    raise RuntimeError(f"GLB byte budget exceeded: {len(blob)}")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = {
    "formatVersion": 2,
    "revision": "commuter-bicycle-v2/1",
    "asset": "commuter_bicycle_v2",
    "reviewStatus": "awaiting-human-review",
    "generator": "art/bicycles/commuter-v2/generator.py",
    "sourceBlend": "art/bicycles/commuter-v2/commuter_bicycle_v2.blend",
    "provenance": "Original unbranded procedural project artwork. No external meshes or textures.",
    "coordinateContract": {
        "units": "metres",
        "upAxis": "+Y",
        "forwardAxis": "-Z",
        "rightSide": "+X",
        "origin": "ground plane beneath wheel contact patches",
        "soleRoot": "CommuterBicycleV2",
    },
    "geometryReference": {
        "manufacturer": "Cannondale",
        "modelFamily": "Quick",
        "size": "Medium",
        "sourceType": "official manufacturer dealer book geometry table",
        "url": "https://www.cannondale.com/-/media/files/manual-uploads/manuals/my20_cannondale_dealerbook.ashx",
        "appliedMetrics": {
            "headTubeAngleDegrees": HEAD_ANGLE_DEG,
            "wheelbaseM": 1.093,
            "chainstayM": 0.450,
            "bottomBracketDropM": 0.060,
            "forkRakeM": FORK_RAKE,
        },
        "usage": "Dimensional proportion reference only; this asset does not reproduce brand identity or proprietary component shapes.",
    },
    "metrics": {
        "classification": {
            "referenced": [
                "wheelbaseM",
                "headTubeAngleDegrees",
                "forkRakeM",
                "bottomBracketDropM",
                "chainstayM",
            ],
            "authoredOrMeasured": [
                "dimensionsM",
                "boundsM",
                "wheelRadiusM",
                "bottomBracketHeightM",
            ],
        },
        "dimensionsM": {"widthX": bounds[0], "heightY": bounds[1], "lengthZ": bounds[2]},
        "boundsM": {
            "min": [round(value, 5) for value in mins],
            "max": [round(value, 5) for value in maxs],
        },
        "wheelRadiusM": WHEEL_RADIUS,
        "wheelDiameterClass": "700C / ISO 622 with 38 mm commuter tires",
        "wheelbaseM": round(REAR_AXLE.z - FRONT_AXLE.z, 3),
        "headTubeAngleDegrees": HEAD_ANGLE_DEG,
        "steeringAxisRearwardTiltFromVerticalDegrees": STEER_TILT_DEG,
        "forkRakeM": round(measured_fork_rake, 6),
        "bottomBracketHeightM": round(BB.y, 3),
        "bottomBracketDropM": 0.060,
        "chainstayM": 0.450,
    },
    "articulation": {
        "RearWheel": {
            "axis": "local X",
            "pivotM": [round(v, 6) for v in REAR_AXLE],
            "restQuaternionXYZW": [0.0, 0.0, 0.0, 1.0],
            "runtimeComposition": "restQuaternion * localAxisDelta",
        },
        "FrontAssembly": {
            "axis": "local Y",
            "pivotM": [round(v, 6) for v in HEAD_LOWER],
            "axisWorldAtRest": [0.0, round(math.cos(math.radians(STEER_TILT_DEG)), 6), round(math.sin(math.radians(STEER_TILT_DEG)), 6)],
            "restQuaternionXYZW": [
                round(math.sin(STEER_TILT_RAD * 0.5), 6),
                0.0,
                0.0,
                round(math.cos(STEER_TILT_RAD * 0.5), 6),
            ],
            "runtimeComposition": "restQuaternion * localAxisDelta",
        },
        "FrontWheel": {
            "axis": "local X",
            "pivotRelativeToFrontAssemblyM": [round(v, 6) for v in to_local(front_assembly, FRONT_AXLE)],
            "pivotWorldAtRestM": [round(v, 6) for v in FRONT_AXLE],
            "restQuaternionXYZW": [0.0, 0.0, 0.0, 1.0],
            "runtimeComposition": "restQuaternion * localAxisDelta",
        },
        "Crank": {
            "axis": "local X",
            "pivotM": [round(v, 6) for v in BB],
            "restQuaternionXYZW": [0.0, 0.0, 0.0, 1.0],
            "runtimeComposition": "restQuaternion * localAxisDelta",
        },
        "Pedal_L": {
            "axis": "local X",
            "parent": "Crank",
            "pivotRelativeToCrankM": [-0.112, 0.0, 0.170],
            "restQuaternionXYZW": [0.0, 0.0, 0.0, 1.0],
            "runtimeComposition": "restQuaternion * localAxisDelta",
        },
        "Pedal_R": {
            "axis": "local X",
            "parent": "Crank",
            "pivotRelativeToCrankM": [0.112, 0.0, -0.170],
            "restQuaternionXYZW": [0.0, 0.0, 0.0, 1.0],
            "runtimeComposition": "restQuaternion * localAxisDelta",
        },
    },
    "attachments": [
        "Grip_L_Attach",
        "Grip_R_Attach",
        "Seat_Attach",
        "Pedal_L_Attach",
        "Pedal_R_Attach",
    ],
    "attachmentTransforms": {
        "Grip_L_Attach": {"parent": "FrontAssembly", "localPositionM": [-0.286, 0.204556, -0.066812]},
        "Grip_R_Attach": {"parent": "FrontAssembly", "localPositionM": [0.286, 0.204556, -0.066812]},
        "Seat_Attach": {"parent": "CommuterBicycleV2", "localPositionM": [0.0, 1.023, 0.282]},
        "Pedal_L_Attach": {"parent": "Pedal_L", "localPositionM": [0.0, 0.010, 0.0], "surface": "platform top"},
        "Pedal_R_Attach": {"parent": "Pedal_R", "localPositionM": [0.0, 0.010, 0.0], "surface": "platform top"},
    },
    "drivetrain": {"side": "+X / rider right", "chainrings": 2, "cassetteSprockets": 7},
    "generation": {
        "blenderVersion": bpy.app.version_string,
        "nodeCount": len(nodes),
        "meshCount": len(gltf.get("meshes", [])),
        "materialCount": len(gltf.get("materials", [])),
        "vertexCount": vertices,
        "triangleCount": triangles,
        "glbBytes": len(blob),
    },
    "validation": {
        "status": "passed",
        "checks": [
            "valid GLB 2.0 header and chunk length",
            "CommuterBicycleV2 is the sole exported scene root",
            "all required articulation and attachment nodes exist",
            "wheel, steering, crank, and pedal parent relationships match the contract",
            "evaluated source bounds touch the Y=0 ground plane",
            "authored wheelbase is 1.093 m",
            "perpendicular front-axle offset from the steering axis is 0.045 m",
            "exported articulation rest quaternions match the declared transforms",
            "manifest bounds are measured from final GLB POSITION vertices with exported node transforms",
            "pedal contact anchors equal the visible 0.010 m platform top plane",
            "triangle count is below 100,000",
            "GLB is below 5,000,000 bytes",
        ],
    },
    "sha256": {
        "glb": sha256(GLB_PATH),
        "blend": sha256(BLEND_PATH),
        "generator": sha256(SCRIPT),
    },
}
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"glb": str(GLB_PATH), "manifest": str(MANIFEST_PATH), "metrics": manifest["generation"], "sha256": manifest["sha256"]}, indent=2))
