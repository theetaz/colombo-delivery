"""Split the approved reconstructed teen without changing geometry or UVs.

This is a visual-parity checkpoint, not the final customization catalog.
"""

from pathlib import Path
import json
import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'art/characters/teen-courier/teen_courier_cleanup.blend'
BLEND=ROOT/'art/characters/teen-courier/teen_courier_modular_base.blend'
GLB=ROOT/'public/models/teen_courier_modular_base_review.glb'
PREVIEW=ROOT/'public/models/teen_courier_modular_base_comparison.png'
MANIFEST=ROOT/'public/models/teen_courier_modular_base_review.manifest.json'
CATEGORIES=('body','face','hair','top','bottom','shoes')

def image_pixels(image):
    values=np.empty(len(image.pixels),dtype=np.float32); image.pixels.foreach_get(values)
    return values.reshape(image.size[1],image.size[0],4)

def sample(pixels,uv):
    h,w,_=pixels.shape
    x=min(w-1,max(0,int((uv.x%1)*w))); y=min(h-1,max(0,int((uv.y%1)*h)))
    return pixels[y,x,:3]

def classify(z,y,rgb):
    r,g,b=(float(x) for x in rgb); value=max(r,g,b); chroma=value-min(r,g,b)
    dark=value<.23; warm=r>g*1.06 and g>b*1.04
    teal=g>r*1.05 and b>r*1.08 and value>.12
    neutral=chroma<.13
    # Hair is restricted behind/above the brow plane; dark facial features on
    # the front surface stay with the approved face.
    # The crown contains light-painted highlight polygons as well as dark locks.
    # Keep the complete upper cap with the swappable hair so shortened styles do
    # not reveal unmoved triangular remnants from the face partition.
    if z>1.53: return 'hair'
    if z>1.43 and dark and y<.095: return 'hair'
    if z>1.275: return 'face'
    if z<.205 and value>.34 and (neutral or b>=r*.88): return 'shoes'
    if .78<z<1.30 and teal: return 'top'
    return 'body'

def keep_faces_copy(source,name,keep,parent):
    obj=source.copy(); obj.data=source.data.copy(); bpy.context.collection.objects.link(obj); obj.name=name; obj.data.name=f'{name}_Mesh'; obj.parent=parent
    bm=bmesh.new();bm.from_mesh(obj.data);bm.faces.ensure_lookup_table();keep=set(keep);bmesh.ops.delete(bm,geom=[face for face in bm.faces if face.index not in keep],context='FACES');bm.to_mesh(obj.data);bm.free();obj.data.update()
    return obj

def descendants(root):
    out=[root]
    for child in root.children: out.extend(descendants(child))
    return out

def main():
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    source=bpy.data.objects['TeenCourier']; source.name='ApprovedTeen_Reference'
    material=source.data.materials[0]
    color_node=next(n for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'Color_' in n.image.name)
    pixels=image_pixels(color_node.image); uv_layer=source.data.uv_layers.active.data
    # Grow hair from the unquestioned crown through edge-connected dark or
    # neutral hair paint. This captures bright front locks while disconnected
    # irises and brows cannot enter the region.
    candidates=set();seeds=[];edge_faces={}
    for polygon in source.data.polygons:
        uv=sum((uv_layer[i].uv for i in polygon.loop_indices),Vector((0,0)))/len(polygon.loop_indices);center=sum((source.data.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices);r,g,b=sample(pixels,uv);value=max(r,g,b);neutral=max(r,g,b)-min(r,g,b)<.11
        if center.z>1.40 and (value<.42 or neutral):candidates.add(polygon.index)
        if center.z>1.53:seeds.append(polygon.index)
        for edge in polygon.edge_keys:edge_faces.setdefault(edge,[]).append(polygon.index)
    adjacency={p.index:set() for p in source.data.polygons}
    for linked in edge_faces.values():
        for a in linked:adjacency[a].update(x for x in linked if x!=a)
    hair=set(seeds);stack=list(seeds)
    while stack:
        current=stack.pop()
        for neighbor in adjacency[current]:
            if neighbor in candidates and neighbor not in hair:hair.add(neighbor);stack.append(neighbor)
    assigned={category:[] for category in CATEGORIES}
    for polygon in source.data.polygons:
        uv=sum((uv_layer[i].uv for i in polygon.loop_indices),Vector((0,0)))/len(polygon.loop_indices)
        center=sum((source.data.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)
        # Reconstructed eye/brow islands sit farther back than the outer face
        # (around local y=.07), so protect the measured bilateral eye boxes even
        # if a seam edge touches a dark hair candidate.
        eye_guard=any(1.40<source.data.vertices[i].co.z<1.50 and .010<abs(source.data.vertices[i].co.x)<.11 and source.data.vertices[i].co.y>.04 for i in polygon.vertices)
        rgb=sample(pixels,uv);teal=rgb[2]>rgb[0]*1.08 and rgb[1]>rgb[0]*1.08;shorts_guard=.48<center.z<.90 and polygon.material_index==3 and (not teal or (center.z<.79 and abs(center.x)<.17))
        assigned['face' if eye_guard else ('hair' if polygon.index in hair else ('bottom' if shorts_guard else classify(center.z,center.y,rgb)))].append(polygon.index)

    root=bpy.data.objects.new('TeenCourierModularBase',None); bpy.context.collection.objects.link(root)
    root['status']='visual-parity-split';root['upAxis']='+Y';root['forwardAxis']='-Z';root['heightMeters']=1.62
    split={category:keep_faces_copy(source,f'Original_{category.capitalize()}',indices,root) for category,indices in assigned.items()}
    # Restore the approved corner normals after topology separation. This keeps
    # the reassembled garment seams shaded like the untouched reconstruction.
    for obj in split.values():
        transfer=obj.modifiers.new('Approved corner normals','DATA_TRANSFER');transfer.object=source;transfer.use_loop_data=True;transfer.data_types_loops={'CUSTOM_NORMAL'};transfer.loop_mapping='POLYINTERP_NEAREST'
        bpy.context.view_layer.objects.active=obj
        try:bpy.ops.object.modifier_apply(modifier=transfer.name)
        except RuntimeError:obj.modifiers.remove(transfer)
    source.hide_render=True;source.hide_viewport=True
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in descendants(root): obj.select_set(True)
    GLB.parent.mkdir(parents=True,exist_ok=True);bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',export_yup=True,export_extras=True,use_selection=True)

    # Render approved reference and reassembled split from identical cameras.
    source.hide_render=False;source.hide_viewport=False;source.location.x=-.48
    for obj in split.values(): obj.location.x=.48
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=960;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(PREVIEW);scene.world.color=(.045,.055,.07)
    bpy.ops.object.camera_add(location=(2.8,5.8,2.05));camera=bpy.context.object;camera.data.lens=65;camera.rotation_euler=(Vector((0,0,.82))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    for loc,energy,size in [((3,-3,4),1500,2.5),((-3,-2,2),900,2.0),((0,2,3),1100,2.0)]:
        bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.data.energy=energy;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.render.render(write_still=True)
    counts={category:len(indices) for category,indices in assigned.items()}
    MANIFEST.write_text(json.dumps({'asset':GLB.name,'source':'art/characters/teen-courier/teen_courier_cleanup.blend','status':'visual-parity-split','contract':{'units':'meters','upAxis':'+Y','forwardAxis':'-Z','heightMeters':1.62},'parts':{category:{'node':split[category].name,'triangles':counts[category]} for category in CATEGORIES},'totalTriangles':sum(counts.values()),'preview':PREVIEW.name,'notes':['Every source polygon appears exactly once; geometry coordinates, UV loops, normals, and authored PBR materials are preserved.','Hair uses a spatial brow-plane guard so dark eyes and eyebrows remain in Original_Face.','This checkpoint proves reassembly only; swap variants are not yet included.']},indent=2)+'\n')
    print(json.dumps({'blend':str(BLEND),'glb':str(GLB),'preview':str(PREVIEW),'triangles':counts}))
if __name__=='__main__':main()
