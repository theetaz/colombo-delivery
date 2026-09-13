"""Narrow skin-weight repairs for the approved teen's seated riding pose."""

from mathutils import Vector


ARM = {
    "L": ("tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2"),
    "R": ("tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2"),
}
LEG_FOOT = {"L": "tripo::0_Left_Limb_2", "R": "tripo::0_Right_Limb_2"}
# ``bone_4`` is the provider's neck, despite earlier code treating it as the
# shirt/torso driver.  The upper shirt and shoulder girdle follow ``bone_3``.
# Assigning the sleeve seam to bone_4 makes those vertices follow the neck
# counter-rotation and pulls the shirt into a long open triangular sheet.
TORSO = "bone_3"
FINGER_GROUPS = {
    "L": {f"bone_{index}" for index in range(12, 30)} | {f"tripo::1_Left_Limb_{index}" for index in range(3, 7)},
    "R": {f"bone_{index}" for index in range(33, 50)} | {f"tripo::1_Right_Limb_{index}" for index in range(3, 7)},
}


def _replace_weights(mesh, vertex_index, weights):
    # Removing via cached MDeformVert entries is unsafe: each removal mutates
    # the collection and later entries can refer to stale slots, leaving old
    # influences behind and producing totals above 1. Remove by stable group.
    for group in mesh.vertex_groups:
        group.remove([vertex_index])
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
    required = {TORSO, "bone_4", *(name for chain in ARM.values() for name in chain)}
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
    central_torso_count = 0
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
            leaked_names = [
                mesh.vertex_groups[element.group].name for element in vertex.groups
                if ((mesh.vertex_groups[element.group].name in finger_groups and not inside_fingers)
                    or (mesh.vertex_groups[element.group].name in terminal_groups and not inside_terminal))
            ]
            if leaked_names:
                for group_name in leaked_names:
                    mesh.vertex_groups[group_name].remove([vertex.index])
                remaining = {
                    mesh.vertex_groups[element.group].name: element.weight
                    for element in mesh.data.vertices[vertex.index].groups
                }
                total = sum(remaining.values())
                if total > 1e-8:
                    _replace_weights(mesh, vertex.index, {
                        name: weight / total for name, weight in remaining.items()
                    })
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

        # Provider clavicle weights leak strongly across the centre chest.
        # Keep that surface on the trunk, then feather continuously through
        # the neck into bone_5. A former hard cutoff at z=1.385 left adjacent
        # 3 mm vertices on unrelated transforms and opened a 71 mm neck edge.
        if 1.16 <= point.z <= 1.43 and radius < 0.105 and abs(point.y) <= 0.17:
            if point.z < 1.375:
                neck = max(0.0, min(0.72, (point.z - 1.25) / 0.125 * 0.72))
                weights = {TORSO: 1.0 - neck, "bone_4": neck}
            else:
                head = max(0.0, min(1.0, (point.z - 1.375) / 0.055))
                weights = {
                    TORSO: 0.28 * (1.0 - head),
                    "bone_4": 0.72 * (1.0 - head),
                    "bone_5": head,
                }
            _replace_weights(mesh, vertex.index, weights)
            central_torso_count += 1

        # The approved source shoulder heads are at x ±.149, z 1.250 m.
        # Blend a narrow seam band from upper spine to upper arm while leaving
        # the rest of the authored skin untouched.
        elif 1.17 <= point.z <= 1.34 and 0.095 <= radius <= 0.215 and abs(point.y) <= 0.17:
            arm_weight = max(0.0, min(1.0, (radius - 0.115) / 0.075))
            _replace_weights(mesh, vertex.index, {
                TORSO: 1.0 - arm_weight,
                ARM[side][0]: arm_weight,
            })
            shoulder_count += 1

        # Stabilize the palm/wrist vertices that are not controlled by a
        # finger chain. Finger descendants retain their repaired authored
        # weights for the explicit grip curl applied by the pose generator.
        elif 0.55 <= point.z <= 0.84 and radius >= 0.27 and abs(point.y) <= 0.13:
            # Feather across the anatomical wrist rather than creating a hard
            # palm/forearm deformation boundary.
            names = {mesh.vertex_groups[e.group].name for e in vertex.groups}
            if not names.intersection(finger_groups_by_side[side]):
                forearm = max(0.0, min(1.0, (point.z - 0.76) / 0.08))
                _replace_weights(mesh, vertex.index, {
                    ARM[side][2]: 1.0 - forearm,
                    ARM[side][1]: forearm,
                })
                hand_count += 1

    mesh.data.update()
    for vertex in mesh.data.vertices:
        total = sum(element.weight for element in vertex.groups)
        if not (total == total and abs(total - 1.0) < 1e-4):
            raise AssertionError(
                f"vertex {vertex.index} has invalid normalized weight sum {total}"
            )
    return {"syncedSeamVertices": synced_count, "centralTorsoVertices": central_torso_count, "shoulderVertices": shoulder_count, "handVertices": hand_count, "contaminatedFingerVertices": contaminated_count, "recoveredVertices": recovered_count}
