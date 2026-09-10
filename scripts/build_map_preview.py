#!/usr/bin/env python3
"""Build offline HTML and SVG previews of the Lotus Tower OSM audit.

The builder uses only Python's standard library. It consumes the reviewed
GeoJSON outputs produced by the Stage 1 audit and embeds a deterministic copy
of that data in the HTML; no live map tiles or network requests are involved.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data"
DEFAULT_OUTPUT = ROOT / "docs" / "maps"
EARTH_RADIUS_M = 6_371_008.8

ROAD_STYLES = {
    "motorway": ("#d9563f", 9.0),
    "trunk": ("#e66b45", 8.0),
    "primary": ("#ed8c4a", 7.0),
    "secondary": ("#e9ad50", 6.0),
    "tertiary": ("#d8bd67", 5.0),
    "residential": ("#6e9ca4", 3.5),
    "unclassified": ("#7e99a1", 3.2),
    "service": ("#8b9298", 2.5),
    "living_street": ("#7a9f8d", 3.0),
    "cycleway": ("#2f9f78", 2.8),
    "path": ("#669773", 2.1),
    "footway": ("#769987", 1.8),
    "pedestrian": ("#82978c", 2.5),
    "steps": ("#858585", 1.8),
    "default": ("#78858e", 2.6),
}

FEATURE_GLYPHS = {
    "traffic_signal": ("#e64f4f", "S"),
    "crossing": ("#36a8d4", "X"),
    "mini_roundabout": ("#a877e5", "R"),
    "barrier": ("#dd7c42", "B"),
    "entrance": ("#5ca56f", "E"),
    "poi": ("#c987bd", "P"),
    "restriction": ("#f0c75e", "!"),
}

LABELLED_ROAD_CLASSES = {
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
}


class BuildError(RuntimeError):
    """An actionable input or rendering error."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir", type=Path, default=DEFAULT_INPUT, help="Audit data directory"
    )
    parser.add_argument(
        "--output-dir", type=Path, default=DEFAULT_OUTPUT, help="Preview output directory"
    )
    return parser.parse_args()


def read_json(path: Path, *, required: bool = True) -> dict[str, Any]:
    if not path.exists():
        if required:
            raise BuildError(f"Required input is missing: {path}")
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BuildError(f"Could not read valid JSON from {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise BuildError(f"Expected a JSON object in {path}")
    return value


def read_feature_collection(path: Path) -> dict[str, Any]:
    value = read_json(path)
    if value.get("type") != "FeatureCollection" or not isinstance(
        value.get("features"), list
    ):
        raise BuildError(f"Expected a GeoJSON FeatureCollection in {path}")
    for index, feature in enumerate(value["features"]):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise BuildError(f"Invalid GeoJSON feature {index} in {path}")
        if not isinstance(feature.get("properties", {}), dict):
            raise BuildError(f"Feature {index} has invalid properties in {path}")
    return value


def iter_positions(geometry: dict[str, Any] | None) -> Iterable[tuple[float, float]]:
    if not geometry:
        return
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if kind == "Point" and valid_position(coordinates):
        yield float(coordinates[0]), float(coordinates[1])
    elif kind in {"LineString", "MultiPoint"} and isinstance(coordinates, list):
        for position in coordinates:
            if valid_position(position):
                yield float(position[0]), float(position[1])
    elif kind in {"Polygon", "MultiLineString"} and isinstance(coordinates, list):
        for part in coordinates:
            if isinstance(part, list):
                for position in part:
                    if valid_position(position):
                        yield float(position[0]), float(position[1])
    elif kind == "MultiPolygon" and isinstance(coordinates, list):
        for polygon in coordinates:
            if isinstance(polygon, list):
                for ring in polygon:
                    if isinstance(ring, list):
                        for position in ring:
                            if valid_position(position):
                                yield float(position[0]), float(position[1])


def valid_position(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
        and math.isfinite(value[0])
        and math.isfinite(value[1])
    )


def get_center(
    study: dict[str, Any],
    collections: Iterable[dict[str, Any]],
    manifest: dict[str, Any],
) -> tuple[float, float]:
    projection_origin = manifest.get("projection", {}).get("origin_wgs84")
    if valid_position(projection_origin):
        return float(projection_origin[0]), float(projection_origin[1])
    for feature in study["features"]:
        properties = feature.get("properties", {})
        if properties.get("role") == "core" and valid_position(properties.get("center_wgs84")):
            center = properties["center_wgs84"]
            return float(center[0]), float(center[1])
    positions = [
        position
        for collection in collections
        for feature in collection.get("features", [])
        for position in iter_positions(feature.get("geometry"))
    ]
    if not positions:
        raise BuildError("The input layers contain no valid WGS84 coordinates")
    west = min(position[0] for position in positions)
    east = max(position[0] for position in positions)
    south = min(position[1] for position in positions)
    north = max(position[1] for position in positions)
    return (west + east) / 2, (south + north) / 2


def project(lon: float, lat: float, center: tuple[float, float]) -> tuple[float, float]:
    center_lon, center_lat = center
    longitude = math.radians(lon)
    latitude = math.radians(lat)
    origin_longitude = math.radians(center_lon)
    origin_latitude = math.radians(center_lat)
    delta_longitude = longitude - origin_longitude
    cos_c = (
        math.sin(origin_latitude) * math.sin(latitude)
        + math.cos(origin_latitude) * math.cos(latitude) * math.cos(delta_longitude)
    )
    central_angle = math.acos(max(-1.0, min(1.0, cos_c)))
    scale = central_angle / math.sin(central_angle) if central_angle else 1.0
    x = EARTH_RADIUS_M * scale * math.cos(latitude) * math.sin(delta_longitude)
    northing = EARTH_RADIUS_M * scale * (
        math.cos(origin_latitude) * math.sin(latitude)
        - math.sin(origin_latitude) * math.cos(latitude) * math.cos(delta_longitude)
    )
    return x, -northing


def geometry_points(
    geometry: dict[str, Any] | None, center: tuple[float, float]
) -> list[list[tuple[float, float]]]:
    if not geometry:
        return []
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if kind == "Point" and valid_position(coordinates):
        return [[project(float(coordinates[0]), float(coordinates[1]), center)]]
    if kind in {"LineString", "MultiPoint"} and isinstance(coordinates, list):
        return [[project(float(p[0]), float(p[1]), center) for p in coordinates if valid_position(p)]]
    if kind in {"Polygon", "MultiLineString"} and isinstance(coordinates, list):
        return [
            [project(float(p[0]), float(p[1]), center) for p in part if valid_position(p)]
            for part in coordinates
            if isinstance(part, list)
        ]
    if kind == "MultiPolygon" and isinstance(coordinates, list):
        return [
            [project(float(p[0]), float(p[1]), center) for p in ring if valid_position(p)]
            for polygon in coordinates
            if isinstance(polygon, list)
            for ring in polygon
            if isinstance(ring, list)
        ]
    return []


def path_data(points: list[tuple[float, float]], *, close: bool = False) -> str:
    if not points:
        return ""
    commands = [f"M {points[0][0]:.2f} {points[0][1]:.2f}"]
    commands.extend(f"L {x:.2f} {y:.2f}" for x, y in points[1:])
    if close:
        commands.append("Z")
    return " ".join(commands)


def road_style(highway: Any) -> tuple[str, float]:
    return ROAD_STYLES.get(str(highway), ROAD_STYLES["default"])


def feature_key(feature: dict[str, Any]) -> str:
    props = feature.get("properties", {})
    return f"{props.get('osm_type', 'feature')}/{props.get('osm_id', 'unknown')}"


def escape_json_for_script(value: Any) -> str:
    # Escaping these characters prevents arbitrary OSM strings ending the script tag.
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def clean_source_label(manifest: dict[str, Any]) -> str:
    for key in (
        "osm_base_timestamp",
        "fetched_at_utc",
        "snapshot_id",
        "snapshot_date",
        "generated_at",
        "downloaded_at",
    ):
        value = manifest.get(key)
        if value not in (None, ""):
            return str(value)
    return "stored Stage 1 snapshot"


def bounds_for(collections: Iterable[dict[str, Any]], center: tuple[float, float]) -> tuple[float, float, float, float]:
    points = [
        project(lon, lat, center)
        for collection in collections
        for feature in collection.get("features", [])
        for lon, lat in iter_positions(feature.get("geometry"))
    ]
    if not points:
        raise BuildError("Cannot determine preview bounds from empty layers")
    min_x = min(point[0] for point in points)
    max_x = max(point[0] for point in points)
    min_y = min(point[1] for point in points)
    max_y = max(point[1] for point in points)
    padding = max(max_x - min_x, max_y - min_y) * 0.04 or 10.0
    return min_x - padding, min_y - padding, max_x + padding, max_y + padding


def render_static_svg(bundle: dict[str, Any], center: tuple[float, float]) -> str:
    study, roads, features, stops = (
        bundle["study"], bundle["roads"], bundle["features"], bundle["stops"]
    )
    min_x, min_y, max_x, max_y = bounds_for((study,), center)
    map_width, map_height = 1160.0, 710.0
    source_width, source_height = max_x - min_x, max_y - min_y
    scale = min(map_width / source_width, map_height / source_height)
    tx = 20 + (map_width - source_width * scale) / 2 - min_x * scale
    ty = 86 + (map_height - source_height * scale) / 2 - min_y * scale

    def screen(point: tuple[float, float]) -> tuple[float, float]:
        return point[0] * scale + tx, point[1] * scale + ty

    items: list[str] = []
    for feature in study["features"]:
        role = feature.get("properties", {}).get("role", "context")
        for ring in geometry_points(feature.get("geometry"), center):
            d = path_data([screen(p) for p in ring], close=True)
            items.append(
                f'<path d="{d}" class="boundary {html.escape(str(role))}"/>'
            )

    for road in sorted(roads["features"], key=lambda item: (str(item.get("properties", {}).get("highway", "")), feature_key(item))):
        props = road.get("properties", {})
        color, width = road_style(
            props.get("highway") or props.get("tags", {}).get("highway")
        )
        bridge = str(props.get("bridge") or props.get("tags", {}).get("bridge") or "") not in {"", "no"}
        for line in geometry_points(road.get("geometry"), center):
            d = path_data([screen(p) for p in line])
            zone = props.get("zone")
            scope_class = (
                " context"
                if zone == "context"
                else " relation-completion"
                if zone == "relation_completion"
                else ""
            )
            bridge_class = " bridge" if bridge else ""
            items.append(
                f'<path d="{d}" class="road{scope_class}{bridge_class}" stroke="{color}" stroke-width="{max(0.8, width * .72):.2f}"/>'
            )

    labelled: set[str] = set()
    label_boxes: list[tuple[float, float, float, float]] = []
    class_priority = {
        "trunk": 0,
        "primary": 1,
        "secondary": 2,
        "tertiary": 3,
        "trunk_link": 4,
        "primary_link": 5,
        "secondary_link": 6,
        "tertiary_link": 7,
    }
    label_roads = sorted(
        roads["features"],
        key=lambda road: (
            road.get("properties", {}).get("zone") != "core",
            class_priority.get(
                road.get("properties", {}).get("highway")
                or road.get("properties", {}).get("tags", {}).get("highway"),
                99,
            ),
            feature_key(road),
        ),
    )
    for road in label_roads:
        props = road.get("properties", {})
        name = props.get("name") or props.get("tags", {}).get("name")
        highway = props.get("highway") or props.get("tags", {}).get("highway")
        lines = geometry_points(road.get("geometry"), center)
        if (
            not name
            or name in labelled
            or highway not in LABELLED_ROAD_CLASSES
            or props.get("zone") == "relation_completion"
            or not lines
            or not lines[0]
        ):
            continue
        labelled.add(str(name))
        label_point = min(lines[0], key=lambda point: point[0] ** 2 + point[1] ** 2)
        x, y = screen(label_point)
        box = (x, y - 14, x + min(180, len(str(name)) * 6.4), y + 2)
        if any(
            box[0] < other[2] + 5
            and box[2] + 5 > other[0]
            and box[1] < other[3] + 3
            and box[3] + 3 > other[1]
            for other in label_boxes
        ):
            continue
        label_boxes.append(box)
        items.append(f'<text x="{x:.2f}" y="{y - 4:.2f}" class="road-label">{html.escape(str(name))}</text>')
        if len(label_boxes) >= 16:
            break

    for feature in features["features"]:
        props = feature.get("properties", {})
        feature_type = str(props.get("feature_type", "poi"))
        if feature_type not in {"traffic_signal", "mini_roundabout"} or not (
            props.get("in_core") is True or props.get("zone") == "core"
        ):
            continue
        color, glyph = FEATURE_GLYPHS.get(feature_type, ("#c987bd", "•"))
        points = list(iter_positions(feature.get("geometry")))
        if not points:
            continue
        x, y = screen(project(*points[len(points) // 2], center))
        items.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5" fill="{color}" class="map-symbol"/><text x="{x:.2f}" y="{y + 2.8:.2f}" class="symbol-text">{html.escape(glyph)}</text>')

    for index, stop in enumerate(stops["features"], 1):
        points = list(iter_positions(stop.get("geometry")))
        if not points:
            continue
        props = stop.get("properties", {})
        label = str(props.get("candidate_id") or index).removeprefix("stop-")
        x, y = screen(project(*points[0], center))
        items.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="8" class="candidate"/><text x="{x:.2f}" y="{y + 3:.2f}" class="candidate-text">{html.escape(label)}</text>')

    cx, cy = screen((0.0, 0.0))
    items.append(f'<path d="M {cx:.2f} {cy-11:.2f} L {cx+8:.2f} {cy+8:.2f} L {cx-8:.2f} {cy+8:.2f} Z" class="lotus"/><circle cx="{cx:.2f}" cy="{cy:.2f}" r="14" class="lotus-ring"/><text x="{cx + 18:.2f}" y="{cy - 8:.2f}" class="lotus-label">Lotus Tower centre</text>')

    metres_per_px = 1 / scale
    scale_candidates = [25, 50, 100, 200, 250, 500, 1000]
    scale_m = min(scale_candidates, key=lambda value: abs(value / metres_per_px - 110))
    scale_px = scale_m / metres_per_px
    counts = count_layers(bundle)
    source_label = html.escape(clean_source_label(bundle["manifest"]))
    class_names = sorted(
        {
            str(
                road.get("properties", {}).get("highway")
                or road.get("properties", {}).get("tags", {}).get("highway")
                or "default"
            )
            for road in roads["features"]
        }
    )
    legend_entries: list[str] = []
    for index, class_name in enumerate(class_names):
        column, row = divmod(index, 8)
        x = 24 + column * 132
        y = 102 + row * 17
        color, _ = road_style(class_name)
        legend_entries.append(
            f'<line x1="{x}" y1="{y}" x2="{x + 18}" y2="{y}" stroke="{color}" stroke-width="4"/>'
            f'<text x="{x + 24}" y="{y + 3.5}" class="legend">{html.escape(class_name)}</text>'
        )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="title description">
  <title id="title">Lotus Tower Stage 1 road-data audit preview</title>
  <desc id="description">Static overview of audited OpenStreetMap roads, mapped features and candidate delivery stops. This is not gameplay.</desc>
  <style>
    .background{{fill:#0e171c}} .frame{{fill:#15242b;stroke:#37505b;stroke-width:1}}
    .boundary{{fill:none;vector-effect:non-scaling-stroke}} .boundary.context{{stroke:#55717a;stroke-width:1;stroke-dasharray:6 5}} .boundary.core{{fill:#1c3035;fill-opacity:.45;stroke:#e7c568;stroke-width:2}}
    .road{{fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.88}} .road.context{{opacity:.48}} .road.relation-completion{{opacity:.22}} .road.bridge{{stroke-dasharray:12 3}}
    .road-label{{font:10px system-ui,sans-serif;fill:#dbe5e7;paint-order:stroke;stroke:#15242b;stroke-width:3;stroke-linejoin:round}}
    .map-symbol{{stroke:#071014;stroke-width:1.5}} .symbol-text,.candidate-text{{font:700 8px system-ui,sans-serif;fill:#071014;text-anchor:middle}}
    .candidate{{fill:#f5d76b;stroke:#171d20;stroke-width:2}} .lotus{{fill:#ffdf78}} .lotus-ring{{fill:none;stroke:#ffdf78;stroke-width:2}} .lotus-label{{font:700 12px system-ui,sans-serif;fill:#ffdf78;paint-order:stroke;stroke:#15242b;stroke-width:3}}
    .title{{font:700 25px system-ui,sans-serif;fill:#f4f7f8}} .subtitle{{font:13px system-ui,sans-serif;fill:#aebfc5}} .meta{{font:12px system-ui,sans-serif;fill:#c5d0d4}} .small{{font:10px system-ui,sans-serif;fill:#91a5ac}} .legend{{font:11px system-ui,sans-serif;fill:#d9e2e5}}
  </style>
  <rect width="1200" height="900" class="background"/>
  <text x="22" y="34" class="title">Lotus Tower road-data audit</text>
  <text x="22" y="56" class="subtitle">Stage 1 offline preview · source snapshot {source_label} · not a playable map</text>
  <rect x="20" y="76" width="1160" height="720" rx="8" class="frame"/>
  {''.join(items)}
  <g><rect x="16" y="86" width="{max(160, math.ceil(len(class_names) / 8) * 132 + 12)}" height="{min(8, len(class_names)) * 17 + 28}" rx="5" fill="#0b1519" fill-opacity=".9"/><text x="24" y="96" class="small">ROAD CLASS</text>{''.join(legend_entries)}</g>
  <g transform="translate(28 820)"><text class="meta">Core: {counts['core_roads']} OSM highway ways · {counts['signals']} signals · {counts['crossings']} crossings · {counts['roundabout_ways']} roundabout ways + {counts['mini_roundabouts']} mini-roundabout nodes · {counts['bridges']} bridge-tagged ways</text><text y="20" class="meta">Context circle: {counts['context_roads']} highway ways ({counts['context_only_roads']} context-only) · {counts['components']} undirected components · {counts['stops']} unverified stop candidates</text><text y="40" class="small">Candidates require field verification. Zero mapped features means none were found in this snapshot; it does not confirm real-world absence.</text><a href="https://www.openstreetmap.org/copyright"><text y="58" class="small">© OpenStreetMap contributors · openstreetmap.org/copyright</text></a></g>
  <g transform="translate({1160-scale_px:.2f} 840)"><line x1="0" y1="0" x2="{scale_px:.2f}" y2="0" stroke="#eef3f4" stroke-width="3"/><line y1="-5" y2="5" stroke="#eef3f4"/><line x1="{scale_px:.2f}" x2="{scale_px:.2f}" y1="-5" y2="5" stroke="#eef3f4"/><text x="{scale_px/2:.2f}" y="17" text-anchor="middle" class="small">{scale_m} m</text></g>
  <g transform="translate(1150 102)"><path d="M 0 -18 L 8 8 L 0 4 L -8 8 Z" fill="#eef3f4"/><text x="0" y="-25" text-anchor="middle" class="legend">N</text></g>
</svg>'''


def count_layers(bundle: dict[str, Any]) -> dict[str, int]:
    roads = bundle["roads"]["features"]
    audit = bundle.get("audit", {})
    core_audit = audit.get("areas", {}).get("core", {})
    context_audit = audit.get("areas", {}).get("context", {})
    core_feature_counts = audit.get("mapped_core_feature_counts", {})
    roundabout_audit = audit.get("roundabouts", {})
    topology_audit = audit.get("topology", {})
    core_features = [
        feature
        for feature in bundle["features"]["features"]
        if feature.get("properties", {}).get("in_core") is True
        or feature.get("properties", {}).get("zone") == "core"
    ]
    core_types = [
        feature.get("properties", {}).get("feature_type") for feature in core_features
    ]
    core_roads = sum(
        1
        for road in roads
        if road.get("properties", {}).get("in_core") is True
        or road.get("properties", {}).get("zone") == "core"
    )
    context_circle_roads = sum(
        1
        for road in roads
        if road.get("properties", {}).get("zone") in {"core", "context"}
    )
    return {
        "core_roads": int(core_audit.get("road_way_count", core_roads)),
        "context_roads": int(
            context_audit.get("road_way_count", context_circle_roads)
        ),
        "context_only_roads": sum(
            1
            for road in roads
            if road.get("properties", {}).get("zone") == "context"
        ),
        "relation_completion_roads": sum(
            1
            for road in roads
            if road.get("properties", {}).get("zone") == "relation_completion"
        ),
        "signals": int(
            core_feature_counts.get(
                "traffic_signal", core_types.count("traffic_signal")
            )
        ),
        "crossings": int(
            core_feature_counts.get("crossing", core_types.count("crossing"))
        ),
        "mini_roundabouts": int(
            roundabout_audit.get(
                "core_mini_roundabout_node_count",
                core_types.count("mini_roundabout"),
            )
        ),
        "roundabout_ways": int(
            roundabout_audit.get(
                "core_roundabout_way_count",
                sum(
                    1
                    for road in roads
                    if road.get("properties", {}).get("zone") == "core"
                    and road.get("properties", {}).get("tags", {}).get("junction")
                    == "roundabout"
                ),
            )
        ),
        "bridges": int(
            core_audit.get("structure_way_counts", {}).get(
                "bridge",
                sum(
                    1
                    for road in roads
                    if road.get("properties", {}).get("zone") == "core"
                    and str(
                        road.get("properties", {}).get("bridge")
                        or road.get("properties", {}).get("tags", {}).get("bridge")
                        or ""
                    )
                    not in {"", "no"}
                ),
            )
        ),
        "components": int(topology_audit.get("context_undirected_components", 0)),
        "stops": len(bundle["stops"]["features"]),
    }


def render_html(bundle: dict[str, Any], center: tuple[float, float]) -> str:
    embedded = escape_json_for_script(
        {
            "study": bundle["study"],
            "roads": bundle["roads"],
            "features": bundle["features"],
            "stops": bundle["stops"],
            "manifest": bundle["manifest"],
            "center": center,
            "counts": count_layers(bundle),
        }
    )
    return HTML_TEMPLATE.replace("__EMBEDDED_DATA__", embedded)


def build(data_dir: Path, output_dir: Path) -> tuple[Path, Path]:
    derived = data_dir / "derived"
    bundle = {
        "study": read_feature_collection(derived / "study_areas.geojson"),
        "roads": read_feature_collection(derived / "road_network.geojson"),
        "features": read_feature_collection(derived / "map_features.geojson"),
        "stops": read_feature_collection(derived / "candidate_stops.geojson"),
        "audit": read_json(data_dir / "audit" / "audit_summary.json", required=False),
        "manifest": read_json(data_dir / "osm" / "manifest.json"),
    }
    center = get_center(
        bundle["study"],
        (bundle["roads"], bundle["features"], bundle["stops"]),
        bundle["manifest"],
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    html_path = output_dir / "lotus-tower-road-audit.html"
    svg_path = output_dir / "lotus-tower-road-audit.svg"
    html_path.write_text(render_html(bundle, center), encoding="utf-8")
    svg_path.write_text(render_static_svg(bundle, center), encoding="utf-8")
    return html_path, svg_path


def main() -> int:
    args = parse_args()
    try:
        html_path, svg_path = build(args.data_dir.resolve(), args.output_dir.resolve())
    except BuildError as exc:
        print(f"Map preview build failed: {exc}", file=sys.stderr)
        return 1
    print(f"Built {html_path}")
    print(f"Built {svg_path}")
    return 0


HTML_TEMPLATE = r'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lotus Tower road-data audit</title>
  <style>
    :root{color-scheme:dark;--bg:#0a1216;--panel:#122027;--line:#304852;--text:#edf3f4;--muted:#9eb1b8;--accent:#f3ce65;--focus:#75d3ee}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    a{color:#8ed8ef}.page{height:100vh;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr)}.masthead{padding:18px 22px 14px;border-bottom:1px solid var(--line);background:#0d181d}.masthead h1{font-size:clamp(20px,3vw,30px);margin:0}.masthead p{margin:4px 0 0;color:var(--muted)}.tag{display:inline-block;margin-left:8px;padding:2px 8px;border:1px solid #7c6b36;border-radius:999px;color:#ffe395;font-size:12px}
    .layout{min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 330px}.map-shell{position:relative;min-height:0;overflow:hidden;background:#101d22}.map-shell svg{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.map-shell svg.dragging{cursor:grabbing}.panel{min-height:0;overflow:auto;padding:18px;border-left:1px solid var(--line);background:var(--panel)}h2{font-size:16px;margin:0 0 10px}h3{font-size:13px;margin:20px 0 7px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
    .toolbar{position:absolute;z-index:3;top:12px;left:12px;display:flex;gap:6px}.toolbar button{width:36px;height:36px;border:1px solid #49626d;border-radius:6px;background:#14252ccc;color:var(--text);font-size:18px;cursor:pointer}.toolbar button:hover,.toolbar button:focus-visible{border-color:var(--focus);outline:2px solid transparent}.map-meta{position:absolute;z-index:2;left:12px;bottom:12px;display:flex;gap:10px;align-items:end;pointer-events:none}.scale{padding:5px 8px;background:#0b1519d9;border-radius:5px;color:#dbe6e9;font-size:11px}.scale-line{height:5px;border:solid #edf4f5;border-width:0 2px 2px;margin-bottom:3px}.north{padding:6px 9px;background:#0b1519d9;border-radius:5px;text-align:center;font-weight:800}.north::before{content:"▲";display:block;color:#e9f0f2}.notice{position:absolute;z-index:2;right:12px;bottom:12px;max-width:320px;padding:8px 10px;background:#0b1519e8;border:1px solid #4b6068;border-radius:5px;color:#c9d4d7;font-size:11px}
    fieldset{border:0;padding:0;margin:0}.toggle{display:flex;align-items:center;gap:8px;margin:6px 0;color:#d7e1e4}.toggle input{accent-color:var(--accent)}.legend{display:grid;grid-template-columns:18px 1fr;gap:6px 8px;align-items:center;color:#c4d1d5;font-size:12px}.swatch{height:4px;border-radius:4px}.stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.stat{padding:8px;background:#172a31;border:1px solid #294049;border-radius:5px}.stat strong{display:block;font-size:18px}.stat span{font-size:11px;color:var(--muted)}
    .details{min-height:180px;padding:11px;border:1px solid #304a54;border-radius:6px;background:#0e1b20;color:#dbe5e7}.details .empty{color:var(--muted)}.details dl{margin:0}.details dt{margin-top:8px;color:#8fa7af;font-size:11px;text-transform:uppercase}.details dd{margin:1px 0;overflow-wrap:anywhere}.tag-table{width:100%;border-collapse:collapse;margin-top:8px;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}.tag-table th,.tag-table td{text-align:left;vertical-align:top;padding:4px;border-top:1px solid #243940;overflow-wrap:anywhere}.tag-table th{width:38%;color:#9eb1b8;font-weight:500}
    .boundary{fill:none;vector-effect:non-scaling-stroke}.boundary.context{stroke:#536e77;stroke-width:1;stroke-dasharray:7 5}.boundary.core{fill:#1b3136;fill-opacity:.5;stroke:#e8c75f;stroke-width:2}.road{fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.9;vector-effect:non-scaling-stroke;cursor:pointer}.road.context{opacity:.48}.road.relation-completion{opacity:.22}.road.bridge{stroke-dasharray:10 3}.road:hover,.selectable:focus-visible,.selected{filter:drop-shadow(0 0 4px #ffffff);outline:none}.road-label{font-size:11px;fill:#d9e4e6;paint-order:stroke;stroke:#102027;stroke-width:3;stroke-linejoin:round;pointer-events:none;vector-effect:non-scaling-stroke}.symbol circle{stroke:#081115;stroke-width:1.5;vector-effect:non-scaling-stroke}.symbol text,.candidate text{font-weight:800;font-size:8px;fill:#071014;text-anchor:middle;pointer-events:none}.candidate circle{fill:#f3cf65;stroke:#0b1114;stroke-width:2;vector-effect:non-scaling-stroke}.candidate{cursor:pointer}.lotus-marker path{fill:#ffdd70}.lotus-marker circle{fill:none;stroke:#ffdd70;stroke-width:2;vector-effect:non-scaling-stroke}.lotus-marker text{font-size:12px;font-weight:800;fill:#ffdd70;paint-order:stroke;stroke:#102027;stroke-width:3;pointer-events:none}
    .hidden{display:none!important}.error{margin:20px;padding:16px;border:1px solid #d66666;background:#371d20;color:#ffd6d6;border-radius:6px}
    @media(max-width:850px){.page{height:auto;min-height:100vh;overflow:visible;display:block}.layout{overflow:visible;display:grid;grid-template-columns:1fr;grid-template-rows:520px auto}.panel{overflow:visible;border-left:0;border-top:1px solid var(--line)}.notice{max-width:240px}.map-shell{height:520px;min-height:0}}
  </style>
</head>
<body>
  <main class="page">
    <header class="masthead"><h1>Lotus Tower road-data audit <span class="tag">Stage 1 · not gameplay</span></h1><p id="snapshot">Stored OpenStreetMap audit preview</p></header>
    <div class="layout">
      <section class="map-shell" aria-label="Interactive road-data map">
        <div class="toolbar" aria-label="Map controls"><button id="zoom-in" type="button" aria-label="Zoom in">+</button><button id="zoom-out" type="button" aria-label="Zoom out">−</button><button id="reset" type="button" aria-label="Reset map view">↺</button></div>
        <svg id="map" tabindex="0" role="application" aria-label="Pan and zoom audit map. Use the arrow keys to pan, plus and minus to zoom, and Tab to select features."><g id="viewport"></g></svg>
        <div class="map-meta"><div class="north" aria-label="North is up">N</div><div class="scale"><div id="scale-line" class="scale-line"></div><span id="scale-label">metres</span></div></div>
        <div class="notice">Candidate stops require field verification. “0 mapped” means none were found in this snapshot; it does not confirm real-world absence.</div>
      </section>
      <aside class="panel">
        <h2>Audit layers</h2><fieldset id="layers"></fieldset>
        <h3>Snapshot counts</h3><div id="stats" class="stat-grid"></div>
        <h3>Road classes</h3><div id="legend" class="legend"></div>
        <h3>Selected source feature</h3><div id="details" class="details" aria-live="polite"><span class="empty">Select a road, mapped feature, or stop candidate for its OSM ID, tags, and audit notes.</span></div>
        <h3>Source</h3><p id="source" style="font-size:12px;color:#aebfc5"></p><p style="font-size:12px"><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a></p>
      </aside>
    </div>
  </main>
  <script id="audit-data" type="application/json">__EMBEDDED_DATA__</script>
  <script>
  (()=>{'use strict';
    const NS='http://www.w3.org/2000/svg';
    const roadStyles={motorway:['#d9563f',9],trunk:['#e66b45',8],primary:['#ed8c4a',7],secondary:['#e9ad50',6],tertiary:['#d8bd67',5],residential:['#6e9ca4',3.5],unclassified:['#7e99a1',3.2],service:['#8b9298',2.5],living_street:['#7a9f8d',3],cycleway:['#2f9f78',2.8],path:['#669773',2.1],footway:['#769987',1.8],pedestrian:['#82978c',2.5],steps:['#858585',1.8],default:['#78858e',2.6]};
    const featureGlyphs={traffic_signal:['#e64f4f','S'],crossing:['#36a8d4','X'],mini_roundabout:['#a877e5','R'],barrier:['#dd7c42','B'],entrance:['#5ca56f','E'],poi:['#c987bd','P'],restriction:['#f0c75e','!']};
    const svg=document.getElementById('map'), viewport=document.getElementById('viewport'), details=document.getElementById('details');
    const create=(name,attrs={},parent=viewport)=>{const el=document.createElementNS(NS,name);Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));parent.appendChild(el);return el};
    const h=(value)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    let data;try{data=JSON.parse(document.getElementById('audit-data').textContent)}catch(error){document.querySelector('.layout').innerHTML=`<div class="error">The embedded audit data could not be read: ${h(error.message)}</div>`;return}
    const [centerLon,centerLat]=data.center,R=6371008.8,rad=Math.PI/180,originLon=centerLon*rad,originLat=centerLat*rad;
    const project=([lon,lat])=>{const lambda=lon*rad,phi=lat*rad,delta=lambda-originLon,cosC=Math.sin(originLat)*Math.sin(phi)+Math.cos(originLat)*Math.cos(phi)*Math.cos(delta),c=Math.acos(Math.max(-1,Math.min(1,cosC))),k=c?c/Math.sin(c):1,x=R*k*Math.cos(phi)*Math.sin(delta),northing=R*k*(Math.cos(originLat)*Math.sin(phi)-Math.sin(originLat)*Math.cos(phi)*Math.cos(delta));return[x,-northing]};
    const parts=geometry=>{if(!geometry||!Array.isArray(geometry.coordinates))return[];const c=geometry.coordinates;switch(geometry.type){case'Point':return[[project(c)]];case'LineString':case'MultiPoint':return[[...c.map(project)]];case'Polygon':case'MultiLineString':return c.map(part=>part.map(project));case'MultiPolygon':return c.flatMap(poly=>poly.map(ring=>ring.map(project)));default:return[]}};
    const d=(points,close=false)=>points.length?`M ${points.map(p=>`${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ')}${close?' Z':''}`:'';
    const groups={boundaries:create('g',{id:'boundaries'}),roads:create('g',{id:'roads'}),labels:create('g',{id:'labels'}),signals:create('g',{id:'signals'}),crossings:create('g',{id:'crossings'}),roundabouts:create('g',{id:'roundabouts'}),restrictions:create('g',{id:'restrictions'}),otherFeatures:create('g',{id:'other-features'}),stops:create('g',{id:'stops'}),landmark:create('g',{id:'landmark'})};
    const allPoints=[];data.study.features.forEach(f=>parts(f.geometry).flat().forEach(p=>allPoints.push(p)));
    if(!allPoints.length){document.querySelector('.layout').innerHTML='<div class="error">The audit layers contain no drawable coordinates.</div>';return}
    const xs=allPoints.map(p=>p[0]),ys=allPoints.map(p=>p[1]),pad=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*.04||10;
    const home={x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,w:Math.max(...xs)-Math.min(...xs)+2*pad,h:Math.max(...ys)-Math.min(...ys)+2*pad};let view={...home};
    const applyView=()=>{svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);updateScale();updateScreenItems()};
    data.study.features.forEach(f=>parts(f.geometry).forEach(line=>create('path',{d:d(line,true),class:`boundary ${f.properties?.role||'context'}`},groups.boundaries)));
    const selection=new Map();let selected=null,selectIndex=0;
    const register=(el,kind,feature)=>{const id=`select-${++selectIndex}`;el.classList.add('selectable');el.setAttribute('tabindex','0');el.dataset.selection=id;selection.set(id,{kind,feature,el});el.addEventListener('click',event=>{event.stopPropagation();showSelection(id)});el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showSelection(id)}})};
    [...data.roads.features].sort((a,b)=>String(a.properties?.highway||a.properties?.tags?.highway||'').localeCompare(String(b.properties?.highway||b.properties?.tags?.highway||''))||Number(a.properties?.osm_id||0)-Number(b.properties?.osm_id||0)).forEach(f=>{const p=f.properties||{},roadClass=p.highway||p.tags?.highway||'default',[color,width]=roadStyles[roadClass]||roadStyles.default,bridge=String(p.bridge||p.tags?.bridge||''),scope=p.zone==='context'?'context':p.zone==='relation_completion'?'relation-completion':'';parts(f.geometry).forEach(line=>{const el=create('path',{d:d(line),class:`road ${scope} ${bridge&&bridge!=='no'?'bridge':''}`,stroke:color,'stroke-width':width},groups.roads);register(el,'road',f)})});
    const placeScreenItem=(g,point)=>{g.classList.add('screen-item');g.dataset.x=point[0];g.dataset.y=point[1]};
    const labelClasses=new Set(['trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link']),classRank={trunk:0,primary:1,secondary:2,tertiary:3,trunk_link:4,primary_link:5,secondary_link:6,tertiary_link:7};
    const named=new Set(),labelRoads=[...data.roads.features].sort((a,b)=>(a.properties?.zone==='core'?0:1)-(b.properties?.zone==='core'?0:1)||(classRank[a.properties?.highway||a.properties?.tags?.highway]??99)-(classRank[b.properties?.highway||b.properties?.tags?.highway]??99));labelRoads.forEach(f=>{const properties=f.properties||{},name=properties.name||properties.tags?.name,roadClass=properties.highway||properties.tags?.highway,line=parts(f.geometry)[0];if(!name||named.has(name)||!labelClasses.has(roadClass)||properties.zone==='relation_completion'||!line?.length)return;named.add(name);const point=line.reduce((best,p)=>p[0]*p[0]+p[1]*p[1]<best[0]*best[0]+best[1]*best[1]?p:best),g=create('g',{class:'road-label-item'},groups.labels),text=create('text',{x:0,y:-6,class:'road-label'},g);text.textContent=name;placeScreenItem(g,point)});
    const featureParents={traffic_signal:groups.signals,crossing:groups.crossings,mini_roundabout:groups.roundabouts,restriction:groups.restrictions};data.features.features.forEach(f=>{const p=f.properties||{},config=featureGlyphs[p.feature_type]||['#c987bd','•'],line=parts(f.geometry)[0];if(!line?.length)return;const point=line[Math.floor(line.length/2)],g=create('g',{class:'symbol'},featureParents[p.feature_type]||groups.otherFeatures);create('circle',{cx:0,cy:0,r:7,fill:config[0]},g);const text=create('text',{x:0,y:2.8},g);text.textContent=config[1];placeScreenItem(g,point);register(g,'mapped feature',f)});
    data.stops.features.forEach((f,index)=>{const point=parts(f.geometry)[0]?.[0];if(!point)return;const label=String(f.properties?.candidate_id||index+1).replace(/^stop-/,'');const g=create('g',{class:'candidate'},groups.stops);create('circle',{cx:0,cy:0,r:10},g);const text=create('text',{x:0,y:3},g);text.textContent=label;placeScreenItem(g,point);register(g,'candidate stop',f)});
    const lotus=create('g',{class:'lotus-marker'},groups.landmark);create('path',{d:'M 0 -13 L 9 9 L -9 9 Z'},lotus);create('circle',{cx:0,cy:0,r:16},lotus);const lotusText=create('text',{x:20,y:-10},lotus);lotusText.textContent='Lotus Tower centre';placeScreenItem(lotus,[0,0]);
    const layers=[['boundaries','Core + context boundaries',true],['roads','Road network',true],['labels','Major road names',true],['signals','Traffic signals',true],['crossings','Crossings',false],['roundabouts','Mini-roundabouts',false],['restrictions','Turn restrictions',false],['otherFeatures','POIs, entrances + barriers',false],['stops','Candidate stops',true],['landmark','Lotus Tower centre',true]];layers.forEach(([key,label,enabled])=>{const row=document.createElement('label');row.className='toggle';const input=document.createElement('input');input.type='checkbox';input.checked=enabled;groups[key].classList.toggle('hidden',!enabled);input.addEventListener('change',()=>{groups[key].classList.toggle('hidden',!input.checked);updateScreenItems()});row.append(input,document.createTextNode(label));document.getElementById('layers').append(row)});
    const presentClasses=[...new Set(data.roads.features.map(f=>f.properties?.highway||f.properties?.tags?.highway||'default'))].sort();presentClasses.forEach(cls=>{const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=(roadStyles[cls]||roadStyles.default)[0];const label=document.createElement('span');label.textContent=cls;document.getElementById('legend').append(swatch,label)});Object.entries(featureGlyphs).forEach(([name,[color,glyph]])=>{if(!data.features.features.some(f=>f.properties?.feature_type===name))return;const swatch=document.createElement('span');swatch.className='swatch';swatch.style.height='12px';swatch.style.background=color;swatch.title=glyph;const label=document.createElement('span');label.textContent=name.replaceAll('_',' ');document.getElementById('legend').append(swatch,label)});
    const statLabels={core_roads:'core highway ways',context_roads:'context-circle highway ways',context_only_roads:'context-only highway ways',relation_completion_roads:'relation-completion ways',signals:'core mapped signals',crossings:'core mapped crossings',roundabout_ways:'core roundabout ways',mini_roundabouts:'core mini-roundabout nodes',bridges:'core bridge-tagged ways',components:'context graph components',stops:'unverified stop candidates'};Object.entries(statLabels).forEach(([key,label])=>{const box=document.createElement('div');box.className='stat';const strong=document.createElement('strong');strong.textContent=data.counts[key];const span=document.createElement('span');span.textContent=label;box.append(strong,span);document.getElementById('stats').append(box)});
    const value=(v)=>v===null||v===undefined||v===''?'not mapped':Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):String(v);
    const tagTable=(title,tags)=>{const source=tags&&typeof tags==='object'?tags:{},rows=Object.entries(source).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`<tr><th>${h(k)}</th><td>${h(value(v))}</td></tr>`).join('');return rows?`<h3>${h(title)}</h3><table class="tag-table"><tbody>${rows}</tbody></table>`:`<p class="empty">No ${h(title.toLowerCase())} were supplied.</p>`};
    function showSelection(id){if(selected)selected.classList.remove('selected');const item=selection.get(id);if(!item)return;selected=item.el;selected.classList.add('selected');const p=item.feature.properties||{},tags=p.tags&&typeof p.tags==='object'?p.tags:{};let fields,tables;if(item.kind==='candidate stop'){fields=[['Type','unverified candidate stop'],['Candidate ID',p.candidate_id],['Source name',p.source_name],['Source OSM object',p.source_osm_type&&p.source_osm_id?`${p.source_osm_type}/${p.source_osm_id}`:null],['Source coordinate WGS84',p.source_coordinate_wgs84],['Road endpoint',p.osm_type&&p.osm_id?`${p.osm_type}/${p.osm_id}`:p.network_endpoint_osm_node_id?`node/${p.network_endpoint_osm_node_id}`:null],['Road endpoint WGS84',p.network_endpoint_wgs84],['Nearest road way',p.nearest_way_id?`way/${p.nearest_way_id}`:null],['Source-to-endpoint link distance',p.distance_to_network_m==null?null:`${p.distance_to_network_m} m straight line`],['Source-to-road segment distance',p.source_to_road_segment_distance_m==null?null:`${p.source_to_road_segment_distance_m} m straight line`],['Road bicycle access',p.network_access_bicycle_class],['Endpoint bicycle access',p.network_node_access_bicycle_class],['Source bicycle access',p.source_access_bicycle_class],['Reachable from anchor',p.structurally_reachable_from_anchor],['Can return to anchor',p.structurally_can_return_to_anchor],['Rationale',p.rationale],['Evidence',p.evidence],['Coordinate basis',p.coordinate_basis],['Caveats',p.caveats]];tables=tagTable('Road endpoint OSM tags',tags)+tagTable('Source POI / entrance OSM tags',p.source_tags)}else{fields=[['Type',item.kind],['Name',p.name??tags.name],['OSM source',p.osm_type&&p.osm_id?`${p.osm_type}/${p.osm_id}`:null],['Class / kind',p.highway||tags.highway||p.kind||p.category],['Audit scope',p.zone||(p.in_core===true?'core':p.in_core===false?'context':null)],['Direction',p.oneway??tags.oneway],['Access',p.access??tags.access],['Bicycle',p.bicycle??tags.bicycle],['Bridge',p.bridge??tags.bridge],['Restriction',p.restriction],['Caveats',p.caveats]];tables=tagTable('Complete OSM tags',tags)}const always=item.kind==='road'?new Set(['Name','Direction','Access','Bicycle']):new Set();const dl=fields.filter(([k,v])=>always.has(k)||(v!==null&&v!==undefined&&v!=='')).map(([k,v])=>`<dt>${h(k)}</dt><dd>${h(value(v))}</dd>`).join('');details.innerHTML=`<dl>${dl}</dl>${tables}`}
    const niceScale=raw=>{const power=10**Math.floor(Math.log10(raw)),base=raw/power;return(base<2?1:base<5?2:5)*power};function updateScale(){const ctm=svg.getScreenCTM(),pxPerMetre=ctm?Math.abs(ctm.a):0;if(!pxPerMetre)return;const metres=niceScale(110/pxPerMetre);document.getElementById('scale-line').style.width=`${metres*pxPerMetre}px`;document.getElementById('scale-label').textContent=`${metres>=1000?`${metres/1000} km`:`${metres} m`}`}
    function updateScreenItems(){const ctm=svg.getScreenCTM(),pxPerMetre=ctm?Math.abs(ctm.a):0;if(!pxPerMetre)return;const worldUnitsPerPixel=1/pxPerMetre;document.querySelectorAll('.screen-item').forEach(item=>item.setAttribute('transform',`translate(${item.dataset.x} ${item.dataset.y}) scale(${worldUnitsPerPixel})`));const occupied=[],mapRect=svg.getBoundingClientRect(),maxLabels=svg.clientWidth<600?7:view.w<home.w*.55?28:16;let visible=0;document.querySelectorAll('.road-label-item').forEach(item=>{item.style.display='';const box=item.getBoundingClientRect(),inside=box.left>=mapRect.left+8&&box.right<=mapRect.right-8&&box.top>=mapRect.top+8&&box.bottom<=mapRect.bottom-8,overlaps=occupied.some(other=>box.left<other.right+6&&box.right+6>other.left&&box.top<other.bottom+4&&box.bottom+4>other.top);if(!inside||overlaps||visible>=maxLabels)item.style.display='none';else{occupied.push(box);visible++}})}
    const mapPoint=(clientX,clientY)=>{const ctm=svg.getScreenCTM();return ctm?new DOMPoint(clientX,clientY).matrixTransform(ctm.inverse()):{x:view.x+view.w/2,y:view.y+view.h/2}};
    function zoom(factor,cx=view.x+view.w/2,cy=view.y+view.h/2){const nw=view.w*factor,nh=view.h*factor;view={x:cx-(cx-view.x)*factor,y:cy-(cy-view.y)*factor,w:nw,h:nh};applyView()}document.getElementById('zoom-in').onclick=()=>zoom(.75);document.getElementById('zoom-out').onclick=()=>zoom(1.333);document.getElementById('reset').onclick=()=>{view={...home};applyView()};svg.addEventListener('wheel',event=>{event.preventDefault();const point=mapPoint(event.clientX,event.clientY);zoom(event.deltaY<0?.82:1.22,point.x,point.y)},{passive:false});
    let drag=null;svg.addEventListener('pointerdown',event=>{if(event.target.closest('.selectable'))return;const ctm=svg.getScreenCTM();drag={x:event.clientX,y:event.clientY,sx:Math.abs(ctm?.a||1),sy:Math.abs(ctm?.d||1),view:{...view}};svg.setPointerCapture(event.pointerId);svg.classList.add('dragging')});svg.addEventListener('pointermove',event=>{if(!drag)return;view.x=drag.view.x-(event.clientX-drag.x)/drag.sx;view.y=drag.view.y-(event.clientY-drag.y)/drag.sy;applyView()});const endDrag=()=>{drag=null;svg.classList.remove('dragging')};svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);svg.addEventListener('keydown',event=>{const step=.08;if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.8)}else if(event.key==='-'){event.preventDefault();zoom(1.25)}else if(event.key==='ArrowLeft'){event.preventDefault();view.x-=view.w*step;applyView()}else if(event.key==='ArrowRight'){event.preventDefault();view.x+=view.w*step;applyView()}else if(event.key==='ArrowUp'){event.preventDefault();view.y-=view.h*step;applyView()}else if(event.key==='ArrowDown'){event.preventDefault();view.y+=view.h*step;applyView()}else if(event.key==='0'){event.preventDefault();view={...home};applyView()}});
    const manifest=data.manifest||{},sourceValue=manifest.osm_base_timestamp||manifest.fetched_at_utc||manifest.snapshot_id||manifest.snapshot_date||manifest.generated_at||manifest.downloaded_at||'stored Stage 1 snapshot';document.getElementById('snapshot').textContent=`Offline OpenStreetMap snapshot: ${sourceValue} · local azimuthal equidistant metres`;document.getElementById('source').textContent=`Rendered from the repository's reviewed Stage 1 snapshot (${sourceValue}). No live tiles or runtime network requests are used.`;applyView();new ResizeObserver(()=>{updateScale();updateScreenItems()}).observe(svg);
  })();
  </script>
</body>
</html>'''


if __name__ == "__main__":
    raise SystemExit(main())
