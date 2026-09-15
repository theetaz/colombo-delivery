"""Build the original Colombo streetscape modular kit.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python studies/colombo-road/streets/generate_building_kit.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / "studies" / "colombo-road" / "streets"
PUBLIC_DIR = ROOT / "studies" / "colombo-road" / "viewer" / "public" / "streets"
BLEND_PATH = SOURCE_DIR / "colombo-building-kit.blend"
GLB_PATH = PUBLIC_DIR / "colombo-building-kit.glb"
MANIFEST_PATH = PUBLIC_DIR / "building-kit.manifest.json"

SOURCE_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

COLORS = {
    "plaster-warm-cream": (0.78, 0.66, 0.47, 1),
    "plaster-sun-faded-ochre": (0.72, 0.43, 0.19, 1),
    "plaster-muted-teal": (0.18, 0.44, 0.43, 1),
    "plaster-dusty-rose": (0.64, 0.36, 0.32, 1),
    "plaster-monsoon-blue": (0.30, 0.48, 0.55, 1),
    "plaster-limewash": (0.72, 0.73, 0.60, 1),
    "terracotta-tile": (0.48, 0.17, 0.08, 1),
    "deep-shadow": (0.045, 0.055, 0.052, 1),
    "window-glass": (0.08, 0.25, 0.29, 1),
    "painted-timber": (0.18, 0.10, 0.06, 1),
    "aged-brass": (0.35, 0.25, 0.10, 1),
    "concrete": (0.43, 0.44, 0.40, 1),
    "awning-rust": (0.60, 0.20, 0.10, 1),
    "awning-mustard": (0.78, 0.48, 0.10, 1),
}


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.84
    if name == "window-glass":
        bsdf.inputs["Roughness"].default_value = 0.24
        bsdf.inputs["Metallic"].default_value = 0.05
    return mat


MATS = {name: material(name, color) for name, color in COLORS.items()}


def root(name, x):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = (x, 0, 0)
    obj["asset_family"] = name
    obj["front_axis_gltf"] = "+Z"
    obj["grounded"] = True
    return obj


def cube(parent, name, loc, size, mat, bevel=0.035, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(v / 2 for v in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = parent
    obj.data.materials.append(MATS[mat])
    if bevel:
        mod = obj.modifiers.new("edge-softening", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return obj


def cylinder(parent, name, loc, radius, depth, mat, vertices=10, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.data.materials.append(MATS[mat])
    bevel = obj.modifiers.new("edge-softening", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    return obj


def roof(parent, name, loc, width, depth, rise, mat):
    x, y = width / 2, depth / 2
    verts = [(-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0), (0, -y, rise), (0, y, rise)]
    faces = [(0, 1, 4), (3, 5, 2), (0, 3, 2, 1), (0, 4, 5, 3), (1, 2, 5, 4)]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(MATS[mat])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.parent = parent
    return obj


def window(parent, x, z, width=1.05, height=1.45, y=-2.53, shutters=False):
    cube(parent, "window-recess", (x, y + .05, z), (width + .28, .16, height + .28), "deep-shadow", .025)
    cube(parent, "window-glass", (x, y - .05, z), (width, .055, height), "window-glass", .012)
    cube(parent, "window-sill", (x, y - .10, z - height / 2 - .12), (width + .34, .26, .14), "plaster-warm-cream", .025)
    cube(parent, "window-mullion", (x, y - .10, z), (.055, .045, height), "painted-timber", .008)
    if shutters:
        for side in (-1, 1):
            cube(parent, "louvered-shutter", (x + side * (width * .72), y - .09, z), (width * .35, .08, height), "plaster-muted-teal", .018, (0, 0, side * .08))


def railing(parent, x0, x1, y, z, height=.86):
    cube(parent, "balcony-rail", ((x0+x1)/2, y, z+height), (x1-x0, .07, .08), "deep-shadow", .012)
    count = max(3, round((x1-x0)/.42))
    for i in range(count + 1):
        x = x0 + (x1-x0) * i / count
        cube(parent, "balcony-baluster", (x, y, z+height/2), (.045, .045, height), "deep-shadow", .008)


def ac_unit(parent, x, y, z):
    cube(parent, "air-conditioner", (x, y, z), (.72, .34, .48), "concrete", .035)
    for dz in (-.12, 0, .12):
        cube(parent, "air-conditioner-vent", (x, y-.18, z+dz), (.58, .025, .025), "deep-shadow", .004)


def tank(parent, x, y, z):
    cylinder(parent, "roof-water-tank", (x, y, z), .48, 1.05, "deep-shadow", 12)
    for dz in (-.28, 0, .28):
        cylinder(parent, "tank-rib", (x, y, z+dz), .495, .035, "concrete", 12)


def storefront(parent, x, width, sign_color="awning-mustard", shutter=False, facade_y=-2.5):
    cube(parent, "storefront-recess", (x, facade_y-.04, 1.42), (width, .18, 2.45), "deep-shadow", .025)
    if shutter:
        cube(parent, "roller-shutter", (x, facade_y-.16, 1.38), (width-.24, .07, 2.20), "concrete", .018)
        for z in (.45,.72,.99,1.26,1.53,1.80,2.07):
            cube(parent, "shutter-slat", (x, facade_y-.205, z), (width-.35, .025, .035), "deep-shadow", .004)
    else:
        cube(parent, "shop-glass", (x, facade_y-.16, 1.42), (width-.20, .055, 2.18), "window-glass", .014)
        cube(parent, "door-frame", (x+width*.18, facade_y-.21, 1.42), (.07, .06, 2.18), "painted-timber", .008)
    cube(parent, "fictional-signboard", (x, facade_y-.19, 2.75), (width+.12, .15, .48), sign_color, .035)
    for dx in (-.25, .05, .33):
        cube(parent, "abstract-sign-mark", (x+dx*width, facade_y-.28, 2.75), (width*.16, .025, .055), "plaster-warm-cream", .006)


def heritage_shop(x):
    r = root("heritage-shop", x)
    cube(r, "limewashed-shell", (0, 0, 3.3), (8.2, 5.0, 6.6), "plaster-sun-faded-ochre", .10)
    cube(r, "parapet", (0, 0, 6.72), (8.55, 5.18, .42), "plaster-warm-cream", .07)
    cube(r, "verandah-roof", (0, -3.0, 3.42), (8.45, 1.45, .18), "terracotta-tile", .04, (.11, 0, 0))
    for px in (-3.55,-1.78,0,1.78,3.55):
        cylinder(r, "verandah-column", (px,-3.2,1.68), .17, 3.35, "plaster-warm-cream", 12)
        cube(r, "column-capital", (px,-3.2,3.22), (.48,.48,.24), "plaster-warm-cream", .05)
    storefront(r,-2.25,2.55,"plaster-muted-teal")
    storefront(r,1.35,3.55,"awning-rust",True)
    for px in (-2.65,0,2.65): window(r,px,5.0,1.15,1.55,shutters=True)
    cube(r,"cornice",(0,-2.58,6.08),(8.48,.26,.22),"plaster-warm-cream",.035)
    return r


def townhouse(x):
    r=root("town-house",x)
    cube(r,"narrow-shell",(0,0,4.05),(5.6,5.0,8.1),"plaster-dusty-rose",.09)
    cube(r,"parapet",(0,0,8.28),(5.92,5.18,.40),"plaster-warm-cream",.06)
    cube(r,"recessed-entry",(1.55,-2.56,1.28),(1.18,.18,2.45),"deep-shadow",.025)
    cube(r,"timber-door",(1.55,-2.68,1.28),(.94,.07,2.18),"painted-timber",.025)
    for floor,z in enumerate((2.0,4.75,7.0)):
        for px in (-1.45,1.45): window(r,px,z,1.0,1.35)
        if floor:
            cube(r,"balcony-slab",(0,-2.82,z-.93),(4.45,.92,.16),"plaster-warm-cream",.035)
            railing(r,-2.0,2.0,-3.22,z-.84)
    cube(r,"vertical-sun-fin",(-2.38,-2.68,4.7),(.25,.35,6.2),"plaster-warm-cream",.025)
    ac_unit(r,2.35,-2.69,6.0)
    return r


def corner_shop(x):
    r=root("corner-shop",x)
    cube(r,"corner-shell",(0,0,3.15),(7.4,5.8,6.3),"plaster-muted-teal",.10)
    cube(r,"roof-parapet",(0,0,6.50),(7.75,6.12,.48),"plaster-warm-cream",.065)
    storefront(r,-1.65,3.35,"awning-mustard",facade_y=-2.9)
    storefront(r,2.05,2.65,"awning-rust",True,facade_y=-2.9)
    cube(r,"deep-corner-awning",(0,-3.28,3.18),(7.35,1.25,.14),"awning-mustard",.035,(.12,0,0))
    for px in (-2.35,0,2.35): window(r,px,4.78,1.05,1.35,shutters=True,y=-2.94)
    cube(r,"side-sign-blade",(-3.82,-1.85,3.8),(.15,1.15,1.55),"awning-rust",.04)
    tank(r,2.35,.8,7.18)
    return r


def courtyard_house(x):
    r=root("courtyard-house",x)
    cube(r,"house-wing",(0,.35,2.35),(8.8,5.3,4.7),"plaster-limewash",.09)
    cube(r,"front-boundary",(0,-3.25,1.05),(8.8,.34,2.1),"plaster-warm-cream",.055)
    for px in (-3.7,3.7): cube(r,"gate-pillar",(px,-3.25,1.36),(.56,.60,2.72),"plaster-sun-faded-ochre",.06)
    cube(r,"slatted-gate",(0,-3.31,1.08),(2.9,.14,1.90),"painted-timber",.025)
    for px in (-1.05,-.52,0,.52,1.05): cube(r,"gate-gap",(px,-3.40,1.08),(.07,.03,1.65),"aged-brass",.006)
    roof(r,"hipped-tile-roof",(0,.35,4.70),9.25,5.75,1.42,"terracotta-tile")
    for py in (-2.05,-1.32,-.58,.15,.88,1.62,2.35): cube(r,"roof-tile-rhythm",(0,py,5.30),(8.75,.055,.07),"awning-rust",.008)
    for px in (-2.45,0,2.45): window(r,px,2.72,1.10,1.45,y=-2.36,shutters=True)
    cylinder(r,"courtyard-planter",(-2.7,-2.72,.42),.48,.84,"terracotta-tile",12)
    return r


def mixed_use(x):
    r=root("mixed-use",x)
    cube(r,"shop-and-flat-shell",(0,0,4.65),(7.0,5.0,9.3),"plaster-monsoon-blue",.09)
    storefront(r,-1.85,2.75,"awning-rust")
    storefront(r,1.65,3.15,"plaster-muted-teal",True)
    for z in (4.55,7.15):
        for px in (-2.2,0,2.2): window(r,px,z,.92,1.32)
        cube(r,"continuous-balcony",(0,-2.85,z-.95),(6.45,.88,.17),"plaster-warm-cream",.035)
        railing(r,-3.0,3.0,-3.22,z-.86)
    cube(r,"sunshade-band",(0,-2.70,8.30),(6.7,.55,.18),"plaster-warm-cream",.025)
    cube(r,"roof-parapet",(0,0,9.52),(7.35,5.28,.44),"plaster-warm-cream",.06)
    ac_unit(r,2.92,-2.70,6.15)
    return r


def apartment(x):
    r=root("apartment",x)
    cube(r,"apartment-shell",(0,0,6.0),(9.6,6.4,12.0),"plaster-warm-cream",.09)
    cube(r,"stair-tower",(-3.55,-.28,6.25),(2.05,5.8,12.5),"plaster-sun-faded-ochre",.07)
    for z in (2.0,4.75,7.5,10.25):
        for px in (-1.6,.65,2.85): window(r,px,z,.95,1.35,y=-3.24)
        cube(r,"balcony-slab",(1.15,-3.48,z-.95),(5.9,1.0,.17),"concrete",.03)
        railing(r,-1.65,3.95,-3.90,z-.86,.84)
        cube(r,"balcony-privacy-screen",(-1.42,-3.79,z-.42),(.18,.18,1.72),"plaster-muted-teal",.02)
    for z in (2.0,4.75,7.5,10.25): cube(r,"stair-slot",(-3.56,-3.22,z),(.72,.08,1.65),"deep-shadow",.018)
    cube(r,"roof-parapet",(0,0,12.24),(9.92,6.70,.48),"concrete",.055)
    tank(r,2.85,.7,13.03)
    ac_unit(r,4.28,-3.22,8.6)
    return r


BUILDERS = [heritage_shop, townhouse, corner_shop, courtyard_house, mixed_use, apartment]
SPACING = [0, 13, 25, 39, 54, 68]
roots = [builder(x) for builder, x in zip(BUILDERS, SPACING)]

# Collapse compatible pieces by family and material. This preserves the readable
# family hierarchy while keeping runtime draw calls practical for street rows.
for obj in list(bpy.context.scene.objects):
    if obj.type == "MESH":
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
for family_root in roots:
    material_groups = {}
    for child in list(family_root.children):
        if child.type == "MESH":
            key = child.data.materials[0].name if child.data.materials else "unpainted"
            material_groups.setdefault(key, []).append(child)
    for material_name, objects in material_groups.items():
        if len(objects) == 1:
            objects[0].name = f"{family_root.name}__{material_name}"
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = f"{family_root.name}__{material_name}"

# Keep authoring roots spaced for inspection. Geometry remains local beneath each root.
for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = roots[0]

bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 1.0
bpy.context.scene["kit_name"] = "Colombo Building Kit"
bpy.context.scene["license"] = "Original project artwork"
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)

dims = {
    "heritage-shop": (8.55, 6.32, 6.93),
    "town-house": (5.92, 5.87, 8.48),
    "corner-shop": (7.77, 6.97, 7.71),
    "courtyard-house": (9.25, 6.78, 6.12),
    "mixed-use": (7.35, 5.93, 9.74),
    "apartment": (9.92, 7.33, 13.56),
}
labels = {
    "heritage-shop": "Verandah Heritage Shop",
    "town-house": "Balcony Town House",
    "corner-shop": "Deep Awning Corner Shop",
    "courtyard-house": "Tiled Roof Courtyard House",
    "mixed-use": "Shopfront Mixed Use",
    "apartment": "Tropical Balcony Apartment",
}
palette_variants = [
    {"id":"warm-cream","wall":"plaster-warm-cream","accent":"plaster-muted-teal","roof":"terracotta-tile"},
    {"id":"sun-faded-ochre","wall":"plaster-sun-faded-ochre","accent":"plaster-warm-cream","roof":"terracotta-tile"},
    {"id":"muted-teal","wall":"plaster-muted-teal","accent":"plaster-warm-cream","roof":"awning-rust"},
    {"id":"dusty-rose","wall":"plaster-dusty-rose","accent":"plaster-warm-cream","roof":"terracotta-tile"},
    {"id":"monsoon-blue","wall":"plaster-monsoon-blue","accent":"plaster-warm-cream","roof":"concrete"},
    {"id":"limewash","wall":"plaster-limewash","accent":"plaster-sun-faded-ochre","roof":"terracotta-tile"},
]
manifest = {
    "schemaVersion": 1,
    "assetPack": "colombo-building-kit",
    "glb": "/streets/colombo-building-kit.glb",
    "coordinateSystem": {"upAxis":"+Y","facadeAxis":"+Z","origin":"ground-center","unit":"meter"},
    "authoredWith": {"generator":"studies/colombo-road/streets/generate_building_kit.py","source":"studies/colombo-road/streets/colombo-building-kit.blend"},
    "provenance": "Original Colombo-inspired project artwork; no third-party building assets or trademarks.",
    "families": [
        {"id":name,"nodeName":name,"familyLabel":labels[name],"dimensions":{"width":dims[name][0],"depth":dims[name][1],"height":dims[name][2]},"recommendedScaleRange":[0.92,1.08],"paletteVariantIds":[v["id"] for v in palette_variants]}
        for name in dims
    ],
    "paletteVariants": palette_variants,
    "materials": [{"id":name,"baseColorLinear":[round(c,3) for c in color[:3]],"roughness":0.24 if name=="window-glass" else 0.84} for name,color in COLORS.items()],
    "budgets": {"triangleTargetMax":70000,"glbTargetBytesMax":4194304},
}
triangle_count = 0
mesh_count = 0
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.data.calc_loop_triangles()
        triangle_count += len(obj.data.loop_triangles)
        mesh_count += 1
manifest["stats"] = {"triangles":triangle_count,"meshNodes":mesh_count,"glbBytes":GLB_PATH.stat().st_size}
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"blend":str(BLEND_PATH),"glb":str(GLB_PATH),"manifest":str(MANIFEST_PATH)}, indent=2))
