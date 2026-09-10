# Lotus Tower Map-Data Audit

## Purpose and decision status

This Stage 1 audit measures the OpenStreetMap coverage available for the first
Colombo Delivery prototype. It is a reproducible desk audit of one OSM snapshot.
It is enough to expose the first map-generation risks and screen possible
delivery endpoints. It does not verify present street conditions, legal access,
entrances, stopping safety, signal operation, or route suitability in the
field.

Stage 1 therefore remains open for manual validation. The extracted network and
preview can support the first road-generation prototype, provided the prototype
treats all unresolved items below as explicit assumptions or exclusions.

## Study area and coordinate reference

The study area has two fixed circles in a local spherical azimuthal-equidistant
projection:

- **Core:** the approximately one-kilometre-radius first-playable area around
  the mapped Lotus Tower anchor. Findings labelled `core` use this boundary.
- **Context:** the core plus approximately 500 metres on every side. Context
  data prevents roads at the gameplay edge from appearing disconnected only
  because the extract stopped there; it is not automatically in first-playable
  scope.

The acquisition uses the enclosing WGS84 rectangle
`[79.8447259, 6.9135367, 79.8719039, 6.9405163]`, ordered west, south, east,
north. The audit includes a road in a circle when one of its projected segments
touches or enters the boundary.

`data/derived/study_areas.geojson` is the authoritative machine-readable record
of the exact areas, anchor, and local projection parameters. The source
longitude and latitude remain authoritative. The audit uses the local projection
for small-area distance and clipping calculations and stores the resulting
measurements in metres.

The OSM anchor is way
[728831229](https://www.openstreetmap.org/way/728831229), centred at longitude
**79.8583149**, latitude **6.9270265**. The separate Colombo Atlas reference
origin is longitude **79.85832**, latitude **6.92703**. It is recorded for later
asset alignment and is not silently substituted for the OSM coordinate. The
Atlas origin is approximately 0.68 m northeast of the OSM anchor under the
audit's spherical distance model.

## Snapshot provenance

- OSM data timestamp: **2026-09-10 23:11:10 UTC**.
- Download completed: **2026-09-10 23:12:35 UTC**.
- Overpass endpoint:
  `https://overpass-api.de/api/interpreter`.
- Overpass generator: `Overpass API 0.7.62.11 87bfad18`.
- Query SHA-256:
  `25cc926964d06684e8e5665435d45c64cc06ad98a6f36189ab434ee8c9161a17`.
- Compressed snapshot SHA-256:
  `35ae3d3b68c95215ad1caf928ee8f9278a6b564ac4e8d7a1c539c681256f5a96`.
- Raw response: 10,014 nodes, 2,200 ways, and 26 relations before area
  filtering and audit classification.

The raw query uses Overpass JSON `out body`, so contributor `user` and `uid`
fields are excluded. The source snapshot is 222,763 bytes compressed and
1,632,078 bytes uncompressed. These sizes and the uncompressed digest are also
recorded in the manifest.

## Reproduce the audit

Requirements: Python 3.12 is recommended and is the tested version. The
published outputs were generated with Python 3.12.7 on arm64 macOS (Darwin
25.5.0); the scripts use only portable standard-library features. Run commands
from the repository root.

```sh
python3 scripts/audit_road_network.py
python3 scripts/build_map_preview.py
python3 -m unittest discover -s tests -v
```

The audit reads the committed snapshot and rewrites its outputs
deterministically. The preview builder embeds those reviewed results without
live tiles or runtime network requests. Re-running either step against the same
snapshot must not contact OSM.

The separate fetch command is an explicit snapshot refresh:

```sh
python3 scripts/fetch_osm_data.py
```

It is the only networked step and replaces the raw response, query, and
manifest, including the timestamps and SHA-256 digests. Run it only when
intentionally creating a new audit snapshot; because OSM is live, a refresh can
change the findings and must be reviewed and documented as a new snapshot.

## Outputs

| Path | Contents |
| --- | --- |
| `data/osm/manifest.json` | Source endpoint, query, timestamps, bounds, projection, and raw-file digest |
| `data/derived/study_areas.geojson` | Core and context boundaries plus coordinate references |
| `data/derived/road_network.geojson` | Extracted OSM highway ways and normalized audit properties |
| `data/derived/map_features.geojson` | Signals, crossings, barriers, entrances, and other audited point features |
| `data/derived/candidate_stops.geojson` | OSM-derived, graph-screened candidate delivery endpoints |
| `data/audit/audit_summary.json` | Counts, coverage measures, graph results, and method metadata |
| `data/audit/gap_inventory.json` | Structured missing or ambiguous evidence requiring follow-up |
| `data/audit/gap_inventory.csv` | Review-friendly form of the same gap inventory |
| `docs/maps/lotus-tower-road-audit.html` | Interactive offline audit preview |
| `docs/maps/lotus-tower-road-audit.svg` | Static audit preview |

The preview is an inspection aid, not a basemap or navigation product. The HTML
opens with boundaries, roads, curated major-road labels, signals, candidate
endpoints, and the Lotus Tower marker. Crossings, mini-roundabouts, turn
restrictions, POIs, entrances, and barriers can be enabled separately. It
supports pointer and keyboard pan, zoom, layer control, and source-feature
inspection, including separate source and road-endpoint details for candidates.
The static SVG keeps a quieter 16-road-label overview. Both outputs include OSM
attribution.

## Measurement definitions

Counts use deliberately different denominators:

- An **OSM way** is one source way element. A physical named street can consist
  of several ways because its tags, junctions, or geometry change.
- A **road identity** is a connected component of ways grouped by normalized
  name, reference, or, for unnamed ways, highway class. This is a heuristic for
  a less fragmented summary, not a surveyed count of physical streets.
- A **graph node** is an extracted network coordinate. An **intersection** is a
  shared OSM node with at least three distinct adjacent graph nodes under the
  audit's topology rules; it is not necessarily one physical junction or signal
  phase.
- Attribute coverage uses eligible road ways as its denominator and reports the
  numerator as well as the percentage. A missing tag means “not recorded in
  this snapshot,” not that the feature is absent in reality.
- A zero mapped-feature count means the query found no matching tags in the
  defined area. It does not confirm real-world absence.
- Core and context results are reported separately. Context totals must not be
  presented as the first playable area's content.

Road connectivity is based on shared OSM nodes. Where bridges, tunnels, or
layered crossings do not share a node, the graph keeps them separate. The audit
reports structural components and basic directed edges, but it is not yet a
complete bicycle router: it does not establish all jurisdictional defaults,
conditional rules, barriers, turn restrictions, lane movements, or safe
crossing behaviour.

## Tag rules used in review

The audit follows the OSM interpretation summarized in
[Data Sources, Provenance, and Licensing](DATA_SOURCES.md). In particular,
specific bicycle access overrides general access, explicit bicycle one-way
tags can override the general one-way direction, and turn-restriction relations
must be evaluated as `from`–`via`–`to` movements with mode exceptions. Lane
counts describe motorised traffic lanes and cannot supply road width.

Signal nodes only show that control is mapped. They do not establish real phase
order, duration, approach assignment, or stop-line geometry. Any game signal
plan will be authored and labelled as a simulation until separately verified.

## Candidate delivery points

Candidate sources are mapped OSM POIs or entrances. Each output geometry is an
existing highway node selected as the road endpoint; the source coordinate and
source OSM identifier remain separate properties. The screen requires a source
within 100 m of an endpoint, removes explicit prohibited or restricted bicycle
access on the source, linked way, or endpoint node, checks directed structural
travel from and back to the anchor, and prefers spatially distributed sources.
It leaves missing access defaults and turn restrictions unresolved.

Coordinates, source and endpoint identifiers, linkage distances, evidence, and
caveats are retained in GeoJSON. “Candidate” means graph-screened only; it does
not mean that a rider can lawfully or safely stop there, enter the property,
carry a parcel to the recipient, or reach it on a currently traversable bicycle
route.

A provisional, non-release prototype can use these endpoints as test markers if
it carries their unverified status and routing assumptions into the interface
and test record. Before a candidate is presented as a verified real-world pickup
or drop-off, manually verify:

1. The feature and entrance still exist at the recorded coordinate.
2. The arrival point is on the correct side of the road or has a safe crossing.
3. Bicycle access and the final approach are legal and physically passable.
4. Stopping does not obstruct traffic or place the rider in an unsafe position.
5. The full route respects directions, restrictions, barriers, and junction
   controls in both travel directions required by the job.

## Data validation

All 12 unit tests pass. They cover boundary clipping, projection units,
non-connected geometric crossings, reverse one-way handling, bicycle contraflow
overrides, conditional direction, access precedence, partial-source rejection,
strict explicit-access lower bounds, restriction member completeness, crossing
classification, source hashes, deterministic offline regeneration, and
candidate-output invariants.

Independent PyProj and Shapely calculations reproduced the core and context way
counts and clipped centreline lengths. A separate raw-snapshot check confirmed
all 15 candidate source and endpoint node identities, tags, core containment,
nearest-way linkage, and uniqueness. These checks validate the generated data
contract and computations; they do not replace the manual street checks below.

Browser QA at 1280 × 720 and 390 × 844 confirmed working zoom, reset, layer
controls, and separate candidate source and road-endpoint details, with no
horizontal overflow or console errors; the static SVG rendered with visible OSM
attribution.

## Findings

The generated summary and gap inventory are the authoritative detailed results.
The following values are rounded only where shown.

| Measure | Core, 1,000 m radius | Context, 1,500 m radius |
| --- | ---: | ---: |
| OSM `highway=*` ways intersecting the area | 700 | 1,688 |
| Clipped highway centreline length | 60,253.5 m | 151,853.3 m |
| Motor-road ways used for motor attribute coverage | 571 | 1,310 |
| Heuristic road-identity groups | 352 | 806 |
| Graph nodes | 2,826 | 6,380 |
| Graph intersection nodes | 653 | 1,604 |

The 700-way core includes service roads, footways, paths, pedestrian ways, and
steps as well as motor roads. It must not be described as 700 streets. The
clipped length is a sum of OSM highway centrelines; parallel carriageways and
separately mapped paths are counted separately. An independent recomputation
with PyProj and Shapely matched both way counts and clipped lengths.

Core tag coverage shows where geometry generation and routing need explicit
defaults or more evidence:

| Tag | Present / denominator | Coverage |
| --- | ---: | ---: |
| Name, all highway ways | 268 / 700 | 38.29% |
| General access, all highway ways | 39 / 700 | 5.57% |
| Bicycle access, all highway ways | 5 / 700 | 0.71% |
| Explicit one-way tag, all highway ways | 201 / 700 | 28.71% |
| Name, motor-road ways | 262 / 571 | 45.88% |
| Lane count, motor-road ways | 107 / 571 | 18.74% |
| Width, motor-road ways | 10 / 571 | 1.75% |
| Maximum speed, motor-road ways | 289 / 571 | 50.61% |

Missing tags are not automatically errors. Unnamed service roads and footways
can be normal, and the absence of `oneway=*` commonly means an implicit default.
However, the very low explicit bicycle-access and width coverage means the
snapshot alone cannot establish legal bicycle routing or reliable road widths.
The game importer will need documented, locally checked defaults and targeted
manual corrections.

The core contains 23 mapped traffic-signal nodes, 146 mapped crossing nodes,
one mini-roundabout node, four roundabout ways, 22 bridge-tagged ways, 26 mapped
barrier features (25 nodes and one way), 12 mapped entrance nodes, and 153
selected POIs (100 nodes and 53 ways). No tunnel-tagged way was found in the
core. Each number means only that matching OSM evidence was present or absent in
this snapshot. In particular, the signal count is not an intersection count or
phase-plan count, and zero mapped tunnels is not field confirmation that no
tunnel condition exists.

The query returned 26 turn-restriction relations, all structurally complete
under the audit's member-reference check. Nine are in the core, five are in the
remaining context area, and 12 were pulled in to complete referenced relations.
The structural graph does not yet apply them and does not validate whether the
mapped restrictions are current or exhaustive.

The context graph has 6,380 nodes in 15 undirected components; its largest
component contains 6,304 nodes. Following mapped one-way direction and bicycle
overrides reaches 6,234 nodes from the network node nearest Lotus Tower and can
return from the screened candidate endpoints. This is structural evidence only:
the check does not apply turn relations or unresolved access defaults. A strict
graph containing only explicitly bicycle-allowed ways cannot leave the anchor,
which demonstrates why the missing access evidence prevents a legal-route
claim. The nearest graph node is 41.6 m from the tower anchor.

The gap inventory contains 8,554 rows. Each row records one missing tag on one
OSM way in either the core or context buffer; it is not 8,554 distinct defects,
unsafe places, or broken roads. The machine-readable inventory is intentionally
exhaustive so reviewers can filter by scope, road class, field, or route before
doing targeted checks.

Fifteen candidate endpoints were selected from 67 graph-screened possibilities:
three mapped entrances, ten parking amenities, one fuel station, and one post
office. Each published endpoint is an existing OSM highway node; the separate
source coordinate and source OSM identifier are retained. Selection excludes
explicitly restricted or prohibited bicycle access on the source, linked way,
or endpoint node, links the source to an endpoint within 100 m, checks
structural travel from and back to the anchor under mapped bicycle direction,
and keeps the selected sources at least 100 m apart. All 15 still have
unresolved bicycle access because the relevant explicit tags are missing. They
are candidates for manual review, not verified destinations.

For the first targeted road review, the audit supplies this illustrative
structural loop:

```text
network node 6828341489 → stop-02 → stop-10 → stop-07 → stop-01 → node 6828341489
```

Its mapped network length is 4,375.1 m, with legs of 180.2 m, 1,060.2 m,
914.9 m, 1,311.9 m, and 907.9 m. This is a useful sequence for inspecting the
first set of roads because it starts and ends at the same graph node and
exercises four distributed candidates. Node 6828341489 is the audit's nearest
network anchor, 41.6 m from the tower centre; it is not a manually approved
Lotus Tower arrival point. This loop is not a recommended delivery route: the
shortest paths honour supported bicycle direction tags but treat conditional
direction as structurally bidirectional, leave missing access unresolved, and
do not apply turn restrictions, curb legality, surface quality, safety, or
field conditions. Validate every movement before using it in gameplay.

## Open verification gates

- Inspect every proposed first-route movement against current signage and road
  geometry, including bicycle access and one-way exceptions.
- Confirm bridge, tunnel, and layer separation at every apparent crossing on
  the first route.
- Confirm candidate entrances and legal, safe stopping positions in person or
  from an authorised current source.
- Record signal approaches, stop lines, crossing controls, and an authored game
  phase plan without claiming real timing.
- Resolve high-priority items in `gap_inventory.json`; record intentional game
  assumptions for lower-priority missing tags.
- Run a turn-aware, bicycle-aware route check before calling any candidate
  reachable for gameplay.
