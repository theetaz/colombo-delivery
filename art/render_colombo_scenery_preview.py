"""Render the same ten-root contact sheet produced by the scenery generator."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "art" / "colombo_scenery_kit.blend"))

# Match generate_colombo_scenery.py's composition. Only the preview scales the
# true-size landmark down to 1:40 so it can share a sheet with street props.
preview_names = [
    "Shop_Ochre", "Shop_CreamTeal", "BoundaryWall_Gate", "ShadeTree", "PalmTree",
    "UtilityPole_Lamp", "PottedPlant_A", "PottedPlant_B", "TukTuk_Parked", "LotusTower",
]
preview_centers = [
    (-15, 14), (-7.5, 14), (0, 14), (7.5, 14), (15, 14),
    (-15, 4.5), (-7.5, 4.5), (0, 4.5), (7.5, 4.5), (15, 4.5),
]
bpy.data.objects["LotusTower"].scale = (.025, .025, .025)
bpy.context.view_layer.update()
for name, (target_x, target_z) in zip(preview_names, preview_centers):
    root = bpy.data.objects[name]
    points = []
    for child in root.children:
        if child.type == "MESH":
            points.extend(child.matrix_world @ Vector(corner) for corner in child.bound_box)
    center_x = (min(point.x for point in points) + max(point.x for point in points)) * .5
    center_z = (min(point.z for point in points) + max(point.z for point in points)) * .5
    root.location.x += target_x - center_x
    root.location.z += target_z - center_z

bpy.ops.object.camera_add(location=(0, -42, 10))
camera = bpy.context.object
bpy.context.scene.camera = camera
camera.rotation_euler = (Vector((0, 0, 9.5)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 46.0

bpy.ops.object.light_add(type="AREA", location=(-8, -10, 18))
key = bpy.context.object
key.data.energy = 1900
key.data.shape = "DISK"
key.data.size = 10
key.rotation_euler = (Vector((0, 0, 3)) - key.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.light_add(type="AREA", location=(12, -4, 9))
fill = bpy.context.object
fill.data.energy = 950
fill.data.size = 8
fill.rotation_euler = (Vector((0, 0, 3)) - fill.location).to_track_quat("-Z", "Y").to_euler()

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1800
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(ROOT / "public" / "models" / "colombo_scenery_preview.png")
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.035, .065, .08, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
bpy.ops.render.render(write_still=True)
