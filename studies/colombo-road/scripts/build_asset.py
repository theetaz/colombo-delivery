"""Create the editable Blender scene and standard GLB files. No rendering or tests."""
import collections
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT/'source/prepared-scene.json').read_text())
manifest = json.loads((ROOT/'manifest.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene['asset_stage'] = 'Geographic blockout for user testing'
scene['origin_lon_lat'] = json.dumps(manifest['origin_lon_lat'])
scene['accuracy'] = 'See README.md and manifest.json; widths and bridge heights are approximate'
layers = {}


def collection(name):
    if name not in layers:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        layers[name] = c
    return layers[name]


def material(name, hex_color, roughness=.85, metallic=0):
    rgb = [int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
    rgb = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb,1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb,1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return m


colors = {'terrain':'aeb29b','water':'477f82','parks':'6e8c58','rail':'655e53',
          'paths':'c8c0a9','roads':'45494b','restricted_roads':'625954','bridges':'50565b'}
mats = {k:material(k,v,.32 if k=='water' else .9) for k,v in colors.items()}
building_mats = [material(f'Building blockout {i+1}',c) for i,c in enumerate(
    ['d3cdbd','c1bdb1','bcb7a7','ded8c6','b7bec0','c9b8a5'])]


def mesh_object(name, vertices, faces, layer, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name,mesh)
    collection(layer).objects.link(obj)
    obj['asset_layer'] = layer
    return obj


road_objects = []
for name, mesh in data['meshes'].items():
    if not mesh['faces']:
        continue
    layer = '01 Roads' if name in ('roads','restricted_roads','bridges') else '02 Context'
    obj = mesh_object(name,mesh['vertices'],mesh['faces'],layer,mats[name])
    if layer=='01 Roads':
        road_objects.append(obj)
        obj['width_accuracy'] = 'Source widths where present; otherwise estimated'
        obj['physics_ready'] = False


buckets = collections.defaultdict(lambda: {'vertices':[],'faces':[],'building_ids':[]})
for index,building in enumerate(data['buildings']):
    rings = building['geometry']['coordinates']
    centre = rings[0][0]
    key = (math.floor(centre[0]/250),math.floor(centre[1]/250),index%6)
    bucket = buckets[key]
    verts, faces = bucket['vertices'], bucket['faces']
    base = building['base']
    height = building['height']
    roof_loops, roof_indices, lookup = [], [], {}
    bottom_lookup = {}
    for ring in rings:
        points = ring[:-1]
        n = len(points)
        start = len(verts)
        for x,y in points:
            bottom_lookup[(x,y)] = len(verts)
            verts.append((x,y,base))
        for x,y in points:
            lookup[(x,y)] = len(verts)
            roof_indices.append(len(verts))
            verts.append((x,y,base+height))
        for i in range(n):
            j = (i+1)%n
            faces.append((start+i,start+j,start+n+j,start+n+i))
        roof_loops.append([Vector((x,y,0)) for x,y in points])
    for tri in tessellate_polygon(roof_loops):
        indices = [roof_indices[v] if isinstance(v,int) else lookup[(v.x,v.y)] for v in tri]
        a,b,c = [verts[i] for i in indices]
        if (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0:
            indices.reverse()
        faces.append(indices)
        faces.append([bottom_lookup[(verts[i][0],verts[i][1])] for i in reversed(indices)])
    bucket['building_ids'].append(building['id'])

for (tx,ty,variant),bucket in buckets.items():
    obj = mesh_object(f'Buildings {tx} {ty} material {variant}',bucket['vertices'],bucket['faces'],
                      '03 Building blockouts',building_mats[variant])
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj['building_ids'] = json.dumps(bucket['building_ids'])
    obj['accuracy'] = 'Mapped footprints, mixed source/estimated heights; placeholder appearance'
print('BUILDING CONTEXT CREATED',len(data['buildings']),flush=True)


marker_mat = material('Reference marker amber','e6a83b',.6)
post_mat = material('Reference marker post','454b51',.7)
marker_collection = collection('04 Traffic control reference markers')
for control in data['controls']:
    x,z,minus_y = control['position']
    y = -minus_y
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.09,depth=2.5,location=(x,y,z+1.25))
    post = bpy.context.object
    post.name = f"Reference post {control['id']}"
    for col in list(post.users_collection):
        col.objects.unlink(post)
    marker_collection.objects.link(post)
    post.data.materials.append(post_mat)
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z+2.8))
    marker = bpy.context.object
    marker.name = f"{control['kind']} reference {control['id']}"
    marker.scale = (.65,.65,.65)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for col in list(marker.users_collection):
        col.objects.unlink(marker)
    marker_collection.objects.link(marker)
    marker.data.materials.append(marker_mat)
    marker['osm_node_id'] = control['id']
    marker['kind'] = control['kind']
    marker['placement'] = control['placement']
    marker['not_a_functional_traffic_signal'] = True


before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source/lotus-tower-original.glb'))
tower_objects = set(bpy.data.objects)-before
tower_collection = collection('05 Lotus Tower')
for obj in tower_objects:
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    tower_collection.objects.link(obj)
    if not obj.parent:
        obj.location.z += data['tower_base_z']
    if obj.type=='MESH':
        obj.data.calc_loop_triangles()
        count = len(obj.data.loop_triangles)
        if count > 5000:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            modifier = obj.modifiers.new('Browser geometry reduction','DECIMATE')
            modifier.ratio = .15
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)
    obj['asset_layer'] = 'Lotus Tower'
print('LOTUS TOWER INCLUDED',len(tower_objects),'objects',flush=True)


def export(filename,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/filename),export_format='GLB',
        use_selection=True,use_active_scene=True,export_apply=True,export_extras=True,
        export_animations=False,export_cameras=False,export_lights=False)
    print('CREATED',filename,flush=True)


export('road-surfaces.glb',road_objects)
export('colombo-roads.glb',[o for o in scene.objects if o.type in ('MESH','EMPTY')])

presentation = collection('06 Presentation')
sun_data = bpy.data.lights.new('Daylight','SUN')
sun_data.energy = 2.5
sun = bpy.data.objects.new('Daylight',sun_data)
presentation.objects.link(sun)
sun.rotation_euler = (math.radians(30),math.radians(-25),math.radians(-35))
world = bpy.data.worlds.new('Neutral daylight')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.65,.75,.82,1)
world.node_tree.nodes['Background'].inputs[1].default_value = .55
scene.world = world
camera_data = bpy.data.cameras.new('District overview')
camera = bpy.data.objects.new('District overview',camera_data)
presentation.objects.link(camera)
camera.location = (950,-1600,1850)
camera.rotation_euler = (Vector((-400,450,35))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2700
camera_data.clip_end = 15000
scene.camera = camera
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space = area.spaces.active
            space.clip_end = 15000
            space.region_3d.view_perspective = 'CAMERA'
            space.shading.color_type = 'MATERIAL'
            space.overlay.show_floor = False
readme = bpy.data.texts.new('Asset handover')
readme.write((ROOT/'README.md').read_text())
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Colombo_Roads_v1.blend'))

triangle_count = 0
for obj in scene.objects:
    if obj.type=='MESH':
        obj.data.calc_loop_triangles()
        triangle_count += len(obj.data.loop_triangles)
manifest['export'] = {'format':'glTF 2.0 binary, standard uncompressed geometry',
                      'triangles':triangle_count,'mesh_objects':sum(o.type=='MESH' for o in scene.objects),
                      'files':{name:(ROOT/name).stat().st_size for name in (
                          'Colombo_Roads_v1.blend','colombo-roads.glb','road-surfaces.glb')}}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('ASSET EXPORT COMPLETE',json.dumps(manifest['export']),flush=True)
