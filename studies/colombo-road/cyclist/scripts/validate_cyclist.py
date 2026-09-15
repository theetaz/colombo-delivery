"""Check the actual exported source animation, skin coverage, and pedal fit."""
from pathlib import Path
import bpy, math, json, hashlib
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
output=ROOT.parent/'viewer/public/cyclist/geometry-check.json'
output.unlink(missing_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'colombo-cyclist.blend'))
body=bpy.data.objects['CourierSurface'];rig=bpy.data.objects['CyclistRig']
for v in body.data.vertices:
    weights=[g.weight for g in v.groups if g.weight>0]
    assert 1<=len(weights)<=4,(v.index,weights)
    assert abs(sum(weights)-1)<.00001,(v.index,sum(weights))
max_ankle_error=0;max_bicycle_error=0;max_stretch=(0,None,None);first=[];last=[];sole_clearances=[]
for frame in range(1,50):
    bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
    phase=(frame-1)/48*math.tau
    dg=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(dg);mesh=evaluated.to_mesh()
    points=[v.co.copy() for v in mesh.vertices]
    if frame==1:first=points
    if frame==49:last=points
    for edge in body.data.edges:
        a,b=edge.vertices;length=(body.data.vertices[a].co-body.data.vertices[b].co).length
        if length<.002:continue
        ratio=(points[a]-points[b]).length/length
        if ratio>max_stretch[0]:max_stretch=(ratio,frame,list(edge.vertices))
    for side,sign in [('L',-1),('R',1)]:
        p=phase+(0 if side=='L' else math.pi)
        pedal=Vector((sign*.112,-.097-.17*math.cos(p),.289+.17*math.sin(p)))
        max_bicycle_error=max(max_bicycle_error,(bpy.data.objects[f'Pedal_{side}'].matrix_world.translation-pedal).length)
        target=pedal+Vector((-sign*.035*1.12,-.115*1.12,.104*1.12+.010))
        error=(rig.pose.bones[f'Foot_{side}'].head-target).length
        max_ankle_error=max(max_ankle_error,error)
        sole=[points[v.index] for v in body.data.vertices if v.co.z<.015 and (v.co.x<0)==(side=='L') and abs(points[v.index].y-pedal.y)<.04]
        assert sole,(frame,side,'No sole near the pedal')
        sole_clearances.append(min(p.z for p in sole)-(pedal.z+.01))
    evaluated.to_mesh_clear()
seam=max((a-b).length for a,b in zip(first,last))
report={'vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bones':len(rig.data.bones),
    'riderSha256':hashlib.sha256((ROOT.parent/'viewer/public/cyclist/rider.glb').read_bytes()).hexdigest(),
    'sampledFrames':49,'maxAnkleTargetErrorMetres':max_ankle_error,'maxBlenderPedalErrorMetres':max_bicycle_error,'loopSeamMetres':seam,
    'soleClearanceRangeMetres':[min(sole_clearances),max(sole_clearances)],'maxEdgeStretch':max_stretch,
    'allVerticesNormalized':True,'maximumSkinInfluences':4,
    'scope':'Geometry and animation checks only. This does not certify visual quality or physical simulation.'}
print(json.dumps(report,indent=2),flush=True)
assert max_ankle_error<.002,'Ankle loses contact with pedal target'
assert max_bicycle_error<.0001,'Blender bicycle animation differs from the rider pedal cycle'
assert seam<.00001,'Pedal animation has a visible loop seam'
assert min(sole_clearances)>-.035 and max(sole_clearances)<.035,'Shoe sole moves away from pedal'
assert max_stretch[0]<4,'Severe skin stretching remains'
output.write_text(json.dumps(report,indent=2)+'\n')
