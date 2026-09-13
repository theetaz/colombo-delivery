"""Build the first clean deformation checkpoint from the approved static courier.

The neutral export is the source mesh under a new rest-pose armature. The only
posed export is a distributed upper-body lean; limb contact posing is deliberately
outside this checkpoint.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import hashlib
import json
import math
import struct
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree


ROOT = Path(__file__).resolve().parents[4]
SOURCE_BLEND = ROOT / "art/characters/teen-courier/teen_courier_cleanup.blend"
SOURCE_GLB = ROOT / "public/models/teen_courier.glb"
POSE_GUIDE = ROOT / "public/references/rider-fit/seated-pose-guide-v2.png"
OUT_DIR = ROOT / "art/characters/teen-courier/clean-rig"
BLEND = OUT_DIR / "teen_courier_clean_rig.blend"
NEUTRAL_GLB = ROOT / "public/models/teen_courier_clean_rig_neutral.glb"
LEAN_GLB = ROOT / "public/models/teen_courier_clean_rig_upper_body.glb"
MANIFEST = ROOT / "public/models/teen_courier_clean_rig.manifest.json"
HEAD_LABEL = OUT_DIR / "head_protected_vertex_ids.json"


BONES = [
    ("root", None, (0, 0, 0.00), (0, 0, 0.12), False),
    ("pelvis", "root", (0, 0, 0.76), (0, 0, 0.91), True),
    ("spine_lower", "pelvis", (0, 0, 0.88), (0, 0, 1.06), True),
    ("spine_upper", "spine_lower", (0, 0, 1.04), (0, 0, 1.22), True),
    ("chest", "spine_upper", (0, 0, 1.20), (0, 0, 1.34), True),
    ("neck", "chest", (0, 0, 1.30), (0, 0, 1.40), True),
    ("head", "neck", (0, 0, 1.38), (0, 0, 1.58), True),
    ("clavicle.L", "chest", (0.00, 0, 1.29), (-0.17, 0, 1.29), True),
    ("upper_arm.L", "clavicle.L", (-0.17, 0, 1.28), (-0.255, 0, 1.08), True),
    ("forearm.L", "upper_arm.L", (-0.255, 0, 1.08), (-0.285, 0, 0.86), True),
    ("hand.L", "forearm.L", (-0.285, 0, 0.86), (-0.285, 0, 0.73), True),
    ("clavicle.R", "chest", (0.00, 0, 1.29), (0.17, 0, 1.29), True),
    ("upper_arm.R", "clavicle.R", (0.17, 0, 1.28), (0.255, 0, 1.08), True),
    ("forearm.R", "upper_arm.R", (0.255, 0, 1.08), (0.285, 0, 0.86), True),
    ("hand.R", "forearm.R", (0.285, 0, 0.86), (0.285, 0, 0.73), True),
    ("thigh.L", "pelvis", (-0.095, 0, 0.84), (-0.095, 0, 0.48), True),
    ("shin.L", "thigh.L", (-0.095, 0, 0.48), (-0.095, 0, 0.12), True),
    ("foot.L", "shin.L", (-0.095, 0, 0.12), (-0.095, 0.12, 0.055), True),
    ("thigh.R", "pelvis", (0.095, 0, 0.84), (0.095, 0, 0.48), True),
    ("shin.R", "thigh.R", (0.095, 0, 0.48), (0.095, 0, 0.12), True),
    ("foot.R", "shin.R", (0.095, 0, 0.12), (0.095, 0.12, 0.055), True),
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def point_segment_distance(p: Vector, a: Vector, b: Vector) -> float:
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t)).length


def create_armature() -> bpy.types.Object:
    data = bpy.data.armatures.new("TeenCourier_CleanRig_Armature")
    rig = bpy.data.objects.new("TeenCourier_CleanRig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    made = {}
    for name, parent, head, tail, deform in BONES:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail, bone.use_deform = head, tail, deform
        if parent:
            bone.parent = made[parent]
        made[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig["assetType"] = "teen_courier_clean_rig"
    rig["revision"] = "teen-courier-clean-rig/1"
    return rig


def material_name(mesh, polygon_index):
    poly = mesh.data.polygons[polygon_index]
    slot = mesh.material_slots[poly.material_index]
    return slot.material.name if slot.material else ""


def vertex_materials(mesh):
    result = [set() for _ in mesh.data.vertices]
    for poly in mesh.data.polygons:
        name = mesh.material_slots[poly.material_index].material.name
        for index in poly.vertices:
            result[index].add(name)
    return result


def connected_components(mesh):
    adjacency = [set() for _ in mesh.data.vertices]
    for edge in mesh.data.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)
    remaining = set(range(len(mesh.data.vertices)))
    components = []
    while remaining:
        start = remaining.pop()
        component = {start}
        stack = [start]
        while stack:
            for neighbor in adjacency[stack.pop()]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    stack.append(neighbor)
        components.append(component)
    return adjacency, sorted(components, key=len, reverse=True)


def boundary_seam_pairs(mesh, components, maximum_gap=0.009):
    component_by_vertex = {}
    for component_index, component in enumerate(components):
        for vertex_index in component:
            component_by_vertex[vertex_index] = component_index
    # Several source islands are closed shells despite having a visible gap, so
    # correspondence is based on nearest surface vertices across components.
    tree = KDTree(len(mesh.data.vertices))
    for insertion_index, vertex_index in enumerate(range(len(mesh.data.vertices))):
        tree.insert(mesh.data.vertices[vertex_index].co, vertex_index)
    tree.balance()
    pairs = set()
    for vertex_index in range(len(mesh.data.vertices)):
        position = mesh.data.vertices[vertex_index].co
        for _, other, distance in tree.find_range(position, maximum_gap):
            if other != vertex_index and component_by_vertex[other] != component_by_vertex[vertex_index]:
                pairs.add(tuple(sorted((vertex_index, other))))
    return sorted(pairs)


def make_weights(mesh, rig):
    deform = {name: (Vector(head), Vector(tail)) for name, _, head, tail, enabled in BONES if enabled}
    groups = {name: mesh.vertex_groups.new(name=name) for name in deform}
    materials = vertex_materials(mesh)
    label = json.loads(HEAD_LABEL.read_text())
    if label.get("selectionVersion") != "head-label/2-below-chin-topology":
        raise ValueError("Stale or unsupported protected-head label; explicitly re-author it")
    rigid_head = set(label["vertexIds"])
    adjacency, components = connected_components(mesh)

    weights = []
    for vertex in mesh.data.vertices:
        p = vertex.co.copy()
        if vertex.index in rigid_head:
            weights.append({"head": 1.0})
            continue

        candidates = list(deform)
        if p.z < 0.70:
            candidates = [n for n in candidates if n.startswith(("thigh", "shin", "foot")) or n == "pelvis"]
        elif p.z > 1.34 and abs(p.x) < 0.16:
            candidates = ["neck", "head", "chest"]
        elif abs(p.x) < 0.155:
            candidates = [n for n in ("pelvis", "spine_lower", "spine_upper", "chest", "neck")]
        elif p.z > 0.69:
            side = ".L" if p.x < 0 else ".R"
            candidates = ["chest", "neck", "clavicle" + side, "upper_arm" + side, "forearm" + side, "hand" + side]

        scored = []
        for name in candidates:
            distance = point_segment_distance(p, *deform[name])
            radius = 0.12 if name in {"pelvis", "spine_lower", "spine_upper", "chest"} else 0.085
            score = math.exp(-((distance / radius) ** 2) * 2.2)
            scored.append((score, name))
        scored.sort(reverse=True)
        chosen = scored[:4]
        total = sum(score for score, _ in chosen) or 1.0
        weights.append({name: score / total for score, name in chosen if score / total > 0.003})

    # Relax over actual mesh edges. Rigid head vertices remain exact seeds.
    for _ in range(5):
        relaxed = []
        for i, current in enumerate(weights):
            if i in rigid_head or not adjacency[i]:
                relaxed.append(current)
                continue
            accum = defaultdict(float)
            for name, value in current.items():
                accum[name] += value * 0.62
            scale = 0.38 / len(adjacency[i])
            for neighbor in adjacency[i]:
                for name, value in weights[neighbor].items():
                    accum[name] += value * scale
            best = sorted(accum.items(), key=lambda item: item[1], reverse=True)[:4]
            total = sum(value for _, value in best) or 1.0
            relaxed.append({name: value / total for name, value in best})
        weights = relaxed

    # The source has open island gaps rather than duplicate coordinates. Pair
    # boundary loops within 9 mm and equalize their vectors to stop shirt/skin,
    # shorts/torso, and shoe/leg seams from acquiring divergent transforms.
    seam_pairs = [
        pair for pair in boundary_seam_pairs(mesh, components)
        if (pair[0] in rigid_head) == (pair[1] in rigid_head)
    ]
    seam_graph = defaultdict(set)
    for a, b in seam_pairs:
        seam_graph[a].add(b)
        seam_graph[b].add(a)
    remaining = set(seam_graph)
    seam_clusters = []
    while remaining:
        start = remaining.pop()
        cluster = {start}
        stack = [start]
        while stack:
            for neighbor in seam_graph[stack.pop()]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    cluster.add(neighbor)
                    stack.append(neighbor)
        seam_clusters.append(sorted(cluster))
    synchronized_vertices = set()
    for indices in seam_clusters:
        accum = defaultdict(float)
        for index in indices:
            for name, value in weights[index].items():
                accum[name] += value
        best = sorted(accum.items(), key=lambda item: item[1], reverse=True)[:4]
        total = sum(value for _, value in best) or 1.0
        shared = {name: value / total for name, value in best}
        for index in indices:
            weights[index] = shared.copy()
            synchronized_vertices.add(index)

    for index, assignment in enumerate(weights):
        for name, value in assignment.items():
            groups[name].add([index], value, "REPLACE")
    modifier = mesh.modifiers.new("Clean anatomical deformation", "ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    return weights, rigid_head, seam_pairs, len(synchronized_vertices), [len(c) for c in components]


def author_head_label(mesh):
    """One-time neutral-source labeling aid; the rig builder consumes only IDs."""
    materials = vertex_materials(mesh)
    _, components = connected_components(mesh)
    face_seed = {vertex.index for vertex in mesh.data.vertices if any(g.group == mesh.vertex_groups["Face_Fairing"].index for g in vertex.groups)}
    face_component = next(component for component in components if face_seed & component)
    # The neck cut sits below the complete chin extent recorded by cleanup.
    main_head_skin = {
        index for index in face_component
        if "Teen_Skin" in materials[index]
        and "Teen_Shirt" not in materials[index]
        and mesh.data.vertices[index].co.z >= 1.245
    }
    facial_islands = set()
    for component in components:
        if component is face_component:
            continue
        skin_only = all("Teen_Skin" in materials[index] for index in component)
        if skin_only and min(mesh.data.vertices[index].co.z for index in component) >= 1.245:
            facial_islands.update(component)
    vertex_ids = sorted(face_seed | main_head_skin | facial_islands | {i for i, mats in enumerate(materials) if "Teen_Hair" in mats})
    payload = {
        "label": "Head_Rigid_Protected",
        "selectionVersion": "head-label/2-below-chin-topology",
        "source": str(SOURCE_BLEND.relative_to(ROOT)),
        "selectionBasis": "authored once on neutral source from all hair topology, the Face_Fairing-seeded head component down to a neck cut below the full chin, and disconnected facial/mouth skin islands",
        "neckCutAuthoringAidMeters": 1.245,
        "vertexCount": len(vertex_ids),
        "vertexIds": vertex_ids,
    }
    HEAD_LABEL.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps({"authoredHeadLabel": str(HEAD_LABEL), "vertices": len(vertex_ids)}))


def evaluated_coords(mesh):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(depsgraph)
    return [v.co.copy() for v in evaluated.data.vertices]


def reset_pose(rig):
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0, 0, 0)
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def set_lean_pose(rig):
    reset_pose(rig)
    # Negative Blender X leans the upper body toward character forward (+Y),
    # which exports as the declared glTF -Z forward axis.
    rig.pose.bones["spine_lower"].rotation_euler.x = math.radians(-9)
    rig.pose.bones["spine_upper"].rotation_euler.x = math.radians(-10)
    rig.pose.bones["chest"].rotation_euler.x = math.radians(-8)
    # Preserve the face's forward gaze rather than letting it pitch downward.
    rig.pose.bones["neck"].rotation_euler.x = math.radians(11)
    rig.pose.bones["head"].rotation_euler.x = math.radians(16)
    bpy.context.view_layer.update()


def export_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", export_yup=True,
        export_extras=True, export_skins=True, export_animations=False,
    )


def export_baked_pose_glb(mesh, head_focus, rigid_head, neutral_corner_normals, head_transform, path):
    """Export evaluated pose geometry so the comparison GLB cannot fall to rest."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(depsgraph)
    source_rig = mesh.parent
    original_names = (source_rig.name, mesh.name, head_focus.name)
    source_rig.name = "__SOURCE_CleanRig"
    mesh.name = "__SOURCE_Body"
    head_focus.name = "__SOURCE_HeadFocus"
    baked_data = bpy.data.meshes.new_from_object(
        evaluated, preserve_all_data_layers=True, depsgraph=depsgraph
    )
    baked_data.name = "TeenCourier_UpperBody_BakedMesh"
    # new_from_object can regenerate split normals at material/UV boundaries.
    # Copy evaluated corner normals explicitly so rigid face shading follows the
    # same head transform as its positions.
    raw_evaluated_corner_normals = [corner.vector.copy() for corner in evaluated.data.corner_normals]
    if len(raw_evaluated_corner_normals) != len(baked_data.loops) or len(neutral_corner_normals) != len(baked_data.loops):
        raise ValueError("Evaluated pose changed loop topology; cannot preserve split normals")
    normal_matrix = head_transform.to_3x3().inverted().transposed()
    target_corner_normals = []
    for index, loop in enumerate(baked_data.loops):
        if loop.vertex_index in rigid_head:
            target_corner_normals.append((normal_matrix @ neutral_corner_normals[index]).normalized())
        else:
            target_corner_normals.append(raw_evaluated_corner_normals[index])
    baked_data.normals_split_custom_set(target_corner_normals)
    baked_data.update()
    baked_corner_normals = [corner.vector.copy() for corner in baked_data.corner_normals]
    baked_normal_error = max(
        (source - baked_normal).length
        for source, baked_normal in zip(target_corner_normals, baked_corner_normals)
    )
    protected_baked_normal_error = max(
        (target_corner_normals[index] - baked_corner_normals[index]).length
        for index, loop in enumerate(baked_data.loops)
        if loop.vertex_index in rigid_head
    )
    baked_root = bpy.data.objects.new("TeenCourier_CleanRig", None)
    bpy.context.collection.objects.link(baked_root)
    baked = bpy.data.objects.new("TeenCourier_Body", baked_data)
    bpy.context.collection.objects.link(baked)
    baked.matrix_world = mesh.matrix_world.copy()
    baked.parent = baked_root
    baked_focus = bpy.data.objects.new("HeadFocus", None)
    bpy.context.collection.objects.link(baked_focus)
    baked_focus.matrix_world = head_focus.matrix_world.copy()
    baked_focus.parent = baked_root
    bpy.ops.object.select_all(action="DESELECT")
    baked.select_set(True)
    baked_focus.select_set(True)
    baked_root.select_set(True)
    bpy.context.view_layer.objects.active = baked
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", export_yup=True,
        export_extras=True, export_skins=False, export_animations=False,
        use_selection=True,
    )
    bpy.data.objects.remove(baked_focus, do_unlink=True)
    bpy.data.objects.remove(baked, do_unlink=True)
    bpy.data.objects.remove(baked_root, do_unlink=True)
    bpy.data.meshes.remove(baked_data)
    source_rig.name, mesh.name, head_focus.name = original_names
    return baked_normal_error, protected_baked_normal_error


def glb_stats(path):
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length].decode("utf-8").rstrip("\0 "))
    accessors = document["accessors"]
    vertices = triangles = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            vertices += accessors[primitive["attributes"]["POSITION"]]["count"]
            triangles += accessors[primitive["indices"]]["count"] // 3
    return {"vertices": vertices, "triangles": triangles, "skins": len(document.get("skins", []))}


def edge_lengths(coords, edges, subset):
    result = []
    for edge in edges:
        a, b = edge.vertices
        if a in subset and b in subset:
            result.append((coords[a] - coords[b]).length)
    return result


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    mesh.name = "TeenCourier_Body"
    mesh.data.name = "TeenCourier_BodyMesh"
    source_coords = [vertex.co.copy() for vertex in mesh.data.vertices]
    if "--author-head-label" in sys.argv:
        author_head_label(mesh)
        return
    if not HEAD_LABEL.exists():
        raise FileNotFoundError(f"Missing authored neutral-source label: {HEAD_LABEL}")
    rig = create_armature()
    weights, rigid_head, seam_pairs, synchronized, component_sizes = make_weights(mesh, rig)
    source_materials = vertex_materials(mesh)
    face_fairing_index = mesh.vertex_groups["Face_Fairing"].index
    face_fairing_ids = {
        vertex.index for vertex in mesh.data.vertices
        if any(group.group == face_fairing_index for group in vertex.groups)
    }
    _, source_components = connected_components(mesh)
    mouth_17_ids = next(
        component for component in source_components
        if len(component) == 17 and all("Teen_Skin" in source_materials[index] for index in component)
    )
    protected_shirt_ids = {index for index in rigid_head if "Teen_Shirt" in source_materials[index]}
    protected_shirt_only_ids = {
        index for index in rigid_head
        if "Teen_Shirt" in source_materials[index]
        and "Teen_Skin" not in source_materials[index]
        and "Teen_Hair" not in source_materials[index]
    }
    protected_unseeded_shirt_only_ids = protected_shirt_only_ids - face_fairing_ids
    if not face_fairing_ids <= rigid_head:
        raise ValueError("Protected head label omits Face_Fairing source vertices")
    if not mouth_17_ids <= rigid_head:
        raise ValueError("Protected head label omits the 17-vertex mouth component")
    if protected_unseeded_shirt_only_ids:
        raise ValueError("Protected head label includes shirt-only vertices outside the required Face_Fairing seed")
    protected_group = mesh.vertex_groups.new(name="Head_Rigid_Protected")
    protected_group.add(sorted(rigid_head), 1.0, "REPLACE")
    head_focus = bpy.data.objects.new("HeadFocus", None)
    bpy.context.collection.objects.link(head_focus)
    head_focus.empty_display_type = "SPHERE"
    head_focus.empty_display_size = 0.025
    head_focus.parent = rig
    head_focus.parent_type = "BONE"
    head_focus.parent_bone = "head"
    head_focus.matrix_world = Matrix.Translation((0.0, -0.07, 1.475))
    reset_pose(rig)
    neutral_head_focus = list(head_focus.matrix_world.translation)
    neutral_chest_tail = list(rig.pose.bones["chest"].tail)
    neutral_coords = evaluated_coords(mesh)
    neutral_corner_normals = [corner.vector.copy() for corner in mesh.data.corner_normals]
    neutral_error = max((a - b).length for a, b in zip(source_coords, neutral_coords))

    guide = bpy.data.images.load(str(POSE_GUIDE), check_existing=False)
    guide.name = "INPUT_ONLY_seated_pose_guide_v2"
    guide.pack()
    guide["usage"] = "Input reference only; not generated output or acceptance evidence"

    # Store named pose assets in the editable source without changing its neutral save state.
    action = bpy.data.actions.new("UpperBodyLean_Checkpoint")
    rig.animation_data_create()
    rig.animation_data.action = action
    set_lean_pose(rig)
    for name in ("spine_lower", "spine_upper", "chest", "neck", "head"):
        rig.pose.bones[name].keyframe_insert("rotation_euler", frame=1, group=name)
    action.use_fake_user = True
    rig.animation_data.action = None
    reset_pose(rig)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    export_glb(NEUTRAL_GLB)

    set_lean_pose(rig)
    posed_coords = evaluated_coords(mesh)
    upper_head_focus = list(head_focus.matrix_world.translation)
    upper_chest_tail = list(rig.pose.bones["chest"].tail)
    chest_forward_displacement = upper_chest_tail[1] - neutral_chest_tail[1]
    head_focus_forward_displacement = upper_head_focus[1] - neutral_head_focus[1]
    if chest_forward_displacement <= 0 or head_focus_forward_displacement <= 0:
        raise ValueError("Upper-body checkpoint does not move forward along Blender +Y")
    before_edges = edge_lengths(source_coords, mesh.data.edges, rigid_head)
    after_edges = edge_lengths(posed_coords, mesh.data.edges, rigid_head)
    rigid_edge_error = max(abs(a - b) for a, b in zip(before_edges, after_edges)) if before_edges else 0.0
    head_transform = rig.pose.bones["head"].matrix @ rig.data.bones["head"].matrix_local.inverted()
    rigid_transform_error = max(
        (posed_coords[index] - (head_transform @ source_coords[index])).length
        for index in rigid_head
    )
    seam_gap_increase = max(
        ((posed_coords[a] - posed_coords[b]).length - (source_coords[a] - source_coords[b]).length)
        for a, b in seam_pairs
    ) if seam_pairs else 0.0
    baked_corner_normal_error, protected_baked_corner_normal_error = export_baked_pose_glb(
        mesh, head_focus, rigid_head, neutral_corner_normals, head_transform, LEAN_GLB
    )
    if protected_baked_corner_normal_error > 0.0004:
        raise ValueError("Baked protected-head split normals exceed preservation tolerance")
    reset_pose(rig)

    seam_weight_error = 0.0
    for a, b in seam_pairs:
        names = set(weights[a]) | set(weights[b])
        seam_weight_error = max(seam_weight_error, *(abs(weights[a].get(n, 0) - weights[b].get(n, 0)) for n in names))

    packed_positions = b"".join(struct.pack("<3f", *vertex.co) for vertex in mesh.data.vertices)
    packed_indices = b"".join(struct.pack("<3I", *polygon.vertices) for polygon in mesh.data.polygons)
    protected_ids = sorted(rigid_head)
    protected_id_bytes = b"".join(struct.pack("<I", index) for index in protected_ids)

    manifest = {
        "asset": "teen_courier_clean_rig",
        "revision": "teen-courier-clean-rig/1",
        "status": "upper-body-deformation-checkpoint",
        "source": str(SOURCE_BLEND.relative_to(ROOT)),
        "provenance": {
            "approvedStaticGlb": str(SOURCE_GLB.relative_to(ROOT)),
            "sourceBlendSha256": sha(SOURCE_BLEND),
            "sourceGlbSha256": sha(SOURCE_GLB),
            "poseGuide": str(POSE_GUIDE.relative_to(ROOT)),
            "poseGuideSha256": sha(POSE_GUIDE),
            "poseGuideUsage": "input-only",
        },
        "contract": {"units": "meters", "upAxis": "+Y", "forwardAxis": "-Z", "origin": "ground contact", "heightMeters": 1.62, "blenderAuthoringAxes": {"up": "+Z", "forward": "+Y", "riderRight": "+X"}},
        "outputs": {
            "editableBlend": str(BLEND.relative_to(ROOT)),
            "neutral": NEUTRAL_GLB.name,
            "upperBody": LEAN_GLB.name,
        },
        "rig": {
            "provider": "project-authored",
            "boneCount": len(BONES),
            "bones": [b[0] for b in BONES],
            "restBones": {name: {"head": list(head), "tail": list(tail), "parent": parent} for name, parent, head, tail, _ in BONES},
            "oldProviderArmatureUsed": False,
        },
        "weighting": {
            "method": "anatomical segment distance fields, five mesh-adjacency relaxation passes, cross-component proximity seam synchronization",
            "maxInfluences": 4,
            "rigidHeadVertexCount": len(rigid_head),
            "rigidHeadVertexIds": protected_ids,
            "rigidHeadVertexIdsSha256": hashlib.sha256(protected_id_bytes).hexdigest(),
            "headSelection": "authored neutral-source topology label loaded from head_protected_vertex_ids.json; the build performs no posed-space or height-box selection",
            "headLabel": str(HEAD_LABEL.relative_to(ROOT)),
            "sourceConnectedComponentSizes": component_sizes,
            "boundarySeamPairCount": len(seam_pairs),
            "synchronizedSeamVertexCount": synchronized,
            "positionBoxOverwriteHeuristics": False,
        },
        "pose": {
            "neutral": "rest pose; source vertex positions unchanged",
            "upperBody": "baked static mesh of a 27 degree distributed forward lean; neck/head counter-rotate to retain forward gaze",
            "hands": "neutral; no grip fitting",
            "legs": "neutral; no saddle or pedal fitting",
            "excluded": ["bicycle contact fitting", "IK contact chasing", "full seated pose", "animation", "backpack"],
            "upperBodyArtifactRepresentation": "evaluated static mesh with no skin; editable rig and named pose remain in the Blender source",
            "headFocus": {"node": "HeadFocus", "neutralWorld": neutral_head_focus, "upperBodyWorld": upper_head_focus},
        },
        "validation": {
            "neutralMaxVertexErrorMeters": neutral_error,
            "rigidHeadMaxEdgeLengthErrorMeters": rigid_edge_error,
            "rigidHeadMaxSingleTransformResidualMeters": rigid_transform_error,
            "pairedBoundarySeamMaxWeightError": seam_weight_error,
            "posedBoundarySeamMaxGapIncreaseMeters": seam_gap_increase,
            "allWeightSumsNormalized": all(abs(sum(w.values()) - 1.0) < 1e-6 for w in weights),
            "faceFairingSeedFullyProtected": face_fairing_ids <= rigid_head,
            "mouth17ComponentFullyProtected": mouth_17_ids <= rigid_head,
            "protectedShirtVertexCount": len(protected_shirt_ids),
            "protectedShirtOnlyVertexCount": len(protected_shirt_only_ids),
            "protectedUnseededShirtOnlyVertexCount": len(protected_unseeded_shirt_only_ids),
            "leftBonesUseNegativeX": all(head[0] <= 0 and tail[0] < 0 for name, _, head, tail, _ in BONES if name.endswith(".L")),
            "rightBonesUsePositiveX": all(head[0] >= 0 and tail[0] > 0 for name, _, head, tail, _ in BONES if name.endswith(".R")),
            "feetPointBlenderForwardPositiveY": all(tail[1] > head[1] for name, _, head, tail, _ in BONES if name.startswith("foot.")),
            "upperBodyChestForwardDisplacementBlenderYMeters": chest_forward_displacement,
            "headFocusForwardDisplacementBlenderYMeters": head_focus_forward_displacement,
            "upperBodyMovesTowardDeclaredGltfNegativeZ": chest_forward_displacement > 0 and head_focus_forward_displacement > 0,
            "evaluatedToBakedMaxCornerNormalError": baked_corner_normal_error,
            "protectedHeadTargetToBakedMaxCornerNormalError": protected_baked_corner_normal_error,
            "sourceNeutralToBakedProtectedMaxCornerNormalError": protected_baked_corner_normal_error,
            "humanAppearanceReviewRequired": True,
        },
        "geometry": {"blenderVertices": len(mesh.data.vertices), "neutralGlb": glb_stats(NEUTRAL_GLB), "upperBodyGlb": glb_stats(LEAN_GLB)},
        "neutralSourceMeshHashes": {
            "blenderPositionFloat32Sha256": hashlib.sha256(packed_positions).hexdigest(),
            "blenderTriangleIndexUint32Sha256": hashlib.sha256(packed_indices).hexdigest(),
            "materialSlotNamesSha256": hashlib.sha256("\n".join(slot.material.name for slot in mesh.material_slots).encode()).hexdigest(),
        },
        "hashes": {"blendSha256": sha(BLEND), "neutralGlbSha256": sha(NEUTRAL_GLB), "upperBodyGlbSha256": sha(LEAN_GLB)},
        "notes": ["This is a torso, shoulder, neck, and head checkpoint only.", "No visual acceptance claim is made; appearance remains a human review gate."],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest["validation"], indent=2))


if __name__ == "__main__":
    main()
