"""Package the rider, fitted bike, reference sheets and editable exit action."""
from pathlib import Path
import bpy, math
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT.parent/'viewer/public/cyclist'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'courier-movement.blend'))
rig=bpy.data.objects['CyclistRig'];body=bpy.data.objects['CourierSurface']
bpy.ops.import_scene.gltf(filepath=str(PUBLIC/'bicycle-fitted.glb'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1280;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.render.fps=24;scene.frame_start=0;scene.frame_end=84
# Keep finger closure synchronized when switching actions in Blender too.
rig['Handlebar grip']=1.0
for name in ['Mount','Dismount']:
    rig.animation_data.action=bpy.data.actions[name]
    for frame in range(85):
        p=frame/84
        u=max(0,min(1,(p-.02)/.21 if name=='Mount' else (p-.78)/.22))
        grip=u*u*(3-2*u)
        rig['Handlebar grip']=grip if name=='Mount' else 1-grip
        rig.keyframe_insert(data_path='["Handlebar grip"]',frame=frame)
curve=body.data.shape_keys.key_blocks['HandlebarGrip'].driver_add('value')
variable=curve.driver.variables.new();variable.name='grip';variable.type='SINGLE_PROP'
variable.targets[0].id=rig;variable.targets[0].data_path='["Handlebar grip"]'
curve.driver.expression='grip'
rig.animation_data.action=bpy.data.actions['Dismount']
rig.show_in_front=True;rig.data.display_type='STICK'
for name in ['Mount','Dismount']:
    bpy.data.actions[name].asset_mark()
    bpy.data.actions[name].asset_data.description=f'{name}: left support, rear leg sweep, 3.5 seconds. Frames 0–84 at 24 fps.'
for label,phase in [('01 Stop seated',0),('02 Plant left foot',.23),('03 Lift right leg',.34),('04 Clear saddle',.49),('05 Land beside',.76),('06 Stand and release',1)]:
    scene.timeline_markers.new(label,frame=round(84*phase))

references=bpy.data.collections.new('Reference sheets — hidden in renders')
scene.collection.children.link(references)
for i,name in enumerate(['mount','dismount']):
    sheet=bpy.data.objects.new(name.title()+' pose reference',None)
    references.objects.link(sheet);sheet.empty_display_type='IMAGE'
    sheet.data=bpy.data.images.load(str(PUBLIC/'references'/f'{name}-sequence.png'));sheet.data.pack()
    sheet.empty_display_size=3;sheet.location=(-4+i*4,2,1.5)
    sheet.rotation_euler=(math.pi/2,0,0);sheet.hide_render=True;sheet.hide_set(True)

bpy.ops.mesh.primitive_plane_add(size=80,location=(0,0,-.003));floor=bpy.context.object;floor.name='Studio floor'
material=bpy.data.materials.new('Studio warm grey');material.diffuse_color=(.53,.59,.55,1);material.use_nodes=True
material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.53,.59,.55,1)
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
floor.data.materials.append(material)
scene.world.color=(.4,.45,.48)
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,position,power,size in [('Key',(-3,4,6),900,5),('Fill',(4,1,4),650,4),('Rim',(1,-4,5),1100,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=position;aim(light,(0,0,.8))
data=bpy.data.cameras.new('Transition camera');camera=bpy.data.objects.new('Transition camera',data)
scene.collection.objects.link(camera);camera.location=(-3.8,3.3,2.4);data.lens=48;aim(camera,(-.15,0,.85));scene.camera=camera
scene.frame_set(41,subframe=.16)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.shading.type='MATERIAL';space.clip_start=.02
            space.region_3d.view_distance=4.3;space.region_3d.view_location=Vector((-.15,0,.9))
            space.region_3d.view_rotation=Vector((-4,3,1.5)).to_track_quat('Z','Y')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bicycle-transitions.blend'),compress=True)
print('TRANSITION_STUDY_SAVED',flush=True)
