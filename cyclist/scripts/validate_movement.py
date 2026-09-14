"""Sample the new movement clips without touching the approved pedal study."""
from pathlib import Path
import bpy,json,hashlib
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'courier-movement.blend'))
rig=bpy.data.objects['CyclistRig'];body=bpy.data.objects['CourierSurface']
report={}
for name in ['Idle','Walk','Mount','Dismount','Pedal']:
    rig.animation_data.action=bpy.data.actions[name]
    low,high=map(int,rig.animation_data.action.frame_range)
    max_stretch=(0,0,[]);minimum=10
    for frame in range(low,high+1,3):
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        obj=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh()
        minimum=min(minimum,min(v.co.z for v in mesh.vertices))
        for edge in body.data.edges:
            a,b=edge.vertices;length=(body.data.vertices[a].co-body.data.vertices[b].co).length
            if length<.002:continue
            ratio=(mesh.vertices[a].co-mesh.vertices[b].co).length/length
            if ratio>max_stretch[0]:max_stretch=(ratio,frame,[a,b])
        obj.to_mesh_clear()
    report[name]={'lowestVertexMetres':minimum,'maxEdgeStretch':max_stretch}
report['assetSha256']=hashlib.sha256((ROOT.parent/'viewer/public/cyclist/courier-movement.glb').read_bytes()).hexdigest()
print(json.dumps(report,indent=2),flush=True)
assert all(v['lowestVertexMetres']>-.04 for v in report.values() if isinstance(v,dict)),'A movement passes below the ground'
assert all(v['maxEdgeStretch'][0]<4 for v in report.values() if isinstance(v,dict)),'Severe skin stretching in a new movement'

# Test the actual deformed surface against the fitted saddle throughout the
# leg swing. Deliberate seated contact at the clip endpoints is excluded.
bicycle=ROOT.parent/'viewer/public/cyclist/bicycle-fitted.glb'
bpy.ops.import_scene.gltf(filepath=str(bicycle))
seat=bpy.data.objects['Fixed_Saddle']
def surface_tree(obj):
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
    tree=BVHTree.FromPolygons([evaluated.matrix_world@v.co for v in mesh.vertices],
                            [tuple(p.vertices) for p in mesh.polygons])
    evaluated.to_mesh_clear();return tree
saddle=surface_tree(seat)
clearance={}
for name in ['Mount','Dismount']:
    rig.animation_data.action=bpy.data.actions[name];collisions=[]
    for half_frame in range(42,133):
        bpy.context.scene.frame_set(half_frame//2,subframe=(half_frame%2)/2)
        bpy.context.view_layer.update()
        hits=len(surface_tree(body).overlap(saddle))
        if hits:collisions.append({'frame':half_frame/2,'facePairs':hits})
    clearance[name]={'firstFrame':21,'lastFrame':66,'stepFrames':.5,'samples':91,'intersections':collisions}
report['saddleClearance']=clearance
report['bicycleSha256']=hashlib.sha256(bicycle.read_bytes()).hexdigest()
print('SADDLE_CLEARANCE',json.dumps(clearance),flush=True)
assert not any(v['intersections'] for v in clearance.values()),'Leg swing intersects the saddle'
(ROOT.parent/'viewer/public/cyclist/movement-check.json').write_text(json.dumps(report,indent=2)+'\n')
