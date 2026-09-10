#!/usr/bin/env python3
"""Fetch and preserve the bounded OpenStreetMap source snapshot for Stage 1."""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
OSM_DIR = ROOT / "data" / "osm"
QUERY_PATH = OSM_DIR / "lotus_tower_query.overpassql"
SNAPSHOT_PATH = OSM_DIR / "lotus_tower_snapshot.osm.json.gz"
MANIFEST_PATH = OSM_DIR / "manifest.json"

ANCHOR = {
    "name": "Colombo Lotus Tower",
    "osm_type": "way",
    "osm_id": 728831229,
    "lon": 79.8583149,
    "lat": 6.9270265,
}
EARTH_RADIUS_M = 6_371_008.8
CORE_RADIUS_M = 1_000
BUFFER_M = 500
CONTEXT_RADIUS_M = CORE_RADIUS_M + BUFFER_M


def enclosing_bbox(lon: float, lat: float, radius_m: float) -> list[float]:
    """Return [west, south, east, north] enclosing a spherical radius."""
    latitude_delta = math.degrees(radius_m / EARTH_RADIUS_M)
    longitude_delta = math.degrees(
        radius_m / (EARTH_RADIUS_M * math.cos(math.radians(lat)))
    )
    return [
        round(lon - longitude_delta, 7),
        round(lat - latitude_delta, 7),
        round(lon + longitude_delta, 7),
        round(lat + latitude_delta, 7),
    ]


ACQUISITION_BBOX = enclosing_bbox(
    ANCHOR["lon"], ANCHOR["lat"], CONTEXT_RADIUS_M
)


def build_query() -> str:
    west, south, east, north = ACQUISITION_BBOX
    bbox = f"{south:.7f},{west:.7f},{north:.7f},{east:.7f}"
    return f"""[out:json][timeout:180][bbox:{bbox}];
way[\"highway\"]->.roads;
node(w.roads)->.road_nodes;
rel(bw.roads)[\"type\"=\"restriction\"]->.restrictions_by_way;
rel(bn.road_nodes)[\"type\"=\"restriction\"]->.restrictions_by_node;
rel[\"type\"=\"restriction\"]->.restrictions_in_bbox;
(
  .restrictions_by_way;
  .restrictions_by_node;
  .restrictions_in_bbox;
)->.restrictions;
(
  node[\"highway\"~\"^(crossing|traffic_signals|mini_roundabout|stop|give_way)$\"];
  way[\"highway\"~\"^(crossing|pedestrian)$\"];
  node[\"barrier\"];
  way[\"barrier\"];
  node[\"entrance\"];
  way[\"entrance\"];
  node[\"amenity\"~\"^(parking|fuel|charging_station|restaurant|cafe|fast_food|pharmacy|hospital|clinic|marketplace|post_office)$\"];
  way[\"amenity\"~\"^(parking|fuel|charging_station|restaurant|cafe|fast_food|pharmacy|hospital|clinic|marketplace|post_office)$\"];
  node[\"shop\"~\"^(supermarket|convenience|department_store|mall|wholesale)$\"];
  way[\"shop\"~\"^(supermarket|convenience|department_store|mall|wholesale)$\"];
  node[\"tourism\"~\"^(attraction|hotel)$\"];
  way[\"tourism\"~\"^(attraction|hotel)$\"];
  node[\"public_transport\"];
  way[\"public_transport\"];
  node[\"highway\"=\"bus_stop\"];
  node[\"railway\"~\"^(station|halt|tram_stop)$\"];
  way[\"railway\"~\"^(station|halt|tram_stop)$\"];
)->.mapped_features;
way({ANCHOR['osm_id']})->.anchor;
(
  .roads;
  .road_nodes;
  .restrictions;
  .mapped_features;
  .anchor;
)->.selected;
(
  .selected;
  .selected >>;
);
out body qt;
"""


DEFAULT_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def atomic_write(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def reproducible_gzip(value: bytes) -> bytes:
    output = bytearray()

    class _Sink:
        def write(self, chunk: bytes) -> int:
            output.extend(chunk)
            return len(chunk)

        def flush(self) -> None:
            return None

    with gzip.GzipFile(filename="", mode="wb", compresslevel=9, fileobj=_Sink(), mtime=0) as handle:
        handle.write(value)
    return bytes(output)


def validate_snapshot(raw: bytes) -> dict:
    payload = json.loads(raw)
    if payload.get("remark"):
        raise ValueError(f"Overpass returned an incomplete-response remark: {payload['remark']}")
    if not payload.get("osm3s", {}).get("timestamp_osm_base"):
        raise ValueError("Overpass response has no OSM base timestamp")
    if not isinstance(payload.get("elements"), list) or not payload["elements"]:
        raise ValueError("Overpass response contains no OSM elements")
    anchor = next(
        (
            element
            for element in payload["elements"]
            if element.get("type") == ANCHOR["osm_type"]
            and element.get("id") == ANCHOR["osm_id"]
        ),
        None,
    )
    if anchor is None or anchor.get("tags", {}).get("name") != ANCHOR["name"]:
        raise ValueError("Overpass response does not contain the verified Lotus Tower anchor")
    personal_keys = {"user", "uid"}
    leaked = [
        f"{element.get('type')}/{element.get('id')}"
        for element in payload["elements"]
        if personal_keys.intersection(element)
    ]
    if leaked:
        raise ValueError(f"Contributor identity fields unexpectedly present: {leaked[:3]}")
    available = {
        (element.get("type"), element.get("id")) for element in payload["elements"]
    }
    missing_refs: list[str] = []
    for element in payload["elements"]:
        if element.get("type") == "way":
            for node_id in element.get("nodes", []):
                if ("node", node_id) not in available:
                    missing_refs.append(f"way/{element.get('id')} -> node/{node_id}")
        elif element.get("type") == "relation" and element.get("tags", {}).get("type") == "restriction":
            for member in element.get("members", []):
                if (member.get("type"), member.get("ref")) not in available:
                    missing_refs.append(
                        f"relation/{element.get('id')} -> {member.get('type')}/{member.get('ref')}"
                    )
    if missing_refs:
        raise ValueError(f"Referenced OSM members are missing: {missing_refs[:3]}")
    return payload


def fetch(query: str, endpoints: list[str]) -> tuple[bytes, str]:
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    failures: list[str] = []
    for endpoint in endpoints:
        request = urllib.request.Request(
            endpoint,
            data=encoded,
            headers={
                "User-Agent": "colombo-delivery-stage1/1.0 (public road-data audit)",
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=240) as response:
                raw = response.read()
            validate_snapshot(raw)
            return raw, endpoint
        except (OSError, ValueError, json.JSONDecodeError, urllib.error.URLError) as error:
            failures.append(f"{endpoint}: {error}")
    raise RuntimeError("All Overpass endpoints failed:\n" + "\n".join(failures))


def build_manifest(raw: bytes, compressed: bytes, query: str, endpoint: str) -> dict:
    payload = json.loads(raw)
    fetched_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    counts: dict[str, int] = {}
    for element in payload["elements"]:
        element_type = element.get("type", "unknown")
        counts[element_type] = counts.get(element_type, 0) + 1
    return {
        "schema_version": 1,
        "dataset": "Colombo Lotus Tower Stage 1 OSM road audit",
        "fetched_at_utc": fetched_at,
        "osm_base_timestamp": payload.get("osm3s", {}).get("timestamp_osm_base"),
        "overpass_generator": payload.get("generator"),
        "endpoint": endpoint,
        "query_file": str(QUERY_PATH.relative_to(ROOT)),
        "query_sha256": sha256_bytes(query.encode("utf-8")),
        "snapshot_file": str(SNAPSHOT_PATH.relative_to(ROOT)),
        "snapshot_sha256_compressed": sha256_bytes(compressed),
        "snapshot_sha256_uncompressed": sha256_bytes(raw),
        "snapshot_bytes_compressed": len(compressed),
        "snapshot_bytes_uncompressed": len(raw),
        "element_counts": dict(sorted(counts.items())),
        "anchor": {
            **ANCHOR,
            "coordinate_method": "Overpass out center for the OSM building way",
            "verification": {
                "nominatim_url": "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=Colombo%20Lotus%20Tower%2C%20Sri%20Lanka",
                "nominatim_coordinate": [79.8583152, 6.9270163],
                "osm_object_url": "https://www.openstreetmap.org/way/728831229",
            },
        },
        "study_area": {
            "shape": "spherical_azimuthal_equidistant_circle",
            "center_wgs84": [ANCHOR["lon"], ANCHOR["lat"]],
            "core_radius_m": CORE_RADIUS_M,
            "routing_buffer_m": BUFFER_M,
            "context_radius_m": CONTEXT_RADIUS_M,
            "acquisition_bbox_wgs84": ACQUISITION_BBOX,
            "boundary_inclusion": "A road intersects an area when any projected segment touches or enters its circular boundary.",
        },
        "projection": {
            "name": "local spherical azimuthal equidistant",
            "origin_wgs84": [ANCHOR["lon"], ANCHOR["lat"]],
            "earth_radius_m": EARTH_RADIUS_M,
            "units": "metres",
            "axis_convention": {"x": "east", "y": "north"},
            "precision_note": "Spherical local analysis, not WGS84 ellipsoidal survey precision.",
        },
        "source": {
            "name": "OpenStreetMap",
            "overpass_api": endpoint,
            "copyright_url": "https://www.openstreetmap.org/copyright",
            "license": "Open Data Commons Open Database License (ODbL) 1.0",
            "license_url": "https://opendatacommons.org/licenses/odbl/1-0/",
            "attribution": "© OpenStreetMap contributors",
        },
        "privacy": {
            "query_output_mode": "body",
            "excluded_contributor_identity_fields": ["user", "uid"],
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--endpoint",
        action="append",
        dest="endpoints",
        help="Overpass interpreter URL; repeat to define fallback order",
    )
    return parser.parse_args()


def main() -> None:
    arguments = parse_args()
    query = build_query()
    endpoints = arguments.endpoints or list(DEFAULT_ENDPOINTS)
    raw, endpoint = fetch(query, endpoints)
    compressed = reproducible_gzip(raw)
    manifest = build_manifest(raw, compressed, query, endpoint)

    atomic_write(QUERY_PATH, query.encode("utf-8"))
    atomic_write(SNAPSHOT_PATH, compressed)
    atomic_write(
        MANIFEST_PATH,
        (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )
    print(
        f"Saved {len(manifest['element_counts'])} element types, "
        f"{sum(manifest['element_counts'].values())} elements from {endpoint}"
    )
    print(f"Snapshot SHA-256: {manifest['snapshot_sha256_compressed']}")


if __name__ == "__main__":
    main()
