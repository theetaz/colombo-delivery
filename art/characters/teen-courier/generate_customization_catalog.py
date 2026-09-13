"""Derive a modular preview catalog from the approved reconstructed teen."""
from pathlib import Path
import json, math, struct, sys
import bpy, bmesh
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from wardrobe_geometry import _SurfaceProjector, create_bottom_variant, create_top_variant

ROOT=Path(__file__).resolve().parents[3];SRC=ROOT/'art/characters/teen-courier/teen_courier_modular_base.blend';BLEND=ROOT/'art/characters/teen-courier/teen_courier_customization.blend';GLB=ROOT/'public/models/teen_courier_customization.glb';MANIFEST=ROOT/'public/models/teen_courier_customization.manifest.json';PREV=ROOT/'public/models/teen_courier_customization_previews';STATIC_GLB=ROOT/'public/models/teen_courier.glb'
IDS={'face':['classic','soft','angular'],'hair':['wavy','crop','quiff'],'top':['crewtee','polo','buttonshirt'],'bottom':['shorts','trousers'],'shoes':['canvas','runner','hightop'],'sunglasses':['none','round','squareframe'],'necklace':['none','chain'],'watch':['none','sport']}
DEFAULT={k:v[0] for k,v in IDS.items()};LABEL={'classic':'Classic','soft':'Soft','angular':'Angular','wavy':'Wavy','crop':'Crop','quiff':'Quiff','crewtee':'Crew tee','polo':'Polo','buttonshirt':'Button shirt','shorts':'Shorts','trousers':'Trousers','canvas':'Canvas','runner':'Runner','hightop':'High-top','none':'None','round':'Round','squareframe':'Square frame','chain':'Chain','sport':'Sport'}

def empty(name,parent=None):o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
def material(name,color,metal=0,rough=.7):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
def clone(source,name,parent):o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.name=name;o.data.name=name+'_Mesh';o.parent=parent;o.hide_render=False;o.hide_viewport=False;return o
def item(slot,id,slots):return empty(f'Item_{slot}_{id}',slots[slot])
def cube(name,loc,scale,mat,parent,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);o.parent=parent
 if bevel:md=o.modifiers.new('Tailored edge','BEVEL');md.width=bevel;md.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=md.name)
 return o
def torus(name,loc,major,minor,mat,parent,rot=(math.pi/2,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=28,minor_segments=8,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.data.materials.append(mat);o.parent=parent;return o
def curve(name,pts,bevel,mat,parent,cyclic=False):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=bevel;cu.bevel_resolution=2;s=cu.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,p in zip(s.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 s.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o.parent=parent;return o
def lens_disc(name,loc,scale,mat,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);o.parent=parent;return o
def subset(source,name,predicate,parent,mat=None):
 o=clone(source,name,parent);bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table();bad=[]
 for f in bm.faces:
  c=f.calc_center_median()
  if not predicate(c):bad.append(f)
 bmesh.ops.delete(bm,geom=bad,context='FACES');bm.to_mesh(o.data);bm.free()
 if mat:
  o.data.materials.clear();o.data.materials.append(mat)
  for polygon in o.data.polygons:polygon.material_index=0
 return o
def body_partition(source,name,keep_lower,parent):
 o=clone(source,name,parent);bm=bmesh.new();bm.from_mesh(o.data);bad=[]
 for face in bm.faces:
  center=face.calc_center_median();is_lower=face.material_index==0 and .17<center.z<.70 and abs(center.x)<.235
  if is_lower!=keep_lower:bad.append(face)
 bmesh.ops.delete(bm,geom=bad,context='FACES');bm.to_mesh(o.data);bm.free();o.data.update();transfer=o.modifiers.new('Approved corner normals','DATA_TRANSFER');transfer.object=source;transfer.use_loop_data=True;transfer.data_types_loops={'CUSTOM_NORMAL'};transfer.loop_mapping='POLYINTERP_NEAREST';bpy.context.view_layer.objects.active=o
 try:bpy.ops.object.modifier_apply(modifier=transfer.name)
 except RuntimeError:o.modifiers.remove(transfer)
 return o
def deform_face(o,kind):
 for v in o.data.vertices:
  x,y,z=v.co
  if not 1.29<z<1.54:continue
  central=y>.105 and abs(x)<.072
  if central:continue
  t=max(0,min(1,(1.49-z)/.17))
  if kind=='soft':v.co.x*=1+.035*t;v.co.y+=.004*t;v.co.z+=.004*(1-t)
  elif kind=='angular':v.co.x*=1-.018*(1-t)+.035*t;v.co.y-=.004*t
def deform_hair(o,kind):
 for v in o.data.vertices:
  x,y,z=v.co
  # Affine reshaping keeps every authored lock and UV seam in the same
  # topological order; nonlinear crown compression folded thin triangles.
  if kind=='crop':v.co.x=x*.93;v.co.y=.02+(y-.02)*.94;v.co.z=1.43+(z-1.43)*.72
  elif kind=='quiff':v.co.x=x*.94+.012*(z-1.43);v.co.z=1.43+(z-1.43)*1.12
def front_y(base,x,z):
 near=[v.co.y for v in base.data.vertices if abs(v.co.x-x)<.035 and abs(v.co.z-z)<.045]
 return max(near) if near else .105
def add_top_details(id,p,base,accent,metal):
 if id=='polo':
  left=cube('Polo_Collar_L',(-.035,front_y(base,-.035,1.272)+.003,1.272),(.035,.0025,.009),accent,p,.003);left.rotation_euler.y=-.55
  right=cube('Polo_Collar_R',(.035,front_y(base,.035,1.272)+.003,1.272),(.035,.0025,.009),accent,p,.003);right.rotation_euler.y=.55
  zs=[1.25,1.22,1.19];curve('Polo_Placket',[(0,front_y(base,0,z)+.003,z) for z in zs],.003,accent,p)
  for i in range(2):
   z=1.225-i*.032;torus(f'Polo_Button_{i}',(0,front_y(base,0,z)+.006,z),.005,.0015,metal,p)
 if id=='buttonshirt':
  zs=[1.25,1.18,1.11,1.04,.97,.90,.84];curve('ButtonShirt_Placket',[(0,front_y(base,0,z)+.003,z) for z in zs],.0035,accent,p)
  for i in range(6):
   z=1.21-i*.073;torus(f'Shirt_Button_{i}',(0,front_y(base,0,z)+.006,z),.0045,.0014,metal,p)
def add_shoe_details(id,p,shoe,sole,accent):
 # The reconstructed canvas already carries fitted laces and sole relief.
 # Variants reshape that complete shoe mesh rather than adding floating bars.
 pass
def descendants(o):
 out=[o]
 for c in o.children:out+=descendants(c)
 return out
def set_visible(slot,id,slots):
 for s,values in IDS.items():
  selected=id if s==slot else DEFAULT[s]
  for value in values:
   node=bpy.data.objects.get(f'Item_{s}_{value}')
   if node:
    for o in descendants(node):o.hide_render=value!=selected
def render_thumbnails(root,slots):
 PREV.mkdir(parents=True,exist_ok=True);sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE';sc.render.resolution_x=320;sc.render.resolution_y=320;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA';sc.render.film_transparent=True;sc.world.color=(.05,.05,.05)
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.lens=68;sc.camera=cam
 def aim(loc,target):cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
 for loc,en,size in [((2,3,4),170,2.5),((-2,2,2),110,2),((0,-2,3),130,2)]:bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=en;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
 framing={'face':((.26,.72,1.47),(0,0,1.43)),'hair':((.26,.72,1.50),(0,0,1.47)),'top':((.36,1.12,1.12),(0,0,1.08)),'bottom':((.34,1.25,.48),(0,0,.48)),'shoes':((.25,.66,.12),(0,.02,.08)),'sunglasses':((.22,.62,1.47),(0,0,1.45)),'necklace':((.22,.66,1.25),(0,0,1.24)),'watch':((-.51,.48,.83),(-.28,0,.82))}
 thumbs={}
 for slot,values in IDS.items():
  thumbs[slot]={};aim(*framing[slot])
  for id in values:
   set_visible(slot,id,slots);path=PREV/f'{slot}-{id}.png';sc.render.filepath=str(path);bpy.ops.render.render(write_still=True);thumbs[slot][id]=f'teen_courier_customization_previews/{path.name}'
 return thumbs

def unpack_glb(path):
 data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);off=20+n;m=struct.unpack_from('<I',data,off)[0];return doc,data[off+8:off+8+m]
def pack_glb(path,doc,binary):
 binary+=b'\0'*(-len(binary)%4);doc['buffers'][0]['byteLength']=len(binary);raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*(-len(raw)%4);total=12+8+len(raw)+8+len(binary);path.write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(binary),b'BIN\0')+binary)
def embed_customization_mask():
 source,source_bin=unpack_glb(STATIC_GLB);target,target_bin=unpack_glb(GLB);si=next(i for i,x in enumerate(source['images']) if x.get('name')=='TeenCourier_CustomizationMask');v=source['bufferViews'][source['images'][si]['bufferView']];blob=source_bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];target_bin+=b'\0'*(-len(target_bin)%4);offset=len(target_bin);target_bin+=blob;target['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(blob)});target['images'].append({'name':'TeenCourier_CustomizationMask','mimeType':'image/png','bufferView':len(target['bufferViews'])-1});target.setdefault('samplers',[]).append({'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497});target.setdefault('textures',[]).append({'name':'TeenCourier_CustomizationMask','sampler':len(target['samplers'])-1,'source':len(target['images'])-1});index=len(target['textures'])-1;node=next(x for x in target['nodes'] if x.get('name')=='TeenCourierCustomization');node.setdefault('extras',{})['customization']={'ready':True,'maskTextureIndex':index,'texCoord':0,'channels':{'skin':'r','shirt':'g','shoes':'b'},'mode':'masked_hsv_hue_saturation','preserveValue':True,'default':'authored'};pack_glb(GLB,target,target_bin);return index

def main():
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.open_mainfile(filepath=str(SRC));src={k:bpy.data.objects[f'Original_{k.capitalize()}'] for k in ('body','face','hair','top','bottom','shoes')};old=bpy.data.objects['TeenCourierModularBase'];old.hide_viewport=True;old.hide_render=True
 for source_root in [bpy.data.objects.get('TeenCourierModularBase'),bpy.data.objects.get('ApprovedTeen_Reference')]:
  if source_root:
   for hidden in descendants(source_root):hidden.hide_viewport=True;hidden.hide_render=True
 root=empty('TeenCourierCustomization');root['upAxis']='+Y';root['forwardAxis']='-Z';root['heightMeters']=1.62;root['previewReady']=True;root['gameReady']=False;slots={s:empty(f'Slot_{s}',root) for s in IDS}
 body=body_partition(src['body'],'Body_Base',False,root)
 for id in IDS['face']:
  p=item('face',id,slots);o=clone(src['face'],f'Face_{id}',p)
  if id!='classic':deform_face(o,id)
 for id in IDS['hair']:
  p=item('hair',id,slots);o=clone(src['hair'],f'Hair_{id}',p)
  if id!='wavy':deform_hair(o,id)
 for id in IDS['top']:
  p=item('top',id,slots);create_top_variant(id,src['top'],p,{'cloth':None,'accent':material('Custom_Top_Trim',(.06,.34,.39)),'hardware':material('Custom_Hardware',(.12,.13,.14),.3,.35)})
 pants=material('Custom_Bottom',(.12,.14,.18))
 for id in IDS['bottom']:
  p=item('bottom',id,slots)
  if id=='shorts':lower=body_partition(src['body'],'Body_Lower_Shorts',True,p);lower['preserveSourceTint']=True
  create_bottom_variant(id,src['bottom'],p,{'cloth':pants},src['body'])
 for id in IDS['shoes']:
  p=item('shoes',id,slots);o=clone(src['shoes'],f'Shoes_{id}',p)
  if id=='runner':o.scale.y=1.075;o.scale.z=.95
  if id=='hightop':
   for vertex in o.data.vertices:
    if vertex.co.z>.055:vertex.co.z+=.055*min(1,(vertex.co.z-.055)/.055)
  add_shoe_details(id,p,material('Custom_Shoes',(.86,.84,.78)),material('Custom_Sole',(.08,.09,.1)),material('Custom_Shoe_Accent',(.75,.31,.12)))
 metal=material('Custom_Accessory_Metal',(.08,.09,.1),.65,.28);lens=material('Custom_Lens',(.03,.07,.08),.15,.2);gold=material('Custom_Chain',(.66,.46,.15),.8,.25)
 p=item('sunglasses','round',slots)
 for s in (-1,1):
  torus(f'Round_Frame_{s}',(s*.039,.112,1.448),.021,.0025,metal,p);lens_disc(f'Round_Lens_{s}',(s*.039,.109,1.448),(.0185,.0015,.0185),lens,p);curve(f'Round_Temple_{s}',[(s*.060,.108,1.45),(s*.086,.070,1.45),(s*.088,.030,1.44)],.002,metal,p)
 curve('Round_Bridge',[(-.018,.113,1.45),(0,.125,1.448),(.018,.113,1.45)],.0025,metal,p)
 p=item('sunglasses','squareframe',slots)
 for s in (-1,1):
  cx=s*.039
  cube(f'Square_Top_{s}',(cx,.112,1.466),(.024,.0025,.0025),metal,p,.0012);cube(f'Square_Bottom_{s}',(cx,.112,1.434),(.024,.0025,.0025),metal,p,.0012)
  cube(f'Square_Outer_{s}',(cx+s*.024,.112,1.45),(.0025,.0025,.016),metal,p,.0012);cube(f'Square_Inner_{s}',(cx-s*.024,.112,1.45),(.0025,.0025,.016),metal,p,.0012);lens_disc(f'Square_Lens_{s}',(cx,.109,1.45),(.0215,.0015,.0135),lens,p);curve(f'Square_Temple_{s}',[(s*.063,.108,1.452),(s*.088,.068,1.45),(s*.088,.030,1.44)],.002,metal,p)
 curve('Square_Bridge',[(-.016,.113,1.452),(0,.125,1.450),(.016,.113,1.452)],.0025,metal,p)
 p=item('necklace','chain',slots);projector=_SurfaceProjector(bpy.data.objects['Top_crewtee'],p);left,_=projector.point(-.065,1.275,.004);low,_=projector.point(0,1.215,.004);right,_=projector.point(.065,1.275,.004);curve('Chain_Geometry',[left,low,right,(.065,-.035,1.292),(-.065,-.035,1.292)],.003,gold,p,True)
 p=item('watch','sport',slots);torus('Watch_Band',(-.31,.005,.79),.036,.009,metal,p,rot=(0,math.pi/2,0));cube('Watch_Face',(-.318,.044,.79),(.012,.025,.031),material('Custom_Watch_Accent',(.88,.34,.12)),p,.006)
 for n,loc in [('Anchor_Eyes',(0,.16,1.455)),('Anchor_Neck',(0,.11,1.26)),('Anchor_Wrist_L',(-.31,0,.79))]:a=empty(n,root);a.location=loc
 thumbs=render_thumbnails(root,slots)
 for o in list(bpy.context.scene.objects):
  if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
 for s,values in IDS.items():
  for value in values:
   node=bpy.data.objects.get(f'Item_{s}_{value}')
   if node:
    for o in descendants(node):o.hide_render=False
 bpy.ops.object.select_all(action='DESELECT')
 for o in descendants(root):o.select_set(True)
 GLB.parent.mkdir(parents=True,exist_ok=True);bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',export_yup=True,export_extras=True,use_selection=True,export_apply=True);mask_index=embed_customization_mask()
 for s in IDS:set_visible(s,DEFAULT[s],slots)
 for s,values in IDS.items():
  for value in values:
   node=bpy.data.objects.get(f'Item_{s}_{value}')
   if node:
    for child in descendants(node):child.hide_viewport=child.hide_render
 bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
 items={s:[{'id':i,'label':LABEL[i],'thumbnail':thumbs[s][i]} for i in values] for s,values in IDS.items()};slots_meta={s:{'default':DEFAULT[s],'items':items[s]} for s in IDS};manifest={'asset':GLB.name,'root':'TeenCourierCustomization','customization':{'previewReady':True,'rigReady':False,'gameReady':False,'maskTextureIndex':mask_index,'slots':slots_meta,'colorRegions':['skin','hair','top','bottom','shoes']},'items':items,'contract':{'units':'meters','upAxis':'+Y','forwardAxis':'-Z','heightMeters':1.62},'anchors':['Anchor_Eyes','Anchor_Neck','Anchor_Wrist_L'],'provenance':'Derived from the approved original project teen reconstruction; variant deformation and added garment/accessory geometry authored in Blender.','limitations':['Static preview geometry. Items are not skinned or validated for bicycle deformation.','Original PBR surfaces are preserved; new solid-color detail geometry has no baked texture maps.']};MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'glbBytes':GLB.stat().st_size,'thumbnails':sum(map(len,IDS.values())),'objects':len(descendants(root))}))
if __name__=='__main__':main()
