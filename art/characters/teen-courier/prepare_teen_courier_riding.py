"""Author and export the approved teen courier's bicycle riding cycle.

The approved detailed mesh and textures come from the reviewed provider asset.
This script rebuilds a compact deformation rig, then uses measured palm and
sole surfaces to bake a seated cycle against the production bicycle.
"""

from pathlib import Path
import hashlib
import json
import math
import struct
import sys

import bpy
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from minimal_riding_rig import rebuild_minimal_riding_rig
from riding_backpack_fit import fit_riding_harness
from riding_weights import repair_riding_weights


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "art/characters/teen-courier/teen_courier_rig_review.blend"
BICYCLE = ROOT / "art/courier_bicycle.blend"
BACKPACK = ROOT / "public/models/delivery_backpack.glb"
RIDING_BACKPACK = ROOT / "public/models/delivery_backpack_riding.glb"
BLEND = ROOT / "art/characters/teen-courier/teen_courier_riding.blend"
OUTPUT = ROOT / "public/models/teen_courier_riding.glb"
MANIFEST = ROOT / "public/models/teen_courier_riding.manifest.json"
REVIEW_DIR = ROOT / "public/models/teen_courier_riding_review"

ARM = {
    "L": ("tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2"),
    "R": ("tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2"),
}
LEG = {
    "L": ("tripo::0_Left_Limb_0", "tripo::0_Left_Limb_1", "tripo::0_Left_Limb_2"),
    "R": ("tripo::0_Right_Limb_0", "tripo::0_Right_Limb_1", "tripo::0_Right_Limb_2"),
}
FRAMES = (0, 6, 12, 18, 24)


def runtime_to_blender(point):
    """Convert Three.js +Y-up/-Z-forward coordinates to Blender +Z-up/+Y-forward."""
    x, y, z = point
    return Vector((x, -z, y))


def add_target(name, point):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=runtime_to_blender(point))
    target = bpy.context.object
    target.name = name
    target.empty_display_size = 0.045
    target.hide_render = True
    return target


def add_ik(armature, bone_name, target, chain_count, pole_point, pole_angle=0.0):
    pose_bone = armature.pose.bones[bone_name]
    constraint = pose_bone.constraints.new("IK")
    constraint.name = f"RidingIK_{bone_name}"
    constraint.target = target
    constraint.chain_count = chain_count
    constraint.iterations = 80
    pole = add_target(f"{target.name}_Pole", pole_point)
    constraint.pole_target = pole
    constraint.pole_angle = pole_angle
    return pose_bone


def rigid_surface_local(mesh, armature, bone_name, surface):
    group = mesh.vertex_groups[bone_name]
    weighted = []
    for vertex in mesh.data.vertices:
        try:
            weight = group.weight(vertex.index)
        except RuntimeError:
            continue
        if weight >= 0.5:
            weighted.append(vertex.co.copy())
    if surface == "sole":
        floor = min(point.z for point in weighted)
        weighted = [point for point in weighted if point.z <= floor + 0.012]
    centroid = sum(weighted, Vector()) / len(weighted)
    return armature.data.bones[bone_name].matrix_local.inverted() @ centroid


def world_bone_head(armature, bone_name):
    return armature.matrix_world @ armature.pose.bones[bone_name].head


def rotate_pose_bone_world(armature, bone_name, axis, angle):
    bone = armature.pose.bones[bone_name]
    head = bone.head.copy()
    world_rotation = Matrix.Rotation(angle, 4, axis)
    armature_rotation = armature.matrix_world.inverted() @ world_rotation @ armature.matrix_world
    bone.matrix = Matrix.Translation(head) @ armature_rotation @ Matrix.Translation(-head) @ bone.matrix


def create_contact_rig(armature):
    # Move the standing rig so the anatomical hip heads sit on the production saddle.
    hip_center = (world_bone_head(armature, LEG["L"][0]) + world_bone_head(armature, LEG["R"][0])) * 0.5
    # A 0.98 m anatomical hip fits the 1.62 m rider's leg reach across the
    # complete 0.27--0.63 m pedal stroke. The bicycle integration lowers the
    # named saddle/seatpost by 0.10 m to meet this contact without stretching.
    saddle = runtime_to_blender((0.0, 1.03, 0.25))
    base_shift = saddle - hip_center
    armature.location += base_shift
    riding_transform = Matrix.Translation(base_shift)
    bpy.context.view_layer.update()

    targets = {}
    for side, sign in (("L", -1.0), ("R", 1.0)):
        # The terminal provider hand bone ends roughly 9 cm above the palm
        # contact surface in this pose, so its target sits below the grip.
        grip = add_target(f"GripTarget_{side}", (0.22 * sign, 0.94, -0.48))
        pedal = add_target(f"PedalTarget_{side}", (0.10 * sign, 0.45, 0.06))
        add_ik(armature, ARM[side][2], grip, 3, (0.34 * sign, 1.34, -0.08), math.pi if side == "R" else 0.0)
        sole_local = rigid_surface_local(next(o for o in bpy.context.scene.objects if o.type == "MESH"), armature, LEG[side][2], "sole")
        rest_foot_world = armature.matrix_world @ armature.data.bones[LEG[side][2]].matrix_local
        leg_pose = add_ik(armature, LEG[side][1], pedal, 2, (0.10 * sign, 0.77, -0.35), 0.0)
        leg_ik = leg_pose.constraints[-1]
        foot_bone = armature.pose.bones[LEG[side][2]]
        bpy.ops.object.empty_add(type="PLAIN_AXES")
        foot_orient = bpy.context.object
        foot_orient.name = f"FootOrient_{side}"
        foot_orient.matrix_world = Matrix.LocRotScale(
            rest_foot_world.to_translation(),
            rest_foot_world.to_quaternion(),
            Vector((1.0, 1.0, 1.0)),
        )
        rotation = foot_bone.constraints.new("COPY_ROTATION")
        rotation.target = foot_orient
        rotation.owner_space = "WORLD"
        rotation.target_space = "WORLD"
        rotation.mix_mode = "REPLACE"
        best_angle = 0.0
        best_error = float("inf")
        for step in range(-36, 37):
            candidate = math.radians(step * 5.0)
            leg_ik.pole_angle = candidate
            bpy.context.view_layer.update()
            knee_x = (armature.matrix_world @ leg_pose.head).x
            error = abs(knee_x - 0.12 * sign)
            if error < best_error:
                best_error = error
                best_angle = candidate
        leg_ik.pole_angle = best_angle
        targets[f"grip_{side}"] = grip
        targets[f"pedal_{side}"] = pedal
        pedal["soleLocal"] = list(sole_local)
        targets[f"foot_orient_{side}"] = foot_orient
    return targets, riding_transform


def keyframe_cycle(targets):
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = 24
    for frame in range(0, 25):
        phase = frame / 24.0 * math.tau
        for side, phase_offset in (("L", 0.0), ("R", math.pi)):
            angle = phase + phase_offset
            # The IK endpoint is inside the foot near the ankle/toe chain. The
            # 55 mm lift and 30 mm rearward offset place the actual sole on the
            # pedal platform instead of placing the endpoint on the platform.
            point = (0.10 * (-1.0 if side == "L" else 1.0), 0.45 + math.cos(angle) * 0.18, 0.06 + math.sin(angle) * 0.18)
            pedal = targets[f"pedal_{side}"]
            sole_offset = targets[f"foot_orient_{side}"].matrix_world.to_3x3() @ Vector(pedal["soleLocal"])
            pedal.location = runtime_to_blender(point) - sole_offset
            targets[f"pedal_{side}"].keyframe_insert("location", frame=frame)


def bake_pose(armature):
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.nla.bake(frame_start=0, frame_end=24, step=1, only_selected=False,
                     visual_keying=True, clear_constraints=True, use_current_action=True,
                     bake_types={"POSE"})
    bpy.ops.object.mode_set(mode="OBJECT")
    action = armature.animation_data.action
    action.name = "PedalCycle"
    action.use_fake_user = True


def add_backpack_attachment(armature, riding_transform):
    bpy.ops.object.empty_add(type="PLAIN_AXES")
    attach = bpy.context.object
    attach.name = "Backpack_Attach"
    attach.empty_display_size = 0.08
    attach.parent = armature
    attach.parent_type = "BONE"
    attach.parent_bone = "bone_3"
    # The backpack is authored in teen-root coordinates. Preserve an identity
    # world transform at the neutral riding pose while parenting to the upper
    # spine; subsequent bone deformation then carries the pack and straps.
    hip = runtime_to_blender((0.0, 1.03, 0.25))
    torso_lean = Matrix.Translation(hip) @ Matrix.Rotation(math.radians(-35.0), 4, "X") @ Matrix.Translation(-hip)
    riding_fit = Matrix.Translation(runtime_to_blender((0.0, -0.02, -0.05)))
    attach.matrix_world = torso_lean @ riding_transform @ riding_fit
    attach["attachmentType"] = "delivery_backpack"
    return attach


def add_contact_markers(armature, mesh, targets):
    markers = []
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    for side in ("L", "R"):
        for kind, bone_name, target_name in (
            ("Hand", ARM[side][2], f"grip_{side}"),
            ("Foot", LEG[side][2], f"pedal_{side}"),
        ):
            bpy.ops.object.empty_add(type="PLAIN_AXES")
            marker = bpy.context.object
            marker.name = f"{kind}Contact_{side}"
            marker.empty_display_size = 0.025
            if kind == "Hand":
                evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
                group = mesh.vertex_groups[ARM[side][2]]
                indices = [vertex.index for vertex in mesh.data.vertices if any(element.group == group.index and element.weight >= 0.5 for element in vertex.groups)]
                # The consolidated terminal group is rigid and contains the
                # complete palm/fingers. Its centroid is the stable proximal
                # palm contact; choosing the nearest vertex falsely binds the
                # grip to a fingertip or wrist edge.
                points = [evaluated.matrix_world @ evaluated.data.vertices[index].co for index in indices]
                actual = sum(points, Vector()) / len(points)
                world = Matrix.Translation(actual)
            else:
                local = Vector(targets[f"pedal_{side}"]["soleLocal"])
                actual = armature.matrix_world @ armature.pose.bones[LEG[side][2]].matrix @ local
                world = Matrix.Translation(actual)
            marker.parent = armature
            marker.parent_type = "BONE"
            marker.parent_bone = bone_name
            marker.matrix_world = world
            markers.append(marker)
    return markers


def append_bicycle_reference():
    with bpy.data.libraries.load(str(BICYCLE), link=False) as (source, target):
        target.objects = source.objects
    collection = bpy.data.collections.new("Bicycle_Review_Reference")
    bpy.context.scene.collection.children.link(collection)
    rider_prefixes = (
        "Rider_", "Shirt_", "Shorts_", "Neck", "Classic_", "Soft_", "Angular_",
        "Face_Profile_", "Helmet", "UpperArm_", "Forearm_", "Hand_L", "Hand_R", "Foot_",
        "Sole_", "Shoe", "Ankle", "CourierBag", "Bag", "CargoReflector",
    )
    for obj in target.objects:
        if obj and obj.name not in bpy.context.scene.objects:
            collection.objects.link(obj)
        if obj:
            obj.hide_render = obj.name.startswith(rider_prefixes)
            obj["reviewReferenceOnly"] = True
    for name in ("Saddle", "SeatPost"):
        if name in bpy.data.objects:
            bpy.data.objects[name].location.y -= 0.04
    if "Kickstand" in bpy.data.objects:
        bpy.data.objects["Kickstand"].hide_render = True
    crank = bpy.data.objects.get("Crank")
    pedals = [bpy.data.objects.get("Pedal_L"), bpy.data.objects.get("Pedal_R")]
    if crank:
        crank.rotation_mode = "XYZ"
        for pedal in pedals:
            if pedal:
                pedal.rotation_mode = "XYZ"
        for frame in range(0, 25):
            phase = frame / 24.0 * math.tau
            crank.rotation_euler.x = phase
            crank.keyframe_insert("rotation_euler", frame=frame)
            for pedal in pedals:
                if pedal:
                    pedal.rotation_euler.x = -phase
                    pedal.keyframe_insert("rotation_euler", frame=frame)
    return collection


def append_backpack_reference(attach):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(BACKPACK))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    backpack = next(obj for obj in imported if obj.name == "DeliveryBackpack")
    backpack.parent = attach
    backpack.matrix_parent_inverse = Matrix.Identity(4)
    backpack.matrix_basis = Matrix.Identity(4)
    for obj in imported:
        obj["reviewReferenceOnly"] = True
    return backpack


def export_riding_backpack(backpack):
    """Export the fitted harness under the backpack's identity-root contract."""
    parent = backpack.parent
    backpack.parent = None
    backpack.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    backpack.select_set(True)
    for child in backpack.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = backpack
    bpy.ops.export_scene.gltf(filepath=str(RIDING_BACKPACK), export_format="GLB", export_yup=True,
                              export_extras=True, export_skins=False, export_animations=False,
                              use_selection=True)
    backpack.parent = parent
    backpack.matrix_parent_inverse = Matrix.Identity(4)
    backpack.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def setup_review_scene():
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.035, 0.045, 0.055)
    bpy.ops.object.light_add(type="AREA", location=(3.0, -4.0, 4.5))
    bpy.context.object.data.energy = 900
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 4.0
    bpy.ops.object.light_add(type="AREA", location=(-3.0, 1.0, 2.5))
    bpy.context.object.data.energy = 550
    bpy.context.object.data.color = (0.45, 0.65, 1.0)
    bpy.context.object.data.size = 3.0
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.01))
    ground = bpy.context.object
    ground.name = "ReviewGround"
    material = bpy.data.materials.new("ReviewGroundMaterial")
    material.diffuse_color = (0.06, 0.08, 0.075, 1)
    ground.data.materials.append(material)
    bpy.ops.object.camera_add(location=(4.2, -0.15, 1.35))
    camera = bpy.context.object
    direction = Vector((0, 0, 0.95)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 58
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"


def export_and_manifest(armature, mesh, attach, review_collection, weight_repair, backpack_fit):
    bpy.context.scene["assetType"] = "teen_courier_riding"
    bpy.context.scene["contractVersion"] = 1
    bpy.context.scene["wheelRadius"] = 0.34
    bpy.context.scene["wheelbase"] = 1.08
    bpy.context.scene["cycleFrames"] = 24
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    mesh.select_set(True)
    attach.select_set(True)
    for name in ("HandContact_L", "HandContact_R", "FootContact_L", "FootContact_R"):
        bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", export_yup=True,
                              export_extras=True, export_skins=True, export_animations=True,
                              use_selection=True)

    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for frame in (0, 6, 12, 18):
        bpy.context.scene.frame_set(frame)
        bpy.context.scene.render.filepath = str(REVIEW_DIR / f"pedal-{frame:02d}.png")
        bpy.ops.render.render(write_still=True)
    camera = bpy.context.scene.camera
    for label, location in (("front", (0.0, 4.2, 1.35)), ("back", (0.0, -4.2, 1.35))):
        camera.location = location
        camera.rotation_euler = (Vector((0, 0, 0.95)) - camera.location).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.frame_set(0)
        bpy.context.scene.render.filepath = str(REVIEW_DIR / f"fit-{label}.png")
        bpy.ops.render.render(write_still=True)

    payload = OUTPUT.read_bytes()
    json_length = struct.unpack_from("<I", payload, 12)[0]
    gltf = json.loads(payload[20:20 + json_length].decode("utf-8").rstrip("\0 "))
    knee_x = {"L": [], "R": []}
    for frame in range(0, 25):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        for side in ("L", "R"):
            knee_x[side].append((armature.matrix_world @ armature.pose.bones[LEG[side][1]].head).x)
    manifest = {
        "asset": OUTPUT.name,
        "status": "riding-cycle-review",
        "source": "art/characters/teen-courier/teen_courier_rig_review.blend",
        "identity": "Approved detailed teen courier mesh and textures; provider skin rebuilt as a clean minimal riding rig.",
        "contract": {"units": "meters", "upAxis": "+Y", "forwardAxis": "-Z", "wheelRadius": 0.34, "wheelbase": 1.08},
        "animation": {"name": "PedalCycle", "frames": [0, 24], "fps": 24, "durationSeconds": 1.0, "loopClosure": True},
        "contacts": {"seat": [0, 1.03, 0.25], "saddleRuntimeYOffset": -0.04, "grips": {"L": [-0.22, 1.04, -0.41], "R": [0.22, 1.04, -0.41]}, "crank": [0, 0.45, 0.06], "radius": 0.18},
        "attachments": {"backpack": "Backpack_Attach", "torsoBone": "bone_3"},
        "rig": {"boneCount": len(armature.data.bones), "skinCount": len(gltf.get("skins", [])), "animationCount": len(gltf.get("animations", [])), "ridingWeightRepair": weight_repair},
        "customization": {"supported": "approved detailed base appearance", "unsupported": "standalone unskinned modular wardrobe selections"},
        "review": {"frames": [f"teen_courier_riding_review/pedal-{frame:02d}.png" for frame in (0, 6, 12, 18)]},
        "kneePlane": {"leftXRange": [min(knee_x["L"]), max(knee_x["L"])], "rightXRange": [min(knee_x["R"]), max(knee_x["R"])], "limitAbsX": 0.2},
        "ridingBackpack": {"asset": RIDING_BACKPACK.name, "bytes": RIDING_BACKPACK.stat().st_size, "sha256": hashlib.sha256(RIDING_BACKPACK.read_bytes()).hexdigest(), "fit": backpack_fit},
        "hashes": {"glbSha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(), "blendSha256": hashlib.sha256(BLEND.read_bytes()).hexdigest()},
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(OUTPUT), "bones": len(armature.data.bones), "animations": len(gltf.get("animations", [])), "nodes": len(gltf.get("nodes", []))}))


def main():
    bpy.context.preferences.filepaths.save_version = 0
    armature = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    armature.animation_data_clear()
    for bone in armature.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.scale = (1, 1, 1)
        for constraint in list(bone.constraints):
            bone.constraints.remove(constraint)
    provider_repair = repair_riding_weights(mesh, armature)
    armature, minimal_rig = rebuild_minimal_riding_rig(mesh, armature)
    weight_repair = {"providerCleanup": provider_repair, "minimalRig": minimal_rig}
    targets, riding_transform = create_contact_rig(armature)
    rotate_pose_bone_world(armature, "tripo::Spine_0", "X", math.radians(-35.0))
    bpy.context.view_layer.update()
    rotate_pose_bone_world(armature, "tripo::Head_0", "X", math.radians(25.0))
    armature.pose.bones["bone_4"].rotation_mode = "XYZ"
    armature.pose.bones["bone_4"].rotation_euler[1] = math.radians(5.0)
    keyframe_cycle(targets)
    bake_pose(armature)
    attach = add_backpack_attachment(armature, riding_transform)
    add_contact_markers(armature, mesh, targets)
    for target in targets.values():
        bpy.data.objects.remove(target, do_unlink=True)
    review_collection = append_bicycle_reference()
    backpack = append_backpack_reference(attach)
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    backpack_fit = fit_riding_harness(backpack, mesh)
    export_riding_backpack(backpack)
    setup_review_scene()
    export_and_manifest(armature, mesh, attach, review_collection, weight_repair, backpack_fit)


if __name__ == "__main__":
    main()
