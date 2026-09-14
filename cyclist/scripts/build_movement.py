"""Add locomotion clips to a copy of the approved cyclist without rebinding it."""
from pathlib import Path
import bpy, math, json
from mathutils import Vector, Matrix, Quaternion

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'viewer/public/cyclist'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'colombo-cyclist.blend'))
rig=bpy.data.objects['CyclistRig'];body=bpy.data.objects['CourierSurface']
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
pedal=rig.animation_data.action
seated={p.name:p.matrix.copy() for p in rig.pose.bones}
for o in list(bpy.data.objects):
    if o not in (rig,body):bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):
    if a!=pedal:bpy.data.actions.remove(a)
pedal.use_fake_user=True
rig.animation_data_clear()
S=1.12
def update():bpy.context.view_layer.update()
def reset():
    for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
    update()
def rotate(name,angle,axis='X'):
    p=rig.pose.bones[name];pivot=p.head.copy()
    p.matrix=Matrix.Translation(pivot)@Matrix.Rotation(angle,4,axis)@Matrix.Translation(-pivot)@p.matrix;update()
def place(name,head,tail):
    p=rig.pose.bones[name];r=p.bone
    q=(r.tail_local-r.head_local).rotation_difference(Vector(tail)-Vector(head))
    m=q.to_matrix().to_4x4()@r.matrix_local;m.translation=Vector(head);p.matrix=m;update()
def ik(a,b,target,pole):
    root=rig.pose.bones[a].head.copy();target=Vector(target)
    l1=rig.data.bones[a].length;l2=rig.data.bones[b].length
    direction=(target-root).normalized();d=max(.001,min((target-root).length,l1+l2-.00001))
    along=(l1*l1-l2*l2+d*d)/(2*d)
    bend=Vector(pole)-root;bend-=direction*bend.dot(direction);bend.normalize()
    joint=root+direction*along+bend*math.sqrt(max(0,l1*l1-along*along))
    place(a,root,joint);place(b,joint,root+direction*d)
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def path(t,keys):
    if t<=keys[0][0]:return Vector(keys[0][1])
    for (a,p),(b,q) in zip(keys,keys[1:]):
        if t<=b:return Vector(p).lerp(Vector(q),smooth((t-a)/(b-a)))
    return Vector(keys[-1][1])
def pelvis_at(position,lean=0):
    p=rig.pose.bones['Pelvis'];p.matrix.translation=Vector(position);update()
    rotate('Pelvis',-lean);rotate('Neck',lean*.435);rotate('Head',lean*.435)
def foot(side,ankle,pole):
    ik('Thigh_'+side,'Shin_'+side,ankle,pole)
    p=rig.pose.bones['Foot_'+side]
    place(p.name,p.head,p.head+Vector((0,.19,-.056))*S)
def arms(offset,phase=0,reach=0):
    for side,sign in [('L',-1),('R',1)]:
        relaxed=offset+Vector((sign*.235,-.025+sign*.13*math.sin(phase),.865))
        target=relaxed.lerp(Vector((sign*.287,.260,1.037)),reach)
        ik('UpperArm_'+side,'Forearm_'+side,target,offset+Vector((sign*.37,-.11,1.02)))
        p=rig.pose.bones['Hand_'+side]
        direction=Vector((sign*.015,.015,-.13)).lerp(Vector((0,.10,-.045)),reach)
        place(p.name,p.head,p.head+direction)
        if reach:
            # Match the approved palm rotation as the hand reaches the bar.
            loc,rot,scale=p.matrix.decompose();_,goal,_=seated[p.name].decompose()
            p.matrix=Matrix.LocRotScale(loc,rot.slerp(goal,reach),scale);update()
def idle(t=0,offset=Vector((0,0,0))):
    reset();pelvis_at(offset+Vector((0,0,.918)))
    rotate('Chest',math.radians(.4)*math.sin(t*math.tau))
    for side,sign in [('L',-1),('R',1)]:
        foot(side,offset+Vector((sign*.11,-.0952,.11648)),offset+Vector((sign*.15,.28,.55)))
    arms(offset)
def walk(t):
    reset();phase=t*math.tau
    # Lower during double support, rise over the planted leg, then transfer
    # weight. One clip cycle travels one metre in the runtime.
    pelvis_at(Vector((-.014*math.sin(phase),0,.903-.015*math.cos(2*phase))),math.radians(4))
    rotate('Pelvis',math.radians(1.5)*math.sin(phase),'Z')
    rotate('Chest',-math.radians(3)*math.sin(phase),'Z')
    for side,sign in [('L',-1),('R',1)]:
        p=(t+(0 if side=='L' else .5))%1
        if p<.6:
            y=.3-p;z=0
            if p<.10:
                pitch=math.radians(14)*(1-smooth(p/.10));pivot=-.08
            else:
                pitch=-math.radians(28)*smooth((p-.38)/.22);pivot=.21
        else:
            u=(p-.6)/.4;y=-.3+.6*smooth(u);z=.075*math.sin(math.pi*u)**2
            pitch=math.radians(-28+42*smooth(u));pivot=.21-.29*smooth(u)
        # Rock the shoe around its heel/toe contact, not around a floating ankle.
        contact=Vector((0,pivot,-.11648))
        correction=contact-Matrix.Rotation(pitch,3,'X')@contact
        ankle=Vector((sign*.105,y-.0952,z+.11648))+correction
        foot(side,ankle,Vector((sign*.16,.45,.58)))
        rotate('Foot_'+side,pitch)
    arms(Vector((0,0,0)),phase)
def mount(t):
    if t<=0:idle(0,Vector((-.6,-.2,0)));return
    if t>=1:
        for p in rig.pose.bones:p.matrix=seated[p.name];update()
        return
    reset()
    hip=path(t,[(0,(-.6,-.2,.918)),(.25,(-.35,-.24,.89)),(.52,(-.29,-.2753,.92)),(.70,(-.04,-.2753,1.07)),(1,(0,-.2753,1.025))])
    pelvis_at(hip,math.radians(39)*smooth(t/.75))
    left=path(t,[(0,(-.71,-.2952,.11648)),(.16,(-.70,-.3,.11648)),(.26,(-.50,-.32,.19)),(.37,(-.36,-.34,.11648)),(.50,(-.36,-.34,.11648)),(.70,(-.0728,-.3958,.41548)),(1,(-.0728,-.3958,.41548))])
    right=path(t,[(0,(-.49,-.2952,.11648)),(.13,(-.49,-.2952,.11648)),(.35,(-.39,-.88,1.06)),(.52,(.30,-.78,1.12)),(.75,(.17,-.36,.60)),(1,(.0728,-.0558,.41548))])
    foot('L',left,Vector((-.20,.30,.75)))
    pole=path(t,[(0,(-.25,.25,.65)),(.35,(-.15,-.80,1.02)),(.52,(.60,-.50,1.10)),(.8,(.25,.3,.9)),(1,(.17,.38,.88))])
    foot('R',right,pole)
    swing=max(0,min(1,(t-.13)/.64))
    rotate('Foot_R',-math.radians(38)*math.sin(math.pi*swing))
    arms(Vector((hip.x,hip.y,hip.z-.918)),0,smooth(t/.65))
    # Finish on the exact approved pedal pose, without a last-frame snap.
    blend=smooth((t-.78)/.22)
    if blend:
        for p in rig.pose.bones:
            loc,rot,scale=p.matrix.decompose();l,q,s=seated[p.name].decompose()
            p.matrix=Matrix.LocRotScale(loc.lerp(l,blend),rot.slerp(q,blend),scale.lerp(s,blend));update()

clips=[('Idle',48,lambda t:idle(t)),('Walk',24,walk),('Mount',84,mount),('Dismount',84,lambda t:mount(1-t))]
for name,frames,pose in clips:
    rig.animation_data_clear()
    for frame in range(frames+1):
        bpy.context.scene.frame_set(frame);pose(frame/frames)
        for p in rig.pose.bones:
            p.rotation_mode='QUATERNION'
            for prop in ('location','rotation_quaternion','scale'):p.keyframe_insert(prop,frame=frame)
    action=rig.animation_data.action;action.name=name;action.use_fake_user=True
rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Idle')
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=84;bpy.context.scene.frame_set(0)
body.data.shape_keys.key_blocks['HandlebarGrip'].value=0
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'courier-movement.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'courier-movement.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True)
print('MOVEMENT_EXPORTED',flush=True)
