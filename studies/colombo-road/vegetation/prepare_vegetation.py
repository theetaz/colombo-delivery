#!/usr/bin/env python3
"""Prepare an immutable Tripo source as metre-scale vegetation for the road study.

Run this through Blender, not the system Python. The script never modifies source_path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
ROAD_DIR = Path(__file__).resolve().parents[1]
VEGETATION_DIR = ROAD_DIR / "vegetation"
PUBLIC_DIR = ROAD_DIR / "viewer" / "public" / "vegetation"
MANIFEST_PATH = PUBLIC_DIR / "manifest.json"


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--height", required=True, type=float)
    parser.add_argument("--kind", required=True, choices=("tree", "palm", "grass"))
    parser.add_argument("--lod1-ratio", type=float, default=0.45)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def import_source(path: Path) -> None:
    suffix = path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True)
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path))
    elif suffix == ".obj":
        bpy.ops.wm.obj_import(filepath=str(path))
    else:
        raise ValueError(f"Unsupported source format: {suffix}")


def meshes() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return Vector(map(min, zip(*points))), Vector(map(max, zip(*points)))


def normalize(objects: list[bpy.types.Object], target_height: float) -> None:
    low, high = world_bounds(objects)
    height = high.z - low.z
    if height <= 1e-6:
        raise ValueError("Imported source has no measurable Z height")
    scale = target_height / height
    center = (low + high) * 0.5
    for obj in objects:
        obj.scale *= scale
        obj.location.x -= center.x * scale
        obj.location.y -= center.y * scale
        obj.location.z -= low.z * scale
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)


def resize_and_pack_images(limit: int = 1024) -> list[dict]:
    results = []
    for image in bpy.data.images:
        if image.source in {"VIEWER", "RENDER_RESULT"}:
            continue
        _ = image.pixels[0] if len(image.pixels) else None
        width, height = image.size
        if max(width, height) > limit:
            factor = limit / max(width, height)
            image.scale(max(1, round(width * factor)), max(1, round(height * factor)))
        image.pack()
        results.append({"name": image.name, "width": image.size[0], "height": image.size[1]})
    return results


def image_for_material(material: bpy.types.Material | None):
    if not material or not material.use_nodes or not material.node_tree:
        return None
    principled = next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not principled:
        return None
    socket = principled.inputs.get("Base Color")
    if not socket or not socket.is_linked:
        return None
    # LOD1 is authored after the export marker has wrapped Base Color. Follow the
    # marker's original-colour input, then traverse upstream without crossing the
    # vertex-colour input that exists only to make Blender emit COLOR semantics.
    pending = [socket.links[0].from_node]
    visited = set()
    while pending:
        node = pending.pop(0)
        if node.as_pointer() in visited:
            continue
        visited.add(node.as_pointer())
        if node.type == "TEX_IMAGE" and node.image:
            _ = node.image.pixels[0] if len(node.image.pixels) else None
            return node.image if node.image.has_data else None
        inputs = [node.inputs[1]] if node.name == "Wind_COLOR_0_zero_mix" else list(node.inputs)
        for input_socket in inputs:
            pending.extend(link.from_node for link in input_socket.links)
    return None


def sampled_green_score(obj: bpy.types.Object) -> list[float]:
    """Estimate foliage from base-colour texture UVs; fall back to material colour."""
    mesh = obj.data
    values = [0.0] * len(mesh.vertices)
    counts = [0] * len(mesh.vertices)
    uv_layer = mesh.uv_layers.active
    pixels_cache = {}
    for polygon in mesh.polygons:
        material = obj.material_slots[polygon.material_index].material if polygon.material_index < len(obj.material_slots) else None
        image = image_for_material(material)
        base = material.diffuse_color[:3] if material else (0.5, 0.5, 0.5)
        if image and image.name not in pixels_cache:
            pixels_cache[image.name] = (list(image.pixels), image.size[0], image.size[1])
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            rgb = base
            if image and uv_layer:
                pixels, width, height = pixels_cache[image.name]
                uv = uv_layer.data[loop_index].uv
                x = int((uv.x % 1.0) * (width - 1))
                y = int((uv.y % 1.0) * (height - 1))
                offset = (y * width + x) * 4
                rgb = pixels[offset : offset + 3]
            r, g, b = rgb
            score = max(0.0, min(1.0, (g - 0.55 * r - 0.25 * b + 0.12) * 2.2))
            values[vertex_index] += score
            counts[vertex_index] += 1
    return [value / count if count else 0.0 for value, count in zip(values, counts)]


def author_wind(objects: list[bpy.types.Object], kind: str, total_height: float) -> None:
    """COLOR_0: R bend, G foliage/edge flutter, B deterministic phase, A 1."""
    for obj in objects:
        mesh = obj.data
        green = sampled_green_score(obj)
        textured = any(image_for_material(slot.material) for slot in obj.material_slots)
        if kind in {"tree", "palm"} and textured and max(green, default=0.0) - min(green, default=0.0) < 0.02:
            raise ValueError(f"{obj.name}: UV-derived foliage score is unexpectedly uniform")
        # Generated sources may carry baked display colours. They are unrelated to
        # wind and would become ambiguous COLOR_1 data in glTF, so replace them.
        for existing in list(mesh.color_attributes):
            mesh.color_attributes.remove(existing)
        attribute = mesh.color_attributes.new(name="COLOR_0", type="FLOAT_COLOR", domain="POINT")
        obj["wind_foliage_score_min"] = min(green, default=0.0)
        obj["wind_foliage_score_max"] = max(green, default=0.0)
        obj["wind_foliage_score_source"] = "base-colour UV" if textured else "material diffuse fallback"
        mesh.color_attributes.active_color = attribute
        # Blender 5.1 exports COLOR_0 only when a material graph reaches the layer.
        # A zero-factor mix leaves the original base colour mathematically unchanged.
        for slot in obj.material_slots:
            material = slot.material
            if material and material.node_tree and not material.node_tree.nodes.get("Wind_COLOR_0_export_marker"):
                nodes = material.node_tree.nodes
                links = material.node_tree.links
                node = material.node_tree.nodes.new("ShaderNodeVertexColor")
                node.name = "Wind_COLOR_0_export_marker"
                node.label = "Wind data only; do not use as material tint"
                node.layer_name = "COLOR_0"
                principled = next((item for item in nodes if item.type == "BSDF_PRINCIPLED"), None)
                if principled:
                    base = principled.inputs.get("Base Color")
                    mix = nodes.new("ShaderNodeMixRGB")
                    mix.name = "Wind_COLOR_0_zero_mix"
                    mix.blend_type = "MIX"
                    mix.inputs[0].default_value = 0.0
                    if base.is_linked:
                        original = base.links[0].from_socket
                        links.remove(base.links[0])
                        links.new(original, mix.inputs[1])
                    else:
                        mix.inputs[1].default_value = base.default_value
                    links.new(node.outputs["Color"], mix.inputs[2])
                    links.new(mix.outputs["Color"], base)
        for vertex in mesh.vertices:
            world = obj.matrix_world @ vertex.co
            normalized_height = max(0.0, min(1.0, world.z / total_height))
            root_ramp = max(0.0, min(1.0, (normalized_height - 0.04) / 0.96))
            foliage = green[vertex.index]
            if kind == "grass":
                bend = root_ramp ** 1.35
                flutter = root_ramp ** 2.0
            else:
                bend = root_ramp * (0.12 + 0.88 * foliage)
                flutter = (root_ramp ** 1.5) * foliage
            phase = math.sin(world.x * 12.9898 + world.y * 78.233 + world.z * 19.19) * 43758.5453
            phase -= math.floor(phase)
            attribute.data[vertex.index].color = (bend, flutter, phase, 1.0)


def set_asset_metadata(asset_id: str, source_hash: str, kind: str) -> None:
    scene = bpy.context.scene
    scene["asset_id"] = asset_id
    scene["immutable_source_sha256"] = source_hash
    scene["wind_attribute"] = "COLOR_0"
    scene["wind_channels"] = "R=bend,G=flutter,B=phase"
    scene["wind_method"] = "texture-colour and height heuristic" if kind != "grass" else "height heuristic"


def triangles(objects: list[bpy.types.Object]) -> int:
    return sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in objects)


def materials(objects: list[bpy.types.Object]) -> list[str]:
    return sorted({slot.material.name for obj in objects for slot in obj.material_slots if slot.material})


def export_selected(path: Path, objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    export_mix_nodes = []
    for obj in objects:
        for slot in obj.material_slots:
            material = slot.material
            mix = material.node_tree.nodes.get("Wind_COLOR_0_zero_mix") if material and material.node_tree else None
            if mix and mix not in export_mix_nodes:
                export_mix_nodes.append(mix)
                mix.blend_type = "MULTIPLY"
                mix.inputs[0].default_value = 1.0
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_attributes=False, export_yup=True,
        export_apply=True, export_image_format="AUTO"
    )
    for mix in export_mix_nodes:
        mix.blend_type = "MIX"
        mix.inputs[0].default_value = 0.0
    normalize_gltf_color_semantics(path)
    for obj in objects:
        obj.select_set(False)


def normalize_gltf_color_semantics(path: Path) -> None:
    """Promote Blender's authored COLOR_1 to the runtime COLOR_0 semantic.

    Blender 5.1 reserves COLOR_0 for a white material marker when an active color
    layer is also exported. The actual authored active layer is COLOR_1. Rewrite
    only the primitive semantic map; accessor bytes remain untouched.
    """
    raw = path.read_bytes()
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f"Invalid GLB JSON chunk: {path}")
    data = json.loads(raw[20 : 20 + json_length])
    promoted = False
    for mesh in data.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            attributes = primitive.get("attributes", {})
            if "COLOR_1" in attributes:
                attributes["COLOR_0"] = attributes.pop("COLOR_1")
                promoted = True
    if not promoted:
        return
    binary_offset = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", raw, binary_offset)
    binary = raw[binary_offset + 8 : binary_offset + 8 + binary_length]
    encoded = json.dumps(data, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    binary += b"\0" * ((-len(binary)) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
        + struct.pack("<II", len(binary), binary_type) + binary
    )


def make_lod1(lod0: list[bpy.types.Object], ratio: float, kind: str, total_height: float) -> list[bpy.types.Object]:
    lod1 = []
    for source in lod0:
        copy = source.copy()
        copy.data = source.data.copy()
        copy.name = source.name.replace("LOD0", "LOD1")
        bpy.context.collection.objects.link(copy)
        if len(copy.data.polygons) > 24:
            modifier = copy.modifiers.new("LOD1_Decimate", "DECIMATE")
            modifier.ratio = ratio
            bpy.context.view_layer.objects.active = copy
            copy.select_set(True)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            copy.select_set(False)
        lod1.append(copy)
    author_wind(lod1, kind, total_height)
    return lod1


def manifest_entry(asset_id: str, source: Path, source_hash: str, target_height: float,
                   kind: str, lod0: list, lod1: list, textures: list[dict], blend_path: Path,
                   lod0_path: Path, lod1_path: Path) -> dict:
    low, high = world_bounds(lod0)
    glb_low = (low.x, low.z, -high.y)
    glb_high = (high.x, high.z, -low.y)
    readable = asset_id.removeprefix("vegetation.").replace("-01", "").replace("-", " ").title()
    return {
        "id": asset_id,
        "label": readable,
        "kind": kind,
        "height": target_height,
        "url": f"/vegetation/{lod0_path.name}",
        "lod1Url": f"/vegetation/{lod1_path.name}",
        "blendUrl": f"/assets/vegetation/{asset_id}.blend",
        "bounds": {"min": [round(v, 6) for v in glb_low], "max": [round(v, 6) for v in glb_high]},
        "triangleCount": triangles(lod0),
        "lod1TriangleCount": triangles(lod1),
        "source": {"filename": source.name, "sha256": source_hash, "generator": "Tripo"},
        "coordinateSystem": {"authoringUp": "Z", "glbUp": "Y", "unit": "metre", "grounded": True},
        "materials": materials(lod0),
        "textures": textures,
        "wind": {
            "attribute": "COLOR_0", "channels": {"r": "bend", "g": "flutter", "b": "phase"},
            "rootLocked": True,
            "method": "height-only heuristic" if kind == "grass" else "base-colour UV greenness plus height heuristic",
            "limitations": "Generated mesh semantics were inferred; masks are not a hand-authored botanical rig. Runtime shaders must read COLOR_0 as wind data and must not multiply it into material colour."
        },
        "lods": [
            {"level": 0, "uri": f"/vegetation/{lod0_path.name}", "triangles": triangles(lod0), "bytes": lod0_path.stat().st_size, "sha256": sha256(lod0_path)},
            {"level": 1, "uri": f"/vegetation/{lod1_path.name}", "triangles": triangles(lod1), "bytes": lod1_path.stat().st_size, "sha256": sha256(lod1_path)},
        ],
    }


def update_manifest(entry: dict) -> None:
    manifest = {"schemaVersion": 1, "assets": []}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text())
    manifest["assets"] = sorted(
        [item for item in manifest.get("assets", []) if item.get("id") != entry["id"]] + [entry],
        key=lambda item: item["id"],
    )
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")


def main() -> None:
    args = arguments()
    source = args.source.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    VEGETATION_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    reset_scene()
    import_source(source)
    lod0 = meshes()
    if not lod0:
        raise ValueError("Source imported without mesh geometry")
    normalize(lod0, args.height)
    for index, obj in enumerate(lod0):
        obj.name = f"{args.id}_LOD0_{index:02d}"
    textures = resize_and_pack_images()
    author_wind(lod0, args.kind, args.height)
    source_hash = sha256(source)
    set_asset_metadata(args.id, source_hash, args.kind)
    lod1 = make_lod1(lod0, args.lod1_ratio, args.kind, args.height)
    lod0_path = PUBLIC_DIR / f"{args.id}.lod0.glb"
    lod1_path = PUBLIC_DIR / f"{args.id}.lod1.glb"
    export_selected(lod0_path, lod0)
    export_selected(lod1_path, lod1)
    for obj in lod0:
        obj.hide_set(False)
    for obj in lod1:
        obj.hide_set(True)
        obj.hide_render = True
    blend_path = VEGETATION_DIR / f"{args.id}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)
    entry = manifest_entry(args.id, source, source_hash, args.height, args.kind, lod0, lod1,
                           textures, blend_path, lod0_path, lod1_path)
    update_manifest(entry)
    print(json.dumps(entry, indent=2))


if __name__ == "__main__":
    main()
