from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import audit_road_network as audit
import fetch_osm_data as fetch


class GeometryTests(unittest.TestCase):
    def test_circle_clip_counts_boundary_crossing_with_both_nodes_outside(self) -> None:
        length = audit.segment_circle_length((-2.0, 0.0), (2.0, 0.0), 1.0)
        self.assertAlmostEqual(length, 2.0, places=9)
        self.assertTrue(audit.line_intersects_circle([(-2.0, 0.0), (2.0, 0.0)], 1.0))

    def test_projection_radius_and_units(self) -> None:
        projection = audit.SphericalAEQD(79.8583149, 6.9270265, 6_371_008.8)
        boundary_coordinate = projection.inverse((1000.0, 0.0))
        x, y = projection.forward(boundary_coordinate)
        self.assertAlmostEqual(x, 1000.0, delta=0.01)
        self.assertAlmostEqual(y, 0.0, delta=0.01)

    def test_geometric_crossing_without_shared_osm_node_stays_disconnected(self) -> None:
        roads = [
            {"id": 10, "nodes": [1, 2], "tags": {"highway": "primary"}},
            {"id": 20, "nodes": [3, 4], "tags": {"highway": "secondary", "layer": "1"}},
        ]
        points = {1: (-10.0, 0.0), 2: (10.0, 0.0), 3: (0.0, -10.0), 4: (0.0, 10.0)}
        edges = audit.road_edges(roads, points, 100.0)
        adjacency: dict[int, set[int]] = {}
        for first, second, *_ in edges:
            adjacency.setdefault(first, set()).add(second)
            adjacency.setdefault(second, set()).add(first)
        self.assertEqual(len(audit.connected_components(adjacency)), 2)


class DirectionAndAccessTests(unittest.TestCase):
    def test_oneway_minus_one_reverses_way_order(self) -> None:
        self.assertEqual(audit.directed_pairs(1, 2, {"oneway": "-1"}, "motor_vehicle"), [(2, 1)])

    def test_bicycle_oneway_override_restores_both_directions(self) -> None:
        tags = {"oneway": "yes", "oneway:bicycle": "no"}
        self.assertEqual(audit.directed_pairs(1, 2, tags, "motor_vehicle"), [(1, 2)])
        self.assertEqual(audit.directed_pairs(1, 2, tags, "bicycle"), [(1, 2), (2, 1)])

    def test_modern_cycleway_side_contraflow_and_conditional_are_explicit(self) -> None:
        contraflow = {"oneway": "yes", "cycleway:left": "lane", "cycleway:left:oneway": "-1"}
        same_as_reverse = {"oneway": "-1", "cycleway:left": "lane", "cycleway:left:oneway": "-1"}
        conditional = {"oneway": "yes", "oneway:bicycle:conditional": "no @ (Mo-Fr)"}
        self.assertEqual(audit.road_direction(contraflow, "bicycle"), "both")
        self.assertEqual(audit.road_direction(same_as_reverse, "bicycle"), "reverse")
        self.assertEqual(audit.road_direction(conditional, "bicycle"), "unresolved")
        self.assertEqual(audit.road_direction({"oneway": "reversible"}, "motor_vehicle"), "unresolved")

    def test_mode_tag_overrides_general_access_and_conditional_stays_unknown(self) -> None:
        self.assertEqual(audit.access_class({"access": "no", "bicycle": "yes"}, "bicycle"), ("allowed", "bicycle"))
        self.assertEqual(
            audit.access_class({"motor_vehicle": "no", "motor_vehicle:conditional": "yes @ (delivery)"}, "motor_vehicle"),
            ("unresolved", "conditional"),
        )
        self.assertEqual(audit.access_class({}, "motor_vehicle"), ("unresolved", None))

    def test_explicit_access_lower_bound_excludes_unresolved_direction(self) -> None:
        tags = {"bicycle": "yes", "oneway:bicycle:conditional": "no @ (Mo-Fr)"}
        self.assertEqual(audit.access_class(tags, "bicycle"), ("allowed", "bicycle"))
        self.assertEqual(audit.road_direction(tags, "bicycle"), "unresolved")
        self.assertFalse(audit.qualifies_for_explicit_allowed_graph(tags, "bicycle"))


class AcquisitionValidationTests(unittest.TestCase):
    def test_rejects_partial_overpass_response_with_remark(self) -> None:
        payload = {
            "osm3s": {"timestamp_osm_base": "2026-01-01T00:00:00Z"},
            "remark": "runtime error: Query timed out",
            "elements": [{"type": "way", "id": fetch.ANCHOR["osm_id"], "tags": {"name": fetch.ANCHOR["name"]}}],
        }
        with self.assertRaisesRegex(ValueError, "incomplete-response remark"):
            fetch.validate_snapshot(json.dumps(payload).encode())

    def test_rejects_missing_member_reference(self) -> None:
        payload = {
            "osm3s": {"timestamp_osm_base": "2026-01-01T00:00:00Z"},
            "elements": [
                {"type": "way", "id": fetch.ANCHOR["osm_id"], "nodes": [123], "tags": {"name": fetch.ANCHOR["name"]}}
            ],
        }
        with self.assertRaisesRegex(ValueError, "Referenced OSM members are missing"):
            fetch.validate_snapshot(json.dumps(payload).encode())


class FeatureClassificationTests(unittest.TestCase):
    def test_pedestrian_street_is_not_counted_as_crossing(self) -> None:
        self.assertIsNone(audit.classify_feature({"highway": "pedestrian"}, "way"))
        self.assertEqual(audit.classify_feature({"highway": "crossing"}, "node"), ("crossing", "crossing"))


class OfflineArtifactTests(unittest.TestCase):
    def test_manifest_hashes_and_offline_rerun_are_deterministic(self) -> None:
        manifest = json.loads((ROOT / "data/osm/manifest.json").read_text())
        compressed = (ROOT / manifest["snapshot_file"]).read_bytes()
        self.assertEqual(hashlib.sha256(compressed).hexdigest(), manifest["snapshot_sha256_compressed"])
        self.assertEqual(hashlib.sha256(gzip.decompress(compressed)).hexdigest(), manifest["snapshot_sha256_uncompressed"])

        outputs = [
            ROOT / "data/derived/road_network.geojson",
            ROOT / "data/derived/map_features.geojson",
            ROOT / "data/derived/study_areas.geojson",
            ROOT / "data/derived/candidate_stops.geojson",
            ROOT / "data/audit/audit_summary.json",
            ROOT / "data/audit/gap_inventory.json",
            ROOT / "data/audit/gap_inventory.csv",
        ]
        before = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in outputs}
        subprocess.run([sys.executable, str(ROOT / "scripts/audit_road_network.py")], cwd=ROOT, check=True, capture_output=True, text=True)
        after = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in outputs}
        self.assertEqual(before, after)

        candidates = json.loads((ROOT / "data/derived/candidate_stops.geojson").read_text())
        for feature in candidates["features"]:
            properties = feature["properties"]
            self.assertEqual(properties["osm_type"], "node")
            self.assertEqual(feature["geometry"]["coordinates"], properties["network_endpoint_wgs84"])
            self.assertTrue(properties["structurally_reachable_from_anchor"])
            self.assertTrue(properties["structurally_can_return_to_anchor"])
            self.assertNotIn(properties["network_access_bicycle_class"], {"prohibited", "restricted"})
            self.assertNotIn(properties["network_node_access_bicycle_class"], {"prohibited", "restricted"})
            self.assertIn("source_tags", properties)


if __name__ == "__main__":
    unittest.main()
