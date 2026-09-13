"""Original insulated delivery backpack for the Colombo teen courier.

Blender source coordinates match the approved teen: +Z is up and +Y is
forward.  The backpack is authored behind the torso (negative Y) and its root
stays at the teen origin, so it can be parented directly to a character root.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Mapping

import bpy
from mathutils import Vector


DEFAULT_CENTER = (0.0, -0.245, 1.03)


def _material(name: str, color: tuple[float, float, float, float], metallic=0.0, roughness=.55):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material


def create_backpack_materials(prefix="DeliveryBackpack") -> dict[str, bpy.types.Material]:
    """Create the original unbranded teal/ochre backpack palette."""
    return {
        "teal": _material(f"{prefix}_Teal", (.025, .25, .27, 1), roughness=.68),
        "teal_dark": _material(f"{prefix}_TealDark", (.012, .085, .095, 1), roughness=.72),
        "ochre": _material(f"{prefix}_Ochre", (.91, .43, .075, 1), roughness=.58),
        "reflective": _material(f"{prefix}_Reflective", (.72, .88, .82, 1), metallic=.18, roughness=.25),
        "hardware": _material(f"{prefix}_Hardware", (.025, .035, .038, 1), metallic=.25, roughness=.32),
        "lining": _material(f"{prefix}_Lining", (.72, .75, .71, 1), metallic=.08, roughness=.38),
    }


def _box(name, location, dimensions, material, parent, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.parent = parent
    if bevel:
        mod = obj.modifiers.new("Soft sewn corners", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return obj


def _tube(name, points, radius, material, parent, cyclic=False, resolution=2):
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY" if cyclic else "BEZIER")
    if cyclic:
        spline.points.add(len(points) - 1)
        for point, coordinate in zip(spline.points, points):
            point.co = (*coordinate, 1.0)
    else:
        spline.bezier_points.add(len(points) - 1)
        for point, coordinate in zip(spline.bezier_points, points):
            point.co = coordinate
            point.handle_left_type = "AUTO"
            point.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def _anchor(name, location, parent):
    anchor = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(anchor)
    anchor.empty_display_type = "SPHERE"
    anchor.empty_display_size = .025
    anchor.location = location
    anchor.parent = parent
    return anchor


def _padded_strap(name, points, width, thickness, material, parent):
    """Build one continuous broad padded harness following a YZ route."""
    path = [Vector(point) for point in points]
    vertices = []
    for index, point in enumerate(path):
        before = path[max(0, index - 1)]
        after = path[min(len(path) - 1, index + 1)]
        tangent = (after - before).normalized()
        thickness_axis = Vector((0, -tangent.z, tangent.y)).normalized()
        for across, depth in ((-1,-1), (1,-1), (1,1), (-1,1)):
            vertices.append(tuple(point + Vector((across * width * .5, 0, 0)) + thickness_axis * depth * thickness * .5))
    faces = [(0,1,2,3), (len(vertices)-4,len(vertices)-3,len(vertices)-2,len(vertices)-1)]
    for index in range(len(path) - 1):
        a, b = index * 4, (index + 1) * 4
        faces.extend(((a,b,b+1,a+1), (a+1,b+1,b+2,a+2), (a+2,b+2,b+3,a+3), (a+3,b+3,b,a)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    strap = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(strap)
    strap.parent = parent
    bevel = strap.modifiers.new("Padded rolled edges", "BEVEL")
    bevel.width = min(width * .12, thickness * .35)
    bevel.segments = 3
    return strap


def _chest_band(name, points, height, thickness, material, parent):
    """Create flat sternum webbing that follows sampled chest depth."""
    vertices = []
    for x, y, z in points:
        vertices.extend(((x,y-thickness*.5,z-height*.5), (x,y+thickness*.5,z-height*.5),
                         (x,y+thickness*.5,z+height*.5), (x,y-thickness*.5,z+height*.5)))
    faces = [(0,1,2,3), (len(vertices)-4,len(vertices)-3,len(vertices)-2,len(vertices)-1)]
    for index in range(len(points)-1):
        a,b=index*4,(index+1)*4
        faces.extend(((a,b,b+1,a+1),(a+1,b+1,b+2,a+2),(a+2,b+2,b+3,a+3),(a+3,b+3,b,a)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    band = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(band)
    band.parent = parent
    bevel = band.modifiers.new("Soft webbing edges", "BEVEL")
    bevel.width = min(height*.18, thickness*.35)
    bevel.segments = 2
    return band


def create_delivery_backpack(
    parent: bpy.types.Object | None = None,
    *,
    prefix: str = "DeliveryBackpack",
    center: tuple[float, float, float] = DEFAULT_CENTER,
    scale: float = 1.0,
    materials: Mapping[str, bpy.types.Material] | None = None,
) -> dict[str, bpy.types.Object]:
    """Build a fitted insulated backpack and return named parts and anchors.

    The root has identity placement at the teen origin. ``center`` shifts only
    the authored bag envelope. Required material keys are teal, teal_dark,
    ochre, reflective, hardware and lining.
    """
    mats = dict(materials or create_backpack_materials(prefix))
    missing = {"teal", "teal_dark", "ochre", "reflective", "hardware", "lining"} - mats.keys()
    if missing:
        raise ValueError(f"Missing backpack materials: {sorted(missing)}")

    root = bpy.data.objects.new(prefix, None)
    bpy.context.collection.objects.link(root)
    root.parent = parent
    root["asset_type"] = "insulated_delivery_backpack"
    root["orientation"] = "+Z up, +Y forward; backpack toward -Y"
    root["nominal_dimensions_m"] = [round(v * scale, 3) for v in (.41, .22, .57)]
    cx, cy, cz = center
    S = scale
    made: dict[str, bpy.types.Object] = {"root": root}

    def loc(x, y, z):
        return (cx + x * S, cy + y * S, cz + z * S)

    # Insulated box: softly rounded shell, padded contact panel, reinforced base.
    made["body"] = _box(f"{prefix}_Body", loc(0, 0, 0), (.41*S, .21*S, .52*S), mats["teal"], root, .028*S)
    made["back_pad"] = _box(f"{prefix}_PaddedBack", loc(0, .116, .005), (.32*S, .028*S, .38*S), mats["teal_dark"], root, .022*S)
    made["base"] = _box(f"{prefix}_ReinforcedBase", loc(0, -.002, -.252), (.39*S, .205*S, .065*S), mats["ochre"], root, .017*S)
    made["lid"] = _box(f"{prefix}_InsulatedLid", loc(0, -.004, .282), (.405*S, .205*S, .085*S), mats["ochre"], root, .023*S)
    made["lid_seal"] = _box(f"{prefix}_InsulatedLidSeal", loc(0, .0, .235), (.35*S, .155*S, .012*S), mats["lining"], root, .005*S)
    made["front_flap"] = _box(f"{prefix}_FrontFlap", loc(0, -.113, .135), (.33*S, .022*S, .235*S), mats["teal_dark"], root, .021*S)

    # Reflective night accents: simple geometry, no text or branding.
    made["reflective_front"] = _box(f"{prefix}_ReflectiveFront", loc(0, -.128, .12), (.25*S, .008*S, .035*S), mats["reflective"], root, .006*S)
    for side in (-1, 1):
        made[f"reflective_side_{side}"] = _box(
            f"{prefix}_ReflectiveSide_{'L' if side < 0 else 'R'}",
            loc(side*.209, -.025, .07), (.008*S, .125*S, .14*S), mats["reflective"], root, .005*S,
        )

    # Lid piping and zipper pulls communicate construction at game camera distance.
    lid_loop = [loc(-.185,-.11,.25), loc(.185,-.11,.25), loc(.205,0,.25), loc(.185,.105,.25), loc(-.185,.105,.25), loc(-.205,0,.25)]
    made["zipper"] = _tube(f"{prefix}_LidZipper", lid_loop, .006*S, mats["hardware"], root, cyclic=True)
    made["front_seam"] = _tube(f"{prefix}_FrontFlapSeam", [loc(-.15,-.127,.24), loc(-.15,-.127,.03), loc(.15,-.127,.03), loc(.15,-.127,.24)], .0032*S, mats["ochre"], root)
    for side in (-1, 1):
        made[f"buckle_{side}"] = _box(f"{prefix}_FlapBuckle_{side}", loc(side*.105,-.139,.015), (.035*S,.014*S,.052*S), mats["hardware"], root, .004*S)

    # Top carry handle arches above the lid.
    made["handle"] = _tube(f"{prefix}_CarryHandle", [loc(-.085,.01,.315), loc(-.075,.01,.365), loc(0,.01,.385), loc(.075,.01,.365), loc(.085,.01,.315)], .012*S, mats["teal_dark"], root)

    # Broad harness travels from the bag, over each shoulder cap, down the
    # actual front chest surface, then under the arm and back to its lower
    # anchor.  Front shirt surface is around Y=.13-.16 on the approved teen.
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        strap_points = [
            loc(side*.13,.13,.245),
            loc(side*.13,.165,.26),
            loc(side*.13,.205,.272),
            loc(side*.13,.245,.255),
            loc(side*.125,.275,.225),
            loc(side*.12,.295,.18),
            loc(side*.12,.305,.11),
            loc(side*.12,.303,.04),
            loc(side*.12,.313,-.05),
            loc(side*.13,.325,-.13),
            loc(side*.17,.295,-.19),
            loc(side*.20,.245,-.22),
            loc(side*.18,.165,-.23),
            loc(side*.16,.135,-.22),
        ]
        made[f"shoulder_strap_{side}"] = _padded_strap(
            f"{prefix}_ShoulderStrap_{tag}", strap_points, .04*S, .012*S, mats["teal_dark"], root,
        )
        made[f"strap_accent_{side}"] = _box(
            f"{prefix}_StrapReflector_{tag}", loc(side*.12,.319,.015),
            (.028*S,.007*S,.065*S), mats["reflective"], root, .005*S,
        )
        made[f"lower_webbing_{side}"] = _tube(
            f"{prefix}_LowerWebbing_{tag}", [loc(side*.16,.137,-.22), loc(side*.19,.105,-.26)], .008*S, mats["teal_dark"], root,
        )

    # Adjustable sternum strap, central buckle, and side compression webbing.
    sternum_points = [
        loc(-.12,.303,.04), loc(-.08,.339,.04), loc(-.04,.355,.04), loc(0,.361,.04),
        loc(.04,.357,.04), loc(.08,.341,.04), loc(.12,.303,.04),
    ]
    made["sternum"] = _chest_band(f"{prefix}_SternumStrap", sternum_points, .02*S, .008*S, mats["teal_dark"], root)
    made["sternum_buckle"] = _box(f"{prefix}_SternumBuckle", loc(0,.373,.04), (.046*S,.016*S,.032*S), mats["hardware"], root, .004*S)
    for side in (-1, 1):
        made[f"compression_{side}"] = _tube(f"{prefix}_Compression_{'L' if side < 0 else 'R'}", [loc(side*.214,-.07,.13), loc(side*.214,.07,.13)], .008*S, mats["ochre"], root)

    # Stable integration points, local to the teen/root coordinate system.
    anchors = {
        "anchor_back": loc(0, .12, .08),
        "anchor_shoulder_l": loc(-.13, .13, .245),
        "anchor_shoulder_r": loc(.13, .13, .245),
        "anchor_lower_l": loc(-.16, .135, -.22),
        "anchor_lower_r": loc(.16, .135, -.22),
        "anchor_sternum": loc(0, .361, .04),
    }
    for key, location in anchors.items():
        made[key] = _anchor(f"{prefix}_{''.join(part.title() for part in key.split('_'))}", location, root)
    return made


def _clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def _build_outputs(output_blend: Path, output_glb: Path, thumbnail: Path):
    _clear_scene()
    # Children are authored in approved teen space so runtime consumers can
    # parent this identity root directly beneath the standing character root.
    parts = create_delivery_backpack()
    root = parts["root"]
    root["builder"] = "art/characters/teen-courier/delivery_backpack.py"
    root["license_note"] = "Original unbranded project artwork"

    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root, *root.children_recursive]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(output_glb), export_format="GLB", use_selection=True, export_apply=True)

    # Render a clean three-quarter rear/product view using the same authored asset.
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, .725))
    floor = bpy.context.object
    floor.data.materials.append(_material("PreviewFloor", (.055, .07, .075, 1), roughness=.8))
    bpy.ops.object.camera_add(location=(1.25, -1.55, 1.25))
    camera = bpy.context.object
    direction = Vector((0, -.245, 1.03)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 58
    bpy.context.scene.camera = camera
    for name, location, energy, size in (
        ("Key", (-1.3,-1.4,2.2), 900, 2.0), ("Fill", (1.5,-.5,1.5), 650, 1.7), ("Rim", (0,1.3,2.0), 800, 1.4)
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (Vector((0,-.245,1.05)) - light.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(thumbnail)
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.8
    scene.world.color = (.018, .025, .03)
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", type=Path, required=True)
    parser.add_argument("--glb", type=Path, required=True)
    parser.add_argument("--thumbnail", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)
    for path in (args.blend, args.glb, args.thumbnail):
        path.parent.mkdir(parents=True, exist_ok=True)
    _build_outputs(args.blend.resolve(), args.glb.resolve(), args.thumbnail.resolve())


if __name__ == "__main__":
    main()
