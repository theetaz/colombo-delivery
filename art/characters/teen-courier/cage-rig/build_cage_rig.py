"""Reproduce a rejected, isolated regular-cage deformation experiment."""

from pathlib import Path
import hashlib, importlib.util, json, math, struct
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / "art/characters/teen-courier/teen_courier_cleanup.blend"
LABEL = ROOT / "art/characters/teen-courier/clean-rig/head_protected_vertex_ids.json"
OUT = ROOT / "art/characters/teen-courier/cage-rig"
BLEND = OUT / "teen_courier_cage_rig.blend"
GLB = OUT / "teen_courier_cage_rig_upper_body.glb"
MANIFEST = OUT / "teen_courier_cage_rig.manifest.json"

spec = importlib.util.spec_from_file_location("clean_rig_helpers", ROOT / "art/characters/teen-courier/clean-rig/rejected_harmonic_v2.py")
helpers = importlib.util.module_from_spec(spec); spec.loader.exec_module(helpers)


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def create_cage():
    rings, sides = 12, 16
    vertices, faces = [], []
    for ring in range(rings):
        t = ring / (rings - 1)
        z = 0.68 + 0.74 * t
        width = 0.29 - 0.12 * max(0.0, (t - 0.78) / 0.22)
        depth = 0.18 - 0.065 * max(0.0, (t - 0.78) / 0.22)
        for side in range(sides):
            angle = 2 * math.pi * side / sides
            vertices.append((width * math.cos(angle), depth * math.sin(angle), z))
    for ring in range(rings - 1):
        for side in range(sides):
            a = ring * sides + side; b = ring * sides + (side + 1) % sides
            c = (ring + 1) * sides + (side + 1) % sides; d = (ring + 1) * sides + side
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((rings - 1) * sides + i for i in range(sides)))
    data = bpy.data.meshes.new("TeenCourier_DeformationCageMesh")
    data.from_pydata(vertices, [], faces); data.update()
    cage = bpy.data.objects.new("TeenCourier_DeformationCage", data)
    bpy.context.collection.objects.link(cage)
    cage.display_type = "WIRE"; cage.hide_render = True
    return cage, rings, sides


def assign_cage_weights(cage, rings, sides):
    names = ("pelvis", "spine_lower", "spine_upper", "chest", "neck", "head")
    groups = {name: cage.vertex_groups.new(name=name) for name in names}
    stops = [0.0, .18, .40, .65, .83, 1.0]
    for ring in range(rings):
        t = ring / (rings - 1)
        upper = next((i for i, stop in enumerate(stops) if stop >= t), len(stops)-1)
        lower = max(0, upper-1)
        span = max(stops[upper]-stops[lower], 1e-6)
        blend = (t-stops[lower])/span if upper != lower else 0
        ids = list(range(ring*sides, (ring+1)*sides))
        groups[names[lower]].add(ids, 1-blend, "REPLACE")
        if upper != lower: groups[names[upper]].add(ids, blend, "REPLACE")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    mesh.name = "TeenCourier_Body"; mesh.data.name = "TeenCourier_BodyMesh"
    source = [v.co.copy() for v in mesh.data.vertices]
    neutral_normals = [n.vector.copy() for n in mesh.data.corner_normals]
    rigid_head = set(json.loads(LABEL.read_text())["vertexIds"])
    adjacency, components = helpers.connected_components(mesh)
    main_component = next(c for c in components if len(c) == 6133)
    rig = helpers.create_armature(); rig["prototype"] = "regular-closed-mesh-deform-cage/1"

    # Detailed mesh armature weights: rigid head plus component-bounded limbs.
    deform = {name:(Vector(h),Vector(t)) for name,_,h,t,d in helpers.BONES if d}
    groups = {name: mesh.vertex_groups.new(name=name) for name in deform}
    groups["head"].add(sorted(rigid_head), 1.0, "REPLACE")
    for component in components:
        center = sum((mesh.data.vertices[i].co for i in component), Vector()) / len(component)
        if component <= rigid_head:
            for i in component: groups["head"].add([i],1,"REPLACE")
        elif len(component) in {513,509}:
            side = ".R" if center.x > 0 else ".L"
            chain = ["clavicle"+side,"upper_arm"+side,"forearm"+side,"hand"+side]
            for i in component:
                scores=[(math.exp(-((helpers.point_segment_distance(mesh.data.vertices[i].co,*deform[n])/.085)**2)*2),n) for n in chain]
                total=sum(s for s,_ in scores)
                for score,name in scores: groups[name].add([i],score/total,"REPLACE")
        elif len(component)==363:
            for i in component: groups["pelvis"].add([i],1,"REPLACE")
        elif len(component)==202:
            name="thigh.R" if center.x>0 else "thigh.L"
            for i in component: groups[name].add([i],1,"REPLACE")
        elif len(component) in {434,430,45,31,29,28,15}:
            name="foot.R" if center.x>0 else "foot.L"
            for i in component: groups[name].add([i],1,"REPLACE")
    cage_group = mesh.vertex_groups.new(name="Cage_Deform")
    cage_ids = sorted(main_component - rigid_head)
    cage_group.add(cage_ids, 1.0, "REPLACE")

    cage, rings, sides = create_cage(); assign_cage_weights(cage,rings,sides)
    cage_arm = cage.modifiers.new("CageArmature","ARMATURE"); cage_arm.object=rig
    cage.parent=rig
    cage_mod = mesh.modifiers.new("RegularTorsoCage","MESH_DEFORM"); cage_mod.object=cage; cage_mod.vertex_group=cage_group.name; cage_mod.precision=5
    arm_mod = mesh.modifiers.new("ComponentArmature","ARMATURE"); arm_mod.object=rig
    mesh.parent=rig
    bpy.context.view_layer.objects.active=mesh; mesh.select_set(True)
    bpy.ops.object.meshdeform_bind(modifier=cage_mod.name)
    if not cage_mod.is_bound: raise RuntimeError("MeshDeform cage failed to bind")

    helpers.reset_pose(rig)
    neutral=helpers.evaluated_coords(mesh)
    neutral_error=max((a-b).length for a,b in zip(source,neutral))
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    helpers.set_lean_pose(rig)
    posed=helpers.evaluated_coords(mesh)
    head_transform=rig.pose.bones["head"].matrix @ rig.data.bones["head"].matrix_local.inverted()
    head_error=max((posed[i]-(head_transform@source[i])).length for i in rigid_head)
    strain=helpers.triangle_edge_strain(mesh,source,posed)
    arms=set().union(*(c for c in components if len(c) in {513,509}))
    arm_strain=helpers.triangle_edge_strain(mesh,source,posed,arms)
    focus=bpy.data.objects.new("HeadFocus",None); bpy.context.collection.objects.link(focus); focus.location=(0,.075,1.45)
    normal_error,protected_normal_error=helpers.export_baked_pose_glb(mesh,focus,rigid_head,neutral_normals,head_transform,GLB)
    helpers.reset_pose(rig)
    manifest={
      "asset":"teen_courier_cage_rig_upper_body.glb","status":"isolated-cage-deformation-prototype","reviewStatus":"engineering-rejected",
      "source":"art/characters/teen-courier/teen_courier_cleanup.blend","sourceSha256":sha(SOURCE),
      "method":"closed 12x16 regular torso/neck cage bound with Blender MeshDeform; protected head excluded; component-bounded armature for head and limbs",
      "scope":{"staticUpperBodyOnly":True,"gameAnimationSupport":False,"sourceGeometryEdited":False},
      "validation":{"neutralMaxVertexErrorMeters":neutral_error,"rigidHeadTransformResidualMeters":head_error,"triangleEdgeStrain":strain,"armTriangleEdgeStrain":arm_strain,"protectedNormalResidual":protected_normal_error},
      "hashes":{"blendSha256":sha(BLEND),"glbSha256":sha(GLB)},
    }
    MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps(manifest["validation"],indent=2))

if __name__=="__main__": main()
