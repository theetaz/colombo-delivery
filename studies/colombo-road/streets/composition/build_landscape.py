"""Build the Colombo street landscape and civic prop kit.

Run with:
  Blender --background --python build_landscape.py

The authored Blender scene is Z-up. Blender's glTF exporter converts it to the
runtime convention: +Y up and +Z forward. Every named prefab root is at its
ground centre so instances can be placed directly on pavements or terrain.
"""

import bpy
import json
import math
import random
import struct
from pathlib import Path
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BLEND_PATH = HERE / "landscape.blend"
EXPORT_DIR = ROOT / "studies/colombo-road/viewer/public/streets/composition"
GLB_PATH = EXPORT_DIR / "landscape.glb"
MANIFEST_PATH = EXPORT_DIR / "landscape.manifest.json"
TEXTURE_PATH = EXPORT_DIR / "landscape/leaf_atlas.png"

random.seed(7391)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, color, roughness=0.75, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def make_leaf_texture():
    TEXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    size = 512
    img = bpy.data.images.new("LeafAtlas_Original", width=size, height=size, alpha=True)
    pixels = [0.0] * (size * size * 4)
    rng = random.Random(288)
    leaves = [
        # centre u/v, half-width, half-height, rotation, colour bias
        (.46,.82,.065,.135,-.20,.025), (.58,.83,.066,.140,.22,.04),
        (.31,.73,.065,.130,-.48,-.01), (.70,.72,.068,.140,.48,.035),
        (.20,.61,.060,.122,-.65,-.025), (.80,.60,.062,.128,.64,.02),
        (.38,.62,.064,.134,-.28,.00), (.61,.61,.067,.140,.30,.035),
        (.28,.49,.060,.124,-.52,-.02), (.72,.47,.062,.128,.55,.025),
        (.43,.45,.061,.130,-.18,.01), (.58,.43,.063,.132,.20,.03),
        (.34,.32,.056,.118,-.38,-.025), (.65,.31,.058,.122,.40,.015),
        (.45,.24,.052,.108,-.15,-.01), (.57,.23,.054,.112,.17,.02),
        (.50,.14,.048,.098,.02,-.03),
    ]
    twigs = [((.50,.04),(.50,.43)),((.50,.32),(.31,.67)),((.50,.38),(.70,.66)),
             ((.49,.48),(.20,.58)),((.51,.50),(.80,.57)),((.48,.57),(.46,.80)),
             ((.52,.58),(.58,.81)),((.49,.38),(.34,.30)),((.51,.37),(.65,.29))]
    for y in range(size):
        v = (y + 0.5) / size
        for x in range(size):
            u = (x + 0.5) / size
            # Seven overlapping pointed leaves form one airy spray. This keeps
            # cards efficient while avoiding billboard-shaped canopy blobs.
            alpha = 0.0; shade = 0.0; vein = 0.0
            for (ax,ay),(bx,by) in twigs:
                vx,vy=bx-ax,by-ay; wx,wy=u-ax,v-ay
                t=max(0.0,min(1.0,(wx*vx+wy*vy)/(vx*vx+vy*vy)))
                if math.hypot(u-(ax+t*vx),v-(ay+t*vy)) < .008:
                    alpha=1.0; shade=-.09
            for cu,cv,hw,hh,rot,bias in leaves:
                dx,dy=u-cu,v-cv
                cr,sr=math.cos(rot),math.sin(rot)
                lx=(dx*cr+dy*sr)/hw; ly=(-dx*sr+dy*cr)/hh
                leaf_width=max(0.0,1.0-abs(ly)**1.35)
                if abs(lx) < leaf_width:
                    alpha=1.0
                    vein=max(vein,max(0.0,1.0-abs(lx)*18.0))
                    shade=bias
            i = (y * size + x) * 4
            if alpha:
                noise = (rng.random() - 0.5) * 0.06
                r = 0.09 + 0.07 * (1.0 - v) + 0.04 * vein + noise + shade
                g = 0.26 + 0.18 * v + 0.07 * vein + noise + shade
                b = 0.055 + 0.045 * v + noise * 0.3
                pixels[i:i+4] = [max(0, r), max(0, g), max(0, b), 1.0]
            else:
                pixels[i:i+4] = [0.0, 0.0, 0.0, 0.0]
    img.pixels = pixels
    img.filepath_raw = str(TEXTURE_PATH)
    img.file_format = "PNG"
    img.save()
    return img


def leaf_material(name, image, tint=(0.85, 1.0, 0.78, 1.0)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Linear"
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.82
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.08
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    if hasattr(mat, "blend_method"):
        mat.blend_method = "CLIP"
        mat.alpha_threshold = 0.45
        mat.show_transparent_back = True
    mat.use_backface_culling = False
    return mat


def root(name, category):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj["prefab"] = True
    obj["category"] = category
    bpy.context.collection.objects.link(obj)
    return obj


def parent(obj, root_obj):
    obj.parent = root_obj
    return obj


def cube(name, location, scale, mat, root_obj, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft_Edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    obj.data.materials.append(mat)
    return parent(obj, root_obj)


def cylinder(name, location, radius, depth, mat, root_obj, vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return parent(obj, root_obj)


def sphere(name, location, scale, mat, root_obj, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return parent(obj, root_obj)


def tapered_branch(name, a, b, r0, r1, mat, root_obj, vertices=8):
    a, b = Vector(a), Vector(b)
    d = b - a
    mid = (a + b) * 0.5
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r0, radius2=r1,
                                    depth=d.length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    obj.data.materials.append(mat)
    return parent(obj, root_obj)


def add_leaf_cards(name, clusters, mat, root_obj, seed, cards_per_cluster=12):
    rng = random.Random(seed)
    verts, faces, uvs = [], [], []
    for ci, (centre, radius) in enumerate(clusters):
        centre = Vector(centre)
        for j in range(cards_per_cluster):
            az = rng.uniform(0, math.tau)
            el = rng.uniform(-0.36, 0.50)
            rr = radius * (rng.random() ** 0.55) * 0.62
            c = centre + Vector((math.cos(az) * rr, math.sin(az) * rr,
                                 math.sin(el) * radius * 0.48))
            w = rng.uniform(0.68, 1.08) * radius * 0.45
            h = rng.uniform(0.75, 1.15) * radius * 0.54
            # Near-vertical leaf cards with randomized azimuth. Crossed layers
            # produce a porous crown and retain silhouette from driving views.
            normal = Vector((math.cos(az), math.sin(az), rng.uniform(-0.12, 0.25))).normalized()
            right = Vector((-normal.y, normal.x, 0)).normalized() * w
            up = normal.cross(right).normalized() * h
            base = len(verts)
            verts.extend([c-right-up, c+right-up, c+right+up, c-right+up])
            faces.append((base, base+1, base+2, base+3))
            uvs.extend([(0,0), (1,0), (1,1), (0,1)])
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop_idx in poly.loop_indices:
            uv_layer.data[loop_idx].uv = uvs[mesh.loops[loop_idx].vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return parent(obj, root_obj)


def build_tree(name, spec, bark, leaf_mat):
    r = root(name, "vegetation")
    # A flared base keeps large trees anchored in pavement tree pits.
    trunk_top = (spec["lean"][0], spec["lean"][1], spec["trunk_h"])
    tapered_branch(name+"_Trunk", (0,0,0), trunk_top, spec["trunk_r"]*1.28,
                   spec["trunk_r"]*0.70, bark, r, 12)
    for k, ang in enumerate((0.15, 2.1, 4.05)):
        a = Vector((math.cos(ang), math.sin(ang), 0)) * spec["trunk_r"] * 0.4
        b = Vector((math.cos(ang), math.sin(ang), 0)) * spec["trunk_r"] * 1.9
        tapered_branch(name+f"_Buttress_{k}", a, b, spec["trunk_r"]*.34, .035, bark, r, 7)
    clusters = []
    for i, branch in enumerate(spec["branches"]):
        start = Vector(trunk_top) + Vector(branch[0])
        elbow = start + Vector(branch[1])
        tip = elbow + Vector(branch[2])
        tapered_branch(name+f"_Primary_{i}", start, elbow, spec["trunk_r"]*.45,
                       spec["trunk_r"]*.19, bark, r, 9)
        tapered_branch(name+f"_Secondary_{i}", elbow, tip, spec["trunk_r"]*.20,
                       .055, bark, r, 7)
        # Fork at each tip; branch architecture remains legible below the crown.
        fork = tip + Vector((branch[2][1]*.34, -branch[2][0]*.34, .55))
        tapered_branch(name+f"_Twig_{i}", tip-Vector(branch[2])*.18, fork,
                       .075, .028, bark, r, 6)
        clusters.extend([(tip, branch[3]), (fork, branch[3]*.72),
                         (elbow + Vector(branch[2])*.42, branch[3]*.82)])
    add_leaf_cards(name+"_LeafCards", clusters, leaf_mat, r, spec["seed"], spec.get("cards", 11))
    return r


def build_palm(bark, leaf_mat):
    r = root("Palm_Modest_A", "vegetation")
    points = [(0,0,0), (.10,0,2.8), (-.12,.08,5.8), (.18,.12,8.0)]
    for i in range(3):
        tapered_branch(f"Palm_Trunk_{i}", points[i], points[i+1], .30-i*.035,
                       .255-i*.035, bark, r, 11)
    # Each frond uses a rib and a chain of leaflets, producing an open crown.
    verts, faces = [], []
    crown = Vector(points[-1])
    for fi in range(12):
        az = fi / 12 * math.tau + (fi%2)*.09
        reach = 2.25 + .35*math.sin(fi*1.7)
        end = crown + Vector((math.cos(az)*reach, math.sin(az)*reach, .45-.16*reach))
        tapered_branch(f"Palm_Rib_{fi}", crown, end, .045, .018, bark, r, 5)
        radial = Vector((math.cos(az), math.sin(az), 0))
        side = Vector((-math.sin(az), math.cos(az), 0))
        for j in range(1,8):
            t = j/8
            c = crown.lerp(end, t)
            length = .46*(1-abs(t-.55)*.8)
            for sign in (-1,1):
                base=len(verts)
                tip = c + side*length*sign + radial*.12
                w=.07
                verts += [c-side*w, c+side*w, tip+side*w*.25, tip-side*w*.25]
                faces.append((base,base+1,base+2,base+3))
    mesh=bpy.data.meshes.new("Palm_Fronds_Mesh"); mesh.from_pydata(verts,[],faces); mesh.materials.append(leaf_mat)
    obj=bpy.data.objects.new("Palm_Fronds",mesh); bpy.context.collection.objects.link(obj); parent(obj,r)
    return r


def build_props(m):
    roots=[]
    # Lamp: restrained curved outreach, common civic scale.
    r=root("StreetLamp_Civic","lighting"); roots.append(r)
    cylinder("Lamp_Pole",(0,0,2.55),.075,5.1,m["metal"],r,10)
    tapered_branch("Lamp_Arm",(0,0,4.75),(0,-.58,5.20),.065,.045,m["metal"],r,8)
    cube("Lamp_Head",(0,-.70,5.18),(.34,.54,.13),m["metal"],r,.04)
    cube("Lamp_Lens",(0,-.70,5.105),(.27,.40,.025),m["glass"],r,.01)

    r=root("Railing_Promenade_2m","barrier"); roots.append(r)
    for x in (-.95,.95):
        cylinder("Railing_Post",(x,0,.55),.06,1.1,m["metal"],r,8)
        sphere("Railing_Cap",(x,0,1.12),(.085,.085,.085),m["metal"],r,8,5)
    for z in (.35,.78,1.05): cube("Railing_Rail",(0,0,z),(2.0,.075,.065),m["metal"],r,.02)

    r=root("Bench_TimberConcrete","furniture"); roots.append(r)
    for x in (-.68,.68): cube("Bench_Leg",(x,0,.28),(.24,.54,.56),m["concrete"],r,.045)
    for y in (-.24,-.08,.08,.24): cube("Bench_Slat",(0,y,.61),(1.82,.12,.09),m["wood"],r,.025)
    for z in (.82,1.04): cube("Bench_Back",(0,.30,z),(1.82,.09,.15),m["wood"],r,.025)
    for x in (-.78,.78): tapered_branch("Bench_BackSupport",(x,.27,.54),(x,.31,1.12),.032,.032,m["metal"],r,6)

    r=root("Planter_Shrub","vegetation"); roots.append(r)
    cube("Planter_Box",(0,0,.28),(1.2,.72,.56),m["concrete"],r,.06)
    cube("Planter_Soil",(0,0,.58),(1.02,.54,.05),m["soil"],r,.01)
    for i,(x,y,z,s) in enumerate([(-.33,-.08,.77,.32),(0,.10,.86,.38),(.34,-.07,.78,.31),(-.1,-.13,1.02,.25)]):
        sphere(f"Shrub_{i}",(x,y,z),(s,s*.75,s*.70),m["shrub"],r,10,6)

    r=root("DrainGrate","infrastructure"); roots.append(r)
    cube("Drain_Frame",(0,0,.025),(.84,.44,.05),m["metal"],r,.015)
    for x in [-.32,-.21,-.10,.01,.12,.23,.34]: cube("Drain_Slot",(x,0,.055),(.055,.34,.018),m["dark"],r,.008)

    r=root("Bollard_Civic","barrier"); roots.append(r)
    cylinder("Bollard",(0,0,.43),.105,.86,m["metal"],r,10)
    cylinder("Bollard_Band",(0,0,.67),.112,.10,m["pale"],r,10)
    sphere("Bollard_Cap",(0,0,.89),(.105,.105,.07),m["metal"],r,10,5)

    r=root("UtilityPole","infrastructure"); roots.append(r)
    cylinder("Utility_Pole",(0,0,3.85),.15,7.7,m["utility"],r,10)
    cube("Utility_Crossbar",(0,0,6.75),(1.2,.12,.12),m["utility"],r,.025)
    for x in (-.48,0,.48):
        cylinder("Utility_Insulator",(x,0,6.91),.055,.23,m["ceramic"],r,8)
    cube("Utility_Box",(0,-.16,3.0),(.34,.18,.52),m["metal"],r,.025)

    r=root("GardenWall_Gate","architecture"); roots.append(r)
    cube("Garden_Wall_L",(-1.85,0,.80),(1.3,.24,1.6),m["wall"],r,.035)
    cube("Garden_Wall_R",(1.85,0,.80),(1.3,.24,1.6),m["wall"],r,.035)
    for x in (-1.15,1.15): cube("Garden_Pier",(x,0,1.0),(.34,.36,2.0),m["wall"],r,.04)
    for x in [-.9,-.6,-.3,0,.3,.6,.9]: cube("Gate_Picket",(x,0,1.02),(.055,.08,1.68),m["gate"],r,.012)
    for z in (.35,1.58): cube("Gate_Rail",(0,0,z),(2.05,.09,.07),m["gate"],r,.012)
    return roots


def mesh_triangles(root_obj):
    total=0
    for obj in [root_obj]+list(root_obj.children_recursive):
        if obj.type=="MESH":
            total += sum(max(0,len(p.vertices)-2) for p in obj.data.polygons)
    return total


def gltf_bounds(root_obj):
    points=[]
    for obj in [root_obj]+list(root_obj.children_recursive):
        if obj.type=="MESH":
            points += [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    # glTF transform used by Blender exporter: (x, z, -y)
    conv=[Vector((p.x,p.z,-p.y)) for p in points]
    mn=[min(p[i] for p in conv) for i in range(3)]
    mx=[max(p[i] for p in conv) for i in range(3)]
    return {"min":[round(v,3) for v in mn],"max":[round(v,3) for v in mx]}, [round(mx[i]-mn[i],3) for i in range(3)]


def snap_prefab_to_ground(root_obj):
    points=[]
    for obj in list(root_obj.children_recursive):
        if obj.type=="MESH": points.extend(obj.matrix_world @ Vector(c) for c in obj.bound_box)
    if not points: return
    dz=-min(p.z for p in points)
    if abs(dz) > 1e-5:
        for child in root_obj.children: child.location.z += dz


def merge_prefab_by_material(root_obj):
    """Collapse a prefab to one mesh per material without changing its shape."""
    meshes=[o for o in list(root_obj.children_recursive) if o.type=="MESH"]
    # Realize bevel modifiers before joining so every authored edge is retained.
    for obj in meshes:
        bpy.context.view_layer.objects.active=obj
        obj.select_set(True)
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(False)
    groups={}
    for obj in meshes:
        mat=obj.data.materials[0] if obj.data.materials else None
        groups.setdefault(mat,[]).append(obj)
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects: obj.select_set(True)
        active=objects[0]
        if len(objects) > 1:
            bpy.context.view_layer.objects.active=active
            bpy.ops.object.join()
        active.name=f"{root_obj.name}_{mat.name if mat else 'Unmaterialed'}"
        active.parent=root_obj
        # Joined identical slots are redundant; one slot yields one glTF primitive.
        for poly in active.data.polygons: poly.material_index=0
        active.data.materials.clear()
        if mat: active.data.materials.append(mat)
        active.select_set(False)


def force_mask_materials(glb_path):
    """Blender 5 exports dithered materials as BLEND; foliage requires MASK."""
    raw=glb_path.read_bytes()
    magic,version,total=struct.unpack_from("<4sII",raw,0)
    offset=12; chunks=[]
    while offset < len(raw):
        length,kind=struct.unpack_from("<II",raw,offset); offset+=8
        chunks.append([kind,raw[offset:offset+length]]); offset+=length
    doc=json.loads(chunks[0][1].rstrip(b" \0"))
    for mat in doc.get("materials",[]):
        if mat.get("name") in {"Broadleaf_Cutout","PalmLeaf_Cutout"}:
            mat["alphaMode"]="MASK"; mat["alphaCutoff"]=0.45; mat["doubleSided"]=True
    encoded=json.dumps(doc,separators=(",",":")).encode()
    encoded += b" "*((4-len(encoded)%4)%4)
    chunks[0][1]=encoded
    body=b"".join(struct.pack("<II",len(data),kind)+data for kind,data in chunks)
    glb_path.write_bytes(struct.pack("<4sII",magic,version,12+len(body))+body)


def main():
    clear_scene()
    image=make_leaf_texture()
    mats={
        "bark":material("Bark_Mottled",(.25,.16,.09),.92),
        "leaf":leaf_material("Broadleaf_Cutout",image),
        "palm":material("PalmFrond_Green",(.075,.29,.105),.86),
        "metal":material("PaintedMetal_Dark",(.075,.095,.09),.58,.25),
        "glass":material("LampLens_Warm",(.72,.54,.28),.28,.05),
        "concrete":material("Concrete_Warm",(.46,.43,.37),.92),
        "wood":material("Timber_Slats",(.34,.17,.075),.78),
        "soil":material("Planter_Soil",(.09,.055,.027),1.0),
        "shrub":material("Shrub_DeepGreen",(.08,.25,.075),.9),
        "dark":material("DrainVoid",(.018,.022,.02),.8,.2),
        "pale":material("ReflectiveBand",(.73,.69,.52),.42),
        "utility":material("WeatheredUtility",(.20,.18,.15),.96),
        "ceramic":material("CeramicInsulator",(.40,.25,.14),.36),
        "wall":material("GardenWall_Warm",(.53,.47,.37),.95),
        "gate":material("Gate_MutedTeal",(.07,.22,.21),.63,.18),
    }
    specs=[
      ("Tree_Broadleaf_A",{"trunk_h":4.5,"trunk_r":.45,"lean":(.18,-.08),"seed":11,"cards":16,"branches":[
       ((0,0,-.25),(-2.1,.2,1.5),(-1.7,.6,2.4),1.9),((0,0,0),(.7,-2.0,1.7),(1.2,-1.5,2.0),1.8),
       ((0,0,.2),(2.1,.6,1.2),(1.8,.9,2.1),2.0),((0,0,.5),(-.4,1.9,1.3),(-.8,1.7,2.1),1.75),
       ((0,0,.7),(.3,.2,2.2),(1.3,-.2,2.0),1.8)]}),
      ("Tree_Broadleaf_B",{"trunk_h":5.0,"trunk_r":.50,"lean":(-.22,.12),"seed":23,"cards":16,"branches":[
       ((0,0,-.5),(-2.4,-.5,1.4),(-1.9,-.3,2.3),2.1),((0,0,-.2),(1.7,-1.5,1.4),(2.2,-.7,2.2),2.0),
       ((0,0,.1),(2.1,1.2,1.7),(1.5,1.4,2.3),1.9),((0,0,.5),(-1.1,1.8,1.6),(-1.3,1.5,2.3),2.0),
       ((0,0,.6),(.2,-.1,2.0),(-.6,.8,2.4),1.8)]}),
      ("Tree_Broadleaf_C",{"trunk_h":3.9,"trunk_r":.37,"lean":(.08,.15),"seed":37,"cards":15,"branches":[
       ((0,0,-.1),(-1.6,-.5,1.3),(-1.3,-.5,1.8),1.55),((0,0,.1),(1.4,-1.0,1.4),(1.2,-.8,1.9),1.5),
       ((0,0,.3),(1.2,1.1,1.4),(1.0,1.1,1.8),1.55),((0,0,.6),(-1.0,1.2,1.5),(-.8,1.0,1.8),1.45)]})]
    roots=[]
    for name,spec in specs: roots.append(build_tree(name,spec,mats["bark"],mats["leaf"]))
    roots.append(build_palm(mats["bark"],mats["palm"]))
    roots.extend(build_props(mats))

    for obj in roots:
        merge_prefab_by_material(obj)
        snap_prefab_to_ground(obj)

    # Store authoring metadata and keep all prefabs co-located for clean export.
    for obj in roots:
        obj["originConvention"]="ground-center"
        obj["runtimeUp"]="+Y"
        obj["runtimeFront"]="+Z"
    bpy.context.scene.unit_settings.system="METRIC"
    bpy.context.scene.unit_settings.scale_length=1.0
    bpy.context.scene.render.engine="BLENDER_EEVEE"
    # The source scene remains portable even when the external source atlas is
    # moved; the GLB also embeds its own copy during export.
    image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    EXPORT_DIR.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(GLB_PATH),export_format="GLB",use_selection=True,
                              export_yup=True,export_apply=False,export_materials="EXPORT",
                              export_image_format="AUTO",export_texture_dir="landscape",export_extras=True)
    force_mask_materials(GLB_PATH)

    prefabs=[]
    for obj in roots:
        bounds,dims=gltf_bounds(obj)
        mats_used=sorted({slot.material.name for child in [obj]+list(obj.children_recursive)
                          if child.type=="MESH" for slot in child.material_slots if slot.material})
        prefabs.append({"name":obj.name,"node":obj.name,"category":obj.get("category","prop"),
                        "bounds":bounds,"dimensions":dims,"origin":"ground-center","front":"+Z",
                        "triangles":mesh_triangles(obj),"materials":mats_used})
    manifest={"asset":"landscape.glb","version":1,"units":"metres",
              "coordinateSystem":{"up":"+Y","front":"+Z","handedness":"right"},
              "texturePolicy":{"leafAtlas":"landscape/leaf_atlas.png","appliesTo":["Broadleaf_Cutout"],
                               "alphaMode":"MASK","alphaCutoff":0.45,
                               "palmFronds":"opaque-untextured"},
              "prefabs":prefabs,"totals":{"prefabs":len(prefabs),"triangles":sum(p["triangles"] for p in prefabs)}}
    MANIFEST_PATH.write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps(manifest["totals"]))


if __name__ == "__main__":
    main()
