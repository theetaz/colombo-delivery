#!/usr/bin/env python3
"""Numeric validation for generated environment deliverables."""
import hashlib, importlib.util, json, math
from pathlib import Path

ROAD=Path(__file__).resolve().parents[1]; PUBLIC=ROAD/"viewer/public/environment"
EXPECTED={"environment.neighborhood-market-01","environment.corner-cafe-01","environment.verandah-house-01","environment.courtyard-apartments-01","environment.hibiscus-shrub-01"}
spec=importlib.util.spec_from_file_location("glbcheck",ROAD/"vegetation/validate_vegetation.py"); glb=importlib.util.module_from_spec(spec); spec.loader.exec_module(glb)

def close(a,b): return all(abs(x-y)<=2e-4 for x,y in zip(a,b))

def check(asset,recipe):
    aid=asset["id"]; source=next((x for x in recipe["outputs"] if x["filename"]=="model.glb"),None)
    assert source and source["sha256"]==asset["source"]["sha256"],f"{aid}: source provenance mismatch"
    assert asset["coordinateSystem"]=={"authoringUp":"Z","glbUp":"Y","front":"Z","unit":"metre","grounded":True}
    assert asset["blendUrl"]==f"/assets/environment/{aid}.blend" and (ROAD/"environment"/f"{aid}.blend").is_file()
    for lod in asset["lods"]:
        path=PUBLIC/Path(lod["uri"]).name; raw=path.read_bytes()
        assert len(raw)==lod["bytes"] and len(raw)<100_000_000 and hashlib.sha256(raw).hexdigest()==lod["sha256"]
        data,binary=glb.load_glb(path); prims=[p for m in data.get("meshes",[]) for p in m.get("primitives",[])]
        assert prims and all(p.get("mode",4)==4 and "indices" in p for p in prims)
        tris=sum(data["accessors"][p["indices"]]["count"]//3 for p in prims); assert tris==lod["triangles"]
        positions=[]
        for p in prims: positions+=glb.values(data,binary,p["attributes"]["POSITION"])
        assert all(math.isfinite(v) for row in positions for v in row)
        low=[min(p[i] for p in positions) for i in range(3)]; high=[max(p[i] for p in positions) for i in range(3)]
        assert abs(low[1])<=2e-4,f"{path}: not grounded"
        if lod["level"]==0: assert close(low,asset["bounds"]["min"]) and close(high,asset["bounds"]["max"]),f"{path}: bounds mismatch"
        assert data.get("materials") and data.get("images")
        assert any("baseColorTexture" in m.get("pbrMetallicRoughness",{}) for m in data["materials"])
        assert any("metallicRoughnessTexture" in m.get("pbrMetallicRoughness",{}) for m in data["materials"])
        assert any("normalTexture" in m for m in data["materials"])
        for image in data["images"]:
            view=data["bufferViews"][image["bufferView"]]; start=view.get("byteOffset",0); payload=binary[start:start+view["byteLength"]]
            assert max(glb.image_size(payload,image["mimeType"]))<=1024
        if asset["kind"]=="shrub":
            assert all("COLOR_0" in p["attributes"] for p in prims)
            colors=[]
            for p in prims: colors+=glb.values(data,binary,p["attributes"]["COLOR_0"])
            assert all(0<=v<=1 for c in colors for v in c[:3])
            roots=[c for p,c in zip(positions,colors) if p[1]<=asset["height"]*.04+1e-5]
            assert roots and max(max(c[0],c[1]) for c in roots)<=1/255+1e-6
    assert asset["lod1TriangleCount"]<asset["triangleCount"]
    if asset["kind"]=="building":
        anchor=asset["anchors"]["front"]; assert anchor["id"]==f"{aid}.anchor.front" and anchor["purpose"]=="exterior interaction reference; not detected doorway"
        assert close(anchor["position"],[0,0,asset["bounds"]["max"][2]])
        footprint=asset["collisionFootprint"]; assert footprint["minX"]==asset["bounds"]["min"][0] and footprint["maxX"]==asset["bounds"]["max"][0]

def main():
    manifest=json.loads((PUBLIC/"manifest.json").read_text()); recipes=json.loads((ROAD/"environment/sources/generation-recipes.json").read_text())
    assert {x["id"] for x in manifest["assets"]}==EXPECTED
    for asset in manifest["assets"]:
        recipe=next((x for x in recipes["recipes"] if x["assetId"]==asset["id"]),None); assert recipe
        check(asset,recipe); print(f"PASS {asset['id']}: {asset['triangleCount']:,}/{asset['lod1TriangleCount']:,} triangles")

if __name__=="__main__": main()
