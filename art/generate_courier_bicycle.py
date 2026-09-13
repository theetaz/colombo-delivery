"""Generate the original articulated Colombo courier bicycle asset and review sheet.

Run with Blender 5.1.2:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python art/generate_courier_bicycle.py
"""
import bpy, bmesh, math, json, struct
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/"public"/"models"; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)

COLORS={
 "Tyre":(.025,.03,.028,1),"Metal":(.55,.61,.59,1),"Frame":(.80,.19,.07,1),"Dark":(.045,.07,.065,1),
 "Rider_Shirt":(.94,.56,.08,1),"Rider_Shorts":(.035,.23,.28,1),"Rider_Skin":(.52,.255,.145,1),
 "Rider_Helmet":(.92,.88,.70,1),"Courier_Bag":(.55,.08,.045,1),"Courier_Bag_Trim":(.16,.055,.035,1),"Rider_Shoes":(.08,.09,.085,1),
 "Sole":(.72,.69,.60,1),"Reflector":(1,.44,.04,1),"Eye":(.018,.014,.012,1),"EyeWhite":(.86,.82,.70,1),"Rider_Hair":(.025,.014,.009,1),
}
M={}
for name,color in COLORS.items():
    mat=bpy.data.materials.new(name); mat.diffuse_color=color; mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get("Principled BSDF"); bsdf.inputs["Base Color"].default_value=color
    bsdf.inputs["Roughness"].default_value=.34 if name=="Metal" else .72
    bsdf.inputs["Metallic"].default_value=.72 if name=="Metal" else 0
    M[name]=mat

# Tiny deterministic procedural luminance maps. They are packed into the .blend and
# embedded into the GLB, so the runtime does not depend on loose image files.
TEXTURED={"Rider_Skin","Rider_Hair","Rider_Helmet","Rider_Shirt","Rider_Shorts","Rider_Shoes","Courier_Bag","Courier_Bag_Trim","Frame","Tyre"}
for name in TEXTURED:
    image=bpy.data.images.new(name+"_Paint",width=64,height=64,alpha=True)
    pixels=[]
    for y in range(64):
        for x in range(64):
            weave=(math.sin(x*1.31)*math.sin(y*1.17))*.012 if name in {"Rider_Shirt","Rider_Shorts","Courier_Bag","Courier_Bag_Trim"} else 0
            grain=(math.sin(x*.23+y*.31)+math.sin(x*.11-y*.17))*.004
            wear=-.018 if ((x*13+y*7)%197)<3 and name in {"Frame","Tyre","Rider_Shoes"} else 0
            factor=max(.91,min(.99,.965+weave+grain+wear))
            pixels.extend((factor,factor,factor,1))
    image.pixels=pixels; image.pack()
    tex=M[name].node_tree.nodes.new("ShaderNodeTexImage"); tex.image=image; tex.interpolation="Linear"
    M[name].node_tree.links.new(tex.outputs["Color"],M[name].node_tree.nodes["Principled BSDF"].inputs["Base Color"])

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o
def finish(o,mat,bevel=0):
    if mat: o.data.materials.append(M[mat])
    if mat in {"Tyre","Rider_Shirt","Rider_Shorts","Rider_Skin","Rider_Helmet","Courier_Bag","Courier_Bag_Trim","Rider_Shoes","Sole","Rider_Hair"} and hasattr(o.data,"polygons"):
        for polygon in o.data.polygons: polygon.use_smooth=True
    if bevel:
        mod=o.modifiers.new("Rounded edge","BEVEL"); mod.width=bevel; mod.segments=2
    return o
def cube(name,loc,size,mat,parent,bevel=.01,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot); o=bpy.context.object; o.name=name; o.scale=tuple(v/2 for v in size)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.parent=parent; return finish(o,mat,bevel)
def cyl(name,loc,radius,depth,mat,parent,verts=12,rot=(0,0,0),r2=None):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=loc,rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=radius,radius2=r2,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.parent=parent; return finish(o,mat,.006)
def sphere(name,loc,scale,mat,parent,segments=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc); o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.parent=parent; return finish(o,mat,.004)
def torus(name,loc,major,minor,mat,parent,rot=(0,0,0),major_segments=32,minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=major_segments,minor_segments=minor_segments,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.parent=parent; return finish(o,mat,0)
def tube(name,a,b,r,mat,parent,verts=10,r2=None):
    a,b=Vector(a),Vector(b); d=b-a; o=cyl(name,(a+b)/2,r,d.length,mat,parent,verts,r2=r2)
    o.rotation_mode="QUATERNION"; o.rotation_quaternion=Vector((0,0,1)).rotation_difference(d.normalized()); return o
def curve_tube(name,points,r,mat,parent):
    curve=bpy.data.curves.new(name+"Curve","CURVE"); curve.dimensions="3D"; curve.bevel_depth=r; curve.bevel_resolution=1; curve.resolution_u=1
    spline=curve.splines.new("POLY"); spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points): p.co=(*co,1)
    o=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(o); o.data.materials.append(M[mat]); o.parent=parent; return o
def loft(name,rings,mat,parent,segments=18):
    """Loft elliptical contour rings: (y, x_radius, z_radius, z_center)."""
    verts=[]; faces=[]
    for y,rx,rz,zc in rings:
        for i in range(segments):
            a=math.tau*i/segments; verts.append((math.cos(a)*rx,y,zc+math.sin(a)*rz))
    for j in range(len(rings)-1):
        for i in range(segments):
            n=(i+1)%segments; a=j*segments+i; b=j*segments+n; c=(j+1)*segments+n; d=(j+1)*segments+i
            faces.append((a,d,c,b))
    faces.append(tuple(range(segments-1,-1,-1))); top=(len(rings)-1)*segments; faces.append(tuple(top+i for i in range(segments)))
    mesh=bpy.data.meshes.new(name+"Mesh"); mesh.from_pydata(verts,[],faces); mesh.materials.append(M[mat])
    bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(mesh); bm.free()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); o.parent=parent
    for polygon in mesh.polygons: polygon.use_smooth=True
    if name=="Rider_Torso" or name.endswith("_Head"):
        sub=o.modifiers.new("Organic contour","SUBSURF"); sub.subdivision_type="CATMULL_CLARK"; sub.levels=1; sub.render_levels=1
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.uv.smart_project(); bpy.ops.object.mode_set(mode="OBJECT")
    return o

root=empty("CourierBicycle")
root["vehicleType"]="bicycle"; root["contractVersion"]=1; root["forwardAxis"]="-Z"; root["wheelRadius"]=.34; root["wheelbase"]=1.08
rear=empty("RearWheel",(0,.34,.54),root)
front_assembly=empty("FrontAssembly",(0,0,-.54),root)
front=empty("FrontWheel",(0,.34,0),front_assembly)

def wheel(node,prefix):
    torus(prefix+"_Tyre",(0,0,0),.309,.031,"Tyre",node,(0,math.pi/2,0),36,10)
    torus(prefix+"_Rim",(0,0,0),.282,.008,"Metal",node,(0,math.pi/2,0),36,6)
    cyl(prefix+"_Hub",(0,0,0),.026,.115,"Metal",node,12,(0,math.pi/2,0))
    for i in range(24):
        a=i*math.tau/24; side=-.044 if i%2 else .044
        tube(f"{prefix}_Spoke_{i+1:02d}",(side,0,0),(0,math.cos(a)*.277,math.sin(a)*.277),.0022,"Metal",node,6)
    # rim reflector and compact V-brake hardware
    cube(prefix+"_Reflector",(.012,.18,.235),(.025,.055,.075),"Reflector",node,.008,rot=(a,0,0))
wheel(rear,"Rear"); wheel(front,"Front")

# Main frame and rear stays in root coordinates.
crank_pos=(0,.45,.06); seat_top=(0,.84,.31); head_low=(0,.72,-.46); head_high=(0,.95,-.41); rear_c=(0,.34,.54)
for name,a,b,r in [
 ("Frame_Down",crank_pos,head_low,.029),("Frame_Top",seat_top,head_high,.028),("Frame_Seat",crank_pos,seat_top,.03),
 ("Frame_ChainStay_L",(-.038,.35,.52),(-.038,.45,.06),.018),("Frame_ChainStay_R",(.038,.35,.52),(.038,.45,.06),.018),
 ("Frame_SeatStay_L",(-.038,.36,.52),(-.038,.82,.30),.017),("Frame_SeatStay_R",(.038,.36,.52),(.038,.82,.30),.017),
]: tube(name,a,b,r,"Frame",root,12)
tube("HeadTube",head_low,head_high,.034,"Frame",root,12)
tube("SeatPost",seat_top,(0,1.01,.39),.018,"Metal",root,10)
cube("Saddle",(0,1.025,.405),(.20,.07,.34),"Dark",root,.035,rot=(-.05,0,0))

# Steering assembly uses coordinates local to FrontAssembly.
for x in (-.045,.045): tube("Fork_L" if x<0 else "Fork_R",(x,.34,0),(x,.79,.08),.018,"Metal",front_assembly,10)
tube("Steerer",(0,.77,.07),(0,1.04,.13),.021,"Metal",front_assembly,10)
tube("Handlebar",(-.31,1.04,.13),(.31,1.04,.13),.016,"Dark",front_assembly,10)
for x in (-.285,.285):
    cube("Grip_L" if x<0 else "Grip_R",(x,1.04,.13),(.12,.043,.043),"Courier_Bag_Trim",front_assembly,.015)
    tube("BrakeLever_L" if x<0 else "BrakeLever_R",(x,1.02,.12),(x*.9,.95,.06),.006,"Metal",front_assembly,8)
for name,loc in [("Grip_L_Attach",(-.22,1.04,.13)),("Grip_R_Attach",(.22,1.04,.13))]: empty(name,loc,front_assembly)
curve_tube("FrontBrakeCable",[(.18,1.02,.13),(.13,.87,.03),(.06,.67,.02)],.004,"Dark",front_assembly)

# Drivetrain: animated crank, chainring, pedals, rear sprocket, and visible chain loop.
crank=empty("Crank",crank_pos,root)
torus("Chainring",(0,0,0),.105,.009,"Metal",crank,(0,math.pi/2,0),28,6)
cyl("CrankAxle",(0,0,0),.035,.16,"Metal",crank,12,(0,math.pi/2,0))
for side,loc in [("L",(-.10,.18,0)),("R",(.10,-.18,0))]:
    pedal=empty("Pedal_"+side,loc,crank); empty("Pedal_"+side+"_Attach",(0,0,0),pedal)
    cube("Pedal_"+side+"_Platform",(0,0,0),(.18,.04,.09),"Dark",pedal,.012)
torus("RearSprocket",(-.067,.34,.54),.07,.007,"Metal",root,(0,math.pi/2,0),24,6)
curve_tube("Chain",[(-.071,.52,.075),(-.071,.405,.535),(-.071,.275,.535),(-.071,.35,.075),(-.071,.52,.075)],.006,"Dark",root)

# Rear rack, fender, kickstand, brake calipers, and practical courier fittings.
for x in (-.18,.18): tube("RackRail_L" if x<0 else "RackRail_R",(x,.76,.36),(x,.76,.78),.012,"Metal",root,8)
for z in (.39,.52,.65,.77): tube(f"RackSlat_{z}",(-.18,.76,z),(.18,.76,z),.009,"Metal",root,8)
for x in (-.16,.16): tube("RackStay_L" if x<0 else "RackStay_R",(x,.75,.73),(x,.39,.55),.01,"Metal",root,8)
curve_tube("RearFender",[(0,.65,.78),(0,.72,.63),(0,.73,.46),(0,.68,.31)],.018,"Dark",root)
tube("Kickstand",(.045,.44,.11),(.12,.03,.30),.012,"Dark",root,8)
for z in (.48,-.48):
    tube("BrakeArm",(-.06,.68,z),(-.015,.57,z),.009,"Metal",root,8); tube("BrakeArm",(.06,.68,z),(.015,.57,z),.009,"Metal",root,8)

# Attachment anchors remain stable even when the current rider and bag are swapped.
for name,loc in [("Cargo_Attach",(0,.82,.69)),("Seat_Attach",(0,1.025,.405)),
                 ("Shoulder_L_Attach",(-.11,1.52,.015)),("Shoulder_R_Attach",(.11,1.52,.015)),
                 ("Hip_L_Attach",(-.075,1.08,.33)),("Hip_R_Attach",(.075,1.08,.33))]: empty(name,loc,root)

# Rider: a forward-leaning adult silhouette with tapered torso, articulated limbs,
# distinct joints, soft courier bag, and close-fitting helmet.
hip=(0,1.10,.34); shoulder=(0,1.54,.015)
loft("Rider_Torso",[(1.09,.145,.145,.33),(1.16,.175,.165,.27),(1.34,.185,.16,.14),(1.46,.205,.15,.045),(1.50,.195,.135,.015),(1.535,.105,.085,-.025),(1.56,.065,.055,-.05)],"Rider_Shirt",root,20)
loft("Rider_Shorts",[(1.055,.15,.17,.34),(1.10,.165,.18,.33),(1.16,.16,.16,.29)],"Rider_Shorts",root,18)
curve_tube("Shirt_Neckline",[(-.075,1.545,-.055),(0,1.525,-.075),(.075,1.545,-.055)],.008,"Courier_Bag_Trim",root)
curve_tube("Shirt_Seam_L",[(-.15,1.48,.02),(-.17,1.31,.15),(-.13,1.14,.29)],.006,"Courier_Bag_Trim",root)
curve_tube("Shirt_Seam_R",[(.15,1.48,.02),(.17,1.31,.15),(.13,1.14,.29)],.006,"Courier_Bag_Trim",root)
cube("Shorts_Waist",(0,1.13,.32),(.29,.035,.24),"Rider_Shorts",root,.018,rot=(-.2,0,0))
tube("Neck",(0,1.55,-.035),(0,1.625,-.065),.064,"Rider_Skin",root,14)

def face_profile(label,width,jaw,projection):
    group=empty("Face_Profile_"+label,(0,0,0),root)
    rings=[(1.595,.072,.052,-.065),(1.625,max(.078,jaw),.07,-.078),(1.655,max(.084,jaw*1.08),.09,-.088),(1.70,width*.96,.108,-.096),
           (1.745,width,.116,-.096),(1.79,width*1.03,.116,-.084),(1.825,width*.96,.106,-.073),(1.855,width*.80,.082,-.065)]
    loft(label+"_Head",rings,"Rider_Skin",group,20)
    # Low-relief eyes sit beneath lids; brows and jaw contours carry expression.
    for x in (-width*.36,width*.36):
        side="L" if x<0 else "R"
        sphere(label+"_Sclera_"+side,(x,1.762,-.091-projection),(.021,.012,.006),"EyeWhite",group,14,8)
        sphere(label+"_Iris_"+side,(x,1.762,-.097-projection),(.007,.008,.004),"Eye",group,12,7)
        curve_tube(label+"_Brow_"+side,[(x-.024,1.792,-.093-projection),(x,1.798,-.097-projection),(x+.024,1.793,-.094-projection)],.0032,"Rider_Hair",group)
        sphere(label+"_Ear_"+side,(math.copysign(width*1.02,x),1.75,-.075),(.022,.037,.018),"Rider_Skin",group,12,8)
    sphere(label+"_Nose",(0,1.735,-.094-projection),(.020,.028,.024),"Rider_Skin",group,14,9)
    curve_tube(label+"_Mouth",[(-.023,1.686,-.098-projection),(.0,1.681,-.102-projection),(.023,1.686,-.098-projection)],.003,"Courier_Bag_Trim",group)
    # Layered hair locks remain visible below the helmet at temple and nape.
    for i in range(11):
        a=math.pi*.12+i*math.pi*.078; x=math.cos(a)*width*.94; z=-.068+math.sin(a)*.10
        sphere(f"{label}_HairLock_{i:02d}",(x,1.82,z),(.031,.045,.035),"Rider_Hair",group,10,7)
    sphere(label+"_HairCap",(0,1.82,-.06),(width*.98,.075,.115),"Rider_Hair",group,18,9)
    return group
classic=face_profile("Classic",.105,.073,.105)
soft=face_profile("Soft",.112,.088,.098)
angular=face_profile("Angular",.10,.062,.112)
sphere("HelmetShell",(0,1.87,-.07),(.15,.09,.16),"Rider_Helmet",root,24,12)
cube("HelmetBrim",(0,1.835,-.22),(.18,.024,.10),"Rider_Helmet",root,.012,rot=(-.10,0,0))
for x in (-.055,0,.055): cube("HelmetVent",(x,1.947,-.07),(.018,.012,.10),"Dark",root,.006)
for x in (-.07,.07): curve_tube("HelmetStrap_L" if x<0 else "HelmetStrap_R",[(x,1.86,-.13),(x,1.70,-.17),(x*.6,1.65,-.10)],.007,"Dark",root)

def limb_driver(name,a,b,r,mat):
    a,b=Vector(a),Vector(b); d=b-a; driver=empty(name,(a+b)/2,root); driver.rotation_mode="QUATERNION"
    driver.rotation_quaternion=Vector((0,1,0)).rotation_difference(d.normalized()); driver.scale.y=d.length
    cyl(name+"_Mesh",(0,0,0),r,1,mat,driver,14,(math.pi/2,0,0),r2=r*.78)
    return driver
hands=[(-.22,1.04,-.41),(.22,1.04,-.41)]; shoulders=[(-.11,1.52,.015),(.11,1.52,.015)]
for side in range(2):
    s=shoulders[side]; h=hands[side]; elbow=((s[0]+h[0])*.5+(-.035 if side==0 else .035),1.32,-.18)
    tag="L" if side==0 else "R"; limb_driver("UpperArm_"+tag,s,elbow,.052,"Rider_Shirt")
    limb_driver("Forearm_"+tag,elbow,h,.042,"Rider_Skin"); sphere("Hand_"+tag,h,(.05,.045,.06),"Rider_Skin",root,14,9)
hips=[(-.075,1.08,.33),(.075,1.08,.33)]; feet=[(-.10,.45,.24),(.10,.45,-.12)]
for side in range(2):
    tag="L" if side==0 else "R"; hp=hips[side]; ft=feet[side]; knee=(hp[0],.77,.05 if side==0 else -.14)
    limb_driver("Rider_Thigh_"+tag,hp,knee,.073,"Rider_Shorts")
    limb_driver("Rider_Shin_"+tag,knee,ft,.052,"Rider_Skin"); shoe=sphere("Foot_"+tag,(ft[0],ft[1]+.005,ft[2]-.045),(.085,.055,.15),"Rider_Shoes",root,18,10)
    cube("Sole_"+tag,(0,-.05,-.01),(.16,.035,.29),"Sole",shoe,.018)
    cube("ShoeTongue_"+tag,(0,.032,-.035),(.10,.025,.15),"Rider_Shoes",shoe,.012,rot=(-.18,0,0))
    for lace in range(3): cube(f"ShoeLace_{tag}_{lace}",(0,.054,-.075+lace*.045),(.11,.008,.009),"Sole",shoe,.003)
    torus("AnkleCuff_"+tag,(0,.05,.09),.055,.012,"Sole",shoe,(math.pi/2,0,0),18,6)

# Soft delivery bag follows the back plane, with straps visibly wrapping shoulders.
bag=sphere("CourierBag",(0,1.39,.29),(.22,.30,.16),"Courier_Bag",root,24,16); bag.rotation_euler.x=-.38
cube("BagFlap",(0,1.52,.365),(.34,.18,.055),"Courier_Bag_Trim",root,.035,rot=(-.38,0,0))
cube("BagPocket",(0,1.31,.435),(.25,.15,.055),"Courier_Bag_Trim",root,.035,rot=(-.30,0,0))
for x in (-.105,.105): curve_tube("BagStrap_L" if x<0 else "BagStrap_R",[(x,1.56,.02),(x,1.42,.13),(x,1.18,.31)],.015,"Courier_Bag_Trim",root)
for x in (-.205,.205): curve_tube("BagSideSeam_L" if x<0 else "BagSideSeam_R",[(x,1.56,.29),(x,1.39,.44),(x,1.20,.34)],.007,"Courier_Bag_Trim",root)
curve_tube("BagTopSeam",[(-.15,1.61,.27),(0,1.65,.31),(.15,1.61,.27)],.007,"Courier_Bag_Trim",root)
for x in (-.17,.17): cube("BagSidePocket_L" if x<0 else "BagSidePocket_R",(x,1.34,.36),(.09,.15,.055),"Courier_Bag_Trim",root,.025,rot=(-.25,0,0))
cube("CargoReflector",(0,1.30,.47),(.16,.05,.018),"Reflector",root,.007)

# Apply bevels before deterministic export.
for o in [o for o in bpy.data.objects if o.type=="MESH"]:
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)

points=[]
for o in root.children_recursive:
    if o.type=="MESH": points.extend(o.matrix_world@v.co for v in o.data.vertices)
mins=[min(p[i] for p in points) for i in range(3)]; maxs=[max(p[i] for p in points) for i in range(3)]
bounds=[round(maxs[0]-mins[0],4),round(maxs[1]-mins[1],4),round(maxs[2]-mins[2],4)]
bpy.context.scene.unit_settings.system="METRIC"; bpy.context.scene["assetProvenance"]="Original procedural project artwork; no external meshes or textures"
bpy.context.preferences.filepaths.save_version=0
# Geometry and pivots are authored directly in the runtime's Y-up coordinates.
# Disabling Blender's automatic Y-up remap preserves those local node transforms
# and keeps CourierBicycle identity in the exported hierarchy.
bpy.ops.export_scene.gltf(filepath=str(OUT/"courier_bicycle.glb"),export_format="GLB",export_apply=True,export_yup=False,export_materials="EXPORT",export_cameras=False,export_lights=False)
glb_path=OUT/"courier_bicycle.glb"; blob=glb_path.read_bytes(); n,_=struct.unpack_from("<II",blob,12)
gltf=json.loads(blob[20:20+n])
# Blender exports a linked base-color texture with a white factor. Restore the
# authored palette factors explicitly so neutral luminance maps multiply by the
# intended color in every glTF viewer and remain safely recolorable at runtime.
for material in gltf.get("materials",[]):
    if material.get("name") in COLORS:
        material.setdefault("pbrMetallicRoughness",{})["baseColorFactor"]=list(COLORS[material["name"]])
json_bytes=json.dumps(gltf,separators=(",",":")).encode(); json_bytes+=b" "*((-len(json_bytes))%4)
tail=blob[20+n:]; rebuilt=struct.pack("<4sII",b"glTF",2,20+len(json_bytes)+len(tail))+struct.pack("<II",len(json_bytes),0x4E4F534A)+json_bytes+tail
glb_path.write_bytes(rebuilt)
tris=sum(gltf["accessors"][p["indices"]]["count"]//3 for m in gltf["meshes"] for p in m["primitives"])
exported_vertices=sum(gltf["accessors"][p["attributes"]["POSITION"]]["count"] for m in gltf["meshes"] for p in m["primitives"])
manifest={"formatVersion":1,"generator":"art/generate_courier_bicycle.py","provenance":"Original procedural project artwork. No external meshes or textures.",
 "units":"meters","upAxis":"Y","forwardAxis":"-Z","root":"CourierBicycle","origin":"ground contact",
 "dimensions":{"widthX":bounds[0],"heightY":bounds[1],"lengthZ":bounds[2]},"wheelRadius":.34,"wheelbase":1.08,
 "animatedNodes":{"RearWheel":{"axis":"local X","pivot":[0,.34,.54]},"FrontAssembly":{"axis":"local Y","pivot":[0,0,-.54]},"FrontWheel":{"axis":"local X","pivotRelativeToFrontAssembly":[0,.34,0]},"Crank":{"axis":"local X","pivot":[0,.45,.06]},
 "limbDrivers":["UpperArm_L","UpperArm_R","Forearm_L","Forearm_R","Rider_Thigh_L","Rider_Thigh_R","Rider_Shin_L","Rider_Shin_R"]},
 "attachments":["Cargo_Attach","Seat_Attach","Grip_L_Attach","Grip_R_Attach","Pedal_L_Attach","Pedal_R_Attach","Shoulder_L_Attach","Shoulder_R_Attach","Hip_L_Attach","Hip_R_Attach"],
 "appearance":{"faceProfiles":["Face_Profile_Classic","Face_Profile_Soft","Face_Profile_Angular"],"defaultProfile":"Face_Profile_Classic","inactiveProfiles":"Runtime visibility toggle; all profiles export at identity scale.",
 "isolatedMaterials":["Rider_Skin","Rider_Hair","Rider_Helmet","Rider_Shirt","Rider_Shorts","Rider_Shoes","Courier_Bag","Courier_Bag_Trim"],
 "surfaceMaps":"Deterministic 64 px neutral luminance maps generated by this script, packed in the Blender source and embedded in the GLB; authored colors remain in glTF baseColorFactor."},
 "generation":{"blenderVersion":bpy.app.version_string,"objectCount":len(bpy.data.objects),"meshCount":len(gltf["meshes"]),"nodeCount":len(gltf["nodes"]),"materialCount":len(gltf.get("materials",[])),"imageCount":len(gltf.get("images",[])),"textureCount":len(gltf.get("textures",[])),"vertexCount":exported_vertices,"triangleCount":tris}}
(OUT/"courier_bicycle.manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")

# Keep the editable Blender source upright and colored in Blender's native Z-up
# viewport. Packed luminance maps remain available for inspection and export.
# This rotation is saved only after the identity-root GLB has been exported.
root.rotation_euler.x=math.pi/2
for name in TEXTURED:
    bsdf=M[name].node_tree.nodes["Principled BSDF"]
    for link in list(M[name].node_tree.links):
        if link.to_socket==bsdf.inputs["Base Color"]: M[name].node_tree.links.remove(link)
    bsdf.inputs["Base Color"].default_value=COLORS[name]
soft.hide_render=True; soft.hide_viewport=True
angular.hide_render=True; angular.hide_viewport=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"art"/"courier_bicycle.blend"))

# Four linked hierarchy copies for a neutral close-up contact sheet.
def duplicate_tree(src,parent=None):
    dst=src.copy(); dst.data=src.data.copy() if getattr(src,"data",None) and src.type in {"CURVE"} else src.data
    bpy.context.collection.objects.link(dst); dst.parent=parent
    for child in src.children: duplicate_tree(child,dst)
    return dst
root.hide_render=True
views=[((-1.45,0,2.15),math.pi/2),((1.45,0,2.15),0),((-1.45,0,.45),math.pi),((1.45,0,.45),-.68)]
for i,(loc,angle) in enumerate(views):
    pivot=empty(f"PreviewPivot_{i+1}",loc); pivot.rotation_euler.z=angle
    copy=duplicate_tree(root,pivot); copy.name=f"Preview_{i+1}"; copy.hide_render=False; copy.location=(0,0,0)
bpy.ops.mesh.primitive_plane_add(size=9,location=(0,0,-.015)); ground=bpy.context.object; ground.data.materials.append(M["Rider_Helmet"])
bpy.ops.object.camera_add(location=(0,-8.4,3.2)); cam=bpy.context.object; bpy.context.scene.camera=cam
cam.rotation_euler=(Vector((0,0,2.0))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type="ORTHO"; cam.data.ortho_scale=8.0
for loc,energy,size in [((-4,-5,7),1150,5),((4,-2,4),700,4)]:
    bpy.ops.object.light_add(type="AREA",location=loc); light=bpy.context.object; light.data.energy=energy; light.data.size=size; light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene; scene.render.engine="BLENDER_EEVEE"; scene.render.resolution_x=1800; scene.render.resolution_y=1050; scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"; scene.render.filepath=str(OUT/"courier_bicycle_preview.png"); scene.view_settings.look="AgX - Medium High Contrast"
scene.world.use_nodes=True; scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.035,.055,.06,1); scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.5
bpy.ops.render.render(write_still=True)
# Dedicated three-quarter head and upper-body closeup for facial and garment QA.
def set_render_tree(node,hidden):
    node.hide_render=hidden
    for child in node.children: set_render_tree(child,hidden)
for i in range(1,5): set_render_tree(bpy.data.objects[f"PreviewPivot_{i}"],i!=3)
# Keep alternate identity-scale profiles out of the still; runtime controls them.
for o in bpy.data.objects:
    if o.name.startswith("Face_Profile_Soft") or o.name.startswith("Face_Profile_Angular"): set_render_tree(o,True)
bpy.context.view_layer.update()
heads=[o for o in bpy.data.objects if o.name.startswith("Classic_Head") and not o.hide_render]
head=heads[-1]; head_points=[head.matrix_world@Vector(corner) for corner in head.bound_box]
target=Vector((sum(p.x for p in head_points)/8,0,sum(p.z for p in head_points)/8-.18))
cam.location=(target.x,-6.0,target.z+.1); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=.95
scene.render.resolution_x=1000; scene.render.resolution_y=1000; scene.render.filepath=str(OUT/"courier_bicycle_closeup.png")
bpy.ops.render.render(write_still=True)
print(json.dumps(manifest["generation"],indent=2))
