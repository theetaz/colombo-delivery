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
    # Shape-preserving cubic interpolation: travel through intermediate poses
    # continuously, but stop at repeated contact holds without overshooting.
    if t<=keys[0][0]:return Vector(keys[0][1])
    if t>=keys[-1][0]:return Vector(keys[-1][1])
    def tangent(i,k):
        if i==0 or i==len(keys)-1:return 0
        h0=keys[i][0]-keys[i-1][0];h1=keys[i+1][0]-keys[i][0]
        d0=(keys[i][1][k]-keys[i-1][1][k])/h0;d1=(keys[i+1][1][k]-keys[i][1][k])/h1
        if d0*d1<=0:return 0
        w0=2*h1+h0;w1=h1+2*h0
        return (w0+w1)/(w0/d0+w1/d1)
    for i,((a,p),(b,q)) in enumerate(zip(keys,keys[1:])):
        if t<=b:
            h=b-a;u=(t-a)/h
            return Vector([(2*u**3-3*u*u+1)*p[k]+(u**3-2*u*u+u)*h*tangent(i,k)+(-2*u**3+3*u*u)*q[k]+(u**3-u*u)*h*tangent(i+1,k) for k in range(3)])
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
        pole=(offset+Vector((sign*.37,-.11,1.02))).lerp(Vector((sign*.50,-.05,1.05)),reach)
        ik('UpperArm_'+side,'Forearm_'+side,target,pole)
        p=rig.pose.bones['Hand_'+side]
        direction=Vector((sign*.015,.015,-.13)).lerp(Vector((0,.10,-.045)),reach)
        place(p.name,p.head,p.head+direction)
        if reach:
            # Match the approved palm rotation as the hand reaches the bar.
            direction=Vector((0,.10,-.045)).normalized()
            q=(p.bone.tail_local-p.bone.head_local).rotation_difference(direction)
            normal=q@Vector((-sign,0,0));normal-=direction*normal.dot(direction);normal.normalize()
            desired=Vector((0,0,-1));desired-=direction*desired.dot(direction);desired.normalize()
            angle=math.atan2(direction.dot(normal.cross(desired)),normal.dot(desired))
            lower=rig.pose.bones['Forearm_'+side];pivot=lower.head.copy()
            twist=Quaternion((lower.tail-lower.head).normalized(),angle*.65*reach).to_matrix().to_4x4()
            lower.matrix=Matrix.Translation(pivot)@twist@Matrix.Translation(-pivot)@lower.matrix;update()
            loc,rot,scale=p.matrix.decompose();_,goal,_=seated[p.name].decompose()
            p.matrix=Matrix.LocRotScale(loc,rot.slerp(goal,reach),scale);update()
def idle(t=0,offset=Vector((0,0,0))):
    reset();pelvis_at(offset+Vector((0,0,.918)))
    rotate('Chest',math.radians(.4)*math.sin(t*math.tau))
    for side,sign in [('L',-1),('R',1)]:
        foot(side,offset+Vector((sign*.11,-.0952,.11648)),offset+Vector((sign*.15,.28,.55)))
    arms(offset)
# Previous gait is retained only for the walking comparison control.
def walk_before(t):
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

# One full left/right cycle covers 1.32 m. Keep this in sync with walking.js.
STRIDE=1.32

def relaxed_arms(t,amount=1):
    # Shoulder-led pendulums: the right arm advances with the left leg.
    # Unlike hand-target IK, this does not pin the wrists to a horizontal line.
    for side,sign in [('L',-1),('R',1)]:
        swing=sign*math.cos(math.tau*(t-.02))*amount
        shoulder=rig.pose.bones['UpperArm_'+side].head.copy()
        upper_angle=math.radians(17)*swing
        elbow_angle=math.radians(13+5*swing)
        upper=Vector((sign*.085,math.sin(upper_angle),-math.cos(upper_angle))).normalized()
        lower=Vector((sign*.04,math.sin(upper_angle+elbow_angle),-math.cos(upper_angle+elbow_angle))).normalized()
        elbow=shoulder+upper*rig.data.bones['UpperArm_'+side].length
        wrist=elbow+lower*rig.data.bones['Forearm_'+side].length
        place('UpperArm_'+side,shoulder,elbow)
        place('Forearm_'+side,elbow,wrist)
        # The palm follows the forearm, without a separate wrist oscillation.
        place('Hand_'+side,wrist,wrist+lower*rig.data.bones['Hand_'+side].length)

def shoe(p,sign):
    if p<.6:
        y=(.22-p)*STRIDE;z=0
        if p<.10:
            pitch=math.radians(12)*(1-smooth(p/.10));pivot=-.08
        else:
            pitch=-math.radians(55)*smooth((p-.38)/.22);pivot=.222
    else:
        u=(p-.6)/.4
        # Hermite swing meets the stance velocity at both ends. A foot must
        # still be travelling backwards relative to the hip at heel strike.
        y0=(.22-.6)*STRIDE;y1=.22*STRIDE;m=-STRIDE*.4
        y=(2*u**3-3*u*u+1)*y0+(u**3-2*u*u+u)*m+(-2*u**3+3*u*u)*y1+(u**3-u*u)*m
        z=.10*math.sin(math.pi*u)**2
        pitch=math.radians(-55+67*smooth(u));pivot=.222-.302*smooth(u)
    contact=Vector((0,pivot,-.11648))
    correction=contact-Matrix.Rotation(pitch,3,'X')@contact
    return Vector((sign*.105,y,z+.11648))+correction,pitch

def support_height(p,knee_degrees):
    ankle,_=shoe(p,-1)
    hip=rig.data.bones['Thigh_L'].head_local-rig.data.bones['Pelvis'].head_local
    a=rig.data.bones['Thigh_L'].length;b=rig.data.bones['Shin_L'].length
    reach2=a*a+b*b+2*a*b*math.cos(math.radians(knee_degrees))
    return ankle.z+math.sqrt(reach2-(ankle.x-hip.x)**2-(ankle.y-hip.y)**2)-hip.z

CONTACT_HEIGHT=support_height(0,9)
HIP_HEIGHTS=[(0,(0,0,CONTACT_HEIGHT)),(.10,(0,0,support_height(.10,18))),
            (.30,(0,0,support_height(.30,6))),(.40,(0,0,support_height(.40,9))),
            (.50,(0,0,CONTACT_HEIGHT))]

def stand(t):
    reset();pelvis_at(Vector((0,0,support_height(.22,7))))
    rotate('Chest',math.radians(.25)*math.sin(t*math.tau))
    for side,sign in [('L',-1),('R',1)]:
        foot(side,Vector((sign*.105,0,.11648)),Vector((sign*.105,.45,.55)))
    relaxed_arms(t,0)

def walk(t):
    reset();phase=t*math.tau
    # Compute pelvis height from this rig's leg lengths. The support knee
    # yields briefly after contact, then extends as the body passes over it.
    hip=path(t%.5,HIP_HEIGHTS);hip.x=-.008*math.sin(phase)
    pelvis_at(hip)
    rotate('Pelvis',math.radians(2)*math.cos(phase),'Z')
    rotate('Chest',-math.radians(4)*math.cos(phase),'Z')
    for side,sign in [('L',-1),('R',1)]:
        p=(t+(0 if side=='L' else .5))%1
        ankle,pitch=shoe(p,sign)
        foot(side,ankle,Vector((sign*.105,.45,.58)))
        rotate('Foot_'+side,pitch)
    relaxed_arms(t)
def seated_pose():
    for p in rig.pose.bones:p.matrix=seated[p.name];update()

def transition_pose(t,getting_off=False):
    if not getting_off and t<=0:idle(0,Vector((-.6,-.2,0)));return
    if not getting_off and t>=1:seated_pose();return
    if getting_off and t<=0:seated_pose();return
    if getting_off and t>=1:idle(0,Vector((-.6,-.2,0)));return
    reset()
    if not getting_off:
        hip=path(t,[(0,(-.6,-.2,.918)),(.23,(-.30,.13,.90)),(.60,(-.30,.13,.90)),(.72,(0,.17,.91)),(.84,(0,.17,.91)),(.94,(0,-.2753,1.06)),(1,(0,-.2753,1.025))])
        left=path(t,[(0,(-.71,-.2952,.11648)),(.08,(-.71,-.2952,.11648)),(.17,(-.52,-.22,.185)),(.24,(-.38,.05,.11648)),(.82,(-.38,.05,.11648)),(.94,(-.14,-.36,.49)),(1,(-.0728,-.3958,.41548))])
        right=path(t,[(0,(-.49,-.2952,.11648)),(.28,(-.49,-.2952,.11648)),(.40,(-.34,-.40,1.05)),(.51,(.02,-.48,1.20)),(.60,(.42,-.30,1.08)),(.72,(.30,.02,.50)),(.78,(.26,.0558,.11648)),(.81,(.26,.0558,.11648)),(.89,(.0728,-.0558,.41548)),(1,(.0728,-.0558,.41548))])
        pole=path(t,[(0,(-.25,.28,.65)),(.34,(-.15,.30,.75)),(.46,(-.32,-.35,1.26)),(.54,(.20,-.06,1.35)),(.65,(.47,.35,1.15)),(.76,(.28,.38,.70)),(1,(.17,.38,.88))])
        lean=math.radians(24+15*smooth((t-.82)/.15))*smooth(t/.25)
        reach=smooth((t-.05)/.24)
        pitch=-math.radians(16)*math.sin(math.pi*max(0,min(1,(t-.34)/.39)))
        seated_blend=smooth((t-.90)/.10)
    else:
        # Free the saddle, establish the left ground support, then swing the
        # right leg back. Keep the hands until both shoes have landed.
        hip=path(t,[(0,(0,-.2753,1.025)),(.12,(0,.15,1.05)),(.25,(-.05,.17,.92)),(.38,(-.30,.13,.90)),(.64,(-.30,.13,.90)),(.78,(-.34,-.04,.90)),(1,(-.6,-.2,.918))])
        left=path(t,[(0,(-.0728,-.3958,.41548)),(.08,(-.0728,-.3958,.41548)),(.23,(-.38,.05,.11648)),(.80,(-.38,.05,.11648)),(.9,(-.56,-.25,.18)),(1,(-.71,-.2952,.11648))])
        right=path(t,[(0,(.0728,-.0558,.41548)),(.25,(.0728,-.0558,.41548)),(.36,(.42,-.30,1.08)),(.49,(.02,-.48,1.20)),(.62,(-.34,-.40,1.05)),(.74,(-.49,-.2952,.11648)),(1,(-.49,-.2952,.11648))])
        pole=path(t,[(0,(.17,.38,.88)),(.25,(.28,.38,.76)),(.39,(.47,.35,1.15)),(.49,(.20,-.06,1.35)),(.60,(-.32,-.35,1.26)),(.74,(-.25,.28,.65)),(1,(-.25,.28,.65))])
        lean=math.radians(39-15*smooth(t/.20))*(1-smooth((t-.73)/.27))
        reach=1-smooth((t-.76)/.24)
        pitch=-math.radians(16)*math.sin(math.pi*max(0,min(1,(t-.25)/.49)))
        seated_blend=1-smooth(t/.10)
    pelvis_at(hip,lean)
    shift=smooth((t-.10)/.16)*(1-smooth((t-.60)/.14)) if not getting_off else smooth((t-.23)/.15)*(1-smooth((t-.67)/.15))
    rotate('Pelvis',math.radians(14)*shift,'Y')
    foot('L',left,Vector((-.25,.38,.75)))
    foot('R',right,pole);rotate('Foot_R',pitch)
    arms(Vector((hip.x,hip.y,hip.z-.918)),0,reach)
    if seated_blend:
        for p in rig.pose.bones:
            loc,rot,scale=p.matrix.decompose();l,q,s=seated[p.name].decompose()
            p.matrix=Matrix.LocRotScale(loc.lerp(l,seated_blend),rot.slerp(q,seated_blend),scale.lerp(s,seated_blend));update()

def mount(t):transition_pose(t)
def dismount(t):transition_pose(t,True)

clips=[('Idle',48,lambda t:idle(t)),('Stand',48,stand),('WalkBefore',24,walk_before),('Walk',48,walk),('Mount',84,mount),('Dismount',84,dismount)]
for name,frames,pose in clips:
    rig.animation_data_clear()
    for frame in range(frames+1):
        bpy.context.scene.frame_set(frame);pose(frame/frames)
        for p in rig.pose.bones:
            p.rotation_mode='QUATERNION'
            for prop in ('location','rotation_quaternion','scale'):p.keyframe_insert(prop,frame=frame/2 if name=='Walk' else frame)
    action=rig.animation_data.action;action.name=name;action.use_fake_user=True
rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Stand')
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=84;bpy.context.scene.frame_set(0)
body.data.shape_keys.key_blocks['HandlebarGrip'].value=0
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'courier-movement.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'courier-movement.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True)
print('MOVEMENT_EXPORTED',flush=True)
