"""Fit the adjustable seat post to the courier; preserve the original bicycle."""
from pathlib import Path
from collections import defaultdict
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/bicycle.blend'))
# This bicycle source is authored in Y-up metres.
delta=Vector((0,-.080,-.080*.068/.183))
o=bpy.data.objects['Fixed_Aluminum']
adj=defaultdict(list)
for e in o.data.edges:
    a,b=e.vertices;adj[a].append(b);adj[b].append(a)
unseen=set(range(len(o.data.vertices)));changed=[]
while unseen:
    seed=unseen.pop();component={seed};queue=[seed]
    while queue:
        for j in adj[queue.pop()]:
            if j in unseen:unseen.remove(j);component.add(j);queue.append(j)
    points=[o.matrix_world@o.data.vertices[i].co for i in component]
    bounds=[(min(p[a] for p in points),max(p[a] for p in points)) for a in range(3)]
    if bounds[1][1]<.84:continue
    if bounds[0][0]<-.04 or bounds[0][1]>.04 or bounds[2][0]<.20 or bounds[2][1]>.41:
        raise RuntimeError('Unexpected geometry in the seat fitting region')
    rail=bounds[1][0]>.94
    axis=Vector((0,.183,.068));base=Vector((0,.805,.258))
    for i in component:
        point=o.matrix_world@o.data.vertices[i].co
        factor=1 if rail else round((point-base).dot(axis)/axis.length_squared)
        o.data.vertices[i].co=o.matrix_world.inverted()@(point+delta*factor)
    changed.append('rail' if rail else 'post')
assert sorted(changed)==['post','rail','rail'],changed
bpy.data.objects['Fixed_Saddle'].location+=delta
bpy.data.objects['Seat_Attach'].location+=delta
bpy.context.scene['seatAdjustmentMetres']=list(delta)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bicycle-fitted.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT.parent/'viewer/public/cyclist/bicycle-fitted.glb'),export_format='GLB',export_yup=False,export_apply=True,export_cameras=False,export_lights=False)
print('BICYCLE_SEAT_FITTED',list(delta),flush=True)
