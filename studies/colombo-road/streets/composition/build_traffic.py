"""Generate compact original ambient traffic assets for the street composition."""
from __future__ import annotations
import json, math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[4]
SRC=ROOT/"studies/colombo-road/streets/composition"
PUB=ROOT/"studies/colombo-road/viewer/public/streets/composition"
BLEND=SRC/"traffic.blend"; GLB=PUB/"traffic.glb"; MANIFEST=PUB/"traffic.manifest.json"
SRC.mkdir(parents=True,exist_ok=True); PUB.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

SPECS={
 "MAT_CarBlue":((.025,.16,.30,1),.34,.48),"MAT_VanOchre":((.68,.27,.035,1),.45,.25),
 "MAT_ScooterRed":((.52,.025,.02,1),.38,.32),"MAT_BikeGreen":((.025,.32,.19,1),.4,.5),
 "MAT_Rubber":((.012,.014,.015,1),.9,.0),"MAT_Rim":((.34,.37,.38,1),.3,.75),
 "MAT_GlassDark":((.018,.045,.06,1),.18,.25),"MAT_Headlight":((1,.78,.33,1),.25,.1),
 "MAT_Taillight":((.8,.015,.006,1),.3,.0),"MAT_White":((.86,.83,.72,1),.65,.0),
 "MAT_Charcoal":((.035,.04,.042,1),.72,.05),"MAT_Skin":((.45,.22,.12,1),.78,.0),
 "MAT_Helmet":((.92,.55,.04,1),.3,.3),"MAT_Shirt":((.08,.28,.56,1),.72,.0),
 "MAT_Trousers":((.035,.07,.12,1),.83,.0),"MAT_Crate":((.28,.12,.035,1),.8,.0),
}
def mat(name,s):
 m=bpy.data.materials.new(name); c,r,metal=s; m.diffuse_color=c; m.use_nodes=True
 b=m.node_tree.nodes.get("Principled BSDF"); b.inputs["Base Color"].default_value=c; b.inputs["Roughness"].default_value=r; b.inputs["Metallic"].default_value=metal
 return m
M={n:mat(n,s) for n,s in SPECS.items()}; ASSETS=[]

def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; o.location=loc; return o
def root(name,asset_id,category,label):
 o=empty(name); o["asset_id"]=asset_id;o["category"]=category;o["label"]=label;o["front_axis_gltf"]="+Z";o["up_axis_gltf"]="+Y";o["origin"]="ground-center";ASSETS.append(o);return o
def box(p,n,loc,size,ma,bev=.03,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot);o=bpy.context.object;o.name=n;o.scale=tuple(x/2 for x in size);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[ma]);o.parent=p
 if bev: md=o.modifiers.new("edge-softening","BEVEL");md.width=bev;md.segments=1
 return o
def cyl(p,n,loc,r,d,ma,v=12,rot=(0,0,0),bev=.01):
 bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=loc,rotation=rot);o=bpy.context.object;o.name=n;o.data.materials.append(M[ma]);o.parent=p
 if bev: md=o.modifiers.new("edge-softening","BEVEL");md.width=bev;md.segments=1
 return o
def sphere(p,n,loc,scale,ma,seg=12,rings=8):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[ma]);o.parent=p;return o
def bar(p,n,a,b,r,ma):
 a,b=Vector(a),Vector(b); mid=(a+b)/2; vec=b-a
 o=cyl(p,n,mid,r,vec.length,ma,10);o.rotation_mode="QUATERNION";o.rotation_quaternion=Vector((0,0,1)).rotation_difference(vec.normalized());return o
def wheel(p,n,loc,r=.32,width=.19):
 pivot=empty(n,p,loc); cyl(pivot,n+"__Tire",(0,0,0),r,width,"MAT_Rubber",16,rot=(0,math.pi/2,0),bev=.018);cyl(pivot,n+"__Rim",(0,0,0),r*.58,width+.015,"MAT_Rim",12,rot=(0,math.pi/2,0),bev=.008);return pivot
def bicycle_wheel(p,n,loc,r=.36):
 pivot=empty(n,p,loc)
 for radius,minor,ma in ((r,.035,"MAT_Rubber"),(r*.87,.014,"MAT_Rim")):
  bpy.ops.mesh.primitive_torus_add(major_radius=radius-minor,minor_radius=minor,major_segments=16,minor_segments=6,location=(0,0,0),rotation=(0,math.pi/2,0))
  o=bpy.context.object;o.name=n+("__Tire" if ma=="MAT_Rubber" else "__Rim");o.data.materials.append(M[ma]);o.parent=pivot
 cyl(pivot,n+"__Hub",(0,0,0),.035,.10,"MAT_Rim",10,rot=(0,math.pi/2,0),bev=.004)
 for a in range(0,360,30):
  q=math.radians(a);bar(pivot,n+"__Spoke",(0,0,0),(0,math.cos(q)*r*.84,math.sin(q)*r*.84),.004,"MAT_Rim")
 return pivot

def compact_car():
 r=root("TRAFFIC_CompactCar","traffic-compact-car","car","Compact hatchback")
 box(r,"lower-body",(0,0,.53),(1.72,3.72,.62),"MAT_CarBlue",.12);box(r,"cabin",(0,.12,1.08),(1.54,1.92,.72),"MAT_CarBlue",.14)
 box(r,"windshield-front",(0,-.88,1.13),(1.28,.06,.48),"MAT_GlassDark",.025,rot=(math.radians(-15),0,0));box(r,"rear-glass",(0,1.09,1.12),(1.25,.06,.43),"MAT_GlassDark",.02,rot=(math.radians(15),0,0))
 for x in (-.79,.79):
  for y in (-1.18,1.16): wheel(r,("TRAFFIC_CompactCar__Wheel_"+("F" if y<0 else "R")+("L" if x<0 else "R")),(x,y,.34),.34,.19)
  box(r,"side-window",(x*1.01,.05,1.12),(.045,1.52,.44),"MAT_GlassDark",.012)
 for x in (-.52,.52): box(r,"headlight",(x,-1.88,.61),(.38,.07,.20),"MAT_Headlight",.04);box(r,"taillight",(x,1.88,.61),(.34,.07,.19),"MAT_Taillight",.03)
 box(r,"front-bumper",(0,-1.91,.33),(1.5,.13,.18),"MAT_Charcoal",.035);box(r,"rear-bumper",(0,1.91,.33),(1.5,.13,.18),"MAT_Charcoal",.035)

def delivery_van():
 r=root("TRAFFIC_DeliveryVan","traffic-delivery-van","van","Original unbranded delivery van")
 box(r,"van-body",(0,.15,1.05),(1.92,4.58,1.78),"MAT_VanOchre",.12);box(r,"cab-roof",(0,-1.25,1.84),(1.82,1.48,.44),"MAT_White",.1)
 box(r,"windshield",(0,-2.16,1.55),(1.55,.06,.63),"MAT_GlassDark",.025,rot=(math.radians(-9),0,0))
 for x in (-.88,.88):
  for y in (-1.48,1.45): wheel(r,("TRAFFIC_DeliveryVan__Wheel_"+("F" if y<0 else "R")+("L" if x<0 else "R")),(x,y,.39),.39,.20)
  box(r,"cab-side-glass",(x*1.01,-1.25,1.52),(.05,1.02,.62),"MAT_GlassDark",.012)
 for x in (-.6,.6): box(r,"van-headlight",(x,-2.31,.66),(.4,.08,.24),"MAT_Headlight",.04);box(r,"van-tail",(x,2.46,.76),(.22,.08,.48),"MAT_Taillight",.035)
 box(r,"parcel-mark",(0,-2.36,1.08),(.58,.05,.34),"MAT_White",.03);box(r,"rear-door-split",(0,2.47,1.25),(.045,.05,1.5),"MAT_Charcoal",.006)

def person(r,prefix,hip,lean=0):
 pelvis=empty(prefix+"__Pelvis",r,hip);box(pelvis,prefix+"__Torso",(0,0,.33),(.43,.27,.62),"MAT_Shirt",.09,rot=(lean,0,0));sphere(pelvis,prefix+"__Head",(0,-math.sin(lean)*.55,.73),(.18,.17,.20),"MAT_Skin")
 sphere(pelvis,prefix+"__Helmet",(0,-math.sin(lean)*.55,.84),(.21,.20,.13),"MAT_Helmet");return pelvis
def limb(parent,name,a,b,r,ma):
 pivot=empty(name,parent,a); bar(pivot,name+"__Mesh",(0,0,0),Vector(b)-Vector(a),r,ma);return pivot
def cyclist_leg(parent,side,hip,knee,ankle):
 name="TRAFFIC_BicycleRider__Leg_"+side
 hip_node=empty(name,parent,hip)
 knee_rel=Vector(knee)-Vector(hip); ankle_rel=Vector(ankle)-Vector(knee)
 bar(hip_node,name+"__Upper",(0,0,0),knee_rel,.068,"MAT_Trousers")
 knee_node=empty("TRAFFIC_BicycleRider__Knee_"+side,hip_node,knee_rel)
 bar(knee_node,name+"__Lower",(0,0,0),ankle_rel,.058,"MAT_Skin")
 foot=empty("TRAFFIC_BicycleRider__Foot_"+side,knee_node,ankle_rel)
 box(foot,name+"__Shoe",(0,-.015,.015),(.20,.31,.09),"MAT_Charcoal",.025)
 return name,knee_node.name,foot.name
def articulated_arm(parent,prefix,side,shoulder,elbow,hand):
 name=prefix+"__Arm_"+side; upper=empty(name,parent,shoulder);er=Vector(elbow)-Vector(shoulder);hr=Vector(hand)-Vector(elbow)
 bar(upper,name+"__Upper",(0,0,0),er,.052,"MAT_Shirt");joint=empty(prefix+"__Elbow_"+side,upper,er);sphere(joint,name+"__ElbowJoint",(0,0,0),(.06,.06,.06),"MAT_Skin",8,6);bar(joint,name+"__Forearm",(0,0,0),hr,.045,"MAT_Skin");sphere(joint,name+"__Hand",hr,(.065,.055,.07),"MAT_Skin",8,6)
 return name,joint.name
def scooter_leg(parent,side,hip,knee,foot):
 name="TRAFFIC_ScooterRider__Leg_"+side; upper=empty(name,parent,hip);kr=Vector(knee)-Vector(hip);fr=Vector(foot)-Vector(knee)
 bar(upper,name+"__Upper",(0,0,0),kr,.07,"MAT_Trousers");joint=empty("TRAFFIC_ScooterRider__Knee_"+side,upper,kr);sphere(joint,name+"__KneeJoint",(0,0,0),(.075,.075,.075),"MAT_Trousers",8,6);bar(joint,name+"__Lower",(0,0,0),fr,.058,"MAT_Trousers");shoe=empty("TRAFFIC_ScooterRider__Foot_"+side,joint,fr);box(shoe,name+"__Shoe",(0,-.05,0),(.19,.30,.09),"MAT_Charcoal",.025)

BIKE_PELVIS=Vector((0,.34,.91)); BIKE_CRANK=Vector((0,.05,.39)); BIKE_CRANK_RADIUS=.24; BIKE_SEGMENT=.52
BIKE_HIPS={"L":BIKE_PELVIS+Vector((-.13,.02,.12)),"R":BIKE_PELVIS+Vector((.13,.02,.12))}
BIKE_ANKLES={"L":BIKE_CRANK+Vector((-.07,-BIKE_CRANK_RADIUS,0)),"R":BIKE_CRANK+Vector((.07,BIKE_CRANK_RADIUS,0))}
def solve_bike_knee(hip,ankle,bend=.30):
 d=ankle-hip; distance=d.length
 along=(BIKE_SEGMENT**2-BIKE_SEGMENT**2+distance**2)/(2*distance); height=math.sqrt(max(0,BIKE_SEGMENT**2-along**2))
 perpendicular=Vector((0,-d.z,d.y)).normalized(); return hip+d.normalized()*along+perpendicular*height*(1 if bend>=0 else -1)
BIKE_KNEES={side:solve_bike_knee(BIKE_HIPS[side],BIKE_ANKLES[side]) for side in ("L","R")}
def audit_bicycle_reach(samples=144):
 for side,x in (("L",-.07),("R",.07)):
  distances=[]
  for i in range(samples):
   angle=2*math.pi*i/samples; target=BIKE_CRANK+Vector((x,math.cos(angle)*BIKE_CRANK_RADIUS,math.sin(angle)*BIKE_CRANK_RADIUS));distances.append((target-BIKE_HIPS[side]).length)
  assert max(distances)<=BIKE_SEGMENT*2+1e-6, f"{side} pedal exceeds leg reach: {max(distances):.4f}"
  assert min(distances)>=0, f"{side} invalid pedal reach"
 left=BIKE_ANKLES["L"]-BIKE_CRANK;right=BIKE_ANKLES["R"]-BIKE_CRANK
 assert abs(left.y+right.y)<1e-9 and abs(left.z+right.z)<1e-9, "Pedals must be 180 degrees apart"
 return {side:{"min":min((BIKE_CRANK+Vector((x,math.cos(2*math.pi*i/samples)*BIKE_CRANK_RADIUS,math.sin(2*math.pi*i/samples)*BIKE_CRANK_RADIUS))-BIKE_HIPS[side]).length for i in range(samples)),"max":max((BIKE_CRANK+Vector((x,math.cos(2*math.pi*i/samples)*BIKE_CRANK_RADIUS,math.sin(2*math.pi*i/samples)*BIKE_CRANK_RADIUS))-BIKE_HIPS[side]).length for i in range(samples))} for side,x in (("L",-.07),("R",.07))}

def scooter():
 r=root("TRAFFIC_ScooterRider","traffic-scooter-rider","motorcycle","Small scooter with helmeted ambient rider")
 wheel(r,"TRAFFIC_ScooterRider__Wheel_Front",(0,-.72,.29),.29,.11);wheel(r,"TRAFFIC_ScooterRider__Wheel_Rear",(0,.68,.29),.29,.12)
 box(r,"scooter-deck",(0,.05,.35),(.34,1.2,.16),"MAT_ScooterRed",.09);sphere(r,"scooter-fairing",(0,-.48,.66),(.31,.35,.46),"MAT_ScooterRed")
 bar(r,"front-fork",(-.14,-.72,.31),(-.14,-.54,1.08),.035,"MAT_Rim");bar(r,"front-fork",(.14,-.72,.31),(.14,-.54,1.08),.035,"MAT_Rim");bar(r,"handlebar",(-.35,-.58,1.1),(.35,-.58,1.1),.035,"MAT_Charcoal")
 box(r,"seat",(0,.35,.79),(.42,.67,.16),"MAT_Charcoal",.08);box(r,"rear-light",(0,.72,.65),(.28,.09,.16),"MAT_Taillight",.03);box(r,"headlamp",(0,-.77,.83),(.24,.09,.19),"MAT_Headlight",.06)
 p=person(r,"TRAFFIC_ScooterRider__Rider",(0,.28,.78),math.radians(10))
 articulated_arm(p,"TRAFFIC_ScooterRider","L",(-.20,-.03,.57),(-.29,-.43,.46),(-.35,-.86,.32));articulated_arm(p,"TRAFFIC_ScooterRider","R",(.20,-.03,.57),(.29,-.43,.46),(.35,-.86,.32))
 scooter_leg(p,"L",(-.13,.02,.08),(-.19,-.06,-.28),(-.17,-.38,-.37));scooter_leg(p,"R",(.13,.02,.08),(.19,-.06,-.28),(.17,-.38,-.37))

def bicycle():
 r=root("TRAFFIC_BicycleRider","traffic-bicycle-rider","bicycle","Original city bicycle with articulated helmeted rider")
 bicycle_wheel(r,"TRAFFIC_BicycleRider__Wheel_Front",(0,-.66,.36),.36);bicycle_wheel(r,"TRAFFIC_BicycleRider__Wheel_Rear",(0,.70,.36),.36)
 crank=empty("TRAFFIC_BicycleRider__Crank",r,(0,.05,.39));cyl(crank,"crank-hub",(0,0,0),.08,.12,"MAT_Rim",12,rot=(0,math.pi/2,0))
 for s in (-1,1):
  bar(crank,"crank-arm",(s*.07,0,0),(s*.07,s*BIKE_CRANK_RADIUS,0),.018,"MAT_Rim");ped=empty("TRAFFIC_BicycleRider__Pedal_"+("L" if s<0 else "R"),crank,(s*.07,s*BIKE_CRANK_RADIUS,0));box(ped,"pedal",(0,0,0),(.19,.07,.035),"MAT_Charcoal",.006)
 for a,b in [((0,.7,.36),(0,.05,.39)),((0,.05,.39),(0,.35,.9)),((0,.35,.9),(0,.7,.36)),((0,.05,.39),(0,-.55,.78)),((0,-.55,.78),(0,-.66,.36))]:bar(r,"frame",a,b,.025,"MAT_BikeGreen")
 bar(r,"fork",(-.04,-.66,.36),(-.04,-.55,.85),.022,"MAT_Rim");bar(r,"handlebar",(-.26,-.56,.87),(.26,-.56,.87),.022,"MAT_Charcoal");box(r,"saddle",(0,.38,.93),(.22,.34,.08),"MAT_Charcoal",.04);box(r,"rear-crate",(0,.73,.83),(.48,.5,.38),"MAT_Crate",.025)
 p=person(r,"TRAFFIC_BicycleRider__Rider",(0,.34,.91),math.radians(18))
 articulated_arm(p,"TRAFFIC_BicycleRider","L",(-.18,-.04,.57),(-.24,-.45,.42),(-.26,-.90,-.04));articulated_arm(p,"TRAFFIC_BicycleRider","R",(.18,-.04,.57),(.24,-.45,.42),(.26,-.90,-.04))
 # Default joint endpoints coincide with their corresponding pedal centers.
 # Runtime can solve the named two-bone chains toward those rotating targets.
 cyclist_leg(p,"L",BIKE_HIPS["L"]-BIKE_PELVIS,BIKE_KNEES["L"]-BIKE_PELVIS,BIKE_ANKLES["L"]-BIKE_PELVIS)
 cyclist_leg(p,"R",BIKE_HIPS["R"]-BIKE_PELVIS,BIKE_KNEES["R"]-BIKE_PELVIS,BIKE_ANKLES["R"]-BIKE_PELVIS)

compact_car();delivery_van();scooter();bicycle(); BIKE_REACH_AUDIT=audit_bicycle_reach()
for o in list(bpy.context.scene.objects):
 if o.type!="MESH":continue
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 for md in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=md.name)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not o.data.uv_layers:o.data.uv_layers.new(name="UVMap")
 o.select_set(False)
bpy.context.scene.unit_settings.system="METRIC";bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene["asset_pack"]="Colombo Ambient Traffic";bpy.context.scene["provenance"]="Original project-authored procedural geometry; no external downloads"
bpy.ops.object.select_all(action="SELECT");bpy.context.view_layer.objects.active=ASSETS[0];bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format="GLB",use_selection=True,export_apply=True,export_texcoords=True,export_materials="EXPORT",export_cameras=False,export_lights=False)

def stats(r):
 meshes=[o for o in r.children_recursive if o.type=="MESH"];pts=[];tris=0
 for o in meshes:
  o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);rel=r.matrix_world.inverted()@o.matrix_world;pts += [rel@Vector(c) for c in o.bound_box]
 lo=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)));hi=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
 nodes=[o.name for o in r.children_recursive]
 wheels=[o.name for o in r.children_recursive if o.type=="EMPTY" and "__Wheel_" in o.name]
 motion={"wheelNodes":wheels,"wheelAxis":"local +X","metersPerUnit":1}
 if "Scooter" in r.name:motion.update({"riderContacts":{"leftHand":[-.35,1.10,.58],"rightHand":[.35,1.10,.58],"leftFoot":[-.17,.41,.10],"rightFoot":[.17,.41,.10]},"contactSpace":"asset-local glTF [x,y,z]"})
 if "Bicycle" in r.name:
  gp=lambda p:[round(p.x,4),round(p.z,4),round(-p.y,4)]
  chains=[]
  for side in ("L","R"):
   chains.append({"side":side,"hip":"TRAFFIC_BicycleRider__Leg_"+side,"knee":"TRAFFIC_BicycleRider__Knee_"+side,"foot":"TRAFFIC_BicycleRider__Foot_"+side,"target":"TRAFFIC_BicycleRider__Pedal_"+side,"rest":{"hip":gp(BIKE_HIPS[side]),"knee":gp(BIKE_KNEES[side]),"ankle":gp(BIKE_ANKLES[side]),"upperLength":BIKE_SEGMENT,"lowerLength":BIKE_SEGMENT}})
  motion.update({"crankNode":"TRAFFIC_BicycleRider__Crank","pedalNodes":["TRAFFIC_BicycleRider__Pedal_L","TRAFFIC_BicycleRider__Pedal_R"],"legNodes":["TRAFFIC_BicycleRider__Leg_L","TRAFFIC_BicycleRider__Leg_R"],"kneeNodes":["TRAFFIC_BicycleRider__Knee_L","TRAFFIC_BicycleRider__Knee_R"],"footNodes":["TRAFFIC_BicycleRider__Foot_L","TRAFFIC_BicycleRider__Foot_R"],"armNodes":["TRAFFIC_BicycleRider__Arm_L","TRAFFIC_BicycleRider__Arm_R"],"riderContacts":{"leftHand":[-.26,.87,.56],"rightHand":[.26,.87,.56],"leftPedal":gp(BIKE_ANKLES["L"]),"rightPedal":gp(BIKE_ANKLES["R"])},"contactSpace":"asset-local glTF [x,y,z]","pedaling":{"solver":"two-bone-ik","crankCenter":gp(BIKE_CRANK),"crankRadius":BIKE_CRANK_RADIUS,"phaseOffsetRadians":{"L":math.pi,"R":0},"chains":chains,"reachAudit":{"samples":144,**BIKE_REACH_AUDIT},"constraint":"Keep each foot pivot coincident with its pedal target; preserve upper/lower rest lengths while solving knee bend."}})
 return {"assetId":r["asset_id"],"category":r["category"],"nodeName":r.name,"label":r["label"],"bounds":{"min":[round(lo.x,3),round(lo.z,3),round(-hi.y,3)],"max":[round(hi.x,3),round(hi.z,3),round(-lo.y,3)]},"size":{"width":round(hi.x-lo.x,3),"height":round(hi.z-lo.z,3),"length":round(hi.y-lo.y,3)},"triangles":tris,"meshNodes":len(meshes),"motion":motion}
assets=[stats(r) for r in ASSETS]
manifest={"schemaVersion":1,"assetPack":"colombo-ambient-traffic","glb":"/streets/composition/traffic.glb","coordinateSystem":{"upAxis":"+Y","frontAxis":"+Z","origin":"ground-center","unit":"meter"},"authoredWith":{"generator":"studies/colombo-road/streets/composition/build_traffic.py","source":"studies/colombo-road/streets/composition/traffic.blend"},"provenance":"Original project-authored Blender procedural geometry. No external models, downloads, trademarks, or hero-character geometry.","usage":"Clone top-level roots. Animate named wheel pivots around local X. Rider limb pivots are rigid ambient articulation nodes.","assets":assets,"materials":[{"id":n,"baseColor":[round(x,3) for x in s[0][:3]],"roughness":s[1],"metallic":s[2]} for n,s in SPECS.items()],"stats":{"assets":len(assets),"triangles":sum(a["triangles"] for a in assets),"meshNodes":sum(a["meshNodes"] for a in assets),"glbBytes":GLB.stat().st_size},"budgets":{"triangleTargetMax":30000,"glbTargetBytesMax":4194304}}
MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n")
print(json.dumps({"blend":str(BLEND),"glb":str(GLB),"manifest":str(MANIFEST),"stats":manifest["stats"]},indent=2))
