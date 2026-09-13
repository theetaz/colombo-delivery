"""Render fit-check views without modifying the approved teen source blend."""

from pathlib import Path
import importlib.util
import sys

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("delivery_backpack", HERE / "delivery_backpack.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.create_delivery_backpack(prefix="FitPreviewBackpack")

teen = bpy.data.objects.get("TeenCourier")
if teen is None:
    raise RuntimeError("Run this script with teen_courier_cleanup.blend")

# Neutral studio environment; these objects exist only in the render process.
bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -.006))
floor = bpy.context.object
floor.data.materials.append(module._material("FitPreviewFloor", (.045, .055, .06, 1), roughness=.82))
for name, location, energy, size in (
    ("FitKey", (-1.7,-1.4,2.4), 1050, 2.2),
    ("FitFill", (1.5,.2,1.6), 650, 1.8),
    ("FitRim", (0,1.7,2.0), 900, 1.5),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.size = size
    light.rotation_euler = (Vector((0,0,1.0)) - light.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.lens = 58
bpy.context.scene.camera = camera
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -1.35
scene.world.color = (.018, .025, .03)

output_dir = Path(sys.argv[sys.argv.index("--") + 1]).resolve() if "--" in sys.argv else HERE
output_dir.mkdir(parents=True, exist_ok=True)
for filename, location, target in (
    ("delivery_backpack_fit_back.png", (1.35,-2.8,1.28), (0,-.08,.86)),
    ("delivery_backpack_fit_profile.png", (2.75,-.25,1.18), (0,-.08,.88)),
    ("delivery_backpack_fit_front.png", (-.75,2.8,1.22), (0,.02,.88)),
):
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(output_dir / filename)
    bpy.ops.render.render(write_still=True)
