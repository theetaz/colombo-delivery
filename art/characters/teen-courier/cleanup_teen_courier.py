"""Normalize and material-separate the accepted Tripo teen courier draft.

Run with Blender 5.1+:
  blender --background --python art/characters/teen-courier/cleanup_teen_courier.py

The reconstruction GLB remains untouched. This pass prepares an editable Blender
source and a static review GLB; rigging and facial controls are separate passes.
"""

from pathlib import Path
import json
import math
import struct

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[3]
CHAR_DIR = ROOT / "art/characters/teen-courier"
RECON = CHAR_DIR / "reconstruction"
INPUT = RECON / "teen-courier-tripo-p1-draft.glb"
BLEND = CHAR_DIR / "teen_courier_cleanup.blend"
OUTPUT = ROOT / "public/models/teen_courier.glb"
MANIFEST = ROOT / "public/models/teen_courier.manifest.json"
NEUTRAL = RECON / "textures/teen-courier-neutral-detail.jpg"
CUSTOMIZATION_MASK = RECON / "textures/teen-courier-customization-mask.png"

PALETTE = {
    "Teen_Skin": (0.66, 0.39, 0.28, 1.0),
    "Teen_Hair": (0.055, 0.071, 0.086, 1.0),
    "Teen_Shirt": (0.11, 0.45, 0.52, 1.0),
    "Teen_Shorts": (0.10, 0.12, 0.15, 1.0),
    "Teen_Shoes": (0.92, 0.91, 0.88, 1.0),
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def image_pixels(image):
    image.colorspace_settings.name = "sRGB"
    data = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(data)
    return data.reshape(image.size[1], image.size[0], 4)


def sample_uv(pixels, uv):
    h, w, _ = pixels.shape
    x = min(w - 1, max(0, int((uv.x % 1.0) * (w - 1))))
    y = min(h - 1, max(0, int((uv.y % 1.0) * (h - 1))))
    return pixels[y, x, :3]


def material_for_region(source, name):
    mat = source.copy()
    mat.name = name
    mat.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    mat.use_nodes = True
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    return mat


def patch_glb_material_factors(path):
    """Preserve tint factors beside the neutral base-color texture."""
    payload = path.read_bytes()
    json_len, json_type = struct.unpack_from("<II", payload, 12)
    gltf = json.loads(payload[20:20 + json_len].decode("utf-8").rstrip("\0 "))
    binary_offset = 20 + json_len
    bin_len, bin_type = struct.unpack_from("<II", payload, binary_offset)
    binary = payload[binary_offset + 8:binary_offset + 8 + bin_len]
    for material in gltf.get("materials", []):
        if material.get("name") in PALETTE:
            pbr = material.setdefault("pbrMetallicRoughness", {})
            pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
    mask_bytes = CUSTOMIZATION_MASK.read_bytes()
    mask_offset = len(binary)
    binary += mask_bytes
    buffer_view_index = len(gltf.setdefault("bufferViews", []))
    gltf["bufferViews"].append({"buffer": 0, "byteOffset": mask_offset, "byteLength": len(mask_bytes)})
    image_index = len(gltf.setdefault("images", []))
    gltf["images"].append({"name": "TeenCourier_CustomizationMask", "mimeType": "image/png", "bufferView": buffer_view_index})
    sampler = gltf.get("textures", [{}])[0].get("sampler")
    texture = {"name": "TeenCourier_CustomizationMask", "source": image_index}
    if sampler is not None:
        texture["sampler"] = sampler
    texture_index = len(gltf.setdefault("textures", []))
    gltf["textures"].append(texture)
    root_node = next(node for node in gltf["nodes"] if node.get("name") == "TeenCourier")
    root_node.setdefault("extras", {})["customization"] = {
        "ready": True,
        "maskTextureIndex": texture_index,
        "texCoord": 0,
        "channels": {"skin": "r", "shirt": "g", "shoes": "b"},
        "mode": "masked_hsv_hue_saturation",
        "preserveValue": True,
        "default": "authored",
    }
    gltf["buffers"][0]["byteLength"] = len(binary)
    encoded = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    binary += b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    rebuilt = struct.pack("<4sII", b"glTF", 2, total)
    rebuilt += struct.pack("<II", len(encoded), json_type) + encoded
    rebuilt += struct.pack("<II", len(binary), bin_type) + binary
    path.write_bytes(rebuilt)
    exported_vertices = sum(
        gltf["accessors"][primitive["attributes"]["POSITION"]]["count"]
        for mesh in gltf.get("meshes", []) for primitive in mesh.get("primitives", [])
    )
    exported_triangles = sum(
        gltf["accessors"][primitive["indices"]]["count"] // 3
        for mesh in gltf.get("meshes", []) for primitive in mesh.get("primitives", [])
    )
    return exported_vertices, exported_triangles


def choose_region(z, rgb):
    r, g, b = [float(v) for v in rgb]
    value = max(r, g, b)
    saturation = value - min(r, g, b)
    # Spatial guards make classification stable where baked shadows alter color.
    if z < 0.20:
        return "Teen_Shoes"
    if z > 1.40 and value < 0.42:
        return "Teen_Hair"
    if 0.52 < z < 0.86 and value < 0.48 and saturation < 0.22:
        return "Teen_Shorts"
    if 0.74 < z < 1.30 and b > r * 1.04 and g > r * 1.08:
        return "Teen_Shirt"
    return "Teen_Skin"


def main():
    bpy.context.preferences.filepaths.save_version = 0
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(INPUT))
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(objects) != 1:
        raise RuntimeError(f"Expected one mesh, found {len(objects)}")
    obj = objects[0]
    obj.name = "TeenCourier"
    obj.data.name = "TeenCourier_Mesh"

    # Tripo supplies a uniform node scale and faces +X. Apply it, rotate +X to
    # project forward -Z, then normalize the standing height to 1.62 metres.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0.0, 0.0, math.radians(90.0))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    local_z = [v.co.z for v in obj.data.vertices]
    scale = 1.62 / (max(local_z) - min(local_z))
    obj.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    zmin = min(v.co.z for v in obj.data.vertices)
    obj.location.z = -zmin
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    # The reconstruction duplicates coincident vertices at UV/normal seams.
    # Welding only exact-position duplicates prevents localized smoothing from
    # pulling paired seam vertices apart; per-loop UV coordinates are retained.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.000001)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Conservative face fairing: lateral cheeks, lower chin, and ears only.
    # Keep central eyes, nose, and lips outside this group so their authored
    # feature volumes and silhouette remain intact.
    fairing = obj.vertex_groups.new(name="Face_Fairing")
    fairing_indices = []
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        cheek = 1.34 < z < 1.50 and y > 0.0 and 0.045 < abs(x) < 0.145
        chin = 1.27 < z < 1.35 and y > -0.005 and abs(x) < 0.105
        ear = 1.33 < z < 1.49 and abs(x) >= 0.14
        if cheek or chin or ear:
            fairing_indices.append(vertex.index)
    fairing.add(fairing_indices, 1.0, "REPLACE")
    smooth = obj.modifiers.new(name="Face_Fairing", type="SMOOTH")
    smooth.vertex_group = fairing.name
    smooth.factor = 0.08
    smooth.iterations = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    obj.data.validate(clean_customdata=False)
    obj.data.update(calc_edges=True)

    source = obj.data.materials[0]
    color_node = next(
        n for n in source.node_tree.nodes
        if n.type == "TEX_IMAGE" and n.image and "Color_" in n.image.name
    )
    pixels = image_pixels(color_node.image)
    obj.data.materials.clear()
    material_index = {}
    for index, name in enumerate(PALETTE):
        obj.data.materials.append(material_for_region(source, name))
        material_index[name] = index

    # Keep the customization source editable and self-contained in the .blend.
    # The node is intentionally unconnected so authored PBR remains the default.
    mask_image = bpy.data.images.load(str(CUSTOMIZATION_MASK), check_existing=True)
    mask_image.name = "TeenCourier_CustomizationMask_RGB"
    mask_image.colorspace_settings.name = "Non-Color"
    mask_image.pack()
    mask_node = obj.data.materials[0].node_tree.nodes.new("ShaderNodeTexImage")
    mask_node.name = "CUSTOMIZATION_MASK_RGB"
    mask_node.label = "R Skin | G Shirt | B Shoes (UV0, top-origin glTF)"
    mask_node.image = mask_image
    mask_node.hide = True

    uv_layer = obj.data.uv_layers.active.data
    counts = {name: 0 for name in PALETTE}
    for polygon in obj.data.polygons:
        uv = sum((uv_layer[i].uv for i in polygon.loop_indices), uv_layer[polygon.loop_indices[0]].uv.copy() * 0.0) / len(polygon.loop_indices)
        z = sum(obj.data.vertices[i].co.z for i in polygon.vertices) / len(polygon.vertices)
        region = choose_region(z, sample_uv(pixels, uv))
        polygon.material_index = material_index[region]
        counts[region] += 1

    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj["assetType"] = "teen_courier_character"
    obj["contractVersion"] = 1
    obj["forwardAxis"] = "-Z"
    obj["upAxis"] = "+Y"
    obj["heightMeters"] = 1.62
    obj["sourceModel"] = "Tripo P1-20260311"
    obj["customizationMaskImage"] = "TeenCourier_CustomizationMask_RGB"
    obj["customizationMaskChannels"] = "R=skin,G=shirt,B=shoes"

    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT), export_format="GLB", use_selection=False,
        export_yup=True, export_apply=True, export_extras=True,
        export_materials="EXPORT", export_image_format="AUTO",
    )
    exported_vertices, exported_triangles = patch_glb_material_factors(OUTPUT)

    verts = len(obj.data.vertices)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    bounds_min = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    bounds_max = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    manifest = {
        "asset": "teen_courier.glb",
        "status": "static-cleanup-review",
        "source": "../art/characters/teen-courier/reconstruction/teen-courier-tripo-p1-draft.glb",
        "provenance": {"service": "Tripo API", "modelVersion": "P1-20260311", "sourceConcept": "teen-courier-v1.png"},
        "contract": {"units": "meters", "upAxis": "+Y", "forwardAxis": "-Z", "origin": "ground contact", "heightMeters": 1.62},
        "geometry": {"blenderVertices": verts, "exportedVertices": exported_vertices, "triangles": exported_triangles, "meshes": 1, "materialRegions": counts},
        "materials": list(PALETTE),
        "textures": {"embedded": True, "basis": "original Tripo 4K base color, normal, and ORM maps retained without rebaking", "customizationMask": "embedded RGB PNG using baseColor TEXCOORD_0"},
        "customization": {"ready": True, "default": "authored", "mode": "masked_hsv_hue_saturation", "preserveValue": True, "maskChannels": {"skin": "r", "shirt": "g", "shoes": "b"}, "tintableRegions": ["skin", "shirt", "shoes"], "editableBlendPackedImage": "TeenCourier_CustomizationMask_RGB"},
        "rig": {"skins": 0, "animations": 0, "morphTargets": 0},
        "blenderBounds": {"min": bounds_min, "max": bounds_max},
        "notes": ["Static cleanup review asset; automated biped rig is evaluated separately.", "Named polygon regions are provisional and retain the original atlas at a white factor. Customization uses the embedded pixel mask rather than material multiplication."],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(OUTPUT), "vertices": verts, "triangles": tris, "regions": counts}))


if __name__ == "__main__":
    main()
