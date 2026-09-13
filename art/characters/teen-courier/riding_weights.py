"""Narrow skin-weight repairs for the approved teen's seated riding pose."""

from mathutils import Vector


ARM = {
    "L": ("tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2"),
    "R": ("tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2"),
}
LEG_FOOT = {"L": "tripo::0_Left_Limb_2", "R": "tripo::0_Right_Limb_2"}
TORSO = "bone_4"
FINGER_GROUPS = {
    "L": {f"bone_{index}" for index in range(12, 30)} | {f"tripo::1_Left_Limb_{index}" for index in range(3, 7)},
    "R": {f"bone_{index}" for index in range(33, 50)} | {f"tripo::1_Right_Limb_{index}" for index in range(3, 7)},
}


def _replace_weights(mesh, vertex_index, weights):
    for element in list(mesh.data.vertices[vertex_index].groups):
        mesh.vertex_groups[element.group].remove([vertex_index])
    for name, weight in weights.items():
        if weight > 1e-5:
            mesh.vertex_groups[name].add([vertex_index], weight, "REPLACE")


def repair_riding_weights(mesh, armature=None):
    """Repair shoulder seams and rigidify palms before applying riding IK.

    The provider skin has almost-binary upper-arm weights at the shirt/torso
    seam. Large forward arm rotation opens that seam into a triangular flap.
    Its distal hand also contains many independently weighted finger chains;
    the three-bone arm IK can fold those unposed chains into long spikes.
    """
    required = {TORSO, *(name for chain in ARM.values() for name in chain)}
    missing = sorted(required.difference(mesh.vertex_groups.keys()))
    if missing:
        raise ValueError(f"riding weight repair is missing groups: {', '.join(missing)}")
    source_bones = armature.data.bones if armature else None
    finger_groups_by_side = {}
    terminal_groups_by_side = {}
    for side in ("L", "R"):
        terminal = source_bones.get(ARM[side][2]) if source_bones else None
        terminal_groups_by_side[side] = {ARM[side][2]}
        finger_groups_by_side[side] = {
            bone.name for bone in source_bones
            if terminal and terminal in bone.parent_recursive
        } if source_bones else FINGER_GROUPS[side]

    # UV islands duplicate positions. Provider weights differ across some of
    # those duplicates, so the copies separate as soon as a joint bends. Give
    # coincident copies the same averaged influences without touching UVs,
    # topology, split normals, materials, or vertex positions.
    coincident = {}
    for vertex in mesh.data.vertices:
        point = mesh.matrix_world @ vertex.co
        key = tuple(round(axis, 4) for axis in point)
        coincident.setdefault(key, []).append(vertex.index)
    synced_count = 0
    for indices in coincident.values():
        if len(indices) < 2:
            continue
        totals = {}
        for vertex_index in indices:
            for element in mesh.data.vertices[vertex_index].groups:
                name = mesh.vertex_groups[element.group].name
                totals[name] = totals.get(name, 0.0) + element.weight
        weights = {name: total / len(indices) for name, total in totals.items()}
        normalizer = sum(weights.values())
        if normalizer <= 1e-8:
            continue
        normalized = {name: weight / normalizer for name, weight in weights.items()}
        if any(any(abs(element.weight - normalized.get(mesh.vertex_groups[element.group].name, 0.0)) > 1e-4 for element in mesh.data.vertices[index].groups) for index in indices):
            synced_count += len(indices)
        for vertex_index in indices:
            _replace_weights(mesh, vertex_index, normalized)

    shoulder_count = 0
    hand_count = 0
    contaminated_count = 0
    recovered_count = 0
    for vertex in mesh.data.vertices:
        point = mesh.matrix_world @ vertex.co
        side = "L" if point.x < 0 else "R"
        radius = abs(point.x)

        # The source contains a real cross-body leak: left finger groups reach
        # x +.306 and z 1.322 even though the left hand envelope is x <= -.27,
        # z .60..84. Strip finger weights outside their own hand before any
        # pose is authored, then renormalize the weights that remain.
        for hand_side, expected_sign in (("L", -1), ("R", 1)):
            finger_groups = finger_groups_by_side[hand_side]
            terminal_groups = terminal_groups_by_side[hand_side]
            inside_fingers = expected_sign * point.x >= 0.27 and 0.55 <= point.z <= 0.84 and abs(point.y) <= 0.13
            # The terminal hand itself may also have provider leakage. Its
            # legitimate envelope includes the wrist and back of the palm, so
            # sanitize it with a deliberately wider domain than the fingers.
            inside_terminal = expected_sign * point.x >= 0.23 and 0.52 <= point.z <= 0.94 and abs(point.y) <= 0.18
            leaked = [
                element for element in vertex.groups
                if ((mesh.vertex_groups[element.group].name in finger_groups and not inside_fingers)
                    or (mesh.vertex_groups[element.group].name in terminal_groups and not inside_terminal))
            ]
            if leaked:
                for element in leaked:
                    mesh.vertex_groups[element.group].remove([vertex.index])
                remaining = [(element, element.weight) for element in vertex.groups]
                total = sum(weight for _, weight in remaining)
                if total > 1e-8:
                    for element, weight in remaining:
                        mesh.vertex_groups[element.group].add([vertex.index], weight / total, "REPLACE")
                else:
                    if point.z < 0.55:
                        recovery = LEG_FOOT[side]
                    elif point.z > 1.12 and radius < 0.13:
                        recovery = TORSO
                    elif point.z > 1.02:
                        recovery = ARM[side][0]
                    else:
                        recovery = ARM[side][1]
                    mesh.vertex_groups[recovery].add([vertex.index], 1.0, "REPLACE")
                    recovered_count += 1
                contaminated_count += 1

        # The approved source shoulder heads are at x ±.149, z 1.250 m.
        # Blend a narrow seam band from upper spine to upper arm while leaving
        # the rest of the authored skin untouched.
        if 1.17 <= point.z <= 1.34 and 0.095 <= radius <= 0.215 and abs(point.y) <= 0.17:
            arm_weight = max(0.0, min(1.0, (radius - 0.115) / 0.075))
            _replace_weights(mesh, vertex.index, {
                TORSO: 1.0 - arm_weight,
                ARM[side][0]: arm_weight,
            })
            shoulder_count += 1

        # Rigid palms/fingers are preferable to provider finger-chain spikes
        # in the bicycle grip pose. The source hands occupy the distal lower
        # arm envelope below z .84 and outside x ±.27 m.
        elif 0.55 <= point.z <= 0.84 and radius >= 0.27 and abs(point.y) <= 0.13:
            # Keep fingers/palm rigid, then feather across the anatomical wrist
            # instead of creating a hard hand/forearm deformation boundary.
            forearm = max(0.0, min(1.0, (point.z - 0.76) / 0.08))
            _replace_weights(mesh, vertex.index, {
                ARM[side][2]: 1.0 - forearm,
                ARM[side][1]: forearm,
            })
            hand_count += 1

    mesh.data.update()
    return {"syncedSeamVertices": synced_count, "shoulderVertices": shoulder_count, "handVertices": hand_count, "contaminatedFingerVertices": contaminated_count, "recoveredVertices": recovered_count}
