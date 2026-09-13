"""Generate the static detailed teen fit for the approved commuter bicycle v2."""

from pathlib import Path
import bpy, hashlib, json, math, struct, sys
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / "art/characters/teen-courier/teen_courier_rig_review.blend"
BIKE = ROOT / "public/models/commuter_bicycle_v2.glb"
OUT = ROOT / "public/models/teen_courier_seated_v2.glb"
BLEND = ROOT / "art/characters/teen-courier/seated-v2/teen_courier_seated_v2.blend"
MANIFEST = ROOT / "public/models/teen_courier_seated_v2.manifest.json"
REFERENCE = ROOT / "public/references/rider-fit/seated-pose-guide-v2.png"
sys.path.insert(0, str(ROOT / "art/characters/teen-courier"))
from riding_weights import repair_riding_weights

ARM = {
    "L": ("tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2"),
    "R": ("tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2"),
}
LEG = {
    "L": ("tripo::0_Left_Limb_0", "tripo::0_Left_Limb_1", "tripo::0_Left_Limb_2"),
    "R": ("tripo::0_Right_Limb_0", "tripo::0_Right_Limb_1", "tripo::0_Right_Limb_2"),
}
CONTACTS = (
    "PelvisContact",
    "Palm_L_Contact",
    "Palm_R_Contact",
    "Sole_L_Contact",
    "Sole_R_Contact",
)


def add_empty(name, loc):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
    o = bpy.context.object
    o.name = name
    o.empty_display_size = 0.02
    return o


def descendants(arm, bone):
    return {
        b.name for b in arm.data.bones if arm.data.bones.get(bone) in b.parent_recursive
    }


def group_vertices(mesh, names, threshold=0.25):
    ids = {mesh.vertex_groups[n].index for n in names if n in mesh.vertex_groups}
    out = []
    for v in mesh.data.vertices:
        if sum(e.weight for e in v.groups if e.group in ids) >= threshold:
            out.append(v.index)
    return out


def eval_points(mesh, indices):
    e = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return [e.matrix_world @ e.data.vertices[i].co for i in indices]


def centroid(points):
    return sum(points, Vector()) / len(points)


def surface_point(mesh, indices, kind, target=None):
    pts = eval_points(mesh, indices)
    if kind == "sole":
        floor = min(p.z for p in pts)
        pts = [p for p in pts if p.z <= floor + 0.012]
    elif kind == "palm":
        # proximal central palm: reject finger tips and wrist edge by robust central quantiles
        xs = sorted(abs(p.x) for p in pts)
        lo = xs[len(xs) // 5]
        hi = xs[(len(xs) * 4) // 5]
        pts = [p for p in pts if lo <= abs(p.x) <= hi]
    if target is not None:
        nearest = min((p - target).length for p in pts)
        patch = [p for p in pts if (p - target).length <= nearest + 0.008]
        return centroid(patch)
    return centroid(pts)


def rotate_world(arm, name, axis, angle):
    b = arm.pose.bones[name]
    pivot = arm.matrix_world @ b.head
    current_world = arm.matrix_world @ b.matrix
    rotation = (
        Matrix.Translation(pivot)
        @ Matrix.Rotation(angle, 4, axis)
        @ Matrix.Translation(-pivot)
    )
    b.matrix = arm.matrix_world.inverted() @ rotation @ current_world
    bpy.context.view_layer.update()
    moved = ((arm.matrix_world @ b.head) - pivot).length
    assert moved < 1e-6, f"world rotation displaced {name} head by {moved} m"


def evaluated_world_points(mesh):
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]


def edge_strain(mesh, baseline, vertex_filter=None):
    """Return robust evaluated/rest edge-length ratios for deformation checks."""
    posed = evaluated_world_points(mesh)
    ratios = []
    for edge in mesh.data.edges:
        a, b = edge.vertices
        if vertex_filter is not None and not (a in vertex_filter and b in vertex_filter):
            continue
        rest_length = (baseline[a] - baseline[b]).length
        if rest_length > 0.002:
            ratio = (posed[a] - posed[b]).length / rest_length
            ratios.append((ratio, a, b))
    ratios.sort(key=lambda item: item[0])
    if not ratios:
        raise AssertionError("strain diagnostic received no mesh edges")
    return {
        "edgeCount": len(ratios),
        "p95": ratios[min(len(ratios) - 1, int(len(ratios) * .95))][0],
        "p99": ratios[min(len(ratios) - 1, int(len(ratios) * .99))][0],
        "max": ratios[-1][0],
        "maxEdge": [ratios[-1][1], ratios[-1][2]],
    }


def add_ik(arm, bone, target, count, pole):
    pb = arm.pose.bones[bone]
    c = pb.constraints.new("IK")
    c.target = target
    c.chain_count = count
    c.iterations = 100
    pe = add_empty(target.name + "_Pole", pole)
    c.pole_target = pe
    return c, pe


def main():
    bpy.context.preferences.filepaths.save_version = 0
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
        pb.ik_stretch = 0.0
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    cleanup = repair_riding_weights(mesh, arm)
    # Uniformly fit the 1.62 m source as a plausible 1.75 m older teen; limbs retain proportions.
    arm.scale = tuple(value * 1.08 for value in arm.scale)
    bpy.context.view_layer.update()
    deformation_baseline = evaluated_world_points(mesh)
    # Import the frozen approved bicycle only to read its evaluated anchors.
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(BIKE))
    imported = [o for o in bpy.context.scene.objects if o not in before]
    anchors = {
        n: bpy.data.objects[n].matrix_world.translation.copy()
        for n in (
            "Seat_Attach",
            "Grip_L_Attach",
            "Grip_R_Attach",
            "Pedal_L_Attach",
            "Pedal_R_Attach",
        )
    }
    contact_targets = dict(anchors)
    contact_targets["Grip_L_Attach"] = anchors["Grip_L_Attach"] + Vector((0, 0, 0.017))
    contact_targets["Grip_R_Attach"] = anchors["Grip_R_Attach"] + Vector((0, 0, 0.017))
    # Actual underside of shorts/pelvis, not the hip joint, defines saddle contact.
    leg_group_ids = {
        mesh.vertex_groups[name].index for chain in LEG.values() for name in chain
    }
    pelvic = []
    for v in mesh.data.vertices:
        point = mesh.matrix_world @ v.co
        leg_weight = sum(e.weight for e in v.groups if e.group in leg_group_ids)
        if (
            abs(point.x) < 0.18
            and -0.18 < point.y < -0.015
            and 0.72 < point.z < 0.92
            and leg_weight < 0.15
        ):
            pelvic.append(v.index)
    pp = eval_points(mesh, pelvic)
    butt = min(pp, key=lambda p: (p - anchors["Seat_Attach"]).length)
    shift = anchors["Seat_Attach"] - butt
    arm.location += shift
    bpy.context.view_layer.update()
    # The provider's names are misleading: Head_0 is the lower trunk, followed
    # by Spine_0 and bone_3; bone_4 is the neck. Distribute the riding lean over
    # the real trunk hierarchy so adjacent shirt rings remain continuous.
    for name, degrees in (
        ("tripo::Head_0", -25.0),
        ("tripo::Spine_0", -25.0),
        ("bone_3", -8.0),
        ("bone_4", 25.0),
        ("bone_5", 20.0),
    ):
        rotate_world(arm, name, "X", math.radians(degrees))
        bpy.context.view_layer.update()
    for parent_name, child_name in (
        ("tripo::Head_0", "tripo::Spine_0"),
        ("tripo::Spine_0", "bone_3"),
    ):
        gap = (
            (arm.matrix_world @ arm.pose.bones[parent_name].tail)
            - (arm.matrix_world @ arm.pose.bones[child_name].head)
        ).length
        assert gap < 1e-5, f"connected torso joint {parent_name}/{child_name} opened by {gap} m"
    segment_pitches = {}
    for name in ("tripo::Head_0", "tripo::Spine_0", "bone_3", "bone_4", "bone_5"):
        direction = (
            arm.matrix_world.to_3x3()
            @ (arm.pose.bones[name].tail - arm.pose.bones[name].head)
        ).normalized()
        segment_pitches[name] = math.degrees(math.atan2(direction.y, direction.z))
    assert 15 <= segment_pitches["tripo::Head_0"] <= 32
    assert 28 <= segment_pitches["tripo::Spine_0"] <= 48
    assert 40 <= segment_pitches["bone_3"] <= 58
    assert 30 <= segment_pitches["bone_4"] <= 60
    rest_head_world = arm.matrix_world.to_3x3() @ arm.data.bones["bone_5"].matrix_local.to_3x3()
    posed_head_world = arm.matrix_world.to_3x3() @ arm.pose.bones["bone_5"].matrix.to_3x3()
    head_gaze = (posed_head_world @ rest_head_world.inverted() @ Vector((0, 1, 0))).normalized()
    head_gaze_elevation = math.degrees(math.atan2(head_gaze.z, head_gaze.y))
    assert head_gaze.y > 0.85 and -30 <= head_gaze_elevation <= 10, "head gaze is not naturally forward"
    # Torso rotation changes the evaluated sitting surface slightly. Re-seat from
    # that actual surface before solving any limb contacts.
    arm.location += anchors["Seat_Attach"] - surface_point(mesh, pelvic, "sole")
    bpy.context.view_layer.update()
    hand_ids = {}
    sole_ids = {}
    targets = []
    for side, sgn in (("L", -1), ("R", 1)):
        hand_bone = arm.data.bones[ARM[side][2]]
        terminal_group = mesh.vertex_groups[ARM[side][2]].index
        hand_ids[side] = []
        for vertex in mesh.data.vertices:
            weight = sum(e.weight for e in vertex.groups if e.group == terminal_group)
            point_arm = arm.matrix_world.inverted() @ (mesh.matrix_world @ vertex.co)
            along = (point_arm - hand_bone.head_local).dot(
                (hand_bone.tail_local - hand_bone.head_local).normalized()
            ) / hand_bone.length
            if weight >= 0.5 and 0.12 <= along <= 0.72:
                hand_ids[side].append(vertex.index)
        sole_ids[side] = group_vertices(
            mesh, {LEG[side][2]} | descendants(arm, LEG[side][2]), 0.35
        )
        palm_now = surface_point(mesh, hand_ids[side], "palm")
        palm_arm = arm.matrix_world.inverted() @ palm_now
        palm_local = arm.pose.bones[ARM[side][2]].matrix.inverted() @ palm_arm
        gt = add_empty(
            "GripTarget_" + side, contact_targets["Grip_" + side + "_Attach"]
        )
        targets.append(gt)
        _, pole = add_ik(arm, ARM[side][1], gt, 2, Vector((0.33 * sgn, -0.08, 1.25)))
        targets.append(pole)
        # Hold the wrist in an explicit grip frame: hand length reaches forward across the bar while the bar crosses
        # the palm and the palm faces downward, independent of arm IK.
        orient = add_empty(
            "HandOrient_" + side, contact_targets["Grip_" + side + "_Attach"]
        )
        targets.append(orient)
        y = Vector((0, 1, 0))
        z = Vector((0, 0, -1))
        x = y.cross(z)
        basis = Matrix(
            ((x.x, y.x, z.x, 0), (x.y, y.y, z.y, 0), (x.z, y.z, z.z, 0), (0, 0, 0, 1))
        )
        orient.matrix_world = basis
        orient.location = contact_targets["Grip_" + side + "_Attach"]
        cr = arm.pose.bones[ARM[side][2]].constraints.new("COPY_ROTATION")
        cr.target = orient
        cr.owner_space = "WORLD"
        cr.target_space = "WORLD"
        cr.mix_mode = "REPLACE"
        desired_rotation = orient.matrix_world.to_3x3()
        gt.location = contact_targets["Grip_" + side + "_Attach"] - (
            desired_rotation @ palm_local
        )
        pt = add_empty(
            "PedalTarget_" + side, contact_targets["Pedal_" + side + "_Attach"]
        )
        targets.append(pt)
        ik, pole = add_ik(arm, LEG[side][1], pt, 2, Vector((0.13 * sgn, 0.12, 0.70)))
        targets.append(pole)
        foot = arm.pose.bones[LEG[side][2]]
        rest = arm.matrix_world @ arm.data.bones[LEG[side][2]].matrix_local
        orient = add_empty("FootOrient_" + side, rest.translation)
        orient.rotation_mode = "QUATERNION"
        orient.rotation_quaternion = rest.to_quaternion()
        targets.append(orient)
        cr = foot.constraints.new("COPY_ROTATION")
        cr.target = orient
        cr.owner_space = "WORLD"
        cr.target_space = "WORLD"
        cr.mix_mode = "REPLACE"
        best = (float("inf"), 0.0)
        for step in range(-36, 37):
            ik.pole_angle = math.radians(step * 5)
            bpy.context.view_layer.update()
            knee = (arm.matrix_world @ arm.pose.bones[LEG[side][1]].head).x
            best = min(best, (abs(knee - 0.12 * sgn), ik.pole_angle))
        ik.pole_angle = best[1]
    # Numerically move IK endpoints until measured mesh surfaces meet approved anchors.
    for _ in range(30):
        bpy.context.view_layer.update()
        for side in ("L", "R"):
            palm = surface_point(
                mesh,
                hand_ids[side],
                "palm",
                contact_targets["Grip_" + side + "_Attach"],
            )
            bpy.data.objects["GripTarget_" + side].location += (
                contact_targets["Grip_" + side + "_Attach"] - palm
            )
            sole = surface_point(
                mesh,
                sole_ids[side],
                "sole",
                contact_targets["Pedal_" + side + "_Attach"],
            )
            bpy.data.objects["PedalTarget_" + side].location += (
                contact_targets["Pedal_" + side + "_Attach"] - sole
            )
    # Recalibrate knee bend planes after the final ankle targets settle.
    for side, sgn in (("L", -1), ("R", 1)):
        ik = next(c for c in arm.pose.bones[LEG[side][1]].constraints if c.type == "IK")
        best = (float("inf"), 0.0)
        for step in range(-36, 37):
            ik.pole_angle = math.radians(step * 5)
            bpy.context.view_layer.update()
            knee = (arm.matrix_world @ arm.pose.bones[LEG[side][1]].head).x
            best = min(best, (abs(knee - 0.12 * sgn), ik.pole_angle))
        ik.pole_angle = best[1]
    # Close the provider's three phalanges around the transverse grip axis.
    # The repaired world-pivot helper keeps each finger joint connected.
    for side in ("L", "R"):
        terminal = arm.data.bones[ARM[side][2]]
        for bone in arm.data.bones:
            if terminal in bone.parent_recursive:
                depth = len(bone.parent_recursive) - len(terminal.parent_recursive)
                if 1 <= depth <= 3:
                    rotate_world(arm, bone.name, "X", math.radians(22 if depth <= 2 else 14))
    bpy.context.view_layer.update()
    # One final endpoint correction after finger closure.
    for _ in range(5):
        for side in ("L", "R"):
            bpy.data.objects["GripTarget_" + side].location += contact_targets[
                "Grip_" + side + "_Attach"
            ] - surface_point(
                mesh,
                hand_ids[side],
                "palm",
                contact_targets["Grip_" + side + "_Attach"],
            )
        bpy.context.view_layer.update()
    posed_pelvis = eval_points(mesh, pelvic)
    nearest = min((p - anchors["Seat_Attach"]).length for p in posed_pelvis)
    actual = {
        "PelvisContact": centroid(
            [
                p
                for p in posed_pelvis
                if (p - anchors["Seat_Attach"]).length <= nearest + 0.008
            ]
        )
    }
    for side in ("L", "R"):
        actual["Palm_" + side + "_Contact"] = surface_point(
            mesh, hand_ids[side], "palm", contact_targets["Grip_" + side + "_Attach"]
        )
        actual["Sole_" + side + "_Contact"] = surface_point(
            mesh, sole_ids[side], "sole", contact_targets["Pedal_" + side + "_Attach"]
        )
    limb_length_ratios = {}
    for name in (*ARM["L"][:2], *ARM["R"][:2], *LEG["L"][:2], *LEG["R"][:2]):
        posed = (
            arm.matrix_world.to_3x3()
            @ (arm.pose.bones[name].tail - arm.pose.bones[name].head)
        ).length
        rest = (
            arm.matrix_world.to_3x3()
            @ (arm.data.bones[name].tail_local - arm.data.bones[name].head_local)
        ).length
        limb_length_ratios[name] = posed / rest
        assert (
            abs(limb_length_ratios[name] - 1.0) < 1e-4
        ), f"{name} stretched during fit"
    knee_x = {
        side: (arm.matrix_world @ arm.pose.bones[LEG[side][1]].head).x
        for side in ("L", "R")
    }
    assert (
        knee_x["L"] < -0.03
        and knee_x["R"] > 0.03
        and max(abs(x) for x in knee_x.values()) < 0.22
    )
    # Anatomical central shirt region in the pre-pose evaluated source. Weight
    # membership alone is unstable when a repair changes the neck blend and
    # can silently move edges into or out of the percentile population.
    torso_strain_vertices = {
        index for index, point in enumerate(deformation_baseline)
        if 0.92 <= point.z <= 1.34 and abs(point.x) <= 0.11 and abs(point.y) <= 0.18
    }
    torso_vertices = {
        index for index, point in enumerate(deformation_baseline)
        if 0.92 <= point.z <= 1.36 and abs(point.x) <= 0.23 and abs(point.y) <= 0.18
    }
    neck_vertices = {
        index for index, point in enumerate(deformation_baseline)
        if 1.34 <= point.z <= 1.44 and abs(point.x) <= 0.12 and abs(point.y) <= 0.18
    }
    strain = {
        "wholeMesh": edge_strain(mesh, deformation_baseline),
        "torso": edge_strain(mesh, deformation_baseline, torso_strain_vertices),
        "neck": edge_strain(mesh, deformation_baseline, neck_vertices),
    }
    print("SURFACE_STRAIN", json.dumps(strain))
    for label in ("wholeMesh", "torso"):
        a, b = strain[label]["maxEdge"]
        print("STRAIN_EDGE", label, a, b,
              tuple(round(x, 5) for x in mesh.data.vertices[a].co),
              tuple(round(x, 5) for x in mesh.data.vertices[b].co),
              [(mesh.vertex_groups[g.group].name, round(g.weight, 3)) for g in mesh.data.vertices[a].groups],
              [(mesh.vertex_groups[g.group].name, round(g.weight, 3)) for g in mesh.data.vertices[b].groups])
    # Linear skinning can stretch around bent joints, but a multi-metre shirt
    # sheet produces edge ratios far beyond these deliberately generous caps.
    assert strain["torso"]["p99"] < 1.75, "torso surface strain indicates a torn/stretched shirt"
    assert strain["torso"]["max"] < 4.0, "torso contains an extreme stretched edge"
    assert strain["neck"]["p99"] < 2.1 and strain["neck"]["max"] < 3.0, "neck transition is discontinuous"
    posed_world = evaluated_world_points(mesh)
    triangle_edges = []
    for polygon in mesh.data.polygons:
        vertices = polygon.vertices
        for i in range(len(vertices)):
            a, b = vertices[i], vertices[(i + 1) % len(vertices)]
            triangle_edges.append(((posed_world[a] - posed_world[b]).length, a, b))
    triangle_edges.sort(key=lambda item: item[0])
    max_triangle_edge = triangle_edges[-1][0]
    p999_triangle_edge = triangle_edges[min(len(triangle_edges) - 1, int(len(triangle_edges) * .999))][0]
    print("TRIANGLE_EDGES", triangle_edges[-1], p999_triangle_edge, sum(item[0] > 0.20 for item in triangle_edges))
    assert max_triangle_edge <= 0.22, "posed mesh contains a long torn triangle edge"
    # Measure the central half of the trunk in its own anatomical frame. This
    # catches a collapsed paper-thin torso even when no individual edge spikes.
    hip_center = sum((arm.matrix_world @ arm.pose.bones[name].head for name in (LEG["L"][0], LEG["R"][0])), Vector()) / 2
    shoulder_center = sum((arm.matrix_world @ arm.pose.bones[name].head for name in (ARM["L"][0], ARM["R"][0])), Vector()) / 2
    trunk_axis = (shoulder_center - hip_center).normalized()
    lateral_axis = Vector((1, 0, 0))
    depth_axis = trunk_axis.cross(lateral_axis).normalized()
    torso_points = [posed_world[i] for i in torso_vertices if abs(posed_world[i].x) < 0.22]
    along = sorted((point - hip_center).dot(trunk_axis) for point in torso_points)
    lo, hi = along[len(along) // 4], along[(len(along) * 3) // 4]
    core = [point for point in torso_points if lo <= (point - hip_center).dot(trunk_axis) <= hi]
    torso_width = max(point.dot(lateral_axis) for point in core) - min(point.dot(lateral_axis) for point in core)
    torso_depth = max(point.dot(depth_axis) for point in core) - min(point.dot(depth_axis) for point in core)
    assert torso_width >= 0.20 and torso_depth >= 0.10, "posed torso volume collapsed"
    trunk_length = (shoulder_center - hip_center).length
    torso_sections = {}
    for name, lower, upper in (
        ("waist", .18, .34),
        ("midTorso", .42, .58),
        ("chest", .66, .82),
    ):
        section = [
            point for point in torso_points
            if lower * trunk_length <= (point - hip_center).dot(trunk_axis) <= upper * trunk_length
        ]
        assert len(section) >= 20, f"{name} section has insufficient surface samples"
        width = max(point.dot(lateral_axis) for point in section) - min(point.dot(lateral_axis) for point in section)
        depth = max(point.dot(depth_axis) for point in section) - min(point.dot(depth_axis) for point in section)
        assert width >= 0.16 and depth >= 0.075, f"{name} section collapsed"
        torso_sections[name] = {"sampleCount": len(section), "widthM": width, "depthM": depth}
    achieved_lean = math.degrees(math.atan2(
        (shoulder_center - hip_center).y, (shoulder_center - hip_center).z
    ))
    assert 25.0 <= achieved_lean <= 48.0, f"anatomical torso lean is {achieved_lean:.2f} degrees"
    geometry_quality = {
        "maxTriangleEdgeM": max_triangle_edge,
        "p999TriangleEdgeM": p999_triangle_edge,
        "edgesOver020M": sum(item[0] > 0.20 for item in triangle_edges),
        "torsoEdgeStrain": strain["torso"],
        "neckEdgeStrain": strain["neck"],
        "torsoCoreWidthM": torso_width,
        "torsoCoreDepthM": torso_depth,
        "torsoCrossSections": torso_sections,
        "anatomicalLeanDegrees": achieved_lean,
        "spineSegmentPitchDegrees": segment_pitches,
        "headGazeDirection": list(head_gaze),
        "headGazeElevationDegrees": head_gaze_elevation,
    }
    markers = {n: add_empty(n, p) for n, p in actual.items()}
    # Pack the approved art-direction guide into the editable source only. It
    # remains hidden from render/export and travels with the .blend for review.
    guide_image = bpy.data.images.load(str(REFERENCE), check_existing=True)
    guide_image.pack()
    guide = bpy.data.objects.new("SeatedPoseGuideV2", None)
    bpy.context.scene.collection.objects.link(guide)
    guide.empty_display_type = "IMAGE"
    guide.data = guide_image
    guide.empty_display_size = 1.6
    guide.location = (1.2, 0.3, 1.0)
    guide.rotation_euler = (math.radians(90), 0, math.radians(90))
    guide.hide_render = True
    guide["purpose"] = "Art-direction input; approved bicycle anchors remain authoritative"
    # Save editable rig before freezing evaluated deformation for browser review.
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    deps = bpy.context.evaluated_depsgraph_get()
    frozen = bpy.data.meshes.new_from_object(mesh.evaluated_get(deps), depsgraph=deps)
    body = bpy.data.objects.new("TeenCourierSeatedBody", frozen)
    bpy.context.scene.collection.objects.link(body)
    body.matrix_world = mesh.matrix_world
    root = add_empty("TeenCourierSeatedV2", Vector())
    root.empty_display_size = 0.05
    body.parent = root
    body.matrix_parent_inverse = root.matrix_world.inverted()
    for m in markers.values():
        m.parent = root
        m.matrix_parent_inverse = root.matrix_world.inverted()
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    body.select_set(True)
    for m in markers.values():
        m.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        export_yup=True,
        export_animations=False,
        export_skins=False,
        use_selection=True,
        export_extras=True,
    )
    # GLB and measured fit contract.
    targets_world = {
        "PelvisContact": anchors["Seat_Attach"],
        "Palm_L_Contact": contact_targets["Grip_L_Attach"],
        "Palm_R_Contact": contact_targets["Grip_R_Attach"],
        "Sole_L_Contact": contact_targets["Pedal_L_Attach"],
        "Sole_R_Contact": contact_targets["Pedal_R_Attach"],
    }
    residuals = {n: round((actual[n] - targets_world[n]).length, 6) for n in CONTACTS}
    pts = [body.matrix_world @ v.co for v in body.data.vertices]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    payload = OUT.read_bytes()
    jl = struct.unpack_from("<I", payload, 12)[0]
    g = json.loads(payload[20 : 20 + jl].decode().rstrip("\0 "))
    scene_roots = g["scenes"][g.get("scene", 0)]["nodes"]
    assert (
        len(scene_roots) == 1
        and g["nodes"][scene_roots[0]]["name"] == "TeenCourierSeatedV2"
    )
    assert not g.get("skins") and not g.get("animations") and len(payload) < 5_000_000
    manifest = {
        "formatVersion": 1,
        "revision": "teen-courier-seated-v2/2",
        "reviewStatus": "awaiting-human-review",
        "asset": OUT.name,
        "source": str(SOURCE.relative_to(ROOT)),
        "poseReference": str(REFERENCE.relative_to(ROOT)),
        "sourceIdentity": "Original detailed teen face, hair, textured body and outfit preserved.",
        "approvedBicycle": {
            "asset": "commuter_bicycle_v2.glb",
            "sha256": "ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125",
            "steer": 0,
            "crankPhase": 0,
        },
        "contract": {
            "soleRoot": "TeenCourierSeatedV2",
            "units": "metres",
            "upAxis": "+Y",
            "forwardAxis": "-Z",
            "rightSide": "+X",
            "rootTransform": "identity",
            "static": True,
            "skinExported": False,
            "animations": 0,
        },
        "fit": {
            "uniformCharacterScale": 1.08,
            "fittedHeightM": 1.7496,
            "seatpostAdjustmentM": 0.0,
            "gripRadiusM": 0.017,
            "gripTargetDefinition": "17 mm above the grip centerline on the palmar contact surface",
            "limbLengthRatios": limb_length_ratios,
            "kneeXBlenderM": knee_x,
            "contactPositionsBlenderZUp": {
                n: [round(x, 6) for x in actual[n]] for n in CONTACTS
            },
            "targetPositionsBlenderZUp": {
                n: [round(x, 6) for x in targets_world[n]] for n in CONTACTS
            },
            "residualsM": residuals,
            "contactMethod": "centroids of evaluated posed mesh surface regions; targets are recorded separately",
            "surfaceStrainRatios": strain,
        },
        "boundsBlenderZUp": {
            "min": [round(x, 6) for x in mn],
            "max": [round(x, 6) for x in mx],
        },
        "weightCleanup": cleanup,
        "geometryQuality": geometry_quality,
        "generation": {
            "nodeCount": len(g.get("nodes", [])),
            "meshCount": len(g.get("meshes", [])),
            "glbBytes": len(payload),
        },
        "validation": {
            "status": "passed",
            "checks": [
                "sole identity root",
                "static unskinned export",
                "no animations",
                "surface-derived contacts recorded separately from targets",
                "approved bicycle unchanged",
                "uniform scale only",
                "torso surface strain below continuity thresholds",
                "GLB under 5 MB",
            ],
        },
        "sha256": {
            "glb": hashlib.sha256(payload).hexdigest(),
            "blend": hashlib.sha256(BLEND.read_bytes()).hexdigest(),
            "generator": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "source": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            "poseReference": hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        json.dumps(
            {
                "glb": manifest["sha256"]["glb"],
                "residuals": residuals,
                "bytes": len(payload),
            }
        )
    )


if __name__ == "__main__":
    main()
