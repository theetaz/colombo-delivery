"""Build a compact, deterministic riding rig over the approved textured mesh.

Call ``rebuild_minimal_riding_rig(mesh, provider_armature)`` before posing.
The mesh is baked into world space, its texture/material slots are preserved,
and provider weights are consolidated into a compact 19-bone deformation rig.
"""

import bpy
from mathutils import Matrix, Vector


ROOT = "tripo::Root"
SPINE = ("tripo::Spine_0", "bone_3", "bone_4")
HEAD = "tripo::Head_0"
ARM = {
    "L": ("tripo::1_Left_Limb_0", "tripo::1_Left_Limb_1", "tripo::1_Left_Limb_2"),
    "R": ("tripo::1_Right_Limb_0", "tripo::1_Right_Limb_1", "tripo::1_Right_Limb_2"),
}
LEG = {
    "L": ("tripo::0_Left_Limb_0", "tripo::0_Left_Limb_1", "tripo::0_Left_Limb_2"),
    "R": ("tripo::0_Right_Limb_0", "tripo::0_Right_Limb_1", "tripo::0_Right_Limb_2"),
}
CLAVICLE = {"L": "bone_8", "R": "bone_29"}

# Measured from the reviewed source after its object transform. Coordinates are
# Blender world space: +Z up, +Y is the teen's front.
BONES = {
    ROOT: ((0.0, 0.0, 0.826), (0.0, 0.0, 0.94), None),
    SPINE[0]: ((0.0, 0.0, 0.826), (0.0, -0.010, 1.022), ROOT),
    SPINE[1]: ((0.0, -0.010, 1.022), (0.0, -0.035, 1.130), SPINE[0]),
    SPINE[2]: ((0.0, -0.035, 1.130), (0.0, -0.041, 1.270), SPINE[1]),
    HEAD: ((0.0, -0.041, 1.270), (0.0, 0.025, 1.535), SPINE[2]),
    CLAVICLE["L"]: ((-0.04, -0.041, 1.250), (-0.149, -0.041, 1.250), SPINE[2]),
    CLAVICLE["R"]: ((0.04, -0.041, 1.250), (0.149, -0.041, 1.250), SPINE[2]),
    ARM["L"][0]: ((-0.149, -0.041, 1.250), (-0.237, -0.047, 1.003), CLAVICLE["L"]),
    ARM["L"][1]: ((-0.237, -0.047, 1.003), (-0.320, 0.003, 0.782), ARM["L"][0]),
    ARM["L"][2]: ((-0.320, 0.003, 0.782), (-0.357, 0.010, 0.747), ARM["L"][1]),
    ARM["R"][0]: ((0.149, -0.041, 1.250), (0.231, -0.047, 1.003), CLAVICLE["R"]),
    ARM["R"][1]: ((0.231, -0.047, 1.003), (0.313, 0.003, 0.782), ARM["R"][0]),
    ARM["R"][2]: ((0.313, 0.003, 0.782), (0.357, 0.010, 0.747), ARM["R"][1]),
    LEG["L"][0]: ((-0.085, -0.003, 0.826), (-0.123, -0.016, 0.471), ROOT),
    LEG["L"][1]: ((-0.123, -0.016, 0.471), (-0.168, -0.085, 0.104), LEG["L"][0]),
    LEG["L"][2]: ((-0.168, -0.085, 0.104), (-0.199, 0.095, 0.035), LEG["L"][1]),
    LEG["R"][0]: ((0.085, -0.003, 0.826), (0.117, -0.016, 0.471), ROOT),
    LEG["R"][1]: ((0.117, -0.016, 0.471), (0.155, -0.085, 0.104), LEG["R"][0]),
    LEG["R"][2]: ((0.155, -0.085, 0.104), (0.193, 0.095, 0.035), LEG["R"][1]),
}


def _provider_target(name, provider_bones):
    for side in ("L", "R"):
        for index, target in enumerate(ARM[side]):
            source = provider_bones.get(name)
            terminal = provider_bones.get(ARM[side][2])
            if name == target or (source and terminal and terminal in source.parent_recursive):
                return target if name == target else ARM[side][2]
        for target in LEG[side]:
            source = provider_bones.get(name)
            terminal = provider_bones.get(LEG[side][2])
            if name == target or (source and terminal and terminal in source.parent_recursive):
                return target if name == target else LEG[side][2]
    return None


def _torso_target(point):
    if point.z < 0.94:
        return ROOT
    if point.z < 1.075:
        return SPINE[0]
    if point.z < 1.205:
        return SPINE[1]
    if point.z < 1.385:
        return SPINE[2]
    return HEAD


def _torso_weights(point):
    centers = ((0.86, ROOT), (1.00, SPINE[0]), (1.14, SPINE[1]), (1.28, SPINE[2]), (1.50, HEAD))
    if point.z <= centers[0][0]:
        return {ROOT: 1.0}
    if point.z >= centers[-1][0]:
        return {HEAD: 1.0}
    for (low_z, low_name), (high_z, high_name) in zip(centers, centers[1:]):
        if low_z <= point.z <= high_z:
            blend = (point.z - low_z) / (high_z - low_z)
            return {low_name: 1.0 - blend, high_name: blend}
    return {_torso_target(point): 1.0}


def rebuild_minimal_riding_rig(mesh, provider_armature):
    world = mesh.matrix_world.copy()
    provider_bones = provider_armature.data.bones
    old_group_names = {group.index: group.name for group in mesh.vertex_groups}
    vertex_weights = []
    for vertex in mesh.data.vertices:
        point = world @ vertex.co
        totals = {}
        torso_total = 0.0
        for element in vertex.groups:
            source_name = old_group_names[element.group]
            target = _provider_target(source_name, provider_bones)
            if target:
                totals[target] = totals.get(target, 0.0) + element.weight
            else:
                torso_total += element.weight
        for name, blend in _torso_weights(point).items():
            totals[name] = totals.get(name, 0.0) + torso_total * blend
        if not totals:
            totals[_torso_target(point)] = 1.0
        total = sum(totals.values())
        vertex_weights.append({name: weight / total for name, weight in totals.items()})

    # The provider shoulder contains millimetre-scale triangle edges whose two
    # ends carry visibly different upper-arm/torso blends. Steering magnifies
    # those discontinuities into thin sleeve spikes. Smooth only this connected
    # shoulder band, using short topology edges so facial and garment islands
    # at similar coordinates remain untouched.
    shoulder_neighbors = {vertex.index: set() for vertex in mesh.data.vertices}
    for edge in mesh.data.edges:
        a, b = edge.vertices
        pa, pb = world @ mesh.data.vertices[a].co, world @ mesh.data.vertices[b].co
        if (pa - pb).length > 0.0035:
            continue
        if all(1.17 <= point.z <= 1.36 and 0.09 <= abs(point.x) <= 0.23 for point in (pa, pb)):
            shoulder_neighbors[a].add(b)
            shoulder_neighbors[b].add(a)
    visited = set()
    for start, neighbors in shoulder_neighbors.items():
        if start in visited or not neighbors:
            continue
        component, pending = set(), [start]
        while pending:
            index = pending.pop()
            if index in component:
                continue
            component.add(index)
            pending.extend(shoulder_neighbors[index] - component)
        visited.update(component)
        names = set().union(*(vertex_weights[index] for index in component))
        averaged = {name: sum(vertex_weights[index].get(name, 0.0) for index in component) / len(component) for name in names}
        total = sum(averaged.values())
        shared = {name: weight / total for name, weight in averaged.items() if weight > 1e-6}
        for index in component:
            vertex_weights[index] = shared.copy()

    # glTF splits source vertices along render loops. Pin the reviewed inner
    # left-shoulder seam by position so both exported copies deform identically.
    seam_points = (Vector((-0.125225, -0.343693, 1.326270)), Vector((-0.128395, -0.343693, 1.326270)))
    seam_indices = [
        vertex.index for vertex in mesh.data.vertices
        if min(((world @ vertex.co) - point).length for point in seam_points) <= 0.0015
    ]
    if len(seam_indices) >= 2:
        names = set().union(*(vertex_weights[index] for index in seam_indices))
        averaged = {name: sum(vertex_weights[index].get(name, 0.0) for index in seam_indices) / len(seam_indices) for name in names}
        total = sum(averaged.values())
        shared = {name: weight / total for name, weight in averaged.items() if weight > 1e-6}
        for index in seam_indices:
            vertex_weights[index] = shared.copy()

    for modifier in list(mesh.modifiers):
        if modifier.type == "ARMATURE":
            mesh.modifiers.remove(modifier)
    mesh.parent = None
    mesh.data.transform(world)
    mesh.matrix_world = Matrix.Identity(4)
    mesh.vertex_groups.clear()

    provider_armature.name = "ProviderRigRetired"
    provider_armature.data.name = "ProviderRigRetiredData"
    armature_data = bpy.data.armatures.new("TeenCourierMinimalRidingRig")
    armature = bpy.data.objects.new("TeenCourierRig", armature_data)
    bpy.context.scene.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    edit = {}
    for name, (head, tail, _) in BONES.items():
        bone = armature_data.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        bone.use_deform = True
        edit[name] = bone
    for name, (_, _, parent) in BONES.items():
        if parent:
            edit[name].parent = edit[parent]
    bpy.ops.object.mode_set(mode="OBJECT")

    groups = {name: mesh.vertex_groups.new(name=name) for name in BONES}
    for vertex_index, weights in enumerate(vertex_weights):
        for name, weight in weights.items():
            groups[name].add([vertex_index], weight, "REPLACE")
    modifier = mesh.modifiers.new("TeenCourierMinimalRidingSkin", "ARMATURE")
    modifier.object = armature
    mesh.parent = armature
    mesh.matrix_parent_inverse = armature.matrix_world.inverted()
    mesh.data.update()

    if provider_armature is not armature:
        bpy.data.objects.remove(provider_armature, do_unlink=True)
    return armature, {
        "boneCount": len(BONES),
        "boneMap": {"root": ROOT, "spine": list(SPINE), "head": HEAD, "clavicles": CLAVICLE, "arms": ARM, "legs": LEG},
    }
