#!/usr/bin/env python3
"""Build deterministic GeoJSON and audit outputs from the saved OSM snapshot."""

from __future__ import annotations

import csv
import gzip
import hashlib
import heapq
import io
import json
import math
import os
from pathlib import Path
import tempfile
from collections import Counter, defaultdict, deque
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
OSM_DIR = ROOT / "data" / "osm"
DERIVED_DIR = ROOT / "data" / "derived"
AUDIT_DIR = ROOT / "data" / "audit"
SNAPSHOT_PATH = OSM_DIR / "lotus_tower_snapshot.osm.json.gz"
MANIFEST_PATH = OSM_DIR / "manifest.json"

ROAD_PATH = DERIVED_DIR / "road_network.geojson"
FEATURE_PATH = DERIVED_DIR / "map_features.geojson"
AREA_PATH = DERIVED_DIR / "study_areas.geojson"
CANDIDATE_PATH = DERIVED_DIR / "candidate_stops.geojson"
SUMMARY_PATH = AUDIT_DIR / "audit_summary.json"
GAPS_JSON_PATH = AUDIT_DIR / "gap_inventory.json"
GAPS_CSV_PATH = AUDIT_DIR / "gap_inventory.csv"

CONVENIENCE_TAGS = (
    "oneway",
    "access",
    "motor_vehicle",
    "vehicle",
    "bicycle",
    "lanes",
    "width",
    "maxspeed",
    "bridge",
    "tunnel",
    "layer",
)
NON_MOTOR_HIGHWAYS = {
    "bridleway",
    "cycleway",
    "footway",
    "path",
    "pedestrian",
    "platform",
    "steps",
}
POI_TAGS = {
    "amenity": {
        "parking",
        "fuel",
        "charging_station",
        "restaurant",
        "cafe",
        "fast_food",
        "pharmacy",
        "hospital",
        "clinic",
        "marketplace",
        "post_office",
    },
    "shop": {"supermarket", "convenience", "department_store", "mall", "wholesale"},
    "tourism": {"attraction", "hotel"},
    "public_transport": None,
    "railway": {"station", "halt", "tram_stop"},
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def stable_json(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")


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


class SphericalAEQD:
    """Local spherical azimuthal-equidistant projection in metres."""

    def __init__(self, lon: float, lat: float, radius_m: float) -> None:
        self.lon0 = math.radians(lon)
        self.lat0 = math.radians(lat)
        self.radius_m = radius_m
        self.sin_lat0 = math.sin(self.lat0)
        self.cos_lat0 = math.cos(self.lat0)

    def forward(self, coordinate: tuple[float, float] | list[float]) -> tuple[float, float]:
        lon, lat = map(math.radians, coordinate)
        delta_lon = (lon - self.lon0 + math.pi) % (2 * math.pi) - math.pi
        sin_lat, cos_lat = math.sin(lat), math.cos(lat)
        cos_c = max(
            -1.0,
            min(1.0, self.sin_lat0 * sin_lat + self.cos_lat0 * cos_lat * math.cos(delta_lon)),
        )
        c = math.acos(cos_c)
        k = 1.0 if abs(c) < 1e-15 else c / math.sin(c)
        return (
            self.radius_m * k * cos_lat * math.sin(delta_lon),
            self.radius_m
            * k
            * (self.cos_lat0 * sin_lat - self.sin_lat0 * cos_lat * math.cos(delta_lon)),
        )

    def inverse(self, point: tuple[float, float]) -> list[float]:
        x, y = point
        rho = math.hypot(x, y)
        if rho < 1e-12:
            return [math.degrees(self.lon0), math.degrees(self.lat0)]
        c = rho / self.radius_m
        sin_c, cos_c = math.sin(c), math.cos(c)
        lat = math.asin(cos_c * self.sin_lat0 + y * sin_c * self.cos_lat0 / rho)
        lon = self.lon0 + math.atan2(
            x * sin_c,
            rho * self.cos_lat0 * cos_c - y * self.sin_lat0 * sin_c,
        )
        return [round(math.degrees(lon), 7), round(math.degrees(lat), 7)]


def segment_circle_length(a: tuple[float, float], b: tuple[float, float], radius: float) -> float:
    """Length of straight projected segment inside or touching a centered circle."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    segment_length = math.hypot(dx, dy)
    if segment_length == 0:
        return 0.0
    aa = dx * dx + dy * dy
    bb = 2 * (a[0] * dx + a[1] * dy)
    cc = a[0] * a[0] + a[1] * a[1] - radius * radius
    discriminant = bb * bb - 4 * aa * cc
    cuts = [0.0, 1.0]
    if discriminant >= 0:
        root = math.sqrt(max(0.0, discriminant))
        cuts.extend(t for t in ((-bb - root) / (2 * aa), (-bb + root) / (2 * aa)) if 0 < t < 1)
    cuts.sort()
    fraction = 0.0
    for start, end in zip(cuts, cuts[1:]):
        middle = (start + end) / 2
        x, y = a[0] + middle * dx, a[1] + middle * dy
        if x * x + y * y <= radius * radius + 1e-7:
            fraction += end - start
    return segment_length * fraction


def line_lengths(points: list[tuple[float, float]], radii: Iterable[float]) -> tuple[float, dict[float, float]]:
    clipped = {radius: 0.0 for radius in radii}
    full = 0.0
    for first, second in zip(points, points[1:]):
        full += math.dist(first, second)
        for radius in clipped:
            clipped[radius] += segment_circle_length(first, second, radius)
    return full, clipped


def segment_intersects_circle(a: tuple[float, float], b: tuple[float, float], radius: float) -> bool:
    return point_segment_distance((0.0, 0.0), a, b) <= radius + 1e-7


def line_intersects_circle(points: list[tuple[float, float]], radius: float) -> bool:
    return any(math.hypot(*point) <= radius + 1e-7 for point in points) or any(
        segment_intersects_circle(first, second, radius) for first, second in zip(points, points[1:])
    )


def point_segment_distance(point: tuple[float, float], first: tuple[float, float], second: tuple[float, float]) -> float:
    dx, dy = second[0] - first[0], second[1] - first[1]
    length_squared = dx * dx + dy * dy
    if length_squared == 0:
        return math.dist(point, first)
    t = max(0.0, min(1.0, ((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / length_squared))
    return math.hypot(point[0] - (first[0] + t * dx), point[1] - (first[1] + t * dy))


def access_class(tags: dict[str, str], mode: str) -> tuple[str, str | None]:
    """Classify explicit OSM access tags without inferring legal defaults."""
    keys = [mode]
    if mode == "motor_vehicle":
        keys.extend(["vehicle", "access"])
    elif mode == "bicycle":
        keys.extend(["vehicle", "access"])
    if any(f"{key}:conditional" in tags for key in keys):
        return "unresolved", "conditional"
    source = next((key for key in keys if key in tags), None)
    if source is None:
        return "unresolved", None
    value = tags[source].strip().lower()
    if value in {"yes", "designated", "permissive", "official"}:
        return "allowed", source
    if value in {"no", "use_sidepath"}:
        return "prohibited", source
    if value in {"private", "destination", "delivery", "customers", "agricultural", "forestry"}:
        return "restricted", source
    return "unresolved", source


def road_direction(tags: dict[str, str], mode: str) -> str:
    """Return forward, reverse, both, or unresolved for the way's node order."""
    if mode == "bicycle":
        conditional_keys = [
            key
            for key in tags
            if key == "oneway:bicycle:conditional"
            or (key.startswith("cycleway:") and key.endswith(":oneway:conditional"))
        ]
        if conditional_keys:
            return "unresolved"
        bicycle_oneway = tags.get("oneway:bicycle", "").lower()
        if bicycle_oneway in {"no", "0", "false"}:
            return "both"
        if bicycle_oneway in {"-1", "reverse"}:
            return "reverse"
        if bicycle_oneway in {"yes", "1", "true"}:
            return "forward"
        if "oneway:conditional" in tags:
            return "unresolved"
        base_value = tags.get("oneway")
        if base_value is None and tags.get("junction") == "roundabout":
            base_direction = "forward"
        elif (base_value or "").strip().lower() in {"-1", "reverse"}:
            base_direction = "reverse"
        elif (base_value or "").strip().lower() in {"yes", "1", "true"}:
            base_direction = "forward"
        elif (base_value or "").strip().lower() in {"reversible", "alternating"}:
            return "unresolved"
        else:
            base_direction = "both"
        cycleway_values = " ".join(
            value.lower() for key, value in tags.items() if key == "cycleway" or key.startswith("cycleway:")
        )
        if "opposite" in cycleway_values:
            return "both"
        adds_reverse = any(
            key.startswith(("cycleway:left:", "cycleway:right:", "cycleway:both:"))
            and key.endswith(":oneway")
            and value.strip().lower() in {"-1", "reverse"}
            for key, value in tags.items()
        )
        adds_forward = any(
            key.startswith(("cycleway:left:", "cycleway:right:", "cycleway:both:"))
            and key.endswith(":oneway")
            and value.strip().lower() in {"yes", "1", "true"}
            for key, value in tags.items()
        )
        if (adds_reverse and base_direction == "forward") or (adds_forward and base_direction == "reverse"):
            return "both"
        if adds_reverse and base_direction == "reverse":
            return "reverse"
        if adds_forward and base_direction == "forward":
            return "forward"
        return base_direction
    override_keys = [f"oneway:{mode}"]
    if mode == "motor_vehicle":
        override_keys.append("oneway:vehicle")
    conditional_keys = [f"{key}:conditional" for key in override_keys] + ["oneway:conditional"]
    if any(key in tags for key in conditional_keys):
        return "unresolved"
    oneway = next((tags[key] for key in override_keys if key in tags), tags.get("oneway"))
    if oneway is None and tags.get("junction") == "roundabout":
        return "forward"
    value = (oneway or "").strip().lower()
    if value in {"-1", "reverse"}:
        return "reverse"
    if value in {"yes", "1", "true"}:
        return "forward"
    if value in {"reversible", "alternating"}:
        return "unresolved"
    return "both"


def directed_pairs(first: int, second: int, tags: dict[str, str], mode: str) -> list[tuple[int, int]]:
    direction = road_direction(tags, mode)
    if direction == "forward":
        return [(first, second)]
    if direction == "reverse":
        return [(second, first)]
    # Unresolved conditional bicycle direction is treated as bidirectional only
    # in the explicitly structural reachability view and counted separately.
    return [(first, second), (second, first)]


def qualifies_for_explicit_allowed_graph(tags: dict[str, str], mode: str) -> bool:
    return access_class(tags, mode)[0] == "allowed" and road_direction(tags, mode) != "unresolved"


def connected_components(adjacency: dict[int, set[int]]) -> list[set[int]]:
    unseen = set(adjacency)
    components: list[set[int]] = []
    while unseen:
        start = min(unseen)
        component = {start}
        queue = deque([start])
        unseen.remove(start)
        while queue:
            current = queue.popleft()
            for neighbour in adjacency[current]:
                if neighbour in unseen:
                    unseen.remove(neighbour)
                    component.add(neighbour)
                    queue.append(neighbour)
        components.append(component)
    return sorted(components, key=lambda value: (-len(value), min(value)))


def reachable(adjacency: dict[int, set[int]], start: int | None) -> set[int]:
    if start is None or start not in adjacency:
        return set()
    visited = {start}
    queue = deque([start])
    while queue:
        current = queue.popleft()
        for neighbour in adjacency[current]:
            if neighbour not in visited:
                visited.add(neighbour)
                queue.append(neighbour)
    return visited


def shortest_distances(adjacency: dict[int, dict[int, float]], start: int) -> dict[int, float]:
    distances = {start: 0.0}
    queue = [(0.0, start)]
    while queue:
        distance, current = heapq.heappop(queue)
        if distance != distances[current]:
            continue
        for neighbour, edge_length in adjacency.get(current, {}).items():
            candidate = distance + edge_length
            if candidate < distances.get(neighbour, math.inf):
                distances[neighbour] = candidate
                heapq.heappush(queue, (candidate, neighbour))
    return distances


def load_source() -> tuple[dict, dict, bytes]:
    manifest = json.loads(MANIFEST_PATH.read_text())
    compressed = SNAPSHOT_PATH.read_bytes()
    if sha256_bytes(compressed) != manifest["snapshot_sha256_compressed"]:
        raise ValueError("Compressed snapshot SHA-256 does not match manifest")
    raw = gzip.decompress(compressed)
    if sha256_bytes(raw) != manifest["snapshot_sha256_uncompressed"]:
        raise ValueError("Uncompressed snapshot SHA-256 does not match manifest")
    query = (ROOT / manifest["query_file"]).read_bytes()
    if sha256_bytes(query) != manifest["query_sha256"]:
        raise ValueError("Overpass query SHA-256 does not match manifest")
    payload = json.loads(raw)
    if payload.get("remark"):
        raise ValueError(f"Snapshot contains Overpass remark: {payload['remark']}")
    if payload.get("osm3s", {}).get("timestamp_osm_base") != manifest.get("osm_base_timestamp"):
        raise ValueError("Snapshot OSM base timestamp does not match manifest")
    available = {(element.get("type"), element.get("id")) for element in payload.get("elements", [])}
    missing_way_nodes = [
        f"way/{element['id']} -> node/{node_id}"
        for element in payload.get("elements", [])
        if element.get("type") == "way"
        for node_id in element.get("nodes", [])
        if ("node", node_id) not in available
    ]
    if missing_way_nodes:
        raise ValueError(f"Snapshot has missing way-node geometry references: {missing_way_nodes[:3]}")
    return manifest, payload, raw


def element_coordinates(element: dict, nodes: dict[int, dict]) -> list[list[float]]:
    if element["type"] == "node":
        return [[element["lon"], element["lat"]]]
    if element["type"] == "way":
        return [[nodes[node_id]["lon"], nodes[node_id]["lat"]] for node_id in element.get("nodes", []) if node_id in nodes]
    return []


def representative_coordinate(element: dict, nodes: dict[int, dict]) -> list[float] | None:
    coordinates = element_coordinates(element, nodes)
    if not coordinates:
        return None
    return [
        sum(coordinate[0] for coordinate in coordinates) / len(coordinates),
        sum(coordinate[1] for coordinate in coordinates) / len(coordinates),
    ]


def feature_zone(projected: list[tuple[float, float]], core_radius: float, context_radius: float) -> str:
    if len(projected) == 1:
        distance = math.hypot(*projected[0])
        if distance <= core_radius:
            return "core"
        if distance <= context_radius:
            return "context"
        return "relation_completion"
    if line_intersects_circle(projected, core_radius):
        return "core"
    if line_intersects_circle(projected, context_radius):
        return "context"
    return "relation_completion"


def road_edges(
    roads: list[dict],
    projected_nodes: dict[int, tuple[float, float]],
    radius: float,
) -> list[tuple[int, int, int, float, dict[str, str]]]:
    edges = []
    for road in roads:
        refs = [node_id for node_id in road.get("nodes", []) if node_id in projected_nodes]
        for first, second in zip(refs, refs[1:]):
            clipped_length = segment_circle_length(projected_nodes[first], projected_nodes[second], radius)
            if clipped_length > 0:
                edges.append((first, second, road["id"], clipped_length, road.get("tags", {})))
    return edges


def physical_road_groups(roads: list[dict], included_way_ids: set[int]) -> int:
    """Estimate corridors as connected same-name/ref/highway groups."""
    node_to_ways: dict[int, list[int]] = defaultdict(list)
    keys: dict[int, tuple[str, str]] = {}
    for road in roads:
        if road["id"] not in included_way_ids:
            continue
        tags = road.get("tags", {})
        if tags.get("name"):
            key = ("name", " ".join(tags["name"].casefold().split()))
        elif tags.get("ref"):
            key = ("ref", " ".join(tags["ref"].casefold().split()))
        else:
            key = ("unnamed_highway", tags.get("highway", "unknown"))
        keys[road["id"]] = key
        for node_id in road.get("nodes", []):
            node_to_ways[node_id].append(road["id"])
    adjacency = {way_id: set() for way_id in keys}
    for way_ids in node_to_ways.values():
        for first in way_ids:
            for second in way_ids:
                if first != second and keys[first] == keys[second]:
                    adjacency[first].add(second)
    return len(connected_components(adjacency))


def tag_coverage(roads: list[dict], way_ids: set[int], fields: list[str]) -> dict:
    selected = [road for road in roads if road["id"] in way_ids]
    result = {}
    for field in fields:
        present = sum(bool(road.get("tags", {}).get(field)) for road in selected)
        total = len(selected)
        result[field] = {
            "denominator_way_count": total,
            "present_way_count": present,
            "missing_way_count": total - present,
            "present_percent": round(100 * present / total, 2) if total else None,
        }
    return result


def area_metrics(
    name: str,
    radius: float,
    roads: list[dict],
    road_records: dict[int, dict],
    projected_nodes: dict[int, tuple[float, float]],
) -> dict:
    way_ids = {road_id for road_id, record in road_records.items() if record[f"{name}_intersects"]}
    selected = [road for road in roads if road["id"] in way_ids]
    motor_ids = {
        road["id"]
        for road in selected
        if road.get("tags", {}).get("highway") not in NON_MOTOR_HIGHWAYS
        and road.get("tags", {}).get("highway") != "construction"
    }
    classification = Counter(road.get("tags", {}).get("highway", "unknown") for road in selected)
    class_lengths: dict[str, float] = defaultdict(float)
    for road in selected:
        highway = road.get("tags", {}).get("highway", "unknown")
        class_lengths[highway] += road_records[road["id"]][f"{name}_length_m"]
    access = {}
    for mode in ("motor_vehicle", "bicycle"):
        classifications = Counter(access_class(road.get("tags", {}), mode)[0] for road in selected)
        access[mode] = {
            "denominator_way_count": len(selected),
            "classification_way_counts": dict(sorted(classifications.items())),
            "note": "Explicit tag classification only; missing/default and conditional access remain unresolved.",
        }
    direction = {
        mode: dict(
            sorted(Counter(road_direction(road.get("tags", {}), mode) for road in selected).items())
        )
        for mode in ("motor_vehicle", "bicycle")
    }
    edges = road_edges(roads, projected_nodes, radius)
    neighbours: dict[int, set[int]] = defaultdict(set)
    incident_ways: dict[int, set[int]] = defaultdict(set)
    for first, second, way_id, _, _ in edges:
        neighbours[first].add(second)
        neighbours[second].add(first)
        incident_ways[first].add(way_id)
        incident_ways[second].add(way_id)
    intersections = {
        node_id
        for node_id, adjacent in neighbours.items()
        if len(adjacent) >= 3 and math.hypot(*projected_nodes[node_id]) <= radius + 1e-7
    }
    return {
        "radius_m": radius,
        "road_way_count": len(selected),
        "motor_road_way_count": len(motor_ids),
        "physical_road_group_count_estimate": physical_road_groups(roads, way_ids),
        "full_length_of_intersecting_ways_m": round(sum(road_records[road_id]["full_length_m"] for road_id in way_ids), 1),
        "clipped_road_length_m": round(sum(road_records[road_id][f"{name}_length_m"] for road_id in way_ids), 1),
        "classification_way_counts": dict(sorted(classification.items())),
        "classification_clipped_length_m": {key: round(value, 1) for key, value in sorted(class_lengths.items())},
        "tag_coverage_all_roads": tag_coverage(selected, way_ids, ["name", "ref", "oneway", "access", "bicycle"]),
        "tag_coverage_motor_roads": tag_coverage(selected, motor_ids, ["name", "lanes", "width", "maxspeed", "oneway"]),
        "structure_way_counts": {
            "bridge": sum(bool(road.get("tags", {}).get("bridge") not in (None, "no")) for road in selected),
            "tunnel": sum(bool(road.get("tags", {}).get("tunnel") not in (None, "no")) for road in selected),
            "nonzero_or_explicit_layer": sum("layer" in road.get("tags", {}) for road in selected),
        },
        "access": access,
        "direction_way_counts": direction,
        "graph": {
            "edge_count": len(edges),
            "node_count": len(neighbours),
            "intersection_node_count": len(intersections),
            "intersection_definition": "Shared OSM node with at least three distinct adjacent graph nodes; geometric line crossings are not connected.",
        },
        "way_ids": sorted(way_ids),
    }


def restriction_records(relations: list[dict], elements_by_key: dict[tuple[str, int], dict], projector: SphericalAEQD, nodes: dict[int, dict]) -> list[dict]:
    records = []
    for relation in sorted(relations, key=lambda item: item["id"]):
        members = relation.get("members", [])
        roles = Counter(member.get("role") for member in members)
        missing = [
            f"{member.get('type')}/{member.get('ref')}"
            for member in members
            if (member.get("type"), member.get("ref")) not in elements_by_key
        ]
        from_members = [member for member in members if member.get("role") == "from"]
        to_members = [member for member in members if member.get("role") == "to"]
        via_members = [member for member in members if member.get("role") == "via"]
        structurally_complete = bool(from_members and to_members and via_members and not missing)
        via_coordinate = None
        if via_members:
            via_element = elements_by_key.get((via_members[0]["type"], via_members[0]["ref"]))
            if via_element:
                via_coordinate = representative_coordinate(via_element, nodes)
        zone = "relation_completion"
        if via_coordinate:
            distance = math.hypot(*projector.forward(via_coordinate))
            zone = "core" if distance <= 1000 else "context" if distance <= 1500 else zone
        records.append(
            {
                "osm_id": relation["id"],
                "restriction": relation.get("tags", {}).get("restriction")
                or next((value for key, value in relation.get("tags", {}).items() if key.startswith("restriction:")), None),
                "zone": zone,
                "member_role_counts": dict(sorted((str(key), value) for key, value in roles.items())),
                "from_way_ids": [member["ref"] for member in from_members],
                "to_way_ids": [member["ref"] for member in to_members],
                "via_members": [{"type": member["type"], "id": member["ref"]} for member in via_members],
                "missing_member_refs": missing,
                "structurally_complete": structurally_complete,
                "tags": dict(sorted(relation.get("tags", {}).items())),
            }
        )
    return records


def classify_feature(tags: dict[str, str], element_type: str) -> tuple[str, str] | None:
    highway = tags.get("highway")
    if highway == "crossing":
        return "crossing", tags.get("crossing", highway)
    if highway == "traffic_signals":
        return "traffic_signal", tags.get("traffic_signals", highway)
    if highway == "mini_roundabout":
        return "mini_roundabout", highway
    if "barrier" in tags:
        return "barrier", tags["barrier"]
    if "entrance" in tags:
        return "entrance", tags["entrance"]
    for key, allowed in POI_TAGS.items():
        if key in tags and (allowed is None or tags[key] in allowed):
            return "poi", f"{key}={tags[key]}"
    if highway in {"bus_stop", "stop", "give_way"}:
        return "poi", f"highway={highway}"
    return None


def geometry_coordinates(geometry: dict | None) -> Iterable[list[float]]:
    if not geometry:
        return
    coordinates = geometry.get("coordinates")
    if geometry.get("type") == "Point":
        yield coordinates
    elif geometry.get("type") == "LineString":
        yield from coordinates
    elif geometry.get("type") == "Polygon":
        for ring in coordinates:
            yield from ring


def feature_collection_bbox(features: list[dict]) -> list[float] | None:
    coordinates = [
        coordinate
        for feature in features
        for coordinate in geometry_coordinates(feature.get("geometry"))
    ]
    if not coordinates:
        return None
    return [
        min(coordinate[0] for coordinate in coordinates),
        min(coordinate[1] for coordinate in coordinates),
        max(coordinate[0] for coordinate in coordinates),
        max(coordinate[1] for coordinate in coordinates),
    ]


def round_number(value: float) -> float:
    return round(value, 3)


def main() -> None:
    manifest, payload, _ = load_source()
    center_lon, center_lat = manifest["study_area"]["center_wgs84"]
    core_radius = manifest["study_area"]["core_radius_m"]
    context_radius = manifest["study_area"]["context_radius_m"]
    projector = SphericalAEQD(center_lon, center_lat, manifest["projection"]["earth_radius_m"])

    elements_by_key = {(element["type"], element["id"]): element for element in payload["elements"]}
    nodes = {element["id"]: element for element in payload["elements"] if element["type"] == "node"}
    projected_nodes = {node_id: projector.forward((node["lon"], node["lat"])) for node_id, node in nodes.items()}
    all_highway_ways = [
        element for element in payload["elements"] if element["type"] == "way" and "highway" in element.get("tags", {})
    ]
    restriction_relations = [
        element
        for element in payload["elements"]
        if element["type"] == "relation" and element.get("tags", {}).get("type") == "restriction"
    ]

    road_records: dict[int, dict] = {}
    road_features = []
    node_way_index: dict[int, set[int]] = defaultdict(set)
    for road in sorted(all_highway_ways, key=lambda item: item["id"]):
        coordinates = element_coordinates(road, nodes)
        if len(coordinates) < 2:
            continue
        projected = [projector.forward(coordinate) for coordinate in coordinates]
        full_length, clipped = line_lengths(projected, (core_radius, context_radius))
        zone = feature_zone(projected, core_radius, context_radius)
        for node_id in road.get("nodes", []):
            node_way_index[node_id].add(road["id"])
        road_records[road["id"]] = {
            "full_length_m": full_length,
            "core_length_m": clipped[core_radius],
            "context_length_m": clipped[context_radius],
            "core_intersects": line_intersects_circle(projected, core_radius),
            "context_intersects": line_intersects_circle(projected, context_radius),
            "zone": zone,
        }
        tags = dict(sorted(road.get("tags", {}).items()))
        properties = {
            "feature_type": "road",
            "osm_type": "way",
            "osm_id": road["id"],
            "tags": tags,
            "highway": tags["highway"],
            "name": tags.get("name"),
            "ref": tags.get("ref"),
            "zone": zone,
            "in_core": zone == "core",
            "in_context": zone in {"core", "context"},
            "length_m": round_number(full_length),
            "core_clipped_length_m": round_number(clipped[core_radius]),
            "context_clipped_length_m": round_number(clipped[context_radius]),
        }
        properties.update({tag: tags.get(tag) for tag in CONVENIENCE_TAGS})
        road_features.append(
            {
                "type": "Feature",
                "id": f"way/{road['id']}",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": properties,
            }
        )

    core_metrics = area_metrics("core", core_radius, all_highway_ways, road_records, projected_nodes)
    context_metrics = area_metrics("context", context_radius, all_highway_ways, road_records, projected_nodes)
    buffer_metrics = {
        "inner_radius_m": core_radius,
        "outer_radius_m": context_radius,
        "road_way_count_touching_ring": sum(
            record["context_intersects"] and (
                not record["core_intersects"]
                or record["context_length_m"] - record["core_length_m"] > 1e-7
            )
            for record in road_records.values()
        ),
        "clipped_road_length_m": round(
            sum(record["context_length_m"] - record["core_length_m"] for record in road_records.values()), 1
        ),
        "note": "Ring length is context-disc clipped length minus core-disc clipped length.",
    }

    restriction_audit = restriction_records(restriction_relations, elements_by_key, projector, nodes)
    map_features = []
    for element in sorted(payload["elements"], key=lambda item: (item["type"], item["id"])):
        if element["type"] not in {"node", "way"}:
            continue
        tags = element.get("tags", {})
        classification = classify_feature(tags, element["type"])
        if classification is None:
            continue
        coordinates = element_coordinates(element, nodes)
        if not coordinates:
            continue
        projected = [projector.forward(coordinate) for coordinate in coordinates]
        zone = feature_zone(projected, core_radius, context_radius)
        feature_type, kind = classification
        geometry = (
            {"type": "Point", "coordinates": coordinates[0]}
            if element["type"] == "node"
            else {"type": "LineString", "coordinates": coordinates}
        )
        linked_way_ids = sorted(node_way_index.get(element["id"], set())) if element["type"] == "node" else []
        map_features.append(
            {
                "type": "Feature",
                "id": f"{element['type']}/{element['id']}",
                "geometry": geometry,
                "properties": {
                    "feature_type": feature_type,
                    "kind": kind,
                    "osm_type": element["type"],
                    "osm_id": element["id"],
                    "tags": dict(sorted(tags.items())),
                    "zone": zone,
                    "in_core": zone == "core",
                    "linked_way_ids": linked_way_ids,
                },
            }
        )
    for record in restriction_audit:
        via = record["via_members"][0] if record["via_members"] else None
        geometry = None
        if via:
            via_element = elements_by_key.get((via["type"], via["id"]))
            if via_element:
                coordinates = element_coordinates(via_element, nodes)
                if coordinates:
                    geometry = (
                        {"type": "Point", "coordinates": coordinates[0]}
                        if via_element["type"] == "node"
                        else {"type": "LineString", "coordinates": coordinates}
                    )
        map_features.append(
            {
                "type": "Feature",
                "id": f"relation/{record['osm_id']}",
                "geometry": geometry,
                "properties": {
                    "feature_type": "restriction",
                    "kind": record["restriction"],
                    "osm_type": "relation",
                    "osm_id": record["osm_id"],
                    "tags": record["tags"],
                    "zone": record["zone"],
                    "in_core": record["zone"] == "core",
                    "linked_way_ids": sorted(set(record["from_way_ids"] + record["to_way_ids"])),
                    "restriction": record["restriction"],
                    "from_way_id": record["from_way_ids"][0] if record["from_way_ids"] else None,
                    "to_way_id": record["to_way_ids"][0] if record["to_way_ids"] else None,
                    "via_osm_type": via["type"] if via else None,
                    "via_osm_id": via["id"] if via else None,
                    "structurally_complete": record["structurally_complete"],
                },
            }
        )

    context_edges = road_edges(all_highway_ways, projected_nodes, context_radius)
    undirected: dict[int, set[int]] = defaultdict(set)
    directed_by_mode = {mode: defaultdict(set) for mode in ("motor_vehicle", "bicycle")}
    explicit_allowed_by_mode = {mode: defaultdict(set) for mode in ("motor_vehicle", "bicycle")}
    bicycle_weighted: dict[int, dict[int, float]] = defaultdict(dict)
    for first, second, _, edge_length, tags in context_edges:
        undirected[first].add(second)
        undirected[second].add(first)
        for mode in directed_by_mode:
            for source, target in directed_pairs(first, second, tags, mode):
                directed_by_mode[mode][source].add(target)
                directed_by_mode[mode].setdefault(target, set())
                if mode == "bicycle":
                    bicycle_weighted[source][target] = min(
                        edge_length,
                        bicycle_weighted[source].get(target, math.inf),
                    )
                    bicycle_weighted.setdefault(target, {})
                if qualifies_for_explicit_allowed_graph(tags, mode):
                    explicit_allowed_by_mode[mode][source].add(target)
                    explicit_allowed_by_mode[mode].setdefault(target, set())
    components = connected_components(undirected)
    anchor_node = min(
        undirected,
        key=lambda node_id: math.hypot(*projected_nodes[node_id]),
        default=None,
    )
    topology = {
        "context_undirected_components": len(components),
        "largest_component_node_count": len(components[0]) if components else 0,
        "context_graph_node_count": len(undirected),
        "anchor_network_node_id": anchor_node,
        "anchor_network_node_distance_m": round(math.hypot(*projected_nodes[anchor_node]), 1) if anchor_node else None,
        "directed_structural_reachability": {
            mode: {
                "reachable_node_count": len(reachable(adjacency, anchor_node)),
                "graph_node_count": len(adjacency),
                "assumption": "Honours mapped oneway direction (including -1 and bicycle overrides) but does not apply access restrictions or turn relations.",
            }
            for mode, adjacency in directed_by_mode.items()
        },
        "explicit_allowed_lower_bound": {
            mode: {
                "reachable_node_count": len(reachable(adjacency, anchor_node)),
                "graph_node_count": len(adjacency),
                "assumption": "Includes only ways with an explicit allowed tag for the mode; unresolved missing/default and conditional access are excluded.",
            }
            for mode, adjacency in explicit_allowed_by_mode.items()
        },
        "legal_routing_status": "Not validated: no turn restrictions are applied and mapped tags do not confirm current legal or physical access.",
    }

    bicycle_forward = reachable(directed_by_mode["bicycle"], anchor_node)
    bicycle_reverse: dict[int, set[int]] = defaultdict(set)
    for source, targets in directed_by_mode["bicycle"].items():
        bicycle_reverse.setdefault(source, set())
        for target in targets:
            bicycle_reverse[target].add(source)
    bicycle_return = reachable(bicycle_reverse, anchor_node)
    drivable_segments = [
        (first, second, way_id, tags)
        for first, second, way_id, _, tags in context_edges
        if tags.get("highway") not in NON_MOTOR_HIGHWAYS
        and tags.get("highway") != "construction"
        and access_class(tags, "bicycle")[0] not in {"prohibited", "restricted"}
    ]
    eligible_candidates = []
    for element in payload["elements"]:
        if element["type"] not in {"node", "way"}:
            continue
        tags = element.get("tags", {})
        source_access, source_access_tag = access_class(tags, "bicycle")
        if source_access in {"prohibited", "restricted"}:
            continue
        coordinate = representative_coordinate(element, nodes)
        if coordinate is None:
            continue
        point = projector.forward(coordinate)
        if math.hypot(*point) > core_radius:
            continue
        category = None
        priority = 99
        if tags.get("entrance") and tags.get("entrance") != "no":
            category, priority = f"entrance={tags['entrance']}", 0
        elif tags.get("amenity") in {"parking", "fuel", "charging_station", "post_office", "marketplace"}:
            category, priority = f"amenity={tags['amenity']}", 1
        elif tags.get("shop") in POI_TAGS["shop"]:
            category, priority = f"shop={tags['shop']}", 2
        elif tags.get("tourism") in {"hotel", "attraction"}:
            category, priority = f"tourism={tags['tourism']}", 3
        if category is None:
            continue
        nearest = None
        for first, second, way_id, road_tags in drivable_segments:
            for network_node_id in (first, second):
                if network_node_id not in bicycle_forward or network_node_id not in bicycle_return:
                    continue
                if math.hypot(*projected_nodes[network_node_id]) > core_radius:
                    continue
                network_node = nodes[network_node_id]
                node_access = access_class(network_node.get("tags", {}), "bicycle")
                if node_access[0] in {"prohibited", "restricted"}:
                    continue
                endpoint_distance = math.dist(point, projected_nodes[network_node_id])
                segment_distance = point_segment_distance(point, projected_nodes[first], projected_nodes[second])
                comparison = (endpoint_distance, segment_distance, way_id, network_node_id)
                if nearest is None or comparison < nearest[0]:
                    nearest = (
                        comparison,
                        way_id,
                        network_node_id,
                        road_tags,
                        segment_distance,
                        node_access,
                    )
        if nearest is None or nearest[0][0] > 100:
            continue
        evidence = [category]
        for key in ("name", "entrance", "amenity", "shop", "tourism", "access"):
            if key in tags and f"{key}={tags[key]}" not in evidence:
                evidence.append(f"{key}={tags[key]}")
        eligible_candidates.append(
            {
                "sort": (priority, round(nearest[0][0], 6), element["type"], element["id"]),
                "element": element,
                "source_coordinate": [round(coordinate[0], 7), round(coordinate[1], 7)],
                "network_coordinate": [
                    round(nodes[nearest[2]]["lon"], 7),
                    round(nodes[nearest[2]]["lat"], 7),
                ],
                "category": category,
                "distance": nearest[0][0],
                "segment_distance": nearest[4],
                "nearest_way_id": nearest[1],
                "network_node_id": nearest[2],
                "network_access": access_class(nearest[3], "bicycle"),
                "network_node_access": nearest[5],
                "source_access": (source_access, source_access_tag),
                "evidence": evidence,
            }
        )
    eligible_candidates.sort(key=lambda item: item["sort"])
    chosen = []
    for candidate in eligible_candidates:
        candidate_point = projector.forward(candidate["source_coordinate"])
        if all(
            math.dist(candidate_point, projector.forward(existing["source_coordinate"])) >= 100
            for existing in chosen
        ):
            chosen.append(candidate)
        if len(chosen) == 15:
            break
    if len(chosen) < 10:
        for candidate in eligible_candidates:
            if candidate not in chosen:
                chosen.append(candidate)
            if len(chosen) == 10:
                break
    candidate_features = []
    for index, candidate in enumerate(chosen, start=1):
        element = candidate["element"]
        source_tags = dict(sorted(element.get("tags", {}).items()))
        network_tags = dict(sorted(nodes[candidate["network_node_id"]].get("tags", {}).items()))
        candidate_features.append(
            {
                "type": "Feature",
                "id": f"stop-{index:02d}",
                "geometry": {"type": "Point", "coordinates": candidate["network_coordinate"]},
                "properties": {
                    "candidate_id": f"stop-{index:02d}",
                    "osm_type": "node",
                    "osm_id": candidate["network_node_id"],
                    "name": source_tags.get("name"),
                    "source_name": source_tags.get("name"),
                    "category": candidate["category"],
                    "tags": network_tags,
                    "in_core": True,
                    "linked_way_ids": sorted(node_way_index.get(candidate["network_node_id"], set())),
                    "nearest_way_id": candidate["nearest_way_id"],
                    "distance_to_network_m": round(candidate["distance"], 1),
                    "source_osm_type": element["type"],
                    "source_osm_id": element["id"],
                    "source_tags": source_tags,
                    "source_coordinate_wgs84": candidate["source_coordinate"],
                    "source_to_road_segment_distance_m": round(candidate["segment_distance"], 1),
                    "network_endpoint_osm_node_id": candidate["network_node_id"],
                    "network_endpoint_wgs84": candidate["network_coordinate"],
                    "network_access_bicycle_class": candidate["network_access"][0],
                    "network_access_bicycle_source_tag": candidate["network_access"][1],
                    "network_node_access_bicycle_class": candidate["network_node_access"][0],
                    "network_node_access_bicycle_source_tag": candidate["network_node_access"][1],
                    "source_access_bicycle_class": candidate["source_access"][0],
                    "source_access_bicycle_source_tag": candidate["source_access"][1],
                    "structurally_reachable_from_anchor": True,
                    "structurally_can_return_to_anchor": True,
                    "rationale": f"Mapped {candidate['category']} source linked to reachable OSM network node {candidate['network_node_id']} ({candidate['distance']:.1f} m straight-line endpoint link).",
                    "evidence": candidate["evidence"],
                    "coordinate_basis": "Feature geometry is an existing OSM highway node; source_coordinate_wgs84 is the mapped source node or mean coordinate of its way nodes.",
                    "caveats": "Map-based screening only; stopping legality, curb access, operating hours, and physical safety were not field-verified.",
                },
            }
        )

    initial_route = {
        "status": "unavailable",
        "reason": "No structurally connected candidate sequence could be constructed.",
    }
    if anchor_node is not None and candidate_features:
        candidate_nodes = {}
        seen_route_nodes = {anchor_node}
        for feature in candidate_features:
            node_id = feature["properties"]["network_endpoint_osm_node_id"]
            if node_id not in seen_route_nodes:
                candidate_nodes[feature["properties"]["candidate_id"]] = node_id
                seen_route_nodes.add(node_id)
        remaining = dict(candidate_nodes)
        current_node = anchor_node
        sequence = []
        legs = []
        for _ in range(min(4, len(remaining))):
            distances = shortest_distances(bicycle_weighted, current_node)
            choices = [
                (distances[node_id], candidate_id, node_id)
                for candidate_id, node_id in remaining.items()
                if node_id in distances
            ]
            if not choices:
                break
            distance, candidate_id, node_id = min(choices)
            legs.append(
                {
                    "from": "anchor" if not sequence else sequence[-1],
                    "to": candidate_id,
                    "network_length_m": round(distance, 1),
                }
            )
            sequence.append(candidate_id)
            del remaining[candidate_id]
            current_node = node_id
        return_distance = shortest_distances(bicycle_weighted, current_node).get(anchor_node)
        if sequence and return_distance is not None:
            legs.append({"from": sequence[-1], "to": "anchor", "network_length_m": round(return_distance, 1)})
            initial_route = {
                "status": "illustrative_structural_screening_only",
                "mode": "bicycle",
                "start_and_end_osm_node_id": anchor_node,
                "candidate_sequence": sequence,
                "legs": legs,
                "total_network_length_m": round(sum(leg["network_length_m"] for leg in legs), 1),
                "assumptions": "Shortest paths on mapped highway centerlines, honoring supported bicycle direction tags. Missing/default access is unresolved; conditional direction is structurally bidirectional; turn restrictions, curb legality, surface, safety, and field conditions are not applied or validated.",
            }

    gap_records = []
    gap_index = 0
    for road in sorted(all_highway_ways, key=lambda item: item["id"]):
        record = road_records.get(road["id"])
        if not record or not record["context_intersects"]:
            continue
        tags = road.get("tags", {})
        scope = "core" if record["core_intersects"] else "context_buffer"
        fields = ["name", "oneway", "access", "bicycle"]
        if tags.get("highway") not in NON_MOTOR_HIGHWAYS and tags.get("highway") != "construction":
            fields.extend(["lanes", "width", "maxspeed"])
        for field in fields:
            if field in tags:
                continue
            gap_index += 1
            gap_records.append(
                {
                    "gap_id": f"gap-{gap_index:05d}",
                    "scope": scope,
                    "category": "missing_osm_tag",
                    "subject_type": "way",
                    "osm_id": road["id"],
                    "highway": tags.get("highway"),
                    "name": tags.get("name"),
                    "field": field,
                    "severity": "information_gap",
                    "detail": f"OSM way has no {field} tag; absence is not evidence of a real-world value or condition.",
                }
            )
    for restriction in restriction_audit:
        if restriction["structurally_complete"]:
            continue
        gap_index += 1
        gap_records.append(
            {
                "gap_id": f"gap-{gap_index:05d}",
                "scope": restriction["zone"],
                "category": "restriction_structure",
                "subject_type": "relation",
                "osm_id": restriction["osm_id"],
                "highway": None,
                "name": None,
                "field": "members",
                "severity": "topology_gap",
                "detail": "Restriction relation lacks a required from/to/via role or a referenced member in the snapshot.",
            }
        )

    metadata = {
        "schema_version": 1,
        "source_manifest": str(MANIFEST_PATH.relative_to(ROOT)),
        "source_snapshot_sha256": manifest["snapshot_sha256_compressed"],
        "generated_from_osm_base_timestamp": manifest["osm_base_timestamp"],
        "center_wgs84": [center_lon, center_lat],
        "core_radius_m": core_radius,
        "routing_buffer_m": manifest["study_area"]["routing_buffer_m"],
        "context_radius_m": context_radius,
        "acquisition_bbox_wgs84": manifest["study_area"]["acquisition_bbox_wgs84"],
        "projection": manifest["projection"],
    }
    road_collection = {"type": "FeatureCollection", "bbox": feature_collection_bbox(road_features), "metadata": metadata, "features": road_features}
    feature_collection = {"type": "FeatureCollection", "bbox": feature_collection_bbox(map_features), "metadata": metadata, "features": map_features}
    candidate_collection = {
        "type": "FeatureCollection",
        "bbox": feature_collection_bbox(candidate_features),
        "metadata": {
            **metadata,
            "screening_status": "Desktop OSM evidence with graph-endpoint and structural out-and-back screening; no field, safety, curb, permission, or legal validation.",
            "maximum_network_endpoint_link_distance_m": 100,
            "minimum_preferred_source_spacing_m": 100,
            "selection_limit": 15,
        },
        "features": candidate_features,
    }
    area_features = []
    for role, radius in (("context", context_radius), ("core", core_radius)):
        ring = [projector.inverse((radius * math.cos(2 * math.pi * index / 128), radius * math.sin(2 * math.pi * index / 128))) for index in range(129)]
        area_features.append(
            {
                "type": "Feature",
                "id": role,
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": {
                    "role": role,
                    "shape": "circle",
                    "bbox_wgs84": [
                        min(coordinate[0] for coordinate in ring),
                        min(coordinate[1] for coordinate in ring),
                        max(coordinate[0] for coordinate in ring),
                        max(coordinate[1] for coordinate in ring),
                    ],
                    "center_wgs84": [center_lon, center_lat],
                    "radius_m": radius,
                    "buffer_m": manifest["study_area"]["routing_buffer_m"] if role == "context" else 0,
                    "polygon_vertex_count": 128,
                },
            }
        )
    area_collection = {"type": "FeatureCollection", "bbox": feature_collection_bbox(area_features), "metadata": metadata, "features": area_features}

    mapped_counts = Counter(feature["properties"]["feature_type"] for feature in map_features if feature["properties"]["zone"] == "core")
    mapped_counts_by_osm_type: dict[str, Counter] = defaultdict(Counter)
    for feature in map_features:
        if feature["properties"]["zone"] == "core":
            mapped_counts_by_osm_type[feature["properties"]["feature_type"]][feature["properties"]["osm_type"]] += 1
    restriction_counts = Counter(record["zone"] for record in restriction_audit)
    summary = {
        "schema_version": 1,
        "metadata": metadata,
        "definitions": {
            "core": "Circle of 1,000 m radius around the verified OSM Lotus Tower way center.",
            "context": "Circle of 1,500 m radius around the same center; includes the core.",
            "routing_buffer": "The 500 m annulus between the core and context boundaries.",
            "road_way": "Distinct OSM way carrying a highway tag and intersecting the stated circular area.",
            "physical_road_group_estimate": "Connected components of ways sharing a normalized name, ref, or (when unnamed) highway class; a heuristic, not a surveyed road count.",
            "intersection": "Shared OSM node with at least three distinct adjacent graph nodes. Geometric crossings without a shared node are not joined.",
            "mapped_zero": "A zero count means no matching feature is mapped in this snapshot; it does not confirm real-world absence.",
        },
        "areas": {"core": core_metrics, "context": context_metrics, "routing_buffer": buffer_metrics},
        "mapped_core_feature_counts": dict(sorted(mapped_counts.items())),
        "mapped_core_feature_counts_by_osm_type": {
            feature_type: dict(sorted(counts.items()))
            for feature_type, counts in sorted(mapped_counts_by_osm_type.items())
        },
        "roundabouts": {
            "core_roundabout_way_count": sum(
                road_records[road["id"]]["core_length_m"] > 0 and road.get("tags", {}).get("junction") == "roundabout"
                for road in all_highway_ways if road["id"] in road_records
            ),
            "core_mini_roundabout_node_count": sum(
                feature["properties"]["feature_type"] == "mini_roundabout" and feature["properties"]["zone"] == "core"
                for feature in map_features
            ),
        },
        "restrictions": {
            "relation_count": len(restriction_audit),
            "zone_counts": dict(sorted(restriction_counts.items())),
            "structurally_complete_count": sum(record["structurally_complete"] for record in restriction_audit),
            "applied_to_routing": False,
            "completeness_definition": "At least one from, to, and via member and every member reference present in the snapshot.",
            "relations": restriction_audit,
        },
        "topology": topology,
        "candidate_stops": {
            "count": len(candidate_features),
            "eligible_before_limit": len(eligible_candidates),
            "screening": "Each source is linked to an existing OSM highway node within 100 m, excludes explicitly restricted/prohibited bicycle source and linked-way access, and must be structurally reachable from and able to return to the Lotus Tower anchor while honoring mapped bicycle direction. Missing/default access remains unresolved; turn restrictions are not applied.",
            "status": "Candidates only; no stopping legality, access permission, curb condition, operating hours, or safety was manually or field validated.",
        },
        "initial_route": initial_route,
        "gaps": {
            "record_count": len(gap_records),
            "json_file": str(GAPS_JSON_PATH.relative_to(ROOT)),
            "csv_file": str(GAPS_CSV_PATH.relative_to(ROOT)),
        },
    }

    outputs = {
        ROAD_PATH: stable_json(road_collection),
        FEATURE_PATH: stable_json(feature_collection),
        CANDIDATE_PATH: stable_json(candidate_collection),
        AREA_PATH: stable_json(area_collection),
        SUMMARY_PATH: stable_json(summary),
        GAPS_JSON_PATH: stable_json({"schema_version": 1, "metadata": metadata, "gaps": gap_records}),
    }
    csv_buffer = io.StringIO(newline="")
    columns = ["gap_id", "scope", "category", "subject_type", "osm_id", "highway", "name", "field", "severity", "detail"]
    writer = csv.DictWriter(csv_buffer, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    writer.writerows(gap_records)
    outputs[GAPS_CSV_PATH] = csv_buffer.getvalue().encode("utf-8")
    for path, value in outputs.items():
        atomic_write(path, value)

    print(f"Audited {len(road_features)} highway ways; {core_metrics['road_way_count']} intersect the core")
    print(f"Wrote {len(candidate_features)} candidate stops and {len(gap_records)} gap records")
    for path in outputs:
        print(f"{path.relative_to(ROOT)} {sha256_bytes(outputs[path])}")


if __name__ == "__main__":
    main()
