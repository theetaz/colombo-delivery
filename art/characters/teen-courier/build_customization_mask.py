"""Build a pixel-accurate RGB tint mask from the accepted reconstruction UVs.

R = skin, G = shirt, B = shoes. The authored base-color texture remains the
default appearance; this mask only identifies pixels eligible for optional UI
recoloring.
"""

from pathlib import Path
import io
import json
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "art/characters/teen-courier/reconstruction/teen-courier-tripo-p1-draft.glb"
OUTPUT = ROOT / "art/characters/teen-courier/reconstruction/textures/teen-courier-customization-mask.png"
COMPONENT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    payload = path.read_bytes()
    json_len = struct.unpack_from("<I", payload, 12)[0]
    gltf = json.loads(payload[20:20 + json_len].decode("utf-8").rstrip("\0 "))
    binary_offset = 20 + json_len
    binary_len = struct.unpack_from("<I", payload, binary_offset)[0]
    return gltf, payload[binary_offset + 8:binary_offset + 8 + binary_len]


def accessor(gltf, binary, index):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    dtype = COMPONENT[acc["componentType"]]
    width = WIDTH[acc["type"]]
    offset = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride", np.dtype(dtype).itemsize * width)
    if stride == np.dtype(dtype).itemsize * width:
        return np.frombuffer(binary, dtype=dtype, count=acc["count"] * width, offset=offset).reshape(-1, width)
    rows = [np.frombuffer(binary, dtype=dtype, count=width, offset=offset + i * stride) for i in range(acc["count"])]
    return np.asarray(rows)


def embedded_image(gltf, binary, index):
    image = gltf["images"][index]
    view = gltf["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return Image.open(io.BytesIO(binary[start:start + view["byteLength"]])).convert("RGB")


def triangle_mask(uvs, positions, indices, predicate, size):
    canvas = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(canvas)
    for tri in indices.reshape(-1, 3):
        center = positions[tri].mean(axis=0)
        if not predicate(center):
            continue
        points = []
        for uv in uvs[tri]:
            # Raw glTF TEXCOORD_0 and the encoded image both use the glTF
            # top-origin convention. GLTFLoader keeps embedded textures at
            # flipY=false, so no Blender-style V inversion belongs here.
            points.append((float(uv[0] % 1.0) * (size - 1), float(uv[1] % 1.0) * (size - 1)))
        draw.polygon(points, fill=255)
    return np.asarray(canvas, dtype=np.float32) / 255.0


def main():
    gltf, binary = read_glb(SOURCE)
    primitive = gltf["meshes"][0]["primitives"][0]
    positions = accessor(gltf, binary, primitive["attributes"]["POSITION"]).astype(np.float32)
    uvs = accessor(gltf, binary, primitive["attributes"]["TEXCOORD_0"]).astype(np.float32)
    indices = accessor(gltf, binary, primitive["indices"]).reshape(-1).astype(np.int64)
    ymin, ymax = positions[:, 1].min(), positions[:, 1].max()
    height = ymax - ymin
    normalized_y = lambda p: (p[1] - ymin) / height

    base_index = gltf["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    image_index = gltf["textures"][base_index]["source"]
    base_image = embedded_image(gltf, binary, image_index)
    size = max(base_image.size)
    base = np.asarray(base_image.resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    all_surface = triangle_mask(uvs, positions, indices, lambda p: True, size)
    shirt_surface = triangle_mask(uvs, positions, indices, lambda p: 0.39 < normalized_y(p) < 0.85, size)
    shoe_surface = triangle_mask(uvs, positions, indices, lambda p: normalized_y(p) < 0.17, size)
    r, g, b = base[..., 0], base[..., 1], base[..., 2]
    value = np.maximum.reduce([r, g, b])
    chroma = value - np.minimum.reduce([r, g, b])

    # Warm mid/high-value pixels capture skin while excluding brows, eyes,
    # pupils, hair, clothing, and deep baked creases.
    skin_color = (r > 0.30) & (r > g * 1.075) & (g > b * 1.06) & (chroma > 0.055)
    # Teal chroma captures the shirt inside a torso/upper-arm height gate.
    shirt_color = (g > r * 1.08) & (b > r * 1.10) & (g > 0.22) & (b > 0.25)
    # Bright low-chroma pixels capture shoe leather but exclude warm ankles.
    shoe_color = (value > 0.58) & (chroma < 0.16)

    mask = np.zeros((size, size, 3), dtype=np.uint8)
    mask[..., 0] = np.where((all_surface > 0.5) & skin_color, 255, 0)
    mask[..., 1] = np.where((shirt_surface > 0.5) & shirt_color, 255, 0)
    mask[..., 2] = np.where((shoe_surface > 0.5) & shoe_color, 255, 0)

    # Close narrow zero-mask cracks caused by dark texels along duplicated UV
    # seams, then pad two texels into island gutters. Feature regions such as
    # eyes, brows, lips, hair, shorts, and ankles are far wider than this
    # kernel and remain excluded by their chroma and spatial predicates.
    repaired = []
    for channel in range(3):
        layer = Image.fromarray(mask[..., channel])
        layer = layer.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
        layer = layer.filter(ImageFilter.MaxFilter(5))
        repaired.append(np.asarray(layer, dtype=np.uint8))
    mask = np.stack(repaired, axis=-1)
    result = Image.fromarray(mask).filter(ImageFilter.GaussianBlur(0.65))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUTPUT, optimize=True)
    counts = {"skin": int((mask[..., 0] > 0).sum()), "shirt": int((mask[..., 1] > 0).sum()), "shoes": int((mask[..., 2] > 0).sum())}
    print(json.dumps({"output": str(OUTPUT), "resolution": [size, size], "maskedPixels": counts}))


if __name__ == "__main__":
    main()
