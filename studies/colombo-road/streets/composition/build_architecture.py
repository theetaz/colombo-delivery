"""Generate the A+B+C Colombo short-street architecture kit.

Run with Blender 4.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python studies/colombo-road/streets/composition/build_architecture.py
"""
from __future__ import annotations

import json
import math
import hashlib
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[4]
SOURCE_DIR = ROOT / "studies/colombo-road/streets/composition"
PUBLIC_DIR = ROOT / "studies/colombo-road/viewer/public/streets/composition"
BLEND_PATH = SOURCE_DIR / "architecture.blend"
GLB_PATH = PUBLIC_DIR / "architecture.glb"
MANIFEST_PATH = PUBLIC_DIR / "architecture.manifest.json"
SOURCE_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
    if datablocks != bpy.data.materials:
        for block in list(datablocks):
            datablocks.remove(block)

PALETTE = {
    "MAT_PlasterCream": ((0.72, 0.60, 0.42, 1), 0.82, 0.0),
    "MAT_PlasterSage": ((0.25, 0.42, 0.34, 1), 0.84, 0.0),
    "MAT_PlasterTeal": ((0.12, 0.37, 0.39, 1), 0.80, 0.0),
    "MAT_PlasterOchre": ((0.63, 0.36, 0.16, 1), 0.86, 0.0),
    "MAT_PlasterRose": ((0.55, 0.29, 0.25, 1), 0.85, 0.0),
    "MAT_Limewash": ((0.70, 0.69, 0.57, 1), 0.91, 0.0),
    "MAT_TrimStone": ((0.68, 0.64, 0.53, 1), 0.78, 0.0),
    "MAT_Concrete": ((0.39, 0.40, 0.36, 1), 0.92, 0.0),
    "MAT_Terracotta": ((0.43, 0.13, 0.055, 1), 0.86, 0.0),
    "MAT_Timber": ((0.16, 0.075, 0.033, 1), 0.73, 0.0),
    "MAT_PaintedMetal": ((0.055, 0.085, 0.075, 1), 0.55, 0.2),
    "MAT_AwningRust": ((0.50, 0.12, 0.055, 1), 0.78, 0.0),
    "MAT_AwningGreen": ((0.10, 0.30, 0.24, 1), 0.78, 0.0),
    "MAT_Glass": ((0.055, 0.19, 0.21, 1), 0.18, 0.05),
    "MAT_Shadow": ((0.025, 0.035, 0.032, 1), 0.88, 0.0),
    "MAT_FruitGreen": ((0.27, 0.50, 0.09, 1), 0.82, 0.0),
    "MAT_FruitGold": ((0.92, 0.48, 0.05, 1), 0.75, 0.0),
    "MAT_FruitRed": ((0.67, 0.10, 0.045, 1), 0.78, 0.0),
}


def make_material(name, spec):
    color, roughness, metallic = spec
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if name == "MAT_Glass":
        bsdf.inputs["Alpha"].default_value = 0.82
        mat.surface_render_method = "DITHERED"
    return mat


MATS = {name: make_material(name, spec) for name, spec in PALETTE.items()}
ROOTS = []


def asset_root(name, label):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj["asset_family"] = label
    obj["front_axis_gltf"] = "+Z"
    obj["up_axis_gltf"] = "+Y"
    obj["unit"] = "meter"
    obj["origin"] = "ground-center"
    ROOTS.append(obj)
    return obj


def box(parent, name, loc, size, mat, bevel=0.025, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(v / 2 for v in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATS[mat])
    obj.parent = parent
    if bevel:
        mod = obj.modifiers.new("edge-softening", "BEVEL")
        mod.width, mod.segments = bevel, 1
    return obj


def cyl(parent, name, loc, radius, depth, mat, verts=12, rot=(0, 0, 0), bevel=.018):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(MATS[mat])
    obj.parent = parent
    if bevel:
        mod = obj.modifiers.new("edge-softening", "BEVEL")
        mod.width, mod.segments = bevel, 1
    return obj


def gable_roof(parent, loc, width, depth, rise=1.25, mat="MAT_Terracotta", ridge_x=False):
    # ridge_x False: ridge follows X, facade eaves stay horizontal.
    w, d = width / 2, depth / 2
    if not ridge_x:
        verts = [(-w,-d,0),(w,-d,0),(-w,d,0),(w,d,0),(-w,0,rise),(w,0,rise)]
        faces = [(0,1,5,4),(2,4,5,3),(0,2,3,1),(0,4,2),(1,3,5)]
    else:
        verts = [(-w,-d,0),(-w,d,0),(w,-d,0),(w,d,0),(0,-d,rise),(0,d,rise)]
        faces = [(0,4,5,1),(2,3,5,4),(0,2,4),(1,5,3),(0,1,3,2)]
    mesh = bpy.data.meshes.new("GableRoofMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(MATS[mat])
    obj = bpy.data.objects.new("gable-roof", mesh)
    bpy.context.collection.objects.link(obj)
    obj.location, obj.parent = loc, parent
    return obj


def window(parent, x, y, z, w=1.0, h=1.35, trim="MAT_TrimStone", shutters=False):
    box(parent,"window-reveal",(x,y,z),(w+.28,.15,h+.28),"MAT_Shadow",.02)
    box(parent,"window-glass",(x,y-.11,z),(w,.055,h),"MAT_Glass",.008)
    box(parent,"window-sill",(x,y-.18,z-h/2-.10),(w+.38,.32,.13),trim,.018)
    box(parent,"mullion-v",(x,y-.16,z),(.05,.045,h),"MAT_Timber",.006)
    box(parent,"mullion-h",(x,y-.16,z),(w,.045,.05),"MAT_Timber",.006)
    if shutters:
        for side in (-1,1):
            sx=x+side*(w*.69)
            box(parent,"timber-shutter",(sx,y-.13,z),(w*.31,.08,h),"MAT_Timber",.015,rot=(0,0,side*.07))
            for dz in (-.42,-.22,0,.22,.42):
                if abs(dz)<h/2:
                    box(parent,"shutter-louver",(sx,y-.18,z+dz),(w*.24,.035,.035),"MAT_TrimStone",.004)


def door(parent, x, y, z=1.15, w=1.0, h=2.3, color="MAT_Timber", fanlight=False):
    box(parent,"door-reveal",(x,y,z),(w+.30,.16,h+.26),"MAT_Shadow",.025)
    box(parent,"door",(x,y-.12,z),(w,.075,h),color,.025)
    for dx in (-.25,.25):
        box(parent,"door-panel",(x+dx*w,y-.17,z),(w*.38,.025,h*.75),"MAT_TrimStone",.012)
    if fanlight:
        box(parent,"fanlight",(x,y-.16,z+h/2+.28),(w,.05,.34),"MAT_Glass",.01)


def rail(parent, x0, x1, y, floor_z, h=.92, metal="MAT_PaintedMetal"):
    for z in (floor_z+.12,floor_z+h):
        box(parent,"balcony-horizontal",((x0+x1)/2,y,z),(x1-x0,.06,.06),metal,.008)
    count=max(4,math.ceil((x1-x0)/.33))
    for i in range(count+1):
        x=x0+(x1-x0)*i/count
        box(parent,"balcony-baluster",(x,y,floor_z+h/2),(0.04,.04,h),metal,.006)


def awning(parent, x, facade_y, z, w, depth, color="MAT_AwningGreen"):
    angle=math.radians(12)
    box(parent,"awning-cloth",(x,facade_y-depth*.48,z),(w,depth,.10),color,.018,rot=(angle,0,0))
    for dx in (-w/2+.12,w/2-.12):
        cyl(parent,"awning-arm",(x+dx,facade_y-depth*.45,z-.24),.025,depth*.88,"MAT_PaintedMetal",8,rot=(math.radians(78),0,0),bevel=.006)
    for i in range(max(3,int(w/.65))):
        px=x-w/2+(i+.5)*w/max(3,int(w/.65))
        box(parent,"awning-stripe",(px,facade_y-depth*.98,z-.12),(w/max(3,int(w/.65))*.42,.06,.19),"MAT_TrimStone",.005)


def ac(parent,x,y,z):
    box(parent,"air-conditioner",(x,y,z),(.72,.35,.50),"MAT_Concrete",.035)
    cyl(parent,"ac-fan",(x,y-.19,z),.18,.035,"MAT_Shadow",16,rot=(math.pi/2,0,0),bevel=.006)
    for dz in (-.15,.15): box(parent,"ac-bracket",(x,y+.02,z+dz),(.88,.08,.035),"MAT_PaintedMetal",.005)


def tank(parent,x,y,z):
    cyl(parent,"roof-water-tank",(x,y,z),.47,1.02,"MAT_Shadow",16)
    for dz in (-.33,0,.33): cyl(parent,"tank-rib",(x,y,z+dz),.485,.045,"MAT_Concrete",16,bevel=.006)
    for dx in (-.30,.30): box(parent,"tank-stand",(x+dx,y,z-.72),(.08,.08,.48),"MAT_PaintedMetal",.006)


def pot(parent,x,y,z=.30,plant=True):
    cyl(parent,"terracotta-pot",(x,y,z),.25,.48,"MAT_Terracotta",12)
    if plant:
        cyl(parent,"plant-stem",(x,y,z+.49),.035,.58,"MAT_PaintedMetal",8)
        for a in range(0,360,60):
            rad=math.radians(a)
            box(parent,"plant-leaf",(x+math.cos(rad)*.18,y+math.sin(rad)*.10,z+.69),(0.32,.11,.09),"MAT_FruitGreen",.04,rot=(0,rad,rad*.15))


def verandah_house():
    r=asset_root("ARCH_VerandahHouse","Verandah house and garden entrance")
    box(r,"house-shell",(0,.45,2.35),(8.8,5.5,4.7),"MAT_Limewash",.07)
    gable_roof(r,(0,.45,4.68),9.25,6.0,1.38)
    # deep, usable verandah with columns and low plinth
    box(r,"verandah-plinth",(0,-2.72,.16),(8.45,1.24,.32),"MAT_TrimStone",.025)
    box(r,"verandah-roof",(0,-2.83,3.28),(8.9,1.55,.17),"MAT_Terracotta",.025,rot=(math.radians(7),0,0))
    for x in (-3.62,-1.22,1.22,3.62):
        cyl(r,"verandah-column",(x,-3.08,1.72),.13,3.08,"MAT_TrimStone",12)
        box(r,"column-capital",(x,-3.08,3.12),(.40,.40,.20),"MAT_PlasterCream",.035)
    door(r,0,-2.34,1.23,1.18,2.32,fanlight=True)
    for x in (-2.65,2.65): window(r,x,-2.34,2.28,1.18,1.48,shutters=True)
    for x in (-3.35,3.35): pot(r,x,-3.27,.30)
    # roof tile rhythm reads at street distance
    for y in (-2.23,-1.35,-.47,.41,1.29,2.17,3.05):
        box(r,"roof-tile-course",(0,y,5.22),(8.95,.055,.07),"MAT_AwningRust",.006)
    return r


def narrow_balcony_home():
    r=asset_root("ARCH_NarrowBalconyHome","Narrow tropical balcony home")
    box(r,"townhouse-shell",(0,.10,4.25),(5.2,5.1,8.5),"MAT_PlasterRose",.075)
    box(r,"parapet",(0,.10,8.68),(5.5,5.35,.40),"MAT_TrimStone",.045)
    door(r,1.38,-2.49,1.22,1.04,2.3)
    window(r,-1.25,-2.49,1.70,1.15,1.35)
    for floor,z in enumerate((4.35,6.95)):
        box(r,"balcony-slab",(0,-2.72,z-.93),(4.75,1.03,.18),"MAT_TrimStone",.025)
        box(r,"balcony-recess",(0,-2.50,z),(4.26,.15,2.20),"MAT_Shadow",.018)
        door(r,.94,-2.62,z,.88,2.06,"MAT_Timber")
        window(r,-.90,-2.62,z,1.08,1.34)
        rail(r,-2.18,2.18,-3.18,z-.84)
        pot(r,-1.78,-3.02,z-.54)
    box(r,"vertical-sun-fin",(-2.20,-2.70,4.65),(.24,.48,6.9),"MAT_PlasterCream",.018)
    ac(r,2.24,-2.57,5.75)
    tank(r,1.55,.55,9.42)
    return r


def produce_shop():
    r=asset_root("ARCH_ProduceShop","Neighborhood produce shop")
    box(r,"shop-shell",(0,.20,2.75),(6.5,5.4,5.5),"MAT_PlasterOchre",.075)
    gable_roof(r,(0,.20,5.48),6.95,5.85,1.05)
    box(r,"open-shop-recess",(-.55,-2.55,1.42),(4.55,.20,2.60),"MAT_Shadow",.02)
    box(r,"side-shutter",(2.38,-2.60,1.40),(1.25,.10,2.38),"MAT_Concrete",.018)
    for z in (.43,.68,.93,1.18,1.43,1.68,1.93,2.18):
        box(r,"shutter-slat",(2.38,-2.66,z),(1.10,.025,.035),"MAT_PaintedMetal",.004)
    box(r,"fascia-sign",(-.25,-2.72,2.92),(5.45,.18,.58),"MAT_AwningGreen",.025)
    for x in (-1.65,-.6,.5,1.45): box(r,"abstract-sign-letter",(x,-2.83,2.92),(.58,.035,.09),"MAT_PlasterCream",.005)
    awning(r,-.25,-2.65,3.22,5.7,1.35,"MAT_AwningGreen")
    # stacked timber produce crates and visible fruit volumes
    crate_positions=[(-2.35,-3.16,.38),(-1.42,-3.20,.38),(-.46,-3.21,.38),(.52,-3.18,.38),(1.48,-3.16,.38),(-1.83,-3.18,1.02),(-.82,-3.18,1.02),(.22,-3.18,1.02)]
    fruit_mats=("MAT_FruitGreen","MAT_FruitGold","MAT_FruitRed")
    for idx,(x,y,z) in enumerate(crate_positions):
        box(r,"produce-crate",(x,y,z),(.82,.52,.55),"MAT_Timber",.018)
        for ix in (-.22,0,.22):
            for iy in (-.12,.12):
                cyl(r,"produce",(x+ix,y+iy,z+.35),.095,.16,fruit_mats[idx%3],10)
    box(r,"counter",(-.50,-2.84,1.62),(3.25,.58,.11),"MAT_Timber",.015)
    return r


def cafe_shop_house():
    r=asset_root("ARCH_CafeShopHouse","Cafe shop house")
    box(r,"cafe-shell",(0,.10,4.05),(7.0,5.25,8.1),"MAT_PlasterTeal",.075)
    box(r,"roof-parapet",(0,.10,8.34),(7.34,5.55,.48),"MAT_TrimStone",.045)
    box(r,"cafe-recess",(-.85,-2.57,1.52),(4.55,.18,2.72),"MAT_Shadow",.018)
    box(r,"cafe-glass",(-.85,-2.69,1.52),(4.30,.05,2.48),"MAT_Glass",.008)
    box(r,"cafe-door",(.40,-2.74,1.43),(1.02,.07,2.30),"MAT_Timber",.015)
    box(r,"roller-shutter",(2.65,-2.63,1.45),(1.28,.09,2.50),"MAT_Concrete",.018)
    awning(r,-.55,-2.70,3.20,5.65,1.25,"MAT_AwningRust")
    box(r,"cafe-sign",(1.70,-2.78,3.72),(2.35,.16,.55),"MAT_Timber",.025)
    for x in (.95,1.55,2.15): box(r,"sign-mark",(x,-2.88,3.72),(.38,.035,.07),"MAT_PlasterCream",.004)
    # cafe chairs/tables under awning
    for x in (-2.30,-.90):
        cyl(r,"cafe-table-top",(x,-3.20,.82),.34,.07,"MAT_Timber",16)
        cyl(r,"cafe-table-leg",(x,-3.20,.42),.045,.76,"MAT_PaintedMetal",8)
        for dx in (-.48,.48):
            box(r,"cafe-seat",(x+dx,-3.18,.48),(.36,.36,.07),"MAT_Timber",.015)
            for sx in (-.13,.13): box(r,"chair-leg",(x+dx+sx,-3.18,.23),(.035,.035,.48),"MAT_PaintedMetal",.004)
    for z in (4.95,7.05):
        box(r,"balcony-slab",(0,-2.77,z-.95),(6.48,.90,.17),"MAT_TrimStone",.025)
        for x in (-2.0,0,2.0): window(r,x,-2.57,z,.95,1.28)
        rail(r,-3.0,3.0,-3.17,z-.86)
    ac(r,2.92,-2.65,6.02)
    return r


def heritage_facade():
    r=asset_root("ARCH_HeritageFacade","Colombo heritage facade")
    box(r,"heritage-shell",(0,.15,3.45),(8.3,5.4,6.9),"MAT_PlasterCream",.08)
    box(r,"stone-plinth",(0,-2.61,.48),(8.42,.26,.96),"MAT_Concrete",.025)
    box(r,"cornice",(0,-2.65,6.28),(8.62,.38,.28),"MAT_TrimStone",.035)
    box(r,"parapet",(0,.15,6.92),(8.58,5.65,.60),"MAT_Limewash",.045)
    # pilasters and layered capitals establish believable facade depth
    for x in (-3.65,-1.22,1.22,3.65):
        box(r,"pilaster",(x,-2.66,3.26),(.38,.34,5.62),"MAT_TrimStone",.025)
        box(r,"pilaster-base",(x,-2.73,.58),(.62,.48,.44),"MAT_Limewash",.025)
        box(r,"pilaster-capital",(x,-2.73,5.92),(.66,.48,.34),"MAT_Limewash",.035)
    door(r,0,-2.69,1.35,1.32,2.62,fanlight=True)
    for x in (-2.43,2.43): window(r,x,-2.69,1.92,1.16,1.62,shutters=True)
    for x in (-2.43,0,2.43):
        window(r,x,-2.69,4.72,1.05,1.48,shutters=True)
        # simple segmented arch hood above each upper opening
        for a in range(0,181,30):
            ang=math.radians(a)
            px=x+math.cos(ang)*.67
            pz=5.45+math.sin(ang)*.48
            box(r,"arched-window-hood",(px,-2.88,pz),(.22,.20,.16),"MAT_TrimStone",.018,rot=(0,ang,0))
    box(r,"verandah-canopy",(0,-3.06,3.18),(8.55,1.18,.16),"MAT_AwningGreen",.025,rot=(math.radians(8),0,0))
    for x in (-3.68,-1.22,1.22,3.68): cyl(r,"canopy-post",(x,-3.36,1.63),.075,3.08,"MAT_PaintedMetal",10)
    return r


def mixed_use_apartments():
    r=asset_root("ARCH_MixedUseApartments","Compact mixed-use apartments")
    box(r,"apartment-shell",(0,.20,5.55),(9.0,6.0,11.1),"MAT_PlasterSage",.08)
    box(r,"stair-tower",(-3.45,.42,5.82),(1.82,5.52,11.64),"MAT_PlasterOchre",.055)
    box(r,"roof-parapet",(0,.20,11.32),(9.34,6.32,.48),"MAT_TrimStone",.045)
    # ground floor: two deep shops and a distinct residential entry
    for x,w,color in ((-.95,3.55,"MAT_AwningGreen"),(2.42,2.42,"MAT_AwningRust")):
        box(r,"shop-recess",(x,-2.89,1.48),(w,.18,2.62),"MAT_Shadow",.018)
        box(r,"shop-glass",(x,-3.01,1.48),(w-.24,.05,2.38),"MAT_Glass",.008)
        awning(r,x,-3.01,3.12,w+.25,1.03,color)
    door(r,-3.48,-2.88,1.28,.90,2.4,"MAT_Timber",fanlight=True)
    for z in (4.45,7.15,9.82):
        box(r,"continuous-balcony",(.70,-3.22,z-.94),(6.55,1.03,.18),"MAT_TrimStone",.025)
        for x in (-1.55,.55,2.62): window(r,x,-2.89,z,.94,1.30)
        rail(r,-2.35,3.80,-3.68,z-.84)
        box(r,"privacy-fin",(-2.23,-3.54,z-.05),(.16,.22,1.70),"MAT_PlasterOchre",.015)
        if z < 9: ac(r,4.08,-3.02,z-.20)
    for z in (2.0,4.55,7.20,9.82): box(r,"stair-slot",(-3.46,-2.88,z),(.56,.10,1.45),"MAT_Shadow",.012)
    tank(r,2.72,.62,12.22)
    tank(r,1.55,.62,12.22)
    return r


def garden_wall_gate():
    r=asset_root("ARCH_GardenWallGate","Garden wall and slatted gate module")
    # Shallow centered module intended to sit ahead of residential facades.
    for x,w in ((-3.25,3.50),(3.25,3.50)):
        box(r,"garden-wall",(x,0,.72),(w,.34,1.44),"MAT_Limewash",.035)
        box(r,"wall-coping",(x,-.01,1.49),(w+.12,.48,.16),"MAT_TrimStone",.025)
    for x in (-1.42,1.42):
        box(r,"gate-pillar",(x,0,1.20),(.54,.58,2.40),"MAT_PlasterOchre",.045)
        box(r,"pillar-cap",(x,0,2.45),(.70,.70,.18),"MAT_TrimStone",.035)
    for x in (-1.10,-.82,-.54,-.26,.02,.30,.58,.86,1.14):
        box(r,"gate-slat",(x,-.15,1.08),(.13,.10,1.84),"MAT_Timber",.012)
    box(r,"gate-top-rail",(0,-.15,1.92),(2.42,.12,.13),"MAT_PaintedMetal",.012)
    box(r,"gate-bottom-rail",(0,-.15,.25),(2.42,.12,.13),"MAT_PaintedMetal",.012)
    for x in (-4.15,4.15): pot(r,x,-.42,.30)
    return r


BUILDERS=(verandah_house,narrow_balcony_home,produce_shop,cafe_shop_house,heritage_facade,mixed_use_apartments,garden_wall_gate)
for builder in BUILDERS: builder()

# Apply bevels, create UVs, and merge each family's same-material parts.
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH": continue
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="UVMap")
    obj.select_set(False)

for family in ROOTS:
    groups={}
    for child in list(family.children):
        if child.type=="MESH":
            key=child.data.materials[0].name if child.data.materials else "unpainted"
            groups.setdefault(key,[]).append(child)
    for mat_name,objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        objects[0].name=f"{family.name}__{mat_name}"

# Bevel modifiers can extend nominally grounded primitives a few centimetres below
# zero. Normalize each finished family using evaluated bounds so every prefab rests
# exactly on the shared ground plane without a compensating root transform.
for family in ROOTS:
    lowest=min(
        (family.matrix_world.inverted() @ obj.matrix_world @ Vector(corner)).z
        for obj in family.children_recursive if obj.type=="MESH"
        for corner in obj.bound_box
    )
    for obj in family.children_recursive:
        if obj.type=="MESH": obj.location.z -= lowest
bpy.context.view_layer.update()


def family_stats(root):
    minv=Vector((1e9,1e9,1e9)); maxv=Vector((-1e9,-1e9,-1e9)); tris=0; meshes=0
    for obj in root.children_recursive:
        if obj.type != "MESH": continue
        meshes += 1
        obj.data.calc_loop_triangles(); tris += len(obj.data.loop_triangles)
        rel=root.matrix_world.inverted() @ obj.matrix_world
        for corner in obj.bound_box:
            p=rel @ Vector(corner)
            minv.x,minv.y,minv.z=min(minv.x,p.x),min(minv.y,p.y),min(minv.z,p.z)
            maxv.x,maxv.y,maxv.z=max(maxv.x,p.x),max(maxv.y,p.y),max(maxv.z,p.z)
    # Blender -> glTF: (x,y,z) becomes (x,z,-y).
    gltf_min=[minv.x,minv.z,-maxv.y]; gltf_max=[maxv.x,maxv.z,-minv.y]
    return {
        "nodeName":root.name,
        "label":root["asset_family"],
        "bounds":{"min":[round(v,3) for v in gltf_min],"max":[round(v,3) for v in gltf_max]},
        "size":{"width":round(maxv.x-minv.x,3),"height":round(maxv.z-minv.z,3),"depth":round(maxv.y-minv.y,3)},
        "footprint":{"width":round(maxv.x-minv.x,3),"depth":round(maxv.y-minv.y,3),"frontOffset":round(-minv.y,3),"backOffset":round(maxv.y,3)},
        "triangles":tris,"meshNodes":meshes,
    }


families=[family_stats(root) for root in ROOTS]
total_triangles=sum(f["triangles"] for f in families)
bpy.context.scene.unit_settings.system="METRIC"
bpy.context.scene.unit_settings.scale_length=1.0
bpy.context.scene["asset_pack"]="Colombo A+B+C Architecture"
bpy.context.scene["provenance"]="Original project artwork generated from project-authored geometry"
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active=ROOTS[0]
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.export_scene.gltf(filepath=str(GLB_PATH),export_format="GLB",use_selection=True,export_apply=True,export_texcoords=True,export_materials="EXPORT",export_cameras=False,export_lights=False)

manifest={
    "schemaVersion":1,
    "assetPack":"colombo-abc-architecture",
    "glb":"/streets/composition/architecture.glb",
    "coordinateSystem":{"upAxis":"+Y","frontAxis":"+Z","origin":"ground-center","unit":"meter"},
    "authoredWith":{"generator":"studies/colombo-road/streets/composition/build_architecture.py","source":"studies/colombo-road/streets/composition/architecture.blend"},
    "provenance":"Original Colombo-inspired project artwork. Geometry and materials are original; no third-party models, logos, or trademarks.",
    "usage":"Place, rotate, and uniformly scale top-level family roots. Do not transform material mesh children independently.",
    "families":families,
    "materials":[{"id":name,"baseColor":[round(x,3) for x in spec[0][:3]],"roughness":spec[1],"metallic":spec[2]} for name,spec in PALETTE.items()],
    "stats":{"families":len(families),"triangles":total_triangles,"meshNodes":sum(f["meshNodes"] for f in families),"glbBytes":GLB_PATH.stat().st_size},
    "budgets":{"triangleTargetMax":100000,"glbTargetBytesMax":6291456},
}
MANIFEST_PATH.write_text(json.dumps(manifest,indent=2)+"\n")

# Distant-only Lotus Tower LOD. The accepted high-resolution source stays intact;
# this separate export preserves its metre proportions and broad silhouette while
# aggressively simplifying detail that is sub-pixel from the street composition.
LANDMARK_SOURCE=ROOT / "studies/colombo-road/source/lotus-tower-original.glb"
LANDMARK_GLB=PUBLIC_DIR / "landmark-lod.glb"
LANDMARK_MANIFEST=PUBLIC_DIR / "landmark-lod.manifest.json"
source_hash=hashlib.sha256(LANDMARK_SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(LANDMARK_SOURCE))
landmark_meshes=[obj for obj in bpy.context.scene.objects if obj.type=="MESH"]

# Bake the imported hierarchy into mesh world transforms, then group compatible
# single-material pieces so the runtime sees a small number of draw-call nodes.
for obj in landmark_meshes:
    world=obj.matrix_world.copy()
    obj.parent=None
    obj.matrix_world=world
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    obj.select_set(False)
for obj in list(bpy.context.scene.objects):
    if obj.type!="MESH": bpy.data.objects.remove(obj,do_unlink=True)

groups={}
for obj in landmark_meshes:
    key=obj.data.materials[0].name if len(obj.data.materials)==1 else f"multi_{obj.name}"
    groups.setdefault(key,[]).append(obj)
merged=[]
for key,objects in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1: bpy.ops.object.join()
    objects[0].name=f"LANDMARK_LotusTower__{key}"
    merged.append(objects[0])

for obj in merged: obj.data.calc_loop_triangles()
source_triangles=sum(len(obj.data.loop_triangles) for obj in merged)
ratio=min(1.0,17500/source_triangles)
for obj in merged:
    if len(obj.data.polygons)<12: continue
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    mod=obj.modifiers.new("distant-lod-decimation","DECIMATE")
    mod.ratio=ratio
    mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)

# Collapse decimation can leave unreferenced vertices. glTF omits them, so remove
# them before calculating bounds to keep the authored data and exported data equal.
for obj in merged:
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    loose=[vertex for vertex in bm.verts if not vertex.link_faces]
    if loose: bmesh.ops.delete(bm,geom=loose,context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()

# Decimation can collapse very small detail groups completely. Exclude those
# groups before measuring and centering so the manifest describes the exact set
# of meshes that the glTF exporter can emit.
exportable=[]
for obj in merged:
    if len(obj.data.polygons)==0:
        bpy.data.objects.remove(obj,do_unlink=True)
    else:
        exportable.append(obj)
merged=exportable
bpy.context.view_layer.update()
for obj in merged:
    obj.data.update()

pts=[obj.matrix_world @ vertex.co for obj in merged for vertex in obj.data.vertices]
lo=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
hi=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
center_x=(lo.x+hi.x)/2; center_y=(lo.y+hi.y)/2
lod_root=bpy.data.objects.new("LANDMARK_LotusTower_LOD",None)
bpy.context.collection.objects.link(lod_root)
for obj in merged:
    obj.location.x-=center_x
    obj.location.y-=center_y
    obj.location.z-=lo.z
    obj.parent=lod_root
bpy.context.view_layer.update()
for obj in merged: obj.data.calc_loop_triangles()
lod_triangles=sum(len(obj.data.loop_triangles) for obj in merged)
bpy.ops.object.select_all(action="DESELECT")
lod_root.select_set(True)
for obj in merged: obj.select_set(True)
bpy.context.view_layer.objects.active=lod_root
bpy.ops.export_scene.gltf(filepath=str(LANDMARK_GLB),export_format="GLB",use_selection=True,export_apply=True,export_texcoords=True,export_materials="EXPORT",export_cameras=False,export_lights=False)
size=hi-lo
landmark_manifest={
    "schemaVersion":1,"asset":"lotus-tower-distant-lod","glb":"/streets/composition/landmark-lod.glb",
    "nodeName":"LANDMARK_LotusTower_LOD",
    "coordinateSystem":{"upAxis":"+Y","origin":"ground-center","unit":"meter"},
    "source":{"path":"studies/colombo-road/source/lotus-tower-original.glb","sha256":source_hash,"triangles":source_triangles},
    "provenance":"Simplified distant-view derivative of the original project-authored Lotus Tower model; source geometry preserved unchanged.",
    "bounds":{"min":[round(-size.x/2,3),0.0,round(-size.y/2,3)],"max":[round(size.x/2,3),round(size.z,3),round(size.y/2,3)]},
    "size":{"width":round(size.x,3),"height":round(size.z,3),"depth":round(size.y,3)},
    "stats":{"triangles":lod_triangles,"meshNodes":len(merged),"glbBytes":LANDMARK_GLB.stat().st_size},
    "usage":"Distant skyline placement only; use the root at metre scale and keep the base on y=0.",
}
LANDMARK_MANIFEST.write_text(json.dumps(landmark_manifest,indent=2)+"\n")
print(json.dumps({"blend":str(BLEND_PATH),"architectureGlb":str(GLB_PATH),"architectureManifest":str(MANIFEST_PATH),"architectureStats":manifest["stats"],"landmarkGlb":str(LANDMARK_GLB),"landmarkManifest":str(LANDMARK_MANIFEST),"landmarkStats":landmark_manifest["stats"]},indent=2))
