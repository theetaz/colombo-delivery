"""Add locomotion clips to a copy of the approved cyclist without rebinding it."""
from pathlib import Path
import bpy, math, json, sys, tempfile
sys.path.insert(0,str(Path(__file__).resolve().parent))
from glb_animation import replace_animation
from mathutils import Vector, Matrix, Quaternion

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'viewer/public/cyclist'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'colombo-cyclist.blend'))
rig=bpy.data.objects['CyclistRig'];body=bpy.data.objects['CourierSurface']
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
pedal=rig.animation_data.action
seated={p.name:p.matrix.copy() for p in rig.pose.bones}
seated_basis={p.name:p.matrix_basis.copy() for p in rig.pose.bones}
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

def ease5(t):
    t=max(0,min(1,t));return t*t*t*(10+t*(-15+6*t))

def quintic(a,b,va,vb,aa,ab,u,duration):
    # Join position, velocity and acceleration; do not ease to rest at contact.
    return (a*(1-ease5(u))+b*ease5(u)
            +va*duration*(u-6*u**3+8*u**4-3*u**5)
            +vb*duration*(-4*u**3+7*u**4-3*u**5)
            +aa*duration**2*.5*(u*u-3*u**3+3*u**4-u**5)
            +ab*duration**2*.5*(u**3-2*u**4+u**5))

def shoe_roll(p):
    if p<.10:
        u=p/.10;angle=math.radians(12);contact_rate=-3
        pitch=quintic(angle,0,contact_rate,0,0,0,u,.10)
        rate=(-angle*30*u*u*(1-u)**2+contact_rate*.10*(1-18*u*u+32*u**3-15*u**4))/.10
        acceleration=(-angle*60*u*(1-u)*(1-2*u)+contact_rate*.10*(-36*u+96*u*u-60*u**3))/.10**2
    else:
        u=max(0,min(1,(p-.34)/.34));angle=-math.radians(55)
        pitch=angle*ease5(u);rate=angle*30*u*u*(1-u)**2/.34
        acceleration=angle*60*u*(1-u)*(1-2*u)/.34**2
    return pitch,rate,acceleration

def stance_shoe(p,sign):
    pitch,rate,acceleration=shoe_roll(p);pivot=-.08 if p<.10 else .222
    s=math.sin(pitch);c=math.cos(pitch);height=.11648
    ankle=Vector((sign*.105,(.22-p)*STRIDE+pivot*(1-c)-height*s,height*c-pivot*s))
    dy=pivot*s-height*c;dz=-height*s-pivot*c
    velocity=Vector((0,-STRIDE+dy*rate,dz*rate))
    accel=Vector((0,(pivot*c+height*s)*rate*rate+dy*acceleration,
                  (-height*c+pivot*s)*rate*rate+dz*acceleration))
    return ankle,pitch,velocity,accel,rate,acceleration

def shoe(p,sign):
    if p<.55:return stance_shoe(p,sign)[:2]
    u=(p-.55)/.45
    start,sp,sv,sa,sr,saa=stance_shoe(.55,sign)
    end,ep,ev,ea,er,eaa=stance_shoe(0,sign)
    ankle=quintic(start,end,sv,ev,sa,ea,u,.45)
    # Broad clearance arcs replace short corrective bumps that made the knee
    # bend, straighten, then bend again within one swing.
    ankle.z+=.04*64*u**3*(1-u)**3
    ankle.z+=.04*u**8*(1-u)**3/((8/11)**8*(3/11)**3)
    return ankle,quintic(sp,ep,sr,er,saa,eaa,u,.45)

def support_height(p,knee_degrees):
    ankle,_=shoe(p,-1)
    hip=rig.data.bones['Thigh_L'].head_local-rig.data.bones['Pelvis'].head_local
    a=rig.data.bones['Thigh_L'].length;b=rig.data.bones['Shin_L'].length
    reach2=a*a+b*b+2*a*b*math.cos(math.radians(knee_degrees))
    return ankle.z+math.sqrt(reach2-(ankle.x-hip.x)**2-(ankle.y-hip.y)**2)-hip.z

# Two low-frequency harmonics retain the upright weight transfer without the
# extra 4 mm rebound in the previous pelvis spline. Heights are metres for this
# rig, with clearance reserved for a softly extended supporting knee.
def hip_height(t):
    phase=4*math.pi*(t-.005)
    return (.92677-.017025*math.cos(phase)+.006143*math.sin(phase)
            +.005371*math.cos(2*phase)+.004539*math.sin(2*phase))

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
    hip=Vector((-.008*math.sin(phase),0,hip_height(t)))
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

def beside_pose():
    # Exact upright walking-study stance, translated to the bike's left side.
    stand(0)
    matrix=rig.pose.bones['Pelvis'].matrix.copy()
    matrix.translation+=Vector((-.6,-.2,0))
    rig.pose.bones['Pelvis'].matrix=matrix;update()

def transition_arms(reach):
    relaxed_arms(0,0)
    for side,sign in [('L',-1),('R',1)]:
        palm=rig.pose.bones['Hand_'+side]
        _,rest_rotation,_=palm.matrix.decompose()
        wrist=palm.head.copy()
        elbow=rig.pose.bones['Forearm_'+side].head.copy()
        shoulder=rig.pose.bones['UpperArm_'+side].head.copy()
        target=wrist.lerp(Vector((sign*.287,.260,1.037)),reach)
        direction=(target-shoulder).normalized()
        back=Vector((0,-1,0));back-=direction*back.dot(direction);back.normalize()
        bend=back*math.cos(math.radians(35))+sign*direction.cross(back)*math.sin(math.radians(35))
        ik('UpperArm_'+side,'Forearm_'+side,target,elbow.lerp(shoulder+bend,reach))
        # Share the palm turn with the forearm instead of hinging the wrist.
        lower=rig.pose.bones['Forearm_'+side];pivot=lower.head.copy()
        twist=Quaternion((lower.tail-lower.head).normalized(),sign*math.radians(48)*reach).to_matrix().to_4x4()
        lower.matrix=Matrix.Translation(pivot)@twist@Matrix.Translation(-pivot)@lower.matrix;update()
        _,goal,_=seated[palm.name].decompose()
        loc,_,scale=palm.matrix.decompose()
        palm.matrix=Matrix.LocRotScale(loc,rest_rotation.slerp(goal,reach),scale);update()

def swing_leg(ankle, bend_angle, influence):
    # Solve on the knee circle with an explicit, continuous hip swivel. A
    # moving pole can cross the leg axis and flip to the opposite bend plane.
    root=rig.pose.bones['Thigh_R'].head.copy();ankle=Vector(ankle)
    delta=ankle-root;direction=delta.normalized()
    a=rig.data.bones['Thigh_R'].length;b=rig.data.bones['Shin_R'].length
    distance=min(delta.length,a+b-.00001)
    along=(a*a-b*b+distance*distance)/(2*distance)
    lateral=Vector((1,0,0));lateral-=direction*lateral.dot(direction);lateral.normalize()
    around=direction.cross(lateral)
    bend=lateral*math.cos(bend_angle)+around*math.sin(bend_angle)
    knee=root+direction*along+bend*math.sqrt(max(0,a*a-along*along))
    place('Thigh_R',root,knee);place('Shin_R',knee,ankle)
    p=rig.pose.bones['Foot_R'];place(p.name,ankle,ankle+Vector((0,.19,-.056))*S)
    flat_rotation=p.matrix.to_quaternion()
    upper=(knee-root).normalized();lower=(ankle-knee).normalized()
    hinge=lower.cross(upper).normalized()
    # Both bones share one hinge axis. Independent shortest-arc bone rotations
    # can make the mesh's kneecap face away from the geometric knee bend.
    solved={n:(rig.pose.bones[n].head.copy(),rig.pose.bones[n].tail.copy(),rig.pose.bones[n].matrix.to_quaternion())
            for n in ['Thigh_R','Shin_R']}
    for name in ['Thigh_R','Shin_R']:
        bone=rig.pose.bones[name];loc,tail,old=solved[name];direction=(tail-loc).normalized()
        q=Matrix((hinge,direction,hinge.cross(direction))).transposed().to_quaternion()
        bone.matrix=Matrix.LocRotScale(loc,old.slerp(q,influence),Vector((1,1,1)));update()
    bone=rig.pose.bones['Foot_R'];loc=Vector(ankle)
    forward=hinge.cross(lower).normalized()
    direction=(forward+lower).normalized()
    q=Matrix((hinge,direction,hinge.cross(direction))).transposed().to_quaternion()
    bone.matrix=Matrix.LocRotScale(loc,flat_rotation.slerp(q,influence),Vector((1,1,1)));update()

def transition_pose(t,getting_off=False):
    if not getting_off and t<=0:beside_pose();return
    if not getting_off and t>=1:seated_pose();return
    if getting_off and t<=0:seated_pose();return
    if getting_off and t>=1:beside_pose();return
    reset();standing_height=support_height(.22,7)
    if not getting_off:
        # Approach the bar, put weight over the left shoe, then fold the right
        # knee and sweep the heel behind the saddle. Keep the pelvis beside or
        # ahead of the saddle while the leg crosses to the opposite side.
        hip=path(t,[(0,(-.6,-.2,standing_height)),(.12,(-.40,-.16,.93)),(.24,(-.36,-.05,.94)),(.35,(-.43,-.08,.95)),(.45,(-.43,-.08,.95)),(.52,(-.38,-.08,.95)),(.56,(-.22,.20,.94)),(.60,(-.10,.13,.925)),(.65,(-.10,.13,.92)),(.70,(-.12,.13,.90)),(.79,(0,.13,.875)),(.82,(0,.13,.875)),(.94,(0,-.2753,1.05)),(1,(0,-.2753,1.025))])
        left=path(t,[(0,(-.705,-.2,.11648)),(.12,(-.705,-.2,.11648)),(.175,(-.53,-.08,.20)),(.23,(-.38,.02,.11648)),(.82,(-.38,.02,.11648)),(.94,(-.14,-.36,.49)),(1,(-.0728,-.3958,.41548))])
        right=path(t,[(0,(-.495,-.2,.11648)),(.015,(-.495,-.2,.11648)),(.07,(-.32,-.14,.20)),(.12,(-.17,-.08,.11648)),(.25,(-.17,-.08,.11648)),(.35,(-.17,-.40,.63)),(.44,(-.13,-.63,1.07)),(.54,(.20,-.62,1.07)),(.62,(.38,-.35,.79)),(.70,(.30,.05,.11648)),(.75,(.30,.05,.11648)),(.81,(.0728,-.0558,.41548)),(1,(.0728,-.0558,.41548))])
        lean=math.radians(20)*smooth(t/.23)+math.radians(19)*smooth((t-.80)/.17)+math.radians(22)*smooth((t-.18)/.12)*(1-smooth((t-.61)/.13))
        reach=smooth((t-.02)/.21)
        seated_blend=smooth((t-.90)/.10)
        shift=smooth((t-.12)/.14)*(1-smooth((t-.60)/.16))
    else:
        # Stand forward of the saddle before unweighting the right pedal.
        # Left foot and both hands hold their contacts for the complete sweep;
        # release the bar only after the right shoe lands on the left side.
        hip=path(t,[(0,(0,-.2753,1.025)),(.12,(0,.13,1.02)),(.23,(-.12,.13,.92)),(.34,(-.10,.13,.925)),(.38,(-.16,.20,.935)),(.43,(-.27,.12,.95)),(.49,(-.40,-.08,.95)),(.53,(-.43,-.08,.95)),(.67,(-.43,-.08,.95)),(.77,(-.30,.02,.945)),(.83,(-.32,-.04,.94)),(1,(-.6,-.2,standing_height))])
        left=path(t,[(0,(-.0728,-.3958,.41548)),(.06,(-.0728,-.3958,.41548)),(.15,(-.28,-.12,.26)),(.23,(-.38,.02,.11648)),(.80,(-.38,.02,.11648)),(.85,(-.56,-.11,.20)),(.90,(-.705,-.2,.11648)),(1,(-.705,-.2,.11648))])
        right=path(t,[(0,(.0728,-.0558,.41548)),(.25,(.0728,-.0558,.41548)),(.34,(.38,-.35,.79)),(.43,(.20,-.62,1.07)),(.53,(-.13,-.63,1.07)),(.63,(-.17,-.40,.63)),(.76,(-.17,-.08,.11648)),(.90,(-.17,-.08,.11648)),(.95,(-.32,-.14,.20)),(1,(-.495,-.2,.11648))])
        lean=math.radians(39-19*smooth(t/.20))*(1-smooth((t-.76)/.24))+math.radians(22)*smooth((t-.25)/.10)*(1-smooth((t-.65)/.12))
        reach=1-smooth((t-.78)/.22)
        seated_blend=1-smooth(t/.10)
        shift=smooth((t-.18)/.14)*(1-smooth((t-.65)/.14))
    upper_shift=(smooth((t-.10)/.13)*(1-smooth((t-.79)/.21))
                 if getting_off else shift)
    # As the hips move ahead of the seat, reduce the forward trunk hinge so
    # the shoulders do not overshoot the grips and force elbows behind the back.
    lean=max(0,lean-math.atan2(max(0,hip.y+.08),.42)*upper_shift)
    hip.z+=.035*shift
    pelvis_at(hip,lean)
    rotate('Pelvis',math.radians(-22)*shift,'Y')
    rotate('Pelvis',-math.radians(6)*shift,'Z')
    rotate('Chest',math.radians(4)*shift,'Z')
    # The hips stay over the ground shoe while the shoulders lean toward the
    # bicycle. Both grips must remain within the real arm lengths.
    rotate('Spine',math.radians(24+16*smooth((-.20-hip.x)/.23))*upper_shift,'Y')
    rotate('Neck',-math.radians(8)*upper_shift,'Y')
    rotate('Head',-math.radians(8)*upper_shift,'Y')
    # Reserve a softly extended knee as each shoe approaches the ground. A target beyond
    # the actual leg length would otherwise be clamped and visibly float.
    supports=[('L',left),('R',right)]
    lower_hips=0
    for side,target in supports:
        root=rig.pose.bones['Thigh_'+side].head
        a=rig.data.bones['Thigh_'+side].length;b=rig.data.bones['Shin_'+side].length
        reach2=a*a+b*b+2*a*b*math.cos(math.radians(6))
        maximum=target.z+math.sqrt(max(.001,reach2-(root.x-target.x)**2-(root.y-target.y)**2))
        lower_hips=max(lower_hips,root.z-maximum)
    if lower_hips>0:
        matrix=rig.pose.bones['Pelvis'].matrix.copy();matrix.translation.z-=lower_hips
        rig.pose.bones['Pelvis'].matrix=matrix;update()
    support=smooth(t/.23) if not getting_off else 1-smooth((t-.80)/.20)
    left_pole=Vector((-.705,.25,.55)).lerp(Vector((-.38,.45,.65)),support)
    foot('L',left,left_pole)
    if getting_off:
        angle=path(t,[(0,(-90,0,0)),(.25,(-90,0,0)),(.34,(5,0,0)),(.43,(45,0,0)),(.53,(160,0,0)),(.63,(270,0,0)),(.76,(270,0,0)),(1,(270,0,0))]).x
        influence=smooth((t-.25)/.09)*(1-smooth((t-.65)/.11))
    else:
        angle=path(t,[(0,(270,0,0)),(.25,(270,0,0)),(.35,(270,0,0)),(.44,(160,0,0)),(.54,(45,0,0)),(.62,(5,0,0)),(.70,(-90,0,0)),(1,(-90,0,0))]).x
        influence=smooth((t-.25)/.10)*(1-smooth((t-.62)/.08))
    # Extend the knee while passing the saddle, then fold it again for the
    # landing. Keeping a deeply folded leg here forced the old high-knee kick.
    extend=(smooth((t-.35)/.08)*(1-smooth((t-.55)/.08)) if getting_off
            else smooth((t-.35)/.09)*(1-smooth((t-.54)/.08)))
    root=rig.pose.bones['Thigh_R'].head.copy()
    a=rig.data.bones['Thigh_R'].length;b=rig.data.bones['Shin_R'].length
    u=max(0,min(1,(t-(.43 if getting_off else .44))/.10))
    flexion=32-14*64*u**3*(1-u)**3
    distance=math.sqrt(a*a+b*b+2*a*b*math.cos(math.radians(flexion)))
    right=right.lerp(root+(right-root).normalized()*distance,extend)
    swing_leg(right,math.radians(angle),influence)
    transition_arms(reach)
    if seated_blend:
        # Blend the local pose once, then solve the contacts again. Reading
        # world matrices after changing their parents applied the old blend
        # repeatedly down each chain and pulled the palms off the handlebars.
        goals={name:rig.pose.bones[name].head.lerp(seated[name].translation,seated_blend)
               for name in ['Shin_L','Shin_R','Foot_L','Foot_R','Forearm_L','Forearm_R','Hand_L','Hand_R']}
        end_rotations={name:rig.pose.bones[name].matrix.to_quaternion().slerp(seated[name].to_quaternion(),seated_blend)
                       for name in ['Foot_L','Foot_R','Hand_L','Hand_R']}
        for p in rig.pose.bones:
            loc,rot,scale=p.matrix_basis.decompose();l,q,s=seated_basis[p.name].decompose()
            p.matrix_basis=Matrix.LocRotScale(loc.lerp(l,seated_blend),rot.slerp(q,seated_blend),scale.lerp(s,seated_blend))
        update()
        for side in ['L','R']:
            for upper,lower,end in [('Thigh_','Shin_','Foot_'),('UpperArm_','Forearm_','Hand_')]:
                a,b,c=upper+side,lower+side,end+side
                twists={name:rig.pose.bones[name].matrix.to_quaternion() for name in [a,b]}
                ik(a,b,goals[c],goals[b])
                solved={name:(rig.pose.bones[name].head.copy(),rig.pose.bones[name].tail.copy()) for name in [a,b,c]}
                for name in [a,b]:
                    head,tail=solved[name];q=twists[name]
                    q=(q@Vector((0,1,0))).rotation_difference((tail-head).normalized())@q
                    rig.pose.bones[name].matrix=Matrix.LocRotScale(head,q,Vector((1,1,1)));update()
                rig.pose.bones[c].matrix=Matrix.LocRotScale(solved[c][0],end_rotations[c],Vector((1,1,1)));update()

def mount(t):transition_pose(t)
def dismount(t):transition_pose(t,True)

clips=[('Idle',48,lambda t:idle(t)),('Stand',48,stand),('WalkBefore',24,walk_before),('Walk',96,walk),('Mount',336,mount),('Dismount',336,dismount)]
for name,frames,pose in clips:
    rig.animation_data_clear()
    previous_rotations={}
    for frame in range(frames+1):
        sample_frame=frame/4 if name in ('Walk','Mount','Dismount') else frame
        bpy.context.scene.frame_set(int(sample_frame),subframe=sample_frame%1);pose(frame/frames)
        for p in rig.pose.bones:
            p.rotation_mode='QUATERNION'
            if name in ('Walk','Mount','Dismount'):
                if p.name in previous_rotations and p.rotation_quaternion.dot(previous_rotations[p.name])<0:p.rotation_quaternion.negate()
                previous_rotations[p.name]=p.rotation_quaternion.copy()
            for prop in ('location','rotation_quaternion','scale'):p.keyframe_insert(prop,frame=sample_frame)
    action=rig.animation_data.action;action.name=name;action.use_fake_user=True
    if name in ('Walk','Mount','Dismount'):
        for layer in action.layers:
            for strip in layer.strips:
                for curve in strip.channelbag(action.slots[0]).fcurves:
                    keys=curve.keyframe_points
                    # Matching wrap tangents prevent an artificial pause each lap.
                    for i,key in enumerate(keys):
                        before=keys[i-1] if i>0 else keys[-2]
                        after=keys[i+1] if i<len(keys)-1 else keys[1]
                        slope=(after.co.y-before.co.y)/.5
                        if name!='Walk' and i in (0,len(keys)-1):slope=0
                        key.handle_left_type=key.handle_right_type='FREE'
                        key.handle_left=(key.co.x-1/12,key.co.y-slope/12)
                        key.handle_right=(key.co.x+1/12,key.co.y+slope/12)
rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Stand')
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=84;bpy.context.scene.frame_set(0)
body.data.shape_keys.key_blocks['HandlebarGrip'].value=0
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'courier-movement.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'courier-movement.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True)
# Preserve authored subframe keys and cubic tangents in the browser. Walking
# retains its periodic seam; the one-shot transitions ease only at endpoints.
with tempfile.TemporaryDirectory(prefix='colombo-walk-export-') as directory:
    curved=Path(directory)/'curves.glb'
    bpy.ops.export_scene.gltf(filepath=str(curved),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=False,export_anim_slide_to_zero=True)
    replace_animation(OUT/'courier-movement.glb',curved,'Walk')
    for name in ('Mount','Dismount'):
        replace_animation(OUT/'courier-movement.glb',curved,name,loop=False)
print('MOVEMENT_EXPORTED',flush=True)
