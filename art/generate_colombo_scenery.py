"""Generate an original, low-poly Colombo-inspired decorative scenery kit.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python art/generate_colombo_scenery.py
"""
import bpy
import math
import json
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

PALETTE = {
    "Ochre": (0.72, 0.35, 0.12, 1), "OchreLight": (0.91, 0.62, 0.28, 1),
    "Cream": (0.88, 0.77, 0.57, 1), "Teal": (0.07, 0.36, 0.36, 1),
    "TealLight": (0.12, 0.55, 0.50, 1), "Clay": (0.55, 0.19, 0.10, 1),
    "Wood": (0.28, 0.12, 0.06, 1), "Leaf": (0.12, 0.34, 0.16, 1),
    "LeafLight": (0.28, 0.48, 0.18, 1), "Dark": (0.055, 0.07, 0.07, 1),
    "Metal": (0.20, 0.23, 0.22, 1), "Glass": (0.13, 0.40, 0.48, 1),
    "Coral": (0.72, 0.18, 0.10, 1), "Yellow": (0.91, 0.60, 0.08, 1),
    "PlasterWarm": (0.80, 0.55, 0.30, 1), "PlasterCool": (0.53, 0.68, 0.62, 1),
    "LeafDark": (0.055, 0.20, 0.09, 1), "LeafSun": (0.48, 0.62, 0.18, 1),
    "Rust": (0.46, 0.13, 0.055, 1), "Tyre": (0.018, 0.022, 0.021, 1),
    "LampWarm": (1.0, 0.56, 0.16, 1),
}

MATS = {}
for name, color in PALETTE.items():
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = .72 if name not in {"Glass", "Metal"} else .35
    bsdf.inputs["Metallic"].default_value = .45 if name == "Metal" else 0
    if name == "LampWarm":
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = 5.0
    MATS[name] = m

def finish(obj, mat, bevel=.06):
    obj.data.materials.append(MATS[mat])
    if bevel and hasattr(obj.data, "polygons"):
        mod = obj.modifiers.new("Soft painted edges", "BEVEL")
        mod.width = bevel; mod.segments = 2
    return obj

def cube(name, loc, scale, mat, parent, bevel=.06, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=(scale[0]/2,scale[1]/2,scale[2]/2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.parent=parent; return finish(o,mat,bevel)

def cyl(name, loc, radius, depth, mat, parent, vertices=10, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o=bpy.context.object; o.name=name; o.parent=parent; return finish(o,mat,.035)

def ico(name, loc, scale, mat, parent, subdiv=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.parent=parent; return finish(o,mat,.03)

def wedge(name, loc, width, depth, height, mat, parent):
    x=width/2; y=depth/2
    verts=[(-x,-y,0),(x,-y,0),(x,y,0),(-x,y,0),(-x,-y,height),(x,-y,height)]
    faces=[(0,1,2,3),(0,4,5,1),(1,5,2),(2,5,4,3),(3,4,0)]
    mesh=bpy.data.meshes.new(name+"Mesh"); mesh.from_pydata(verts,[],faces)
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent
    return finish(o,mat,.035)

def sign_symbol(name, x, y, z, mat, parent, kind=0):
    """Simple geometric shop mark: deliberately not text or a real business logo."""
    if kind%3==0:
        ico(name,(x,y,z),(.20,.06,.20),mat,parent)
    elif kind%3==1:
        cube(name,(x,y,z),(.34,.07,.34),mat,parent,.025,rot=(0,math.radians(45),0))
    else:
        cyl(name,(x,y,z),.20,.08,mat,parent,8,rot=(math.pi/2,0,0))

def leaf_card(name, loc, length, width, mat, parent, rotation=(0,0,0)):
    """Small pointed, slightly folded leaf; dense batches merge by material."""
    verts=[(-length*.5,0,0),(-length*.12,-width*.5,.025),(length*.34,-width*.34,0),
           (length*.5,0,-.035),(length*.34,width*.34,0),(-length*.12,width*.5,.025),(0,0,.10)]
    faces=[(0,1,6),(1,2,6),(2,3,6),(3,4,6),(4,5,6),(5,0,6)]
    mesh=bpy.data.meshes.new(name+"Mesh"); mesh.from_pydata(verts,[],faces); mesh.materials.append(MATS[mat])
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    o.location=loc; o.rotation_euler=rotation; o.parent=parent
    return o

def lance(name, origin, angle, length, width, rise, droop, mat, parent, leaflets=False):
    """Single low-poly curved leaf/frond mesh, optionally with pinnate leaflets."""
    verts=[]; faces=[]; segments=5
    for i in range(segments+1):
        t=i/segments; d=length*t; z=origin[2]+rise*math.sin(t*math.pi)-droop*t*t
        w=width*math.sin(math.pi*t)*.5 + .015
        cx=origin[0]+math.cos(angle)*d; cy=origin[1]+math.sin(angle)*d
        px=-math.sin(angle)*w; py=math.cos(angle)*w
        verts += [(cx+px,cy+py,z),(cx-px,cy-py,z)]
        if i: faces += [(2*i-2,2*i-1,2*i+1),(2*i-2,2*i+1,2*i)]
    if leaflets:
        for i in range(1,segments):
            t=i/segments; d=length*t; z=origin[2]+rise*math.sin(t*math.pi)-droop*t*t
            cx=origin[0]+math.cos(angle)*d; cy=origin[1]+math.sin(angle)*d
            side_len=width*(1-t*.55)*1.35
            for side in (-1,1):
                ax=angle+side*math.pi/2
                tip=(cx+math.cos(ax)*side_len,cy+math.sin(ax)*side_len,z-.12)
                verts += [(cx,cy,z+.025),(cx,cy,z-.025),tip]
                k=len(verts); faces.append((k-3,k-2,k-1))
    mesh=bpy.data.meshes.new(name+"Mesh");mesh.from_pydata(verts,[],faces);mesh.materials.append(MATS[mat])
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=parent
    return o

def root(name,x):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=(x,0,0)
    o["asset_root"]=True; return o

def shop(name, x, wall, trim, awning, variant=0):
    r=root(name,x)
    cube("Building",(x,0,3.15),(7.2,4.8,6.3),wall,r,.12)
    # broad, shallow bands break up the plaster and read as weathered repainting
    cube("PlasterBand",(x,-2.425,5.92),(6.75,.055,.42),"PlasterWarm" if variant==0 else "PlasterCool",r,.015)
    cube("Parapet",(x,-.02,6.48),(7.45,4.95,.45),trim,r,.08)
    cube("Cornice",(x,-2.46,3.35),(7.45,.22,.22),trim,r,.04)
    # recessed street-level bays, posts and shutters
    for sx in (-2.35,0,2.35):
        cube("ShopBay",(x+sx,-2.43,1.55),(2.02,.16,2.75),"Dark",r,.035)
        cube("RollerShutter",(x+sx,-2.54,1.42),(1.72,.08,2.35),trim,r,.025)
        for z in (.45,.8,1.15,1.5,1.85,2.2):
            cube("ShutterSlat",(x+sx,-2.595,z),(1.65,.035,.035),"Cream",r,.005)
        cube("Pier",(x+sx-1.08,-2.52,1.55),(.18,.30,3.05),"Cream",r,.03)
    # striped awning with a strong silhouette
    cube("Awning",(x,-2.86,3.05),(6.85,1.05,.14),awning,r,.035,rot=(math.radians(10),0,0))
    for sx in (-2.7,-1.35,0,1.35,2.7):
        cube("AwningStripe",(x+sx,-2.91,3.08),(1.0,1.02,.04),"Cream",r,.01,rot=(math.radians(10),0,0))
    # upper windows, arched impression via header and shutters
    for sx in (-2.25,0,2.25):
        cube("WindowRecess",(x+sx,-2.445,4.75),(1.35,.12,1.65),"Dark",r,.035)
        cube("WindowGlass",(x+sx,-2.53,4.75),(1.05,.05,1.38),"Glass",r,.018)
        cube("WindowBarV",(x+sx,-2.58,4.75),(.06,.04,1.38),"Cream",r,.008)
        cube("WindowBarH",(x+sx,-2.58,4.75),(1.05,.04,.06),"Cream",r,.008)
        cube("ShutterL",(x+sx-.78,-2.55,4.75),(.34,.09,1.52),trim,r,.025,rot=(0,0,math.radians(-8)))
        cube("ShutterR",(x+sx+.78,-2.55,4.75),(.34,.09,1.52),trim,r,.025,rot=(0,0,math.radians(8)))
    # balcony and railing
    cube("BalconySlab",(x,-2.78,4.02),(4.75,1.0,.18),"Cream",r,.045)
    for sx in (-2.2,-1.45,-.72,0,.72,1.45,2.2):
        cube("Baluster",(x+sx,-3.16,4.52),(.08,.08,.9),"Dark",r,.012)
    cube("BalconyRail",(x,-3.16,4.98),(4.55,.09,.10),"Dark",r,.015)
    cube("Signboard",(x,-2.63,2.72),(4.15,.16,.56),trim,r,.045)
    sign_symbol("GenericShopMark",x-1.55,-2.74,2.72,"Yellow" if variant else "Cream",r,variant)
    for sx in (-.95,-.3,.35,1.0): cube("SignDash",(x+sx,-2.72,2.72),(.42,.055,.075),"Cream",r,.01)
    # Roofs distinguish the two shops: a tiled hip roof and a corrugated lean-to.
    if variant==0:
        wedge("TiledRoof",(x,-.05,6.62),7.75,5.35,1.05,"Clay",r)
        for sx in (-3,-2,-1,0,1,2,3): cube("RoofRib",(x+sx,-.08,7.10),(.065,5.0,.07),"Rust",r,.012,rot=(0,math.radians(-10),0))
    else:
        wedge("LeanRoof",(x,-.05,6.58),7.72,5.28,.68,"Teal",r)
        for sx in (-3,-2.4,-1.8,-1.2,-.6,0,.6,1.2,1.8,2.4,3): cube("RoofSeam",(x+sx,-.05,6.93),(.035,5.0,.055),"Cream",r,.008)
        cube("SideAwning",(x+3.72,-.55,4.0),(.16,2.85,1.0),"Coral",r,.035,rot=(0,0,math.radians(-6)))
    return r

shop("Shop_Ochre",0,"Ochre","Teal","OchreLight",0)
shop("Shop_CreamTeal",10,"Cream","Teal","Coral",1)

# Boundary wall and ornamental gate
r=root("BoundaryWall_Gate",20)
for sx in (-3.2,3.2): cube("Wall",(20+sx,0,1.0),(1.6,.45,2.0),"Cream",r,.08)
for sx in (-4,4,-2.35,2.35): cube("Pillar",(20+sx,0,1.25),(.55,.65,2.5),"Ochre",r,.07)
for sx in (-1.55,1.55):
    cube("GateLeaf",(20+sx,0,1.05),(2.95,.14,1.95),"Teal",r,.035)
    for dx in (-1.1,-.55,0,.55,1.1): cube("GateBar",(20+sx+dx,0,1.12),(.08,.18,1.82),"Cream",r,.012)
for sx in (-4,4,-2.35,2.35): ico("PillarCap",(20+sx,0,2.62),(.35,.35,.24),"Clay",r)
cube("WallCoping",(20,0,2.1),(8.45,.62,.16),"Clay",r,.035)
for sx in (-3.9,-3.25,3.25,3.9):
    cyl("WallPlanter",(20+sx,-.48,.35),.34,.70,"Clay",r,10)
    for j in range(5):
        a=j*1.256+.3*sx
        lance("WallPlant",(20+sx,-.48,.67),a,.55,.22,.48,.1,"LeafSun" if j%2 else "Leaf",r)

# Broad shade tree with layered, asymmetric connected canopy masses
r=root("ShadeTree",30)
cyl("Trunk",(30,0,2.15),.48,4.3,"Wood",r,10)
branches=[(-1.1,.15,4.75,-28),(1.1,.2,4.85,31),(-.25,-.85,5.0,-10),(.3,.75,5.1,12)]
for bx,by,bz,ang in branches:
    cyl("Branch",(30+bx*.46,by*.46,bz-.65),.19,3.0,"Wood",r,8,rot=(math.radians(by*18),math.radians(ang),0))
# Many faceted crowns create a leafy silhouette while staying far below the kit budget.
for i in range(46):
    a=i*2.399963; ring=.35+(i%9)*.34; z=5.15+(i%5)*.30+math.sin(i*1.7)*.18
    px=30+math.cos(a)*ring; py=math.sin(a)*ring*.72
    sc=.54+(i%4)*.09
    ico("LeafCluster",(px,py,z),(sc*1.25,sc,sc*.72),("LeafDark","Leaf","LeafLight","LeafSun")[i%4],r,1)
for i in range(13):
    a=i*1.71; lance("TwigLeaf",(30+math.cos(a)*1.2,math.sin(a)*.7,5.4+(i%3)*.45),a,1.28,.34,.34,.18,"LeafSun" if i%3==0 else "LeafLight",r)
# A fine outer shell of pointed leaves breaks up every edge of the faceted inner
# crown. Golden-angle placement keeps it deterministic and avoids visible rows.
for i in range(520):
    a=i*2.399963; band=(i%17)/16; rad=2.15+band*1.42
    z=4.85+((i*7)%29)/28*2.05 + math.sin(a*2.0)*.22
    px=30+math.cos(a)*rad; py=math.sin(a)*rad*.66
    tilt=.18*math.sin(i*.73); roll=(i%9-4)*.075
    leaf_card("CanopyLeaf",(px,py,z),.42+(i%5)*.045,.20+(i%4)*.025,
              ("LeafDark","Leaf","LeafLight","LeafSun")[i%4],r,(tilt,roll,a))

# Palm, with tapered segmented trunk and radial lance leaves
r=root("PalmTree",40)
for i in range(7):
    cyl("PalmTrunk",(40+.04*i,0,.55+i*.78),.32-i*.018,1.0,"Wood",r,9,rot=(0,math.radians(3),0))
ico("PalmCrown",(40.3,0,6.05),(.62,.62,.48),"Leaf",r,1)
for i in range(11):
    a=2*math.pi*i/11; length=3.0 if i%2==0 else 2.55
    lance("PalmFrond",(40.3,0,6.18),a,length,.50,.42,.95,"LeafLight" if i%3 else "Leaf",r,True)
for i in range(9):
    a=2*math.pi*(i+.5)/9
    lance("YoungFrond",(40.3,0,6.15),a,1.75,.34,.72,.12,"LeafSun" if i%2 else "LeafDark",r,True)
# Pointed leaflets along each palm frond strengthen the feathered silhouette.
for i in range(150):
    fr=i%15; step=i//15; a=2*math.pi*fr/15
    d=.72+step*.22; px=40.3+math.cos(a)*d; py=math.sin(a)*d
    z=6.28+.38*math.sin(d/3*math.pi)-.68*(d/3)**2
    side=-1 if step%2 else 1
    leaf_card("PalmLeaflet",(px,py,z),.48,.15,"LeafSun" if i%5==0 else "Leaf",r,
              (side*.2,.12*math.sin(i),a+side*.72))

# utility pole with street lamp and cables
r=root("UtilityPole_Lamp",49)
cyl("Pole",(49,0,3.45),.17,6.9,"Wood",r,10)
cube("CrossArm",(49,0,5.85),(2.2,.18,.20),"Wood",r,.035)
for sx in (-.8,0,.8): cyl("Insulator",(49+sx,0,6.08),.10,.35,"Cream",r,8)
cube("LampArm",(49,-.55,5.15),(.12,1.3,.12),"Metal",r,.025,rot=(0,0,0))
cube("LampHead",(49,-1.18,5.03),(.62,.48,.22),"Metal",r,.06)
cube("LampGlow",(49,-1.18,4.89),(.48,.36,.06),"LampWarm",r,.025)

def pot(name,x,leafmat):
    r=root(name,x)
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=.42,radius2=.52,depth=.62,location=(x,0,.31))
    o=bpy.context.object;o.name="TerracottaPot";o.parent=r;finish(o,"Clay",.035)
    cyl("PotRim",(x,0,.62),.55,.16,"Ochre",r,10)
    for i,a in enumerate((0,1.05,2.1,3.15,4.2,5.25)):
        lance("PlantLeaf",(x,0,.68),a,.72,.30,.62,.15,leafmat if i%2 else "LeafLight",r)
pot("PottedPlant_A",56,"Leaf")
pot("PottedPlant_B",59,"LeafLight")

# Parked decorative three-wheeler; simplified and intentionally nonfunctional
r=root("TukTuk_Parked",64)
cube("Body",(64,0,1.0),(1.45,2.45,1.15),"Teal",r,.16)
cube("Cabin",(64,-.18,1.63),(1.38,1.35,1.05),"Yellow",r,.14)
cube("Windshield",(64,-.91,1.72),(1.05,.06,.62),"Glass",r,.03,rot=(math.radians(-8),0,0))
cube("Canopy",(64,-.05,2.22),(1.5,1.65,.18),"Cream",r,.09)
cube("FrontNose",(64,-1.23,.92),(1.1,.35,.62),"Yellow",r,.12)
for wx,wy in [(-.58,.56),(.58,.56),(0,-1.2)]:
    cyl("Wheel",(64+wx,wy,.43),.35,.16,"Dark",r,12,rot=(math.pi/2,0,0))
    cyl("Hub",(64+wx,wy,.43),.13,.18,"Cream",r,10,rot=(math.pi/2,0,0))
for sx in (-.38,.38): cyl("Headlamp",(64+sx,-1.42,1.02),.11,.08,"Cream",r,10,rot=(math.pi/2,0,0))
cube("FrontBumper",(64,-1.47,.62),(1.02,.13,.13),"Metal",r,.025)
cube("NumberPlate",(64,-1.55,.80),(.46,.045,.18),"Cream",r,.025)
for sx in (-.53,.53): cube("Mudguard",(64+sx,.55,.55),(.18,.74,.16),"Yellow",r,.05)
for sx in (-.43,.43): cube("CabinPost",(64+sx,-.64,1.71),(.09,.09,.95),"Dark",r,.018,rot=(0,math.radians(sx*10),0))
cube("Seat",(64,.35,1.24),(1.15,.45,.36),"Dark",r,.08)
cube("RearPanel",(64,.98,1.28),(1.26,.12,.72),"TealLight",r,.06)
for sx in (-.37,.37): cyl("Mirror",(64+sx,-.88,1.95),.13,.07,"Metal",r,10,rot=(math.pi/2,0,0))

# Simplified landmark-scale Lotus Tower silhouette (recognition over surveyed detail).
r=root("LotusTower",70)
cyl("TowerStem",(70,0,123),6.2,246,"TealLight",r,12)
cyl("TowerCollar",(70,0,248),18,.8*10,"Cream",r,12)
for i,(z,rad) in enumerate(((250,19),(260,23),(271,20),(281,15))):
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=rad,radius2=max(7,rad-6),depth=13,location=(70,0,z))
    o=bpy.context.object;o.name="LotusPetalLayer";o.parent=r;finish(o,"Coral" if i%2==0 else "OchreLight",.06)
cyl("LotusPod",(70,0,290),8,10,"Cream",r,12)
cyl("Antenna",(70,0,322.5),1.25,65,"Metal",r,8)
ico("AntennaTip",(70,0,355.5),(1.8,1.8,1.8),"Coral",r,1)

# Metadata and deterministic export.
# Helpers above author in catalog/world coordinates. Rebase direct children so each
# asset root is independently cloneable and its local origin remains at ground contact.
asset_roots = [o for o in bpy.data.objects if o.get("asset_root")]
for asset_root in asset_roots:
    for child in asset_root.children:
        child.location.x -= asset_root.location.x

# Bake bevels, then batch rigid geometry by asset root and material. This retains
# editable named roots while sharply reducing runtime primitives/draw calls.
for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
    bpy.context.view_layer.objects.active=obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
for asset_root in asset_roots:
    material_groups={}
    for child in list(asset_root.children):
        material_name=child.data.materials[0].name if child.data.materials else "Unmaterialed"
        material_groups.setdefault(material_name,[]).append(child)
    for material_name, objects in material_groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        objects[0].name=f"{asset_root.name}_{material_name}"

# Measure final baked local bounds. Blender XYZ maps to glTF X,Z,-Y, so exported
# dimensions are width X, height Y, depth Z = Blender X, Z, Y extents.
actual_bounds={}
for asset_root in asset_roots:
    points=[]
    for child in asset_root.children:
        if child.type != "MESH": continue
        points.extend(child.matrix_local @ vertex.co for vertex in child.data.vertices)
    mins=[min(point[i] for point in points) for i in range(3)]
    maxs=[max(point[i] for point in points) for i in range(3)]
    actual_bounds[asset_root.name]=[
        round(maxs[0]-mins[0],4), round(maxs[2]-mins[2],4), round(maxs[1]-mins[1],4)
    ]

bpy.context.scene["kit_license"]="CC0-style original project artwork; generated locally without external model inputs"
bpy.context.scene["subject_note"]="Illustrative Colombo-inspired props; not surveyed real buildings"
bpy.context.scene.unit_settings.system="METRIC"
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art" / "colombo_scenery_kit.blend"))
bpy.ops.export_scene.gltf(filepath=str(OUT / "colombo_scenery_kit.glb"), export_format="GLB", export_apply=True,
    export_yup=True, export_materials="EXPORT", export_cameras=False, export_lights=False)

with (OUT / "colombo_scenery_kit.glb").open("rb") as glb:
    glb.read(12)
    json_length, _ = struct.unpack("<II", glb.read(8))
    gltf = json.loads(glb.read(json_length))
exported_triangles = sum(
    gltf["accessors"][primitive["indices"]]["count"] // 3
    for mesh in gltf["meshes"] for primitive in mesh["primitives"]
)

manifest = {
  "formatVersion": 1,
  "generator": "art/generate_colombo_scenery.py",
  "units": "meters", "upAxis": "Y", "forwardAxis": "+Z",
  "dimensionOrder": ["widthX", "heightY", "depthZ"],
  "usage": "Load once; clone a named top-level root and place its root at ground contact.",
  "provenance": "Original procedural project artwork. No external meshes or textures.",
  "surfaceProvenance": "Original glTF-safe painted material palette plus modeled plaster bands, roof ribs, shutter slats, leaf facets, and trim; generated entirely by this script with no downloaded texture inputs.",
  "inspirationReference": "https://colombolotustower.lk/our-story/ (356 m height reference; no copied imagery or texture)",
  "disclaimer": "Illustrative Colombo-inspired scenery, not a survey or replica of a real building.",
  "generation": {"blenderVersion": bpy.app.version_string, "rootCount": len(asset_roots),
                 "objectCount": len(bpy.data.objects), "materialCount": len(bpy.data.materials),
                 "meshVertexCount": sum(len(o.data.vertices) for o in bpy.data.objects if o.type == "MESH"),
                 "sourceMeshTriangleCount": sum(len(p.vertices)-2 for o in bpy.data.objects if o.type == "MESH" for p in o.data.polygons),
                 "exportedMeshCount": len(gltf["meshes"]), "exportedNodeCount": len(gltf["nodes"]),
                 "exportedMaterialCount": len(gltf.get("materials",[])), "exportedTriangleCount": exported_triangles},
  "palette": {k: list(v) for k,v in PALETTE.items()},
  "assets": [
    {"name":"Shop_Ochre","catalogPosition":[0,0,0],"dimensions":actual_bounds["Shop_Ochre"]},
    {"name":"Shop_CreamTeal","catalogPosition":[10,0,0],"dimensions":actual_bounds["Shop_CreamTeal"]},
    {"name":"BoundaryWall_Gate","catalogPosition":[20,0,0],"dimensions":actual_bounds["BoundaryWall_Gate"]},
    {"name":"ShadeTree","catalogPosition":[30,0,0],"dimensions":actual_bounds["ShadeTree"]},
    {"name":"PalmTree","catalogPosition":[40,0,0],"dimensions":actual_bounds["PalmTree"]},
    {"name":"UtilityPole_Lamp","catalogPosition":[49,0,0],"dimensions":actual_bounds["UtilityPole_Lamp"]},
    {"name":"PottedPlant_A","catalogPosition":[56,0,0],"dimensions":actual_bounds["PottedPlant_A"]},
    {"name":"PottedPlant_B","catalogPosition":[59,0,0],"dimensions":actual_bounds["PottedPlant_B"]},
    {"name":"TukTuk_Parked","catalogPosition":[64,0,0],"dimensions":actual_bounds["TukTuk_Parked"]}
    ,{"name":"LotusTower","catalogPosition":[70,0,0],"dimensions":actual_bounds["LotusTower"],"scaleNote":"Simplified world-unit landmark scale based on published 356 m height; approximate silhouette, not surveyed geometry."}
  ]
}
(OUT / "colombo_scenery_kit.manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")

# Render a two-row contact sheet after the deliverable is saved and exported.
# The true-scale tower is previewed at 1:40, while its saved/exported transform
# and manifest retain the full landmark scale.
preview_names=["Shop_Ochre","Shop_CreamTeal","BoundaryWall_Gate","ShadeTree","PalmTree",
               "UtilityPole_Lamp","PottedPlant_A","PottedPlant_B","TukTuk_Parked","LotusTower"]
preview_centers=[(-15,14),(-7.5,14),(0,14),(7.5,14),(15,14),
                 (-15,4.5),(-7.5,4.5),(0,4.5),(7.5,4.5),(15,4.5)]
bpy.data.objects["LotusTower"].scale=(.025,.025,.025); bpy.context.view_layer.update()
for name,(target_x,target_z) in zip(preview_names,preview_centers):
    root_obj=bpy.data.objects[name]; points=[]
    for child in root_obj.children:
        if child.type=='MESH': points.extend(child.matrix_world @ Vector(corner) for corner in child.bound_box)
    center_x=(min(p.x for p in points)+max(p.x for p in points))*.5
    center_z=(min(p.z for p in points)+max(p.z for p in points))*.5
    root_obj.location.x += target_x-center_x; root_obj.location.z += target_z-center_z
bpy.ops.object.camera_add(location=(0,-42,10))
camera=bpy.context.object; camera.name="PreviewCamera"; bpy.context.scene.camera=camera
target=Vector((0,0,9.5)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=46.0
bpy.ops.object.light_add(type='AREA', location=(-8,-10,18)); key=bpy.context.object
key.data.energy=1900; key.data.shape='DISK'; key.data.size=10
key.rotation_euler=((Vector((0,0,3))-key.location).to_track_quat('-Z','Y').to_euler())
bpy.ops.object.light_add(type='AREA', location=(12,-4,9)); fill=bpy.context.object
fill.data.energy=950; fill.data.size=8
fill.rotation_euler=((Vector((0,0,3))-fill.location).to_track_quat('-Z','Y').to_euler())
world=bpy.context.scene.world or bpy.data.worlds.new("PreviewWorld"); bpy.context.scene.world=world
world.use_nodes=True; world.node_tree.nodes["Background"].inputs["Color"].default_value=(.035,.065,.08,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.45
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1800; scene.render.resolution_y=1050; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.render.filepath=str(OUT / "colombo_scenery_preview.png")
scene.view_settings.look='AgX - Medium High Contrast'
bpy.ops.render.render(write_still=True)
print(json.dumps({"objects":len(bpy.data.objects),"materials":len(bpy.data.materials),"output":str(OUT)},indent=2))
