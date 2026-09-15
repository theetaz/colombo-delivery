#!/usr/bin/env python3
"""Prepare a genuine generated environment source for the Colombo road study."""
import argparse, importlib.util, json, sys
from pathlib import Path
import bpy
from mathutils import Vector

ROAD=Path(__file__).resolve().parents[1]; ROOT=ROAD.parents[1]
OUT=ROAD/"environment"; PUBLIC=ROAD/"viewer/public/environment"; MANIFEST=PUBLIC/"manifest.json"
spec=importlib.util.spec_from_file_location("vegetation_prep",ROAD/"vegetation/prepare_vegetation.py")
veg=importlib.util.module_from_spec(spec); spec.loader.exec_module(veg)

def args():
    p=argparse.ArgumentParser(); p.add_argument("--id",required=True); p.add_argument("--source",required=True,type=Path)
    size=p.add_mutually_exclusive_group(required=True); size.add_argument("--width",type=float); size.add_argument("--height",type=float)
    p.add_argument("--kind",required=True,choices=("building","shrub")); p.add_argument("--lod1-ratio",type=float,default=.45)
    return p.parse_args(sys.argv[sys.argv.index("--")+1:])

def normalize(objects,target,axis):
    low,high=veg.world_bounds(objects); extent=(high-low)[axis]
    if extent<=1e-6: raise ValueError("source has no measurable target extent")
    scale=target/extent; center=(low+high)*.5
    for obj in objects:
        obj.scale*=scale; obj.location.x-=center.x*scale; obj.location.y-=center.y*scale; obj.location.z-=low.z*scale
        bpy.context.view_layer.objects.active=obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True); obj.select_set(False)

def export_plain(path,objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects: obj.hide_set(False); obj.hide_render=False; obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_yup=True,export_apply=True,export_image_format="AUTO")
    for obj in objects: obj.select_set(False)

def lod1(objects,ratio,kind,height):
    result=[]
    for source in objects:
        copy=source.copy(); copy.data=source.data.copy(); copy.name=source.name.replace("LOD0","LOD1"); bpy.context.collection.objects.link(copy)
        if len(copy.data.polygons)>24:
            mod=copy.modifiers.new("LOD1_Decimate","DECIMATE"); mod.ratio=ratio; bpy.context.view_layer.objects.active=copy; copy.select_set(True)
            bpy.ops.object.modifier_apply(modifier=mod.name); copy.select_set(False)
        copy.data.validate(clean_customdata=False); copy.data.update()
        result.append(copy)
    # Exporters omit loose vertices and degenerate faces. Ground against vertices
    # referenced by real triangles so the published POSITION accessor starts at 0.
    grounded_points=[]
    for copy in result:
        used={index for polygon in copy.data.polygons if polygon.area>1e-12 for index in polygon.vertices}
        grounded_points.extend((copy.matrix_world@copy.data.vertices[index].co).z for index in used)
    actual_low=min(grounded_points)
    if abs(actual_low)>1e-7:
        for copy in result:
            copy.location.z-=actual_low; bpy.context.view_layer.objects.active=copy; copy.select_set(True)
            bpy.ops.object.transform_apply(location=True,rotation=False,scale=False); copy.select_set(False)
    if kind=="shrub": veg.author_wind(result,"tree",height)
    return result

def add_anchor(asset_id,bounds):
    # Authoring -Y becomes glTF +Z. This is an explicit interaction reference,
    # never a claim that a doorway was detected in generated geometry.
    empty=bpy.data.objects.new(f"{asset_id}.anchor.front",None); bpy.context.collection.objects.link(empty)
    empty.location=(0,bounds[0].y,0); empty.empty_display_type="ARROWS"; empty["purpose"]="exterior interaction reference; not detected doorway"

def main():
    a=args(); source=a.source.resolve()
    if not source.is_file(): raise FileNotFoundError(source)
    OUT.mkdir(parents=True,exist_ok=True); PUBLIC.mkdir(parents=True,exist_ok=True); veg.reset_scene(); veg.import_source(source)
    near=veg.meshes()
    if not near: raise ValueError("source imported without mesh geometry")
    for obj in near: obj.data.validate(clean_customdata=False); obj.data.update()
    normalize(near,a.width if a.width else a.height,0 if a.width else 2)
    for i,obj in enumerate(near): obj.name=f"{a.id}_LOD0_{i:02d}"
    textures=veg.resize_and_pack_images()
    if a.kind=="shrub": veg.author_wind(near,"tree",a.height)
    low,high=veg.world_bounds(near); width=high.x-low.x; height=high.z-low.z; depth=high.y-low.y
    if a.kind=="building": add_anchor(a.id,(low,high))
    mid=lod1(near,a.lod1_ratio,a.kind,height)
    near_path=PUBLIC/f"{a.id}.lod0.glb"; mid_path=PUBLIC/f"{a.id}.lod1.glb"
    exporter=veg.export_selected if a.kind=="shrub" else export_plain
    exporter(near_path,near); exporter(mid_path,mid)
    for obj in near: obj.hide_set(False)
    for obj in mid: obj.hide_set(True); obj.hide_render=True
    blend=OUT/f"{a.id}.blend"; bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True)
    glb_min=(low.x,low.z,-high.y); glb_max=(high.x,high.z,-low.y)
    entry={"id":a.id,"label":a.id.removeprefix("environment.").replace("-01","").replace("-"," ").title(),"kind":a.kind,
      "height":round(height,6),"width":round(width,6),"depth":round(depth,6),"url":f"/environment/{near_path.name}","lod1Url":f"/environment/{mid_path.name}",
      "blendUrl":f"/assets/environment/{a.id}.blend","bounds":{"min":[round(x,6) for x in glb_min],"max":[round(x,6) for x in glb_max]},
      "frontAssumption":"Authoring -Y / glTF +Z; generated orientation assumption, not human verified.","triangleCount":veg.triangles(near),"lod1TriangleCount":veg.triangles(mid),
      "source":{"filename":source.name,"sha256":veg.sha256(source),"generator":"Tripo"},
      "coordinateSystem":{"authoringUp":"Z","glbUp":"Y","front":"Z","unit":"metre","grounded":True},"materials":veg.materials(near),"textures":textures,
      "lods":[{"level":0,"uri":f"/environment/{near_path.name}","triangles":veg.triangles(near),"bytes":near_path.stat().st_size,"sha256":veg.sha256(near_path)},
              {"level":1,"uri":f"/environment/{mid_path.name}","triangles":veg.triangles(mid),"bytes":mid_path.stat().st_size,"sha256":veg.sha256(mid_path)}]}
    if a.kind=="building":
        entry["anchors"]={"front":{"id":f"{a.id}.anchor.front","position":[0,0,round(glb_max[2],6)],"purpose":"exterior interaction reference; not detected doorway"}}
        entry["collisionFootprint"]={"minX":round(glb_min[0],6),"maxX":round(glb_max[0],6),"minZ":round(glb_min[2],6),"maxZ":round(glb_max[2],6),"method":"conservative visual bounds; includes roof, awning, and balcony extents"}
    else:
        entry["wind"]={"attribute":"COLOR_0","channels":{"r":"bend","g":"flutter","b":"phase"},"rootLocked":True,"method":"base-colour UV greenness plus height heuristic","limitations":"Generated mesh semantics were inferred; masks are not a hand-authored botanical rig. Runtime must not use COLOR_0 as material tint."}
    manifest={"schemaVersion":1,"assets":[]}
    if MANIFEST.exists(): manifest=json.loads(MANIFEST.read_text())
    manifest["assets"]=sorted([x for x in manifest.get("assets",[]) if x.get("id")!=a.id]+[entry],key=lambda x:x["id"])
    MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n"); print(json.dumps(entry,indent=2))

if __name__=="__main__": main()
