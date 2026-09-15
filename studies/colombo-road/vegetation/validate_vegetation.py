#!/usr/bin/env python3
"""Validate published vegetation numerically, without rendering."""
import hashlib, json, math, struct
from pathlib import Path

ROAD = Path(__file__).resolve().parents[1]
PUBLIC = ROAD / "viewer/public/vegetation"
EXPECTED = {"vegetation.rain-tree-01", "vegetation.round-tree-01", "vegetation.coconut-palm-01", "vegetation.short-grass-01", "vegetation.tall-grass-01"}
FMT = {5120:"b", 5121:"B", 5122:"h", 5123:"H", 5125:"I", 5126:"f"}
COUNT = {"SCALAR":1, "VEC2":2, "VEC3":3, "VEC4":4}

def load_glb(path):
    raw = path.read_bytes(); magic, version, length = struct.unpack_from("<4sII", raw)
    assert (magic, version, length) == (b"glTF", 2, len(raw)), f"{path}: invalid GLB header"
    n, kind = struct.unpack_from("<II", raw, 12); assert kind == 0x4E4F534A
    data = json.loads(raw[20:20+n]); offset = 20+n
    size, kind = struct.unpack_from("<II", raw, offset); assert kind == 0x004E4942
    return data, raw[offset+8:offset+8+size]

def values(data, binary, index):
    acc=data["accessors"][index]; view=data["bufferViews"][acc["bufferView"]]
    n=COUNT[acc["type"]]; code=FMT[acc["componentType"]]; unit=struct.calcsize(code)
    stride=view.get("byteStride", n*unit); start=view.get("byteOffset",0)+acc.get("byteOffset",0)
    divisor=1.0
    if acc.get("normalized"): divisor={5120:127,5121:255,5122:32767,5123:65535}[acc["componentType"]]
    return [tuple(v/divisor for v in struct.unpack_from("<"+code*n,binary,start+i*stride)) for i in range(acc["count"])]

def close(a,b): return all(abs(x-y)<=2e-4 for x,y in zip(a,b))

def image_size(payload, mime):
    if mime=="image/png" and payload[:8]==b"\x89PNG\r\n\x1a\n": return struct.unpack(">II",payload[16:24])
    if mime in {"image/jpeg","image/jpg"} and payload[:2]==b"\xff\xd8":
        offset=2
        while offset+9<len(payload):
            if payload[offset]!=0xFF: offset+=1; continue
            marker=payload[offset+1]; offset+=2
            if marker in {0xD8,0xD9}: continue
            length=struct.unpack_from(">H",payload,offset)[0]
            if marker in {0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF}:
                height,width=struct.unpack_from(">HH",payload,offset+3); return width,height
            offset+=length
    raise AssertionError(f"unsupported embedded image format: {mime}")

def check(asset):
    aid=asset["id"]
    assert len(asset["source"]["sha256"])==64, f"{aid}: invalid source hash"
    recipes=json.loads((ROAD/"vegetation/sources/generation-recipes.json").read_text())
    recipe=next((item for item in recipes["recipes"] if item["assetId"]==aid),None)
    source_output=next((item for item in recipe["outputs"] if item["filename"]=="model.glb"),None) if recipe else None
    assert source_output and source_output["sha256"]==asset["source"]["sha256"], f"{aid}: recipe source hash mismatch"
    assert asset["wind"]["attribute"]=="COLOR_0" and asset["wind"]["rootLocked"]
    assert asset["blendUrl"]==f"/assets/vegetation/{aid}.blend"
    assert (ROAD/"vegetation"/f"{aid}.blend").is_file()
    for lod in asset["lods"]:
        path=PUBLIC/Path(lod["uri"]).name
        assert path.is_file() and path.stat().st_size==lod["bytes"] and path.stat().st_size<100_000_000
        assert hashlib.sha256(path.read_bytes()).hexdigest()==lod["sha256"], f"{path}: output hash mismatch"
        data,binary=load_glb(path); prims=[p for mesh in data.get("meshes",[]) for p in mesh.get("primitives",[])]
        assert prims and all("COLOR_0" in p.get("attributes",{}) for p in prims), f"{path}: missing COLOR_0 primitive"
        tris=0; positions=[]; colors=[]
        for prim in prims:
            assert prim.get("mode",4)==4 and "indices" in prim
            tris += data["accessors"][prim["indices"]]["count"]//3
            positions += values(data,binary,prim["attributes"]["POSITION"])
            color_acc=data["accessors"][prim["attributes"]["COLOR_0"]]; assert color_acc["type"] in {"VEC3","VEC4"}
            colors += values(data,binary,prim["attributes"]["COLOR_0"])
        assert tris==lod["triangles"], f"{path}: triangle count mismatch"
        assert all(math.isfinite(v) for row in positions+colors for v in row), f"{path}: non-finite data"
        assert all(0.0<=v<=1.0 for color in colors for v in color[:3]), f"{path}: wind mask outside [0,1]"
        actual_min=[min(p[i] for p in positions) for i in range(3)]; actual_max=[max(p[i] for p in positions) for i in range(3)]
        if lod["level"]==0: assert close(actual_min,asset["bounds"]["min"]) and close(actual_max,asset["bounds"]["max"]), f"{path}: bounds mismatch"
        roots=[c for p,c in zip(positions,colors) if p[1]<=asset["height"]*.04+1e-5]
        assert roots and max(max(c[0],c[1]) for c in roots)<=1/255+1e-6, f"{path}: roots not locked"
        assert data.get("materials") and data.get("images"), f"{path}: PBR assets missing"
        assert any("baseColorTexture" in m.get("pbrMetallicRoughness",{}) for m in data["materials"]), f"{path}: base texture missing"
        assert any("metallicRoughnessTexture" in m.get("pbrMetallicRoughness",{}) for m in data["materials"]), f"{path}: ORM texture missing"
        assert any("normalTexture" in m for m in data["materials"]), f"{path}: normal texture missing"
        for image in data["images"]:
            view=data["bufferViews"][image["bufferView"]]; start=view.get("byteOffset",0); payload=binary[start:start+view["byteLength"]]
            assert max(image_size(payload,image["mimeType"]))<=1024, f"{path}: embedded texture exceeds 1024px"

def main():
    manifest=json.loads((PUBLIC/"manifest.json").read_text()); ids={a["id"] for a in manifest.get("assets",[])}
    missing=EXPECTED-ids
    if missing: raise AssertionError("manifest missing assets: "+", ".join(sorted(missing)))
    for asset in manifest["assets"]:
        check(asset); print(f"PASS {asset['id']}: LOD0 {asset['triangleCount']:,}, LOD1 {asset['lod1TriangleCount']:,}")

if __name__=="__main__": main()
