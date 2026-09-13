"""Normalize the genuine Tripo biped rig for deformation review.

This preserves the returned bone hierarchy and corrects the documented stray
leg influences on the hands. It does not add animations or facial controls.
"""

from pathlib import Path
import hashlib
import json
import math
import struct

import bpy


ROOT = Path(__file__).resolve().parents[3]
INPUT = ROOT / "art/characters/teen-courier/reconstruction/teen-courier-tripo-v2_5-biped-rig.glb"
BLEND = ROOT / "art/characters/teen-courier/teen_courier_rig_review.blend"
OUTPUT = ROOT / "public/models/teen_courier_rig_review.glb"
MANIFEST = ROOT / "public/models/teen_courier_rig_review.manifest.json"


def mesh_world_bounds(obj):
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return [min(v[i] for v in points) for i in range(3)], [max(v[i] for v in points) for i in range(3)]


def remove_leg_weights_from_hands(mesh):
    leg_groups = {
        f"tripo::0_{side}_Limb_{index}"
        for side in ("Left", "Right") for index in range(4)
    }
    candidates = []
    removed_assignments = 0
    affected_vertices = 0
    fallback_vertices = 0
    for vertex in mesh.data.vertices:
        world = mesh.matrix_world @ vertex.co
        if abs(world.x) <= 0.26 or not (0.55 < world.z < 0.85):
            continue
        candidates.append(vertex.index)
        weights = {
            mesh.vertex_groups[element.group].name: element.weight
            for element in vertex.groups
        }
        contaminated = [name for name in weights if name in leg_groups and weights[name] > 0.0]
        if not contaminated:
            continue
        affected_vertices += 1
        for name in contaminated:
            mesh.vertex_groups[name].remove([vertex.index])
            removed_assignments += 1
        remaining = {
            mesh.vertex_groups[element.group].name: element.weight
            for element in vertex.groups
            if mesh.vertex_groups[element.group].name not in leg_groups
        }
        total = sum(remaining.values())
        if total <= 1e-8:
            side = "Left" if world.x < 0.0 else "Right"
            mesh.vertex_groups[f"tripo::1_{side}_Limb_2"].add([vertex.index], 1.0, "REPLACE")
            fallback_vertices += 1
        else:
            for name, weight in remaining.items():
                mesh.vertex_groups[name].add([vertex.index], weight / total, "REPLACE")
    return {
        "candidateHandVertices": len(candidates),
        "affectedVertices": affected_vertices,
        "removedLegAssignments": removed_assignments,
        "fallbackVertices": fallback_vertices,
        "removedGroups": sorted(leg_groups),
    }


def main():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(INPUT))
    armature = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    armature.name = "TeenCourierRig"
    armature.data.name = "TeenCourierRig_Armature"
    mesh.name = "TeenCourier_Body"
    mesh.data.name = "TeenCourier_BodyMesh"

    lo, hi = mesh_world_bounds(mesh)
    scale = 1.62 / (hi[2] - lo[2])
    armature.rotation_mode = "XYZ"
    armature.rotation_euler = (0.0, 0.0, math.radians(90.0))
    armature.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    lo, _ = mesh_world_bounds(mesh)
    armature.location.z -= lo[2]
    bpy.context.view_layer.update()
    weight_cleanup = remove_leg_weights_from_hands(mesh)

    armature["assetType"] = "teen_courier_rig_review"
    armature["contractVersion"] = 1
    armature["upAxis"] = "+Y"
    armature["forwardAxis"] = "-Z"
    armature["heightMeters"] = 1.62
    armature["rigSource"] = "Tripo animate_rig v2.5-20260210"
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", export_yup=True, export_extras=True, export_skins=True, export_animations=True)

    payload = OUTPUT.read_bytes()
    json_length = struct.unpack_from("<I", payload, 12)[0]
    exported = json.loads(payload[20:20 + json_length].decode("utf-8").rstrip("\0 "))
    accessors = exported["accessors"]
    exported_vertices = 0
    exported_triangles = 0
    for exported_mesh in exported.get("meshes", []):
        for primitive in exported_mesh.get("primitives", []):
            exported_vertices += accessors[primitive["attributes"]["POSITION"]]["count"]
            exported_triangles += accessors[primitive["indices"]]["count"] // 3

    lo, hi = mesh_world_bounds(mesh)
    glb_sha256 = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    blend_sha256 = hashlib.sha256(BLEND.read_bytes()).hexdigest()
    packed_images = sorted(image.name for image in bpy.data.images if image.packed_file)
    manifest = {
        "asset": OUTPUT.name,
        "status": "rig-deformation-review",
        "source": "art/characters/teen-courier/reconstruction/teen-courier-tripo-v2_5-biped-rig.glb",
        "contract": {"units": "meters", "upAxis": "+Y", "forwardAxis": "-Z", "origin": "ground contact", "heightMeters": 1.62},
        "rig": {"provider": "Tripo", "modelVersion": "v2.5-20260210", "skinCount": 1, "sourceNodeCount": 60, "animations": 0, "reviewRequired": True, "weightCleanup": weight_cleanup},
        "geometry": {"blenderVertices": len(mesh.data.vertices), "exportedVertices": exported_vertices, "triangles": exported_triangles},
        "textures": {"glbEmbedded": True, "blendPackedImages": packed_images, "portable": True},
        "hashes": {"glbSha256": glb_sha256, "blendSha256": blend_sha256},
        "blenderWorldBounds": {"min": lo, "max": hi},
        "validation": {"manualReviewRequired": True, "reviewGuide": "docs/CHARACTER_ART_PIPELINE.md"},
        "notes": ["Preserves provider weights and hierarchy except the documented narrow hand influence correction.", "Full pedaling, shoulder, hip, and facial-topology review remains pending before runtime use."],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(OUTPUT), "bounds": [lo, hi], "bones": len(armature.data.bones)}))


if __name__ == "__main__":
    main()
