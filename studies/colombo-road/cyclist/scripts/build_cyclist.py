"""Build a cycling-pose rig from the original courier mesh and approved bicycle.

Automatic heat weights are solved on a closed volume proxy, then transferred to
the untouched textured surface. The proxy never becomes the visible character.
"""
from pathlib import Path
import bpy, math, json
from mathutils import Vector, Matrix, Quaternion
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'viewer/public/cyclist'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/courier-static.blend'))
body=next(o for o in bpy.data.objects if o.type=='MESH' and 'TeenCourier' in o.name)
for o in list(bpy.data.objects):
    if o!=body:bpy.data.objects.remove(o,do_unlink=True)
body.parent=None
bpy.context.view_layer.objects.active=body
body.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.vertex_groups.clear()
for m in list(body.modifiers):body.modifiers.remove(m)
body.name='CourierSurface'
S=1.12
for v in body.data.vertices:v.co*=S

definitions=[
 ('Pelvis',None,(0,0,.84),(0,0,.96)),
 ('Spine','Pelvis',(0,0,.96),(0,-.02,1.13)),
 ('Chest','Spine',(0,-.02,1.13),(0,-.035,1.28)),
 ('Neck','Chest',(0,-.035,1.28),(0,-.012,1.40)),
 ('Head','Neck',(0,-.012,1.40),(0,.03,1.59)),
]
for side,sign in [('L',-1),('R',1)]:
    definitions.extend([
      (f'Clavicle_{side}','Chest',(0,-.035,1.25),(sign*.15,-.04,1.25)),
      (f'UpperArm_{side}',f'Clavicle_{side}',(sign*.15,-.04,1.25),(sign*.236,-.047,1.003)),
      (f'Forearm_{side}',f'UpperArm_{side}',(sign*.236,-.047,1.003),(sign*.316,.003,.782)),
      (f'Hand_{side}',f'Forearm_{side}',(sign*.316,.003,.782),(sign*.343,.035,.658)),
      (f'Thigh_{side}','Pelvis',(sign*.085,0,.826),(sign*.12,-.015,.471)),
      (f'Shin_{side}',f'Thigh_{side}',(sign*.12,-.015,.471),(sign*.16,-.085,.104)),
      (f'Foot_{side}',f'Shin_{side}',(sign*.16,-.085,.104),(sign*.16,.105,.048)),
    ])
data=bpy.data.armatures.new('CourierSkeleton')
rig=bpy.data.objects.new('CyclistRig',data);bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,parent,head,tail in definitions:
    bone=data.edit_bones.new(name);bone.head=Vector(head)*S;bone.tail=Vector(tail)*S
    if parent:bone.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

proxy=body.copy();proxy.data=body.data.copy();proxy.name='WeightVolume';bpy.context.collection.objects.link(proxy)
bpy.ops.object.select_all(action='DESELECT');proxy.select_set(True);bpy.context.view_layer.objects.active=proxy
remesh=proxy.modifiers.new('Closed anatomical weighting volume','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.013
remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
weighted=sum(bool(v.groups) for v in proxy.data.vertices)
print('HEAT_WEIGHT_VERTICES',weighted,len(proxy.data.vertices),flush=True)
if weighted<len(proxy.data.vertices)*.99:raise RuntimeError('Heat binding did not cover the weighting volume')
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
for g in proxy.vertex_groups:body.vertex_groups.new(name=g.name)
transfer=body.modifiers.new('Anatomical volume weight transfer','DATA_TRANSFER');transfer.object=proxy
transfer.use_vert_data=True;transfer.data_types_verts={'VGROUP_WEIGHTS'};transfer.vert_mapping='POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier=transfer.name)
weighted_vertices=[v for v in body.data.vertices if sum(g.weight for g in v.groups)>.00001]
tree=KDTree(len(weighted_vertices))
for i,v in enumerate(weighted_vertices):tree.insert(v.co,i)
tree.balance()
filled=0
for v in body.data.vertices:
    weights=[(g.group,g.weight) for g in v.groups]
    if sum(w for _,w in weights)<.00001:
        _,i,d=tree.find(v.co)
        weights=[(g.group,g.weight) for g in weighted_vertices[i].groups]
        dominant=body.vertex_groups[max(weights,key=lambda pair:pair[1])[0]].name
        if d>.085 or not dominant.startswith('Hand_'):
            raise RuntimeError(f'Unbound vertex {v.index}: nearest solved region {dominant}, {d:.4f}m away')
        filled+=1
    weights=sorted(weights,key=lambda pair:pair[1],reverse=True)[:4]
    total=sum(w for _,w in weights)
    for g in body.vertex_groups:g.remove([v.index])
    for group,w in weights:body.vertex_groups[group].add([v.index],w/total,'REPLACE')
print('UNBOUND_TIP_VERTICES_REPAIRED',filled,flush=True)
body.parent=rig;body.matrix_parent_inverse=Matrix.Identity(4)
arm=body.modifiers.new('Courier deformation','ARMATURE');arm.object=rig
bpy.data.objects.remove(proxy,do_unlink=True)
for p in body.data.polygons:p.use_smooth=True

def update():bpy.context.view_layer.update()
def place_bone(name,head,tail):
    bone=rig.pose.bones[name];rest=bone.bone
    q=(rest.tail_local-rest.head_local).rotation_difference(Vector(tail)-Vector(head))
    matrix=q.to_matrix().to_4x4()@rest.matrix_local
    matrix.translation=Vector(head)
    bone.matrix=matrix;update()

def ik(a,b,target,pole):
    root=rig.pose.bones[a].head.copy();target=Vector(target)
    l1=rig.data.bones[a].length;l2=rig.data.bones[b].length
    d=(target-root).length;direction=(target-root).normalized();d=min(d,l1+l2-.00001)
    target=root+direction*d
    along=(l1*l1-l2*l2+d*d)/(2*d)
    bend=(Vector(pole)-root);bend-=direction*bend.dot(direction);bend.normalize()
    joint=root+direction*along+bend*math.sqrt(max(0,l1*l1-along*along))
    place_bone(a,root,joint);place_bone(b,joint,target)

def grip_hand(side,sign,wrist):
    bone=rig.pose.bones[f'Hand_{side}'];rest=bone.bone
    direction=Vector((0,.10,-.045)).normalized()
    q=(rest.tail_local-rest.head_local).rotation_difference(direction)
    normal=q@Vector((-sign,0,0));normal-=direction*normal.dot(direction);normal.normalize()
    desired=Vector((0,0,-1));desired-=direction*desired.dot(direction);desired.normalize()
    angle=math.atan2(direction.dot(normal.cross(desired)),normal.dot(desired))
    forearm=rig.pose.bones[f'Forearm_{side}'];pivot=forearm.head.copy()
    twist=Quaternion((forearm.tail-forearm.head).normalized(),angle*.65).to_matrix().to_4x4()
    forearm.matrix=Matrix.Translation(pivot)@twist@Matrix.Translation(-pivot)@forearm.matrix
    update()
    matrix=(Quaternion(direction,angle)@q).to_matrix().to_4x4()@rest.matrix_local
    matrix.translation=bone.head.copy();bone.matrix=matrix;update()

def pose(phase):
    for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
    update()
    pelvis=rig.pose.bones['Pelvis'];origin=pelvis.head.copy()
    target=Vector((0,-.2753,1.025))
    rotation=Matrix.Rotation(math.radians(-39),4,'X')
    pelvis.matrix=Matrix.Translation(target)@rotation@Matrix.Translation(-origin)@pelvis.matrix
    update()
    # Maintain a forward gaze while the torso inclines towards the handlebar.
    for name,angle in [('Neck',17),('Head',17)]:
        p=rig.pose.bones[name];pivot=p.head.copy()
        p.matrix=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(angle),4,'X')@Matrix.Translation(-pivot)@p.matrix;update()
    for side,sign in [('L',-1),('R',1)]:
        wrist=Vector((sign*.287,.260,1.037))
        ik(f'UpperArm_{side}',f'Forearm_{side}',wrist,(sign*.50,-.05,1.05))
        grip_hand(side,sign,wrist)
        pedalPhase=phase+(0 if side=='L' else math.pi)
        pedal=Vector((sign*.112,-.097-.17*math.cos(pedalPhase),.289+.17*math.sin(pedalPhase)))
        ankle=pedal+Vector((-sign*.035*S,-.115*S,.104*S+.010))
        ik(f'Thigh_{side}',f'Shin_{side}',ankle,(sign*.17,.38,.88))
        place_bone(f'Foot_{side}',rig.pose.bones[f'Foot_{side}'].head,ankle+Vector((0,.19,-.056))*S)
    update()

pose(0)
# A small editable grip correction closes the relaxed source fingers toward
# the bar. It stays separate from the untouched Basis shape and skin weights.
body.shape_key_add(name='Basis')
grip=body.shape_key_add(name='HandlebarGrip');grip.value=1
skin={p.name:p.matrix@p.bone.matrix_local.inverted() for p in rig.pose.bones}
for v in body.data.vertices:
    hand=sum(g.weight for g in v.groups if body.vertex_groups[g.group].name.startswith('Hand_'))
    if hand<.8 or v.co.z>.715*S:continue
    u=max(0,min(1,(.715*S-v.co.z)/(.11*S)))
    falloff=u*u*(3-2*u)
    matrix=Matrix(((0,0,0,0),)*4)
    for g in v.groups:matrix+=skin[body.vertex_groups[g.group].name]*g.weight
    point=matrix@v.co
    point+=Vector((0,-.029*falloff,.025*falloff*falloff))
    grip.data[v.index].co=matrix.inverted()@point
rig['source']='Original Colombo courier reconstruction, retargeted on anatomical volume weights'
rig['rig_status']='Local cycling deformation candidate; requires visual review'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.context.scene.render.fps=24
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=49
for frame in range(1,50):
    bpy.context.scene.frame_set(frame);pose((frame-1)/48*math.tau)
    for p in rig.pose.bones:
        p.rotation_mode='QUATERNION'
        p.keyframe_insert('location',frame=frame)
        p.keyframe_insert('rotation_quaternion',frame=frame)
        p.keyframe_insert('scale',frame=frame)
rig.animation_data.action.name='Pedal'
bpy.context.scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'colombo-cyclist.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'rider.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True)
# The editable handover includes the fitted bicycle in Blender's Z-up space.
# Only the rider was selected for the standalone browser GLB above.
bpy.ops.import_scene.gltf(filepath=str(OUT/'bicycle-fitted.glb'))
parts={name:bpy.data.objects[name] for name in ['Crank','Pedal_L','Pedal_R','FrontWheel','RearWheel']}
rotations={name:o.rotation_quaternion.copy() for name,o in parts.items()}
for frame in range(1,50):
    bpy.context.scene.frame_set(frame);phase=(frame-1)/48*math.tau
    for name,o in parts.items():
        angle=phase if name.startswith('Pedal_') else -phase*(2.8 if name.endswith('Wheel') else 1)
        o.rotation_mode='QUATERNION';o.rotation_quaternion=rotations[name]@Quaternion(Vector((1,0,0)),angle)
        o.keyframe_insert('rotation_quaternion',frame=frame)
        o.animation_data.action.name=name+'_Cycle'
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.shading.type='MATERIAL';space.clip_start=.02
            space.region_3d.view_distance=4.4;space.region_3d.view_location=Vector((0,0,.9))
            space.region_3d.view_rotation=Vector((3,-4,2)).to_track_quat('Z','Y')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'colombo-cyclist.blend'),compress=True)
print('CYCLIST_EXPORTED',str(OUT/'rider.glb'),flush=True)
